# Handoff: TruValue — Self-Guided Trade-In Valuation

## Overview
TruValue is a new TruSaaS module: a self-guided, over-the-air trade-in valuation flow. A vehicle owner enters basic vehicle info, walks their own car through 6 prompted camera sections (no dealer on the call), and receives an AI-generated instant offer. A note on the result screen indicates the appraisal is also pushed to the dealer's TruCRM, so the flow serves both consumer and dealer audiences.

It's designed as a sibling app to **TruLive** and **TruTrade**, reusing their token system and visual language (dark "LIVE tier" surfaces, JetBrains Mono for data/labels, Inter for UI text).

## About the Design Files
The bundled `TruValue.dc.html` + `support.js` are a **design reference prototype**, not production code. It's a self-contained HTML file that renders and is clickable in any browser (open `TruValue.dc.html` directly) so you can click through all 5 screens and inspect exact styling via devtools. The task is to **recreate this design in the TruTrade/TruLive codebase's existing environment** (vanilla JS + Express, per `server.js`/`public/index.html` pattern in those repos) — not to ship this HTML file as-is. Follow the existing repo's file structure (e.g. a new `public/` single-page app, `tru-tokens.css` for shared tokens) rather than introducing a new framework.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final for a first pass. Layout/sizing shown at a 390×844 mobile viewport (iPhone-class). Treat measurements and hex values below as exact.

## Screens / Views

### 1. Landing
- **Purpose:** Entry point; pitches the self-guided flow, routes to vehicle info.
- **Layout:** Full-height flex column, centered, `padding: 36px 26px`, `gap: 26px`. Background: `radial-gradient(120% 60% at 50% -10%, rgba(79,227,220,.10), transparent 60%)` over `#0A0A0A`.
- **Components:**
  - Logo mark: 56×56px, `border-radius:16px`, gradient `linear-gradient(160deg,#4FE3DC,#1FAFA8)`, centered car-icon SVG (`#04222a` stroke). Gentle float animation (`translateY(-4px)`, 5.5s ease-in-out infinite).
  - Wordmark: "Tru" (`#c9ced8`) + "Value" (`#4FE3DC`), 27px/800/-.02em letter-spacing.
  - Tagline: 14.5px, `#C9D1D9`, line-height 1.55, max-width 300px, centered.
  - Two trust pills ("2-minute walkthrough", "AI-scored condition"): pill shape, `border:1px solid #2A2A2A`, `border-radius:999px`, `padding:6px 12px`, 11px `#6E7681` text, green (`#10B981`) check icon.
  - Primary CTA card button "Start My Trade-In": dark gradient card (`linear-gradient(180deg,#20323a,#182831,#111a20)`), `border-radius:16px`, `padding:18px`, icon tile (44×44, teal gradient `#A8F5F0→#4FE3DC→#1FAFA8`, `+` icon), title 15.5px/700 white, subtitle 12.5px `#6E7681`, trailing chevron. Hover: lifts `-2px`, border brightens to teal, glow shadow. Active: scales to `.98`.
  - Footer text link: "I'm a dealer — view submitted appraisals", 12px `#6E7681`, decorative in this pass (satisfies dealer-side entry point; not wired).

### 2. Vehicle Info
- **Purpose:** Collect plate/VIN + year/make/model/mileage before starting the walkthrough.
- **Layout:** Flex column, `padding:24px 22px`, `gap:16px`, scrollable.
- **Components:**
  - Header row: 32×32 back-icon button (`border:1px solid #2A2A2A`, transparent bg) + title "Tell us about your vehicle" (19px/800 white).
  - Helper text: 13px `#6E7681`.
  - Fields (all same input style: `background:#141414; border:1px solid #2A2A2A; border-radius:12px; padding:13px 14px; color:#fff; font-size:14px`, focus → border `#4FE3DC` + `box-shadow:0 0 0 3px rgba(79,227,220,.12)`):
    - License plate or VIN (full width)
    - Year / Make (2-col grid, 10px gap)
    - Model / Mileage (2-col grid)
  - Primary CTA "Begin Guided Walkthrough": teal gradient (`#A8F5F0→#4FE3DC`), `#04222a` text, 800/15px, full width, `border-radius:12px`, `padding:16px`, trailing arrow icon. **Disabled** (opacity .5) until Make + Model are filled. Hover/active same lift/scale treatment as landing CTA.

### 3. Guided Capture (core screen)
- **Purpose:** Step through 6 vehicle sections with live prompts; "capture" advances automatically.
- **Layout:** Full-height flex column: topbar → video stage (flex:1) → progress rail → bottom controls.
- **Topbar:** `padding:14px 14px 12px`, `border-bottom:1px solid #1F1F1F`, translucent black bg. Contains: 30×30 back button, pulsing red recording dot (8px, `box-shadow:0 0 10px #EF4444`, 1.4s pulse), "GUIDED" label (JetBrains Mono 11px, letter-spacing .14em), right-aligned "SECTION n/6" (mono, `#6E7681`).
- **Stage:** Black background, placeholder "Live camera preview" icon+label in `#3a3a3a` (real camera feed goes here in production). On capture: full-bleed green flash overlay (`rgba(16,185,129,.14)`) with a 64px green checkmark circle for ~550ms.
  - **Prompt overlay** (bottom, floating): glass card `rgba(12,12,14,.88)` + `backdrop-filter: blur(14px)`, `border:1px solid #2A2A2A`, `border-radius:16px`, `padding:14px 15px`. Shows section index chip (mono, teal border/text) + section name (14px/700) + instruction copy (13px, `#C9D1D9`).
- **Progress rail:** 6 segments, `height:4px`, `border-radius:999px`, `gap:4px`. Upcoming = `#2A2A2A`; current = `#4FE3DC` with glow; completed = `#10B981`.
- **Controls:** Centered 64px circular shutter button, white fill, teal ring (`box-shadow:0 0 0 3px #4FE3DC`). Scales to `.92` on press.
- **The 6 sections (name — instruction):**
  1. Front — "Stand centered, capture the full front bumper and grille."
  2. Driver Side — "Walk the driver side, hold steady for the full profile."
  3. Passenger Side — "Walk the passenger side, capture the full profile."
  4. Rear — "Center on the rear bumper and taillights."
  5. Wheels & Tires — "Get close on each wheel — tread depth matters."
  6. Interior & Odometer — "Show the dash, seats, and a clear shot of the odometer."
- **Behavior:** Tapping shutter marks the section captured (green flash), then after ~550ms advances to the next section; on the 6th capture, transitions to the Processing screen instead. Back button steps to the previous section, or back to Vehicle Info from section 1.

### 4. Processing
- **Purpose:** AI valuation "thinking" state.
- **Layout:** Centered flex column, `padding:36px`, `gap:24px`.
- **Components:**
  - 56px spinner ring: `border:3px solid #1F1F1F`, top border `#4FE3DC`, 1s linear spin.
  - Heading: "Valuating your {year make model}" (17px/800 white, line-height 1.35), subtext "TruAI is scoring your walkthrough" (13px `#6E7681`, margin-top 10px).
  - Checklist (5 items, staggered reveal every ~750ms): each row `background:#141414`, `border:1px solid #2A2A2A`, `border-radius:10px`, `padding:10px 12px`; 18px status dot (grey `#2A2A2A` pending → green `#10B981` + check icon when done); label 12.5px `#C9D1D9`. Not-yet-reached items sit at `opacity:.35`.
  - Checklist copy, in order: "Decoding VIN" · "Analyzing 6 walkthrough captures" · "Pulling live market comps" · "Scoring condition grade" · "Finalizing offer".
  - Auto-advances to Result ~500ms after the last item completes (~4.25s total).

### 5. Result
- **Purpose:** Present the instant offer and next steps.
- **Layout:** Flex column, `padding:26px 22px`, `gap:16px`, scrollable.
- **Components:**
  - Header: "Your Instant Offer" (20px/800 white) + "{vehicle} · {mileage} mi" (13px `#6E7681`).
  - Offer card: gradient `linear-gradient(160deg, rgba(79,227,220,.10), rgba(10,10,14,.6))`, `border:1px solid rgba(79,227,220,.35)`, `border-radius:16px`, `padding:22px`, centered. Label "TRADE-IN VALUE" (mono, 10px, letter-spacing .16em, teal). Amount: 38px/800 white (e.g. "$18,240"). Sub-copy: "Valid 7 days · market range $17,100–$19,400" (12px `#6E7681`).
  - 2×2 stat grid: Exterior / Interior / Mechanical / Mileage Adj. Each: `background:#141414`, `border:1px solid #2A2A2A`, `border-radius:12px`, `padding:14px`; label mono 10px `#6E7681`; value 18px/800 (white, or `#10B981` for the positive mileage adjustment).
  - Primary CTA "Accept & Schedule Drop-off": same teal-gradient treatment as other primary buttons.
  - Secondary CTA "Get a Second Opinion": dark gradient outline button, `border:1px solid #2A2A2A`, hover brightens border to teal.
  - Dealer handoff note: italic 11px `#6E7681`, "A copy of this appraisal has been sent to your dealer's TruCRM." (toggleable — see Design Tokens/props below).
  - "Start Over" text link, 12px `#6E7681`, underlined, resets to Landing.

## Interactions & Behavior
- All primary/nav buttons: `transition: transform .18s ease, box-shadow .18s ease`. Hover → `translateY(-2px)` + brighter glow/border. Active/press → `scale(.98)` (shutter button scales to `.92`).
- Screen transitions are instant swaps in this prototype (no route animation) — consider a slide/fade transition matching TruTrade's existing `.screen` fade-in convention (`opacity 0→1, translateY(6px)→0, .35s ease`).
- Capture flow auto-advances; no manual "confirm" step per photo in this pass.
- Processing checklist and auto-transition to Result are timer-driven in the prototype — replace with real completion signals from the vision/valuation pipeline (VIN decode, comp lookup, condition scoring, offer finalize).
- Form validation: "Begin Guided Walkthrough" only enables once Make and Model are non-empty. Extend with real VIN/plate validation as needed.

## State Management
Minimal state needed in the client:
- `screen`: enum (landing | vehicleInfo | capture | processing | result)
- `vehicle`: { plate, year, make, model, mileage }
- `section`: current capture step index (0–5), plus a `captured[]`/completion flag per section
- `processingStep`: index into the checklist for staged reveal (replace with async task states in production)
- `offer`: result payload (amount, range, condition grades, mileage adjustment) — currently hardcoded placeholder data in the prototype and should come from the real valuation API

## Design Tokens
Reuses the shared TruSaaS "LIVE tier" tokens (see `tru-tokens.css` in TruLive/TruTrade repos), with the accent updated to the new green-cyan:
- `--bg-base`: `#0A0A0A`
- `--bg-raised`: `#141414`
- `--bg-overlay`: `#1F1F1F`
- `--border-subtle`: `#2A2A2A`
- `--text-primary`: `#FFFFFF`
- `--text-secondary`: `#C9D1D9`
- `--text-muted`: `#6E7681`
- **Accent (updated):** `#4FE3DC` (was `#22D3EE` cyan) — hover/pressed `#1FAFA8`
- `--state-error` / live-recording: `#EF4444`
- `--state-success` / connected: `#10B981`
- `--state-attention`: `#F59E0B` (unused in this flow but part of the shared palette)
- Fonts: **Inter** (400–900) for UI text, **JetBrains Mono** (400–600) for labels/data/mono chips.
- Radii: 8px (icon buttons), 12px (inputs/buttons/stat cards), 16px (cards/prompt overlay).
- Note: apply the same accent update (`#22D3EE` → `#4FE3DC`, `#0891B2` → `#1FAFA8`) to TruLive/TruTrade if the rebrand should be consistent platform-wide — confirm scope with design.

## Props / Config Surface (from prototype)
- `offerAmount` (string, default `"$18,240"`) — the headline offer value.
- `showDealerHandoff` (boolean, default `true`) — toggles the "sent to TruCRM" note on Result.

## Assets
No external image assets — all icons are inline SVG (line icons, ~1.5–2px stroke, drawn to match TruTrade's existing icon style). No logo lockup image used; wordmark is styled text.

## Files
- `TruValue.dc.html` + `support.js` — the interactive prototype. Open `TruValue.dc.html` directly in a browser to click through all 5 screens.
