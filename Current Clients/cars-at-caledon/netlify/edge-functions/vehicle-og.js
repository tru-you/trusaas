// netlify/edge-functions/vehicle-og.js
//
// Per-car social preview for Cars on Caledon.
//
// Link-unfurl bots (WhatsApp, Facebook, iMessage, Slack, LinkedIn, Telegram)
// read ONLY the raw HTML meta tags — they never run the page's JavaScript.
// This edge function runs before /vehicle/ is served, reads the car data the
// "Share this car" button already put in the query string, and rewrites the
// <head> so a shared link unfurls with the real car: title, price, photo.
//
// Humans are unaffected — same HTML, and the page's own script still runs.
// No feed lookup: the share URL already carries the car's data.

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

  // Market declarations (absent on SA links → the launch defaults). Keep the
  // param names in step with tru-share.js and TruFlow Mobile's shareVehicle.
  const CUR = { R: { iso: "ZAR", sym: "R ", sep: " " }, "£": { iso: "GBP", sym: "£", sep: "," }, $: { iso: "USD", sym: "$", sep: "," } }[clean(q.get("cur")) || "R"] || { iso: "ZAR", sym: "R ", sep: " " };
  const odu = clean(q.get("odu")) === "mi" ? "mi" : "km";
  const distSep = odu === "mi" ? "," : CUR.sep;

  const priceNum = parseInt(String(q.get("price") || "").replace(/\D/g, ""), 10) || 0;
  const priceFmt = priceNum ? CUR.sym + groupNum(priceNum, CUR.sep) : "";

  const kmDigits = String(q.get("km") || "").replace(/\D/g, "");
  const kmFmt = kmDigits ? groupNum(parseInt(kmDigits, 10), distSep) + " " + odu : "";

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
    `${title} for sale at Cars on Caledon, Kariega` +
    (priceFmt ? ` — ${priceFmt}` : "") +
    (kmFmt ? `, ${kmFmt}` : "") +
    (trans ? `, ${trans}` : "") +
    (fuel ? `, ${fuel}` : "") +
    ". Inspected stock, bank finance and trade-ins welcome.";

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

  // ---- Rewrite the existing head tags (matched to /vehicle/ markup) ----
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(ogTitle)} | Cars on Caledon</title>`)
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
