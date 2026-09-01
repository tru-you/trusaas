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
  /** UK registration plate (VRM) — filled by the DVLA/aggregator lookup. */
  registration?: string;
  /** Snapshot of the last reg lookup (make/model/MOT/tax/mileage signals).
   *  Kept raw-ish on purpose — providers return more than we render today. */
  regCheck?: import('../../packages/reg-lookup').RegLookupResult;
  stockNumber: string;
  color: string;
  price: number;
  vehicleType?: string; // Bakkie, Sedan, SUV, etc.
  /* Captured here because the dealer's website shows all three on every card,
     and nothing else in the chain knows them. TruFlow's importer has always
     read these off the export, but TruLens never sent them — so every car
     created from a capture reached the website as "0 km · Automatic · Petrol",
     whatever it actually was. Optional so an older capture still imports. */
  mileage?: number;
  transmission?: 'Automatic' | 'Manual';
  fuelType?: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
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
  /* Set once on the first successful DMS export. Anchors the 7-day Lens
     retention window — Lens deletes the vehicle from its own store 7 days
     after this timestamp, at which point Flow is the sole source of truth. */
  firstDmsExportAt?: string;
  lastDmsVehicleId?: string | null;
  lastDmsStockNumber?: string;
  /** Damage tagged by hand on a captured photo, keyed by photo slot id.
   *  Ported from TruInspect so a TruLens capture can carry real condition
   *  findings through to the dealer's website — Caledon's coc-media.js already
   *  reads car.damage / car.damageTags / car.findings and has never had
   *  anything to show. */
  damageFindings?: Record<string, DamageFinding[]>;
  /** Per-slot condition assessment from the review screen (OK / Note / Damage) */
  slotAssessment?: Record<string, PointResult>;
  /** Dealer's plain condition declaration for the retail listing. TruLens is NOT
   *  a graded VIR (that's TruInspect) — this is an explicit, honest statement of
   *  what the dealer is claiming: either "no visible damage reported" or that
   *  the visible damage shown in damageFindings is everything. Absent until the
   *  dealer answers on the review screen, so silence is never read as a claim. */
  conditionDeclaration?: {
    /** true = dealer declares no visible damage; false = damage tagged & shown */
    noVisibleDamage: boolean;
    declaredAt: string;
    declaredBy?: string;
  };
  /** Close-up photos of damage, keyed by slot id */
  closeups?: Record<string, string[]>;
  /** Name of the person who captured / signed off on this vehicle */
  capturedBy?: string;
  /** PNG data URL of the photographer's drawn signature. Prints on the shoot
   *  report — 'I shot this car, these are my photos'. */
  capturedBySignatureUrl?: string;
  /** Last web 3D / spin package export */
  lastWeb3dExportAt?: string;
  web3dPublicPath?: string;
  /** Tickbox-selected vehicle features (e.g. "Reverse Camera", "Leather Seats").
   *  Plain string array — the UI offers a predefined checklist but custom
   *  entries are fine, so consumers never need to know the master list. */
  optionalExtras?: string[];
  /** Per-field updatedAt (ms since epoch) used for last-writer-wins sync
   *  between TruLens and TruFlow. Absent map or absent key = epoch 0, so the
   *  first inbound write wins on legacy rows. Every mutation stamps only the
   *  fields it actually changed; unchanged fields keep their prior timestamp
   *  so a Lens re-export cannot silently clobber a fresher Flow edit. */
  fieldMeta?: Record<string, number>;
}

export interface PointResult {
  rating?: 'ok' | 'note' | 'damage';
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
  /** Whether the TruOrbit Web3D spin was autoexported alongside the DMS
   *  push. Set by handleExportToDms after awaiting the autoexport so the
   *  confirmation toast can say "TruOrbit ✓" or "no TruOrbit" accurately.
   *  Replaces the old breakdown.walkaround check, which pointed at a
   *  video-slot field that was removed from the capture template. */
  truOrbit?: boolean;
  breakdown?: {
    mainImages: number;
    extras: number;
    damage: number;
    vin: number;
    serviceBook: number;
    /** The 360 walkaround, counted apart from the stills. It used to fall into
     *  `extras`, which made an export carrying no video indistinguishable from
     *  one that did. */
    walkaround: number;
    /** Everything except the walkaround. */
    stills: number;
    total: number;
  };
  dmsUrl?: string;
  dmsVehicle?: { id?: string; stockNumber?: string; images?: string[] } | null;
  vehicle?: Vehicle;
}

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

export const STUDIO_BACKGROUNDS = [
  { id: 'none', name: 'Original', class: 'bg-transparent', label: 'As shot' },
  {
    // A cutout to a transparent PNG — honest and genuinely useful: drop the car
    // onto the dealer's own website or advert cleanly. Not a fake scene.
    id: 'cutout',
    name: 'Cutout',
    description: 'Removes the background to a clean transparent PNG — drops onto any page or advert.',
    gradient: 'transparent',
    lightingPreset: { brightness: 1.0, contrast: 1.05, saturation: 1.0 },
  },
  {
    // Two neutral studio greys. This is what real vehicle photography uses —
    // a plain seamless behind the car — rather than fake marble or a sunset.
    id: 'studio_light',
    name: 'Studio light',
    description: 'A clean, neutral light-grey seamless. The safe, professional default.',
    gradient: 'linear-gradient(to bottom, #E8EAE6, #C2C6C0)',
    lightingPreset: { brightness: 1.0, contrast: 1.08, saturation: 0.98 },
  },
  {
    id: 'studio_dark',
    name: 'Studio dark',
    description: 'A deep neutral charcoal that makes bodywork and reflections pop.',
    gradient: 'linear-gradient(to bottom, #1A1D22, #0B0F17)',
    lightingPreset: { brightness: 1.02, contrast: 1.12, saturation: 1.03 },
  },
];
