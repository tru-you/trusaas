import React from 'react';
import { ArrowLeft, Save, FileText, ShoppingCart, Shield, AlertTriangle, Camera, Pencil, CheckCircle2, Upload } from 'lucide-react';
import { Vehicle } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { computeInspectionReadiness } from '../lib/readiness';

interface Props {
  vehicle: Vehicle;
  onUpdateVehicle: (vehicle: Vehicle, updates: Partial<Vehicle>) => Promise<Vehicle | undefined>;
  onViewReport: () => void;
  onOpenTradeIn: () => void;
  onOpenDamage: () => void;
  onOpenChecklist: () => void;
  onBack: () => void;
}

export default function VehicleManager({
  vehicle,
  onUpdateVehicle,
  onViewReport,
  onOpenTradeIn,
  onOpenDamage,
  onOpenChecklist,
  onBack,
}: Props) {
  const [make, setMake] = React.useState(vehicle.make);
  const [model, setModel] = React.useState(vehicle.model);
  const [year, setYear] = React.useState(String(vehicle.year));
  const [trim, setTrim] = React.useState(vehicle.trim);
  const [vin, setVin] = React.useState(vehicle.vin);
  const [color, setColor] = React.useState(vehicle.color);
  const [price, setPrice] = React.useState(String(vehicle.price || ''));
  const [mileage, setMileage] = React.useState(String(vehicle.mileage || ''));
  const [transmission, setTransmission] = React.useState(vehicle.transmission || 'Automatic');
  const [fuelType, setFuelType] = React.useState(vehicle.fuelType || 'Petrol');
  const [warranty, setWarranty] = React.useState(vehicle.warranty || '');
  const [servicePlan, setServicePlan] = React.useState(vehicle.servicePlan || '');
  const [extras, setExtras] = React.useState(vehicle.extras || '');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setMake(vehicle.make);
    setModel(vehicle.model);
    setYear(String(vehicle.year));
    setTrim(vehicle.trim);
    setVin(vehicle.vin);
    setColor(vehicle.color);
    setPrice(String(vehicle.price || ''));
    setMileage(String(vehicle.mileage || ''));
    setTransmission(vehicle.transmission || 'Automatic');
    setFuelType(vehicle.fuelType || 'Petrol');
    setWarranty(vehicle.warranty || '');
    setServicePlan(vehicle.servicePlan || '');
    setExtras(vehicle.extras || '');
    setSaved(false);
  }, [vehicle.id]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateVehicle(vehicle, {
      make, model, year: parseInt(year) || vehicle.year, trim, vin, color,
      price: parseFloat(price) || 0,
      mileage: parseInt(mileage) || undefined,
      transmission: transmission as Vehicle['transmission'],
      fuelType: fuelType as Vehicle['fuelType'],
      warranty, servicePlan, extras,
    });
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

  const Field = ({ label, value, onChange, type = 'text', placeholder = '' }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-[16px] font-bold text-[#E8EAE6]">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <p className="text-[12px] text-neutral-500">{vehicle.stockNumber || 'No stock #'} · <span style={{ color: readiness.color }}>{readiness.label}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-[#06080D] text-[13px] font-semibold transition"
          >
            {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-[11px] text-neutral-500">Photos</p>
            <p className="text-[18px] font-bold text-[#E8EAE6] mt-0.5">{requiredTaken}/{totalRequired}</p>
            <div className="w-full h-1 bg-neutral-800 rounded-full mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-[11px] text-neutral-500">Damage Tags</p>
            <p className={`text-[18px] font-bold mt-0.5 ${damageCount > 0 ? 'text-amber-400' : 'text-neutral-600'}`}>{damageCount}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-[11px] text-neutral-500">Inspection</p>
            <p className={`text-[14px] font-semibold mt-1 ${inspectionDone ? 'text-emerald-400' : 'text-neutral-600'}`}>
              {inspectionDone ? 'Complete' : 'Pending'}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <p className="text-[11px] text-neutral-500">Price</p>
            <p className="text-[18px] font-bold text-[#E8EAE6] mt-0.5">R {(vehicle.price || 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Vehicle details */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
            <h3 className="text-[14px] font-semibold text-[#E8EAE6] flex items-center gap-2">
              <Pencil size={14} className="text-cyan-400" /> Vehicle Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make" value={make} onChange={setMake} />
              <Field label="Model" value={model} onChange={setModel} />
              <Field label="Year" value={year} onChange={setYear} type="number" />
              <Field label="Trim" value={trim} onChange={setTrim} />
              <Field label="VIN" value={vin} onChange={setVin} />
              <Field label="Colour" value={color} onChange={setColor} />
              <Field label="Price (R)" value={price} onChange={setPrice} type="number" />
              <Field label="Mileage (km)" value={mileage} onChange={setMileage} type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Transmission</label>
                <select
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Fuel Type</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
            </div>
          </section>

          {/* T&Cs and extras */}
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
            <h3 className="text-[14px] font-semibold text-[#E8EAE6] flex items-center gap-2">
              <FileText size={14} className="text-cyan-400" /> Warranty, Service & Extras
            </h3>
            <div>
              <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Warranty</label>
              <textarea
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                rows={2}
                placeholder="e.g. 3 year / 100 000 km factory warranty"
                className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Service Plan</label>
              <textarea
                value={servicePlan}
                onChange={(e) => setServicePlan(e.target.value)}
                rows={2}
                placeholder="e.g. Full service history, next service at 90 000 km"
                className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Extras / Features</label>
              <textarea
                value={extras}
                onChange={(e) => setExtras(e.target.value)}
                rows={3}
                placeholder="e.g. Sunroof, leather seats, reverse camera, park sensors"
                className="w-full px-3 py-2 rounded-lg text-[13px] bg-neutral-900 border border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40 resize-none"
              />
            </div>
          </section>
        </div>

        {/* Photo gallery */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#E8EAE6] flex items-center gap-2">
              <Camera size={14} className="text-cyan-400" /> Photos ({requiredTaken}/{totalRequired})
            </h3>
          </div>
          {photoSlots.length === 0 ? (
            <p className="text-[13px] text-neutral-500 py-4 text-center">No photos captured yet — field workers capture these on their phones.</p>
          ) : (
            <div className="grid grid-cols-4 xl:grid-cols-6 gap-2">
              {photoSlots.map((slot) => (
                <div key={slot.id} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
                  <img
                    src={vehicle.photos[slot.id]}
                    alt={slot.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                    <p className="text-[10px] text-neutral-300 truncate">{slot.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Damage overview */}
        {damageCount > 0 && (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#E8EAE6] flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" /> Damage Findings ({damageCount})
              </h3>
              <button
                onClick={onOpenDamage}
                className="text-[12px] text-cyan-400 hover:text-cyan-300 transition"
              >
                Edit Damage Tags
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, findings]) =>
                findings.map((f) => {
                  const slot = DEFAULT_TEMPLATE.slots.find((s) => s.id === slotId);
                  const severityColors: Record<number, string> = {
                    1: 'text-neutral-400', 2: 'text-yellow-400', 3: 'text-amber-400', 4: 'text-orange-400', 5: 'text-red-400',
                  };
                  return (
                    <div key={f.id} className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#E8EAE6] capitalize">{f.damageType}</span>
                        <span className={`text-[11px] font-mono ${severityColors[f.severity] || 'text-neutral-500'}`}>
                          Sev {f.severity}/5
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{f.panel} · {slot?.label || slotId}</p>
                      {f.note && <p className="text-[11px] text-neutral-400 mt-1">{f.note}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <button onClick={onViewReport} className="flex items-center gap-2 justify-center px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60 text-[13px] font-semibold text-[#E8EAE6] transition">
            <FileText size={15} className="text-cyan-400" /> View Report
          </button>
          <button onClick={onOpenTradeIn} className="flex items-center gap-2 justify-center px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60 text-[13px] font-semibold text-[#E8EAE6] transition">
            <ShoppingCart size={15} className="text-cyan-400" /> Trade-In
          </button>
          <button onClick={onOpenDamage} className="flex items-center gap-2 justify-center px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60 text-[13px] font-semibold text-[#E8EAE6] transition">
            <AlertTriangle size={15} className="text-amber-400" /> Damage Tags
          </button>
          <button onClick={onOpenChecklist} className="flex items-center gap-2 justify-center px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/60 text-[13px] font-semibold text-[#E8EAE6] transition">
            <CheckCircle2 size={15} className="text-emerald-400" /> Inspection
          </button>
        </div>
      </div>
    </div>
  );
}
