import { SocialChampApi } from '../SocialChampApi.credentials';

const credential = new SocialChampApi();
const property = (name: string) => credential.properties.find((p) => p.name === name);

describe('SocialChampApi credential', () => {
	it('is registered under the name the node asks for', () => {
		expect(credential.name).toBe('socialChampApi');
	});

	it('sends the key as a bearer token', () => {
		expect(credential.authenticate.properties.headers).toEqual({
			Authorization: '=Bearer {{$credentials.apiKey}}',
		});
	});

	it('masks the API key in the editor', () => {
		expect(property('apiKey')?.typeOptions?.password).toBe(true);
		expect(property('apiKey')?.required).toBe(true);
	});

	it('defaults to the production API', () => {
		expect(property('baseUrl')?.default).toBe('https://www.socialchamp.com/secure/api/v1');
	});

	it('tests the credential against a real read endpoint', () => {
		expect(credential.test.request).toMatchObject({
			baseURL: '={{$credentials.baseUrl}}',
			url: '/profile',
			method: 'GET',
		});
	});

	it('does not carry a default API key that could ship as a placeholder', () => {
		expect(property('apiKey')?.default).toBe('');
	});
});
