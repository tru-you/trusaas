import React from 'react';
import { X, Plus } from 'lucide-react';
import { Vehicle } from '../types';

interface Props {
  onClose: () => void;
  onAdd: (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => void;
}

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

export default function AddVehicleDialog({ onClose, onAdd }: Props) {
  const [f, setF] = React.useState({
    make: '', model: '', year: String(new Date().getFullYear()), trim: '',
    vin: '', stockNumber: '', color: '', price: '', mileage: '',
    transmission: 'Automatic', fuelType: 'Petrol',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const canSubmit = f.make.trim() && f.model.trim() && f.mileage.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAdd({
      make: f.make.trim(), model: f.model.trim(), year: Number(f.year), trim: f.trim.trim(),
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label className={labelCls}>Make *</label><input className={inputCls} value={f.make} onChange={set('make')} placeholder="Toyota" autoFocus /></div>
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
