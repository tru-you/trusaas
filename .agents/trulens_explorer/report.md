# TruLens Code Audit Report

**Audit Date**: 2026-09-02  
**Target Surface**: TruLens (`TruLens/` PWA Photo Studio)  
**Auditor**: TruLens Explorer  
**Integrity Mode**: Read-Only Analysis & Synthesis  

---

## Executive Summary

TruLens is the high-conversion mobile PWA photo studio for independent car dealerships. It bridges physical lot photography, live condition assessment, AI quality auditing, 360-degree TruOrbit spin generation, and automated DMS exports.

This deep audit evaluated TruLens across 4 core dimensions:
1. **UX Polish**: Viewfinder flow, walkaround speed, mobile touch responsiveness, dialogs, transitions.
2. **Performance**: Pre-upload image resizing, memory lifecycle, canvas allocation, stream teardown.
3. **Code Quality**: Dead configuration remnants, race conditions in async loops, validation gaps.
4. **Missing Micro-features**: Fast-action copy buttons, search UX, lot framing guides, WhatsApp sales blurbs.

### Findings Summary Matrix

| # | Finding Title | Category | Effort | Impact | Key File(s) |
|---|---|---|---|---|---|
| **TL-01** | Restore Rapid In-Camera Capture Walkaround Loop | UX Polish | **S** (<30m) | **High** | `src/App.tsx:369-374` |
| **TL-02** | Compress & Resize Bulk Import Images Client-Side | Performance | **S** (<30m) | **High** | `src/components/CameraGuide.tsx:259-284` |
| **TL-03** | One-Tap Copy for VIN & Direct WhatsApp Sales Share | Micro-feature | **S** (<30m) | **High** | `src/components/InventoryList.tsx:1541-1570` |
| **TL-04** | Eliminate Dead Currency Selector in Settings | Code Quality | **S** (<15m) | **Medium** | `src/components/InventoryList.tsx:256-258, 2013-2035` |
| **TL-05** | Replace Blocking `window.confirm()` with PWA Sheet | UX Polish | **S** (<30m) | **Medium** | `src/components/InventoryList.tsx:1584-1596` |
| **TL-06** | Fix Unbounded Async Race in Initial Photo Uploads | Code Quality | **S** (<20m) | **Medium** | `src/App.tsx:223-227` |
| **TL-07** | Search Input Quick-Clear `(X)` Button | Micro-feature | **S** (<15m) | **Medium** | `src/components/InventoryList.tsx:840-850` |
| **TL-08** | Reuse Canvas Buffer in Disc Scanner | Performance | **S** (<20m) | **Medium** | `src/components/DiscScanner.tsx:60-68` |
| **TL-09** | Optional Ghost Silhouette Framing Overlays | UX Polish | **M** (1-2h) | **High** | `src/components/CameraGuide.tsx:679-681` |
| **TL-10** | Add VIN Character Sanitization & Duplicate Alert | Code Quality | **S** (<30m) | **Medium** | `src/components/InventoryList.tsx:1220-1227` |

---

## Top Quick Wins (S-Effort, High-Impact)

1. **TL-01 (Restore Rapid In-Camera Walkaround Loop)**: Fix `App.tsx:369-374` so saving a captured photo does not force a transition to the full-screen `ImageEditor` modal. Lets lot photographers complete a full 10-shot core walkaround in under 60 seconds without interruption.
2. **TL-02 (Client-Side Bulk Image Compression)**: Pre-resize photos in `CameraGuide.tsx:handleBulkDump` to max 1920px at 0.85 JPEG before POSTing, preventing mobile OOMs and massive 10-20MB payloads over cellular data.
3. **TL-03 (One-Tap Copy VIN & WhatsApp Quick Share)**: Add immediate VIN copy and 1-tap WhatsApp blurb generation on vehicle cards in `InventoryList.tsx`, saving sales reps multiple navigation steps per lead inquiry.

---

## Detailed Audit Findings

---

### Finding TL-01: Restore Rapid In-Camera Capture Walkaround Loop

- **App**: TruLens
- **Category**: UX Polish / Camera Capture Workflow
- **File(s)**: `TruLens/src/App.tsx:369-374` & `TruLens/src/components/CameraGuide.tsx:754-766`
- **Effort**: **S** (< 30 min)
- **Impact**: **High**

#### Description
`CameraGuide.tsx` was carefully designed with an in-viewfinder "Pending Shot" card (lines 743–780) featuring instant **Redo** and **Keep & next** buttons, plus an optional "Tag damage" action (`onEditRequested`). The explicit architectural design (documented in lines 21–23 and 500–528) is:
> `// A just-taken shot awaiting Redo / Keep. This is the whole point: shoot, glance, keep or redo — no forced save-and-edit between every angle.`

However, in `App.tsx:369-374`, `handlePhotoCaptured` (passed as `onPhotoCaptured`) forces a view change to `'editor'`:
```tsx
const handlePhotoCaptured = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
  setActiveSlotId(slotId);
  setActiveImageSrc(base64Image);
  setActiveQualityReport(qualityReport);
  setActiveView('editor'); // <-- FORCIBLY EJECTS SHOOTER FROM CAMERA VIEW
};
```
When redirected to `ImageEditor.tsx`, the photographer is trapped: the save button defaults to disabled with label `"Rate it first"` until they manually click "OK"/"Note"/"Damage", requiring 2 extra taps and 2 full-screen transitions *per angle* (up to 54 extra taps on a full 27-shot capture).

#### Suggested Fix
Update `App.tsx` so `handlePhotoCaptured` updates the vehicle photos state and calls `uploadPhotoToServer` asynchronously without navigating away from `'camera'`. Reserve `setActiveView('editor')` exclusively for `handleEditSlot` when the user explicitly requests damage tagging:

```tsx
// In TruLens/src/App.tsx:
const handlePhotoCaptured = async (slotId: string, base64Image: string, qualityReport: QualityReport) => {
  if (!activeVehicleId) return;
  // Optimistic local update so CameraGuide auto-advances in walkaround order
  setVehicles(prev => prev.map(v => {
    if (v.id !== activeVehicleId) return v;
    return {
      ...v,
      photos: { ...(v.photos || {}), [slotId]: base64Image },
      quality: { ...(v.quality || {}), [slotId]: qualityReport },
    };
  }));
  // Upload in background
  await uploadPhotoToServer(activeVehicleId, slotId, base64Image, qualityReport);
};
```

---

### Finding TL-02: Compress & Resize Bulk Import Images Client-Side Before Upload

- **App**: TruLens
- **Category**: Performance / Image Processing
- **File(s)**: `TruLens/src/components/CameraGuide.tsx:259-284`
- **Effort**: **S** (< 30 min)
- **Impact**: **High**

#### Description
When capturing via viewfinder, `finalizeCapture` uses `fitDims(..., maxEdge=1920)` and canvas `.toDataURL('image/jpeg', 0.85)` to constrain payload sizes.
However, in `CameraGuide.tsx:handleBulkDump` (lines 259–284), selected files from phone storage or camera roll are read raw via `FileReader.readAsDataURL(f)` and immediately POSTed to `/api/inventory/upload-photo`.
On modern smartphones (iPhone 14/15/16, Samsung Galaxy S23/S24), photos are 12MP–48MP (5MB–20MB each). Reading multiple uncompressed photos into base64 and transmitting them over cellular connections causes request timeouts, HTTP 413 Payload Too Large errors, and UI freezing.

#### Suggested Fix
Implement a helper `compressImageFile(file: File, maxEdge = 1920, quality = 0.85)` in `CameraGuide.tsx` using an `Image` and offscreen `<canvas>` before dispatching the POST request:

```tsx
// In TruLens/src/components/CameraGuide.tsx:
const compressImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { w, h } = fitDims(img.naturalWidth, img.naturalHeight, 1920);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(String(e.target?.result)); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = String(e.target?.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// In handleBulkDump:
const base64 = await compressImageFile(files[i]);
```

---

### Finding TL-03: Add One-Tap "Copy VIN" and Direct "Share to WhatsApp" on Inventory Cards

- **App**: TruLens
- **Category**: Missing Micro-feature / UX Polish
- **File(s)**: `TruLens/src/components/InventoryList.tsx:1541-1570, 1633-1715`
- **Effort**: **S** (< 30 min)
- **Impact**: **High**

#### Description
In `InventoryList.tsx`, vehicle cards provide a convenient copy button for the Stock number (`copyStockNumber`). However:
1. **No Copy VIN Button**: Dealers and floor managers frequently need the VIN on mobile to check parts catalogues, insurance, or external DMS tools. Currently they must open the Edit modal, select the input, and copy manually.
2. **WhatsApp Sharing Gated in Report Preview**: Generating a WhatsApp sales blurb requires opening the vehicle card → tapping "Report" → waiting for the full report to mount → tapping "WhatsApp".
`whatsAppSalesBlurb()` already exists in `src/lib/readiness.ts` and can be triggered directly from the vehicle card.

#### Suggested Fix
1. Add a copyable VIN pill next to the Stock number pill on every vehicle card:
```tsx
{vehicle.vin && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      copyStockNumber(vehicle.vin, `vin-${vehicle.id}`);
    }}
    className="text-[12px] font-mono text-[rgba(232,234,230,0.42)] hover:text-[rgba(232,234,230,0.72)] flex items-center gap-1 min-h-[32px] px-2"
    title="Copy VIN"
  >
    VIN: {vehicle.vin.slice(0, 7)}…{vehicle.vin.slice(-4)}
    {copiedStockId === `vin-${vehicle.id}` ? <Check size={12} className="text-[#4FE3DC]" /> : <Copy size={12} />}
  </button>
)}
```
2. Add a quick WhatsApp share button in the card actions grid (or 4th slot) that copies the formatted sales blurb and launches WhatsApp directly (`whatsapp://send?text=...`).

---

### Finding TL-04: Eliminate Dead Currency Setting in Settings Tab

- **App**: TruLens
- **Category**: Code Quality / Consistency
- **File(s)**: `TruLens/src/components/InventoryList.tsx:256-258, 2013-2035, 2084`
- **Effort**: **S** (< 15 min)
- **Impact**: **Medium**

#### Description
In `AGENTS.md` (UK-first market expansion milestone), it is documented that TruLens currency and distance units are strictly server- and market-scoped via `MarketContext` (`useMarket()` and `useMoney()`).
However, `InventoryList.tsx` still contains a redundant "Regional & Localization" settings panel (lines 2013–2035) with a `<select>` allowing users to pick ZAR, USD, or GBP, which saves to `localStorage.setItem('trulens_currency', currency)`.
This setting is completely ignored by all valuation cards, vehicle prices, and reports. Changing this dropdown gives the false impression of an active preference while having zero effect.

#### Suggested Fix
Replace the dead `<select>` input with a clean read-only badge indicating the active server-configured market:
```tsx
{/* Regional & Localization */}
<div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
  <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
    <span className="text-[13px] font-bold text-neutral-400">Regional & Market Active</span>
    <span className="text-[11px] font-mono text-[#4FE3DC] px-2 py-0.5 rounded bg-[#4FE3DC]/10 border border-[#4FE3DC]/30 uppercase">
      {market.id}
    </span>
  </div>
  <div className="p-4 space-y-2">
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-neutral-400">Currency</span>
      <span className="font-semibold text-neutral-200">{market.currency} ({market.currencySymbol})</span>
    </div>
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-neutral-400">Odometer Unit</span>
      <span className="font-semibold text-neutral-200">{market.distanceUnit}</span>
    </div>
  </div>
</div>
```

---

### Finding TL-05: Replace Blocking Browser `confirm()` with In-App Confirmation

- **App**: TruLens
- **Category**: UX Polish / Mobile Responsiveness
- **File(s)**: `TruLens/src/components/InventoryList.tsx:1584-1596`
- **Effort**: **S** (< 30 min)
- **Impact**: **Medium**

#### Description
In `InventoryList.tsx` line 1587, deleting a vehicle executes:
```tsx
if (confirm(`Remove ${vehicle.year} ${vehicle.make} from the catalogue?`)) {
  onDeleteVehicle(vehicle.id);
}
```
Native `window.confirm()` halts UI rendering, violates PWA styling standards, and can be suppressed by mobile browsers if tapped repeatedly. Because the trash button sits right next to the edit pencil in the top-right header of each card, an accidental tap immediately triggers this modal.

#### Suggested Fix
Implement an inline two-step confirmation state (e.g. `deletingId === vehicle.id`) or a glassmorphic bottom sheet asking "Remove {year} {make}? [Cancel] [Delete Vehicle]":
```tsx
{deletingVehicleId === vehicle.id ? (
  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onDeleteVehicle(vehicle.id); setDeletingVehicleId(null); }}
      className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[12px] font-bold"
    >
      Confirm
    </button>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setDeletingVehicleId(null); }}
      className="px-2 py-1.5 rounded-lg text-neutral-400 text-[12px]"
    >
      Cancel
    </button>
  </div>
) : (
  <button
    onClick={(e) => { e.stopPropagation(); setDeletingVehicleId(vehicle.id); }}
    className="flex items-center justify-center h-11 w-11 rounded-[12px] text-[rgba(232,234,230,0.55)] hover:text-[#C07676]"
    title="Delete vehicle"
  >
    <Trash2 size={16} />
  </button>
)}
```

---

### Finding TL-06: Fix Unbounded Async Race in Initial Photo Uploads on Vehicle Creation

- **App**: TruLens
- **Category**: Code Quality / Error Handling
- **File(s)**: `TruLens/src/App.tsx:223-227`
- **Effort**: **S** (< 20 min)
- **Impact**: **Medium**

#### Description
In `App.tsx:handleAddVehicle`:
```tsx
if (initialPhotos) {
  for (const [slotId, base64] of Object.entries(initialPhotos)) {
    uploadPhotoToServer(newVehicle.id, slotId, base64, undefined as any);
  }
}
```
`uploadPhotoToServer` is an `async` function that modifies `setVehicles` and `setSyncStatus`. Firing concurrent promises inside a `for` loop without `await` creates unhandled promise rejections and race conditions where multiple requests compete to overwrite the local `vehicles` state. It also passes `undefined as any` for `qualityReport`.

#### Suggested Fix
Await photo uploads sequentially or use `Promise.all` with properly structured payloads:
```tsx
if (initialPhotos) {
  for (const [slotId, base64] of Object.entries(initialPhotos)) {
    await uploadPhotoToServer(newVehicle.id, slotId, base64);
  }
}
```

---

### Finding TL-07: Add Quick-Clear `(X)` Button to Inventory Search Input

- **App**: TruLens
- **Category**: Missing Micro-feature / UX Polish
- **File(s)**: `TruLens/src/components/InventoryList.tsx:840-850`
- **Effort**: **S** (< 15 min)
- **Impact**: **Medium**

#### Description
In `InventoryList.tsx`, the search bar lets users filter by VIN, stock number, make, and model. When typing on mobile keyboards, clearing a long search term (like a 17-digit VIN) requires repeatedly tapping backspace. There is no inline clear `(X)` button inside the input container.

#### Suggested Fix
Add a small clear icon button when `searchTerm.length > 0`:
```tsx
<div className="relative flex-1">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
  <input
    type="text"
    placeholder="Search VIN, stock, make…"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full h-11 bg-[rgba(232,234,230,0.04)] text-[15px] text-neutral-200 pl-10 pr-9 rounded-[12px] border border-[rgba(232,234,230,0.14)] focus:border-[#4FE3DC] outline-none font-mono"
  />
  {searchTerm && (
    <button
      type="button"
      onClick={() => setSearchTerm('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
      aria-label="Clear search"
    >
      <X size={14} />
    </button>
  )}
</div>
```

---

### Finding TL-08: Reuse Canvas Buffer in Disc Scanner to Eliminate Allocation Churn

- **App**: TruLens
- **Category**: Performance / Memory Management
- **File(s)**: `TruLens/src/components/DiscScanner.tsx:60-68`
- **Effort**: **S** (< 20 min)
- **Impact**: **Medium**

#### Description
In `DiscScanner.tsx`, `grabFrame` is called whenever a barcode is successfully decoded. Line 63 creates a brand new DOM `<canvas>` on every invocation:
```tsx
const grabFrame = React.useCallback((): string | undefined => {
  const video = videoRef.current;
  if (!video || !video.videoWidth) return undefined;
  const c = document.createElement('canvas'); // <-- UNCACHED CANVAS DOM ALLOCATION
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d')?.drawImage(video, 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}, []);
```
`DiscScanner` already holds a dedicated `canvasRef` (line 30 and line 349). Creating detached canvas objects adds unnecessary GC pressure on mobile devices with limited RAM.

#### Suggested Fix
Use the existing `canvasRef.current` buffer:
```tsx
const grabFrame = React.useCallback((): string | undefined => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !canvas || !video.videoWidth) return undefined;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}, []);
```

---

### Finding TL-09: Add Optional Ghost Silhouette Framing Overlays for Consistent Lot Angles

- **App**: TruLens
- **Category**: UX Polish / Micro-feature
- **File(s)**: `TruLens/src/components/CameraGuide.tsx:679-681` & `TruLens/src/template.ts:33`
- **Effort**: **M** (1–2 hrs)
- **Impact**: **High**

#### Description
The template definition in `src/template.ts` specifies precise `idealAngle` coordinates (pitch, roll, yaw) for all 27 slots. However, `CameraGuide.tsx` currently has no framing guides active (`{/* No framing-guide overlay — the camera view carries only the panel label and shot count below. */}`).
Lot attendants frequently capture inconsistent shot distances, tilted horizons, or off-center angles, degrading the visual consistency of dealer website inventories.

#### Suggested Fix
Add a subtle, toggleable SVG wireframe silhouette overlay in `CameraGuide.tsx` corresponding to the active slot category (Front Bumper, 45° Corner, Side Profile, Rear, Odometer, Interior Cabin). Provide a simple ghost icon toggle on the viewfinder overlay to turn the silhouette on/off with 20% opacity.

---

### Finding TL-10: Add 17-Character VIN Sanitization & Duplicate Catalog Check

- **App**: TruLens
- **Category**: Code Quality / Input Validation
- **File(s)**: `TruLens/src/components/InventoryList.tsx:1220-1227, 565-605`
- **Effort**: **S** (< 30 min)
- **Impact**: **Medium**

#### Description
In `InventoryList.tsx`, the VIN input accepts arbitrary strings with `onChange={(e) => setVin(e.target.value.toUpperCase())}`.
Standard ISO 3779 VINs never contain the letters `I`, `O`, or `Q` (to avoid confusion with 1 and 0). Furthermore, if a vehicle with the same VIN or Stock Number is scanned or typed twice, TruLens creates a duplicate card that later fails or causes ambiguity during DMS export.

#### Suggested Fix
1. Sanitize VIN input to alphanumeric excluding `I`, `O`, `Q` and limit to 17 characters:
```tsx
onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))}
```
2. Display an inline warning below the VIN input if `vehicles.some(v => v.vin === vin && v.id !== editingVehicle?.id)`:
```tsx
{vin.length === 17 && vehicles.some(v => v.vin === vin && v.id !== editingVehicle?.id) && (
  <p className="text-[12px] text-amber-400 mt-1">⚠ A vehicle with this VIN already exists in your catalogue.</p>
)}
```

---

## Action Plan & Recommended Shipping Order

1. **Sprint 1 (Immediate Quick Wins - 1.5 hrs)**:
   - Ship **TL-01** (Restore in-camera capture loop in `App.tsx`).
   - Ship **TL-02** (Bulk upload client-side compression in `CameraGuide.tsx`).
   - Ship **TL-03** (Copy VIN & quick WhatsApp share in `InventoryList.tsx`).
   - Ship **TL-04** (Remove dead currency setting).

2. **Sprint 2 (Polish & Reliability - 1 hr)**:
   - Ship **TL-05** (In-app delete confirm sheet).
   - Ship **TL-06** (`await` initial photo uploads).
   - Ship **TL-07** (Search clear button).
   - Ship **TL-08** (Disc scanner canvas reuse).
   - Ship **TL-10** (VIN sanitization & duplicate check).

3. **Sprint 3 (Micro-feature Enhancements - 1.5 hrs)**:
   - Ship **TL-09** (Toggleable SVG silhouette ghost framing guides).
