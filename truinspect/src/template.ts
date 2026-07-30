/**
 * TRUINSPECT'S COPY of the canonical template at
 * assets/templates/vehicle-template.ts (same convention as src/brand.css
 * copied from assets/brand/tokens.css — no sync script, review `git diff`
 * against the canonical file before editing this one by hand).
 *
 * This is the full superset: keeps the video_360 slot / phase 7, and
 * additionally carries checklistGroups / checklistPoints /
 * disclosureQuestions, which TruLens has no equivalent for.
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
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'front_3_4',
    name: 'Front 3/4 (Hero)',
    description: 'Stand at a 45-degree angle from the front driver-side corner.',
    required: true,
    idealAngle: { pitch: 12, roll: 0, yaw: 45 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_front_driver',
    name: 'Wheel - Front Driver',
    description: 'Rim face and tyre wall, shot as you reach this corner on the lap.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_driver',
    name: 'Driver Side Profile',
    description: 'Position camera level with the middle of the vehicle on the driver side.',
    required: true,
    idealAngle: { pitch: 8, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_rear_driver',
    name: 'Wheel - Rear Driver',
    description: 'Rim face and tyre wall on the rear driver corner.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_3_4',
    name: 'Rear 3/4',
    description: 'Stand at a 45-degree angle from the rear passenger-side corner.',
    required: true,
    idealAngle: { pitch: 12, roll: 0, yaw: 135 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_straight',
    name: 'Rear Profile',
    description: 'Position camera level with the rear bumper, perfectly centered.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_rear_passenger',
    name: 'Wheel - Rear Passenger',
    description: 'Rim face and tyre wall on the rear passenger corner.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_passenger',
    name: 'Passenger Side Profile',
    description: 'Position camera level with the middle of the vehicle on the passenger side.',
    required: true,
    idealAngle: { pitch: 8, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheel_front_passenger',
    name: 'Wheel - Front Passenger',
    description: 'Rim face and tyre wall on the front passenger corner.',
    required: true,
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
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_driver',
    name: 'Driver Seat',
    description: 'Capture the driver seat bolsters and general condition.',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: 45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_passenger',
    name: 'Passenger Seat',
    description: 'Capture the passenger seat and front cabin area.',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: -45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seats_rear',
    name: 'Rear Seats',
    description: 'Capture condition of rear passenger bench.',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'boot_bay',
    name: 'Boot / Load Bay',
    description: 'Open tailgate/boot and capture storage area condition.',
    required: true,
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
    required: true,
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
    required: true,
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
    required: true,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'reg_papers',
    name: 'Registration Papers',
    description: 'Capture vehicle registration or title documents.',
    required: true,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'odometer_reading',
    name: 'Odometer Close-up',
    description: 'Capture a clear image of the current mileage on the instrument cluster.',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'vin_plate',
    name: 'VIN Plate / Sticker',
    description: 'Capture the manufacturer VIN plate or barcode sticker.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },

  // Phase 7: 360 Walkaround Video — Truinspect only, trim this out of TruLens's copy
  {
    id: 'video_360',
    name: 'Tru Orbit',
    description: 'Capture a complete 360-degree high-fidelity continuous walkaround video.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 7,
    category: '360 Video',
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
  { id: 7, name: 'Tru Orbit' }, // Truinspect only — trim out of TruLens's copy
];

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { id: 'Exterior', name: 'Exterior' },
  { id: 'Glass & lights', name: 'Glass & lights' },
  { id: 'Wheels & tyres', name: 'Wheels & tyres' },
  { id: 'Interior', name: 'Interior' },
  { id: 'Engine & underbody', name: 'Engine & underbody' },
  { id: 'Identity & documents', name: 'Identity & documents' },
];

const CHECKLIST_POINTS: ChecklistPoint[] = [
  // ---- Exterior panels (rate + tag on the angle photos) ----
  { id: 'ext_front', group: 'Exterior', name: 'Front (bumper, bonnet, grille)', kind: 'condition', photoSlotId: 'front_3_4' },
  { id: 'ext_rear', group: 'Exterior', name: 'Rear (bumper, boot/tailgate)', kind: 'condition', photoSlotId: 'rear_3_4' },
  { id: 'ext_driver', group: 'Exterior', name: 'Driver side (doors, fenders, sills)', kind: 'condition', photoSlotId: 'side_driver' },
  { id: 'ext_passenger', group: 'Exterior', name: 'Passenger side (doors, fenders, sills)', kind: 'condition', photoSlotId: 'side_passenger' },
  { id: 'ext_roof', group: 'Exterior', name: 'Roof', kind: 'condition', photoSlotId: 'roof_view' },
  { id: 'ext_paint', group: 'Exterior', name: 'Paint & panel gaps', kind: 'condition', hint: 'respray, mismatched panels, uneven gaps' },

  // ---- Glass, lights & wipers ----
  { id: 'glass_windscreen', group: 'Glass & lights', name: 'Windscreen', kind: 'condition', photoSlotId: 'lights_detail', hint: 'chips / cracks' },
  { id: 'fn_headlights', group: 'Glass & lights', name: 'Headlights work', kind: 'function', hint: 'both sides, high & low beam' },
  { id: 'cond_headlights', group: 'Glass & lights', name: 'Headlight lenses', kind: 'condition', hint: 'cracked / hazed / water ingress' },
  { id: 'fn_indicators', group: 'Glass & lights', name: 'Indicators & hazards work', kind: 'function' },
  { id: 'fn_taillights', group: 'Glass & lights', name: 'Tail & brake lights work', kind: 'function' },
  { id: 'fn_wipers', group: 'Glass & lights', name: 'Wipers & washers work', kind: 'function' },

  // ---- Wheels & tyres ----
  { id: 'tyre_tread', group: 'Wheels & tyres', name: 'Tyre tread & condition', kind: 'condition', photoSlotId: 'wheel_front_driver', hint: 'tread mm per corner, cracks, uneven wear — each corner has its own photo' },
  { id: 'cond_rims', group: 'Wheels & tyres', name: 'Rims', kind: 'condition', hint: 'kerbing, cracks, buckles' },
  { id: 'fn_spare', group: 'Wheels & tyres', name: 'Spare wheel present & serviceable', kind: 'function' },
  { id: 'fn_jack', group: 'Wheels & tyres', name: 'Jack & wheel tools present', kind: 'function' },

  // ---- Interior ----
  { id: 'int_dash', group: 'Interior', name: 'Dashboard & warning lights', kind: 'condition', photoSlotId: 'interior_dash', hint: 'any lights on with ignition' },
  { id: 'int_seat_driver', group: 'Interior', name: 'Driver seat & trim', kind: 'condition', photoSlotId: 'seat_driver' },
  { id: 'int_seat_pass', group: 'Interior', name: 'Passenger seat & trim', kind: 'condition', photoSlotId: 'seat_passenger' },
  { id: 'int_seats_rear', group: 'Interior', name: 'Rear seats', kind: 'condition', photoSlotId: 'seats_rear' },
  { id: 'int_headliner', group: 'Interior', name: 'Roof lining (headliner)', kind: 'condition', hint: 'sagging, stains, smoke' },
  { id: 'int_carpets', group: 'Interior', name: 'Carpets & mats', kind: 'condition', photoSlotId: 'floor_mats' },
  { id: 'fn_aircon', group: 'Interior', name: 'Aircon blows cold', kind: 'function' },
  { id: 'fn_electrics', group: 'Interior', name: 'Windows, mirrors, central locking work', kind: 'function' },
  { id: 'fn_infotainment', group: 'Interior', name: 'Infotainment & reverse camera work', kind: 'function' },

  // ---- Engine & underbody ----
  { id: 'eng_bay', group: 'Engine & underbody', name: 'Engine bay', kind: 'condition', photoSlotId: 'engine_bay', hint: 'leaks, corrosion, non-standard wiring' },
  { id: 'fn_leaks', group: 'Engine & underbody', name: 'No oil / coolant leaks', kind: 'function' },
  { id: 'fn_battery', group: 'Engine & underbody', name: 'Battery secure & healthy', kind: 'function' },
  { id: 'fn_smoke', group: 'Engine & underbody', name: 'No abnormal smoke on start', kind: 'function' },
  { id: 'eng_under', group: 'Engine & underbody', name: 'Undercarriage', kind: 'condition', photoSlotId: 'undercarriage', hint: 'rust, impact, weld repairs' },

  // ---- Identity & documents ----
  { id: 'doc_vin', group: 'Identity & documents', name: 'VIN plate', kind: 'condition', photoSlotId: 'vin_plate', hint: 'legible, untampered' },
  { id: 'fn_vin_match', group: 'Identity & documents', name: 'VIN matches licence disc & papers', kind: 'function' },
  { id: 'fn_service', group: 'Identity & documents', name: 'Service history validated', kind: 'function', hint: 'book or digital history confirmed' },
  { id: 'fn_disc', group: 'Identity & documents', name: 'Licence disc present & current', kind: 'function' },
  { id: 'fn_spare_key', group: 'Identity & documents', name: 'Spare key present', kind: 'function' },
];

const DISCLOSURE_QUESTIONS: { section: string; items: DisclosureQuestion[] }[] = [
  {
    section: 'Mechanical',
    items: [
      { id: 'oil_leaks', q: 'Any visible oil leaks (engine bay or under vehicle)?', flagWhen: 'yes' },
      { id: 'coolant', q: 'Coolant at level with no visible leaks?', flagWhen: 'no' },
      { id: 'battery', q: 'Battery secure, terminals clean?', flagWhen: 'no' },
      { id: 'startup_smoke', q: 'Abnormal smoke on startup?', flagWhen: 'yes' },
      { id: 'warning_lights', q: 'Any dashboard warning lights on?', flagWhen: 'yes' },
      { id: 'diag_scan', q: 'OBD diagnostic scan done and clear?', flagWhen: 'no' },
      { id: 'drive_noise', q: 'Abnormal noise / vibration on short drive?', flagWhen: 'yes' },
    ],
  },
  {
    section: 'Body panels',
    items: [
      { id: 'hidden_dents', q: 'Any dents or dings not clearly visible in the photos?', flagWhen: 'yes' },
      { id: 'respray', q: 'Signs of respray or panel-beating on any panel?', flagWhen: 'yes' },
      { id: 'panel_gaps', q: 'Panel gaps even all round?', flagWhen: 'no' },
      { id: 'underbody_rust', q: 'Rust on underbody, sills or arches?', flagWhen: 'yes' },
      { id: 'glass_damage', q: 'Windscreen or glass chips / cracks?', flagWhen: 'yes' },
    ],
  },
  {
    section: 'Interior & electronics',
    items: [
      { id: 'aircon', q: 'Aircon blows cold?', flagWhen: 'no' },
      { id: 'electric_windows', q: 'All windows, mirrors and central locking working?', flagWhen: 'no' },
      { id: 'infotainment', q: 'Infotainment / reverse camera working?', flagWhen: 'no' },
      { id: 'seat_wear', q: 'Excessive seat or trim wear for the mileage?', flagWhen: 'yes' },
      { id: 'odour', q: 'Damp or smoke odour inside?', flagWhen: 'yes' },
    ],
  },
  {
    section: 'Wheels & tyres',
    items: [
      { id: 'tread', q: 'All tyres above 3mm tread?', flagWhen: 'no' },
      { id: 'tyre_match', q: 'Matching tyre brands per axle?', flagWhen: 'no' },
      { id: 'rims', q: 'Rim damage (kerbing, cracks, buckles)?', flagWhen: 'yes' },
      { id: 'spare_tools', q: 'Spare wheel, jack and tools present?', flagWhen: 'no' },
    ],
  },
  {
    section: 'Documents & compliance',
    items: [
      { id: 'license_disc', q: 'License disc present and current? (photograph it in Documents)', flagWhen: 'no' },
      { id: 'service_history', q: 'Service book / digital service history verified?', flagWhen: 'no' },
      { id: 'spare_key', q: 'Spare key present?', flagWhen: 'no' },
      { id: 'vin_match', q: 'VIN plate matches papers?', flagWhen: 'no' },
    ],
  },
];

export const vehicleTemplate: InspectionTemplate = {
  id: 'vehicle-v1',
  label: 'Vehicle capture & VIR',
  slots: SLOTS,
  phases: PHASES,
  checklistGroups: CHECKLIST_GROUPS,
  checklistPoints: CHECKLIST_POINTS,
  disclosureQuestions: DISCLOSURE_QUESTIONS,
};
