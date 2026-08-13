import type { INodeProperties } from 'n8n-workflow';
import { SocialChamp } from '../SocialChamp.node';

const description = new SocialChamp().description;
const byName = (name: string) => description.properties.filter((p) => p.name === name);
const one = (name: string): INodeProperties => {
	const matches = byName(name);
	expect(matches.length).toBeGreaterThan(0);
	return matches[0];
};

describe('node description', () => {
	it('declares the credential it needs', () => {
		expect(description.credentials).toEqual([{ name: 'socialChampApi', required: true }]);
	});

	it('has one main input and one main output', () => {
		expect(description.inputs).toEqual(['main']);
		expect(description.outputs).toEqual(['main']);
	});

	it('can be called by an AI Agent as a tool', () => {
		expect(description.usableAsTool).toBe(true);
	});

	it('ships light and dark icons', () => {
		expect(description.icon).toEqual({
			light: 'file:socialChamp.svg',
			dark: 'file:socialChamp.dark.svg',
		});
	});

	it('offers the channel and post resources', () => {
		const resource = one('resource');
		expect(resource.options?.map((o) => (o as { value: string }).value)).toEqual([
			'channel',
			'post',
		]);
	});

	it('offers every timing the create endpoint accepts', () => {
		const timing = one('postType');
		const values = timing.options?.map((o) => (o as { value: string }).value).sort();
		expect(values).toEqual(['LAST', 'NEXT', 'NOW', 'SCHEDULE'].sort());
	});

	it('loads the channel list from the API rather than hardcoding it', () => {
		expect(one('channelIds').typeOptions?.loadOptionsMethod).toBe('getChannels');
	});

	it('only shows the date field when scheduling', () => {
		expect(one('dateTime').displayOptions?.show?.postType).toEqual(['SCHEDULE']);
	});

	it('marks channel, text and date as required', () => {
		expect(one('channelIds').required).toBe(true);
		expect(one('text').required).toBe(true);
		expect(one('dateTime').required).toBe(true);
	});

	it('tells the author which timestamp format is unambiguous', () => {
		expect(one('dateTime').description).toMatch(/ISO 8601/);
	});
});
