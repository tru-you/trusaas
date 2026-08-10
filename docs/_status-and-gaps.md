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
5. **WhatsApp is tap-to-chat only.** All handoffs are `wa.me` links; no WhatsApp Business API send is integrated.
6. **Some TruFlow document PDFs are placeholders.** `generateDocument` returns a stub blob, not a rendered PDF.

## Needs a decision from Paul (documented with a caveat)

7. **TruInspect Basic vs AI tiers — not enforced in code.** Memory/product framing says two tiers (manual Basic, AI-assisted). The code runs one flow with AI damage detection available; there's no tier gate. I documented AI damage detection as present and flagged the tier split as a commercial packaging decision, not a feature flag. Confirm how you want this framed publicly.
8. **`Truflow-light` — RESOLVED (2026-08-02): it ships, and render.yaml is fixed.** TruFlow Light is a supported product: served by `trusaas-premium` at `flow.tru-saas.com/light` (static `public/light`, no own service/disk), source of truth `truflow-light/index.html` → copied to `truflow-premium/public/light/`, rebranded to the cyan suite (old blue "LITE" mark gone). `render.yaml` now documents this correctly (the "pending deletion" note is gone) — no further render.yaml change needed. Docs (`truflow-light.md`, `truflow.md`) synced to match.

## Small things worth confirming

- **Naming drift:** docs use the current shipped names (TruLive ← TruView, TruTrade ← TruValue, TruOrbit ← Tru3D). The brief used the older names; I noted the aliases on the Showrooms page.
- **Screenshots:** every page has `[SCREENSHOT: …]` markers at the exact spots — none captured yet.
- **Hosting/nav:** `index.md` is a simple nav skeleton. No site generator wired up; these are plain markdown pages ready for whatever builds docs.tru-saas.com.
