/**
 * Display labels for the `type` the channel endpoint returns
 * (Social Champ's internal `user_auth_type`). Mirrors the publisher's own
 * label map so a channel reads the same in n8n as it does in the app.
 * An unknown type falls back to its raw code rather than being hidden.
 */
const CHANNEL_TYPE_LABELS: Record<string, string> = {
	TW: 'X (Twitter)',
	TWITTER: 'X (Twitter)',
	FB: 'Facebook',
	FB_PAGE: 'Facebook Page',
	FB_GROUP: 'Facebook Group',
	IN: 'LinkedIn',
	IN_PAGE: 'LinkedIn Page',
	IG: 'Instagram Personal',
	IG_BUSINESS: 'Instagram Professional',
	IG_DIRECT: 'Instagram Direct',
	PINIT: 'Pinterest',
	PINIT_PAGE: 'Pinterest',
	G_BUSINESS: 'Google Business Profile',
	GOOGLE: 'Google Business Profile',
	YT: 'YouTube Channel',
	TIKTOK: 'TikTok',
	MST: 'Mastodon',
	BSKY: 'Bluesky',
	THD: 'Threads',
};

export function channelTypeLabel(type: unknown): string {
	const code = typeof type === 'string' ? type : '';
	return CHANNEL_TYPE_LABELS[code] ?? code ?? '';
}
