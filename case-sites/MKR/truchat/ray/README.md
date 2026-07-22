# Ray · TruChat (Your Car Guy)

## Shipping now (tonight)

| # | Product | File | Audience |
|---|---------|------|----------|
| 1 | **AI chatbot** | `chat.html` + **`widget.js`** | Visitors (WP site) |
| 2 | **Chatbot leads portal** | `portal.html` | Ray only (PIN) |

**Later:** WhatsApp Business bot (`wa.html` + `wa-business.js`).

## WordPress

See **[WORDPRESS.md](./WORDPRESS.md)** — full install sheet for Ray’s web guy.

```html
<script src="…/shared/qualifier.js"></script>
<script src="…/shared/chat-core.js"></script>
<script src="…/ray/config.js"></script>
<script src="…/ray/widget.js" data-bottom="90px" defer></script>
```

## Design / function upgrades (this pass)

- YCG logo + red brand chrome  
- Shared `chat-core.js` (full page + widget)  
- Floating **Chat** FAB stacked above Joinchat  
- Vehicle page awareness (`/vehicle/…`)  
- WhatsApp CTA bar when qualified  
- Portal PIN + export JSON  
- Optional `leadWebhook` for remote leads  
- Expanded brand map (Ford, Toyota, VW, Audi, Chevy…)  

## Config highlights

```js
personalWhatsApp: "27834659921",
portalPin: "ycg",        // change before live
leadWebhook: "",         // Make / Zapier / Formspree
logoUrl: "https://yourcarguy.co.za/wp-content/uploads/…",
```

## Lead path (live site)

1. Visitor chats on yourcarguy.co.za  
2. Qualifies (intent + phone)  
3. **WhatsApp ticket → Ray** (primary)  
4. Optional webhook POST  
5. Portal = same-browser inbox / staff testing  

## Local open

```text
truchat/ray/index.html
```
