import React from 'react';
import { X, Plus, Search, Loader2, CheckCircle2, Shield, History, TrendingUp, LineChart, Radio } from 'lucide-react';
import { Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Imagin8GatedButton, Imagin8Bundles, ZERO_BUNDLES } from './imagin8-gating';
import { formatMoney, formatMoneyFromData } from './market';
import { useMarket, useRegLookup } from '../contexts/MarketContext';
import type { RegLookupResult } from '../../../packages/reg-lookup';

interface Props {
  onClose: () => void;
  onAdd: (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
}

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

const titleCase = (s: string) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

/** Synthetic identifier used by demo when no VIN/stock is typed yet — seeds the
 *  simulated responder off the form's own data so every demo car gets a stable,
 *  "generic" result rather than nothing. */
const synthId = (f: { make: string; model: string; year: string; trim?: string }) =>
  ('DEMO-' + (f.make || 'car') + '-' + (f.model || 'x') + '-' + f.year + (f.trim ? '-' + f.trim : ''))
    .toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'DEMO-CAR';

export default function AddVehicleDialog({ onClose, onAdd }: Props) {
  const { user, isDemo } = useAuth();
  const market = useMarket();
  const regLookup = useRegLookup();
  const [imagin8Bundles, setImagin8Bundles] = React.useState<Imagin8Bundles>(ZERO_BUNDLES);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch('/api/imagin8/bundles', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok && alive) {
          const data = await res.json();
          setImagin8Bundles(data);
        }
      } catch {
        // default to ZERO_BUNDLES
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const [f, setF] = React.useState({
    mmCode: '', make: '', model: '', year: String(new Date().getFullYear()), trim: '',
    vin: '', stockNumber: '', color: '', price: '', mileage: '',
    transmission: 'Automatic', fuelType: 'Petrol',
  });
  const [lookup, setLookup] = React.useState<'idle' | 'loading' | 'filled' | 'miss'>('idle');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  // M&M-first: entering a code pulls make/model/fuel from the live static API
  // so the identity comes from the code, not a hand-typed guess.
  const lookupMm = async (raw: string) => {
    const code = (raw || '').replace(/\s/g, '');
    if (!code) return;
    setLookup('loading');
    try {
      const token = await user?.getIdToken();
      const qs = new URLSearchParams({ mmCode: code }).toString();
      const res = await fetch(`/api/imagin8/static?${qs}`, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const s = res.ok ? await res.json() : null;
      const fuelMap: Record<string, string> = { P: 'Petrol', D: 'Diesel', H: 'Hybrid', E: 'Electric' };
      if (s && (s.make || s.model)) {
        setF((prev) => ({
          ...prev,
          make: s.make ? titleCase(s.make) : prev.make,
          model: s.model ? titleCase(s.model) : prev.model,
          fuelType: s.fuelType && fuelMap[s.fuelType] ? fuelMap[s.fuelType] : prev.fuelType,
        }));
        setLookup('filled');
      } else {
        setLookup('miss');
      }
    } catch {
      setLookup('miss');
    }
  };

  const [regCheckResult, setRegCheckResult] = React.useState<any>(null);
  const [regCheckLoading, setRegCheckLoading] = React.useState(false);

  /* UK plate lookup — VRM → registration dataset fills make/model/year/colour/
     fuel; the snapshot rides the vehicle record as regCheck. */
  const [plate, setPlate] = React.useState('');
  const [plateLoading, setPlateLoading] = React.useState(false);
  const [plateNote, setPlateNote] = React.useState<string | null>(null);
  const [plateLookup, setPlateLookup] = React.useState<RegLookupResult | null>(null);
  const runPlateLookup = async () => {
    const reg = plate.trim();
    if (!reg) return;
    setPlateLoading(true);
    setPlateNote(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reg-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ registration: reg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Lookup failed (${res.status})`);
      const fuelMap: Record<string, string> = { PETROL: 'Petrol', DIESEL: 'Diesel', HYBRID: 'Hybrid', ELECTRICITY: 'Electric' };
      const filled: string[] = [];
      setF((prev) => ({
        ...prev,
        make: data.make ? titleCase(data.make) : prev.make,
        model: data.model ? titleCase(data.model) : prev.model,
        year: data.yearOfManufacture ? String(data.yearOfManufacture) : prev.year,
        color: data.colour ? titleCase(data.colour) : prev.color,
        vin: data.vin ? String(data.vin).toUpperCase() : prev.vin,
        fuelType: data.fuelType && fuelMap[String(data.fuelType).toUpperCase()] ? fuelMap[String(data.fuelType).toUpperCase()] : prev.fuelType,
      }));
      if (data.make) filled.push('make');
      if (data.model) filled.push('model');
      if (data.yearOfManufacture) filled.push('year');
      if (data.colour) filled.push('colour');
      if (data.fuelType) filled.push('fuel');
      if (data.vin) filled.push('vin');
      setPlateLookup(data as RegLookupResult);
      setPlateNote(
        filled.length === 0
          ? 'No details came back for that plate — enter the basics by hand.'
          : `Filled ${filled.length} field${filled.length > 1 ? 's' : ''} from UK vehicle data — check and adjust.`,
      );
    } catch (err: any) {
      setPlateNote(err?.message || 'Lookup failed — enter the details by hand.');
    } finally {
      setPlateLoading(false);
    }
  };

  const runRegCheck = async () => {
    let id = f.vin.trim() || f.stockNumber.trim();
    if (!id) {
      if (!isDemo) {
        setRegCheckResult({ error: 'Enter a VIN or stock # first — the check runs against that identifier.' });
        return;
      }
      id = synthId(f); // demo: generic statement off the form itself
    }
    if (!user) return;
    setRegCheckLoading(true);
    setRegCheckResult(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/imagin8/regcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ identifier: id, type: 'vin' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setRegCheckResult(res.ok ? data : { error: data.error || `Check failed (${res.status})` });
    } catch (e: any) {
      setRegCheckResult({ error: e?.message || 'Check failed' });
    } finally {
      setRegCheckLoading(false);
    }
  };

  const [accidentResult, setAccidentResult] = React.useState<any>(null);
  const [accidentLoading, setAccidentLoading] = React.useState(false);
  const runAccidentReport = async () => {
    let id = f.vin.trim();
    if (!id) {
      if (!isDemo) {
        setAccidentResult({ error: 'Enter a VIN first — the report runs against that VIN.' });
        return;
      }
      id = synthId(f);
    }
    if (!user) return;
    setAccidentLoading(true);
    setAccidentResult(null);
    try {
      const token = await user.getIdToken();
      const qs = new URLSearchParams({ vin: id }).toString();
      const res = await fetch(`/api/imagin8/accident-report?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setAccidentResult(res.ok ? data : { error: data.error || `Report failed (${res.status})` });
    } catch (e: any) {
      setAccidentResult({ error: e?.message || 'Report failed' });
    } finally {
      setAccidentLoading(false);
    }
  };

  // TransUnion price (bundle-gated) — needs an M&M code in production because
  // getValues can only price off a real code, but in demo the simulated
  // responder accepts any seed, so we synthesise one from the form itself.
  const [tuPriceResult, setTuPriceResult] = React.useState<any>(null);
  const [tuPriceLoading, setTuPriceLoading] = React.useState(false);
  const runTuPrice = async () => {
    const yearNum = Number(f.year);
    if (!yearNum || (!f.mmCode.trim() && !isDemo)) {
      setTuPriceResult({ error: 'Enter an M&M code (or pick model/variant) for a TransUnion price.' });
      return;
    }
    const mm = f.mmCode.trim() || synthId(f);
    setTuPriceLoading(true);
    setTuPriceResult(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/imagin8/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mmCode: mm, year: yearNum, mileage: f.mileage ? Number(f.mileage) : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.bundlesRemaining) setImagin8Bundles(data.bundlesRemaining);
      setTuPriceResult(res.ok ? data : { error: data.error || `Price failed (${res.status})` });
    } catch (e: any) {
      setTuPriceResult({ error: e?.message || 'Price failed' });
    } finally { setTuPriceLoading(false); }
  };

  // Live market value (free scraper — not Imagin8, no gating) — needs make +
  // model at minimum. Works identically in production and demo since it's the
  // real Bright Data scraper, just flat-free and ungated for every tier.
  const [marketResult, setMarketResult] = React.useState<any>(null);
  const [marketLoading, setMarketLoading] = React.useState(false);
  const runMarketValue = async () => {
    if (!f.make.trim() || !f.model.trim()) {
      setMarketResult({ error: 'Enter make and model to scan live listings.' });
      return;
    }
    setMarketLoading(true);
    setMarketResult(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          make: f.make.trim(), model: f.model.trim(), year: Number(f.year),
          mileage: f.mileage ? Number(f.mileage) : undefined,
          vin: f.vin.trim() || undefined,
        }),
      });
      setMarketResult(res.ok ? await res.json() : { averageRetailPrice: null, listingsFound: 0 });
    } catch {
      setMarketResult({ averageRetailPrice: null, listingsFound: 0 });
    } finally { setMarketLoading(false); }
  };

  const canSubmit = f.make.trim() && f.model.trim() && f.mileage.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd({
      make: f.make.trim(), model: f.model.trim(), year: Number(f.year), trim: f.trim.trim(),
      mmCode: f.mmCode.trim() || undefined,
      vin: f.vin.trim() || 'VIN-PENDING-' + Math.floor(1000 + Math.random() * 9000),
      registration: plate.trim() || undefined,
      regCheck: plateLookup || undefined,
      stockNumber: f.stockNumber.trim() || 'STK-' + Math.floor(10000 + Math.random() * 90000),
      color: f.color.trim() || 'Black',
      price: Number(f.price) || 0,
      mileage: f.mileage.trim() ? Number(f.mileage) : undefined,
      transmission: f.transmission as Vehicle['transmission'],
      fuelType: f.fuelType as Vehicle['fuelType'],
      status: 'In-Progress',
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="ti-card w-full max-w-2xl p-6 space-y-5"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold" style={{ color: 'var(--white)', letterSpacing: 'var(--track-h3)' }}>Add Vehicle</h2>
          <button type="button" onClick={onClose} className="tru-btn-ghost h-9 w-9 flex items-center justify-center cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Identity block is market-shaped: SA leads with the M&M code; UK
            leads with the registration plate (when a lookup is configured). */}
        {market.id === 'za' && (
        <div className="rounded-lg p-3" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
          <label className={labelCls}>M&amp;M Code — auto-fills make, model &amp; fuel</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
            <input
              className={`${inputCls} pl-9`}
              value={f.mmCode}
              onChange={(e) => { setF((s) => ({ ...s, mmCode: e.target.value })); setLookup('idle'); }}
              onBlur={(e) => lookupMm(e.target.value)}
              placeholder="e.g. 60090200"
              style={{ fontFamily: 'var(--mono)' }}
              autoFocus
            />
          </div>
          <div className="mt-1.5 text-[11px] flex items-center gap-1.5" style={{ minHeight: 16, color: 'var(--muted)' }}>
            {lookup === 'loading' && <><Loader2 size={12} className="animate-spin" /> Looking up…</>}
            {lookup === 'filled' && <span style={{ color: 'var(--cyan)' }} className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Make, model &amp; fuel auto-filled — adjust below if needed.</span>}
            {lookup === 'miss' && <span>No match — enter make/model by hand below.</span>}
            {lookup === 'idle' && <span>Enter the code and tab out, or fill the fields by hand below.</span>}
          </div>
        </div>
        )}

        {market.id === 'uk' && regLookup.available && (
        <div className="rounded-lg p-3" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
          <label className={labelCls}>Registration plate — auto-fills make, model &amp; more</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
              <input
                className={`${inputCls} pl-9 uppercase tracking-widest`}
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runPlateLookup(); } }}
                placeholder="e.g. BJ52SFK"
                maxLength={10}
                style={{ fontFamily: 'var(--mono)' }}
                autoFocus
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => void runPlateLookup()}
              disabled={plateLoading || plate.trim().length < 2}
              className="tru-btn-secondary px-4 flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 40 }}
            >
              {plateLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {plateLoading ? 'Checking…' : 'Look up'}
            </button>
          </div>
          <div className="mt-1.5 text-[11px] flex flex-wrap items-center gap-1.5" style={{ minHeight: 16, color: 'var(--muted)' }}>
            {plateNote && <span>{plateNote}</span>}
            {!plateNote && <span>Enter the plate and look up, or fill the fields by hand below.</span>}
          </div>
          {plateLookup && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {plateLookup.motStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: plateLookup.motStatus === 'Valid' ? 'var(--cyan)' : 'var(--amber, #F59E0B)', borderColor: 'currentColor' }}>
                  MOT: {plateLookup.motStatus}{plateLookup.motExpiryDate ? ` · due ${plateLookup.motExpiryDate}` : ''}
                </span>
              )}
              {plateLookup.taxStatus && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: plateLookup.taxStatus === 'Taxed' ? 'var(--cyan)' : 'var(--amber, #F59E0B)', borderColor: 'currentColor' }}>
                  Tax: {plateLookup.taxStatus}
                </span>
              )}
              {plateLookup.mileageAlert && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: 'var(--red, #EF4444)', borderColor: 'currentColor' }}>⚠ Mileage discrepancy recorded</span>
              )}
              {plateLookup.markedForExport && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: 'var(--red, #EF4444)', borderColor: 'currentColor' }}>⚠ Marked for export</span>
              )}
            </div>
          )}
        </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Make *</label><input className={inputCls} value={f.make} onChange={set('make')} placeholder="Toyota" /></div>
          <div><label className={labelCls}>Model *</label><input className={inputCls} value={f.model} onChange={set('model')} placeholder="Hilux" /></div>
          <div><label className={labelCls}>Year</label><input className={inputCls} type="number" value={f.year} onChange={set('year')} /></div>
          <div><label className={labelCls}>Trim</label><input className={inputCls} value={f.trim} onChange={set('trim')} placeholder="2.8 GD-6 Raider" /></div>
          <div><label className={labelCls}>Mileage ({market.distanceUnit}) *</label><input className={inputCls} type="number" value={f.mileage} onChange={set('mileage')} placeholder="45000" /></div>
          <div><label className={labelCls}>Price ({market.currency})</label><input className={inputCls} type="number" value={f.price} onChange={set('price')} placeholder="459900" /></div>
          <div><label className={labelCls}>Stock #</label><input className={inputCls} value={f.stockNumber} onChange={set('stockNumber')} placeholder="auto" style={{ fontFamily: 'var(--mono)' }} /></div>
          <div><label className={labelCls}>VIN</label><input className={inputCls} value={f.vin} onChange={set('vin')} placeholder="auto" style={{ fontFamily: 'var(--mono)' }} /></div>
          <div><label className={labelCls}>Colour</label><input className={inputCls} value={f.color} onChange={set('color')} placeholder="White" /></div>
          <div>
            <label className={labelCls}>Transmission</label>
            <select className={inputCls} value={f.transmission} onChange={set('transmission')} style={{ minHeight: 40 }}>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Fuel</label>
            <select className={inputCls} value={f.fuelType} onChange={set('fuelType')} style={{ minHeight: 40 }}>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
        </div>

        {/* Pricing + verification + background — TransUnion price & the two
            bundle-gated checks, plus the free live market-value scan.
            All four do something real; none ever silently no-op.
            The TransUnion stack is SA-only (SA provider), so it renders only
            on ZA instances — UK instances keep the free market scan. */}
        <div className="grid grid-cols-2 gap-2">
          {market.id === 'za' && (
          <>
          <Imagin8GatedButton
            feature="valuation"
            bundles={imagin8Bundles}
            onClick={runTuPrice}
            onUnlock={() => alert('TransUnion valuations are bundle-gated. Contact your TruSaaS account manager to activate live pricing for this dealership.')}
            className="w-full"
            icon={tuPriceLoading ? <Loader2 size={13} className="animate-spin" /> : <TrendingUp size={13} />}
            label="TransUnion price"
          />
          <Imagin8GatedButton
            feature="regCheck"
            bundles={imagin8Bundles}
            onClick={runRegCheck}
            onUnlock={() => alert('Registration checks are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion verification for this dealership.')}
            className="w-full"
            icon={regCheckLoading ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
          />
          <Imagin8GatedButton
            feature="accidentReport"
            bundles={imagin8Bundles}
            onClick={runAccidentReport}
            onUnlock={() => alert('Accident reports are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion claims history for this dealership.')}
            className="w-full"
            icon={accidentLoading ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
          />
          </>
          )}
          <button
            type="button"
            onClick={runMarketValue}
            disabled={marketLoading}
            className={`market-btn inline-flex items-center justify-center gap-2 min-h-[42px] px-3.5 py-2.5 text-[#4FE3DC] text-[13px] font-semibold cursor-pointer select-none${marketLoading ? ' scanning' : ''}${market.id !== 'za' ? ' col-span-2' : ''}`}
          >
            {marketLoading ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
            <span className="truncate">Live Market Value</span>
            <span className="mv-badge">LIVE</span>
          </button>
        </div>
        {market.id === 'za' && regCheckResult && (
          <div className="rounded-lg p-2.5 text-[12px]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>Reg check</span>
              {regCheckResult.error ? (
                <span className="text-amber-400 font-medium">{regCheckResult.error}</span>
              ) : (
                <span className={regCheckResult.stolen || regCheckResult.financePending ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {regCheckResult.stolen ? 'Stolen' : regCheckResult.financePending ? 'Finance pending' : 'Clear'}
                </span>
              )}
            </div>
          </div>
        )}
        {market.id === 'za' && accidentResult && (
          <div className="rounded-lg p-2.5 text-[12px]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>Accident history</span>
              {accidentResult.error ? (
                <span className="text-amber-400 font-medium">{accidentResult.error}</span>
              ) : (
                <span className={accidentResult.claims?.length > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {accidentResult.claims?.length > 0 ? `${accidentResult.claims.length} claim(s)` : 'No claims'}
                </span>
              )}
            </div>
          </div>
        )}
        {market.id === 'za' && tuPriceResult && (
          <div className="rounded-lg p-2.5 text-[12px]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>TransUnion price</span>
              {tuPriceResult.error ? (
                <span className="text-amber-400 font-medium">{tuPriceResult.error}</span>
              ) : (
                <span className="font-semibold" style={{ color: 'var(--cyan)' }}>
                  {/* TransUnion eValue8 is the SA provider — ZAR by definition. */}
                  Retail {formatMoney(tuPriceResult.retailPrice)} · Trade {formatMoney(tuPriceResult.tradePrice)}
                </span>
              )}
            </div>
            {!tuPriceResult.error && tuPriceResult.marketValue != null && (
              <div className="mt-1 flex items-center justify-between">
                <span style={{ color: 'var(--muted)' }}>Market estimate</span>
                <span style={{ color: 'var(--white)' }}>{formatMoney(tuPriceResult.marketValue)}</span>
              </div>
            )}
          </div>
        )}
        {marketResult && (
          <div className="rounded-lg p-2.5 text-[12px]" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <div className="flex items-center justify-between gap-3">
              <span style={{ color: 'var(--muted)' }}>Live market value</span>
              {marketResult.error ? (
                <span className="text-amber-400 font-medium">{marketResult.error}</span>
              ) : marketResult.averageRetailPrice != null ? (
                <span className="text-right">
                  <span className="font-semibold" style={{ color: 'var(--white)' }}>{formatMoneyFromData(marketResult.averageRetailPrice, marketResult)}</span>
                  <span className="ml-2" style={{ color: 'var(--muted)' }}>{marketResult.listingsFound} listings</span>
                  <button type="button" onClick={() => setF((s) => ({ ...s, price: String(Math.round(marketResult.averageRetailPrice)) }))}
                    className="ml-2 underline cursor-pointer" style={{ color: 'var(--cyan)' }}>Use as price</button>
                </span>
              ) : (
                <span className="text-amber-400 font-medium">No live data right now — price manually.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {!canSubmit && <p className="text-[12px] text-rose-400 mr-2">Please enter Make, Model, and Mileage</p>}
          <button type="button" onClick={onClose} className="tru-btn-ghost px-4 text-[13px] cursor-pointer" style={{ minHeight: 42 }}>Cancel</button>
          <button type="submit" disabled={!canSubmit} title={!canSubmit ? 'Please enter Make, Model, and Mileage' : undefined} className="btn-primary on-fill flex items-center gap-2 px-5 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 42 }}>
            <Plus size={15} /> Add Vehicle
          </button>
        </div>
      </form>
    </div>
  );
}
