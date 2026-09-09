// netlify/edge-functions/vehicle-og.js
//
// Per-car social preview for Apex Auto Investments.
// Link-unfurl bots (WhatsApp, Facebook, iMessage, Slack, LinkedIn, Telegram)
// read raw HTML meta tags without executing JavaScript.
// This edge function runs before /vehicle/ is served, reads car query parameters,
// and rewrites <head> so shared links unfurl with title, price, and vehicle photo.

const SITE = "https://www.apexinvest.co.za";
const FALLBACK_IMG = SITE + "/og-card.jpg";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const groupNum = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

export default async function (request, context) {
  const q = new URL(request.url).searchParams;

  const hasCar = ["stock", "name", "price", "img"].some((k) => q.get(k));
  if (!hasCar) return;

  const response = await context.next();
  if (!(response.headers.get("content-type") || "").includes("text/html")) {
    return response;
  }
  let html = await response.text();

  const make = clean(q.get("make"));
  const name = clean(q.get("name"));
  const year = clean(q.get("year"));
  const variant = clean(q.get("variant"));
  const stock = clean(q.get("stock"));
  const trans = clean(q.get("trans"));
  const fuel = clean(q.get("fuel"));
  const body = clean(q.get("body"));

  const CUR = { R: { iso: "ZAR", sym: "R ", sep: " " }, "£": { iso: "GBP", sym: "£", sep: "," }, $: { iso: "USD", sym: "$", sep: "," } }[clean(q.get("cur")) || "R"] || { iso: "ZAR", sym: "R ", sep: " " };
  const odu = clean(q.get("odu")) === "mi" ? "mi" : "km";
  const distSep = odu === "mi" ? "," : CUR.sep;

  const priceNum = parseInt(String(q.get("price") || "").replace(/\D/g, ""), 10) || 0;
  const priceFmt = priceNum ? CUR.sym + groupNum(priceNum, CUR.sep) : "";

  const kmDigits = String(q.get("km") || "").replace(/\D/g, "");
  const kmFmt = kmDigits ? groupNum(parseInt(kmDigits, 10), distSep) + " " + odu : "";

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
    `${title} for sale at Apex Auto Investments, Gqeberha (Port Elizabeth)` +
    (priceFmt ? ` — ${priceFmt}` : "") +
    (kmFmt ? `, ${kmFmt}` : "") +
    (trans ? `, ${trans}` : "") +
    (fuel ? `, ${fuel}` : "") +
    ". Quality pre-owned cars, bakkies & SUVs. Bank finance and trade-ins welcome.";

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
        name: "Apex Auto Investments",
        areaServed: "Gqeberha, Port Elizabeth, Eastern Cape",
      },
    },
  };
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(ogTitle)} | Apex Auto Investments</title>`)
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
    `<script type="application/ld+json">${ldJson}</script>`;
  html = html.replace(/<\/head>/i, inject + "</head>");

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(html, { status: response.status, headers });
}
