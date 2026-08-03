# TruSocial — Social Auto-Publish Module

TruSocial connects dealer social accounts (Facebook, Instagram, Google Business) via the [Zernio API](https://docs.zernio.com) and auto-publishes stock listings to those channels.

## Architecture

- **Integration layer**: Zernio (team-level API key, one profile per dealer)
- **Dealer isolation**: We enforce it — Zernio does not. Every accountId is checked against our own accountId→dealer map before any action.
- **Branding**: Headless OAuth flow — dealers never see "Zernio". The entire connect flow stays inside TruFlow UI.

## Env Vars (Render)

| Variable | Required | Notes |
|---|---|---|
| `ZERNIO_API_KEY` | Yes | Team-level key from docs.zernio.com |
| `ZERNIO_WEBHOOK_SECRET` | No | Format `HeaderName:secretvalue` for custom-header webhook auth. If unset, webhook endpoint accepts all POSTs (still validates payload structure). |

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/social/toggle` | admin, manager, principal | Enable/disable TruSocial for a dealer. First enable provisions a Zernio profile. |
| GET | `/api/social/connect/:platform` | any authed | Returns Zernio OAuth URL (headless mode, our redirect). |
| GET | `/api/social/callback` | public | OAuth redirect target — closes popup. |
| GET | `/api/social/accounts` | any authed | Lists connected accounts. Syncs live from Zernio API on each call. |
| POST | `/api/social/disconnect` | any authed | Disconnects an account (with ownership check). |
| POST | `/api/integration/webhook-zernio` | public | Receives Zernio webhooks (account.connected, account.disconnected, post.published, post.failed). |

## Data Model

On each dealership object in `data.json`:
- `truSocialEnabled: boolean` — UI visibility flag
- `zernioProfileId: string` — the Zernio profile ID for this dealer

In `state.socialAccounts[]`:
- `accountId` — Zernio account `_id`
- `dealershipId` — our dealer ID
- `platform` — facebook, instagram, google-business
- `username` — display handle
- `connectedAt` — ISO timestamp

## Key Safety Rules

1. **Toggle OFF does NOT disconnect** — it hides the UI and stops publishes. Connections are preserved.
2. **accountId→dealer isolation** — never trust an accountId from the frontend without checking our map.
3. **Profile naming** — uses dealer ID (slug), not dealer name, as the Zernio profile unique name.
4. **Account sync** — GET /api/social/accounts pulls live from Zernio and syncs local state, so missed webhooks self-heal.

## Frontend

- `src/components/TruSocialSettings.tsx` — dealer-facing settings panel
- For admin: one panel per qualifying dealer (iterates dealerships with "social" product)
- For dealer login: shows their own panel if they have the "social" product
