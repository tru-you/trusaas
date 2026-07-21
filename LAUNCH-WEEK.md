# Launch week — first sites go live

**Status:** product stack healthy · Render Starter always-on (2026-07-21) · showrooms ready for pilot  
**Smoke (last):** Lens / Lite / Premium / MKR stock all OK

---

## Must-do before first client open day

### 1. Backend (Render) — 15 min
- [x] **Upgrade to Starter** (always-on): `trusaas-lens`, `trusaas-flow`, `trusaas-premium` — done 2026-07-21
- [ ] **Redeploy** latest code (junk filter + health uptime) after git push.
- [ ] Confirm env:
  - Lens `TRUFLOW_DMS_URL` = `https://premium.tru-saas.com`
  - Lens `LOCAL_MODE` = `1` (pilot) or `0` + Firebase (if ready)
- [ ] Change **pilot password** off `2026` before real dealers use it.
- [ ] In Premium UI: **delete** junk unit `sS DDAS` / `STK-26505` (sites already hide it client-side).

### 2. Per-dealer slug (wiring)
| Site | Slug | WA |
|------|------|-----|
| MKR | `mkr-autosales` | 27662912809 |
| Cars on Caledon | `cars-on-caledon` (+ fallbacks in HTML) | 27618759389 |
| HV Motors | set in Flow when live | 27614878054 |
| Your Car Guy | set when live | 27834659921 |

**Rule:** same slug in Flow Settings + public stock URL + website JS.

### 3. Websites (Netlify / host)
- [ ] Deploy showroom HTML (MKR / Caledon / HV / YCG as applicable).
- [ ] **TruAfford** script present (already in demos).
- [ ] `true-cars.co.za` DNS: Host Africa still owns NS — fix apex/www → Netlify if that site launches (see earlier DNS note).
- [ ] `yourcarguy.co.za` is **live WordPress** (bizitdns) — TruAfford inject is separate when you place the script.

### 4. Pre-demo smoke (every morning)

```powershell
pwsh -File "…\TruSaaS\scripts\smoke-trusaas.ps1"
```

Expect all **OK** under ~2s (Starter always-on — anything slower means a real problem, not a cold start).

### 5. Phone path (5 min dry run)
1. Open Premium (warm)  
2. TruLens on phone → capture → export  
3. Premium shows photos  
4. Site `?dealer=slug` shows unit (no junk)  
5. TruAfford → WhatsApp lead test  

---

## Already in place for launch week

| Item | Status |
|------|--------|
| Lens → Premium export URL | Live |
| Public stock API | Live |
| Render Starter always-on (all 3) | Live 2026-07-21 (keep-alive retired) |
| Smoke script | Ready |
| Showrooms + TruAfford | In demos |
| Client junk filter | On MKR + Caledon |
| Server junk filter | Code ready — needs redeploy |

---

## Launch order (recommended)

1. **MKR** pilot (Premium + Lens + HTML)  
2. **Caledon** HTML on Netlify/demo  
3. **YCG / Ray** — AI chat + chatbot leads portal + WA Business bot (qualify → personal WA) — `truchat/ray/`  


4. **true-cars.co.za** DNS cleanup when consumer site is the priority  

---

## Red flags — stop and fix

- Stock API >20s or 502 after wait  
- Site showing test junk (`sS DDAS`) after filter deploy  
- WhatsApp number wrong on TruAfford / FABs  
- Lens export failing (check `TRUFLOW_DMS_URL`)  
- Free tier asleep mid-demo (warm all three URLs first)

---

## One-liner for the room

> Capture in **Lens**, run the floor in **Flow**, websites only **read** public stock by **dealer slug**. TruAfford is soft lead gen only.
