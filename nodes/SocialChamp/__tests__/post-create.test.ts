import { runExecute } from './test-helpers';

describe('post: create', () => {
	it('sends one posts[] entry per selected channel', async () => {
		const { requests } = await runExecute([
			{ channelIds: ['chan-1', 'chan-2', 'chan-3'], text: 'launch day' },
		]);

		expect(requests).toHaveLength(1);
		const posts = requests[0].body?.posts as Record<string, unknown>[];
		expect(posts).toHaveLength(3);
		expect(posts.map((p) => p.profileId)).toEqual(['chan-1', 'chan-2', 'chan-3']);
		expect(posts.every((p) => p.post === 'launch day')).toBe(true);
	});

	it('posts to the create endpoint on the credential base URL', async () => {
		const { requests } = await runExecute([{}]);

		expect(requests[0].method).toBe('POST');
		expect(requests[0].url).toBe('https://www.socialchamp.com/secure/api/v1/post');
	});

	it('trims a trailing slash off the base URL rather than doubling it', async () => {
		const { requests } = await runExecute([{}], {
			credentials: {
				apiKey: 'test-key',
				baseUrl: 'https://www.socialchamp.com/secure/api/v1/',
			},
		});

		expect(requests[0].url).toBe('https://www.socialchamp.com/secure/api/v1/post');
	});

	it.each(['NOW', 'NEXT', 'LAST'] as const)(
		'sends postType %s with no dateTime',
		async (postType) => {
			const { requests } = await runExecute([{ postType }]);

			const posts = requests[0].body?.posts as Record<string, unknown>[];
			expect(posts[0].postType).toBe(postType);
			expect(posts[0]).not.toHaveProperty('dateTime');
		},
	);

	it('omits the image field when no image was given', async () => {
		const { requests } = await runExecute([{}]);

		const posts = requests[0].body?.posts as Record<string, unknown>[];
		expect(posts[0]).not.toHaveProperty('image');
	});

	it('passes an image URL through to every channel entry', async () => {
		const { requests } = await runExecute([
			{
				channelIds: ['chan-1', 'chan-2'],
				additionalFields: { image: 'https://cdn.example.com/a.png' },
			},
		]);

		const posts = requests[0].body?.posts as Record<string, unknown>[];
		expect(posts.map((p) => p.image)).toEqual([
			'https://cdn.example.com/a.png',
			'https://cdn.example.com/a.png',
		]);
	});

	it('returns one output item per created post', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [{ status: 200, data: [{ id: 'post-1' }, { id: 'post-2' }] }],
		});

		expect(returnData.map((item) => item.json)).toEqual([{ id: 'post-1' }, { id: 'post-2' }]);
		expect(returnData.every((item) => item.pairedItem)).toBe(true);
	});

	it('falls back to the raw response when the API returns no post list', async () => {
		const { returnData } = await runExecute([{}], {
			responses: [{ status: 200, message: 'Success' }],
		});

		expect(returnData).toHaveLength(1);
		expect(returnData[0].json).toEqual({ status: 200, message: 'Success' });
	});

	it('processes every input item', async () => {
		const { requests } = await runExecute([
			{ text: 'first' },
			{ text: 'second' },
			{ text: 'third' },
		]);

		expect(requests).toHaveLength(3);
		const texts = requests.map(
			(r) => (r.body?.posts as Record<string, unknown>[])[0].post,
		);
		expect(texts).toEqual(['first', 'second', 'third']);
	});
});
