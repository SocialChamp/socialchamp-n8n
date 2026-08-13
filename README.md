# n8n-nodes-socialchamp

An [n8n](https://n8n.io/) community node for [Social Champ](https://www.socialchamp.com). It lists the
social channels an API key can reach and creates posts — immediately, into the queue, or scheduled for
a specific time.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) ·
[Errors and retries](#errors-and-retries) · [Known limits](#known-limits) · [Development](#development)

## Installation

In n8n, go to **Settings > Community Nodes**, select **Install**, and enter:

```
@socialchamp/n8n-nodes-socialchamp
```

Self-hosted installs can instead run `npm install @socialchamp/n8n-nodes-socialchamp` in the n8n
custom-nodes folder.

## Credentials

The node authenticates with a Social Champ API key sent as a bearer token.

1. In Social Champ, open **Settings > API Keys** and create a key.
2. In n8n, add a **Social Champ API** credential and paste the key.
3. Select **Test** — it calls the channel endpoint and reports whether the key works.

The key lives in the n8n credential store. It is not written into an exported workflow, so a workflow
JSON can be shared without leaking it.

**Base URL** defaults to `https://www.socialchamp.com/secure/api/v1` and only needs changing if you
were given a different host.

## Operations

### Channel — Get Many

Returns the channels the key can publish to:

```json
{
  "id": "6512…",
  "name": "Acme Marketing",
  "type": "IG_BUSINESS",
  "typeLabel": "Instagram Professional",
  "profileImg": "https://…",
  "workspaceId": "64ab…"
}
```

`typeLabel` is added by the node so the platform reads the same as it does in the app. Set
**Workspace ID** to return only the channels in one workspace — run the operation once without it to
read the IDs off the results.

### Post — Create

| Field | Notes |
|---|---|
| Channel Names or IDs | Loaded from your account. Selecting several sends the post to each. |
| Text | The post body. Per-platform length limits still apply and are enforced by Social Champ. |
| Timing | Publish Now, Add to Queue (Next), Add to Queue (Last), or Schedule for a Specific Time. |
| Date and Time | Required when scheduling. |
| Image URL | Optional. Must stay publicly reachable until the post goes out. |
| Idempotency Key | Optional. See below. |

**Scheduling is UTC-normalised.** The node converts whatever it is given to an ISO 8601 UTC
timestamp before sending, so pass a value with an explicit offset:

- `2026-08-14T09:30:00Z` → 09:30 UTC
- `2026-08-14T14:30:00+05:00` → 09:30 UTC
- `2026-08-14T04:30:00-05:00` → 09:30 UTC

A bare `2026-08-14T09:30:00` is interpreted by the n8n host's clock, which is rarely what you want in
a shared workflow.

## Errors and retries

| Response | What the node does |
|---|---|
| 401 / 400 invalid token | Fails immediately with a message pointing at the credential. No retry — a retry cannot fix it. |
| 403 | Fails immediately; the key lacks the scope for that operation. |
| 429 | Retries up to 3 attempts, honouring `Retry-After` when present, otherwise exponential backoff capped at 30s. |
| 500 / 502 / 503 / 504 | Same bounded retry. |
| Validation errors | Fail immediately and surface the API's own message. |

Turning on **Continue On Fail** puts the error message on the output item instead of stopping the
workflow, so a batch of posts is not lost to one bad channel.

## Known limits

Read these before building anything that depends on them.

- **Idempotency is not enforced yet.** The node always sends an `Idempotency-Key` header (derived
  from the execution and payload unless you supply one), and the API documents the header, but the
  create-post path does not deduplicate on it today. Treat a retried create as capable of producing a
  second post until that lands.
- **No publish-status tracking.** There is no public read/status endpoint for a created post, so the
  node cannot tell you whether a post actually went out on the platform. The create response reports
  that Social Champ accepted the post, not that the network published it.
- **No workspace picker.** Channels carry a `workspaceId` and can be filtered by it, but the public
  API does not expose a workspace list, so the workspace field is an ID rather than a dropdown.
- **Text and a single image only.** Video, carousels, first comments, per-platform customisation and
  drafts are not exposed in this version.

## Development

```bash
npm install
npm run build      # tsc + copies icons into dist/
npm run lint       # eslint-plugin-n8n-nodes-base, the same rules n8n verification uses
```

To try it in a local n8n:

```bash
npm run build
npm link
cd ~/.n8n/custom && npm link @socialchamp/n8n-nodes-socialchamp
```

Then restart n8n and the node appears in the palette.

## License

[MIT](LICENSE.md)
