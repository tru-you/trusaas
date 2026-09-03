/**
 * Vertical display & configuration layer — the shared vertical substrate.
 *
 * One source of truth for asset vocabulary, measurement units, inspection
 * templates, and booking terminology across TruDealer verticals (Auto, Moto,
 * Marine, Trucks, Caravans).
 *
 * Synced into consuming apps via sync:ui — edit ONLY here, app copies get clobbered.
 *
 * Client-safe by design: no node built-ins, no imports.
 */

export type VerticalId = 'cars' | 'moto' | 'marine' | 'trucks' | 'caravans';

export interface VerticalConfig {
  id: VerticalId;
  label: string;
  assetNoun: string;            // "Vehicle" | "Motorcycle" | "Boat" | "Truck" | "Caravan"
  pluralAssetNoun: string;      // "Vehicles" | "Motorcycles" | "Boats" | "Trucks" | "Caravans"
  identifierLabel: string;      // "VIN" | "VIN / Frame #" | "Hull ID (HIN)" | "VIN / Chassis #"
  usageUnit: 'km' | 'mi' | 'hrs' | 'none';
  usageLabel: string;           // "Odometer" | "Engine Hours" | "Operating Hours"
  testDriveLabel: string;       // "Test Drive" | "Demo Ride" | "Sea Trial" | "Viewing / Inspection"
  testDriveVerb: string;        // "test drive" | "demo ride" | "sea trial" | "viewing"
  defaultCategory: string;      // Primary M&M / catalogue category filter
  isOdometerApplicable: boolean;
}

export const VERTICALS: Record<VerticalId, VerticalConfig> = {
  cars: {
    id: 'cars',
    label: 'TruDealer Auto',
    assetNoun: 'Vehicle',
    pluralAssetNoun: 'Vehicles',
    identifierLabel: 'VIN',
    usageUnit: 'km',
    usageLabel: 'Odometer',
    testDriveLabel: 'Test Drive',
    testDriveVerb: 'test drive',
    defaultCategory: 'PASSENGER',
    isOdometerApplicable: true,
  },
  moto: {
    id: 'moto',
    label: 'TruDealer Moto',
    assetNoun: 'Motorcycle',
    pluralAssetNoun: 'Motorcycles',
    identifierLabel: 'VIN / Frame #',
    usageUnit: 'km',
    usageLabel: 'Odometer',
    testDriveLabel: 'Demo Ride',
    testDriveVerb: 'demo ride',
    defaultCategory: 'MOTORCYCLE',
    isOdometerApplicable: true,
  },
  marine: {
    id: 'marine',
    label: 'TruDealer Marine',
    assetNoun: 'Boat / Vessel',
    pluralAssetNoun: 'Boats & Watercraft',
    identifierLabel: 'Hull ID (HIN)',
    usageUnit: 'hrs',
    usageLabel: 'Engine Hours',
    testDriveLabel: 'Sea Trial',
    testDriveVerb: 'sea trial',
    defaultCategory: 'BOAT/JETSKI',
    isOdometerApplicable: false,
  },
  trucks: {
    id: 'trucks',
    label: 'TruDealer Trucks',
    assetNoun: 'Commercial Vehicle',
    pluralAssetNoun: 'Commercial Vehicles',
    identifierLabel: 'VIN / Chassis #',
    usageUnit: 'km',
    usageLabel: 'Odometer',
    testDriveLabel: 'Inspection & Test Drive',
    testDriveVerb: 'test drive',
    defaultCategory: 'COMMERCIAL',
    isOdometerApplicable: true,
  },
  caravans: {
    id: 'caravans',
    label: 'TruDealer Caravans',
    assetNoun: 'Caravan / Trailer',
    pluralAssetNoun: 'Caravans & Trailers',
    identifierLabel: 'VIN / Chassis #',
    usageUnit: 'none',
    usageLabel: 'Condition',
    testDriveLabel: 'Viewing & Demonstration',
    testDriveVerb: 'view',
    defaultCategory: 'CARAVAN',
    isOdometerApplicable: false,
  },
};

/**
 * Resolve vertical config by id; unknown/absent ids fall back to 'cars'
 * so existing auto dealerships preserve today's exact behaviour.
 */
export function verticalById(id?: string | null): VerticalConfig {
  const key = String(id || 'cars').toLowerCase().trim() as VerticalId;
  return VERTICALS[key] || VERTICALS.cars;
}

/**
 * Common motorcycle makes in the TransUnion catalogue for rapid filtering.
 */
export const MOTO_MAKES = new Set([
  'APRILIA', 'ARCTIC CAT', 'BAJAJ', 'BB QUADS', 'BENNELLI', 'BETA RACING', 'BIG BOY', 'BIMOTA',
  'BMW', 'BOMBARDIERCANAM', 'BUYANG', 'CAGIVA', 'CLEVELAND', 'CSR', 'DAELIM', 'DAYUN', 'DAZON',
  'DERBI', 'DINLI', 'DUCATI', 'EBR', 'ELECTRIC MOTION', 'GAS GAS', 'GOES', 'GOMOTO',
  'HARLEY DAVIDSON', 'HARTFORD', 'HDZT', 'HONDA', 'HUNTER', 'HUSABERG', 'HUSQVARNA', 'HYOSUNG',
  'INDIAN', 'JAWA', 'JIALING', 'JIANSHE', 'JOHNNY PAG', 'JONWAY', 'KAWASAKI', 'KAZUMA',
  'KIDEN', 'KINETIC', 'KTM', 'KYMCO', 'LAMBRETTA', 'LAVERDA', 'LIFAN', 'LINHAI', 'LML',
  'LONCIN', 'MASAI', 'MOTO GUZZI', 'MOTO PRO', 'MOTOMIA', 'MUTT', 'MV AGUSTA', 'MZ',
  'Multiple Motorcycle Manufacturers', 'PGO', 'PIAGGIO', 'POLARIS', 'PUZEY', 'QINGQI', 'QUADRO',
  'RADICAL RIDES', 'RAIDER', 'REGARD', 'RETROQUAD', 'ROYAL ENFIELD', 'SECMA', 'SHERCO', 'SHINERAY',
  'SKYGO', 'SMC', 'STUD', 'SUMOTO', 'SUZUKI', 'SWM', 'SYM', 'TGB', 'TM RACING', 'TRIUMPH',
  'TVS', 'URAL', 'VBA', 'VESPA', 'VICTORY', 'VOR', 'VUKA', 'WARRIOR', 'X-MOTO', 'XINGYUE',
  'YAMAHA', 'YAMOTO', 'ZAHOW', 'ZERO', 'ZHEJIANG CF MOTO', 'ZHEJIANG LEIKE', 'ZHEJIANG RENLI',
  'ZHEJIANG RIYA', 'ZIPPER', 'ZONGSHEN', 'ZONTES'
]);

/**
 * Check whether a make name belongs to the motorcycle catalogue.
 */
export function isMotoMake(makeName: string): boolean {
  if (!makeName) return false;
  return MOTO_MAKES.has(makeName.toUpperCase().trim());
}
