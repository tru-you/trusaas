# TruSaaS production & phone demo checklist

**Product domain:** [https://www.trusaas.co.za](https://www.trusaas.co.za) · **app** / **lens** subdomains (see `DEPLOY.md`).  
**Public consumer demo:** [https://true-cars.co.za](https://true-cars.co.za) — prospect retail experience only.

Use this before a dealer demo or go-live. Local ports: **TruLens :3000 · Premium :3001 · Lite :3002**.

---

## Phone demo (same day)

### 1. Host TruLens on HTTPS (camera + PWA install)

Phone cameras and “Add to Home Screen” need a secure origin.

**Fast tunnel (dev demo):**

```bash
# From autolens-pro folder, with npm run dev already on :3000
npx cloudflared tunnel --url http://localhost:3000
# or: npx localtunnel --port 3000
```

Copy the `https://…` URL → open on the phone → Install / Add to Home Screen.

**Same Wi‑Fi only (layout check):** `http://<PC-LAN-IP>:3000`  
Camera may be blocked without HTTPS.

### 2. Point Flow at that TruLens URL

1. Open Flow (Premium or Lite) → **Settings**
2. **TruLens URL** = the `https://…` tunnel (or production host)
3. **Dealer slug** = e.g. `mkr-autosales`
4. **Sales WhatsApp** = `27…` (country code, no +)
5. Save

### 3. Demo path (5 minutes)

| Step | App | Action |
|------|-----|--------|
| 1 | Flow | Add vehicle (metadata only) |
| 2 | TruLens (phone) | Shoot unit → Export to DMS |
| 3 | Flow | Refresh photos / Stock media |
| 4 | Flow inventory | Readiness badge + **Shoot** / **WhatsApp** |
| 5 | Website | Paste embed snippet from Settings |

### 4. PWA on dealer phone

- Android Chrome: Install banner or menu → **Install app**
- iPhone Safari: Share → **Add to Home Screen**
- Prefer cloud inventory for multi-device (`LOCAL_MODE=0` + Firebase) for real dealers

---

## Production hosting (checklist)

Free-tier path: **Render** — full steps in `DEPLOY.md` + `render.yaml`.

- [ ] TruLens on HTTPS → `https://lens.trusaas.co.za` (Render free web)
- [ ] Flow Premium on HTTPS → `https://app.trusaas.co.za` (Render free web)
- [ ] Landing static → `https://www.trusaas.co.za` (Render static or Cloudflare Pages free)
- [ ] `TRUFLOW_DMS_URL=https://app.trusaas.co.za` on Lens
- [ ] Public stock: `GET /api/public/stock?dealer=mkr-autosales` live
- [ ] Embed: `…/embed/stock-widget.js` + optional web3d viewer
- [ ] CORS open on public feed (already `*`)
- [ ] Replace shared Flow password `2026` with real multi-user auth before clients
- [ ] Demo banner stays until auth is real (or remove when shipping)
- [ ] Expect free-tier cold starts after ~15 min idle

---

## Product rules (don’t break on deploy)

1. **Capture only in TruLens** — Flow never becomes a second camera  
2. **Lite** = stock + leads + tasks + light costs  
3. **Premium** = + media hub + full recon + syndication  
4. Website only **reads** public APIs  

See `PRODUCT-CUT.md`.

---

## Quick LAN IPs (Windows)

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }
```

Example: `http://192.168.8.16:3000` for TruLens on the same network.
