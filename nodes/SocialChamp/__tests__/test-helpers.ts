import type { IDataObject, INodeExecutionData, INodePropertyOptions } from 'n8n-workflow';
import { SocialChamp } from '../SocialChamp.node';

export interface CapturedRequest {
	method: string;
	url: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: Record<string, string>;
}

/** A response the mock API returns, or an error it throws instead. */
export type MockResponse = unknown | { __throw: MockHttpError };

export interface MockHttpError {
	message?: string;
	httpCode?: string;
	statusCode?: number;
	response?: { headers?: Record<string, unknown> };
}

export function httpError(
	statusCode: number,
	headers?: Record<string, unknown>,
	message = 'request failed',
): { __throw: MockHttpError } {
	return {
		__throw: {
			message,
			statusCode,
			httpCode: String(statusCode),
			...(headers ? { response: { headers } } : {}),
		},
	};
}

function isThrow(value: MockResponse): value is { __throw: MockHttpError } {
	return typeof value === 'object' && value !== null && '__throw' in value;
}

export interface RunOptions {
	/**
	 * Responses returned in call order. When there are more calls than
	 * responses the last entry is reused, which keeps retry tests short.
	 */
	responses?: MockResponse[];
	continueOnFail?: boolean;
	credentials?: IDataObject;
	executionId?: string;
}

const POST_DEFAULTS: Record<string, unknown> = {
	resource: 'post',
	operation: 'create',
	channelIds: ['chan-1'],
	text: 'hello world',
	postType: 'NOW',
	additionalFields: {},
};

const CHANNEL_DEFAULTS: Record<string, unknown> = {
	resource: 'channel',
	operation: 'getAll',
	returnAll: true,
	limit: 50,
	workspaceId: '',
};

/**
 * Runs the node's execute() against a mocked n8n context, one entry in
 * `itemsParams` per input item. Returns every request the node made plus the
 * items it emitted, so a test can assert on the request body and the output.
 */
export async function runExecute(
	itemsParams: Record<string, unknown>[],
	options: RunOptions = {},
): Promise<{ requests: CapturedRequest[]; returnData: INodeExecutionData[] }> {
	const node = new SocialChamp();
	const requests: CapturedRequest[] = [];
	const responses = options.responses ?? [[]];

	const items = itemsParams.map((params) => ({
		...(params.resource === 'channel' ? CHANNEL_DEFAULTS : POST_DEFAULTS),
		...params,
	}));

	const context = {
		getInputData: () => items.map(() => ({ json: {} })),
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const params = items[itemIndex];
			if (!params || !(name in params)) {
				return fallback !== undefined ? fallback : '';
			}
			return params[name];
		},
		getCredentials: async () =>
			options.credentials ?? {
				apiKey: 'test-key',
				baseUrl: 'https://www.socialchamp.com/secure/api/v1',
			},
		getNode: () => ({
			name: 'Social Champ',
			type: 'socialChamp',
			typeVersion: 1,
			position: [0, 0],
		}),
		getExecutionId: () => options.executionId ?? 'exec-1',
		helpers: {
			httpRequestWithAuthentication: {
				call: async (_thisArg: unknown, _credType: string, opts: CapturedRequest) => {
					requests.push(opts);
					const next = responses[Math.min(requests.length - 1, responses.length - 1)];
					if (isThrow(next)) throw next.__throw;
					return next;
				},
			},
		},
		continueOnFail: () => options.continueOnFail ?? false,
	};

	const returnData = (await node.execute.call(
		context as never,
	)) as unknown as INodeExecutionData[][];

	return { requests, returnData: returnData[0] };
}

/** Runs the getChannels loadOptions method against a mocked context. */
export async function runLoadChannels(
	response: MockResponse,
): Promise<{ requests: CapturedRequest[]; options: INodePropertyOptions[] }> {
	const node = new SocialChamp();
	const requests: CapturedRequest[] = [];

	const context = {
		getCredentials: async () => ({
			apiKey: 'test-key',
			baseUrl: 'https://www.socialchamp.com/secure/api/v1',
		}),
		getNode: () => ({
			name: 'Social Champ',
			type: 'socialChamp',
			typeVersion: 1,
			position: [0, 0],
		}),
		helpers: {
			httpRequestWithAuthentication: {
				call: async (_thisArg: unknown, _credType: string, opts: CapturedRequest) => {
					requests.push(opts);
					if (isThrow(response)) throw response.__throw;
					return response;
				},
			},
		},
	};

	const options = await node.methods.loadOptions.getChannels.call(context as never);
	return { requests, options };
}

export const CHANNELS = [
	{ id: 'chan-1', name: 'Acme Marketing', type: 'IG_BUSINESS', workspaceId: 'ws-1' },
	{ id: 'chan-2', name: 'Acme Support', type: 'TW', workspaceId: 'ws-2' },
	{ id: 'chan-3', name: 'Zeta Brand', type: 'FB_PAGE', workspaceId: 'ws-1' },
];
