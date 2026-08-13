import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

const DEFAULT_BASE_URL = 'https://www.socialchamp.com/secure/api/v1';

/** 429 and transient 5xx are worth retrying; everything else is the caller's fault. */
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

type Context = IExecuteFunctions | ILoadOptionsFunctions;

function statusOf(error: unknown): number | undefined {
	const candidate = error as { httpCode?: string; statusCode?: number };
	if (typeof candidate?.statusCode === 'number') return candidate.statusCode;
	const parsed = Number(candidate?.httpCode);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Honour Retry-After when the API sends one, otherwise back off exponentially.
 * Retry-After may be seconds or an HTTP date; both are in the spec.
 */
function backoffMs(error: unknown, attempt: number): number {
	const headers = (error as { response?: { headers?: Record<string, unknown> } })?.response?.headers;
	const raw = headers?.['retry-after'] ?? headers?.['Retry-After'];

	if (typeof raw === 'string' || typeof raw === 'number') {
		const seconds = Number(raw);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.min(seconds * 1000, MAX_BACKOFF_MS);
		}
		const at = Date.parse(String(raw));
		if (Number.isFinite(at)) {
			return Math.min(Math.max(at - Date.now(), 0), MAX_BACKOFF_MS);
		}
	}

	return Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

/** Turn the API's own wording into something a workflow author can act on. */
function describe(error: unknown): string | undefined {
	switch (statusOf(error)) {
		case 400:
		case 401:
			return 'Social Champ rejected the API key. Check that the key in the credential is current and has not been revoked.';
		case 403:
			return "The API key is valid but lacks permission for this operation. Check the key's scopes in Social Champ.";
		case 429:
			return 'Social Champ is rate limiting this key. The node already retried with backoff - lower the workflow concurrency or add a Wait node.';
		default:
			return undefined;
	}
}

export async function socialChampApiRequest(
	this: Context,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	headers: IDataObject = {},
): Promise<IDataObject | IDataObject[]> {
	const credentials = await this.getCredentials('socialChampApi');
	const baseUrl = ((credentials.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${resource}`,
		headers: { 'Content-Type': 'application/json', ...headers },
		qs,
		json: true,
	};

	if (Object.keys(body).length) {
		options.body = body;
	} else {
		delete options.body;
	}

	let lastError: unknown;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'socialChampApi',
				options,
			)) as IDataObject | IDataObject[];
		} catch (error) {
			lastError = error;

			const status = statusOf(error);
			const retryable = status !== undefined && RETRYABLE_STATUS.includes(status);

			// Auth, permission and validation failures never get retried - a retry
			// cannot fix them and, for a create, it risks a second post.
			if (!retryable || attempt === MAX_ATTEMPTS) break;

			await sleep(backoffMs(error, attempt));
		}
	}

	throw new NodeApiError(this.getNode(), lastError as JsonObject, {
		message: describe(lastError),
	});
}

/**
 * GET /profile answers with the channel array directly, but the gateway has
 * historically wrapped it in `{ data: [...] }`. Accept both.
 */
export function unwrapList(response: IDataObject | IDataObject[]): IDataObject[] {
	if (Array.isArray(response)) return response;
	const inner = (response as IDataObject)?.data;
	if (Array.isArray(inner)) return inner as IDataObject[];
	return inner ? [inner as IDataObject] : [];
}
