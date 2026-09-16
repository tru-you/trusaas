# AutoLogic PE — Agent Client Context & Handover

**Last updated:** 2026-09-16 07:05 SAST by Antigravity  
**Client:** AutoLogic PE (Gqeberha / Port Elizabeth, Eastern Cape)  
**Dealer Principal / Reference:** Charl  
**Site Root:** `Current Clients/Autologic/`  
**Tagline:** "The Logical Choice in Pre-Owned Vehicles"  
**Palette & Theme:** Dark mode first (`data-theme="dark"`), `#080B10` Obsidian Carbon, `#E31B23` Performance Crimson Red, `#FF333A` Active Glow Accent.  
**WhatsApp Contact:** `27826039334`  
**Dealer Email:** `autologicpe@gmail.com`  
**Dealer Slug:** `autologic-pe` (to be registered in TruFlow backend)  

---

## 1. Executive Summary & Architecture Standard

AutoLogic PE digital showroom scaffolded to the TruDealer flagship standard:
1. **Glassmorphic Sticky Header & Navbar**:
   - Dark frosted glass (`backdrop-filter: blur(24px) saturate(180%)`) with top crimson glowing accent line (`#E31B23`).
   - Clean high-resolution vector logo (`assets/brand/logo.svg`).
2. **Hero Presentation & Distant Framing**:
   - High-impact, full-bleed automotive staging featuring AutoLogic's flagship dark vehicle hero (`assets/brand/hero-car.jpg`).
   - Gentle Ken Burns ambient animation (`scale(0.98)` to `1.04`) with distant responsive framing so the vehicle is never cut off or over-zoomed on mobile.
3. **Pop-Out Glassmorphic Search Rail**:
   - Positioned below the hero and provenance ticker with frosted glass styling (`backdrop-filter: blur(28px) saturate(200%)`), crimson glowing top border (`border-top: 2px solid var(--accent)`), and deep specular pop-out shadows.
4. **VDP Gallery Primary & TruOrbit Secondary**:
   - High-definition photo gallery active by default with thumbnail filmstrip and lightbox.
   - Interactive 360° Studio Orbit walkaround available as secondary tab.
5. **Interactive Financial & Trade-In Suite**:
   - 3-step live Trade-In Appraisal & Showroom Equity Matcher (`trade-in.html`).
   - Vehicle finance calculator & multi-bank pre-approval showcase (`finance.html`).
   - Responsive standalone widgets (`tru-repay.js`, `tru-afford.js`, `tru-value.js`) styled in obsidian glass with crimson aura rings and glint sweeps.

---

## 2. Color System & Design Tokens

| Token Role | Hex Code | Visual Application |
|---|---|---|
| `--color-dark-anchor` | `#080B10` | Full-page background ground |
| `--color-surface` | `#121824` | Elevated cards, vehicle tiles, modals |
| `--color-surface-subdued` | `#171F2E` | Input fields, secondary panels |
| `--color-primary` | `#E31B23` | Brand Performance Crimson Red |
| `--color-primary-light` | `#FF333A` | Active glow, hover states, pulse aura |
| `--color-primary-dark` | `#990F14` | Deep mahogany/crimson undertone |
| `--color-border` | `rgba(227, 27, 35, 0.22)` | Card borders, glass rims |
| `--color-ink` | `#FAF5EE` | High contrast typography (Dark mode) |
| `--color-ink-secondary`| `#D6D3D1` | Subtitles, specs labels |

---

## 3. Key Files Structure

| File Path | Description | Status |
|---|---|---|
| `AGENTS.md` | Client context, tokens, and technical specification. | Active |
| `index.html` | Homepage with distant-view hero, provenance ticker & pop-out glassmorphic search rail. | Complete |
| `stock.html` | Pre-owned inventory grid (SRP) with filters & sorting. | Complete |
| `vehicle.html` | Vehicle detail page (VDP) with HD photos primary, 360 Orbit secondary & VIR score. | Complete |
| `finance.html` | Dynamic vehicle finance showcase & repayment simulator. | Complete |
| `trade-in.html` | 3-step condition-adjusted live valuation wizard & equity matcher. | Complete |
| `assets/css/showroom.css` | Scoped design system tokens, components, and media queries. | Verified |
| `assets/js/showroom-data.js`| Live stock synchronization & fallback inventory. | Complete |
| `assets/js/showroom.js` | Navbar, mobile drawer, sticky deal bar, theme toggler. | Complete |
| `assets/js/vdp-page.js` | VDP gallery, specs renderer, WhatsApp lead builder. | Complete |
| `assets/js/web3d-mock.js` | Interactive 360 turntable player engine. | Complete |
| `tru-loader.js` | Central TruDealer widget loader configured for AutoLogic PE. | Verified |
| `tru-repay.js` | Monthly installment calculator with obsidian/crimson glass styling. | Verified |
| `tru-afford.js` | Affordability slider & lead qualifier. | Verified |
| `tru-value.js` | Instant trade appraisal widget. | Verified |

---

## 4. Verification & Dev Notes
- **Local Dev Server**: Launch on `python -m http.server 8086`.
- **WhatsApp Routing**: Configured to `27826039334`.
- **Sensitive Documents**: Ignored from Git (`*.pdf`, `Invoice*`, `SLA*`).
