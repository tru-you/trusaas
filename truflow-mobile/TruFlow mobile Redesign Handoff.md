# TruFlow Mobile — Redesign Handoff

## Direction chosen: 1a Pulse (task-first command center)

---

## Design system alignment

TruFlow now matches the TruLens / TruInspect / TruDealer suite:

| Token | Value |
|---|---|
| `--ink` | `#06080D` |
| `--ink-2` | `#0B0F17` |
| `--ink-3` | `#161B22` |
| `--ink-4` | `#21262D` |
| `--border` | `#30363D` |
| `--paper` | `#E8EAE6` |
| `--cyan` | `#4FE3DC` |
| `--cyan-500` | `#3ECFC8` |
| `--cyan-800` | `#22807C` |
| `--danger` | `#B86A6A` |
| Type | Inter 400/500/600 |
| Mono | IBM Plex Mono 400/500 |
| Card radius | 18px |
| Element radius | 12px |
| Pill radius | 100px |

### What changed from the old design

- **No uppercase** — brand.css explicitly forbids it; old design used it everywhere
- **12px type floor** — old design had 10–11px labels
- **Sculpted 3D buttons** — 5px side shadow + press travel (was flat 2px)
- **Card depth** — inset top hairline + ambient shadow (`--shadow-card`)
- **Neutral avatars** — glass/ink tone with border, no bright colors
- **Task-focused density** — one purpose per screen, not information overload

---

## Screens

### 2a — Leads list
- Sticky header with search + sculpted filter chips (All / New / Contacted / Negotiating / Won)
- "+ Walk-in" sculpted CTA in header
- Lead rows: glass avatar, name, vehicle of interest, source tag, time
- Status pills: cyan (New), neutral (Contacted/Negotiating), dust (Stale)

### 2b — Lead detail (bottom sheet)
- Slides up from leads list with scrim + handle
- Header: avatar, name, status pill, source, close button
- Quick actions: Call + WhatsApp (green border accent)
- Enquiry message card (cyan-faint bg)
- Status stepper: New → Contacted → Negotiating → Won (sculpted active state)
- Vehicle of interest card with chevron → links to vehicle detail
- Notes textarea
- Activity timeline
- Sticky footer: sculpted Save button

### 2c — Stock list
- Search bar + filter chips (All / In stock / Live / Sold)
- Vehicle cards: photo placeholder area, glass pill overlay (Live / Unpublished), title, price, spec chips (km, fuel, transmission)

### 2d — Vehicle detail (bottom sheet)
- Hero image area with close button + status pill overlay
- Title + variant + price
- Spec chips row
- Listing controls: website toggle (on/off), status segmented control (In stock / Sold)
- Pricing table: asking price + TruPrice
- Footer: sculpted Save + delete button

### 2e — Activity feed
- Grouped timeline: Today / Yesterday
- Timeline dots: cyan (actionable events) / dim (informational)
- Event types: new lead, vehicle published, photos uploaded, lead updated, vehicle added, deal closed, price adjusted

### 2f — Add vehicle
- Section headers: "The car" / "The money"
- 2-column grid form: Year, Make, Model, Variant, Body, Fuel, Transmission, Mileage
- Pricing: Asking price, TruPrice
- Sculpted "Add to inventory" CTA
- Helper text: "Saved unpublished · shoot in TruLens to go live"

### 2g — Account
- Profile card: cyan avatar, name, dealer code (mono)
- WhatsApp support row
- Sign out row (danger color)
- Footer branding: "TruFlow · Powered by TruSaaS"

### 2h — Chat assistant (Dealer Assist)
- Full-screen overlay with header + close
- Chat bubbles: bot (ink-3 bg, glass border) / user (cyan-faint bg, cyan border)
- Suggestion chips row (scrollable)
- Text input + sculpted send button

---

## Navigation

5-tab bottom nav with inset hairline + ambient shadow:

1. **Home** — pulse dashboard
2. **Leads** — lead list + detail sheet
3. **Stock** — inventory + vehicle detail sheet
4. **Activity** — timeline feed
5. **Account** — profile + settings

Active state: cyan icon + label.

---

## Component patterns

### Sculpted button (primary)
```css
background: #3ECFC8;
color: #06080D;
border-radius: 12px;
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.28),
  0 5px 0 #22807C,
  0 10px 22px -8px rgba(0,0,0,.95);
```

### Card
```css
background: #0B0F17;
border: 1px solid rgba(232,234,230,.14);
border-radius: 18px;
box-shadow:
  0 1px 0 rgba(232,234,230,.06) inset,
  0 18px 40px -28px rgba(0,0,0,.8);
```

### Bottom sheet
- Scrim: `rgba(4,6,10,.65)` + `blur(3px)`
- Body: `border-top-left-radius: 24px`, inset hairline, heavy drop shadow
- Handle: 38×5px, `--border` color, centered

### Avatar (neutral)
```css
background: rgba(232,234,230,.055);
border: 1px solid rgba(232,234,230,.14);
border-radius: 12px;
color: rgba(232,234,230,.72);
```

### Filter chip (active)
Same sculpted treatment as primary button but 3px shadow depth.

---

## Notes for development

- All screens are mobile-first at 393×852 (iPhone 15 viewport)
- Bottom nav height: 84px (includes 20px home indicator safe area)
- Status bar height: 54px
- Scroll areas need `padding-bottom: 90px` to clear the bottom nav
- Bottom sheets use `position: absolute` within the phone frame
- TruLens integration: "shoot in TruLens to go live" messaging on unpublished vehicles
- Chat assistant ("Dealer Assist") is a full-screen overlay, not a tab — accessed via a floating action or home card
