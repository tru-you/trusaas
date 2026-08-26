/**
 * dealers vertical — TruDealer.
 *
 * Phone-first: discovers dealers off the cars.co.za directory list (the
 * /groups/…/id/ links are stable), then fetches each detail page and reads the
 * dealer's name/phone/address from JSON-LD (the site moved dealer data out of
 * __NEXT_DATA__ into JSON-LD in 2026). Direct dealer phone numbers — what you
 * dial.
 */

import { webUnlockerFetch, detectBlocked, cleanHtmlText, extractEmails, extractSaPhones, extractJsonLdBusinesses, dedupeById } from "../core";
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

function dealerListUrl(location: string): string {
  const entry = CITY_PROVINCE[location.trim().toLowerCase()];
  return entry ? `https://www.cars.co.za/search-dealer/${entry}/` : "https://www.cars.co.za/search-dealer/";
}

/** Pull dealer detail-page URLs off a rendered cars.co.za directory list. */
function dealerEntriesFromList(html: string): { detailUrl: string; name: string }[] {
  const out: { detailUrl: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\/groups\/[^/]+\/[^/]+\/\d+\//gi)) {
    const path = m[0];
    const parts = path.split("/").filter(Boolean); // [groups, Group, Name, id]
    const name = parts[2] || "";
    const id = parts[3] || "";
    if (!name || !id || seen.has(path)) continue;
    seen.add(path);
    out.push({ detailUrl: `https://www.cars.co.za${path}`, name: name.replace(/-/g, " ") });
  }
  return out;
}

const EXTERNAL_EXCLUDE =
  /(cars\.co\.za|autotrader\.co\.za|doubleclick\.net|googlesyndication\.com|googletagmanager\.com|google-analytics\.com|googleadservices\.com|googleapis\.com|gstatic\.com|google\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|linkedin\.com|whatsapp\.com|wa\.me|w3\.org|schema\.org|recaptcha\.net|cloudflare\.com)$/;

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

export const DEALER_COLUMNS = ["name", "location", "country", "address", "website", "linkedin", "emails", "phones", "source"];

export async function searchDealers(
  p: SearchParams & { location?: string; maxDealers?: number; concurrency?: number }
): Promise<DealerLead[]> {
  const location = (p.location || "cape town").trim();
  const maxDealers = p.maxDealers ?? 10;
  const concurrency = p.concurrency ?? 3;

  let listHtml = await webUnlockerFetch(dealerListUrl(location), { country: "za" });
  if (!listHtml) listHtml = await webUnlockerFetch(dealerListUrl(location), { country: "za" }); // retry once
  if (!listHtml) return [];
  if (detectBlocked(listHtml)) {
    const retry = await webUnlockerFetch(dealerListUrl(location), { country: "za" });
    if (retry) listHtml = retry;
    if (detectBlocked(listHtml)) {
      console.warn("[lead-scraper:dealers] blocked:", detectBlocked(listHtml));
      return [];
    }
  }

  const entries = dealerEntriesFromList(listHtml).slice(0, maxDealers);
  const leads: DealerLead[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const item = entries[cursor++];
      const page = await webUnlockerFetch(item.detailUrl, { country: "za" });
      if (!page) continue;
      const pr = parseDealerPage(page, item.name);
      if (!pr.name || !pr.phone) continue;
      leads.push({
        vertical: "dealers",
        id: `dealers|za|${pr.name}|${pr.phone}`.toLowerCase().replace(/\s+/g, " "),
        name: pr.name,
        location,
        country: "za",
        website: pr.website,
        linkedin: "",
        emails: pr.email ? [pr.email] : [],
        phones: [pr.phone],
        source: "cars.co.za",
        foundAt: new Date().toISOString(),
        address: pr.address,
      });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return dedupeById(leads);
}
