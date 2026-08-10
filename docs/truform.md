# TruForm

*The embeddable enquiry form for dealer sites — captures a lead straight into the DMS.*

## What it does

TruForm is a contact/enquiry form a dealer drops onto their website with one script tag. A visitor fills it in and the enquiry lands directly in the [TruFlow](./truflow.md) CRM as a new lead, optionally also opening a pre-filled WhatsApp chat to the yard. It's themed to the dealer's brand from a single colour and renders in isolation so the host site's styles can't break it — the same approach as [TruAfford](./truafford.md).

## Who uses it

- **Website visitor / buyer** — submits the enquiry.
- **Sales / yard staff** — pick the lead up in the TruFlow CRM (and on WhatsApp if that's enabled).
- **Dealer admin / web builder** — sets the embed attributes (dealer, slug, Flow URL, WhatsApp number, brand colour, which optional fields to show).

## Core workflow

1. **Embed the script** on any page, setting the dealer name, dealership slug, Flow URL and brand accent on the tag.
2. **Choose the fields.** Base fields are always shown — name, phone, email, an interest dropdown and a message. Optional blocks are switched on with `data-fields`: `vehicle`, `tradein` (year/make/model/km), `finance` (employment/deposit), and `location`.
3. **Visitor submits.** The form validates, then `POST`s the enquiry to TruFlow's `/api/integration/webhook-lead` when a slug + Flow URL are set.
4. **The lead lands in the CRM** against the right dealership (scoped by slug), ready to work.
5. **Optional WhatsApp.** If a WhatsApp number is set, a button opens a pre-filled chat to the yard as well.

## Placement and theming

- **Two modes.** `float` (a fixed button/panel, the default) or `inline` — rendered inside a chosen element on the page via `data-target`.
- **One colour to brand it.** Set `data-accent`; the rest derives from it. Pre-fill a vehicle of interest with `data-vehicle` (e.g. from a vehicle detail page). Override the footer credit with `data-brand`.
- **Renders in a shadow root**, isolated from the host page's CSS.
- **Programmatic control.** `window.TruForm.open()` / `.close()` open or close the widget from a host-page button (e.g. a "Contact us" nav link). Multiple TruForm embeds can run on one page (e.g. an inline form plus the float launcher).

## Screenshots

[SCREENSHOT: TruForm in float mode — the enquiry panel open on a dealer site with base fields visible]

[SCREENSHOT: The form with optional blocks enabled — trade-in (year/make/model/km) and finance (employment/deposit)]

[SCREENSHOT: The "sent" confirmation state after submit]

[SCREENSHOT: The resulting new lead in the TruFlow CRM, tagged to the dealership]

## Notes on scope

- **What's built:** the canonical widget (`packages/tru-form/tru-form.js`) — shadow-root isolation, single-colour theming, base + optional field blocks, float/inline modes, and lead post to TruFlow's `/api/integration/webhook-lead`. It **confirms delivery for real**: the "sent" screen shows only when the POST actually succeeds; a failure shows an error state with a WhatsApp fallback and a retry, so a lead is never silently lost. The **WhatsApp path also files the lead** (so a WA-first visitor is captured), and there's field validation (name/phone/email), a honeypot + timing spam guard, keyboard support (Esc to close, focus management, ARIA), and a `window.TruForm` open/close API. Per-dealer copies under `case-sites/` are deploy artefacts of this canonical file.
- **Note:** the DMS post requires the embed to carry a dealership slug and a Flow URL. With them set, "Send Enquiry" delivers to the CRM; without them (or if the endpoint is unreachable) the Send path shows the error state and steers the visitor to WhatsApp.

## Related modules

- **[TruFlow](./truflow.md)** — where the lead lands.
- **[TruAfford](./truafford.md)** · **[TruChat](./truchat.md)** — the other dealer-site widgets; often on the same page.
- **[Integrations](./integrations.md)** — the `/api/integration/webhook-lead` endpoint behind the submit.
- **[Getting Started](./getting-started.md)**
