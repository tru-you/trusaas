# Getting Started

*Onboarding a new dealer — from first login to a car live on the website. Written for a dealer ops person, not a developer.*

## What this covers

This is the single path a new dealership takes to go live on TruDealer: set up the account and staff logins, connect the phone-capture app to the DMS, run one car through the full **Lens → Flow → publish** cycle, and switch on the website pieces. Follow it in order and the first vehicle should be photographed, in the DMS, and showing on the site the same day.

## Who does this

- **Dealer principal / ops person** — owns the account, adds staff, confirms cars go live.
- **Yard staff** — do the capture on their phones once they're set up.
- **Whoever manages the website** — drops in the stock feed and widgets (a few copy-paste snippets).

## The onboarding sequence

### 1. Account and staff logins

1. Sign in to TruFlow at **flow.tru-saas.com** with the dealership's master admin code.
2. Go to **Team & Users** and add each staff member, choosing a role — **principal**, **manager**, or **salesperson**.
3. Each person gets a **one-time access code** shown once. Hand it over; if it's lost, rotate it from the same screen. Switching a seat off ends that person's session immediately.

[SCREENSHOT: Team & Users — adding a salesperson and the one-time code dialog]

### 2. Point the yard's phones at the DMS (TruLens)

1. Staff open **TruLens** (lens.tru-saas.com) on their phones and add it to the home screen (Install / Add to Home Screen) so it behaves like an app.
2. They sign in with the dealership's TruLens access code — this pins captures to *your* yard so a car can't file into another dealer's stock.
3. In **TruFlow → Settings**, confirm the TruLens link and the dealership slug are set so exports land in the right place.

[SCREENSHOT: TruLens install prompt on a phone home screen]

### 3. Capture the first car (Lens)

1. In TruLens, start the vehicle and (optionally) scan the licence disc to pull its details.
2. Walk the guided capture — three phases, up to 27 shots — tagging any damage as you go.
3. Check the readiness screen: it shows shots taken vs. required and the quality score, and whether the car can be exported and published.
4. Tap **Export to DMS**.

[SCREENSHOT: TruLens readiness screen showing "Ready to publish" before export]

### 4. Finish the car in the DMS (Flow)

1. In TruFlow → **All Vehicles**, open the car that just arrived from TruLens (photos, spin and scores attached).
2. Add price, recon and any missing details (enter the VIN manually — VIN decoding isn't available yet).
3. Set the car to show on the website and confirm it's web-ready.

[SCREENSHOT: TruFlow vehicle detail — a Lens-captured car with its photos, ready to publish]

### 5. Publish to the website

1. On the dealer site, add the **live stock feed** once — either the stock widget snippet (from TruFlow → Settings) or a portal webhook. The site now shows whatever is web-ready in the DMS; you never hand-edit stock on the site again.
2. Add the dealer-site widgets as needed: **[TruChat](./truchat.md)** (assistant + lead capture), **[TruForm](./truform.md)** (enquiry form), and **[TruAfford](./truafford.md)** (affordability). Each is a script tag branded with one colour and a WhatsApp number.
3. Confirm the loop: the first car appears on the site, and a test enquiry from the site lands as a lead in **TruFlow → Lead CRM**.

[SCREENSHOT: The first car live on the dealer website, pulled from the stock feed]

[SCREENSHOT: A website test enquiry appearing in the TruFlow Lead CRM]

## After the first car

- **Roll out capture** to the rest of the yard's staff and work through existing stock.
- **Add the extras** where they fit: [TruInspect](./truinspect.md) for condition reports and trade-in appraisals, and the [Showrooms](./showrooms.md) tools (TruLive, TruTrade, TruOrbit) for remote buyers.
- **Set who works leads** — turn on round-robin auto-assign in the CRM so website leads distribute across active reps.

## Go-live checklist

- [ ] Master admin signed in; staff seats created with the right roles
- [ ] TruLens installed on staff phones and signed in with the dealer code
- [ ] TruFlow Settings: TruLens link + dealership slug confirmed
- [ ] Photo sync working (a test capture exports and appears in the DMS)
- [ ] First car priced, web-ready, and published
- [ ] Stock feed / widget live on the website
- [ ] TruChat / TruForm / TruAfford added where wanted
- [ ] Test website enquiry lands in the Lead CRM

## Related modules

- **[TruLens](./trulens.md)** → **[TruFlow](./truflow.md)** — the core capture-to-publish loop.
- **[Integrations](./integrations.md)** — the feed, webhook and lead endpoints behind step 5.
- **[TruChat](./truchat.md)** · **[TruAfford](./truafford.md)** · **[TruInspect](./truinspect.md)** · **[Showrooms](./showrooms.md)**
