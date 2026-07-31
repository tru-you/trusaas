/**
 * TRUINSPECT'S COPY of the canonical template at
 * assets/templates/vehicle-template.ts (same convention as src/brand.css
 * copied from assets/brand/tokens.css — no sync script, review `git diff`
 * against the canonical file before editing this one by hand).
 *
 * This is the full superset: this exact SLOTS/PHASES list, plus
 * checklistGroups / checklistPoints / disclosureQuestions, which TruLens has
 * no equivalent for.
 *
 * There is no video/360-capture slot (2026-07-31, Paul's call). TruOrbit — the
 * 3D spin viewer — is built entirely from the exterior panel PHOTOS below and
 * lives in TruLens only; it was never built from a recorded video, and
 * TruInspect never exposes an orbit-build button (standalone VIR + trade-in
 * tool, not the website-facing app).
 *
 * This list is the same 27 ids/order/categories as this app's own
 * src/types/inspection.ts TRADE_IN_ITEMS, on purpose: the trade-in and full
 * inspect workflows share one photo per vehicle instead of each re-shooting
 * the same 27 angles.
 */

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number; // -> TemplatePhase.id
  category: string;
}

export interface TemplatePhase {
  id: number; // matches TemplateSlot.phase
  name: string; // shown in the CameraGuide phase tab strip
  reportCard?: {
    /** presence of this object = "this phase gets its own ReportPreview score card" */
    label: string;
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
  kind: 'condition' | 'function' | 'presence' | 'service_history';
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

/* Category 1: Front & Engine — the five shots you can get without moving
   around the car: nose-on, bonnet open, and the windscreen/disc close-ups. */
const SLOTS: TemplateSlot[] = [
  {
    id: 'bonnet',
    name: 'Bonnet (Exterior)',
    description: 'Stand at the front and hold the camera high, looking down the length of the closed bonnet.',
    required: true,
    idealAngle: { pitch: 30, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'engine_bay',
    name: 'Engine Bay (Under Bonnet)',
    description: 'Prop the bonnet fully open and shoot from front-centre looking down.',
    required: true,
    idealAngle: { pitch: 35, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'front_bumper',
    name: 'Front Bumper & Grill',
    description: 'Position the camera level with the front bumper, perfectly centred.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'front_windscreen',
    name: 'Front Windscreen',
    description: 'Stand at the front and frame the full windscreen, checking for chips and cracks.',
    required: true,
    idealAngle: { pitch: 15, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'license_disc',
    name: 'Licence Disc',
    description: 'Close-up on the licence disc through the windscreen, sharp enough to read the expiry date.',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },

  /* Category 2: Clockwise Exterior Walk-Around — ONE lap of the vehicle, in
     the order you physically reach each shot: front-right corner, down the
     right side, around the back, up the left side, back to the front-left
     corner. To walk it the other way, mirror the left/right blocks below —
     order here is the capture order, nothing keys off the index. */
  {
    id: 'fender_front_right',
    name: 'Front Right Wing / Fender',
    description: 'Stand at the front-right corner, 45 degrees off the nose.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 45 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_front_right',
    name: 'Front Right Wheel & Tyre',
    description: 'Rim face and tyre wall, shot as you reach this corner on the lap.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_front_right',
    name: 'Driver Door & Side Mirror',
    description: 'Position the camera level with the driver door and mirror.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_rear_right',
    name: 'Rear Right Door',
    description: 'Position the camera level with the rear right door.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 100 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'quarter_rear_right',
    name: 'Rear Right Quarter Panel',
    description: 'Stand at the rear-right corner, 45 degrees off the tail.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_rear_right',
    name: 'Rear Right Wheel & Tyre',
    description: 'Rim face and tyre wall on the rear-right corner.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'boot_tailgate',
    name: 'Boot Exterior / Tailgate',
    description: 'Position the camera level with the rear bumper, centred on the boot or tailgate.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'rear_bumper',
    name: 'Rear Bumper',
    description: 'Position the camera level with the rear bumper, perfectly centred.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'spare_wheel',
    name: 'Spare Wheel & Boot Floor',
    description: 'Open the boot floor and photograph the spare wheel and tray. Mark Present / Not Present if there is nothing to shoot.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'vehicle_jack',
    name: 'Jack & Tool Kit',
    description: 'Photograph the jack, wheel spanner and tool kit. Mark Present / Not Present if there is nothing to shoot.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'quarter_rear_left',
    name: 'Rear Left Quarter Panel',
    description: 'Stand at the rear-left corner, 45 degrees off the tail.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: -135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_rear_left',
    name: 'Rear Left Wheel & Tyre',
    description: 'Rim face and tyre wall on the rear-left corner.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: -135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_rear_left',
    name: 'Rear Left Door',
    description: 'Position the camera level with the rear left door.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: -100 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_front_left',
    name: 'Front Left Door & Side Mirror',
    description: 'Position the camera level with the front left door and mirror.',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: -90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'fender_front_left',
    name: 'Front Left Wing / Fender',
    description: 'Stand at the front-left corner, 45 degrees off the nose.',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: -45 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_front_left',
    name: 'Front Left Wheel & Tyre',
    description: 'Rim face and tyre wall on the front-left corner, closing the lap.',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: -90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'roof_sunroof',
    name: 'Roof & Sunroof',
    description: 'Hold the camera high to capture the condition of the roof and sunroof, if fitted.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Clockwise Exterior',
  },

  /* Category 3: Interior, History & Verification */
  {
    id: 'steering_wheel',
    name: 'Steering & Controls',
    description: 'Shoot from the driver seat, framing the steering wheel, stalks and buttons.',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'interior_cabin',
    name: 'Interior Cabin',
    description: 'Shoot from the rear seat centred, capturing the dash, front seats and footwell trim.',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'service_book',
    name: 'Service Book',
    description: 'Capture the service booklet or digital service history maintenance stamps.',
    required: true,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'odometer',
    name: 'Odometer',
    description: 'Capture a clear, legible image of the current mileage on the instrument cluster.',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'spare_keys',
    name: 'Spare Keys',
    description: 'Photograph the spare key and remote(s). Mark Present / Not Present if there is nothing to shoot.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
];

const PHASES: TemplatePhase[] = [
  { id: 1, name: 'Front & Engine', reportCard: { label: 'Front & Engine', iconKey: 'wrench' } },
  { id: 2, name: 'Clockwise Exterior Walk-Around', reportCard: { label: 'Exterior', iconKey: 'camera' } },
  { id: 3, name: 'Interior, History & Verification', reportCard: { label: 'Interior & History', iconKey: 'clipboard' } },
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
  { id: 'ext_front', group: 'Exterior', name: 'Front (bumper, bonnet, grille)', kind: 'condition', photoSlotId: 'front_bumper' },
  { id: 'ext_rear', group: 'Exterior', name: 'Rear (bumper, boot/tailgate)', kind: 'condition', photoSlotId: 'rear_bumper' },
  { id: 'ext_driver', group: 'Exterior', name: 'Driver side (doors, fenders, sills)', kind: 'condition', photoSlotId: 'door_front_right' },
  { id: 'ext_passenger', group: 'Exterior', name: 'Passenger side (doors, fenders, sills)', kind: 'condition', photoSlotId: 'door_front_left' },
  { id: 'ext_roof', group: 'Exterior', name: 'Roof', kind: 'condition', photoSlotId: 'roof_sunroof' },
  { id: 'ext_paint', group: 'Exterior', name: 'Paint & panel gaps', kind: 'condition', hint: 'respray, mismatched panels, uneven gaps' },

  // ---- Glass, lights & wipers ----
  { id: 'glass_windscreen', group: 'Glass & lights', name: 'Windscreen', kind: 'condition', photoSlotId: 'front_windscreen', hint: 'chips / cracks' },
  { id: 'fn_headlights', group: 'Glass & lights', name: 'Headlights work', kind: 'function', hint: 'both sides, high & low beam' },
  { id: 'cond_headlights', group: 'Glass & lights', name: 'Headlight lenses', kind: 'condition', hint: 'cracked / hazed / water ingress' },
  { id: 'fn_indicators', group: 'Glass & lights', name: 'Indicators & hazards work', kind: 'function' },
  { id: 'fn_taillights', group: 'Glass & lights', name: 'Tail & brake lights work', kind: 'function' },
  { id: 'fn_wipers', group: 'Glass & lights', name: 'Wipers & washers work', kind: 'function' },

  // ---- Wheels & tyres ----
  { id: 'tyre_tread', group: 'Wheels & tyres', name: 'Tyre tread & condition', kind: 'condition', photoSlotId: 'wheel_front_right', hint: 'tread mm per corner, cracks, uneven wear — each corner has its own photo' },
  { id: 'cond_rims', group: 'Wheels & tyres', name: 'Rims', kind: 'condition', hint: 'kerbing, cracks, buckles' },
  { id: 'fn_spare', group: 'Wheels & tyres', name: 'Spare wheel present & serviceable', kind: 'presence', photoSlotId: 'spare_wheel' },
  { id: 'fn_jack', group: 'Wheels & tyres', name: 'Jack & wheel tools present', kind: 'presence', photoSlotId: 'vehicle_jack' },

  // ---- Interior ----
  { id: 'int_dash', group: 'Interior', name: 'Dashboard & warning lights', kind: 'condition', photoSlotId: 'interior_cabin', hint: 'any lights on with ignition' },
  { id: 'int_seat_driver', group: 'Interior', name: 'Driver seat & trim', kind: 'condition', photoSlotId: 'interior_cabin' },
  { id: 'int_seat_pass', group: 'Interior', name: 'Passenger seat & trim', kind: 'condition', photoSlotId: 'interior_cabin' },
  { id: 'int_seats_rear', group: 'Interior', name: 'Rear seats', kind: 'condition', photoSlotId: 'interior_cabin' },
  { id: 'int_headliner', group: 'Interior', name: 'Roof lining (headliner)', kind: 'condition', hint: 'sagging, stains, smoke' },
  { id: 'int_carpets', group: 'Interior', name: 'Carpets & mats', kind: 'condition', photoSlotId: 'interior_cabin' },
  { id: 'fn_aircon', group: 'Interior', name: 'Aircon blows cold', kind: 'function' },
  { id: 'fn_electrics', group: 'Interior', name: 'Windows, mirrors, central locking work', kind: 'function' },
  { id: 'fn_infotainment', group: 'Interior', name: 'Infotainment & reverse camera work', kind: 'function' },

  // ---- Engine & underbody ----
  { id: 'eng_bay', group: 'Engine & underbody', name: 'Engine bay', kind: 'condition', photoSlotId: 'engine_bay', hint: 'leaks, corrosion, non-standard wiring' },
  { id: 'fn_leaks', group: 'Engine & underbody', name: 'No oil / coolant leaks', kind: 'function' },
  { id: 'fn_battery', group: 'Engine & underbody', name: 'Battery secure & healthy', kind: 'function' },
  { id: 'fn_smoke', group: 'Engine & underbody', name: 'No abnormal smoke on start', kind: 'function' },
  { id: 'eng_under', group: 'Engine & underbody', name: 'Undercarriage', kind: 'condition', hint: 'rust, impact, weld repairs — no dedicated photo slot, note only' },

  // ---- Identity & documents ----
  { id: 'doc_vin', group: 'Identity & documents', name: 'VIN plate', kind: 'condition', hint: 'legible, untampered — no dedicated photo slot, note only' },
  { id: 'fn_vin_match', group: 'Identity & documents', name: 'VIN matches licence disc & papers', kind: 'function' },
  { id: 'fn_service', group: 'Identity & documents', name: 'Service history', kind: 'service_history', hint: 'book or digital history confirmed', photoSlotId: 'service_book' },
  { id: 'fn_disc', group: 'Identity & documents', name: 'Licence disc present & current', kind: 'presence', photoSlotId: 'license_disc' },
  { id: 'fn_spare_key', group: 'Identity & documents', name: 'Spare key present', kind: 'presence', photoSlotId: 'spare_keys' },
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
      { id: 'license_disc', q: 'License disc present and current? (photograph it in Front & Engine)', flagWhen: 'no' },
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
