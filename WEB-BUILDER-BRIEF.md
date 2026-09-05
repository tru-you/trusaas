# TruDealer — Product & Platform Fact Sheet

> **Purpose:** accurate, up-to-date information about the TruDealer apps, widgets
> and integrations — for the marketing site and any dealer-facing copy.
>
> **Ground truth:** every fact below was verified against the application source
> in `TruDealerMaster/` (git `main`, tip `6c5fb9d`) on 2026-08-27. The older
> brief that was used before contained false information; the errors are listed
> in [§9](#9-false-information-previously-given) so nothing gets repeated.
>
> **The one thing to keep in mind:** the marketing site should describe what the
> software **actually does**. Every feature listed here is shipped, live, and
> usable today. Nothing here is a roadmap promise.

---

## 1. What TruDealer is

TruDealer is a dealer-management platform for independent used-car dealerships
in South Africa. It covers the full lifecycle of a car:

**Shoot it (TruLens) → Prove it (TruInspect) → Run the business (TruFlow DMS) → Sell it from anywhere (TruFlow Mobile) → Put it in front of buyers (website feed, TruOrbit 360, widgets) → Close the deal (deals, finance, documents).**

One subscription, one login, everything in one place. Runs in the browser and
installs as an app (PWA) — no downloads, no hardware.

### The core suite

| App | One-liner | URL |
|---|---|---|
| **TruFlow** | The dealer's operating system — stock, sales pipeline, leads, finance, deals and documents | `flow.tru-saas.com` |
| **TruLens** | Guided photo capture — any staff member shoots a car to a professional standard on a phone | `lens.tru-saas.com` |
| **TruInspect** | Vehicle condition reports (VIR) and trade-in appraisals you can defend | `inspect.tru-saas.com` |
| **TruFlow Mobile** | The whole dealership in your pocket — leads, stock, follow-ups on the floor | `app.tru-saas.com` |

### Around the core

| Product | One-liner | URL |
|---|---|---|
| **TruLive** | Live guided video walkthrough — the dealer walks the buyer around the car in real time | `live.tru-saas.com` |
| **TruTrade** | Live video trade-in appraisal — the customer films their own car, the dealer prices it | `trade.tru-saas.com` |
| **TruChat** | The 24/7 website assistant — answers questions, searches stock, captures leads, hands off to WhatsApp | chat + embed |
| **TruSocial** | Auto-publish stock to Facebook, Instagram and Google Business from the DMS | inside TruFlow |
| **TruCRM** | Outbound sales CRM — lead generation, power dialler, dealership contact scraping | `crm.tru-saas.com` |
| **Website widgets** | Drop-in tools for a dealer's site — affordability, finance calculator, forms, bookings, trade-in estimate | `cdn.tru-saas.com` |
| **TruOrbit** | The 360° car view built automatically from a TruLens shoot | embeddable on any site |

---

## 2. The apps — what they do

### Functions at a glance

| App | Function | Who it's for | Key output |
|---|---|---|---|
| **TruFlow** | Run the business — stock, pipeline, leads, finance, deals, documents | Dealer principal, managers, sales team (desktop) | A managed, web-ready dealership with live inventory + closed deals |
| **TruLens** | Shoot a car to a professional standard, on a phone, with no photographer | Yard staff (phone) | A complete, web-ready photo package + 360° spin, exported to the DMS |
| **TruInspect** | Prove the condition and price a trade-in defensibly | Appraisers + office staff | A signed VIR / trade-in appraisal PDF a bank will accept |
| **TruFlow Mobile** | Run the day from your phone — leads, stock, follow-ups, add-a-car | Floor staff (phone) | The same live DMS in your pocket |
| **TruChat** | Never miss a website enquiry — 24/7 assistant | Website visitors / dealer | Qualified leads in the CRM |
| **TruLive** | Sell to a remote buyer with a live video walkthrough | Sales rep + buyer | A guided live viewing + inspection summary |
| **TruTrade** | Appraise a trade-in remotely — customer films, dealer prices | Customer + appraiser | A trade price, subject to viewing |
| **TruSocial** | Get stock in front of buyers automatically | Dealer | Auto-posts to Facebook / Instagram / Google Business |
| **TruCRM** | Generate outbound leads and run the calls | Sales team | Contact lists, dialling, follow-ups, battlecards |
| **Website widgets** | Turn a website into a lead machine | Any dealer site | Structured leads delivered by webhook |

### 2.1 TruFlow — the dealer desktop (DMS)

**What it is.** TruFlow is the system of record for the dealership. Every vehicle,
lead, task, invoice and staff login lives here; the other apps feed into it and
the dealer's website reads from it. A car moves through the whole lifecycle in
TruFlow — stock-in, recon, pricing, sale, handover.

**What a dealer can actually do:**

- **Manage stock** — add vehicles (by hand, from TruLens capture, or bulk
  import); track price, cost, mileage, recon; see stock-health ageing (30/60/90+
  days); mark a car **live on the website** with one toggle. Rich vehicle data:
  condition score, damage pins, 360° spin, service history, documents.
- **Run the sales pipeline** — leads in a kanban board (New → Contacted → Test
  Drive Scheduled → Negotiating → Closed), round-robin auto-assignment to
  active salespeople, WhatsApp/call/email from the lead, test-drive diary.
- **Close deals properly** — Deal Readiness checklist (NATIS, roadworthy,
  invoiced, deposit, delivered), document workflow (proforma → offer → invoice
  → handover) with real PDFs and captured signatures.
- **See the numbers** — capital tied up in stock, projected vs realised margin,
  finance & recon, invoices, expenses, repayment calculator.
- **Publish to the web** — the dealer's website pulls live stock straight from
  TruFlow; no hand-editing the site. Category ("showroom tier") decides where a
  car sits on the site.
- **Manage the team** — staff seats with roles (principal / manager /
  salesperson), one-time access codes, instant off-switch.
- **Automate marketing** — push stock to Facebook / Instagram / Google Business
  (TruSocial), and let the built-in AI assistant answer staff questions about
  their own stock and leads.

**Not in TruFlow:** photo capture (that's TruLens) and vehicle inspection
(that's TruInspect). VIN decoding is not wired — staff enter the VIN manually.

### 2.2 TruLens — guided photo capture

**What it is.** A phone app that walks a staff member around a car, prompting
shot by shot, until the vehicle is photographed to a consistent, web-ready
standard — then exports the whole package to the DMS with one tap. No separate
photographer, no manual upload.

**What it does:**

- **28 guided shots in 3 phases** (front & engine, full exterior walk-around,
  interior/history/verification). New staff capture like the pros.
- **Licence-disc scan** — reads the PDF417 barcode to auto-fill make, model,
  colour, VIN and disc expiry.
- **Damage tagging** — tap the photo, pin the panel, note type and severity.
  Tags carry through to the report and the website.
- **Quality scoring & readiness** — scores each shot, grades the shoot, and
  tells you when a car is ready to export and publish.
- **TruOrbit 360** — automatically builds a drag-to-spin 360° view from the
  exterior shots. Included in every shoot.
- **Market value** — one tap pulls live market prices (AutoTrader + Cars.co.za)
  so the car is priced against reality.
- **TransUnion verification** — price checks, registration checks and accident
  reports, right in the capture flow.
- **Export to the DMS** — pushes photos, scores, damage and the 360 to TruFlow
  against the stock number.

### 2.3 TruInspect — condition reports & trade-in appraisals

**What it is.** Turns a walk-around into a professional, printable condition
report (VIR) and a defensible trade-in appraisal — the paperwork a buyer, bank
or auction house takes seriously.

**What it does:**

- **Vehicle Inspection Report (VIR)** — 28 photos, a 35-point checklist across
  6 areas, 25 disclosure questions, manual damage tagging, an overall grade
  (Excellent / Good / Fair / Poor), and the inspector's signature. Generates a
  clean A4 PDF with a `VIR-` reference.
- **Trade-in appraisal** — the same walk-around plus a transparent trade price:
  **live market retail − recon costs − dealer margin**, shown line by line. A
  signed offer the dealer can stand behind, with a `TI-` reference and 7-day
  validity.
- **Live market pricing** — pulls real listings (AutoTrader + Cars.co.za via
  Bright Data) with mileage adjustment, so the numbers aren't guesses.
- **TransUnion checks** — registration check (stolen / finance outstanding) and
  accident/claims history, gated per-dealership.
- **Desktop manager** — office staff review, edit, contact and export from a
  desktop shell; field inspectors use the phone app.
- **Works with TruLens** — a car shot in TruLens carries straight into the
  inspection, no re-shooting.

### 2.4 TruFlow Mobile — the dealership in your pocket

**What it is.** The phone companion to TruFlow or standlone for small dealers. Floor staff work the day from
their phone — leads, stock, follow-ups, add-a-car — against the **same live
data** as the desktop.

**What it does:**

- **Home** — KPIs at a glance (in stock, live on site, active leads), follow-ups
  due today, stale leads that need chasing.
- **Leads** — search, stage updates, one-tap Call / WhatsApp / Email, walk-in
  quick add.
- **Stock** — search and filter the yard; flip a car **live on the website**
  from your phone; get a live market value; **share a car** as a deep link that
  opens the dealer's website.
- **Add a vehicle** — full form with market value and TruPrice benchmark, saved
  unpublished until you're ready.
- **Follow-ups** — create, edit and resolve tasks, grouped overdue / today /
  upcoming.
- **Dealer Assist** — the built-in AI answers floor questions about stock and
  leads.

Entry-level dealers can run entirely on Mobile; full-DMS dealers use it as the
floor companion. **TruFlow Light (the old web console) was retired in August
2026 and replaced by Mobile.**

---

## 3. The buyer-facing products

### 3.1 TruChat — the 24/7 website assistant

A chat assistant on the dealer's site that never sleeps:

- **Answers instantly, for free** — hours, location, finance, trade-in, warranty
  come from the dealer's own settings (no AI cost).
- **Searches live stock** — a buyer asks "what Fortuners do you have?" and gets
  real cards from the dealer's feed.
- **Captures the lead** — qualified visitors land straight in the TruFlow CRM.
- **Hands off to WhatsApp** — pre-filled message to the yard when the buyer is
  ready for a human.
- **Never breaks** — if the AI brain is unreachable it still answers common
  questions and offers WhatsApp.

Two delivery forms: a **WordPress plugin** (self-contained, leads in its own
portal) and a **DMS-connected embed** (leads into the TruFlow CRM) for TruDealer
dealers. There is also **TruChat Voice** — an after-hours AI receptionist that
answers calls — hosted on CloudTalk.

### 3.2 TruOrbit — the 360° car view

The drag-to-rotate 360° view on a vehicle listing. **No extra shoot required** —
it's built automatically from the exterior photos taken in TruLens, with any
tagged damage shown as points on the spin. TruLens builds it; any website plays
it back. A genuine differentiator for dealer listings.

### 3.3 TruLive — live video walkthrough

A dealer sends a single-use link over WhatsApp; the buyer opens it in their
phone browser (no app, no install) and the two walk the car together on a live
video call — guided section by section, with the buyer able to snapshot and flag
concerns. Ends with an inspection summary for the CRM and the buyer.

### 3.4 TruTrade — live trade-in appraisal

The inverse of TruLive: the **customer** films their own car from their phone
while the **dealer** guides, asks questions and records findings — then the
dealer sets a trade price, subject to a physical viewing. Brings trade-ins
forward to a video call so the yard isn't chasing blind.

### 3.5 The website widgets

One script tag adds any of these to a dealer's site. Each is branded from a
single colour, isolated from the site's CSS, and captures a lead into the CRM
(or a webhook):

| Widget | What a visitor does | What the dealer gets |
|---|---|---|
| **TruAfford** | Works out what they can afford against a price | A finance-minded lead |
| **TruRepay** | Calculates a monthly repayment on a car | A lead with the exact figures |
| **TruForm** | Sends an enquiry | A lead in the CRM |
| **TruBook** | Books a test drive / showroom visit / trade-in slot | A booked appointment |
| **TruValue** | Gets an instant trade-in estimate on their car | A lead + a shareable estimate report |
| **TruShare** | Shares a car to WhatsApp/social | Free exposure (no lead) |
| **TruChat** | Chats with the dealership | A qualified lead |

All compliant (finance widgets carry the required "estimate only — not credit
approval" disclaimers built in).

---

## 4. Integrations — what the platform connects to

**Status legend:** 🟢 **Live** = wired and active in the running apps · 🟡 **Optional** = shipped in code, active only when the dealer/instance has the key configured · ⚪ **Not wired** = referenced or planned but not present in the code · 🟠 **Stub/retired** = exists as a code path but returns empty/placeholder results.

### 4.0 The webhook lead system — the integration that matters

**The core value of the widget suite and the website layer is that every
enquiry becomes a structured lead delivered by webhook.** No lead is trapped in
a form on a page; every one is pushed somewhere useful:

- **Into the TruFlow CRM** — each widget `POST`s to TruFlow's
  `/api/integration/webhook-lead` (when the embed carries `data-slug` +
  `data-flow`), scoped by dealership slug, landing in the dealer's lead pipeline
  as a normal lead. Refuses unrouted leads so nothing files to the wrong yard.
- **Into any external system** — the same widgets accept a `data-webhook` URL
  (Zapier, Make, n8n, any CRM), so a dealer with their own stack gets the lead
  directly. Webhook and TruFlow can be configured **at the same time** — leads
  fire everywhere, nothing is lost.
- **As an instant notification** — optional CallMeBot pings the dealer's
  WhatsApp the moment a lead completes.
- **Plus tap-to-chat** — every lead widget also opens a pre-filled WhatsApp
  conversation (`wa.me`) as the always-on customer floor.

**Payload contract (uniform across every widget):**
`{ dealerSlug, firstName, lastName, phone, email, source, notes }` — one shape
regardless of whether it came from the affordability widget, the finance
calculator, the enquiry form, the booking widget, the trade-in widget, or a
custom site posting directly to `/api/integration/webhook-lead`.

This is why the widgets are "lead capture," not "forms" — the system-of-record
delivery is the product.

### The AI brain

| Integration | Status | Where it's used | Notes |
|---|---|---|---|
| **DeepSeek** | 🟢 Live / 🟡 optional (degrades without a key) | Dealer Assist in every app, TruChat website assistant, listing copywriter, lead auto-assign, TruLive summaries, TruTrade condition write-ups | Model `deepseek-chat` (chat brain) / `deepseek-v4-flash` (live/trade). Every feature falls back to a rule-based answer — nothing breaks. |
| **Anthropic Claude** | 🟡 Optional, plugin-only | Standalone **WordPress TruChat plugin** only | The hosted brain is **DeepSeek**, not Claude. Only the WP plugin still calls Claude. |
| **AI damage detection** | 🟠 **Stub — not real** | "Scan with AI" buttons in TruLens/TruInspect | Endpoint returns `{aiMode:false, findings:[]}`. All tagging is manual. Do not market this. |

### Vehicle data & market pricing

| Integration | Status | Where | Notes |
|---|---|---|---|
| **TransUnion eValue8 (Imagin8)** | 🟢 Live | TruFlow, TruLens, TruInspect | Free: specs + model catalogue. Paid (per-call, bundle-gated): valuation, registration check, accident report. One shared credit ledger in TruFlow; TruLens/Inspect proxy to it. Demo = simulated (5 of each per session). |
| **Bright Data Web Unlocker** | 🟢 Live | All 4 apps + TruValue widget + trade-estimate API | The **market-value scraper** (AutoTrader.co.za + Cars.co.za + Google SERP fallback). The "Get market value · Free" button is never gated and runs real data even in demo. |
| **VIN decoding** | ⚪ **Not wired** | — | TruFlow tells staff to enter the VIN manually. Don't claim VIN auto-decode. |

### Marketing & communications

| Integration | Status | Where | Notes |
|---|---|---|---|
| **Webhook lead delivery** | 🟢 **Live — the lead engine** | All widgets + any custom dealer site | TruFlow `/api/integration/webhook-lead` (into the CRM) **and/or** any `data-webhook` URL (Zapier/Make/n8n/CRM). See §4.0. Also inbound inventory sync. |
| **Zernio (TruSocial)** | 🟢 Live | TruFlow (publish FB/IG/Google Business), TruCRM (ads, inbox, WhatsApp DM) | Stock auto-publishing; dealer-owned account connect. |
| **WhatsApp (tap-to-chat)** | 🟢 Live everywhere | All apps, all widgets | Free `wa.me` pre-filled links — the always-on floor on top of the webhook lead. |
| **WhatsApp Business API (Meta Cloud API)** | 🟢 **Owned & available (TruSaaS side)** | WhatsApp Business bot bridge (`truchat/shared/wa-business.js`, chat stack) + TruCRM `/api/whatsapp/send` | TruSaaS holds WhatsApp Business API capability. The chat stack includes a **WhatsApp Business bot bridge** that runs the same TruChat brain over a business number and forwards qualified tickets to the dealer's personal WhatsApp (the module's header says the Meta webhook server must be wired to it). TruCRM has real programmatic send live (`graph.facebook.com/v21.0`). **Marketing framing:** leads are delivered by webhook; WhatsApp is the human handoff layer — and the API is in the house. |
| **CallMeBot** | 🟡 Optional (per-embed key) | Widgets | Free WhatsApp ping on new leads for dealers with no CRM. A notification, not a system of record. |
| **SMTP email** | 🟡 Optional (server config) | TruFlow send engine, TruChat dual emails | Dealer + customer notifications. |
| **SMS gateway** | 🟡 Optional (server config) | TruFlow send engine | Generic SMS API + fallback to `sms:` links. |
| **CloudTalk** | 🟢 Live in TruCRM / ⚪ platform-only for Voice | TruCRM (click-to-call dialler, SMS, agents), **TruChat Voice** (after-hours AI receptionist) | TruChat Voice is configured in the CloudTalk platform, **not in this codebase** — its "demo" is a phone number. Confirm it's still live before quoting it. |

### Business systems

| Integration | Status | Where | Notes |
|---|---|---|---|
| **Codat (Xero / QuickBooks / Zoho Books)** | 🟡 Optional (server key) | TruFlow accounting | Connect + invoice push. |
| **Third-party CRMs (HubSpot / Salesforce / Pipedrive)** | ⚪ **Not wired** | — | Only the generic `/api/integration/webhook-lead` inbound exists. |
| **Firebase / Firestore** | 🟡 Legacy path, not production | TruLens/TruInspect | Production runs local JSON stores on disk; Firestore is a fallback mode only. |

### Scrapers & data sources

| Integration | Status | Where | Notes |
|---|---|---|---|
| **Market scraper (AutoTrader + Cars.co.za)** | 🟢 Live | All 4 apps + widgets | One engine, three faces: dealer "Get market value", TruValue widget, `/api/public/trade-estimate`. Mileage-adjusted, 15-min cache. |
| **Dealership directory scraper (Cars.co.za)** | 🟢 Live | TruCRM | Finds dealerships by location with phone numbers (AutoTrader directory excluded — SPA + reCAPTCHA). |
| **Job-board scraper (Indeed/LinkedIn/Adzuna/etc.)** | 🟢 Live | TruCRM | Hiring search. |
| **Google SERP / Geoapify** | 🟡 Optional (key) | TruCRM, market scraper fallback | SERP business lookup + geo search. |

### Data & payments

| Integration | Status | Notes |
|---|---|---|
| **Bank AVS (account verification)** | 🟢 Live (Flow only) | Imagin8 AVS in the Flow lead detail (debit-order verification). |
| **Online payments** | ⚪ **Not wired** | No payment gateway in the product. Deals close on invoice + deposit, offline. |

---

## 5. Pricing (current — 2026-08)

### Platform packages

| Tier | Monthly | Setup | Highlights |
|---|---|---|---|
| **TruStart** | **R 1,599** | Free | Single rooftop, no unit cap, inspections, capture studio (1 user), AI chat, dealer website |
| **TruPro** | **R 3,599** | R 15,000 — **R 7,500** if signed within 48h of a demo | Full DMS + F&I, unlimited inspection templates, damage tagger, full TransUnion, 3 capture users, video handover, social publishing, trade-in valuation |
| **TruEnterprise** | **R 3,599 per rooftop** | R 20,000 (quoted) | Multi-branch, white-label, API, unlimited capture users, TruChat Voice, dedicated SLA |

Month-to-month, cancel anytime, data exports to CSV/Excel. No per-seat fees on
DMS users.

### Standalone apps & widgets

**Setup is once-off and the monthly fee rides on top of it.** Nothing here
replaces the monthly price — a standalone app or widget costs its setup fee
**plus** its monthly fee (monthly rates are quoted per dealer/package).

| Item | Setup fee | Monthly | What you get |
|---|---|---|---|
| **Standalone app** (TruLens / TruInspect on a dealer's own site) | **R 999 once-off** | Monthly app fee applies on top | The app running standalone for that dealer, fully set up and branded |
| **Widgets** (TruAfford / TruRepay / TruForm / TruBook / TruValue / TruChat) | **R 599 once-off per widget** | Monthly widget fee applies on top | The widget embedded + branded on the dealer's site, with lead delivery to their CRM/webhook |
| **Widget site bundle** | Widget setup fees (R 599 each) | Monthly bundle fee applies on top | The set of widgets a dealer wants, each installed and configured |

### Optimisation services (monthly retainer)

| Service | Price | What's included |
|---|---|---|
| **SEO / AEO optimisation** | **R 1,899 / month** | AEO (answer-engine optimisation), SEO, schema markup, Search Console setup & monitoring, and the ongoing optimisation work — so the dealer's site actually gets found in Google and AI search |

> ⚠️ **Stale pricing is still scattered around:** `social.html` says **R 850 /
> R 1,650** (old platform pricing); the flagship `technology.html` case-site page
> carries old module pricing (R500/R1,000/R2,500 site packages, "TruFlow Lite");
> the homepage chatbot references "$290/mo" and "TruFlow Lite". **The numbers in
> the tables above are the current published structure — but confirm the final
> figures with Paul before publishing anything.**

---

## 6. Where everything lives (for reference)

| Service | Domain | What |
|---|---|---|
| TruFlow DMS | `flow.tru-saas.com` (+ `premium.tru-saas.com` alias) | The DMS |
| TruLens | `lens.tru-saas.com` | Capture app |
| TruInspect | `inspect.tru-saas.com` | Inspections |
| TruFlow Mobile | `app.tru-saas.com` | Phone app |
| TruLive | `live.tru-saas.com` | Video walkthroughs |
| TruTrade | `trade.tru-saas.com` | Trade-in appraisals |
| TruChat brain | `chat.tru-saas.com` | AI chat service |
| TruCRM | `crm.tru-saas.com` | Outbound CRM |
| Widgets | `cdn.tru-saas.com` | Embeddable widgets |
| Marketing site | `trudealer.tru-saas.com` | **This site** |

All services are always-on (no cold starts). Dealer data lives on mounted
disks — dealers never lose inventory on a deploy.

---

## 7. Naming — use these

| Use | Not | Why |
|---|---|---|
| **TruFlow** | TruFlow Lite / TruFlow Light | Light retired Aug 2026 → Mobile |
| **TruLive** | TruView | Old name |
| **TruTrade** | TruValue (the video appraisal) | See below |
| **TruValue** | — | The **widget** / instant online trade-in estimate (not the video appraisal) |
| **TruOrbit** | Tru3D | Old name |
| **TruDealer** | — | The product line |
| **TruProperty** | — | The real-estate sibling (separate, don't reference in dealer copy) |

---

## 8. Demo accounts (for screenshots and copy)

Every app has **"Try demo (24h)"** on the login screen — isolated sandbox, no
sign-up. Use real demos for screenshots instead of old mockups. **`true-cars`**
is the flagship demo dealership (live site: true-cars.co.za). Demo mode includes
simulated TransUnion data (so the paid lookups can be demoed) but **live, real
market prices** (so the pricing story is genuine).

---

## 9. False information previously given

Errors from the earlier brief / old site that must not be repeated:

1. **"27 photo slots"** → the code has **28** (TruLens and TruInspect).
2. **"TruFlow Light is a product at flow.tru-saas.com/light"** → Light is
   **retired**; `/light` redirects to `app.tru-saas.com` (TruFlow Mobile).
3. **"TruChat brain runs on Claude"** → the hosted brain is **DeepSeek**. (The
   standalone WordPress plugin uses Claude internally — two builds, two
   providers. For the platform/marketing story: **DeepSeek**.)
4. **"AI damage detection is a feature"** → it is a **stub**. Damage tagging is
   manual. Previously marketed — not real, don't repeat.
5. **"TruLive/TruTrade AI summaries run on Claude"** → **DeepSeek**.
6. **"The CDN ships 8 widgets including chat and concierge"** → the CDN ships
   **7** (afford, book, form, loader, repay, share, value). **Chat 404s on the
   CDN** — it's deployed per-site, not on the widget CDN.
7. **"TruValue works as the trutrade consumer flow"** → the `truvalue.html` in
   the trutrade app is a **static prototype**. The real engine is the TruValue
   **widget** + the `trade-estimate` API on TruFlow.
8. **"Pricing R850 / R1,650"** → current is **R1,599 / R3,599**.
9. **"The dealer website is auto-generated"** → there is no auto-publish
   pipeline. Dealer sites consume the live stock feed (and can use the embed
   stock widget or TruOrbit viewer).
10. **"TruFlow tiers gate features"** → **one product, no tier gating**. Tiers
    are a packaging/pricing story, not a feature difference in the software.
    (The "Premium" name is branding.)
11. **"VIN decoding / AI damage detection / HubSpot-Salesforce-Pipedrive
    connectors"** → none of these exist. **The webhook lead system is the
    value** — every widget and any custom site delivers structured leads into
    the TruFlow CRM and/or any external webhook (Zapier/Make/n8n). WhatsApp is
    the handoff layer: tap-to-chat everywhere, a WhatsApp Business bot bridge
    in the chat stack, and TruCRM with real Meta Cloud API send. Don't claim
    VIN decode or AI detection — they're not there.
12. **"Online payments are accepted"** → **no payment gateway** is wired. Deals
    close on invoice + deposit, offline.

---

*Prepared from `TruDealerMaster` @ `main` (6c5fb9d), 2026-08-27. Internal
document — verify pricing and any commercial claims with Paul before publishing.*
