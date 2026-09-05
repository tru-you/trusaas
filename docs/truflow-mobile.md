# TruFlow Mobile

*The dealer's phone companion — the full DMS in your pocket, on the same backend.*

## What it does

TruFlow Mobile is the installable phone app (PWA) that gives floor staff the day-to-day DMS on a phone: work leads, look at stock, add a vehicle, and manage follow-ups — all against the **same TruFlow backend** as the desktop, so nothing is a copy or a separate system. It runs at **`app.tru-saas.com`** and proxies API calls to TruFlow (`flow.tru-saas.com`).

It replaced **TruFlow Light** (the old `/light` console) on **2026-08-14**: the `/light` route on TruFlow now 301-redirects to `app.tru-saas.com`, so old bookmarks migrate automatically. Light is retired — do not document it as current.

## Who uses it

- **Sales rep / floor staff** — leads, stock, add-vehicle and follow-ups on the phone.
- **Small-yard owner / admin** — entry-level dealers can run entirely on Mobile (leads, inventory, add-vehicle) without the full desktop.
- **Full-DMS dealers** — use it as the field companion to the desktop.

## Core workflow

1. **Sign in.** Open `app.tru-saas.com`, enter the dealer code (or "Try demo (24h)").
2. **Home.** KPI tiles (In stock / Live on site / Active leads / Unpublished), follow-ups due today, stale-lead "follow up" list. 30s polling + pull-to-refresh.
3. **Leads.** Search, stage stepper (New → Contacted → Test Drive Scheduled → Negotiating → Closed Won/Lost), Call/WhatsApp/Email, walk-in quick add, journey timeline.
4. **Stock.** Search, chips (All / In stock / Live / Draft / Sold), vehicle sheet with the "Live on website" toggle, price/km/blurb editing, market value, "Share this car".
5. **Add a vehicle.** Year/make/model/variant, mileage, asking price + TruPrice, market-value button.
6. **Follow-ups.** Create/edit/resolve tasks, grouped Overdue / Today / Upcoming / No date / Recently done.
7. **Activity + Account.** Feed, dealer code, WhatsApp support, sign-out.

Market value (the free live scraper) and "Share this car" (deep links that unfurl on the dealer website) were added in v1.3.

## How it relates to TruFlow

Mobile is a **thin client over the one real DMS**: same logins, same stock, same leads, same backend (`truflow-premium`). It has **no service or database of its own** — `truflow-mobile/` is a static PWA + a small proxy server that forwards `/api/*` and `/media/*` to `flow.tru-saas.com`.

It is **not** the retired "TruFlow Lite" service (separate codebase, own data), and it is **not** "TruFlow Light" (the old `/light` console — retired in its favour).

## Notes on scope

- **What's built:** a vanilla-JS PWA (no build step) with Home KPIs, full lead + stock management, add-vehicle with market value, follow-up tasks, share deep links, Dealer Assist chat, and demo mode. Desktop viewport (>1200px) shows a "use your phone" splash with a QR code.
- **Not in Mobile:** finance & recon, DocHub documents, TruSocial, invoicing, Imagin8 gated lookups — those stay in the full desktop.

## Related modules

- **[TruFlow](./truflow.md)** — the DMS backend Mobile runs on.
- **[TruLens](./trulens.md)** — captures that feed the same inventory.
- **[Getting Started](./getting-started.md)** — onboarding; Mobile is the fast door for floor staff.
