# TruFlow

*The dealer desktop — DMS, sales pipeline, stock management and finance in one place.*

## What it does

TruFlow is the dealership's operating system: every vehicle, lead, task, invoice and staff login lives here, and it's the system of record that [TruLens](./trulens.md) photos and website leads flow into. It tracks a car from stock-in through recon, pricing and the sales pipeline to sold, and shows the numbers that matter to a principal — capital tied up in stock, ageing, projected vs. realised margin. It runs in the browser and installs as a desktop/phone app (PWA).

## Who uses it

- **Dealer principal / admin** — the whole picture: stock health, margin, team, settings.
- **Sales manager** — the pipeline, lead assignment, deal readiness, recon.
- **Sales rep** — their leads, tasks, and the vehicles they're working.

## Core workflow

1. **Stock arrives.** A vehicle is added — by hand, from a [TruLens](./trulens.md) capture, or via an upload/integration — and lands in inventory against its stock number.
2. **Recon and price.** Recon tasks and costs are tracked on the car; stock-health flags ageing and capital tied up so nothing sits unnoticed.
3. **Publish to web.** Once a car is web-ready its media and category feed the dealer's website through the live stock feed (see [Integrations](./integrations.md)).
4. **Work the pipeline.** Leads (from the website, [TruChat](./truchat.md), or entered manually) land in the CRM, can be auto-assigned round-robin across active reps, and move through the sales stages.
5. **Close the deal.** The Deal Readiness checklist tracks the paperwork gates — NATIS, roadworthy, invoiced, deposit received, delivered — so a car isn't handed over with a step missing.
6. **Reconcile.** Finance & Recon covers expenses, reconciliation and the repayment calculator; the dashboard rolls it up into realised margin.

## The dealer desktop (what's in the nav)

| Area | What it covers |
|---|---|
| Overview | Dashboard KPIs — capital in stock, projected/realised margin, aged capital |
| All Vehicles | Full inventory, filterable by status, photo-readiness and age |
| Sales pipeline | Deals by stage |
| Add vehicle | Manual stock entry |
| Lead CRM | Leads, statuses, assignment, round-robin auto-assign |
| Tasks | Team task list |
| Stock health | Ageing bands (0–30 / 31–60 / 61–90 / 90+ days) |
| Finance & Recon | Expenses, reconciliation |
| Deal Readiness | Per-deal paperwork checklist (NATIS, roadworthy, invoiced, deposit, delivered) |
| Repayment calculator | Illustrative monthly repayment / amortisation |
| Stock media | Gallery and publish evidence per car (capture itself happens in TruLens) |
| Team & Users | Staff logins (seats) and roles |
| Settings | Dealership settings, integrations, stock feed |

## Roles and seats

Staff logins are managed as **seats** with three roles — **principal**, **manager** and **salesperson**. Adding a person creates their login and issues a one-time access code (shown once, rotatable if lost). A seat can be switched off, which ends the session immediately and drops it from the billable active-seat count while keeping that person's leads and notes.

## A note on "Premium" and tiers

The app still carries **"TruFlow Premium"** branding in places, but there is **one product**. TruFlow Lite was retired in July 2026 and its codebase removed; the nav has **no tier gating** — every dealer on TruFlow sees the full desktop. `flow.tru-saas.com` is the canonical address; `premium.tru-saas.com` is kept as an alias so older dealer embeds keep working. The only place "tier" still means something is per-vehicle **showroom category** (e.g. Premium Used / Select / Performance), which decides where a car lands on the dealer's website — not what the dealer can access.

## TruFlow Mobile

The phone companion is **[TruFlow Mobile](./truflow-mobile.md)** — a PWA at **`app.tru-saas.com`** that proxies to this same DMS backend: home KPIs, leads, stock, add-vehicle, follow-up tasks, and "share this car" deep links. Entry-level dealers can run entirely on it; full-desktop dealers use it on the floor. TruFlow Light (the old `/light` console) was **retired 2026-08-14** and replaced by Mobile — `flow.tru-saas.com/light` now 301-redirects to `app.tru-saas.com`. See its [own page](./truflow-mobile.md) for detail.

## Screenshots

[SCREENSHOT: Overview dashboard — capital-in-stock, projected vs. realised margin, aged-capital tiles]

[SCREENSHOT: All Vehicles inventory grid with the status / photo-readiness / age filters]

[SCREENSHOT: Sales pipeline board with leads across stages]

[SCREENSHOT: Deal Readiness checklist for one car — NATIS / roadworthy / invoiced / deposit / delivered toggles]

[SCREENSHOT: Team & Users — seats list with roles and the one-time access code dialog]

## Notes on scope

- **What's built:** full DMS state (vehicles, leads, tasks, invoices, agreements, documents, communications, expenses), server-persisted per dealership; TruLens photo sync; public stock feed; webhook portal push and inbound lead/inventory endpoints; Gemini-backed dealer assistant; document upload + signature capture; seats/roles.
- **Coming soon / partial:** **VIN decoding is not wired up** — the app tells staff to enter details manually rather than invent them. PDF generation for some documents currently returns a placeholder rather than a rendered file.

## Related modules

- **[TruLens](./trulens.md)** · **[TruInspect](./truinspect.md)** — feed stock, photos and condition in.
- **[TruChat](./truchat.md)** · **[TruAfford](./truafford.md)** — feed website leads in.
- **[Integrations](./integrations.md)** — the stock feed, webhooks and lead endpoints.
- **[Getting Started](./getting-started.md)**
