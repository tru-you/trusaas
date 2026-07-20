# TruSaaS ↔ True-Cars site map

How the two public faces work together. **Do not merge them into one domain.**

---

## Roles

| Site | Domain | Role | Audience |
|------|--------|------|----------|
| **TruSaaS product** | `lens` / `flow` / `premium`.trusaas.co.za (Render until DNS public) | Dealer tools: capture, DMS, CRM | Dealers, pilot (MKR), you |
| **True-Cars SA** | `true-cars.co.za` | Consumer retail demo + “this yard runs on TruSaaS” | Buyers + dealer prospects |
| **TruSaaS landing** | Personal (`index.html` in repo) | Your portfolio / pitch — **not** product host | You / sales narrative |

---

## Product stack (trusaas)

| Host | App | Public API of interest |
|------|-----|-------------------------|
| `lens.trusaas.co.za` · `trusaas-lens.onrender.com` | TruLens | Photos, VIR, web3d |
| `flow.trusaas.co.za` · `trusaas-flow.onrender.com` | Flow Lite | `/api/public/stock?dealer=SLUG` |
| `premium.trusaas.co.za` · `trusaas-premium.onrender.com` | Flow Premium | `/api/public/stock?dealer=SLUG` (primary for live feed) |

**Data flow (dealer):**

```text
Phone (TruLens) → Export → Flow Premium/Lite → public stock API
                                              ↓
                                    Dealer / True-Cars website
```

---

## Consumer demo (true-cars)

| Piece | Today | Target tie-in |
|-------|--------|----------------|
| Inventory | Static `assets/js/data.js` | **+ live** stock from Premium public API |
| Story | “Powered by TruSaaS” copy | Links to product demos (lens / premium) |
| DMS console | `portal.html` mock / local | Optional later: deep-link to `premium` host |
| Deploy | Own host (live true-cars.co.za) | Stay separate from Render product |

**Stock bridge:** `TrueCar-SA/assets/js/stock-bridge.js`  
- Tries Premium → Flow Lite → onrender URLs  
- Maps API vehicles into `TCSA.vehicles`  
- Keeps static catalogue as fallback if API empty/down  

Dealer slug for the True-Cars demo feed: **`true-cars`** (set same slug in Flow Settings).

---

## Link rules (don’t break the story)

| From | Link to | Not |
|------|---------|-----|
| true-cars “Book demo” | WhatsApp / you | Don’t send buyers into Flow login |
| true-cars “Platform” | technology.html + optional product URLs | Don’t replace consumer nav with DMS |
| TruSaaS personal landing | true-cars = consumer proof | Product CTAs → lens/flow/premium |
| Flow Settings embed | true-cars or dealer domain | Localhost only for dev |

---

## Env / URLs to keep in sync

| Setting | Value (until custom DNS public) | After DNS |
|---------|----------------------------------|-----------|
| Flow → TruLens URL | `https://trusaas-lens.onrender.com` | `https://lens.trusaas.co.za` |
| Lens `TRUFLOW_DMS_URL` | `https://trusaas-premium.onrender.com` | `https://premium.trusaas.co.za` |
| true-cars stock API | same premium base + `?dealer=true-cars` | same |

---

## Checklist — “they tie together”

- [x] Roles separated (product vs consumer)
- [x] Public stock API on Premium (and Lite)
- [x] true-cars can load live stock via bridge (fallback static)
- [ ] Domain `trusaas.co.za` public (HostAfrica / registry)
- [ ] Flow dealer slug `true-cars` for demo units you want on the site
- [ ] Redeploy true-cars after bridge deploy
- [ ] Personal TruSaaS landing CTAs point at premium/flow/lens (not old `app.`)

---

*See also: `HANDOFF.md`, `DEPLOY.md`, TrueCar-SA `_deploy/HOW-TO-DEPLOY.txt`.*
