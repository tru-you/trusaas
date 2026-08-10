# TruAfford (Finance)

*The affordability widget that turns a browser into a qualified finance enquiry — embedded on the dealer's own site.*

## What it does

TruAfford is a small, self-contained widget a dealer drops onto their website. A visitor works out a rough monthly figure against a price, and — where a WhatsApp number is set — sends that as an enquiry straight to the yard. It's a soft, pre-qualification tool for capturing finance-minded buyers earlier; it deliberately does **not** make, imply, or record a credit decision. It's themed to the dealer's brand from a single colour and renders in isolation so a dealer's own site styles can't break it.

## Who uses it

- **Website visitor / buyer** — runs the affordability estimate and taps through to WhatsApp.
- **Sales / finance staff** — receives the enquiry on WhatsApp with the buyer's figures.
- **Dealer admin / web builder** — sets the embed attributes (dealer name, WhatsApp number, brand colour, illustrative rate).

## Core workflow

1. **Embed the script** on any page, setting the dealer name, WhatsApp number and brand accent colour on the tag.
2. **Visitor opens the widget** and enters the numbers (price / deposit / term against the illustrative rate).
3. **The estimate shows** a rough monthly figure, with an affordability band (a "Tight" band shows in amber as a state, not a brand colour).
4. **The compliance disclaimer displays in the result body** — stating this is an estimate only, not a credit decision, quotation, offer of finance, or an affordability assessment under the National Credit Act.
5. **Visitor sends the enquiry.** Either path — the Send button or the WhatsApp button — captures the lead. The green WhatsApp button (WhatsApp's own brand, not themeable) opens a pre-filled chat to the yard, and **the same figures are posted straight into [TruFlow](./truflow.md)** as a new lead.

## Where the lead goes

When the embed is given a dealer slug and a Flow URL (`data-slug` + `data-flow`), TruAfford `POST`s each enquiry to TruFlow's `/api/integration/webhook-lead` endpoint — tagged `source: "TruAfford Widget"` (or `"TruAfford Widget (WhatsApp)"` when sent via WhatsApp) with the visitor's name, phone and the full soft-estimate breakdown in the notes. So the lead lands in the [TruFlow](./truflow.md) CRM whether or not the customer also opens WhatsApp. Without a slug + Flow URL the widget still runs and still opens WhatsApp — it just doesn't post to the DMS.

## Theming and isolation

- **One colour to brand it.** Set `data-accent` only; shades, glows, focus rings, slider tracks and the gradient are all derived from it — a dealer recolour is an embed-tag edit, never a code edit.
- **Renders in a shadow root.** The widget is fully isolated from the host page's CSS, so a badly-scoped dealer theme can't leak in and break it.

## Compliance (do not weaken)

The NCA disclaimer is the sharpest legal edge in the suite. It must stay **in the output body** (not a footer) and must keep stating that the figure is an estimate only — **not** a credit decision, quotation, offer of finance, or an affordability assessment under the National Credit Act. Never introduce language implying approval, pre-approval, or qualification.

## Screenshots

[SCREENSHOT: TruAfford collapsed as a floating button on a dealer site, clearing the WhatsApp FAB]

[SCREENSHOT: The open widget mid-estimate — price/deposit/term inputs with the monthly figure and affordability band]

[SCREENSHOT: The result state showing the NCA disclaimer in the body and the green WhatsApp send button]

[SCREENSHOT: The same widget themed for two dealers (e.g. red and blue accents) to show single-colour branding]

## Notes on scope

- **What's built:** the canonical widget (`packages/tru-afford/tru-afford.js`) — shadow-root isolation, single-colour theming, affordability estimate, in-body NCA disclaimer, WhatsApp send, and a QA harness (`demo.html`) that tests it against deliberately hostile dealer CSS in both light and dark pages.
- **Known gap:** the copies currently deployed on live dealer sites have **drifted** from this canonical file — they still carry the old pre-rebrand palette, a dead `data-brand` attribute, and light-DOM isolation that doesn't fully hold. Bringing each site onto the canonical file is a **per-dealer site release** (sign-off + QA), not a refactor step.

## Related modules

- **[TruChat](./truchat.md)** — usually sits on the same dealer site; both route enquiries to WhatsApp.
- **[TruFlow](./truflow.md)** — where finance-minded leads are worked once they arrive.
- **[Integrations](./integrations.md)** — how dealer-site widgets connect back to the platform.
- **[Getting Started](./getting-started.md)**
