# TruLens Visual Alignment with TruInspect

TruLens and TruInspect are sibling apps — same brand, same dealer audience, same yard context. A dealer switching between them should feel like they're in the same product family. This document captures the exact design system, component patterns, and UX conventions established in TruInspect so TruLens can match them.

---

## 1. Design System & Tokens

Both apps share `packages/tokens/tru-tokens.css` (L1 primitives) and `src/brand.css` (L2 semantic). **Copy `brand.css` verbatim** — it is the canonical source.

### Colour Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--tru-ink-900` | `#06080D` | Primary background (near-black) |
| `--tru-ink-800` | `#0D1117` | Raised surfaces, cards |
| `--tru-ink-700` | `#161B22` | Overlays |
| `--tru-paper` | `#E8EAE6` | Primary text (warm off-white, NOT pure white) |
| `--tru-cyan-400` | `#4FE3DC` | Brand primary accent — interactive states, live elements |
| `--tru-cyan-300` | `#7FF0EA` | Highlight / bright variant |
| `--tru-cyan-500` | `#3ECFC8` | Hover / pressed |
| `--tru-amber-500` | `#F59E0B` | Attention / retake — NOT error |
| `--tru-red-500` | `#EF4444` | System error / LIVE recording |
| `--tru-green-500` | `#10B981` | Connected; otherwise sparing |

### Text Opacities (one colour, four levels)

```css
--white:     #E8EAE6;              /* primary text */
--white-dim: rgba(232,234,230,0.72); /* secondary */
--muted:     rgba(232,234,230,0.55); /* labels, meta */
--faint:     rgba(232,234,230,0.32); /* disabled, decorative */
```

### Typography

- **Font stack:** `Inter`, `system-ui`, `-apple-system`, `sans-serif`
- **Mono:** `IBM Plex Mono`, `ui-monospace`
- **Minimum font size:** 12px (the floor — nothing smaller)
- **Scale:** 12px (micro/labels) / 13px (small/body) / 15px (body) / 17px (lead) / 20px (h3) / 28px (h2) / 38px (h1)
- **Weights:** 400 regular, 500 medium, 600 semibold (heaviest in normal use)
- **Tracking:** headings tighten as they grow: h1 `-0.022em`, h2 `-0.015em`, h3 `-0.01em`
- **No uppercase** for running text — only `tracking-[0.1em]` label text at 10-12px

### Depth & Shadows

```css
--shadow-card:  0 1px 0 rgba(232,234,230,0.06) inset, 0 18px 40px -28px rgba(0,0,0,0.8);
--shadow-lift:  0 1px 0 rgba(232,234,230,0.09) inset, 0 26px 50px -28px rgba(0,0,0,0.9);
--shadow-modal: 0 40px 90px -40px rgba(0,0,0,0.95);
--glow-cyan:    0 0 8px var(--cyan);
```

### Radius

```css
--r-sm:   8px;
--r-card: 18px;
--r-pill: 100px;
```

### Glass Effect

```css
.tl-glass {
  background: rgba(232,234,230,0.055);
  border: 1px solid rgba(232,234,230,0.14);
}
```

---

## 2. Layout & Structure

### Mobile-First Device Frame

Both apps wrap content in a `<MobileDevice>` component that enforces:
- Max-width: 430px centred on desktop
- Full-height flex column
- Safe-area insets for PWA: `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`

### Bottom Tab Bar

Three tabs, fixed at the bottom:
1. **Catalogue** (folder icon) — vehicle list
2. **Dashboard** (bar chart icon) — KPIs and charts
3. **Settings** (gear icon) — org config

Active tab: cyan text + cyan icon + subtle background pill. Inactive: `text-neutral-500`.

### Header Bar

```
[TruLens/TruInspect wordmark] | [Dealership name] [Sign-out icon]
                                 [Status line: "3/12 signed off · 2 need photos"]
```

- Wordmark: `font-display font-semibold text-[16px]` — "Tru" in `--tru-paper`, "Lens"/"Inspect" in `--tru-cyan-400`
- Divider: 1px vertical line at `white/12`
- Status line: `text-[11px] text-neutral-400`

---

## 3. Component Patterns

### Vehicle Cards (Catalogue)

Each card contains:
- **Thumbnail** (top-left): photo counter badge `X/29` overlaid
- **Vehicle title:** `text-[15px] font-bold` — `{year} {make} {model}`
- **Subtitle:** `text-[13px] text-neutral-400` — `{trim} . R {price}`
- **Stock number:** monospace, copy-to-clipboard button
- **Photo badge:** `Photos X/22` in cyan/amber depending on completion
- **Progress bar:** thin `h-1.5` rounded, indigo when in-progress, emerald when complete
- **Action buttons:** 2-column grid, `min-h-[44px]`, `rounded-lg`, `text-[13px] font-bold`
  - Photos: indigo-600 fill, white text
  - Inspect/Checklist: cyan-500/10 bg, cyan-400 text, cyan border
  - Damage: amber-500/10 bg, amber-300 text
  - Trade-In: emerald-500/10 bg, emerald-300 text
  - Report: gradient fill `linear-gradient(120deg, #7FF0EA, #4FE3DC)`, dark text

### Buttons — General

- **Primary CTA:** gradient `linear-gradient(120deg, #7FF0EA, #4FE3DC, #4D9BFF)`, text `#06080D`, `font-bold`
- **Secondary:** `bg-neutral-900 border border-neutral-800 text-neutral-300`
- **Destructive:** `bg-rose-500/15 border-rose-500/50 text-rose-300` (never solid red)
- **All touch targets:** `min-h-[44px]` minimum (Apple HIG / WCAG)
- **Active press:** `active:scale-[0.98]` on primary CTAs

### Forms

- Input: `bg-neutral-900 border border-neutral-800 text-[#E8EAE6] rounded-xl px-4 py-3`
- Focus: `focus:border-cyan-500/40 focus:outline-none`
- Labels: `text-[12px] text-neutral-500 font-semibold`, uppercase tracking only for category labels
- Placeholders: `text-neutral-600`

### Status Toggles

Two-option toggles (OK/Damaged, Present/Not Present):
- Active good: `bg-emerald-500/15 border-emerald-500/50 text-emerald-300`
- Active bad: `bg-rose-500/15 border-rose-500/50 text-rose-300`
- Inactive: `bg-neutral-950 border-neutral-800 text-neutral-400`

### Dashboard KPIs

- Grid: `grid-cols-3` for top row, `grid-cols-2` for second row
- Cards: `bg-neutral-950 p-2 rounded-xl border border-neutral-850 h-16`
- Label: `text-[13px] font-bold` in the status colour
- Value: `text-[16px] font-semibold`

### Charts

- Recharts library (`recharts`)
- Pie chart: `innerRadius={25} outerRadius={40} paddingAngle={5}` donut style
- Bar chart: cyan fill bars, `rounded-t` caps
- Container: `bg-neutral-950 border border-neutral-850 rounded-xl p-3 h-48`

---

## 4. Report / PDF Export

### Branding

- **Header:** dark gradient `linear-gradient(135deg, #0B0F17 0%, #1E293B 55%, #0B3B5A 100%)`
- **Left:** TruInspect/TruLens logo (SVG from `src/assets/images/truinspect-logo.svg`)
- **Right:** TruDealer lockup dark variant (`trudealer-lockup-dark.svg`) — white text version
- **Report ID:** `TI-{stockNumber or vehicleId, uppercase, alphanumeric only, max 12 chars}`
- **Footer:** TruDealer lockup light variant (`trudealer-lockup-light.svg`) — dark text version

### Print Styles

- White page background — the report is a WHITE document
- **Never use the app's near-white text tokens on the report** — use proper dark text colours
- Section headers: `#0D9488` (teal-600) with bottom border
- Body text: `#1F2937` (neutral-800)
- PDF export: `html2pdf.js` with clone-to-offscreen approach

### Assets

Located at `src/assets/images/`:
- `truinspect-logo.svg` — app logo (cyan shield)
- `trudealer-lockup-light.svg` — dark text, for white/light backgrounds
- `trudealer-lockup-dark.svg` — white text, for dark/gradient backgrounds

---

## 5. Auth & User Flow

Both apps use the **same auth pattern** — users are created and managed through TruFlow:

1. **TruFlow is the single source of truth** for dealer codes and entitlements
2. Login screen: single access code field (not email/password)
3. `POST /api/auth/device` with `{ code }` verifies against TruFlow first (`POST /api/auth/verify-code` with `product: 'lens'` or `product: 'inspect'`)
4. Falls back to local `TRULENS_ACCESS_CODE` / `TRUINSPECT_ACCESS_CODE` env var
5. Returns a signed JWT device token valid for 30 days
6. Token stored in localStorage, sent as `Authorization: Bearer {token}`

### Login Screen Design

- Near-black background with two soft cyan light pools (blur-[110px])
- Centred wordmark at 38px
- Single code field with show/hide toggle
- "Continue offline" button when no access code is configured
- Message: "Inspectors cannot self-register" — links to TruSaaS onboarding

---

## 6. Settings Tab

- **Organisation profile:** name + branch inputs
- **Regional:** currency dropdown (ZAR default)
- **Capture quality:** slider with percentage (default 85%)
- **WhatsApp sales number:** +27 prefilled
- **Save Configuration:** primary gradient CTA
- **App:** PWA install prompt with "How to install" button
- **Session:** "Signed in as {email} (offline). Log out returns to the login screen." + red-tinted Log out button
- **Footer:** "Powered by TruSaaS" in `text-neutral-600 tracking-[0.15em]`

---

## 7. Animations & Transitions

- View transitions: `animate-in fade-in duration-500`
- Button press: `transition-colors` on hover, `active:scale-[0.98]` on CTAs
- Progress bars: `transition-all duration-500`
- Loading spinners: `animate-spin` on `Loader2` icon from lucide-react

---

## 8. Key UX Conventions

1. **No seed data** — the app starts empty, dealer adds their own vehicles
2. **Photo count:** `X/22` required photos (not total slots which is 29)
3. **Condition defaults to 5.0/5** (perfect until proven otherwise), with "Not yet inspected" qualifier
4. **44px minimum touch targets** on all interactive elements
5. **Copy-to-clipboard** on stock numbers with toast feedback
6. **Progress bars are thin** (h-1.5) — unobtrusive but always visible
7. **Status colours are tinted backgrounds, not solid fills** — emerald/10, amber/10, rose/15
8. **Delete actions** use red-tinted styling but are never the loudest thing on screen
9. **Search filters across** VIN, stock number, make, model — all normalised to lowercase

---

## 9. Tech Stack (shared)

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **Icons:** lucide-react (consistent across both apps)
- **Charts:** recharts
- **PDF:** html2pdf.js
- **Auth:** Custom JWT (not Firebase Auth in production — device tokens)
- **Server:** Express + tsx (TypeScript runner)
- **Storage:** Local JSON file (`data/local-inventory.json`) + file-based photo storage (`data/media/`)
- **PWA:** Service worker with offline support

---

## 10. Scope Boundaries — What Stays Where

TruLens and TruInspect are **not competing apps**. They serve different jobs:

- **TruLens** = photo capture, quality scoring, basic damage tags, and the VIR (Vehicle Inspection Report) with photo checklist
- **TruInspect** = trade-in appraisal (28-step walk-around), market valuation, inspection sheet (35-point), advanced damage tagger with severity/location, condition rating, trade-in summary with margin masking

**Do NOT add TruInspect features to TruLens.** TruLens already has basic damage tagging — keep it basic. The trade-in, valuation, detailed inspection, and condition-rating workflows belong exclusively in TruInspect.

**What SHOULD match** between the two apps: design tokens, colour palette, typography, button styles, card layouts, navigation pattern, report header/footer branding, auth flow, settings structure, and overall look and feel.
