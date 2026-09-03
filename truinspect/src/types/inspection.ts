export type InspectionStatus =
  | 'OK' | 'DAMAGED'
  | 'PRESENT' | 'NOT_PRESENT'
  | 'VALID' | 'EXPIRED' | 'MISSING'
  | 'FSH' | 'PARTIAL' | 'NO_BOOK'
  | 'MATCHES' | 'MISMATCH' | 'NOT_FOUND';

export type InspectionCondition = 'Showroom' | 'Good' | 'Average' | 'Poor' | 'New' | 'Used' | 'Needs Replacing';

export type ItemType = 'visual_panel' | 'accessory' | 'documentation' | 'verification';

const TYRE_ITEM_IDS = new Set([
  'wheel_front_right', 'wheel_rear_right', 'wheel_rear_left', 'wheel_front_left',
  'front_wheel_brake', 'rear_wheel_chain', 'wheel_front', 'wheel_rear'
]);
export function isTyreItem(itemId: string): boolean { return TYRE_ITEM_IDS.has(itemId); }

export type ItemCategory =
  | 'Front & Engine'
  | 'Clockwise Exterior'
  | 'Interior, History & Verification'
  | 'Front & Controls'
  | 'Frame, Engine & Final Drive'
  | 'History & Documentation';

export interface InspectionItem {
  id: string;
  label: string;
  category: ItemCategory;
  itemType: ItemType;
  status: InspectionStatus;
  condition: InspectionCondition;
  photoUrl: string | null;
  estimatedRepairCost: number;
  /** Dealer's note on WHAT the recon cost covers (e.g. "Repaint front bumper").
   *  Entered when the item is flagged for recon; printed under the item's line
   *  in the report's valuation build-up. Optional — legacy saved items omit it. */
  reconNote?: string;
  /** Service book specific fields */
  lastServicedDate?: string;
  serviceDue?: boolean;
  serviceComments?: string;
  /** Tyre tread depth in mm — only on wheel/tyre items. */
  treadDepth?: number;
  isCompleted: boolean;
}

export interface ValuationSnapshot {
  price: number;
  listingsFound: number;
  sources: string[];
  scrapedAt: string;
}

export interface ValuationState {
  averageRetailPrice: number | null;
  totalReconCost: number;
  marginPercentage: number;
  finalTradeInValue: number;
  fallbackRequired: boolean;
  searchUrl?: string;
  history?: ValuationSnapshot[];
  /** Market currency the estimate came back in (R/£/$) — carried from the
   *  valuation response so saved appraisals render in the right money. */
  currency?: string;
  /** Odometer unit the source market speaks in (km default, mi for UK/US). */
  distanceUnit?: 'km' | 'mi';
}

export interface TradeInVehicleDetails {
  make: string;
  model: string;
  year: number;
  variant: string;
  mileage: number;
  vin?: string;
  overallRating: number;
  isSmokerVehicle?: boolean;
}

export interface TradeInDealerDetails {
  dealershipName: string;
  inspectorName: string;
  contactPhone: string;
  digitalSignatureUrl: string | null;
}

export interface TradeInData {
  inspectionId: string;
  vehicleDetails: TradeInVehicleDetails;
  dealerDetails: TradeInDealerDetails;
  valuation: ValuationState;
  items: InspectionItem[];
}

/**
 * The Inspect VIR and the Trade-In Appraisal are two different documents for
 * the same vehicle, but both used to call this with no prefix argument and
 * print the identical id — a buyer or finance house citing "TI-ABC123" had no
 * way to say which of the two reports they meant. `prefix` defaults to 'TI'
 * so existing trade-in report ids on disk don't change; TruInspect's own VIR
 * report passes 'VIR' explicitly.
 */
export function deriveReportId(vehicle: { stockNumber?: string; id: string }, prefix: string = 'TI'): string {
  return `${prefix}-${(vehicle.stockNumber || vehicle.id).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;
}

export interface StatusOption {
  value: InspectionStatus;
  label: string;
}

export function getStatusOptions(itemId: string): StatusOption[] {
  if (itemId === 'license_disc') {
    return [
      { value: 'VALID', label: 'Valid / Up to Date' },
      { value: 'EXPIRED', label: 'Expired / Arrears' },
      { value: 'MISSING', label: 'Missing' },
    ];
  }
  if (itemId === 'service_book') {
    return [
      { value: 'FSH', label: 'Full Service History (FSH)' },
      { value: 'PARTIAL', label: 'Partial History' },
      { value: 'NO_BOOK', label: 'No Book / Untracked' },
    ];
  }
  if (itemId === 'spare_wheel' || itemId === 'vehicle_jack' || itemId === 'spare_keys') {
    return [
      { value: 'PRESENT', label: 'Present' },
      { value: 'NOT_PRESENT', label: 'Not Present' },
    ];
  }
  if (itemId === 'vin_plate') {
    return [
      { value: 'MATCHES', label: 'Matches' },
      { value: 'MISMATCH', label: "Doesn't Match" },
      { value: 'NOT_FOUND', label: 'Not Found' },
    ];
  }
  return [
    { value: 'OK', label: 'OK / No Damage' },
    { value: 'DAMAGED', label: 'Damaged / Needs Recon' },
  ];
}

export function needsReconCost(status: InspectionStatus): boolean {
  return status === 'DAMAGED' || status === 'NOT_PRESENT' || status === 'EXPIRED' || status === 'NO_BOOK' || status === 'MISSING' || status === 'MISMATCH' || status === 'NOT_FOUND';
}

export interface ConditionOption {
  value: InspectionCondition;
  label: string;
}

export function getConditionOptions(itemId: string): ConditionOption[] {
  if (isTyreItem(itemId)) {
    return [
      { value: 'New', label: 'New' },
      { value: 'Used', label: 'Used' },
      { value: 'Needs Replacing', label: 'Needs Replacing' },
    ];
  }
  return [
    { value: 'Showroom', label: 'Showroom' },
    { value: 'Good', label: 'Good' },
    { value: 'Average', label: 'Average' },
    { value: 'Poor', label: 'Poor' },
  ];
}

export type TradeInItemDef = Pick<InspectionItem, 'id' | 'label' | 'category' | 'itemType'>;

export const TRADE_IN_ITEMS: TradeInItemDef[] = [
  // Category 1: Front & Engine
  { id: 'bonnet', label: 'Bonnet (Exterior)', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'engine_bay', label: 'Engine Bay (Under Bonnet)', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'front_bumper', label: 'Front Bumper & Grill', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'front_windscreen', label: 'Front Windscreen', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'license_disc', label: 'License Disc & Windscreen Markings', category: 'Front & Engine', itemType: 'documentation' },
  { id: 'vin_plate', label: 'VIN Number Plate (dashboard or door jamb)', category: 'Front & Engine', itemType: 'verification' },

  // Category 2: Clockwise Exterior Walk-Around
  { id: 'fender_front_right', label: 'Front Right Wing / Fender', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'wheel_front_right', label: 'Front Right Wheel & Tyre', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'door_front_right', label: 'Driver Door & Side Mirror', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'door_rear_right', label: 'Rear Right Door', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'quarter_rear_right', label: 'Rear Right Quarter Panel', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'wheel_rear_right', label: 'Rear Right Wheel & Tyre', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'boot_tailgate', label: 'Boot Exterior / Tailgate', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'rear_bumper', label: 'Rear Bumper', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'spare_wheel', label: 'Spare Wheel & Boot Floor Tray', category: 'Clockwise Exterior', itemType: 'accessory' },
  { id: 'vehicle_jack', label: 'Jack, Spanner & Tool Kit', category: 'Clockwise Exterior', itemType: 'accessory' },
  { id: 'quarter_rear_left', label: 'Rear Left Quarter Panel', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'wheel_rear_left', label: 'Rear Left Wheel & Tyre', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'door_rear_left', label: 'Rear Left Door', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'door_front_left', label: 'Front Left Door & Side Mirror', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'fender_front_left', label: 'Front Left Wing / Fender', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'wheel_front_left', label: 'Front Left Wheel & Tyre', category: 'Clockwise Exterior', itemType: 'visual_panel' },
  { id: 'roof_sunroof', label: 'Roof & Sunroof', category: 'Clockwise Exterior', itemType: 'visual_panel' },

  // Category 3: Interior, History & Verification
  { id: 'steering_wheel', label: 'Steering Wheel, Stalks & Controls', category: 'Interior, History & Verification', itemType: 'visual_panel' },
  { id: 'interior_cabin', label: 'Seats, Dash, Carpets & Trim', category: 'Interior, History & Verification', itemType: 'visual_panel' },
  { id: 'service_book', label: 'Service Book & Maintenance Records', category: 'Interior, History & Verification', itemType: 'documentation' },
  { id: 'odometer', label: 'Odometer Display (Mileage Verification)', category: 'Interior, History & Verification', itemType: 'verification' },
  { id: 'spare_keys', label: 'Spare Keys & Remote Transponders', category: 'Interior, History & Verification', itemType: 'accessory' },
];

export const MOTO_TRADE_IN_ITEMS: TradeInItemDef[] = [
  // Category 1: Front & Controls
  { id: 'front_wheel_brake', label: 'Front Wheel, Tyre & Calipers', category: 'Front & Controls', itemType: 'visual_panel' },
  { id: 'front_forks', label: 'Front Forks & Stanchions', category: 'Front & Controls', itemType: 'visual_panel' },
  { id: 'cockpit_handlebars', label: 'Handlebars, Grips & Levers', category: 'Front & Controls', itemType: 'visual_panel' },
  { id: 'mirrors_lights', label: 'Mirrors, Headlight & Indicators', category: 'Front & Controls', itemType: 'visual_panel' },
  { id: 'odometer', label: 'Odometer & Instrument Cluster', category: 'Front & Controls', itemType: 'verification' },

  // Category 2: Frame, Engine & Final Drive
  { id: 'fuel_tank', label: 'Fuel Tank & Fairings / Bodywork', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'engine_left', label: 'Engine Left Side & Shifter', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'engine_right', label: 'Engine Right Side & Rear Brake', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'exhaust_silencer', label: 'Exhaust Headers & Silencer', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'frame_swingarm', label: 'Frame, Headstock & Swingarm', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'rear_wheel_chain', label: 'Rear Wheel, Tyre & Drive Chain / Sprockets', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'rear_suspension', label: 'Rear Suspension / Monoshock', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },
  { id: 'rear_tail', label: 'Rear Tail, Brake Light & Plate Mount', category: 'Frame, Engine & Final Drive', itemType: 'visual_panel' },

  // Category 3: History & Documentation
  { id: 'license_disc', label: 'License Disc & Roadworthy', category: 'History & Documentation', itemType: 'documentation' },
  { id: 'vin_plate', label: 'VIN / Frame Stamping Verification', category: 'History & Documentation', itemType: 'verification' },
  { id: 'service_book', label: 'Service Book & Invoices', category: 'History & Documentation', itemType: 'documentation' },
  { id: 'spare_keys', label: 'Spare Keys & Tool Kit', category: 'History & Documentation', itemType: 'accessory' },
];

export function getTradeInItems(vertical?: string | null): TradeInItemDef[] {
  return vertical === 'moto' ? MOTO_TRADE_IN_ITEMS : TRADE_IN_ITEMS;
}

export function createDefaultItems(vertical?: string | null): InspectionItem[] {
  const items = getTradeInItems(vertical);
  return items.map((def) => ({
    ...def,
    status: def.itemType === 'accessory' ? 'PRESENT' as InspectionStatus :
            def.id === 'license_disc' ? 'VALID' as InspectionStatus :
            def.id === 'service_book' ? 'FSH' as InspectionStatus :
            def.id === 'vin_plate' ? 'MATCHES' as InspectionStatus :
            'OK' as InspectionStatus,
    condition: (isTyreItem(def.id) ? 'Used' : 'Good') as InspectionCondition,
    photoUrl: null,
    estimatedRepairCost: 0,
    isCompleted: false,
  }));
}

export function computeTradeInValue(
  averageRetailPrice: number | null,
  totalReconCost: number,
  marginPercentage: number,
): number {
  if (averageRetailPrice === null || averageRetailPrice <= 0) return 0;
  return Math.round((averageRetailPrice - totalReconCost) * (1 - marginPercentage / 100));
}

export function computeOverallRating(items: InspectionItem[]): number {
  if (items.length === 0) return 5.0;
  const penalties: number[] = [];
  for (const item of items) {
    // Status is the primary fault signal.
    if (item.status === 'DAMAGED' || item.status === 'EXPIRED' || item.status === 'NO_BOOK' || item.status === 'MISMATCH') {
      penalties.push(0.5);
    } else if (item.status === 'NOT_PRESENT' || item.status === 'MISSING' || item.status === 'NOT_FOUND') {
      penalties.push(0.25);
    } else if (item.status === 'PARTIAL') {
      penalties.push(0.15);
    }
    // Condition only adds on top for a genuinely poor item, and never double
    // counts a DAMAGED status (the fault is already captured above).
    if ((item.condition === 'Poor' || item.condition === 'Needs Replacing') && item.status !== 'DAMAGED') {
      penalties.push(0.2);
    }
    // 'Average' is normal for a used car — not a fault, so no penalty.
  }
  // Diminishing returns: the worst fault counts fully, each further one less,
  // so many minor notes don't collapse a car to 1/5.
  penalties.sort((a, b) => b - a);
  const penalty = penalties.reduce((s, p, i) => s + p / (i + 1), 0);
  return Math.max(1.0, Math.round((5.0 - Math.min(4.0, penalty)) * 10) / 10);
}
