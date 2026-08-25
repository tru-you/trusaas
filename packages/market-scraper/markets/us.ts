import { MarketConfig } from "../engine";

/** United States — Autotrader.com + Cars.com, USD, us. TrueCar/Carfax not
 *  wired here; the selectors are the same e-price pattern the SA sites use and
 *  should be retuned against live markup before trusting them. */
export const us: MarketConfig = {
  id: "us",
  currency: "$",
  country: "us",
  googleDomain: "google.com",
  googleGl: "gl=us&hl=en",
  googleQuerySuffix: "USA",
  minPrice: 1_000,
  maxPrice: 3_000_000,
  acceptLanguage: "en-US,en;q=0.9",
  classifieds: [
    {
      name: "Autotrader.com",
      url: (make, model, year) =>
        `https://www.autotrader.com/cars-for-sale/${encodeURIComponent(make)}-${encodeURIComponent(model)}-${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(","),
    },
    {
      name: "Cars.com",
      url: (make, model, year) =>
        `https://www.cars.com/shopping/results/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year_purchase=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [data-testid="price"]'.split(","),
    },
  ],
  searchUrl: (make, model, year) =>
    `https://www.autotrader.com/cars-for-sale/${encodeURIComponent(make)}-${encodeURIComponent(model)}-${year}`,
};
