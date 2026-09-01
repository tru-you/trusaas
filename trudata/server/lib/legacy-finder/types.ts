/**
 * Legacy Site Finder — Core Data Structures & Interfaces
 */

export interface ContactInfo {
  phones: string[];
  whatsAppLinks: string[];
  emails: string[];
  address?: string;
  contactPagesFound: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    googleMaps?: string;
  };
}

export interface DefectItem {
  id: string;
  category: 'MOBILE' | 'SECURITY' | 'PERFORMANCE' | 'SEO' | 'OBSOLETE_TECH';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  title: string;
  description: string;
  agencyPitchAngle: string;
}

export interface TechStackAudit {
  cms?: string;
  server?: string;
  hasViewportMeta: boolean;
  isSslValid: boolean;
  usesOutdatedJQuery: boolean;
  hasFlashOrFrames: boolean;
  hasSchemaOrg: boolean;
  hasMetaDescription: boolean;
  hasGoogleAnalyticsOrPixel: boolean;
  estimatedLoadSeconds: number;
}

export interface LegacySiteTarget {
  id: string;
  domain: string;
  url: string;
  businessName: string;
  city: string;
  industry: string;
  readinessScore: number; // 0 (Worst, Most Defective) to 100 (Perfect)
  defects: DefectItem[];
  techStack: TechStackAudit;
  contacts: ContactInfo;
  estimatedPitchValue: string; // e.g. "R 25,000 - R 40,000"
  discoveredAt: string;
}

export interface CrawlRequest {
  city: string;
  industry: string;
  country?: 'za' | 'uk';
  maxResults?: number;
}

export interface CrawlResult {
  query: string;
  city: string;
  industry: string;
  totalFound: number;
  criticalDefectsFound: number;
  averageReadinessScore: number;
  targets: LegacySiteTarget[];
  scannedAt: string;
}
