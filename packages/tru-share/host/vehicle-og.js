// netlify/edge-functions/vehicle-og.js
//
// TEMPLATE — ships with the TruShare package. Copy into a dealer site at
// netlify/edge-functions/vehicle-og.js and edit the SITE CONFIG block below.
// Nothing else in this file is dealer-specific.
//
// WHY THIS FILE IS NOT OPTIONAL.
// Link-unfurl bots (WhatsApp, Facebook, iMessage, Slack, LinkedIn, Telegram)
// read ONLY the raw HTML meta tags — they never run the page's JavaScript.
// Without this, every TruShare button still works and every shared car
// unfurls as the generic site card, which is the whole value gone.
//
// This runs before /vehicle/ is served, reads the car data TruShare already
// put in the query string, and rewrites the <head>. No feed lookup: the share
// URL carries the car. Humans are unaffected — same HTML, page script still runs.
//
// Register it in netlify.toml:
//   [[edge_functions]]
//     path = "/vehicle"
//     function = "vehicle-og"
//   [[edge_functions]]
//     path = "/vehicle/*"
//     function = "vehicle-og"
//   (Two entries so both /vehicle and /vehicle/ are covered.)
//
// Edge functions ship via the Netlify CLI or a Git-connected deploy ONLY.
// Netlify Drop / drag-and-drop silently strips them.

/* ─────────── SITE CONFIG — the only lines you edit ─────────── */
const SITE      = "https://www.example.co.za";   // no trailing slash
const DEALER    = "Example Motors";              // as it should read in a share card
const AREA      = "Somewhere, Province";         // "Kariega, Eastern Cape"
const TAGLINE   = "Inspected stock, bank finance and trade-ins welcome.";
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

// Group digits with spaces (en-ZA style) without relying on Intl/ICU,
// which is not fully available in the edge runtime.
const groupNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default async function (request, context) {
  const q = new URL(request.url).searchParams;

  // Nothing to personalise → let Netlify serve the static page untouched.
  const hasCar = ["stock", "name", "price", "img"].some((k) => q.get(k));
  if (!hasCar) return;

  const response = await context.next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }
  let html = await response.text();

  // ---- Per-car values from the share URL ----
  const make = clean(q.get("make"));
  const name = clean(q.get("name"));
  const year = clean(q.get("year"));
  const variant = clean(q.get("variant"));
  const stock = clean(q.get("stock"));
  const trans = clean(q.get("trans"));
  const fuel = clean(q.get("fuel"));
  const body = clean(q.get("body"));

  const priceNum = parseInt(String(q.get("price") || "").replace(/\D/g, ""), 10) || 0;
  const priceFmt = priceNum ? "R " + groupNum(priceNum) : "";

  const kmDigits = String(q.get("km") || "").replace(/\D/g, "");
  const kmFmt = kmDigits ? groupNum(parseInt(kmDigits, 10)) + " km" : "";

  // Drop the make if the name already leads with it.
  const parts =
    make && name && name.toLowerCase().startsWith(make.toLowerCase())
      ? [year, name]
      : [year, make, name];
  const title = clean(parts.filter(Boolean).join(" ")) || "Quality Pre-Owned Vehicle";

  const rawImg = q.get("img") || "";
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
    TAGLINE;

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

  // ---- Rewrite the existing head tags (matched to /vehicle/ markup) ----
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(ogTitle)} | ${esc(DEALER)}</title>`)
    .replace(/(<meta\s+name="description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:title"[^>]*\scontent=")[^"]*(")/i, `$1${esc(ogTitle)}$2`)
    .replace(/(<meta\s+property="og:description"[^>]*\scontent=")[^"]*(")/i, `$1${esc(desc)}$2`)
    .replace(/(<meta\s+property="og:image"[^>]*\scontent=")[^"]*(")/i, `$1${esc(img)}$2`);

  // ---- Add the tags the static page doesn't already carry ----
  // og:image:width/height are DECLARED, not measured. Facebook renders the
  // small card on a first share until it has fetched and sized the image
  // itself — which is the share that matters, because that is the one the
  // dealer is watching. Declaring 1200x630 makes it commit to the large card
  // immediately. Feed photos are 4:3 (1600x1200 measured), so the platform
  // centre-crops to fill; the car survives that, sky and tarmac do not.
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
    `<script type="application/ld+json">${ldJson}</script>`;
  html = html.replace(/<\/head>/i, inject + "</head>");

  // Body length changed and it's no longer whatever encoding the origin used;
  // drop those headers so Netlify re-computes them.
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(html, { status: response.status, headers });
}
