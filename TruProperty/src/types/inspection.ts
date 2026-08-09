export type InspectionStatus =
  | 'OK' | 'DAMAGED'
  | 'PRESENT' | 'NOT_PRESENT'
  | 'VALID' | 'EXPIRED' | 'MISSING'
  | 'COMPLIANT' | 'NON_COMPLIANT';

export type InspectionCondition = 'Good' | 'Fair' | 'Poor' | 'Needs Repair';

export type ItemType = 'visual_area' | 'fixture' | 'documentation' | 'system';

export type ItemCategory = 'Exterior' | 'Living Areas' | 'Bedrooms & Bathrooms' | 'Systems & Documents';

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

export interface ValuationState {
  averageMarketPrice: number | null;
  totalReconCost: number;
  marginPercentage: number;
  finalValue: number;
  fallbackRequired: boolean;
  searchUrl?: string;
}

export interface PropertyDetails {
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  suburb?: string;
  yearBuilt?: number;
  erfNumber?: string;
  floorArea?: number;
  overallRating: number;
}

export interface AgentDetails {
  agencyName?: string;
  inspectorName: string;
  contactPhone: string;
  digitalSignatureUrl: string | null;
}

export interface InspectionData {
  inspectionId: string;
  propertyDetails: PropertyDetails;
  agentDetails: AgentDetails;
  valuation: ValuationState;
  items: InspectionItem[];
}

export function deriveReportId(property: { address?: string; id: string }, prefix: string = 'PI'): string {
  return `${prefix}-${(property.address || property.id).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;
}

export interface StatusOption {
  value: InspectionStatus;
  label: string;
}

export function getStatusOptions(itemId: string): StatusOption[] {
  if (itemId === 'rates_bill' || itemId === 'coc_electrical' || itemId === 'coc_plumbing') {
    return [
      { value: 'VALID', label: 'Valid / Current' },
      { value: 'EXPIRED', label: 'Expired / Outdated' },
      { value: 'MISSING', label: 'Missing / Not Provided' },
    ];
  }
  if (itemId === 'db_board' || itemId === 'geyser' || itemId === 'plumbing') {
    return [
      { value: 'COMPLIANT', label: 'Compliant' },
      { value: 'NON_COMPLIANT', label: 'Non-Compliant / Faulty' },
      { value: 'MISSING', label: 'Unable to Access' },
    ];
  }
  return [
    { value: 'OK', label: 'OK / Good Condition' },
    { value: 'DAMAGED', label: 'Damaged / Needs Repair' },
  ];
}

export function needsReconCost(status: InspectionStatus): boolean {
  return status === 'DAMAGED' || status === 'EXPIRED' || status === 'NON_COMPLIANT' || status === 'MISSING';
}

export type InspectionItemDef = Pick<InspectionItem, 'id' | 'label' | 'category' | 'itemType'>;

export const INSPECTION_ITEMS: InspectionItemDef[] = [
  // Category 1: Exterior
  { id: 'front_elevation', label: 'Front Elevation', category: 'Exterior', itemType: 'visual_area' },
  { id: 'rear_elevation', label: 'Rear Elevation', category: 'Exterior', itemType: 'visual_area' },
  { id: 'left_elevation', label: 'Left Elevation', category: 'Exterior', itemType: 'visual_area' },
  { id: 'right_elevation', label: 'Right Elevation', category: 'Exterior', itemType: 'visual_area' },
  { id: 'roof_overall', label: 'Roof (Overall)', category: 'Exterior', itemType: 'visual_area' },
  { id: 'gutters_fascias', label: 'Gutters & Fascias', category: 'Exterior', itemType: 'visual_area' },
  { id: 'garden_yard', label: 'Garden / Yard', category: 'Exterior', itemType: 'visual_area' },
  { id: 'pool_patio', label: 'Pool / Patio Area', category: 'Exterior', itemType: 'fixture' },
  { id: 'driveway_garage', label: 'Driveway & Garage', category: 'Exterior', itemType: 'visual_area' },
  { id: 'boundary_walls', label: 'Boundary Walls & Fencing', category: 'Exterior', itemType: 'visual_area' },

  // Category 2: Living Areas
  { id: 'entrance_hall', label: 'Entrance / Hallway', category: 'Living Areas', itemType: 'visual_area' },
  { id: 'lounge', label: 'Lounge / Living Room', category: 'Living Areas', itemType: 'visual_area' },
  { id: 'dining', label: 'Dining Room', category: 'Living Areas', itemType: 'visual_area' },
  { id: 'kitchen_wide', label: 'Kitchen (Wide)', category: 'Living Areas', itemType: 'visual_area' },
  { id: 'kitchen_cabinets', label: 'Kitchen Cabinets & Counters', category: 'Living Areas', itemType: 'fixture' },
  { id: 'kitchen_appliances', label: 'Stove, Oven & Appliances', category: 'Living Areas', itemType: 'fixture' },
  { id: 'scullery_laundry', label: 'Scullery / Laundry', category: 'Living Areas', itemType: 'visual_area' },

  // Category 3: Bedrooms & Bathrooms
  { id: 'main_bedroom', label: 'Main Bedroom', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },
  { id: 'ensuite', label: 'En-Suite Bathroom', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },
  { id: 'bedroom_2', label: 'Bedroom 2', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },
  { id: 'bedroom_3', label: 'Bedroom 3', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },
  { id: 'main_bathroom', label: 'Main Bathroom', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },
  { id: 'guest_wc', label: 'Guest WC / Powder Room', category: 'Bedrooms & Bathrooms', itemType: 'visual_area' },

  // Category 4: Systems & Documents
  { id: 'db_board', label: 'Electrical DB Board', category: 'Systems & Documents', itemType: 'system' },
  { id: 'geyser', label: 'Geyser / Hot Water', category: 'Systems & Documents', itemType: 'system' },
  { id: 'plumbing', label: 'Plumbing Under Sinks', category: 'Systems & Documents', itemType: 'system' },
  { id: 'windows_frames', label: 'Window Frames & Seals', category: 'Systems & Documents', itemType: 'fixture' },
  { id: 'floor_closeup', label: 'Floor Condition (Close-Up)', category: 'Systems & Documents', itemType: 'visual_area' },
  { id: 'ceiling_condition', label: 'Ceiling Condition', category: 'Systems & Documents', itemType: 'visual_area' },
  { id: 'built_in_cupboards', label: 'Built-In Cupboards', category: 'Systems & Documents', itemType: 'fixture' },
  { id: 'rates_bill', label: 'Municipal Rates Bill', category: 'Systems & Documents', itemType: 'documentation' },
  { id: 'coc_electrical', label: 'Electrical COC', category: 'Systems & Documents', itemType: 'documentation' },
];

export function createDefaultItems(): InspectionItem[] {
  return INSPECTION_ITEMS.map((def) => ({
    ...def,
    status: def.itemType === 'documentation' ? 'VALID' as InspectionStatus :
            def.itemType === 'system' ? 'COMPLIANT' as InspectionStatus :
            'OK' as InspectionStatus,
    condition: 'Good' as InspectionCondition,
    photoUrl: null,
    estimatedRepairCost: 0,
    isCompleted: false,
  }));
}

export function computeTradeInValue(
  averageMarketPrice: number | null,
  totalReconCost: number,
  marginPercentage: number,
): number {
  if (averageMarketPrice === null || averageMarketPrice <= 0) return 0;
  return Math.round((averageMarketPrice - totalReconCost) * (1 - marginPercentage / 100));
}

export function computeOverallRating(items: InspectionItem[]): number {
  if (items.length === 0) return 5.0;
  let penalty = 0;
  for (const item of items) {
    if (item.status === 'DAMAGED' || item.status === 'EXPIRED' || item.status === 'NON_COMPLIANT') {
      penalty += 0.5;
    } else if (item.status === 'MISSING') {
      penalty += 0.3;
    }
    if (item.condition === 'Poor' || item.condition === 'Needs Repair') {
      penalty += 0.3;
    } else if (item.condition === 'Fair') {
      penalty += 0.1;
    }
  }
  return Math.max(1.0, Math.round((5.0 - Math.min(4.0, penalty)) * 10) / 10);
}
