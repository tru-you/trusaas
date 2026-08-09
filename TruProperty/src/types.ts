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
    identifiedProperty?: string;
    suggestedTitle?: string;
    suggestedDescription?: string;
    detectedIssues?: string[];
  };
}

export type InspectionPurpose = 'sale' | 'rental' | 'new_build';

export interface ComplianceCert {
  received: boolean;
  issuer?: string;
  date?: string;
  note?: string;
}

export interface Property {
  id: string;
  propertyType: string;  // House, Flat, Townhouse, Estate, Farm, Commercial
  suburb: string;
  yearBuilt: number;
  erfNumber: string;
  listingRef: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  floorArea?: number;
  listPrice: number;
  inspectorName?: string;
  inspectorRole?: string;
  status: 'In-Progress' | 'Ready' | 'Listed';
  createdAt: string;
  updatedAt: string;
  photos: Record<string, string>;
  videos?: Record<string, string>;
  quality: Record<string, QualityReport>;
  agencyName?: string;
  agencyLogoDataUrl?: string;
  agencyPhone?: string;
  agencyWhatsApp?: string;
  damageFindings?: Record<string, DamageFinding[]>;
  inspectionChecklist?: Record<string, ChecklistAnswer>;
  inspectionPoints?: Record<string, PointResult>;
  slotAssessment?: Record<string, PointResult>;
  closeups?: Record<string, string[]>;
  activeSlotIds?: string[];
  inspectionPurpose?: InspectionPurpose;
  complianceCerts?: Record<string, ComplianceCert>;
  meterReadings?: {
    electricity?: string;
    water?: string;
    gas?: string;
  };
  keysHanded?: {
    count: number;
    description: string;
  };
  issuedReport?: {
    html: string;
    issuedAt: string;
    issuedBy: string;
  };
}

/** @deprecated Use Property instead */
export type Vehicle = Property;

export interface ChecklistAnswer {
  answer: 'yes' | 'no' | 'na';
  note?: string;
}

export interface DamageFinding {
  id: string;
  panel: string;
  damageType: 'rising_damp' | 'mould' | 'efflorescence' | 'spalling' | 'settlement_crack' | 'water_stain' | 'termite' | 'rot' | 'crack' | 'paint' | 'wear' | 'missing' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  note: string;
  x: number;
  y: number;
  source?: 'manual' | 'ai';
  confirmed?: boolean;
}

export interface PointResult {
  rating?: 'ok' | 'note' | 'damage';
  works?: 'yes' | 'no' | 'na';
  comment?: string;
}
