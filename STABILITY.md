# TruSaaS stability — Lens · Flow Lite · Premium

**Goal:** always-warm, predictable public stock, no junk on showrooms, safe redeploys.

---

## Current state (2026-07-21)

**All three services upgraded to Render Starter (always-on).** No spin-down, no
cold starts. `render.yaml` now says `plan: starter` — do not revert to `free`,
or a Blueprint sync will downgrade the services.

The keep-alive machinery is retired (was only needed on free tier):
`scripts/keep-alive.ps1`, `scripts/register-keepalive-task.ps1`, and
`.github/workflows/trusaas-keepalive.yml` are deleted; the
`TruSaaS-KeepAlive` Windows scheduled task is unregistered.

| Item | Path / action |
|------|----------------|
| Smoke test | `scripts/smoke-trusaas.ps1` |
| Health JSON + uptime | Lens / Lite / Premium `/api/health` |
| Public stock junk filter | Hides `sS DDAS`, `STK-LITE-TEST`, etc. on Premium + Lite |
| Render notes | `render.yaml` comments |

### Run smoke now

```powershell
cd path\to\TruSaaS
pwsh -File scripts\smoke-trusaas.ps1
```

---

## Render service settings

1. Open [Render Dashboard](https://dashboard.render.com) → `tru-you/trusaas` services  
2. For each of **trusaas-lens**, **trusaas-flow**, **trusaas-premium**:  
   - Instance type: **Starter** ✅ (done 2026-07-21)  
   - Confirm health check path = `/api/health`  
3. Env (already mostly set):

| Service | Key | Value |
|---------|-----|--------|
| Lens | `TRUFLOW_DMS_URL` | `https://premium.tru-saas.com` |
| Lens | `LOCAL_MODE` | `1` pilot / `0` when Firebase ready |
| All | `NODE_ENV` | `production` |
| All | `GEMINI_API_KEY` | your key (secret) |

4. Redeploy after code push (junk filter + health uptime).

### Firebase later (multi-device, survives redeploy)

1. Create Firebase project (shared Lens + Premium).  
2. Set `LOCAL_MODE=0` + service account / ADC on Render.  
3. See `TruLens/.env.example` and Flow Firebase notes.  
4. Until then: treat free disk as **pilot only** — export stock before big deploys.

---

## Wiring (don’t break)

```text
TruLens  --export-->  TruFlow Premium (MKR path)
Website  --GET---->  /api/public/stock?dealer=<slug>
```

| Dealer | Slug |
|--------|------|
| MKR | `mkr-autosales` |
| Caledon | `cars-on-caledon` (try variants in HTML) |
| YCG / HV | set when live |

---

## Clean pilot data (manual in Flow UI)

Public API currently had junk like **2026 sS DDAS**. Code now **filters** that from the public feed; still delete in Premium UI when you can:

- Open Premium → inventory  
- Remove test / nonsense units  
- Change shared pilot password before real clients  

---

## After every deploy

```powershell
pwsh -File scripts\smoke-trusaas.ps1
```

Expect:

- HTTP 200 on all three health endpoints  
- Stock `success: true` for `mkr-autosales`  
- Responses in ~1s (always-on Starter, no cold starts)  

---

## Priority order

1. ✅ Smoke + junk filter + health uptime  
2. ✅ Render Starter on all three (real stability) — done 2026-07-21  
3. ⬜ Firebase `LOCAL_MODE=0`  
4. ⬜ Real auth (replace pilot password)  
