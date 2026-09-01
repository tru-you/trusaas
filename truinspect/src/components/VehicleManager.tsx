import React from 'react';
import {
  ArrowLeft, Save, FileText, ShoppingCart, AlertTriangle, Camera, Pencil,
  CheckCircle2, Phone, Mail, MessageCircle, HandCoins, User, Upload, Paperclip,
  Trash2, Plus, X, ChevronLeft, ChevronRight, Shield, History, Loader2,
} from 'lucide-react';
import { Vehicle, VehicleOffer } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeInspectionReadiness } from '../lib/readiness';
import { telHref, mailtoHref, whatsappHref, openContact } from '../lib/contact';
import { deriveReportId } from '../types/inspection';
import { useAuth } from '../contexts/AuthContext';
import { Imagin8GatedButton, Imagin8Bundles, ZERO_BUNDLES } from './imagin8-gating';
import { useMarket, useMoney } from '../contexts/MarketContext';

interface Props {
  vehicle: Vehicle;
  onUpdateVehicle: (vehicle: Vehicle, updates: Partial<Vehicle>) => Promise<Vehicle | undefined>;
  onPhotosUploaded: (updated: Vehicle) => void;
  onViewReport: () => void;
  onOpenTradeIn: () => void;
  onOpenDamage: () => void;
  onOpenChecklist: () => void;
  onDelete: () => void;
  onBack: () => void;
}

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

export default function VehicleManager({
  vehicle, onUpdateVehicle, onPhotosUploaded, onViewReport, onOpenTradeIn, onOpenDamage, onOpenChecklist, onDelete, onBack,
}: Props) {
  const { user } = useAuth();
  const money = useMoney();
  const market = useMarket();
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    make: vehicle.make, model: vehicle.model, year: String(vehicle.year), trim: vehicle.trim,
    vin: vehicle.vin, color: vehicle.color, price: String(vehicle.price || ''),
    mileage: String(vehicle.mileage || ''), transmission: vehicle.transmission || 'Automatic',
    fuelType: vehicle.fuelType || 'Petrol', warranty: vehicle.warranty || '',
    servicePlan: vehicle.servicePlan || '', extras: vehicle.extras || '',
    customerName: vehicle.customerName || '', customerPhone: vehicle.customerPhone || '',
    customerEmail: vehicle.customerEmail || '', managerComments: vehicle.managerComments || '',
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  // Add-offer form (offers are received from buyers, not issued here)
  const [offer, setOffer] = React.useState({ buyerName: '', buyerContact: '', amount: '', note: '' });
  const [offerDoc, setOfferDoc] = React.useState<string>('');
  const [savingOffer, setSavingOffer] = React.useState(false);
  const offerDocRef = React.useRef<HTMLInputElement | null>(null);

  // Imagin8 bundle gating
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

  // Imagin8 data lookups — reg check & accident report
  const [regCheckResult, setRegCheckResult] = React.useState<any>(null);
  const [regCheckLoading, setRegCheckLoading] = React.useState(false);
  const runRegCheck = async () => {
    const id = form.vin.trim() || vehicle.vin?.trim() || vehicle.stockNumber?.trim();
    if (!id || !user) return;
    setRegCheckLoading(true);
    setRegCheckResult(null);
    try {
      const token = await user.getIdToken();
      const qs = new URLSearchParams({ identifier: id, type: 'vin' }).toString();
      const res = await fetch(`/api/imagin8/regcheck?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
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
    const id = form.vin.trim() || vehicle.vin?.trim();
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

  /** Lightbox state for desktop photo zoom */
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  React.useEffect(() => {
    setForm({
      make: vehicle.make, model: vehicle.model, year: String(vehicle.year), trim: vehicle.trim,
      vin: vehicle.vin, color: vehicle.color, price: String(vehicle.price || ''),
      mileage: String(vehicle.mileage || ''), transmission: vehicle.transmission || 'Automatic',
      fuelType: vehicle.fuelType || 'Petrol', warranty: vehicle.warranty || '',
      servicePlan: vehicle.servicePlan || '', extras: vehicle.extras || '',
      customerName: vehicle.customerName || '', customerPhone: vehicle.customerPhone || '',
      customerEmail: vehicle.customerEmail || '', managerComments: vehicle.managerComments || '',
    });
    setOffer({ buyerName: '', buyerContact: '', amount: '', note: '' });
    setOfferDoc('');
    setSaved(false);
  }, [vehicle.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const buildUpdates = (): Partial<Vehicle> => ({
    make: form.make, model: form.model, year: parseInt(form.year) || vehicle.year, trim: form.trim,
    vin: form.vin, color: form.color, price: parseFloat(form.price) || 0,
    mileage: parseInt(form.mileage) || undefined,
    transmission: form.transmission as Vehicle['transmission'],
    fuelType: form.fuelType as Vehicle['fuelType'],
    warranty: form.warranty, servicePlan: form.servicePlan, extras: form.extras,
    customerName: form.customerName, customerPhone: form.customerPhone, customerEmail: form.customerEmail,
    managerComments: form.managerComments,
  });

  const handleSave = async () => {
    setSaving(true);
    await onUpdateVehicle(vehicle, buildUpdates());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const readiness = computeInspectionReadiness(vehicle);
  const requiredSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
  const requiredTaken = requiredSlots.filter((s) => vehicle.photos?.[s.id]).length;
  const totalRequired = requiredSlots.length;
  const pct = Math.round((requiredTaken / totalRequired) * 100);
  const damageCount = vehicle.damageFindings ? Object.values(vehicle.damageFindings).flat().length : 0;
  const inspectionDone = vehicle.inspectionPoints && Object.keys(vehicle.inspectionPoints).length > 0;
  const photoSlots = DEFAULT_TEMPLATE.slots.filter((s) => vehicle.photos?.[s.id]);

  React.useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) => (i - 1 + photoSlots.length) % photoSlots.length);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i + 1) % photoSlots.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photoSlots.length]);

  const dealerName = (typeof localStorage !== 'undefined' && localStorage.getItem('trulens_dealer_name')) || 'our dealership';
  const vehLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const reportId = deriveReportId(vehicle, 'VIR');

  const reportMessage = `Hi${form.customerName ? ' ' + form.customerName : ''}, here is the inspection report for the ${vehLabel} (Ref ${reportId}) from ${dealerName}.`;

  const hasPhone = !!form.customerPhone.trim();
  const hasEmail = !!form.customerEmail.trim();
  const offers = vehicle.offers || [];

  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

  /* Desktop has no camera, so a manager attaches photos from files. Files map
     to the next unfilled required slots in order, then to any remaining slots. */
  const handleUploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const token = await user?.getIdToken();
      const allSlots = DEFAULT_TEMPLATE.slots;
      const emptySlots = [
        ...allSlots.filter((s) => s.required && !vehicle.photos?.[s.id]),
        ...allSlots.filter((s) => !s.required && !vehicle.photos?.[s.id]),
      ];
      let latest = vehicle;
      const list = Array.from(files);
      for (let i = 0; i < list.length && i < emptySlots.length; i++) {
        const base64 = await readAsDataUrl(list[i]);
        const res = await fetch('/api/inventory/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ vehicleId: vehicle.id, slotId: emptySlots[i].id, base64Image: base64 }),
        });
        if (res.ok) latest = (await res.json()).vehicle;
      }
      onPhotosUploaded(latest);
    } catch (e) {
      console.error('Photo upload failed:', e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pickOfferDoc = async (file: File) => {
    try { setOfferDoc(await readAsDataUrl(file)); } catch { /* ignore */ }
  };

  const addOffer = async () => {
    const amt = parseFloat(offer.amount) || 0;
    if (!offer.buyerName.trim() || !amt) return;
    setSavingOffer(true);
    try {
      let documentRef: string | undefined;
      if (offerDoc) {
        const token = await user?.getIdToken();
        const res = await fetch('/api/inventory/upload-trade-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ base64Image: offerDoc }),
        });
        if (res.ok) documentRef = (await res.json()).ref;
      }
      const next: VehicleOffer = {
        id: 'offer-' + Math.floor(100000 + Math.random() * 900000),
        buyerName: offer.buyerName.trim(),
        buyerContact: offer.buyerContact.trim() || undefined,
        amount: amt,
        note: offer.note.trim() || undefined,
        documentRef,
        status: 'received',
        receivedAt: new Date().toISOString(),
      };
      await onUpdateVehicle(vehicle, { offers: [next, ...offers] });
      setOffer({ buyerName: '', buyerContact: '', amount: '', note: '' });
      setOfferDoc('');
      if (offerDocRef.current) offerDocRef.current.value = '';
    } finally {
      setSavingOffer(false);
    }
  };

  const setOfferStatus = (id: string, status: VehicleOffer['status']) =>
    onUpdateVehicle(vehicle, { offers: offers.map((o) => (o.id === id ? { ...o, status } : o)) });

  const removeOffer = (id: string) =>
    onUpdateVehicle(vehicle, { offers: offers.filter((o) => o.id !== id) });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div
        className="sticky top-0 z-20 px-6 py-3 flex items-center justify-between"
        style={{ background: 'color-mix(in srgb, var(--ink) 92%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--glass-line)' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="tru-btn-ghost h-9 w-9 flex items-center justify-center cursor-pointer">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[17px] font-semibold" style={{ color: 'var(--white)' }}>{vehLabel}</h2>
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
              {vehicle.stockNumber || 'No stock #'} · <span style={{ color: readiness.color }}>{readiness.label}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (window.confirm(`Delete ${vehLabel}? This removes the vehicle and its photos. This cannot be undone.`)) onDelete(); }}
            className="tru-btn-ghost flex items-center gap-2 px-3 text-[13px] cursor-pointer"
            style={{ minHeight: 40, color: 'var(--danger)' }}
            title="Delete this vehicle"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary on-fill flex items-center gap-2 px-4 text-[13px] cursor-pointer" style={{ minHeight: 40 }}>
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="ti-stat">
            <p className="ti-stat-label">Photos</p>
            <p className="ti-stat-value">{requiredTaken}/{totalRequired}</p>
            <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: 'rgba(232,234,230,0.08)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--cyan)' : '#6366F1' }} />
            </div>
          </div>
          <div className="ti-stat">
            <p className="ti-stat-label">Damage Tags</p>
            <p className="ti-stat-value" style={damageCount > 0 ? { color: 'var(--danger)' } : { color: 'var(--faint)' }}>{damageCount}</p>
          </div>
          <div className="ti-stat">
            <p className="ti-stat-label">Inspection</p>
            <p className="ti-stat-value" style={{ fontSize: 'var(--t-body)', color: inspectionDone ? 'var(--cyan)' : 'var(--faint)' }}>{inspectionDone ? 'Complete' : 'Pending'}</p>
          </div>
          <div className="ti-stat">
            <p className="ti-stat-label">Asking Price</p>
            <p className="ti-stat-value">{money(vehicle.price || 0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Vehicle details */}
          <section className="ti-card p-5 space-y-4">
            <h3 className="ti-section-title"><Pencil size={14} style={{ color: 'var(--cyan)' }} /> Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Make</label><input className={inputCls} value={form.make} onChange={set('make')} /></div>
              <div><label className={labelCls}>Model</label><input className={inputCls} value={form.model} onChange={set('model')} /></div>
              <div><label className={labelCls}>Year</label><input className={inputCls} type="number" value={form.year} onChange={set('year')} /></div>
              <div><label className={labelCls}>Trim</label><input className={inputCls} value={form.trim} onChange={set('trim')} /></div>
              <div><label className={labelCls}>VIN</label><input className={inputCls} value={form.vin} onChange={set('vin')} style={{ fontFamily: 'var(--mono)' }} /></div>
              <div><label className={labelCls}>Colour</label><input className={inputCls} value={form.color} onChange={set('color')} /></div>
              <div><label className={labelCls}>Price (R)</label><input className={inputCls} type="number" value={form.price} onChange={set('price')} /></div>
              <div><label className={labelCls}>Mileage (km)</label><input className={inputCls} type="number" value={form.mileage} onChange={set('mileage')} /></div>
              <div>
                <label className={labelCls}>Transmission</label>
                <select className={inputCls} value={form.transmission} onChange={set('transmission')} style={{ minHeight: 40 }}>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Fuel Type</label>
                <select className={inputCls} value={form.fuelType} onChange={set('fuelType')} style={{ minHeight: 40 }}>
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
            </div>

            {/* Imagin8 / Vehicle Verification */}
            {/* TransUnion stack is SA-only (SA provider) — hidden on other markets. */}
            {market.id === 'za' && (
            <div className="pt-2 border-t border-[var(--glass-line)] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--white-dim)' }}>TransUnion Verification</span>
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Imagin8 bundle-gated</span>
              </div>
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
            </div>
            )}
          </section>

          {/* Warranty / service / extras */}
          <section className="ti-card p-5 space-y-4">
            <h3 className="ti-section-title"><FileText size={14} style={{ color: 'var(--cyan)' }} /> Warranty, Service &amp; Extras</h3>
            <div><label className={labelCls}>Warranty</label>
              <textarea className={inputCls} rows={2} value={form.warranty} onChange={set('warranty')} placeholder="e.g. 3 year / 100 000 km factory warranty" /></div>
            <div><label className={labelCls}>Service Plan</label>
              <textarea className={inputCls} rows={2} value={form.servicePlan} onChange={set('servicePlan')} placeholder="e.g. Full service history, next service at 90 000 km" /></div>
            <div><label className={labelCls}>Extras / Features</label>
              <textarea className={inputCls} rows={3} value={form.extras} onChange={set('extras')} placeholder="e.g. Sunroof, leather seats, reverse camera, park sensors" /></div>
          </section>
        </div>

        {/* Manager comments — customer-facing summary for the report */}
        <section className="ti-card p-5 space-y-3">
          <h3 className="ti-section-title"><Pencil size={14} style={{ color: 'var(--cyan)' }} /> Comments</h3>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Customer-facing summary printed on the report — rewrite the field notes into something buyer-ready.</p>
          <textarea className={inputCls} rows={4} value={form.managerComments} onChange={set('managerComments')} placeholder="e.g. Well-maintained, full service history, minor stone chips on bonnet touched up. Drives excellently." />
        </section>

        {/* Customer + send report */}
        <section className="ti-card p-5 space-y-4">
          <h3 className="ti-section-title"><User size={14} style={{ color: 'var(--cyan)' }} /> Customer &amp; Report Delivery</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Name</label><input className={inputCls} value={form.customerName} onChange={set('customerName')} placeholder="Customer name" /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.customerPhone} onChange={set('customerPhone')} placeholder="082 000 0000" style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.customerEmail} onChange={set('customerEmail')} placeholder="name@email.com" style={{ fontFamily: 'var(--mono)' }} /></div>
          </div>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            Send the report via the customer's own channel — TruInspect opens your native dialer, mail app or WhatsApp. Export the report as PDF first from <span style={{ color: 'var(--white-dim)' }}>View Report</span>, then attach it.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button disabled={!hasPhone} onClick={() => openContact(telHref(form.customerPhone))} className="tru-btn-secondary flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 42 }}>
              <Phone size={14} /> Call
            </button>
            <button disabled={!hasEmail} onClick={() => openContact(mailtoHref(form.customerEmail, `Your vehicle report — ${vehLabel}`, reportMessage))} className="tru-btn-secondary flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 42 }}>
              <Mail size={14} /> Email
            </button>
            <button disabled={!hasPhone} onClick={() => openContact(whatsappHref(form.customerPhone, reportMessage))} className="tru-btn-secondary flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 42 }}>
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>
        </section>

        {/* Offers received on this vehicle */}
        <section className="ti-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="ti-section-title"><HandCoins size={14} style={{ color: 'var(--cyan)' }} /> Offers ({offers.length})</h3>
          </div>

          {/* Existing offers */}
          {offers.length > 0 && (
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o.id} className="ti-card-quiet p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--white)' }}>{o.buyerName}</span>
                      <span className="text-[13px]" style={{ fontFamily: 'var(--mono)', color: 'var(--cyan)' }}>{money(o.amount)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{
                        background: o.status === 'accepted' ? 'var(--cyan-faint)' : 'rgba(232,234,230,0.06)',
                        color: o.status === 'accepted' ? 'var(--cyan)' : o.status === 'declined' ? 'var(--danger)' : 'var(--muted)',
                      }}>{o.status}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {o.buyerContact && <span>{o.buyerContact}</span>}
                      <span>{new Date(o.receivedAt).toLocaleDateString(market.locale)}</span>
                      {o.documentRef && <a href={o.documentRef} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--cyan)]"><Paperclip size={10} /> Document</a>}
                    </div>
                    {o.note && <p className="text-[11px] mt-1" style={{ color: 'var(--white-dim)' }}>{o.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {o.status !== 'accepted' && (
                      <button onClick={() => setOfferStatus(o.id, 'accepted')} className="tru-btn-ghost px-2 text-[11px] cursor-pointer" style={{ minHeight: 30, color: 'var(--cyan)' }}>Accept</button>
                    )}
                    {o.status !== 'declined' && (
                      <button onClick={() => setOfferStatus(o.id, 'declined')} className="tru-btn-ghost px-2 text-[11px] cursor-pointer" style={{ minHeight: 30 }}>Decline</button>
                    )}
                    <button onClick={() => removeOffer(o.id)} title="Remove offer" className="tru-btn-ghost h-8 w-8 flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add an offer received from a buyer / other dealership */}
          <div className="rounded-lg p-3 space-y-3" style={{ background: 'var(--glass)', border: '1px solid var(--glass-line)' }}>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--white-dim)' }}>Log an offer received</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Buyer / Dealership</label><input className={inputCls} value={offer.buyerName} onChange={(e) => setOffer((s) => ({ ...s, buyerName: e.target.value }))} placeholder="Name" /></div>
              <div><label className={labelCls}>Contact (optional)</label><input className={inputCls} value={offer.buyerContact} onChange={(e) => setOffer((s) => ({ ...s, buyerContact: e.target.value }))} placeholder="Phone / email" style={{ fontFamily: 'var(--mono)' }} /></div>
              <div><label className={labelCls}>Amount (R)</label><input className={inputCls} type="number" value={offer.amount} onChange={(e) => setOffer((s) => ({ ...s, amount: e.target.value }))} placeholder="0" /></div>
            </div>
            <div><label className={labelCls}>Note (optional)</label><input className={inputCls} value={offer.note} onChange={(e) => setOffer((s) => ({ ...s, note: e.target.value }))} placeholder="e.g. Valid 7 days, cash, subject to viewing" /></div>
            <div className="flex items-center gap-2">
              <input ref={offerDocRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pickOfferDoc(e.target.files[0])} />
              <button onClick={() => offerDocRef.current?.click()} className="tru-btn-secondary flex items-center gap-2 px-3 text-[12px] cursor-pointer" style={{ minHeight: 38 }}>
                <Paperclip size={13} /> {offerDoc ? 'Document attached' : 'Attach OTP doc'}
              </button>
              <div className="flex-1" />
              <button disabled={!offer.buyerName.trim() || !offer.amount || savingOffer} onClick={addOffer} className="btn-primary on-fill flex items-center gap-2 px-4 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 38 }}>
                <Plus size={14} /> {savingOffer ? 'Saving…' : 'Add Offer'}
              </button>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            Track offers received from buyers or other dealers. TruInspect just records them — the deal itself lives in your PMS.
          </p>
        </section>

        {/* Photos */}
        <section className="ti-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="ti-section-title"><Camera size={14} style={{ color: 'var(--cyan)' }} /> Photos ({requiredTaken}/{totalRequired})</h3>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleUploadFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="tru-btn-secondary flex items-center gap-2 px-3 text-[13px] cursor-pointer disabled:opacity-40" style={{ minHeight: 36 }}>
              <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload Photos'}
            </button>
          </div>
          {photoSlots.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: 'var(--muted)' }}>No photos yet — field workers capture on their phones, or upload from files above.</p>
          ) : (
            <div className="grid grid-cols-4 xl:grid-cols-6 gap-2">
              {photoSlots.map((slot, idx) => (
                <div
                  key={slot.id}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group"
                  style={{ border: '1px solid var(--glass-line)' }}
                  onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                >
                  <img src={vehicle.photos[slot.id]} alt={slot.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                    <p className="text-[10px] truncate" style={{ color: 'var(--white-dim)' }}>{slot.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Damage overview */}
        {damageCount > 0 && (
          <section className="ti-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="ti-section-title"><AlertTriangle size={14} style={{ color: 'var(--danger)' }} /> Damage Findings ({damageCount})</h3>
              <button onClick={onOpenDamage} className="text-[12px] cursor-pointer transition-colors hover:text-[var(--cyan-bright)]" style={{ color: 'var(--cyan)' }}>Edit Damage Tags</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, findings]) =>
                findings.map((f) => {
                  const slot = DEFAULT_TEMPLATE.slots.find((s) => s.id === slotId);
                  return (
                    <div key={f.id} className="ti-card-quiet px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold capitalize" style={{ color: 'var(--white)' }}>{f.damageType}</span>
                        <span className="text-[11px]" style={{ fontFamily: 'var(--mono)', color: f.severity >= 4 ? 'var(--danger)' : 'var(--muted)' }}>Sev {f.severity}/5</span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{f.panel} · {slot?.name || slotId}</p>
                      {f.note && <p className="text-[11px] mt-1" style={{ color: 'var(--white-dim)' }}>{f.note}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <button onClick={onViewReport} className="tru-btn-secondary flex items-center gap-2 justify-center text-[13px] cursor-pointer" style={{ minHeight: 46 }}>
            <FileText size={15} /> View Report
          </button>
          <button onClick={onOpenTradeIn} className="tru-btn-secondary flex items-center gap-2 justify-center text-[13px] cursor-pointer" style={{ minHeight: 46 }}>
            <ShoppingCart size={15} /> Trade-In
          </button>
          <button onClick={onOpenDamage} className="tru-btn-ghost flex items-center gap-2 justify-center text-[13px] cursor-pointer" style={{ minHeight: 46 }}>
            <AlertTriangle size={15} /> Damage Tags
          </button>
          <button onClick={onOpenChecklist} className="tru-btn-ghost flex items-center gap-2 justify-center text-[13px] cursor-pointer" style={{ minHeight: 46 }}>
            <CheckCircle2 size={15} /> Inspection
          </button>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && photoSlots.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
            <p className="text-[13px] font-medium" style={{ color: 'var(--white-dim)' }}>
              {photoSlots[lightboxIndex]?.name} <span className="text-[12px]" style={{ color: 'var(--muted)' }}>({lightboxIndex + 1} / {photoSlots.length})</span>
            </p>
            <button
              onClick={() => setLightboxOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={22} style={{ color: 'var(--white)' }} />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center w-full px-4 py-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={vehicle.photos[photoSlots[lightboxIndex].id]}
              alt={photoSlots[lightboxIndex]?.name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          {/* Nav arrows */}
          {photoSlots.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + photoSlots.length) % photoSlots.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={24} style={{ color: 'var(--white)' }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % photoSlots.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <ChevronRight size={24} style={{ color: 'var(--white)' }} />
              </button>
            </>
          )}

          {/* Damage badges for this photo */}
          {vehicle.damageFindings?.[photoSlots[lightboxIndex].id]?.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
              {vehicle.damageFindings[photoSlots[lightboxIndex].id].map((f) => (
                <span
                  key={f.id}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    background: f.severity >= 4 ? 'rgba(239,68,68,0.25)' : 'rgba(232,234,230,0.12)',
                    color: f.severity >= 4 ? 'var(--danger)' : 'var(--white-dim)',
                    border: `1px solid ${f.severity >= 4 ? 'rgba(239,68,68,0.4)' : 'rgba(232,234,230,0.15)'}`,
                  }}
                >
                  {f.damageType} · Sev {f.severity}/5
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
