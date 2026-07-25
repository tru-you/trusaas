# TruSaaS Claims Register
_Audit date: 2026-07-25 · Branch: feat/tru-token-system · §2.3–2.4_

All public-facing claims and their evidence status. Review before any marketing publish or investor deck.

---

## NUMERIC CLAIMS

| File | Line | Claim | Status |
|------|------|-------|--------|
| `index.html` | 604, 627 | **DMS UPTIME 99.97%** | ⚠️ NEEDS EVIDENCE — no monitoring provider, SLA contract, or uptime log cited |
| `index.old-hub.backup.html` | 1635 | "99.9% uptime SLA" | ℹ️ BACKUP FILE — not live copy, defer |
| `trusaas_document_hub.html` | 633 | "99.5% uptime on hosted modules" | ⚠️ NEEDS EVIDENCE — different figure from marketing page; reconcile or remove |
| `trusaas_document_hub.backup.html` | 996 | "99.9% uptime guarantee" | ℹ️ BACKUP FILE — not live copy |

**Decision required:** Align uptime claim to one verified figure (99.5% / 99.9% / 99.97%). Remove from marketing until a monitoring tool (UptimeRobot, Render metrics) can back it.

---

## TRUST LANGUAGE

| File | Line | Claim | Status |
|------|------|-------|--------|
| `trusaas_document_hub.html` | ~633 | "TruSaaS commitments" section | ⚠️ REVIEW — ensure commitments in quotes are contractually backed |

---

## COMPLIANCE & REGULATORY

| File | Line | Claim | Status |
|------|------|-------|--------|
| `case-sites/*/tru-afford.js` | 364–366 | NCA disclaimer: "not offering credit by this tool alone. Illustrative rate X% linked" | ✅ CORRECT APPROACH — widget correctly disclaimed; naming now fixed (TruSaaS) |
| `index.old-hub.backup.html` | 1613 | "FICA, POPIA, CPA, NCA built-in" | ⚠️ NEEDS EVIDENCE — strong compliance claim; ensure actual implementations exist before using in live copy |
| `trusaas_document_hub.backup.html` | 790 | "TruCRM: POPIA Audit Trail" | ⚠️ NEEDS EVIDENCE — confirm audit trail module is implemented and logged |

---

## NAMING DRIFT — "TrueSaas" / "TrueSaaS"

All uses of the wrong spelling have been catalogued below. **Fixed in this branch** are the tracked JS widget files. The rest are in untracked or backup/static files requiring a separate sweep.

### FIXED (this branch)
- `case-sites/MKR/tru-afford.js` — footer text, brand comment, legal disclaimer ✅
- `case-sites/your-car-guy/tru-afford.js` — footer text, brand comment, file header, legal disclaimer ✅
- `case-sites/cars-at-caledon/tru-afford.js` — footer text, brand comment, legal disclaimer ✅
- `truweb/mkr-autosales/tru-afford.js` — footer text, brand comment, file header, legal disclaimer ✅

### FIXED (Commit 12 — full sweep)
- `TruCRM/server.ts`, `TruCRM/metadata.json` ✅
- `TruCRM/src/context/AppContext.tsx`, `carDealerData.ts`, `ExecutiveDashboard.tsx` ✅
- `TruCRM/src/components/accounting/AccountingSuite.tsx`, `WorkflowsSuite.tsx` ✅
- `TruCRM/src/components/common/CommunicationModal.tsx`, `SettingsView.tsx`, `Sidebar.tsx` ✅
- All Truchat `index.html` footers (true-cars + ray, across MKR, YCG, Caledon) ✅
- All `truweb/mkr-autosales/` HTML files ✅
- All `case-sites/your-car-guy/` HTML files + `_inject_tru_afford.py` ✅
- All `public/embed/stock-widget.js` copies (TruLens, TruInspect, TruFlow Premium, TruFlow Light) ✅
- `truweb/embed/stock-widget.js` ✅
- `case-sites/MKR/tru-afford.js` + `case-sites/cars-at-caledon/tru-afford.js` header comments ✅
- `case-sites/cars-at-caledon/index.html` HTML comments ✅

### STILL PRESENT (URL slugs — not display strings)
- `truweb/mkr-autosales/` HTML files: `href="…/truesaas.html"` — URL slug on the live
  true-cars.co.za domain; requires a server-side redirect + page rename, out of branch scope

---

## CSS COLOUR SYSTEM — DEFERRED VIOLATIONS

Raw hex/rgba values NOT yet migrated to tokens (require colour-decision first):

| File | Rule | Value | Issue |
|------|------|-------|-------|
| `TruLens/src/index.css` | `.tl-btn-3d` | `#7FF0EA`, `#4FE3DC`, `#3ECFC8` gradient | No gradient token; brand cyan `#4FE3DC` conflicts with `--tru-cyan-400: #22D3EE` in token file |
| `TruLens/src/index.css` | `.tl-card-lift::before` | `rgba(79,227,220,...)` glow | Same cyan conflict |
| `TruLens/src/index.css` | `.tl-stock-highlight` | `rgba(79,227,220,...)` pulse | Same cyan conflict |
| `*/brand.css` | All L1 vars | `#4FE3DC`, `#0B0F17`, etc. | brand.css is an L1-alias file; exempt until token-file cyan is resolved |

**Critical open item — cyan colour:** `brand.css` and all apps use `#4FE3DC` (RGB 79,227,220) as the TruSaaS brand cyan. `tru-tokens.css` was created with `--tru-cyan-400: #22D3EE` (standard Tailwind cyan-400). These are visually different. Before the purge can be completed, decide: does the brand cyan stay `#4FE3DC`, and if so, update L1 primitives in `tru-tokens.css` accordingly.

---

## DOCUMENT AUDIT (§2.4)

| Document | Location | Status |
|----------|----------|--------|
| TruInspect VIR output | `Truinspect/` — no PDF template found | ⚠️ VIR template not found in source; confirm generation path |
| TruTrade (TruValue) offer disclaimer | `Truvalue/public/index.html` — "TP subject to viewing" wording | ✅ Correct — offer is conditional |
| TruAfford NCA disclaimer | All 4 tru-afford.js copies | ✅ Present and corrected |
