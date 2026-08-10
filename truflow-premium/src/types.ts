/** A unit is either on the floor or gone.
 *
 *  'PENDING' was removed once the stock kanban that wrote it was deleted:
 *  nothing created it any more, yet the Overview counted it while Stock Health
 *  excluded it from both its live and sold buckets, so its capital vanished
 *  from "Capital in stock". Legacy rows are mapped to SOLD at boot by
 *  retirePendingStatus() in server.ts. */
export type VehicleStatus = 'INVENTORY' | 'SOLD';

/** Set when a sold unit is retired from the floor without being deleted.
 *
 *  A car whose sale is recorded here — a deal, invoice, agreement or DocHub
 *  document — cannot simply be removed, because that would destroy the record
 *  of the transaction. Archiving takes it out of every stock list while leaving
 *  it in the sold figures, which is the whole distinction from deleting: a
 *  deleted car leaves the numbers because the dealer chose to remove it, an
 *  archived one leaves only the lists.
 *
 *  Declared here rather than on Vehicle's own line so the reasoning sits with
 *  the status type it qualifies. */
export type VehicleArchive = string;

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
  /** Which products this dealership's code opens — "lens", "flow", "inspect",
   *  "live", "value". Every product verifies codes against this instance, so a
   *  dealer gains or loses an app by this list changing, rather than by someone
   *  editing that app's environment variable and redeploying it. Backfilled to
   *  all products on load, since that is what a dealer can reach today. */
  products?: string[];
  /** Street address lines for invoices/agreements. */
  address?: string;
  /** CIPC registration number, e.g. "2015/123456/07". */
  registrationNumber?: string;
  /** SARS VAT reference number. */
  vatNumber?: string;
  /** Trading-as name. SA dealers commonly trade under a name that differs
   *  from the CIPC-registered entity, and invoices / agreements must show
   *  it alongside the registered name. */
  tradingAs?: string;
  /** Public contact email — the address printed on documents and used for
   *  buyer-facing notifications, distinct from any staff user's login email. */
  contactEmail?: string;
  /** Zernio profile ID — provisioned when TruSocial is enabled for this dealer. */
  zernioProfileId?: string;
  /** Whether TruSocial is active (UI shown, publishes triggered). */
  truSocialEnabled?: boolean;
  /** High-water marks for this dealer's issued document numbers.
   *
   *  SARS requires a tax invoice number to be sequential and non-repeating.
   *  Both numbers used to come from `collection.length + 1`, counted across
   *  every dealer — so two dealerships drew from one sequence, and removing a
   *  row handed the next one a number already issued. These only ever climb,
   *  and they are per dealer. */
  invoiceSeq?: number;
  agreementSeq?: number;
  /** High-water mark for DocHub generated document numbers (proforma, offer,
   *  invoice, handover). Kept separate from invoiceSeq/agreementSeq because
   *  those feed the accounting collections; this one counts rendered PDFs.
   *  Monotonic and per dealer so a number is never reissued. */
  docSeq?: number;
  /** DocHub: per-stage mode. 'attach' = dealer uploads their own signed
   *  document; 'generate' = TruFlow renders one from a template. Missing keys
   *  default to 'attach' (least surprise for dealers already using their own
   *  paperwork). Set once in DocFlowSettings; not per-deal. */
  docFlow?: Partial<Record<DocStage, DocMode>>;
  /** Dealer-editable content that appears on generated documents.
   *  Everything here is optional — templates render sensible defaults or
   *  leave the section out when the dealer hasn't configured it. */
  docSettings?: DocSettings;
}

export interface DocSettings {
  /** Dealer logo — a /media/ reference stored via photoStore.put().
   *  Rendered top-left on every generated document. */
  logo?: string;
  bankingDetails?: {
    bankName?: string;
    branchCode?: string;
    accountNumber?: string;
    accountType?: string;
  };
  /** Free-text sale conditions appended to the Offer to Purchase.
   *  Each entry renders as a numbered clause. */
  saleTerms?: string[];
  /** Override the default ownership-retention clause on invoices.
   *  If blank, the statutory default is used. */
  ownershipClause?: string;
  /** Footer note printed at the bottom of every generated document
   *  (e.g. "Thank you for your business", a disclaimer, or a promo). */
  footerNote?: string;
  /** Warranty description included on the handover document. */
  warrantyTerms?: string;
}

/** DocHub stages, in the order a deal progresses through them. */
export type DocStage = 'proforma' | 'deed' | 'compliance' | 'invoice' | 'handover';

/** How a dealer fulfils a given stage's document.
 *
 *  - 'generate' — TruFlow renders a PDF from a template.
 *  - 'attach'   — dealer uploads their own signed document.
 *  - 'confirm'  — no document; the stage is satisfied by ticking flags on
 *    the lead. Used for compliance, where NATIS and roadworthy are
 *    government-issued and cannot be produced by the dealer.
 *  - 'connect'  — generates an accounting-import CSV (Xero/QuickBooks/Zoho
 *    format). Available on any non-fixed stage. */
export type DocMode = 'generate' | 'attach' | 'confirm' | 'connect';

/** Default docFlow for new dealers — generate everywhere except compliance
 *  (fixed to 'confirm'). Dealers can reconfigure in DocFlowSettings. */
export const DEFAULT_DOC_FLOW: Record<DocStage, DocMode> = {
  proforma: 'generate',
  deed: 'generate',
  compliance: 'confirm',
  invoice: 'generate',
  handover: 'generate',
};

/** Stages whose mode is fixed by the product, not the dealer. Compliance is
 *  always 'confirm' because NATIS/RWC come from government — there is nothing
 *  for a dealer to generate or attach. */
export const FIXED_STAGE_MODES: Partial<Record<DocStage, DocMode>> = {
  compliance: 'confirm',
};

/** Ordered list of stages — single source of truth for "advance to next". */
export const DOC_STAGES: readonly DocStage[] = ['proforma', 'deed', 'compliance', 'invoice', 'handover'] as const;

/** Audit-trail row for DocHub document actions (create, sign, finalize, void). */
export interface DocEvent {
  id: string;
  docId: string;
  leadId?: string;
  action: 'created' | 'signed' | 'finalized' | 'voided';
  userId?: string;
  timestamp: string;
  dealershipId?: string;
}

/** A social account connected via Zernio, mapped to exactly one dealer. */
export interface SocialAccount {
  accountId: string;
  dealershipId: string;
  platform: string;
  username?: string;
  connectedAt: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  status: VehicleStatus;
  /** When this unit was archived off the floor. See VehicleArchive.
   *  Explicitly nullable: clearing it is how a unit is restored, and
   *  `undefined` would be dropped by JSON.stringify on the way to the server. */
  archivedAt?: VehicleArchive | null;
  /** Which deal's closure marked this car sold, when a deal did.
   *
   *  Only that deal may un-sell it. Without this, reopening ANY lead attached
   *  to the car returned it to stock — including a car sold outside the system
   *  or sold from the Light console, which no deal owns. A car sold with no
   *  deal behind it leaves this unset, so no lead can put it back. */
  soldByLeadId?: string | null;
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
  engineNumber?: string;
  mmCode?: string;
  registrationNumber?: string;
  color?: string;
  /** Where the record came from, e.g. "trulens". */
  source?: string;
  /** Whether the dealer's public feed may show this unit. Undefined is treated
   *  as published by the feed, which is why the TruLens Publish toggle has to
   *  send `false` explicitly rather than omitting the field. */
  showOnWebsite?: boolean;

  /** TruLens 360 damage orbit — spin frames + positioned damage tags.
   *  Replaces the old walkaroundVideo field entirely. */
  web3d?: {
    frames: { index: number; slotId: string; name: string; azimuth: number; image: string }[];
    damageTags: { id: string; label: string; severity: string; azimuth: number; elevation: number; slotId: string; thumb?: string }[];
  };
  /** TruLens inspection score, 0–100. Computed at capture and, until now,
   *  never sent anywhere. */
  vir?: number;
  /** The inspection findings per section, so a dealer site can render the
   *  report instead of linking a buyer into an app they cannot open. Shape
   *  changed 2026-08-04 from numeric score to a binary rating + optional
   *  note — no such thing as a used car scoring 100 per panel, and the
   *  data model doesn't carry a real score anyway. */
  virReport?: { section: string; rating: 'ok' | 'note' | 'damage'; note?: string }[];
  /** Damage tagged by hand in TruLens, pinned to a point on a specific photo.
   *  Only human-confirmed findings ever arrive here. */
  damage?: {
    slotId: string; panel: string; type: string;
    severity: number; note: string; x: number; y: number;
  }[];
  slotAssessment?: Record<string, { rating?: 'ok' | 'note' | 'damage'; works?: 'yes' | 'no' | 'na'; comment?: string }>;
  optionalExtras?: string[];
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
  idOrBrn?: string;
  address?: string;
  buyerVatNumber?: string;
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
  /** Deal readiness — status of the steps to close and hand over, tracked as
   *  flags rather than stored documents. The dealer keeps the actual paperwork
   *  in their own systems; this just records what's done, so nothing sensitive
   *  (bank statements, IDs) ever lives on the server. */
  dealChecklist?: {
    natis?: boolean;
    roadworthy?: boolean;
    invoiced?: boolean;
    depositReceived?: boolean;
    financeStatus?: 'N/A' | 'Submitted' | 'Approved' | 'Declined';
    delivered?: boolean;
  };
  /** Where the deal stood immediately before it closed Won.
   *
   *  Recorded so that reopening restores the stage it actually came from. The
   *  reopen paths used to hardcode "Negotiating", which silently rewrote the
   *  history of any deal that closed straight from New or Test Drive
   *  Scheduled. Cleared once consumed. */
  statusBeforeClose?: LeadStatus;
  /** DocHub: which contractual stage this deal is currently on — the stage
   *  that is next *due*, not the last one finalised. Advances as each stage's
   *  document is finalised. The checklist runs in parallel for physical/admin
   *  milestones the paperwork does not cover.
   *
   *  `null` is ambiguous on its own: it is both "never started" and "finished
   *  the last stage, nothing left due". Read it with `docFlowCompletedAt` to
   *  tell those apart — never on its own. */
  docStage?: DocStage | null;
  /** DocHub: when the final stage was finalised. Set once, never cleared by
   *  advancing.
   *
   *  Exists because `docStage` alone cannot express completion — finalising
   *  handover leaves it `null`, which is exactly what a brand-new lead carries,
   *  so a finished deal rendered as though it had never started. Kept as a
   *  separate field rather than a `'complete'` member of DocStage because
   *  DocStage also types `Document.stage` and `Dealership.docFlow`, where a
   *  "complete" document or a per-stage mode for it would both be nonsense. */
  docFlowCompletedAt?: string;
  /** DocHub: stages the dealer intentionally bypassed (deal happened outside
   *  the DMS, or the stage genuinely does not apply). Recorded so the audit
   *  trail shows the stage was deliberately skipped rather than silently
   *  absent, and so `finalize`'s ordering gate can treat a skipped stage as
   *  satisfied. Advancing `docStage` treats these as complete — never forced. */
  docSkips?: Partial<Record<DocStage, { at: string; by?: string; reason?: string }>>;
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

/** A dealer's own uploaded document (any file/template — we don't prescribe what it is) with an e-sign flow.
 *
 *  Also the persistence shape for DocHub documents: when `stage` is set,
 *  the doc belongs to DocHub's 5-stage lifecycle. `mode` records whether
 *  the file came from a dealer upload ('attach') or was rendered from a
 *  TruFlow template ('generate'); `fieldSnapshot` captures the merge inputs
 *  for audit reproducibility. Existing hub uploads leave all four undefined
 *  and behave exactly as before. */
export interface DealerDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileData: string; // data URL — original uploaded file
  status: 'Unsigned' | 'Signed' | 'Draft' | 'Void';
  uploadedAt: string;
  signature?: string; // data URL of drawn signature, or "TYPED:Name"
  signedBy?: string;
  signedAt?: string;
  leadId?: string;
  vehicleId?: string;
  dealershipId?: string;
  /** DocHub stage this doc satisfies, if any. */
  stage?: DocStage;
  /** How this doc was produced. Required whenever `stage` is set. */
  mode?: DocMode;
  /** Field values captured at generate/finalize time — only populated when
   *  mode === 'generate'. Preserves the exact data the PDF was built from
   *  even if the underlying deal record later changes. */
  fieldSnapshot?: Record<string, unknown>;
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
  /** DocHub audit trail — one row per document action. Per-dealer, so
   *  scoped alongside documents in TENANT_SCOPED_COLLECTIONS. Optional so
   *  older dealer files without the array parse cleanly. */
  docEvents?: DocEvent[];
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
  /** Zernio social accounts mapped to dealers — the accountId→dealer lookup. */
  socialAccounts?: SocialAccount[];
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
  truSocial: boolean;
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
    truSocial: false,
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
    truSocial: false,
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
    truSocial: false,
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
