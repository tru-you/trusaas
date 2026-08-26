/**
 * jobs vertical — Pipeline South.
 *
 * Source: Adzuna (structured, free). Company → website → contact via the
 * shared enrichLeads() (SERP zone "tds" → domain → crawl).
 *
 * "Company, not agency": Adzuna has no recruiter/direct-employer flag, so
 * `likelyAgency()` heuristically scores agency posts from the company NAME and
 * the description ("our client", "on behalf of", "recruiting for"). ~90%
 * precise; keep the brand list growing as leaks surface.
 */

import { fetchJson, enrichLeads, dedupeById } from "../core";
import type { JobLead, SearchParams } from "../types";

export interface RoleQuery {
  name: string;
  what: string;
}

export interface JobSearchParams extends SearchParams {
  roles: RoleQuery[];
  excludeAgencies?: boolean;
  remoteOnly?: boolean;
  salaryMin?: number;
  fullTimeOnly?: boolean;
  resultsPerRole?: number;
}

const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs";

const CURRENCY: Record<string, string> = {
  gb: "GBP", us: "USD", za: "ZAR", au: "AUD", ca: "CAD", ie: "EUR", sg: "SGD",
  de: "EUR", fr: "EUR", nl: "EUR", it: "EUR", es: "EUR", at: "EUR", be: "EUR",
  br: "BRL", in: "INR", mx: "MXN", nz: "NZD", pl: "PLN", ru: "RUB", ch: "CHF",
};

const REMOTE_RE = /remote|work from home|wfh|home-based|virtual|hybrid/i;
const isRemoteJob = (title: string, location: string) => REMOTE_RE.test(`${title} ${location}`);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function cleanCompany(name: string): string {
  return String(name || "").replace(/\s*\*+$/, "").trim();
}

/* ── agency detection ──────────────────────────────────────────────────── */

const AGENCY_BRANDS = [
  "manpower", "adecco", "randstad", "hays", "michael page", "pagegroup",
  "page personnel", "robert half", "robert walters", "reed", "pertemps",
  "sthree", "harnham", "la fosse", "understanding recruitment", "nigel frank",
  "jefferson frank", "franklin fitch", "xcede", "harvey nash", "badenoch",
  "morgan hunt", "hudson", "adlib", "the candidate", "talent point",
  "people scout", "peoplescout", "tqr", "searchability", "fintelligent",
  "key appointments", "this is prime", "oscar", "premier group", "hired by",
  "get recruited", "graduate recruitment", "in technology", "it works",
  "maxwell bond", "zachary daniels", "we are ssg", "x4", "venturi",
  "explore group", "claremont", "apex systems", "astute", "betting jobs",
  "bond moran", "beach baker", "recruitment genius", "talentspa",
  "anson mccade", "futureworks", "the future works", "interaction",
  "hackajob", "broadwood resources", "the portfolio group", "mason frank",
  "washington frank", "anderson frank", "nicoll curtin", "sanderson",
  "computer futures", "inventum", "lawrence harvey", "lorien", "matchtech",
  "real staffing", "search recruitment", "senitor", "spectrum it",
  "talent international", "the bridge", "trust in soda", "we are adam",
  "experis", "teksystems", "networkers", "blu digital", "trg",
];

const AGENCY_NAME_RE =
  /(placements?|recruitment|recruiting|recruiter|staffing|resourcing|headhunt\w*|executive search|search & selection|search and selection|talent solutions|talent partners|talent group|talent acquisition|workforce solutions|people solutions|rpo)\b/i;

const AGENCY_DESC_RE =
  /(our client|on behalf of|recruiting for|we are recruiting|the client is|client of ours|on their behalf|recruitment agency)/i;

export function likelyAgency(company: string, descriptionHtml: string): boolean {
  const name = company.toLowerCase();
  if (AGENCY_BRANDS.some((b) => name.includes(b))) return true;
  if (AGENCY_NAME_RE.test(name)) return true;
  const desc = String(descriptionHtml || "").replace(/<[^>]+>/g, " ").toLowerCase();
  return AGENCY_DESC_RE.test(desc);
}

/* ── Adzuna ────────────────────────────────────────────────────────────── */

async function adzunaSearch(country: string, what: string, p: JobSearchParams): Promise<any[]> {
  const id = (process.env.ADZUNA_APP_ID || "").trim();
  const key = (process.env.ADZUNA_APP_KEY || "").trim();
  if (!id || !key) throw new Error("ADZUNA_APP_ID / ADZUNA_APP_KEY not set in env.");

  const perPage = 50;
  const want = p.resultsPerRole ?? 12;
  const out: any[] = [];
  const baseParams: Record<string, string> = {
    app_id: id, app_key: key, results_per_page: String(perPage), what,
  };
  if (p.where) baseParams.where = p.where;
  if (p.maxDaysOld) baseParams.max_days_old = String(p.maxDaysOld);
  if (p.salaryMin) baseParams.salary_min = String(p.salaryMin);
  if (p.fullTimeOnly) baseParams.full_time = "1";

  for (let page = 1; out.length < want && page <= 5; page++) {
    const qs = new URLSearchParams(baseParams);
    const data = await fetchJson(`${ADZUNA_BASE}/${country}/search/${page}?${qs.toString()}`);
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) break;
    out.push(...results);
  }
  return out.slice(0, want);
}

function normalize(job: any, country: string, role: string): JobLead {
  const company = cleanCompany(str(job?.company?.display_name) || str(job?.company));
  const location = str(job?.location?.display_name || job?.location).trim();
  const title = str(job?.title).trim();
  const description = str(job?.description);
  return {
    vertical: "jobs",
    id: `jobs|${country}|${company}|${title}`.toLowerCase().replace(/\s+/g, " "),
    name: company,
    location,
    country,
    website: "",
    linkedin: "",
    emails: [],
    phones: [],
    source: "adzuna",
    foundAt: new Date().toISOString(),
    description,
    title,
    role,
    remote: isRemoteJob(title, location),
    salaryMin: typeof job?.salary_min === "number" ? Math.round(job.salary_min) : null,
    salaryMax: typeof job?.salary_max === "number" ? Math.round(job.salary_max) : null,
    salaryPredicted: !!job?.salary_is_predicted,
    currency: CURRENCY[country] || country.toUpperCase(),
    contract: [job?.contract_type, job?.contract_time].filter(Boolean).join(" / ") || "",
    posted: str(job?.created),
    category: str(job?.category?.label),
    applyUrl: str(job?.redirect_url),
    likelyAgency: likelyAgency(company, description),
  };
}

/* ── public ────────────────────────────────────────────────────────────── */

export const JOB_COLUMNS = [
  "name", "title", "role", "likelyAgency", "location", "country", "remote",
  "salaryMin", "salaryMax", "salaryPredicted", "currency", "contract", "posted",
  "category", "website", "linkedin", "emails", "phones", "applyUrl",
];

export async function searchJobs(p: JobSearchParams): Promise<JobLead[]> {
  const excludeAgencies = p.excludeAgencies !== false;
  const all: JobLead[] = [];
  for (const country of p.countries || ["gb", "us"]) {
    for (const role of p.roles) {
      try {
        const raw = await adzunaSearch(country, role.what, p);
        all.push(...raw.map((r) => normalize(r, country, role.name)));
      } catch (e: any) {
        console.warn(`[lead-scraper:jobs] adzuna ${country}/${role.name} failed:`, e?.message || e);
      }
    }
  }

  let leads = dedupeById(all).filter((l) => l.name && l.title);
  if (excludeAgencies) leads = leads.filter((l) => !l.likelyAgency);
  if (p.remoteOnly) leads = leads.filter((l) => l.remote);

  if (p.enrich !== false) leads = await enrichLeads(leads, p.maxEnrich ?? 10);
  return leads;
}
