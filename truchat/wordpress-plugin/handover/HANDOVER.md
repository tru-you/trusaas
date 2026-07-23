# TruChat (Ray) — Install Handover

**For:** Your Car Guy's web/tech person
**Site:** https://yourcarguy.co.za
**What this is:** An AI showroom assistant ("Ray") for the website — a chat bubble
that answers customer questions, searches stock, books test drives and trade-in
valuations, hands off to WhatsApp, and emails confirmations to the customer and
the dealership.

It installs as **one standard WordPress plugin**. No theme edits, no code changes,
no external hosting.

---

## What's in this package

| File | Purpose |
|------|---------|
| `truchat.zip` | **The plugin — upload this to WordPress** |
| `portal.html` | Optional mobile "leads inbox" for Ray's phone |
| `README.md` | Full reference documentation |
| `HANDOVER.md` | This file |

---

## Requirements

- WordPress 5.6+ and **PHP 7.4 or newer**
- The server must allow **outbound HTTPS** to `api.anthropic.com`
  (most hosts do; a few locked-down ones block outbound calls — if the chat
  returns "I hit a snag", this is the first thing to check)
- **Pretty permalinks** enabled (Settings → Permalinks → anything except "Plain").
  Only required for the optional phone portal; the chat widget works either way.
- A **Claude API key** — Paul/Ray will supply this. Treat it like a password.

---

## Install (about 5 minutes)

1. **Plugins → Add New → Upload Plugin** → choose `truchat.zip` → **Install Now** → **Activate**.
2. Go to **Settings → TruChat**.
3. Paste the **Claude API key**.
   *(The chat bubble deliberately stays hidden on the site until a key is saved,
   so nothing half-working ever shows to customers.)*
4. Check the **dealership details** (address, hours, WhatsApp number, brand colour)
   and the **email addresses** ("Send from" + "Dealer alerts to").
5. **Save**. The chat bubble now appears on the front-end automatically.

That's the whole install. Everything else below is optional or informational.

---

## ⚠️ Two things that commonly trip people up

**1. Email deliverability — please don't skip this.**
Ray sends confirmation emails via WordPress's built-in `wp_mail()`. On most shared
hosting that lands in spam or silently fails. **Please install an SMTP plugin**
(e.g. *WP Mail SMTP*) and set the "Send from" address to something on the
`yourcarguy.co.za` domain. If emails are the only thing not working, this is
almost certainly why — it is not a plugin fault.

**2. Ignore the old install instructions.**
If you come across an older `WORDPRESS.md` with manual `<script>` tags, **do not
follow it** — that was the previous version. This plugin replaces it entirely.

---

## Where the leads go

Every booking / captured lead is stored **in the WordPress database** (it survives
browser clearing and works across devices), and shows up in three places:

1. **Email** — an alert to the dealership + a confirmation to the customer.
2. **WordPress admin** → **Settings → TruChat Leads** — full list, mark contacted,
   delete, one-tap WhatsApp reply.
3. **Phone portal** (optional) — see below.

### Optional: the phone portal
So Ray can check leads without logging into WordPress:
1. In **Settings → TruChat → Leads portal**, set a **Standalone portal PIN**.
2. Give Ray `portal.html` (host it on the site, or he can just open the file on his phone).
3. First open, he enters the site address + PIN once; it remembers after that.

Leave the PIN blank to disable the portal entirely (the admin list still works).

---

## Optional: live stock feed

If there's a stock/inventory JSON feed, paste the URL under **Live stock feed**.
Expected shape:

```json
{ "vehicles": [ { "make": "Ford", "model": "Ranger 2.0D Wildtrak", "year": 2023,
                  "price": 569000, "mileage": 55500, "fuelType": "Diesel",
                  "stockNumber": "A123" } ] }
```

Leave it blank and Ray works from the knowledge base, pointing customers to the
website to browse.

---

## The knowledge base (needs Ray's input, not yours)

Under **Settings → TruChat → Knowledge base** is the text Ray answers from. It
ships with sensible defaults but contains several `[EDIT]` markers — warranties,
which banks they're accredited with, payment/deposit terms. **Ray needs to fill
those in.** Ray only states what's written there; he's explicitly instructed never
to invent finance rates, guarantee approvals, or give a final trade-in figure.

---

## Smoke test (do this after install)

In order — this checks each subsystem:

1. Open the site, click the chat bubble, type **"what time do you close?"**
   → instant answer. *(Confirms the widget + knowledge base. Costs nothing —
   common questions never hit the API.)*
2. Type **"do you have a Ranger?"**
   → a real answer / stock cards. *(Confirms the API key and outbound HTTPS.)*
3. Book a test drive — give a name, mobile, email and a time.
   → Ray confirms.
4. Check **Settings → TruChat Leads** — the lead should be listed.
5. Check both inboxes — the dealership alert and the customer confirmation.
   *(If this step fails, see the SMTP note above.)*
6. Tap **Open WhatsApp** — WhatsApp should open with a pre-filled message.

If steps 1–4 pass and only 5 fails, it's email deliverability, not the plugin.

---

## Notes on cost and security

- **Cost:** Common questions are answered from the knowledge base with **no API
  call at all**. Only novel questions reach Claude, on the cheapest model, with
  caching — a typical conversation costs a fraction of a cent.
- **Security:** The API key is stored server-side and is **never exposed to the
  browser**. The chat endpoint is public (it's a website chatbot) but rate-limited
  to 30 requests / 5 min per IP. The leads endpoint requires the PIN.
- **Uninstall:** Deactivating the plugin removes the chat bubble immediately. The
  leads table is left in place so no data is lost.

---

## Questions

Anything unclear or not behaving — come back to Paul de Beer
(paulgordondebeer@gmail.com), who sent you this. Full technical detail is in
`README.md`.

Built by **TruSaaS**.
