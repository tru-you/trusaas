/**
 * TRULENS'S COPY of the canonical template at
 * assets/templates/vehicle-template.ts (same convention as src/brand.css
 * copied from assets/brand/tokens.css — no sync script, review `git diff`
 * against the canonical file before editing this one by hand).
 *
 * Same 27 slots/order/categories as the canonical file and as Truinspect's
 * copy, but every slot's `required` is deliberately `false` here (2026-07-31,
 * Paul's call) — TruLens feeds a dealer website, not a graded VIR, so it's the
 * dealer's call what goes on their site; a 5-photo shoot must sync just as
 * cleanly as a full 27. Do NOT copy this required:false pattern back into
 * Truinspect's copy — its deeper inspection stays strict by design (its own
 * trade-in flow has a separate, existing "Showroom Condition" bypass in
 * TradeInWalkAround.tsx for when photos genuinely aren't needed).
 *
 * No checklistGroups / checklistPoints / disclosureQuestions either — TruLens
 * has no inspection-checklist equivalent (that's Truinspect's deeper
 * feature). No video/360-capture slot — TruOrbit (the 3D spin viewer this app
 * builds and publishes) is assembled entirely from the exterior panel PHOTOS
 * below, see lib/web3dPackage.ts; it was never built from a recorded video.
 *
 * This list is the same 27 ids/order/categories as Truinspect's
 * src/types/inspection.ts TRADE_IN_ITEMS, on purpose: a vehicle captured here
 * and later run through Truinspect (or vice versa) shares one photo per slot
 * instead of each app re-shooting the same 27 angles.
 */

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number; // -> TemplatePhase.id
  category: string;
  /* Retail capture tier (TruLens only — TruInspect ignores this and stays a full
     graded VIR). `core` = the honest minimum for a listing, `recommended` adds
     trust, `extra` shows only on request. Stamped onto the slots below rather
     than written into each literal so this list stays byte-identical to the
     canonical / Truinspect copies for `git diff`. */
  tier?: 'core' | 'recommended' | 'extra';
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
    required: false,
    idealAngle: { pitch: 30, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'engine_bay',
    name: 'Engine Bay (Under Bonnet)',
    description: 'Prop the bonnet fully open and shoot from front-centre looking down.',
    required: false,
    idealAngle: { pitch: 35, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'front_bumper',
    name: 'Front Bumper & Grill',
    description: 'Position the camera level with the front bumper, perfectly centred.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'front_windscreen',
    name: 'Front Windscreen',
    description: 'Stand at the front and frame the full windscreen, checking for chips and cracks.',
    required: false,
    idealAngle: { pitch: 15, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'license_disc',
    name: 'Licence Disc',
    description: 'Close-up on the license disc through the windscreen, sharp enough to read the expiry date.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Front & Engine',
  },
  {
    id: 'vin_plate',
    name: 'VIN Number Plate',
    description: 'Close-up of the VIN plate — dashboard (visible through windscreen) or driver-side door jamb. Must be legible.',
    required: false,
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
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 45 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_front_right',
    name: 'Front Right Wheel & Tyre',
    description: 'Rim face and tyre wall, shot as you reach this corner on the lap.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_front_right',
    name: 'Driver Door & Side Mirror',
    description: 'Position the camera level with the driver door and mirror.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_rear_right',
    name: 'Rear Right Door',
    description: 'Position the camera level with the rear right door.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 100 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'quarter_rear_right',
    name: 'Rear Right Quarter Panel',
    description: 'Stand at the rear-right corner, 45 degrees off the tail.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_rear_right',
    name: 'Rear Right Wheel & Tyre',
    description: 'Rim face and tyre wall on the rear-right corner.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: 135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'boot_tailgate',
    name: 'Boot Exterior / Tailgate',
    description: 'Position the camera level with the rear bumper, centred on the boot or tailgate.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'rear_bumper',
    name: 'Rear Bumper',
    description: 'Position the camera level with the rear bumper, perfectly centred.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'spare_wheel',
    name: 'Spare Wheel & Boot Floor',
    description: 'Open the boot floor and photograph the spare wheel and tray, if the dealer wants it shown.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'vehicle_jack',
    name: 'Jack & Tool Kit',
    description: 'Photograph the jack, wheel spanner and tool kit, if the dealer wants it shown.',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 180 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'quarter_rear_left',
    name: 'Rear Left Quarter Panel',
    description: 'Stand at the rear-left corner, 45 degrees off the tail.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: -135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_rear_left',
    name: 'Rear Left Wheel & Tyre',
    description: 'Rim face and tyre wall on the rear-left corner.',
    required: false,
    idealAngle: { pitch: -15, roll: 0, yaw: -135 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_rear_left',
    name: 'Rear Left Door',
    description: 'Position the camera level with the rear left door.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: -100 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'door_front_left',
    name: 'Front Left Door & Side Mirror',
    description: 'Position the camera level with the front left door and mirror.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: -90 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'fender_front_left',
    name: 'Front Left Wing / Fender',
    description: 'Stand at the front-left corner, 45 degrees off the nose.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: -45 },
    phase: 2,
    category: 'Clockwise Exterior',
  },
  {
    id: 'wheel_front_left',
    name: 'Front Left Wheel & Tyre',
    description: 'Rim face and tyre wall on the front-left corner, closing the lap.',
    required: false,
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
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'interior_cabin',
    name: 'Interior Cabin',
    description: 'Shoot from the rear seat centred, capturing the dash, front seats and footwell trim.',
    required: false,
    idealAngle: { pitch: -5, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'service_book',
    name: 'Service Book',
    description: 'Capture the service booklet or digital service history maintenance stamps.',
    required: false,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'odometer',
    name: 'Odometer',
    description: 'Capture a clear, legible image of the current mileage on the instrument cluster.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
  {
    id: 'spare_keys',
    name: 'Spare Keys',
    description: 'Photograph the spare key and remote(s), if the dealer wants it shown.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior, History & Verification',
  },
];

/* Retail capture tiers — TruLens only. `core` is the honest listing minimum: the
   eight exterior-lap panels (which also build the TruOrbit 360, so every side of
   the car is shown — damage can't be hidden by having fewer angles) plus one
   interior and the odometer. `extra` is shown only on request. Everything else is
   `recommended`. Stamped here so the 27 slot literals above stay identical to the
   canonical / Truinspect copies. TruInspect never reads `tier`, so its deep flow
   is untouched. */
export const CORE_SLOT_IDS = new Set<string>([
  'front_bumper', 'fender_front_right', 'door_front_right', 'quarter_rear_right',
  'rear_bumper', 'quarter_rear_left', 'door_front_left', 'fender_front_left',
  'interior_cabin', 'odometer',
]);
const EXTRA_SLOT_IDS = new Set<string>([
  'bonnet', 'door_rear_right', 'door_rear_left', 'spare_wheel', 'vehicle_jack',
  'roof_sunroof', 'spare_keys',
]);
for (const s of SLOTS) {
  s.tier = CORE_SLOT_IDS.has(s.id) ? 'core' : EXTRA_SLOT_IDS.has(s.id) ? 'extra' : 'recommended';
}

const PHASES: TemplatePhase[] = [
  { id: 1, name: 'Front & Engine', reportCard: { label: 'Front & Engine', iconKey: 'wrench' } },
  { id: 2, name: 'Clockwise Exterior Walk-Around', reportCard: { label: 'Exterior', iconKey: 'camera' } },
  { id: 3, name: 'Interior, History & Verification', reportCard: { label: 'Interior & History', iconKey: 'clipboard' } },
];

export const vehicleTemplate: InspectionTemplate = {
  id: 'vehicle-v1',
  label: 'Vehicle capture',
  slots: SLOTS,
  phases: PHASES,
  // no checklistGroups / checklistPoints / disclosureQuestions — TruLens is
  // capture-only, that deeper inspection layer is Truinspect's
};

/* Motorcycle photo capture template — 14 core angles */
export const MOTO_SLOTS: TemplateSlot[] = [
  {
    id: 'front_left_three_quarter',
    name: 'Front 3/4 (Left)',
    description: 'Stand 45 degrees off the front left, capturing the front profile, headlight and handlebars.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: -45 },
    phase: 1,
    category: 'Walk-Around',
    tier: 'core',
  },
  {
    id: 'front_right_three_quarter',
    name: 'Front 3/4 (Right)',
    description: 'Stand 45 degrees off the front right, capturing the front profile, brake rotor and forks.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: 45 },
    phase: 1,
    category: 'Walk-Around',
    tier: 'core',
  },
  {
    id: 'profile_left',
    name: 'Left Side Profile',
    description: 'Stand side-on to capture the full left profile of the motorcycle.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Walk-Around',
    tier: 'core',
  },
  {
    id: 'profile_right',
    name: 'Right Side Profile',
    description: 'Stand side-on to capture the full right profile showing exhaust, engine and drive.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Walk-Around',
    tier: 'core',
  },
  {
    id: 'front_wheel_brake',
    name: 'Front Wheel & Disc Brakes',
    description: 'Close-up of the front tyre, rim, brake calipers and fork stanchions.',
    required: false,
    idealAngle: { pitch: 15, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'cockpit_handlebars',
    name: 'Cockpit & Handlebars',
    description: 'Shoot from rider perspective showing grips, levers, mirrors and switchgear.',
    required: false,
    idealAngle: { pitch: 20, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Component Details',
    tier: 'core',
  },
  {
    id: 'odometer',
    name: 'Odometer & Dash Display',
    description: 'Clear, legible close-up of the instrument cluster showing mileage and warning lights.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Component Details',
    tier: 'core',
  },
  {
    id: 'fuel_tank',
    name: 'Fuel Tank & Paintwork',
    description: 'Capture the top and sides of the tank checking for dents, scuffs or paint chips.',
    required: false,
    idealAngle: { pitch: 25, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'engine_left',
    name: 'Engine (Left Side)',
    description: 'Close-up of the left engine casing, clutch cover and gear shift linkage.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: -90 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'engine_right',
    name: 'Engine & Headers (Right Side)',
    description: 'Close-up of the right engine casing, brake pedal and exhaust downpipes.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 90 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'exhaust_silencer',
    name: 'Exhaust & Silencer',
    description: 'Capture the full muffler and exhaust can, checking for scraping or modifications.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 120 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'rear_wheel_chain',
    name: 'Rear Wheel, Chain & Sprocket',
    description: 'Close-up of rear rim, tyre tread, drive chain tension and rear sprocket teeth.',
    required: false,
    idealAngle: { pitch: 10, roll: 0, yaw: -135 },
    phase: 2,
    category: 'Component Details',
    tier: 'recommended',
  },
  {
    id: 'rear_tail',
    name: 'Rear Tail & Brake Light',
    description: 'Direct rear view showing tail light, turn signals and number plate bracket.',
    required: false,
    idealAngle: { pitch: 5, roll: 0, yaw: 180 },
    phase: 1,
    category: 'Walk-Around',
    tier: 'core',
  },
  {
    id: 'vin_plate',
    name: 'VIN / Frame Stamping & Licence Disc',
    description: 'Close-up of headstock frame stamping and valid licence disc.',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'History & Documentation',
    tier: 'core',
  },
];

const MOTO_PHASES: TemplatePhase[] = [
  { id: 1, name: 'Walk-Around', reportCard: { label: 'Walk-Around', iconKey: 'camera' } },
  { id: 2, name: 'Component Details', reportCard: { label: 'Components', iconKey: 'wrench' } },
  { id: 3, name: 'History & Documentation', reportCard: { label: 'Documentation', iconKey: 'clipboard' } },
];

export const motoTemplate: InspectionTemplate = {
  id: 'moto-v1',
  label: 'Motorcycle capture',
  slots: MOTO_SLOTS,
  phases: MOTO_PHASES,
};

