import React, { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useTruCrm, localDay } from '../../context/TruCrmContext';
import { Lead, LeadSource, LeadTemperature, BuyerIntent } from '../../types/trucrm';
import { inputClass, labelClass } from './shared';

const SOURCES: LeadSource[] = [
  'Website',
  'AutoTrader',
  'Cars.co.za',
  'Facebook',
  'WhatsApp',
  'Walk-In',
  'Phone-In',
  'Referral',
  'Repeat Customer',
  'Service Drive',
];

export const NewLeadModal: React.FC<{ onClose: () => void; onCreated: (lead: Lead) => void }> = ({
  onClose,
  onCreated,
}) => {
  const { addLead, salespeople, settings } = useTruCrm();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [source, setSource] = useState<LeadSource>('Walk-In');
  const [temperature, setTemperature] = useState<LeadTemperature>('Warm');
  const [intent, setIntent] = useState<BuyerIntent>('Finance');
  const [salespersonId, setSalespersonId] = useState(salespeople[0]?.id || '');

  const [stockNumber, setStockNumber] = useState('');
  const [year, setYear] = useState('2023');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [mileage, setMileage] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [hasTrade, setHasTrade] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !make.trim() || !model.trim()) return;

    const askingPrice = Number(price) || 0;
    const lead = addLead({
      customerName: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      source,
      temperature,
      intent,
      stage: 'new',
      salespersonId,
      vehicle: {
        stockNumber: stockNumber.trim() || undefined,
        year: Number(year) || new Date().getFullYear(),
        make: make.trim(),
        model: model.trim(),
        variant: variant.trim() || undefined,
        mileage: Number(mileage) || undefined,
        askingPrice,
      },
      tradeIn: { status: hasTrade ? 'Declared' : 'None' },
      finance: { status: intent === 'Finance' ? 'Docs Outstanding' : 'Not Started' },
      dealSheet: {
        vehiclePrice: askingPrice,
        discount: 0,
        tradeAllowance: 0,
        tradeSettlement: 0,
        deposit: 0,
        vapsValue: 0,
        // Default stand-in to ~88% of asking so gross is a sane starting estimate.
        costOfSale: Number(cost) || Math.round(askingPrice * 0.88),
      },
      // A new up is due for contact immediately — that is the whole point.
      nextFollowUpDate: localDay(),
      nextFollowUpNote: 'New lead — make first contact.',
      tags: [],
    });

    onCreated(lead);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,20,32,0.40)] backdrop-blur">
      <form
        onSubmit={submit}
        className="bg-white border border-[rgba(10,20,32,0.08)] rounded-[18px] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white p-5 border-b border-[rgba(10,20,32,0.08)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#1A2332] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#0E9D98]" />
              Log a New Up
            </h3>
            <p className="text-[length:var(--t-micro)] text-[#6B7685] mt-0.5">
              Speed-to-lead target is {settings.speedToLeadTargetMins} minutes — this lead goes straight to today's queue.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685] mb-2.5">Customer</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Full name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Sipho Ndlovu" />
              </div>
              <div>
                <label className={labelClass}>Mobile *</label>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+27 82 000 0000" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>City / town</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685] mb-2.5">Lead detail</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={inputClass}>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned to</label>
                <select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)} className={inputClass}>
                  {salespeople.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Temperature</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Hot', 'Warm', 'Cold'] as LeadTemperature[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemperature(t)}
                      className={`py-2 rounded-xl text-[length:var(--t-micro)] font-medium border transition-all ${
                        temperature === t
                          ? 'bg-[#EFEDE8] border-[#0E9D98] text-[#1A2332]'
                          : 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)] text-[#6B7685] hover:text-[#1A2332]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Buying intent</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Cash', 'Finance', 'Undecided'] as BuyerIntent[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setIntent(t)}
                      className={`py-2 rounded-xl text-[length:var(--t-micro)] font-medium border transition-all ${
                        intent === t
                          ? 'bg-[#EFEDE8] border-[#0E9D98] text-[#1A2332]'
                          : 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)] text-[#6B7685] hover:text-[#1A2332]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[length:var(--t-micro)] font-medium text-[#6B7685] mb-2.5">Vehicle of interest</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Stock no.</label>
                <input value={stockNumber} onChange={(e) => setStockNumber(e.target.value)} className={inputClass} placeholder="STK-0000" />
              </div>
              <div>
                <label className={labelClass}>Year</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mileage (km)</label>
                <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Make *</label>
                <input required value={make} onChange={(e) => setMake(e.target.value)} className={inputClass} placeholder="Toyota" />
              </div>
              <div>
                <label className={labelClass}>Model *</label>
                <input required value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} placeholder="Hilux" />
              </div>
              <div>
                <label className={labelClass}>Variant</label>
                <input value={variant} onChange={(e) => setVariant(e.target.value)} className={inputClass} placeholder="2.8 GD-6 Raider" />
              </div>
              <div>
                <label className={labelClass}>Asking price ({settings.currency})</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Stand-in value</label>
                <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} placeholder="auto" />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setHasTrade(!hasTrade)}
                  className={`w-full py-2 rounded-xl text-[length:var(--t-micro)] font-medium border transition-all ${
                    hasTrade
                      ? 'bg-[#EFEDE8] border-[#0E9D98] text-[#1A2332]'
                      : 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)] text-[#6B7685] hover:text-[#1A2332]'
                  }`}
                >
                  {hasTrade ? '✓ Has trade-in' : 'Has trade-in?'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-5 border-t border-[rgba(10,20,32,0.08)] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[#6B7685] hover:text-[#1A2332] text-xs font-semibold">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-[#0E9D98] hover:bg-[#14B8A6] text-white rounded-xl text-xs font-medium">
            Create Lead & Open
          </button>
        </div>
      </form>
    </div>
  );
};
