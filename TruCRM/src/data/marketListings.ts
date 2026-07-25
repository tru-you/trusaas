/* ============================================================================
   Market listings — competitor stock, for pricing your own units against.

   *** SAMPLE FEED ***  These are illustrative listings, not a live scrape. The
   MATCHING and STATS built on top of them are real; the numbers are a plausible
   snapshot so the pricing engine can be seen working. Replace this array with a
   scheduled AutoTrader / Cars.co.za unit-level feed and nothing downstream
   changes — the comp-matching, median, position and days-to-sell all still hold.
   ========================================================================== */

export type ListingSource = 'AutoTrader' | 'Cars.co.za' | 'Gumtree' | 'Facebook';

export interface MarketListing {
  id: string;
  year: number;
  make: string;
  model: string;
  variant: string;
  mileage: number;      // km
  price: number;        // R
  dealer: string;
  town: string;         // Eastern Cape / nearby
  source: ListingSource;
  /** Days the listing has been live — the single best signal of how a unit prices. */
  daysListed: number;
}

export const MARKET_LISTINGS: MarketListing[] = [
  // ── Toyota Hilux 2.8 GD-6 (double/single cab 4x4) ──────────────────────────
  { id: 'm-hl1', year: 2022, make: 'Toyota', model: 'Hilux', variant: '2.8 GD-6 Raider 4x4 AT', mileage: 58000, price: 611900, dealer: 'Halfway Toyota', town: 'Gqeberha', source: 'AutoTrader', daysListed: 41 },
  { id: 'm-hl2', year: 2022, make: 'Toyota', model: 'Hilux', variant: '2.8 GD-6 Legend 4x4 AT', mileage: 63400, price: 619900, dealer: 'Kariega Motors', town: 'Kariega', source: 'Cars.co.za', daysListed: 52 },
  { id: 'm-hl3', year: 2021, make: 'Toyota', model: 'Hilux', variant: '2.8 GD-6 Raider 4x4 AT', mileage: 71200, price: 589900, dealer: 'Algoa Prestige Motors', town: 'Gqeberha', source: 'AutoTrader', daysListed: 63 },
  { id: 'm-hl4', year: 2023, make: 'Toyota', model: 'Hilux', variant: '2.8 GD-6 Raider 4x4 AT', mileage: 39800, price: 664900, dealer: 'Garden Route Auto', town: 'George', source: 'Cars.co.za', daysListed: 28 },
  { id: 'm-hl5', year: 2022, make: 'Toyota', model: 'Hilux', variant: '2.8 GD-6 Raider 4x4 MT', mileage: 61000, price: 604900, dealer: 'Bay Ford & Pre-Owned', town: 'Gqeberha', source: 'Gumtree', daysListed: 47 },
  { id: 'm-hl6', year: 2022, make: 'Toyota', model: 'Hilux', variant: '2.4 GD-6 SRX 4x4 AT', mileage: 55000, price: 549900, dealer: 'Private seller', town: 'Jeffreys Bay', source: 'Facebook', daysListed: 19 },

  // ── VW Polo 1.0 TSI ────────────────────────────────────────────────────────
  { id: 'm-po1', year: 2023, make: 'Volkswagen', model: 'Polo', variant: '1.0 TSI Life', mileage: 31000, price: 324900, dealer: 'Barons VW', town: 'Gqeberha', source: 'AutoTrader', daysListed: 34 },
  { id: 'm-po2', year: 2023, make: 'Volkswagen', model: 'Polo', variant: '1.0 TSI Life DSG', mileage: 24500, price: 339900, dealer: 'Kariega Motors', town: 'Kariega', source: 'Cars.co.za', daysListed: 22 },
  { id: 'm-po3', year: 2022, make: 'Volkswagen', model: 'Polo', variant: '1.0 TSI Life', mileage: 42000, price: 309900, dealer: 'Garden Route Auto', town: 'George', source: 'AutoTrader', daysListed: 58 },
  { id: 'm-po4', year: 2023, make: 'Volkswagen', model: 'Polo', variant: '1.0 TSI Comfortline', mileage: 28900, price: 334900, dealer: 'Algoa Prestige Motors', town: 'Gqeberha', source: 'Cars.co.za', daysListed: 40 },
  { id: 'm-po5', year: 2024, make: 'Volkswagen', model: 'Polo', variant: '1.0 TSI Life', mileage: 12000, price: 354900, dealer: 'Barons VW', town: 'Gqeberha', source: 'AutoTrader', daysListed: 15 },

  // ── Isuzu D-Max 3.0 ────────────────────────────────────────────────────────
  { id: 'm-dm1', year: 2021, make: 'Isuzu', model: 'D-Max', variant: '3.0 TD LS 4x4 AT', mileage: 82000, price: 549900, dealer: 'Isuzu Gqeberha', town: 'Gqeberha', source: 'AutoTrader', daysListed: 55 },
  { id: 'm-dm2', year: 2021, make: 'Isuzu', model: 'D-Max', variant: '3.0 TD LS 4x4 AT', mileage: 91500, price: 534900, dealer: '4x4 & Bakkie Centre EC', town: 'Kariega', source: 'Cars.co.za', daysListed: 70 },
  { id: 'm-dm3', year: 2022, make: 'Isuzu', model: 'D-Max', variant: '3.0 TD LS 4x4 AT', mileage: 61000, price: 579900, dealer: 'Garden Route Auto', town: 'George', source: 'AutoTrader', daysListed: 38 },
  { id: 'm-dm4', year: 2020, make: 'Isuzu', model: 'D-Max', variant: '3.0 TD LX 4x4 MT', mileage: 118000, price: 489900, dealer: 'Private seller', town: 'Despatch', source: 'Facebook', daysListed: 44 },

  // ── Suzuki Swift 1.2 ───────────────────────────────────────────────────────
  { id: 'm-sw1', year: 2024, make: 'Suzuki', model: 'Swift', variant: '1.2 GL+ AMT', mileage: 9800, price: 244900, dealer: 'Suzuki Walmer', town: 'Gqeberha', source: 'AutoTrader', daysListed: 21 },
  { id: 'm-sw2', year: 2023, make: 'Suzuki', model: 'Swift', variant: '1.2 GL+ AMT', mileage: 22000, price: 229900, dealer: 'Kariega Motors', town: 'Kariega', source: 'Cars.co.za', daysListed: 33 },
  { id: 'm-sw3', year: 2024, make: 'Suzuki', model: 'Swift', variant: '1.2 GL MT', mileage: 14500, price: 234900, dealer: 'Garden Route Auto', town: 'George', source: 'AutoTrader', daysListed: 26 },
  { id: 'm-sw4', year: 2024, make: 'Suzuki', model: 'Swift', variant: '1.2 GLX AMT', mileage: 8000, price: 264900, dealer: 'Suzuki Walmer', town: 'Gqeberha', source: 'Cars.co.za', daysListed: 12 },

  // ── Haval Jolion 1.5T ──────────────────────────────────────────────────────
  { id: 'm-jo1', year: 2023, make: 'Haval', model: 'Jolion', variant: '1.5T Luxury DCT', mileage: 34500, price: 354900, dealer: 'Haval Gqeberha', town: 'Gqeberha', source: 'AutoTrader', daysListed: 48 },
  { id: 'm-jo2', year: 2023, make: 'Haval', model: 'Jolion', variant: '1.5T Luxury DCT', mileage: 41000, price: 344900, dealer: 'Nelson Mandela Bay Auto Superstore', town: 'Gqeberha', source: 'Cars.co.za', daysListed: 61 },
  { id: 'm-jo3', year: 2024, make: 'Haval', model: 'Jolion', variant: '1.5T Luxury DCT', mileage: 18000, price: 379900, dealer: 'Haval Gqeberha', town: 'Gqeberha', source: 'AutoTrader', daysListed: 24 },
  { id: 'm-jo4', year: 2023, make: 'Haval', model: 'Jolion', variant: '1.5T Premium DCT', mileage: 37000, price: 334900, dealer: 'Garden Route Auto', town: 'George', source: 'Gumtree', daysListed: 55 },

  // ── Ford Ranger 2.2 ────────────────────────────────────────────────────────
  { id: 'm-rg1', year: 2019, make: 'Ford', model: 'Ranger', variant: '2.2 TDCi XL', mileage: 138000, price: 369900, dealer: 'Bay Ford & Pre-Owned', town: 'Gqeberha', source: 'AutoTrader', daysListed: 66 },
  { id: 'm-rg2', year: 2019, make: 'Ford', model: 'Ranger', variant: '2.2 TDCi XLS', mileage: 129000, price: 389900, dealer: 'Kariega Motors', town: 'Kariega', source: 'Cars.co.za', daysListed: 51 },
  { id: 'm-rg3', year: 2020, make: 'Ford', model: 'Ranger', variant: '2.2 TDCi XL', mileage: 112000, price: 399900, dealer: '4x4 & Bakkie Centre EC', town: 'Kariega', source: 'AutoTrader', daysListed: 43 },
  { id: 'm-rg4', year: 2018, make: 'Ford', model: 'Ranger', variant: '2.2 TDCi XL', mileage: 156000, price: 339900, dealer: 'Private seller', town: 'Uitenhage', source: 'Facebook', daysListed: 72 },
];
