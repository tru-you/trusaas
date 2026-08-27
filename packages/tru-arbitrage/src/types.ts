export type ListingSource = 'facebook' | 'cars_co_za' | 'autotrader' | 'gumtree' | 'webuycars' | 'dealer_direct';

export type DealCategory = 'underpriced_arbitrage' | 'stale_floorplan_distress' | 'price_drop_velocity';

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
  source?: string;
}

export interface ValuationResult {
  averageRetailPrice: number | null;
  listingsFound: number;
  mileageAdjusted: boolean;
  sampleMedianKm: number | null;
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
  daysOnMarket: number;
  urgencyScore: number;
  detectedAt: string;
  status: 'new' | 'alerted' | 'claimed' | 'archived';
}

export interface DealerBuyBox {
  id: string;
  dealerName: string;
  contactNumber: string;
  webhookUrl?: string;
  sources?: ListingSource[]; // Empty = all
  provinces: string[];
  allowedMakes?: string[]; // Empty = all
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
  alertsDispatched: number;
}
