# Your Car Guy — TruChat on WordPress  
**Site:** https://yourcarguy.co.za  
**Ship:** AI chatbot + floating widget + leads portal  
**For:** Ray’s web guy  

---

## What you get

| Piece | File | Who |
|--------|------|-----|
| Floating **Chat** widget | `widget.js` (+ deps) | Site visitors |
| Full-page chat (optional) | `chat.html` | Direct link / menu |
| Leads portal | `portal.html` | Ray only (PIN) |

**Not shipping tonight:** WhatsApp Business Cloud API bot (later).

---

## 1. Host the files

Upload this folder structure to a public HTTPS path (same site is best):

```text
/wp-content/uploads/truchat/
  shared/
    qualifier.js
    chat-core.js
  ray/
    assets/
      ycg-icon.jpg    ← FAB + avatar brand mark
    config.js
    widget.js
    chat.html
    portal.html
```

**Or** host on Netlify / Cloudflare Pages and point the script `src`s there.

Base URL example:

```text
https://yourcarguy.co.za/wp-content/uploads/truchat/
```

---

## 2. Embed on every page (recommended)

**Appearance → Theme File Editor → footer.php**  
(or **Insert Headers and Footers** / **WPCode** → Footer)

Paste **before** `</body>`:

```html
<!-- TruChat · Your Car Guy · Ray -->
<script src="https://yourcarguy.co.za/wp-content/uploads/truchat/shared/qualifier.js"></script>
<script src="https://yourcarguy.co.za/wp-content/uploads/truchat/shared/chat-core.js"></script>
<script src="https://yourcarguy.co.za/wp-content/uploads/truchat/ray/config.js"></script>
<script
  src="https://yourcarguy.co.za/wp-content/uploads/truchat/ray/widget.js"
  data-bottom="24px"
  data-position="right"
  defer
></script>
```

### FAB layout (live site, Jul 2026)

From the live homepage:

| Corner | What sits there |
|--------|------------------|
| **Bottom left** | Joinchat / WhatsApp (green) |
| **Mid right** | Seriti “Check Affordability” |
| **Bottom right** | **TruChat** (red Chat FAB) — free corner |

So default is `data-position="right"` + `data-bottom="24px"` — **do not** put Chat on the left or it will fight WhatsApp.

| Attribute | Meaning |
|-----------|---------|
| `data-bottom="24px"` | Clear bottom edge; raise only if something else is bottom-right |
| `data-position="right"` | **Required** on YCG — left is WhatsApp |
| `data-open="1"` | Open chat on load (usually leave off) |
| `data-z="999990"` | Z-index if buried under other plugins |

Brand chrome (match site): charcoal header, bright red nav (`#e30613`), white/red logo.

---

## 3. Optional full-page chat

Create a WP page **Chat with Ray** → Custom HTML / link to:

```text
https://yourcarguy.co.za/wp-content/uploads/truchat/ray/chat.html
```

Or iframe:

```html
<iframe
  src="https://yourcarguy.co.za/wp-content/uploads/truchat/ray/chat.html"
  style="width:100%;height:720px;border:0;border-radius:16px"
  title="Chat with Ray"
  loading="lazy"
></iframe>
```

On **vehicle detail** pages the bot auto-reads the vehicle title from the page `h1` / URL.

---

## 4. Leads portal (Ray)

Bookmark:

```text
…/truchat/ray/portal.html
```

- Default PIN: set in `config.js` → `portalPin` (currently `ycg` — **change it**)
- Shows chatbot leads from **this browser**
- **WhatsApp handoff** is the main live path for Ray (ticket opens to `27834659921`)

### Remote leads (recommended for production)

In `config.js`:

```js
leadWebhook: "https://hooks.zapier.com/…", // or Make / n8n / Formspree
```

Qualified leads POST as:

```json
{
  "type": "truchat_lead",
  "dealer": "Your Car Guy",
  "entry": { "name", "phone", "vehicleInterest", "qualified", "ticket", "pageUrl", … }
}
```

---

## 5. Config checklist (`ray/config.js`)

| Key | Value |
|-----|--------|
| `personalWhatsApp` | `27834659921` |
| `portalPin` | change from default |
| `leadWebhook` | optional webhook URL |
| `logoUrl` | YCG logo (already set) |
| `stockApi` | TruFlow public stock (optional) |

---

## 6. Test script (5 minutes)

1. Open homepage → red **Chat** FAB above Joinchat  
2. Tap Chat → greeting from Ray  
3. “Browse stock” → cards + Test drive / Finance  
4. Leave a phone number → qualified → green WhatsApp bar  
5. WhatsApp opens with full ticket to Ray  
6. Open `portal.html` + PIN → lead listed (same browser)  

On a vehicle page: open chat → should mention that vehicle.

---

## 7. Design notes for the web guy

- Widget is self-contained (scoped CSS) — should not fight theme styles  
- Dark glass panel + YCG red; logo from live WP uploads  
- Mobile: panel becomes bottom sheet  
- Do **not** put `portal.html` in the public menu  

---

## 8. Files to send the web guy

Zip or copy:

```text
truchat/shared/qualifier.js
truchat/shared/chat-core.js
truchat/ray/config.js
truchat/ray/widget.js
truchat/ray/chat.html
truchat/ray/portal.html
truchat/ray/WORDPRESS.md  ← this file
```

---

## Support

TrueSaas / Paul — TruChat for Your Car Guy  
Portal + chat only; WA Business bot is a later phase.
