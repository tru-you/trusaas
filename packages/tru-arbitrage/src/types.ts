export type ListingSource = 'facebook' | 'cars_co_za' | 'autotrader' | 'gumtree' | 'webuycars' | 'dealer_direct' | 'flow_stock';

export type DealCategory = 'underpriced_arbitrage' | 'stale_floorplan_distress' | 'price_drop_velocity' | 'overpriced_stale_stock';

export interface RawFbListing {
  id?: string;
  item_id?: string;
  source?: ListingSource;
  url: string;
  title: string;
  description?: string;
  price?: number | string;
  final_price?: number | string;
  initial_price?: number | string;
  currency?: string;
  location?: string;
  seller_id?: string;
  seller_name?: string;
  images?: string[] | string;
  date_posted?: string;
  scraped_at?: string;
  days_listed?: number;
  /* Typed fields from structured feeds (Flow's public stock feed). Absent for
   * scraped classifieds, where these are parsed from title/description. */
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
}

export interface NormalizedVehicle {
  rawId: string;
  source: ListingSource;
  url: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileageKm: number | null;
  askingPrice: number;
  location: string;
  sellerId?: string;
  sellerName?: string;
  images: string[];
  isDamagedOrSalvage: boolean;
  isWantedAd: boolean;
  confidence: number;
  normalizedBy: 'regex_fastpath' | 'gemini_flash' | 'native_scraper' | 'fallback';
}

export interface ValuationComp {
  price: number;
  km?: number;
  /** Model year of the listing — captured where the extractor can read it, so
   *  the ranked price-check table shows the year mix and the valuation can
   *  age-correct comps that fall a year either side of the subject. */
  year?: number;
  source?: string;
  /** Listing URL where the extractor could capture one — cheapest-in-country
   *  results deep-link so the dealer can go straight to the listing. */
  url?: string;
  /** True if this comp is a sister-model fallback within the same category & make (e.g. Golf / Polo Vivo for Polo) */
  isRelatedModel?: boolean;
  relatedModelName?: string;
}

export interface ValuationResult {
  averageRetailPrice: number | null;
  listingsFound: number;
  /** True when the free crawler found zero live comps and no numeric price was produced. Caller decides how to react (skip, fall back to TU, etc.). */
  fallbackRequired?: boolean;
  mileageAdjusted: boolean;
  sampleMedianKm: number | null;
  /** 0–1 confidence in the valuation (sample size + price-band tightness). Alerts below CONFIDENCE_FLOOR never fire. */
  confidence: number;
  sources: Array<{ name: string; count: number; avg: number | null }>;
}

export interface TrackedPricePoint {
  price: number;
  timestamp: string;
}

export interface TrackedInventoryVehicle {
  fingerprint: string;
  rawId: string;
  source: ListingSource;
  url: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileageKm: number | null;
  location: string;
  sellerId?: string;
  sellerName?: string;
  images: string[];
  
  // Days on Market & Pricing
  firstSeenAt: string;
  lastSeenAt: string;
  daysOnMarket: number;
  originalPrice: number;
  currentPrice: number;
  totalPriceDrop: number;
  priceHistory: TrackedPricePoint[];
  
  // Status & Scores
  urgencyScore: number; // 0 to 100
  status: 'active' | 'price_dropped' | 'stale_floorplan' | 'delisted';
}

export interface ArbitrageDeal {
  id: string;
  fingerprint: string;
  source: ListingSource;
  dealCategory: DealCategory;
  vehicle: NormalizedVehicle;
  askingPrice: number;
  marketRetailPrice: number;
  reconBuffer: number;
  projectedGrossMargin: number;
  projectedNetMargin: number;
  marginPercentage: number;
  sampleCompsCount: number;
  /** 0–1 valuation confidence at detection time (see ValuationResult). */
  confidence: number;
  daysOnMarket: number;
  urgencyScore: number;
  detectedAt: string;
  status: 'new' | 'alerted' | 'claimed' | 'archived';
  /** Seller-offer workflow (desktop management): generated offer text + a
   *  6-digit OTP the seller can verify when the dealer makes contact.
   *  OTP lives 15 minutes; regenerating replaces it. */
  offerText?: string;
  offerOtp?: string;
  offerOtpExpiresAt?: string;
  offeredAt?: string;
  /** TransUnion variant match — resolved from the local static data file */
  mmCode?: string;
  tuSpecs?: { cc: number; kw: number; fuelType: string; bodyType: string; axle: string; variant: string };
}

export interface DealerBuyBox {
  id: string;
  dealerName: string;
  contactNumber: string;
  webhookUrl?: string;
  sources?: ListingSource[]; // Empty = all
  provinces: string[];
  allowedMakes?: string[]; // Empty = all
  /** Scan targets — "Toyota" or "Toyota/Hilux" per entry. These drive the
   *  targeted ingestion lane (P7): without them the scan samples only the
   *  newest-page feed, so a make with hundreds on sale is missed entirely. */
  watchTargets?: string[];
  maxPrice: number;
  maxMileageKm: number;
  minNetMargin: number;
  includeStaleDistressDeals?: boolean;
  active: boolean;
}

export interface IngestionBatchResult {
  totalRaw: number;
  validNormalized: number;
  filteredOut: number;
  trackedUpdated: number;
  arbitrageDealsFound: number;
  staleDealsFound: number;
  overpricedStockFound: number;
  alertsDispatched: number;
  /** Per-stage drop funnel — a zero-deal scan must be diagnosable, not a
   *  dead black box. Every listing falls through exactly one of these.
   *  (P0 instrumentation.) */
  rawBySource: Record<string, number>;
  droppedNormalizer: number;
  droppedDamagedWanted: number;
  droppedMakeUnknown: number;
  droppedNoComps: number;
  droppedBelowConfidence: number;
  droppedBelowMargin: number;
  sourceHealth: Array<{ name: string; listings: number; tier: string; hostOk: boolean }>;
}
