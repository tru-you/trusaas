import { webUnlockerFetch, detectBlocked, cleanHtmlText, extractSaPhones, crawlWebsiteContacts, serpBusinessLookup, serpLinkedInLookup, dedupeById, fetchJson } from "../core";
import type { PropertyLead, SearchParams } from "../types";

export const SA_PROPERTY_CITIES = [
  "johannesburg", "sandton", "pretoria", "cape town", "durban", "umhlanga", "ballito",
  "stellenbosch", "somerset west", "centurion", "randburg", "port elizabeth", "bloemfontein",
];

const SOURCES = [
  { name: "Private Property", url: "https://www.privateproperty.co.za/estate-agencies" },
  { name: "Property24", url: "https://www.property24.com/estate-agents" },
];

function jsonLdBusinesses(html: string): { name: string; phone: string; url: string; area: string }[] {
  const out: { name: string; phone: string; url: string; area: string }[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: any;
    try { parsed = JSON.parse(m[1].trim()); } catch { continue; }
    const graph = parsed["@graph"];
    const items = Array.isArray(graph) ? graph : Array.isArray(parsed) ? parsed : [parsed];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const t = Array.isArray(it["@type"]) ? it["@type"] : [it["@type"]];
      if (!t.some((x: string) => /RealEstateAgent|LocalBusiness|Organization|Business/i.test(String(x)))) continue;
      if (!it.name) continue;
      out.push({
        name: String(it.name).trim(),
        phone: typeof it.telephone === "string" ? it.telephone : "",
        url: typeof it.url === "string" ? it.url : "",
        area: it.address && typeof it.address === "object" ? [it.address.addressLocality, it.address.addressRegion].filter(Boolean).join(", ") : "",
      });
    }
  }
  return out;
}

async function geoapifyAgenciesInCity(city: string, limit = 20): Promise<PropertyLead[]> {
  const apiKey = (process.env.GEOAPIFY_API_KEY || "").trim();
  if (!apiKey) return [];
  try {
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?apiKey=${apiKey}&text=${encodeURIComponent(`${city}, South Africa`)}&limit=1`;
    const geo = await fetchJson(geoUrl);
    const coords = geo?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== "number") return [];

    const lon1 = (coords[0] - 0.35).toFixed(4);
    const lat1 = (coords[1] - 0.25).toFixed(4);
    const lon2 = (coords[0] + 0.35).toFixed(4);
    const lat2 = (coords[1] + 0.25).toFixed(4);

    const placesUrl = `https://api.geoapify.com/v2/places?apiKey=${apiKey}&categories=service.financial.real_estate,commercial.office&filter=rect:${lon1},${lat1},${lon2},${lat2}&bias=proximity:${coords[0]},${coords[1]}&limit=${limit}`;
    const data = await fetchJson(placesUrl);
    const features: any[] = Array.isArray(data?.features) ? data.features : [];

    const results: PropertyLead[] = [];
    for (const f of features) {
      const p = f?.properties || {};
      const name = String(p?.name || "").trim();
      const phone = String(p?.phone || p?.contact?.phone || "");
      if (!name) continue;
      const address = [p?.address_line1, p?.address_line2].filter(Boolean).join(", ");
      const website = String(p?.website || p?.datasource?.raw?.website || "");
      results.push({
        vertical: "property",
        id: `property|za|geoapify|${name}|${city}`.toLowerCase().replace(/\s+/g, " "),
        name,
        agency: "Real Estate",
        location: city,
        country: "za",
        website,
        linkedin: "",
        emails: [],
        phones: phone ? [phone] : [],
        source: "Geoapify",
        foundAt: new Date().toISOString(),
        context: `Estate Agency — ${city}`,
        address: address || city,
      });
    }
    return results;
  } catch {
    return [];
  }
}

export const PROPERTY_COLUMNS = ["name", "agency", "location", "country", "website", "linkedin", "emails", "phones", "source"];

export async function searchProperty(
  p: SearchParams & { province?: string; location?: string; maxAgencies?: number }
): Promise<PropertyLead[]> {
  const max = p.maxAgencies ?? p.maxResults ?? 25;
  const loc = (p.location || p.province || "all").trim().toLowerCase();
  const leads: PropertyLead[] = [];

  // 1) Directory scrape via Web Unlocker
  for (const src of SOURCES) {
    try {
      const html = await webUnlockerFetch(src.url, { country: "za" });
      if (!html || detectBlocked(html)) continue;
      const businesses = jsonLdBusinesses(html);
      const fallbackPhones = extractSaPhones(cleanHtmlText(html));

      for (const b of businesses.slice(0, Math.ceil(max / 2))) {
        leads.push({
          vertical: "property",
          id: `property|za|${b.name}`.toLowerCase().replace(/\s+/g, " "),
          name: b.name,
          agency: src.name,
          location: b.area || loc,
          country: "za",
          website: b.url,
          linkedin: "",
          emails: [],
          phones: b.phone ? [b.phone] : fallbackPhones.slice(0, 1),
          source: src.name,
          foundAt: new Date().toISOString(),
          context: "Estate Agency",
          address: b.area || loc,
        });
      }
    } catch {
      /* continue */
    }
  }

  // 2) Geoapify Places search across cities
  const cities = loc === "all" ? SA_PROPERTY_CITIES.slice(0, 5) : [loc];
  for (const city of cities) {
    if (leads.length >= max) break;
    const geoLeads = await geoapifyAgenciesInCity(city, Math.ceil(max / cities.length));
    leads.push(...geoLeads);
  }

  // 3) Enrich with websites / emails / phones
  if (p.enrich !== false) {
    const concurrency = p.concurrency ?? 4;
    let cursor = 0;
    const worker = async () => {
      while (cursor < leads.length) {
        const item = leads[cursor++];
        if (!item.website) {
          const hosts = await serpBusinessLookup(item.name, "za");
          if (hosts[0]) item.website = `https://${hosts[0]}`;
          item.linkedin = await serpLinkedInLookup(item.name, "za");
        }
        if (item.website && !item.website.includes("property24") && !item.website.includes("privateproperty")) {
          const crawled = await crawlWebsiteContacts(item.website);
          if (crawled.emails.length > 0) item.emails = crawled.emails.slice(0, 3);
          if (crawled.phones.length > 0 && item.phones.length === 0) item.phones = crawled.phones.slice(0, 3);
          if (!item.linkedin && crawled.linkedin) item.linkedin = crawled.linkedin;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }

  return dedupeById(leads).slice(0, max);
}
