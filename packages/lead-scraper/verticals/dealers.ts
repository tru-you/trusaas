/**
 * dealers vertical — TruDealer.
 *
 * Phone-first: discovers dealers off the cars.co.za directory list (the
 * /groups/…/id/ links are stable), then fetches each detail page and reads the
 * dealer's name/phone/address from JSON-LD (the site moved dealer data out of
 * __NEXT_DATA__ into JSON-LD in 2026). Direct dealer phone numbers — what you
 * dial.
 */

import { webUnlockerFetch, detectBlocked, cleanHtmlText, extractEmails, extractSaPhones, extractJsonLdBusinesses, serpBusinessLookup, serpLinkedInLookup, dedupeById } from "../core";
import type { DealerLead, SearchParams } from "../types";

const CITY_PROVINCE: Record<string, string> = {
  centurion: "Gauteng/Centurion", pretoria: "Gauteng/Pretoria", johannesburg: "Gauteng/Johannesburg",
  sandton: "Gauteng/Sandton", randburg: "Gauteng/Randburg", boksburg: "Gauteng/Boksburg",
  benoni: "Gauteng/Benoni", midrand: "Gauteng/Midrand", "kempton park": "Gauteng/Kempton-Park",
  vereeniging: "Gauteng/Vereeniging", roodepoort: "Gauteng/Roodepoort", germiston: "Gauteng/Germiston",
  alberton: "Gauteng/Alberton", "cape town": "Western-Cape/Cape-Town", bellville: "Western-Cape/Bellville",
  milnerton: "Western-Cape/Milnerton", durbanville: "Western-Cape/Durbanville", stellenbosch: "Western-Cape/Stellenbosch",
  paarl: "Western-Cape/Paarl", george: "Western-Cape/George", durban: "Kwazulu-Natal/Durban",
  pietermaritzburg: "Kwazulu-Natal/Pietermaritzburg", ballito: "Kwazulu-Natal/Ballito", "richards bay": "Kwazulu-Natal/Richards-Bay",
  bloemfontein: "Free-State/Bloemfontein", polokwane: "Limpopo/Polokwane", nelspruit: "Mpumalanga/Nelspruit",
  witbank: "Mpumalanga/Witbank", kimberley: "Northern-Cape/Kimberley", rustenburg: "North-West-Province/Rustenburg",
  klerksdorp: "North-West-Province/Klerksdorp", "port elizabeth": "Eastern-Cape/Port-Elizabeth",
  gqeberha: "Eastern-Cape/Port-Elizabeth", "east london": "Eastern-Cape/East-London",
};

export const UK_DEALER_CITIES = [
  "london", "manchester", "birmingham", "leeds", "glasgow", "liverpool", "bristol", "sheffield", "edinburgh", "nottingham",
];

export const US_DEALER_CITIES = [
  "los angeles", "houston", "chicago", "dallas", "miami", "atlanta", "phoenix", "austin", "denver", "orlando",
];

export const SA_MAJOR_DEALER_CITIES = [
  "johannesburg", "pretoria", "sandton", "centurion", "randburg", "boksburg",
  "cape town", "bellville", "durban", "port elizabeth", "bloemfontein",
  "east london", "nelspruit", "polokwane", "rustenburg", "kimberley", "george",
];

const COUNTRY_NAMES: Record<string, string> = {
  za: "South Africa",
  gb: "United Kingdom",
  uk: "United Kingdom",
  us: "United States",
  au: "Australia",
  ca: "Canada"
};

function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/[-_]+/g, " ");
}

function dealerListUrl(location: string, page = 1): string {
  const norm = normalizeCity(location);
  const entry = CITY_PROVINCE[norm];
  const base = entry ? `https://www.cars.co.za/search-dealer/${entry}/` : "https://www.cars.co.za/search-dealer/";
  return page > 1 ? `${base}?page=${page}` : base;
}

/** Pull dealer detail-page URLs off a rendered cars.co.za directory list. */
function dealerEntriesFromList(html: string): { detailUrl: string; name: string }[] {
  const out: { detailUrl: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\/groups\/[^/]+\/[^/]+\/\d+\//gi)) {
    const path = m[0];
    const parts = path.split("/").filter(Boolean);
    const name = parts[2] || "";
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ detailUrl: `https://www.cars.co.za${path}`, name });
  }
  return out;
}

const EXTERNAL_EXCLUDE =
  /(cars\.co\.za|autotrader\.co\.za|autotrader\.co\.uk|autotrader\.com|cars\.com|cargurus|doubleclick\.net|googlesyndication\.com|googletagmanager\.com|google-analytics\.com|googleadservices\.com|googleapis\.com|gstatic\.com|google\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|linkedin\.com|whatsapp\.com|wa\.me|w3\.org|schema\.org|recaptcha\.net|cloudflare\.com)$/;

function parseDealerPage(html: string, fallbackName: string): { name: string; address: string; phone: string; email: string; website: string } {
  const biz = extractJsonLdBusinesses(html).find((b) => b.phone) || extractJsonLdBusinesses(html)[0];
  const text = cleanHtmlText(html);
  const phones = extractSaPhones(text);
  const emails = extractEmails(text);
  for (const raw of html.match(/href=["']tel:([^"']+)["']/gi) || []) {
    const p = extractSaPhones(raw.replace(/^href=["']tel:/i, "").replace(/["']$/i, "").replace(/[^0-9+]/g, ""))[0];
    if (p) phones.push(p);
  }
  const website =
    (html.match(/href="(https?:\/\/[^"]+)"/g) || [])
      .map((a) => a.replace(/^href="/, "").replace(/"$/, ""))
      .find((u) => {
        try {
          const host = new URL(u).hostname.replace(/^www\./, "");
          return host.includes(".") && !EXTERNAL_EXCLUDE.test(host);
        } catch {
          return false;
        }
      }) || "";
  return {
    name: biz?.name || fallbackName,
    address: biz?.address || "",
    phone: biz?.phone || phones[0] || "",
    email: biz?.email || emails[0] || "",
    website,
  };
}

/** Geoapify places search for verified dealerships across SA, UK, US */
async function geoapifyDealersInCity(city: string, country = "za", limit = 20): Promise<DealerLead[]> {
  const apiKey = (process.env.GEOAPIFY_API_KEY || "").trim();
  if (!apiKey) return [];
  try {
    const countryName = COUNTRY_NAMES[country.toLowerCase()] || "South Africa";
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?apiKey=${apiKey}&text=${encodeURIComponent(`${city}, ${countryName}`)}&limit=1`;
    const geo = await (await import("../core")).fetchJson(geoUrl);
    const coords = geo?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== "number") return [];

    const placesUrl = `https://api.geoapify.com/v2/places?apiKey=${apiKey}&categories=commercial.vehicle&filter=circle:${coords[0]},${coords[1]},35000&bias=proximity:${coords[0]},${coords[1]}&limit=${limit}`;
    const data = await (await import("../core")).fetchJson(placesUrl);
    const features: any[] = Array.isArray(data?.features) ? data.features : [];

    const results: DealerLead[] = [];
    for (const f of features) {
      const p = f?.properties || {};
      const name = String(p?.name || "").trim();
      const phone = String(p?.phone || p?.contact?.phone || "");
      if (!name) continue;
      const address = [p?.address_line1, p?.address_line2, p?.city].filter(Boolean).join(", ");
      const website = String(p?.website || p?.datasource?.raw?.website || "");
      results.push({
        vertical: "dealers",
        id: `dealers|${country}|geoapify|${name}|${city}`.toLowerCase().replace(/\s+/g, " "),
        name,
        location: `${city} (${country.toUpperCase()})`,
        country,
        website,
        linkedin: "",
        emails: [],
        phones: phone ? [phone] : [],
        source: "Geoapify",
        foundAt: new Date().toISOString(),
        context: `Dealership — ${city}`,
        address: address || city,
        rating: p?.rating,
        reviews: p?.reviews,
      });
    }
    return results;
  } catch {
    return [];
  }
}

export const DEALER_COLUMNS = ["name", "location", "country", "address", "website", "linkedin", "emails", "phones", "source"];

async function scrapeDealersForSingleCity(
  city: string,
  country: string,
  maxDealers: number,
  concurrency: number,
  enrichWebsites = true
): Promise<DealerLead[]> {
  const leads: DealerLead[] = [];
  const core = await import("../core");

  // 1. Primary: Geoapify Places (Fast, guaranteed real local dealerships)
  const placesLeads = await geoapifyDealersInCity(city, country, maxDealers);
  leads.push(...placesLeads);

  // 2. Supplement with Cars.co.za directory if country is ZA and more needed
  if (country === "za" && leads.length < maxDealers) {
    try {
      const entries: { detailUrl: string; name: string }[] = [];
      const listUrl = dealerListUrl(city, 1);
      const listHtml = await webUnlockerFetch(listUrl, { country: "za" });
      if (listHtml && !detectBlocked(listHtml)) {
        entries.push(...dealerEntriesFromList(listHtml));
      }
      for (const item of entries.slice(0, maxDealers - leads.length)) {
        const page = await webUnlockerFetch(item.detailUrl, { country: "za" });
        if (!page) continue;
        const pr = parseDealerPage(page, item.name);
        if (!pr.name) continue;
        leads.push({
          vertical: "dealers",
          id: `dealers|za|${pr.name}|${city}`.toLowerCase().replace(/\s+/g, " "),
          name: pr.name,
          location: city,
          country: "za",
          website: pr.website || item.detailUrl,
          linkedin: "",
          emails: pr.email ? [pr.email] : [],
          phones: pr.phone ? [pr.phone] : [],
          source: "cars.co.za",
          foundAt: new Date().toISOString(),
          context: `Dealership — ${city}`,
          address: pr.address || city,
        });
      }
    } catch {
      /* continue */
    }
  }

  // 3. Deep Enrichment (Web Search Fallback + Website Contact Crawl + Pitch Battlecards)
  if (enrichWebsites && leads.length > 0) {
    let cursor = 0;
    const enrichWorker = async () => {
      while (cursor < leads.length) {
        const item = leads[cursor++];
        try {
          // If website or phone is missing, resolve via zero-block fast lookup
          if (!item.website || item.phones.length === 0) {
            const webInfo = await core.fastWebLookup(`${item.name} dealership ${city} South Africa contact phone`, country);
            if (!item.website && webInfo.website) item.website = webInfo.website;
            if (item.phones.length === 0 && webInfo.phone) item.phones = [webInfo.phone];
          }

          // Crawl official website for sales emails & direct phone lines
          if (item.website && !item.website.includes("cars.co.za")) {
            const crawled = await core.crawlWebsiteContacts(item.website);
            if (crawled.emails.length > 0) {
              item.emails = Array.from(new Set([...item.emails, ...crawled.emails])).slice(0, 5);
            }
            if (crawled.phones.length > 0) {
              item.phones = Array.from(new Set([...item.phones, ...crawled.phones])).slice(0, 5);
            }
            if (crawled.linkedin && !item.linkedin) item.linkedin = crawled.linkedin;
          }

          // Format phone, quality score, and 2-sentence battlecard
          if (item.phones?.[0]) item.formattedPhone = core.formatPhoneE164(item.phones[0], country);
          item.pitch = core.generateBattlecard(item);
          item.qualityScore = core.calculateQualityScore(item);
        } catch {
          /* continue */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, leads.length || 1) }, enrichWorker));
  }

  return leads;
}

export async function searchDealers(
  p: SearchParams & { location?: string; countries?: string[]; maxDealers?: number; concurrency?: number }
): Promise<DealerLead[]> {
  const rawLoc = (p.location || "all").trim().toLowerCase();
  const countries = p.countries?.length ? p.countries.map((c) => c.toLowerCase()) : ["za"];
  const maxDealers = p.maxDealers ?? (rawLoc === "all" ? 100 : 30);
  const concurrency = p.concurrency ?? 6;

  const allLeads: DealerLead[] = [];

  for (const country of countries) {
    let cities: string[] = [];
    if (rawLoc === "all" || rawLoc === "nationwide") {
      if (country === "gb" || country === "uk") cities = UK_DEALER_CITIES;
      else if (country === "us") cities = US_DEALER_CITIES;
      else cities = SA_MAJOR_DEALER_CITIES;
    } else if (rawLoc.includes(",")) {
      cities = rawLoc.split(",").map((c) => c.trim()).filter(Boolean);
    } else {
      cities = [rawLoc];
    }

    const perCity = Math.max(5, Math.ceil(maxDealers / (cities.length * countries.length)));

    for (const city of cities) {
      try {
        const cityLeads = await scrapeDealersForSingleCity(city, country, perCity, concurrency, p.enrich !== false);
        allLeads.push(...cityLeads);
        if (allLeads.length >= maxDealers) break;
      } catch (e: any) {
        console.warn(`[lead-scraper:dealers] ${city} (${country}) failed:`, e?.message || e);
      }
    }
    if (allLeads.length >= maxDealers) break;
  }

  return dedupeById(allLeads).slice(0, maxDealers);
}
