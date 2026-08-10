# TruRepay

*The on-page finance calculator that turns a repayment estimate into a lead — embedded on the dealer's site.*

## What it does

TruRepay is a repayment calculator a dealer drops onto their website: a shopper works out a monthly instalment against a price (deposit, term, balloon, rate), and — when they want the deal — leaves a name and phone so the full calculation lands in the [TruFlow](./truflow.md) CRM as a lead. It's the standard, dealer-brandable replacement for the one-off calculators each site used to build, and unlike those it captures the enquiry instead of just showing a number. It's themed from a single colour and renders in isolation so the host site's styles can't break it.

## Who uses it

- **Website visitor / buyer** — works out an instalment and asks for the deal.
- **Sales / F&I desk** — receives the lead with the exact figures the buyer ran, and on WhatsApp if that's enabled.
- **Dealer admin / web builder** — sets the embed attributes (dealer, slug, Flow URL, WhatsApp, brand colour, starting price/vehicle, default rate).

## Core workflow

1. **Embed the script** on a page (or a vehicle detail page), setting the dealer, slug, Flow URL and brand accent — and optionally a starting `price` and `vehicle`.
2. **Shopper adjusts the sliders** — price, deposit, term, balloon/residual, interest rate — and the estimated instalment updates live, with the breakdown and the NCA disclaimer shown in the result.
3. **Shopper taps "Get this deal"** and leaves a name + phone (email optional).
4. **The lead lands in TruFlow** — the enquiry `POST`s to `/api/integration/webhook-lead` with the full calculation (price, deposit, term, balloon, rate, instalment, vehicle) in the notes; the success screen shows only when the CRM actually receives it.
5. **Optional WhatsApp.** With a WhatsApp number set, the shopper can send the figures to the yard on WhatsApp — which also files the lead.

## Compliance (do not weaken)

The estimate carries an NCA disclaimer in the result body: it is **indicative only** — not a quote, credit approval, or offer of finance — **excludes** the initiation fee and monthly admin fee, and the **final rate is risk-based and set by the bank**. Never introduce language implying approval, pre-approval, or a guaranteed rate.

## Placement and theming

- **On-page (inline) or float.** Inline renders into a target element (like a finance page section); float shows a launcher button that opens the calculator.
- **One colour to brand it.** Set `data-accent`; everything derives from it. Prefill from a vehicle page with `data-price` and `data-vehicle`; override the footer credit with `data-brand`.
- **Renders in a shadow root**, isolated from the host page's CSS.
- **Programmatic control.** `window.TruRepay.open()` / `.close()`; multiple embeds can run on one page.

## Screenshots

[SCREENSHOT: TruRepay inline on a finance page — sliders on the left, live instalment + breakdown on the right, disclaimer beneath]

[SCREENSHOT: The "Get this deal" capture step — name/phone/email with Send + WhatsApp]

[SCREENSHOT: The "Quote on its way" success state]

[SCREENSHOT: The resulting lead in the TruFlow CRM with the calculation in the notes]

## Notes on scope

- **What's built:** the canonical widget (`packages/tru-repay/tru-repay.js`) — balloon-PMT calculation (matching the flagship finance page), live recompute, capture → hardened lead post to TruFlow (real send confirmation, error state with WhatsApp fallback, timeout), WhatsApp path that also files the lead, honeypot + timing spam guard, keyboard/ARIA support, a `window.TruRepay` API, single-colour theming, and shadow-root isolation. Verified against the balloon-PMT math and the lead flow.
- **Note:** the lead post requires the embed to carry a dealership slug and a Flow URL. Without them the calculator still computes, but the Send path shows the error state and steers the visitor to WhatsApp.
- **Not deployed yet:** the canonical widget exists but isn't placed on any live site — rolling it out is a per-site release.

## Related modules

- **[TruAfford](./truafford.md)** — the affordability widget (budget → price); TruRepay is the repayment side (price → instalment). They pair on a finance page.
- **[TruForm](./truform.md)** — the general enquiry form; same webhook + theming family.
- **[TruFlow](./truflow.md)** — where the lead lands.
- **[Integrations](./integrations.md)** · **[Getting Started](./getting-started.md)**
