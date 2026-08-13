import { httpError, runExecute } from './test-helpers';

const OK = { data: [{ id: 'post-1' }] };

describe('error handling and retries', () => {
	// A retry cannot fix a bad key, and for a create it risks a second post.
	it.each([400, 401, 403, 404, 422])('does not retry %i', async (status) => {
		const { requests } = await runExecute([{}], {
			responses: [httpError(status)],
			continueOnFail: true,
		});

		expect(requests).toHaveLength(1);
	});

	it('explains a 401 in terms of the credential', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [httpError(401)],
			continueOnFail: true,
		});

		expect(returnData[0].json.error).toMatch(/API key/i);
	});

	it('explains a 403 in terms of missing permission', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [httpError(403)],
			continueOnFail: true,
		});

		expect(returnData[0].json.error).toMatch(/permission/i);
	});

	it('retries a 429 and succeeds on the second attempt', async () => {
		const { requests, returnData } = await runExecute([{}], {
			responses: [httpError(429, { 'retry-after': '0' }), OK],
		});

		expect(requests).toHaveLength(2);
		expect(returnData[0].json).toEqual({ id: 'post-1' });
	});

	it.each([500, 502, 503, 504])('retries a transient %i', async (status) => {
		const { requests } = await runExecute([{}], {
			responses: [httpError(status, { 'retry-after': '0' }), OK],
		});

		expect(requests).toHaveLength(2);
	});

	it('gives up after three attempts rather than retrying forever', async () => {
		const { requests } = await runExecute([{}], {
			responses: [httpError(429, { 'retry-after': '0' })],
			continueOnFail: true,
		});

		expect(requests).toHaveLength(3);
	});

	it('mentions rate limiting when a 429 survives every retry', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [httpError(429, { 'retry-after': '0' })],
			continueOnFail: true,
		});

		expect(returnData[0].json.error).toMatch(/rate limit/i);
	});

	it('honours a Retry-After given as an HTTP date', async () => {
		const at = new Date(Date.now() + 10).toUTCString();
		const { requests } = await runExecute([{}], {
			responses: [httpError(429, { 'retry-after': at }), OK],
		});

		expect(requests).toHaveLength(2);
	});

	it('retries the channel read too', async () => {
		const { requests } = await runExecute([{ resource: 'channel' }], {
			responses: [httpError(503, { 'retry-after': '0' }), []],
		});

		expect(requests).toHaveLength(2);
	});
});
