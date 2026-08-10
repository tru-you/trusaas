# TruLens

*Guided photo capture for the yard. Feeds [TruFlow](./truflow.md) and the dealer website.*

## What it does

TruLens is a phone app that walks a staff member around a vehicle, prompting them shot by shot until the car is photographed to a consistent standard. Every capture is scored for quality, packaged for the website (including a 360° spin), and pushed straight into the dealer's DMS — so a car goes from arrival to web-ready without a separate photographer or a manual upload step. It runs as an installable phone app (PWA) and needs no app-store download.

## Who uses it

- **Sales rep / yard staff** — does the walk-around capture on their phone.
- **Dealer admin** — sets the dealership the captures file into and confirms cars are web-ready before they publish.

## Core workflow

1. **Sign in and pick the vehicle.** Staff open TruLens on their phone, choose the dealership, and select or start the vehicle they're shooting.
2. **Scan the licence disc (optional).** The disc's PDF417 barcode is scanned to pull make, model, colour, VIN and expiry, so the record isn't typed by hand.
3. **Walk the guided capture.** The camera guide runs three phases — Front & Engine, Clockwise Exterior Walk-Around, and Interior/History/Verification — across 27 named shots. Each phase gets its own quality score card.
4. **Tag any damage.** Marks are placed on the relevant panel so they carry through to the report and the website spin.
5. **Check readiness.** TruLens grades the shoot (shots taken vs. required, overall quality score) and shows whether the car can be exported to the DMS and published to the web.
6. **Export to DMS.** With one action the photos, spin package and scores are pushed into [TruFlow](./truflow.md) against that stock number.

## Screenshots

[SCREENSHOT: TruLens home on a phone — dealership picker and the vehicle/inventory list, one card mid-capture]

[SCREENSHOT: The camera guide mid-shoot — the phase tab strip (Front & Engine / Exterior / Interior) with the on-screen shot prompt and framing overlay]

[SCREENSHOT: Licence-disc scanner with the PDF417 barcode lined up in the capture box]

[SCREENSHOT: Damage tagger — a marker dropped on a rear quarter panel with a severity label]

[SCREENSHOT: Readiness / publish gate screen showing "Ready to publish", shots taken vs. required, and the VIR quality score]

## Notes on scope

- **What's built:** 27-slot guided capture across 3 scored phases, licence-disc barcode scan, damage tagging, quality/readiness scoring, 360° spin package generation, and keyed photo export to TruFlow. Installable as a PWA.
- **Coming soon / partial:** the licence-disc scanner is functional but not yet 100% reliable across all phones (it falls back to manual entry on a miss).

## Related modules

- **[TruFlow](./truflow.md)** — receives every TruLens capture; captures are only ever taken in TruLens, not in the DMS.
- **[TruInspect](./truinspect.md)** — shares the same 27-shot template, so a car captured in TruLens doesn't need re-shooting for a condition report.
- **[Showrooms → TruOrbit](./showrooms.md)** — the 360° spin TruLens builds is what TruOrbit plays back on the website.
- **[Getting Started](./getting-started.md)** — where TruLens sits in the first Lens → Flow → publish cycle.
