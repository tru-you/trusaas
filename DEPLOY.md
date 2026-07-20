# TruSaaS deploy guide — trusaas.co.za

**Goal:** free-tier host for day-one modules, polish, ship MKR pilot.

---

## Host decision (free tier)

| Host | Fits | Cost | Notes |
|------|------|------|--------|
| **Render** (recommended) | Node Express (Lens + Flow) + static www | **Free** web + static | Spins down after ~15 min idle; cold start ~30–60s. Custom domains + HTTPS included. |
| Cloudflare Pages | Static only (`www`, MKR) | Free | Great for landing; **cannot** run Express. |
| Railway | Node | Trial credit only | No ongoing free tier. |
| Fly.io | Node | Limited / paid for most new accounts | Skip for free pilot. |
| Vercel | Static / serverless | Free hobby | Our apps are long-running Express + large photo payloads — **not** a good fit without a rewrite. |

**Pick: Render free** for `lens` + `app` + `www`. Blueprint: `render.yaml`.

Old versions may still be on other hosts — retire them after the new services pass health checks so you don’t pay or confuse domains.

---

## Domain map (trusaas.co.za)

| Host | Service | App |
|------|---------|-----|
| `www.trusaas.co.za` / apex | `trusaas-www` (static) | Landing `index.html` + `truweb/` + case study |
| `lens.trusaas.co.za` | `trusaas-lens` | TruLens PWA |
| `app.trusaas.co.za` | `trusaas-app` | TruFlow Premium (MKR primary) |
| `mkr.trusaas.co.za` | optional CNAME → www path or separate static | Only if MKR has no own domain |
| `lite.` / `chat.` | later | Skip day-one |

`true-cars.co.za` stays the public consumer demo — not product home.

---

## DNS (at registrar / Cloudflare)

After each Render service is live, open **Settings → Custom Domains** and add the hostname. Render shows the target (usually a `*.onrender.com` CNAME).

| Record | Type | Target |
|--------|------|--------|
| `www` | CNAME | Render www service hostname |
| `lens` | CNAME | Render lens service hostname |
| `app` | CNAME | Render app service hostname |
| `@` (apex) | ALIAS/ANAME or Render redirect | Prefer redirect apex → `https://www.trusaas.co.za` |

Wait for SSL (Render issues certs once DNS propagates).

---

## Deploy steps (Render)

### A. Blueprint (fastest)

1. Push this `TruSaaS` folder to a GitHub repo (or monorepo subfolder).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Select the repo; confirm `render.yaml`.
4. Set secret env when prompted: `GEMINI_API_KEY` (optional).
5. Deploy. Note the three `*.onrender.com` URLs.

### B. Manual (if blueprint path is awkward)

**Service 1 — TruLens**

- Root: `autolens-pro`
- Build: `npm install && npm run build`
- Start: `npm start`
- Health: `/api/health`
- Env: `NODE_ENV=production`, `LOCAL_MODE=1`, `TRUFLOW_DMS_URL=https://app.trusaas.co.za`

**Service 2 — Flow Premium**

- Root: `truflow-premium`
- Build: `npm install && npm run build`
- Start: `npm start`
- Health: `/api/health`
- Env: `NODE_ENV=production`

**Service 3 — www static**

- Static site, publish directory = repo root of TruSaaS (contains `index.html`, `truweb/`, `truchat-your-car-guy.html`)
- Or use **Cloudflare Pages** free: upload / connect same root, custom domain `www.trusaas.co.za`

---

## Wiring after deploy (MKR)

1. Open **https://app.trusaas.co.za** → Settings  
   - TruLens URL = `https://lens.trusaas.co.za`  
   - Dealer slug = `mkr-autosales`  
   - WhatsApp = `27…` (country code, no +)
2. TruLens export uses env `TRUFLOW_DMS_URL=https://app.trusaas.co.za` (already in blueprint).
3. MKR showroom (`truweb/mkr-autosales/`) already prefers  
   `https://app.trusaas.co.za/api/public/stock?dealer=mkr-autosales`.
4. Phone: open `https://lens.trusaas.co.za` → Install / Add to Home Screen → shoot one unit → Export to DMS → confirm photos on Flow.

---

## Pre-flight checklist

- [ ] `npm run build` succeeds in `autolens-pro` and `truflow-premium` locally  
- [ ] `/api/health` returns `{ ok: true }` on both services  
- [ ] `GET /api/public/stock?dealer=mkr-autosales` on app host returns JSON  
- [ ] Custom domains + HTTPS green on Render  
- [ ] Landing demos point at `app.` / `lens.` (not localhost)  
- [ ] Pilot auth labelled (shared password `2026` = pilot only)  
- [ ] Old host deploys deleted or domains detached  

### Known free-tier limits

- **Cold starts** after idle — first open of lens/app can take ~1 min. Warn MKR demos: open the URL once before the meeting.
- **Ephemeral disk** — `data.json` / local inventory reset on redeploy. Fine for pilot; turn on Firebase (`LOCAL_MODE=0` + credentials) for multi-device production.
- **Large photos** — export payloads can be big; if free tier times out, retry or reduce shot count for demo.

---

## Local ports (unchanged)

| App | Port |
|-----|------|
| TruLens | 3000 |
| Flow Premium | 3001 |
| Flow Lite | 3002 |

```bash
# autolens-pro
npm run dev

# truflow-premium
npm run dev
```

---

## Product rules (don’t break)

1. Capture **only** in TruLens  
2. Flow is DMS / CRM / media hub — not a second camera  
3. Website only **reads** public APIs  
4. Day-one = Premium path for MKR; Lite later  

See `HANDOFF.md`, `PRODUCTION.md`, `PRODUCT-CUT.md`.
