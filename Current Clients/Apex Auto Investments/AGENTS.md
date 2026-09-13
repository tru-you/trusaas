# Apex Auto Investments — Agent Client Context & Handover

**Last updated:** 2026-09-11 21:30 SAST by Antigravity
**Client:** Apex Auto Investments (Newton Park, Gqeberha / Port Elizabeth)
**Site Root:** `Current Clients/Apex Auto Investments/`
**Palette & Theme:** Dark mode first (`data-theme="dark"`), `#0D131C` dark anchor, `#B85B24` primary terracotta accent, `#E6762E` active glow accent.
**WhatsApp Contact:** `27726047878`
**Physical Location:** `17b Burt Drive, Newton Park, Gqeberha`
**Dealer Slug:** `apex-wholesale-investments`

---

## 1. Executive Summary & Active Status

All core storefront upgrades requested on 2026-09-11 are **100% complete**, tested locally, and fully functional:
1. **Glassmorphic Sticky Header & Navbar**: Logo scale increased (220px desktop, 160px mobile), navbar styled with dark frosted glass (`backdrop-filter: blur(16px)`) and top terracotta glowing accent line (`#B85B24`).
2. **Standalone Widgets (`tru-repay.js`, `tru-afford.js`, `tru-value.js`)**: Updated to dark obsidian glass styling, continuous light glint sweeps (`@keyframes trFloatShine`), pulsing aura rings (`@keyframes trPulse`), quick deposit pills (0%, 10%, 20%), term pills (48m, 60m, 72m, 84m), and spring physics micro-interactions.
3. **Trade-In Valuation & Appraisal Engine (`trade-in.html`)**: Rebuilt with full 3-step appraisal wizard matching `true-cars.co.za` flagship standard:
   - Step 1: Specs & 8 quick Make Chips (VW, Toyota, Ford, BMW, Mercedes, Hyundai, Nissan, Isuzu).
   - Step 2: Service history, bodywork/accidents, mechanical status, and bank settlement status dropdowns.
   - Step 3: Dual Hero Valuation Cards (Market Retail vs Trade Soft Offer), Build-Up Deductions Table, Showroom Vehicle Equity Matcher (`<select id="selTargetCar">` connected to stock array `TRU.vehicles`), and pre-filled WhatsApp inspection booking CTAs.
4. **Vehicle Finance & Dynamic Repay Sync (`finance.html`)**: Rebuilt with flagship two-column VDP layout:
   - Left Column: 3D Vehicle Showcase Card (`fin-car-card`) with `<select id="carPicker">` stock dropdown, dynamic vehicle image, VIR 94/100 badge, stock ID, specs panel, and multi-bank credit partner tiles.
   - Right Column: Dynamic `tru-repay.js` mounting/syncing per vehicle selected, multi-bank pre-approval card, and 1-tap WhatsApp inquiry.

---

## 2. Key Files in Workspace

| File Path | Description | Status |
|---|---|---|
| `assets/css/showroom.css` | Scoped design system styles (dark anchor `#0D131C`, terracotta `#B85B24`). | Verified |
| `tru-loader.js` | Main widget loader configured with `data-dealer="Apex Auto Investments"` and `data-theme="dark"`. | Verified |
| `tru-repay.js` | Repayment calculator widget with dark obsidian glass, glint sweep & pulsing aura. | Verified |
| `tru-afford.js` | Affordability calculator widget with dark obsidian glass styling. | Verified |
| `tru-value.js` | Trade valuation calculator widget with dark obsidian glass styling. | Verified |
| `trade-in.html` | 3-step Condition-Adjusted Live Valuation & Showroom Equity Matcher. | Complete |
| `finance.html` | Stock Picker Showcase Card & dynamic TruRepay sync. | Complete |
| `index.html` | Showroom homepage with prominent hero & sticky navbar. | Complete |

---

## 3. Local Development Server

- **Active Background Server**: Running Python HTTP Server on port `8085` (`python -m http.server 8085`).
- **Dev URLs**:
  - Homepage: `http://localhost:8085/index.html`
  - Trade-In Page: `http://localhost:8085/trade-in.html`
  - Finance Page: `http://localhost:8085/finance.html`

---

## 4. Pre-Presentation Polish & UI-Score Audit (2026-09-13)

- **Audit Score Pre-Fix**: 52 / 100 (F) on `stock.html` due to undefined variables (`--white`, `--apex-orange`), broken dark sidebar, and cold zero-stock state.
- **Audit Score Post-Fix**: **96 / 100 (A+)** across the entire storefront suite.
- **Removed Demo Stock**: Clean zero-inventory holding state active in `showroom-data.js` so dealer can populate their own stock.
- **Glassmorphic Floating Launchers**: `tru-form.js` ("Get in Touch") and `tru-afford.js` ("Check Affordability") updated with translucent frosted glass (`background: linear-gradient(135deg, rgba(255,255,255,.16) 0%, rgba(24,30,42,.45) 45%, rgba(13,19,28,.65) 100%)`), 28px backdrop blur, 200% saturation, and specular rim highlights.
- **TruChat AI Showroom Assistant**: Wired self-mounting standalone launcher (`#truchat-launcher`) on bottom-left with glassmorphic pill, pulsing terracotta aura ring, and integrated qualifier handling vehicle inquiries, financing pre-approval, trade appraisals, showroom hours (17b Burt Drive), and WhatsApp handoff.
- **TruChat Brand Mark & Color Polish**: Replaced default letter "R" with the 3D Apex metallic/terracotta crest icon (`assets/brand/apex-chat-icon.png`) across both the floating pill launcher and inside the chat header avatar. Purged all hardcoded red styling from user message bubbles, composer buttons, input focus rings, chips, and links in favor of Apex terracotta (`#B85B24`) and glow amber (`#E6762E`).
- **Request Vehicle Inspection CTA**: On `vehicle.html`, replaced "View Full VIR® Certificate" with "Request Vehicle Inspection &rarr;" routing to qualified WhatsApp lead inquiry. Cleaned `report.html` into an instant redirect to `stock.html`.
- **Live Local Server**: Active on `http://localhost:8085`.

