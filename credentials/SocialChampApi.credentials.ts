import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SocialChampApi implements ICredentialType {
	name = 'socialChampApi';

	displayName = 'Social Champ API';

	documentationUrl = 'https://developers.socialchamp.com/docs/create-api-token';

	icon = {
		light: 'file:../nodes/SocialChamp/socialChamp.svg',
		dark: 'file:../nodes/SocialChamp/socialChamp.dark.svg',
	} as const;

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one in Social Champ under Settings > API Keys. The key is stored in n8n and is never written into an exported workflow.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://www.socialchamp.com/secure/api/v1',
			description: 'Only change this if you were given a different API host',
		},
	];

	// The public API takes the key as a bearer token; it falls back to API-key
	// auth when the value is not an OAuth access token.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/profile',
			method: 'GET',
		},
	};
}
