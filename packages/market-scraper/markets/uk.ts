import { MarketConfig } from "../engine";

/** United Kingdom — AutoTrader.co.uk + Parkers, GBP, gb. */
export const uk: MarketConfig = {
  id: "uk",
  currency: "£",
  country: "gb",
  googleDomain: "google.co.uk",
  googleGl: "gl=uk&hl=en",
  googleQuerySuffix: "United Kingdom",
  minPrice: 1_000,
  maxPrice: 3_000_000,
  acceptLanguage: "en-GB,en;q=0.9",
  classifieds: [
    {
      name: "AutoTrader UK",
      url: (make, model, year) =>
        `https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${year}&year-to=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
    {
      name: "Parkers",
      url: (make, model, year) =>
        `https://www.parkers.co.uk/cars-for-sale/${encodeURIComponent(make)}/${encodeURIComponent(model)}/?year=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="listing-price"]'.split(","),
    },
  ],
  searchUrl: (make, model, year) =>
    `https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${year}&year-to=${year}`,
};
