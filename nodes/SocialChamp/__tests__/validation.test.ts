import { runExecute } from './test-helpers';

describe('post: input validation', () => {
	it('rejects an empty channel selection', async () => {
		await expect(runExecute([{ channelIds: [] }])).rejects.toThrow(
			/at least one channel/i,
		);
	});

	it('rejects empty text', async () => {
		await expect(runExecute([{ text: '' }])).rejects.toThrow(/text cannot be empty/i);
	});

	it('rejects whitespace-only text', async () => {
		await expect(runExecute([{ text: '   \n\t ' }])).rejects.toThrow(
			/text cannot be empty/i,
		);
	});

	it('does not reach the API when validation fails', async () => {
		const { requests } = await runExecute([{ channelIds: [] }], { continueOnFail: true });

		expect(requests).toHaveLength(0);
	});

	it('rejects an unsupported resource and operation pair', async () => {
		await expect(
			runExecute([{ resource: 'post', operation: 'delete' }]),
		).rejects.toThrow(/not supported/i);
	});
});

describe('continueOnFail', () => {
	it('puts the error on the item instead of throwing', async () => {
		const { returnData } = await runExecute([{ text: '' }], { continueOnFail: true });

		expect(returnData).toHaveLength(1);
		expect(returnData[0].json.error).toMatch(/text cannot be empty/i);
	});

	it('keeps processing later items after one fails', async () => {
		const { requests, returnData } = await runExecute(
			[{ text: '' }, { text: 'this one is fine' }],
			{ continueOnFail: true, responses: [{ data: [{ id: 'post-1' }] }] },
		);

		expect(returnData).toHaveLength(2);
		expect(returnData[0].json.error).toMatch(/text cannot be empty/i);
		expect(returnData[1].json).toEqual({ id: 'post-1' });
		// Only the valid item should have reached the API.
		expect(requests).toHaveLength(1);
	});

	it('pairs each failed item back to its input index', async () => {
		const { returnData } = await runExecute([{ text: 'ok' }, { text: '' }], {
			continueOnFail: true,
			responses: [{ data: [{ id: 'post-1' }] }],
		});

		expect(returnData[1].pairedItem).toEqual({ item: 1 });
	});
});
