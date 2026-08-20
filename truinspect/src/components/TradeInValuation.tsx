import React from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, TrendingDown, TrendingUp, Minus, Shield } from 'lucide-react';
import { Vehicle } from '../types';
import { InspectionItem, ValuationState, ValuationSnapshot, computeTradeInValue } from '../types/inspection';
import { useAuth } from '../contexts/AuthContext';
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

  const [history, setHistory] = React.useState<ValuationSnapshot[]>([]);

  // TransUnion official valuation
  const [tuVal, setTuVal] = React.useState<any>(null);
  const [tuValLoading, setTuValLoading] = React.useState(false);
  const handleTuValuation = async () => {
    if (!vehicle.mmCode || !user) return;
    setTuValLoading(true);
    setTuVal(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/imagin8/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mmCode: vehicle.mmCode, year: vehicle.year, mileage: vehicle.mileage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTuVal(data);
    } catch (err: any) {
      alert(err?.message || 'TU valuation failed');
    } finally {
      setTuValLoading(false);
    }
  };

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const hRes = await fetch(`/api/valuation/history/${vehicle.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (hRes.ok) {
          const hData = await hRes.json();
          if (Array.isArray(hData.history)) setHistory(hData.history);
        }
      } catch { /* not connected — fine */ }
    })();
  }, [user, vehicle.id]);

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
          vehicleId: vehicle.id,
        }),
      });
      const data = await res.json();
      if (data.carsUrl) setCarsUrl(data.carsUrl);
      if (data.averageRetailPrice != null) {
        setManualPrice(String(data.averageRetailPrice));
        recalc(data.averageRetailPrice, valuation.marginPercentage);
        setHistory((prev) => [...prev, {
          price: data.averageRetailPrice,
          listingsFound: data.listingsFound,
          sources: (data.sources || []).filter((s: any) => s.count > 0).map((s: any) => s.name),
          scrapedAt: new Date().toISOString(),
        }]);
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
        {/* Fetch buttons */}
        <button
          type="button"
          onClick={handleFetchValuation}
          disabled={fetching}
          className="btn-primary on-fill w-full min-h-[52px] flex items-center justify-center gap-2 text-[16px] cursor-pointer disabled:opacity-60"
        >
          {fetching ? 'Scanning…' : 'Fetch Live Market Value'}
        </button>

        <button
          type="button"
          onClick={handleTuValuation}
          disabled={tuValLoading || !vehicle.mmCode}
          className="tru-btn-secondary w-full min-h-[48px] flex items-center justify-center gap-2 text-[14px] cursor-pointer disabled:opacity-40"
        >
          <Shield size={15} />
          {tuValLoading ? 'Loading…' : 'TransUnion Valuation'}
        </button>

        {/* TU Valuation result */}
        {tuVal && tuVal.available === false && (
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/40 p-4">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">TransUnion Official</div>
            <div className="text-[13px] text-neutral-400">{tuVal.note || 'Valuation unavailable — using market estimate.'}</div>
          </div>
        )}
        {tuVal && tuVal.available !== false && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-2">
            <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">TransUnion Official</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Trade', value: tuVal.tradePrice },
                { label: 'Retail', value: tuVal.retailPrice },
                { label: 'New', value: tuVal.newPrice },
              ].map((v) => (
                <div key={v.label}>
                  <div className="text-[11px] text-neutral-500">{v.label}</div>
                  <div className="text-[16px] font-bold font-mono text-[#E8EAE6]">
                    {v.value != null ? `R ${Math.round(v.value).toLocaleString('en-ZA')}` : '—'}
                  </div>
                </div>
              ))}
            </div>
            {tuVal.variant && <div className="text-[11px] text-neutral-500">{tuVal.make} {tuVal.model} {tuVal.variant}</div>}
            {tuVal.retailPrice != null && (
              <button
                type="button"
                onClick={() => {
                  const p = Math.round(tuVal.retailPrice);
                  setManualPrice(String(p));
                  recalc(p, valuation.marginPercentage);
                }}
                className="mt-2 w-full min-h-[36px] rounded-lg text-[12px] font-semibold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition"
              >
                Use retail R {Math.round(tuVal.retailPrice).toLocaleString('en-ZA')}
              </button>
            )}
          </div>
        )}

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

        {/* Valuation history */}
        {history.length > 1 && (() => {
          const latest = history[history.length - 1];
          const prev = history[history.length - 2];
          const delta = latest.price - prev.price;
          const pct = prev.price > 0 ? ((delta / prev.price) * 100).toFixed(1) : '0';
          const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const trendColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-neutral-400';
          return (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[rgba(232,234,230,0.55)] font-semibold uppercase tracking-wider">Price History</p>
                <div className={`flex items-center gap-1 text-[13px] font-bold ${trendColor}`}>
                  <TrendIcon size={14} />
                  <span>{delta > 0 ? '+' : ''}{pct}%</span>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {[...history].reverse().map((snap, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-neutral-500">
                      {new Date(snap.scrapedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <span className="text-[#E8EAE6] font-mono font-medium">{fmt(snap.price)}</span>
                    <span className="text-neutral-600 text-[12px]">{snap.listingsFound} listings</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
