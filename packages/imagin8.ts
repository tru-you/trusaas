/**
 * Imagin8 eValue8 API client — TransUnion vehicle data for SA dealers.
 *
 * Transport (confirmed against the live API, 2026-08-21):
 *   GET https://www.imagin8.co.za/api/{Live|Sandbox}/channelApps/api/<controller>.php?route=...&APIKey=...&...
 *
 * The API accepts query string parameters only. POST with JSON body returns
 * "No request data received". All params (auth + payload) are URL-encoded.
 *
 * Auth is TWO credentials:
 *   - APIKey     — the secret (IMAGIN8_API_KEY, or a dealer's own key)
 *   - customerId — the account id (IMAGIN8_CUSTOMER_ID, or a dealer's own)
 *
 * Billing model:
 *   - getMakes / getModels / getStaticInfo → platform key (flat monthly, unlimited) — free to dealer.
 *   - getValues / regCheck / accidentReport → dealer's key (per-call, dealer pays).
 */

const LIVE_BASE = "https://www.imagin8.co.za/api/Live/channelApps/api";
const SANDBOX_BASE = "https://www.imagin8.co.za/api/Sandbox/channelApps/api";

export interface Imagin8Opts {
  apiKey: string;
  customerId: string;
  /** Per-call (chargeable) services — getValues, regCheck, accidentReport —
   *  also require the account's login and a pre-registered application name.
   *  Platform calls (getMakes/getModels/getStaticInfo) ignore these. */
  userName?: string;
  password?: string;
  appName?: string;
  sandbox?: boolean;
  timeout?: number;
}

/** Build a query string from a flat object. Skips null/undefined/empty. */
function toQueryString(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

/** GET a routed request to a controller and return the parsed JSON. */
async function get(
  controller: string,
  route: string,
  params: Record<string, unknown>,
  opts: Imagin8Opts,
): Promise<any> {
  const base = opts.sandbox ? SANDBOX_BASE : LIVE_BASE;
  const qs = toQueryString({
    route,
    APIKey: opts.apiKey,
    customerId: opts.customerId,
    ...params,
  });
  const url = `${base}/${controller}.php?${qs}`;

  const controllerAbort = new AbortController();
  const timer = setTimeout(() => controllerAbort.abort(), opts.timeout ?? 20_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controllerAbort.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Imagin8 ${route}: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    // API signals success with result === "0"; anything else is an error payload.
    if (data && data.result != null && String(data.result) !== "0") {
      throw new Error(`Imagin8 ${route}: API error result=${data.result} ${data.message || ""}`.trim());
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ── Vehicle catalogue: Makes / Models (platform key) ──

export interface CatalogueVariant {
  mmCode: string;        // 8-digit M&M code
  make: string;          // e.g. "VOLKSWAGEN"
  model: string;         // full variant description, e.g. "GOLF 8 2.0 TSI R DSG"
  introDate: string | null;   // ISO "YYYY-MM", parsed from packed MMYYYY
  disconDate: string | null;
  vehicleType: string | null; // "P" passenger, "C" commercial
  typeCode: string | null;    // A / B / M / H / Z …
}

/**
 * Imagin8 packs intro/discontinue as <month><year> with NO separator:
 *   "71992"  → 07/1992   "122026" → 12/2026
 * The last 4 digits are the year; whatever precedes them is the month.
 */
function parsePackedDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s.length < 5) return null;
  const year = s.slice(-4);
  const month = s.slice(0, -4).padStart(2, "0");
  return `${year}-${month}`;
}

function mapVariant(row: any): CatalogueVariant {
  return {
    mmCode: row?.mmCode || row?.mvCode || "",
    make: row?.mmMakeShortCode || row?.mmMake || "",
    model: row?.mmModel || row?.mvModel || "",
    introDate: parsePackedDate(row?.IntroYear),
    disconDate: parsePackedDate(row?.DisconYear),
    vehicleType: row?.VehicleType || row?.vehicletype || null,
    typeCode: row?.mmVehicleTypeCode || row?.MMVehicleTypecode || null,
  };
}

/** All variants for a given make (make/model/variant + years + M&M code). */
export async function getMakes(make: string, opts: Imagin8Opts): Promise<CatalogueVariant[]> {
  const data = await get("im8vehicle_api", "getMakes", { make }, opts);
  const rows: any[] = data?.Variants || data?.variants || [];
  return rows.map(mapVariant);
}

/** Models for a make (thin wrapper; same row shape as getMakes). */
export async function getModels(make: string, opts: Imagin8Opts): Promise<CatalogueVariant[]> {
  const data = await get("im8vehicle_api", "getModels", { make }, opts);
  const rows: any[] = data?.Variants || data?.variants || data?.Models || [];
  return rows.map(mapVariant);
}

// ── Vehicle specs: Static Info (platform key) — for the Add Vehicle flow ──

export interface StaticInfo {
  mmCode: string;
  make: string | null;
  model: string | null;
  kw: number | null;
  cc: number | null;
  cylinders: number | null;
  doors: number | null;
  seats: number | null;
  bodyType: string | null;     // e.g. "S/C"
  fuelType: string | null;     // "P" petrol, "D" diesel
  fuelTankSize: number | null;
  tare: number | null;
  gvm: number | null;
  co2: number | null;
  introDate: string | null;
  disconDate: string | null;
  vehicleType: string | null;
  typeCode: string | null;
  raw: any;
}

/** Full vehicle specification for an M&M code — auto-fills the stock card. */
export async function getStaticInfo(mmCode: string, opts: Imagin8Opts): Promise<StaticInfo> {
  // Live is case-sensitive on the param: `mmCode`/`vehicleCode` return specs,
  // lowercase `mmcode` returns an empty {"raw":""}. Send the working names
  // (confirmed against the live API 2026-08-21).
  const data = await get("im8vehicle_api", "getStaticInfo", { mmCode, vehicleCode: mmCode }, opts);
  const row: any = (data?.StaticInfo || data?.staticInfo || [])[0] || {};
  return {
    mmCode: row?.mmCode || mmCode,
    make: row?.Make || row?.mmMake || null,
    model: row?.Model || row?.mmModel || null,
    kw: num(row?.kw),
    cc: num(row?.cc),
    cylinders: num(row?.Cylinders),
    doors: num(row?.doors),
    seats: num(row?.seats),
    bodyType: row?.body || null,
    fuelType: row?.FuelType || null,
    fuelTankSize: num(row?.FuelTankSize),
    tare: num(row?.Tare),
    gvm: num(row?.gvm),
    co2: num(row?.CO2),
    introDate: parsePackedDate(row?.IntroYear),
    disconDate: parsePackedDate(row?.DisconYear),
    vehicleType: row?.vehicletype || null,
    typeCode: row?.MMVehicleTypecode || null,
    raw: data,
  };
}

// ── TransUnion Auto: Valuations (dealer key) ──

export interface TuValuation {
  available: boolean;   // false when the API is unprovisioned / returned no prices
  note: string | null;  // human-readable reason when unavailable
  newPrice: number | null;
  retailPrice: number | null;
  tradePrice: number | null;
  marketValue: number | null;
  year: number | null;
  mmCode: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  raw: any;
}

/**
 * Graceful by design: field names below are BEST-GUESS pending one live
 * getValues response, and Get Values may not be provisioned on every key.
 * So this NEVER throws on a missing/odd shape — it returns available:false
 * with the raw payload preserved, and callers fall back to the scraper FMV.
 * Correcting the field mapping later needs no signature change.
 */
/** Map actual km to the API's mileage band code. Bands are indicative — the
 *  API only accepts VL/LO/AV/HI/VH — and default to Average when km is unknown. */
function mileageCode(km: number | undefined): string {
  if (km == null || km <= 0) return "AV";
  if (km < 20_000) return "VL";
  if (km < 60_000) return "LO";
  if (km < 120_000) return "AV";
  if (km < 200_000) return "HI";
  return "VH";
}

/** TransUnion data publication (guide) in MMYYYY — e.g. "082026" for Aug 2026.
 *  The API needs it sent explicitly (the implicit default returns no value).
 *  Override with IMAGIN8_GUIDE if TU's latest published guide lags the month. */
function currentGuide(): string {
  if (typeof process !== "undefined" && process.env?.IMAGIN8_GUIDE) return process.env.IMAGIN8_GUIDE;
  const now = new Date();
  return String(now.getMonth() + 1).padStart(2, "0") + now.getFullYear();
}

export async function getValues(
  mmCode: string,
  year: string | number,
  mileage: number | undefined,
  opts: Imagin8Opts,
): Promise<TuValuation> {
  /* Field names and required credentials per the eValue8 API console:
   *   vehicleCode (8-digit M&M), yearModel, plus the account login
   *   (userName/password) and a pre-registered applicationName. mileage here is
   *   a CODE (VL/LO/AV/HI/VH), not a number — we map from km, defaulting to
   *   Average when unknown. Sending a raw number is what the old payload did,
   *   and the API rejected it with an HTML error page. */
  const params: Record<string, unknown> = {
    vehicleCode: mmCode,
    yearModel: String(year),
    userName: opts.userName,
    password: opts.password,
    applicationName: opts.appName,
    mileage: mileageCode(mileage),
    guide: currentGuide(),
    condition: "GO",
  };

  const base: TuValuation = {
    available: false, note: null,
    newPrice: null, retailPrice: null, tradePrice: null, marketValue: null,
    year: num(year), mmCode, make: null, model: null, variant: null, raw: null,
  };

  let data: any;
  try {
    data = await get("im8vehicle_api", "getValues", params, opts);
  } catch (err: any) {
    // Unprovisioned key, network, or API error — soft-fail, don't blow up the UI.
    return { ...base, note: "TransUnion valuation unavailable — using market estimate." };
  }

  /* The API can answer result:0 (transport OK) yet carry an Error object, e.g.
   *  { Error: { ErrorMessage: "Subscription Not Valid" } } when the valuation
   *  bundle isn't active on the customerId. Surface that reason instead of a
   *  vague "no price" so the cause is visible. */
  const apiError = data?.Error?.ErrorMessage || data?.error?.ErrorMessage || data?.ErrorMessage;
  if (apiError) {
    return { ...base, raw: data, note: `TransUnion: ${apiError} — using market estimate.` };
  }

  /* Sandbox returns the prices flat ({ RetailPrice, TradePrice, … }); some live
   *  responses wrap them in an envelope. Search the top level and the common
   *  containers so either shape maps. */
  const src: any = data?.RetailPrice != null || data?.TradePrice != null
    ? data
    : (data?.Values ?? data?.values ?? data?.data ?? data?.Result ?? data ?? {});
  const pick = (...keys: string[]) => {
    for (const k of keys) { const v = num(src?.[k] ?? data?.[k]); if (v != null) return v; }
    return null;
  };
  const retailPrice = pick("RetailPrice", "retailPrice", "Retail", "mmRetail");
  const tradePrice = pick("TradePrice", "tradePrice", "Trade", "mmTrade");
  const marketValue = pick("MarketValue", "marketValue", "Market", "ListedPrice", "mmEstimator");
  const newPrice = pick("NewPrice", "newPrice", "New", "mmNew");
  const gotAnyPrice = [retailPrice, tradePrice, marketValue, newPrice].some((v) => v != null);

  return {
    available: gotAnyPrice,
    note: gotAnyPrice ? null : "No TransUnion price returned for this vehicle — using market estimate.",
    newPrice, retailPrice, tradePrice, marketValue,
    year: num(data?.Year ?? data?.year) ?? num(year),
    mmCode: data?.mmCode || data?.MMCode || mmCode,
    make: data?.mmMake || data?.Make || null,
    model: data?.mmModel || data?.Model || null,
    variant: data?.Variant || data?.variant || null,
    raw: data,
  };
}

// ── Vehicle Background: Reg Check (dealer key) ──

export interface RegCheckResult {
  registered: boolean;
  stolen: boolean;
  financePending: boolean;
  microdotted: boolean;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  engineNumber: string | null;
  registrationNumber: string | null;
  colour: string | null;
  description: string | null;
  alerts: string[];
  raw: any;
}

export async function regCheck(
  identifier: string,
  type: "vin" | "reg" | "engine",
  opts: Imagin8Opts,
): Promise<RegCheckResult> {
  const paramKey = type === "vin" ? "vinno" : type === "reg" ? "regno" : "engineno";
  const data = await get("im8vehicle_api", "regCheck", { [paramKey]: identifier }, opts);

  const alerts: string[] = [];
  if (toBool(data?.Stolen)) alerts.push("STOLEN — vehicle is flagged as stolen");
  if (toBool(data?.FinancePending)) alerts.push("FINANCE — outstanding finance registered");
  if (toBool(data?.Microdotted)) alerts.push("MICRODOT — vehicle is microdotted");

  return {
    registered: toBool(data?.Registered),
    stolen: toBool(data?.Stolen),
    financePending: toBool(data?.FinancePending),
    microdotted: toBool(data?.Microdotted),
    make: data?.Make || null,
    model: data?.Model || null,
    year: num(data?.Year),
    vin: data?.VinNumber || data?.Vin || null,
    engineNumber: data?.EngineNumber || null,
    registrationNumber: data?.RegistrationNumber || null,
    colour: data?.Colour || null,
    description: data?.Description || null,
    alerts,
    raw: data,
  };
}

// ── Vehicle Accident Report (dealer key) ──

export interface AccidentClaim {
  date: string | null;
  areaDamaged: string | null;
  claimAmount: number | null;
  description: string | null;
}

export interface AccidentReportResult {
  vin: string;
  hasClaims: boolean;
  claims: AccidentClaim[];
  raw: any;
}

export async function accidentReport(
  vin: string,
  opts: Imagin8Opts,
): Promise<AccidentReportResult> {
  const data = await get("im8vehicle_api", "accidentReport", { vin }, opts);

  const claims: AccidentClaim[] = [];
  const rawClaims: any[] = data?.Claims || data?.claims || [];
  for (const c of rawClaims) {
    claims.push({
      date: c?.Date || c?.date || null,
      areaDamaged: c?.AreaDamaged || c?.areaDamaged || c?.area || null,
      claimAmount: num(c?.ClaimAmount || c?.claimAmount),
      description: c?.Description || c?.description || null,
    });
  }

  return {
    vin,
    hasClaims: claims.length > 0 || toBool(data?.HasClaims || data?.hasClaims),
    claims,
    raw: data,
  };
}

// ── Bank Services: AVS-R account verification (dealer key) ──

export interface AvsResult {
  valid: boolean;
  accountExists: boolean;
  accountOpen: boolean;
  idMatch: boolean;
  nameMatch: boolean;
  initials: string | null;
  surname: string | null;
  accountType: string | null;
  raw: any;
}

export async function bankAvs(
  bankAccount: string,
  branchCode: string,
  idNumber: string,
  initials: string,
  surname: string,
  opts: Imagin8Opts,
  accountType?: string,
): Promise<AvsResult> {
  const data = await get("im8bank_api", "avsr", {
    accountnumber: bankAccount,
    accountNo: bankAccount,
    branchcode: branchCode,
    branchCode: branchCode,
    idnumber: idNumber,
    idNo: idNumber,
    initials,
    surname,
    accountName: surname,
    accountType: accountType || "1",
    userName: opts.userName,
    password: opts.password,
    applicationName: opts.appName,
  }, opts);

  return {
    valid: toBool(data?.Valid || data?.valid),
    accountExists: toBool(data?.AccountExists || data?.accountExists),
    accountOpen: toBool(data?.AccountOpen || data?.accountOpen),
    idMatch: toBool(data?.IDMatch || data?.idMatch),
    nameMatch: toBool(data?.NameMatch || data?.nameMatch),
    initials: data?.Initials || data?.initials || null,
    surname: data?.Surname || data?.surname || null,
    accountType: data?.AccountType || data?.accountType || accountType || null,
    raw: data,
  };
}

// ── Imagin8 Core: Invoicing ──
// NOTE: Slated for retirement once DocHub + per-client Xero fully own invoicing.
// Kept because DocHubPanel still posts to it today.

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
}

export interface CreateInvoiceParams {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerVatNumber?: string;
  lineItems: InvoiceLineItem[];
  reference?: string;
  notes?: string;
  dueDate?: string;
  paymentMethod?: string;
}

export interface InvoiceResult {
  invoiceId: string | null;
  invoiceNumber: string | null;
  total: number | null;
  vatTotal: number | null;
  status: string | null;
  raw: any;
}

export async function createInvoice(
  params: CreateInvoiceParams,
  opts: Imagin8Opts,
): Promise<InvoiceResult> {
  const data = await get("im8core_api", "invoice.create", {
    CustomerName: params.customerName,
    CustomerEmail: params.customerEmail,
    CustomerPhone: params.customerPhone,
    CustomerAddress: params.customerAddress,
    CustomerVATNumber: params.customerVatNumber,
    Reference: params.reference,
    Notes: params.notes,
    DueDate: params.dueDate,
    PaymentMethod: params.paymentMethod,
    LineItems: params.lineItems.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitPrice: li.unitPrice,
      VATRate: li.vatRate ?? 15,
    })),
  }, opts);

  return {
    invoiceId: data?.InvoiceId || data?.Id || null,
    invoiceNumber: data?.InvoiceNumber || null,
    total: num(data?.Total),
    vatTotal: num(data?.VATTotal),
    status: data?.Status || null,
    raw: data,
  };
}

// ── Helpers ──

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";
  return !!v;
}

// ── Simulated TransUnion responses (prospect demo) ──
// A demo token must get the FULL Imagin8 experience so a prospect can run a
// valuation, a reg check and an accident report before the upsell wall — but a
// demo never spends real credits. So instead of hitting the chargeable API we
// return deterministic, plausible results seeded off the request: same input →
// same output, so the demo is stable and can't be gamed into draining a real
// allocation. The bundle counter still decrements client-side, so "credits
// running out → Unlock (Premium)" is part of the demo story.
//
// These match the normalized TuValuation / RegCheckResult / AccidentReportResult
// shapes the servers already hand the UI, so no frontend change is needed.

/** Demo sessions get ZERO paid calls — TransUnion features are gated behind a
 *  real dealership subscription. The UI shows the glassmorphic "Unlock" state. */
export const DEMO_IMAGIN8_ALLOWANCE = { valuation: 0, regCheck: 0, accidentReport: 0, bankAvs: 0 };

/** Deterministic FNV-1a hash → 32-bit uint. Stable per input string. */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic unit value in [0, 1) from a seed string. */
function unit(seed: string): number {
  return (hash32(seed) % 10000) / 10000;
}

/** Believable used-car prices for a SA dealer app. Deterministic from the
 *  mmCode/year so the same demo car returns the same numbers every visit. */
export function simulatedValuation(mmCode: string, year: number, mileage?: number): TuValuation {
  const yr = year || new Date().getFullYear();
  const age = Math.max(0, new Date().getFullYear() - yr);
  const rNew = unit(`${mmCode}:${yr}:new`);
  const rRtl = unit(`${mmCode}:${yr}:retail`);
  const rMkt = unit(`${mmCode}:${yr}:market`);
  // Mass-market SA band (~R120k–R500k new) skewed toward affordable used stock.
  const newPrice = Math.round(120_000 + rNew * 380_000);
  const retail = Math.max(15_000, Math.round(newPrice * (0.92 - age * 0.045 - rRtl * 0.06)));
  const trade = Math.round(retail * 0.88);
  const marketValue = Math.round(retail * (0.96 + rMkt * 0.05));
  return {
    available: true,
    note: null,
    newPrice,
    retailPrice: retail,
    tradePrice: trade,
    marketValue,
    year: yr,
    mmCode,
    make: null,
    model: null,
    variant: null,
    raw: null,
  };
}

/** Deterministic vehicle background check. Mostly clean; ~1/3 carry registered
 *  finance (a real SA reality), and microdotting is common. */
export function simulatedRegCheck(identifier: string, type: "vin" | "reg" | "engine"): RegCheckResult {
  const r = unit(`${identifier}:reg`);
  const stolen = r < 0.03; // rare — flagged stolen
  const financePending = r >= 0.03 && r < 0.35;
  const microdotted = r >= 0.5; // widespread in SA
  const alerts: string[] = [];
  if (stolen) alerts.push("STOLEN — vehicle is flagged as stolen");
  if (financePending) alerts.push("FINANCE — outstanding finance registered");
  if (microdotted) alerts.push("MICRODOT — vehicle is microdotted");
  return {
    registered: true,
    stolen,
    financePending,
    microdotted,
    make: null,
    model: null,
    year: null,
    vin: type === "vin" ? identifier : null,
    engineNumber: type === "engine" ? identifier : null,
    registrationNumber: type === "reg" ? identifier : null,
    colour: null,
    description: null,
    alerts,
    raw: null,
  };
}

/** Deterministic accident report. ~1/3 of seeded VINs show 1–2 prior claims, so
 *  a prospect can see both the "No records" and the damaged-area chips. */
export function simulatedAccidentReport(vin: string): AccidentReportResult {
  const r = unit(`${vin}:accident`);
  const hasClaims = r < 0.35;
  const claims: AccidentClaim[] = [];
  if (hasClaims) {
    const areas = [
      "Front bumper", "Rear bumper", "Driver's side", "Passenger side",
      "Bonnet", "Rear quarter panel",
    ];
    const count = 1 + Math.floor(unit(`${vin}:n`) * 2); // 1–2 claims
    for (let i = 0; i < count; i++) {
      const day = 1 + Math.floor(unit(`${vin}:d${i}`) * 28);
      const month = 1 + Math.floor(unit(`${vin}:m${i}`) * 12);
      const claimYear = new Date().getFullYear() - 1 - Math.floor(unit(`${vin}:y${i}`) * 5);
      claims.push({
        date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${claimYear}`,
        areaDamaged: areas[Math.floor(unit(`${vin}:a${i}`) * areas.length)],
        claimAmount: Math.round((5_000 + unit(`${vin}:c${i}`) * 60_000) / 100) * 100,
        description: "Reported collision damage — panel repaired.",
      });
    }
  }
  return { vin, hasClaims, claims, raw: null };
}
