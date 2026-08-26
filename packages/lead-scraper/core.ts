/**
 * lead-scraper core — vertical-agnostic plumbing.
 *
 * No TruCRM imports, no framework: just node built-ins. The one place every
 * vertical shares: IPv4-forced fetching (undici's IPv6 bug bites here too),
 * email/phone extraction, company enrichment (SERP → website → contact crawl),
 * dedupe and CSV output.
 *
 * Bright Data zones (account-specific):
 *   unlocker = tds2   (BRIGHTDATA_UNLOCKER_ZONE)
 *   serp     = tds    (BRIGHTDATA_SERP_ZONE)   ← the zone is named "tds", not "serp"
 */

import http from "http";
import https from "https";
import zlib from "zlib";
import fs from "fs";
import path from "path";
import dns from "dns";
import type { Lead } from "./types";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const BD_API_BASE = "https://api.brightdata.com";

/* ── env ───────────────────────────────────────────────────────────────── */

export function loadEnv(path = ".env"): void {
  try {
    const txt = fs.readFileSync(path, "utf-8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env — rely on real env vars
  }
}

const bdEnv = (name: string) => (process.env[name] || "").trim();
export const serpConfigured = () => !!bdEnv("BRIGHTDATA_API_KEY");

/* ── fetch (IPv4-forced, gzip/br) ──────────────────────────────────────── */

export function nodeGet(
  url: string,
  opts: { timeoutMs: number; accept: string; maxRedirects?: number }
): Promise<{ status: number; text: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    let redirects = 0;
    const go = (u: string) => {
      const parsed = new URL(u);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.get(
        u,
        {
          family: 4,
          headers: {
            "User-Agent": UA,
            Accept: opts.accept,
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
          },
        },
        (res) => {
          const { statusCode = 0, headers } = res;
          if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && redirects < (opts.maxRedirects ?? 3)) {
            redirects++;
            res.resume();
            go(new URL(headers.location, u).toString());
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            let buf = Buffer.concat(chunks);
            const enc = String(headers["content-encoding"] || "").toLowerCase();
            try {
              if (enc.includes("gzip")) buf = zlib.gunzipSync(buf);
              else if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
              else if (enc.includes("br")) buf = zlib.brotliDecompressSync(buf);
            } catch {
              /* keep raw */
            }
            resolve({ status: statusCode, text: buf.toString("utf-8"), contentType: String(headers["content-type"] || "") });
          });
        }
      );
      req.setTimeout(opts.timeoutMs, () => req.destroy(new Error("timeout")));
      req.on("error", reject);
    };
    go(url);
  });
}

export async function postJson(url: string, body: unknown, token?: string, timeoutMs = 20000): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(parsed, {
      method: "POST",
      family: 4,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString("utf-8") }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/** Generic JSON POST (IPv4-forced) with arbitrary headers — used to push leads. */
export async function httpPost(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 30000
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(parsed, {
      method: "POST",
      family: 4,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString("utf-8") }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export async function fetchJson(url: string, timeoutMs = 20000): Promise<any> {
  const { status, text } = await nodeGet(url, { timeoutMs, accept: "application/json" });
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("non-JSON response");
  }
}

export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const { status, text, contentType } = await nodeGet(url, {
      timeoutMs: 12000,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    if (status < 200 || status >= 300) return null;
    if (contentType.includes("application/pdf") || contentType.includes("image/")) return null;
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

/* ── email / phone extraction ──────────────────────────────────────────── */

// Deobfuscate "name [at] domain [dot] com" — but only deliberate tokens
// (bracketed, or standalone " at "/" dot " with whitespace). The old regex
// matched mid-word "at" and invented "mitig@ion.ai" from "mitigation ai".
const deobfuscate = (s: string) =>
  s
    .replace(/\[\s*at\s*\]|\(\s*at\s*\)/gi, "@")
    .replace(/\[\s*dot\s*\]|\(\s*dot\s*\)/gi, ".")
    .replace(/\[\s*com\s*\]|\(\s*com\s*\)/gi, ".com")
    .replace(/(\s)at(\s)/gi, "$1@$2")
    .replace(/(\s)dot(\s)/gi, "$1.$2")
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".");

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Reject fake emails the deobfuscation pass invents from prose ("upd@e.company",
// "fe@ures.disabling") by requiring a real-looking TLD.
function isPlausibleDomain(domain: string): boolean {
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (tld === "za") return ["co", "org", "web", "gov", "ac", "net"].includes(parts[parts.length - 2]);
  const COMMON_TLDS = ["com", "net", "org", "info", "biz", "me", "io", "co", "uk", "za", "cc", "tv", "website", "site", "ai", "dev", "app", "email"];
  return COMMON_TLDS.includes(tld);
}

export function extractEmails(text: string): string[] {
  const found = new Set<string>();
  const add = (e: string) => {
    const [local, domain] = e.toLowerCase().split("@");
    if (!local || !domain) return;
    if (!/[a-zA-Z]/.test(local) || local.length < 2 || local.length > 40) return;
    if (domain.length > 40 || !/^[a-z0-9.-]+$/.test(domain)) return;
    if (!isPlausibleDomain(domain)) return;
    if (e.includes("example") || /\.(png|jpg|jpeg|webp|gif)$/.test(e)) return;
    found.add(e.toLowerCase());
  };
  (text.match(EMAIL_RE) || []).forEach(add);
  (deobfuscate(text).match(EMAIL_RE) || []).forEach(add);
  return [...found].slice(0, 5);
}

export function extractIntlPhones(text: string): string[] {
  const found = new Set<string>();
  const push = (d: string) => {
    if (d.length >= 8 && d.length <= 15 && !/(\d)\1{6,}/.test(d)) found.add(d);
  };
  for (const m of text.matchAll(/tel:([+\d][\d\s().-]{5,20})/gi)) push(m[1].replace(/[^\d+]/g, ""));
  const re = /(?:\+\d{1,3}[\s()-]*)?\d{3,4}[\s()-]+\d{3,4}[\s()-]+\d{3,4}/g;
  for (const m of text.matchAll(re)) push(m[0].replace(/[^\d+]/g, ""));
  return [...found].slice(0, 5);
}

/* ── domain helpers ────────────────────────────────────────────────────── */

export async function domainExists(hostname: string): Promise<boolean> {
  try {
    await dns.promises.lookup(hostname, { all: true, family: 4 });
    return true;
  } catch {
    return false;
  }
}

export function slugifyCompany(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/\b(ltd|l\.l\.c|llc|inc|corp|corporation|group|holdings|plc|pty|co|company|limited|technologies|software|solutions|services|media|digital|marketing)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

const TLD_CANDIDATES = [".com", ".co.uk", ".co.za", ".io", ".net", ".org"];

export function candidateDomains(company: string, country: string): string[] {
  const slug = slugifyCompany(company);
  if (!slug) return [];
  const home = country === "gb" ? ".co.uk" : country === "za" ? ".co.za" : ".com";
  const tlds = TLD_CANDIDATES.slice().sort((a, b) => (a === home ? -1 : b === home ? 1 : 0));
  return tlds.map((t) => slug + t);
}

const LINK_EXCLUDE =
  /(adzuna|indeed|linkedin|glassdoor|ziprecruiter|monster|reed\.co|totaljobs|cvlibrary|google|facebook|twitter|x\.com|instagram|youtube|tiktok|recruit|apply|workable|greenhouse|lever|smartrecruiters|jobvite|bamboohr|ashby|workday|icims)/i;

export function linksFromDescription(descriptionHtml: string): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const m of String(descriptionHtml || "").matchAll(/href=["']?(https?:\/\/[^"'\s>]+)/gi)) {
    try {
      const host = new URL(m[1]).hostname.replace(/^www\./, "");
      if (!host || seen.has(host) || LINK_EXCLUDE.test(host)) continue;
      seen.add(host);
      hosts.push(host);
      if (hosts.length >= 3) break;
    } catch {
      /* malformed */
    }
  }
  return hosts;
}

/* ── SERP business lookup (Bright Data SERP zone "tds") ────────────────── */

const SERP_EXCLUDE =
  /(wikipedia|linkedin|facebook|instagram|youtube|twitter|x\.com|yahoo|finance\.yahoo|zoominfo|crunchbase|glassdoor|indeed|adzuna|google|maps|g2\.com|trustpilot|yelp|bbb\.org|reddit|quora|amazon|play\.google|bloomberg|forbes)/i;

/** Resolve a company name → its real domain via Google SERP (organic results). */
export async function serpBusinessLookup(name: string, country: string): Promise<string[]> {
  const key = bdEnv("BRIGHTDATA_API_KEY");
  if (!key || !name) return [];
  const zone = bdEnv("BRIGHTDATA_SERP_ZONE") || "tds";
  const gl = country === "gb" ? "uk" : country === "za" ? "za" : "us";
  const url = `https://www.google.com/search?q=${encodeURIComponent(`${name} official website`)}&gl=${gl}&hl=en&num=8&brd_json=1`;
  try {
    const { status, text } = await postJson(`${BD_API_BASE}/request`, { zone, url, format: "raw" }, key, 15000);
    if (status !== 200 || !text) return [];
    const data = JSON.parse(text);
    const organic = Array.isArray(data?.organic) ? data.organic : [];
    const hosts: string[] = [];
    const seen = new Set<string>();
    for (const r of organic) {
      const link = String(r?.link || "");
      try {
        const host = new URL(link).hostname.replace(/^www\./, "");
        if (!host || seen.has(host) || SERP_EXCLUDE.test(host)) continue;
        seen.add(host);
        hosts.push(host);
        if (hosts.length >= 2) break;
      } catch {
        /* skip */
      }
    }
    return hosts;
  } catch {
    return [];
  }
}

/* ── enrichment ────────────────────────────────────────────────────────── */

/** Resolve a company name → its LinkedIn URL (company or person page). */
export async function serpLinkedInLookup(name: string, country: string): Promise<string> {
  const key = bdEnv("BRIGHTDATA_API_KEY");
  if (!key || !name) return "";
  const zone = bdEnv("BRIGHTDATA_SERP_ZONE") || "tds";
  const gl = country === "gb" ? "uk" : country === "za" ? "za" : "us";
  const url = `https://www.google.com/search?q=${encodeURIComponent(`${name} linkedin`)}&gl=${gl}&hl=en&num=8&brd_json=1`;
  try {
    const { status, text } = await postJson(`${BD_API_BASE}/request`, { zone, url, format: "raw" }, key, 15000);
    if (status !== 200 || !text) return "";
    const data = JSON.parse(text);
    const organic = Array.isArray(data?.organic) ? data.organic : [];
    for (const r of organic) {
      const link = String(r?.link || "");
      if (/linkedin\.com\/(company|in)\//i.test(link)) return link;
    }
    return "";
  } catch {
    return "";
  }
}

export interface Enrichment {
  website: string;
  linkedin: string;
  emails: string[];
  phones: string[];
}

/** Find the company's real website (desc links → SERP → slug-guess) and crawl it. */
export async function enrichCompany(name: string, country: string, descriptionHtml?: string): Promise<Enrichment> {
  const linkedin = await serpLinkedInLookup(name, country);
  const empty: Enrichment = { website: "", linkedin, emails: [], phones: [] };
  const hosts = [
    ...linksFromDescription(descriptionHtml || ""),
    ...(await serpBusinessLookup(name, country)),
    ...candidateDomains(name, country),
  ];
  const seen = new Set<string>();

  for (const host of hosts) {
    if (!host || seen.has(host)) continue;
    seen.add(host);
    if (!(await domainExists(host))) continue;

    const pages = [`https://${host}/`, `https://${host}/contact`, `https://${host}/contact-us`, `https://${host}/contactus`];
    const emails = new Set<string>();
    const phones = new Set<string>();
    let anyPage = false;
    for (const url of pages) {
      const html = await fetchPageText(url);
      if (!html) continue;
      anyPage = true;
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
      extractEmails(text).forEach((e) => emails.add(e));
      extractIntlPhones(text).forEach((p) => phones.add(p));
    }
    if (anyPage) return { website: `https://${host}`, linkedin, emails: [...emails], phones: [...phones] };
  }
  return empty;
}

/** Enrich the distinct companies across a lead list (concurrent, capped). */
export async function enrichLeads<T extends Lead>(leads: T[], maxEnrich = 10): Promise<T[]> {
  const byName = new Map<string, { country: string; desc: string }>();
  for (const l of leads) if (!byName.has(l.name)) byName.set(l.name, { country: l.country, desc: l.description || "" });
  const names = [...byName.keys()].slice(0, maxEnrich);
  let cursor = 0;
  const worker = async () => {
    while (cursor < names.length) {
      const n = names[cursor++];
      const e = byName.get(n)!;
      const r = await enrichCompany(n, e.country, e.desc);
      for (const l of leads) {
        if (l.name === n) {
          l.website = r.website;
          l.linkedin = r.linkedin;
          l.emails = r.emails;
          l.phones = r.phones;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  for (const l of leads) delete l.description;
  return leads;
}

/* ── output ────────────────────────────────────────────────────────────── */

export function dedupeById<T extends Lead>(leads: T[]): T[] {
  const seen = new Set<string>();
  return leads.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

function csvField(v: unknown): string {
  const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Lead>(leads: T[], columns: string[]): string {
  const rows = leads.map((l) => columns.map((c) => csvField((l as any)[c])).join(","));
  return [columns.join(","), ...rows].join("\n");
}

/**
 * Write leads into the CRM's per-workspace JSON store (the same store the CRM
 * reads via /api/db/:key). Merges with existing leads (dedupe by id) so repeat
 * runs append instead of clobbering. `workspace` follows the CRM's workspaceFile
 * convention: "default" → scraper-leads.json, else "<ws>_scraper-leads.json".
 */
export function writeScraperStore<T extends Lead>(leads: T[], dataDir: string, workspace: string): string {
  const dir = dataDir || "data";
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, workspace === "default" ? "scraper-leads.json" : `${workspace}_scraper-leads.json`);
  let existing: T[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    /* no existing store */
  }
  const seen = new Set<string>();
  const merged = [...existing, ...leads].filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf-8");
  return file;
}

/* ── HTML text + SA phone + unlocker (dealers/property verticals) ───────── */

export const cleanHtmlText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** SA phone extractor — handles +27, 0XX, and the "(0)" trunk variant. */
export function extractSaPhones(text: string): string[] {
  const found = new Map<string, string>();
  const patterns = [
    /(?:\+27|0)(?:\s?\d{2}){4}\d{1,2}/g,
    /\+27\s?\(?\d{2}\)?\s?\d{3}\s?\d{4}/g,
    /0\s?\d{2}\s?\d{3}\s?\d{4}/g,
    /(?:\(\s?)?(?:\+27\s?\(?0?\)?|0)\s?\d{2}[-.()\s]{0,2}\d{3}[-.()\s]{0,2}\d{4}/g,
  ];
  const normalizeSa = (raw: string): string | null => {
    let digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return null;
    if (digits.startsWith("27") && digits.length >= 11) {
      digits = digits.length >= 12 && digits[2] === "0" ? "0" + digits.slice(3) : "0" + digits.slice(2);
    }
    return /^0[1-8]\d{8}$/.test(digits) ? digits : null;
  };
  for (const re of patterns) {
    for (const p of text.match(re) || []) {
      const cleaned = p.replace(/\s+/g, " ").trim();
      const digits = normalizeSa(p);
      if (digits) {
        const key = digits.slice(-9);
        if (!found.has(key)) found.set(key, cleaned);
      }
    }
  }
  return Array.from(found.values()).slice(0, 5);
}

export interface JsonLdBusiness {
  name: string;
  phone: string;
  email: string;
  url: string;
  address: string;
}

/** Pull business/dealer/agency records out of JSON-LD (the current cars.co.za path). */
export function extractJsonLdBusinesses(html: string): JsonLdBusiness[] {
  const out: JsonLdBusiness[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: any;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    const graph = parsed["@graph"];
    const items = Array.isArray(graph) ? graph : Array.isArray(parsed) ? parsed : [parsed];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const t = Array.isArray(it["@type"]) ? it["@type"] : [it["@type"]];
      if (!t.some((x: string) => /AutoDealer|CarDealer|VehicleDealer|AutomotiveBusiness|RealEstateAgent|LocalBusiness|Organization|Business/i.test(String(x)))) continue;
      if (!it.name) continue;
      const addr = it.address && typeof it.address === "object" ? it.address : {};
      const cp = Array.isArray(it.contactPoint) ? it.contactPoint[0] : it.contactPoint;
      const phones: string[] = [];
      if (typeof it.telephone === "string") phones.push(it.telephone);
      if (typeof cp?.telephone === "string") phones.push(cp.telephone);
      const emails: string[] = [];
      if (typeof cp?.email === "string") emails.push(cp.email);
      if (typeof it.email === "string") emails.push(it.email);
      out.push({
        name: String(it.name).trim(),
        phone: phones[0] || "",
        email: emails[0] || "",
        url: typeof it.url === "string" ? it.url : "",
        address: [addr.streetAddress, addr.addressLocality, addr.addressRegion]
          .filter((x: unknown) => typeof x === "string" && x)
          .join(", "),
      });
    }
  }
  return out;
}

const BLOCKED_MARKERS: [RegExp, string][] = [
  [/just a moment|cf-challenge|cf-browser-verification|checking your browser/i, "cloudflare"],
  [/captcha (?:required|challenge|verification|protection|noticed)|enter[ -]?(?:the )?captcha|complete[ -]?(?:the )?captcha|verify[ -]?(?:you are|that you are) a? human|robot check|robots? detected|unusual traffic|access.*blocked.*captcha/i, "captcha"],
  [/access denied|403 forbidden|forbidden[ -]error|not available in your country/i, "access-denied"],
  [/enable javascript|please enable javascript|javascript is disabled/i, "js-required"],
];

export function detectBlocked(html: string): string | null {
  for (const [re, label] of BLOCKED_MARKERS) if (re.test(html)) return label;
  return null;
}

/** Fetch a URL through the Bright Data Web Unlocker (zone "tds2"). */
export async function webUnlockerFetch(
  url: string,
  opts: { country?: string; timeoutMs?: number } = {}
): Promise<string | null> {
  const key = bdEnv("BRIGHTDATA_API_KEY");
  const zone = bdEnv("BRIGHTDATA_UNLOCKER_ZONE") || "tds2";
  if (!key || !zone) return null;
  try {
    const body: Record<string, unknown> = { zone, url, format: "raw" };
    if (opts.country) body.country = opts.country;
    const { status, text } = await postJson(`${BD_API_BASE}/request`, body, key, opts.timeoutMs ?? 60000);
    if (status !== 200) return null;
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        const maybe = parsed?.body ?? parsed?.html ?? parsed?.result;
        if (typeof maybe === "string" && maybe.length > 0) return maybe;
      } catch {
        /* keep raw */
      }
    }
    return text.length <= 2_000_000 ? text : text.slice(0, 2_000_000);
  } catch {
    return null;
  }
}
