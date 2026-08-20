import React from 'react';
import {
  ArrowLeft, Save, FileText, ShoppingCart, AlertTriangle, Camera, Pencil,
  CheckCircle2, Phone, Mail, MessageCircle, HandCoins, User,
} from 'lucide-react';
import { Vehicle } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeInspectionReadiness } from '../lib/readiness';
import { telHref, mailtoHref, whatsappHref, openContact } from '../lib/contact';
import { deriveReportId } from '../types/inspection';
import OtpDocument from './OtpDocument';

interface Props {
  vehicle: Vehicle;
  onUpdateVehicle: (vehicle: Vehicle, updates: Partial<Vehicle>) => Promise<Vehicle | undefined>;
  onViewReport: () => void;
  onOpenTradeIn: () => void;
  onOpenDamage: () => void;
  onOpenChecklist: () => void;
  onBack: () => void;
}

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

export default function VehicleManager({
  vehicle, onUpdateVehicle, onViewReport, onOpenTradeIn, onOpenDamage, onOpenChecklist, onBack,
}: Props) {
  const [form, setForm] = React.useState({
    make: vehicle.make, model: vehicle.model, year: String(vehicle.year), trim: vehicle.trim,
    vin: vehicle.vin, color: vehicle.color, price: String(vehicle.price || ''),
    mileage: String(vehicle.mileage || ''), transmission: vehicle.transmission || 'Automatic',
    fuelType: vehicle.fuelType || 'Petrol', warranty: vehicle.warranty || '',
    servicePlan: vehicle.servicePlan || '', extras: vehicle.extras || '',
    customerName: vehicle.customerName || '', customerPhone: vehicle.customerPhone || '',
    customerEmail: vehicle.customerEmail || '',
    offerAmount: String(vehicle.purchaseOffer?.amount || ''), offerNote: vehicle.purchaseOffer?.note || '',
    offerDeposit: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [otpOpen, setOtpOpen] = React.useState(false);

  React.useEffect(() => {
    setForm({
      make: vehicle.make, model: vehicle.model, year: String(vehicle.year), trim: vehicle.trim,
      vin: vehicle.vin, color: vehicle.color, price: String(vehicle.price || ''),
      mileage: String(vehicle.mileage || ''), transmission: vehicle.transmission || 'Automatic',
      fuelType: vehicle.fuelType || 'Petrol', warranty: vehicle.warranty || '',
      servicePlan: vehicle.servicePlan || '', extras: vehicle.extras || '',
      customerName: vehicle.customerName || '', customerPhone: vehicle.customerPhone || '',
      customerEmail: vehicle.customerEmail || '',
      offerAmount: String(vehicle.purchaseOffer?.amount || ''), offerNote: vehicle.purchaseOffer?.note || '',
      offerDeposit: '',
    });
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
  });

  const handleSave = async () => {
    setSaving(true);
    await onUpdateVehicle(vehicle, buildUpdates());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const readiness = computeInspectionReadiness(vehicle, DEFAULT_TEMPLATE);
  const requiredSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
  const requiredTaken = requiredSlots.filter((s) => vehicle.photos?.[s.id]).length;
  const totalRequired = requiredSlots.length;
  const pct = Math.round((requiredTaken / totalRequired) * 100);
  const damageCount = vehicle.damageFindings ? Object.values(vehicle.damageFindings).flat().length : 0;
  const inspectionDone = vehicle.inspectionPoints && Object.keys(vehicle.inspectionPoints).length > 0;
  const photoSlots = DEFAULT_TEMPLATE.slots.filter((s) => vehicle.photos?.[s.id]);

  const dealerName = (typeof localStorage !== 'undefined' && localStorage.getItem('trulens_dealer_name')) || 'our dealership';
  const vehLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const reportId = deriveReportId(vehicle, 'VIR');

  const reportMessage = `Hi${form.customerName ? ' ' + form.customerName : ''}, here is the inspection report for the ${vehLabel} (Ref ${reportId}) from ${dealerName}.`;

  const hasPhone = !!form.customerPhone.trim();
  const hasEmail = !!form.customerEmail.trim();

  const generateOtp = async () => {
    const amt = parseFloat(form.offerAmount) || 0;
    await onUpdateVehicle(vehicle, {
      ...buildUpdates(),
      purchaseOffer: { amount: amt, note: form.offerNote, status: 'sent', sentAt: new Date().toISOString() },
    });
    setOtpOpen(true);
  };

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
        <button onClick={handleSave} disabled={saving} className="btn-primary on-fill flex items-center gap-2 px-4 text-[13px] cursor-pointer" style={{ minHeight: 40 }}>
          {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
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
            <p className="ti-stat-value">R {(vehicle.price || 0).toLocaleString('en-ZA')}</p>
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

        {/* Offer to purchase */}
        <section className="ti-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="ti-section-title"><HandCoins size={14} style={{ color: 'var(--cyan)' }} /> Offer to Purchase</h3>
            {vehicle.purchaseOffer?.status === 'sent' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--cyan-faint)', color: 'var(--cyan)' }}>
                Sent {vehicle.purchaseOffer.sentAt ? new Date(vehicle.purchaseOffer.sentAt).toLocaleDateString('en-ZA') : ''}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Total Price incl VAT (R)</label><input className={inputCls} type="number" value={form.offerAmount} onChange={set('offerAmount')} placeholder="0" /></div>
            <div><label className={labelCls}>Deposit (R)</label><input className={inputCls} type="number" value={form.offerDeposit} onChange={set('offerDeposit')} placeholder="0" /></div>
            <div><label className={labelCls}>Note (optional)</label><input className={inputCls} value={form.offerNote} onChange={set('offerNote')} placeholder="e.g. Valid 7 days, subject to finance" /></div>
          </div>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            Generates a formal OTP deed (VAT breakdown, Voetstoots &amp; POPI clauses, signature lines) — print to PDF or send. TruInspect stops at the offer; invoicing lives in your PMS.
          </p>
          <button disabled={!form.offerAmount} onClick={generateOtp} className="btn-primary on-fill flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed w-full" style={{ minHeight: 46 }}>
            <FileText size={15} /> Generate Offer to Purchase (OTP)
          </button>
        </section>

        {/* Photos */}
        <section className="ti-card p-5 space-y-4">
          <h3 className="ti-section-title"><Camera size={14} style={{ color: 'var(--cyan)' }} /> Photos ({requiredTaken}/{totalRequired})</h3>
          {photoSlots.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: 'var(--muted)' }}>No photos captured yet — field workers capture these on their phones.</p>
          ) : (
            <div className="grid grid-cols-4 xl:grid-cols-6 gap-2">
              {photoSlots.map((slot) => (
                <div key={slot.id} className="relative aspect-[4/3] rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-line)' }}>
                  <img src={vehicle.photos[slot.id]} alt={slot.label} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                    <p className="text-[10px] truncate" style={{ color: 'var(--white-dim)' }}>{slot.label}</p>
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
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{f.panel} · {slot?.label || slotId}</p>
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

      {otpOpen && (
        <OtpDocument
          vehicle={vehicle}
          amount={parseFloat(form.offerAmount) || 0}
          deposit={parseFloat(form.offerDeposit) || 0}
          note={form.offerNote}
          customer={{ name: form.customerName, phone: form.customerPhone, email: form.customerEmail }}
          onClose={() => setOtpOpen(false)}
        />
      )}
    </div>
  );
}
