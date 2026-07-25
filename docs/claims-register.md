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

### FIXED (second sweep — "TruSaas", lowercase final s)
The first sweep matched `TrueSaas`/`TrueSaaS` only and missed `TruSaas`,
which was the spelling actually rendering on the TruFlow login splash.
40 occurrences across 17 in-scope files, all now `TruSaaS`:
- App login/inventory/demo-banner surfaces: TruLens, TruInspect,
  TruFlow Lite, TruFlow Premium ✅
- `truchat-api/server.js` + `package.json` description ✅
- `Trulive/` README, public index, assets README ✅
- `case-sites/hv-motors`, `case-sites/cars-at-caledon` (+ `coc-polish.css`) ✅

### STILL PRESENT — OUT OF SCOPE
- `index.html` (root) — 12 occurrences of `TruSaas`. This is the TruSaaS
  marketing site, which the brief puts explicitly out of scope. Needs an
  owner decision alongside the `/truesaas.html` slug rename below, since
  both are public-facing and change together.

### STILL PRESENT (URL slugs — not display strings)
- `truweb/mkr-autosales/` HTML files: `href="…/truesaas.html"` — URL slug on the live
  true-cars.co.za domain; requires a server-side redirect + page rename, out of branch scope

---

## CSS COLOUR SYSTEM — RESOLVED

The cyan conflict is closed. `--tru-cyan-400` is `#4FE3DC` (the actual brand
cyan); the stock Tailwind `#22D3EE` was the error and is gone.

| File | Rule | Status |
|------|------|--------|
| `TruLens/src/index.css` | `.tl-btn-3d`, `.tl-btn-3d-dark` | ✅ token gradient (`--tru-cyan-300/400/500`) |
| `TruLens/src/index.css` | `.tl-card-lift` + `::before` | ✅ `rgb(var(--accent-rgb) / a)`, `--accent-glow` |
| `TruLens/src/index.css` | `.tl-stock-highlight`, `tl-stock-pulse` | ✅ token channel forms |
| `*/brand.css` | All L1 vars | ✅ reference `--tru-*` primitives |

Arbitrary-alpha glows are expressed via channel-form primitives
(`--tru-cyan-400-rgb` etc.) so a colour is still defined exactly once.

### Known remaining raw hex — accepted, with reason
- **`@theme` blocks in each app's `index.css`.** Tailwind v4 palette ramps.
  These deliberately collapse the stock emerald/green/lime/teal/indigo/
  purple/violet/fuchsia/pink ramps onto brand cyan so several hundred
  existing utility classNames land on-brand without being edited. They are
  palette definitions, not component rules — the same category as
  `brand.css`. **Action:** add `**/index.css` `@theme` to the stylelint
  ignore set, or migrate the ramps to `var(--tru-*)` references in a
  separate commit; do not silently leave them failing lint.
- **`--color-*-tc` legacy alias sets** in both TruFlow entry points. Now
  brand-consistent between Lite and Premium, but still raw hex.

---

## DOCUMENT AUDIT (§2.4)

| Document | Location | Status |
|----------|----------|--------|
| TruInspect VIR output | `Truinspect/` — no PDF template found | ⚠️ VIR template not found in source; confirm generation path |
| TruTrade (TruValue) offer disclaimer | `Truvalue/public/index.html` — "TP subject to viewing" wording | ✅ Correct — offer is conditional |
| TruAfford NCA disclaimer | All 4 tru-afford.js copies | ✅ Present and corrected |
