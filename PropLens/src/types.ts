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
    identifiedSubject?: string;
    suggestedTitle?: string;
    suggestedDescription?: string;
    detectedIssues?: string[];
  };
}

export interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  propertyType?: 'House' | 'Townhouse' | 'Flat' | 'Duplex' | 'Estate' | 'Plot' | 'Commercial' | 'Farm';
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  erfSize?: number;
  floorSize?: number;
  erfRef?: string;
  price: number;
  listingRef: string;
  status: 'In-Progress' | 'Ready' | 'Listed';
  createdAt: string;
  updatedAt: string;
  photos: Record<string, string>;
  quality: Record<string, QualityReport>;
  showOnWebsite?: boolean;
  agencyName?: string;
  agencyLogoDataUrl?: string;
  agencyPhone?: string;
  agencyWhatsApp?: string;
  lastPmsExportAt?: string;
  lastPmsExportStatus?: string;
  firstPmsExportAt?: string;
  lastPmsPropertyId?: string | null;
  lastDmsListingRef?: string;
  damageFindings?: Record<string, DamageFinding[]>;
  slotAssessment?: Record<string, PointResult>;
  conditionDeclaration?: {
    noVisibleDamage: boolean;
    declaredAt: string;
    declaredBy?: string;
  };
  closeups?: Record<string, string[]>;
  capturedBy?: string;
  features?: string[];
  fieldMeta?: Record<string, number>;
}

export interface PointResult {
  rating?: 'ok' | 'note' | 'damage';
  works?: 'yes' | 'no' | 'na';
  comment?: string;
}

export interface PmsExportResult {
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
    total: number;
  };
  dmsUrl?: string;
  dmsProperty?: { id?: string; listingRef?: string; images?: string[] } | null;
  property?: Property;
}

export interface DamageFinding {
  id: string;
  panel: string;
  damageType: 'crack' | 'stain' | 'damp' | 'mould' | 'chip' | 'wear' | 'leak' | 'missing' | 'broken' | 'scratch' | 'dent' | 'rust' | 'paint' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  note: string;
  x: number;
  y: number;
  source?: 'manual' | 'ai';
  confirmed?: boolean;
}

export const STUDIO_BACKGROUNDS = [
  { id: 'none', name: 'Original', class: 'bg-transparent', label: 'As shot' },
];
