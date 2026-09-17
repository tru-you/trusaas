# TruSaaS — Master Stack Status & Architecture Handover

**Timestamp:** 2026-09-12 10:22 SAST  
**Host:** Hetzner Bare Metal `2.29.17.123` (Ubuntu Linux)  
**Authority:** Master TruFlow DMS (`http://127.0.0.1:3003`) — Single Source of Truth for Identity & Stock

---

## 1. Executive Summary & Verification Matrix

All six microservices across the TruSaaS ecosystem are online in PM2, communicating over authenticated internal networks, with strict access control enforced at every boundary.

| Pillar | Service | Port | Auth / Gating Rule | Verified Status |
|:---|:---|:---|:---|:---|
| **Master DMS** | `trusaas-premium` | `3003` | Admin: `[REDACTED]`<br>Legacy `tru2026`: **BLOCKED (401)** | **PASS (200)** · Full fleet management & centralized photo ledger |
| **PWA Studio** | `trusaas-lens` | `3001` | Dynamic validation via `POST /api/auth/device`<br>Proxy over `x-tru-sync-key` | **PASS (200)** · 33 True Cars vehicles + 13 Caledon vehicles loaded |
| **Inspections** | `trusaas-inspect` | `3002` | Tenant entitlement gating via Master Flow | **PASS (200)** · Inspect tenants active (`APX-7K9-W2M`, `YCG-8M4-P9X`) |
| **Mobile App** | `trusaas-mobile` | `3004` | Direct proxy to Flow `:3003` + Chat `:5000` | **PASS (200)** · True Cars (`6SY-WJH-5KY`) loads 36 live vehicles |
| **AI Engine** | `trusaas-chat` | `5000` | DeepSeek (`deepseek-chat`) + Live DMS Stock feed | **PASS (200)** · Natural language queries, stock cards, WhatsApp handoff |
| **Valuations** | `trusaas-scraper` | `4300` | Scraper Valuation Engine | **PASS (200)** · Unlocked live market valuations |

---

## 2. Active Tenant Directory & Access Codes

> [!IMPORTANT]
> Weak codes (`tru2026`, `true-cars`, `demo`) have been **strictly purged**. All authentication attempts using legacy strings are rejected with `401 Unauthorized`.

| Tenant Name | Slug | Access Code | Role | Entitled Product Suite | Live Units in Flow DMS |
|:---|:---|:---|:---|:---|:---|
| **Master Admin** | `admin` | `[REDACTED]` | `admin` | Global Management Console | 49 units (fleet-wide) |
| **True Cars** | `true-cars` | `[REDACTED]` | `principal` | `flow`, `lens`, `inspect`, `live`, `value`, `social` | 36 units |
| **Cars on Caledon** | `cars-on-caledon` | `[REDACTED]` | `principal` | `flow`, `lens`, `inspect`, `live`, `value`, `social` | 13 units |
| **MKR Auto Sales** | `mkr-autosales` | `[REDACTED]` | `principal` | `flow`, `lens`, `inspect`, `live`, `value`, `social` | Provisioned |
| **Apex Auto Investments** | `apex-auto` | `[REDACTED]` | `principal` | `inspect` *(Lens locked: 403)* | 0 in Flow / Standalone Inspect |
| **Your Car Guy** | `your-car-guy` | `[REDACTED]` | `principal` | `inspect` *(Lens locked: 403)* | 0 in Flow / Standalone Inspect |

---

## 3. Product-by-Product Status

### A. TruLens (Photo Studio PWA — Port 3001)
- **True Cars Inventory**: Populated with 33 vehicles in `/var/data/trusaas/lens/local-inventory.json`.
- **10 Core Slot Layout**: Each vehicle captures into the 10 mandatory studio slots:
  1. `front_bumper`
  2. `fender_front_right`
  3. `door_front_right`
  4. `quarter_rear_right`
  5. `rear_bumper`
  6. `quarter_rear_left`
  7. `door_front_left`
  8. `fender_front_left`
  9. `interior_cabin`
  10. `odometer`
  *(Followed by mechanical/extra slots: `bonnet`, `engine_bay`, `spare_wheel`, `roof_sunroof`, etc.)*
- **Re-Export Verification**: Tested `POST /api/export/dms` for vehicle `v_lens_1785857184107` (Volkswagen Polo). Synced all 23 photo references to Flow with `200 OK { ok: true, synced: true }`.
- **Photo Workflow & VIR Upgrade (2026-09-17)**:
  - Removed rigid required-slot constraints and red error crosses; replaced with neutral, clean 10-shot recommendation.
  - Added simple 1–10 vehicle condition rating in review mode ($1..10 \times 10 = \text{VIR}$ on client websites).
  - Bi-directional sync in `syncVehiclesFromDms` automatically accepts photo reorderings made in TruFlow DMS.

### B. TruFlow Premium DMS (Full Dealer Management — Port 3003)
- **Photo Reordering & Cover Selection**:
  - `VehicleDetailModal.tsx` now supports native photo reordering (move left / move right) and single-tap `COVER` selection.
  - Reordering saves to `images` and clears `extrasPhotos` to ensure consistent gallery order on public feeds and website hero car views.
  - Fixed modal container scroll-drop bug by locking outer overlay to `overflow-hidden`, setting fixed modal card height, and locking body scroll.
- **DMS Gallery Readiness**:
  - Harmonized readiness in `dmsReadiness.ts` so $\ge 6$ photos qualifies as Web-Ready, while $\sim 10$ photos is surfaced as an optional recommendation without creating pending task warnings.
- **1–10 Condition VIR**:
  - Direct 1–10 numbered pill selector in Specs tab; updates `vir` directly without clamping to 90.

### C. TruFlow Mobile (Companion App — Port 3004)
- **Environment & Routing**: Configured in `/var/www/trusaas/truflow-mobile/.env` with `API_TARGET=http://127.0.0.1:3003`, `CHAT_API=http://127.0.0.1:5000`, and `TRUFLOW_SYNC_KEY=[REDACTED — set via server environment]`.
- **Authentication**: Logging in with `6SY-WJH-5KY` yields an auth session with `GET /api/state` streaming all 36 live vehicles.

### C. TruChat API (Dealer Assist & Web Chat — Port 5000)
- **Daemon Configuration**: Running under PM2 as `trusaas-chat` (:5000).
- **Brain Integration**: Powered by DeepSeek (`[REDACTED — set via DEEPSEEK_API_KEY env var]`) with live catalog streaming from Master Flow (`http://127.0.0.1:3003/api/public/stock?dealer=true-cars`).
- **Live Test Response**: Natural language queries (e.g. *"What Polo do you have?"*) successfully return accurate real-time inventory cards, prices (e.g. R 350,000 / 18,500 km), and WhatsApp lead generation buttons.

### D. Inter-Service Security & Sync Key
- **Shared Secret**: `TRUFLOW_SYNC_KEY=[REDACTED]` configured across all apps and ecosystem file (`/var/www/trusaas/tools/hetzner/ecosystem.config.cjs`).
- **Inter-service Code Verification**: `POST /api/auth/verify-code` checks dealership existence and product entitlements; unauthorized or unentitled products fail closed with 403.

---

## 4. PM2 Process Map (Hetzner `2.29.17.123`)

```
┌────┬────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────────┐
│ id │ name               │ namespace   │ version │ mode    │ pid      │ uptime │ status   │
├────┼────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼─────────┤
│ 0  │ trusaas-scraper    │ default     │ 1.0.0   │ cluster │ 293375   │ online │ 61.5 MB  │
│ 1  │ trusaas-premium    │ default     │ 1.0.0   │ cluster │ 293793   │ online │ 123.2 MB │
│ 2  │ trusaas-inspect    │ default     │ 1.0.0   │ cluster │ 293399   │ online │ 110.2 MB │
│ 3  │ trusaas-lens       │ default     │ 1.0.0   │ cluster │ 294510   │ online │ 39.6 MB  │
│ 4  │ trusaas-mobile     │ default     │ 1.0.0   │ cluster │ 293423   │ online │ 52.0 MB  │
│ 5  │ trusaas-chat       │ default     │ 1.0.0   │ cluster │ 294094   │ online │ 67.1 MB  │
└────┴────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────────┘
```

---

## 5. Next Session Focus Points

1. **Client Handover Portal HTML**: Build the branded client access page once custom palette colors are provided.
2. **True Cars & Caledon Showroom Visual Verification**: Confirm public domain rendering over Caddy reverse proxy (`true-cars.co.za`, `carsoncaledon.co.za`, `app.trudealers.com`, `lens.trudealers.com`, `inspect.trudealers.com`, `chat.trudealers.com`).
