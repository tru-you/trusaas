import { MarketConfig, urlMake } from "../engine";

const AUTO_SELECTORS = '[class^="e-price__"]';
const CARSSELECTORS = ".vehicle-price";

/** South Africa — the original market: AutoTrader + Cars.co.za, ZAR, za. */
export const sa: MarketConfig = {
  id: "za",
  currency: "R",
  country: "za",
  distanceUnit: "km",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "South Africa",
  minPrice: 10_000,
  maxPrice: 50_000_000,
  acceptLanguage: "en-ZA,en;q=0.9",
  classifieds: [
    {
      name: "AutoTrader",
      url: (make, model, year) =>
        `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&minYear=${year}&maxYear=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_AUTOTRADER_SELECTORS || AUTO_SELECTORS).split(","),
    },
    {
      name: "Cars.co.za",
      url: (make, model, year) =>
        `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_CARSCOZA_SELECTORS || CARSSELECTORS).split(","),
    },
  ],
  searchUrl: (make, model, year) =>
    `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&minYear=${year}&maxYear=${year}`,
  secondaryUrl: (make, model, year) =>
    `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
  secondarySourceName: "Cars.co.za",
};

