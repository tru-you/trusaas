/**
 * ad-hoc harness — run a valuation per market to smoke-test the engine.
 *   npx tsx scripts/test-markets.ts
 *
 * Set env to keep it quick and cheap (site scraping against live classifieds
 * can be slow / bot-blocked; the engine degrades gracefully to listingsFound: 0):
 *   SCRAPER_CLASSIFIEDS_PAGES=1 SCRAPER_TIMEOUT_MS=5000
 */
import { fetchValuation, markets } from "../index";

interface Case { label: string; make: string; model: string; year: string; mileage?: number; market: any; }

const cases: Case[] = [
  { label: "ZA (car)",        make: "Volkswagen", model: "Golf",         year: "2021", mileage: 40000, market: markets.sa },
  { label: "US (car)",        make: "Honda",      model: "Civic",        year: "2021", mileage: 40000, market: markets.us },
  { label: "UK (car)",        make: "Ford",       model: "Fiesta",       year: "2021", mileage: 40000, market: markets.uk },
  { label: "Housing ZA",      make: "Cape Town",  model: "apartment",    year: "2024",              market: markets.housingZa },
];

async function main() {
  for (const c of cases) {
    console.log(`\n=== ${c.label} ===`);
    const t0 = Date.now();
    try {
      const r = await fetchValuation(c.make, c.model, c.year, { mileage: c.mileage }, c.market);
      console.log(`time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      console.log(JSON.stringify({
        avg: r.averageRetailPrice,
        listings: r.listingsFound,
        fallback: r.fallbackRequired,
        searchUrl: r.searchUrl,
        carsUrl: r.carsUrl,
        sources: r.sources,
      }, null, 2));
    } catch (e: any) {
      console.log(`time: ${((Date.now() - t0) / 1000).toFixed(1)}s — ERROR: ${e?.message}`);
    }
  }
}

main();
