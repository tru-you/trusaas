import { MarketConfig } from "../engine";

const NUM_RE = /\b\d{1,3}(?:[ ,]\d{3})*(?:\.\d+)?\b/;

/** Property matcher: title names a place (contains a number + a property word)
 *  and, when a year is given, those are the sale/rent not a model year — so we
 *  skip the year band and simply require the query terms to appear. */
function propertyTitleMatch(title: string, make: string, model: string, _year: string): boolean {
  const t = String(title || "").toLowerCase();
  // query terms are, for housing, treated as location / property-kind tokens.
  const q = [make, model].filter(Boolean).map((s) => String(s).toLowerCase().trim());
  if (q.length && !q.every((term) => t.includes(term))) return false;
  // a property listing must be anchored to an address-ish string (a number or
  // a property word) — prevents a random number on a page from claiming a hit.
  return /\b\d{1,4}\b/.test(t) || /(apartment|flat|house|villa|townhouse|unit|sectional|plot|stand)/.test(t);
}

/** Housing — South Africa residential: Property24 + Private Property, ZAR.
 *  Location + property kind are passed as make/model by the caller. */
export const housingZa: MarketConfig = {
  id: "housing-za",
  currency: "R",
  country: "za",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "property for sale",
  minPrice: 300_000,
  maxPrice: 200_000_000,
  acceptLanguage: "en-ZA,en;q=0.9",
  titleMatch: propertyTitleMatch,
  classifieds: [
    {
      name: "Private Property",
      url: (make, model, year) =>
        `https://www.privateproperty.co.za/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}?from=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
    {
      name: "Property24",
      url: (make, model, year) =>
        `https://www.property24.com/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}/${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
  ],
  searchUrl: (make, model, year) =>
    `https://www.property24.com/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}/${year}`,
};
