/**
 * PROPLENS — Property capture template.
 *
 * The property equivalent of TruLens's 27-vehicle-slot template. Covers
 * exterior approach, interior rooms, and compliance/features — everything
 * an agent needs to list a property fast.
 *
 * Same architecture as TruLens: slots, phases, tiers. `core` is the honest
 * listing minimum (the shots every portal expects); `recommended` adds trust;
 * `extra` shows only on request. All slots are optional — it's the agent's
 * call what goes on the listing.
 */

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number;
  category: string;
  tier?: 'core' | 'recommended' | 'extra';
}

export interface TemplatePhase {
  id: number;
  name: string;
  reportCard?: {
    label: string;
    iconKey: string;
  };
}

export interface ChecklistGroup {
  id: string;
  name: string;
}

export interface ChecklistPoint {
  id: string;
  group: string;
  name: string;
  kind: 'condition' | 'function';
  photoSlotId?: string;
  hint?: string;
}

export interface DisclosureQuestion {
  id: string;
  q: string;
  flagWhen: 'yes' | 'no';
}

export interface InspectionTemplate {
  id: string;
  label: string;
  slots: TemplateSlot[];
  phases: TemplatePhase[];
  checklistGroups?: ChecklistGroup[];
  checklistPoints?: ChecklistPoint[];
  disclosureQuestions?: { section: string; items: DisclosureQuestion[] }[];
}

/* Phase 1: Exterior & Approach — the street-side shots an agent takes
   on arrival: the full frontage, approach, sides, garden/yard, and parking. */
const SLOTS: TemplateSlot[] = [
  {
    id: 'street_view',
    name: 'Street View',
    description: 'Stand across the street and capture the full property frontage with street number visible.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'front_entrance',
    name: 'Front Entrance',
    description: 'Stand at the gate or front door and capture the entrance, path, and any security features.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'exterior_left',
    name: 'Left Side Exterior',
    description: 'Capture the left side of the property from the boundary, showing walls and windows.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'exterior_right',
    name: 'Right Side Exterior',
    description: 'Capture the right side of the property from the boundary.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'rear_garden',
    name: 'Rear / Garden',
    description: 'Stand at the back of the property and capture the rear elevation, garden, and outdoor living area.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 180 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'parking_garage',
    name: 'Parking / Garage',
    description: 'Capture the garage, carport, or parking area. Show the number of bays clearly.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'pool_area',
    name: 'Pool / Outdoor Features',
    description: 'Capture the swimming pool, braai area, deck, or any outdoor entertainment features.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior & Approach',
  },
  {
    id: 'boundary_security',
    name: 'Boundary & Security',
    description: 'Capture boundary walls, fencing, electric fence, intercom, and security features.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior & Approach',
  },

  /* Phase 2: Interior Rooms — walk through the property, one shot per room.
     Core rooms lead so the listing minimum is captured first. */
  {
    id: 'living_room',
    name: 'Living Room / Lounge',
    description: 'Stand in the doorway and capture the full room. Show flooring, windows, and natural light.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    description: 'Capture the kitchen showing countertops, cabinets, appliances, and layout.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'dining_room',
    name: 'Dining Room',
    description: 'Capture the dining area, whether open-plan or separate.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'main_bedroom',
    name: 'Main Bedroom',
    description: 'Capture the main bedroom from the doorway. Show built-in cupboards if present.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'main_bathroom',
    name: 'Main Bathroom / En-suite',
    description: 'Capture the main bathroom showing bath/shower, basin, and finishes.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'bedroom_2',
    name: 'Bedroom 2',
    description: 'Capture the second bedroom from the doorway.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'bedroom_3',
    name: 'Bedroom 3',
    description: 'Capture the third bedroom from the doorway.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'bedroom_4',
    name: 'Bedroom 4',
    description: 'Capture additional bedroom if present.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'bathroom_2',
    name: 'Bathroom 2',
    description: 'Capture the second bathroom.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'bathroom_3',
    name: 'Bathroom 3 / Guest WC',
    description: 'Capture the guest toilet or third bathroom.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'study_office',
    name: 'Study / Home Office',
    description: 'Capture the study, office, or flex room.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'laundry',
    name: 'Laundry',
    description: 'Capture the laundry room or scullery.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },
  {
    id: 'hallway_entrance',
    name: 'Entrance Hall / Passage',
    description: 'Capture the entrance hall or main passage.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior Rooms',
  },

  /* Phase 3: Compliance & Utilities — the technical shots for due diligence */
  {
    id: 'electrical_box',
    name: 'Electrical DB Board',
    description: 'Capture the distribution board with the door open — breakers, labels, and CoC sticker.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
  {
    id: 'water_meter',
    name: 'Water Meter',
    description: 'Capture the water meter reading clearly.',
    required: false,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
  {
    id: 'electricity_meter',
    name: 'Electricity Meter',
    description: 'Capture the electricity meter reading clearly.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
  {
    id: 'geyser',
    name: 'Geyser / Water Heater',
    description: 'Capture the geyser showing condition and any drip tray or solar panels.',
    required: false,
    idealAngle: { pitch: 20, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
  {
    id: 'roof_condition',
    name: 'Roof Condition',
    description: 'Capture the roof showing tiles, gutters, and overall condition. Step back for a clear angle.',
    required: false,
    idealAngle: { pitch: 30, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
  {
    id: 'compliance_docs',
    name: 'Compliance Documents',
    description: 'Photograph compliance certificates (electrical CoC, gas CoC, beetle clearance, etc.).',
    required: false,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Compliance & Utilities',
  },
];

export const CORE_SLOT_IDS = new Set<string>([
  'street_view', 'front_entrance', 'rear_garden',
  'living_room', 'kitchen', 'main_bedroom', 'main_bathroom',
]);
const EXTRA_SLOT_IDS = new Set<string>([
  'bedroom_4', 'bathroom_3', 'hallway_entrance',
  'pool_area', 'boundary_security',
  'water_meter', 'electricity_meter', 'geyser', 'roof_condition', 'compliance_docs',
]);
for (const s of SLOTS) {
  s.tier = CORE_SLOT_IDS.has(s.id) ? 'core' : EXTRA_SLOT_IDS.has(s.id) ? 'extra' : 'recommended';
}

const PHASES: TemplatePhase[] = [
  { id: 1, name: 'Exterior & Approach', reportCard: { label: 'Exterior', iconKey: 'camera' } },
  { id: 2, name: 'Interior Rooms', reportCard: { label: 'Interior', iconKey: 'clipboard' } },
  { id: 3, name: 'Compliance & Utilities', reportCard: { label: 'Compliance', iconKey: 'wrench' } },
];

export const propertyTemplate: InspectionTemplate = {
  id: 'property-v1',
  label: 'Property capture',
  slots: SLOTS,
  phases: PHASES,
};
