/**
 * Smoke-test harness — run a valuation per market to verify the engine.
 *
 *   npm run test                 # run all markets
 *   npm run test -- za           # run just a market by id (za | us | uk | housingZa)
 *
 * Set env to keep it quick/cheap (live classifieds can be slow or bot-blocked;
 * the engine degrades gracefully to listingsFound: 0):
 *   SCRAPER_CLASSIFIEDS_PAGES=1 SCRAPER_TIMEOUT_MS=5000
 */
import { fetchValuation, markets } from "../index";

interface Case { label: string; id: string; make: string; model: string; year: string; mileage?: number; market: any; }

const cases: Case[] = [
  { label: "ZA (car)",      id: "za",         make: "Volkswagen", model: "Golf",      year: "2021", mileage: 40000, market: markets.sa },
  { label: "US (car)",      id: "us",         make: "Honda",      model: "Civic",     year: "2021", mileage: 40000, market: markets.us },
  { label: "UK (car)",      id: "uk",         make: "Ford",       model: "Fiesta",    year: "2021", mileage: 40000, market: markets.uk },
  { label: "Housing ZA",    id: "housingZa",  make: "Cape Town",  model: "apartment", year: "2024",              market: markets.housingZa },
];

async function main() {
  const filter = process.argv[2];
  const run = filter ? cases.filter((c) => c.id === filter) : cases;
  if (!run.length) {
    console.log(`No market matches "${filter}". Choose: ${cases.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }
  for (const c of run) {
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
