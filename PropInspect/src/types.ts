export type PropertyStatus = 'AVAILABLE' | 'SOLD' | 'RENTED' | 'INVENTORY';
export type PropertyArchive = string;

export interface Dealership {
  id: string;
  name: string;
  location: string;
  websiteUrl?: string;
  slug?: string;
  products?: string[];
  address?: string;
  registrationNumber?: string;
  vatNumber?: string;
  tradingAs?: string;
  contactEmail?: string;
  zernioProfileId?: string;
  truSocialEnabled?: boolean;
  invoiceSeq?: number;
  agreementSeq?: number;
  docFlow?: Partial<Record<DocStage, DocMode>>;
  docSettings?: DocSettings;
}

export interface DocSettings {
  logo?: string;
  bankingDetails?: {
    bankName?: string;
    branchCode?: string;
    accountNumber?: string;
    accountType?: string;
  };
  saleTerms?: string[];
  ownershipClause?: string;
  footerNote?: string;
  warrantyTerms?: string;
}

/** DocHub stages for property deals: Offer to Purchase → Transfer → Compliance → Invoice → Occupation */
export type DocStage = 'offer' | 'transfer' | 'compliance' | 'invoice' | 'occupation';

export type DocMode = 'generate' | 'attach' | 'confirm';

export const FIXED_STAGE_MODES: Partial<Record<DocStage, DocMode>> = {
  compliance: 'confirm',
};

export const DOC_STAGES: readonly DocStage[] = ['offer', 'transfer', 'compliance', 'invoice', 'occupation'] as const;

export interface DocEvent {
  id: string;
  docId: string;
  leadId?: string;
  action: 'created' | 'signed' | 'finalized' | 'voided';
  userId?: string;
  timestamp: string;
  dealershipId?: string;
}

export interface SocialAccount {
  accountId: string;
  dealershipId: string;
  platform: string;
  username?: string;
  connectedAt: string;
}

export interface Property {
  id: string;
  address: string;
  suburb: string;
  propertyType: 'House' | 'Apartment' | 'Townhouse' | 'Plot' | 'Commercial' | 'Sectional Title';
  bedrooms: number;
  bathrooms: number;
  garages: number;
  erfRef?: string;
  erfSize: string;
  floorSize: string;
  yearBuilt?: number;
  status: PropertyStatus;
  archivedAt?: PropertyArchive | null;
  soldByLeadId?: string | null;
  askingPrice: number;
  costPrice: number;
  ratesAndTaxes: number;
  levy: number;
  listingRef: string;
  dateAcquired: string;
  daysInInventory: number;
  description: string;
  images?: string[];
  damagePhotos?: string[];
  extrasPhotos?: string[];
  lastPhotoSync?: string;
  maintenanceTasks?: { id: string; name: string; cost: number; status: 'Pending' | 'In Progress' | 'Completed'; dateAdded: string; category?: string; photo?: string }[];
  inspectionResults?: Record<string, 'Pass' | 'Attention'>;
  dealershipId?: string;
  category?: 'residential' | 'commercial' | 'luxury' | 'used' | 'select' | 'performance';
  truPrice?: number;
  retailPrice?: number;
  source?: string;
  showOnWebsite?: boolean;
  virReport?: { section: string; rating: 'ok' | 'note' | 'damage'; note?: string }[];
  damage?: {
    section: string; type: string;
    severity: number; note: string;
  }[];
  slotAssessment?: Record<string, { rating?: 'ok' | 'note' | 'damage'; works?: 'yes' | 'no' | 'na'; comment?: string }>;
  optionalExtras?: string[];
  /** Compatibility fields for TruLens sync — used by the photo export path */
  make?: string; model?: string; year?: number; trim?: string;
  mileage?: number; transmission?: string; fuelType?: string;
  vinPhotos?: string[]; serviceBookPhotos?: string[]; vir?: number;
  web3d?: any; vin?: string; color?: string; bodyType?: string;
  engine?: string; conditionDeclaration?: any; fieldMeta?: any;
  stockNumber?: string;
}
export type EnquiryStatus = 'New' | 'Contacted' | 'Viewing Scheduled' | 'Negotiating' | 'Closed Won' | 'Closed Lost';

export interface Enquiry {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  propertyId: string;
  source: string;
  status: EnquiryStatus;
  assignedUserId: string;
  createdAt: string;
  lastContactedAt: string | null;
  digitalScore: number;
  notes: string;
  idOrBrn?: string;
  address?: string;
  journey?: { time: string; action: string; detail: string }[];
  dealershipId?: string;
  nextAction?: string;
  nextActionAt?: string | null;
  stageChangedAt?: string;
  dealChecklist?: {
    compliance?: boolean;
    bondApproval?: boolean;
    invoiced?: boolean;
    depositReceived?: boolean;
    financeStatus?: 'N/A' | 'Submitted' | 'Approved' | 'Declined';
    occupation?: boolean;
    natis?: boolean; roadworthy?: boolean; delivered?: boolean;
  };
  statusBeforeClose?: EnquiryStatus;
  docStage?: DocStage | null;
  docFlowCompletedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  leadId?: string;
  propertyId?: string;
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
  propertyId: string;
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
  propertyId: string;
  purchasePrice: number;
  depositAmount: number;
  type: 'Property Sale' | 'Deposit Hold' | 'Offer to Purchase' | 'Lease Agreement' | 'Bond Application' | 'Vehicle Sale' | 'Trade-In Transfer' | 'Finance Application';
  status: 'Pending Signature' | 'Signed' | 'Completed';
  signature?: string;
  signedAt?: string;
  signedBy?: string;
  dealershipId?: string;
  date?: string;
}

export interface DealerDocument {
  id: string;
  fileName: string;
  mimeType: string;
  fileData: string;
  status: 'Unsigned' | 'Signed' | 'Draft' | 'Void';
  uploadedAt: string;
  signature?: string;
  signedBy?: string;
  signedAt?: string;
  leadId?: string;
  propertyId?: string;
  dealershipId?: string;
  stage?: DocStage;
  mode?: DocMode;
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
  referenceId?: string;
  reconciled: boolean;
  dealershipId?: string;
}

export interface DMSState {
  properties: Property[];
  enquiries: Enquiry[];
  tasks: Task[];
  invoices: Invoice[];
  agreements: Agreement[];
  documents: DealerDocument[];
  docEvents?: DocEvent[];
  users: User[];
  communications: Communication[];
  expenses: Expense[];
  digitalProducts?: any[]; digitalSales?: any[];
  dealerships: Dealership[];
  settings?: PremiumSettings;
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
    tier: 'lite', truLens: false, truInspect: false, websitePortal: false,
    multiPortalSync: false, trueAI: false, smartLedger: false, chatbot: false,
    liveReceptionist: false, seoAeo: false, syndication: false, truSocial: false,
  },
  standard: {
    tier: 'standard', truLens: true, truInspect: false, websitePortal: true,
    multiPortalSync: false, trueAI: true, smartLedger: true, chatbot: true,
    liveReceptionist: false, seoAeo: false, syndication: false, truSocial: false,
  },
  premium: {
    tier: 'premium', truLens: true, truInspect: true, websitePortal: true,
    multiPortalSync: true, trueAI: true, smartLedger: true, chatbot: true,
    liveReceptionist: true, seoAeo: true, syndication: true, truSocial: false,
  },
};
