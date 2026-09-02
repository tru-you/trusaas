import { MarketConfig } from "../engine";

/** Property matcher: a listing is a property if its title carries a property
 *  keyword and an address-ish number. Location is NOT required in the title —
 *  the search URL scopes the area, and SA listing titles name the suburb, not
 *  the city ('3 Bedroom House in Strandfontein'). */
function propertyTitleMatch(title: string, make: string, model: string, _year: string): boolean {
  const t = String(title || "").toLowerCase();
  
  // Verify that listing relates to properties
  const isProperty = /(apartment|flat|house|villa|townhouse|unit|sectional|cluster|plot|land|property|erf|holding|residence)/.test(t);
  if (!isProperty) return false;

  // When a specific property type is requested, verify
  const modelTerm = String(model || "").toLowerCase().trim();
  if (modelTerm && modelTerm !== "property" && modelTerm !== "all") {
    const typeMatch = modelTerm === "apartment" || modelTerm === "flat"
      ? /(apartment|flat)/.test(t)
      : modelTerm === "house" || modelTerm === "villa"
        ? /(house|villa|home|townhouse|cluster)/.test(t)
        : true;
    if (!typeMatch) return false;
  }

  // Anchor to a number (bedrooms or price/address indicator)
  return /\b\d{1,4}\b/.test(t);
}

/** Helper to slugify area name for portal URLs */
function areaSlug(area: string): string {
  return String(area || "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

/** Housing — South Africa residential, ZAR. */
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
      url: (make, _model, _year) => {
        const slug = areaSlug(make);
        return slug
          ? `https://www.privateproperty.co.za/for-sale?search=${encodeURIComponent(make)}`
          : `https://www.privateproperty.co.za/for-sale`;
      },
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
    {
      name: "Property24",
      url: (make, _model, _year) => {
        const slug = areaSlug(make);
        return slug
          ? `https://www.property24.com/for-sale/search?sp=${encodeURIComponent(make)}`
          : `https://www.property24.com/for-sale`;
      },
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
  ],
  searchUrl: (make, _model, _year) => `https://www.property24.com/for-sale/search?sp=${encodeURIComponent(make)}`,
};
