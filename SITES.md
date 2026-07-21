# TruSaaS ↔ True-Cars — full product map

## Domains

| Site | Domain | Role |
|------|--------|------|
| **Product apps** | Render free hosts (below) | Dealer tools |
| **Virtual showroom demo** | `true-cars.co.za` | Buyer-facing retail proof |
| **Personal landing** | TruSaaS `index.html` (not product host) | Pitch / portfolio |

---

## Full product suite (not only Lens / Flow / Premium)

### Core (live on Render — use these URLs everywhere for now)

| Product | What it is | Live URL |
|---------|------------|----------|
| **TruLens** | Guided capture, VIR, PWA | https://lens.tru-saas.com |
| **TruFlow Lite** | Entry DMS — stock, leads, tasks | https://flow.tru-saas.com |
| **TruFlow Premium** | Full DMS — media, recon, public stock API | https://premium.tru-saas.com |

Custom domains (`*.trusaas.co.za`) are optional later — do not depend on them yet.

### Experience

| Product | What it is | Demo |
|---------|------------|------|
| **Tru3D** | Orbit frames + damage tags (TruLens package) | true-cars vehicle page |
| **TruShowroom** | TruWeb / consumer site fed by stock API | https://true-cars.co.za |
| **TruLive** | Live video walkaround | technology / chat |
| **TruVIR** | Condition score + PDF | vir-report.html |

### AI

| Product | What it is | Demo |
|---------|------------|------|
| **TruChat** | Site + WhatsApp AI sales assistant | true-cars chat / technology `#truchat` |
| **TruReceptionist** | Front-desk qualify & route | technology `#trureceptionist` |
| **TruChat** | Family brand for chat + receptionist | technology modules |

### Growth

| Product | What it is |
|---------|------------|
| **Syndication** | AutoTrader / Cars.co.za / Facebook |
| **TruReel / TruCopy** | Video + AI listing copy |
| **TruSites / SEO-AEO** | Dealer web + discovery |

---

## How they tie together

```text
TruLens (shoot)
    ↓ export
TruFlow Lite / Premium (DMS + CRM)
    ↓ public stock API
TruShowroom (true-cars / dealer site)
    ├── Tru3D player on each unit
    ├── TruChat on site + WhatsApp
    └── TruReceptionist path → CRM leads
```

**true-cars** = virtual showroom demo of the full story.  
**Render apps** = real core tools.  
**AI + Tru3D** = experience layer on top of core.

---

## Dealer page

true-cars: `dealers.html` — full suite cards + live core links.

## Stock bridge

`TrueCar-SA/assets/js/stock-bridge.js` — dealer slug `true-cars`.

## Tru3D

`TrueCar-SA/assets/js/web3d-mock.js` — mock package + live TruLens fetch when available.

---

*Redeploy true-cars after local edits. Redeploy Render only when product app code changes.*
