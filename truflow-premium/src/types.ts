export type VehicleStatus = 'INVENTORY' | 'PENDING' | 'SOLD';

export interface Dealership {
  id: string;
  name: string;
  location: string;
  /** The dealer's own public showroom. The sidebar link was hardcoded to
   *  true-cars.co.za, so every dealer got a link to our consumer site rather
   *  than to their own website. */
  websiteUrl?: string;
  /** Slug used by the public stock feed (?dealer=). */
  slug?: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  status: VehicleStatus;
  retailPrice: number;
  costPrice: number;
  mileage: number;
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  stockNumber: string;
  dateAcquired: string;
  daysInInventory: number;
  description: string;
  bodyType?: string;
  engine?: string;
  images?: string[];
  damagePhotos?: string[];
  vinPhotos?: string[];
  serviceBookPhotos?: string[];
  extrasPhotos?: string[];
  lastPhotoSync?: string;
  reconTasks?: { id: string; name: string; cost: number; status: 'Pending' | 'In Progress' | 'Completed'; dateAdded: string; category?: string; photo?: string }[];
  inspectionResults?: Record<string, 'Pass' | 'Attention'>;
  dealershipId?: string;
  /** Showroom tier this vehicle is shelved under on the dealer website
   *  (MKR's Premium Used / Select / Performance pages). Left unset means the
   *  dealer hasn't chosen, and the site falls back to its own price/name
   *  heuristic rather than the DMS silently picking one. */
  category?: 'used' | 'select' | 'performance';
  /** TruPrice — an honest market-value benchmark for this vehicle, independent
   *  of retailPrice, set by the dealer from their own trade knowledge.
   *  Public sites show "R below TruPrice" from the delta, so it is only worth
   *  anything if a person stands behind the number. */
  truPrice?: number;

  /* The four below are already written by the TruLens sync and already present
     on every vehicle in data.json — they were simply never declared here, so
     the one route that creates stock from a capture could not be type-checked
     at all. */
  vin?: string;
  color?: string;
  /** Where the record came from, e.g. "trulens". */
  source?: string;
  /** Whether the dealer's public feed may show this unit. Undefined is treated
   *  as published by the feed, which is why the TruLens Publish toggle has to
   *  send `false` explicitly rather than omitting the field. */
  showOnWebsite?: boolean;
}

export type LeadStatus = 'New' | 'Contacted' | 'Test Drive Scheduled' | 'Negotiating' | 'Closed Won' | 'Closed Lost';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  vehicleId: string;
  source: string;
  status: LeadStatus;
  assignedUserId: string;
  createdAt: string;
  lastContactedAt: string | null;
  digitalScore: number;
  notes: string;
  journey?: { time: string; action: string; detail: string }[];
  dealershipId?: string;
  /** What happens next with this customer, and when. This is the whole point
   *  of a pipeline — a lead without a next step is a lead you have already
   *  lost, and "overdue" previously only meant "new or never contacted", so a
   *  customer you spoke to three weeks ago and forgot never surfaced. */
  nextAction?: string;
  nextActionAt?: string | null;
  /** When the lead last moved stage — lets you see deals stuck in Negotiating. */
  stageChangedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  leadId?: string;
  vehicleId?: string;
  assignedUserId: string;
  dueDate: string;
  priority: 'Normal' | 'High' | 'Urgent' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  dealershipId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  leadId: string;
  vehicleId: string;
  amount: number;
  paymentMethod: string;
  status: 'Sent' | 'Paid' | 'Overdue';
  dueDate: string;
  additionalCharges?: number;
  chargeDescription?: string;
  dealershipId?: string;
}

export interface Agreement {
  id: string;
  agreementNumber: string;
  leadId: string;
  vehicleId: string;
  purchasePrice: number;
  depositAmount: number;
  type: 'Vehicle Sale' | 'Deposit Hold' | 'Trade-In Transfer' | 'Offer to Purchase' | 'Finance Application';
  status: 'Pending Signature' | 'Signed' | 'Completed';
  signature?: string;
  signedAt?: string;
  signedBy?: string;
  dealershipId?: string;
  date?: string;
}

/** A dealer's own uploaded document (any file/template — we don't prescribe what it is) with an e-sign flow. */
export interface DealerDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileData: string; // data URL — original uploaded file
  status: 'Unsigned' | 'Signed';
  uploadedAt: string;
  signature?: string; // data URL of drawn signature, or "TYPED:Name"
  signedBy?: string;
  signedAt?: string;
  leadId?: string;
  vehicleId?: string;
  dealershipId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'salesperson' | 'manager' | 'admin';
  phone: string;
  isActive: boolean;
  dealershipId?: string;
}

export interface Communication {
  id: string;
  leadId: string;
  type: 'email' | 'sms' | 'whatsapp' | 'call';
  subject: string;
  content: string;
  sentBy: string;
  sentAt: string;
  dealershipId?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  referenceId?: string; // maps to a vehicle stockNumber or ID
  reconciled: boolean;
  dealershipId?: string;
}

export interface DigitalProduct {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface DigitalSale {
  id: string;
  productId: string;
  leadId: string;
  saleDate: string;
  amount: number;
  status: 'Pending' | 'Active' | 'Cancelled';
}

export interface DMSState {
  vehicles: Vehicle[];
  leads: Lead[];
  tasks: Task[];
  invoices: Invoice[];
  agreements: Agreement[];
  documents: DealerDocument[];
  users: User[];
  communications: Communication[];
  expenses: Expense[];
  dealerships: Dealership[];
  /** Vestigial. Neither the server seed nor the live data.json has ever
   *  carried these, and nothing reads them — api.ts just defaults them to [].
   *  Optional so the server's state can be typed against this interface
   *  honestly, rather than seeding two empty arrays to satisfy a shape that
   *  does not describe the data. */
  digitalProducts?: DigitalProduct[];
  digitalSales?: DigitalSale[];
  settings?: PremiumSettings;
}

export type PlanTier = 'lite' | 'standard' | 'premium';

export interface PremiumSettings {
  tier: PlanTier;
  truLens: boolean;
  truInspect: boolean;
  websitePortal: boolean;
  multiPortalSync: boolean;
  trueAI: boolean;
  smartLedger: boolean;
  chatbot: boolean;
  liveReceptionist: boolean;
  seoAeo: boolean;
  syndication: boolean;
}

export const PLAN_DEFAULTS: Record<PlanTier, PremiumSettings> = {
  lite: {
    tier: 'lite',
    truLens: false,
    truInspect: false,
    websitePortal: false,
    multiPortalSync: false,
    trueAI: false,
    smartLedger: false,
    chatbot: false,
    liveReceptionist: false,
    seoAeo: false,
    syndication: false,
  },
  standard: {
    tier: 'standard',
    truLens: true,
    truInspect: false,
    websitePortal: true,
    multiPortalSync: false,
    trueAI: true,
    smartLedger: true,
    chatbot: true,
    liveReceptionist: false,
    seoAeo: false,
    syndication: false,
  },
  premium: {
    tier: 'premium',
    truLens: true,
    truInspect: true,
    websitePortal: true,
    multiPortalSync: true,
    trueAI: true,
    smartLedger: true,
    chatbot: true,
    liveReceptionist: true,
    seoAeo: true,
    syndication: true,
  },
};

// --- TruLens / AutoLens Photo Types ---

export interface PhotoSlot {
  id: string;
  name: string;
  description: string;
  overlaySvgPath: string;
  required: boolean;
  idealAngle: { pitch: number; roll: number; yaw: number };
  phase: number;
  category: string;
}

export interface QualityReport {
  overallScore: number;
  lightingCheck: {
    status: 'Poor' | 'Fair' | 'Perfect';
    brightness: number;
    contrast: number;
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

export const PHOTO_SLOTS: PhotoSlot[] = [
  { id: 'front_3_4', name: 'Front 3/4 (Hero)', description: 'Stand at a 45-degree angle from the front driver-side corner.', overlaySvgPath: 'front_3_4', required: true, idealAngle: { pitch: 12, roll: 0, yaw: 45 }, phase: 1, category: 'Exterior Panels' },
  { id: 'front_straight', name: 'Front Profile', description: 'Position camera level with the front grill, perfectly centered.', overlaySvgPath: 'front_profile', required: true, idealAngle: { pitch: 10, roll: 0, yaw: 0 }, phase: 1, category: 'Exterior Panels' },
  { id: 'rear_3_4', name: 'Rear 3/4', description: 'Stand at a 45-degree angle from the rear passenger-side corner.', overlaySvgPath: 'rear_3_4', required: true, idealAngle: { pitch: 12, roll: 0, yaw: 135 }, phase: 1, category: 'Exterior Panels' },
  { id: 'rear_straight', name: 'Rear Profile', description: 'Position camera level with the rear bumper, perfectly centered.', overlaySvgPath: 'rear_profile', required: true, idealAngle: { pitch: 10, roll: 0, yaw: 180 }, phase: 1, category: 'Exterior Panels' },
  { id: 'side_driver', name: 'Driver Side Profile', description: 'Position camera level with the middle of the vehicle on the driver side.', overlaySvgPath: 'side_profile', required: true, idealAngle: { pitch: 8, roll: 0, yaw: 90 }, phase: 1, category: 'Exterior Panels' },
  { id: 'side_passenger', name: 'Passenger Side Profile', description: 'Position camera level with the middle of the vehicle on the passenger side.', overlaySvgPath: 'side_profile', required: true, idealAngle: { pitch: 8, roll: 0, yaw: -90 }, phase: 1, category: 'Exterior Panels' },
  { id: 'roof_view', name: 'Roof View', description: 'Hold camera high to capture the condition of the roof and sunroof if applicable.', overlaySvgPath: 'roof_view', required: false, idealAngle: { pitch: 45, roll: 0, yaw: 0 }, phase: 1, category: 'Exterior Panels' },
  { id: 'wheels_all', name: 'Wheels & Tyres', description: 'Capture close-ups of all 4 wheels and the spare tyre if visible.', overlaySvgPath: 'rims_condition', required: true, idealAngle: { pitch: -15, roll: 0, yaw: 90 }, phase: 1, category: 'Exterior Panels' },
  { id: 'badges_detail', name: 'Badges & Branding', description: 'Close-up of model, engine, and brand badges.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 2, category: 'Interior + Engine' },
  { id: 'lights_detail', name: 'Headlights & Taillights', description: 'Close-up of clear lenses to prove no cracks or fogging.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 2, category: 'Interior + Engine' },
  { id: 'mirrors_handles', name: 'Mirrors & Door Handles', description: 'Check for scuffs on mirrors and wear on handles.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 2, category: 'Interior + Engine' },
  { id: 'interior_dash', name: 'Dashboard & Steering', description: 'Shoot from back seat centered, capturing steering wheel and active instrument cluster.', overlaySvgPath: 'interior_dash', required: true, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 3, category: 'Interior + Engine' },
  { id: 'seat_driver', name: 'Driver Seat', description: 'Capture the driver seat bolsters and general condition.', overlaySvgPath: 'interior_seats', required: true, idealAngle: { pitch: -5, roll: 0, yaw: 45 }, phase: 3, category: 'Interior + Engine' },
  { id: 'seat_passenger', name: 'Passenger Seat', description: 'Capture the passenger seat and front cabin area.', overlaySvgPath: 'interior_seats', required: true, idealAngle: { pitch: -5, roll: 0, yaw: -45 }, phase: 3, category: 'Interior + Engine' },
  { id: 'seats_rear', name: 'Rear Seats', description: 'Capture condition of rear passenger bench.', overlaySvgPath: 'interior_seats', required: true, idealAngle: { pitch: -5, roll: 0, yaw: 0 }, phase: 3, category: 'Interior + Engine' },
  { id: 'boot_bay', name: 'Boot / Load Bay', description: 'Open tailgate/boot and capture storage area condition.', overlaySvgPath: 'rear_profile', required: true, idealAngle: { pitch: 10, roll: 0, yaw: 180 }, phase: 3, category: 'Interior + Engine' },
  { id: 'floor_mats', name: 'Floor Mats & Carpets', description: 'Capture the condition of carpets and mats in all footwells.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: -45, roll: 0, yaw: 0 }, phase: 3, category: 'Interior + Engine' },
  { id: 'engine_bay', name: 'Engine Bay', description: 'Shoot from front center looking down, hood fully propped.', overlaySvgPath: 'engine_bay', required: true, idealAngle: { pitch: 35, roll: 0, yaw: 0 }, phase: 4, category: 'Interior + Engine' },
  { id: 'mechanical_details', name: 'Battery & Fluids', description: 'Close-up of battery terminals and fluid reservoirs.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: 45, roll: 0, yaw: 0 }, phase: 4, category: 'Interior + Engine' },
  { id: 'undercarriage', name: 'Undercarriage', description: 'Low angle shot showing chassis, exhaust, and lack of leaks.', overlaySvgPath: 'generic_detail', required: false, idealAngle: { pitch: -30, roll: 0, yaw: 0 }, phase: 4, category: 'Interior + Engine' },
  { id: 'recon_damage', name: 'Damage & Recon', description: 'Document specific scratches, dents, or areas needing repair.', overlaySvgPath: 'vehicle_damage', required: false, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 5, category: 'Recon Photos' },
  { id: 'service_book', name: 'Service History Book', description: 'Capture the service booklet maintenance stamps.', overlaySvgPath: 'service_book', required: true, idealAngle: { pitch: -20, roll: 0, yaw: 0 }, phase: 6, category: 'Documents' },
  { id: 'reg_papers', name: 'Registration Papers', description: 'Capture vehicle registration or title documents.', overlaySvgPath: 'service_book', required: true, idealAngle: { pitch: -20, roll: 0, yaw: 0 }, phase: 6, category: 'Documents' },
  { id: 'odometer_reading', name: 'Odometer Close-up', description: 'Capture a clear image of the current mileage on the instrument cluster.', overlaySvgPath: 'generic_detail', required: true, idealAngle: { pitch: 0, roll: 0, yaw: 0 }, phase: 6, category: 'Documents' },
  { id: 'vin_plate', name: 'VIN Plate / Sticker', description: 'Capture the manufacturer VIN plate or barcode sticker.', overlaySvgPath: 'barcode_scanner', required: true, idealAngle: { pitch: -15, roll: 0, yaw: 0 }, phase: 6, category: 'Documents' },
  { id: 'video_360', name: '360° Video Walkaround', description: 'Capture a complete 360-degree high-fidelity continuous walkaround video.', overlaySvgPath: 'video_360', required: true, idealAngle: { pitch: 5, roll: 0, yaw: 0 }, phase: 7, category: '360 Video' },
];

export const STUDIO_BACKGROUNDS = [
  { id: 'none', name: 'Original Background', class: 'bg-transparent', label: 'Transparent / Off' },
  { id: 'showroom_luxury', name: 'Luxury Showroom', description: 'Polished marble tiles with professional overhead spotlight highlights.', gradient: 'linear-gradient(135deg, #1f2937, #111827)', lightingPreset: { brightness: 1.1, contrast: 1.15, saturation: 1.0 } },
  { id: 'studio_clean', name: 'Infinity Studio', description: 'Seamless minimalist white cyclorama walls with soft studio diffuser box lights.', gradient: 'linear-gradient(to bottom, #f3f4f6, #e5e7eb, #d1d5db)', lightingPreset: { brightness: 1.0, contrast: 1.1, saturation: 0.9 } },
  { id: 'industrial_depot', name: 'Industrial Depot', description: 'Exposed warm bricks, rustic iron pillars, and cinematic side ambient neon styling.', gradient: 'linear-gradient(135deg, #2d3748, #1a202c)', lightingPreset: { brightness: 0.95, contrast: 1.2, saturation: 1.05 } },
  { id: 'outdoor_sunset', name: 'Coastal Sunset', description: 'Warm, golden hour horizon overlooking an outdoor coastal dealership pad.', gradient: 'linear-gradient(to top, #fda4af, #fef08a, #bae6fd)', lightingPreset: { brightness: 1.05, contrast: 1.0, saturation: 1.2 } },
];

// --- TruInspect VIR Types ---

export type InspectionVerdict = 'Pass' | 'Attention' | 'Fail';

export interface InspectionCheckpoint {
  id: string;
  name: string;
  category: string;
  verdict: InspectionVerdict;
  photo?: string;
  notes?: string;
}

export interface VehicleInspectionReport {
  id: string;
  vehicleId: string;
  stockNumber: string;
  inspectedBy: string;
  inspectedAt: string;
  overallVerdict: InspectionVerdict;
  checkpoints: InspectionCheckpoint[];
  summary?: string;
}
