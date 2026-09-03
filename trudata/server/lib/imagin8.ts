/**
 * Imagin8 eValue8 API client — TransUnion vehicle data for TruData
 */

const LIVE_BASE = "https://www.imagin8.co.za/api/Live/channelApps/api";
const SANDBOX_BASE = "https://www.imagin8.co.za/api/Sandbox/channelApps/api";

export interface Imagin8Opts {
  apiKey: string;
  customerId: string;
  userName?: string;
  password?: string;
  appName?: string;
  sandbox?: boolean;
  timeout?: number;
}

function toQueryString(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

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
    if (data && data.result != null && String(data.result) !== "0") {
      throw new Error(`Imagin8 ${route}: API error result=${data.result} ${data.message || ""}`.trim());
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export interface CatalogueVariant {
  mmCode: string;
  make: string;
  model: string;
  introDate: string | null;
  disconDate: string | null;
  vehicleType: string | null;
  typeCode: string | null;
}

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

export async function getMakes(make: string, opts: Imagin8Opts): Promise<CatalogueVariant[]> {
  const data = await get("im8vehicle_api", "getMakes", { make }, opts);
  const rows: any[] = data?.Variants || data?.variants || [];
  return rows.map(mapVariant);
}

export async function getModels(make: string, opts: Imagin8Opts): Promise<CatalogueVariant[]> {
  const data = await get("im8vehicle_api", "getModels", { make }, opts);
  const rows: any[] = data?.Variants || data?.variants || data?.Models || [];
  return rows.map(mapVariant);
}

export interface StaticInfo {
  mmCode: string;
  make: string | null;
  model: string | null;
  kw: number | null;
  cc: number | null;
  cylinders: number | null;
  doors: number | null;
  seats: number | null;
  bodyType: string | null;
  fuelType: string | null;
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

export async function getStaticInfo(mmCode: string, opts: Imagin8Opts): Promise<StaticInfo> {
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

export interface TuValuation {
  available: boolean;
  note: string | null;
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

function mileageCode(km: number | undefined): string {
  if (km == null || km <= 0) return "AV";
  if (km < 20_000) return "VL";
  if (km < 60_000) return "LO";
  if (km < 120_000) return "AV";
  if (km < 200_000) return "HI";
  return "VH";
}

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
    return { ...base, note: "TransUnion valuation unavailable — using market estimate." };
  }

  const apiError = data?.Error?.ErrorMessage || data?.error?.ErrorMessage || data?.ErrorMessage;
  if (apiError) {
    return { ...base, raw: data, note: `TransUnion: ${apiError} — using market estimate.` };
  }

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

export function getImagin8Opts(): Imagin8Opts | null {
  const apiKey = process.env.IMAGIN8_API_KEY;
  const customerId = process.env.IMAGIN8_CUSTOMER_ID;
  if (!apiKey || !customerId) return null;

  return {
    apiKey,
    customerId,
    userName: process.env.IMAGIN8_USERNAME,
    password: process.env.IMAGIN8_PASSWORD,
    appName: process.env.IMAGIN8_APP_NAME,
    sandbox: process.env.NODE_ENV !== "production"
  };
}

// Bank AVS — Account Verification Service
export interface AvsResult {
  valid: boolean;
  accountExists: boolean;
  accountOpen: boolean;
  idMatch: boolean;
  nameMatch: boolean;
  initials: string | null;
  surname: string | null;
  accountType: string | null;
  acceptsCredits: boolean;
  acceptsDebits: boolean;
  accountAge: string | null;
}

export async function bankAvs(
  bankAccount: string,
  branchCode: string,
  idNumber: string,
  initials: string,
  surname: string,
  opts: Imagin8Opts,
): Promise<AvsResult> {
  const data = await get('im8bank_api', 'avsr', {
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
    acceptsCredits: toBool(data?.AcceptsCredits),
    acceptsDebits: toBool(data?.AcceptsDebits),
    accountAge: data?.AccountAge || null,
  };
}
