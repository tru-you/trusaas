/**
 * UK vehicle registration lookup — provider-agnostic spine.
 *
 * Tier 1 (intake, every vehicle): registration + MOT history + mileage —
 * auto-fills the add-vehicle forms and returns MOT/tax/mileage signals.
 * Tier 2 (per-vehicle due diligence, gated): full car-history check
 * (stolen/write-off/finance/keepers) via lookupCarHistory — only when
 * HISTORY_CHECK_ENABLED=1.
 *
 * Providers:
 *   checkcardetails — GET per data point, api key in the URL ({key}/{vrm}
 *                     placeholders). URL shapes are env-overridable because
 *                     their docs sit behind login; swap REG_LOOKUP_URL* when
 *                     the exact endpoints arrive. No model? Theirs HAS model.
 *   dvla            — official Vehicle Enquiry Service: POST, x-api-key.
 *                     Returns make/year/colour/fuel/engine/MOT/tax — NO
 *                     model, NO VIN. Live host by default, REG_LOOKUP_UAT=1
 *                     switches to the scripted test environment.
 *   mock            — deterministic fake vehicle (demo mode, zero cost).
 *
 * REG_LOOKUP_PROVIDER unset = lookup unavailable; the UI hides the plate box.
 * Server-only: uses global fetch, no client imports.
 */

export interface MotTestRecord {
  date?: string;
  mileage?: number;
  result?: string;
  advisories?: string[];
  failures?: string[];
}

export interface MileageRecord {
  date?: string;
  mileage?: number;
}

export interface RegLookupResult {
  provider: string;
  registration: string;
  make?: string;
  model?: string;
  colour?: string;
  fuelType?: string;
  engineCapacity?: number;
  yearOfManufacture?: number;
  firstRegistration?: string;
  /** From the spec data point (optional, costs a call) — fills the VIN field. */
  vin?: string;
  bodyType?: string;
  transmissionType?: string;
  co2Emissions?: number;
  bhp?: number;
  motStatus?: string;
  motExpiryDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
  markedForExport?: boolean;
  /** True when recorded mileages suggest clocking/discrepancy. */
  mileageAlert?: boolean;
  mileageRecords?: MileageRecord[];
  motHistory?: MotTestRecord[];
  /** Tier 2 deep-check blob (finance/write-off/stolen/keepers…) when run. */
  history?: any;
}

const PROVIDER = (process.env.REG_LOOKUP_PROVIDER || '').toLowerCase();
const API_KEY = process.env.REG_LOOKUP_API_KEY || '';
const DVLA_UAT = /^(1|true|yes)$/i.test(process.env.REG_LOOKUP_UAT || '');
const HISTORY_ENABLED = /^(1|true|yes)$/i.test(process.env.HISTORY_CHECK_ENABLED || '');

/* CheckCarDetails data-point URLs — confirmed live 2026-08-31:
 *   GET https://api.checkcardetails.co.uk/vehicledata/{datapoint}?apikey={key}&vrm={vrm}
 * vehicleregistration (£0.02) = make/model/colour/fuel/year/tax/mot status;
 * mot (£0.02) = full MOT history incl. defects + odometer readings.
 * Override per env if their paths ever move. */
const CCD_BASE = 'https://api.checkcardetails.co.uk';
const CCD_REG_URL = process.env.REG_LOOKUP_URL || `${CCD_BASE}/vehicledata/vehicleregistration?apikey={key}&vrm={vrm}`;
const CCD_MOT_URL = process.env.REG_LOOKUP_MOT_URL || `${CCD_BASE}/vehicledata/mot?apikey={key}&vrm={vrm}`;
const CCD_MILEAGE_URL = process.env.REG_LOOKUP_MILEAGE_URL || '';
const CCD_HISTORY_URL = process.env.REG_LOOKUP_HISTORY_URL || '';
/* Spec data point (£0.04) — adds VIN + body/transmission/CO2. Off by default
 * to keep intake at 4p; flip REG_LOOKUP_SPECS=1 to enrich. */
const CCD_SPECS_ENABLED = /^(1|true|yes)$/i.test(process.env.REG_LOOKUP_SPECS || '');
const CCD_SPECS_URL = process.env.REG_LOOKUP_SPECS_URL || `${CCD_BASE}/vehicledata/vehiclespecs?apikey={key}&vrm={vrm}`;

const DVLA_HOST = DVLA_UAT
  ? 'https://uat.driver-vehicle-licensing.api.gov.uk'
  : 'https://driver-vehicle-licensing.api.gov.uk';

export function regLookupConfigured(): boolean {
  return PROVIDER !== '' && (PROVIDER === 'mock' || API_KEY !== '');
}

export function regLookupProvider(): string {
  return regLookupConfigured() ? PROVIDER : '';
}

export function historyCheckEnabled(): boolean {
  return HISTORY_ENABLED && regLookupConfigured() && (PROVIDER === 'checkcardetails' || PROVIDER === 'mock');
}

/** UK VRN normalisation: uppercase, alphanumerics only. Loose length check —
 *  covers current formats, older plates and motorbikes. */
export function normalizeVrm(raw: string): string {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidVrm(raw: string): boolean {
  const v = normalizeVrm(raw);
  return v.length >= 2 && v.length <= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v);
}

function fillTemplate(url: string, vrm: string): string {
  return url.replace(/\{key\}/g, API_KEY).replace(/\{vrm\}/g, encodeURIComponent(vrm));
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* noop */ }
    const err: any = new Error(`Lookup failed (${res.status})`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

/* ---------- field extraction (tolerant across providers) ---------- */

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

function extractRegistrationResult(data: any, provider: string, vrm: string): RegLookupResult {
  const d = data || {};
  const tax = d.tax || {};
  const mot = d.mot || {};
  return {
    provider,
    registration: String(d.registrationNumber || vrm),
    make: d.make ? String(d.make) : undefined,
    model: d.model ? String(d.model) : undefined,
    colour: d.colour ? String(d.colour) : undefined,
    fuelType: d.fuelType ? String(d.fuelType) : undefined,
    engineCapacity: num(d.engineCapacity),
    yearOfManufacture: num(d.yearOfManufacture),
    firstRegistration: d.monthOfFirstRegistration || d.dateOfFirstRegistration || d.firstRegistered || undefined,
    motStatus: mot.motStatus || d.motStatus || undefined,
    motExpiryDate: mot.motDueDate || mot.motExpiryDate || d.motExpiryDate || undefined,
    taxStatus: tax.taxStatus || d.taxStatus || undefined,
    taxDueDate: tax.taxDueDate || d.taxDueDate || undefined,
    markedForExport: !!d.markedForExport,
    mileageAlert: !!d.mileageDiscrepancy || !!d.mileageAlert,
  };
}

function attachMotHistory(result: RegLookupResult, data: any): void {
  const list = Array.isArray(data?.motHistory) ? data.motHistory : Array.isArray(data?.tests) ? data.tests : null;
  if (!list) return;
  result.motHistory = list.map((t: any) => {
    /* CheckCarDetails shape: completedDate / odometerValue+odometerUnit /
       testResult / defects[{type: ADVISORY|MAJOR|DANGEROUS|MINOR, text}]. */
    let mileage = num(t.mileage ?? t.odometer);
    if (mileage == null) mileage = num(t.odometerValue);
    const unit = String(t.odometerUnit || '').toUpperCase();
    if (mileage != null && (unit === 'MI' || unit === 'MILES')) mileage = Math.round(mileage * 1.60934);
    const defects = Array.isArray(t.defects) ? t.defects : null;
    const advisories = defects
      ? defects.filter((d: any) => /ADVISORY|MINOR/i.test(String(d?.type || ''))).map((d: any) => String(d?.text || '')).filter(Boolean)
      : Array.isArray(t.advisories) ? t.advisories.map(String) : undefined;
    const failures = defects
      ? defects.filter((d: any) => /MAJOR|DANGEROUS|PRS/i.test(String(d?.type || ''))).map((d: any) => String(d?.text || '')).filter(Boolean)
      : Array.isArray(t.failures) ? t.failures.map(String) : Array.isArray(t.reasons) ? t.reasons.map(String) : undefined;
    const rawResult = String(t.result || t.status || t.testResult || '');
    return {
      date: t.date || t.testDate || t.completedDate || undefined,
      mileage,
      result: rawResult ? rawResult.charAt(0).toUpperCase() + rawResult.slice(1).toLowerCase() : undefined,
      advisories,
      failures,
    };
  });
}

/** MOT odometer readings double as the mileage timeline — newest first in the
 *  CCD response, so sort ascending and flag any backwards step (clocking). */
function deriveMileageFromMot(result: RegLookupResult): void {
  if (result.mileageRecords?.length || !result.motHistory?.length) return;
  const recs = result.motHistory
    .filter((t) => t.mileage != null && t.date)
    .map((t) => ({ date: t.date, mileage: t.mileage as number }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (recs.length < 2) return;
  result.mileageRecords = recs;
  for (let i = 1; i < recs.length; i++) {
    if (recs[i].mileage < recs[i - 1].mileage) { result.mileageAlert = true; break; }
  }
}

function attachMileageRecords(result: RegLookupResult, data: any): void {
  const d = data || {};
  const list = Array.isArray(d.mileageRecords) ? d.mileageRecords : Array.isArray(d.records) ? d.records : Array.isArray(d.mileage) ? d.mileage : null;
  if (list) {
    result.mileageRecords = list
      .map((m: any) => ({ date: m.date || undefined, mileage: num(m.mileage ?? m.value) }))
      .filter((m: MileageRecord) => m.mileage != null);
    /* A recorded drop between consecutive readings is the classic clocking
     * signature — flag it unless the provider already did. */
    const recs = result.mileageRecords;
    for (let i = 1; i < recs.length; i++) {
      if ((recs[i].mileage || 0) < (recs[i - 1].mileage || 0)) { result.mileageAlert = true; break; }
    }
  }
}

/* ---------- adapters ---------- */

async function lookupCheckCarDetails(vrm: string): Promise<RegLookupResult> {
  const regData = await fetchJson(fillTemplate(CCD_REG_URL, vrm));
  const result = extractRegistrationResult(regData, 'checkcardetails', vrm);
  attachMotHistory(result, regData);
  attachMileageRecords(result, regData);
  /* The MOT data point carries the full test history + odometer timeline.
   * A miss there never fails the intake lookup itself. */
  if (CCD_MOT_URL) {
    try {
      const mot = await fetchJson(fillTemplate(CCD_MOT_URL, vrm));
      attachMotHistory(result, mot);
      deriveMileageFromMot(result);
      /* MOT endpoint repeats the live status too — prefer it when fresher. */
      if (mot?.mot?.motStatus && !result.motStatus) result.motStatus = mot.mot.motStatus;
    } catch { /* intake still returns */ }
  }
  /* Optional spec enrichment (REG_LOOKUP_SPECS=1): VIN + body/transmission/
     CO2/BHP. Costs an extra call per lookup, so it stays opt-in. */
  if (CCD_SPECS_ENABLED && CCD_SPECS_URL) {
    try {
      const specs = await fetchJson(fillTemplate(CCD_SPECS_URL, vrm));
      const vi = specs?.VehicleIdentification || {};
      const model = specs?.ModelData || {};
      const perf = specs?.Performance || {};
      const trans = specs?.Transmission || {};
      if (vi.Vin) result.vin = String(vi.Vin);
      if (vi.DvlaBodyType) result.bodyType = String(vi.DvlaBodyType);
      if (trans.TransmissionType) result.transmissionType = String(trans.TransmissionType);
      const co2 = specs?.VehicleExciseDutyDetails?.DvlaCo2 ?? specs?.Emissions?.ManufacturerCo2;
      if (num(co2) != null) result.co2Emissions = num(co2);
      if (num(perf?.Power?.Bhp) != null) result.bhp = num(perf?.Power?.Bhp);
      /* Spec model string is richer than the registration one — keep both,
       * prefer the detailed model for display when present. */
      if (model.Model && !result.model) result.model = String(model.Model);
      if (!result.firstRegistration && vi.DateFirstRegistered) result.firstRegistration = String(vi.DateFirstRegistered);
    } catch { /* intake still returns */ }
  }
  if (CCD_MILEAGE_URL) {
    try { const mil = await fetchJson(fillTemplate(CCD_MILEAGE_URL, vrm)); attachMileageRecords(result, mil); } catch { /* intake still returns */ }
  }
  return result;
}

async function lookupDvla(vrm: string): Promise<RegLookupResult> {
  const res = await fetch(`${DVLA_HOST}/vehicle-enquiry/v1/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ registrationNumber: vrm }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const err: any = new Error(res.status === 404 ? 'Vehicle not found' : `DVLA lookup failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const d = await res.json();
  return {
    provider: 'dvla',
    registration: String(d.registrationNumber || vrm),
    make: d.make ? String(d.make) : undefined,
    /* DVLA VES returns no model and no VIN — by spec. */
    colour: d.colour ? String(d.colour) : undefined,
    fuelType: d.fuelType ? String(d.fuelType) : undefined,
    engineCapacity: num(d.engineCapacity),
    yearOfManufacture: num(d.yearOfManufacture),
    firstRegistration: d.monthOfFirstRegistration || undefined,
    motStatus: d.motStatus || undefined,
    motExpiryDate: d.motExpiryDate || undefined,
    taxStatus: d.taxStatus || undefined,
    taxDueDate: d.taxDueDate || undefined,
    markedForExport: !!d.markedForExport,
  };
}

/* ---------- mock (demo mode — deterministic per plate, zero cost) ---------- */

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const MOCK_MAKES: Array<[string, string[]]> = [
  ['FORD', ['FIESTA', 'FOCUS', 'PUMA', 'KUGA', 'RANGER']],
  ['VOLKSWAGEN', ['GOLF', 'POLO', 'TIGUAN', 'T-ROC']],
  ['VAUXHALL', ['CORSA', 'ASTRA', 'MOKKA', 'CROSSLAND']],
  ['BMW', ['1 SERIES', '3 SERIES', 'X1', 'X3']],
  ['MERCEDES-BENZ', ['A CLASS', 'C CLASS', 'GLA', 'GLC']],
  ['AUDI', ['A1', 'A3', 'Q2', 'Q3']],
  ['TOYOTA', ['YARIS', 'COROLLA', 'C-HR', 'RAV4']],
  ['NISSAN', ['JUKE', 'QASHQAI', 'MICRA', 'X-TRAIL']],
  ['KIA', ['PICANTO', 'SPORTAGE', 'CEED', 'STONIC']],
  ['HYUNDAI', ['I10', 'TUCSON', 'KONA', 'I30']],
];
const MOCK_COLOURS = ['BLACK', 'WHITE', 'GREY', 'BLUE', 'RED', 'SILVER'];
const MOCK_FUELS = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRICITY'];

function lookupMock(vrm: string): RegLookupResult {
  const h = fnv(vrm);
  const [make, models] = MOCK_MAKES[h % MOCK_MAKES.length];
  const model = models[(h >> 4) % models.length];
  const year = 2015 + (h % 10);
  const mileageBase = 18000 + (h % 90000);
  const motValid = h % 5 !== 0;
  const nextYear = new Date().getFullYear() + 1;
  const advisories = h % 3 === 0
    ? ['Front brake pads worn close to limit', 'Nearside front tyre worn close to legal limit']
    : [];
  return {
    provider: 'mock',
    registration: vrm,
    make,
    model,
    colour: MOCK_COLOURS[(h >> 8) % MOCK_COLOURS.length],
    fuelType: MOCK_FUELS[(h >> 10) % MOCK_FUELS.length],
    engineCapacity: [999, 1197, 1498, 1968, 1995][(h >> 6) % 5],
    yearOfManufacture: year,
    firstRegistration: `${year}-0${1 + (h % 9)}`,
    motStatus: motValid ? 'Valid' : 'Not valid',
    motExpiryDate: motValid ? `${nextYear}-0${1 + (h % 9)}-15` : undefined,
    taxStatus: h % 7 === 0 ? 'Untaxed' : 'Taxed',
    taxDueDate: h % 7 === 0 ? undefined : `${nextYear}-0${1 + (h % 9)}-01`,
    markedForExport: h % 23 === 0,
    mileageAlert: h % 29 === 0,
    mileageRecords: [
      { date: `${year + 1}-05-10`, mileage: mileageBase - 24000 },
      { date: `${year + 3}-05-12`, mileage: mileageBase - 11000 },
      { date: `${year + 5}-05-14`, mileage: mileageBase },
    ],
    motHistory: [
      {
        date: `${new Date().getFullYear()}-01-10`,
        mileage: mileageBase,
        result: motValid ? 'Passed' : 'Failed',
        advisories,
        failures: motValid ? [] : ['Offside front anti-roll bar pin or bush excessively worn'],
      },
    ],
  };
}

async function lookupMockHistory(vrm: string): Promise<any> {
  const h = fnv(vrm);
  return {
    provider: 'mock',
    stolen: false,
    writeOffCategory: h % 6 === 0 ? 'CAT N' : undefined,
    financeOutstanding: h % 5 === 0,
    keepers: 1 + (h % 4),
    exTaxiOrFleet: h % 11 === 0,
    plateChanges: h % 7 === 0 ? 1 : 0,
    note: 'Simulated history check (demo).',
  };
}

/* ---------- public entry points ---------- */

export async function lookupRegistration(registration: string): Promise<RegLookupResult> {
  const vrm = normalizeVrm(registration);
  if (!isValidVrm(vrm)) {
    const err: any = new Error('Invalid registration format');
    err.status = 400;
    throw err;
  }
  switch (PROVIDER) {
    case 'checkcardetails': return lookupCheckCarDetails(vrm);
    case 'dvla': return lookupDvla(vrm);
    case 'mock': return lookupMock(vrm);
    default: {
      const err: any = new Error('Registration lookup is not configured');
      err.status = 503;
      throw err;
    }
  }
}

export async function lookupCarHistory(registration: string): Promise<any> {
  if (!historyCheckEnabled()) {
    const err: any = new Error('History checks are not enabled on this instance');
    err.status = 503;
    throw err;
  }
  const vrm = normalizeVrm(registration);
  if (!isValidVrm(vrm)) {
    const err: any = new Error('Invalid registration format');
    err.status = 400;
    throw err;
  }
  if (PROVIDER === 'mock') return lookupMockHistory(vrm);
  if (!CCD_HISTORY_URL) {
    const err: any = new Error('History endpoint not configured');
    err.status = 503;
    throw err;
  }
  const data = await fetchJson(fillTemplate(CCD_HISTORY_URL, vrm));
  return { provider: 'checkcardetails', ...(data || {}) };
}
