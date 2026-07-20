# Ray · TruChat (Your Car Guy)

Personal-first showroom assistant for **Ray**, with a path to WhatsApp Business later.

## Open the web bot

Open in a browser:

```text
C:\Users\pgdeb\OneDrive\Documents\Desktop\Paulie_Hub\projects\TruSaaS\truchat\ray\index.html
```

Or serve the `truchat` folder with any static server.

## What’s included

| File | Role |
|------|------|
| `index.html` | Ray web bot + lead console |
| `config.js` | Branding, hours, catalog, **sales WhatsApp**, stock API |
| `../shared/qualifier.js` | Shared brain (web **and** future WhatsApp webhook) |

## Personal use (now)

1. Visitor chats with **Ray** on the web page  
2. Bot qualifies: stock / trade-in / test drive / phone  
3. You click **WhatsApp handoff** or **Copy ticket**  
4. Ticket opens to number in `config.js` → `salesWhatsApp`  
5. **Save lead** stores sessions in this browser  

Edit Ray’s number / copy in `config.js`:

```js
salesWhatsApp: "27834659921", // no +
```

## Business later (same brain)

1. Meta WhatsApp Cloud API (or Twilio) on a **business** number  
2. Webhook server calls `TruChatQualifier.createQualifier(RAY_TRUCHAT_CONFIG)`  
3. Map WhatsApp buttons/lists → `process` / `selectVehicleAction` / `confirmSlot`  
4. On `session.qualified` → CRM + notify sales (not only personal WA)  

No need to rewrite the sales flow — only the channel adapter.

## Stock

- Tries TruFlow public API from `config.js`  
- Falls back to local catalog if API empty  

## Related

- Original full case-study page: `../../truchat-your-car-guy.html`  
- Product name: **TruChat** (Ray is this dealer’s assistant persona)
