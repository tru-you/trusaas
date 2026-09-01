/* Throwaway probe: what do the UK classifieds actually return, plain vs Unlocker?
 * Usage: node .tmp/probe-uk.mjs  (env BRIGHTDATA_* loaded by caller) */
const URLS = [
  ["AutoTrader UK", "https://www.autotrader.co.uk/car-search?make=Ford&model=Fiesta&year-from=2021&year-to=2021"],
  ["Parkers", "https://www.parkers.co.uk/cars-for-sale/ford/fiesta/?year=2021"],
];
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

function markers(html) {
  const h = String(html || "");
  return {
    len: h.length,
    nextData: h.includes("__NEXT_DATA__"),
    jsonLd: (h.match(/application\/ld\+json/g) || []).length,
    poundSigns: (h.match(/£/g) || []).length,
    priceWords: (h.match(/price/gi) || []).length,
    miles: (h.match(/\bmiles\b/gi) || []).length,
    captcha: /captcha|cf-challenge|challenge-platform|are you a robot|access denied/i.test(h),
    title: (h.match(/<title[^>]*>([^<]{0,120})/i) || [])[1]?.trim(),
  };
}

const key = process.env.BRIGHTDATA_API_KEY || "";
const url = process.env.SCRAPER_SERVICE_URL || "https://api.brightdata.com/request";
const zone = process.env.BRIGHTDATA_UNLOCKER_ZONE || "unlocker";
console.log(`unlocker: ${key ? "key present" : "NO KEY"} zone=${zone} endpoint=${url}`);

for (const [name, target] of URLS) {
  console.log(`\n=== ${name} ===`);
  // 1. plain HTTP
  try {
    const res = await fetch(target, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    console.log(`plain   status=${res.status} final=${res.url}`, markers(body));
  } catch (e) {
    console.log(`plain   ERROR ${e?.cause?.code || e.message}`);
  }
  // 2. unlocker
  if (key) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ zone, url: target, format: "raw", country: "gb" }),
        signal: AbortSignal.timeout(30000),
      });
      const body = await res.text();
      const parsed = (() => { try { const j = JSON.parse(body); return j?.body ?? j?.html ?? j?.result; } catch { return null; } })();
      const html = typeof parsed === "string" ? parsed : body;
      console.log(`unlock  status=${res.status}`, markers(html));
      if (html.length < 400) console.log(`unlock body: ${html.slice(0, 400)}`);
    } catch (e) {
      console.log(`unlock  ERROR ${e?.cause?.code || e.message}`);
    }
  }
}
