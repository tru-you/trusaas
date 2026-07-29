import React from 'react';
import { ArrowLeft, ArrowRight, Zap, ExternalLink, Loader2 } from 'lucide-react';
import { Vehicle } from '../types';
import { InspectionItem, ValuationState, computeTradeInValue } from '../types/inspection';
import { useAuth } from '../contexts/AuthContext';

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
  const [sources, setSources] = React.useState<{ name: string; count: number; avg: number | null }[]>([]);

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
        }),
      });
      const data = await res.json();
      if (data.sources) setSources(data.sources);
      if (data.carsUrl) setCarsUrl(data.carsUrl);
      if (data.fallbackRequired) {
        setValuation((v) => ({ ...v, fallbackRequired: true, searchUrl: data.searchUrl }));
        if (data.carsUrl) setCarsUrl(data.carsUrl);
      } else {
        setManualPrice(String(data.averageRetailPrice));
        recalc(data.averageRetailPrice, valuation.marginPercentage);
        setValuation((v) => ({ ...v, fallbackRequired: false }));
      }
    } catch {
      const atUrl = `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&year=${vehicle.year}`;
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
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
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
          className="w-full py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {fetching ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          {fetching ? 'Fetching…' : 'Fetch Market Value'}
        </button>

        {/* Source breakdown (shown after successful fetch) */}
        {!valuation.fallbackRequired && sources.length > 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 flex items-center gap-3">
            {sources.map((s) => (
              <div key={s.name} className="flex-1 text-center">
                <p className="text-[11px] text-neutral-500 font-semibold">{s.name}</p>
                <p className="text-[13px] font-bold text-neutral-300">
                  {s.count > 0 ? `${s.count} listings · ${fmt(s.avg!)}` : 'No results'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Fallback deep links */}
        {valuation.fallbackRequired && valuation.searchUrl && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/25 p-4">
            <p className="text-[13px] text-amber-200 mb-3">
              Auto-scrape unavailable — enter the market average manually after checking listings.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={valuation.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-semibold"
              >
                <ExternalLink size={14} /> AutoTrader
              </a>
              {carsUrl && (
                <a
                  href={carsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[13px] font-semibold"
                >
                  <ExternalLink size={14} /> Cars.co.za
                </a>
              )}
            </div>
          </div>
        )}

        {/* Average retail price input */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <label className="text-[12px] text-neutral-500 font-semibold block mb-2">AVERAGE MARKET RETAIL PRICE (R)</label>
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
          <span className="text-[13px] text-neutral-400 font-semibold">Total Recon Costs</span>
          <span className={`text-[16px] font-bold ${totalRecon > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            - {fmt(totalRecon)}
          </span>
        </div>

        {/* Margin (dealer only) */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] text-neutral-500 font-semibold">DEALER MARGIN %</label>
            <span className="text-[11px] text-neutral-600">(hidden on customer export)</span>
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
          <p className="text-[12px] text-cyan-400 font-semibold tracking-[0.1em] mb-1">FINAL TRADE-IN OFFER</p>
          <p className="text-[28px] font-black text-cyan-300">
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

      {/* Bottom nav */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95">
        <button
          type="button"
          disabled={valuation.averageRetailPrice === null || valuation.averageRetailPrice <= 0}
          onClick={() => onComplete(valuation)}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          Continue to Summary <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
