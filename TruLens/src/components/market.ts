/**
 * Market display layer — the client-side half of the market substrate.
 *
 * Server engines (packages/market-scraper) do ALL valuation maths in km and
 * return `currency` + `distanceUnit` on their results; this module turns
 * those into display strings. One source of truth, synced into every app's
 * src/components/ by sync:ui — edit ONLY here, app copies get clobbered.
 *
 * Client-safe by design: no node built-ins, no imports.
 */

export type MarketId = 'za' | 'uk' | 'us';
export type DistanceUnit = 'km' | 'mi';

export interface MarketDisplay {
  id: MarketId;
  /** Currency symbol used in display: R, £, $. */
  currency: string;
  /** BCP-47 locale for number/date grouping: en-ZA, en-GB, en-US. */
  locale: string;
  /** Odometer unit the market speaks in. */
  distanceUnit: DistanceUnit;
  label: string;
}

export const MARKETS: Record<MarketId, MarketDisplay> = {
  za: { id: 'za', currency: 'R', locale: 'en-ZA', distanceUnit: 'km', label: 'South Africa' },
  uk: { id: 'uk', currency: '£', locale: 'en-GB', distanceUnit: 'mi', label: 'United Kingdom' },
  us: { id: 'us', currency: '$', locale: 'en-US', distanceUnit: 'mi', label: 'United States' },
};

/** Resolve a market by id; unknown/absent ids fall back to ZA (the launch
 *  market), so SA instances without a MARKET env keep today's behaviour. */
export function marketById(id?: string | null): MarketDisplay {
  return MARKETS[String(id || 'za').toLowerCase() as MarketId] || MARKETS.za;
}

/** Resolve a market by currency symbol — valuation responses carry
 *  `currency` but not the market id. Unknown symbols fall back to ZA. */
export function marketByCurrency(sym?: string | null): MarketDisplay {
  const s = String(sym || '').trim();
  return Object.values(MARKETS).find((m) => m.currency === s) || MARKETS.za;
}

/** Money display: symbol + locale grouping. Prefer the currency the DATA
 *  carries (valuation responses include it) over the market default.
 *  "R" keeps the SA space separator; £/$ attach directly (£9,217 / $9,217). */
export function formatMoney(n: number | null | undefined, opts?: { currency?: string; locale?: string }): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const sym = opts?.currency || 'R';
  const locale = opts?.locale || 'en-ZA';
  const sep = sym === 'R' ? ' ' : '';
  return `${sym}${sep}${Math.round(Number(n)).toLocaleString(locale)}`;
}

export const KM_PER_MILE = 1.60934;

/** Display a distance the engine stores in km, converted to the market's
 *  unit. Pass the `distanceUnit` from the valuation response (or the
 *  market's default). */
export function formatDistance(km: number | null | undefined, displayUnit: DistanceUnit = 'km', locale = 'en-ZA'): string {
  if (km == null || !Number.isFinite(Number(km))) return '—';
  const v = displayUnit === 'mi' ? Number(km) / KM_PER_MILE : Number(km);
  return `${Math.round(v).toLocaleString(locale)} ${displayUnit}`;
}

/** Convert a distance the USER typed (in their local unit) to km — the
 *  storage/engine unit everywhere. */
export function toKm(value: number | null | undefined, unit: DistanceUnit = 'km'): number | undefined {
  if (value == null || !Number.isFinite(Number(value))) return undefined;
  return unit === 'mi' ? Math.round(Number(value) * KM_PER_MILE) : Math.round(Number(value));
}

/** One-liner for every "show a valuation number" call site: formats with the
 *  currency the server response carries (falls back to ZA when absent). */
export function formatMoneyFromData(n: number | null | undefined, data?: { currency?: string | null } | null): string {
  const m = marketByCurrency(data?.currency);
  return formatMoney(n, { currency: m.currency, locale: m.locale });
}
