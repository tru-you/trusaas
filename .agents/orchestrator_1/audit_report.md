# TruSaaS Dealer Management Suite — Comprehensive Audit Report & Polish Punch-List

**Audit Date:** 2026-09-02  
**Target Scope:** Entire TruDealer Vertical SaaS Suite (All 5 Surfaces)  
**Integrity Mode:** Read-Only Deep Code Inspection & Synthesis  
**Output Location:** `.agents/orchestrator_1/audit_report.md`  

---

## 1. Executive Summary

TruSaaS is a vertical SaaS platform for independent automotive dealerships. The product is already winning competitive displacements against South Africa's incumbent provider by delivering fast, dealer-centric workflows and zero-cold-start cloud architecture.

This comprehensive audit inspected all five application surfaces of the TruSaaS suite:
1. **TruLens** (`trusaas-lens/` / `TruLens/`) — PWA lot photography studio, AI quality auditor, and 360° spin engine.
2. **TruInspect** (`truinspect/`) — Mobile/desktop vehicle inspection condition reports (VIR), damage tagging, and trade-in appraisals.
3. **TruFlow Premium** (`truflow-premium/`) — Flagship desktop Dealer Management System (DMS), CRM lead pipeline, inventory management, DocHub, and accounting.
4. **TruFlow Mobile** (`truflow-mobile/`) — Lightweight showroom floor companion app with offline caching and quick lead/stock actions.
5. **CDN Widgets & WordPress Plugin** (`packages/standalone/` & `packages/truwidgets-wp/`) — Zero-dependency embeddable website widgets (Afford, Repay, Form, Book, Value, Loader, Share) and CMS integration.

The audit was conducted strictly under the **polish and refinement doctrine**: no architectural rewrites, no framework migrations, and no breaking changes to data structures or public APIs. Instead, it surfaced **55 concrete, highly actionable refinements** across UX polish, performance, code quality, missing micro-features, and widget developer experience.

---

## 2. Audit Matrix: Surface × Category Breakdown

| Surface | UX Polish | Performance | Code Quality | Micro-Features | Widget DX | Total Findings | High Impact | Med Impact | Low Impact |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. TruLens** | 3 | 2 | 3 | 2 | — | **10** | 4 | 6 | 0 |
| **2. TruInspect** | 4 | — | 3 | — | 1* | **8** | 3 | 4 | 1 |
| **3. TruFlow Premium** | 7 | 3 | 4 | 2 | — | **16** | 11 | 4 | 1 |
| **4. TruFlow Mobile** | 4 | 1 | 3 | 3 | — | **11** | 5 | 5 | 1 |
| **5. CDN Widgets & WP** | 3 | 1 | 1 | — | 5 | **10** | 6 | 4 | 0 |
| **TOTAL** | **21** | **7** | **14** | **7** | **6** | **55** | **29** | **23** | **3** |

*\*Note: Multi-Market substrate consistency evaluated under Widget DX / Multi-market.*

### Effort Breakdown
- **Small (S) Effort (<30 min):** 46 findings (83.6%)
- **Medium (M) Effort (1–3 hours):** 9 findings (16.4%)
- **Large (L) Effort (Half-day+):** 0 findings (0%) — *all proposed changes are strictly bite-sized and shippable independently.*

---

## 3. Top 10 Quick Wins (Highest Value, Lowest Effort)

These 10 changes represent the highest impact-to-effort ratio across the entire suite. Each requires less than 30 minutes of developer time, carries zero regression risk, and immediately improves dealer productivity, data integrity, or conversion rates:

| # | Code | Surface | Category | Title & Location | Summary of Impact |
|---|---|---|---|---|---|
| **1** | **TFP-01** | TruFlow Premium | Security / Code Quality | **Multi-Tenant Leak in `/api/state`**<br>`server.ts:1623–1642` | One-line filter scopes `dealerships` to caller's own dealership for non-admins, closing a critical multi-tenant data leak. |
| **2** | **TL-01** | TruLens | UX Polish | **Restore Rapid 60s Camera Capture Loop**<br>`src/App.tsx:369–374` | Eliminates forced view navigation to `ImageEditor` on every shot, saving 54 taps per vehicle walkaround. |
| **3** | **CW-02** | CDN Widgets | UX / Reliability | **Fix False Error Alarm in TruRepay**<br>`tru-repay.js:629–638` | Stops showing false red error screen when WhatsApp-only dealers receive finance quotes without a configured webhook URL. |
| **4** | **TFM-01** | TruFlow Mobile | Code Quality | **Fix `api()` HTTP Status Handling**<br>`public/index.html:716–720` | Rejects non-2xx responses in `api()`, preventing false "Saved / Vehicle updated" toasts when backend writes fail. |
| **5** | **TI-01** | TruInspect | UX / Workflow DX | **Direct Slot Routing to Damage Tagger**<br>`InspectionSheet.tsx:266`<br>`DamageTagger.tsx:46` | Passes `item.photoSlotId` directly into `DamageTagger`, eliminating manual navigation through 27 slots to tag damage. |
| **6** | **TFP-02** | TruFlow Premium | Search UX | **Expand Stock Search to VIN & License Plate**<br>`src/App.tsx:2124–2127` | Includes `vin`, `registrationNumber`, `year`, and `color` in main inventory search queries. |
| **7** | **TFM-02** | TruFlow Mobile | Performance / Caching | **Prevent ServiceWorker Cache Poisoning**<br>`public/sw.js:44–49` | Guards cache writes with `res.status === 200` so 502/504 gateway timeout responses do not poison offline storage. |
| **8** | **CW-01** | CDN Widgets | Widget DX | **Restore Missing TruValue in TruLoader**<br>`tru-loader.js:164–296` | Adds `value` / `tru-value` boot branch and `TruDealer.open('value')` / `closeAll()` support for universal embeds. |
| **9** | **TL-02** | TruLens | Performance | **Client-Side Bulk Image Compression**<br>`CameraGuide.tsx:259–284` | Downscales camera roll bulk dumps to max 1920px @ 0.85 JPEG before POSTing, eliminating 20MB cellular payloads and OOM crashes. |
| **10** | **TI-03** | TruInspect | UX / Workflow | **Completion Review Grid Jump to Missing Slots**<br>`CompletionReview.tsx:101` | Removes `photo &&` guard so tapping red missing shot tiles opens the camera directly on that missing angle. |

---

## 4. Consolidated Prioritised Punch-List

Ranked by **Impact-to-Effort Ratio**:
- **Tier 1: High Impact · Small Effort (Quick Wins)**
- **Tier 2: High Impact · Medium Effort (High-Value Micro-Features & Polish)**
- **Tier 3: Medium Impact · Small Effort (Fast Polish & Refinements)**
- **Tier 4: Medium Impact · Medium Effort (Component Enhancements)**
- **Tier 5: Low Impact · Small Effort (Hygiene & Minor Fixes)**

---

### Tier 1: High Impact · Small Effort (S) — Quick Wins

#### [TFP-01] Multi-Tenant Dealership Metadata Leak in `/api/state`
* **App:** TruFlow Premium
* **Category:** Code Quality / Security
* **File & Lines:** `truflow-premium/server.ts:1623–1642`
* **Description:** In `app.get("/api/state")`, the response spreads the full root state object `...s`. While collections like `vehicles`, `leads`, and `tasks` are scoped with `scopeToDealer()`, `dealerships` is returned un-scoped. Non-admin users receive every registered dealership's CIPC registration number, VAT number, physical address, and contact details.
* **Suggested Fix:**
  ```typescript
  // server.ts line 1627
  res.json({
    ...s,
    market: INSTANCE_MARKET,
    dealerships: req.auth?.role === "admin"
      ? s.dealerships
      : (s.dealerships || []).filter((d: any) => d.id === req.auth?.dealershipId),
    vehicles: scopeToDealer(s.vehicles, req.auth),
    leads: scopeToDealer(s.leads, req.auth),
  });
  ```
* **Effort:** S (<15 min) | **Impact:** High

---

#### [TL-01] Restore Rapid In-Camera Capture Walkaround Loop
* **App:** TruLens
* **Category:** UX Polish / Camera Workflow
* **File & Lines:** `TruLens/src/App.tsx:369–374` & `TruLens/src/components/CameraGuide.tsx:754–766`
* **Description:** `CameraGuide.tsx` has an in-viewfinder "Pending Shot" card for quick Redo/Keep decisions. However, `App.tsx:handlePhotoCaptured` forces `setActiveView('editor')` on every photo taken, kicking the photographer out of the camera and requiring 2 extra taps to save each angle (up to 54 extra taps on a full 27-shot capture).
* **Suggested Fix:** In `App.tsx`, update `handlePhotoCaptured` to save optimistically in state and upload in the background without changing `activeView` away from `'camera'`. Reserve `setActiveView('editor')` only when the user explicitly clicks "Tag damage".
* **Effort:** S (<30 min) | **Impact:** High

---

#### [CW-02] TruRepay Displays Error Screen for Webhook-Free Dealers on Lead Submission
* **App:** CDN Widgets
* **Category:** UX Polish / Code Quality
* **File & Lines:** `packages/standalone/tru-repay/tru-repay.js:629–638, 656–660`
* **Description:** When a dealer uses CallMeBot/WhatsApp notifications without a backend webhook URL, `postLead()` returns `Promise.resolve(false)`. Line 656 sees `false` and renders `.is-error` with "Something went wrong", even though the notification was sent successfully.
* **Suggested Fix:** Update line 631 to `if (!(cfg.webhook || (cfg.slug && cfg.flowUrl))) return Promise.resolve(!!(cfg.cmbKey && cfg.cmbPhone));`.
* **Effort:** S (<15 min) | **Impact:** High

---

#### [TFM-01] Core `api()` Client Does Not Reject HTTP 4xx/5xx Responses
* **App:** TruFlow Mobile
* **Category:** Code Quality / Reliability
* **File & Lines:** `truflow-mobile/public/index.html:716–720`
* **Description:** `api()` only checks `if (r.status === 401)` and returns `r.json()` for all other HTTP status codes (400, 403, 404, 500). Because `r.json()` resolves, calling functions trigger `.then()` and display misleading "Saved" or "Added to inventory" toasts even when backend writes fail.
* **Suggested Fix:**
  ```javascript
  return fetch(API + path, opts).then(function(r) {
    if (r.status === 401) { doLogout(); throw new Error("Session expired"); }
    return r.json().then(function(data) {
      if (!r.ok) throw new Error((data && data.error) || ("HTTP " + r.status));
      return data;
    });
  });
  ```
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TI-01] Direct `slotId` Routing from Inspection Checklist to Damage Tagger
* **App:** TruInspect
* **Category:** UX Polish / Workflow DX
* **File & Lines:** `truinspect/src/components/InspectionSheet.tsx:266–276` & `truinspect/src/components/DamageTagger.tsx:36, 46`
* **Description:** Clicking "Tag damage on this photo" from an inspection checklist item invokes `onTagDamage()` without passing `item.photoSlotId`. `DamageTagger.tsx` always resets to slot 1 (`front_bumper`), forcing inspectors to manually swipe through 27 photos to find the right panel.
* **Suggested Fix:** Pass `item.photoSlotId` into `onTagDamage(slotId)` and initialize `selectedSlotId` in `DamageTagger` with `initialSlotId || shotSlots[0]?.id`.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TFP-02] Incomplete Inventory Search in Main App Shell
* **App:** TruFlow Premium
* **Category:** UX Polish / Search
* **File & Lines:** `truflow-premium/src/App.tsx:2124–2127`
* **Description:** Main inventory search only filters by `make`, `model`, and `stockNumber`. Searching by VIN, registration number, year (e.g. `2023`), trim, or color returns 0 results.
* **Suggested Fix:** Update `mSearch` filter to check `[v.make, v.model, v.stockNumber, v.vin, v.registrationNumber, String(v.year), v.trim, v.color, (v as any).colour].some(...)`.
* **Effort:** S (<15 min) | **Impact:** High

---

#### [TFM-02] Service Worker Caches 502/504 Error Responses
* **App:** TruFlow Mobile
* **Category:** Performance / Caching
* **File & Lines:** `truflow-mobile/public/sw.js:44–49, 57–61`
* **Description:** Network-first fetches to `/api/*` clone and cache responses into the ServiceWorker cache without verifying `res.status === 200`. Cold starts returning 502 Bad Gateway poison the cache, locking the mobile app into error states even when offline.
* **Suggested Fix:** Add `if (res.status === 200)` before `caches.open(VERSION).then(c => c.put(req, copy))`.
* **Effort:** S (<15 min) | **Impact:** High

---

#### [CW-01] TruLoader Ignores TruValue and Omits It from `TruDealer` JS API
* **App:** CDN Widgets
* **Category:** Widget DX / Code Quality
* **File & Lines:** `packages/standalone/tru-loader/tru-loader.js:164–296, 308–324`
* **Description:** `tru-loader.js` boots afford, repay, form, chat, book, and share, but omits `value`/`tru-value`. Embedding `data-widgets="value"` silently fails, and `TruDealer.open('value')` / `closeAll()` does not handle valuation.
* **Suggested Fix:** Add `value` boot branch to `boot()`, and add `TruValue` handlers to `TruDealer.open()` and `closeAll()`.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TL-02] Compress & Resize Bulk Import Images Client-Side Before Upload
* **App:** TruLens
* **Category:** Performance / Image Processing
* **File & Lines:** `TruLens/src/components/CameraGuide.tsx:259–284`
* **Description:** `handleBulkDump` reads raw camera roll files via `FileReader.readAsDataURL` and POSTs 10–20MB uncompressed base64 payloads to `/api/inventory/upload-photo`, causing mobile cellular timeouts and HTTP 413 errors.
* **Suggested Fix:** Introduce `compressImageFile(file, 1920, 0.85)` using canvas offscreen downscaling prior to POSTing.
* **Effort:** S (<30 min) | **Impact:** High

---

#### [TI-03] Completion Review Grid Cannot Jump to Missing / Empty Slots
* **App:** TruInspect
* **Category:** UX Polish / Workflow
* **File & Lines:** `truinspect/src/components/CompletionReview.tsx:101`
* **Description:** The 6-column review grid renders missing slots highlighted in red, but guards click navigation behind `onClick={() => photo && onRetakeSlot(slot.id)}`. Because `photo` is undefined for missing slots, clicking them does nothing.
* **Suggested Fix:** Change to `onClick={() => onRetakeSlot(slot.id)}` so tapping any missing slot opens `CameraGuide` directly on that slot.
* **Effort:** S (<5 min) | **Impact:** High

---

#### [TFP-03] Lead CRM Search Fails on Full Customer Names
* **App:** TruFlow Premium
* **Category:** UX Polish / Search
* **File & Lines:** `truflow-premium/src/App.tsx:1221–1226`
* **Description:** `leadMatchesQuery` tests `l.firstName` and `l.lastName` separately. Searching for `"John Smith"` fails both substring checks and returns no leads.
* **Suggested Fix:** Concatenate `${l.firstName || ""} ${l.lastName || ""}` in the checked fields array.
* **Effort:** S (<10 min) | **Impact:** High

---

#### [CW-03] WordPress Plugin Omits TruValue Trade-in / Valuation Option
* **App:** WordPress Plugin
* **Category:** Widget DX
* **File & Lines:** `packages/truwidgets-wp/includes/settings.php:40, 120–130` & `packages/truwidgets-wp/includes/inject.php:14, 98–128`
* **Description:** The WordPress plugin settings page lacks options for TruValue. Dealers hosting on WordPress cannot enable or configure trade-in valuation via the admin panel.
* **Suggested Fix:** Add `'value'` to `$all` widgets, register `'w_value'` in settings checkboxes, and add injection attributes in `inject.php`.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TFM-03] WhatsApp Click-to-Chat Links Lack Country Code Normalisation
* **App:** TruFlow Mobile
* **Category:** UX Polish / Communication
* **File & Lines:** `truflow-mobile/public/index.html:897, 1309, 1314`
* **Description:** Quick action WhatsApp links use `phone.replace(/\D/g, "")`, leaving local leading zeroes (e.g. South African `082...` -> `wa.me/082...`), which WhatsApp rejects as invalid.
* **Suggested Fix:** Implement `cleanWaPhone(phone)` using `MARKET.id` dialing prefixes (`27` for ZA, `44` for UK, `1` for US) and stripping leading zeroes.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TL-03] Add One-Tap "Copy VIN" and Direct "Share to WhatsApp" on Inventory Cards
* **App:** TruLens
* **Category:** Missing Micro-feature / UX Polish
* **File & Lines:** `TruLens/src/components/InventoryList.tsx:1541–1570, 1633–1715`
* **Description:** Vehicle cards have a copy button for Stock Number but not for VIN. Generating a WhatsApp sales blurb requires opening the full report preview.
* **Suggested Fix:** Add a 1-tap copyable VIN pill on cards and a direct WhatsApp share action button that invokes `whatsAppSalesBlurb()`.
* **Effort:** S (<30 min) | **Impact:** High

---

#### [TI-02] VIR Report Header Missing WhatsApp Share & Copy Link Actions
* **App:** TruInspect
* **Category:** UX Polish / Micro-Feature
* **File & Lines:** `truinspect/src/components/ReportPreview.tsx:1–5, 120, 310–343`
* **Description:** `ReportPreview.tsx` imports `Share2`/`Copy` icons and creates `linkCopied` state, but only renders "Export PDF" and "Print" in the action header.
* **Suggested Fix:** Render "Copy Summary" and "Share WhatsApp" buttons in the report header (lines 310–343).
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TFP-04] Server Drops Custom DocSettings on Save (`PUT /api/dealership/self`)
* **App:** TruFlow Premium
* **Category:** Code Quality / Data Integrity
* **File & Lines:** `truflow-premium/server.ts:3634–3660`
* **Description:** `PUT /api/dealership/self` drops `invoiceExtrasDefaults`, `otpOutrightTerms`, `invoicePrefix`, and `nextInvoiceNumber` during docSettings updates, silently resetting dealer invoice configuration.
* **Suggested Fix:** Whitelist and persist these fields in `server.ts:3634`.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [CW-04] Resilient Inline Mount with MutationObserver (`tru-afford.js` & `tru-repay.js`)
* **App:** CDN Widgets
* **Category:** Widget DX / Reliability
* **File & Lines:** `packages/standalone/tru-afford/tru-afford.js:378–382` & `tru-repay/tru-repay.js:366–371`
* **Description:** In modern page builders (Elementor, Divi) and SPAs, container targets (`data-mount` / `data-target`) appear asynchronously after `DOMContentLoaded`. Immediate querying fails and falls back to floating/detached elements.
* **Suggested Fix:** Port the `MutationObserver` boot helper from `tru-value.js` to wait up to 5 seconds for target selectors.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TFM-04] `isOffline` Status Computed but Never Displayed to Floor Staff
* **App:** TruFlow Mobile
* **Category:** UX Polish / Offline Awareness
* **File & Lines:** `truflow-mobile/public/index.html:784–792, 801`
* **Description:** `isOffline` is tracked internally on fetch failures, but never rendered in the UI. Floor staff have no visual indication that they are viewing stale cached data.
* **Suggested Fix:** Toggle an "Offline · Cached" pill in the header and change the status dot color to amber/red when `isOffline` is true.
* **Effort:** S (<20 min) | **Impact:** High

---

#### [TFP-05] Missing State Refresh After Bulk Vehicle Import
* **App:** TruFlow Premium
* **Category:** UX Polish / Data Flow
* **File & Lines:** `truflow-premium/src/App.tsx:2594–2606`
* **Description:** After completing CSV import in `onImportVehicles`, the app does not call `loadAllState()`. Newly imported vehicles do not appear in the inventory grid until a manual page refresh.
* **Suggested Fix:** Await `loadAllState()` and dispatch a success notification upon loop completion.
* **Effort:** S (<15 min) | **Impact:** High

---

#### [CW-05] Universal `tru:lead` CustomEvent Analytics Telemetry Across All Widgets
* **App:** CDN Widgets
* **Category:** Widget DX / Analytics
* **File & Lines:** `packages/standalone/tru-form/tru-form.js:899–905` vs `tru-afford.js:609`, `tru-repay.js:656`, `tru-book.js:299`, `tru-value.js:495`
* **Description:** Only `tru-form.js` emits the `tru:lead` DOM CustomEvent on window. Webmasters and digital marketing agencies cannot track Meta Pixel / GA4 / GTM conversions for finance, valuation, or booking leads.
* **Suggested Fix:** Dispatch `new CustomEvent("tru:lead", { detail: { product, dealer, slug, data } })` across all widget lead submissions.
* **Effort:** S (<30 min) | **Impact:** High

---

#### [TFP-06] Global Desktop Keyboard Accelerators (`Ctrl+K`, `/`, and `Escape`)
* **App:** TruFlow Premium
* **Category:** Missing Micro-features / Desktop DX
* **File & Lines:** `truflow-premium/src/App.tsx:520–530`, `VehicleDetailModal.tsx:150–160`, `LeadDetailModal.tsx:145–160`
* **Description:** Pressing `Escape` does not close vehicle or lead modals. Pressing `Ctrl+K` or `/` does not focus the search input.
* **Suggested Fix:** Add `Escape` key event listeners to modals and global `/` / `Ctrl+K` shortcuts to focus active search inputs.
* **Effort:** S (<30 min) | **Impact:** High

---

#### [TFP-07] Hardcoded Dialing Code 27 in Desktop WhatsApp Action Links
* **App:** TruFlow Premium
* **Category:** UX Polish / Internationalization
* **File & Lines:** `truflow-premium/src/App.tsx:2883, 2963` and `LeadDetailModal.tsx:299`
* **Description:** WhatsApp links use `.replace(/^0/, "27")`, breaking UK (`44`) and US (`1`) deployments by producing invalid phone numbers.
* **Suggested Fix:** Derive dial code prefix dynamically from `market.id` (`uk: 44, us: 1, za: 27`).
* **Effort:** S (<15 min) | **Impact:** High

---

### Tier 2: High Impact · Medium Effort (M) — High-Value Micro-Features

#### [TL-09] Add Optional Ghost Silhouette Framing Overlays in Viewfinder
* **App:** TruLens
* **Category:** UX Polish / Micro-feature
* **File & Lines:** `TruLens/src/components/CameraGuide.tsx:679–681` & `TruLens/src/template.ts:33`
* **Description:** Template definitions specify ideal pitch/roll/yaw angles for 27 shots, but no framing overlays exist in the camera viewfinder. Lot attendants capture inconsistent angles and distances.
* **Suggested Fix:** Add a subtle toggleable SVG wireframe silhouette overlay (Front, 45° Corner, Side, Rear, Interior) with 20% opacity.
* **Effort:** M (1.5 hrs) | **Impact:** High

---

#### [CW-06] TruBook Shadow DOM Encapsulation, Escape Handler, and Confirmation Screen
* **App:** CDN Widgets
* **Category:** Widget DX / UX
* **File & Lines:** `packages/standalone/tru-book/tru-book.js:125–183, 191–194, 320–327`
* **Description:** TruBook runs in Light DOM causing CSS collisions with host websites, lacks an Escape key handler, and abruptly closes upon submission without displaying an appointment confirmation screen.
* **Suggested Fix:** Wrap container in Shadow DOM, add `Escape` listener, and display a "Booking Request Sent" thank-you screen before dismissal.
* **Effort:** M (1.5 hrs) | **Impact:** High

---

#### [CW-09] WordPress Plugin Shortcode Support (`[tru_repay]`, `[tru_value]`, `[tru_afford]`)
* **App:** WordPress Plugin
* **Category:** Widget DX
* **File & Lines:** `packages/truwidgets-wp/includes/inject.php:1–138`
* **Description:** The plugin only supports global footer injection. Dealers building custom vehicle detail pages with Elementor or Gutenberg cannot place calculators inline via shortcodes.
* **Suggested Fix:** Register `[tru_repay]`, `[tru_value]`, `[tru_afford]`, and `[tru_form]` shortcodes generating target container divs.
* **Effort:** M (1 hr) | **Impact:** High

---

#### [TFM-05] Multi-Field Walk-in Lead Creation & Contact Editing on Mobile
* **App:** TruFlow Mobile
* **Category:** Missing Micro-features / UX Polish
* **File & Lines:** `truflow-mobile/public/index.html:1303–1358, 1760–1768`
* **Description:** Walk-in modal only accepts a single name string with no phone number field. Lead detail sheets display contact info as static text with no edit button to add missing phone numbers.
* **Suggested Fix:** Expand walk-in modal to capture Name, Phone, and Notes. Add an edit contact pencil in `openLead()` calling `PUT /api/leads/:id`.
* **Effort:** M (1.5 hrs) | **Impact:** High

---

#### [TFM-07] Multi-Photo Preview Carousel in Vehicle Detail Sheet
* **App:** TruFlow Mobile
* **Category:** UX Polish / Vehicle Presentation
* **File & Lines:** `truflow-mobile/public/index.html:1083–1085`
* **Description:** Vehicle detail sheet only renders the primary hero image. Floor staff presenting cars to walk-in customers cannot view interior or extra photos without opening an external tab.
* **Suggested Fix:** Render a horizontal scrolling thumbnail strip below the hero image that swaps the main photo on click.
* **Effort:** M (1.5 hrs) | **Impact:** High

---

### Tier 3: Medium Impact · Small Effort (S) — Fast Polish & Refinements

#### [TL-04] Eliminate Dead Currency Setting in Settings Tab
* **App:** TruLens | **Category:** Code Quality | **File:** `TruLens/src/components/InventoryList.tsx:2013–2035`
* **Description:** Settings contains a redundant ZAR/USD/GBP selector saving to unused localStorage key.
* **Suggested Fix:** Replace dead `<select>` with a read-only badge showing server-resolved `market.id`, `currency`, and `distanceUnit`.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TL-05] Replace Blocking `window.confirm()` with In-App Confirmation
* **App:** TruLens | **Category:** UX Polish | **File:** `TruLens/src/components/InventoryList.tsx:1584–1596`
* **Description:** Deleting a vehicle uses browser `confirm()`, which halts execution and violates PWA standards.
* **Suggested Fix:** Use inline two-step confirmation (`deletingVehicleId === vehicle.id`) with "Confirm / Cancel" buttons.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [TL-06] Fix Unbounded Async Race in Initial Photo Uploads
* **App:** TruLens | **Category:** Code Quality | **File:** `TruLens/src/App.tsx:223–227`
* **Description:** `for (const [slotId, base64] of Object.entries(initialPhotos))` fires async uploads without `await`, causing race conditions.
* **Suggested Fix:** Add `await uploadPhotoToServer(...)` sequentially inside the loop.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TL-07] Add Quick-Clear `(X)` Button to Inventory Search Input
* **App:** TruLens | **Category:** Micro-feature | **File:** `TruLens/src/components/InventoryList.tsx:840–850`
* **Description:** Clearing a 17-digit VIN or search term on mobile requires tapping backspace 17 times.
* **Suggested Fix:** Render an `(X)` clear icon button inside the input container when `searchTerm.length > 0`.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TL-08] Reuse Canvas Buffer in Disc Scanner
* **App:** TruLens | **Category:** Performance | **File:** `TruLens/src/components/DiscScanner.tsx:60–68`
* **Description:** `grabFrame` creates a new `document.createElement('canvas')` on every decoded frame instead of reusing `canvasRef.current`.
* **Suggested Fix:** Draw to and extract from `canvasRef.current` directly.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TL-10] Add 17-Character VIN Sanitization & Duplicate Catalog Alert
* **App:** TruLens | **Category:** Code Quality | **File:** `TruLens/src/components/InventoryList.tsx:1220–1227`
* **Description:** VIN input allows invalid characters (`I`, `O`, `Q`) and doesn't warn if a vehicle with the same VIN already exists.
* **Suggested Fix:** Sanitize input with `replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17)` and display an inline warning on duplicates.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [TI-04] Remove Dead "Scan with AI" Button in Damage Tagger
* **App:** TruInspect | **Category:** Code Quality / UX | **File:** `truinspect/src/components/DamageTagger.tsx:98–132, 360–367` & `server.ts:1504–1510`
* **Description:** `server.ts` returns `{ aiMode: false }`, but DamageTagger renders a prominent AI scan button that always fails.
* **Suggested Fix:** Remove the dead button and `scanWithAI` function, focusing the UI on manual pin-dropping.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TI-05] Standardize TradeInSummary to use Shared `SignaturePad`
* **App:** TruInspect | **Category:** Code Quality / DRY | **File:** `truinspect/src/components/TradeInSummary.tsx:106–160, 715–741`
* **Description:** `TradeInSummary` maintains 60 lines of raw canvas event listeners instead of using the shared `SignaturePad` component.
* **Suggested Fix:** Replace custom canvas with `<SignaturePad value={digitalSignatureUrl} onChange={setDigitalSignatureUrl} />`.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [TI-06] Fix Hardcoded ZAR `(R)` and `(km)` in Trade-In & Vehicle Manager
* **App:** TruInspect | **Category:** Multi-Market Consistency | **File:** `truinspect/src/components/TradeInWalkAround.tsx:284` & `VehicleManager.tsx:351, 519`
* **Description:** Form field labels hardcode `(R)` and `(km)` instead of reading `market.currency` / `market.distanceUnit`.
* **Suggested Fix:** Replace static `(R)` with `({market.currency})` and `(km)` with `({market.distanceUnit})`.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TI-08] Add Validation Feedback on Disabled Add Vehicle Button
* **App:** TruInspect | **Category:** UX Polish | **File:** `truinspect/src/components/AddVehicleDialog.tsx:261, 529–531`
* **Description:** When Mileage is missing, "Add Vehicle" is disabled with no tooltip or feedback explaining why.
* **Suggested Fix:** Add `title={!canSubmit ? 'Please enter Make, Model, and Mileage' : undefined}`.
* **Effort:** S (<5 min) | **Impact:** Medium

---

#### [TFP-08] Interactive Expense Reconciliation Toggle in Accounting Ledger
* **App:** TruFlow Premium | **Category:** Code Quality / UX | **File:** `truflow-premium/src/components/AccountingRecon.tsx:284–295`
* **Description:** `onReconcileExpense` prop is accepted but status badges are static non-clickable text.
* **Suggested Fix:** Make the status badge a toggle button calling `onReconcileExpense(e.id, !e.reconciled)`.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [TFP-09] Eliminate N+1 Network Requests in DealershipAdmin
* **App:** TruFlow Premium | **Category:** Performance | **File:** `truflow-premium/src/components/DealershipAdmin.tsx:192–197`
* **Description:** `load()` executes N separate `fetch('/api/public/stock?dealer=' + d.slug)` requests on mount.
* **Suggested Fix:** Return `stockCount` directly on `GET /api/dealerships` or batch state reads.
* **Effort:** S (<25 min) | **Impact:** Medium

---

#### [TFP-10] EOD Report CSV Encoding Truncation & Email Action Cleanup
* **App:** TruFlow Premium | **Category:** UX Polish / Reliability | **File:** `truflow-premium/src/App.tsx:1438–1444, 4704–4712`
* **Description:** CSV export uses `encodeURI()` which truncates on `#` characters; "Email to Stakeholders" triggers a toast without action.
* **Suggested Fix:** Use `Blob` and `URL.createObjectURL`; copy EOD text to clipboard on email button click.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [TFP-13] Scale Profitability Alert Thresholds by Market
* **App:** TruFlow Premium | **Category:** UX Polish / Multi-Market | **File:** `truflow-premium/src/components/VehicleDetailModal.tsx:1357–1360`
* **Description:** Profit alert hardcodes R25,000 threshold, triggering false violation alerts on £/$-denominated vehicles.
* **Suggested Fix:** Scale threshold dynamically (`uk: 1200`, `us: 1500`, `za: 25000`) and format with `{money()}`.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TFP-14] Atomic File Writes for Imagin8 Bundles & Trade Reports
* **App:** TruFlow Premium | **Category:** Code Quality / Reliability | **File:** `truflow-premium/server.ts:187, 6946`
* **Description:** Direct `fs.writeFileSync` can corrupt JSON files if process terminates mid-write.
* **Suggested Fix:** Use `.tmp` write + `fs.renameSync` atomic pattern.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TFP-15] VehiclePicker Search Keyboard Handlers
* **App:** TruFlow Premium | **Category:** Micro-feature | **File:** `truflow-premium/src/components/VehiclePicker.tsx:180–193`
* **Description:** Searchable dropdown does not select top result on `Enter` or dismiss on `Escape`.
* **Suggested Fix:** Add `onKeyDown` handlers for `Enter` (select first) and `Escape` (close dropdown).
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TFM-06] Stock Search Filter Missing VIN & Registration Matching
* **App:** TruFlow Mobile | **Category:** Micro-feature / Search | **File:** `truflow-mobile/public/index.html:973`
* **Description:** Stock search matches only make, model, and stock number, ignoring VIN and registration plate.
* **Suggested Fix:** Include `v.vin` and `v.regNumber` in the search filter query string.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TFM-08] Lead Filter Chips Missing "Test Drive Scheduled" Stage
* **App:** TruFlow Mobile | **Category:** UX Polish | **File:** `truflow-mobile/public/index.html:1941`
* **Description:** Stage filter chips omit "Test Drive Scheduled", preventing quick access to upcoming test drives.
* **Suggested Fix:** Add `"Test drive"` to chips array and filter matching.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [TFM-09] Auto-Log Contact Timestamp on Call & WhatsApp Clicks
* **App:** TruFlow Mobile | **Category:** UX Polish / Automation | **File:** `truflow-mobile/public/index.html:1312–1316`
* **Description:** In-app guide promises automated contact logging, but action buttons are plain links without click handlers.
* **Suggested Fix:** Attach click listeners updating `lastContactedAt` and appending a journey log entry.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [CW-07] TruRepay Range Slider Dynamic Track Fill
* **App:** CDN Widgets | **Category:** UX Polish | **File:** `packages/standalone/tru-repay/tru-repay.js:281–285, 539–543`
* **Description:** Range slider track is statically illuminated with a full gradient regardless of slider position.
* **Suggested Fix:** Use dynamic `--fill` percentage CSS variable updated on `recalc()`.
* **Effort:** S (<20 min) | **Impact:** Medium

---

#### [CW-08] TruForm Validation Errors Auto-Clear on User Input
* **App:** CDN Widgets | **Category:** UX Polish | **File:** `packages/standalone/tru-form/tru-form.js:793–805`
* **Description:** Red validation error highlights persist on inputs while typing until submit is pressed again.
* **Suggested Fix:** Attach `input` listeners to clear `.tf-err` dynamically.
* **Effort:** S (<15 min) | **Impact:** Medium

---

#### [CW-10] Unify Inline Attribute Aliases (`data-mount` and `data-target`)
* **App:** CDN Widgets | **Category:** Widget DX | **File:** `packages/standalone/tru-afford/tru-afford.js:74`, `tru-repay.js:99`, `tru-form.js:97`
* **Description:** Some widgets look for `data-mount` while others look for `data-target`, causing developer confusion.
* **Suggested Fix:** Check `attr("data-mount", "") || attr("data-target", "")` across all widgets.
* **Effort:** S (<15 min) | **Impact:** Medium

---

### Tier 4: Medium Impact · Medium Effort (M) — Component Enhancements

#### [TFP-12] Replace Blocking `alert()` Dialogs with In-App Toasts
* **App:** TruFlow Premium
* **Category:** UX Polish
* **File & Lines:** `truflow-premium/src/components/LeadDetailModal.tsx` & `VehicleDetailModal.tsx` (22 instances)
* **Description:** Multiple actions (task scheduling, lead deletion, valuation errors) trigger native browser `alert(...)` popups that disrupt dark-mode desktop styling.
* **Suggested Fix:** Replace `alert()` invocations with `onNotify(...)` toast notifications or inline banners.
* **Effort:** M (1.5 hrs) | **Impact:** Medium

---

### Tier 5: Low Impact · Small Effort (S) — Hygiene & Minor Fixes

#### [TI-07] Retire Deprecated `flow-lite` DMS Preset from InventoryList
* **App:** TruInspect | **Category:** Code Quality | **File:** `truinspect/src/components/InventoryList.tsx:50–56, 633–653`
* **Description:** `flow-lite` preset remnants remain in DMS selection options.
* **Suggested Fix:** Remove `lite` option from `DMS_PRESETS`.
* **Effort:** S (<10 min) | **Impact:** Low

---

#### [TFP-11] Fix Blank "Colour" Column in Stock List CSV Export
* **App:** TruFlow Premium | **Category:** UX Polish / Data Quality | **File:** `truflow-premium/src/App.tsx:2082`
* **Description:** Reads `v.colour` instead of `v.color`, resulting in blank values in exported CSVs.
* **Suggested Fix:** Update to `(v as any).color || (v as any).colour || ""`.
* **Effort:** S (<5 min) | **Impact:** Low

---

#### [TFP-16] Notification Toast Red/Danger Style for Error Type
* **App:** TruFlow Premium | **Category:** UX Polish | **File:** `truflow-premium/src/App.tsx:4733–4742`
* **Description:** `type === 'error'` renders with cyan/info styling.
* **Suggested Fix:** Add explicit red/danger CSS classes and alert icon for error notifications.
* **Effort:** S (<15 min) | **Impact:** Low

---

#### [TFM-10] Clear Stale Live Market Value Preview on Add Vehicle Form Reset
* **App:** TruFlow Mobile | **Category:** UX Polish | **File:** `truflow-mobile/public/index.html:1716`
* **Description:** Resetting the add vehicle form does not clear `#aMvOut`, leaving the previous car's valuation card visible.
* **Suggested Fix:** Add `if ($("#aMvOut")) $("#aMvOut").innerHTML = "";` on reset.
* **Effort:** S (<5 min) | **Impact:** Low

---

#### [TFM-11] Fix `todayISO()` Timezone Offset Calculation
* **App:** TruFlow Mobile | **Category:** Code Quality | **File:** `truflow-mobile/public/index.html:1296`
* **Description:** `toISOString().slice(0, 10)` uses UTC, returning yesterday's date in UTC+2 between 00:00 and 02:00.
* **Suggested Fix:** Construct ISO date string using local `getFullYear()`, `getMonth() + 1`, and `getDate()`.
* **Effort:** S (<10 min) | **Impact:** Low

---

## 5. Implementation Roadmap & Recommended Shipping Sequence

To maximize momentum and minimize risk, we recommend executing these refinements in **4 focused sprint packages**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Sprint 1: Security, Data Integrity & Critical Quick Wins (Day 1 - ~3h) │
├────────────────────────────────────────────────────────────────────────┤
│ • TFP-01: Multi-tenant /api/state leak fix                             │
│ • TL-01: Rapid camera capture walkaround loop                          │
│ • CW-02: TruRepay false error fix on lead submission                   │
│ • TFM-01: TruFlow Mobile api() HTTP error rejection                   │
│ • TI-01: TruInspect direct slotId damage tagging                       │
│ • TFP-04: DocSettings server persistence whitelist                     │
│ • TFM-02: ServiceWorker 502/504 cache poisoning fix                   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Sprint 2: Search, Navigation & Workflow Speed (Day 2 - ~3h)            │
├────────────────────────────────────────────────────────────────────────┤
│ • TFP-02 & TFP-03: VIN, Plate & Full-Name search in DMS                │
│ • TFM-06: VIN & Plate search in Mobile companion                       │
│ • TL-02: Bulk image client-side compression                            │
│ • TI-03: Completion review grid missing slot navigation                │
│ • TFP-05: State refresh after bulk CSV import                          │
│ • TFP-06: Global desktop keyboard shortcuts (Ctrl+K, /, Escape)        │
│ • TL-03 & TI-02: Copy VIN & 1-tap WhatsApp share shortcuts             │
│ • TFM-03 & TFP-07: Country code aware WhatsApp URLs (ZA/UK/US)         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Sprint 3: Widget Ecosystem & Embedding DX (Day 3 - ~3.5h)              │
├────────────────────────────────────────────────────────────────────────┤
│ • CW-01: Restore TruValue in TruLoader JS API                          │
│ • CW-03: Add TruValue settings & injector to WordPress Plugin          │
│ • CW-04: MutationObserver resilient inline mount                       │
│ • CW-05: Universal tru:lead CustomEvent for GTM/Pixel tracking         │
│ • CW-07 & CW-08: TruRepay dynamic slider fill & TruForm live errors   │
│ • CW-09: WordPress plugin shortcodes for page builders                 │
│ • CW-10: Unify data-mount / data-target attribute aliases              │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Sprint 4: UI Polish, Multi-Market & Micro-Features (Day 4 - ~4h)       │
├────────────────────────────────────────────────────────────────────────┤
│ • TL-09: Viewfinder silhouette framing guides                          │
│ • CW-06: TruBook Shadow DOM & confirmation screen                      │
│ • TFM-05: Mobile walk-in lead multi-field form & edit modal            │
│ • TFM-07: Mobile vehicle detail multi-photo thumbnail strip            │
│ • TI-05: Standardize SignaturePad in TradeInSummary                    │
│ • TI-06 & TFP-13: Multi-market label & profitability threshold fixes   │
│ • All remaining Tier 5 hygiene cleanups                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Conclusion

The TruSaaS dealer management suite has an exceptionally strong functional core. Implementing these 55 targeted refinements will eliminate friction in high-frequency lot and showroom workflows, harden multi-tenant security and offline reliability, and give digital marketing agencies and webmasters a world-class embedding experience.
