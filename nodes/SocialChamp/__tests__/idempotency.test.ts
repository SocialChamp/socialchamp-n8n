import { runExecute } from './test-helpers';

const key = (headers?: Record<string, string>) => headers?.['Idempotency-Key'];

describe('idempotency key', () => {
	it('sends a key on every create', async () => {
		const { requests } = await runExecute([{}]);

		expect(key(requests[0].headers)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('uses a key supplied by the workflow author verbatim', async () => {
		const { requests } = await runExecute([
			{ additionalFields: { idempotencyKey: 'order-4821' } },
		]);

		expect(key(requests[0].headers)).toBe('order-4821');
	});

	it('derives the same key for the same execution and payload', async () => {
		const a = await runExecute([{ text: 'same' }], { executionId: 'exec-42' });
		const b = await runExecute([{ text: 'same' }], { executionId: 'exec-42' });

		expect(key(a.requests[0].headers)).toBe(key(b.requests[0].headers));
	});

	it('derives a different key when the text changes', async () => {
		const a = await runExecute([{ text: 'one' }], { executionId: 'exec-42' });
		const b = await runExecute([{ text: 'two' }], { executionId: 'exec-42' });

		expect(key(a.requests[0].headers)).not.toBe(key(b.requests[0].headers));
	});

	it('derives a different key for a different execution', async () => {
		const a = await runExecute([{ text: 'same' }], { executionId: 'exec-1' });
		const b = await runExecute([{ text: 'same' }], { executionId: 'exec-2' });

		expect(key(a.requests[0].headers)).not.toBe(key(b.requests[0].headers));
	});

	// Two items with identical content are two intended posts, not a retry.
	it('derives a different key per item within one execution', async () => {
		const { requests } = await runExecute([{ text: 'same' }, { text: 'same' }]);

		expect(key(requests[0].headers)).not.toBe(key(requests[1].headers));
	});

	it('reuses the same key across the retries of one attempt', async () => {
		const { requests } = await runExecute([{}], {
			responses: [
				{ __throw: { statusCode: 429, httpCode: '429', response: { headers: { 'retry-after': '0' } } } },
				{ data: [{ id: 'post-1' }] },
			],
		});

		expect(requests).toHaveLength(2);
		expect(key(requests[0].headers)).toBe(key(requests[1].headers));
	});

	it('does not send an idempotency key on a read', async () => {
		const { requests } = await runExecute([{ resource: 'channel' }], { responses: [[]] });

		expect(key(requests[0].headers)).toBeUndefined();
	});
});
