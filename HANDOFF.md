# TruSaaS handoff — pick up here

**Saved:** 2026-07-20  
**Resume:** Deploy **product modules only** on Render → **trusaas.co.za**. MKR pilot. Ray/TruChat ~90%.

---

## Decision (locked)

### Product (host these)

| Module | Host | Folder |
|--------|------|--------|
| **TruLens** | `lens.trusaas.co.za` | `autolens-pro` |
| **TruFlow Lite** | `flow.trusaas.co.za` | `truflow-light` |
| **TruFlow Premium** | `premium.trusaas.co.za` | `truflow-premium` |

### Consumer demo (separate site)

| Site | Domain | Role |
|------|--------|------|
| **True-Cars SA** | `true-cars.co.za` | Buyer-facing retail demo; story “powered by TruSaaS” |
| Live stock | pulls `/api/public/stock?dealer=true-cars` from Premium (see `SITES.md`) | Static `data.js` fallback |

### Personal (do NOT host as product)

- SaaS marketing landing (`index.html`)  
- Document hub / case-study HTML  
- Internal handoff docs  

These stay in the repo for you. They are **not** the customer product stack.

### Other

- Free tier: **Render** (`render.yaml` = 3 web services only)  
- MKR primary path: **Premium** + **Lens** (Lite available as entry tier)  
- Full site map: **`SITES.md`**

### Wiring after deploy

- Settings → TruLens URL = `https://lens.trusaas.co.za`  
- Dealer slug = `mkr-autosales`, WhatsApp `27…`  
- Lens env `TRUFLOW_DMS_URL` = `https://premium.trusaas.co.za` (or `flow` if on Lite)

---

## Honest product status

| Module | Score | Notes |
|--------|-------|--------|
| TruLens | ~8/10 | Capture, readiness, export, PWA |
| Flow Premium | ~8/10 | Full floor ops |
| Flow Lite | ~7.5/10 | Honest entry tier |

Pilot password on Flow = pilot only. Not multi-tenant enterprise yet.

---

## Deploy-ready

- [x] Blueprint = **lens + flow + premium** only (www removed)  
- [x] Health endpoints on all three  
- [x] Repo: https://github.com/tru-you/trusaas  
- [ ] Render deploy Live  
- [ ] DNS for lens / flow / premium  
- [ ] Phone PWA smoke test  

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

## Next session prompt

> Product stack only: lens + flow (Lite) + premium on trusaas.co.za via Render. Personal landing/docs stay off product host. Finish deploy + DNS + MKR wire.

---

*End of handoff.*
