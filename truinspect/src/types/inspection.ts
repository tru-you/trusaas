export type InspectionStatus =
  | 'OK' | 'DAMAGED'
  | 'PRESENT' | 'NOT_PRESENT'
  | 'VALID' | 'EXPIRED' | 'MISSING'
  | 'FSH' | 'PARTIAL' | 'NO_BOOK';

export type InspectionCondition = 'Good' | 'Fair' | 'Poor' | 'Needs Recon';

export type ItemType = 'visual_panel' | 'accessory' | 'documentation' | 'verification';

export type ItemCategory = 'Front & Engine' | 'Clockwise Exterior' | 'Interior, History & Verification';

export interface InspectionItem {
  id: string;
  label: string;
  category: ItemCategory;
  itemType: ItemType;
  status: InspectionStatus;
  condition: InspectionCondition;
  photoUrl: string | null;
  estimatedRepairCost: number;
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
}

export interface TradeInVehicleDetails {
  make: string;
  model: string;
  year: number;
  variant: string;
  mileage: number;
  vin?: string;
  overallRating: number;
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
  return [
    { value: 'OK', label: 'OK / No Damage' },
    { value: 'DAMAGED', label: 'Damaged / Needs Recon' },
  ];
}

export function needsReconCost(status: InspectionStatus): boolean {
  return status === 'DAMAGED' || status === 'NOT_PRESENT' || status === 'EXPIRED' || status === 'NO_BOOK' || status === 'MISSING';
}

export type TradeInItemDef = Pick<InspectionItem, 'id' | 'label' | 'category' | 'itemType'>;

export const TRADE_IN_ITEMS: TradeInItemDef[] = [
  // Category 1: Front & Engine
  { id: 'bonnet', label: 'Bonnet (Exterior)', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'engine_bay', label: 'Engine Bay (Under Bonnet)', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'front_bumper', label: 'Front Bumper & Grill', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'front_windscreen', label: 'Front Windscreen', category: 'Front & Engine', itemType: 'visual_panel' },
  { id: 'license_disc', label: 'License Disc & Windscreen Markings', category: 'Front & Engine', itemType: 'documentation' },

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

export function createDefaultItems(): InspectionItem[] {
  return TRADE_IN_ITEMS.map((def) => ({
    ...def,
    status: def.itemType === 'accessory' ? 'PRESENT' as InspectionStatus :
            def.id === 'license_disc' ? 'VALID' as InspectionStatus :
            def.id === 'service_book' ? 'FSH' as InspectionStatus :
            'OK' as InspectionStatus,
    condition: 'Good' as InspectionCondition,
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
  let penalty = 0;
  for (const item of items) {
    if (item.status === 'DAMAGED' || item.status === 'EXPIRED' || item.status === 'NO_BOOK') {
      penalty += 0.5;
    } else if (item.status === 'NOT_PRESENT' || item.status === 'MISSING') {
      penalty += 0.3;
    } else if (item.status === 'PARTIAL') {
      penalty += 0.15;
    }
    if (item.condition === 'Poor' || item.condition === 'Needs Recon') {
      penalty += 0.3;
    } else if (item.condition === 'Fair') {
      penalty += 0.1;
    }
  }
  return Math.max(1.0, Math.round((5.0 - Math.min(4.0, penalty)) * 10) / 10);
}
