# Handoff: Cars on Caledon — Design Fixes

## Overview
Drop-in CSS and JS patches for the Cars on Caledon dealer site (`carsoncaledon.co.za`). Fixes colour clashes, spacing, fake data, mobile UX, and splash behaviour — without touching stock feeds, webhooks, or widget packages.

## About These Files
These are **production-ready drop-in files**, not prototypes. `coc-fixes.css` and `coc-fixes.js` load after the existing stylesheets and scripts and override specific behaviours. No build step required.

## What to Do

### 1. Copy the two patch files into the site root
Place `coc-fixes.css` and `coc-fixes.js` in the same directory as `index.html` (alongside `coc-site.css`, `coc-polish.js`, etc).

### 2. Add two lines to `index.html`

**CSS — find this line (near end of `<head>`, around line 1040):**
```html
<link rel="stylesheet" href="coc-site.css?v=20260805a">
```
**Add immediately after it:**
```html
<link rel="stylesheet" href="coc-fixes.css?v=20260806a">
```

**JS — find this line (near end of `<body>`, around line 1880):**
```html
<script src="coc-polish.js?v=20260805a" defer></script>
```
**Add immediately after it:**
```html
<script src="coc-fixes.js?v=20260806a" defer></script>
```

### 3. Optional: vehicle page
In `vehicle/index.html`, find:
```html
<link rel="stylesheet" href="../coc-site.css">
```
Add after it:
```html
<link rel="stylesheet" href="../coc-fixes.css">
```

## What the Patches Fix

| # | Type | Fix |
|---|------|-----|
| 1 | CSS | Green status dots (#25D366) → blue accent (#6E9BFF) everywhere except WhatsApp buttons |
| 2 | CSS | Section padding 110px → 72px desktop / 48px mobile |
| 3 | CSS | Hide WhatsApp + Book Viewing buttons on mobile cards (≤640px) — detail modal has both |
| 4 | CSS | Hide fake ribbons (Just arrived / Price reduced / Reserved) — derived from price hash, not real |
| 5 | CSS | Hide synthetic "Fair TruPrice" tags (keep real DMS-sourced "below TruPrice" tags) |
| 6 | CSS | Kill FAB rail ambient animations (float, sheen) — keep entrance animations |
| 7 | CSS | Collapsible search panel on mobile (≤640px) |
| 8 | CSS | Tighter body-type tiles, stats strip, footer on mobile |
| 9 | JS  | Remove delivered ticker (hardcoded fake delivery data) |
| 10 | JS | Kill splash intro on mobile (≤768px) — set sessionStorage flag before splash.js can run |
| 11 | JS | Direct-dial call button on mobile bar (skip double-tap arm pattern) |
| 12 | JS | Replace flashing "40+" stat and fake tile counts with neutral text during load |
| 13 | JS | Wire the collapsible search toggle button on mobile |

## What Is NOT Touched
- Stock feed URLs, dealer slugs, API endpoints
- `mapApiVehicle()` and all data mapping
- Webhook lead capture
- TruLoader config and all widget packages (TruChat, TruAfford, TruRepay, TruForm, TruBook)
- `coc-vd.js` (vehicle detail modal)
- `coc-media.js` (3D orbit)
- `coc-book.js` (booking modal)
- `coc-tradein.js` (TruValue profiler)
- `coc-hours.js` (trading hours)
- `coc-dock.js` (FAB rail proxy)

## NOT Included (Requires HTML Restructure)
Consolidating the 3 trade-in sections (Sell/Trade-In + TruInspect Workshop + TruValue Profiler) into one section. This needs manual DOM restructuring — the CSS/JS patches cannot move HTML blocks. If desired, this is a separate task.

## Files in This Package
- `coc-fixes.css` — CSS overrides (load after coc-site.css)
- `coc-fixes.js` — JS patches (load after coc-polish.js)
- `README.md` — this file
