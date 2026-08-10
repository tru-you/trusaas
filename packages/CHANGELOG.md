# Canonical Package Changes — 2026-08-05

## `tru-loader/tru-loader.js`

### Path resolution
- **Fixed**: `baseUrl` calculation now handles bare filenames (no slashes) — uses `lastIndexOf("/")` instead of regex replacement that failed on single-segment paths.
- **Fixed**: `getScriptUrl` fallback no longer strips subdirectories from relative paths. `truchat/coc/config.js` was resolving to just `config.js` → 404 → entire chat chain aborted silently.
- **Fixed**: Regex widened from `/tru-loader\/?$/` to `/tru-loader.*$/` to match `tru-loader.js`, `tru-loader/`, etc.

### Attribute forwarding
- TruRepay now receives `data-bottom` (from `data-repay-bottom`) and `data-collapsible` (from `data-repay-collapsible`).
- TruForm now receives `data-position` (from `data-form-position`) and `data-bottom` (from `data-form-bottom`).
- TruBook path corrected from `tru-book/coc-book.js` → `tru-book.js`.

---

## `tru-repay/tru-repay.js`

### `data-bottom` support
- Added `offsetBottom` config reading `data-bottom` (default `"24px"`).
- Float-mode host CSS now uses `bottom:${cfg.offsetBottom}` instead of hardcoded `24px`.

### `data-collapsible` support
- When `data-mode="inline"` and `data-collapsible="1"`: renders a toggle button instead of the always-visible panel.
- Toggle button: gradient icon, heading, subheading, animated chevron (rotates 180° on open).
- Panel hidden by default; expands on toggle click.
- `open()`/`close()` updated to handle collapsible toggling.
- Toggle subtext shows a live monthly estimate (e.g. "R7 480/mo") after initial calculation.

### Styling
- Glass background opacity reduced: `rgba(10,11,18,.9)` → `rgba(14,16,22,.48)`.
- Border opacity reduced: `rgba(255,255,255,.12)` → `rgba(255,255,255,.06)`.
- Text: `#F4F4F1` → `#fff` (pure white).
- Muted/placeholder text: `#94A3B8` → `#B0B8C4`, now uses `--tr-faint` variable.
- Launcher/toggle backgrounds lightened from `.92–.96` opacity to `.78–.84`.
- All heading elements (`.tr-ltitle`, `.tr-toggle-title`, `.tr-head b`) explicitly set `color:#fff`.

---

## `tru-form/tru-form.js`

### `data-bottom` support
- Added `offsetBottom` config reading `data-bottom` (default `"24px"`).
- Float-mode host CSS now uses `bottom:${cfg.offsetBottom}` instead of hardcoded `24px`.

### Styling
- Glass background opacity reduced: `rgba(10,11,18,.88)` → `rgba(14,16,22,.48)`.
- Border opacity reduced: `rgba(255,255,255,.12)` → `rgba(255,255,255,.06)`.
- Text: `#F4F4F1` → `#fff` (pure white).
- Muted/placeholder text: `#94A3B8` → `#B0B8C4`, placeholder now uses `--tf-faint`.
- Launcher background lightened from `.92` opacity to `.78`.
- Launcher title (`.tf-ltitle`) explicitly set `color:#fff`.
