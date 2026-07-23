# TruChat — Ray (Your Car Guy) · WordPress plugin

Ray is an AI showroom assistant for the Your Car Guy website. He holds a real
conversation, answers questions from a knowledge base, searches live stock,
books test-drive / valuation slots, hands off to WhatsApp, and emails a
confirmation to **both the customer and the yard**.

Everything runs inside WordPress. The Claude API key stays on the server and is
never exposed to the browser.

## Install

1. Zip the `truchat` folder (the one containing `truchat.php`).
2. WordPress admin → **Plugins → Add New → Upload Plugin** → choose the zip → **Install** → **Activate**.
3. Go to **Settings → TruChat** and fill in:
   - **Claude API key** — from [console.anthropic.com](https://console.anthropic.com). Required.
   - **Model** — leave `claude-haiku-4-5` (cheapest). Only used for novel questions; see Hybrid below.
   - **Dealership details** — address, hours, WhatsApp number, brand colour.
   - **Email confirmations** — "Send from" address + where dealer alerts land.
   - **Knowledge base** — replace every `[EDIT]` with real facts (warranties, banks, payment, etc.).
4. Save. The chat bubble appears on the front-end automatically.

## Hybrid: knowledge-first, API-second

Ray answers the common questions — greetings, hours, location, contact, finance,
trade-in and warranty basics — **instantly from your settings, with no API call
and no cost**. Only genuinely novel or transactional messages fall through to
Claude (on Haiku, with the knowledge base cached at ~10% price). In practice most
conversations cost a fraction of a cent, and many cost nothing at all.

The instant answers are dynamic — they pull your hours, address and WhatsApp
number from the settings above. The deeper knowledge base powers the Claude
fallback for everything else.

## WhatsApp handoff (free, no Meta account)

When a customer is ready, Ray shows an **Open WhatsApp** button. It opens their
WhatsApp with a **natural, first-person message pre-filled** — e.g. *"Hi, I'm
John. I'd like to confirm my Test drive — Thu 24 Jul at 10:00. My number is
082…, email john@…"* — addressed to your sales WhatsApp number. The customer
just taps send; you receive a message that reads like they wrote it but carries
every detail.

This uses the free WhatsApp click-to-chat (no WhatsApp Business Cloud API, no
Meta onboarding, no per-message fees). The customer taps to send — messages
can't be auto-sent without the Cloud API. Email remains the automatic
confirmation to both the customer and the yard.

## Email delivery (important)

Ray sends confirmation emails through WordPress's `wp_mail()`. Shared hosts often
send WordPress mail to spam or drop it. For reliable delivery install an SMTP
plugin (e.g. **WP Mail SMTP**) and use a "Send from" address on the
yourcarguy.co.za domain.

## Leads (where they land)

Every booking and captured lead is saved **server-side** (a database table), so
nothing is lost when a browser is cleared or a different device is used. You can
see leads three ways:

1. **Email** — a dealer alert + a customer confirmation go out automatically.
2. **WordPress admin** — **Settings → TruChat Leads**: full list, mark contacted,
   delete, one-tap WhatsApp.
3. **Standalone portal** — `portal.html`: a mobile-friendly leads inbox you can
   open on any phone, no WordPress login.

### Setting up the standalone portal

1. In **Settings → TruChat → Leads portal**, set a **Standalone portal PIN**.
2. Open `portal.html` (host it anywhere, or just open the file on your phone).
3. Enter your site address (e.g. `https://yourcarguy.co.za`) and the PIN — saved
   on that device so you only do it once.
4. You'll see every lead with WhatsApp / call / email buttons, search, status
   filters, "mark contacted", and CSV export.

Leave the PIN blank to disable the standalone portal (the WordPress admin list
still works).

> The standalone portal needs **pretty permalinks** on (Settings → Permalinks →
> anything except "Plain"). The chat widget works either way.

## Live stock (optional)

Paste a stock feed URL under **Live stock feed**. It must return JSON like:

```json
{ "vehicles": [ { "make": "Ford", "model": "Ranger 2.0D Wildtrak", "year": 2023, "price": 569000, "mileage": 55500, "fuelType": "Diesel", "stockNumber": "A123" } ] }
```

Leave it blank and Ray works from the knowledge base alone (he'll invite
customers to browse the website for stock).

## What each part does

| File | Role |
|------|------|
| `truchat.php` | Plugin bootstrap: REST endpoint `/wp-json/truchat/v1/chat`, widget enqueue |
| `includes/knowledge.php` | Ray's knowledge base + system prompt |
| `includes/chat.php` | Claude tool-use loop (stock search, booking, lead, handoff) |
| `includes/email.php` | Dual confirmation emails (customer + dealer) |
| `includes/leads.php` | Server-side lead storage, leads API, **Settings → TruChat Leads** |
| `includes/settings.php` | The **Settings → TruChat** admin screen |
| `assets/*` | The floating chat widget (JS + icon) |
| `../portal.html` | Standalone mobile leads inbox (PIN-protected) |

## How Ray is different from the old bot

The previous version was a fixed keyword tree — it only knew hours and address,
and any off-script question hit a generic menu. Ray now:

- **Knows the dealership** (finance, trade-ins, process, warranties) from an editable knowledge base.
- **Actually converses** — free-form questions get real answers, powered by Claude.
- **Searches stock**, **books slots**, and **hands off to WhatsApp** as before.
- **Emails a confirmation** to the customer and alerts the yard — a lead is never lost.

## Security notes

- The API key lives only in the WordPress database / server. The browser never sees it.
- The chat endpoint is public (it's a website chatbot) but rate-limited to 30 requests / 5 min per IP.
- Ray is instructed never to quote guaranteed finance rates/approvals, never to give a final trade-in figure, and never to share another customer's details.
