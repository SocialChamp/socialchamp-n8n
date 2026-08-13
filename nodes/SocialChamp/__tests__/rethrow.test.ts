import { NodeApiError } from 'n8n-workflow';
import { runExecute } from './test-helpers';

describe('unexpected failures', () => {
	// Anything the transport did not already wrap would otherwise reach the
	// user as a bare stack trace with no node context attached.
	it('wraps a non-node error in NodeApiError', async () => {
		await expect(
			runExecute([{}], {
				responses: [{ __throw: { message: 'socket hang up' } as never }],
			}),
		).rejects.toBeInstanceOf(NodeApiError);
	});

	it('keeps a validation error as-is rather than rewrapping it', async () => {
		await expect(runExecute([{ text: '' }])).rejects.toThrow(/text cannot be empty/i);
	});

	it('still reports an unexpected failure on the item under continueOnFail', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [{ __throw: { message: 'socket hang up' } as never }],
			continueOnFail: true,
		});

		expect(returnData[0].json.error).toBeTruthy();
	});
});
