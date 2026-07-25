# TruLive

*A TruSaaS module — live video walkaround streaming.*

**Live, guided vehicle walkthroughs over a secure link.** A dealer sends a single-use link
(via WhatsApp), the buyer opens it **in their browser — no app install** — and they run
through the car together on a live video call. The app *guides both sides* through every
section of the vehicle with prompts and a shared checklist, then generates an AI inspection
summary for the CRM and the buyer.

Part of the **TruSaaS** automotive platform (the `TruLive` module).

---

## How it works

1. **Dealer** taps *Start a walkthrough* → enters the vehicle → gets a **single-use, 24h-expiry** link.
2. Shares it over **WhatsApp** (or copy).
3. **Buyer** opens the link in Chrome/Safari → *Join* → allows camera & mic.
4. Live WebRTC call connects the two phones. The dealer's rear camera shows the car; the buyer sees it full-screen and hears the dealer.
5. **Guided script** drives 10 sections (front, sides, wheels, engine bay, interior, start-up, underbody…). When the dealer taps *Next section*, the buyer's prompts and checklist **advance in sync**.
6. Buyer can **snapshot** and **⚑ flag a concern** — flags relay live to the dealer.
7. On finish, **AI Audit Core** produces an inspection summary with the flagged points to follow up. The report saves against the vehicle in the **Truecars DMS** and can be sent to the buyer.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

> Camera/mic need a secure context. `localhost` counts as secure, so local testing works.
> For two real devices, deploy (HTTPS) — see below.

## Deploy to Render

This repo includes `render.yaml`. On Render:

1. New → **Blueprint** → point at this repo (or New → Web Service, Node).
2. Build: `npm install` · Start: `node server.js`
3. (Optional) Add env var **`ANTHROPIC_API_KEY`** to turn on real AI summaries.
   Without it, TruLive returns a solid structured summary automatically.

Render gives you HTTPS out of the box, so the WhatsApp links work on real phones immediately.

## Config

| Env var | Purpose | Default |
|---|---|---|
| `PORT` | server port | `3000` (Render sets this) |
| `ANTHROPIC_API_KEY` | enables Claude-generated summaries | *(off → local summary)* |
| `TRULIVE_MODEL` | Claude model for summaries | `claude-sonnet-5` |

## Notes / roadmap

- **NAT traversal:** uses public STUN. On strict mobile networks (some corporate/carrier NATs) a **TURN** server is needed for 100% connect rate — add TURN creds to the `iceServers` list in `public/index.html` when you have them (e.g. Twilio/Metered).
- **Rooms are in-memory:** fine for a single instance. For multi-instance scale, move room state to Redis.
- **Phase 3 ideas:** session recording, CRM push (Truecars DMS), buyer e-sign of interest, multi-buyer viewing.
