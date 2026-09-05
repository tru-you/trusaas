# TruInspect Code Audit Report — Punch-List of Refinements

**Date:** 2026-09-02  
**Target:** `truinspect/` (TruInspect PWA & Desktop Vehicle Inspection Manager)  
**Auditor:** TruInspect Explorer  
**Status:** Read-Only Audit Complete  

---

## 1. Executive Summary

A comprehensive, read-only code audit was performed on **TruInspect** (`truinspect/`), examining frontend components (`src/components/*`), app state management (`src/App.tsx`), routing, mobile inspection workflows, and backend API routes (`server.ts`).

Overall, TruInspect has a robust architecture with solid mobile ergonomics, dark-mode styling, offline photo caching, and multi-market substrate support. However, this audit identified **8 high-return refinements** across **UX Polish**, **Code Quality / DRY**, **Performance**, and **Multi-Market Consistency** that can be resolved with Small (S) effort to deliver significant improvements in usability, workflow efficiency, and maintainability.

### Metrics & Findings Breakdown

| Category | High Impact | Medium Impact | Low Impact | Total |
|---|---|---|---|---|
| **UX Polish / Workflow DX** | 3 | 1 | 0 | 4 |
| **Code Quality / DRY** | 0 | 2 | 1 | 3 |
| **Multi-Market Consistency** | 0 | 1 | 0 | 1 |
| **Total** | **3** | **4** | **1** | **8** |

---

## 2. Top Quick Wins (S-Effort, High-Impact)

| # | Finding | File(s) & Lines | Effort | Impact |
|---|---|---|---|---|
| **1** | **Direct `slotId` routing from Inspection Checklist to Damage Tagger** | `src/components/InspectionSheet.tsx:266-276`<br>`src/components/DamageTagger.tsx:36,46`<br>`src/App.tsx:936-943` | **S** | **High** |
| **2** | **VIR Report Header WhatsApp Share & Copy Link Shortcuts** | `src/components/ReportPreview.tsx:1-5,120,310-343` | **S** | **High** |
| **3** | **Completion Review Grid Navigation to Missing / Empty Slots** | `src/components/CompletionReview.tsx:101` | **S** | **High** |
| **4** | **Removal of Dead "Scan with AI" Button in Damage Tagger** | `server.ts:1504-1510`<br>`src/components/DamageTagger.tsx:98-132,360-367` | **S** | **Medium** |
| **5** | **Standardize TradeInSummary to use shared `SignaturePad` component** | `src/components/TradeInSummary.tsx:41,106-160,715-741`<br>`src/components/signature-pad.tsx` | **S** | **Medium** |
| **6** | **Fix Hardcoded ZAR `(R)` and `(km)` in Trade-In & Vehicle Manager** | `src/components/TradeInWalkAround.tsx:284`<br>`src/components/TradeInValuation.tsx:159-160,285`<br>`src/components/VehicleManager.tsx:351,352,519` | **S** | **Medium** |
| **7** | **Retire Deprecated `flow-lite` DMS Preset from InventoryList** | `src/components/InventoryList.tsx:50-56,239-245,633-653` | **S** | **Low** |
| **8** | **Add Validation Feedback / Hints on Disabled Add Vehicle Button** | `src/components/AddVehicleDialog.tsx:261,389,529-531` | **S** | **Medium** |

---

## 3. Detailed Findings & Proposed Refinements

### Finding 1: Direct `slotId` Routing from Inspection Checklist to Damage Tagger

- **Category:** UX Polish / Workflow DX
- **Effort:** **S** (~10 lines changed)
- **Impact:** **High**
- **Location:**
  - `src/components/InspectionSheet.tsx:266-276`
  - `src/components/DamageTagger.tsx:36,46`
  - `src/App.tsx:936-943`

#### Observation
In `InspectionSheet.tsx`, each inspection item with a photo association renders a button:
```tsx
// src/components/InspectionSheet.tsx:267-271
{item.photoSlotId && onTagDamage && (
  <button
    type="button"
    onClick={onTagDamage}
    className="text-[12px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
  >
    <AlertTriangle size={12} /> Tag damage on this photo
  </button>
)}
```
`onTagDamage()` is invoked without passing `item.photoSlotId`. In `App.tsx:936-943`, `setIsDamageTaggerOpen(true)` is called without tracking which slot was targeted. When `DamageTagger.tsx` opens:
```tsx
// src/components/DamageTagger.tsx:46
const [selectedSlotId, setSelectedSlotId] = React.useState<string>(shotSlots[0]?.id || 'front_bumper');
```
It always resets to the first photo (`shotSlots[0]`). If an inspector was reviewing item #14 (Rear Bumper or Spare Wheel) and clicked "Tag damage on this photo", they are dumped at the Front 45° photo and must manually swipe/click through 27 slots to find the right photo.

#### Proposed Change
1. Update `InspectionSheetProps`: `onTagDamage?: (slotId?: string) => void`
2. Update `InspectionSheet.tsx:269`: `onClick={() => onTagDamage(item.photoSlotId)}`
3. Update `App.tsx`: maintain `const [initialDamageSlotId, setInitialDamageSlotId] = useState<string | undefined>()` and pass it to `<DamageTagger initialSlotId={initialDamageSlotId} />`.
4. Update `DamageTagger.tsx`: accept `initialSlotId?: string` and initialize `const [selectedSlotId, setSelectedSlotId] = React.useState<string>(initialSlotId || shotSlots[0]?.id || 'front_bumper')`.

---

### Finding 2: VIR Report Header Missing WhatsApp Share & Copy Link Action

- **Category:** UX Polish / Micro-Feature
- **Effort:** **S** (~20 lines changed)
- **Impact:** **High**
- **Location:**
  - `src/components/ReportPreview.tsx:1-5,120,310-343`

#### Observation
`ReportPreview.tsx` imports unused icons and declares state that was never wired up:
```tsx
// src/components/ReportPreview.tsx:1-5
import { 
  Printer, ArrowLeft, Download, ShieldCheck, Share2, Eye,
  Building2, Phone, Mail, MapPin, Check, Copy, CheckCircle2,
  Calendar, FileText, CheckCircle, Clock, Info, ShieldAlert, Award
} from 'lucide-react';
...
// src/components/ReportPreview.tsx:120
const [linkCopied, setLinkCopied] = React.useState(false);
```
The action header (lines 310-343) only renders `Export PDF` and `Print / Save PDF`. When inspectors or sales managers want to send the VIR summary to a customer over WhatsApp or copy the report summary/link to clipboard, they must navigate away to `VehicleManager` or manually re-type the details.

#### Proposed Change
Add WhatsApp and Copy Summary buttons directly in the top action bar:
```tsx
// In src/components/ReportPreview.tsx action buttons (lines 310-343):
const reportSummary = `Vehicle Inspection Report: ${vehicle.year} ${vehicle.make} ${vehicle.model} (Ref ${reportId}) · Condition: ${score.grade} (${score.label}) · Dealer: ${dealershipName}`;

<button
  onClick={() => {
    navigator.clipboard.writeText(reportSummary);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }}
  className="tru-btn-secondary px-3 flex items-center gap-1.5 text-[13px] cursor-pointer"
  title="Copy summary to clipboard"
>
  {linkCopied ? <Check size={14} className="text-cyan-400" /> : <Copy size={14} />}
  <span>{linkCopied ? 'Copied' : 'Copy'}</span>
</button>
```

---

### Finding 3: Completion Review Grid Cannot Jump to Missing / Empty Slots

- **Category:** UX Polish / Workflow
- **Effort:** **S** (1 line changed)
- **Impact:** **High**
- **Location:**
  - `src/components/CompletionReview.tsx:101`

#### Observation
In `CompletionReview.tsx`, the 6-column shot grid displays all required and optional slots. Empty required slots are highlighted in red (`border-rose-500/40 bg-rose-500/5`).
However, line 101 has the following click guard:
```tsx
// src/components/CompletionReview.tsx:101
<button
  key={slot.id}
  type="button"
  onClick={() => photo && onRetakeSlot(slot.id)}
  className={...}
>
```
Because `photo` is undefined for un-captured slots, clicking on an empty/missing slot does nothing! An inspector who identifies a missing required shot in the review screen is blocked from tapping it to open `CameraGuide` directly on that slot.

#### Proposed Change
Remove the `photo &&` condition:
```tsx
// Before:
onClick={() => photo && onRetakeSlot(slot.id)}

// After:
onClick={() => onRetakeSlot(slot.id)}
```

---

### Finding 4: Dead "Scan with AI" Button in Damage Tagger

- **Category:** Code Quality / UX Polish
- **Effort:** **S** (~40 lines removed)
- **Impact:** **Medium**
- **Location:**
  - `server.ts:1504-1510`
  - `src/components/DamageTagger.tsx:98-132,360-367`

#### Observation
In `server.ts`, `/api/inspect/damage` is an inactive stub that always returns:
```typescript
// server.ts:1504-1510
app.post('/api/inspect/damage', requireDeviceAuth, async (req, res) => {
  // AI visual damage tagging disabled — manual tagging is the official path
  return res.json({ aiMode: false, findings: [] });
});
```
However, `DamageTagger.tsx:360-367` renders a full-width action button:
```tsx
<button
  type="button"
  onClick={scanWithAI}
  disabled={isScanningAI}
  className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 border border-indigo-500/40 text-neutral-200 text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:from-indigo-600/40 hover:to-cyan-600/40 transition-all disabled:opacity-50"
>
  <Sparkles size={14} className="text-cyan-400" />
  {isScanningAI ? 'Analyzing photo with AI…' : 'Scan this photo with AI'}
</button>
```
Clicking it spins briefly and either does nothing or displays "AI mode is not active on this instance." This causes confusion for inspectors.

#### Proposed Change
Remove the button and `scanWithAI` function from `DamageTagger.tsx`, allowing the clean manual pin-dropping interface to take primary focus.

---

### Finding 5: Duplicated Canvas Signature Implementation in TradeInSummary vs Shared SignaturePad

- **Category:** Code Quality / DRY
- **Effort:** **S** (~50 lines refactored)
- **Impact:** **Medium**
- **Location:**
  - `src/components/TradeInSummary.tsx:41,106-160,715-741`
  - `src/components/signature-pad.tsx`

#### Observation
`ReportPreview.tsx` correctly uses the shared `SignaturePad` component (`src/components/signature-pad.tsx`).
However, `TradeInSummary.tsx` maintains its own raw HTML5 canvas event handlers (60 lines of code: `canvasRef`, `isDrawing`, `startDrawing`, `draw`, `stopDrawing`, `clearSignature`) with raw line drawing without line smoothing or high-DPI scaling.

#### Proposed Change
Import `SignaturePad` in `TradeInSummary.tsx` and replace the manual canvas block with:
```tsx
<SignaturePad
  value={digitalSignatureUrl}
  onChange={(dataUrl) => setDigitalSignatureUrl(dataUrl || '')}
  label="Appraiser digital signature"
  height={120}
/>
```
This removes 50+ lines of duplicated event listeners and guarantees unified signature rendering across all reports.

---

### Finding 6: Hardcoded Currency Symbols `(R)` and ZA Domains in Trade-In & Vehicle Manager

- **Category:** Multi-Market Consistency
- **Effort:** **S** (6 label/link replacements)
- **Impact:** **Medium**
- **Location:**
  - `src/components/TradeInWalkAround.tsx:284`
  - `src/components/TradeInValuation.tsx:159-160,285,299,308`
  - `src/components/VehicleManager.tsx:351,352,519`

#### Observation
While the market substrate (`MarketContext`, `useMarket()`, `useMoney()`) is integrated into TruInspect, several labels and links still hardcode South African Rand `(R)` and `(km)`:
1. `TradeInWalkAround.tsx:284`: `<label ...>Price (R)</label>`
2. `TradeInValuation.tsx:159-160`: `<label ...>Estimated value (R)</label>`
3. `TradeInValuation.tsx:285,299,308`: Hardcoded link `https://www.autotrader.co.za/cars-for-sale/...` even when running on UK instance (`market.id === 'uk'`).
4. `VehicleManager.tsx:351,352,519`: `<label ...>Price (R)</label>`, `<label ...>Mileage (km)</label>`, `<label ...>Amount (R)</label>`.

#### Proposed Change
Replace all static `(R)` with `({market.currency})` and `(km)` with `({market.distanceUnit})`. In `TradeInValuation.tsx`, adjust the external search link based on `market.id` (e.g. `autotrader.co.uk` for UK or omit when not ZA).

---

### Finding 7: Retire Deprecated `flow-lite` DMS Preset from InventoryList

- **Category:** Code Quality / Architecture Memory
- **Effort:** **S** (~15 lines cleaned up)
- **Impact:** **Low**
- **Location:**
  - `src/components/InventoryList.tsx:50-56,239-245,633-653`

#### Observation
As documented in `AGENTS.md` (2026-08-30), `flow-lite` was officially retired from the platform. `InventoryList.tsx` still defines:
```typescript
const DMS_PRESETS = {
  premium: { label: 'TruFlow Premium', url: 'http://localhost:3001' },
  lite: { label: 'TruFlow Lite', url: 'http://localhost:3002' },
  custom: { label: 'Custom URL', url: '' },
} as const;
```
And retains state handling for the `'lite'` preset.

#### Proposed Change
Remove `lite` from `DMS_PRESETS` and preset handlers in `InventoryList.tsx`, keeping `premium` and `custom`.

---

### Finding 8: Form Validation Feedback on Disabled Add Vehicle Button

- **Category:** UX Polish / Error Prevention
- **Effort:** **S** (~5 lines)
- **Impact:** **Medium**
- **Location:**
  - `src/components/AddVehicleDialog.tsx:261,389,529-531`

#### Observation
In `AddVehicleDialog.tsx:261`:
```typescript
const canSubmit = f.make.trim() && f.model.trim() && f.mileage.trim();
```
When an inspector is adding a new unit from the desktop manager, if they leave Mileage blank, the "Add Vehicle" button is disabled:
```tsx
<button type="submit" disabled={!canSubmit} className="btn-primary on-fill ... disabled:opacity-40 disabled:cursor-not-allowed">
  <Plus size={15} /> Add Vehicle
</button>
```
There is no tooltip, validation text, or helper explaining why the button is disabled. If an inspector doesn't notice the asterisk on Mileage, they are left wondering why clicking fails.

#### Proposed Change
Add a title tooltip or inline helper when `!canSubmit`:
```tsx
<button
  type="submit"
  disabled={!canSubmit}
  title={!canSubmit ? 'Please enter Make, Model, and Mileage to add the vehicle' : undefined}
  className="btn-primary on-fill flex items-center gap-2 px-5 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  style={{ minHeight: 42 }}
>
  <Plus size={15} /> Add Vehicle
</button>
```

---

## 4. Verification & Testing Instructions

To independently verify these findings:
1. **Inspection Checklist → Damage Tagger Slot Routing:**
   - Open mobile view, navigate to a vehicle, open `Checklist`, find an item with a photo association (e.g. `Rear Bumper`), click "Tag damage on this photo".
   - Verify that without the fix, it always opens at `front_bumper` (Slot 1) instead of the target slot.
2. **Completion Review Navigation:**
   - On a vehicle with un-captured shots, open `Review & Submit`.
   - Click on an un-captured slot tile in the 6-column grid; observe that clicking produces no action.
3. **Multi-Market Labels:**
   - Run TruInspect with `MARKET=uk` (`npm run dev:inspect`).
   - Inspect `VehicleManager` and `TradeInWalkAround`; observe `(R)` and `(km)` hardcoded in labels.

---
*Report generated for TruSaaS Core Engineering Team.*
