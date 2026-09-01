/**
 * MarketContext — the client's instance-market signal.
 *
 * The server's MARKET env (default 'za') decides which market this instance
 * serves; it rides GET /api/dealership/settings. Every display surface that
 * shows the dealer's OWN prices reads the market here.
 *
 * The same fetch also carries the UK reg-lookup availability flags — the
 * plate box in the add-vehicle flows renders only when regLookup is true.
 *
 * Fail-safe: any fetch hiccup keeps the ZA default, so SA instances behave
 * exactly as before this existed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { MarketDisplay, marketById } from '../components/market';

export interface RegLookupInfo {
  available: boolean;
  provider: string;
  historyChecks: boolean;
}

interface MarketContextValue {
  market: MarketDisplay;
  regLookup: RegLookupInfo;
}

const MarketContext = createContext<MarketContextValue>({
  market: marketById('za'),
  regLookup: { available: false, provider: '', historyChecks: false },
});

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [value, setValue] = useState<MarketContextValue>({
    market: marketById('za'),
    regLookup: { available: false, provider: '', historyChecks: false },
  });

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
        if (!alive) return;
        setValue({
          market: data?.market ? marketById(data.market) : marketById('za'),
          regLookup: {
            available: !!data?.regLookup,
            provider: String(data?.regLookupProvider || ''),
            historyChecks: !!data?.historyChecks,
          },
        });
      } catch {
        /* keep the ZA default — market is display-only, never blocking */
      }
    })();
    return () => { alive = false; };
  }, [user]);

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

/** The instance market (ZA when unknown). */
export function useMarket(): MarketDisplay {
  return useContext(MarketContext).market;
}

/** UK reg-lookup availability (false on SA instances / unconfigured). */
export function useRegLookup(): RegLookupInfo {
  return useContext(MarketContext).regLookup;
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
