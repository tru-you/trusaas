# Handoff Report — TruLens Code Audit

**Date**: 2026-09-02T11:45:00Z  
**Author**: TruLens Explorer (`trulens_explorer`)  
**Target**: Orchestrator / Lead Architect  
**Status**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

Direct code inspections and pattern matches across `TruLens/`:

1. **`TruLens/src/App.tsx:369-374` & `TruLens/src/components/CameraGuide.tsx:754-766`**:
   - In `CameraGuide.tsx:754-766`, tapping "Keep & next" calls `onPhotoCaptured(s.slotId, s.base64, s.report)`.
   - In `App.tsx:369-374`, `handlePhotoCaptured` handles `onPhotoCaptured` by executing:
     ```tsx
     const handlePhotoCaptured = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
       setActiveSlotId(slotId);
       setActiveImageSrc(base64Image);
       setActiveQualityReport(qualityReport);
       setActiveView('editor');
     };
     ```
   - In `ImageEditor.tsx:147-158`, the save button is disabled with label `"Rate it first"` until the user selects a condition rating (`rating`), even though `CameraGuide` already confirmed the photo.

2. **`TruLens/src/components/CameraGuide.tsx:259-284`**:
   - `handleBulkDump` loads files directly via `FileReader.readAsDataURL` without dimension downscaling or quality compression, POSTing multi-megabyte base64 strings directly to `/api/inventory/upload-photo`.
   - In contrast, canvas captures in `CameraGuide.tsx:375-380` constrain dimensions using `fitDims(..., maxEdge=1920)` and `canvas.toDataURL('image/jpeg', 0.85)`.

3. **`TruLens/src/components/InventoryList.tsx:256-258, 2013-2035, 2084`**:
   - `InventoryList.tsx` contains state `const [currency, setCurrency] = React.useState(() => localStorage.getItem('trulens_currency') || 'ZAR')` and a settings `<select>` for ZAR/USD/GBP.
   - `AGENTS.md` establishes that currency is strictly instance/market-driven via `MarketContext`. `trulens_currency` is never consumed by price formatting functions anywhere in the codebase.

4. **`TruLens/src/components/InventoryList.tsx:1541-1570`**:
   - Vehicle cards provide one-tap copy for `vehicle.stockNumber` but lack a copy button for `vehicle.vin`.
   - WhatsApp sales blurbs can only be copied from `ReportPreview.tsx:208-214`, not directly from the inventory catalogue card.

5. **`TruLens/src/components/InventoryList.tsx:1584-1596`**:
   - Vehicle deletion uses native blocking `window.confirm(\`Remove \${vehicle.year} \${vehicle.make} from the catalogue?\`)`.

6. **`TruLens/src/App.tsx:223-227`**:
   - `handleAddVehicle` loops over `initialPhotos` calling `uploadPhotoToServer(newVehicle.id, slotId, base64, undefined as any)` without `await`, creating race conditions on `setVehicles`.

7. **`TruLens/src/components/DiscScanner.tsx:60-68`**:
   - `grabFrame` instantiates `document.createElement('canvas')` on every decoded frame instead of reusing `canvasRef.current`.

8. **`TruLens/src/components/CameraGuide.tsx:679-681`**:
   - Frame overlays are explicitly bypassed (`{/* No framing-guide overlay... */}`), despite `idealAngle` specs in `template.ts`.

---

## 2. Logic Chain

1. **Camera Flow Disruption**:
   - `CameraGuide` was refactored to support rapid walkaround capture via an in-viewfinder pending state.
   - Because `App.tsx` redirects `onPhotoCaptured` to `activeView = 'editor'`, the rapid loop is broken on every shot.
   - Restoring direct asynchronous background upload in `handlePhotoCaptured` recovers the intended 60-second walkaround speed.

2. **Mobile Data and Memory Optimization**:
   - High-resolution smartphone cameras produce 5–20MB images.
   - Passing uncompressed base64 in `handleBulkDump` wastes bandwidth and risks payload rejection.
   - Pre-compressing images to max 1920px at 0.85 quality client-side matches the live viewfinder capture pipeline and reduces payload size by ~80–90%.

3. **User Confusion & Dead Code Removal**:
   - Having a user-facing currency dropdown that doesn't affect prices creates support confusion.
   - Removing it and displaying the active server market adheres to the multi-market architecture in `AGENTS.md`.

4. **Dealer Friction Reduction**:
   - Adding 1-tap VIN copy and direct WhatsApp sharing from inventory cards eliminates repetitive screen navigation during sales workflows.

---

## 3. Caveats

- **Scope Boundary**: This audit investigated the TruLens client (`TruLens/src/`) and server routes (`TruLens/server.ts`). Shared packages (`packages/tru-ui-src`, `packages/imagin8.ts`) were reviewed for integration contracts but not modified.
- **Server Storage Compatibility**: Client-side image resizing in bulk upload produces standard JPEG data URLs which remain 100% compatible with `photoStore.ts:put()` on the server.

---

## 4. Conclusion

TruLens has a solid, resilient architecture (content-addressed `photoStore.ts`, PWA service worker with offline fallback, market localization). The 10 identified findings are contained, high-leverage refinements that resolve real friction for lot attendants and sales reps without requiring any architectural overhaul. 

All 10 findings are documented in detail in `.agents/trulens_explorer/report.md`.

---

## 5. Verification Method

To independently verify all observations and fixes:

1. **Verify Files and Code References**:
   ```bash
   rg -n "handlePhotoCaptured" TruLens/src/App.tsx
   rg -n "handleBulkDump" TruLens/src/components/CameraGuide.tsx
   rg -n "trulens_currency" TruLens/src/components/InventoryList.tsx
   rg -n "whatsAppSalesBlurb" TruLens/src/lib/readiness.ts
   ```

2. **Run Static Type Check & Lint**:
   ```bash
   cd TruLens && npm run lint
   ```

3. **Run Existing Test Suite**:
   ```bash
   cd TruLens && npm test
   ```
