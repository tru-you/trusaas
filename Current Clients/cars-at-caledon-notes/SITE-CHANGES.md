# Cars on Caledon — Site Changes Handover

## Date: 2026-08-05

---

## Widget Layout (what the visitor sees)

| Widget | Position | Notes |
|--------|----------|-------|
| **TruChat** | Bottom-right float (desktop: `bottom:24px`, mobile: `bottom:calc(96px+safe)`) | Independent FAB, not proxied into rail |
| **TruAfford** | FAB rail proxy (desktop), independent float (mobile `bottom:160px`) | Proxied via `coc-dock.js` above 721px |
| **TruRepay** | Inline collapsible inside Finance section | Replaces old static calculator; webhook-lead capture |
| **TruForm** | Hidden launcher, popup from CTAs | Opens from bottom-left, panel clears mobile bar |
| **TruBook** | Modal | Triggered by CTA buttons |
| **FAB rail** | `bottom:200px`, 3 buttons (Afford + Test Drive + Trade-in) | Hidden on mobile ≤720px |

---

## Files Changed

### `index.html`
- **Line 858–862**: Rail CSS changed from `top:50%;transform:translateY(-50%)` to `bottom:108px` → removed positioning conflict with `coc-site.css`.
- **Line 936**: Rail shrink `@media` extended from `max-width:900px` to `960px` for uniform tablet buttons.
- **Line 1196**: Native calculator replaced with `<div class="calc rv d2" id="finance-calc">` for TruRepay inline mount.
- **Line 1219**: Sell CTA (`#sellValuation`) — now opens TruForm, falls back to WhatsApp.
- **Line 1340**: Visit CTA (`#visitEnquire`) — same treatment.
- **Lines 1887–1890**: Script tag config: `data-widgets="afford,repay,form,chat,book"` with `data-repay-mode="inline"`, `data-repay-target="#finance-calc"`, `data-repay-collapsible="1"`, `data-form-mode="float"`.
- **Lines 1892–1930**: Glue script — hides TruForm launcher, wires CTAs, watches panel for coc-ticker repositioning.

### `coc-dock.js`
- **Line 10–23**: Removed `chat` from `WIDGETS` array — TruChat FAB now floats independently.
- **Lines 106–109**: `watchChatPanel()` — no longer strips `display:none` set by `mount()` on desktop when chat closes. Only restores visibility on mobile.

### `coc-site.css`
- **Line 303**: Removed dead `.fab-rail{bottom:84px}` (rail already hidden by `display:none` on next line).
- **Lines 308–310**: Mobile: `#tru-afford-host{bottom:160px !important}` — prevents TruChat/TruAfford overlap.
- **Lines 311**: Mobile: `#tru-form-1{bottom:108px !important}` — panel clears mobile bar on notched devices.
- **Lines 319–322**: Removed dead `--ta-offset-bottom` CSS variable (TruAfford never reads it).
- **Line 327**: FAB rail `bottom:200px !important` (was `108px`).
- **Lines 339–349**: `#finance-calc` — dark card wrapper (min-height 320px, centered, glass border) to balance the text column. Strips at ≤960px.
- **Lines 353–356**: TruValue `.ti-grid` → `align-items:stretch`, `.ti-card` flex column with `.ti-nav{margin-top:auto}` — pins nav to bottom.
- **Line 371**: Mobile `#tc-panel{bottom:110px !important}` — panel clears mobile bar at ≤480px.
- **Lines 469–498**: Removed dead `#tru-afford-root` selectors from hero visibility rules (shadow DOM unreachable).
- **Lines 1032–1034**: Removed dead `#tru-afford-root` touch-target selectors.
- **Line 1341**: Removed dead `#tru-afford-root` font-family override.

### `tru-loader.js`
- **Lines 64–85**: Fixed `baseUrl` calculation and `getScriptUrl` to preserve directory structure (chat scripts were failing to load).
- **Lines 124, 139, 157, 179**: Widget file paths updated to flat layout (`tru-afford.js`, `tru-repay.js`, `tru-form.js`, `coc-book.js`).
- **Line 152**: Added `data-collapsible` forwarding for TruRepay.
- **Line 166**: TruForm set to `data-position="left"`.

### `tru-repay.js` / `tru-form.js`
- Synced from canonical packages. See `packages/CHANGELOG.md` for full details.

---

## Mobile Responsive Stack (≤720px, bottom-up)

| Position | Element | Z-index |
|----------|---------|---------|
| `bottom:0` | Mobile bar (Call / WhatsApp / Stock) | 230 |
| `bottom:calc(96px+safe)` | TruChat FAB (52px) | 999990 |
| `bottom:108px` | TruForm host (launcher hidden) | 999980 |
| `bottom:110px` | TruChat panel (when open, ≤480px full-width) | 999990 |
| `bottom:160px` | TruAfford launcher (scale 0.8) | 999990 |
| hidden | FAB rail | — |
| hidden | coc-ticker | — |

---

## Key Caveats

- **TruChat + TruAfford share z-index 999990** on mobile. They're vertically separated (160px vs 96px+safe) so no visual overlap, but if any future change moves them closer, DOM order determines stacking.
- **Vehicle page** (`vehicle/index.html`) is unchanged — still loads `../tru-loader.js` (path may need fixing) and uses its own TruRepay inline config.
- **FAB rail tablet** at 901–960px: buttons are 50px with hidden labels (uniform now that shrink extends to 960px). The `bottom` reposition in the HTML @media is overridden by `coc-site.css !important` — rail stays at 200px.
