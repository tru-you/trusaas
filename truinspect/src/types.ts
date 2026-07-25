export interface PhotoSlot {
  id: string;
  name: string;
  description: string;
  overlaySvgPath: string; // Describes the silhouette outline
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number;
  category: string;
}

export interface QualityReport {
  overallScore: number; // 0 to 100
  lightingCheck: {
    status: 'Poor' | 'Fair' | 'Perfect';
    brightness: number; // 0 to 255
    contrast: number; // 0 to 255
    feedback: string;
  };
  angleCheck: {
    status: 'Off-Angle' | 'Good' | 'Perfect';
    pitchDiff: number;
    rollDiff: number;
    feedback: string;
  };
  aiAnalysis?: {
    identifiedVehicle?: string;
    suggestedTitle?: string;
    suggestedDescription?: string;
    detectedIssues?: string[];
  };
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  vin: string;
  stockNumber: string;
  color: string;
  price: number;
  vehicleType?: string; // Bakkie, Sedan, SUV, etc.
  /** Who carried out the inspection. Printed on the VIR — the report lands with
   *  buyers and finance houses, and a dealership name is not an inspector. */
  inspectorName?: string;
  inspectorRole?: string;
  status: 'In-Progress' | 'Ready' | 'Listed';
  createdAt: string;
  updatedAt: string;
  photos: Record<string, string>; // slotId -> base64 or path
  quality: Record<string, QualityReport>; // slotId -> report
  /** Publish to public website feed when true (default false until one-tap publish) */
  showOnWebsite?: boolean;
  /** Dealer branding for VIR / share (from settings) */
  dealerName?: string;
  dealerLogoDataUrl?: string;
  dealerPhone?: string;
  dealerWhatsApp?: string;
  /** Set after a successful TruFlow DMS export */
  lastDmsExportAt?: string;
  lastDmsExportStatus?: string;
  lastDmsVehicleId?: string | null;
  lastDmsStockNumber?: string;
  /** Last web 3D / spin package export */
  lastWeb3dExportAt?: string;
  web3dPublicPath?: string;
  /** TruInspect: AI damage findings per photo slot */
  damageFindings?: Record<string, DamageFinding[]>;
  /** TruInspect: inspector questionnaire answers, keyed by checklist item id */
  inspectionChecklist?: Record<string, ChecklistAnswer>;
  /** TruInspect: per-point inspection results (rating / works / comment), keyed by point id */
  inspectionPoints?: Record<string, PointResult>;
  /** TruInspect: condition + note recorded at the moment each photo is taken, keyed by photo slot id */
  slotAssessment?: Record<string, PointResult>;
  /** TruInspect: close-up damage photos taken at capture time, keyed by photo slot id */
  closeups?: Record<string, string[]>;
}

/** TruInspect: one answered checklist question */
export interface ChecklistAnswer {
  answer: 'yes' | 'no' | 'na';
  note?: string;
}

export interface ChecklistItem {
  id: string;
  q: string;
  /** Which answer means "problem — disclose on report" */
  flagWhen: 'yes' | 'no';
}

/** Inspector questionnaire — the things a camera can't prove */
export const INSPECTION_CHECKLIST: { section: string; items: ChecklistItem[] }[] = [
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

/** TruInspect: a single AI-detected (or manually logged) damage item on a photo */
/**
 * A defect the inspector tags by hand on a real photo. Every field is entered
 * by a person — nothing inferred — because this ends up on a report a buyer
 * relies on. `x`/`y` pin the mark to the exact spot on the photo it belongs to.
 */
export interface DamageFinding {
  /** Stable id for editing/removing a tag */
  id: string;
  /** Panel / area, e.g. "front bumper", "driver door" (defaults from the slot) */
  panel: string;
  damageType: 'scratch' | 'dent' | 'chip' | 'rust' | 'crack' | 'hail' | 'paint' | 'wear' | 'missing' | 'other';
  /** 1 = cosmetic blemish … 5 = structural / safety concern */
  severity: 1 | 2 | 3 | 4 | 5;
  /** Inspector's note, e.g. "20cm scratch through clearcoat" */
  note: string;
  /** Position of the mark on the photo, 0–1 relative to width/height */
  x: number;
  y: number;
  /** Who created it: the inspector by hand, or a real vision model as a suggestion */
  source?: 'manual' | 'ai';
  /** AI suggestions start false; only a human-confirmed tag reaches the report */
  confirmed?: boolean;
}

/**
 * One line item in the inspection. Two kinds:
 *  - 'condition': a physical area rated OK / Note / Damage, often with a photo
 *    the inspector can tag damage on (photoSlotId).
 *  - 'function': something that either works or doesn't — headlights, indicators,
 *    wipers, aircon — recorded as Works / Faulty / N/A.
 * Every point takes a free comment. The report is graded only from these real
 * inputs plus tagged damage — never a black-box score.
 */
export interface InspectionPoint {
  id: string;
  group: string;
  name: string;
  kind: 'condition' | 'function';
  /** condition points that have a captured photo to tag damage on */
  photoSlotId?: string;
  /** short prompt shown under the name, e.g. "tread depth", "matches licence disc?" */
  hint?: string;
}

/** The inspector's result for one point, keyed by point id on the vehicle. */
export interface PointResult {
  /** condition points */
  rating?: 'ok' | 'note' | 'damage';
  /** function points */
  works?: 'yes' | 'no' | 'na';
  comment?: string;
}

/**
 * The full inspection sheet — every part of the car gets a place to rate,
 * check function, comment, and (where there's a photo) tag damage.
 */
export const INSPECTION_POINTS: InspectionPoint[] = [
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
  { id: 'tyre_tread', group: 'Wheels & tyres', name: 'Tyre tread & condition', kind: 'condition', photoSlotId: 'wheels_all', hint: 'tread mm per corner, cracks, uneven wear' },
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

export interface DmsExportResult {
  success: boolean;
  synced?: boolean;
  created?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
  breakdown?: {
    mainImages: number;
    extras: number;
    damage: number;
    vin: number;
    serviceBook: number;
    total: number;
  };
  dmsUrl?: string;
  dmsVehicle?: { id?: string; stockNumber?: string; images?: string[] } | null;
  vehicle?: Vehicle;
}

export const PHOTO_SLOTS: PhotoSlot[] = [
  // Phase 1: Exterior Panels (Lens Folder: Exterior Panels -> TruFlow: Main images)
  {
    id: 'front_3_4',
    name: 'Front 3/4 (Hero)',
    description: 'Stand at a 45-degree angle from the front driver-side corner.',
    overlaySvgPath: 'front_3_4',
    required: true,
    idealAngle: { pitch: 12, roll: 0, yaw: 45 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'front_straight',
    name: 'Front Profile',
    description: 'Position camera level with the front grill, perfectly centered.',
    overlaySvgPath: 'front_profile',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_3_4',
    name: 'Rear 3/4',
    description: 'Stand at a 45-degree angle from the rear passenger-side corner.',
    overlaySvgPath: 'rear_3_4',
    required: true,
    idealAngle: { pitch: 12, roll: 0, yaw: 135 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'rear_straight',
    name: 'Rear Profile',
    description: 'Position camera level with the rear bumper, perfectly centered.',
    overlaySvgPath: 'rear_profile',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_driver',
    name: 'Driver Side Profile',
    description: 'Position camera level with the middle of the vehicle on the driver side.',
    overlaySvgPath: 'side_profile',
    required: true,
    idealAngle: { pitch: 8, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'side_passenger',
    name: 'Passenger Side Profile',
    description: 'Position camera level with the middle of the vehicle on the passenger side.',
    overlaySvgPath: 'side_profile',
    required: true,
    idealAngle: { pitch: 8, roll: 0, yaw: -90 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'roof_view',
    name: 'Roof View',
    description: 'Hold camera high to capture the condition of the roof and sunroof if applicable.',
    overlaySvgPath: 'roof_view',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 0 },
    phase: 1,
    category: 'Exterior Panels',
  },
  {
    id: 'wheels_all',
    name: 'Wheels & Tyres',
    description: 'Capture close-ups of all 4 wheels and the spare tyre if visible.',
    overlaySvgPath: 'rims_condition',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 90 },
    phase: 1,
    category: 'Exterior Panels',
  },

  // Phase 2: Details & Badges (Lens Folder: Interior + Engine -> TruFlow: Additional images)
  {
    id: 'badges_detail',
    name: 'Badges & Branding',
    description: 'Close-up of model, engine, and brand badges.',
    overlaySvgPath: 'generic_detail',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },
  {
    id: 'lights_detail',
    name: 'Headlights & Taillights',
    description: 'Close-up of clear lenses to prove no cracks or fogging.',
    overlaySvgPath: 'generic_detail',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },
  {
    id: 'mirrors_handles',
    name: 'Mirrors & Door Handles',
    description: 'Check for scuffs on mirrors and wear on handles.',
    overlaySvgPath: 'generic_detail',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 2,
    category: 'Interior + Engine',
  },

  // Phase 3: Interior (Lens Folder: Interior + Engine -> TruFlow: Additional images)
  {
    id: 'interior_dash',
    name: 'Dashboard & Steering',
    description: 'Shoot from back seat centered, capturing steering wheel and active instrument cluster.',
    overlaySvgPath: 'interior_dash',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_driver',
    name: 'Driver Seat',
    description: 'Capture the driver seat bolsters and general condition.',
    overlaySvgPath: 'interior_seats',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: 45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seat_passenger',
    name: 'Passenger Seat',
    description: 'Capture the passenger seat and front cabin area.',
    overlaySvgPath: 'interior_seats',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: -45 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'seats_rear',
    name: 'Rear Seats',
    description: 'Capture condition of rear passenger bench.',
    overlaySvgPath: 'interior_seats',
    required: true,
    idealAngle: { pitch: -5, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'boot_bay',
    name: 'Boot / Load Bay',
    description: 'Open tailgate/boot and capture storage area condition.',
    overlaySvgPath: 'rear_profile',
    required: true,
    idealAngle: { pitch: 10, roll: 0, yaw: 180 },
    phase: 3,
    category: 'Interior + Engine',
  },
  {
    id: 'floor_mats',
    name: 'Floor Mats & Carpets',
    description: 'Capture the condition of carpets and mats in all footwells.',
    overlaySvgPath: 'generic_detail',
    required: false,
    idealAngle: { pitch: -45, roll: 0, yaw: 0 },
    phase: 3,
    category: 'Interior + Engine',
  },

  // Phase 4: Engine Bay & Mechanical (Lens Folder: Interior + Engine -> TruFlow: Additional images)
  {
    id: 'engine_bay',
    name: 'Engine Bay',
    description: 'Shoot from front center looking down, hood fully propped.',
    overlaySvgPath: 'engine_bay',
    required: true,
    idealAngle: { pitch: 35, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },
  {
    id: 'mechanical_details',
    name: 'Battery & Fluids',
    description: 'Close-up of battery terminals and fluid reservoirs.',
    overlaySvgPath: 'generic_detail',
    required: false,
    idealAngle: { pitch: 45, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },
  {
    id: 'undercarriage',
    name: 'Undercarriage',
    description: 'Low angle shot showing chassis, exhaust, and lack of leaks.',
    overlaySvgPath: 'generic_detail',
    required: true,
    idealAngle: { pitch: -30, roll: 0, yaw: 0 },
    phase: 4,
    category: 'Interior + Engine',
  },

  // Phase 5: Recon / Work Photos (Lens Folder: Recon Photos -> TruFlow: reconTasks + damage photos)
  {
    id: 'recon_damage',
    name: 'Damage & Recon',
    description: 'Document specific scratches, dents, or areas needing repair.',
    overlaySvgPath: 'vehicle_damage',
    required: false,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 5,
    category: 'Recon Photos',
  },

  // Phase 6: Documents (Lens Folder: Documents -> TruFlow: Extra images)
  {
    id: 'service_book',
    name: 'Service History Book',
    description: 'Capture the service booklet maintenance stamps.',
    overlaySvgPath: 'service_book',
    required: true,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'reg_papers',
    name: 'Registration Papers',
    description: 'Capture vehicle registration or title documents.',
    overlaySvgPath: 'service_book',
    required: true,
    idealAngle: { pitch: -20, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'odometer_reading',
    name: 'Odometer Close-up',
    description: 'Capture a clear image of the current mileage on the instrument cluster.',
    overlaySvgPath: 'generic_detail',
    required: true,
    idealAngle: { pitch: 0, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },
  {
    id: 'vin_plate',
    name: 'VIN Plate / Sticker',
    description: 'Capture the manufacturer VIN plate or barcode sticker.',
    overlaySvgPath: 'barcode_scanner',
    required: true,
    idealAngle: { pitch: -15, roll: 0, yaw: 0 },
    phase: 6,
    category: 'Documents',
  },

  // Phase 7: 360 Walkaround Video (Lens Folder: 360 Video -> TruFlow: Main media / video field)
  {
    id: 'video_360',
    name: '360° Video Walkaround',
    description: 'Capture a complete 360-degree high-fidelity continuous walkaround video.',
    overlaySvgPath: 'video_360',
    required: true,
    idealAngle: { pitch: 5, roll: 0, yaw: 0 },
    phase: 7,
    category: '360 Video',
  },
];

export const STUDIO_BACKGROUNDS = [
  { id: 'none', name: 'Original Background', class: 'bg-transparent', label: 'Transparent / Off' },
  {
    id: 'showroom_luxury',
    name: 'Luxury Showroom',
    description: 'Polished marble tiles with professional overhead spotlight highlights.',
    gradient: 'linear-gradient(135deg, #1f2937, #111827)',
    lightingPreset: { brightness: 1.1, contrast: 1.15, saturation: 1.0 },
  },
  {
    id: 'studio_clean',
    name: 'Infinity Studio',
    description: 'Seamless minimalist white cyclorama walls with soft studio diffuser box lights.',
    gradient: 'linear-gradient(to bottom, #f3f4f6, #e5e7eb, #d1d5db)',
    lightingPreset: { brightness: 1.0, contrast: 1.1, saturation: 0.9 },
  },
  {
    id: 'industrial_depot',
    name: 'Industrial Depot',
    description: 'Exposed warm bricks, rustic iron pillars, and cinematic side ambient neon styling.',
    gradient: 'linear-gradient(135deg, #2d3748, #1a202c)',
    lightingPreset: { brightness: 0.95, contrast: 1.2, saturation: 1.05 },
  },
  {
    id: 'outdoor_sunset',
    name: 'Coastal Sunset',
    description: 'Warm, golden hour horizon overlooking an outdoor coastal dealership pad.',
    gradient: 'linear-gradient(to top, #fda4af, #fef08a, #bae6fd)',
    lightingPreset: { brightness: 1.05, contrast: 1.0, saturation: 1.2 },
  },
];
