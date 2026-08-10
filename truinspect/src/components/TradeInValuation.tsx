import React from 'react';
import { ArrowLeft, ArrowRight, Zap, ExternalLink, Loader2, Shield } from 'lucide-react';
import { Vehicle } from '../types';
import { InspectionItem, ValuationState, computeTradeInValue } from '../types/inspection';
import { useAuth } from '../contexts/AuthContext';
import { kredoValuation, kredoStatus, type CarValueResult } from '../lib/kredo';
import { urlMake } from '../lib/makeAliases';

interface TradeInValuationProps {
  vehicle: Vehicle;
  items: InspectionItem[];
  onBack: () => void;
  onComplete: (valuation: ValuationState) => void;
}

export default function TradeInValuation({ vehicle, items, onBack, onComplete }: TradeInValuationProps) {
  const { user } = useAuth();
  const totalRecon = items.reduce((s, i) => s + i.estimatedRepairCost, 0);

  const [valuation, setValuation] = React.useState<ValuationState>(() => {
    const saved = vehicle.tradeInData?.valuation;
    if (saved) return { ...saved, totalReconCost: totalRecon };
    return {
      averageRetailPrice: null,
      totalReconCost: totalRecon,
      marginPercentage: Number(localStorage.getItem('trulens_margin_pct')) || 15,
      finalTradeInValue: 0,
      fallbackRequired: false,
    };
  });

  const [fetching, setFetching] = React.useState(false);
  const [manualPrice, setManualPrice] = React.useState<string>(
    valuation.averageRetailPrice !== null ? String(valuation.averageRetailPrice) : ''
  );
  const [carsUrl, setCarsUrl] = React.useState<string | null>(null);

  const [kredoConnected, setKredoConnected] = React.useState(false);
  const [kredoValue, setKredoValue] = React.useState<CarValueResult | null>(null);
  const [kredoFetching, setKredoFetching] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const s = await kredoStatus(token);
        setKredoConnected(s.connected);
      } catch { /* not connected — fine */ }
    })();
  }, [user]);

  const handleKredoValuation = async () => {
    if (!user || !vehicle.vin) return;
    setKredoFetching(true);
    try {
      const token = await user.getIdToken();
      const result = await kredoValuation(token, vehicle.vin);
      if (result) setKredoValue(result);
    } catch { /* non-blocking */ }
    setKredoFetching(false);
  };

  const recalc = (price: number | null, margin: number) => {
    const final = computeTradeInValue(price, totalRecon, margin);
    setValuation((v) => ({
      ...v,
      averageRetailPrice: price,
      totalReconCost: totalRecon,
      marginPercentage: margin,
      finalTradeInValue: final,
    }));
  };

  const handleFetchValuation = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/valuation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          variant: vehicle.trim,
          vin: vehicle.vin,
        }),
      });
      const data = await res.json();
      if (data.carsUrl) setCarsUrl(data.carsUrl);
      if (data.averageRetailPrice != null) {
        setManualPrice(String(data.averageRetailPrice));
        recalc(data.averageRetailPrice, valuation.marginPercentage);
      }
      setValuation((v) => ({
        ...v,
        fallbackRequired: !!data.fallbackRequired,
        searchUrl: data.searchUrl,
      }));
    } catch {
      const atUrl = `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(vehicle.make))}&model=${encodeURIComponent(vehicle.model)}&year=${vehicle.year}`;
      setCarsUrl(`https://www.cars.co.za/usedcars/${encodeURIComponent(vehicle.make)}/${encodeURIComponent(vehicle.model)}/?Year=${vehicle.year}`);
      setValuation((v) => ({
        ...v,
        fallbackRequired: true,
        searchUrl: atUrl,
      }));
    } finally {
      setFetching(false);
    }
  };

  const handleManualPriceChange = (val: string) => {
    setManualPrice(val);
    const num = Number(val) || 0;
    recalc(num > 0 ? num : null, valuation.marginPercentage);
  };

  const handleMarginChange = (val: string) => {
    const margin = Math.max(0, Math.min(100, Number(val) || 0));
    recalc(valuation.averageRetailPrice, margin);
  };

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA')}`;

  return (
    <div className="relative flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass p-4 border-b border-cyan-500/20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[16px] font-bold tracking-tight">Market Valuation</h1>
            <p className="text-[13px] text-neutral-400">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Fetch button */}
        <button
          type="button"
          onClick={handleFetchValuation}
          disabled={fetching}
          className="btn-primary on-fill w-full min-h-[52px] flex items-center justify-center gap-2 text-[16px] disabled:opacity-60"
        >
          <Zap size={18} />
          Fetch Market Value
        </button>

        {/* Fallback deep links */}
        {valuation.fallbackRequired && valuation.searchUrl && (
          <div className="rounded-xl border border-[rgba(232,234,230,0.14)] bg-[rgba(232,234,230,0.055)] p-4">
            {valuation.averageRetailPrice != null ? (
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mb-3">
                Dealer stock was thin — this price blends dealer listings with online
                classifieds. Cross-check before finalising.
              </p>
            ) : (
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mb-3">
                Auto-scrape unavailable — enter the market average manually after checking listings.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <a
                href={valuation.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tru-btn-secondary inline-flex items-center gap-2 px-4 min-h-[44px] text-[13px]"
              >
                <ExternalLink size={14} /> AutoTrader
              </a>
              {carsUrl && (
                <a
                  href={carsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tru-btn-secondary inline-flex items-center gap-2 px-4 min-h-[44px] text-[13px]"
                >
                  <ExternalLink size={14} /> Cars.co.za
                </a>
              )}
            </div>
          </div>
        )}

        {/* Kredo CarValue — second data source, only when connected + vehicle has VIN */}
        {kredoConnected && vehicle.vin && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-amber-400" />
                <span className="text-[13px] font-bold text-amber-300">Kredo CarValue</span>
              </div>
              {!kredoValue && (
                <button
                  type="button"
                  onClick={handleKredoValuation}
                  disabled={kredoFetching}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/60 hover:bg-amber-600 text-[12px] font-bold text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {kredoFetching ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  {kredoFetching ? 'Fetching…' : 'Get Kredo Value'}
                </button>
              )}
            </div>
            {kredoValue && (
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[11px] text-neutral-500 font-semibold">Trade</p>
                  <p className="text-[14px] font-bold text-amber-300 font-mono">
                    {kredoValue.tradeValue !== null ? fmt(kredoValue.tradeValue) : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-neutral-500 font-semibold">Retail</p>
                  <p className="text-[14px] font-bold text-amber-300 font-mono">
                    {kredoValue.retailValue !== null ? fmt(kredoValue.retailValue) : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-neutral-500 font-semibold">Market</p>
                  <p className="text-[14px] font-bold text-amber-300 font-mono">
                    {kredoValue.marketValue !== null ? fmt(kredoValue.marketValue) : '—'}
                  </p>
                </div>
              </div>
            )}
            {kredoValue && (
              <p className="text-[11px] text-neutral-600">
                Checked {new Date(kredoValue.checkedAt).toLocaleDateString('en-ZA')} via Kredo
              </p>
            )}
            {!kredoValue && !kredoFetching && (
              <p className="text-[12px] text-neutral-500">
                VIN-based valuation from Kredo's SA dealer market data.
              </p>
            )}
          </div>
        )}

        {/* Average retail price input */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <label className="text-[12px] text-[rgba(232,234,230,0.55)] block mb-2">Average market retail price (R)</label>
          <input
            type="number"
            min={0}
            value={manualPrice}
            onChange={(e) => handleManualPriceChange(e.target.value)}
            placeholder="Enter market average…"
            className="w-full px-4 py-3 rounded-xl text-[16px] font-bold bg-neutral-950/80 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        {/* Recon cost (read-only summary) */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 flex items-center justify-between">
          <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Total recon costs</span>
          <span className={`text-[16px] font-medium font-mono ${totalRecon > 0 ? 'text-rose-400' : 'text-[rgba(232,234,230,0.55)]'}`}>
            - {fmt(totalRecon)}
          </span>
        </div>

        {/* Margin (dealer only) */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] text-[rgba(232,234,230,0.55)]">Dealer margin</label>
            <span className="text-[12px] text-neutral-600">(hidden on customer export)</span>
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={valuation.marginPercentage}
            onChange={(e) => handleMarginChange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-[16px] font-bold bg-neutral-950/80 border border-neutral-800 text-[#E8EAE6] focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        {/* Final calculation */}
        <div className="rounded-2xl border-2 border-cyan-500/40 bg-cyan-950/20 p-5">
          <p className="text-[13px] text-[#4FE3DC] mb-2">Final trade-in offer</p>
          <p className="text-[38px] font-semibold text-[#E8EAE6] tracking-[-0.022em]">
            {valuation.averageRetailPrice !== null && valuation.averageRetailPrice > 0
              ? fmt(valuation.finalTradeInValue)
              : '—'}
          </p>
          {valuation.averageRetailPrice !== null && valuation.averageRetailPrice > 0 && (
            <p className="text-[12px] text-neutral-500 mt-1">
              ({fmt(valuation.averageRetailPrice)} - {fmt(totalRecon)}) × {(100 - valuation.marginPercentage).toFixed(0)}%
            </p>
          )}
        </div>
      </div>

      {/* Loading overlay while the live market is being assessed */}
      {fetching && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-neutral-950/90 backdrop-blur-sm px-8">
          <Loader2 size={30} className="animate-spin text-cyan-400" />
          <p className="text-[15px] font-bold text-[#E8EAE6]">Assessing live market…</p>
          <p className="text-[12px] text-neutral-400 text-center">
            Scanning dealer stock and SA classifieds for your {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
      )}

      {/* Bottom nav */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95">
        <button
          type="button"
          disabled={valuation.averageRetailPrice === null || valuation.averageRetailPrice <= 0}
          onClick={() => onComplete(valuation)}
          className="tru-btn-secondary w-full min-h-[52px] text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
        >
          Continue to Summary <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
