# TruFlow Light

*A lightweight dealer console — leads, inventory and vehicle upload, on the same DMS.*

## What it does

TruFlow Light is a stripped-back console for a dealer who needs the day-to-day essentials without the full desktop: work leads, look at inventory, and add a vehicle. It's a single page served by TruFlow at **`flow.tru-saas.com/light`** that signs in to the **same [TruFlow](./truflow.md) backend**, so it's the same live data — not a separate system or a copy. It's the fast way onto the platform for a small yard or a staff member who only touches those three things.

## Who uses it

- **Sales rep** — works leads and adds vehicles from a simple screen.
- **Small-yard owner / admin** — the essentials without the full desktop's depth.

## Core workflow

1. **Sign in.** Open `flow.tru-saas.com/light` and enter the dealer code (the server address is pre-filled).
2. **Dashboard.** Land on a quick overview.
3. **Leads.** Search leads by name, phone or source, and update a lead's status as it moves.
4. **Inventory.** Search stock by make, model or year.
5. **Add a vehicle.** Upload a car with its details — year, make, model, variant, mileage, description, asking price and TruPrice benchmark.

Because it talks to the canonical TruFlow backend, anything done here shows up in the full [TruFlow](./truflow.md) desktop and feeds the website stock feed the same way.

## How it relates to TruFlow

TruFlow Light is **not** the retired "TruFlow Lite" service (that was a separate codebase with its own data). Light is a thin client over the **one** real DMS: same logins, same stock, same leads. Think of it as a smaller door into TruFlow, not a different building.

It has **no service or database of its own** — TruFlow (the `trusaas-premium` service) serves it as a static page at `flow.tru-saas.com/light`, and it signs into the Premium API with a dealer code. The maintained source of truth is `truflow-light/index.html` (one self-contained file); the deploy copy lives at `truflow-premium/public/light/`.

## Screenshots

[SCREENSHOT: TruFlow Light sign-in at flow.tru-saas.com/light — dealer code entry, cyan suite branding]

[SCREENSHOT: The Leads view — search bar and a lead with its status control]

[SCREENSHOT: The Inventory view — stock search by make/model/year]

[SCREENSHOT: The Add-vehicle form — year/make/model/variant/mileage/price/TruPrice fields]

## Notes on scope

- **What's built:** a single-file console with sign-in against the TruFlow backend, a dashboard, lead management (search + status update), inventory search, and vehicle upload — all against the live DMS. Served at `flow.tru-saas.com/light` and rebranded to the cyan suite identity (the old blue "LITE" mark is gone).
- **Status:** a supported, shipping entry point — not a demo, and not pending deletion (`render.yaml` documents it as the console served from `public/light`).

## Related modules

- **[TruFlow](./truflow.md)** — the full dealer desktop and the backend Light runs on.
- **[TruLens](./trulens.md)** — captures that feed the same inventory.
- **[Getting Started](./getting-started.md)** — onboarding; Light is a lighter alternative to the full desktop for the right dealer.
