# TruSaaS handoff — pick up here

**Saved:** 2026-07-20  
**Resume:** Free-tier deploy on **Render** → **trusaas.co.za** (`lens` + `app` + `www`) + **MKR** pilot. Ray/TruChat ~90%.

---

## Decision (locked)

- Host product stack on **trusaas.co.za** (you own it).
- **Free tier:** **Render** free web services + free static (see `DEPLOY.md` + `render.yaml`).
- **true-cars.co.za** stays consumer demo only — not the product home.
- MKR this week; Ray chat almost done.
- Day-one: Premium path only (skip live Lite unless needed).

### Domain map

| Host | App |
|------|-----|
| `www.trusaas.co.za` / apex | Marketing landing (`index.html`) + static kit |
| `lens.trusaas.co.za` | TruLens (HTTPS + PWA / camera) |
| `app.trusaas.co.za` | TruFlow Premium (MKR primary) |
| `lite.trusaas.co.za` | TruFlow Lite (optional later) |
| `chat.trusaas.co.za` | Ray / TruChat when ready |
| `mkr.trusaas.co.za` | Temp MKR showroom only if they have no domain |
| true-cars.co.za | Public consumer demo (TruWeb) — leave as prospect link |

**Day-one minimum:** `lens` + `app` + `www`.

### Wiring after deploy

- Flow Settings → TruLens URL = `https://lens.trusaas.co.za`
- Flow → dealer slug `mkr-autosales`, WhatsApp `27…`
- TruLens env `TRUFLOW_DMS_URL` = `https://app.trusaas.co.za`
- MKR site reads `https://app.trusaas.co.za/api/public/stock?dealer=mkr-autosales`

---

## Honest product status (3 modules)

| Module | Score | Notes |
|--------|-------|--------|
| TruLens | ~8/10 | Capture, readiness, export, PWA, logout, deep-link |
| Flow Premium | ~8/10 | Inventory, CRM, media, shoot/WA, aging filter |
| Flow Lite | ~7.5/10 | Same core story; honest entry tier — not day-one host |

Good enough to demo and pilot. Not multi-tenant enterprise yet. Shared Flow password `2026` = pilot only.

---

## Deploy-ready polish (done this session)

- [x] Host pick: **Render free** documented in `DEPLOY.md`
- [x] `render.yaml` blueprint (lens + app + www)
- [x] Flow Premium: `PORT` from env + `/api/health`
- [x] Production defaults: TruLens URL + dealer slug `mkr-autosales` on trusaas hosts
- [x] Landing demos → `https://app.` / `https://lens.trusaas.co.za`
- [x] MKR stock APIs prefer live `app.trusaas.co.za` (localhost fallback for local dev)
- [x] `.env.example` + nixpacks for Node services

### Still on you before go-live

1. DNS for `www` / `lens` / `app` on **trusaas.co.za**
2. Connect GitHub → Render Blueprint (or manual services)
3. Attach custom domains + wait for SSL
4. Settings wiring + one phone PWA shoot → export → Flow
5. Retire old host versions / detach old domains

---

## Case study & landing

- Landing: `index.html` — true-cars demo + **Your Car Guy** TruChat case study card
- Case study file: `truchat-your-car-guy.html`
- Product kit: `autolens-pro`, `truflow-light`, `truflow-premium`, `truweb`, docs

---

## Features recently added (useful)

**TruLens**

- `?stock=` deep-link from Flow **Shoot** → search + banner + pulse highlight + scroll
- Copy stock # on catalogue card
- Readiness chips: All / Needs shots / Web-ready

**Flow Lite + Premium**

- Photo filter: Needs shoot / Partial / Web-ready
- Stock: Shoot · WhatsApp · copy blurb
- Lead WhatsApp when phone present
- Aging filter: 30+ / 60+ / 90+ days + age colour on cards

**Local ports (dev)**

- TruLens `:3000` · Premium `:3001` · Lite `:3002`

See also: `DEPLOY.md`, `PRODUCTION.md`, `PRODUCT-CUT.md`.

---

## This week — MKR checklist

1. DNS on trusaas.co.za: `www`, `lens`, `app` (+ `chat` when Ray ships)
2. Deploy Lens + Flow Premium on Render HTTPS
3. Point integrations (Lens URL / DMS URL / dealer slug)
4. MKR site (path under www or temp `mkr.`) + public stock embed
5. Phone: install TruLens PWA, shoot one unit, export, see photos in Flow
6. Don’t block on Lite packaging — give MKR what’s real (Premium path)
7. Label pilot auth; plan real users before broader roll-out

---

## Product rules (don’t break)

1. **Capture only in TruLens** — Flow is not a second camera  
2. Lite = stock + leads + tasks + light costs  
3. Premium = + media hub + full recon + syndication  
4. Website only **reads** public APIs  

---

## Next session prompt

> Pick up TruSaaS from HANDOFF.md — Render free tier on trusaas.co.za (lens + app + www). Finish DNS + first deploy, wire MKR, phone PWA smoke test. Ray chat ~90% when hosting is live.

---

*End of handoff.*
