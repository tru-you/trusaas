import React from 'react';
import { X, Printer, MessageCircle, Mail, Shield } from 'lucide-react';
import { Vehicle } from '../types';
import { deriveReportId } from '../types/inspection';
import { telHref, mailtoHref, whatsappHref, openContact } from '../lib/contact';

interface Props {
  vehicle: Vehicle;
  amount: number;
  deposit: number;
  note: string;
  customer: { name: string; phone: string; email: string };
  onClose: () => void;
}

const zar = (n: number) => 'R ' + Math.round(n || 0).toLocaleString('en-ZA');

/**
 * Offer to Purchase (OTP) — the one document TruInspect issues. Mirrors the
 * TruFlow OTP deed so a dealer running TruInspect standalone produces the same
 * paper. TruInspect stops here: signing/invoicing live in the PMS.
 */
export default function OtpDocument({ vehicle, amount, deposit, note, customer, onClose }: Props) {
  const ls = (k: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null) || '';
  const dealerName = vehicle.dealerName || ls('trulens_dealer_name') || 'Your Dealership';
  const dealerReg = ls('trulens_dealer_vat');
  const dealerAddress = ls('trulens_dealer_address');
  const dealerPhone = vehicle.dealerPhone || ls('trulens_dealer_phone');

  const exVat = amount / 1.15;
  const vat = amount - exVat;
  const ref = 'OTP-' + deriveReportId(vehicle, 'OTP').replace(/^OTP-/, '');
  const today = new Date().toISOString().slice(0, 10);
  const vehLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const handlePrint = () => {
    const content = document.getElementById('ti-otp-paper')?.innerHTML || '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Offer to Purchase — ${ref}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #06080D; background: #fff; }
        h1 { text-align:center; font-size:20px; font-weight:600; margin:0 0 4px; }
        .sub { text-align:center; font-size:11px; color:#6E7681; letter-spacing:2px; margin-bottom:28px; font-family:ui-monospace,monospace; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:24px; font-size:12px; line-height:1.6; }
        .label { color:#6E7681; font-weight:600; font-size:11px; letter-spacing:1px; }
        .panel { background:#F2F3F0; border:1px solid rgba(6,8,13,0.12); border-radius:6px; padding:15px; margin-bottom:24px; font-size:12px; }
        .terms { font-size:11px; line-height:1.7; color:#21262D; padding:12px; border:1px solid rgba(6,8,13,0.12); border-radius:6px; background:#F2F3F0; margin-bottom:28px; }
        .sign { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:40px; font-size:12px; }
        .sline { border-top:1px solid #30363D; padding-top:8px; margin-top:50px; }
        b { color:#06080D; }
      </style></head><body>${content}<script>window.print()</script></body></html>`);
    win.document.close();
  };

  const shareMsg = `Hi${customer.name ? ' ' + customer.name : ''}, please find the Offer to Purchase (${ref}) for the ${vehLabel} at ${zar(amount)} from ${dealerName}.${note ? ' ' + note : ''}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="ti-card w-full max-w-3xl my-8" style={{ boxShadow: 'var(--shadow-modal)' }} onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--glass-line)' }}>
          <h2 className="text-[16px] font-semibold" style={{ color: 'var(--white)' }}>Offer to Purchase (OTP)</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="tru-btn-secondary flex items-center gap-2 px-3 text-[13px] cursor-pointer" style={{ minHeight: 38 }}>
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="tru-btn-ghost h-9 w-9 flex items-center justify-center cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        {/* Paper */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div id="ti-otp-paper" className="bg-white rounded-xl p-8 mx-auto relative" style={{ color: '#06080D', maxWidth: 760 }}>
            <div className="absolute top-6 right-6 flex items-center gap-1 text-[11px] font-semibold tracking-wider select-none" style={{ color: '#9AA0A6' }}>
              <Shield size={14} /> SECURED DOCUMENT
            </div>
            <h1 className="text-center text-[20px] font-semibold">Offer to Purchase (OTP)</h1>
            <div className="text-center text-[11px] font-semibold tracking-widest mb-7" style={{ color: '#6E7681', fontFamily: 'ui-monospace, monospace' }}>
              Reference Index: {ref}
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-[12px] leading-relaxed pb-6" style={{ color: '#21262D', borderBottom: '1px solid rgba(6,8,13,0.08)' }}>
              <div>
                <div className="font-semibold mb-2 tracking-wider text-[11px]" style={{ color: '#6E7681' }}>PART A: DEALER MERCHANT</div>
                <div className="font-semibold" style={{ color: '#06080D' }}>{dealerName}</div>
                {dealerReg && <div>VAT / Reg No: {dealerReg}</div>}
                {dealerAddress && dealerAddress.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                {dealerPhone && <div>Tel: {dealerPhone}</div>}
              </div>
              <div>
                <div className="font-semibold mb-2 tracking-wider text-[11px]" style={{ color: '#6E7681' }}>PART B: PURCHASER</div>
                {customer.name ? (
                  <>
                    <div className="font-semibold" style={{ color: '#06080D' }}>{customer.name}</div>
                    {customer.phone && <div>Phone: {customer.phone}</div>}
                    {customer.email && <div>Email: {customer.email}</div>}
                  </>
                ) : (
                  <div className="italic" style={{ color: '#9AA0A6' }}>Walk-In Client Account</div>
                )}
              </div>
            </div>

            {/* Asset */}
            <div className="rounded-lg p-4 mb-6 text-[12px]" style={{ background: '#F2F3F0', border: '1px solid rgba(6,8,13,0.12)', color: '#21262D' }}>
              <div className="font-semibold mb-2" style={{ color: '#06080D' }}>Vehicle Identification:</div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div><span style={{ color: '#6E7681' }}>Year:</span> <b>{vehicle.year || 'N/A'}</b></div>
                <div><span style={{ color: '#6E7681' }}>Make:</span> <b>{vehicle.make || 'N/A'}</b></div>
                <div><span style={{ color: '#6E7681' }}>Model:</span> <b>{vehicle.model} {vehicle.trim}</b></div>
                <div><span style={{ color: '#6E7681' }}>Stock #:</span> <b style={{ fontFamily: 'ui-monospace, monospace' }}>{vehicle.stockNumber || 'N/A'}</b></div>
                <div><span style={{ color: '#6E7681' }}>VIN:</span> <b style={{ fontFamily: 'ui-monospace, monospace' }}>{vehicle.vin || 'N/A'}</b></div>
                <div><span style={{ color: '#6E7681' }}>Mileage:</span> <b>{vehicle.mileage ? vehicle.mileage.toLocaleString('en-ZA') + ' km' : 'N/A'}</b></div>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-[12px] rounded-lg p-4" style={{ background: '#F2F3F0', border: '1px solid rgba(6,8,13,0.12)', color: '#21262D' }}>
              <div><span style={{ color: '#6E7681' }}>Purchase Price (Ex VAT):</span> <b>{zar(exVat)}</b></div>
              <div><span style={{ color: '#6E7681' }}>Deposit / Downpayment:</span> <b style={{ color: '#22807C' }}>{zar(deposit)}</b></div>
              <div><span style={{ color: '#6E7681' }}>Standard 15% VAT:</span> <b>{zar(vat)}</b></div>
              <div><span className="text-[14px] font-semibold" style={{ color: '#6E7681' }}>Total (Incl VAT):</span> <b className="text-[14px]" style={{ fontFamily: 'ui-monospace, monospace' }}>{zar(amount)}</b></div>
            </div>

            {/* Legal */}
            <div className="text-[11px] leading-relaxed rounded-lg p-4 mb-6" style={{ color: '#3A4149', background: '#F2F3F0', border: '1px solid rgba(6,8,13,0.12)' }}>
              <div className="font-semibold mb-1" style={{ color: '#06080D' }}>1. OFFER &amp; ACCEPTANCE:</div>
              This Offer to Purchase (OTP) constitutes a formal, binding offer for submission to financing agencies or direct cash payment. The offer remains valid for 7 calendar days from sign-off.
              <div className="font-semibold mt-2 mb-1" style={{ color: '#06080D' }}>2. VOETSTOOTS (AS-IS):</div>
              The vehicle is offered Voetstoots with any standard factory warranties continuing where applicable. The purchaser acknowledges the inspection report supplied with this offer.
              <div className="font-semibold mt-2 mb-1" style={{ color: '#06080D' }}>3. POPI ACT:</div>
              Personal information is processed under the Protection of Personal Information (POPI) Act. {note && <span><br />Note: {note}</span>}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-8 text-[12px] pt-6" style={{ borderTop: '1px solid rgba(6,8,13,0.08)' }}>
              <div className="flex flex-col">
                <div style={{ height: 44, borderBottom: '1px solid #6E7681' }} />
                <div className="font-semibold mt-2" style={{ color: '#06080D' }}>Dealer Representative</div>
                <div className="text-[11px] mt-0.5" style={{ color: '#9AA0A6' }}>Date: {today}</div>
              </div>
              <div className="flex flex-col">
                <div style={{ height: 44, borderBottom: '1px solid #6E7681' }} />
                <div className="font-semibold mt-2" style={{ color: '#06080D' }}>Purchaser</div>
                <div className="text-[11px] mt-0.5" style={{ color: '#9AA0A6' }}>Date: Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Send */}
        <div className="px-5 py-4 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--glass-line)' }}>
          <button disabled={!customer.phone} onClick={() => openContact(whatsappHref(customer.phone, shareMsg))} className="btn-primary on-fill flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 44 }}>
            <MessageCircle size={15} /> Send via WhatsApp
          </button>
          <button disabled={!customer.email} onClick={() => openContact(mailtoHref(customer.email, `Offer to Purchase — ${vehLabel}`, shareMsg))} className="tru-btn-secondary flex items-center justify-center gap-2 text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={{ minHeight: 44 }}>
            <Mail size={15} /> Send via Email
          </button>
        </div>
      </div>
    </div>
  );
}
