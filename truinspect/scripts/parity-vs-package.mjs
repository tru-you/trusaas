/**
 * Parity rig — in-tree fork (truinspect/src/lib/scraper.ts) vs the shared
 * package (packages/market-scraper). Same env, same queries, diff the outputs.
 *
 * Run from truinspect/:  npx tsx scripts/parity-vs-package.mjs
 * (load truinspect/.env first for SCRAPER_SERVICE_URL etc. — NO Bright Data
 * locally: both engines take the identical worker/plain path.)
 */
import { fetchValuation as forkFetch } from "../src/lib/scraper.js";
import { fetchValuation as pkgFetch, markets } from "../../packages/market-scraper/index.js";

const CASES = [
  { make: "Volkswagen", model: "Golf", year: "2021", mileage: 40000 },
  { make: "Toyota", model: "Corolla", year: "2020", mileage: 60000 },
  { make: "Ford", model: "Fiesta", year: "2019", mileage: 80000 },
];

function normalise(r) {
  if (!r) return null;
  return {
    avg: r.averageRetailPrice ?? null,
    listings: r.listingsFound ?? 0,
    sources: (r.sources || []).map((s) => `${s.name}:${s.count}`).join(","),
    adjusted: !!r.mileageAdjusted,
  };
}

for (const c of CASES) {
  const label = `${c.make} ${c.model} ${c.year}`;
  console.log(`\n=== ${label} ===`);
  let f = null, p = null, fe = null, pe = null;
  try { f = normalise(await forkFetch(c.make, c.model, c.year, { mileage: c.mileage })); }
  catch (e) { fe = e?.message || String(e); }
  try { p = normalise(await pkgFetch(c.make, c.model, c.year, { mileage: c.mileage }, markets.za)); }
  catch (e) { pe = e?.message || String(e); }
  console.log("fork   :", fe ? `ERROR ${fe}` : JSON.stringify(f));
  console.log("package:", pe ? `ERROR ${pe}` : JSON.stringify(p));
  if (!fe && !pe && f && p) {
    const same = f.avg === p.avg && f.listings === p.listings && f.sources === p.sources && f.adjusted === p.adjusted;
    const avgClose = f.avg != null && p.avg != null && Math.abs(f.avg - p.avg) / f.avg < 0.02;
    console.log(same ? "IDENTICAL" : avgClose ? `≈ MATCH (avg within 2%: fork ${f.avg} vs pkg ${p.avg})` : `MISMATCH: fork ${JSON.stringify(f)} vs pkg ${JSON.stringify(p)}`);
  }
}
