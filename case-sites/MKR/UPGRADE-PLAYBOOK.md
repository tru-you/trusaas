# Dealership Showroom Upgrade Playbook

A repeatable brief for taking a TruSaaS dealer showroom site from "good" to "10/10."
Derived from the MKR Auto Sales upgrade. Paste the **Session Prompt** below into a new
session, filling in the bracketed blanks for the new site.

---

## Session Prompt (paste this)

> Act as a world-leading dealership showroom designer. I want to upgrade the site at
> `[ABSOLUTE PATH TO SITE FOLDER]` to a 10/10 experience **without breaking structure** —
> all changes additive, mock data where real integrations aren't ready yet.
>
> First, read the existing files to learn the design tokens, fonts, page structure, the
> stock/render pattern, and the WhatsApp number. Then implement the five upgrade pillars
> in the playbook below. Extract shared CSS/JS into two new files
> (`[prefix]-polish.css` / `[prefix]-polish.js`) and link them on every page so there's no
> duplication. Verify on a local http server (not file://) via DOM/computed-style checks —
> this preview renderer doesn't paint frames, so don't rely on screenshots.
>
> Key facts for this site:
> - Brand/dealer name: `[…]`
> - WhatsApp number (digits only): `[…]`
> - Badge/logo image for favicon + chat + trust marks: `[path or "find in Downloads"]`
> - Pages to cover: `[list the .html files]`
> - Body background is `[light / dark]` — **critical for text contrast** (see Pillar 4 note)

---

## The five upgrade pillars

### 1. Hero cinema (first 3 seconds)
- Slow Ken Burns drift on the hero image (26s, `scale(1)→scale(1.12)` translate).
- Staggered blur-to-sharp entrance on the eyebrow / welcome / headline lines.
- Wrap **all** motion in `@media (prefers-reduced-motion: no-preference)`.

### 2. Grid polish (perceived quality of the stock grid)
- **Skeleton shimmer loaders** shown only while the grid is empty at load.
- **Status ribbons** — pulsing "Just arrived" / "Price reduced" / "Reserved", positioned
  on the card image. Drive them from a **deterministic value** (e.g. `price % 97`) so they
  don't reshuffle on every re-render. Re-apply on grid mutation (live API stock re-renders).
- **Quick-view hover bar** that slides up and opens the detail modal. Use a plain `<div>`
  (not a button/link) so the grid's existing card-click handler still fires. Hide on touch.

### 3. Detail modal upgrades (make the existing modal elite)
- **VIR score ring** animates: arc sweeps via `stroke-dashoffset` transition + number counts
  up 0→N. Use `setInterval`/`setTimeout` for the count-up, **not** `requestAnimationFrame`
  — this preview renderer doesn't fire rAF reliably.
- **360 cross-fade**: add a mirrored second image layer (`.im-b`, `scaleX(-1)`, absolute,
  opacity 0); toggle a `.flip` class when drag angle is 90°–270° for a "far side" illusion,
  plus subtle perspective drift on the car element.
- **Share button** — copies a WhatsApp-ready message (car, price, monthly, wa.me link) to
  clipboard with a glass toast confirmation; falls back to `wa.me/?text=` if clipboard fails.

### 4. Trust layer
- **Reviews strip** above the footer: aggregate score + stars + 3 verified-buyer cards
  (badge-branded). Inject via JS before `<footer>`.
- **Delivered ticker** — bottom-left, surfaces "[Car] delivered to [City] this week" every
  ~18s on desktop; hidden on mobile.
- ⚠️ **CONTRAST NOTE (the bug that bit MKR):** these components use **white text**. If the
  page **body background is light/cream**, give the reviews strip its **own dark background
  band** (e.g. `linear-gradient(180deg,#0A1626,#0C1D33)`) or the text is invisible. Always
  check the computed background behind any white-text section you inject.

### 5. Mobile
- **Sticky bottom action bar**: Call / WhatsApp / Stock, always visible. Nudge any existing
  FAB rail up out of its way (`bottom: 84px`). Hide the site bar while a modal is open
  (`body.modal-open`).
- Inside the detail modal on mobile, collapse the buy panel into its own sticky bar
  (price + monthly + Reserve + WhatsApp).

---

## Working conventions (what made it clean)

- **Shared files, linked everywhere.** One `*-polish.css` + `*-polish.js` (IIFE), plus the
  existing per-component modal files. No inline duplication across pages.
- **Compatibility shims** for multi-page use: resolve helpers as
  `window.fmtR || NS.fmtR || fallback` so the same JS works on the home page and category pages.
- **Deterministic mock data** (modulo of price), never `Math.random()` — stable across reloads.
- **Badge/branding**: favicon + `apple-touch-icon` + Open Graph `og:image` on every page's
  `<head>`; badge reused in chat avatar/FAB and on trust marks. Wordmark stays in the masthead,
  badge for square/compact contexts.
- **Verification**: add the site to `.claude/launch.json` as an http.server entry, start the
  preview, then verify with `javascript_tool` DOM/computed-style/contrast checks and
  `read_console_messages` (expect zero errors). Screenshots time out — don't depend on them.
- **Syntax-check** every JS file with `node --check` before finishing.

---

## Design tokens (MKR reference — adapt to the new brand)

```
--ink:#0A1626;  --carbon:#0E1D33;  --graphite:#14294A;
--blue:#0B5BD7; --blue-bright:#4D8DFF; --blue-deep:#0846A8;
--gold:#C8A24B; --gold-light:#E4C878;
--wa:#22C55E;   --radius-lg:18px;
spring easing: cubic-bezier(.34,1.4,.64,1)   reveal easing: cubic-bezier(.22,1,.36,1)
Fonts: Archivo (sans), Fraunces (serif), IBM Plex Mono (mono)
```

Glassmorphic overlay theme: `rgba(255,255,255,.04)` panels, `backdrop-filter: blur(…)`,
white text on translucent borders `rgba(255,255,255,.1)`.
