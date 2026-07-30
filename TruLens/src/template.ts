/**
 * TRULENS'S COPY of the canonical template at
 * assets/templates/vehicle-template.ts (same convention as src/brand.css
 * copied from assets/brand/tokens.css — no sync script, review `git diff`
 * against the canonical file before editing this one by hand).
 *
 * Trimmed from the canonical superset: no video_360 slot / no phase 7 —
 * TruLens has no 360-video capture. No checklistGroups / checklistPoints /
 * disclosureQuestions either — TruLens has no inspection-checklist equivalent
 * (that's Truinspect's deeper feature).
 *
 * Every slot's `required` is deliberately `false` here (2026-07-31, Paul's
 * call) — TruLens feeds a dealer website, not a graded VIR, so it's the
 * dealer's call what goes on their site; a 5-photo shoot must sync just as
 * cleanly as a full 28. Do NOT copy this required:false pattern back into
 * Truinspect's copy — its deeper inspection stays strict by design (its own
 * trade-in flow has a separate, existing "Showroom Condition" bypass in
 * TradeInWalkAround.tsx for when photos genuinely aren't needed).
 */

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number; // -> TemplatePhase.id
  category: string; // kept separate from phase name — Truinspect's phase 7 uses
                     // '360 Video'; phase 2 uses 'Interior + Engine'
}

export interface TemplatePhase {
  id: number; // matches TemplateSlot.phase
  name: string; // shown in the CameraGuide phase tab strip
  reportCard?: {
    /** presence of this object = "this phase gets its own ReportPreview score card" */
    label: string; // e.g. phase 1's card says 'Exterior', not 'Exterior Panels'
    iconKey: string; // resolved via each app's own iconMap.ts — never a live component ref
  };
}

export interface ChecklistGroup {
  id: string; // == the `group` string on ChecklistPoint entries
  name: string;
}

export interface ChecklistPoint {
  id: string;
  group: string; // -> ChecklistGroup.id
  name: string;
  kind: 'condition' | 'function';
  photoSlotId?: string; // loose reference into slots[].id — validated at load time, not statically
  hint?: string;
}

export interface DisclosureQuestion {
  id: string;
  q: string;
  flagWhen: 'yes' | 'no';
}

export interface InspectionTemplate {
  id: string; // the getTemplate(id) lookup key, e.g. 'vehicle-v1'
  label: string;
  slots: TemplateSlot[];
  phases: TemplatePhase[];
  checklistGroups?: ChecklistGroup[];
  checklistPoints?: ChecklistPoint[];
  disclosureQuestions?: { section: string; items: DisclosureQuestion[] }[];
}

/* Phase 1 is ONE walk around the vehicle, in the order you physically reach
   each shot: nose, front corner, then clockwise down the driver side and up
   the passenger side, taking each wheel at the corner you are standing on.
   To walk it the other way, swap the driver and passenger blocks below —
   order here is the capture order, nothing keys off the index. */
const SLOTS: TemplateSlot[] = [
  {
    id: 'front_straight',
    name: 'Front Profile',
    description: 'Position camera level with the front grill, perfectly centered.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'front_3_4',
    name: 'Front 3/4 (Hero)',
    description: 'Stand at a 45-degree angle from the front driver-side corner.',
    required: false,
    idealAngle: { pitch: 12, roll: 0, yaw: 45 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_front_driver',
    name: 'Wheel - Front Driver',
    description: 'Rim face and tyre wall, shot as you reach this corner on the lap.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_driver',
    name: 'Driver Side Profile',
    description: 'Position camera level with the middle of the vehicle on the driver side.',
    required: false,
    idealAngle: { pitch: 8, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_rear_driver',
    name: 'Wheel - Rear Driver',
    description: 'Rim face and tyre wall on the rear driver corner.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_3_4',
    name: 'Rear 3/4',
    description: 'Stand at a 45-degree angle from the rear passenger-side corner.',
    required: false,
    idealAngle: { pitch: 12, roll: 0, yaw: 135 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_straight',
    name: 'Rear Profile',
    description: 'Position camera level with the rear bumper, perfectly centered.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_rear_passenger',
    name: 'Wheel - Rear Passenger',
    description: 'Rim face and tyre wall on the rear passenger corner.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_passenger',
    name: 'Passenger Side Profile',
    description: 'Position camera level with the middle of the vehicle on the passenger side.',
    required: false,
    idealAngle: { pitch: 8, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_front_passenger',
    name: 'Wheel - Front Passenger',
    description: 'Rim face and tyre wall on the front passenger corner.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'roof_view',
    name: 'Roof View',
    description: 'Hold camera high to capture the condition of the roof and sunroof if applicable.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior Panels',
  },

  // Phase 2: Details & Badges
  {
    id: 'badges_detail',
    name: 'Badges & Branding',
    description: 'Close-up of model, engine, and brand badges.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },
  {
    id: 'lights_detail',
    name: 'Headlights & Taillights',
    description: 'Close-up of clear lenses to prove no cracks or fogging.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },
  {
    id: 'mirrors_handles',
    name: 'Mirrors & Door Handles',
    description: 'Check for scuffs on mirrors and wear on handles.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },

  // Phase 3: Interior
  {
    id: 'interior_dash',
    name: 'Dashboard & Steering',
    description: 'Shoot from back seat centered, capturing steering wheel and active instrument cluster.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_driver',
    name: 'Driver Seat',
    description: 'Capture the driver seat bolsters and general condition.',
    required: false,
    idealAngle: { pitch: -5, roll: 0, yaw: 45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_passenger',
    name: 'Passenger Seat',
    description: 'Capture the passenger seat and front cabin area.',
    required: false,
    idealAngle: { pitch: -5, roll: 0, yaw: -45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seats_rear',
    name: 'Rear Seats',
    description: 'Capture condition of rear passenger bench.',
    required: false,
    idealAngle: { pitch: -5, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'boot_bay',
    name: 'Boot / Load Bay',
    description: 'Open tailgate/boot and capture storage area condition.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'floor_mats',
    name: 'Floor Mats & Carpets',
    description: 'Capture the condition of carpets and mats in all footwells.',
    required: false,
    idealAngle: { pitch: -45, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },

  // Phase 4: Engine Bay & Mechanical
  {
    id: 'engine_bay',
    name: 'Engine Bay',
    description: 'Shoot from front center looking down, hood fully propped.',
    required: false,
    idealAngle: { pitch: 35, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },
  {
    id: 'mechanical_details',
    name: 'Battery & Fluids',
    description: 'Close-up of battery terminals and fluid reservoirs.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },
  {
    id: 'undercarriage',
    name: 'Undercarriage',
    description: 'Low angle shot showing chassis, exhaust, and lack of leaks.',
    required: false,
    idealAngle: { pitch: -30, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },

  // Phase 5: Recon / Work Photos
  {
    id: 'recon_damage',
    name: 'Damage & Recon',
    description: 'Document specific scratches, dents, or areas needing repair.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 5,
    category: 'Recon Photos',
  },

  // Phase 6: Documents
  {
    id: 'service_book',
    name: 'Service History Book',
    description: 'Capture the service booklet maintenance stamps.',
    required: false,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'reg_papers',
    name: 'Registration Papers',
    description: 'Capture vehicle registration or title documents.',
    required: false,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'odometer_reading',
    name: 'Odometer Close-up',
    description: 'Capture a clear image of the current mileage on the instrument cluster.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'vin_plate',
    name: 'VIN Plate / Sticker',
    description: 'Capture the manufacturer VIN plate or barcode sticker.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
];

const PHASES: TemplatePhase[] = [
  { id: 1, name: 'Exterior Panels', reportCard: { label: 'Exterior', iconKey: 'camera' } },
  { id: 2, name: 'Details & Badges' }, // no reportCard — matches today's report, which
                                        // has always silently omitted phase 2; now explicit
  { id: 3, name: 'Interior', reportCard: { label: 'Interior', iconKey: 'clipboard' } },
  { id: 4, name: 'Engine & Mechanical', reportCard: { label: 'Engine', iconKey: 'wrench' } },
  { id: 5, name: 'Recon / Work', reportCard: { label: 'Damage', iconKey: 'alert' } },
  { id: 6, name: 'Documents', reportCard: { label: 'Documents', iconKey: 'file' } },
];

export const vehicleTemplate: InspectionTemplate = {
  id: 'vehicle-v1',
  label: 'Vehicle capture',
  slots: SLOTS,
  phases: PHASES,
  // no checklistGroups / checklistPoints / disclosureQuestions — TruLens is
  // capture-only, that deeper inspection layer is Truinspect's
};
