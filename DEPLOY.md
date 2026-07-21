# TruSaaS deploy — product modules only

**Domain:** trusaas.co.za  
**Host:** Render free tier  
**Repo:** https://github.com/tru-you/trusaas  

---

## What gets hosted (product)

| Module | Folder | Host | Service name |
|--------|--------|------|--------------|
| **TruLens** | `TruLens/` | `trusaas-lens.onrender.com` | `trusaas-lens` |
| **TruFlow Lite** | `truflow-light/` | `trusaas-flow.onrender.com` | `trusaas-flow` |
| **TruFlow Premium** | `truflow-premium/` | `trusaas-premium.onrender.com` | `trusaas-premium` |

Three Node apps. That’s the product stack.

---

## What is PERSONAL (not a product host)

Keep in the repo for you — **do not** deploy as the public product:

- `index.html` — personal SaaS marketing / portfolio landing  
- `truchat-your-car-guy.html` — case study  
- `trusaas_document_hub.html` — personal docs hub  
- `HANDOFF.md`, `PRODUCT-CUT.md`, etc. — internal notes  

`true-cars.co.za` stays a separate consumer demo if you use it — not this product home.

Dealer showroom mock (`truweb/mkr-autosales/`) is optional later; not required for Lens/Flow/Premium go-live.

---

## Domain map

| DNS host | Points to |
|----------|-----------|
| `trusaas-lens.onrender.com` | trusaas-lens |
| `trusaas-flow.onrender.com` | trusaas-flow (Lite) |
| `trusaas-premium.onrender.com` | trusaas-premium |

No `www` product site required for day-one modules.

---

## Wiring

| Setting | Value |
|---------|--------|
| Flow Lite / Premium → TruLens URL | `https://lens.tru-saas.com` |
| TruLens `TRUFLOW_DMS_URL` (export) | `https://premium.tru-saas.com` for MKR Premium path, **or** `https://flow.tru-saas.com` if dealer is on Lite |
| Dealer slug (MKR) | `mkr-autosales` |

---

## Render steps

1. **New → Blueprint** → `tru-you/trusaas` → `main`  
2. Confirm **3 services only**: lens, flow, premium  
3. If an old **www** service exists from a previous blueprint → **delete it** (personal landing is not product)  
4. Deploy → wait for **Live**  
5. Custom domains: `lens` / `flow` / `premium`  
6. DNS CNAMEs at your registrar → Render targets  

### Smoke test

- `https://…-lens…/api/health` → `{ "ok": true }`  
- `https://…-flow…/api/health`  
- `https://…-premium…/api/health`  

First open after idle can take ~1 min (free tier).

---

## Free-tier notes

- Render free web: spins down after ~15 min idle  
- Disk is ephemeral — pilot OK; cloud DB later  
- Max **3 free web services** fits Lens + Flow + Premium exactly  

---

## Product rules

1. Capture **only** in TruLens  
2. Lite = stock + leads + tasks + light costs  
3. Premium = + media hub + full recon + syndication  
4. Personal SaaS docs are **not** the product surface  

See `HANDOFF.md`.
