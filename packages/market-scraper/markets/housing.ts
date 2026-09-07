import { MarketConfig } from "../engine";

/** Property matcher: a listing is a property if its title carries a property
 *  keyword and an address-ish number. Location is NOT required in the title —
 *  the search URL scopes the area, and SA listing titles name the suburb, not
 *  the city ('3 Bedroom House in Strandfontein'). */
function propertyTitleMatch(title: string, _make: string, model: string, _year: string): boolean {
  const t = String(title || "").toLowerCase();
  // When a specific property type is requested, prefer titles of that kind.
  const modelTerm = String(model || "").toLowerCase().trim();
  if (modelTerm && modelTerm !== "all") {
    const typeOk = /(apartment|flat|house|villa|townhouse|unit|sectional|cluster)/.test(t);
    const typeMatch = modelTerm === "apartment" || modelTerm === "flat"
      ? /(apartment|flat)/.test(t)
      : modelTerm === "house" || modelTerm === "villa"
        ? /(house|villa|home|townhouse|cluster)/.test(t)
        : true;
    if (!typeOk || !typeMatch) return false;
  } else if (!/(apartment|flat|house|villa|townhouse|unit|sectional|plot|land|property)/.test(t)) {
    return false;
  }
  // anchor to a number (street number / bedrooms) so a stray word can't claim a hit
  return /\b\d{1,4}\b/.test(t);
}

/** Housing — South Africa residential, ZAR. Both sites load at /for-sale; the
 *  request passes location (make) and property type (model) as hints. */
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
      url: (_make, _model, _year) => `https://www.privateproperty.co.za/for-sale`,
      fetchConfig: {},
      selectors: '.property-price, .price, [class*="price"], [class*="Price"]'.split(","),
    },
    {
      name: "Property24",
      url: (_make, _model, _year) => `https://www.property24.com/for-sale`,
      fetchConfig: {},
      selectors: '.p24_price, .p24_listingTilePrice, [class*="price"], [class*="Price"]'.split(","),
    },
  ],
  searchUrl: (_make, _model, _year) => `https://www.property24.com/for-sale`,
};
