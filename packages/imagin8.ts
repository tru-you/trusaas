/**
 * Imagin8 eValue8 API client — TransUnion vehicle data for SA dealers.
 *
 * Hybrid auth: M&M lookups use the platform key (IMAGIN8_API_KEY env var),
 * per-call endpoints (valuations, reg checks) use the dealer's own key.
 */

const BASE = "https://evalue8.imagin8.co.za/api";

interface Imagin8Opts {
  apiKey: string;
  timeout?: number;
}

async function call(endpoint: string, params: Record<string, string>, opts: Imagin8Opts): Promise<any> {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("apikey", opts.apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 15_000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Imagin8 ${endpoint}: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── TransUnion Auto: Valuations ──

export interface TuValuation {
  newPrice: number | null;
  retailPrice: number | null;
  tradePrice: number | null;
  marketValue: number | null;
  year: number | null;
  mmCode: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
}

export async function getValues(
  mmCode: string,
  year: string | number,
  mileage: number | undefined,
  opts: Imagin8Opts,
): Promise<TuValuation> {
  const params: Record<string, string> = {
    mmcode: mmCode,
    year: String(year),
  };
  if (mileage != null && mileage > 0) params.mileage = String(Math.round(mileage));

  const data = await call("TransUnionAuto/GetValues", params, opts);

  return {
    newPrice: num(data?.NewPrice),
    retailPrice: num(data?.RetailPrice),
    tradePrice: num(data?.TradePrice),
    marketValue: num(data?.MarketValue),
    year: num(data?.Year),
    mmCode: data?.MMCode || mmCode,
    make: data?.Make || null,
    model: data?.Model || null,
    variant: data?.Variant || null,
  };
}

// ── Vehicle Background: Reg Check ──

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
  const data = await call("VehicleBackground/RegCheck", { [paramKey]: identifier }, opts);

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

// ── Bank Services: AVS-R (Account Verification) ──

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
  const data = await call("BankServices/AVS-R", {
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

async function postJson(endpoint: string, body: any, opts: Imagin8Opts): Promise<any> {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set("apikey", opts.apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 20_000);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Imagin8 ${endpoint}: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function createInvoice(
  params: CreateInvoiceParams,
  opts: Imagin8Opts,
): Promise<InvoiceResult> {
  const body = {
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
  };

  const data = await postJson("Imagin8Core/CreateInvoice", body, opts);

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
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";
  return !!v;
}
