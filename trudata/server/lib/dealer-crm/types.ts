/**
 * TruCRM Dealer Prospect & Ingestion Types
 */

export interface DealerContactProfile {
  dealerName: string;
  tradingAs?: string;
  websiteUrl: string;
  city: string;
  suburb?: string;
  province?: string;
  physicalAddress: string;
  googleMapsUrl?: string;
  
  // Contacts
  dealerPrincipalName?: string;
  salesManagerName?: string;
  primaryMobile: string;
  secondaryMobile?: string;
  switchboardPhone?: string;
  whatsAppDirectLink?: string;
  salesEmail: string;
  financeEmail?: string;
  adminEmail?: string;
  
  // Dealership Tech & Pain Point Profile
  estimatedStockCount?: number;
  hasOnlineFinanceForm: boolean;
  hasMobileVir: boolean;
  hasLiveChat: boolean;
  readinessScore: number;
  digitalPainPoints: string[];
  
  // Sales Pitch Angle for TruSaaS rep
  recommendedTruSaasProducts: ('TruFlow DMS' | 'TruLens Studio' | 'TruInspect VIR' | 'TruLive Video' | 'TruTrade')[];
  outreachBlurbWhatsApp: string;
  outreachBlurbEmail: string;
}

export interface TruCrmLeadPayload {
  id: string;
  reference?: string;
  company: string;
  contact?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  formattedPhone?: string;
  email?: string;
  website?: string;
  location?: string;
  address?: string;
  source: string;
  status?: string;
  stage?: 'new' | 'contacted' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost';
  temperature?: 'Hot' | 'Warm' | 'Cold';
  salespersonId?: string;
  value?: number;
  pitch?: string;
  qualityScore?: number;
  digitalScore?: number;
  tags?: string[];
  notes: string;
  createdAt: string;
}

export interface DealerScanRequest {
  city: string;
  province?: string;
  country?: 'za' | 'uk';
  maxDealers?: number;
  autoSyncToTruCrm?: boolean;
}

export interface DealerScanResponse {
  city: string;
  country: 'za' | 'uk';
  dealersFound: number;
  syncedToTruCrmCount: number;
  prospects: DealerContactProfile[];
  scannedAt: string;
}
