import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Download, Printer, Share2, Award, AlertTriangle, CheckCircle2,
  Camera, FileText, ClipboardList, Clock, Copy, Check,
} from 'lucide-react';
import { Vehicle, PointResult } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';
import { deriveReportId } from '../types/inspection';
import { DEFAULT_TEMPLATE } from '../templates';
import truinspectLogo from '../assets/images/truinspect-logo.svg';
import trudealerLockup from '../assets/images/trudealer-lockup.png';

interface ReportPreviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onVehicleUpdated?: (v: Vehicle) => void;
}

/** How many of the template's slots have a photo — a count, not a quality
 *  score. Photo capture quality (lighting/angle/AI score) is a TruLens
 *  concept and plays no part in this report; see the note on CONDITION_SCALE
 *  below for why. */
function countCapturedPhotos(vehicle: Vehicle) {
  const captured = DEFAULT_TEMPLATE.slots.filter(s => !!vehicle.photos?.[s.id]).length;
  return { captured };
}

/**
 * The condition scale, printed on the report so a number never has to be
 * interpreted. Numeric only and weighted from inspector findings — the same
 * shape a dealer already reads on a Manheim condition report.
 *
 * This replaces an A–D letter grade that was derived from computeOverallScore,
 * i.e. from the AI's assessment of the PHOTOGRAPHS — lighting, framing,
 * sharpness. A reader seeing "Grade A" on a vehicle inspection report will take
 * it to describe the vehicle. It described the pictures. Photo capture
 * quality is a TruLens concept now — it grades the photographs for a dealer
 * website, not the vehicle for a VIR — and TruInspect's report no longer
 * shows or scores by it at all.
 */
const CONDITION_SCALE = [
  { min: 4.5, band: '5.0 – 4.5', label: 'Excellent', meaning: 'Minor blemishes only. Retail ready.', color: '#16A34A' },
  { min: 3.5, band: '4.4 – 3.5', label: 'Good', meaning: 'Light cosmetic wear consistent with age.', color: '#65A30D' },
  { min: 2.5, band: '3.4 – 2.5', label: 'Fair', meaning: 'Visible defects recorded. Attention advised.', color: '#CA8A04' },
  { min: 0,   band: '2.4 – 1.0', label: 'Poor', meaning: 'Significant damage documented below.', color: '#DC2626' },
];

function conditionBand(stars: number | null) {
  if (stars === null) {
    return { label: 'Not yet inspected', meaning: 'No inspector findings recorded.', color: '#475569' };
  }
  return CONDITION_SCALE.find(b => stars >= b.min) ?? CONDITION_SCALE[CONDITION_SCALE.length - 1];
}

/** TruInspect: severity badge styling for inspector-tagged damage */
function severityMeta(sev: number) {
  if (sev >= 5) return { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' };
  if (sev >= 4) return { label: 'Major', color: '#EA580C', bg: '#FFEDD5' };
  if (sev >= 3) return { label: 'Moderate', color: '#CA8A04', bg: '#FEF9C3' };
  if (sev >= 2) return { label: 'Minor', color: '#64748B', bg: '#F1F5F9' };
  return { label: 'Cosmetic', color: '#475569', bg: '#F8FAFC' };
}

/**
 * Overall condition out of 5 — computed ONLY from real inspector inputs:
 * tagged damage (by severity) plus per-point ratings and function faults.
 * No black-box scoring.
 */
function computeCondition(vehicle: Vehicle) {
  const all = Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, list]) =>
    (list || []).map(f => ({ ...f, slotId }))
  );
  const sevPenalties = [0, 0.1, 0.25, 0.55, 1.0, 1.7];

  const slotsWithTags = new Set(all.map(f => f.slotId));
  const rawPenalties: number[] = all.map(f => sevPenalties[f.severity] ?? 0.3);

  const pts = vehicle.inspectionPoints || {};
  const flaggedPoints = (DEFAULT_TEMPLATE.checklistPoints || [])
    .map(p => ({ point: p, res: pts[p.id] }))
    .filter(({ res }) => res && (res.rating === 'note' || res.rating === 'damage' || res.works === 'no'));
  for (const { res } of flaggedPoints) {
    if (res?.works === 'no') rawPenalties.push(0.4);
    else if (res?.rating === 'damage') rawPenalties.push(0.5);
    else if (res?.rating === 'note') rawPenalties.push(0.15);
  }

  const slotAssess = vehicle.slotAssessment || {};
  for (const [slotId, res] of Object.entries(slotAssess)) {
    if (slotsWithTags.has(slotId)) continue;
    if (res?.rating === 'damage') rawPenalties.push(0.5);
    else if (res?.rating === 'note') rawPenalties.push(0.15);
  }

  rawPenalties.sort((a, b) => b - a);
  const penalty = rawPenalties.reduce((s, p, i) => s + p / (i + 1), 0);

  const stars = Math.max(1, Math.round((5 - Math.min(4, penalty)) * 10) / 10);
  const hasInput = all.length > 0 || flaggedPoints.length > 0 || Object.keys(pts).length > 0 || Object.keys(slotAssess).length > 0;
  const label =
    !hasInput ? 'Not yet inspected' :
    stars >= 4.5 ? 'Excellent — minor blemishes only' :
    stars >= 3.5 ? 'Good — light cosmetic wear' :
    stars >= 2.5 ? 'Fair — visible defects to address' :
    'Poor — significant damage documented';
  return { stars, label, findings: all, flaggedPoints, hasInput };
}

export default function ReportPreview({ vehicle, onBack, onVehicleUpdated }: ReportPreviewProps) {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  /* Inlining every photo takes a moment on a big inspection, and a download
     button that appears to do nothing gets pressed again. */
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);

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
    () => ({
      ...vehicle,
      dealerName,
      dealerWhatsApp: dealerWa || vehicle.dealerWhatsApp,
    }),
    [vehicle, dealerName, dealerWa]
  );

  const readiness = useMemo(() => computeInspectionReadiness(brandedVehicle), [brandedVehicle]);
  const overall = useMemo(() => countCapturedPhotos(vehicle), [vehicle]);
  const condition = useMemo(() => computeCondition(vehicle), [vehicle]);

  /** Inspector questionnaire: answered items + the flagged (disclosure) subset */
  const checklistRows = useMemo(() => (DEFAULT_TEMPLATE.disclosureQuestions || []).flatMap(section =>
    section.items.map(item => {
      const a = vehicle.inspectionChecklist?.[item.id];
      return { section: section.section, item, answer: a?.answer, note: a?.note, flagged: a?.answer === item.flagWhen };
    })
  ), [vehicle.inspectionChecklist]);
  const checklistFlags = useMemo(() => checklistRows.filter(r => r.flagged), [checklistRows]);
  const checklistAnswered = useMemo(() => checklistRows.filter(r => r.answer), [checklistRows]);

  /**
   * Standalone HTML export — genuinely self-contained.
   *
   * This used to be self-contained by accident: photos were base64 in the
   * record, so serialising the DOM carried them along. Photos are files now, so
   * the same serialisation would produce `<img src="/media/…">` — a relative
   * URL that resolves against nothing once the file is emailed, saved to a
   * desktop or opened offline, which is precisely when a VIR matters. Every
   * image is fetched and inlined before writing the file.
   *
   * Done on a clone, so the report on screen keeps its light URLs and the page
   * does not briefly balloon to hold every photo twice.
   */
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

      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TruInspect VIR · ${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.stockNumber || ''}</title><style>*{box-sizing:border-box}body{margin:0;background:#F1F5F9;padding:16px;overflow-x:hidden}</style></head><body>${clone.outerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `TruInspect_VIR_${vehicle.stockNumber || 'draft'}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setExporting(false);
    }
  };
  const hasCondition = condition.hasInput;
  const band = conditionBand(hasCondition ? condition.stars : null);

  /* Stable for the life of the vehicle record. This carried Date.now(), so
     printing the same inspection twice produced two different IDs and the
     report could not be cited. Derived only from the vehicle id, which does
     not change. 'VIR' distinguishes this report from the Trade-In Appraisal
     for the same vehicle — both used to print the identical 'TI-' id. */
  const reportId = deriveReportId(vehicle, 'VIR');
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /* Render straight from the live report node — the same approach TruLens uses,
   * which downloads reliably. An earlier version cloned the node offscreen and
   * re-waited for images; that was a workaround for a DOM stuffed with base64
   * photos, and html2canvas chokes on a detached, unpainted node. Photos are
   * lightweight "/media/…" URLs now (already loaded on screen), so the live node
   * rasterises cleanly. */
  const runPdf = async () => {
    const el = reportRef.current;
    if (!el) return;
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `TruInspect_VIR_${vehicle.stockNumber || 'draft'}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
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
      setGenerating(false);
    }
  };

  const hero = vehicle.photos?.front_bumper || Object.values(vehicle.photos || {})[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-900 text-slate-100">
      {/* Signed off after the inspection, before the report goes anywhere.
          On screen only — the printed VIR shows the values on its own
          signature block. */}
      <div className="no-print bg-slate-950/60 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-3 py-3">
          <div className="text-[12px] font-medium text-[rgba(232,234,230,0.55)] mb-2">
            Signed off by
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              defaultValue={vehicle.inspectorName || ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (vehicle.inspectorName || '')) onVehicleUpdated?.({ ...vehicle, inspectorName: v });
              }}
              placeholder="Inspector name"
              className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-white/15 text-[13px] text-[#E8EAE6] placeholder-neutral-500"
            />
            <input
              type="text"
              defaultValue={vehicle.inspectorRole || ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (vehicle.inspectorRole || '')) onVehicleUpdated?.({ ...vehicle, inspectorRole: v });
              }}
              placeholder="Designation (e.g. Workshop Manager)"
              className="w-full px-3 py-3 rounded-lg bg-slate-900 border border-white/15 text-[13px] text-[#E8EAE6] placeholder-neutral-500"
            />
          </div>
          {(!vehicle.inspectorName || !vehicle.vin) && (
            <p className="text-[12px] text-amber-300/90 mt-2">
              {!vehicle.vin && !vehicle.inspectorName
                ? 'No VIN and no inspector recorded — both print blank on the report.'
                : !vehicle.vin
                  ? 'No VIN on this vehicle — it prints blank on the report.'
                  : 'No inspector recorded — the signature block prints blank.'}
            </p>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-white/10 no-print">
        <div className="max-w-5xl mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-[#E8EAE6] text-[16px] font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[13px] font-bold px-2 py-1 rounded-full border ${
                condition.stars >= 3.5
                  ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                  : condition.stars >= 2.5
                    ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                    : 'text-red-300 border-red-500/40 bg-red-500/10'
              }`}
            >
              Condition {condition.stars.toFixed(1)}/5
            </span>
            <button
              onClick={exportHtml}
              disabled={exporting}
              title="Downloads a single file with every photo embedded — opens offline and survives being emailed"
              className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg text-[13px] font-bold text-slate-200 disabled:opacity-50"
            >
              <FileText size={12} /> {exporting ? 'Embedding…' : 'HTML'}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-2 bg-white/5 rounded-lg text-[13px] font-bold text-slate-200">
              <Printer size={12} /> Print
            </button>
            <button onClick={() => runPdf()} disabled={generating}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-bold text-[#0B0F17] disabled:opacity-50"
              style={{ background: 'linear-gradient(120deg, #7FF0EA, #4FE3DC)' }}>
              <Download size={12} /> {generating ? '…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden-on-screen sales pack used only for PDF (also shown in print if user wants) */}
      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {/* On-screen inspection summary card */}
        <div className="no-print rounded-xl border border-white/10 bg-slate-950/60 p-3 text-[13px]">
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-[13px] tracking-normal text-slate-500 font-bold">Inspection status</div>
              <div className="font-bold text-[16px] text-cyan-300">{condition.label}</div>
              <div className="text-slate-400 mt-1">
                Photos {readiness.requiredTaken}/{readiness.requiredTotal}
                {` · ${condition.findings.length} damage tag${condition.findings.length === 1 ? '' : 's'}`}
                {` · ${checklistFlags.length} checklist flag${checklistFlags.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="text-right text-slate-500 text-[13px] max-w-[200px]">
              Export the report as PDF or standalone HTML when capture and checklist are complete.
            </div>
          </div>
        </div>

        <div ref={reportRef} className="tl-report">
          {/* ── Palette warning ──────────────────────────────────────────────
              This document is WHITE paper (#FFFFFF, ink #0B0F17). The app around
              it is near-black. A rebrand sweep had put the app's paper token —
              rgba(232,234,230,·), which is a near-WHITE — on 21 pieces of text
              inside this white page: the checklist headers, the footer, every
              "Inspected by" / "Vehicle identity" / "Condition scale" label, and
              the condition score itself. Measured 1.2:1. On the printed VIR that
              a dealer hands to a customer, those lines were blank paper.

              On this component the muted colours are slate ink, not the app's
              paper token: #334155 / #475569 / #64748B. The only place a light
              colour is correct is .cover and .band, which paint a dark gradient
              behind themselves and use the #F8FAFC family. */}
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
            .tl-report h2 { font-weight:800; font-size:16px; margin:0 0 12px; display:flex; align-items:center; gap:8px; padding-bottom:8px; border-bottom:2px solid #4FE3DC; }
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
            @media print {
              .no-print { display:none !important; }
              .tl-sales { break-after: page; }
              body, html { background:#fff !important; color:#0B0F17 !important; margin:0; padding:0; overflow:visible !important; }
              [class*="bg-slate"] { background:transparent !important; }
              .tl-report { max-width:100% !important; width:100% !important; border-radius:0 !important; box-shadow:none !important; margin:0 !important; }
              .tl-report section { padding:8mm 10mm; }
              .tl-report .cover { padding:14mm 10mm 10mm; }
              .tl-report .foot { padding:10px 10mm; }
              .tl-report img { max-height:120px; }
              .tl-report .photo-grid { grid-template-columns:repeat(3,1fr); }
              .tl-report .damage-grid { grid-template-columns:1fr 1fr; }
              .tl-report .grade { break-inside:avoid; }
              .tl-report .finding { break-inside:avoid; }
              .tl-report table { break-inside:auto; }
              .tl-report tr { break-inside:avoid; }
            }
          `}</style>

          <div className="cover">
            {/* Logos — centered, stacked */}
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <img src={truinspectLogo} alt="TruInspect" style={{ height:44, width:'auto', display:'inline-block' }} />
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
            <div style={{ width:60, height:3, borderRadius:2, background:'linear-gradient(90deg,#4FE3DC,#4D9BFF)', margin:'0 auto 14px' }} />
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.14em', color:'rgba(79,227,220,.7)', marginBottom:6, textAlign:'center' }}>VEHICLE INSPECTION REPORT</div>
            <h1 style={{ textAlign:'center' }}>{vehicle.year} {vehicle.make} {vehicle.model}</h1>
            <div className="subhead" style={{ textAlign:'center' }}>{vehicle.trim} · {vehicle.color} · Stock <b>{vehicle.stockNumber}</b></div>

            {/* Condition + vehicle details — unified strip */}
            <div className="score-strip">
              <div className="score-big">
                <div className="score-ring" style={{ background: `conic-gradient(${band.color} ${(hasCondition ? condition.stars / 5 : 0) * 360}deg, rgba(255,255,255,.08) 0)` }}>
                  <div style={{ background:'#1E293B', borderRadius:'50%', width:70, height:70, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontWeight:800, fontSize:28, color: band.color }}>{hasCondition ? condition.stars.toFixed(1) : '—'}</div>
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
                <div><div className="k">Status</div><div className="v">{vehicle.status}</div></div>
                <div><div className="k">List price</div><div className="v">R {Number(vehicle.price || 0).toLocaleString('en-ZA')}</div></div>
                <div><div className="k">Photos</div><div className="v">{readiness.requiredTaken}/{readiness.requiredTotal} required</div></div>
                <div><div className="k">Damage tags</div><div className="v">{condition.findings.length}</div></div>
              </div>
            </div>
          </div>

          {/* Photo capture QUALITY (lighting/angle/AI score) is a TruLens
              concept — it grades the photographs, not the vehicle, and TruLens
              is the app that feeds a dealer website where that matters. This
              report only lists whether the required shots were captured. */}
          <section>
            <h2><ClipboardList size={16} /> Required photo checklist</h2>
            <table className="checklist">
              <thead>
                <tr><th>Slot</th><th>Status</th></tr>
              </thead>
              <tbody>
                {DEFAULT_TEMPLATE.slots.filter(s => s.required).map(s => {
                  const has = !!vehicle.photos?.[s.id];
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td style={{ color: has ? '#16A34A' : '#DC2626', fontWeight:700 }}>{has ? 'Captured' : 'Missing'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section>
            <h2><AlertTriangle size={16} /> Damage tagged by inspector</h2>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'#F8FAFC', border:'1px solid #E8EAE6', borderRadius:12 }}>
              <div style={{ fontWeight:800, fontSize:24, color: condition.stars >= 3.5 ? '#16A34A' : condition.stars >= 2.5 ? '#CA8A04' : '#DC2626' }}>
                {condition.stars.toFixed(1)}<span style={{ fontSize:12, color:'#475569' }}>/5</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>Condition score</div>
                <div style={{ fontSize:11.5, color:'#64748B' }}>{condition.label} · {condition.findings.length} tag{condition.findings.length === 1 ? '' : 's'} across {Object.keys(vehicle.damageFindings || {}).length} photos</div>
              </div>
            </div>
            {condition.findings.length === 0 ? (
              <div className="no-issues"><CheckCircle2 size={14} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/> No damage was tagged on the inspection photos.</div>
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
                      {f.note || 'Tagged by inspector'}
                      <span style={{ color:'#475569' }}> — {slot?.name || f.slotId}</span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {(() => {
            const sa = vehicle.slotAssessment || {};
            const rows = DEFAULT_TEMPLATE.slots
              .map(s => ({ s, r: sa[s.id], shots: vehicle.closeups?.[s.id] || [] }))
              .filter(({ r, shots }) => r && (r.rating || r.comment || shots.length));
            if (!rows.length) return null;
            const stateOf = (r?: PointResult) =>
              r?.rating === 'ok' ? { t: 'OK', c: '#16A34A' } :
              r?.rating === 'note' ? { t: 'Note', c: '#B45309' } :
              r?.rating === 'damage' ? { t: 'Damage', c: '#DC2626' } : { t: '—', c: '#64748B' };
            return (
              <section>
                <h2><Camera size={16} /> Condition by photo</h2>
                {rows.map(({ s, r, shots }) => {
                  const st = stateOf(r);
                  return (
                    <div className="finding" key={s.id} style={r?.rating === 'ok' ? { background:'#F0FDF4', borderLeftColor:'#16A34A' } : undefined}>
                      <div className="h" style={{ color: st.c }}>{s.name} · {st.t}</div>
                      {r?.comment && <div className="l" style={{ color:'#334155' }}>{r.comment}</div>}
                      {shots.length > 0 && (
                        <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                          {shots.map((src, i) => (
                            <img key={i} src={src} alt="close-up" style={{ width:96, height:72, objectFit:'cover', borderRadius:8, border:'1px solid #E8EAE6' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })()}

          <section>
            <h2><ClipboardList size={16} /> Inspection sheet</h2>
            {(() => {
              const pts = vehicle.inspectionPoints || {};
              const rows = (DEFAULT_TEMPLATE.checklistPoints || [])
                .map(p => ({ p, r: pts[p.id] }))
                .filter(({ r }) => r && (r.rating || r.works || r.comment));
              if (!rows.length) {
                return (
                  <div style={{ fontSize:12, color:'#475569', fontStyle:'italic' }}>
                    Inspection not completed for this vehicle.
                  </div>
                );
              }
              const stateLabel = (r?: typeof rows[number]['r'], kind?: string) =>
                kind === 'presence' ? (
                  r?.works === 'yes' ? { t: 'Present', c: '#16A34A' } :
                  r?.works === 'no' ? { t: 'Not Present', c: '#DC2626' } :
                  { t: '—', c: '#64748B' }
                ) : kind === 'service_history' ? (
                  r?.works === 'yes' ? { t: 'FSH', c: '#16A34A' } :
                  r?.works === 'na' ? { t: 'Partial', c: '#B45309' } :
                  r?.works === 'no' ? { t: 'None', c: '#DC2626' } :
                  { t: '—', c: '#64748B' }
                ) :
                r?.works === 'yes' ? { t: 'Works', c: '#16A34A' } :
                r?.works === 'no' ? { t: 'Faulty', c: '#DC2626' } :
                r?.works === 'na' ? { t: 'N/A', c: '#64748B' } :
                r?.rating === 'ok' ? { t: 'OK', c: '#16A34A' } :
                r?.rating === 'note' ? { t: 'Note', c: '#B45309' } :
                r?.rating === 'damage' ? { t: 'Damage', c: '#DC2626' } :
                { t: '—', c: '#64748B' };
              const flagged = condition.flaggedPoints;
              return (
                <>
                  {flagged.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      {flagged.map(({ point, res }) => (
                        <div className="finding" key={point.id}>
                          <div className="h">Disclosure · {point.name}</div>
                          <div className="l">
                            {stateLabel(res, point.kind).t}{res?.comment ? ` — ${res.comment}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <table className="checklist">
                    <thead>
                      <tr><th>Point</th><th style={{width:70}}>State</th><th>Comment</th></tr>
                    </thead>
                    <tbody>
                      {rows.map(({ p, r }) => {
                        const s = stateLabel(r, p.kind);
                        const isFlag = r?.rating === 'note' || r?.rating === 'damage' || r?.works === 'no';
                        return (
                          <tr key={p.id} style={isFlag ? { background:'#FFFBEB' } : undefined}>
                            <td><span style={{ color:'#475569', fontSize:9, letterSpacing:'.08em' }}>{p.group}</span><br/>{p.name}</td>
                            <td style={{ fontWeight:700, color: s.c }}>{s.t}</td>
                            <td style={{ color:'#64748B' }}>{r?.comment || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              );
            })()}
          </section>

          <section>
            <h2><Camera size={16} /> Gallery</h2>
            <div className="photo-grid">
              {DEFAULT_TEMPLATE.slots.filter(s => vehicle.photos?.[s.id]).slice(0, 12).map(slot => (
                <div className="photo-tile" key={slot.id}>
                  <img src={vehicle.photos[slot.id]} alt={slot.name} />
                  <div className="cap">{slot.name}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2><Award size={16} /> Inspection summary</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', textTransform:'', color:'#475569' }}>Inspected by</div>
                <div style={{ fontWeight:700, marginTop:4 }}>{dealerName}</div>
                {dealerBranch ? <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{dealerBranch}</div> : null}
                {dealerWa ? <div style={{ fontSize:12, marginTop:6 }}>WhatsApp {dealerWa}</div> : null}
              </div>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', textTransform:'', color:'#475569' }}>Work done</div>
                <div style={{ fontSize:12, color:'#334155', marginTop:4 }}>
                  Photos captured: {Object.keys(vehicle.photos || {}).length}
                </div>
                <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                  Damage tags: {condition.findings.length}
                </div>
                <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                  Checklist answered: {checklistAnswered.length} · flagged: {checklistFlags.length}
                </div>
              </div>
            </div>

            {/* Identity. A stock number can be reused, and has been across two
                dealers in this system — the VIN is what ties this document to
                one vehicle. */}
            <div className="grade" style={{ textAlign:'left', padding:14, marginTop:10 }}>
              <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Vehicle identity</div>
              <div style={{ fontSize:12, color:'#334155', marginTop:4 }}>
                VIN <b style={{ fontFamily:'ui-monospace, monospace' }}>{vehicle.vin || '— not recorded —'}</b>
              </div>
              <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                Stock {vehicle.stockNumber || '—'} · {vehicle.year} {vehicle.make} {vehicle.model}
              </div>
              <div style={{ fontSize:12, color:'#334155', marginTop:2 }}>
                Inspected {generatedAt}
              </div>
            </div>

            {/* The scale, printed. A number a reader has to interpret is a
                number they will interpret wrongly. */}
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
                Weighted from recorded findings — damage severity, flagged inspection
                points and function faults. It is not a measure of photo quality.
              </div>
            </div>

            {/* Scope. What was looked at, and — the part that matters in a
                dispute — what was not. */}
            <div className="grade" style={{ textAlign:'left', padding:14, marginTop:10 }}>
              <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Scope of this inspection</div>
              <div style={{ fontSize:11.5, color:'#334155', marginTop:6 }}>
                <b>Covered —</b> a visual inspection of the vehicle's exterior panels,
                interior, engine bay and documents, carried out with the vehicle
                stationary and on the ground. Engine oil level and condition checked
                by eye on the dipstick. Tyres checked visually for tread and damage.
              </div>
              <div style={{ fontSize:11.5, color:'#334155', marginTop:6 }}>
                <b>Not covered —</b> no inspection on a lift or over a pit, no
                dismantling or removal of trim, no fluid sampling or laboratory
                analysis, no paint depth or structural measurement, and no assessment
                of any component not visible from outside the vehicle.
              </div>
              <div style={{ fontSize:11.5, color:'#334155', marginTop:6 }}>
                <b>Road test and diagnostics —</b> carried out only where the checklist
                below records it. Where an item is unanswered or marked not applicable,
                that check was not performed and nothing should be inferred from its
                absence.
              </div>
              <div style={{ fontSize:11.5, color:'#334155', marginTop:6 }}>
                Findings describe what was observed on the date shown. Nothing in this
                report states or implies the mechanical condition of any component
                that was not physically tested.
              </div>
            </div>

            {/* Signed by a person. "Inspected by <dealership>" is not an
                inspector, and a document that lands with a finance house
                should carry the name of whoever stands behind it. */}
            <div className="grade" style={{ textAlign:'left', padding:14, marginTop:10 }}>
              <div className="k" style={{ fontSize:9, letterSpacing:'.1em', color:'#475569' }}>Inspected by</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:10 }}>
                <div>
                  <div style={{ borderBottom:'1px solid #94A3B8', height:26 }}>
                    <span style={{ fontSize:12, color:'#334155' }}>{vehicle.inspectorName || ''}</span>
                  </div>
                  <div style={{ fontSize:9.5, color:'#475569', marginTop:3 }}>Inspector name</div>
                </div>
                <div>
                  <div style={{ borderBottom:'1px solid #94A3B8', height:26 }}>
                    <span style={{ fontSize:12, color:'#334155' }}>{vehicle.inspectorRole || ''}</span>
                  </div>
                  <div style={{ fontSize:9.5, color:'#475569', marginTop:3 }}>Designation</div>
                </div>
              </div>
            </div>
          </section>

          <div style={{ height:3, background:'linear-gradient(90deg,#4FE3DC,#4D9BFF,#4FE3DC)' }} />
          <div className="foot" style={{ alignItems:'center' }}>
            <div>Prepared by <b style={{color:'#4FE3DC'}}>{dealerName}</b> · powered by <b>TruInspect</b></div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <img src={trudealerLockup} alt="TruDealer" style={{ height:20, width:'auto' }} />
              <span>{reportId}</span>
            </div>
            <div>Visual inspection at a moment in time — not a mechanical warranty. See Scope.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
