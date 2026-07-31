import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Download, Printer, Award, AlertTriangle, CheckCircle2,
  Camera, FileText, ClipboardList, Clock, Check, MessageCircle, Box,
} from 'lucide-react';
import { Vehicle, QualityReport, DamageFinding } from '../types';
import { computeWebReadiness, whatsAppSalesBlurb } from '../lib/readiness';
import { buildWeb3DPackage } from '../lib/web3dPackage';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_TEMPLATE } from '../templates';
import type { TemplateSlot } from '../template';
import { ICONS } from '../iconMap';
import trulensLockup from '../assets/images/trulens-wordmark.png';
import trudealerLockup from '../assets/images/trudealer-lockup.png';

interface ReportPreviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onVehicleUpdated?: (v: Vehicle) => void;
}

const CONDITION_SCALE = [
  { min: 4.5, band: '5.0 – 4.5', label: 'Excellent', meaning: 'Minor blemishes only. Retail ready.', color: '#16A34A' },
  { min: 3.5, band: '4.4 – 3.5', label: 'Good', meaning: 'Light cosmetic wear consistent with age.', color: '#65A30D' },
  { min: 2.5, band: '3.4 – 2.5', label: 'Fair', meaning: 'Visible defects recorded. Attention advised.', color: '#CA8A04' },
  { min: 0,   band: '2.4 – 1.0', label: 'Poor', meaning: 'Significant damage documented below.', color: '#DC2626' },
];

function conditionBand(stars: number | null) {
  if (stars === null) {
    return { label: 'Not yet assessed', meaning: 'No damage findings recorded.', color: '#475569' };
  }
  return CONDITION_SCALE.find(b => stars >= b.min) ?? CONDITION_SCALE[CONDITION_SCALE.length - 1];
}

function severityMeta(sev: number) {
  if (sev >= 5) return { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' };
  if (sev >= 4) return { label: 'Major', color: '#EA580C', bg: '#FFEDD5' };
  if (sev >= 3) return { label: 'Moderate', color: '#CA8A04', bg: '#FEF9C3' };
  if (sev >= 2) return { label: 'Minor', color: '#64748B', bg: '#F1F5F9' };
  return { label: 'Cosmetic', color: '#475569', bg: '#F8FAFC' };
}

function computeCondition(vehicle: Vehicle) {
  const all = Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, list]) =>
    (list || []).filter(f => f.confirmed !== false).map(f => ({ ...f, slotId }))
  );
  const sevPenalties = [0, 0.1, 0.25, 0.55, 1.0, 1.7];

  const slotsWithTags = new Set(all.map(f => f.slotId));
  const rawPenalties: number[] = all.map(f => sevPenalties[f.severity] ?? 0.3);

  const slotAssess = vehicle.slotAssessment || {};
  for (const [slotId, res] of Object.entries(slotAssess)) {
    if (slotsWithTags.has(slotId)) continue;
    if (res?.rating === 'damage') rawPenalties.push(0.5);
    else if (res?.rating === 'note') rawPenalties.push(0.15);
  }

  rawPenalties.sort((a, b) => b - a);
  const penalty = rawPenalties.reduce((s, p, i) => s + p / (i + 1), 0);

  const stars = Math.max(1, Math.round((5 - Math.min(4, penalty)) * 10) / 10);
  const hasInput = all.length > 0 || Object.keys(slotAssess).length > 0;
  const label =
    !hasInput ? 'Not yet assessed' :
    stars >= 4.5 ? 'Excellent — minor blemishes only' :
    stars >= 3.5 ? 'Good — light cosmetic wear' :
    stars >= 2.5 ? 'Fair — visible defects to address' :
    'Poor — significant damage documented';
  return { stars, label, findings: all, hasInput };
}

function captureBand(score: number | null) {
  if (score === null) return { label: 'Not captured', color: '#475569', bg: 'rgba(148,163,184,0.10)' };
  if (score >= 80) return { label: 'Good', color: '#16A34A', bg: 'rgba(34,197,94,0.12)' };
  if (score >= 60) return { label: 'Usable', color: '#CA8A04', bg: 'rgba(234,179,8,0.14)' };
  return { label: 'Re-shoot', color: '#DC2626', bg: 'rgba(239,68,68,0.14)' };
}

function scoreForSlots(vehicle: Vehicle, slots: TemplateSlot[]): number | null {
  const captured = slots.map(s => vehicle.quality?.[s.id]).filter(Boolean) as QualityReport[];
  if (captured.length === 0) return null;
  return Math.round(captured.reduce((sum, q) => sum + q.overallScore, 0) / captured.length);
}

const PHASES = DEFAULT_TEMPLATE.phases
  .filter(p => p.reportCard)
  .map(p => ({ id: p.id, name: p.reportCard!.label, icon: ICONS[p.reportCard!.iconKey] }));

export default function ReportPreview({ vehicle, onBack, onVehicleUpdated }: ReportPreviewProps) {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [waCopied, setWaCopied] = useState(false);
  const [generating, setGenerating] = useState<'full' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [web3dBusy, setWeb3dBusy] = useState(false);
  const [web3dMsg, setWeb3dMsg] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  const dealerName =
    vehicle.dealerName ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('trulens_dealer_name') : null) ||
    '';
  const dealerBranch =
    (typeof localStorage !== 'undefined' ? localStorage.getItem('trulens_dealer_branch') : null) ||
    '';
  const dealerWa =
    vehicle.dealerWhatsApp ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('trulens_dealer_wa') : null) ||
    '';

  const brandedVehicle = useMemo(
    () => ({ ...vehicle, dealerName, dealerWhatsApp: dealerWa || vehicle.dealerWhatsApp }),
    [vehicle, dealerName, dealerWa]
  );

  const readiness = useMemo(() => computeWebReadiness(brandedVehicle), [brandedVehicle]);
  const condition = useMemo(() => computeCondition(vehicle), [vehicle]);
  const band = conditionBand(condition.hasInput ? condition.stars : null);
  const waBlurb = useMemo(
    () => whatsAppSalesBlurb(brandedVehicle, readiness, { dealerName, waNumber: dealerWa || undefined }),
    [brandedVehicle, readiness, dealerName, dealerWa]
  );

  const embedUrl = vehicle.web3dPublicPath
    ? `/embed/web3d-viewer.html?stock=${encodeURIComponent(vehicle.stockNumber)}`
    : null;

  const phaseScores = PHASES.map(p => {
    const slots = DEFAULT_TEMPLATE.slots.filter(s => s.phase === p.id);
    return { ...p, slots, score: scoreForSlots(vehicle, slots) };
  });

  const capturedPhotos = DEFAULT_TEMPLATE.slots.filter(s => vehicle.photos?.[s.id]);
  const requiredSlots = DEFAULT_TEMPLATE.slots.filter(s => s.required);
  const requiredTaken = requiredSlots.filter(s => vehicle.photos?.[s.id]).length;

  const reportId = `TL-${(vehicle.stockNumber || vehicle.id).toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /* Photos are files now, so serialising the DOM would produce `<img src="/media/…">`
   * — a relative URL that resolves against nothing once the file is emailed, saved
   * or opened offline, which is precisely when a report matters. Every image is
   * fetched and inlined as a data URI before writing the file. Done on a clone so
   * the on-screen report keeps its light URLs and the page does not briefly hold
   * every photo twice. */
  const exportHtml = async () => {
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
            /* One unreachable photo must not cost the whole report — the rest
               still export, and the gap is visible rather than silent. */
          }
        })
      );
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TruLens Report · ${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.stockNumber || ''}</title><style>*{box-sizing:border-box}body{margin:0;background:#F1F5F9;padding:16px;overflow-x:hidden}</style></head><body>${clone.outerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TruLens_Report_${vehicle.stockNumber || 'draft'}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setExporting(false);
    }
  };

  const runPdf = async () => {
    const el = reportRef.current;
    if (!el) return;
    setGenerating('full');
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `TruLens_Report_${vehicle.stockNumber || 'draft'}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        } as any)
        .from(el)
        .save();
    } catch (err) {
      console.error(err);
      alert('PDF failed — use Print → Save as PDF.');
    } finally {
      setGenerating(null);
    }
  };

  const handleCopyWa = async () => {
    try {
      await navigator.clipboard.writeText(waBlurb);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 1600);
    } catch { /* ignore */ }
  };

  const handleExportWeb3d = async () => {
    if (!user) return;
    setWeb3dBusy(true);
    setWeb3dMsg(null);
    try {
      const pkg = await buildWeb3DPackage(vehicle);
      if (!pkg.frames.length && !pkg.video) {
        setWeb3dMsg('Need exterior photos or a 360 video first.');
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch('/api/export/web-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId: vehicle.id, package: pkg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      setWeb3dMsg(
        `Web 3D ready · ${data.frames ?? pkg.frames.length} frames · ${data.damageTags ?? pkg.damageTags.length} damage tags · ${pkg.background}`
      );
      onVehicleUpdated?.({
        ...vehicle,
        lastWeb3dExportAt: new Date().toISOString(),
        web3dPublicPath: data.publicUrl,
      });
      window.open(data.embedUrl, '_blank');
    } catch (e: any) {
      setWeb3dMsg(e.message || 'Web 3D export failed');
    } finally {
      setWeb3dBusy(false);
    }
  };

  const handleTogglePublish = async () => {
    setPublishBusy(true);
    try {
      const next = !vehicle.showOnWebsite;
      await onVehicleUpdated?.({
        ...vehicle,
        showOnWebsite: next,
        status: next && vehicle.status === 'In-Progress' ? 'Ready' : vehicle.status,
        dealerName,
        dealerWhatsApp: dealerWa || vehicle.dealerWhatsApp,
      });
      setWeb3dMsg(next ? 'Published to website stock feed' : 'Unpublished from website feed');
    } finally {
      setPublishBusy(false);
    }
  };

  const hero = vehicle.photos?.front_bumper || Object.values(vehicle.photos || {})[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#06080D] text-[#E8EAE6]">
      {/* Signed off by — on-screen only, value prints on the report footer */}
      <div className="no-print bg-[#0B0F17] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-3 py-3">
          <div className="text-[12px] font-medium text-[rgba(232,234,230,0.55)] mb-2">Signed off by</div>
          <input
            type="text"
            defaultValue={vehicle.capturedBy || ''}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (vehicle.capturedBy || '')) onVehicleUpdated?.({ ...vehicle, capturedBy: v });
            }}
            placeholder="Name of person signing off this report"
            className="w-full px-3 py-3 rounded-lg bg-[#06080D] border border-white/15 text-[13px] text-[#E8EAE6] placeholder-neutral-500"
          />
          {!vehicle.capturedBy && (
            <p className="text-[12px] text-amber-300/90 mt-2">
              No name recorded — the signature line prints blank on the report.
            </p>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky top-0 z-50 bg-[#0B0F17]/95 backdrop-blur border-b border-white/10 no-print">
        <div className="max-w-5xl mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onBack} className="flex items-center gap-2 text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] text-[16px] font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[13px] font-bold px-2 py-1 rounded-full border"
              style={{ color: band.color, borderColor: band.color + '55', background: band.color + '18' }}
            >
              {condition.hasInput ? `${condition.stars.toFixed(1)}/5` : 'No findings'}
            </span>
            <button onClick={handleCopyWa} className="flex items-center gap-1 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-[13px] font-bold text-emerald-300">
              {waCopied ? <Check size={12} /> : <MessageCircle size={12} />} WhatsApp
            </button>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={publishBusy}
              className="flex items-center gap-1 px-3 py-2 bg-sky-600/20 border border-sky-500/30 rounded-lg text-[13px] font-bold text-sky-300 disabled:opacity-50"
            >
              {publishBusy ? '…' : vehicle.showOnWebsite ? 'Unpublish' : 'Publish'}
            </button>
            <button onClick={handleExportWeb3d} disabled={web3dBusy}
              className="flex items-center gap-1 px-3 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded-lg text-[13px] font-bold text-cyan-300 disabled:opacity-50">
              <Box size={12} /> {web3dBusy ? '…' : '3D'}
            </button>
            {embedUrl && (
              <button
                type="button"
                onClick={() => window.open(embedUrl, '_blank')}
                className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg text-[13px] font-bold text-[rgba(232,234,230,0.72)]"
              >
                Open 3D
              </button>
            )}
            <button onClick={exportHtml} disabled={exporting}
              title="Downloads a single file with every photo embedded — opens offline and survives being emailed"
              className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg text-[13px] font-bold text-[rgba(232,234,230,0.72)] disabled:opacity-50">
              <FileText size={12} /> {exporting ? 'Embedding…' : 'HTML'}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg text-[13px] font-bold text-[rgba(232,234,230,0.72)]">
              <Printer size={12} /> Print
            </button>
            <button onClick={runPdf} disabled={!!generating}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-bold text-[#E8EAE6]"
              style={{ background: 'linear-gradient(120deg, #4FE3DC, #4FE3DC)' }}>
              <Download size={12} /> {generating ? '…' : 'PDF'}
            </button>
          </div>
        </div>
        {web3dMsg && (
          <div className="text-center text-[13px] text-cyan-300/90 pb-2 no-print">{web3dMsg}</div>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {/* On-screen summary card */}
        <div className="no-print rounded-xl border border-white/10 bg-[#0B0F17] p-3 text-[13px]">
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.55)] font-bold">Condition report</div>
              <div className="font-bold text-[16px]" style={{ color: band.color }}>{condition.label}</div>
              <div className="text-[rgba(232,234,230,0.55)] mt-1">
                Photos {requiredTaken}/{requiredSlots.length} required
                {` · ${condition.findings.length} damage tag${condition.findings.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="text-right text-[rgba(232,234,230,0.55)] text-[13px] max-w-[200px]">
              {readiness.reasons.length ? readiness.reasons.join(' · ') : 'Ready for website.'}
            </div>
          </div>
        </div>

        {/* ── PRINTABLE CONDITION REPORT ── */}
        <div ref={reportRef} className="tl-report">
          <style>{`
            .tl-report {
              width: 100%; max-width: 210mm; margin: 0 auto; background: #FFFFFF; color: #0B0F17;
              font-family: Inter, system-ui, sans-serif; border-radius: 12px; overflow: hidden;
              box-sizing: border-box;
            }
            .tl-report *, .tl-report *::before, .tl-report *::after { box-sizing: border-box; }
            .tl-report .cover { padding: 20mm 16mm 12mm; background: linear-gradient(135deg,#0B0F17 0%,#1E293B 55%,#0B3B5A 100%); color:#F8FAFC; overflow:hidden; }
            .tl-report h1 { font-weight:800; font-size:30px; letter-spacing:-.025em; margin:0 0 6px; overflow-wrap:break-word; }
            .tl-report .subhead { font-size:13px; color:rgba(248,250,252,.72); margin-bottom:18px; }
            .tl-report .score-strip { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .tl-report .score-big { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:16px; display:flex; gap:14px; align-items:center; min-width:0; }
            .tl-report .score-ring { width:88px; height:88px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
            .tl-report .vehicle-facts { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:10px 18px; }
            .tl-report .vehicle-facts .k { font-size:9px; letter-spacing:.12em; color:rgba(248,250,252,.5); font-family:ui-monospace,monospace; }
            .tl-report .vehicle-facts .v { font-weight:700; font-size:13px; margin-top:2px; overflow-wrap:break-word; word-break:break-all; }
            .tl-report section { padding: 12mm 16mm; overflow:hidden; }
            .tl-report h2 { font-weight:800; font-size:16px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
            .tl-report .grades { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
            @media (max-width:600px) {
              .tl-report .grades { grid-template-columns:repeat(3,1fr); }
              .tl-report .score-strip { grid-template-columns:1fr; }
              .tl-report .cover { padding: 10mm 5mm 8mm; }
              .tl-report section { padding: 8mm 5mm; }
              .tl-report .foot { padding: 14px 5mm; }
              .tl-report .photo-grid { grid-template-columns:1fr 1fr; }
            }
            .tl-report .grade { border:1px solid #E8EAE6; border-radius:12px; padding:12px 8px; text-align:center; overflow:hidden; }
            .tl-report .grade .v { font-weight:800; font-size:22px; }
            .tl-report .grade .n { font-size:10px; color:#475569; margin-top:6px; font-weight:600; }
            .tl-report .finding { background:#FEF3C7; border-left:4px solid #F59E0B; border-radius:0 10px 10px 0; padding:10px 14px; margin-bottom:8px; overflow-wrap:break-word; }
            .tl-report .finding .h { font-size:10px; letter-spacing:.1em; color:#B45309; font-family:ui-monospace,monospace; }
            .tl-report .finding .l { font-size:12.5px; color:#78350F; margin-top:4px; font-weight:500; }
            .tl-report .no-issues { background:#DCFCE7; border-left:4px solid #22C55E; border-radius:0 10px 10px 0; padding:12px 14px; color:#166534; font-weight:600; font-size:13px; }
            .tl-report .damage-grid, .tl-report .photo-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .tl-report .photo-grid { grid-template-columns:repeat(3,1fr); }
            .tl-report .damage-card, .tl-report .photo-tile { border:1px solid #E8EAE6; border-radius:12px; overflow:hidden; }
            .tl-report .damage-card img, .tl-report .photo-tile img { width:100%; height:auto; max-height:150px; object-fit:cover; display:block; }
            .tl-report .cap { padding:8px 10px; font-size:11px; overflow-wrap:break-word; }
            .tl-report .checklist { width:100%; border-collapse:collapse; font-size:11px; table-layout:fixed; }
            .tl-report .checklist th, .tl-report .checklist td { border-bottom:1px solid #E8EAE6; padding:7px 6px; text-align:left; overflow-wrap:break-word; }
            .tl-report .checklist th { font-size:9px; letter-spacing:.1em; color:#475569; }
            .tl-report .foot { border-top:1px solid #E8EAE6; padding:14px 16mm; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:10px; color:#64748B; letter-spacing:.08em; font-family:ui-monospace,monospace; }
            .tl-report .damage-pin { position:absolute; width:20px; height:20px; border-radius:50%; border:2px solid #fff; transform:translate(-50%,-50%); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#fff; box-shadow:0 1px 4px rgba(0,0,0,.4); }
            @media print {
              .no-print { display:none !important; }
              body { background:#fff !important; }
            }
          `}</style>

          {/* Cover */}
          <div className="cover">
            {/* Logos — centered, stacked */}
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <img src={trulensLockup} alt="TruLens" style={{ height:44, width:'auto', display:'inline-block' }} />
              <div style={{ marginTop:10 }}>
                <img src={trudealerLockup} alt="TruDealer" style={{ height:28, width:'auto', display:'inline-block' }} />
              </div>
              {dealerName && <div style={{ fontSize:11, fontWeight:600, opacity:.75, marginTop:8 }}>{dealerName}</div>}
              {dealerBranch && <div style={{ fontSize:10, opacity:.55, marginTop:2 }}>{dealerBranch}</div>}
            </div>

            {/* Report meta — centered */}
            <div style={{ textAlign:'center', fontFamily:'ui-monospace,monospace', fontSize:10, color:'rgba(248,250,252,.62)', lineHeight:1.6, marginBottom:18 }}>
              <div><b style={{color:'#fff'}}>Report ID</b> · {reportId}</div>
              <div><Clock size={9} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/>{generatedAt}</div>
            </div>

            {/* Accent bar */}
            <div style={{ width:60, height:3, borderRadius:2, background:'linear-gradient(90deg,#4FE3DC,#4FE3DC)', margin:'0 auto 14px' }} />
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.14em', color:'rgba(79,227,220,.7)', marginBottom:6, textAlign:'center' }}>VEHICLE CONDITION REPORT</div>
            <h1 style={{ textAlign:'center' }}>{vehicle.year} {vehicle.make} {vehicle.model}</h1>
            <div className="subhead" style={{ textAlign:'center' }}>
              {vehicle.trim} · {vehicle.color}
              {vehicle.mileage ? ` · ${Number(vehicle.mileage).toLocaleString('en-ZA')} km` : ''}
              {vehicle.transmission ? ` · ${vehicle.transmission}` : ''}
              {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ''}
              {' · Stock '}<b>{vehicle.stockNumber}</b>
            </div>

            {/* Condition + vehicle details — unified strip */}
            <div className="score-strip">
              <div className="score-big">
                <div className="score-ring" style={{ background: `conic-gradient(${band.color} ${(condition.hasInput ? condition.stars / 5 : 0) * 360}deg, rgba(255,255,255,.08) 0)` }}>
                  <div style={{ background:'#1E293B', borderRadius:'50%', width:70, height:70, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontWeight:800, fontSize:28, color: band.color }}>{condition.hasInput ? condition.stars.toFixed(1) : '—'}</div>
                    <div style={{ fontSize:9, opacity:.7 }}>/ 5</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, letterSpacing:'.12em', opacity:.55 }}>Vehicle condition</div>
                  <div style={{ fontWeight:800, fontSize:20, color: band.color, marginTop:4 }}>{band.label}</div>
                  <div style={{ fontSize:12, opacity:.75, marginTop:4 }}>{band.meaning}</div>
                </div>
              </div>
              <div className="vehicle-facts">
                <div><div className="k">VIN</div><div className="v">{vehicle.vin || '—'}</div></div>
                <div><div className="k">Type</div><div className="v">{vehicle.vehicleType || '—'}</div></div>
                <div><div className="k">Mileage</div><div className="v">{vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString('en-ZA')} km` : '—'}</div></div>
                <div><div className="k">List price</div><div className="v">R {Number(vehicle.price || 0).toLocaleString('en-ZA')}</div></div>
                <div><div className="k">Photos</div><div className="v">{capturedPhotos.length} captured</div></div>
                <div><div className="k">Damage tags</div><div className="v">{condition.findings.length}</div></div>
              </div>
            </div>
          </div>

          {/* Hero photo */}
          {hero && (
            <section style={{ paddingBottom:0 }}>
              <img src={hero} alt="Hero" style={{ width:'100%', borderRadius:12, objectFit:'cover', aspectRatio:'16/10', background:'#F1F5F9' }} />
            </section>
          )}

          {/* Damage findings */}
          <section>
            <h2><AlertTriangle size={16} /> Damage & condition findings</h2>
            {condition.hasInput && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'#F8FAFC', border:'1px solid #E8EAE6', borderRadius:12 }}>
                <div style={{ fontWeight:800, fontSize:24, color: band.color }}>
                  {condition.stars.toFixed(1)}<span style={{ fontSize:12, color:'#475569' }}>/5</span>
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>Condition score</div>
                  <div style={{ fontSize:11.5, color:'#64748B' }}>
                    {condition.label} · {condition.findings.length} tag{condition.findings.length === 1 ? '' : 's'}
                    {' across '}{Object.keys(vehicle.damageFindings || {}).length} photo{Object.keys(vehicle.damageFindings || {}).length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            )}
            {condition.findings.length === 0 ? (
              <div className="no-issues"><CheckCircle2 size={14} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/> No damage tagged on captured photos.</div>
            ) : (
              condition.findings.map((f, i) => {
                const sev = severityMeta(f.severity);
                const slot = DEFAULT_TEMPLATE.slots.find(s => s.id === f.slotId);
                return (
                  <div className="finding" key={i} style={{ background: sev.bg, borderLeftColor: sev.color }}>
                    <div className="h" style={{ color: sev.color }}>
                      {sev.label} · {f.damageType} · {f.panel}
                    </div>
                    <div className="l" style={{ color:'#334155' }}>
                      {f.note || 'Tagged during capture'}
                      <span style={{ color:'#475569' }}> — {slot?.name || f.slotId}</span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Damage photos with pins */}
          {(() => {
            const slotsWithDamage = Object.entries(vehicle.damageFindings || {})
              .filter(([, list]) => list && list.some(f => f.confirmed !== false))
              .map(([slotId, list]) => ({
                slot: DEFAULT_TEMPLATE.slots.find(s => s.id === slotId),
                src: vehicle.photos?.[slotId],
                findings: (list || []).filter(f => f.confirmed !== false),
              }))
              .filter(d => d.src && d.slot);
            if (!slotsWithDamage.length) return null;
            return (
              <section>
                <h2><Camera size={16} /> Damage locations</h2>
                <div className="damage-grid">
                  {slotsWithDamage.map(({ slot, src, findings }) => (
                    <div className="damage-card" key={slot!.id} style={{ position:'relative' }}>
                      <div style={{ position:'relative' }}>
                        <img src={src} alt={slot!.name} />
                        {findings.map((f, i) => {
                          const sev = severityMeta(f.severity);
                          return (
                            <div
                              key={f.id || i}
                              className="damage-pin"
                              style={{
                                position:'absolute',
                                left: `${f.x * 100}%`,
                                top: `${f.y * 100}%`,
                                background: sev.color,
                              }}
                            >
                              {f.severity}
                            </div>
                          );
                        })}
                      </div>
                      <div className="cap">
                        <b>{slot!.name}</b>
                        <div style={{ color:'#64748B', marginTop:3 }}>
                          {findings.length} tag{findings.length === 1 ? '' : 's'}
                          {findings.length === 1 ? ` · ${findings[0].damageType}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Photo capture quality */}
          <section>
            <h2><Award size={16} /> Photo capture quality</h2>
            <div style={{ fontSize:11, color:'#475569', marginTop:-4, marginBottom:8 }}>
              How well each section was photographed — this describes the images, not the vehicle.
            </div>
            <div className="grades">
              {phaseScores.map(p => {
                const g = captureBand(p.score);
                const Icon = p.icon;
                return (
                  <div className="grade" key={p.id} style={{ background: g.bg, borderColor: g.color + '40' }}>
                    <div className="v" style={{ color: g.color, fontSize:15 }}>{g.label}</div>
                    <div className="n"><Icon size={11} style={{display:'inline',verticalAlign:'-2px',marginRight:4,color:g.color}}/>{p.name}</div>
                    <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>{p.score !== null ? `${p.score}/100` : '—'}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Required photo checklist */}
          <section>
            <h2><ClipboardList size={16} /> Required photos</h2>
            <table className="checklist">
              <thead>
                <tr><th>Shot</th><th>Status</th><th>Quality</th></tr>
              </thead>
              <tbody>
                {requiredSlots.map(s => {
                  const has = !!vehicle.photos?.[s.id];
                  const q = vehicle.quality?.[s.id];
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td style={{ color: has ? '#16A34A' : '#DC2626', fontWeight:700 }}>{has ? 'Captured' : 'Missing'}</td>
                      <td>{q ? q.overallScore : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* Gallery */}
          {capturedPhotos.length > 0 && (
            <section>
              <h2><Camera size={16} /> Gallery</h2>
              <div className="photo-grid">
                {capturedPhotos.slice(0, 15).map(slot => (
                  <div className="photo-tile" key={slot.id}>
                    <img src={vehicle.photos[slot.id]} alt={slot.name} />
                    <div className="cap">{slot.name}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Dealer & vehicle identity */}
          <section>
            <h2><Award size={16} /> Report details</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Dealership</div>
                <div style={{ fontWeight:700, marginTop:4 }}>{dealerName}</div>
                {dealerBranch ? <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{dealerBranch}</div> : null}
                {dealerWa ? <div style={{ fontSize:12, marginTop:6 }}>WhatsApp {dealerWa}</div> : null}
              </div>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Vehicle identity</div>
                <div style={{ fontSize:12, color:'#334155', marginTop:4 }}>
                  VIN <b style={{ fontFamily:'ui-monospace, monospace' }}>{vehicle.vin || '— not recorded —'}</b>
                </div>
                <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                  Stock {vehicle.stockNumber || '—'} · {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
                <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                  Captured {generatedAt}
                </div>
              </div>
            </div>

            {/* Condition scale legend */}
            <div className="grade" style={{ textAlign:'left', padding:14, marginTop:10 }}>
              <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Condition scale</div>
              <div style={{ marginTop:6 }}>
                {CONDITION_SCALE.map(b => (
                  <div key={b.label} style={{ display:'flex', gap:8, fontSize:11.5, color:'#334155', marginTop:3 }}>
                    <b style={{ color:b.color, minWidth:64, fontFamily:'ui-monospace, monospace' }}>{b.band}</b>
                    <b style={{ minWidth:64 }}>{b.label}</b>
                    <span style={{ opacity:.85 }}>{b.meaning}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'#475569', marginTop:8 }}>
                Weighted from tagged damage severity. Not a mechanical assessment.
              </div>
            </div>
          </section>

          {/* Signature block */}
          <section style={{ paddingTop:0 }}>
            <div className="grade" style={{ textAlign:'left', padding:14 }}>
              <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Signed off by</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:10 }}>
                <div>
                  <div style={{ borderBottom:'1px solid #94A3B8', height:26 }}>
                    <span style={{ fontSize:12, color:'#334155' }}>{vehicle.capturedBy || ''}</span>
                  </div>
                  <div style={{ fontSize:9.5, color:'#475569', marginTop:3 }}>Name</div>
                </div>
                <div>
                  <div style={{ borderBottom:'1px solid #94A3B8', height:26 }}>
                    <span style={{ fontSize:12, color:'#334155' }}>{generatedAt}</span>
                  </div>
                  <div style={{ fontSize:9.5, color:'#475569', marginTop:3 }}>Date</div>
                </div>
              </div>
            </div>
          </section>

          <div className="foot">
            <div>Prepared by <b style={{color:'#4FE3DC'}}>{dealerName}</b> · powered by <b>TruLens</b></div>
            <img src={trudealerLockup} alt="TruDealer" style={{ height:20, width:'auto' }} />
            <div>{reportId}</div>
            <div>Visual condition at a moment in time — not a mechanical warranty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
