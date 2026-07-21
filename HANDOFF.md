# TruSaaS handoff — pick up here

**Saved:** 2026-07-21  
**Resume:** Core product is **Live on Render Starter (always-on, upgraded 2026-07-21)** — keep-alive scripts/task retired, `render.yaml` now `plan: starter`. See **`STABILITY.md`** (smoke, junk filter). Next: YCG + Firebase `LOCAL_MODE=0` + real auth.

---

## Live right now (verified 2026-07-20)

| Module | URL | Health |
|--------|-----|--------|
| **TruLens** | https://trusaas-lens.onrender.com | `{"ok":true,"mode":"local","dmsUrl":"https://trusaas-premium.onrender.com"}` |
| **TruFlow Lite** | https://trusaas-flow.onrender.com | `{"ok":true,"product":"truflow-lite"}` |
| **TruFlow Premium** | https://trusaas-premium.onrender.com | `{"ok":true,"product":"truflow-premium"}` |

**Stock API (MKR):**
- Premium: `https://trusaas-premium.onrender.com/api/public/stock?dealer=mkr-autosales` → 5 vehicles (incl. TruLens import)
- Lite: `https://trusaas-flow.onrender.com/api/public/stock?dealer=mkr-autosales` → 5 vehicles

**Wiring already set on Render:**
- Lens `TRUFLOW_DMS_URL` → Premium (MKR path)
- Cold start on free tier: first hit after idle can take ~30–60s

**Not live:**
- `trusaas.co.za` — DNS does not resolve (optional; use onrender.com URLs for demos)
- `true-cars.co.za` / `tru-cars.co.za` — separate consumer/Host Africa track (still NXDOMAIN last check)

---

## Decision (locked)

### Product suite (full story)

**Core (hosted on Render / trusaas subdomains):**

| Module | Host | Folder |
|--------|------|--------|
| **TruLens** | `trusaas-lens.onrender.com` | `TruLens` |
| **TruFlow Lite** | `trusaas-flow.onrender.com` | `truflow-light` |
| **TruFlow Premium** | `trusaas-premium.onrender.com` | `truflow-premium` |

**Also part of TruSaaS (experience + AI — demos on true-cars / technology):**

| Module | Role |
|--------|------|
| **Tru3D** | Orbit + damage pins (TruLens package) |
| **TruShowroom** | Buyer site / TruWeb (true-cars.co.za) |
| **TruChat** | Site + WhatsApp AI sales |
| **TruReceptionist** | Front-desk qualify & CRM handoff |
| TruVIR · TruLive · Syndication · TruReel/Copy | Trust, remote sell, growth |

### Consumer demo (separate site)

| Site | Domain | Role |
|------|--------|------|
| **True-Cars SA** | `true-cars.co.za` | Virtual showroom + full suite story |
| Live stock | `/api/public/stock?dealer=true-cars` | + Tru3D mock/live on vehicle pages |
| Dealers hub | `dealers.html` | Product map for DPs |

### Personal (do NOT host as product)

- SaaS marketing landing (`index.html`)  
- Document hub / case-study HTML  
- Internal handoff docs  

These stay in the repo for you. They are **not** the customer product stack.

### Other

- Free tier: **Render** (`render.yaml` = 3 web services only)  
- MKR primary path: **Premium** + **Lens** (Lite available as entry tier)  
- Full site map: **`SITES.md`**  
- **Ray / Your Car Guy TruChat (ship web first):** `truchat/ray/` — `chat.html` + **`widget.js`** (WordPress FAB, Joinchat-safe) + `portal.html` (PIN, chatbot leads only). Shared `chat-core.js` + `qualifier.js`. Install: `WORDPRESS.md`. WA Business bot later (`wa-business.js`).

### Wiring after deploy

- Settings → TruLens URL = `https://trusaas-lens.onrender.com`  
- Dealer slug = `mkr-autosales`, WhatsApp `27…`  
- Lens env `TRUFLOW_DMS_URL` = `https://trusaas-premium.onrender.com` (or `flow` if on Lite)

---

## Honest product status

| Module | Score | Notes |
|--------|-------|--------|
| TruLens | ~8/10 | Capture, readiness, export, PWA — Live |
| Flow Premium | ~8/10 | Full floor ops — Live; stock API OK |
| Flow Lite | ~7.5/10 | Honest entry tier — Live |

Pilot password on Flow = pilot only. Not multi-tenant enterprise yet.

---

## Deploy checklist

- [x] Blueprint = **lens + flow + premium** only (www removed)  
- [x] Health endpoints on all three  
- [x] Repo: https://github.com/tru-you/trusaas  
- [x] Render deploy Live (verified 2026-07-20)  
- [x] MKR stock API returns data on Premium + Lite  
- [ ] Custom DNS `*.trusaas.co.za` (optional — onrender.com is fine for pilot)  
- [ ] Phone PWA smoke test (install TruLens, capture → export to Premium)  
- [ ] Clean pilot demo data (remove test vehicles like `sS DDAS`, `STK-LITE-TEST`)  

---

## Local ports (dev)

| App | Port |
|-----|------|
| TruLens | 3000 |
| Flow Premium | 3001 |
| Flow Lite | 3002 |

---

## Product rules (don’t break)

1. **Capture only in TruLens**  
2. Lite = stock + leads + tasks + light costs  
3. Premium = + media hub + full recon + syndication  
4. Personal SaaS site ≠ product modules  

---

## Local repo note (2026-07-20)

`main` tracks `origin/main`. Uncommitted local noise (do not ship as product host):
- Modified: `truweb/mkr-autosales/index.html`
- Deleted: `truchat-your-car-guy.html` (moved under `Your car guy/`?)
- Untracked: `Cars at caledon/`, `MKR/`, `Your car guy/`

---

## Next actions (pick one)

1. **Phone PWA smoke** — open Lens on phone, install PWA, capture unit, export to Premium, confirm stock.  
2. **Optional DNS** — at registrar: CNAMEs for `lens` / `flow` / `premium` → Render targets (only if you want `*.trusaas.co.za`).  
3. **Pilot polish** — purge test stock, set real WhatsApp for MKR, walk DP through Premium + Lens.  
4. **Consumer site** — separate track: Host Africa / `tru-cars` or `true-cars` DNS (still broken last check).

---

*End of handoff.*
