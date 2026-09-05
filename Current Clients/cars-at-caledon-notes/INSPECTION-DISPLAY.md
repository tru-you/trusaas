# Inspection display on the vehicle-detail page — the standard for every dealer site

Companion to [`TRUORBIT-360.md`](./TRUORBIT-360.md). This is how a dealer site shows
inspection/condition. Paul's decision (2026-08-04): **every** TruSaaS dealer site
displays it this way.

## What the page shows
On the vehicle-detail page, in place of any graded inspection block:

1. **"Inspected"** — a plain status, **never** a /100 score or a ★ x/5 rating.
2. **Condition summary** — one line: `car.conditionLabel`
   ("No damage reported" / "Visible damage reported — N items"), falling back to a
   damage-derived line, else "No damage reported".
3. **"Request full inspection report"** button — the full graded report is
   **dealer-delivered on request**, not rendered on the page.

The spec-grid "Condition" cell also reads **Inspected** (no score).

**Deliberately NOT on the page:** the /100 score ring, the per-section checklist,
and the itemised damage list. Those live in the full report the dealer sends. An
app shouldn't auto-publish a formal graded document — a human (the dealer) stays
accountable for it.

## The request button
A WhatsApp deep-link to the dealer, prefilled with the car + stock number:

```js
var waVir = encodeURIComponent("Hi "+DEALER+", please send me the full inspection "
  + "report for the "+car.yr+" "+car.make+" "+car.name+(car.tag?" (stock "+car.tag+")":""));
// <a href="https://wa.me/"+WA+"?text="+waVir ...>Request full inspection report</a>
```

The dealer gets the request with the car identified, pulls the VIR report from
TruLens/TruFlow, and sends it. It's also a warm, high-intent **lead**.

Optional (recommended for CRM tracking): also fire the site's existing lead pipe
`https://premium.tru-saas.com/api/integration/webhook-lead` with `type: "vir-request"`
+ the stock number, so every request lands in the dealer's CRM, not just WhatsApp.

## Feed contract — nothing special needed
The public stock feed already carries everything (no payload change was required):

- **`conditionLabel`** — "No damage reported" / "Visible damage reported — N".
  Emitted by both feeds (`Truflow-premium` `toPublicVehicle`, `TruLens`
  `toPublicFromLens`). Absent until the dealer declares condition, so a site
  never implies a clean bill from silence.
- `conditionDeclaration` — the raw `{ noVisibleDamage, declaredAt, declaredBy }`.
- `vir` / `virReport` / `damage` — still flow (the dealer needs them to produce the
  full report; the site uses them only to decide whether to show the block and the
  "N sections checked" / damage-count summary). **The site does not render the
  graded VIR from them.**

The site's `mapApiVehicle` must pass `conditionLabel` through onto the card
(alongside `vir`/`virReport`/`damage`). The WhatsApp number is site config, not feed.

## Grid / listing cards
The card badge shows `conditionLabel || 'Inspected'` — **never** the "Inspected · N/100"
score. So a card reads "Inspected" (or "No damage reported" once declared), matching
the detail page. Reference: `index.html` card template, the `.card .ph .vir` badge.

## New-site checklist
1. `mapApiVehicle` exposes `conditionLabel` (+ keeps `vir`/`virReport`/`damage`, `tag`).
2. VD page renders: **Inspected** + condition summary + **Request full inspection report**.
3. Grid card badge = `conditionLabel || 'Inspected'` (no score).
4. Request button = WhatsApp deep-link (dealer number + stock); optionally also the
   `webhook-lead` `vir-request` for CRM.
5. No /100 score, no ★ rating, no per-section checklist, no damage list on the page.
6. Reference implementation: this site's `coc-vd.js` (inspection block + spec cell +
   hero badge) and `index.html` `mapApiVehicle`.

## Why (the honesty model)
TruLens retail capture is a **declared condition**, not a graded VIR (that's
TruInspect). The listing makes one plain claim from the dealer; the formal graded
report is available on request from the party who stands behind it. See the
platform memory `project_trulens_retail_capture` for the capture side.
