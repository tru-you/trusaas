/* Probe 2: can the deployed production assets see UK listings?
 *  1. headless worker (trusaas-crm-scraper) against AutoTrader UK
 *  2. deployed trusaas-market-value service, market=uk (has real Render keys)
 *  3. Parkers URL-format candidates (plain HTTP — it 404'd, not bot-walled) */
const AT = "https://www.autotrader.co.uk/car-search?make=Ford&model=Fiesta&year-from=2021&year-to=2021";
const WORKER = "https://trusaas-crm-scraper.onrender.com";

function markers(html) {
  const h = String(html || "");
  return {
    len: h.length,
    nextData: h.includes("__NEXT_DATA__"),
    jsonLd: (h.match(/application\/ld\+json/g) || []).length,
    pound: (h.match(/£/g) || []).length,
    miles: (h.match(/\bmiles\b/gi) || []).length,
    captcha: /just a moment|captcha|cf-challenge|challenge-platform|access denied|verify you are human/i.test(h),
    title: (h.match(/<title[^>]*>([^<]{0,120})/i) || [])[1]?.trim(),
    sample: (h.match(/£\s?\d[\d,]{2,9}/g) || []).slice(0, 8),
  };
}

console.log("=== 1. worker → AutoTrader UK ===");
try {
  const res = await fetch(`${WORKER}/scrape`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: AT }), signal: AbortSignal.timeout(60000),
  });
  const body = await res.json().catch(() => null);
  console.log("status", res.status, "ok:", body?.ok, markers(body?.html || ""));
} catch (e) { console.log("worker ERROR:", e?.cause?.code || e.message); }

console.log("\n=== 2. deployed market-value service → uk ===");
for (const svc of ["https://trusaas-market-value.onrender.com"]) {
  try {
    const res = await fetch(`${svc}/api/valuation`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ make: "Ford", model: "Fiesta", year: "2021", mileage: 40000, market: "uk" }),
      signal: AbortSignal.timeout(90000),
    });
    const j = await res.json().catch(() => null);
    console.log(svc, "status", res.status, JSON.stringify(j, null, 2)?.slice(0, 1200));
  } catch (e) { console.log(svc, "ERROR:", e?.cause?.code || e.message); }
}

console.log("\n=== 3. Parkers URL candidates (plain) ===");
const candidates = [
  "https://www.parkers.co.uk/cars/for-sale/ford/fiesta/",
  "https://www.parkers.co.uk/cars-for-sale/ford/fiesta/",
  "https://www.parkers.co.uk/cars/ford/fiesta/for-sale/",
];
for (const u of candidates) {
  try {
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Accept-Language": "en-GB,en;q=0.9" },
      redirect: "follow", signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    console.log(res.status, u, "→", markers(html).title, "| £:", markers(html).pound, "len:", markers(html).len, "final:", res.url);
  } catch (e) { console.log("ERR", u, e?.cause?.code || e.message); }
}
