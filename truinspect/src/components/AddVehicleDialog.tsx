import React from 'react';
import { X, Plus, Search, Loader2, CheckCircle2, Shield, History } from 'lucide-react';
import { Vehicle } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Imagin8GatedButton, Imagin8Bundles, ZERO_BUNDLES } from './imagin8-gating';

interface Props {
  onClose: () => void;
  onAdd: (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
}

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

const titleCase = (s: string) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

export default function AddVehicleDialog({ onClose, onAdd }: Props) {
  const { user } = useAuth();
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
  const runRegCheck = async () => {
    const id = f.vin.trim() || f.stockNumber.trim();
    if (!id || !user) return;
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
    const id = f.vin.trim();
    if (!id || !user) return;
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

  const canSubmit = f.make.trim() && f.model.trim() && f.mileage.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd({
      make: f.make.trim(), model: f.model.trim(), year: Number(f.year), trim: f.trim.trim(),
      mmCode: f.mmCode.trim() || undefined,
      vin: f.vin.trim() || 'VIN-PENDING-' + Math.floor(1000 + Math.random() * 9000),
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

        {/* M&M first — the code drives make/model/fuel (flat-rate static API) */}
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Make *</label><input className={inputCls} value={f.make} onChange={set('make')} placeholder="Toyota" /></div>
          <div><label className={labelCls}>Model *</label><input className={inputCls} value={f.model} onChange={set('model')} placeholder="Hilux" /></div>
          <div><label className={labelCls}>Year</label><input className={inputCls} type="number" value={f.year} onChange={set('year')} /></div>
          <div><label className={labelCls}>Trim</label><input className={inputCls} value={f.trim} onChange={set('trim')} placeholder="2.8 GD-6 Raider" /></div>
          <div><label className={labelCls}>Mileage (km) *</label><input className={inputCls} type="number" value={f.mileage} onChange={set('mileage')} placeholder="45000" /></div>
          <div><label className={labelCls}>Price (R)</label><input className={inputCls} type="number" value={f.price} onChange={set('price')} placeholder="459900" /></div>
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

        {/* Imagin8 lookups — reg check & accident report */}
        <div className="grid grid-cols-2 gap-2">
          <Imagin8GatedButton
            feature="regCheck"
            bundles={imagin8Bundles}
            onClick={runRegCheck}
            onUnlock={() => alert('Registration checks are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion verification for this dealership.')}
            className="w-full"
            icon={regCheckLoading ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : <Shield size={13} />}
          />
          <Imagin8GatedButton
            feature="accidentReport"
            bundles={imagin8Bundles}
            onClick={runAccidentReport}
            onUnlock={() => alert('Accident reports are bundle-gated. Contact your TruSaaS account manager to activate live TransUnion claims history for this dealership.')}
            className="w-full"
            icon={accidentLoading ? <Loader2 size={13} className="animate-spin text-cyan-400" /> : <History size={13} />}
          />
        </div>
        {regCheckResult && (
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
        {accidentResult && (
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

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="tru-btn-ghost px-4 text-[13px] cursor-pointer" style={{ minHeight: 42 }}>Cancel</button>
          <button type="submit" disabled={!canSubmit} className="btn-primary on-fill flex items-center gap-2 px-5 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 42 }}>
            <Plus size={15} /> Add Vehicle
          </button>
        </div>
      </form>
    </div>
  );
}
