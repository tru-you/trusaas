import React from 'react';
import { Plus, Phone, Mail, MessageCircle, Trash2, Search, Building2 } from 'lucide-react';
import { telHref, mailtoHref, whatsappHref, openContact } from '../lib/contact';

export interface Buyer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  deliveryAddress?: string;
  note?: string;
}

const KEY = 'truinspect_buyers';
const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

function load(): Buyer[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(list: Buyer[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/** Frequently-contacted buyers / businesses. Local to this device — a light
 *  contact book so a manager can reach a regular buyer without leaving the
 *  portal. Not a CRM; the PMS owns customer records. */
export default function BuyersList() {
  const [buyers, setBuyers] = React.useState<Buyer[]>(() => load());
  const [q, setQ] = React.useState('');
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', deliveryAddress: '', note: '' });

  const persist = (list: Buyer[]) => { setBuyers(list); save(list); };

  const add = () => {
    if (!form.name.trim()) return;
    const b: Buyer = {
      id: 'buyer-' + Math.floor(100000 + Math.random() * 900000),
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      deliveryAddress: form.deliveryAddress.trim() || undefined,
      note: form.note.trim() || undefined,
    };
    persist([b, ...buyers]);
    setForm({ name: '', phone: '', email: '', deliveryAddress: '', note: '' });
  };

  const remove = (id: string) => persist(buyers.filter((b) => b.id !== id));

  const filtered = buyers.filter((b) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return b.name.toLowerCase().includes(s) || (b.phone || '').includes(s) || (b.email || '').toLowerCase().includes(s);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold" style={{ color: 'var(--white)', letterSpacing: 'var(--track-h2)' }}>Buyers</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>Your frequently-contacted buyers and businesses.</p>
        </div>

        {/* Add buyer */}
        <section className="ti-card p-5 space-y-3">
          <h3 className="ti-section-title"><Plus size={14} style={{ color: 'var(--cyan)' }} /> Add Buyer</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Name / Business</label><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Buyer or dealership" /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="082 000 0000" style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@email.com" style={{ fontFamily: 'var(--mono)' }} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Delivery Address</label><input className={inputCls} value={form.deliveryAddress} onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))} placeholder="Where vehicles are delivered" /></div>
            <div><label className={labelCls}>Note</label><input className={inputCls} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. buys bakkies, cash" /></div>
          </div>
          <div className="flex justify-end">
            <button disabled={!form.name.trim()} onClick={add} className="btn-primary on-fill flex items-center gap-2 px-4 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 40 }}>
              <Plus size={14} /> Add Buyer
            </button>
          </div>
        </section>

        {/* Search + list */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
          <input className={`${inputCls} pl-10`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buyers…" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 size={40} style={{ color: 'var(--faint)' }} className="mb-3" />
            <p className="text-[14px]" style={{ color: 'var(--white-dim)' }}>{buyers.length === 0 ? 'No buyers yet' : 'No matches'}</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>Add the buyers you deal with most.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((b) => (
              <div key={b.id} className="ti-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold truncate" style={{ color: 'var(--white)' }}>{b.name}</h3>
                    {b.deliveryAddress && <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{b.deliveryAddress}</p>}
                    {b.note && <p className="text-[12px] mt-0.5" style={{ color: 'var(--white-dim)' }}>{b.note}</p>}
                  </div>
                  <button onClick={() => remove(b.id)} title="Remove" className="tru-btn-ghost h-8 w-8 flex items-center justify-center cursor-pointer shrink-0"><Trash2 size={13} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button disabled={!b.phone} onClick={() => b.phone && openContact(telHref(b.phone))} className="tru-btn-secondary flex items-center justify-center gap-1.5 text-[12px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 38 }}><Phone size={13} /> Call</button>
                  <button disabled={!b.email} onClick={() => b.email && openContact(mailtoHref(b.email))} className="tru-btn-secondary flex items-center justify-center gap-1.5 text-[12px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 38 }}><Mail size={13} /> Email</button>
                  <button disabled={!b.phone} onClick={() => b.phone && openContact(whatsappHref(b.phone))} className="tru-btn-secondary flex items-center justify-center gap-1.5 text-[12px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 38 }}><MessageCircle size={13} /> WA</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
