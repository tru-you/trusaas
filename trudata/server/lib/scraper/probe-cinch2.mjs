/* Probe 5: does cinch respect year query params? Compare listing year spread
 * across URL variants (plain HTTP — no wall). */
import fs from "fs";
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function listingsOf(html) {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").contents().text() || $("#__NEXT_DATA__").text();
  if (!raw) return [];
  let root; try { root = JSON.parse(raw); } catch { return []; }
  const out = [];
  const visit = (n) => {
    if (n == null) return;
    if (typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (typeof n.price === "number" && (n.make || n.model)) {
      out.push({ price: n.price, year: n.modelYear ?? n.vehicleYear ?? null, mileage: n.mileage ?? null });
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  // dedupe
  const seen = new Set(); 
  return out.filter((l) => { const k = `${l.price}|${l.mileage ?? ""}|${l.year ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const variants = [
  ["no-filter", "https://www.cinch.co.uk/used-cars/ford/fiesta/"],
  ["q-year", "https://www.cinch.co.uk/used-cars/ford/fiesta/?year=2021"],
  ["q-yearFrom", "https://www.cinch.co.uk/used-cars/ford/fiesta/?year-from=2021&year-to=2021"],
  ["q-age", "https://www.cinch.co.uk/used-cars/ford/fiesta/?maximum-age=5"],
];
for (const [label, u] of variants) {
  try {
    const res = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const html = await res.text();
    const ls = listingsOf(html);
    const years = [...new Set(ls.map((l) => l.year))].sort();
    console.log(`${label.padEnd(12)} status=${res.status} listings=${ls.length} years=[${years.join(",")}] final=${res.url}`);
  } catch (e) { console.log(`${label.padEnd(12)} ERR ${e?.cause?.code || e.message}`); }
}
