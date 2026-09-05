# Handoff Report — TruFlow Premium Explorer

**Date:** 2026-09-02  
**Agent:** TruFlow Premium Explorer  
**Task:** Read-only Code Audit of TruFlow Premium (`truflow-premium/`)  
**Artifacts Generated:**  
- `report.md` (Detailed prioritized punch-list of 16 findings)  
- `handoff.md` (This handoff report)  
- `DISPATCH.md`  
- `BRIEFING.md`  
- `progress.md`  

---

## 1. Observation

Direct code observations from `truflow-premium/`:

1. **Multi-tenant Leak (`server.ts:1623-1642`):**
   ```typescript
   app.get("/api/state", (req: any, res) => {
     const s = readState();
     res.json({
       ...s,
       market: INSTANCE_MARKET,
       vehicles: scopeToDealer(s.vehicles, req.auth),
       // ...
     });
   });
   ```
   `...s` spreads `s.dealerships` containing all registered tenant metadata to any authenticated user.

2. **Inventory Search Omissions (`src/App.tsx:2124-2127`):**
   ```typescript
   const mSearch =
     (v.make || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
     (v.model || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
     (v.stockNumber || "").toLowerCase().includes(inventorySearch.toLowerCase());
   ```
   `v.vin`, `v.registrationNumber`, `v.year`, `v.trim`, and `v.color` are omitted.

3. **Lead Full Name Search Failure (`src/App.tsx:1221-1226`):**
   ```typescript
   const leadMatchesQuery = (l: { firstName?: string; lastName?: string; phone?: string; email?: string; vehicleId?: string }) => {
     const q = leadQuery.trim().toLowerCase();
     if (!q) return true;
     return [l.firstName, l.lastName, l.phone, l.email, getVehicleLabel(l.vehicleId)]
       .some((f) => (f || "").toLowerCase().includes(q));
   };
   ```
   Searching for full customer name (e.g., "John Smith") evaluates against `l.firstName` and `l.lastName` separately and fails.

4. **Dropped DocSettings (`server.ts:3634-3660`):**
   `PUT /api/dealership/self` updates only `logo`, `bankingDetails`, `saleTerms`, `ownershipClause`, `footerNote`, and `warrantyTerms`. `invoiceExtrasDefaults`, `otpOutrightTerms`, `invoicePrefix`, and `nextInvoiceNumber` are omitted from the update object.

5. **Missing State Refresh After CSV Import (`src/App.tsx:2594-2605`):**
   `onImportVehicles` executes `createVehicle(...)` in a loop and terminates without calling `loadAllState()`.

6. **Dead Prop & Non-Interactive Expense Status (`src/components/AccountingRecon.tsx:20, 24, 284-295`):**
   `onReconcileExpense` is accepted in props but never invoked in the component.

7. **Hardcoded WhatsApp Dial Code (`src/App.tsx:2883, 2963`, `src/components/LeadDetailModal.tsx:299`):**
   `replace(/^0/, "27")` unconditionally assumes South Africa dialing code (+27).

8. **Missing Global Keyboard Navigation (`src/App.tsx:520-530`, `src/components/VehicleDetailModal.tsx:150-160`, `src/components/LeadDetailModal.tsx:145-160`):**
   No `Escape` key listener on modals and no `Ctrl+K` or `/` shortcut to focus search.

---

## 2. Logic Chain

1. **Multi-tenant Leak:**
   - In `readState()`, `s.dealerships` holds all dealerships.
   - Spreading `...s` before explicit scoped properties attaches `dealerships: s.dealerships`.
   - Result: Non-admin users inspect `/api/state` and receive all tenant records.
   - Fix: Scope `dealerships` explicitly matching `scopeToDealer()`.

2. **Search Omissions:**
   - Dealership operations rely on VIN and registration lookups for trade-ins, inspections, and customer inquiries.
   - Checking only make, model, and stock number causes search failure on standard inputs.
   - Fix: Add VIN, registration number, year, trim, and color to the search predicate.

3. **Lead Search Matching:**
   - Full name queries combine `firstName` + `lastName`.
   - Checking tokens individually fails exact match for strings containing spaces.
   - Fix: Check `${l.firstName} ${l.lastName}` in addition to individual fields.

4. **DocSettings Persistence:**
   - `DocSettingsPanel.tsx` allows customizing invoice line items and invoice number prefixes.
   - `PUT /api/dealership/self` reconstructs `next` with an explicit whitelist.
   - Any property omitted from the whitelist is lost on write to disk.
   - Fix: Add the missing 4 fields to the whitelist assignment.

5. **Bulk Import Refresh:**
   - React state in `App.tsx` (`state.vehicles`) drives the Inventory tab.
   - `onImportVehicles` mutates server data via API calls without refreshing local state.
   - Fix: Await `loadAllState()` after loop completion.

---

## 3. Caveats

- Investigation was strictly read-only; no code was modified.
- External dependencies (such as Codat or Zernio APIs) were analyzed from implementation code, not live network calls.
- Scraper performance in non-ZA regions was verified from codebase configurations (`packages/market-scraper/markets/uk.ts` and `server.ts:6901-6915`).

---

## 4. Conclusion

TruFlow Premium has solid architectural foundations and rich vertical domain capabilities. Implementing the 16 identified refinements—particularly the 7 Top Quick Wins—will eliminate multi-tenant data leaks, fix search dead-ends, ensure reliable data persistence, speed up desktop workflows, and enhance dealer confidence.

All findings are documented with exact file paths, line numbers, concrete code changes, and Impact/Effort ratings in `report.md`.

---

## 5. Verification Method

To independently verify all findings:

1. **Verify `/api/state` Scoping:**
   Inspect `truflow-premium/server.ts:1623-1642` and test API response with non-admin session token.
2. **Verify Search Fields:**
   Inspect `truflow-premium/src/App.tsx:2124-2127` and `truflow-premium/src/App.tsx:1221-1226`.
3. **Verify DocSettings Persistence:**
   Inspect `truflow-premium/server.ts:3634-3660` against `src/types.ts:106-135`.
4. **Verify Bulk Import State Refresh:**
   Inspect `truflow-premium/src/App.tsx:2594-2605`.
5. **Verify Dead Prop in AccountingRecon:**
   Inspect `truflow-premium/src/components/AccountingRecon.tsx:20, 24, 284-295`.
6. **Verify WhatsApp Phone Formatting:**
   Search `replace(/^0/` across `truflow-premium/src/`.
