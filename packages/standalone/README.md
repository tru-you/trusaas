# TruDealer Standalone Widgets

> ✅ **This is the active source of truth for all dealer widgets** (2026-08).
> The old `packages/tru-*` canonical copies are frozen — see
> [`packages/WIDGETS-SOURCE.md`](../WIDGETS-SOURCE.md). Develop here, then deploy
> to `cdn.tru-saas.com`.

Drop-in dealer widgets for sites **outside** the TruDealer / TruFlow ecosystem —
no DMS, no TruFlow instance, no CRM required. One loader tag adds:

| Widget | What it does | Backend needed |
|---|---|---|
| **TruAfford** | Soft affordability / pre-qualification estimate | webhook *(optional)* |
| **TruRepay** | Finance repayment calculator + lead capture | webhook *(optional)* |
| **TruForm** | Enquiry / contact capture | webhook *(optional)* |
| **TruBook** | Test-drive booking | webhook *(optional)* |
| **TruShare** | Per-vehicle social sharing | **none** — pure share links |

The only difference from the canonical (ecosystem) widgets: these read a
`data-webhook` attribute and can deliver leads **anywhere**, plus an optional
CallMeBot WhatsApp ping — so a dealer with zero tooling can still catch leads.

---

## ⚡ Quick embed

Paste one tag before `</body>`:

```html
<script src="https://cdn.your-domain.com/standalone/tru-loader/tru-loader.js"
        data-dealer="Demo Motors"
        data-accent="#e30613"
        data-wa="27618759389"
        data-widgets="afford,repay,form,book,share"
        data-webhook="https://hooks.zapier.com/hooks/catch/123/abc/"
        data-repay-target="#finance-calc"
        data-repay-price="459900"
        data-repay-vehicle="2023 Toyota Fortuner 2.8 GD-6"></script>
```

That's it. Every widget in `data-widgets` mounts itself and routes leads to the
webhook. Open `demo.html` in this folder to see it working locally.

> **Don't hand-write the tag — use the configurator.** Open `configurator.html`
> for a settings panel that exposes **every** widget option: brand, theme,
> per-widget left/right placement, webhook, CallMeBot, and each widget's own
> settings (TruRepay's rate/deposit/term/balloon/fees/heading, TruAfford's rate,
> TruForm's fields/headings, TruBook's address, TruShare's social handles). It
> live-previews the result (desktop + mobile) and generates the exact `<script>`
> snippet to copy. Serve the folder (`python -m http.server`) and open
> `/configurator.html`.
>
> Under the hood the loader forwards **any** `data-<widget>-<attr>` on the tag to
> that widget as `data-<attr>` (e.g. `data-repay-term="60"` → the calculator's
> `data-term`), so the panel can expose new widget options with no loader change.

### Responsive

Launchers are full pills on desktop and collapse to icon-only round FABs below
480px, so several can share a side on a phone without colliding. Panels open
full-width (bottom-sheet) on mobile. No configuration needed.

---

## 🎯 Embed inline (in-page, not floating)

Every lead widget can render **inside a page element** instead of as a floating
launcher — drop it into a section, a pricing card, a hero. Point it at a target
selector and the launcher flattens into an in-page card.

| Widget | Inline attribute | Notes |
|---|---|---|
| **TruAfford** | `data-mount="#el"` | launcher → inline card |
| **TruValue**  | `data-mount="#el"` | inline trade-in estimate |
| **TruRepay**  | `data-target="#el"` | inline by default; add `data-mode="float"` for a FAB |
| **TruForm**   | `data-target="#el"` | inline enquiry form |
| TruBook / TruShare | — | launcher-only (no inline mode) |

Example — three widgets in one "try the tools" block:

```html
<div id="afford-here"></div>
<div id="value-here"></div>
<div id="repay-here"></div>

<script src=".../tru-afford/tru-afford.js" data-dealer="Demo Motors" data-wa="27..." data-mount="#afford-here"></script>
<script src=".../tru-value/tru-value.js"   data-dealer="Demo Motors" data-wa="27..." data-mount="#value-here"></script>
<script src=".../tru-repay/tru-repay.js"   data-dealer="Demo Motors" data-wa="27..." data-target="#repay-here" data-price="389900" data-vehicle="2023 VW Polo 1.0 TSI"></script>
```

The widget mounts on `DOMContentLoaded`, so the target `<div>` just needs to exist
in the markup. If the selector doesn't resolve, the widget degrades to its default
placement rather than erroring.

> ⚠️ **Attribute name isn't unified yet:** TruAfford/TruValue read `data-mount`,
> TruRepay/TruForm read `data-target`. Use the table above. Worth collapsing to a
> single `data-mount` alias across all four in a future pass.

---

## 📬 How leads reach the dealer

Each lead widget fires **every configured channel** — they stack, so nothing is
lost. Configure as many as the dealer has:

```
1. data-webhook        → their Zapier / Make / CRM        (durable record)
2. data-callmebot-key  → instant WhatsApp ping to dealer  (notification)
3. data-wa  (built-in) → customer taps to WhatsApp/email  (always present)
```

- **`data-webhook`** is the system of record. Point it at a Zapier/Make catch
  hook, an n8n webhook, or any endpoint that accepts a JSON `POST`. Payload:
  ```json
  { "firstName": "", "lastName": "", "phone": "", "email": "",
    "source": "TruForm", "notes": "…human-readable summary…" }
  ```
- **`data-wa`** is the always-there floor — the customer's own tap-to-chat /
  mailto CTA. No account, no backend, no PII leaves the browser.

### Instant WhatsApp notifications — CallMeBot (opt-in)

For a dealer with **nothing** — no Zapier, no CRM — CallMeBot pings their
personal WhatsApp the moment a lead completes. Setup (one time, per number):

1. Save the CallMeBot number **+34 644 84 71 89** to the dealer's contacts.
2. From the dealer's WhatsApp, send: `I allow callmebot to send me messages`.
3. CallMeBot replies with an **API key**.
4. Add to the loader tag:
   ```html
   data-callmebot-key="123456"
   data-callmebot-phone="27618759389"
   ```
   (`data-callmebot-phone` defaults to `data-wa` if omitted.)

**⚠️ Privacy — read before enabling.** CallMeBot delivers by putting the lead's
name, phone and message **in a URL query string to `callmebot.com`**. That is
fine for a low-stakes "new enquiry" notification, but it is **not** a system of
record and the data transits a third party. Use it *alongside* `data-webhook`,
not instead of it. It is a free hobby service — rate-limited (~1 msg/min, one
recipient), so treat it as a ping, not a database.

---

## ⚙️ Loader attributes

| Attribute | Default | Description |
|---|---|---|
| `data-dealer` | `this dealership` | Name shown in copy & lead notes |
| `data-accent` | `#1466E0` | Brand colour; widgets derive gradients from it |
| `data-wa` | *(none)* | Sales WhatsApp number, digits only |
| `data-widgets` | `afford,repay,form,share` | Which widgets to load (comma-separated) |
| `data-webhook` | *(none)* | Lead delivery endpoint (Zapier/CRM) |
| `data-callmebot-key` | *(none)* | CallMeBot API key — enables WhatsApp ping |
| `data-callmebot-phone` | `data-wa` | Number CallMeBot messages |
| `data-text` | *(theme default)* | Override primary text colour across all widgets |
| `data-scale` | `1` | Launcher size multiplier (e.g. `1.2` = 20% larger) |
| `data-layout` | `nested` | `nested` = `name/name.js`; `flat` = `name.js` (one dir) |
| `data-theme` | `dark` | `dark` or `light` |
| `data-repay-target` | `#finance-calc` | Element to mount inline TruRepay |
| `data-repay-price` | `0` | Default vehicle price |
| `data-repay-vehicle` | *(none)* | Default vehicle title |
| `data-share-vehicle-path` | `/vehicle/` | Path prefix for per-vehicle share URLs |

> **Note — `chat` is intentionally excluded** from the default widget set.
> TruChat needs an AI backend a standalone dealer does not have; requesting it
> without `data-flow` logs a warning and skips, rather than 404-ing silently.

---

## 🕹️ JavaScript API

```js
TruDealer.open('afford');                              // open a widget
TruDealer.open('repay', { price: 389900, vehicle: '2022 VW Polo GTI' });
TruDealer.closeAll();                                  // dismiss panels
```
`window.TruDealer` and `window.TruSaaS` are aliases of the same object.

---

## 📁 Folder layout

```
standalone/
├── tru-loader/tru-loader.js   ← the one tag dealers paste
├── tru-afford/tru-afford.js
├── tru-repay/tru-repay.js
├── tru-form/tru-form.js
├── tru-book/tru-book.js
├── tru-share/tru-share.js
├── demo.html                  ← local test page
└── README.md
```

Deploy the whole folder to a CDN/static host. Keep the nested layout (default),
or flatten every `*.js` into one directory and add `data-layout="flat"`.

---

## Standalone vs canonical

These are a **fork** of `packages/tru-*`. The canonical widgets hardwire lead
delivery to TruFlow (`<data-flow>/api/integration/webhook-lead`); standalone adds
the `data-webhook` + CallMeBot paths for dealers who aren't on TruFlow. Port
canonical fixes across by hand — do **not** blind-copy, since the lead-delivery
branch differs.
