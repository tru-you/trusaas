# Status & gaps (internal — not a public page)

Where the code doesn't yet support more than a stub, or where a documented claim needs a decision before it goes public. Reviewed against the codebase on 2026-08-02.

## Pages that are on solid ground (code fully supports the page)

- **TruLens** — 27-slot / 3-phase guided capture, per-phase scoring, licence-disc scan, damage tagging, readiness/publish gate, TruOrbit spin build, keyed export to TruFlow. Well-covered.
- **TruFlow** — full nav, DMS API surface, seats/roles, deal-readiness flags, stock health, finance & recon all present in code.
- **TruAfford** — its own canonical README documents theming, isolation, compliance and the deployed-copy drift. Strongest-documented module.
- **TruChat** — WordPress plugin + static widget + hosted API brain, tool-use, knowledge fallback, leads/email all present.

## Confirmed with Paul during review (2026-08-02)

- **TruChat has two builds, and leads route differently.** The **standalone WordPress plugin + PIN portal** came first (for a WordPress client, YCG-origin) — leads stay local (portal + dual customer/yard email), **not** the DMS. The **DMS-connected version was built afterwards for TruDealer** — its `leadWebhook` posts leads into the TruFlow CRM. Docs now draw this line explicitly. (Corrected from a first-pass assumption that the plugin synced to Flow.)
- **Site widgets that DO post leads into the DMS** (`/api/integration/webhook-lead`, code-confirmed, scoped by `dealerSlug`, rejects unrouted leads): the TruDealer TruChat widget, **TruAfford** (`tru-afford.js` — on both Send and WhatsApp paths), and **TruForm** (`tru-form.js`). Requires `data-slug` + a Flow URL on the embed.
- **YCG** is a separate/legacy client build — mentioned in passing, not documented as current product.

## Real gaps (flagged in the pages, listed here for the record)

1. **CloudTalk — not in the codebase, but not a gap.** Zero code references *because* it hosts **TruChat Voice** (AI after-hours receptionist), configured in the CloudTalk platform, not in this repo. Its "demo" is a phone number, not a URL. Documented as ⚙️ platform-hosted on the Integrations page. **Action:** confirm the Voice line is still live (platform-side; can't be verified from code — and I can't place calls) and capture the number for the docs.
2. **VIN decoder — not wired.** TruFlow deliberately returns "enter manually." Documented as a gap on both the TruFlow and Integrations pages.
3. **Third-party CRM connectors (HubSpot/Salesforce/Pipedrive) — none.** Only the generic `/api/integration/webhook-lead` inbound exists.
4. **"WordPress auto-plugin publish loop" — narrower than the brief implies.** What exists: the public stock feed (pull) and the portal webhook push (`/api/portals/sync`), plus the TruChat plugin. There is no DMS pipeline that generates and auto-publishes a WordPress plugin. Documented accurately rather than to the brief's wording.
5. **WhatsApp: tap-to-chat is the dealer floor; the Business API is in the house but not wired as the dealer send path.** All dealer-product handoffs are `wa.me` links. A WhatsApp Business **bot bridge** exists in the chat stack (`truchat/shared/wa-business.js`, Meta Cloud API) but nothing wires it to a live webhook server. TruCRM has real Meta Cloud API send (`/api/whatsapp/send`). The **webhook lead system** is the actual lead-delivery value — every widget posts to `/api/integration/webhook-lead` (TruFlow CRM) and/or a `data-webhook` (Zapier/Make/CRM).
6. **Some TruFlow document PDFs are placeholders.** `generateDocument` returns a stub blob, not a rendered PDF.

## Needs a decision from Paul (documented with a caveat)

7. **TruInspect Basic vs AI tiers — not enforced in code.** Memory/product framing says two tiers (manual Basic, AI-assisted). The code runs one flow; there is **no AI damage detection** — the `/api/inspect/damage` endpoint is a stub that returns `{aiMode:false, findings:[]}`, and every "Scan with AI" button fails into manual tagging. Treat any "AI detection" claim as false until a vision model is actually wired. The tier split is a commercial packaging decision, not a feature flag.
8. **`Truflow-light` — RETIRED (2026-08-14), replaced by TruFlow Mobile.** The `/light` console is gone; `truflow-premium` 301s `/light` → `app.tru-saas.com` (TruFlow Mobile, `truflow-mobile/`). Docs (`truflow-mobile.md`, `truflow.md`) reflect Mobile, not Light. Source of truth for the console is `truflow-mobile/public/index.html`; it proxies `/api/*` and `/media/*` to `flow.tru-saas.com`.

## Small things worth confirming

- **Naming drift:** docs use the current shipped names (TruLive ← TruView, TruTrade ← TruValue, TruOrbit ← Tru3D). The brief used the older names; I noted the aliases on the Showrooms page.
- **Screenshots:** every page has `[SCREENSHOT: …]` markers at the exact spots — none captured yet.
- **Hosting/nav:** `index.md` is a simple nav skeleton. No site generator wired up; these are plain markdown pages ready for whatever builds docs.tru-saas.com.
