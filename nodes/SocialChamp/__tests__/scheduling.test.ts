import { runExecute } from './test-helpers';

async function scheduledDateTime(dateTime: string): Promise<string> {
	const { requests } = await runExecute([{ postType: 'SCHEDULE', dateTime }]);
	const posts = requests[0].body?.posts as Record<string, unknown>[];
	return posts[0].dateTime as string;
}

describe('post: scheduling', () => {
	it('keeps a UTC timestamp unchanged', async () => {
		expect(await scheduledDateTime('2026-08-14T09:30:00Z')).toBe('2026-08-14T09:30:00.000Z');
	});

	// The offsets below all describe the same instant. Getting these wrong is
	// how a customer's post goes out hours early or late, so they are pinned.
	it('converts a positive offset to the same instant in UTC', async () => {
		expect(await scheduledDateTime('2026-08-14T14:30:00+05:00')).toBe('2026-08-14T09:30:00.000Z');
	});

	it('converts a negative offset to the same instant in UTC', async () => {
		expect(await scheduledDateTime('2026-08-14T04:30:00-05:00')).toBe('2026-08-14T09:30:00.000Z');
	});

	it('normalises a millisecond-precision timestamp', async () => {
		expect(await scheduledDateTime('2026-08-14T09:30:00.123Z')).toBe('2026-08-14T09:30:00.123Z');
	});

	it('sends dateTime only when the timing is SCHEDULE', async () => {
		const { requests } = await runExecute([
			{ postType: 'NOW', dateTime: '2026-08-14T09:30:00Z' },
		]);

		const posts = requests[0].body?.posts as Record<string, unknown>[];
		expect(posts[0]).not.toHaveProperty('dateTime');
	});

	it('applies the same timestamp to every selected channel', async () => {
		const { requests } = await runExecute([
			{
				postType: 'SCHEDULE',
				dateTime: '2026-08-14T09:30:00Z',
				channelIds: ['chan-1', 'chan-2'],
			},
		]);

		const posts = requests[0].body?.posts as Record<string, unknown>[];
		expect(posts.map((p) => p.dateTime)).toEqual([
			'2026-08-14T09:30:00.000Z',
			'2026-08-14T09:30:00.000Z',
		]);
	});

	it.each(['not a date', '', '2026-13-45T99:99:99Z'])(
		'rejects %p before calling the API',
		async (dateTime) => {
			await expect(
				runExecute([{ postType: 'SCHEDULE', dateTime }]),
			).rejects.toThrow(/not a valid date and time/);
		},
	);

	it('does not call the API when the date is invalid', async () => {
		const { requests } = await runExecute([{ postType: 'SCHEDULE', dateTime: 'nope' }], {
			continueOnFail: true,
		});

		expect(requests).toHaveLength(0);
	});
});
