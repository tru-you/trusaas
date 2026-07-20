# TruSaaS ↔ True-Cars — full product map

## Domains

| Site | Domain | Role |
|------|--------|------|
| **Product apps** | `lens` / `flow` / `premium`.trusaas.co.za (Render until DNS public) | Dealer tools |
| **Virtual showroom demo** | `true-cars.co.za` | Buyer-facing retail proof |
| **Personal landing** | TruSaaS `index.html` (not product host) | Pitch / portfolio |

---

## Full product suite (not only Lens / Flow / Premium)

### Core (live on Render today)

| Product | What it is | Demo |
|---------|------------|------|
| **TruLens** | Guided capture, VIR, PWA | https://trusaas-lens.onrender.com |
| **TruFlow Lite** | Entry DMS — stock, leads, tasks | https://trusaas-flow.onrender.com |
| **TruFlow Premium** | Full DMS — media, recon, public stock API | https://trusaas-premium.onrender.com |

### Experience

| Product | What it is | Demo |
|---------|------------|------|
| **Web3D** | Orbit frames + damage tags (TruLens package) | true-cars vehicle page |
| **Virtual Showroom** | TruWeb / consumer site fed by stock API | https://true-cars.co.za |
| **TruLive** | Live video walkaround | technology / chat |
| **TruVIR** | Condition score + PDF | vir-report.html |

### AI

| Product | What it is | Demo |
|---------|------------|------|
| **AI Auto Chat** | Site + WhatsApp AI sales assistant | true-cars chat / technology `#ai-chat` |
| **AI Receptionist** | Front-desk qualify & route | technology `#ai-receptionist` |
| **TruChat / TrueX** | Family brand for chat + receptionist | technology modules |

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
Virtual Showroom (true-cars / dealer site)
    ├── Web3D player on each unit
    ├── AI Auto Chat on site + WhatsApp
    └── AI Receptionist path → CRM leads
```

**true-cars** = virtual showroom demo of the full story.  
**Render apps** = real core tools.  
**AI + Web3D** = experience layer on top of core.

---

## Dealer page

true-cars: `dealers.html` — full suite cards + live core links.

## Stock bridge

`TrueCar-SA/assets/js/stock-bridge.js` — dealer slug `true-cars`.

## Web3D

`TrueCar-SA/assets/js/web3d-mock.js` — mock package + live TruLens fetch when available.

---

*Redeploy true-cars after local edits. Redeploy Render only when product app code changes.*
