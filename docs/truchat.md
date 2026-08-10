# TruChat

*The 24/7 assistant on the dealer's website — answers, stock search, bookings and lead capture.*

## What it does

TruChat is a chat assistant that sits on the dealer's website and handles the after-hours and first-touch conversations a yard can't always staff. It answers the common questions (hours, location, finance, trade-in, warranty) instantly with no AI cost, searches live stock, books walkthrough slots, captures the lead, and hands off to a real person on WhatsApp when the customer is ready. Every lead and booking is stored for the dealer and emailed to both the customer and the yard.

## Who uses it

- **Website visitor / buyer** — chats, browses stock, books, or asks for a human.
- **Sales rep / yard** — picks up qualified leads (in the DMS, the leads portal, and by email) and takes the WhatsApp handoff.
- **Dealer admin** — sets the knowledge (hours, contact, finance basics) that answers questions for free.

## How it's delivered

TruChat ships in two forms, and **where the leads go differs between them** — this matters. The standalone WordPress build came first (for a WordPress client); the DMS-connected version was built afterwards for TruDealer.

- **WordPress plugin + portal (standalone).** One plugin a WordPress client installs, plus a PIN-protected mobile **leads portal**. Leads are stored server-side in the plugin and emailed to the customer and the yard (the dual email); the yard works them in the portal. This form is **self-contained and does not push leads into the TruFlow DMS** — it's the packaged product for a WordPress client.
- **DMS-connected widget (for TruDealer dealers).** A script drop-in (`widget.js` + `chat-core.js` + `qualifier.js` + a per-dealer `config.js`) for a dealer site, backed by the hosted [TruChat API](./integrations.md) brain. Its `leadWebhook` is set to TruFlow's `/api/integration/webhook-lead`, so **captured leads land directly in the [TruFlow](./truflow.md) CRM** (alongside the same dual email and WhatsApp handoff).

## Core workflow

1. **Visitor opens the chat** on the dealer site.
2. **Knowledge-first answers.** Common questions are answered instantly from the dealer's own settings — no API call, no cost.
3. **AI for the rest.** Novel or transactional messages go to Claude (Haiku), which drives the tools: **search stock**, **book a slot**, **capture a lead**, **WhatsApp handoff**. If the AI key is missing or errors, the bot degrades to knowledge answers plus WhatsApp — it never breaks.
4. **Live stock in the chat.** Stock search reads the dealer's live feed (from [TruFlow](./truflow.md)) and shows matching vehicles as cards.
5. **Qualify and hand off.** Once the visitor is qualified (or asks for a person), TruChat opens WhatsApp to the yard with a full ticket and emails both the customer and the yard (the "dual" email). Where the lead is stored depends on the form: the WordPress plugin keeps it in its own portal; the DMS-connected version for TruDealer dealers posts it into the [TruFlow](./truflow.md) CRM (see *How it's delivered* above).

## TruChat Voice (AI receptionist)

Alongside the chat, TruChat has a **Voice** capability — an AI receptionist that answers after-hours calls. It runs on **CloudTalk** (third-party telephony) and is configured in that platform, **not in this codebase** — so there's no voice module in the repo, and its "demo" is a phone number to call rather than a URL. *(Platform-side and not verifiable from code — confirm it's still live before quoting it to a dealer.)*

## Screenshots

[SCREENSHOT: TruChat open on a dealer homepage — greeting with quick-reply chips (Browse stock / How it works / Book a walkthrough)]

[SCREENSHOT: In-chat stock results — vehicle cards returned by a stock search]

[SCREENSHOT: WhatsApp handoff — the pre-filled ticket message to the yard]

[SCREENSHOT: Leads portal (portal.html) — the PIN-protected mobile inbox of captured leads]

## Notes on scope

- **What's built:** knowledge-first answering, Claude (Haiku) tool-use for stock search / booking / lead capture / WhatsApp handoff, live stock from the TruFlow feed, dual customer + yard emails, and two delivery forms — the **standalone WordPress plugin + PIN leads portal** (for a WordPress client, leads stay local) and the **DMS-connected embed widget for TruDealer dealers** (leads post into the TruFlow CRM). Market/locale/currency are configurable (SA is the launch market).
- **Legacy:** older standalone/demo pages and a script-tag install predate the plugin and are superseded — use the plugin or the current widget package.

## Related modules

- **[Integrations](./integrations.md)** — the hosted TruChat API brain and how the widget connects.
- **[TruFlow](./truflow.md)** — where captured leads and the live stock feed come from / go to.
- **[TruAfford](./truafford.md)** — the affordability widget that often sits alongside TruChat on the same site.
- **[Showrooms → TruLive](./showrooms.md)** — the live video walkthrough a booked slot can turn into.
- **[Getting Started](./getting-started.md)**
