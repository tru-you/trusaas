/**
 * Shared types for the lead-scraper framework.
 *
 * One framework, three verticals:
 *   jobs     → Pipeline South (place your talent pool into open roles)
 *   dealers  → TruDealer (cars.co.za dealer directory)
 *   property → TruProperty (estate-agency directory)
 *
 * Every vertical emits a `Lead` — a business/company you can approach — with a
 * common contact block (website/email/phone) and vertical-specific fields.
 */

export type Vertical = "jobs" | "dealers" | "property";

export interface Lead {
  vertical: Vertical;
  /** Stable dedupe key: vertical|name|title-ish. */
  id: string;
  /** The business/company name — the thing you actually approach. */
  name: string;
  location: string;
  country: string;
  website: string;
  linkedin: string;
  emails: string[];
  phones: string[];
  source: string;
  foundAt: string;
  /** Decision maker contact name (e.g. "Dave Miller (Dealer Principal)") */
  contact?: string;
  /** Decision maker title/role */
  contactTitle?: string;
  /** Auto-generated cold call battlecard / 2-sentence opening pitch */
  pitch?: string;
  /** Lead completeness & dial-readiness quality score (0-100) */
  qualityScore?: number;
  /** E.164 cleaned phone number ready for VoIP / click-to-call */
  formattedPhone?: string;
  /** Role, title, or service context */
  context?: string;
  /** Raw description, used only as an enrichment hint (dropped from CSV). */
  description?: string;
  /** Optional tags */
  tags?: string[];
  /** Deal/placement value estimate */
  value?: number;
}

export interface JobLead extends Lead {
  vertical: "jobs";
  title: string;
  role: string;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPredicted: boolean;
  currency: string;
  contract: string;
  posted: string;
  category: string;
  applyUrl: string;
  /** True when the "company" looks like a recruitment agency, not an employer. */
  likelyAgency: boolean;
}

export interface DealerLead extends Lead {
  vertical: "dealers";
  address: string;
  rating?: number;
  reviews?: number;
}

export interface PropertyLead extends Lead {
  vertical: "property";
  /** Agency/brand when different from `name`. */
  agency: string;
  address?: string;
}

export interface SearchParams {
  countries?: string[];
  where?: string;
  maxDaysOld?: number;
  maxResults?: number;
  enrich?: boolean;
  maxEnrich?: number;
  concurrency?: number;
  location?: string;
}

/** A vertical's search entry point. Each vertical supplies its own params. */
export type VerticalSearch<T extends Lead = Lead> = (params: SearchParams & Record<string, unknown>) => Promise<T[]>;
