import { CHANNELS, runExecute } from './test-helpers';

describe('channel: getAll', () => {
	it('reads the profile endpoint with GET', async () => {
		const { requests } = await runExecute([{ resource: 'channel' }], {
			responses: [CHANNELS],
		});

		expect(requests[0].method).toBe('GET');
		expect(requests[0].url).toBe('https://www.socialchamp.com/secure/api/v1/profile');
	});

	it('returns every channel when returnAll is set', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], {
			responses: [CHANNELS],
		});

		expect(returnData).toHaveLength(3);
	});

	it('adds a human-readable typeLabel alongside the raw type', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], {
			responses: [CHANNELS],
		});

		expect(returnData[0].json).toMatchObject({
			type: 'IG_BUSINESS',
			typeLabel: 'Instagram Professional',
		});
		expect(returnData[1].json.typeLabel).toBe('X (Twitter)');
	});

	it('leaves an unknown channel type as its raw code rather than hiding it', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], {
			responses: [[{ id: 'chan-9', name: 'Future Network', type: 'NEW_THING' }]],
		});

		expect(returnData[0].json.typeLabel).toBe('NEW_THING');
	});

	it('filters by workspace when a workspace ID is given', async () => {
		const { returnData } = await runExecute([{ resource: 'channel', workspaceId: 'ws-1' }], {
			responses: [CHANNELS],
		});

		expect(returnData.map((item) => item.json.id)).toEqual(['chan-1', 'chan-3']);
	});

	it('ignores surrounding whitespace in the workspace ID', async () => {
		const { returnData } = await runExecute([{ resource: 'channel', workspaceId: '  ws-2 ' }], {
			responses: [CHANNELS],
		});

		expect(returnData.map((item) => item.json.id)).toEqual(['chan-2']);
	});

	it('returns nothing when no channel matches the workspace', async () => {
		const { returnData } = await runExecute([{ resource: 'channel', workspaceId: 'ws-none' }], {
			responses: [CHANNELS],
		});

		expect(returnData).toHaveLength(0);
	});

	it('applies the limit when returnAll is off', async () => {
		const { returnData } = await runExecute(
			[{ resource: 'channel', returnAll: false, limit: 2 }],
			{ responses: [CHANNELS] },
		);

		expect(returnData).toHaveLength(2);
	});

	it('applies the limit after the workspace filter, not before', async () => {
		const { returnData } = await runExecute(
			[{ resource: 'channel', returnAll: false, limit: 2, workspaceId: 'ws-1' }],
			{ responses: [CHANNELS] },
		);

		expect(returnData.map((item) => item.json.id)).toEqual(['chan-1', 'chan-3']);
	});

	// The gateway has returned both shapes over time; neither should break.
	it('accepts a bare array response', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], {
			responses: [CHANNELS],
		});

		expect(returnData).toHaveLength(3);
	});

	it('accepts a { data: [...] } wrapped response', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], {
			responses: [{ data: CHANNELS }],
		});

		expect(returnData).toHaveLength(3);
	});

	it('returns nothing for an empty channel list', async () => {
		const { returnData } = await runExecute([{ resource: 'channel' }], { responses: [[]] });

		expect(returnData).toHaveLength(0);
	});
});
