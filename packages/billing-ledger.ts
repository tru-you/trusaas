import fs from 'fs';
import path from 'path';

export interface ApiCallDefinition {
  callType: string;
  provider: 'lexisnexis' | 'imagin8' | 'serper' | 'brightdata';
  description: string;
  wholesaleCost: number;       // Direct Imagin8/WinDeed cost in ZAR (excl VAT)
  isPlatformBundled?: boolean; // True for free flat-fee calls (makes, models, static specs)
  truDealerMarkupPct: number;  // Capped at 15% max for TruDealer contract clients
  truDataRetailPrice: number;  // Public marketplace rate
  truPropertyRetailPrice: number; // Estate agency rate
  marketBenchmarkRetail: number; // FirstCheck / WinDeed public retail price
}

export interface ApiUsageRecord {
  id: string;
  tenantId: string;        // Dealership slug, agent account ID, or TruData user email
  product: 'truflow' | 'truproperty' | 'trudata' | 'truinspect' | 'trulens' | 'trucars';
  provider: string;
  callType: string;
  description: string;
  wholesaleCost: number;
  markupPct: number;
  retailPrice: number;
  timestamp: string;
  billingCycle: string;    // Format "YYYY-MM" (Cutoff on 25th)
  metadata?: Record<string, any>;
}

export interface MonthlyBillingStatement {
  tenantId: string;
  billingCycle: string;
  dueDate: string;         // Always 25th of the month
  totalCalls: number;
  wholesaleTotal: number;
  retailTotal: number;
  marginEarned: number;
  records: ApiUsageRecord[];
}

/**
 * OFFICIAL IMAGIN8 DIGITAL INNOVATION PRICE LIST (Excl. VAT):
 * 1. Comprehensive Vehicle Report: R200.00
 * 2. Previous Accident Claims: R55.50
 * 3. Salvage Data: R67.00
 * 4. Financial Interest: R24.25
 * 5. Traffic Fines: R40.00
 * 6. SAPS Interest (Police Flag): R17.50
 * 7. Microdot Info: R17.50
 * 8. VIN Confirmation: R35.00
 * 9. ID to VIN: R97.50
 * 10. VIN to ID: R90.00
 * 11. Driver’s Licence Verification: R49.00
 * 12. Vehicle Auto-Prefill (Reg/VIN): R13.00
 */
export const API_PRICING_CATALOG: Record<string, ApiCallDefinition> = {
  // Free / Bundled Platform Endpoints (Imagin8)
  'imagin8_static': {
    callType: 'imagin8_static',
    provider: 'imagin8',
    description: 'Vehicle Specs & M&M Code Lookup',
    wholesaleCost: 0.00,
    isPlatformBundled: true,
    truDealerMarkupPct: 0,
    truDataRetailPrice: 0.00,
    truPropertyRetailPrice: 0.00,
    marketBenchmarkRetail: 0.00,
  },
  'imagin8_models': {
    callType: 'imagin8_models',
    provider: 'imagin8',
    description: 'Vehicle Catalogue Makes & Models',
    wholesaleCost: 0.00,
    isPlatformBundled: true,
    truDealerMarkupPct: 0,
    truDataRetailPrice: 0.00,
    truPropertyRetailPrice: 0.00,
    marketBenchmarkRetail: 0.00,
  },

  // Official Imagin8 Data Products (Wholesale Price List)
  'imagin8_auto_prefill': {
    callType: 'imagin8_auto_prefill',
    provider: 'imagin8',
    description: 'Vehicle Auto-Prefill from Reg or VIN',
    wholesaleCost: 13.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R14.95
    truDataRetailPrice: 22.00,
    truPropertyRetailPrice: 22.00,
    marketBenchmarkRetail: 35.00,
  },
  'imagin8_valuation': {
    callType: 'imagin8_valuation',
    provider: 'imagin8',
    description: 'TransUnion Vehicle Valuation (Retail/Trade/New)',
    wholesaleCost: 6.50,
    truDealerMarkupPct: 15,        // TruDealer Billed: R7.48
    truDataRetailPrice: 14.99,     // FirstCheck R19.00
    truPropertyRetailPrice: 14.99,
    marketBenchmarkRetail: 19.00,
  },
  'imagin8_saps_interest': {
    callType: 'imagin8_saps_interest',
    provider: 'imagin8',
    description: 'SAPS Police Interest Stolen Vehicle Flag',
    wholesaleCost: 17.50,
    truDealerMarkupPct: 15,        // TruDealer Billed: R20.13
    truDataRetailPrice: 29.00,
    truPropertyRetailPrice: 29.00,
    marketBenchmarkRetail: 45.00,
  },
  'imagin8_microdot': {
    callType: 'imagin8_microdot',
    provider: 'imagin8',
    description: 'Microdot Information Record',
    wholesaleCost: 17.50,
    truDealerMarkupPct: 15,        // TruDealer Billed: R20.13
    truDataRetailPrice: 29.00,
    truPropertyRetailPrice: 29.00,
    marketBenchmarkRetail: 45.00,
  },
  'imagin8_financial_interest': {
    callType: 'imagin8_financial_interest',
    provider: 'imagin8',
    description: 'Outstanding Bank Finance / Settlement Interest Check',
    wholesaleCost: 24.25,
    truDealerMarkupPct: 15,        // TruDealer Billed: R27.89
    truDataRetailPrice: 39.00,
    truPropertyRetailPrice: 39.00,
    marketBenchmarkRetail: 65.00,
  },
  'imagin8_vin_confirm': {
    callType: 'imagin8_vin_confirm',
    provider: 'imagin8',
    description: 'VIN Record Confirmation Check',
    wholesaleCost: 35.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R40.25
    truDataRetailPrice: 55.00,
    truPropertyRetailPrice: 55.00,
    marketBenchmarkRetail: 75.00,
  },
  'imagin8_traffic_fines': {
    callType: 'imagin8_traffic_fines',
    provider: 'imagin8',
    description: 'Outstanding Traffic Fines Search',
    wholesaleCost: 40.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R46.00
    truDataRetailPrice: 65.00,
    truPropertyRetailPrice: 65.00,
    marketBenchmarkRetail: 90.00,
  },
  'imagin8_drivers_licence': {
    callType: 'imagin8_drivers_licence',
    provider: 'imagin8',
    description: 'Driver Licence Verification Check',
    wholesaleCost: 49.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R56.35
    truDataRetailPrice: 79.00,
    truPropertyRetailPrice: 79.00,
    marketBenchmarkRetail: 110.00,
  },
  'imagin8_accident': {
    callType: 'imagin8_accident',
    provider: 'imagin8',
    description: 'Previous Insurance Accident Claims History',
    wholesaleCost: 55.50,
    truDealerMarkupPct: 15,        // TruDealer Billed: R63.83
    truDataRetailPrice: 89.00,
    truPropertyRetailPrice: 89.00,
    marketBenchmarkRetail: 149.00,
  },
  'imagin8_salvage': {
    callType: 'imagin8_salvage',
    provider: 'imagin8',
    description: 'Salvage & Code 3 Write-Off Record Check',
    wholesaleCost: 67.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R77.05
    truDataRetailPrice: 99.00,
    truPropertyRetailPrice: 99.00,
    marketBenchmarkRetail: 165.00,
  },
  'imagin8_vin_to_id': {
    callType: 'imagin8_vin_to_id',
    provider: 'imagin8',
    description: 'VIN to Registered Owner Identity Search',
    wholesaleCost: 90.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R103.50
    truDataRetailPrice: 145.00,
    truPropertyRetailPrice: 145.00,
    marketBenchmarkRetail: 220.00,
  },
  'imagin8_id_to_vin': {
    callType: 'imagin8_id_to_vin',
    provider: 'imagin8',
    description: 'SA ID Number to Registered VIN(s) Asset Search',
    wholesaleCost: 97.50,
    truDealerMarkupPct: 15,        // TruDealer Billed: R112.13
    truDataRetailPrice: 159.00,
    truPropertyRetailPrice: 159.00,
    marketBenchmarkRetail: 250.00,
  },
  'imagin8_comprehensive': {
    callType: 'imagin8_comprehensive',
    provider: 'imagin8',
    description: 'Comprehensive Consolidated Vehicle Dossier',
    wholesaleCost: 200.00,
    truDealerMarkupPct: 15,        // TruDealer Billed: R230.00
    truDataRetailPrice: 299.00,
    truPropertyRetailPrice: 299.00,
    marketBenchmarkRetail: 450.00,
  },

  // WinDeed / LexisNexis Endpoints
  'lexisnexis_cipc': {
    callType: 'lexisnexis_cipc',
    provider: 'lexisnexis',
    description: 'CIPC Company & Director Report',
    wholesaleCost: 12.00,
    truDealerMarkupPct: 15,
    truDataRetailPrice: 18.50,
    truPropertyRetailPrice: 18.50,
    marketBenchmarkRetail: 20.49,
  },
  'lexisnexis_deeds_property': {
    callType: 'lexisnexis_deeds_property',
    provider: 'lexisnexis',
    description: 'Deeds Office Property Ownership Report',
    wholesaleCost: 18.00,
    truDealerMarkupPct: 15,
    truDataRetailPrice: 26.00,
    truPropertyRetailPrice: 25.00,
    marketBenchmarkRetail: 29.52,
  },
  'lexisnexis_deeds_person': {
    callType: 'lexisnexis_deeds_person',
    provider: 'lexisnexis',
    description: 'Deeds Office Person Property Search',
    wholesaleCost: 18.00,
    truDealerMarkupPct: 15,
    truDataRetailPrice: 26.00,
    truPropertyRetailPrice: 25.00,
    marketBenchmarkRetail: 29.52,
  },
  'lexisnexis_id_verify': {
    callType: 'lexisnexis_id_verify',
    provider: 'lexisnexis',
    description: 'Home Affairs SA ID Verification (FICA Check)',
    wholesaleCost: 8.00,
    truDealerMarkupPct: 15,
    truDataRetailPrice: 12.50,
    truPropertyRetailPrice: 12.50,
    marketBenchmarkRetail: 15.19,
  },
};

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'api-billing-ledger.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

function loadLedger(): ApiUsageRecord[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveLedger(records: ApiUsageRecord[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(records, null, 2));
  } catch (err) {
    console.error('[BillingLedger] Failed to save ledger:', err);
  }
}

export function getBillingCycle(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();

  if (day > 25) {
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function recordApiUsage(
  tenantId: string,
  product: ApiUsageRecord['product'],
  callType: string,
  customWholesaleCost?: number,
  metadata?: Record<string, any>
): ApiUsageRecord {
  const records = loadLedger();
  const item = API_PRICING_CATALOG[callType];

  if (item?.isPlatformBundled) {
    const now = new Date();
    return {
      id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenantId: tenantId.toLowerCase().trim(),
      product,
      provider: item.provider,
      callType,
      description: item.description,
      wholesaleCost: 0,
      markupPct: 0,
      retailPrice: 0,
      timestamp: now.toISOString(),
      billingCycle: getBillingCycle(now),
      metadata: { ...metadata, bundled: true },
    };
  }

  const wholesaleCost = customWholesaleCost ?? item?.wholesaleCost ?? 10.00;
  const isTruDealerProduct = product === 'truflow' || product === 'trucars' || product === 'trulens' || product === 'truinspect';

  let retailPrice: number;
  let markupPct: number;

  if (isTruDealerProduct) {
    markupPct = item?.truDealerMarkupPct ?? 15;
    retailPrice = Math.round(wholesaleCost * (1 + markupPct / 100) * 100) / 100;
  } else if (product === 'truproperty') {
    retailPrice = item?.truPropertyRetailPrice ?? Math.round(wholesaleCost * 1.35 * 100) / 100;
    markupPct = Math.round(((retailPrice - wholesaleCost) / wholesaleCost) * 100);
  } else {
    retailPrice = item?.truDataRetailPrice ?? Math.round(wholesaleCost * 1.45 * 100) / 100;
    markupPct = Math.round(((retailPrice - wholesaleCost) / wholesaleCost) * 100);
  }

  const description = item?.description || callType;
  const provider = item?.provider || 'api';

  const now = new Date();
  const record: ApiUsageRecord = {
    id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tenantId: tenantId.toLowerCase().trim(),
    product,
    provider,
    callType,
    description,
    wholesaleCost,
    markupPct,
    retailPrice,
    timestamp: now.toISOString(),
    billingCycle: getBillingCycle(now),
    metadata: {
      ...metadata,
      marketBenchmarkRetail: item?.marketBenchmarkRetail,
      savingsVsPublicRetail: item ? Math.round((item.marketBenchmarkRetail - retailPrice) * 100) / 100 : 0,
    },
  };

  records.push(record);
  saveLedger(records);

  console.log(`[BillingLedger] Recorded ${callType} for ${tenantId} (${product}): Billed R${retailPrice.toFixed(2)} (Cost R${wholesaleCost.toFixed(2)}, Markup ${markupPct}%)`);
  return record;
}

export function getMonthlyStatement(tenantId: string, billingCycle?: string): MonthlyBillingStatement {
  const cycle = billingCycle || getBillingCycle();
  const records = loadLedger().filter(
    r => r.tenantId === tenantId.toLowerCase().trim() && r.billingCycle === cycle
  );

  const totalCalls = records.length;
  const wholesaleTotal = records.reduce((sum, r) => sum + r.wholesaleCost, 0);
  const retailTotal = records.reduce((sum, r) => sum + r.retailPrice, 0);
  const marginEarned = retailTotal - wholesaleTotal;

  const [y, m] = cycle.split('-');
  const dueDate = `${y}-${m}-25`;

  return {
    tenantId,
    billingCycle: cycle,
    dueDate,
    totalCalls,
    wholesaleTotal: Math.round(wholesaleTotal * 100) / 100,
    retailTotal: Math.round(retailTotal * 100) / 100,
    marginEarned: Math.round(marginEarned * 100) / 100,
    records,
  };
}
