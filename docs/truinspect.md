# TruInspect

*Vehicle inspection reports (VIR) and trade-in appraisals.*

## What it does

TruInspect turns a walk-around into a graded condition report and a defensible trade-in number. A staff member records the state of each panel, accessory and document; the app costs the recon, pulls a market retail figure, and works back to a trade price the dealer can stand behind. It produces two distinct documents for the same car — a Vehicle Inspection Report (VIR) and a Trade-In Appraisal — each with its own reference so a buyer or finance house always knows which one they're looking at.

## Who uses it

- **Buyer / appraiser (dealer staff)** — runs the inspection and sets the trade number.
- **Sales manager** — sets the margin used in the trade-in calculation and reviews the finished report.
- **Dealer admin** — inspection records and their photos are retained per dealership.

## Core workflow

1. **Start the inspection** against the vehicle (shares the same 28-item template as [TruLens](./trulens.md), so existing photos carry over).
2. **Grade each item.** For every panel, accessory and document, record a status (e.g. OK / Damaged, Present / Not present, Valid / Expired, FSH / Partial / No book) and a condition, and enter a recon cost where one applies.
3. **Tag damage (manual).** Marks are placed on the relevant panel with a type and severity. **There is no AI damage detection** — the `/api/inspect/damage` endpoint is a stub returning empty findings, so every tag is placed by the inspector by hand. The grade is computed purely from what's entered.
4. **Fetch a market value.** TruInspect requests an average retail price for the make/model/year/variant; if a live figure isn't available it falls back to a pre-built cars.co.za / AutoTrader search so the appraiser can read the market and enter it manually.
5. **Set the trade price.** The app computes **(average retail − total recon) × (1 − margin %)** and shows the number; the dealer stays in control of margin and the final figure.
6. **Issue the report.** Generate the VIR or the Trade-In Appraisal (each with its own reference ID) to share with the customer, a buyer, or a finance house.

## Screenshots

[SCREENSHOT: Inspection sheet — the 28-slot checklist grouped by category, with status/condition controls and a recon-cost field on a damaged item]

[SCREENSHOT: A photo with an AI-detected damage tag pinned to a panel]

[SCREENSHOT: Market Valuation screen — "Fetch Market Value" with the returned retail figure and source breakdown]

[SCREENSHOT: Trade-in calculation — retail, total recon, margin slider, and the resulting trade price]

[SCREENSHOT: Finished VIR / Trade-In Appraisal report ready to send]

## Notes on scope

- **What's built:** full 28-item inspection (28 slots / 35 checklist points / 25 disclosure questions) with status/condition/recon per item, an overall rating, **manual** damage tagging (no AI detection — the damage endpoint is a stub), market-value lookup via the live scraper (AutoTrader + Cars.co.za through Bright Data) with a manual fallback, the trade-in value calculation, and two separately-referenced report documents (VIR and Trade-In). Installable as a PWA; records are retained per dealership.
- **Coming soon / partial:** the Basic (fully manual) vs. AI-assisted split is described as a product tier but is **not enforced in the code** today. There is no AI damage-detection path at all — treat any tier packaging as a commercial decision, not a feature flag.

## Related modules

- **[TruLens](./trulens.md)** — shares the identical 28-slot template; a car shot once serves both apps.
- **[TruFlow](./truflow.md)** — the recon costs and condition feed the DMS's stock-health and deal-readiness picture.
- **[Showrooms → TruTrade](./showrooms.md)** — the live-video appraisal for trade-ins the customer can't bring in.
- **[Getting Started](./getting-started.md)**
