/* Inspect cinch __NEXT_DATA__: does the engine's generic walker find price+km,
 * and what do the listing objects actually look like? */
import fs from "fs";
import * as cheerio from "cheerio";

const html = fs.readFileSync(".tmp/uk-cinch.html", "utf-8");
const $ = cheerio.load(html);
const raw = $("#__NEXT_DATA__").contents().text() || $("#__NEXT_DATA__").text();
const root = JSON.parse(raw);

/* Collect every object with a numeric price + any of make/model/title/mileage */
const found = [];
const visit = (n, path) => {
  if (n == null) return;
  if (typeof n === "string") {
    if ((n[0] === "{" || n[0] === "[") && n.includes('"price"')) {
      try { visit(JSON.parse(n), path + "(embedded)"); } catch {}
    }
    return;
  }
  if (typeof n !== "object") return;
  if (Array.isArray(n)) { n.forEach((x, i) => visit(x, `${path}[${i}]`)); return; }
  const price = typeof n.price === "number" ? n.price : null;
  if (price != null && (n.make || n.model || n.title)) {
    found.push({
      path, price,
      make: n.make, model: n.model, title: String(n.title || "").slice(0, 60),
      mileage: n.mileage ?? n.km ?? n.odometer ?? null,
      year: n.year ?? null,
      otherKeys: Object.keys(n).filter((k) => /mile|km|odo|year|make|model|fuel|trans/i.test(k)),
    });
  }
  for (const k of Object.keys(n)) visit(n[k], `${path}.${k}`);
};
visit(root, "root");

console.log("listing-shaped objects:", found.length);
console.log(JSON.stringify(found.slice(0, 6), null, 2));

/* Also: what shape is mileage under? Dump one full listing's keys */
if (found.length) {
  const keysByFreq = {};
  for (const f of found) for (const k of f.otherKeys) keysByFreq[k] = (keysByFreq[k] || 0) + 1;
  console.log("\nkey frequency across listings:", keysByFreq);
}

/* And check JSON-LD on the page too */
let ld = 0;
$('script[type="application/ld+json"]').each((_, el) => { ld++; });
console.log("\nJSON-LD blocks:", ld);
