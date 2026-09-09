// netlify/edge-functions/vehicle-og.js
//
// Per-car social preview for Cars on Caledon.
//
// Link-unfurl bots (WhatsApp, Facebook, iMessage, Slack, LinkedIn, Telegram)
// read ONLY the raw HTML meta tags — they never run the page's JavaScript.
// This edge function runs before /vehicle/ is served. It resolves the car
// from the dealer's live feed using the clean stock parameter (?stock=... or /vehicle/:stock)
// or fallback query parameters, rewrites the <head> tags for dynamic unfurling,
// and injects preloaded car data so the browser hydrates instantly.

const SITE = "https://www.carsoncaledon.co.za";
const FALLBACK_IMG = SITE + "/og-card.jpg";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// Group digits without relying on Intl/ICU, which is not fully available in
// the edge runtime. ZA (R) groups with spaces; £/$ markets with commas.
const groupNum = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

// In-memory feed cache in the Deno edge isolate (60s TTL)
let cachedFeed = null;
let cacheExpiry = 0;

async function getStockFeed() {
  const now = Date.now();
  if (cachedFeed && now < cacheExpiry) return cachedFeed;

  const endpoints = [
    "https://premium.tru-saas.com/api/public/stock?dealer=cars-on-caledon",
    "https://trusaas-premium.onrender.com/api/public/stock?dealer=cars-on-caledon"
  ];

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "Accept": "application/json" }
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.vehicles) ? data.vehicles : (Array.isArray(data) ? data : []);
        if (list.length > 0) {
          cachedFeed = list;
          cacheExpiry = now + 60000;
          return list;
        }
      }
    } catch (_) {}
  }
  return cachedFeed || [];
}

function findCarInFeed(feed, stockQuery) {
  if (!feed || !feed.length || !stockQuery) return null;
  const target = String(stockQuery).toLowerCase().replace(/[^a-z0-9]/g, "");
  return feed.find((v) => {
    const s1 = String(v.stockNumber || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const s2 = String(v.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return s1 === target || s2 === target;
  }) || null;
}

export default async function (request, context) {
  const url = new URL(request.url);
  const q = url.searchParams;

  // Extract stock from query param ?stock=... or path /vehicle/:stock
  let stock = clean(q.get("stock"));
  if (!stock) {
    const pathMatch = url.pathname.match(/^\/vehicle\/([^/?#]+)/i);
    if (pathMatch && !pathMatch[1].includes(".") && pathMatch[1].toLowerCase() !== "index") {
      stock = clean(decodeURIComponent(pathMatch[1]));
    }
  }

  // Check if we have any car identifier or query data
  const hasParamData = ["name", "price", "img"].some((k) => q.get(k));
  if (!stock && !hasParamData) {
    return; // Bare /vehicle/ request -> serve untouched
  }

  // Attempt feed lookup if stock is known
  let feedMatch = null;
  if (stock) {
    const feed = await getStockFeed();
    feedMatch = findCarInFeed(feed, stock);
  }

  // ---- Extract per-car values (Feed match takes priority, falling back to query params) ----
  let make = "";
  let name = "";
  let year = "";
  let variant = "";
  let trans = "";
  let fuel = "";
  let body = "";
  let rawImg = "";
  let priceNum = 0;
  let kmDigits = "";
  let fullCarObject = null;

  if (feedMatch) {
    make = clean(feedMatch.make);
    name = clean([feedMatch.model, feedMatch.trim].filter(Boolean).join(" ") || feedMatch.make || "Vehicle");
    year = clean(feedMatch.year);
    variant = clean(feedMatch.trim || feedMatch.variant);
    trans = clean(feedMatch.transmission);
    fuel = clean(feedMatch.fuelType || feedMatch.fuel);
    body = clean(feedMatch.bodyType || feedMatch.body);
    rawImg = feedMatch.heroImage || (Array.isArray(feedMatch.images) && feedMatch.images[0]) || "";
    priceNum = parseInt(String(feedMatch.price || "").replace(/\D/g, ""), 10) || 0;
    kmDigits = String(feedMatch.mileage || feedMatch.km || "").replace(/\D/g, "");
    fullCarObject = feedMatch;
  } else {
    make = clean(q.get("make"));
    name = clean(q.get("name"));
    year = clean(q.get("year"));
    variant = clean(q.get("variant"));
    trans = clean(q.get("trans"));
    fuel = clean(q.get("fuel"));
    body = clean(q.get("body"));
    rawImg = q.get("img") || "";
    priceNum = parseInt(String(q.get("price") || "").replace(/\D/g, ""), 10) || 0;
    kmDigits = String(q.get("km") || "").replace(/\D/g, "");
  }

  // If nothing identifiable was found, pass through
  if (!name && !make && !priceNum && !stock) {
    return;
  }

  const response = await context.next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }
  let html = await response.text();

  // Currency & Distance formatting
  const CUR = { R: { iso: "ZAR", sym: "R ", sep: " " }, "£": { iso: "GBP", sym: "£", sep: "," }, $: { iso: "USD", sym: "$", sep: "," } }[clean(q.get("cur")) || "R"] || { iso: "ZAR", sym: "R ", sep: " " };
  const odu = clean(q.get("odu")) === "mi" ? "mi" : "km";
  const distSep = odu === "mi" ? "," : CUR.sep;

  const priceFmt = priceNum ? CUR.sym + groupNum(priceNum, CUR.sep) : "";
  const kmFmt = kmDigits ? groupNum(parseInt(kmDigits, 10), distSep) + " " + odu : "";

  // Title formatting
  const parts =
    make && name && name.toLowerCase().startsWith(make.toLowerCase())
      ? [year, name]
      : [year, make, name];
  const title = clean(parts.filter(Boolean).join(" ")) || "Quality Pre-Owned Vehicle";

  const img = /^https?:/i.test(rawImg)
    ? rawImg
    : rawImg
      ? SITE + "/" + rawImg.replace(/^(\.\.\/)+/, "")
      : FALLBACK_IMG;

  const canonical = stock
    ? `${SITE}/vehicle/?stock=${encodeURIComponent(stock)}`
    : `${SITE}/vehicle/`;

  const ogTitle = priceFmt ? `${title} — ${priceFmt}` : title;
  const desc =
    `${title} for sale at Cars on Caledon, Kariega` +
    (priceFmt ? ` — ${priceFmt}` : "") +
    (kmFmt ? `, ${kmFmt}` : "") +
    (trans ? `, ${trans}` : "") +
    (fuel ? `, ${fuel}` : "") +
    ". Inspected stock, bank finance and trade-ins welcome.";

  // Schema.org Car + Offer
  const ld = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: title,
    url: canonical,
    image: img,
    ...(make ? { brand: { "@type": "Brand", name: make } } : {}),
    ...(variant ? { model: variant } : {}),
    ...(year ? { vehicleModelDate: year } : {}),
    ...(stock ? { sku: stock } : {}),
    ...(fuel ? { fuelType: fuel } : {}),
    ...(trans ? { vehicleTransmission: trans } : {}),
    ...(body ? { bodyType: body } : {}),
    ...(kmDigits
      ? {
          mileageFromOdometer: {
            "@type": "QuantitativeValue",
            value: parseInt(kmDigits, 10),
            unitCode: odu === "mi" ? "SMI" : "KMT",
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: CUR.iso,
      ...(priceNum ? { price: priceNum } : {}),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "AutoDealer",
        name: "Cars on Caledon",
        areaServed: "Kariega, Eastern Cape",
      },
    },
  };
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  // Prepared data payload for client hydration
  const clientPayload = fullCarObject || {
    stockNumber: stock,
    make,
    model: name,
    trim: variant,
    year,
    price: priceNum,
    mileage: kmDigits,
    transmission: trans,
    fuelType: fuel,
    bodyType: body,
    heroImage: img
  };
  const payloadJson = JSON.stringify(clientPayload).replace(/</g, "\\u003c");

  // Rewrite existing tags in /vehicle/index.html
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(ogTitle)} | Cars on Caledon</title>`)
    .replace(/(<meta\s+name="description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:title"[^>]*\scontent=")[^"]*(")/i, `$1${esc(ogTitle)}$2`)
    .replace(/(<meta\s+property="og:description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:image"[^>]*\scontent=")[^"]*(")/i, `$1${esc(img)}$2`);

  // Inject meta tags, canonical, JSON-LD, and preloaded payload
  const inject =
    `<meta property="og:url" content="${esc(canonical)}">` +
    `<meta property="og:image:width" content="1200">` +
    `<meta property="og:image:height" content="630">` +
    `<meta property="og:image:alt" content="${esc(title)}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${esc(ogTitle)}">` +
    `<meta name="twitter:description" content="${esc(desc)}">` +
    `<meta name="twitter:image" content="${esc(img)}">` +
    `<link rel="canonical" href="${esc(canonical)}">` +
    `<script type="application/ld+json">${ldJson}</script>` +
    `<script id="__PRELOADED_CAR__" type="application/json">${payloadJson}</script>`;

  html = html.replace(/<\/head>/i, inject + "</head>");

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(html, { status: response.status, headers });
}
