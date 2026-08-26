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
  /** Raw description, used only as an enrichment hint (dropped from CSV). */
  description?: string;
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
}

export interface PropertyLead extends Lead {
  vertical: "property";
  /** Agency/brand when different from `name`. */
  agency: string;
}

export interface SearchParams {
  countries?: string[];
  where?: string;
  maxDaysOld?: number;
  maxResults?: number;
  enrich?: boolean;
  maxEnrich?: number;
}

/** A vertical's search entry point. Each vertical supplies its own params. */
export type VerticalSearch<T extends Lead = Lead> = (params: SearchParams & Record<string, unknown>) => Promise<T[]>;
