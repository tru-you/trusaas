import React from 'react';
import { Building2, FileText, CheckCircle2 } from 'lucide-react';

const inputCls = 'ti-input';
const labelCls = 'ti-field-label';

/** Manager settings — dealer identity + trade-in T&Cs, the branding that lands
 *  on every VIR, trade-in report and offer. Same localStorage keys the mobile
 *  settings tab uses (trulens_dealer_*), so phone and desktop stay in sync on a
 *  shared device and reports render the same either way. */
export default function DesktopSettings() {
  const get = (k: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : '') || '';
  const [f, setF] = React.useState({
    name: get('trulens_dealer_name'),
    branch: get('trulens_dealer_branch'),
    phone: get('trulens_dealer_phone'),
    email: get('trulens_dealer_email'),
    whatsapp: get('trulens_dealer_wa'),
    vat: get('trulens_dealer_vat'),
    address: get('trulens_dealer_address'),
    tcs: get('trulens_tradein_tcs'),
  });
  const [saved, setSaved] = React.useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  // Auto-save on change (mirrors the mobile settings behaviour)
  React.useEffect(() => {
    localStorage.setItem('trulens_dealer_name', f.name);
    localStorage.setItem('trulens_dealer_branch', f.branch);
    localStorage.setItem('trulens_dealer_phone', f.phone);
    localStorage.setItem('trulens_dealer_email', f.email);
    localStorage.setItem('trulens_dealer_wa', f.whatsapp);
    localStorage.setItem('trulens_dealer_vat', f.vat);
    localStorage.setItem('trulens_dealer_address', f.address);
    localStorage.setItem('trulens_tradein_tcs', f.tcs);
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
  }, [f]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-semibold" style={{ color: 'var(--white)', letterSpacing: 'var(--track-h2)' }}>Settings</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>Dealer identity &amp; terms — printed on every report and offer.</p>
          </div>
          <span className="text-[12px] flex items-center gap-1.5 transition-opacity" style={{ color: 'var(--cyan)', opacity: saved ? 1 : 0 }}>
            <CheckCircle2 size={13} /> Saved
          </span>
        </div>

        <section className="ti-card p-5 space-y-4">
          <h3 className="ti-section-title"><Building2 size={14} style={{ color: 'var(--cyan)' }} /> Dealer Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={labelCls}>Dealership Name</label><input className={inputCls} value={f.name} onChange={set('name')} placeholder="e.g. Cars at Caledon" /></div>
            <div><label className={labelCls}>Branch</label><input className={inputCls} value={f.branch} onChange={set('branch')} placeholder="e.g. Caledon" /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={f.phone} onChange={set('phone')} placeholder="021 000 0000" style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={f.email} onChange={set('email')} placeholder="sales@dealer.co.za" style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className={labelCls}>WhatsApp</label><input className={inputCls} value={f.whatsapp} onChange={set('whatsapp')} placeholder="082 000 0000" style={{ fontFamily: 'var(--mono)' }} /></div>
            <div><label className={labelCls}>VAT / Reg No</label><input className={inputCls} value={f.vat} onChange={set('vat')} placeholder="4xxxxxxxxx" style={{ fontFamily: 'var(--mono)' }} /></div>
          </div>
          <div><label className={labelCls}>Address</label>
            <textarea className={inputCls} rows={2} value={f.address} onChange={set('address')} placeholder="Street, town, postal code" /></div>
        </section>

        <section className="ti-card p-5 space-y-4">
          <h3 className="ti-section-title"><FileText size={14} style={{ color: 'var(--cyan)' }} /> Trade-In Terms &amp; Conditions</h3>
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>Printed on the trade-in appraisal and offer. Leave blank to omit.</p>
          <textarea className={inputCls} rows={6} value={f.tcs} onChange={set('tcs')} placeholder={'e.g. This appraisal is valid for 7 days and subject to a final physical inspection…'} />
        </section>
      </div>
    </div>
  );
}
