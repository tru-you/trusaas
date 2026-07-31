import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Star, Pen, Clock } from 'lucide-react';
import { Vehicle } from '../types';
import {
  InspectionItem, ValuationState, TradeInData,
  computeOverallRating, needsReconCost, deriveReportId,
} from '../types/inspection';
import truinspectLogo from '../assets/images/truinspect-logo.svg';
import trudealerLockup from '../assets/images/trudealer-lockup.png';

interface TradeInSummaryProps {
  vehicle: Vehicle;
  items: InspectionItem[];
  valuation: ValuationState;
  onBack: () => void;
  onSave: (data: TradeInData) => Promise<void>;
}

export default function TradeInSummary({ vehicle, items, valuation, onBack, onSave }: TradeInSummaryProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(
    vehicle.tradeInData?.dealerDetails?.digitalSignatureUrl || null
  );
  const [isDrawing, setIsDrawing] = useState(false);

  const [inspectorName, setInspectorName] = useState(
    vehicle.tradeInData?.dealerDetails?.inspectorName ||
    vehicle.inspectorName ||
    localStorage.getItem('trulens_inspector_name') || ''
  );
  const [contactPhone, setContactPhone] = useState(
    vehicle.tradeInData?.dealerDetails?.contactPhone ||
    vehicle.dealerPhone ||
    localStorage.getItem('trulens_dealer_phone') || ''
  );

  const dealerName =
    vehicle.dealerName ||
    localStorage.getItem('trulens_dealer_name') || '';

  const overallRating = computeOverallRating(items);
  const totalRecon = items.reduce((s, i) => s + i.estimatedRepairCost, 0);
  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA')}`;
  const now = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const ratingLabel =
    overallRating >= 4.5 ? 'Excellent' :
    overallRating >= 3.5 ? 'Good' :
    overallRating >= 2.5 ? 'Fair' : 'Poor';

  const ratingColor =
    overallRating >= 4.5 ? '#16A34A' :
    overallRating >= 3.5 ? '#65A30D' :
    overallRating >= 2.5 ? '#CA8A04' : '#DC2626';

  const photosWithLabel = items.filter(i => i.photoUrl);

  // Signature canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    setSignatureUrl(url);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl(null);
  };

  const buildTradeInData = (): TradeInData => ({
    inspectionId: deriveReportId(vehicle),
    vehicleDetails: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      variant: vehicle.trim,
      mileage: vehicle.mileage || 0,
      vin: vehicle.vin,
      overallRating,
    },
    dealerDetails: {
      dealershipName: dealerName,
      inspectorName,
      contactPhone,
      digitalSignatureUrl: signatureUrl,
    },
    valuation: { ...valuation, totalReconCost: totalRecon },
    items,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(buildTradeInData());
    } finally {
      setSaving(false);
    }
  };

  /* Render straight from the live report node — matches TruLens, which downloads
   * reliably. No offscreen clone: photos are "/media/…" URLs already painted on
   * screen, so html2canvas rasterises the live node cleanly. */
  const handleExportPdf = async () => {
    const el = reportRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `TradeIn_${vehicle.stockNumber || 'draft'}.pdf`,
          image: { type: 'jpeg', quality: 0.92 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        } as any)
        .from(el)
        .save();
    } catch (err) {
      console.error(err);
      alert('PDF failed — use Save Report (HTML) or Print → Save as PDF.');
    } finally {
      setExporting(false);
    }
  };

  /* Self-contained HTML export — the reliable path on a phone.
   *
   * html2canvas (the PDF route) rasterises the whole report in memory and
   * routinely runs out of it on a mobile browser. This clones the report,
   * inlines every image as a data URI so the file opens offline / after being
   * emailed, and downloads one .html — which every mobile browser can save and
   * share. Photos are "/media/…" URLs now, so they must be fetched and embedded
   * or the saved file would point at nothing. */
  const handleExportHtml = async () => {
    const el = reportRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const clone = el.cloneNode(true) as HTMLElement;
      const images = Array.from(clone.querySelectorAll('img'));
      await Promise.all(
        images.map(async (img) => {
          const src = img.getAttribute('src') || '';
          if (!src || src.startsWith('data:')) return; // already inline
          try {
            const res = await fetch(src, { cache: 'force-cache' });
            if (!res.ok) return;
            const blob = await res.blob();
            const dataUri = await new Promise<string>((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result));
              fr.onerror = () => reject(fr.error);
              fr.readAsDataURL(blob);
            });
            img.setAttribute('src', dataUri);
          } catch {
            /* One unreachable photo must not cost the whole report. */
          }
        })
      );
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TruInspect Trade-In · ${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.stockNumber || ''}</title><style>*{box-sizing:border-box}body{margin:0;background:#F1F5F9;padding:16px;overflow-x:hidden}</style></head><body>${clone.outerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TradeIn_${vehicle.stockNumber || 'draft'}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setExporting(false);
    }
  };

  const stars = Array.from({ length: 5 }, (_, i) => i + 1 <= Math.floor(overallRating));
  const halfStar = overallRating % 1 >= 0.3;

  const categories = [
    { name: 'Front & Engine', items: items.filter(i => i.category === 'Front & Engine') },
    { name: 'Clockwise Exterior', items: items.filter(i => i.category === 'Clockwise Exterior') },
    { name: 'Interior, History & Verification', items: items.filter(i => i.category === 'Interior, History & Verification') },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass p-4 border-b border-cyan-500/20 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[16px] font-bold tracking-tight">Trade-In Summary</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportHtml}
            disabled={exporting}
            title="Downloads a single file with every photo embedded — opens offline and survives being emailed"
            className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={13} /> HTML
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-[12px] font-semibold flex items-center gap-1.5"
          >
            <Printer size={13} /> Print
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-3 py-2 rounded-lg text-[#0B0F17] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(120deg, #7FF0EA, #4FE3DC)' }}
          >
            <Download size={13} /> {exporting ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* ===== PRINTABLE REPORT (white bg for export) ===== */}
        <div
          ref={reportRef}
          className="mx-auto max-w-[210mm] bg-white text-gray-900 p-6"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '12px', lineHeight: '1.5' }}
        >
          {/* Cover header */}
          <div style={{ background: 'linear-gradient(135deg,#0B0F17 0%,#1E293B 55%,#0B3B5A 100%)', borderRadius: '12px', padding: '24px 20px 20px', marginBottom: '20px', color: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <img src={truinspectLogo} alt="TruInspect" style={{ height: 40, width: 'auto' }} />
                <p style={{ fontSize: '11px', fontWeight: 600, opacity: 0.75, marginTop: 6 }}>{dealerName}</p>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: 'rgba(248,250,252,.62)' }}>
                <img src={trudealerLockup} alt="TruDealer" style={{ height: 26, width: 'auto', display: 'block', marginLeft: 'auto', marginBottom: 6 }} />
                <div>ID: {deriveReportId(vehicle)}</div>
                <div><Clock size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{now}</div>
              </div>
            </div>
            <div style={{ width: 50, height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#4FE3DC,#4D9BFF)', marginBottom: 10 }} />
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(79,227,220,.7)', marginBottom: 6 }}>TRADE-IN APPRAISAL REPORT</div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', color: '#F8FAFC', letterSpacing: '-0.025em' }}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p style={{ fontSize: '13px', color: 'rgba(248,250,252,.72)', margin: 0 }}>
              {vehicle.trim} · Stock <b>{vehicle.stockNumber}</b>
            </p>
          </div>

          {/* Vehicle details + rating */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <table style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ color: '#6B7280', paddingRight: '16px' }}>Variant</td><td style={{ fontWeight: 600 }}>{vehicle.trim || '—'}</td></tr>
                  <tr><td style={{ color: '#6B7280', paddingRight: '16px' }}>Mileage</td><td style={{ fontWeight: 600 }}>{(vehicle.mileage || 0).toLocaleString('en-ZA')} km</td></tr>
                  <tr><td style={{ color: '#6B7280', paddingRight: '16px' }}>VIN</td><td style={{ fontWeight: 600 }}>{vehicle.vin || '—'}</td></tr>
                  <tr><td style={{ color: '#6B7280', paddingRight: '16px' }}>Stock #</td><td style={{ fontWeight: 600 }}>{vehicle.stockNumber || '—'}</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 24px', border: `2px solid ${ratingColor}`, borderRadius: '12px' }}>
              <p style={{ fontSize: '28px', fontWeight: 800, color: ratingColor, margin: 0 }}>
                {overallRating.toFixed(1)}
              </p>
              <p style={{ fontSize: '11px', color: ratingColor, fontWeight: 600, margin: 0 }}>/ 5.0</p>
              <p style={{ fontSize: '12px', fontWeight: 700, color: ratingColor, margin: '4px 0 0' }}>{ratingLabel}</p>
            </div>
          </div>

          {/* Photo gallery */}
          {photosWithLabel.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0D9488', borderBottom: '2px solid #0D9488', paddingBottom: '4px', marginBottom: '10px' }}>
                  Inspection Photos ({photosWithLabel.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {photosWithLabel.map((it) => (
                    <div key={it.id} style={{ position: 'relative' }}>
                      <img
                        src={it.photoUrl!}
                        alt={it.label}
                        style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E5E7EB' }}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,.7))', borderRadius: '0 0 6px 6px', padding: '2px 4px' }}>
                        <span style={{ fontSize: '8px', color: '#fff', fontWeight: 600 }}>{it.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
          )}

          {/* Valuation banner — margin is applied but not itemised on the report */}
          <div style={{ background: '#F0FDFA', border: '2px solid #0D9488', borderRadius: '12px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.12em', color: '#0D9488', margin: '0 0 6px' }}>TRADE-IN OFFER</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#0D9488', margin: 0 }}>
              {fmt(valuation.finalTradeInValue)}
            </p>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '8px 0 0' }}>
              Based on current market retail pricing, less estimated reconditioning costs.
            </p>
          </div>

          {/* Itemized grid */}
          {categories.map((cat) => (
            <div key={cat.name} style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0D9488', borderBottom: '2px solid #0D9488', paddingBottom: '4px', marginBottom: '8px' }}>
                {cat.name}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {cat.items.map((it) => {
                  const bad = needsReconCost(it.status);
                  return (
                    <div
                      key={it.id}
                      style={{
                        border: `1px solid ${bad ? '#FCA5A5' : '#E5E7EB'}`,
                        borderRadius: '8px',
                        padding: '8px',
                        background: bad ? '#FEF2F2' : '#FAFAFA',
                        fontSize: '11px',
                      }}
                    >
                      {it.photoUrl && (
                        <img
                          src={it.photoUrl}
                          alt={it.label}
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '6px' }}
                        />
                      )}
                      <p style={{ fontWeight: 700, margin: '0 0 2px', fontSize: '11px' }}>{it.label}</p>
                      <p style={{ color: bad ? '#DC2626' : '#16A34A', fontWeight: 600, margin: 0 }}>{it.status.replace(/_/g, ' ')}</p>
                      <p style={{ color: '#6B7280', margin: 0 }}>{it.condition}</p>
                      {it.estimatedRepairCost > 0 && (
                        <p style={{ color: '#DC2626', fontWeight: 700, margin: '2px 0 0' }}>
                          Recon: {fmt(it.estimatedRepairCost)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Dealer sign-off */}
          <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '16px', marginTop: '24px', pageBreakInside: 'avoid' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0D9488', marginBottom: '12px' }}>
              Dealer Sign-Off
            </h3>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ color: '#6B7280', padding: '4px 0', width: '140px' }}>Dealership</td><td style={{ fontWeight: 600 }}>{dealerName}</td></tr>
                <tr><td style={{ color: '#6B7280', padding: '4px 0' }}>Inspector</td><td style={{ fontWeight: 600 }}>{inspectorName || '—'}</td></tr>
                <tr><td style={{ color: '#6B7280', padding: '4px 0' }}>Contact</td><td style={{ fontWeight: 600 }}>{contactPhone || '—'}</td></tr>
                <tr><td style={{ color: '#6B7280', padding: '4px 0' }}>Date</td><td style={{ fontWeight: 600 }}>{now}</td></tr>
              </tbody>
            </table>
            {signatureUrl && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '4px' }}>Digital Signature:</p>
                <img src={signatureUrl} alt="Signature" style={{ height: '60px', border: '1px solid #E5E7EB', borderRadius: '4px' }} />
              </div>
            )}
          </div>

          <div style={{ height: 3, background: 'linear-gradient(90deg,#4FE3DC,#4D9BFF,#4FE3DC)', marginTop: 24, borderRadius: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '12px 0', fontSize: '10px', color: '#64748B', fontFamily: 'ui-monospace, monospace', letterSpacing: '.08em' }}>
            <span>Prepared by <b style={{ color: '#0D9488' }}>{dealerName}</b> · powered by <b>TruInspect</b></span>
            <img src={trudealerLockup} alt="TruDealer" style={{ height: 18, width: 'auto' }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '9px', color: '#94A3B8', margin: 0 }}>
            Trade-in valuation at a moment in time — subject to physical verification.
          </p>
        </div>

        {/* === APP-ONLY SECTIONS (not in export ref) === */}
        <div className="p-4 space-y-4">
          {/* Dealer sign-off fields */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
            <h3 className="text-[13px] font-bold text-cyan-400">Inspector Details</h3>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Inspector name…"
              className="w-full px-3 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Contact phone…"
              className="w-full px-3 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {/* Digital signature canvas */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-cyan-400 flex items-center gap-2">
                <Pen size={14} /> Digital Signature
              </h3>
              <button
                type="button"
                onClick={clearSignature}
                className="text-[12px] text-neutral-500 hover:text-rose-400"
              >
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={320}
              height={120}
              className="w-full bg-white rounded-lg border border-neutral-300 touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Trade-In Appraisal'}
        </button>
      </div>
    </div>
  );
}
