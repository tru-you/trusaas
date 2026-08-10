# Handoff: TruSaaS Button System 2026

## Overview

A single button system for **TruLens**, **TruInspect** and **TruFlow Premium**, replacing five
different primary treatments with four tiers, one shape and one depth vocabulary — plus the
screen-level changes that follow from having fewer buttons.

The brief was "the blue and white buttons are an eyesore, they look dated, and there are too many
competing button styles". The root cause is not the colour: it is that almost everything on these
screens is a filled button, and the filled buttons fake depth with a 2012 vocabulary (vertical
gradient, 80%-white inset top lip, letterpress `text-shadow`, embossed icon `drop-shadow`).

**Nothing in this handoff changes functionality.** No handlers, routes, state, API calls or data
shapes are altered. Everything here is presentation, hierarchy and, in two places, progressive
disclosure of fields that were already optional.

---

## About the design files

`Button System 2026.dc.html` in this bundle is a **design reference created in HTML** — a prototype
showing intended look and behaviour. It is **not production code to copy**.

The task is to apply these designs to the existing React + Tailwind v4 codebase using its
established patterns: `src/index.css` `@theme` blocks, the L2 semantic tokens in
`packages/tokens/tru-tokens.css`, `src/brand.css`, and the existing Tailwind utility classNames on
components. Most of this ships as a stylesheet change against selectors that already exist — see
**Ship order** below, which is where to start.

Open the file in a browser and pan/zoom. It is organised newest-turn-first:

| Turn | Contents |
|------|----------|
| 10 | Flow finished — recon pipeline, deal readiness, and the last four sections |
| 9 | Leads, Tasks, Documents, Team — Leads, Tasks, Documents, Team, aged stock |
| 8 | Does Inspect match Lens — the two capture-screen differences |
| 7 | TruFlow vehicle detail modal, before/after |
| 6 | TruLens capture screen + add-vehicle form, before/after |
| 5 | Icon audit |
| 4 | Choosing the cyan |
| 3 | Three smaller fixes |
| 2 | Depth options 2a / 2b / **2c chosen** |
| 1a | The audit, the four tiers, TruLens catalogue + login, TruFlow overview, the CSS swap |

## Fidelity

**High-fidelity.** Colours, type sizes, weights, radii, heights, shadow values and copy are all
final and exact. Every value traces to a token in `tru-tokens.css`, `brand.css` or the `@theme`
block — no new colours were invented. Recreate pixel-perfectly using the codebase's existing
Tailwind utilities and CSS.

---

## The system

### Tiers

Four tiers. Three carry thickness; **ghost is the only flat one**, and that is what keeps a card of
four controls from reading as four decisions.

| Tier | Fill | Border | Depth | Label |
|------|------|--------|-------|-------|
| Primary | `#3ECFC8` | none | `inset 0 1px 0 rgba(255,255,255,0.28)`, `0 5px 0 #22807C`, `0 10px 22px -8px rgba(0,0,0,0.95)` | `#06080D`, weight 600 |
| Secondary | `#161B22` | none | `inset 0 1px 0 rgba(232,234,230,0.10)`, `0 4px 0 #06080D`, `0 8px 18px -8px rgba(0,0,0,0.95)` | `#E8EAE6`, weight 500 |
| Ghost | transparent | none | none | `rgba(232,234,230,0.72)`, weight 500 |
| Destructive | `#3D2222` | none | `inset 0 1px 0 rgba(232,234,230,0.08)`, `0 4px 0 #241414`, `0 8px 18px -8px rgba(0,0,0,0.95)` | `#C07676`, weight 500 |

**One primary per view.** If a screen has two filled cyan buttons in one glance, one of them is
wrong.

### Depth — the rule

The chosen treatment is **2c "sculpted"**. It is more physical than the old button, not less, but
built from a different vocabulary:

- **Thickness, not shine.** A solid darker *side* (`0 5px 0`), so the object has a side rather than
  a coating.
- **One light source, stated once.** A single 1px top hairline at 28%. **Never a gradient.**
- **One ambient shadow** beneath.
- **The label stays flat.** All `text-shadow` on buttons and all `filter: drop-shadow` on button
  icons are deleted. These were the strongest date-stamp on the old set *and* they were costing
  real label contrast outdoors.
- **Press travels.** `translateY(4px)` and the side collapses to `0 1px 0`. Not `scale()`, not a
  shadow swap.

### Colour states

| State | Primary |
|-------|---------|
| Default | `#3ECFC8` — `--tru-cyan-500` |
| Hover | `#4FE3DC` — `--tru-cyan-400` |
| Pressed | `#2FB3AD` — `--tru-cyan-700` (via the travel) |
| Focus | existing 2px `--focus-ring` outline, offset 2 — unchanged |
| Disabled | `rgba(232,234,230,0.08)` fill, `rgba(232,234,230,0.32)` label, **no side, no shadow** |

The fill dropped one rung from `#4FE3DC` to `#3ECFC8` because `#4FE3DC` glares on `#06080D`. The
old `disabled` used `filter: saturate(0.4) brightness(0.7)` on cyan, which reads as a dimmed live
button; a neutral tint reads as unavailable.

### Sizes — one radius

**12px radius on every button at every size.** The pill is retired from buttons and kept for filter
chips and status only, so shape means something again.

| Size | Height | Font | Use |
|------|--------|------|-----|
| Field hero | 52px | 16px | Lens/Inspect primary actions, login, form submit |
| Default | 44px | 15px | touch floor, card actions |
| Desk | 36px | 13px | TruFlow |
| Inline | 28px | 13px | inside a row |
| Icon | 44×44 | — | icon-only |
| Shutter | 64px | 17px | capture screen only, 16px radius |

Labels: weight 600 for primary, 500 for everything else. **Nothing above 600** — `brand.css` caps
there and the old code had `font-weight: 700` in several places.

### Inputs — the inverse of buttons

Fields become the **recess** to the buttons' **raise**. Same 12px radius, but:

```
height: 48px;
background: rgba(232,234,230,0.04);
border: 1px solid rgba(232,234,230,0.14);
box-shadow: inset 0 2px 4px rgba(0,0,0,0.35);
font-size: 16px;                /* below 16px iOS Safari zooms on focus */
```

Labels 13px weight 500 at `rgba(232,234,230,0.72)` (was 12px at 0.55, below the readable floor
outdoors).

One depth vocabulary read in both directions — you can tell what to press from what to type into
without reading either.

---

## Ship order — read this first

Not the same thing as the implementation steps below. This is the order to *release* in, and the
reasoning matters more than the sequence.

**Stage 1 — the stylesheet swap, alone.** Steps 1–3 below: about 40 lines across three `index.css`
files, no markup touched. This gets most of the visual win in all three apps at once, in one commit
that reverts cleanly. **Do not bundle it with any screen work** — if something looks wrong you want
to know which change caused it. Ship it, look at it for a day.

**Stage 2 — the two field surfaces only.** The TruLens/TruInspect vehicle card and the capture
console. That is where a photographer spends an entire shift. Everything in stages 3–4 is real but
it is desk work, and desk users tolerate ugly far better than someone holding a phone in the sun.

**Stage 3 — the rest of the field apps.** Login, the add-vehicle form, the Inspect header pair.

**Stage 4 — TruFlow.** Overview, vehicle detail, then Leads/Tasks/Documents/Team, then the recon
pipeline and deal readiness, then the four sections that are header swaps only. Flow is a desk tool
that is looked at all day but rarely in bad light; it can wait behind the phones.

**Alongside stage 2, not after it — stop the remapping.** This is the one to push hardest, and it is
not a design point. The codebase is held together with override machinery: twelve colour ramps
remapped in `@theme` so wrong classNames land on right colours, unlayered CSS written specifically
to beat Tailwind utilities, six `!important` flags on one selector, a
`.text-\[11px\] { font-size: 12px }` patch propping up eighteen labels. Every one is a workaround for
a call site nobody wanted to touch. It works, and it also means nobody can read a component and know
what it renders. **This pass opens those files anyway — fix the classNames while you are in them,
then delete the remaps.** If that does not happen now it will not happen, and the next person
inherits four layers of indirection and adds a fifth.

### One thing to check before committing to the depth

The sculpted treatment (2c) was chosen on a desk monitor. **Put it on a real phone, outdoors, in
direct sun before stage 1 ships.** The part expected to fail is the 28% top hairline — if it washes
out, switch to **2b** (the solid edge with no highlight, shown in turn 2 of the design file). That is
a one-line change to the `box-shadow`: drop the `inset 0 1px 0` and keep the rest. Everything else in
this document is unaffected either way.

---

## Implementation order

Do these in sequence within each stage above. Steps 1–3 are a stylesheet change and land everywhere
at once; steps 4+ are per-screen.

### 1. Replace the primary treatment (all three apps)

Same selectors, new bodies. In `TruLens/src/index.css`, `Truinspect/src/index.css` and
`Truflow-premium/src/index.css`:

```css
.tl-btn-3d,
.btn-primary,
.bg-tru-cyan {
  background: var(--tru-cyan-500);
  color: var(--text-on-accent);
  border: none;
  border-radius: 12px;
  font-weight: var(--w-semibold);
  text-shadow: none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.28),
    0 5px 0 var(--tru-cyan-800),
    0 10px 22px -8px rgba(0,0,0,0.95);
  transition: background 120ms ease, box-shadow 90ms ease, transform 90ms ease;
}
.tl-btn-3d:hover,
.btn-primary:hover { background: var(--tru-cyan-400); }
.tl-btn-3d:active,
.btn-primary:active {
  transform: translateY(4px);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.20),
    0 1px 0 var(--tru-cyan-800),
    0 2px 6px -3px rgba(0,0,0,0.9);
}
.tl-btn-3d:disabled,
.btn-primary:disabled {
  background: rgba(232,234,230,0.08);
  color: var(--faint);
  box-shadow: none;
  transform: none;
  filter: none;
}
/* icons stop being embossed */
.on-fill svg,
.btn-primary svg { filter: none; }
```

**Delete** `.tl-btn-3d-dark` — superseded by `.tru-btn-secondary`.

### 2. Add the two new tiers

```css
.tru-btn-secondary {
  background: var(--tru-ink-700);
  border: none;
  color: var(--white);
  border-radius: 12px;
  font-weight: var(--w-medium);
  box-shadow:
    inset 0 1px 0 rgba(232,234,230,0.10),
    0 4px 0 var(--tru-ink-900),
    0 8px 18px -8px rgba(0,0,0,0.95);
}
.tru-btn-secondary:hover { background: var(--tru-ink-600); }
.tru-btn-secondary:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--tru-ink-900), 0 2px 6px -3px rgba(0,0,0,0.9);
}

/* the only flat tier */
.tru-btn-ghost {
  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--white-dim);
  border-radius: 12px;
  font-weight: var(--w-medium);
}
.tru-btn-ghost:hover { background: rgba(232,234,230,0.06); color: var(--white); }
```

Then sweep `bg-white/5 border border-white/10` and `bg-white/[0.04] border-white/10` buttons onto
`.tru-btn-secondary` or `.tru-btn-ghost` per the screen notes below. The `bg-white/5` secondary sat
at almost exactly the value of the card behind it, so it read as a well rather than a control.

### 3. Retire the last blue

`--blue: #8AA2B8` in `brand.css` is already marked retired as an accent, but `bg-sky-500/15
text-sky-300 border-sky-500/30` is still on the Publish button in
`TruLens/src/components/InventoryList.tsx` (~line 1146). Publish becomes a secondary (when the car
is web-ready) or disabled (when it isn't). No blue anywhere.

### 4+. Per-screen work — see the screen tables below, worked in the stage order above.

---

## Screens

### TruLens · Catalogue
`TruLens/src/components/InventoryList.tsx` · shell `TruLens/src/App.tsx`

**Layout unchanged:** header, scroll area, bottom nav; card list in a `space-y-3` column.

Changes:

| # | Change | Why |
|---|--------|-----|
| 1 | Card's 2×2 grid of four buttons → one full-width 44px primary (**"Take pictures"**) over a 3-up ghost row (Export / Report / Publish) | A cyan fill, two grey fills and a blue fill at equal weight said nothing is the job |
| 2 | Publish: secondary when `isStructurallyWebReady`, otherwise `disabled` at `rgba(232,234,230,0.30)` | A coloured button that refuses is less honest than a disabled one |
| 3 | `.tl-appbar` removed — lit hairline, wordmark divider and the three bordered icon squares all go | 62px of chrome saying what one line of type says better |
| 4 | Dealership name becomes a plain **20px/600** page title on the page background, count as 13px below it | Orientation, not a headline. Do **not** scale this up |
| 5 | Header icon buttons → 40px ghost, no border, no box | Three bordered squares read as three decisions |
| 6 | Filter pills → underlined tab row, `box-shadow: inset 0 -2px 0 #3ECFC8` on the active one | A row of filled pills reads as five buttons; this frees the cyan fill for the action |
| 7 | Card radius 12 → 16px | Matches the panels around it |
| 8 | Progress bar 6px → 3px, track `rgba(232,234,230,0.08)` | Ambient, not a headline |
| 9 | Card title `font-bold` → `font-semibold` | `brand.css` caps at 600 |
| 10 | Readiness chip → plain coloured text (`#F59E0B` / `#4FE3DC`), no border, no tint | It was a chip that looked pressable |
| 11 | Stock number → plain 12px mono at 0.42, not a bordered chip | It was never a button |
| 12 | Search field → 44px, 12px radius, `rgba(232,234,230,0.04)` | Was below the floor the rest of the app uses |
| 13 | Per-card edit/delete icons → one 28px ghost overflow button | Two 13px icons at `text-neutral-600` were both invisible and mis-hittable |
| 14 | `.tl-card-lift` hover glow + `translateY(-3px)` removed | Depth lives on controls now. The `pointermove` listener also cost scroll perf on touch |
| 15 | Empty-state `tl-btn-3d bg-indigo-600` → primary | — |
| 16 | Settings "Save Configuration" → primary; Log out → destructive | — |

Exact copy on the after card: `2022 Ford Ranger` / `Wildtrak · R 689,900` / `STK-10293` /
`8 shots short` / `Take pictures` / `Export` `Report` `Publish`.

### TruLens & TruInspect · Sign in
`TruLens/src/components/Login.tsx`, `Truinspect/src/components/Login.tsx`

- `tl-btn-3d` → 52px primary, 12px radius, 16px label.
- Field → 52px, 12px radius, inset recess, still `text-[16px]`.
- Everything else unchanged: the two blurred cyan pools, the wordmark
  `[filter:brightness(2.1)_contrast(0.95)_saturate(1.05)]`, all copy, the eye toggle, caps-lock
  hint, error box in `#B86A6A`.
- Note for the record: the gloss was never what made this button visible in sunlight — the
  cyan-on-black contrast is. The white top lip and letterpress shadow were *reducing* label
  contrast.

### TruLens · Capture screen
`TruLens/src/components/CameraGuide.tsx`

| # | Change | Why |
|---|--------|-----|
| 1 | Nav bar, count bar and tick strip → overlays on the feed; viewfinder becomes `flex:1` (drop `min-h-[46svh]`) | Four stacked bars cost ~170px before the camera starts, on the one screen whose job is framing a car |
| 2 | 88px circular shutter with translucent cyan ring → **64px sculpted key, 16px radius, labelled "Shoot"** | The circle is the stock camera-app idiom and put the most-pressed control in a row of three unlabelled circles. The key is a bigger target and the same object as every other primary |
| 3 | Six controls → three: import (52px secondary), shoot (primary), **skip** (52px secondary) | Upload / shoot / bulk-import / retry-camera / two more in the empty state all meant "put an image in this slot". Skip was genuinely missing |
| 4 | 19-segment tick strip → one 2px bar; count moves to the header as `12 / 19 · 8 to go` | Three indicators counted the same thing |
| 5 | Slot chips: 18px → 12px radius; active = primary key, captured = secondary key, next = amber hairline, idle = flat 12% hairline; 110×74 → 96px wide | They join the button family. Keep the existing `slot-state--*` class names and only change the bodies |
| 6 | Slot name 17px/600 + description move to a bottom-left overlay on the feed, no black pill | — |
| 7 | Pending-shot Redo/Keep: Redo → ghost, Keep & next → primary, both 12px radius | Were `rounded-2xl` at 16px in a 2:1 split |

`renderGuideOverlay` SVG is unchanged except stroke-width 0.7 → 0.4 and opacity 0.55 → 0.5, so it
sits behind the new overlays.

### TruLens · Add vehicle form
`TruLens/src/components/InventoryList.tsx`, the `showAddForm` block

| # | Change | Why |
|---|--------|-----|
| 1 | **"Scan licence disc" becomes the primary** (52px, full width) | It fills nine fields from one photo, but shipped as a cyan-tinted ghost above the real cyan button — the loud control was the slow one |
| 2 | Three visible fields: **Make and model** (merged), Mileage, Price | Only make/model/mileage carry `required` in the source. Nobody types make and model separately |
| 3 | Other eleven fields behind one disclosure row: `Trim, colour, VIN, stock # — 11 more` | Was ~400px of equally-weighted 2-col grid |
| 4 | All fields → 48px, 12px radius, inset recess, 16px text | Were 46px at 8px radius against 44px/12px buttons |
| 5 | Labels 12px/0.55 → 13px/500/0.72 | Readable floor outdoors |
| 6 | Cancel + Add vehicle 50/50 at weight 700 → stacked, ranked: primary **"Add and start shooting"** over a ghost Cancel | Two identical buttons is not a hierarchy. Label says what happens next |
| 7 | Form header → 20px/600 title + 13px subtitle + 36px ghost close | Was a 13px label under a `+` icon with a hairline |

Keep all `required`, `inputMode`, `type` and `onChange` behaviour exactly as-is. The eleven hidden
fields must still be reachable and submit identically.

### TruInspect · Capture screen
`Truinspect/src/components/CameraGuide.tsx`

**The two `CameraGuide.tsx` files are the same component** (995 vs 1046 lines) and `index.css`
already says "kept identical to TruInspect's copy so the two field apps feel like one product —
edit both together". Every TruLens capture change above lands here unaltered. Two Inspect-only
differences:

1. **Two extra header buttons.** Tag damage (`text-amber-400`) and Checklist (`text-cyan-400`) ship
   as bare 26px icons with `p-1`, no label, no target padding — under the 44px floor the same
   stylesheet sets, and they are the two most important actions on an inspection. They come out of
   the header and become a **labelled ghost pair above the shutter**, with the checklist's
   outstanding count on it. Amber stays amber; the checklist loses its cyan, because cyan is the
   shutter.
2. **The shutter is a different cyan.** Lens writes `bg-[#4FE3DC]`, Inspect writes `bg-cyan-600`,
   which the `@theme` block remaps to `#3ECFC8` — one ramp step apart, visible if you hold both
   phones together. Both land on `#3ECFC8` once step 1 above ships, so this fixes itself.

### TruFlow Premium · Dealership overview
`Truflow-premium/src/App.tsx`

- `btn btn-primary` pills → 36px, **10px radius** (the desk tier — one step down from the field's
  12px, same family). A full pill on a desk tool reads as a marketing CTA.
- `btn btn-secondary` → `.tru-btn-secondary` at 36px.
- **One cyan per region.** The header's cyan is `New inventory`; the EOD card's cyan is
  `Compile summary`. Never two in one glance.
- **Cyan text is not a button.** `Gross after recon` stays cyan as *data*. Colour marks importance;
  fill marks action.
- Stat cards keep `.stat-card`; only the buttons change.

### TruFlow Premium · Leads / Tasks / Documents / Team
`Truflow-premium/src/App.tsx`, `Truflow-premium/src/components/DocumentsHub.tsx`

All four sections share three faults, so they take the same four fixes.

| # | Change | Applies to | Why |
|---|--------|-----------|-----|
| 1 | Filter controls leave the header and become the **tab row**, each carrying its count | Leads, Tasks | Leads had "Show overdue", "Auto-assign" and "+ New Lead" side by side in three different weights — three claims, no rank. The count is the reason you'd tap a filter |
| 2 | **Auto-assign loses its glow.** Drop `shadow-lg shadow-cyan-500/10`, the `--cyan-faint` fill, the `--cyan-soft` border and the pulsing `Sparkles`; becomes a ghost labelled `Auto-assign 5 new` | Leads | It was the loudest control in the section, for a convenience action |
| 3 | **Status and Priority chips → plain text.** A 6px dot for urgency; state as 13px text | Leads, Tasks | Adjacent columns of tinted chips that both resolve to cyan through the `@theme` remap, so "Urgent" and "Open" read as the same kind of thing — and both looked pressable |
| 4 | **Resolve and Delete stop matching.** Both become ghosts; only Delete's hover goes `rgba(184,106,106,0.14)` / `#C07676` | Leads, Tasks | A `--cyan-faint` Resolve beside a same-size trash at `--muted`, whose hover went to `--warning` rather than red |
| 5 | **Completed rows drop to 45%** with a struck label, a cyan check and no action buttons | Tasks | A finished task kept full contrast and a cyan "Resolved" label, so a done list looked as busy as an undone one |
| 6 | Table header `--glass` fill + double border → **12px mono labels over one hairline**; rows separated by a 6% line | all four | Keep `min-w-[700px]` and the `stack-mobile` responsive behaviour exactly as-is |
| 7 | Page header: `btn btn-primary` pill → **36px / 10px-radius desk primary**; subtitle becomes the counts that decide the morning | all four | — |
| 8 | Documents: Print / Download / Clear were three identical `bg-white/5` buttons → one primary `Upload`, per-row `Sign` primary only where a signature is outstanding, everything else in a 36px overflow ghost | Documents | Three same-weight buttons for three different jobs |
| 9 | Team: the issued access code becomes **22px mono in a recessed field** (same recess as every input) with a secondary `Copy` | Team | It was small text with a cyan-filled button inside a cyan-tinted card. It's a value read aloud down a phone |

**Copy changes** (safe, no logic): `+ Log Directive Task` → `New task`; `+ New Lead` → `New lead`;
`+ Add staff member` → `Add staff`; `Showroom Tasks` → `Tasks` (the sidebar already says where you
are); "Configure daily operational checklists & reconditioning items" → the three counts. **Drop the
`+` prefix everywhere** — a button that adds something doesn't need to say so twice.

**Aged-stock table** (`activeSection === "inventory"` analytics block): no buttons, nothing to
restyle. It is already the best-behaved table in Flow — 12px mono column labels, age band colour as
*text* not a chip — and the other three move toward it. Leave `AGE_BANDS`, `ageBand()`,
`grossMargin()` and `stockAge()` untouched.

### TruFlow Premium · Recon pipeline / Deal readiness / and the last four
`Truflow-premium/src/App.tsx` — `activeSection` values `workflow`, `deal_readiness`,
`stock_health`, `accounting_recon`, `media_web`, `payment`, `upload`

**Recon & delivery pipeline** (`workflow`, ~line 2075)

| # | Change | Why |
|---|--------|-----|
| 1 | `← Prev` / `Next →` both become **ghosts**; labels name the destination — `Move to sale`, `Deliver` | Every card carried a `--cyan-faint` `Next →`, so a 16-car board had 16 primaries. A direction arrow also makes you count columns to know where it goes |
| 2 | **Un-nest the board.** Drop the column `.card` + `--glass` fill + `--glass` `.card-header`; column becomes a heading, a hairline, and cards at 12px on `#161B22` | Three 18px-rounded surfaces inside each other. `.pipeline-card` keeps its name, loses its border and `shadow-md` |
| 3 | Column count `rounded-full` chip → plain mono on the heading baseline | A pill in a column header looks like a tappable filter |
| 4 | Price stops being `--cyan-bright`; becomes 15px mono in `--white` | Cyan text on every card competed with the cyan button on every card |
| 5 | Copy: "Reconditioning & Delivery Pipeline" → `Recon`; subtitle deleted; "Floor Inventory / Processing Sale / Delivered" → `On the floor / Processing / Delivered` | The three columns say what the subtitle said |
| 6 | `min-h-[500px]` / `min-h-[300px]` on empty columns can go | They were holding up boxes that no longer exist |

**Deal readiness** (`deal_readiness`, ~line 2701)

| # | Change | Why |
|---|--------|-----|
| 1 | The five `CHECK_ITEMS` become **real checkboxes** — filled `#3ECFC8` box with an ink tick when on; recessed empty box (`inset 0 0 0 1px rgba(232,234,230,0.22), inset 0 2px 3px rgba(0,0,0,0.4)`) when off | They shipped as cyan-tinted *buttons*, so a half-done deal was a row of half-lit buttons and you could not read state from affordance |
| 2 | `FINANCE_OPTS` (N/A / Submitted / Approved / Declined) → **tab row** | It is one choice, not four toggles |
| 3 | `done/total` gains a 56×3px bar beside it | So the ratio reads without arithmetic |
| 4 | Lead status `--cyan-faint` chip → plain text on the subtitle line | Every deal here is Negotiating or Closed Won, so the chip carried no information at full volume |

Keep `patchChecklist`, `CHECK_ITEMS`, `FINANCE_OPTS` and the `dealChecklist` shape exactly as-is —
this is a control-type change, not a data change.

**The last four** — no layout design needed; they follow the system:

| Section | Work |
|---------|------|
| `upload` (Add vehicle) | Same treatment as the TruLens add-vehicle form above: three fields plus a disclosure, primary at the bottom. Keep the "Photos only in TruLens" note |
| `stock_health`, `accounting_recon` | Read-only tables. 12px mono column labels, band/age colour as **text** not chips, no `--glass` header fill |
| `media_web`, `payment` | Header `btn btn-primary` → 36px desk primary. Nothing else |

### TruFlow Premium · Vehicle detail modal
`Truflow-premium/src/components/VehicleDetailModal.tsx`

The densest surface in the product and the worst offender.

| # | Change | Why |
|---|--------|-----|
| 1 | Five cyan-filled tab buttons → underlined tab row (`inset 0 -2px 0 #3ECFC8` on active) | A segmented control whose active segment is a filled cyan key with a shadow makes the loudest object in the panel *a label for where you already are*. This frees cyan for Publish — the only action that changes anything outside the modal |
| 2 | Price / category / spec `--glass` cards → plain rows with a 12px mono label above each value | Three nested surfaces at nearly the same value, inside a card, inside a modal |
| 3 | Retail price → **32px mono**, with an inline 32px ghost `Edit` | It is the number the dealer opened this for |
| 4 | Gallery goes **full-bleed on `#000`** — drop the 24px padding and 12px radius | The image was the fourth nested rounded rectangle. Also what §1.3 of `index.css` asks for around vehicle photography |
| 5 | Gallery arrows → 44px secondary keys, 12px radius | Were 36px `bg-black/50` circles |
| 6 | Thumbnails → 10px radius, `box-shadow: 0 0 0 2px #3ECFC8` for active instead of a 2px border | A border changes the box size and shifted the strip |
| 7 | **"Upload Photos" moves into the thumbnail strip** as a secondary, relabelled `Add photos` | It was a full-width cyan button in the spec column, competing with the retail price while acting on the panel opposite |
| 8 | **Remove leaves the header.** Becomes a footer ghost in `rgba(184,106,106,0.85)`, hover `rgba(184,106,106,0.14)` | It sat next to the close X in identical styling — the most destructive control on the screen was the easiest to mis-hit |
| 9 | Footer: primary `Publish to website` over a 2-up ghost row (`Edit details` / `Remove from stock`) | — |
| 10 | Labels stop shouting: "Showroom Retail Price" → `Retail`; Dealer Assist → `Assist`; Syndicate → `Feed` | 13px semibold wide-tracked labels above the numbers they describe, in a card titled by a tab that says Specs |
| 11 | Spec matrix → 2-col grid, 12px mono label over 15px/500 value | Was `Mileage: 78 400 km` inline, so label and value had equal weight |
| 12 | Stock number joins the subtitle line as mono | Was a cyan-tinted chip that looked pressable |

---

## Interactions & behaviour

- **Press** (all raised tiers): `transform: translateY(4px)` (3px on secondary/destructive), side
  collapses to `0 1px 0`, 90ms ease. **Remove** the global
  `button:active { transform: scale(0.97) }` and the `.tl-btn-3d:active { translateY(2px) }` shadow
  swap from `index.css` — the travel replaces both.
- **Hover** is desktop-only and already gated behind `@media (hover: hover) and (pointer: fine)`.
  Keep that gate. Ghost hover must not be the only affordance on touch — every ghost button has a
  label or a recognised icon.
- **Focus**: unchanged. Keep `:focus-visible` 2px `--focus-ring` offset 2, and keep the
  `.btn-primary:focus-visible { outline-color: var(--text-primary) }` override so the ring survives
  on a cyan fill.
- **Loading**: label stays, spinner leads (`Loader2` `animate-spin`), fill unchanged. Do not swap
  the label for a spinner alone.
- **Reduced motion**: `prefers-reduced-motion` must also kill the press travel. Add
  `transform: none` for `.tl-btn-3d:active, .tru-btn-secondary:active` inside the existing
  reduced-motion block.
- **Touch targets**: the existing 44px `min-height` / `min-width` rules stay. Nothing here is below
  44px except the 28px inline tier, which is exempt via the existing `p button, .inline-action`
  rule, and the 40px header/card ghosts, which need their own `min-height` exemption or should be
  raised to 44.
- **Disclosure** (add-vehicle form): purely visual. The eleven fields stay mounted or must remount
  with their values intact; submit payload is unchanged.

## State management

No new state except:

- Add-vehicle form: one boolean for the disclosure row (`showAllFields`).
- Everything else — `activeTab`, `activeFilter`, `readinessFilter`, `selectedSlotId`,
  `pendingShot`, `editingTruPrice`, `uploading`, `exportingId`, `publishingId` — unchanged.

## Design tokens

All from `packages/tokens/tru-tokens.css` and `src/brand.css`. **No new colours.**

| Token | Value | Use |
|-------|-------|-----|
| `--tru-cyan-500` | `#3ECFC8` | primary fill |
| `--tru-cyan-400` | `#4FE3DC` | primary hover; cyan *text* and data |
| `--tru-cyan-700` | `#2FB3AD` | pressed |
| `--tru-cyan-800` | `#22807C` | the primary's side |
| `--tru-ink-700` | `#161B22` | secondary fill |
| `--tru-ink-600` | `#21262D` | secondary hover |
| `--tru-ink-900` | `#06080D` | secondary side; ink label on cyan |
| `--tru-ink-800` | `#0B0F17` | card / panel surface |
| `--tru-paper` | `#E8EAE6` | primary text |
| — | `rgba(232,234,230,0.72)` | ghost label, secondary body text |
| — | `rgba(232,234,230,0.42 / 0.32)` | mono meta / disabled |
| — | `rgba(232,234,230,0.14 / 0.10 / 0.08)` | borders, input border, tint fills |
| `--tru-amber-500` | `#F59E0B` | "needs shots", tag damage, next-up chip |
| — | `#3D2222` / `#241414` / `#C07676` | destructive fill / side / label |
| `--r-*` | **12px buttons/inputs, 10px desk tier, 16px cards, 999px chips only** | radius |
| `--t-*` | 12 / 13 / 15 / 17 / 20 / 28 / 32 / 38 | type scale, 12px floor |
| `--w-*` | 400 / 500 / **600 max** | weights |
| Fonts | Inter; IBM Plex Mono for numbers, stock numbers, labels | — |

Shadow vocabulary — the whole set, nothing else:

```
raised primary:      inset 0 1px 0 rgba(255,255,255,0.28), 0 5px 0 #22807C, 0 10px 22px -8px rgba(0,0,0,0.95)
raised neutral:      inset 0 1px 0 rgba(232,234,230,0.10), 0 4px 0 #06080D, 0 8px 18px -8px rgba(0,0,0,0.95)
pressed:             inset 0 1px 0 rgba(255,255,255,0.20), 0 1px 0 <side>, 0 2px 6px -3px rgba(0,0,0,0.9)
recessed (input):    inset 0 2px 4px rgba(0,0,0,0.35)
```

## Changes to look for — regression checklist

Things that will silently undo this work.

**Specificity and `!important`**
- `.btn-primary` is declared **three times** in `Truflow-premium/src/index.css` with six
  `!important` flags, fighting the `@utility btn-primary` Tailwind utility. Collapse to one
  declaration. If you leave two, the later one wins and the earlier one looks like dead code that
  someone will "fix".
- `.tl-btn-3d` is unlayered plain CSS specifically so it beats Tailwind `bg-*` utilities on the same
  element. Keep it unlayered, and keep the `bg-indigo-600` classNames on those buttons *or* remove
  them everywhere — do not do half.

**The `@theme` remap**
- Every chromatic ramp (indigo, purple, violet, sky, blue, emerald, teal, green, lime, fuchsia,
  pink) is remapped to brand cyan or brand slate. So `bg-indigo-600` and `bg-[#4FE3DC]` render
  almost the same but are different tokens. Two consequences:
  - The `.bg-cyan-400, .bg-indigo-600, …` contrast rule matches **named ramp classes only**.
    `bg-[#3ECFC8]` written as an arbitrary value slips past it. If you add a new arbitrary cyan,
    add it to that selector list too.
  - Opacity variants (`bg-cyan-600/20`) are a *different* class token and are correctly unmatched —
    those are dark tints that want light text. Don't "fix" them.
- Inspect's bulk importer still uses `indigo-950/40`, `indigo-500`, `indigo-400` where Lens's copy
  was moved to cyan. They render identically through the remap, so it is invisible — but the next
  person to touch either file will diverge them again. Normalise in this pass.

**Gradients are invisible to the contrast rules**
- A gradient paints `background-image`, not `background-color`, so no `.bg-*` rule can see it. Any
  element with an accent gradient fill **must** carry `.on-fill`. The
  `[class*="from-[#4FE3DC]"]` selectors only cover the Tailwind gradient utilities; inline styles
  need the class. Better: don't add gradients — the system has none.

**Contrast**
- **Never light text on a cyan fill.** `#E8EAE6` on `#3ECFC8` is ~1.3:1. Ink `#06080D` on `#3ECFC8`
  is ~7.4:1. Components historically passed `text-[#E8EAE6]` on cyan buttons and the stylesheet
  had to override it — if you strip the override, the labels vanish. Prefer fixing the classNames.
- Watch for anyone re-adding `text-shadow` "for legibility". It reduces contrast on this fill.

**The 12px type floor**
- `brand.css` sets 12px and explains why; there is a `.text-\[11px\] { font-size: 12px }` patch
  holding eighteen labels up. Anything new at 10–11px will pass review on a monitor and fail in a
  yard.

**Depth creep**
- The line to hold is **one** highlight hairline, **never** a gradient. If a second inset highlight,
  a second gradient stop, or a coloured glow appears on a button, it is becoming the old button
  again.
- No cyan glow on buttons. `--glow-cyan` is reserved for genuinely live elements.
- `.tl-card-lift` cursor-tracking radial glow: keep it removed. Depth belongs to controls.

**Colour discipline**
- `--blue: #8AA2B8` is retired as an accent. If `bg-sky-*` or `border-sky-*` reappears on a control,
  it is the old Publish button coming back.
- Traffic lights are retired: warnings de-emphasise to muted text; `#B86A6A` is destructive only;
  amber `#F59E0B` means "do this again / do this next", never error; red means system fault.
- One cyan fill per glance. The most common regression is a second primary appearing next to the
  first.

**Field-capture sterile zones (TruLens only)**
- `[data-app="trulens"] .capture-preview / .photo-review / .panel-thumb` must stay zero-saturation
  and zero-blur; `.photo-review :where(*) { --accent: transparent }` suppresses accent inside. Do
  not put a cyan-tinted chrome, a glow or a backdrop-blur next to a vehicle photo — that bias shows
  up as a white-balance fault on white dealer sites.

**Motion**
- Nothing infinite. `.tl-float`, `.tl-progress-sheen` and `.animate-pulse-custom` were all
  deliberately converted to one-shot or opt-in (`.is-working`). If an `infinite` reappears,
  someone has re-broken a decision that was made on purpose.

**Two field apps, one product**
- `TruLens/src/index.css` and `Truinspect/src/index.css` are near-verbatim copies, as are the two
  `CameraGuide.tsx`, `Login.tsx`, `DiscScanner.tsx`, `DamageTagger.tsx`, `MobileDevice.tsx` and
  `ErrorBoundary.tsx`. **Edit both together, every time.** `brand.css` exists verbatim in three
  apps for the same reason — edit the canonical copy and copy it across.

## A note on the source — dead code found

Verified against the newer `Truflow-premium` mount:

`AgreementPreview.tsx` and `InvoicePreview.tsx` **still exist as files and are still imported**
(`App.tsx` lines 80–81, `LeadDetailModal.tsx` line 6) but there is **no render site anywhere in the
tree** — no `<AgreementPreview` or `<InvoicePreview`. They are stripped from the UI with live
imports left behind. Nothing to design; delete the three imports and the two files.

The live white surfaces that remain are inside `DocumentsHub.tsx`: the document preview frame
(line ~312), the signature thumbnail (~332) and the draw canvas (~368). Those are paper, not chrome
— leave them white. Only the dark controls around them take the new tiers.

## Assets

| Asset | Source |
|-------|--------|
| `assets/trulens-wordmark.png` | `TruLens/src/assets/images/trulens-wordmark.png` |
| `assets/truflow-logo.svg` | `logos/TruFlow-Light-Logo.svg` |

The TruLens wordmark is the light-background variant, so it carries
`filter: brightness(2.1) contrast(0.95) saturate(1.05)` to read as silver on dark. Remove that
filter once a proper light-chrome wordmark exists.

Icons in the prototype are inline SVG traced from the **lucide-react** icons the codebase already
uses (`Camera`, `Download`, `FileText`, `ExternalLink`, `RefreshCw`, `LogOut`, `Search`, `Plus`,
`ChevronLeft/Right`, `X`, `MoreVertical`, `ScanLine`, `Images`, `Upload`, `Check`, `AlertCircle`,
`ClipboardCheck`, `Lock`, `Monitor`, `HelpCircle`). **Use the real lucide components** — do not
copy the SVG paths out of the prototype.

## Files

| File | Contents |
|------|----------|
| `Button System 2026.dc.html` | the full design reference, all eight turns |
| `assets/trulens-wordmark.png` | TruLens wordmark |
| `assets/truflow-logo.svg` | TruFlow logo |

Source files this design was built from, and which need changing:

```
packages/tokens/tru-tokens.css                       (read only — no changes needed)
TruLens/src/brand.css                                (read only)
TruLens/src/index.css                                steps 1, 2, motion, press
TruLens/src/components/InventoryList.tsx             catalogue + add-vehicle form
TruLens/src/components/CameraGuide.tsx               capture screen
TruLens/src/components/Login.tsx                     sign in
Truinspect/src/index.css                             steps 1, 2 (mirror of TruLens)
Truinspect/src/components/CameraGuide.tsx            capture screen + 2 Inspect-only diffs
Truinspect/src/components/InventoryList.tsx          catalogue (mirror)
Truinspect/src/components/Login.tsx                  sign in (mirror)
Truflow-premium/src/index.css                        steps 1, 2 — collapse the 3x .btn-primary
Truflow-premium/src/App.tsx                          overview, Leads, Tasks, Team, aged stock
Truflow-premium/src/components/DocumentsHub.tsx        Documents (incl. the white signature panels)
Truflow-premium/src/components/VehicleDetailModal.tsx  vehicle detail
```

## Not covered

Out of scope in this pass, in rough priority order:

1. `ReportPreview.tsx` in both field apps — still `bg-white/5` toolbars with `font-bold`. Button
   swap only, no layout design needed.
2. `DiscScanner.tsx`, `DamageTagger.tsx`, `PublishGate.tsx`, `PwaInstallBanner.tsx`,
   `LeadDetailModal.tsx`, `DealershipAdmin.tsx`, `LoginSplash.tsx`, `AccountingRecon.tsx`,
   `AmortizationCalc.tsx`, `CommissionEstimator.tsx`, `CustomerLeadForm.tsx`, `ChatWidget.tsx`,
   `InstallAppButton.tsx` — button swaps only; they follow the tiers without further design.
3. TruAfford (light tier) — the only light-surface product; needs its own side and highlight values
   on paper. Also the only remaining light surface in the estate, now that the agreement and invoice
   previews are gone.
4. TruChat, TruTrade, TruLive, TruCRM.
