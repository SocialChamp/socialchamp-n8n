import { CHANNELS, runLoadChannels } from './test-helpers';

describe('loadOptions: getChannels', () => {
	it('labels each channel with its platform', async () => {
		const { options } = await runLoadChannels(CHANNELS);

		expect(options).toEqual([
			{ name: 'Acme Marketing (Instagram Professional)', value: 'chan-1' },
			{ name: 'Acme Support (X (Twitter))', value: 'chan-2' },
			{ name: 'Zeta Brand (Facebook Page)', value: 'chan-3' },
		]);
	});

	it('sorts alphabetically so the dropdown is stable between loads', async () => {
		const { options } = await runLoadChannels([
			{ id: 'c', name: 'Zebra', type: 'TW' },
			{ id: 'a', name: 'Apple', type: 'TW' },
			{ id: 'b', name: 'Mango', type: 'TW' },
		]);

		expect(options.map((o) => o.value)).toEqual(['a', 'b', 'c']);
	});

	it('skips entries with no id, which cannot be posted to', async () => {
		const { options } = await runLoadChannels([
			{ id: 'chan-1', name: 'Real', type: 'TW' },
			{ name: 'Orphaned', type: 'TW' },
		]);

		expect(options).toHaveLength(1);
		expect(options[0].value).toBe('chan-1');
	});

	it('falls back to the id when a channel has no readable name', async () => {
		const { options } = await runLoadChannels([{ id: 'chan-7', type: 'MST' }]);

		expect(options[0].name).toBe('chan-7 (Mastodon)');
	});

	it('keeps the bare name when the platform code is unrecognised', async () => {
		const { options } = await runLoadChannels([{ id: 'chan-8', name: 'Somewhere' }]);

		expect(options[0].name).toBe('Somewhere');
	});

	it('accepts a { data: [...] } wrapped response', async () => {
		const { options } = await runLoadChannels({ data: CHANNELS });

		expect(options).toHaveLength(3);
	});

	it('returns an empty list rather than throwing when there are no channels', async () => {
		const { options } = await runLoadChannels([]);

		expect(options).toEqual([]);
	});
});
