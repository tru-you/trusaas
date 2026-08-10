# Showrooms

*The live and interactive ways a dealer shows a car when the buyer isn't standing in the yard.*

This cluster covers three modules that share one job — closing the distance between a car on the lot and a buyer on a phone: **TruLive** (live buyer-side walkthrough), **TruTrade** (live seller-side trade-in appraisal), and **TruOrbit** (the 360° spin on the website).

---

## TruLive — live video walkthrough

### What it does

TruLive lets a dealer run a guided, live video walk-around of a car with a buyer who's somewhere else. The dealer sends a single-use link over WhatsApp, the buyer opens it in their phone browser — no app to install — and the two go through the vehicle together on a live call, section by section, with a shared checklist that advances in sync. At the end it produces an inspection summary for the CRM and the buyer.

### Who uses it

- **Sales rep** — runs the walkthrough from the car with their rear camera.
- **Buyer** — joins in-browser, watches full-screen, snapshots and flags concerns.

### Core workflow

1. **Dealer starts a walkthrough** on a vehicle and gets a single-use, 24-hour link.
2. **Shares it over WhatsApp** to the buyer.
3. **Buyer joins in-browser** and allows camera + mic; a live call connects the two phones.
4. **Guided script drives ~10 sections** (front, sides, wheels, engine bay, interior, start-up, underbody…); when the dealer advances, the buyer's prompts and checklist advance too.
5. **Buyer snapshots and flags concerns** live to the dealer.
6. **On finish, a summary is generated** (AI where the key is set, otherwise a structured local summary) with the flagged points to follow up.

[SCREENSHOT: Dealer's TruLive screen — "Start a walkthrough", the generated single-use link, WhatsApp share]

[SCREENSHOT: Buyer's in-browser view mid-call — full-screen car video, current section prompt, the ⚑ flag control]

---

## TruTrade — live trade-in appraisal

### What it does

TruTrade is the inverse of TruLive: the **customer** films their own car and the **dealer** guides, questions and records findings, then issues a trade price subject to a physical viewing. It brings a trade-in appraisal forward to a video call so a dealer can size up a car — and set expectations on price — before the customer drives in. The dealer always sets the number; **nothing in TruTrade prices a vehicle automatically**.

### Who uses it

- **Customer** — films their own car from their phone browser via a single-use link.
- **Dealer / appraiser** — guides the customer, questions privately, and sets the trade price (TP) subject to viewing.

### Core workflow

1. **Dealer opens an appraisal** for the customer's vehicle and gets a single-use, 24-hour customer link.
2. **Customer opens the link in-browser** and starts filming their car.
3. **Dealer guides the customer** through the car and records condition findings privately.
4. **A condition write-up is generated** (AI where the key is set, otherwise a structured local write-up) — it never prices the car.
5. **Dealer issues a trade price** to the customer, subject to a physical viewing.

[SCREENSHOT: Customer's in-browser filming view with the dealer's on-screen prompt]

[SCREENSHOT: Dealer's appraisal panel — condition notes and the trade-price field marked "subject to viewing"]

---

## TruOrbit — 360° spin on the website

### What it does

TruOrbit is the drag-to-spin 360° view of a car on the dealer's website. It isn't a separate shoot: it's assembled automatically from the exterior walk-around photos captured in [TruLens](./trulens.md), with any tagged damage carried through as points on the spin. TruLens captures and builds the package; TruOrbit plays it back.

### Who uses it

- **Website visitor / buyer** — drags to rotate the car and sees flagged points.
- **Dealer** — gets an interactive listing with no extra work beyond the normal TruLens capture.

### Core workflow

1. **Staff shoot the exterior walk-around** in TruLens as normal.
2. **TruLens builds the spin package** — it orders the exterior panel frames around the car, applies an approximate background cut, and attaches any damage tags.
3. **The package publishes** with the car; the viewer (`embed/web3d-viewer.html`) renders it on the website, scrubbing frames by drag.

[SCREENSHOT: TruOrbit embedded on a vehicle detail page mid-rotation, with a damage-tag hotspot visible]

---

## Notes on scope

- **What's built:** TruLive and TruTrade are live WebRTC apps — single-use 24h links, in-browser join (no install), synced guided sections, and generated summaries with a local fallback when no AI key is set. TruOrbit is generated from TruLens exterior photos and shipped with a web viewer.
- **Coming soon / partial:** TruLive/TruTrade rooms are held in memory on a single instance and use public STUN only — a small share of strict mobile networks will need a TURN server for a reliable connect, and multi-instance scale would need shared room state. TruOrbit's background removal is an approximation (not ML matting) — good for web, not a studio cut.

## Naming

TruLive was previously **TruView**; TruTrade was previously **TruValue**; TruOrbit was previously **Tru3D**. The current shipped names are used here.

## Related modules

- **[TruLens](./trulens.md)** — captures the photos TruOrbit is built from.
- **[TruInspect](./truinspect.md)** — the in-yard counterpart to TruTrade's remote appraisal.
- **[TruChat](./truchat.md)** — a booked slot can turn into a TruLive walkthrough.
- **[Getting Started](./getting-started.md)**
