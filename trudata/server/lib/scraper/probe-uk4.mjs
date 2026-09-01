/* Probe 4: two lanes.
 *  A) Pull AutoTrader UK's main bundle via the worker, grep for its data API.
 *  B) Probe server-rendered UK comp candidates (plain + worker), score each. */
import fs from "fs";
const WORKER = "https://trusaas-crm-scraper.onrender.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function markers(html) {
  const h = String(html || "");
  const prices = h.match(/£\s?\d[\d,]{3,9}/g) || [];
  return {
    len: h.length,
    nextData: h.includes("__NEXT_DATA__"),
    jsonLd: (h.match(/application\/ld\+json/g) || []).length,
    pricesFound: prices.length,
    sample: prices.slice(0, 6),
    miles: (h.match(/\b\d[\d,]{2,7}\s?(?:miles|mi)\b/gi) || []).slice(0, 4),
    captcha: /just a moment|captcha|verify you are human|access denied|are you a robot/i.test(h),
    title: (h.match(/<title[^>]*>([^<]{0,100})/i) || [])[1]?.trim(),
  };
}

async function viaWorker(url) {
  try {
    const res = await fetch(`${WORKER}/scrape`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }), signal: AbortSignal.timeout(60000),
    });
    const b = await res.json().catch(() => null);
    return b?.ok ? b.html : null;
  } catch { return null; }
}
async function plain(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    return { status: res.status, html: await res.text(), final: res.url };
  } catch (e) { return { status: 0, html: "", err: e?.cause?.code || e.message }; }
}

/* ── A. AutoTrader bundle grep ── */
console.log("=== A. AutoTrader main bundle ===");
const bundle = await viaWorker("https://www.autotrader.co.uk/search-results-app/bundles/main-C2PD0siA.js");
if (bundle) {
  fs.writeFileSync(".tmp/at-uk-main.js", bundle);
  const apiHits = [...new Set((bundle.match(/["'`](?:\/[a-zA-Z0-9-]+){1,4}(?:\?[^"'`]*)?["'`]/g) || [])
    .filter((s) => /api|search|griffin|results|adverts/i.test(s))
    .map((s) => s.slice(1, -1)))].slice(0, 25);
  const urlHits = [...new Set((bundle.match(/https?:\/\/[a-z0-9.-]*autotrader[^"'`\s\\]{0,80}/gi) || []))].slice(0, 15);
  console.log(JSON.stringify({ len: bundle.length, apiHits, urlHits }, null, 2));
} else console.log("bundle fetch failed");

/* ── B. server-rendered UK candidates ── */
console.log("\n=== B. UK comp candidates ===");
const candidates = [
  ["cinch", "https://www.cinch.co.uk/used-cars/ford/fiesta/"],
  ["ArnoldClark", "https://www.arnoldclark.com/used-cars/search/make/ford/model/fiesta"],
  ["CarShop", "https://www.carshop.co.uk/used-cars/ford/fiesta"],
  ["PistonHeads", "https://www.pistonheads.com/classifieds/cars/ford/fiesta/"],
  ["EvansHalshaw", "https://www.evanshalshaw.com/used-cars/ford/fiesta/"],
];
for (const [name, u] of candidates) {
  const p = await plain(u);
  const pm = markers(p.html);
  const good = pm.pricesFound > 0 || pm.nextData || pm.jsonLd > 0;
  console.log(`${good ? "✓" : "✗"} ${name} plain ${p.status} — ${pm.title || pm.err} | £:${pm.pricesFound} next:${pm.nextData} ld:${pm.jsonLd} len:${pm.len}`);
  if (!good) {
    const whtml = await viaWorker(u);
    const wm = markers(whtml || "");
    console.log(`   ${wm.pricesFound > 0 ? "✓" : "✗"} ${name} worker — £:${wm.pricesFound} next:${wm.nextData} ld:${wm.jsonLd} len:${wm.len} ${wm.captcha ? "CAPTCHA" : ""}`);
    if (wm.pricesFound > 0) { fs.writeFileSync(`.tmp/uk-${name}.html`, whtml); console.log(`   saved .tmp/uk-${name}.html`); }
  } else {
    fs.writeFileSync(`.tmp/uk-${name}.html`, p.html); console.log(`   saved .tmp/uk-${name}.html`);
  }
}
