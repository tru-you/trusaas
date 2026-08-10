# TruRepay — canonical widget

Dealer-branded, on-page finance (repayment) calculator that **also generates a
lead**. A shopper works out a monthly instalment; when they want the deal they
leave a name + phone and the full calculation is filed into TruFlow.

`tru-repay.js` here is the **source of truth**. Copies under `case-sites/*/`
(and any other deploy) are artefacts — fix here, then re-copy.

---

## Embed (on-page / inline)

```html
<div id="finance-calc"></div>
<script src="tru-repay.js"
        data-dealer="True Cars"
        data-slug="true-cars"
        data-flow="https://premium.tru-saas.com"
        data-wa="27620502091"
        data-accent="#1466E0"
        data-mode="inline"
        data-target="#finance-calc"
        data-price="459900"
        data-vehicle="2023 Toyota Fortuner 2.8 GD-6"></script>
```

For a floating launcher instead, set `data-mode="float"` and drop `data-target`.

## Attributes

| Attribute | Default | Purpose |
|---|---|---|
| `data-dealer` | `this dealership` | Name in header, WhatsApp and lead |
| `data-slug` | *(none)* | Dealership slug — **required to file a CRM lead** |
| `data-flow` | *(none)* | TruFlow origin — **required to file a CRM lead** |
| `data-wa` | *(none)* | WhatsApp number, digits only. Enables the WhatsApp send |
| `data-accent` | `#1466E0` | Brand colour; everything derives from it |
| `data-accent-2` | derived | Far end of the gradient (default: accent darkened) |
| `data-mode` | `inline` | `inline` (renders into `data-target`) or `float` (FAB) |
| `data-target` | *(none)* | CSS selector for the inline mount (falls back to a body div) |
| `data-position` | `right` | `right` or `left` (float mode) |
| `data-price` | `0` | Starting vehicle price (editable) |
| `data-vehicle` | *(none)* | Vehicle name — carried into the lead + WhatsApp message |
| `data-rate` | `11.75` | Default interest rate % |
| `data-deposit` | `10` | Default deposit % |
| `data-term` | `72` | Default term (months) |
| `data-balloon` | `0` | Default balloon % |
| `data-init-fee` | `1207` | Initiation fee shown in the disclaimer |
| `data-admin-fee` | `69` | Monthly admin fee shown in the disclaimer |
| `data-currency` | `R` | Currency symbol |
| `data-brand` | `TruRepay · TruSaaS` | Footer credit |
| `data-z` | `999975` | z-index (float) |

### Theming

Set **`data-accent` only** — shades, gradient, slider track, focus rings and
result tints all derive from it in JS, so a dealer recolour is an embed-tag edit,
never a JS edit. WhatsApp green on the send button is deliberately **not**
themeable (it is WhatsApp's brand affordance).

## Lead delivery

On "Send me this quote" (or the WhatsApp button) the enquiry is `POST`ed to
`<data-flow>/api/integration/webhook-lead` with the full calculation in the
notes (price, deposit, term, balloon, rate, instalment, vehicle). The success
screen shows **only** when the CRM actually receives it; a failure shows an error
state with a WhatsApp fallback and a retry. The WhatsApp path files the lead too.
A hidden honeypot + a submit-timing check drop bot submissions before they reach
the CRM.

## Isolation

Renders inside a **shadow root**, so the host page's CSS cannot reach in and the
widget's styles cannot leak out. `window.TruRepay.open()` / `.close()` remain
available to host pages; multiple instances can coexist on one page.

## Compliance — do not weaken

The result is an **estimate**. The disclaimer must stay in the output body and
keep stating it is indicative only, excludes the initiation and monthly admin
fees, and is **not a quote, credit approval, or offer of finance** — the final
rate is risk-based and set by the bank. Never imply approval, pre-approval, or a
guaranteed rate.

## demo.html — QA harness

```bash
npx serve packages/tru-repay -l 8092
```

Then open the demo. Adjust the sliders and confirm the instalment matches the
balloon-PMT math; tap "Get this deal" to exercise the capture → lead flow.
> The demo's `data-flow` points at the live endpoint — a real submit files a real
> lead. Blank `data-flow` for a pure-UI demo.
