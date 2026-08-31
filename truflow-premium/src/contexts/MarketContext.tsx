/**
 * MarketContext — the client's instance-market signal (TruFlow Premium).
 *
 * The server's MARKET env (default 'za') decides which market this instance
 * serves; it rides GET /api/dealership/settings (same endpoint name as
 * Lens/Inspect). Every display surface that shows the dealer's OWN prices
 * reads the market here; valuation responses carry their own currency.
 *
 * Premium's auth is token-based (authFetch), not a user context — this is the
 * adapted twin of the Lens/Inspect MarketContext.
 *
 * Fail-safe: any fetch hiccup keeps the ZA default, so SA instances behave
 * exactly as before this existed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MarketDisplay, marketById } from '../components/market';
import { authFetch } from '../lib/session';

const MarketContext = createContext<MarketDisplay>(marketById('za'));

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [market, setMarket] = useState<MarketDisplay>(marketById('za'));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authFetch('/api/dealership/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.market) setMarket(marketById(data.market));
      } catch {
        /* keep the ZA default — market is display-only, never blocking */
      }
    })();
    return () => { alive = false; };
  }, []);

  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
};

/** The instance market (ZA when unknown). */
export function useMarket(): MarketDisplay {
  return useContext(MarketContext);
}

/** Format the dealer's own money (asking price, offers, invoices) in the
 *  instance market's currency + grouping. */
export function useMoney() {
  const market = useMarket();
  return (n: number | null | undefined) =>
    n == null || !Number.isFinite(Number(n))
      ? '—'
      : `${market.currency}${market.currency === 'R' ? ' ' : ''}${Math.round(Number(n)).toLocaleString(market.locale)}`;
}
