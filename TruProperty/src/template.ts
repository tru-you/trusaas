export type PropertyType = 'House' | 'Flat' | 'Townhouse' | 'Estate' | 'Farm' | 'Commercial';

const ALL_TYPES: PropertyType[] = ['House', 'Flat', 'Townhouse', 'Estate', 'Farm', 'Commercial'];
const RESIDENTIAL: PropertyType[] = ['House', 'Flat', 'Townhouse', 'Estate', 'Farm'];
const HOUSE_LIKE: PropertyType[] = ['House', 'Townhouse', 'Estate', 'Farm'];

export type MediaType = 'photo' | 'video' | 'both';

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number;
  category: string;
  defaultFor: PropertyType[];
  mediaType?: MediaType;
  maxDurationSec?: number;
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
  kind: 'condition' | 'function' | 'presence' | 'compliance';
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

/* ─── Slot Library ───────────────────────────────────────────────────────────
   Every possible photo slot lives here. Each declares which property types
   include it by default. The inspector toggles slots on/off per property;
   `getPropertySlots()` resolves the final list.
   ───────────────────────────────────────────────────────────────────────── */

const FLAT = { pitch: 0, roll: 0, yaw: 0 };
const SLIGHT_UP = { pitch: 5, roll: 0, yaw: 0 };
const LOOK_UP = { pitch: 30, roll: 0, yaw: 0 };
const LOOK_DOWN = { pitch: -20, roll: 0, yaw: 0 };

export const SLOT_LIBRARY: TemplateSlot[] = [
  /* ── Phase 1: Exterior ── */
  { id: 'front_elevation', name: 'Front Elevation', description: 'Stand at the street and capture the full front of the property, including the main entrance, garage, and front garden.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: ALL_TYPES },
  { id: 'rear_elevation', name: 'Rear Elevation', description: 'Capture the full rear of the property, including any back door, patio, and yard.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: ALL_TYPES },
  { id: 'left_elevation', name: 'Left Elevation', description: 'Stand at the left boundary and capture the full side of the property.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'right_elevation', name: 'Right Elevation', description: 'Stand at the right boundary and capture the full side of the property.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'roof_overall', name: 'Roof (Overall)', description: 'From an elevated position or ladder, capture the roof — check for broken tiles, rust, or sagging.', required: true, idealAngle: LOOK_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'gutters_fascias', name: 'Gutters & Fascias', description: 'Close-up of the gutters, fascias, and downpipes — check for leaks, rust, and blockages.', required: true, idealAngle: { pitch: 10, roll: 0, yaw: 0 }, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'garden_yard', name: 'Garden / Yard', description: 'Capture the garden or yard area, showing ground condition, drainage, and landscaping.', required: false, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'pool_patio', name: 'Pool / Patio Area', description: 'Capture the pool, patio, braai area or outdoor entertainment space.', required: false, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: ['House', 'Estate', 'Farm'] },
  { id: 'driveway_garage', name: 'Driveway & Garage', description: 'Capture the driveway and garage/carport exterior, including the garage door.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'garage_interior', name: 'Garage Interior', description: 'Capture inside the garage — floor, walls, door mechanism, and storage areas.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: ['House', 'Estate'] },
  { id: 'boundary_walls', name: 'Boundary Walls & Fencing', description: 'Capture the perimeter walls, fencing, and gate — check for cracks, leaning, or damage.', required: true, idealAngle: SLIGHT_UP, phase: 1, category: 'Exterior', defaultFor: HOUSE_LIKE },
  { id: 'security_system', name: 'Security System', description: 'Capture alarm panel, beams, electric fence energiser, or camera system. Note make/model if visible.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: ['House', 'Estate', 'Commercial'] },
  { id: 'parking_bay', name: 'Parking Bay / Carport', description: 'Capture the allocated parking bay or carport for this unit.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: ['Flat', 'Townhouse'] },
  { id: 'common_areas', name: 'Common Areas', description: 'Capture shared corridors, stairwells, or communal garden relevant to the unit.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: ['Flat'] },

  /* ── Phase 2: Living Areas ── */
  { id: 'entrance_hall', name: 'Entrance / Hallway', description: 'Capture the entrance hall or main hallway, showing floors, walls, and ceiling.', required: true, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: ALL_TYPES },
  { id: 'lounge', name: 'Lounge / Living Room', description: 'Capture the main living room from the doorway, showing floors, walls, windows, and ceiling.', required: true, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: RESIDENTIAL },
  { id: 'dining', name: 'Dining Room', description: 'Capture the dining area, showing floors, walls, and proximity to kitchen.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: HOUSE_LIKE },
  { id: 'kitchen_wide', name: 'Kitchen (Wide Angle)', description: 'Stand in the doorway and capture the full kitchen layout — cabinets, counters, sink, and appliances.', required: true, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: RESIDENTIAL },
  { id: 'kitchen_cabinets', name: 'Kitchen Cabinets & Counters', description: 'Close-up of cabinet doors, drawer fronts, countertops — check for damage, swelling, or loose hinges.', required: true, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: RESIDENTIAL },
  { id: 'kitchen_appliances', name: 'Stove, Oven & Appliances', description: 'Photograph the stove, oven, and hob. Test and note if functional.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: RESIDENTIAL },
  { id: 'scullery_laundry', name: 'Scullery / Laundry', description: 'Capture the scullery or laundry area, including plumbing connections.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: HOUSE_LIKE },
  { id: 'study_office', name: 'Study / Home Office', description: 'Capture the study or office — floors, walls, windows, built-in desk or shelving.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [] },
  { id: 'tv_room', name: 'TV Room / Family Room', description: 'Capture an additional living area separate from the main lounge.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [] },
  { id: 'storeroom', name: 'Storeroom / Storage', description: 'Capture the storeroom — check for damp, ventilation, and structural condition.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [] },
  { id: 'domestic_quarters', name: 'Domestic Quarters', description: 'Capture the domestic worker\'s room — floors, walls, ceiling, separate entrance if applicable.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [] },

  /* ── Phase 3: Bedrooms & Bathrooms ── */
  { id: 'main_bedroom', name: 'Main Bedroom', description: 'Capture the main bedroom from the doorway — floors, walls, windows, ceiling, and built-in cupboards.', required: true, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: RESIDENTIAL },
  { id: 'ensuite', name: 'En-Suite Bathroom', description: 'Capture the en-suite — shower, basin, toilet. Check for leaks, damp, and ventilation.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: HOUSE_LIKE },
  { id: 'bedroom_2', name: 'Bedroom 2', description: 'Capture bedroom 2 from the doorway, showing floors, walls, windows, and cupboards.', required: true, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: RESIDENTIAL },
  { id: 'bedroom_3', name: 'Bedroom 3', description: 'Capture bedroom 3 from the doorway.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: HOUSE_LIKE },
  { id: 'bedroom_4', name: 'Bedroom 4', description: 'Capture bedroom 4 from the doorway.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: ['Estate'] },
  { id: 'bedroom_5', name: 'Bedroom 5', description: 'Capture bedroom 5 from the doorway.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [] },
  { id: 'main_bathroom', name: 'Main Bathroom', description: 'Capture the main bathroom — bath/shower, basin, toilet. Check for leaks, damp, and mould.', required: true, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: RESIDENTIAL },
  { id: 'bathroom_2', name: 'Bathroom 2', description: 'Capture the second full bathroom.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: ['Estate'] },
  { id: 'guest_wc', name: 'Guest WC / Powder Room', description: 'Capture the guest toilet.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: HOUSE_LIKE },

  /* ── Phase 4: Systems & Documents ── */
  { id: 'db_board', name: 'Electrical DB Board', description: 'Open the DB board cover and capture the breakers, wiring, and earth leakage. Check COC sticker.', required: true, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'geyser', name: 'Geyser / Hot Water', description: 'Capture the geyser installation — check the drip tray, overflow pipe, and insulation.', required: true, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: RESIDENTIAL },
  { id: 'solar_panels', name: 'Solar Panels / Inverter', description: 'Capture the solar panel array and inverter installation. Note capacity if visible on the label.', required: false, idealAngle: LOOK_UP, phase: 4, category: 'Systems & Documents', defaultFor: [] },
  { id: 'water_tank', name: 'Water Tank / Borehole', description: 'Capture the water storage tank or borehole pump. Check connections and condition.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: ['Farm'] },
  { id: 'plumbing', name: 'Plumbing Under Sinks', description: 'Open the cupboard under the kitchen and bathroom sinks — check for leaks, corrosion, and trap condition.', required: true, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: RESIDENTIAL },
  { id: 'meter_box', name: 'Meter Box (Elec / Water)', description: 'Capture the electricity and water meters — note if prepaid or conventional, and current readings.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'windows_frames', name: 'Window Frames & Seals', description: 'Close-up of a representative window — check frame condition, seals, and any signs of damp or rot.', required: true, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'floor_closeup', name: 'Floor Condition (Close-Up)', description: 'Close-up of the floor in a high-traffic area — check for cracks, lifting, damp, or damage.', required: true, idealAngle: { pitch: -30, roll: 0, yaw: 0 }, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'ceiling_condition', name: 'Ceiling Condition', description: 'Capture the ceiling, looking for cracks, damp spots, sagging, or signs of roof leaks.', required: true, idealAngle: LOOK_UP, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'built_in_cupboards', name: 'Built-In Cupboards', description: 'Open and photograph built-in cupboards — check doors, rails, shelves, and any damp or damage.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: RESIDENTIAL },
  { id: 'rates_bill', name: 'Municipal Rates Bill', description: 'Capture the latest municipal rates account — sharp enough to read the address and amount.', required: true, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'coc_electrical', name: 'Electrical COC', description: 'Capture the electrical Certificate of Compliance. Mark Missing if not provided.', required: true, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: ALL_TYPES },
  { id: 'coc_gas', name: 'Gas COC', description: 'Capture the gas Certificate of Compliance — required for any gas installation (stove, geyser, fireplace).', required: false, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: [] },
  { id: 'coc_electric_fence', name: 'Electric Fence COC', description: 'Capture the electric fence Certificate of Compliance.', required: false, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: [] },
  { id: 'coc_plumbing', name: 'Plumbing COC', description: 'Capture the plumbing Certificate of Compliance if required by province.', required: false, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: [] },
  { id: 'beetle_cert', name: 'Beetle / Pest Certificate', description: 'Capture the beetle or pest clearance certificate.', required: false, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: [] },

  /* ── Commercial-only ── */
  { id: 'reception_area', name: 'Reception / Foyer', description: 'Capture the reception or main entrance area of the commercial property.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: ['Commercial'] },
  { id: 'office_space', name: 'Office Space', description: 'Capture the main office area — floors, walls, ceiling, lighting, and air conditioning.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: ['Commercial'] },
  { id: 'warehouse_area', name: 'Warehouse / Workshop', description: 'Capture the warehouse or workshop floor — structure, roller doors, loading bays.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: ['Commercial'] },
  { id: 'fire_system', name: 'Fire System / Extinguishers', description: 'Capture fire extinguishers, hose reels, sprinkler heads, and the fire panel. Check service dates.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: ['Commercial'] },
  { id: 'loading_bay', name: 'Loading Bay / Roller Doors', description: 'Capture loading bay access, roller door mechanisms, and ramp condition.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: ['Commercial'] },

  /* ── Video walkthrough slots (rental inspections) ── */
  { id: 'video_exterior', name: 'Exterior Walkthrough', description: 'Slow pan around the full exterior — boundary walls, garden, driveway, roof line. Start at the front gate and work clockwise.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: [], mediaType: 'video', maxDurationSec: 30 },
  { id: 'video_lounge', name: 'Lounge Walkthrough', description: 'Pan the full lounge from the doorway — floor, walls, ceiling, windows, light fittings, power points. Note any marks or damage out loud.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [], mediaType: 'video', maxDurationSec: 20 },
  { id: 'video_kitchen', name: 'Kitchen Walkthrough', description: 'Open every cupboard and drawer. Run each tap. Check oven, hob, extractor. Show inside the fridge if included.', required: false, idealAngle: FLAT, phase: 2, category: 'Living Areas', defaultFor: [], mediaType: 'video', maxDurationSec: 30 },
  { id: 'video_main_bedroom', name: 'Main Bedroom Walkthrough', description: 'Pan from doorway — floor, walls, ceiling, built-in cupboards (open them), windows, curtain rails and blinds.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [], mediaType: 'video', maxDurationSec: 20 },
  { id: 'video_bedroom_2', name: 'Bedroom 2 Walkthrough', description: 'Same as main bedroom — floor, walls, ceiling, cupboards, windows.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [], mediaType: 'video', maxDurationSec: 15 },
  { id: 'video_bedroom_3', name: 'Bedroom 3 Walkthrough', description: 'Same as above — floor, walls, ceiling, cupboards, windows.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [], mediaType: 'video', maxDurationSec: 15 },
  { id: 'video_main_bathroom', name: 'Main Bathroom Walkthrough', description: 'Flush toilet, run basin and shower/bath taps, check drains. Show grouting, silicone seals, extractor fan.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [], mediaType: 'video', maxDurationSec: 20 },
  { id: 'video_bathroom_2', name: 'Bathroom 2 Walkthrough', description: 'Same — flush, run taps, check seals and drains.', required: false, idealAngle: FLAT, phase: 3, category: 'Bedrooms & Bathrooms', defaultFor: [], mediaType: 'video', maxDurationSec: 15 },
  { id: 'video_garage', name: 'Garage Walkthrough', description: 'Open and close the garage door on camera. Pan floor, walls, door mechanism, any built-in storage.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: [], mediaType: 'video', maxDurationSec: 15 },
  { id: 'video_garden', name: 'Garden Walkthrough', description: 'Pan the garden — lawn condition, flower beds, irrigation, pool (if present), boundary fencing.', required: false, idealAngle: FLAT, phase: 1, category: 'Exterior', defaultFor: [], mediaType: 'video', maxDurationSec: 20 },

  /* ── Meter readings (rental) ── */
  { id: 'meter_elec_reading', name: 'Electricity Meter Reading', description: 'Close-up of the electricity meter showing the current reading. Capture the full number clearly.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: [], mediaType: 'photo' },
  { id: 'meter_water_reading', name: 'Water Meter Reading', description: 'Close-up of the water meter showing the current reading.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: [], mediaType: 'photo' },
  { id: 'meter_gas_reading', name: 'Gas Meter Reading', description: 'Close-up of the gas meter showing the current reading — only if gas supply present.', required: false, idealAngle: FLAT, phase: 4, category: 'Systems & Documents', defaultFor: [], mediaType: 'photo' },

  /* ── Keys & access (rental handover) ── */
  { id: 'keys_handed', name: 'Keys & Remotes', description: 'Lay out all keys, gate remotes, and access cards. Count and photograph them together.', required: false, idealAngle: LOOK_DOWN, phase: 4, category: 'Systems & Documents', defaultFor: [], mediaType: 'photo' },
];

const PHASES: TemplatePhase[] = [
  { id: 1, name: 'Exterior', reportCard: { label: 'Exterior', iconKey: 'home' } },
  { id: 2, name: 'Living Areas', reportCard: { label: 'Living Areas', iconKey: 'sofa' } },
  { id: 3, name: 'Bedrooms & Bathrooms', reportCard: { label: 'Bedrooms & Bathrooms', iconKey: 'bed' } },
  { id: 4, name: 'Systems & Documents', reportCard: { label: 'Systems & Documents', iconKey: 'clipboard' } },
];

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { id: 'Exterior', name: 'Exterior' },
  { id: 'Roof & structure', name: 'Roof & structure' },
  { id: 'Interior', name: 'Interior' },
  { id: 'Kitchen & plumbing', name: 'Kitchen & plumbing' },
  { id: 'Electrical', name: 'Electrical' },
  { id: 'Compliance', name: 'Compliance & documents' },
];

const CHECKLIST_POINTS: ChecklistPoint[] = [
  { id: 'ext_walls', group: 'Exterior', name: 'Exterior walls', kind: 'condition', photoSlotId: 'front_elevation', hint: 'cracks, damp, paint condition' },
  { id: 'ext_boundary', group: 'Exterior', name: 'Boundary walls & fencing', kind: 'condition', photoSlotId: 'boundary_walls', hint: 'structural, leaning, rust' },
  { id: 'ext_driveway', group: 'Exterior', name: 'Driveway & paving', kind: 'condition', photoSlotId: 'driveway_garage', hint: 'cracks, sinkholes, drainage' },
  { id: 'ext_garden', group: 'Exterior', name: 'Garden / yard condition', kind: 'condition', photoSlotId: 'garden_yard', hint: 'drainage, overgrowth, erosion' },
  { id: 'ext_pool', group: 'Exterior', name: 'Pool & equipment', kind: 'condition', photoSlotId: 'pool_patio', hint: 'pump, filter, cracks, leaks — mark OK if no pool' },
  { id: 'ext_security', group: 'Exterior', name: 'Security system', kind: 'function', photoSlotId: 'security_system', hint: 'alarm, beams, electric fence, cameras' },

  { id: 'roof_condition', group: 'Roof & structure', name: 'Roof covering', kind: 'condition', photoSlotId: 'roof_overall', hint: 'broken tiles, rust, sagging' },
  { id: 'roof_gutters', group: 'Roof & structure', name: 'Gutters & downpipes', kind: 'condition', photoSlotId: 'gutters_fascias', hint: 'leaks, blockages, rust' },
  { id: 'roof_ceiling', group: 'Roof & structure', name: 'Ceilings throughout', kind: 'condition', photoSlotId: 'ceiling_condition', hint: 'cracks, damp spots, sagging' },
  { id: 'struct_walls', group: 'Roof & structure', name: 'Internal walls', kind: 'condition', hint: 'cracks, damp, mould' },
  { id: 'struct_floors', group: 'Roof & structure', name: 'Floors throughout', kind: 'condition', photoSlotId: 'floor_closeup', hint: 'cracks, lifting, damp' },

  { id: 'int_windows', group: 'Interior', name: 'Window frames & glass', kind: 'condition', photoSlotId: 'windows_frames', hint: 'rot, seals, broken panes' },
  { id: 'int_doors', group: 'Interior', name: 'Internal doors', kind: 'condition', hint: 'warping, sticking, handles' },
  { id: 'int_bic', group: 'Interior', name: 'Built-in cupboards', kind: 'condition', photoSlotId: 'built_in_cupboards', hint: 'doors, rails, damp' },
  { id: 'int_damp', group: 'Interior', name: 'Signs of damp or mould', kind: 'condition', hint: 'walls, ceilings, cupboards — any room' },

  { id: 'kp_cabinets', group: 'Kitchen & plumbing', name: 'Kitchen cabinets', kind: 'condition', photoSlotId: 'kitchen_cabinets', hint: 'swelling, hinges, handles' },
  { id: 'kp_sink', group: 'Kitchen & plumbing', name: 'Kitchen sink & taps', kind: 'function', hint: 'leaks, pressure, drainage' },
  { id: 'kp_appliances', group: 'Kitchen & plumbing', name: 'Stove & oven working', kind: 'function', photoSlotId: 'kitchen_appliances' },
  { id: 'kp_geyser', group: 'Kitchen & plumbing', name: 'Geyser functional', kind: 'function', photoSlotId: 'geyser', hint: 'hot water at all taps, no leaks from tray' },
  { id: 'kp_plumbing', group: 'Kitchen & plumbing', name: 'Under-sink plumbing', kind: 'condition', photoSlotId: 'plumbing', hint: 'leaks, corrosion, traps' },
  { id: 'kp_bathroom', group: 'Kitchen & plumbing', name: 'Bathroom fixtures', kind: 'function', photoSlotId: 'main_bathroom', hint: 'toilets flush, basins drain, no leaks' },

  { id: 'elec_db', group: 'Electrical', name: 'DB board', kind: 'condition', photoSlotId: 'db_board', hint: 'breakers, wiring, COC sticker' },
  { id: 'elec_lights', group: 'Electrical', name: 'Lights & switches work', kind: 'function', hint: 'test in every room' },
  { id: 'elec_plugs', group: 'Electrical', name: 'Plug points work', kind: 'function', hint: 'test a representative sample' },
  { id: 'elec_solar', group: 'Electrical', name: 'Solar / inverter system', kind: 'function', photoSlotId: 'solar_panels', hint: 'panels, inverter, battery if present' },

  { id: 'comp_coc_elec', group: 'Compliance', name: 'Electrical COC', kind: 'compliance', photoSlotId: 'coc_electrical', hint: 'valid, within 2 years' },
  { id: 'comp_coc_gas', group: 'Compliance', name: 'Gas COC', kind: 'compliance', photoSlotId: 'coc_gas', hint: 'required if gas installation present' },
  { id: 'comp_coc_fence', group: 'Compliance', name: 'Electric fence COC', kind: 'compliance', photoSlotId: 'coc_electric_fence', hint: 'required if electric fence installed' },
  { id: 'comp_beetle', group: 'Compliance', name: 'Beetle / pest certificate', kind: 'compliance', photoSlotId: 'beetle_cert', hint: 'clearance certificate from registered inspector' },
  { id: 'comp_rates', group: 'Compliance', name: 'Rates account current', kind: 'compliance', photoSlotId: 'rates_bill', hint: 'no arrears, matches address' },
];

const DISCLOSURE_QUESTIONS: { section: string; items: DisclosureQuestion[] }[] = [
  {
    section: 'Structure & damp',
    items: [
      { id: 'roof_leaks', q: 'Any known roof leaks or recent repairs?', flagWhen: 'yes' },
      { id: 'wall_cracks', q: 'Any structural cracks in walls?', flagWhen: 'yes' },
      { id: 'damp_issues', q: 'Any damp or mould problems, past or present?', flagWhen: 'yes' },
      { id: 'foundation', q: 'Any known foundation or subsidence issues?', flagWhen: 'yes' },
    ],
  },
  {
    section: 'Plumbing & electrical',
    items: [
      { id: 'plumbing_leaks', q: 'Any plumbing leaks or drainage issues?', flagWhen: 'yes' },
      { id: 'geyser_issues', q: 'Geyser in working order, no recent failures?', flagWhen: 'no' },
      { id: 'elec_issues', q: 'Any electrical faults — tripping breakers, flickering lights?', flagWhen: 'yes' },
      { id: 'coc_valid', q: 'Electrical COC valid and provided?', flagWhen: 'no' },
    ],
  },
  {
    section: 'Fixtures & fittings',
    items: [
      { id: 'builtin_damage', q: 'Any damage to built-in cupboards or fixtures?', flagWhen: 'yes' },
      { id: 'window_damage', q: 'Any broken windows or damaged frames?', flagWhen: 'yes' },
      { id: 'floor_damage', q: 'Any damaged flooring — cracked tiles, lifting laminate?', flagWhen: 'yes' },
      { id: 'appliance_fault', q: 'Any faulty appliances included in the sale?', flagWhen: 'yes' },
    ],
  },
  {
    section: 'Compliance & legal',
    items: [
      { id: 'rates_arrears', q: 'Any rates or municipal arrears?', flagWhen: 'yes' },
      { id: 'alterations', q: 'Any unapproved alterations or additions to the property?', flagWhen: 'yes' },
      { id: 'disputes', q: 'Any boundary disputes or neighbour issues?', flagWhen: 'yes' },
    ],
  },
];

/* ─── Compliance certificates (SA property transfer) ───────────────────
   Required for sale / new build. Rental inspections skip these.
   ───────────────────────────────────────────────────────────────────── */

export interface ComplianceCertDef {
  id: string;
  name: string;
  description: string;
  requiredFor: ('sale' | 'new_build')[];
  conditional?: string;
}

export const COMPLIANCE_CERTS: ComplianceCertDef[] = [
  { id: 'coc_electrical', name: 'Electrical COC', description: 'Valid electrical Certificate of Compliance — mandatory for all property transfers.', requiredFor: ['sale', 'new_build'] },
  { id: 'coc_plumbing', name: 'Plumbing COC', description: 'Plumbing Certificate of Compliance — required by some provinces.', requiredFor: ['sale', 'new_build'] },
  { id: 'coc_gas', name: 'Gas COC', description: 'Gas Certificate of Compliance — required if any gas installation is present (stove, geyser, fireplace).', requiredFor: ['sale', 'new_build'], conditional: 'Only if gas installation present' },
  { id: 'coc_electric_fence', name: 'Electric Fence COC', description: 'Electric fence Certificate of Compliance — required if electric fence is installed.', requiredFor: ['sale', 'new_build'], conditional: 'Only if electric fence installed' },
  { id: 'beetle_cert', name: 'Beetle / Pest Certificate', description: 'Clearance certificate from a registered pest inspector — common in coastal and humid areas.', requiredFor: ['sale'], conditional: 'Common in KZN, Garden Route, and coastal areas' },
  { id: 'engineer_report', name: "Engineer's Report", description: 'Structural engineer report — required when cracks, subsidence, or structural concerns are noted.', requiredFor: ['sale', 'new_build'], conditional: 'Required when structural issues are noted' },
  { id: 'occupancy_cert', name: 'Occupancy Certificate', description: 'Municipal occupancy certificate confirming the building is approved for habitation.', requiredFor: ['new_build'] },
];

/* ─── Default slot IDs for a given property type ───────────────────────── */
export function getDefaultSlotIds(propertyType: string): string[] {
  return SLOT_LIBRARY
    .filter(s => s.defaultFor.includes(propertyType as PropertyType))
    .map(s => s.id);
}

/* ─── Resolve the active slots for a property ──────────────────────────── */
export function getPropertySlots(activeSlotIds: string[]): TemplateSlot[] {
  const idSet = new Set(activeSlotIds);
  return SLOT_LIBRARY.filter(s => idSet.has(s.id));
}

export const propertyTemplate: InspectionTemplate = {
  id: 'property-v1',
  label: 'Property inspection & condition report',
  slots: SLOT_LIBRARY,
  phases: PHASES,
  checklistGroups: CHECKLIST_GROUPS,
  checklistPoints: CHECKLIST_POINTS,
  disclosureQuestions: DISCLOSURE_QUESTIONS,
};
