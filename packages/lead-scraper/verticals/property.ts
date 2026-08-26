/**
 * property vertical — TruProperty.
 *
 * Net-new, best-effort. Estate-agency directories are JS-heavy, so fetch via
 * Web Unlocker (zone "tds2") and pull agency records from JSON-LD
 * (RealEstateAgent / LocalBusiness) with a phone/website regex fallback.
 * Marked RETUNE — verify the selectors/URLs against live markup before trusting.
 */

import { webUnlockerFetch, detectBlocked, cleanHtmlText, extractSaPhones, dedupeById } from "../core";
import type { PropertyLead, SearchParams } from "../types";

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
        name: String(it.name),
        phone: typeof it.telephone === "string" ? it.telephone : "",
        url: typeof it.url === "string" ? it.url : "",
        area: it.address && typeof it.address === "object" ? [it.address.addressLocality, it.address.addressRegion].filter(Boolean).join(", ") : "",
      });
    }
  }
  return out;
}

export const PROPERTY_COLUMNS = ["name", "agency", "location", "country", "website", "linkedin", "emails", "phones", "source"];

export async function searchProperty(
  p: SearchParams & { province?: string; maxAgencies?: number }
): Promise<PropertyLead[]> {
  const max = p.maxAgencies ?? 10;
  const province = p.province || "";
  const leads: PropertyLead[] = [];

  for (const src of SOURCES) {
    const html = await webUnlockerFetch(src.url, { country: "za" });
    if (!html || detectBlocked(html)) continue;
    const businesses = jsonLdBusinesses(html);
    const fallbackPhones = extractSaPhones(cleanHtmlText(html));

    const toLead = (name: string, phone: string, url: string, area: string): PropertyLead => ({
      vertical: "property",
      id: `property|za|${name}`.toLowerCase().replace(/\s+/g, " "),
      name,
      agency: src.name,
      location: province || area || "",
      country: "za",
      website: url,
      linkedin: "",
      emails: [],
      phones: phone ? [phone] : fallbackPhones.slice(0, 1),
      source: src.name,
      foundAt: new Date().toISOString(),
    });

    for (const b of businesses.slice(0, max)) leads.push(toLead(b.name, b.phone, b.url, b.area));
  }

  return dedupeById(leads);
}
