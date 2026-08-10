# TruLoader — Universal TruDealer Widget Loader

The single drop-in script tag to load and orchestrate all **TruDealer / TruSaaS** canonical widgets across dealer websites:

- **TruAfford** — Soft affordability & pre-qualification estimator
- **TruRepay** — Dynamic finance repayment calculator & lead generator
- **TruForm** — Multi-block contact & lead capture form
- **TruChat** — AI showroom assistant & qualification engine

---

## ⚡ Quick Embed

Add a single script tag to any dealer site HTML before `</body>`:

```html
<script src="https://cdn.tru-saas.com/tru-loader.js"
        data-dealer="Cars on Caledon"
        data-slug="cars-on-caledon"
        data-flow="https://premium.tru-saas.com"
        data-wa="27618759389"
        data-accent="#e30613"
        data-widgets="afford,repay,form,chat"
        data-repay-target="#finance-calc"
        data-repay-price="459900"
        data-repay-vehicle="2023 Toyota Fortuner 2.8 GD-6"></script>
```

---

## ⚙️ Configuration Attributes

| Attribute | Default | Description |
|---|---|---|
| `data-dealer` | `this dealership` | Dealership name shown across headers, WhatsApp copy & lead notes |
| `data-slug` | *(none)* | CRM dealer slug (**required for TruFlow lead delivery**) |
| `data-flow` | *(none)* | TruFlow API origin (**required for TruFlow lead delivery**) |
| `data-wa` | *(none)* | Sales WhatsApp number (digits only) |
| `data-accent` | `#1466E0` | Brand primary color. All widgets derive gradients & states from it |
| `data-widgets` | `afford,repay,form,chat` | Comma-separated list of widgets to load on the page |
| `data-repay-target` | `#finance-calc` | Element selector to mount inline TruRepay calculator |
| `data-repay-price` | `0` | Default vehicle price |
| `data-repay-vehicle` | *(none)* | Default vehicle title |
| `data-brand` | `Powered by TruDealer` | Footer attribution credit |

---

## 🕹️ JavaScript API (`window.TruDealer` / `window.TruSaaS`)

Control widgets programmatically from host page buttons:

```js
// Open specific widget
window.TruDealer.open('repay', { price: 389900, vehicle: '2022 VW Polo GTI' });
window.TruDealer.open('afford');
window.TruDealer.open('form');
window.TruDealer.open('chat');

// Close all modal panels
window.TruDealer.closeAll();
```
