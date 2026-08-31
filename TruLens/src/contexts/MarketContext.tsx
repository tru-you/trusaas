/**
 * MarketContext — the client's instance-market signal.
 *
 * The server's MARKET env (default 'za') decides which market this instance
 * serves; it rides GET /api/dealership/settings. Every display surface that
 * shows the dealer's OWN prices (asking prices, offers, recon — as opposed to
 * valuation responses, which carry their own currency) reads the market here.
 *
 * Fail-safe: any fetch hiccup keeps the ZA default, so SA instances behave
 * exactly as before this existed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { MarketDisplay, marketById } from '../components/market';

const MarketContext = createContext<MarketDisplay>(marketById('za'));

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [market, setMarket] = useState<MarketDisplay>(marketById('za'));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch('/api/dealership/settings', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.market) setMarket(marketById(data.market));
      } catch {
        /* keep the ZA default — market is display-only, never blocking */
      }
    })();
    return () => { alive = false; };
  }, [user]);

  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
};

/** The instance market (ZA when unknown). */
export function useMarket(): MarketDisplay {
  return useContext(MarketContext);
}

/** Format the dealer's own money (asking price, offers, recon) in the
 *  instance market's currency + grouping. */
export function useMoney() {
  const market = useMarket();
  return (n: number | null | undefined) =>
    n == null || !Number.isFinite(Number(n))
      ? '—'
      : `${market.currency}${market.currency === 'R' ? ' ' : ''}${Math.round(Number(n)).toLocaleString(market.locale)}`;
}
