import path from "path";
import { MarketConfig, urlMake } from "../engine";

/** United Kingdom — GBP, gb.
 *
 * Primary source: cinch.co.uk — one of the UK's largest used-car retailers.
 * Verified 2026-08-31: serves server-rendered Next.js over PLAIN HTTP (no
 * bot wall), listings in __NEXT_DATA__ at
 * props.pageProps.searchResults.response.vehicleListings[] with numeric
 * price, make, model, modelYear/vehicleYear and mileage IN MILES (the engine
 * normalises via distanceUnit). Year query params are ignored server-side, so
 * the engine's ±year-tolerance filter does the year work on parsed listings.
 *
 * AutoTrader.co.uk is parked: Cloudflare "Just a moment" on plain HTTP AND a
 * client-rendered Vite SPA (results arrive via XHR), so even our headless
 * worker only gets the shell. Revive it when Bright Data Unlocker credits
 * return (country=gb) or the worker gains SPA wait support.
 * Parkers is dropped: every used-car URL shape 404s (they exited listings). */

const slug = (s: string) => encodeURIComponent(String(s).toLowerCase().trim().replace(/\s+/g, "-"));

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
  distanceUnit: "mi",
  /* Market-scoped dealer layer: the default price-sources.json holds SA
   * dealers whose rand prices would poison a £ pool. UK gets its own file
   * (absent until we onboard UK dealer groups = empty layer, classifieds
   * only). */
  priceSourcesPath: path.join(process.cwd(), "data", "price-sources-uk.json"),
  classifieds: [
    {
      name: "cinch",
      url: (make, model) =>
        `https://www.cinch.co.uk/used-cars/${slug(urlMake(make))}/${slug(model)}/`,
      fetchConfig: {},
      /* Fallback only — cinch parses via __NEXT_DATA__. */
      selectors: '[data-testid*="price"], [class*="price"]'.split(","),
    },
  ],
  searchUrl: (make, model) =>
    `https://www.cinch.co.uk/used-cars/${slug(urlMake(make))}/${slug(model)}/`,
};
