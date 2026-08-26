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

export function loadEnv(customPath?: string): void {
  const pathsToTry = [
    customPath,
    ".env",
    "../../TruCRM/.env",
    "../TruCRM/.env",
    "TruCRM/.env",
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../TruCRM/.env"),
    path.resolve(process.cwd(), "../TruCRM/.env"),
    path.resolve(process.cwd(), "TruCRM/.env"),
  ].filter(Boolean) as string[];

  for (const p of pathsToTry) {
    try {
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, "utf-8");
        for (const line of txt.split("\n")) {
          const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
          if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* ignore */
    }
  }
}

// Auto-run on module import
loadEnv();

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

export async function fetchPageText(url: string, timeoutMs = 4500): Promise<string | null> {
  try {
    const { status, text, contentType } = await nodeGet(url, {
      timeoutMs,
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
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1].toLowerCase();
  if (tld === "za") {
    const sld = parts[parts.length - 2]?.toLowerCase();
    return ["co", "org", "web", "gov", "ac", "net", "law", "school"].includes(sld);
  }
  const COMMON_TLDS = [
    "com", "net", "org", "info", "biz", "me", "io", "co", "uk", "za", "cc", "tv", "website",
    "site", "ai", "dev", "app", "email", "tech", "agency", "africa", "solutions", "group",
    "careers", "global", "ltd", "services", "consulting", "digital", "store", "online", "auto",
    "cars", "estate", "properties", "cloud", "software", "systems", "direct", "work", "world",
  ];
  return COMMON_TLDS.includes(tld);
}

const JUNK_EMAIL_LOCAL_PARTS = [
  "noreply", "no-reply", "donotreply", "privacy", "hostmaster", "postmaster",
  "mailer-daemon", "sentry", "wixpress", "bootstrap", "webpack", "example",
  "test", "demo", "sample", "feedback", "abuse", "root",
];

export function extractEmails(text: string): string[] {
  const found = new Set<string>();
  const add = (e: string) => {
    const clean = e.trim().toLowerCase().replace(/^mailto:/i, "").replace(/[.,;:)\]]+$/, "");
    const [local, domain] = clean.split("@");
    if (!local || !domain) return;
    if (!/[a-zA-Z]/.test(local) || local.length < 2 || local.length > 40) return;
    if (domain.length > 50 || !/^[a-z0-9.-]+$/.test(domain)) return;
    if (!isPlausibleDomain(domain)) return;
    if (JUNK_EMAIL_LOCAL_PARTS.some((j) => local === j || local.startsWith(j + "+") || local.startsWith(j + "."))) return;
    if (/\.(png|jpg|jpeg|webp|gif|svg|css|js|ico|woff|woff2|ttf)$/i.test(domain) || /\.(png|jpg|jpeg|webp|gif)$/i.test(clean)) return;
    found.add(clean);
  };
  (text.match(EMAIL_RE) || []).forEach(add);
  (deobfuscate(text).match(EMAIL_RE) || []).forEach(add);
  return [...found].slice(0, 8);
}

export function extractIntlPhones(text: string): string[] {
  const found = new Set<string>();
  const push = (d: string) => {
    const digits = d.replace(/[^0-9+]/g, "");
    if (digits.length >= 8 && digits.length <= 16 && !/(\d)\1{6,}/.test(digits)) {
      found.add(digits);
    }
  };
  for (const m of text.matchAll(/tel:([+\d][\d\s().-]{5,20})/gi)) push(m[1]);
  const saMatches = extractSaPhones(text);
  saMatches.forEach((p) => found.add(p));
  const re = /(?:\+\d{1,3}[\s()-]*)?\d{3,4}[\s()-]+\d{3,4}[\s()-]+\d{3,4}/g;
  for (const m of text.matchAll(re)) push(m[0]);
  return [...found].slice(0, 8);
}

/* ── domain helpers ────────────────────────────────────────────────────── */

export async function domainExists(hostname: string): Promise<boolean> {
  try {
    const cleanHost = hostname.replace(/^www\./, "").split("/")[0].split(":")[0];
    await dns.promises.lookup(cleanHost, { all: true, family: 4 });
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

const TLD_CANDIDATES = [".com", ".co.za", ".co.uk", ".io", ".net", ".org", ".africa", ".tech", ".agency"];

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
      if (hosts.length >= 4) break;
    } catch {
      /* malformed */
    }
  }
  return hosts;
}

/* ── SERP business lookup (Bright Data SERP zone "tds") ────────────────── */

const SERP_EXCLUDE =
  /(wikipedia|linkedin|facebook|instagram|youtube|twitter|x\.com|yahoo|finance\.yahoo|zoominfo|crunchbase|glassdoor|indeed|adzuna|google|maps|g2\.com|trustpilot|yelp|bbb\.org|reddit|quora|amazon|play\.google|bloomberg|forbes|autotrader|cars\.co\.za|gumtree|olx|webuycars|autodealer|yellowpages|yell\.com|parkers|heycar|cazoo|carvana|carmax|property24|privateproperty)/i;

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
        if (hosts.length >= 3) break;
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

export interface DeepBusinessIntelligence {
  website: string;
  phones: string[];
  emails: string[];
  address?: string;
  rating?: number;
  reviews?: number;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  contact?: string;
  contactTitle?: string;
}

/** Fast HTML web search fallback that never blocks or requires API credits */
export async function fastWebLookup(query: string, country = "za"): Promise<{ website: string; phone: string; snippet: string }> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return { website: "", phone: "", snippet: "" };
    const html = await res.text();
    const text = cleanHtmlText(html);
    const phones = country.toLowerCase() === "za" ? extractSaPhones(text) : extractIntlPhones(text);

    const matches = Array.from(html.matchAll(/class="result__url"[^>]*href="([^"]+)"/gi)).map((m) => m[1]);
    let website = "";
    for (const m of matches) {
      const decoded = decodeURIComponent(m.replace(/^.*uddg=/, "").replace(/&.*$/, ""));
      if (!SERP_EXCLUDE.test(decoded)) {
        website = decoded;
        break;
      }
    }
    return { website, phone: phones[0] || "", snippet: text.slice(0, 300) };
  } catch {
    return { website: "", phone: "", snippet: "" };
  }
}

/** Comprehensive Google SERP + Zero-Block Web Business Intelligence */
export async function serpDeepBusinessLookup(
  name: string,
  location = "",
  country = "za",
  vertical = "dealers"
): Promise<DeepBusinessIntelligence> {
  const result: DeepBusinessIntelligence = {
    website: "",
    phones: [],
    emails: [],
  };
  if (!name) return result;

  const key = bdEnv("BRIGHTDATA_API_KEY");
  const zone = bdEnv("BRIGHTDATA_SERP_ZONE") || "tds";
  const gl = country === "gb" ? "uk" : country === "za" ? "za" : "us";
  const query = vertical === "dealers"
    ? `"${name}" ${location ? `"${location}"` : ""} dealership`
    : `"${name}" ${location ? `"${location}"` : ""}`;

  // 1. Try Bright Data SERP (fast 5s timeout)
  if (key) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${gl}&hl=en&num=8&brd_json=1`;
      const { status, text } = await postJson(`${BD_API_BASE}/request`, { zone, url, format: "raw" }, key, 5000);
      if (status === 200 && text && text.trim().startsWith("{")) {
        const data = JSON.parse(text);
        const kg = data?.knowledge || {};
        if (kg.phone) result.phones.push(String(kg.phone).trim());
        if (kg.address) result.address = String(kg.address).trim();
        if (typeof kg.rating === "number") result.rating = kg.rating;
        if (typeof kg.reviews === "number") result.reviews = kg.reviews;
        if (kg.website && !SERP_EXCLUDE.test(kg.website)) result.website = kg.website;

        const local = Array.isArray(data?.local_results) ? data.local_results : [];
        if (local.length > 0) {
          const bestLocal = local.find((l: any) => l.title?.toLowerCase().includes(name.toLowerCase())) || local[0];
          if (bestLocal) {
            if (result.phones.length === 0 && bestLocal.phone) result.phones.push(String(bestLocal.phone).trim());
            if (!result.address && bestLocal.address) result.address = String(bestLocal.address).trim();
            if (!result.rating && typeof bestLocal.rating === "number") result.rating = bestLocal.rating;
            if (!result.reviews && typeof bestLocal.reviews === "number") result.reviews = bestLocal.reviews;
            if (!result.website && bestLocal.link && !SERP_EXCLUDE.test(bestLocal.link)) result.website = bestLocal.link;
          }
        }
      }
    } catch {
      /* fallback */
    }
  }

  // 2. Zero-block web fallback (instant DuckDuckGo lookup) if phone or website still missing
  if (!result.website || result.phones.length === 0) {
    const webInfo = await fastWebLookup(`${name} ${location} ${vertical === "dealers" ? "dealership contact phone" : "contact phone"}`, country);
    if (!result.website && webInfo.website) result.website = webInfo.website;
    if (result.phones.length === 0 && webInfo.phone) result.phones.push(webInfo.phone);
  }

  // 4. Decision Maker SERP search
  const dm = await findDecisionMaker(name, vertical, country);
  if (dm.name) {
    result.contact = dm.title ? `${dm.name} (${dm.title})` : dm.name;
    result.contactTitle = dm.title;
    if (dm.linkedin && !result.linkedin) result.linkedin = dm.linkedin;
  }

  // 5. Deep crawl official website for team emails and direct phone lines
  if (result.website && !SERP_EXCLUDE.test(result.website)) {
    const crawled = await crawlWebsiteContacts(result.website);
    if (crawled.emails.length > 0) {
      result.emails = Array.from(new Set([...result.emails, ...crawled.emails])).slice(0, 5);
    }
    if (crawled.phones.length > 0) {
      result.phones = Array.from(new Set([...result.phones, ...crawled.phones])).slice(0, 5);
    }
    if (!result.linkedin && crawled.linkedin) result.linkedin = crawled.linkedin;
  }

  return result;
}

export interface Enrichment {
  website: string;
  linkedin: string;
  emails: string[];
  phones: string[];
}

/** Deeply crawl a given website URL or domain for emails, phone numbers, and socials. */
export async function crawlWebsiteContacts(rawUrlOrDomain: string): Promise<{ emails: string[]; phones: string[]; linkedin?: string }> {
  let host = rawUrlOrDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
  if (!host) return { emails: [], phones: [] };
  const origin = `https://${host}`;
  const pages = [
    `${origin}/`,
    `${origin}/contact`,
    `${origin}/contact-us`,
    `${origin}/about`,
    `${origin}/about-us`,
    `${origin}/team`,
  ];
  const emails = new Set<string>();
  const phones = new Set<string>();
  let foundLinkedin = "";

  const pageTexts = await Promise.all(pages.map((u) => fetchPageText(u, 4000)));
  for (const html of pageTexts) {
    if (!html) continue;
    const text = cleanHtmlText(html);
    extractEmails(text).forEach((e) => emails.add(e));
    extractSaPhones(text).forEach((p) => phones.add(p));
    extractIntlPhones(text).forEach((p) => phones.add(p));
    if (!foundLinkedin) {
      const m = html.match(/href=["'](https?:\/\/[a-z.]*linkedin\.com\/(?:company|in)\/[^"'\s>]+)["']/i);
      if (m) foundLinkedin = m[1];
    }
  }
  return { emails: [...emails], phones: [...phones], linkedin: foundLinkedin || undefined };
}

/** Find the company's real website (desc links → SERP → slug-guess) and crawl it. */
export async function enrichCompany(name: string, country: string, descriptionHtml?: string): Promise<Enrichment> {
  const [linkedin, serpHosts] = await Promise.all([
    serpLinkedInLookup(name, country),
    serpBusinessLookup(name, country),
  ]);

  const empty: Enrichment = { website: "", linkedin, emails: [], phones: [] };
  const hosts = [
    ...linksFromDescription(descriptionHtml || ""),
    ...serpHosts,
    ...candidateDomains(name, country),
  ];
  const seen = new Set<string>();

  for (const host of hosts) {
    if (!host || seen.has(host)) continue;
    seen.add(host);
    if (!(await domainExists(host))) continue;

    const crawled = await crawlWebsiteContacts(host);
    if (crawled.emails.length > 0 || crawled.phones.length > 0 || (await fetchPageText(`https://${host}/`))) {
      return {
        website: `https://${host}`,
        linkedin: linkedin || crawled.linkedin || "",
        emails: crawled.emails,
        phones: crawled.phones,
      };
    }
  }
  return empty;
}

/* ── Decision Maker & Battlecard Intelligence ─────────────────────────── */

/** E.164 Clean phone formatter for 1-click VoIP / tel: dialling */
export function formatPhoneE164(phone: string, country = "za"): string {
  const digits = String(phone || "").replace(/[^0-9+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;

  const c = country.toLowerCase();
  if (c === "za") {
    if (digits.startsWith("0") && digits.length === 10) return `+27${digits.slice(1)}`;
    if (digits.startsWith("27") && digits.length >= 11) return `+${digits}`;
  } else if (c === "gb" || c === "uk") {
    if (digits.startsWith("0") && digits.length >= 10) return `+44${digits.slice(1)}`;
    if (digits.startsWith("44")) return `+${digits}`;
  } else if (c === "us" || c === "ca") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  }
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/** Search for actual Decision Maker Name & Title (Dealer Principal, General Manager, CEO, Head of Talent) */
export async function findDecisionMaker(company: string, vertical: string, country = "za"): Promise<{ name: string; title: string; linkedin?: string }> {
  const key = bdEnv("BRIGHTDATA_API_KEY");
  if (!key || !company) return { name: "", title: "" };
  const zone = bdEnv("BRIGHTDATA_SERP_ZONE") || "tds";
  const gl = country === "gb" ? "uk" : country === "za" ? "za" : "us";

  let roleTerms = "";
  if (vertical === "dealers") {
    roleTerms = `"Dealer Principal" OR "General Manager" OR "General Sales Manager" OR "Managing Director" OR "Owner"`;
  } else if (vertical === "jobs") {
    roleTerms = `"Head of Talent" OR "VP Sales" OR "Founder" OR "CEO" OR "Hiring Manager" OR "Director of Engineering"`;
  } else {
    roleTerms = `"Principal" OR "Managing Director" OR "Broker" OR "Owner"`;
  }

  const query = `"${company}" (${roleTerms}) site:linkedin.com/in`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${gl}&hl=en&num=4&brd_json=1`;

  try {
    const { status, text } = await postJson(`${BD_API_BASE}/request`, { zone, url, format: "raw" }, key, 15000);
    if (status !== 200 || !text) return { name: "", title: "" };
    const data = JSON.parse(text);
    const organic = Array.isArray(data?.organic) ? data.organic : [];

    for (const r of organic) {
      const titleStr = String(r?.title || "");
      const link = String(r?.link || "");
      // Expected LinkedIn SERP title format: "John Doe - Dealer Principal - Company | LinkedIn"
      const cleanTitle = titleStr.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
      const parts = cleanTitle.split(/\s*[-–—|]\s*/);
      if (parts.length >= 2) {
        const personName = parts[0].trim();
        const role = parts[1].trim();
        // Basic sanity check: person name shouldn't be the company name
        if (personName.length >= 3 && personName.length <= 35 && !personName.toLowerCase().includes(company.toLowerCase())) {
          return {
            name: personName,
            title: role,
            linkedin: link.includes("linkedin.com/in") ? link : undefined,
          };
        }
      }
    }
    return { name: "", title: "" };
  } catch {
    return { name: "", title: "" };
  }
}

/** Pre-computes tailored 2-sentence cold calling battlecard / opening pitch script */
export function generateBattlecard(lead: Partial<Lead>): string {
  const name = lead.contact ? lead.contact.split(" ")[0] : (lead.contactTitle ? lead.contactTitle : "there");
  const loc = lead.location ? ` in ${lead.location}` : "";
  const company = lead.name || "your company";

  if (lead.vertical === "dealers") {
    return `Hi ${name}, calling from TruDealer. We automate vehicle inventory feeds and CRM lead response for dealerships${loc}. Are you open to seeing how other dealers increased showroom walk-in conversion by 25% this month?`;
  }

  if (lead.vertical === "jobs") {
    const role = (lead as any)?.role || lead.context || "open roles";
    return `Hi ${name}, saw ${company} is currently hiring for a ${role}. We place pre-vetted, immediate-start nearshore talent at 60% lower cost than local recruiters. Would you be open to reviewing 2 candidate profiles this week?`;
  }

  return `Hi ${name}, calling from TruCRM regarding your listings${loc}. We provide an all-in-one lead capture and deal management platform for agencies. Would you be open to a 5-minute preview?`;
}

/** Calculates 0-100 lead quality/completeness score */
export function calculateQualityScore(lead: Partial<Lead>): number {
  let score = 0;
  // Direct dial phone: +35 pts
  if ((Array.isArray(lead.phones) && lead.phones.length > 0) || lead.formattedPhone) score += 35;
  // Decision maker name: +25 pts
  if (lead.contact && lead.contact.trim()) score += 25;
  // Direct email: +20 pts
  if (Array.isArray(lead.emails) && lead.emails.length > 0) score += 20;
  // Live website: +15 pts
  if (lead.website && lead.website.startsWith("http")) score += 15;
  // Location / Address: +5 pts
  if (lead.location || (lead as any)?.address) score += 5;
  return Math.min(100, score);
}

/** Enrich the distinct companies across a lead list (concurrent, capped). */
export async function enrichLeads<T extends Lead>(leads: T[], maxEnrich = 20, concurrency = 6): Promise<T[]> {
  const byName = new Map<string, { country: string; vertical: string; desc: string }>();
  for (const l of leads) {
    if (!byName.has(l.name)) {
      byName.set(l.name, { country: l.country || "za", vertical: l.vertical || "jobs", desc: l.description || "" });
    }
  }
  const names = [...byName.keys()].slice(0, maxEnrich);
  let cursor = 0;

  const worker = async () => {
    while (cursor < names.length) {
      const n = names[cursor++];
      const e = byName.get(n)!;
      const [compRes, dmRes] = await Promise.all([
        enrichCompany(n, e.country, e.desc),
        findDecisionMaker(n, e.vertical, e.country),
      ]);

      for (const l of leads) {
        if (l.name === n) {
          if (!l.website && compRes.website) l.website = compRes.website;
          if (!l.linkedin && (dmRes.linkedin || compRes.linkedin)) l.linkedin = dmRes.linkedin || compRes.linkedin;
          if (compRes.emails.length > 0) l.emails = Array.from(new Set([...(l.emails || []), ...compRes.emails])).slice(0, 5);
          if (compRes.phones.length > 0) l.phones = Array.from(new Set([...(l.phones || []), ...compRes.phones])).slice(0, 5);

          if (dmRes.name) {
            l.contact = dmRes.title ? `${dmRes.name} (${dmRes.title})` : dmRes.name;
            l.contactTitle = dmRes.title;
          }

          const primaryPhone = (Array.isArray(l.phones) && l.phones[0]) || "";
          if (primaryPhone) l.formattedPhone = formatPhoneE164(primaryPhone, l.country || e.country);

          l.pitch = generateBattlecard(l);
          l.qualityScore = calculateQualityScore(l);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, names.length || 1) }, worker));

  // Compute pitch and quality score for all leads (even those unenriched)
  for (const l of leads) {
    delete l.description;
    if (!l.pitch) l.pitch = generateBattlecard(l);
    if (!l.qualityScore) l.qualityScore = calculateQualityScore(l);
    const ph = (Array.isArray(l.phones) && l.phones[0]) || "";
    if (ph && !l.formattedPhone) l.formattedPhone = formatPhoneE164(ph, l.country || "za");
  }

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

/** Automatically locate the TruCRM data directory. */
export function findCrmDataDir(): string {
  const env = (process.env.CRM_DATA_DIR || process.env.DATA_DIR || "").trim();
  if (env && fs.existsSync(env)) return env;

  const candidates = [
    path.resolve(process.cwd(), "../../TruCRM/data"),
    path.resolve(process.cwd(), "../TruCRM/data"),
    path.resolve(process.cwd(), "TruCRM/data"),
    path.resolve(process.cwd(), "data"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultFallback = candidates[0];
  fs.mkdirSync(defaultFallback, { recursive: true });
  return defaultFallback;
}

/**
 * Write leads into the CRM's per-workspace JSON store (the same store the CRM
 * reads via /api/db/:key). Merges with existing leads (dedupe by id) so repeat
 * runs append instead of clobbering. `workspace` follows the CRM's workspaceFile
 * convention: "default" → scraper-leads.json, else "<ws>_scraper-leads.json".
 */
export function writeScraperStore<T extends Lead>(leads: T[], dataDir?: string, workspace = "default"): string {
  const dir = dataDir || findCrmDataDir();
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

/**
 * Write leads directly into the CRM's active working `leads.json` store
 * (the actual pipeline board database), assigning CRM references and fields.
 */
export function writeCrmLeadsDirect<T extends Lead>(leads: T[], workspace = "default", dataDir?: string): { file: string; added: number; total: number } {
  const dir = dataDir || findCrmDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, workspace === "default" ? "leads.json" : `${workspace}_leads.json`);
  let existing: any[] = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Array.isArray(parsed)) existing = parsed;
  } catch {
    /* no existing store */
  }
  const seen = new Set(existing.map((l) => `${l?.company || ""}|${l?.context || ""}`.toLowerCase()));
  const year = new Date().getFullYear();
  let seq = existing.length;
  const added: any[] = [];

  for (const raw of leads) {
    const company = String(raw?.name || "").trim();
    if (!company) continue;
    const context = String(raw?.context || (raw as any)?.title || (raw as any)?.role || "").trim();
    const k = `${company}|${context}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    seq += 1;
    const ph = (Array.isArray(raw?.phones) ? raw.phones[0] : (raw?.phones || (raw as any)?.phone)) || undefined;
    const cleanPh = ph ? formatPhoneE164(ph, raw?.country || "za") : undefined;
    const pitch = raw?.pitch || generateBattlecard(raw);
    const qualityScore = raw?.qualityScore || calculateQualityScore(raw);

    added.push({
      id: `scrape-${raw?.id || `${Date.now()}-${seq}`}`,
      reference: `LD-${year}-${String(seq).padStart(4, "0")}`,
      company,
      contact: raw?.contact || "",
      context: context || undefined,
      phone: cleanPh || ph,
      email: (Array.isArray(raw?.emails) ? raw.emails[0] : (raw?.emails || (raw as any)?.email)) || undefined,
      linkedin: raw?.linkedin || undefined,
      website: raw?.website || (raw as any)?.applyUrl || undefined,
      location: raw?.location || (raw as any)?.address || undefined,
      source: raw?.source === "adzuna" ? "Adzuna" : raw?.source === "cars.co.za" ? "Cars.co.za" : (raw?.source || "Scraper"),
      temperature: "Cold",
      stage: "new",
      salespersonId: "sp-1",
      value: raw?.value,
      tags: [raw?.vertical, ...(raw?.tags || [])].filter(Boolean),
      notes: pitch ? `[Cold Pitch]: ${pitch}` : undefined,
      pitch,
      qualityScore,
      createdAt: raw?.foundAt || new Date().toISOString(),
    });
  }

  const updated = [...added, ...existing];
  fs.writeFileSync(file, JSON.stringify(updated, null, 2), "utf-8");
  return { file, added: added.length, total: updated.length };
}

/**
 * Zero-friction helper to push leads to TruCRM over HTTP.
 * No manual curls needed — auto-attaches scraper API key and target workspace.
 */
export async function pushLeadsToCrm<T extends Lead>(
  leads: T[],
  opts: { url?: string; workspace?: string; apiKey?: string } = {}
): Promise<{ ok: boolean; imported: number; skipped: number; total: number; message: string }> {
  const targetUrl = (opts.url || process.env.CRM_URL || process.env.TRUCRM_URL || "http://localhost:3000").replace(/\/$/, "");
  const ws = opts.workspace || "default";
  const key = opts.apiKey || process.env.SCRAPER_API_KEY || "";

  const headers: Record<string, string> = {
    "x-workspace": ws,
    ...(key ? { "x-scraper-key": key } : {}),
  };

  try {
    const { status, text } = await httpPost(`${targetUrl}/api/leads/import`, { leads, workspace: ws }, headers, 40000);
    if (status === 200) {
      const data = JSON.parse(text);
      return {
        ok: true,
        imported: data.imported ?? leads.length,
        skipped: data.skipped ?? 0,
        total: data.totalInCrm ?? (data.imported || 0),
        message: `Successfully pushed to CRM [${ws}]: ${data.imported ?? leads.length} imported, ${data.skipped ?? 0} skipped.`,
      };
    }
    return {
      ok: false,
      imported: 0,
      skipped: leads.length,
      total: 0,
      message: `Push failed (HTTP ${status}): ${text.slice(0, 200)}`,
    };
  } catch (e: any) {
    return {
      ok: false,
      imported: 0,
      skipped: leads.length,
      total: 0,
      message: `Push failed to reach ${targetUrl}: ${e?.message || e}`,
    };
  }
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
