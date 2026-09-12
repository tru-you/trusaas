// netlify/edge-functions/vehicle-og.js
//
// Dynamic Open Graph Social Preview for True Cars.
// Resolves vehicles from the live dealer feed using clean stock parameters (?stock=... or /vehicle/:stock)
// or fallback query parameters, rewrites <head> meta tags, and injects preloaded car data.

/* ─────────── SITE CONFIG — the only lines you edit ─────────── */
const SITE      = "https://www.true-cars.co.za";  // no trailing slash
const DEALER    = "True Cars";                    // as it should read in a share card
const AREA      = "Port Elizabeth, Eastern Cape";
const TAGLINE   = "Inspected stock, instant finance figures and trade-ins welcome.";
const OG_CARD   = "/og-card.jpg";                // fallback image, site-relative
/* ──────────────────────────────────────────────────────────── */

const FALLBACK_IMG = SITE + OG_CARD;

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// Group digits with spaces (en-ZA style)
const groupNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// In-memory feed cache in the Deno edge isolate (60s TTL)
let cachedFeed = null;
let cacheExpiry = 0;

async function getStockFeed() {
  const now = Date.now();
  if (cachedFeed && now < cacheExpiry) return cachedFeed;

  const endpoints = [
    "https://premium.trudealers.com/api/public/stock?dealer=true-cars",
    "https://premium.tru-saas.com/api/public/stock?dealer=true-cars",
    "https://trusaas-premium.onrender.com/api/public/stock?dealer=true-cars"
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

  if (!name && !make && !priceNum && !stock) {
    return;
  }

  const response = await context.next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }
  let html = await response.text();

  const priceFmt = priceNum ? "R " + groupNum(priceNum) : "";
  const kmFmt = kmDigits ? groupNum(parseInt(kmDigits, 10)) + " km" : "";

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
    `${title} for sale at ${DEALER}, ${AREA}` +
    (priceFmt ? ` — ${priceFmt}` : "") +
    (kmFmt ? `, ${kmFmt}` : "") +
    (trans ? `, ${trans}` : "") +
    (fuel ? `, ${fuel}` : "") +
    (TAGLINE ? `. ${TAGLINE}` : "");

  // ---- schema.org Car + Offer ----
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
            unitCode: "KMT",
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "ZAR",
      ...(priceNum ? { price: priceNum } : {}),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: {
        "@type": "AutoDealer",
        name: DEALER,
        areaServed: AREA,
      },
    },
  };
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

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

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(ogTitle)} | ${esc(DEALER)}</title>`)
    .replace(/(<meta\s+name="description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:title"[^>]*\scontent=")[^"]*(")/i, `$1${esc(ogTitle)}$2`)
    .replace(/(<meta\s+property="og:description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:image"[^>]*\scontent=")[^"]*(")/i, `$1${esc(img)}$2`);

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
