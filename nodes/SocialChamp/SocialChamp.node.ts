import { createHash } from 'crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { channelTypeLabel } from './ChannelTypes';
import { socialChampApiRequest, unwrapList } from './GenericFunctions';

/** postType values the create-post endpoint validates against. */
const POST_TYPES = ['NOW', 'NEXT', 'LAST', 'SCHEDULE'] as const;

export class SocialChamp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Social Champ',
		name: 'socialChamp',
		icon: {
			light: 'file:socialChamp.svg',
			dark: 'file:socialChamp.dark.svg',
		} as const,
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'List channels and create or schedule posts in Social Champ',
		defaults: {
			name: 'Social Champ',
		},
		// The literal is what both the old enum and the current
		// NodeConnectionTypes const resolve to, so it works across n8n versions.
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{
				name: 'socialChampApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Channel',
						value: 'channel',
					},
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'post',
			},

			// ----------------------------------
			//             channel
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['channel'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Retrieve the social channels this API key can publish to',
						action: 'Get many channels',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['channel'],
						operation: ['getAll'],
					},
				},
				default: true,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['channel'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Workspace ID',
				name: 'workspaceId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['channel'],
						operation: ['getAll'],
					},
				},
				default: '',
				description:
					'Only return channels in this workspace. Leave empty for every workspace the key can reach. Run this operation once without a filter to read the workspace IDs off the results.',
			},

			// ----------------------------------
			//              post
			// ----------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['post'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Publish, queue or schedule a post',
						action: 'Create a post',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Channel Names or IDs',
				name: 'channelIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getChannels',
				},
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['create'],
					},
				},
				default: [],
				required: true,
				description:
					'The channels to post to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['create'],
					},
				},
				default: '',
				required: true,
				description: 'The post content. Per-platform length limits still apply.',
			},
			{
				displayName: 'Timing',
				name: 'postType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['create'],
					},
				},
				options: [
					{
						name: 'Add to Queue (Last)',
						value: 'LAST',
						description: 'Append to the end of the queue',
					},
					{
						name: 'Add to Queue (Next)',
						value: 'NEXT',
						description: "Take the channel's next free queue slot",
					},
					{
						name: 'Publish Now',
						value: 'NOW',
						description: 'Send to the platform immediately',
					},
					{
						name: 'Schedule for a Specific Time',
						value: 'SCHEDULE',
						description: 'Publish at the date and time given below',
					},
				],
				default: 'SCHEDULE',
				description: 'When the post should go out',
			},
			{
				displayName: 'Date and Time',
				name: 'dateTime',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['create'],
						postType: ['SCHEDULE'],
					},
				},
				default: '',
				required: true,
				description:
					'When to publish. Send an ISO 8601 timestamp with an explicit offset (2026-08-14T09:30:00Z or 2026-08-14T14:30:00+05:00) so the time is unambiguous.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['create'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Image URL',
						name: 'image',
						type: 'string',
						default: '',
						description:
							'Publicly reachable URL of an image to attach. Social Champ fetches it at publish time, so it must stay reachable until then.',
					},
					{
						displayName: 'Idempotency Key',
						name: 'idempotencyKey',
						type: 'string',
						default: '',
						description:
							'Sent as the Idempotency-Key header. Leave empty and the node derives a stable key from the execution and the payload. Reuse a key only when retrying the same intended post.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await socialChampApiRequest.call(this, 'GET', '/profile');

				return unwrapList(response)
					.filter((channel) => Boolean(channel.id))
					.map((channel) => {
						const label = channelTypeLabel(channel.type);
						// Older API builds return only `name`, which is blank for a
						// Mastodon account with no display name. Prefer whatever
						// human-readable field is present before falling back to the id.
						const name =
							(channel.alias as string) ||
							(channel.screenName as string) ||
							(channel.name as string) ||
							(channel.id as string);
						return {
							name: label ? `${name} (${label})` : name,
							value: channel.id as string,
						};
					})
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'channel' && operation === 'getAll') {
					const workspaceId = (this.getNodeParameter('workspaceId', i, '') as string).trim();
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;

					let channels = unwrapList(
						await socialChampApiRequest.call(this, 'GET', '/profile'),
					);

					if (workspaceId) {
						channels = channels.filter((channel) => channel.workspaceId === workspaceId);
					}

					if (!returnAll) {
						channels = channels.slice(0, this.getNodeParameter('limit', i) as number);
					}

					returnData.push(
						...channels.map((channel) => ({
							json: { ...channel, typeLabel: channelTypeLabel(channel.type) },
							pairedItem: { item: i },
						})),
					);
					continue;
				}

				if (resource === 'post' && operation === 'create') {
					const channelIds = this.getNodeParameter('channelIds', i) as string[];
					const text = this.getNodeParameter('text', i) as string;
					const postType = this.getNodeParameter('postType', i) as (typeof POST_TYPES)[number];
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					if (!channelIds.length) {
						throw new NodeOperationError(this.getNode(), 'Select at least one channel', {
							itemIndex: i,
						});
					}

					if (!text.trim()) {
						throw new NodeOperationError(this.getNode(), 'Text cannot be empty', {
							itemIndex: i,
						});
					}

					let dateTime = '';
					if (postType === 'SCHEDULE') {
						dateTime = this.getNodeParameter('dateTime', i) as string;
						const parsed = Date.parse(dateTime);
						if (!Number.isFinite(parsed)) {
							throw new NodeOperationError(
								this.getNode(),
								`"${dateTime}" is not a valid date and time. Use an ISO 8601 value such as 2026-08-14T09:30:00Z.`,
								{ itemIndex: i },
							);
						}
						dateTime = new Date(parsed).toISOString();
					}

					const image = (additionalFields.image as string) || '';

					// One entry per channel: the API fans a post out per profile.
					const posts = channelIds.map((profileId) => {
						const post: IDataObject = { post: text, profileId, postType };
						if (dateTime) post.dateTime = dateTime;
						if (image) post.image = image;
						return post;
					});

					const body: IDataObject = { posts };

					// Idempotency-Key is documented on the create endpoint. It is not
					// enforced server-side yet, so this makes the node forward-compatible
					// rather than a duplicate guarantee - see the README.
					const idempotencyKey =
						(additionalFields.idempotencyKey as string) ||
						createHash('sha256')
							.update(`${this.getExecutionId()}:${i}:${JSON.stringify(body)}`)
							.digest('hex');

					const response = await socialChampApiRequest.call(this, 'POST', '/post', body, {}, {
						'Idempotency-Key': idempotencyKey,
					});

					const created = unwrapList(response);
					returnData.push(
						...(created.length
							? created.map((post) => ({ json: post, pairedItem: { item: i } }))
							: [{ json: response as IDataObject, pairedItem: { item: i } }]),
					);
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`The operation "${operation}" is not supported for resource "${resource}"`,
					{ itemIndex: i },
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
