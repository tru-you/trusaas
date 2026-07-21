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
}

/** TruInspect: a single AI-detected (or manually logged) damage item on a photo */
export interface DamageFinding {
  /** Panel / area, e.g. "front bumper", "driver door" */
  panel: string;
  damageType: 'scratch' | 'dent' | 'chip' | 'rust' | 'crack' | 'hail' | 'paint' | 'wear' | 'missing' | 'other';
  /** 1 = cosmetic blemish … 5 = structural / safety concern */
  severity: 1 | 2 | 3 | 4 | 5;
  /** 0–1 model confidence */
  confidence: number;
  /** Short human note, e.g. "20cm scratch through clearcoat" */
  note: string;
  /** Rough location words for the report, e.g. "lower left" */
  location?: string;
  /** Inspector moderation: AI findings start 'ai'; inspector can confirm/dismiss */
  status?: 'ai' | 'confirmed' | 'dismissed';
}

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
    required: false,
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
