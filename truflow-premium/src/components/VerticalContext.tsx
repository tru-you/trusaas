/**
 * VerticalContext — the client's instance / dealership vertical signal.
 *
 * The server's VERTICAL env (default 'cars') or per-dealership settings
 * decide which vertical this instance / dealership operates under.
 * Rides GET /api/dealership/settings alongside market and regLookup.
 *
 * Display surfaces use `useVertical()` to adapt asset nouns, test drive vs demo
 * ride labels, odometer vs hours units, and inspection checklist profiles.
 *
 * Fail-safe: any fetch issue keeps the 'cars' default, so auto instances
 * behave exactly as before this existed.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { VerticalConfig, verticalById, VerticalId } from './vertical';

interface VerticalContextValue {
  vertical: VerticalConfig;
}

const VerticalContext = createContext<VerticalContextValue>({
  vertical: verticalById('cars'),
});

export const VerticalProvider: React.FC<{
  children: React.ReactNode;
  initialVertical?: VerticalId | string;
  fetchSettings?: boolean;
}> = ({ children, initialVertical, fetchSettings = true }) => {
  const [vertical, setVertical] = useState<VerticalConfig>(
    verticalById(initialVertical || 'cars')
  );

  useEffect(() => {
    if (!fetchSettings) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/dealership/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        if (data?.vertical) {
          setVertical(verticalById(data.vertical));
        } else if (data?.settings?.vertical) {
          setVertical(verticalById(data.settings.vertical));
        }
      } catch {
        /* Fail-safe: keep default 'cars' */
      }
    })();
    return () => { alive = false; };
  }, [fetchSettings]);

  return (
    <VerticalContext.Provider value={{ vertical }}>
      {children}
    </VerticalContext.Provider>
  );
};

export function useVertical(): VerticalConfig {
  return useContext(VerticalContext).vertical;
}
