# Integrations

*How TruDealer connects to a dealer's website and to the tools around it.*

## What it does

TruDealer's integration layer moves stock **out** to dealer websites and pulls leads and captures **in** to the DMS. The hub is [TruFlow](./truflow.md): it publishes a live stock feed, pushes inventory to configured portals, and accepts leads and photos from the dealer's site and apps. This page documents only what is wired up in the code today; anything not built is listed honestly in the stub table at the end.

## Who uses it

- **Dealer web builder / admin** — sets up the stock feed or webhook, and the lead endpoint on the dealer site.
- **Dealer principal** — sees website leads land in the CRM automatically.

## What's wired up now

### Stock → website (publish)

There are two publish paths, both live:

- **Live stock feed (pull).** `GET /api/public/stock?dealer=<slug>` serves a dealer's active inventory as JSON. Dealer sites, the embeddable stock widget (`/embed/stock-widget.js`, `/api/widget/inventory.js`) and [TruChat](./truchat.md) all read from it. One car, one feed, many surfaces. This slug-scoped public feed — **not** `GET /api/inventory` — is the path external sites use. `GET /api/inventory` requires a signed-in session and returns only the caller's own dealership (it is the dealer-console stock list, e.g. TruFlow Light); it is not a public multi-dealer feed.
- **Portal webhook (push).** A dealer can register a **portal** with a `webhookUrl` and API key. `POST /api/portals/sync` then pushes an `inventory_sync` event — active inventory with images and details — to every active portal, signed with `X-API-Key` and `X-Portal-Id` headers, and records the last-sync time per portal. This is the "publish loop" for any endpoint (including a WordPress receiver) that wants stock pushed to it rather than polling.

### Website → DMS (leads in)

- **Public lead webhook.** `POST /api/integration/webhook-lead` accepts a lead from an external dealer site straight into the CRM. It's scoped by `dealerSlug` (or `dealershipId`) and **refuses an unrouted lead** rather than risk filing it to the wrong yard.
- **Which widgets post here.** **[TruAfford](./truafford.md)**, **[TruForm](./truform.md)**, **[TruRepay](./trurepay.md)**, and the **DMS-connected [TruChat](./truchat.md) widget for TruDealer dealers** all `POST` captured leads to this endpoint (when configured with a dealer slug + Flow URL), so they land in the TruFlow CRM. The **standalone TruChat WordPress plugin does not** — see the WordPress note below.
- **Inbound inventory sync.** `POST /api/integration/sync-inventory` accepts inventory from an external source.

### Apps → DMS

- **TruLens photo sync.** [TruLens](./trulens.md) pushes captures to `POST /api/sync/push-photos`, gated by a shared `TRUFLOW_SYNC_KEY` that must match on both services. (Set it on TruLens first, then TruFlow — see the deploy notes in `render.yaml`.)

### WordPress

- **TruChat WordPress plugin (standalone).** A self-contained WordPress plugin registers its own REST route (`truchat/v1/chat`) and ships a PIN leads portal — the packaged way a WordPress client runs the assistant. It was the original build (for a WordPress client); its leads stay **in the plugin's own portal and email**, and it does **not** post to the TruFlow DMS. The DMS-connected TruChat came later for TruDealer dealers (see the widget-leads point above).
- **Stock in WordPress.** WordPress sites consume the public stock feed (`/api/public/stock?dealer=<slug>`) above, or receive the portal webhook push. There is **no bespoke "auto-generate and publish a WordPress plugin" pipeline in the DMS** — stock reaches WordPress through the feed or the webhook, and TruChat is installed as its own plugin.

### Hosted AI brain

- **TruChat API.** A zero-dependency hosted service (`trusaas-chat`) holds the **DeepSeek** key server-side and drives the chat tools; its `STOCK_API` points at the TruFlow public stock feed. Degrades to knowledge + WhatsApp if the key is missing. *(The older prose said "Claude" — the code calls DeepSeek.)*

## Not wired up (stub)

These were asked about or would be expected, but are **not present in the codebase** today. Documenting them as stubs so nobody assumes they exist.

| Integration | Status | Notes |
|---|---|---|
| CloudTalk | 🟢 Live in TruCRM / ⚙️ Platform-hosted for Voice | **TruChat Voice** (AI after-hours receptionist) is configured in the CloudTalk platform, not in this codebase. TruCRM uses the CloudTalk API for click-to-call and SMS. *(Confirm Voice is still live — platform-side, can't be verified from code.)* |
| WhatsApp Business API (send) | 🟠 Built in chat stack, not wired · 🟢 Live in TruCRM | **TruCRM** sends real messages via Meta Cloud API (`graph.facebook.com/v21.0`). The **dealer product** (TruFlow/Lens/Inspect/widgets) sends leads via webhooks + `wa.me` tap-to-chat; the chat stack has a WhatsApp Business **bot bridge** (`truchat/shared/wa-business.js`) but nothing wires it to a live webhook server yet — do not claim it's live. |
| Third-party CRM (HubSpot, Salesforce, Pipedrive) | ❌ Not wired | No connectors found. TruFlow's own Lead CRM is the system of record; external CRMs can only reach it via the generic `/api/integration/webhook-lead` endpoint. |
| VIN decoder | ❌ Not wired | TruFlow explicitly returns "not available — enter manually." A decode provider would need to be added. |
| Online payments | ❌ Not wired | No payment gateway; deals close on invoice + deposit offline. |
| Email delivery (provider) | ✅ Present | TruFlow send engine (SMTP) + TruChat dual emails. |
| Outbound WordPress plugin auto-publish | ❌ Not wired | Stock reaches WordPress via the feed/webhook; there is no DMS pipeline that generates and publishes a plugin automatically. |

## Screenshots

[SCREENSHOT: TruFlow Settings → integrations — the stock feed URL / embed snippet and the portal (webhook) configuration with API key]

[SCREENSHOT: A dealer website showing live stock pulled from the feed]

[SCREENSHOT: A website enquiry appearing as a new lead in the TruFlow CRM]

## Related modules

- **[TruFlow](./truflow.md)** — the integration hub.
- **[TruChat](./truchat.md)** · **[TruAfford](./truafford.md)** — the dealer-site widgets that feed leads in.
- **[TruLens](./trulens.md)** — the keyed photo sync.
- **[Getting Started](./getting-started.md)**
