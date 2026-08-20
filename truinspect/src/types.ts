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
  mmCode?: string;
  vin: string;
  stockNumber: string;
  color: string;
  price: number;
  vehicleType?: string; // Bakkie, Sedan, SUV, etc.
  mileage?: number;
  transmission?: 'Automatic' | 'Manual';
  fuelType?: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  /** Who carried out the inspection. Printed on the VIR — the report lands with
   *  buyers and finance houses, and a dealership name is not an inspector. */
  inspectorName?: string;
  inspectorRole?: string;
  status: 'In-Progress' | 'Ready' | 'Listed';
  createdAt: string;
  updatedAt: string;
  photos: Record<string, string>; // slotId -> base64 or path
  quality: Record<string, QualityReport>; // slotId -> report
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
  /** Warranty / service plan / extras — dealer-entered, shown on reports */
  warranty?: string;
  servicePlan?: string;
  extras?: string;
  /** Trade-in appraisal: 28-step walk-around + valuation */
  tradeInData?: import('./types/inspection').TradeInData;
  /** Per-dealer valuation history — keyed by dealerSlug */
  valuationHistory?: Record<string, import('./types/inspection').ValuationSnapshot[]>;
  /** Manager portal: the customer/seller this vehicle relates to, so reports
   *  and a purchase offer can be sent from the desktop manager via the native
   *  dialer / emailer / WhatsApp. Not part of field capture. */
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  /** Manager portal: offers to purchase RECEIVED on this vehicle — typically
   *  from other dealers/buyers. The inspecting yard uploads and tracks them; it
   *  does not issue them. TruInspect stops at tracking — the PMS handles the
   *  deal itself. */
  offers?: VehicleOffer[];
}

export interface VehicleOffer {
  id: string;
  /** Who made the offer — buyer or dealership name */
  buyerName: string;
  buyerContact?: string;
  amount: number;
  note?: string;
  /** Uploaded photo/scan of the signed OTP (/media/… disk ref, never inline) */
  documentRef?: string;
  status: 'received' | 'accepted' | 'declined';
  receivedAt: string;
}

/** TruInspect: one answered checklist question */
export interface ChecklistAnswer {
  answer: 'yes' | 'no' | 'na';
  note?: string;
}

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

/** The inspector's result for one point, keyed by point id on the vehicle. */
export interface PointResult {
  /** condition points */
  rating?: 'ok' | 'note' | 'damage';
  /** function points */
  works?: 'yes' | 'no' | 'na';
  comment?: string;
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