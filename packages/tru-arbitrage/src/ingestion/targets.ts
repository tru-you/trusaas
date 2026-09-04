/**
 * Targeted ingestion lane — the fix for "find deals shows nothing of the make
 * while there are hundreds for sale".
 *
 * The legacy scan fed ONLY the national newest-page feed (~32 cars, whatever
 * was posted in the last hour). A dealer watching GWM saw nothing unless a GWM
 * happened to be in that sliver. This lane instead queries AutoTrader BY
 * MAKE/MODEL, cheapest-first, paginated — the exact query find-cheapest provably
 * answers every time — and returns real listings for the normalizer to process.
 *
 * Targets are "Toyota" or "Toyota/Hilux", configured in the Buy Box modal
 * (DealerBuyBox.watchTargets -> POST /api/buybox).
 */
import * as cheerio from 'cheerio';
import { RawFbListing } from '../types';
import { CONFIG } from '../config';
import { fetchHtmlWithFallback } from '../engine/fetch-html';
import { findCardYear } from '../engine/year';
import { modelCore } from '../engine/valuation';
import { titleCaseVehicle } from '../engine/tu-matcher';

const PRICE_RE = /R\s?((?:\d{1,3}(?:[ ,]\d{3})+|\d{6,7}))/i;
const KM_RE = /(\d{1,3}(?:[ ,]\d{3})?)\s?km/i;
const DISPLACEMENT_RE = /[0-9]\.[0-9]/;
// Field separators that glue onto the model in AutoTrader's concatenated text
// ("...P-Series2.0TD SXUsed93800 kmAutomaticDiesel").
const NOISE_CUT_RE = /\b(insights available|fair price|great price|low price|high price|no rating|used|new|automatic|manual|km)\b/i;

/** Extract a base model from a concatenated AutoTrader tile by cutting the
 *  GLUED-ON tail: "GWM P3002.4T Double Cab LTNewAutomaticDiesel" -> "P300",
 *  "GWM Tank 300 Ultra Luxury Used12 000 km" -> "Tank". Falls back to the
 *  first token after the make. */
export function modelFromTile(text: string, make: string): string | null {
  const mkLower = (make || '').toLowerCase();
  const idx = (text || '').toLowerCase().indexOf(mkLower);
  if (idx < 0) return null;
  let after = text.slice(idx + mkLower.length);

  const disp = after.match(DISPLACEMENT_RE);
  if (disp && disp.index !== undefined) after = after.slice(0, disp.index);

  const cut = after.search(NOISE_CUT_RE);
  if (cut > 0) after = after.slice(0, cut);

  const model = after.trim().replace(/\s+/g, ' ').split(/\s+/)[0] || '';
  return model.length >= 2 ? model : null;
}

/** Pull listing rows off an AutoTrader results page. Cards whose model year
 *  can't be read are dropped (unreadable year = can't validate the band). */
export function parseAutoTraderListings(html: string, make: string, model?: string): RawFbListing[] {
  const $ = cheerio.load(html);
  const out: RawFbListing[] = [];
  const seen = new Set<string>();
  const makeKey = make.toLowerCase();
  const modelKey = model ? modelCore(model) : null;

  $('a[class*="result-tile"], a[class*="vehicle-card"], a[class*="listing-card"]').each((_, el) => {
    const $c = $(el);
    const text = $c.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 8) return;

    const lower = text.toLowerCase();
    if (!lower.includes(makeKey)) return;
    if (modelKey && !lower.includes(modelKey)) return;

    const year = findCardYear(text, make);
    if (year == null) return;

    const modelName = modelFromTile(text, make);

    const priceMatch = text.match(PRICE_RE);
    if (!priceMatch) return;
    const price = parseInt(priceMatch[1].replace(/[^\d]/g, ''), 10);
    if (price < CONFIG.MIN_VEHICLE_PRICE || price > CONFIG.MAX_VEHICLE_PRICE) return;

    const kmMatch = text.match(KM_RE);
    const km = kmMatch ? parseInt(kmMatch[1].replace(/[\s,]/g, ''), 10) : undefined;

    const href = $c.attr('href') || '';
    const url = href.startsWith('http') ? href : `https://www.autotrader.co.za${href}`;
    // Full URL as the id — a base64-prefix slice collides for URLs sharing a
    // long prefix (/gwm-1 vs /gwm-2 differ only in the last byte, so 16 base64
    // chars of the shared prefix produce the SAME id and one gets deduped away).
    const id = `at_${url}`;
    if (seen.has(id)) return;
    seen.add(id);

    out.push({
      id,
      source: 'autotrader',
      url,
      title: text,
      description: `Mileage: ${km ?? 'N/A'} km. AutoTrader targeted scan.`,
      final_price: price,
      price,
      currency: 'ZAR',
      location: 'South Africa',
      seller_name: 'AutoTrader Dealer',
      images: [],
      date_posted: new Date().toISOString(),
      // Structured fields — the normalizer prefers typed values over title
      // parsing when present (see normalizeViaRegex).
      year,
      make,
      model: modelName || model || undefined,
      mileage: km,
    });
  });

  return out;
}

/** Fetch every page of one target's AutoTrader results, cheapest first.
 *  Stops paging the moment a page yields nothing (end of listings). */
export async function fetchTargetListings(target: string, pages: number): Promise<RawFbListing[]> {
  const [makeRaw, modelRaw] = String(target || '')
    .split('/')
    .map((s) => s.trim());
  if (!makeRaw) return [];

  const make = titleCaseVehicle(makeRaw);
  const model = modelRaw ? titleCaseVehicle(modelRaw) : undefined;
  const out: RawFbListing[] = [];

  for (let p = 1; p <= pages; p++) {
    const url =
      `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(make)}` +
      (model ? `&model=${encodeURIComponent(model)}` : '') +
      `&sort=Price_Ascending&page=${p}`;
    const html = await fetchHtmlWithFallback(url);
    if (!html) continue;
    const found = parseAutoTraderListings(html, make, model);
    if (found.length === 0) break; // last page reached / source blocked
    out.push(...found);
  }
  return out;
}

/** Fetch all of a dealer's watch targets with small concurrency. */
export async function fetchAllTargets(targets: string[]): Promise<RawFbListing[]> {
  const pages = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
  const out: RawFbListing[] = [];
  const queue = [...new Set(targets.map((t) => t.trim()).filter(Boolean))];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(2, queue.length); w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const target = queue.shift()!;
          try {
            const found = await fetchTargetListings(target, pages);
            console.log(`[targets] "${target}" -> ${found.length} targeted listings`);
            out.push(...found);
          } catch (err: any) {
            console.warn(`[targets] "${target}" fetch failed:`, err?.message || err);
          }
        }
      })()
    );
  }
  await Promise.all(workers);
  return out;
}