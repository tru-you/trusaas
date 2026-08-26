/**
 * lead-scraper — one framework, three verticals (jobs / dealers / property).
 *
 *   searchJobs({ roles, countries, ... })    → JobLead[]    (Pipeline South)
 *   searchDealers({ location })              → DealerLead[]  (TruDealer)
 *   searchProperty({ province })             → PropertyLead[] (TruProperty)
 *
 * Each vertical is a self-contained source module emitting a common `Lead`
 * shape; enrichment (SERP → website → email/phone) and CSV output are shared.
 */

export * from "./types";
export * from "./core";
export { searchJobs, likelyAgency, JOB_COLUMNS } from "./verticals/jobs";
export { searchDealers, DEALER_COLUMNS } from "./verticals/dealers";
export { searchProperty, PROPERTY_COLUMNS } from "./verticals/property";
export type { JobSearchParams, RoleQuery } from "./verticals/jobs";
