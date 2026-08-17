# Installing Standalone Widgets on a WordPress site

A field runbook. Worked example: **Your Car Guy (YCG)**, Port Elizabeth —
TruForm + TruBook + TruShare, leads via YCG's existing CallMeBot.

---

## 0. YCG values (fill the blanks marked ⬜)

| Setting | Value |
|---|---|
| Dealer name | `Your Car Guy` |
| Brand colour | `#e30613` |
| Sales WhatsApp | `27834659921` |
| CallMeBot phone | `27834659921` |
| CallMeBot API key | ⬜ *copy from wp-admin → TruChat → "CallMeBot API key"* |
| Address | `Port Elizabeth` |
| Dealer site | `https://yourcarguy.co.za` |
| Netlify URL (today) | ⬜ `https://<site>.netlify.app` |
| CDN URL (after cutover) | `https://cdn.tru-saas.com` |

> The **same** CallMeBot key YCG already uses for their PHP chatbot works here —
> CallMeBot keys are tied to the receiving number, not the app.

---

## 1. Host the files on Netlify

Deploy the whole `packages/standalone/` folder (loader + all widget subfolders,
structure intact). A `netlify.toml` is already in the folder — it publishes as
site root, sets `Access-Control-Allow-Origin: *`, and a 5-min cache.

```bash
cd packages/standalone
netlify login
netlify deploy --dir . --prod    # create a new site, e.g. "ycg-widgets"
```

Or drag the `standalone` folder onto **app.netlify.com/drop**.

**Verify:** open `https://<site>.netlify.app/tru-loader/tru-loader.js` — you must
see the JS, `200`, over **https**. (The live configurator also deploys, at
`/configurator.html`.)

---

## 2. Custom domain — `cdn.tru-saas.com`

1. Netlify → site → **Domain management → Add a domain** → `cdn.tru-saas.com`.
2. At tru-saas.com's DNS host, add: **CNAME  `cdn`  →  `<site>.netlify.app`**.
3. Netlify auto-provisions SSL once DNS resolves (minutes, up to ~1 hr).

**Timing:** the dealer reviews tomorrow, so there's an overnight window — set up
`cdn.tru-saas.com` now and let DNS + SSL settle. Install straight onto the custom
domain; no `.netlify.app` fallback needed. (If you ever *do* need to demo within
the hour before SSL is green, the `.netlify.app` URL works instantly — swap the
one `src=` later, a one-line edit.)

---

## 3. Paste the loader tag into WordPress

wp-admin → **WPCode** (or *Insert Headers and Footers*) → **Footer** → paste:

```html
<script src="https://cdn.tru-saas.com/tru-loader/tru-loader.js"
        data-dealer="Your Car Guy"
        data-accent="#e30613"
        data-wa="27834659921"
        data-widgets="form,book,share"
        data-callmebot-key="PASTE_YCG_APIKEY"
        data-callmebot-phone="27834659921"
        data-book-address="Port Elizabeth"
        data-share-site="https://yourcarguy.co.za"
        data-share-vehicle-path="/vehicle/"></script>
```

*(Only if demoing before SSL is live: temporarily set `src` to the `.netlify.app` URL.)*

**TruForm appears on its own** — a floating launcher, bottom corner. No extra
wiring. TruBook and TruShare load but stay hidden until triggered (steps 4–5).

---

## 4. TruBook trigger — one button, anywhere

TruBook has no launcher; it opens on click. Add a button in a menu, a hero CTA,
or a Custom HTML block (site-wide is fine):

```html
<button onclick="TruDealer.open('book')">Book a Test Drive</button>
```

---

## 5. TruShare trigger — one button per vehicle

TruShare is per-car — it needs that vehicle's data, so the button lives in the
vehicle listing/template, populated from each car:

```html
<button onclick="TruShare.open({
  year: '2019', make: 'Volkswagen', name: 'Polo 1.0 TSI',
  price: 199900, img: 'https://yourcarguy.co.za/uploads/polo.jpg'
})">Share this car</button>
```

Fields: `year, make, name, price, img` (optional `url`, `images[]`). The share
URL is built from `data-share-site` + `data-share-vehicle-path`.

> This is the involved one — the full rollout means editing the vehicle template
> so every car gets a button. **For the test, hardcode one Share button on one
> vehicle page** to demo it; template it properly afterward.

---

## 6. Verify (before you show anyone)

- [ ] Loader URL opens `200` over https.
- [ ] Cleared WP/Cloudflare cache (or test in a private window).
- [ ] TruForm launcher shows bottom-corner in YCG red.
- [ ] Submit a test enquiry → lands on YCG WhatsApp via CallMeBot.
- [ ] "Book a Test Drive" button opens the TruBook modal.
- [ ] The demo Share button opens the share sheet with the right car.
- [ ] Shrink the window → launchers collapse to icon FABs (responsive OK).
- [ ] Browser console (F12) is clean — no 404s or errors.

---

## Reality check (dealer reviews tomorrow)

| Widget | Effort | Status today |
|---|---|---|
| **TruForm** | Zero wiring — self-mounts | ✅ Solid |
| **TruBook** | One button (step 4) | ✅ Easy |
| **TruShare** | Per-vehicle wiring (step 5) | ⏳ Overnight window — template it properly |

Regenerate the snippet anytime from `/configurator.html` on the deployed site.
