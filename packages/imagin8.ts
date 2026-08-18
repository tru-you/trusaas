/**
 * Imagin8 eValue8 API client — TransUnion vehicle data for SA dealers.
 *
 * Transport (confirmed against the live API console, 2026-08):
 *   POST https://www.imagin8.co.za/api/{Live|Sandbox}/channelApps/api/<controller>.php
 *   Content-Type: application/json
 *   Body: { route, APIKey, customerId, ...params }
 *
 * Auth is TWO credentials, both in the body:
 *   - APIKey     — the secret (IMAGIN8_API_KEY, or a dealer's own key)
 *   - customerId — the account id (IMAGIN8_CUSTOMER_ID, or a dealer's own)
 *
 * Billing model:
 *   - getMakes / getModels → platform key (flat monthly, unlimited) — free to dealer.
 *   - getValues / regCheck → dealer's key (per-call, dealer pays).
 */

const LIVE_BASE = "https://www.imagin8.co.za/api/Live/channelApps/api";
const SANDBOX_BASE = "https://www.imagin8.co.za/api/Sandbox/channelApps/api";

export interface Imagin8Opts {
  apiKey: string;
  customerId: string;
  sandbox?: boolean;
  timeout?: number;
}

/** POST a routed request to a controller and return the parsed JSON. */
async function post(
  controller: string,
  route: string,
  params: Record<string, unknown>,
  opts: Imagin8Opts,
): Promise<any> {
  const base = opts.sandbox ? SANDBOX_BASE : LIVE_BASE;
  const url = `${base}/${controller}.php`;

  const body = {
    route,
    APIKey: opts.apiKey,
    customerId: opts.customerId,
    ...params,
  };

  const controllerAbort = new AbortController();
  const timer = setTimeout(() => controllerAbort.abort(), opts.timeout ?? 20_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controllerAbort.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
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
  const data = await post("im8vehicle_api", "getMakes", { make }, opts);
  const rows: any[] = data?.Variants || data?.variants || [];
  return rows.map(mapVariant);
}

/** Models for a make (thin wrapper; same row shape as getMakes). */
export async function getModels(make: string, opts: Imagin8Opts): Promise<CatalogueVariant[]> {
  const data = await post("im8vehicle_api", "getModels", { make }, opts);
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
  const data = await post("im8vehicle_api", "getStaticInfo", { mmcode: mmCode }, opts);
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
export async function getValues(
  mmCode: string,
  year: string | number,
  mileage: number | undefined,
  opts: Imagin8Opts,
): Promise<TuValuation> {
  const params: Record<string, unknown> = { mmcode: mmCode, year: String(year) };
  if (mileage != null && mileage > 0) params.mileage = Math.round(mileage);

  const base: TuValuation = {
    available: false, note: null,
    newPrice: null, retailPrice: null, tradePrice: null, marketValue: null,
    year: num(year), mmCode, make: null, model: null, variant: null, raw: null,
  };

  let data: any;
  try {
    data = await post("im8vehicle_api", "getValues", params, opts);
  } catch (err: any) {
    // Unprovisioned key, network, or API error — soft-fail, don't blow up the UI.
    return { ...base, note: "TransUnion valuation unavailable — using market estimate." };
  }

  const retailPrice = num(data?.RetailPrice ?? data?.retailPrice ?? data?.Retail);
  const tradePrice = num(data?.TradePrice ?? data?.tradePrice ?? data?.Trade);
  const marketValue = num(data?.MarketValue ?? data?.marketValue ?? data?.Market);
  const newPrice = num(data?.NewPrice ?? data?.newPrice ?? data?.New);
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
  const data = await post("im8vehicle_api", "regCheck", { [paramKey]: identifier }, opts);

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
): Promise<AvsResult> {
  const data = await post("im8bank_api", "avsr", {
    accountnumber: bankAccount,
    branchcode: branchCode,
    idnumber: idNumber,
    initials,
    surname,
  }, opts);

  return {
    valid: toBool(data?.Valid),
    accountExists: toBool(data?.AccountExists),
    accountOpen: toBool(data?.AccountOpen),
    idMatch: toBool(data?.IDMatch),
    nameMatch: toBool(data?.NameMatch),
    initials: data?.Initials || null,
    surname: data?.Surname || null,
    accountType: data?.AccountType || null,
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
  const data = await post("im8core_api", "invoice.create", {
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
