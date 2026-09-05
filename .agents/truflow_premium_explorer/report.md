# TruFlow Premium — Codebase Audit & Polish Punch-List

**Surface:** TruFlow Premium (`truflow-premium/`)  
**Audit Date:** 2026-09-02  
**Auditor:** TruFlow Premium Explorer  
**Scope:** Desktop DMS, API routes (`server.ts`), State management (`App.tsx`), Modals, Admin, Accounting, and Workflows  

---

## Executive Summary

TruFlow Premium is a highly functional, feature-rich vertical SaaS dealer management system. It provides comprehensive inventory workflows, lead CRM pipelines, financial reconditioning/P&L tracking, multi-tenant document generation (DocHub), and external ecosystem integrations.

This audit focuses on **subtle refinement, high-leverage UX polish, data integrity, multi-tenant isolation, performance optimizations, and missing desktop micro-features** without proposing framework migrations or structural rewrites.

### Findings Summary Matrix

| Category | High Impact | Medium Impact | Low Impact | Total |
|---|:---:|:---:|:---:|:---:|
| **UX Polish** | 4 | 2 | 1 | **7** |
| **Performance** | 2 | 1 | 0 | **3** |
| **Code Quality / Security** | 3 | 1 | 0 | **4** |
| **Missing Micro-features** | 2 | 0 | 0 | **2** |
| **Total** | **11** | **4** | **1** | **16** |

---

## Top Quick Wins (S-Effort, High-Impact)

1. **Fix `/api/state` Unscoped Dealerships Leak (GDPR Multi-tenant Isolation)** — One-line server filter prevents all dealership metadata from being leaked to non-admin accounts.
2. **Expand Inventory Search to Include VIN, Registration Plate, Year, and Color** — Fixes dealer search queries failing on primary vehicle identifiers in `App.tsx`.
3. **Fix Full Name Search in Lead CRM Pipeline** — Allows searching by `"FirstName LastName"` without returning empty results.
4. **Persist Missing DocSettings in `PUT /api/dealership/self`** — Whitelist and save `invoiceExtrasDefaults`, `otpOutrightTerms`, and `invoicePrefix`.
5. **State Reload After Bulk CSV Import** — Triggers `loadAllState()` after batch import so newly added stock appears immediately on the inventory screen.
6. **Global Keyboard Accelerators (`Ctrl+K`, `/`, and `Escape`)** — Adds desktop-native search focusing and modal dismissals.
7. **Internationalize WhatsApp Formatting (UK: 44, US: 1, ZA: 27)** — Replaces hardcoded `replace(/^0/, "27")` with dynamic market dial codes.

---

## Prioritised Punch-List of Findings

### 1. Multi-Tenant Dealership Metadata Leak in `/api/state`
* **App:** TruFlow Premium
* **Category:** Code Quality / Security
* **File(s):** `truflow-premium/server.ts` (lines 1623–1642)
* **Effort:** S (<15 min)
* **Impact:** High
* **Description:**  
  In `app.get("/api/state")`, the response spreads the full state object `...s` and explicitly scopes collections like `vehicles`, `leads`, `tasks`, `documents`, and `users` via `scopeToDealer()`. However, `dealerships` is included un-scoped via `...s`. Non-admin users of any single dealership receive the entire array of all registered dealerships—including legal CIPC registration numbers, SARS VAT numbers, contact emails, physical addresses, and integration credentials.
* **Suggested Fix:**  
  Explicitly scope `dealerships` in the response payload so only admins receive all dealerships:
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
    // ...
  });
  ```

---

### 2. Incomplete Inventory Search in Main App Shell
* **App:** TruFlow Premium
* **Category:** UX Polish / Search
* **File(s):** `truflow-premium/src/App.tsx` (lines 2124–2127)
* **Effort:** S (<15 min)
* **Impact:** High
* **Description:**  
  The main inventory grid search only queries `make`, `model`, and `stockNumber`. Searching by VIN (or partial VIN), registration/licence plate, year (e.g. `2022`), or trim returns 0 matches—even though VIN and registration numbers are primary lookups for dealerships. (`WebManagementGrid.tsx` already includes these fields).
* **Suggested Fix:**  
  Update `mSearch` filter condition in `App.tsx`:
  ```typescript
  const q = inventorySearch.toLowerCase().trim();
  const mSearch = !q ||
    [v.make, v.model, v.stockNumber, v.vin, v.registrationNumber, String(v.year), v.trim, v.color, (v as any).colour]
      .some((field) => (field || "").toLowerCase().includes(q));
  ```

---

### 3. Lead CRM Search Fails on Full Customer Names
* **App:** TruFlow Premium
* **Category:** UX Polish / Search
* **File(s):** `truflow-premium/src/App.tsx` (lines 1221–1226)
* **Effort:** S (<15 min)
* **Impact:** High
* **Description:**  
  `leadMatchesQuery` checks each field independently: `[l.firstName, l.lastName, l.phone, l.email, getVehicleLabel(l.vehicleId)].some(...)`. When a salesperson searches for a customer by full name (e.g. `"John Smith"` or `"Marc van"`), `l.firstName` ("John") and `l.lastName` ("Smith") fail the substring check, producing empty results.
* **Suggested Fix:**  
  Include the concatenated full name in the checked fields array:
  ```typescript
  const leadMatchesQuery = (l: { firstName?: string; lastName?: string; phone?: string; email?: string; vehicleId?: string }) => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${l.firstName || ""} ${l.lastName || ""}`.trim();
    return [fullName, l.firstName, l.lastName, l.phone, l.email, getVehicleLabel(l.vehicleId)]
      .some((f) => (f || "").toLowerCase().includes(q));
  };
  ```

---

### 4. Server Drops Custom DocSettings on Save (`PUT /api/dealership/self`)
* **App:** TruFlow Premium
* **Category:** Code Quality / Data Persistence
* **File(s):** `truflow-premium/server.ts` (lines 3634–3660)
* **Effort:** S (<20 min)
* **Impact:** High
* **Description:**  
  When saving document settings via `DocSettingsPanel.tsx`, the server's update handler in `server.ts` whitelists only `logo`, `bankingDetails`, `saleTerms`, `ownershipClause`, `footerNote`, and `warrantyTerms`. It ignores `invoiceExtrasDefaults`, `otpOutrightTerms`, `invoicePrefix`, and `nextInvoiceNumber`. Dealers who configure custom invoice line-item defaults or prefixes find their settings silently discarded on save and reset upon page reload.
* **Suggested Fix:**  
  Add the missing properties to the `docSettings` update block in `server.ts`:
  ```typescript
  if (Array.isArray(docSettings.invoiceExtrasDefaults)) {
    next.invoiceExtrasDefaults = docSettings.invoiceExtrasDefaults
      .filter((e: any) => e && typeof e.description === "string" && e.description.trim())
      .map((e: any) => ({
        description: e.description.trim(),
        amount: Number(e.amount) || 0,
        secondGross: Boolean(e.secondGross),
      }));
  }
  if (Array.isArray(docSettings.otpOutrightTerms)) {
    next.otpOutrightTerms = docSettings.otpOutrightTerms
      .filter((t: any) => typeof t === "string" && t.trim())
      .map((t: string) => t.trim());
  }
  if (typeof docSettings.invoicePrefix === "string") {
    next.invoicePrefix = docSettings.invoicePrefix.trim() || "INV";
  }
  if (docSettings.nextInvoiceNumber != null) {
    const n = Number(docSettings.nextInvoiceNumber);
    if (!isNaN(n) && n > 0) next.nextInvoiceNumber = n;
  }
  ```

---

### 5. Missing State Refresh After Bulk Vehicle Import
* **App:** TruFlow Premium
* **Category:** Performance / UX Polish
* **File(s):** `truflow-premium/src/App.tsx` (lines 2594–2606)
* **Effort:** S (<15 min)
* **Impact:** High
* **Description:**  
  In `App.tsx`, `onImportVehicles` loops through the parsed CSV rows calling `createVehicle(...)`. When the loop finishes, it does not invoke `loadAllState()` or update `state.vehicles`. The user sees the green "Import completed" step in `BulkImport`, but upon navigating back to Inventory, the newly imported vehicles are missing from the table until a hard page reload.
* **Suggested Fix:**  
  Await `loadAllState()` and display a success notification once the import completes:
  ```typescript
  onImportVehicles={async (vehicles) => {
    for (const v of vehicles) {
      await createVehicle({
        ...v,
        images: [],
        damagePhotos: [],
        vinPhotos: [],
        serviceBookPhotos: [],
        extrasPhotos: [],
      });
    }
    await loadAllState();
    addNotification("Import Complete", `Successfully imported ${vehicles.length} vehicles into inventory.`, "info");
  }}
  ```

---

### 6. Missing Desktop Keyboard Shortcuts (`Ctrl+K` / `/` Search & `Escape` Modal Close)
* **App:** TruFlow Premium
* **Category:** Missing Micro-features / UX Polish
* **File(s):** `truflow-premium/src/App.tsx` (lines 520–530), `src/components/VehicleDetailModal.tsx` (lines 150–160), `src/components/LeadDetailModal.tsx` (lines 145–160)
* **Effort:** S (<30 min)
* **Impact:** High
* **Description:**  
  As a high-frequency desktop DMS, users navigate between dozens of stock and lead records daily. Currently, pressing `Escape` does not dismiss `VehicleDetailModal`, `LeadDetailModal`, or top-level modals (`Add Vehicle`, `Add Lead`, `EOD Report`). Additionally, there is no global shortcut (`Ctrl+K`, `Cmd+K`, or `/`) to focus the search bar.
* **Suggested Fix:**  
  1. In `VehicleDetailModal.tsx` and `LeadDetailModal.tsx`, add an `Escape` key handler:
     ```typescript
     useEffect(() => {
       if (!isOpen) return;
       const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [isOpen, onClose]);
     ```
  2. In `App.tsx`, add a global listener for `/` and `Ctrl+K` to focus the active section search input (`document.querySelector('input[type="search"], input[placeholder*="Search"]')`).

---

### 7. Hardcoded Dialing Code 27 in WhatsApp Integration Links
* **App:** TruFlow Premium
* **Category:** UX Polish / Internationalization
* **File(s):** `truflow-premium/src/App.tsx` (lines 2883, 2963) and `src/components/LeadDetailModal.tsx` (line 299)
* **Effort:** S (<15 min)
* **Impact:** High
* **Description:**  
  WhatsApp quick-action buttons strip leading zeroes using `.replace(/^0/, "27")`. On international deployments (e.g. UK Frankfurt instance with `MARKET=uk` or US instances), clicking WhatsApp creates invalid URLs (e.g. `wa.me/277123456789` instead of `wa.me/447123456789`).
* **Suggested Fix:**  
  Use the active `market.id` to determine the dialing code prefix:
  ```typescript
  const dialCode = market.id === "uk" ? "44" : market.id === "us" ? "1" : "27";
  const digits = String(l.phone || "").replace(/\D/g, "").replace(/^0/, dialCode);
  ```

---

### 8. Dead Prop `onReconcileExpense` & Non-Interactive Expense Status in Accounting
* **App:** TruFlow Premium
* **Category:** Code Quality / UX Polish
* **File(s):** `truflow-premium/src/components/AccountingRecon.tsx` (lines 20, 24, 284–295)
* **Effort:** S (<20 min)
* **Impact:** Medium
* **Description:**  
  `AccountingReconProps` accepts `onReconcileExpense: (id: string, reconciled: boolean) => Promise<void>`, but the table rows in the Expense Ledger render static non-clickable badges (`<span ...>Reconciled</span>` / `<span ...>Open</span>`). The prop is completely dead, meaning bookkeepers cannot toggle expense reconciliation from the UI.
* **Suggested Fix:**  
  Make the badge a toggle button calling `onReconcileExpense`:
  ```tsx
  <button
    type="button"
    onClick={() => onReconcileExpense(e.id, !e.reconciled)}
    className="cursor-pointer hover:opacity-80 transition"
    title={e.reconciled ? "Click to mark Open" : "Click to mark Reconciled"}
  >
    {e.reconciled ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)] font-semibold">
        <Check size={8} /> Reconciled
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] font-semibold">
        <AlertCircle size={8} /> Open
      </span>
    )}
  </button>
  ```

---

### 9. N+1 Network Cascade on DealershipAdmin Mount
* **App:** TruFlow Premium
* **Category:** Performance
* **File(s):** `truflow-premium/src/components/DealershipAdmin.tsx` (lines 192–197)
* **Effort:** S (<30 min)
* **Impact:** Medium
* **Description:**  
  In `DealershipAdmin.tsx`, `load()` iterates over all dealerships using `list.forEach` and executes `fetch('/api/public/stock?dealer=' + d.slug)`. For N dealerships, this sends N separate HTTP requests simultaneously and performs N re-renders (`setStock((p) => ({ ...p, [d.id]: count }))`).
* **Suggested Fix:**  
  Return the `stockCount` directly on `GET /api/dealerships` or batch the counts into a single state read, eliminating N redundant network requests and component re-renders.

---

### 10. EOD Report CSV Encoding Truncation & Mock Email Notification
* **App:** TruFlow Premium
* **Category:** UX Polish / Reliability
* **File(s):** `truflow-premium/src/App.tsx` (lines 1438–1444, lines 4704–4712)
* **Effort:** S (<25 min)
* **Impact:** Medium
* **Description:**  
  1. `handleExportCSV` encodes the CSV with `data:text/csv;charset=utf-8,` + `encodeURI()`. Unescaped characters like `#` in stock numbers truncate the data URI in modern browsers.
  2. In the EOD modal, clicking "📧 Email to Stakeholders" triggers `addNotification("EOD Summary Dispatched", ...)` without calling any API or mail client.
* **Suggested Fix:**  
  1. Use `Blob` and `URL.createObjectURL` (matching `Stock List Export` at line 2095).
  2. In `Email to Stakeholders`, either invoke a `mailto:` link with the EOD summary body or copy the summary to the clipboard with a clear message: `"EOD Summary copied to clipboard"`.

---

### 11. Blank "Colour" Column in Stock List CSV Export
* **App:** TruFlow Premium
* **Category:** UX Polish / Data Quality
* **File(s):** `truflow-premium/src/App.tsx` (line 2082)
* **Effort:** S (<5 min)
* **Impact:** Low
* **Description:**  
  `App.tsx` reads `v.colour || ""` when constructing CSV rows for export. The `Vehicle` interface defines `color?: string`. Because `v.colour` is undefined, the Colour column in every exported Stock List CSV is empty.
* **Suggested Fix:**  
  Change line 2082 to `(v as any).color || (v as any).colour || ""`.

---

### 12. Native Browser `alert()` Popups Disrupting Dark-Mode Desktop UX
* **App:** TruFlow Premium
* **Category:** UX Polish
* **File(s):** `truflow-premium/src/components/LeadDetailModal.tsx` (10 instances) & `src/components/VehicleDetailModal.tsx` (12 instances)
* **Effort:** M (1–2 hrs)
* **Impact:** Medium
* **Description:**  
  Key user actions (e.g. scheduling tasks, deleting leads, bundle unlock gates, valuation errors) use blocking `alert(...)` dialogs. These disrupt desktop keyboard flow and clash with the sleek dark glassmorphic design system.
* **Suggested Fix:**  
  Replace `alert()` calls with `onNotify(...)` toasts or inline message banners.

---

### 13. Hardcoded Profitability Violation Thresholds in VehicleDetailModal
* **App:** TruFlow Premium
* **Category:** UX Polish / Internationalization
* **File(s):** `truflow-premium/src/components/VehicleDetailModal.tsx` (lines 1357–1360, line 1423)
* **Effort:** S (<15 min)
* **Impact:** Medium
* **Description:**  
  The Profitability Alert box hardcodes `targetProfitThreshold = 25000` (R25,000) and displays `"below dealership threshold (10.0% / R25,000)"`. On UK or US deployments, comparing against 25,000 triggers false violation alerts on nearly every £/$-denominated vehicle.
* **Suggested Fix:**  
  Scale `targetProfitThreshold` based on `market.id` (`uk: 1200`, `us: 1500`, `za: 25000`) and format using `{money(targetProfitThreshold)}`.

---

### 14. Non-Atomic File Writes on Bundles & Trade Reports
* **App:** TruFlow Premium
* **Category:** Code Quality / Reliability
* **File(s):** `truflow-premium/server.ts` (line 187, line 6946)
* **Effort:** S (<15 min)
* **Impact:** Medium
* **Description:**  
  While `writeDealerData` uses atomic rename (`.tmp` -> `target`), `writeImagin8Bundles` and `writeTradeReports` use direct `fs.writeFileSync(...)`. If the Node process terminates during write, the JSON file can be corrupted.
* **Suggested Fix:**  
  Use `.tmp` file + `fs.renameSync` pattern consistently across all disk persistence helpers.

---

### 15. VehiclePicker Keyboard Navigation Missing Enter/Escape Handlers
* **App:** TruFlow Premium
* **Category:** Missing Micro-features / Accessibility
* **File(s):** `truflow-premium/src/components/VehiclePicker.tsx` (lines 180–193)
* **Effort:** S (<15 min)
* **Impact:** Medium
* **Description:**  
  In the searchable dropdown for Makes/Models/Variants, typing into the search input and pressing `Enter` does not select the top matching result, and `Escape` does not dismiss the portal menu.
* **Suggested Fix:**  
  Add `onKeyDown` to the search input:
  ```typescript
  onKeyDown={(e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && filtered.length > 0) {
      onChange(filtered[0]);
      setOpen(false);
    }
  }}
  ```

---

### 16. Notification Toast Styling Ignores "Error" Type
* **App:** TruFlow Premium
* **Category:** UX Polish
* **File(s):** `truflow-premium/src/App.tsx` (lines 4733–4742)
* **Effort:** S (<15 min)
* **Impact:** Low
* **Description:**  
  `App.tsx` notifications only branch on `notif.type === 'warning' ? ... : ...`. When `type === 'error'` is dispatched, it renders with cyan/blue styling and an `AlertTriangle` icon, looking like an informational notice rather than an error badge.
* **Suggested Fix:**  
  Add an explicit red/danger style and error icon when `notif.type === 'error'`.
