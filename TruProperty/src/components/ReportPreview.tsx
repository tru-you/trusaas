import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Download, Printer, Share2, Award, AlertTriangle, CheckCircle2, XCircle,
  Camera, FileText, ClipboardList, Clock, Copy, Check, Lock,
} from 'lucide-react';
import { Vehicle, PointResult } from '../types';
import { computeInspectionReadiness } from '../lib/readiness';
import { useAuth } from '../contexts/AuthContext';
import { deriveReportId } from '../types/inspection';
import { DEFAULT_TEMPLATE } from '../templates';
import type { TemplateSlot } from '../templates';
import { usePropertySlots } from '../lib/usePropertySlots';
import { generateVaultReport } from '../lib/propvault';

interface ReportPreviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onVehicleUpdated?: (v: Vehicle) => void;
}

/** How many of the template's slots have a photo — a count, not a quality
 *  score. Photo capture quality (lighting/angle/AI score) is a TruLens
 *  concept and plays no part in this report; see the note on CONDITION_SCALE
 *  below for why. */
function countCapturedPhotos(vehicle: Vehicle, slots: TemplateSlot[]) {
  const captured = slots.filter(s => !!vehicle.photos?.[s.id]).length;
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
  { min: 4.5, band: '5.0 – 4.5', label: 'Excellent', meaning: 'Minor blemishes only. Move-in ready.', color: '#16A34A' },
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
  const slots = usePropertySlots(vehicle);
  const reportRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  /* Inlining every photo takes a moment on a big inspection, and a download
     button that appears to do nothing gets pressed again. */
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [vaulting, setVaulting] = useState(false);
  const [vaultDone, setVaultDone] = useState(!!vehicle.issuedReport);

  const agencyName =
    vehicle.agencyName ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('truestate_agency_name') : null) ||
    '';
  const agencyBranch =
    (typeof localStorage !== 'undefined' ? localStorage.getItem('truestate_agency_branch') : null) ||
    '';
  const agencyWa =
    vehicle.agencyWhatsApp ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('truestate_agency_wa') : null) ||
    '';

  const brandedVehicle = useMemo(
    () => ({
      ...vehicle,
      agencyName,
      agencyWhatsApp: agencyWa || vehicle.agencyWhatsApp,
    }),
    [vehicle, agencyName, agencyWa]
  );

  const readiness = useMemo(() => computeInspectionReadiness(brandedVehicle), [brandedVehicle]);
  const overall = useMemo(() => countCapturedPhotos(vehicle, slots), [vehicle, slots]);
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

      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PropInspect Report · ${vehicle.propertyType} · ${vehicle.suburb} · ${vehicle.listingRef || ''}</title><style>*{box-sizing:border-box}body{margin:0;background:#F1F5F9;padding:16px;overflow-x:hidden}</style></head><body>${clone.outerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `PropInspect_Report_${vehicle.listingRef || 'draft'}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setExporting(false);
    }
  };
  const hasCondition = condition.hasInput;
  const band = conditionBand(hasCondition ? condition.stars : null);

  /* Stable for the life of the property record. This carried Date.now(), so
     printing the same inspection twice produced two different IDs and the
     report could not be cited. Derived only from the vehicle id, which does
     not change. 'PI' = Property Inspection. */
  const reportId = deriveReportId(vehicle, 'PI');
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
          filename: `PropInspect_Report_${vehicle.listingRef || 'draft'}.pdf`,
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

  const issueToVault = async () => {
    if (!onVehicleUpdated) return;
    setVaulting(true);
    try {
      const html = await generateVaultReport(vehicle, slots, agencyName, agencyBranch, agencyWa);
      onVehicleUpdated({
        ...vehicle,
        issuedReport: {
          html,
          issuedAt: new Date().toISOString(),
          issuedBy: user?.email || vehicle.inspectorName || 'inspector',
        },
      });
      setVaultDone(true);
    } catch (err) {
      console.error('PropVault generation failed:', err);
      alert('Could not generate the vault report. Try again.');
    } finally {
      setVaulting(false);
    }
  };

  const hero = vehicle.photos?.front_bumper || Object.values(vehicle.photos || {})[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F4F8FC] text-[#0A1420]">
      {/* Signed off after the inspection, before the report goes anywhere.
          On screen only — the printed VIR shows the values on its own
          signature block. */}
      <div className="no-print bg-white border-b border-[rgba(10,20,32,0.10)]">
        <div className="max-w-5xl mx-auto px-3 py-3">
          <div className="text-[12px] font-medium text-[rgba(10,20,32,0.50)] mb-2">
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
              className="w-full px-3 py-3 rounded-lg bg-[#F4F8FC] border border-[rgba(10,20,32,0.10)] text-[13px] text-[#0A1420] placeholder-neutral-400"
            />
            <input
              type="text"
              defaultValue={vehicle.inspectorRole || ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (vehicle.inspectorRole || '')) onVehicleUpdated?.({ ...vehicle, inspectorRole: v });
              }}
              placeholder="Designation (e.g. Workshop Manager)"
              className="w-full px-3 py-3 rounded-lg bg-[#F4F8FC] border border-[rgba(10,20,32,0.10)] text-[13px] text-[#0A1420] placeholder-neutral-400"
            />
          </div>
          {(!vehicle.inspectorName || !vehicle.erfNumber) && (
            <p className="text-[12px] text-amber-300/90 mt-2">
              {!vehicle.erfNumber && !vehicle.inspectorName
                ? 'No erf number and no inspector recorded — both print blank on the report.'
                : !vehicle.erfNumber
                  ? 'No erf number on this property — it prints blank on the report.'
                  : 'No inspector recorded — the signature block prints blank.'}
            </p>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[rgba(10,20,32,0.10)] no-print">
        <div className="max-w-5xl mx-auto px-3 py-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onBack} className="flex items-center gap-2 text-[rgba(10,20,32,0.65)] hover:text-[#0A1420] text-[16px] font-medium">
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
              className="flex items-center gap-1 px-3 py-2 bg-black/5 rounded-lg text-[13px] font-bold text-[rgba(10,20,32,0.65)] disabled:opacity-50"
            >
              <FileText size={12} /> {exporting ? 'Embedding…' : 'HTML'}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-2 bg-black/5 rounded-lg text-[13px] font-bold text-[rgba(10,20,32,0.65)]">
              <Printer size={12} /> Print
            </button>
            <button onClick={() => runPdf()} disabled={generating}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: '#0E9D98' }}>
              <Download size={12} /> {generating ? '…' : 'PDF'}
            </button>
            {onVehicleUpdated && (
              <button
                onClick={issueToVault}
                disabled={vaulting}
                title={vaultDone ? 'Report already issued — tap to re-issue with current data' : 'Seal a self-contained report into PropVault. Raw captures can be deleted after.'}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-bold disabled:opacity-50 ${
                  vaultDone
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                <Lock size={12} /> {vaulting ? 'Sealing…' : vaultDone ? 'Issued' : 'Vault'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden-on-screen sales pack used only for PDF (also shown in print if user wants) */}
      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {/* On-screen inspection summary card */}
        <div className="no-print rounded-xl border border-[rgba(10,20,32,0.10)] bg-white p-3 text-[13px]">
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-[13px] tracking-normal text-[rgba(10,20,32,0.50)] font-bold">Inspection status</div>
              <div className="font-bold text-[16px] text-[#0E9D98]">{condition.label}</div>
              <div className="text-[rgba(10,20,32,0.50)] mt-1">
                Photos {readiness.requiredTaken}/{readiness.requiredTotal}
                {` · ${condition.findings.length} damage tag${condition.findings.length === 1 ? '' : 's'}`}
                {` · ${checklistFlags.length} checklist flag${checklistFlags.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="text-right text-[rgba(10,20,32,0.50)] text-[13px] max-w-[200px]">
              Export the report as PDF or standalone HTML when capture and checklist are complete.
            </div>
          </div>
        </div>

        <div ref={reportRef} className="tl-report">
          {/* ── Palette warning ──────────────────────────────────────────────
              This document is WHITE paper (var(--paper) / var(--ink)). The app
              around it is near-black. A rebrand sweep once put the app's paper
              token — a near-WHITE — on text inside this white page. Every
              muted colour on this report is dark ink (var(--ink-2)/var(--muted)),
              never the app's light text tokens. The only place near-white is
              correct is text painted on a coloured chip (verdict icon, dots),
              which carries its own background. */}
          <style>{`
            .tl-report {
              --paper:#FFFFFF; --ink:#121A26; --ink-2:#3A4553; --muted:#6E6656; --faint:#A79D8C;
              --line:rgba(18,26,38,.12); --line-soft:rgba(18,26,38,.06);
              --cyan:#07889B; --cyan-bg:rgba(7,136,155,.06);
              --green:#1A7A3A; --green-bg:rgba(26,122,58,.08);
              --amber:#B07A26; --amber-bg:rgba(176,122,38,.08);
              --red:#B03226; --red-bg:rgba(176,50,38,.08);
              --night:#080C14;
              --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
              --display: Georgia, "Times New Roman", serif;
              --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
              width: 100%; max-width: 210mm; margin: 0 auto; background: var(--paper); color: var(--ink);
              font-family: var(--sans); font-size: 9.5px; line-height: 1.55; border-radius: 12px; overflow: hidden;
              box-sizing: border-box;
            }
            .tl-report *, .tl-report *::before, .tl-report *::after { box-sizing: border-box; }
            .tl-report .doc-body { padding: 10mm 12mm 8mm; overflow: hidden; }

            /* Header band */
            .tl-report .hdr { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding-bottom:10px; margin-bottom:16px; border-bottom:2.5px solid var(--ink); break-inside:avoid; page-break-inside:avoid; }
            .tl-report .hdr-left { display:flex; align-items:center; gap:10px; min-width:0; flex-wrap:wrap; }
            .tl-report .hdr-left img.logo { height:28px; width:auto; flex:none; }
            .tl-report .hdr-left img.lockup { height:16px; width:auto; flex:none; margin-left:6px; }
            .tl-report .hdr-left .dealer { font-size:9.5px; color:var(--ink-2); margin-left:8px; line-height:1.35; overflow-wrap:break-word; }
            .tl-report .hdr-left .dealer b { color:var(--ink); }
            .tl-report .hdr-right { text-align:right; flex:none; }
            .tl-report .hdr-right .doc-type { font-family:var(--mono); font-size:8.5px; letter-spacing:.18em; text-transform:uppercase; color:var(--cyan); font-weight:700; white-space:nowrap; }
            .tl-report .hdr-right .doc-id { font-family:var(--mono); font-size:8.5px; color:var(--muted); margin-top:3px; white-space:nowrap; }

            /* Verdict banner */
            .tl-report .verdict { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:10px; margin-bottom:18px; break-inside:avoid; }
            .tl-report .verdict.pass { background:var(--green-bg); border:1px solid rgba(26,122,58,.3); }
            .tl-report .verdict.caution { background:var(--amber-bg); border:1px solid rgba(176,122,38,.3); }
            .tl-report .verdict.fail { background:var(--red-bg); border:1px solid rgba(176,50,38,.3); }
            .tl-report .verdict.unknown { background:var(--line-soft); border:1px solid var(--line); }
            .tl-report .verdict .icon { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none; color:#fff; }
            .tl-report .verdict.pass .icon { background:var(--green); }
            .tl-report .verdict.caution .icon { background:var(--amber); }
            .tl-report .verdict.fail .icon { background:var(--red); }
            .tl-report .verdict.unknown .icon { background:var(--muted); }
            .tl-report .verdict .body { min-width:0; flex:1; }
            .tl-report .verdict .body h3 { font-family:var(--display); font-weight:600; font-size:17px; line-height:1.15; margin:0 0 3px; overflow-wrap:break-word; }
            .tl-report .verdict.pass .body h3 { color:var(--green); }
            .tl-report .verdict.caution .body h3 { color:var(--amber); }
            .tl-report .verdict.fail .body h3 { color:var(--red); }
            .tl-report .verdict.unknown .body h3 { color:var(--muted); }
            .tl-report .verdict .body p { font-size:10.5px; color:var(--ink-2); margin:0; }
            .tl-report .verdict .score { margin-left:auto; text-align:center; flex:none; padding-left:12px; border-left:1px solid var(--line); }
            .tl-report .verdict .score .num { font-family:var(--display); font-size:24px; font-weight:600; line-height:1; }
            .tl-report .verdict .score .lbl { font-family:var(--mono); font-size:7px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-top:3px; }

            /* Vehicle info grid */
            .tl-report .vehicle { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; margin-bottom:18px; }
            .tl-report .vehicle .row { display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid var(--line-soft); }
            .tl-report .vehicle .row .k { font-family:var(--mono); font-size:7.8px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); white-space:nowrap; }
            .tl-report .vehicle .row .v { font-size:10.5px; font-weight:700; color:var(--ink); text-align:right; overflow-wrap:break-word; word-break:break-word; }

            /* Photo grid — hero 2x2 */
            .tl-report .photos { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:18px; break-inside:avoid; page-break-inside:avoid; }
            .tl-report .photo { position:relative; aspect-ratio:4/3; background:var(--line-soft); border-radius:6px; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; overflow:hidden; break-inside:avoid; }
            .tl-report .photo img { width:100%; height:100%; object-fit:cover; display:block; }
            .tl-report .photo span.slot { font-family:var(--mono); font-size:6.8px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); text-align:center; padding:4px; }
            .tl-report .photo .cap { position:absolute; left:0; right:0; bottom:0; background:rgba(18,26,38,.65); color:#fff; font-size:6.8px; letter-spacing:.06em; padding:3px 5px; font-family:var(--mono); }
            .tl-report .photo.hero { grid-column:span 2; grid-row:span 2; }
            @media (max-width:720px) {
              .tl-report .photos { grid-template-columns:repeat(2,1fr); }
              .tl-report .photo.hero { grid-column:span 2; grid-row:span 1; }
            }

            /* Section title pattern */
            .tl-report .section-title { display:flex; align-items:center; gap:8px; margin:20px 0 12px; }
            .tl-report .section-title .n { font-family:var(--mono); font-size:8.5px; letter-spacing:.18em; text-transform:uppercase; color:var(--cyan); font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:6px; }
            .tl-report .section-title .ln { flex:1; height:1px; background:var(--line); }

            /* Body panel grades */
            .tl-report .panel-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:18px; }
            .tl-report .panel { padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--paper); break-inside:avoid; }
            .tl-report .panel .name { font-family:var(--mono); font-size:7.2px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
            .tl-report .panel .grade { font-size:10.5px; font-weight:700; }
            .tl-report .panel .grade.good { color:var(--green); }
            .tl-report .panel .grade.fair { color:var(--amber); }
            .tl-report .panel .grade.poor { color:var(--red); }
            .tl-report .panel .grade.na { color:var(--faint); }
            .tl-report .panel .note { font-size:9px; color:var(--ink-2); margin-top:3px; overflow-wrap:break-word; }
            @media (max-width:720px) { .tl-report .panel-grid { grid-template-columns:repeat(2,1fr); } }

            /* Damage / disclosure findings */
            .tl-report .finding { border-radius:0 8px 8px 0; padding:10px 14px; margin-bottom:8px; border-left:4px solid var(--muted); overflow-wrap:break-word; break-inside:avoid; }
            .tl-report .finding .h { font-family:var(--mono); font-size:7.8px; letter-spacing:.1em; text-transform:uppercase; }
            .tl-report .finding .l { font-size:10.5px; color:var(--ink-2); margin-top:4px; font-weight:500; }
            .tl-report .no-issues { background:var(--green-bg); border-left:4px solid var(--green); border-radius:0 8px 8px 0; padding:10px 14px; color:var(--green); font-weight:700; font-size:11px; }

            /* Mechanicals / inspection sheet — status dots */
            .tl-report .checks { display:grid; grid-template-columns:repeat(2,1fr); gap:2px 12px; margin-bottom:18px; }
            .tl-report .check { display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-bottom:1px solid var(--line-soft); break-inside:avoid; }
            .tl-report .check .dot { width:7px; height:7px; border-radius:50%; flex:none; margin-top:3px; }
            .tl-report .check .lbl { font-size:9.5px; color:var(--ink-2); overflow-wrap:break-word; }
            .tl-report .check .grp { font-family:var(--mono); font-size:6.8px; letter-spacing:.08em; color:var(--muted); display:block; }
            @media (max-width:720px) { .tl-report .checks { grid-template-columns:1fr; } }

            /* Gallery */
            .tl-report .gallery { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:18px; break-inside:avoid; page-break-inside:avoid; }
            .tl-report .photo-tile { border:1px solid var(--line); border-radius:6px; overflow:hidden; break-inside:avoid; }
            .tl-report .photo-tile img { width:100%; height:auto; max-height:130px; object-fit:cover; display:block; }
            .tl-report .photo-tile .cap { padding:6px 8px; font-size:9px; color:var(--ink-2); font-family:var(--mono); overflow-wrap:break-word; }
            @media (max-width:720px) { .tl-report .gallery { grid-template-columns:repeat(2,1fr); } }

            /* Prose blocks — scope & disclaimers */
            .tl-report .prose { font-size:10px; color:var(--ink-2); margin-bottom:8px; line-height:1.6; overflow-wrap:break-word; }
            .tl-report .prose b { color:var(--ink); }
            .tl-report .card { border:1px solid var(--line); border-radius:8px; padding:12px 14px; margin-bottom:10px; break-inside:avoid; }
            .tl-report .card .k { font-family:var(--mono); font-size:7.8px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }

            /* Condition scale legend */
            .tl-report .scale-row { display:flex; gap:8px; font-size:10px; color:var(--ink-2); padding:4px 0; border-bottom:1px solid var(--line-soft); align-items:baseline; flex-wrap:wrap; }
            .tl-report .scale-row b.band { min-width:60px; font-family:var(--mono); }
            .tl-report .scale-row b.label { min-width:60px; color:var(--ink); }

            /* Checklist tables */
            .tl-report table.checklist { width:100%; border-collapse:collapse; font-size:9.5px; table-layout:fixed; margin-bottom:14px; }
            .tl-report table.checklist th, .tl-report table.checklist td { border-bottom:1px solid var(--line-soft); padding:6px 6px; text-align:left; overflow-wrap:break-word; }
            .tl-report table.checklist th { font-family:var(--mono); font-size:7.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }

            /* Signature row */
            .tl-report .sig-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:20px; padding-top:14px; border-top:1px solid var(--line); }
            .tl-report .sig .line { border-top:1px solid var(--ink); padding-top:5px; min-height:22px; overflow-wrap:break-word; }
            .tl-report .sig .name { font-size:10.5px; color:var(--ink); font-weight:600; }
            .tl-report .sig .lbl { font-family:var(--mono); font-size:7.2px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-top:4px; }

            /* Footer */
            .tl-report .foot { border-top:1px solid var(--line); margin-top:16px; padding-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-family:var(--mono); font-size:7.8px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
            .tl-report .foot .cy { color:var(--cyan); }
            .tl-report .foot .lockup-wrap { display:flex; align-items:center; gap:8px; }
            .tl-report .foot img.lockup { height:16px; width:auto; }
            .tl-report .accent { height:3px; background:var(--cyan); margin:0 0 2px; }

            @media print {
              .no-print { display:none !important; }
              body, html { background:#fff !important; color:var(--ink) !important; margin:0; padding:0; overflow:visible !important; }
              .tl-report { max-width:100% !important; width:100% !important; border-radius:0 !important; box-shadow:none !important; margin:0 !important; }
              .tl-report .doc-body { padding:8mm 10mm; }
              .tl-report img { max-height:120px; }
              .tl-report .hdr { break-inside:avoid; page-break-inside:avoid; }
              .tl-report .verdict { break-inside:avoid; page-break-inside:avoid; }
              .tl-report .photos { grid-template-columns:repeat(4,1fr); break-inside:avoid; page-break-inside:avoid; }
              .tl-report .gallery { grid-template-columns:repeat(3,1fr); break-inside:avoid; page-break-inside:avoid; }
              .tl-report .section-title { break-after:avoid; page-break-after:avoid; }
              .tl-report .panel, .tl-report .finding, .tl-report .check, .tl-report .photo-tile, .tl-report .photo, .tl-report .card, .tl-report .sig-row { break-inside:avoid; page-break-inside:avoid; }
              .tl-report table { break-inside:auto; }
              .tl-report tr { break-inside:avoid; }
            }
          `}</style>

          <div className="doc-body">
            {/* Header band */}
            <div className="hdr">
              <div className="hdr-left">
                <span style={{ fontFamily:'var(--display)', fontWeight:700, fontSize:18, color:'var(--cyan)' }}>PropInspect</span>
                {(agencyName || agencyBranch) && (
                  <div className="dealer">
                    {agencyName && <b>{agencyName}</b>}
                    {agencyBranch ? <> · {agencyBranch}</> : null}
                  </div>
                )}
              </div>
              <div className="hdr-right">
                <div className="doc-type">Property Inspection Report</div>
                <div className="doc-id">{reportId} · {generatedAt}</div>
              </div>
            </div>

            {/* Verdict banner */}
            {(() => {
              const verdictClass = !hasCondition ? 'unknown' : condition.stars >= 3.5 ? 'pass' : condition.stars >= 2.5 ? 'caution' : 'fail';
              const VerdictIcon = !hasCondition ? ClipboardList : condition.stars >= 3.5 ? CheckCircle2 : condition.stars >= 2.5 ? AlertTriangle : XCircle;
              const verdictHeading = !hasCondition ? 'Not Yet Inspected' : `Condition — ${band.label}`;
              return (
                <div className={`verdict ${verdictClass}`}>
                  <div className="icon"><VerdictIcon size={18} /></div>
                  <div className="body">
                    <h3>{verdictHeading}</h3>
                    <p>{band.meaning} · {condition.findings.length} damage tag{condition.findings.length === 1 ? '' : 's'} · {readiness.requiredTaken}/{readiness.requiredTotal} required photos captured.</p>
                  </div>
                  <div className="score">
                    <div className="num">{hasCondition ? condition.stars.toFixed(1) : '—'}</div>
                    <div className="lbl">/ 5 condition</div>
                  </div>
                </div>
              );
            })()}

            {/* Property info grid */}
            <div className="vehicle">
              <div className="row"><span className="k">Property Type</span><span className="v">{vehicle.propertyType || '—'}</span></div>
              <div className="row"><span className="k">Suburb</span><span className="v">{vehicle.suburb || '—'}</span></div>
              <div className="row"><span className="k">Erf Number</span><span className="v">{vehicle.erfNumber || '—'}</span></div>
              <div className="row"><span className="k">Listing Ref</span><span className="v">{vehicle.listingRef || '—'}</span></div>
              <div className="row"><span className="k">Year Built</span><span className="v">{vehicle.yearBuilt || '—'}</span></div>
              <div className="row"><span className="k">Address</span><span className="v">{vehicle.address || '—'}</span></div>
              <div className="row"><span className="k">List Price</span><span className="v">R {Number(vehicle.listPrice || 0).toLocaleString('en-ZA')}</span></div>
              <div className="row"><span className="k">Photos</span><span className="v">{readiness.requiredTaken}/{readiness.requiredTotal} required</span></div>
              <div className="row"><span className="k">Issues Found</span><span className="v">{condition.findings.length}</span></div>
            </div>

            {/* Photo grid — hero + required slots */}
            {(() => {
              const ordered = slots.filter(s => s.required).length
                ? slots.filter(s => s.required)
                : slots;
              const heroSlot = ordered.find(s => vehicle.photos?.[s.id] === hero) || ordered[0];
              const rest = ordered.filter(s => s.id !== heroSlot?.id).slice(0, 6);
              const tiles = heroSlot ? [heroSlot, ...rest] : rest;
              return (
                <div className="photos">
                  {tiles.map((slot, i) => {
                    const src = vehicle.photos?.[slot.id];
                    const isHero = i === 0;
                    return (
                      <div className={`photo${isHero ? ' hero' : ''}`} key={slot.id}>
                        {src ? (
                          <>
                            <img src={src} alt={slot.name} />
                            <div className="cap">{slot.name}</div>
                          </>
                        ) : (
                          <span className="slot">{slot.name}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Condition summary — panel grades */}
            <div className="section-title"><span className="n"><Award size={11} /> Condition summary</span><span className="ln" /></div>
            {(() => {
              const sa = vehicle.slotAssessment || {};
              const rows = slots
                .map(s => ({ s, r: sa[s.id] }))
                .filter(({ r }) => r && (r.rating || r.comment));
              if (!rows.length) {
                return <div className="prose" style={{ fontStyle:'italic' }}>No panel-by-panel assessments recorded yet.</div>;
              }
              const gradeOf = (r?: PointResult) =>
                r?.rating === 'ok' ? { t: 'Good', cls: 'good' } :
                r?.rating === 'note' ? { t: 'Fair', cls: 'fair' } :
                r?.rating === 'damage' ? { t: 'Poor', cls: 'poor' } : { t: '—', cls: 'na' };
              return (
                <div className="panel-grid">
                  {rows.map(({ s, r }) => {
                    const g = gradeOf(r);
                    return (
                      <div className="panel" key={s.id}>
                        <div className="name">{s.name}</div>
                        <div className={`grade ${g.cls}`}>{g.t}</div>
                        {r?.comment && <div className="note">{r.comment}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Required photo checklist */}
            <div className="section-title"><span className="n"><ClipboardList size={11} /> Required photo checklist</span><span className="ln" /></div>
            <table className="checklist">
              <thead>
                <tr><th>Slot</th><th>Status</th></tr>
              </thead>
              <tbody>
                {slots.filter(s => s.required).map(s => {
                  const has = !!vehicle.photos?.[s.id];
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td style={{ color: has ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>{has ? 'Captured' : 'Missing'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Damage findings */}
            <div className="section-title"><span className="n"><AlertTriangle size={11} /> Damage findings</span><span className="ln" /></div>
            <div className="card" style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontFamily:'var(--display)', fontWeight:600, fontSize:22, color: condition.stars >= 3.5 ? 'var(--green)' : condition.stars >= 2.5 ? 'var(--amber)' : 'var(--red)' }}>
                {condition.stars.toFixed(1)}<span style={{ fontSize:11, color:'var(--muted)' }}>/5</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:11 }}>Condition score</div>
                <div style={{ fontSize:10, color:'var(--ink-2)' }}>{condition.label} · {condition.findings.length} tag{condition.findings.length === 1 ? '' : 's'} across {Object.keys(vehicle.damageFindings || {}).length} photos</div>
              </div>
            </div>
            {condition.findings.length === 0 ? (
              <div className="no-issues"><CheckCircle2 size={13} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/> No damage was tagged on the inspection photos.</div>
            ) : (
              condition.findings.map((f, i) => {
                const sev = severityMeta(f.severity);
                const slot = slots.find(s => s.id === f.slotId);
                return (
                  <div className="finding" key={i} style={{ background: sev.bg, borderLeftColor: sev.color }}>
                    <div className="h" style={{ color: sev.color }}>
                      {sev.label} · {f.damageType} · {f.panel}
                    </div>
                    <div className="l">
                      {f.note || 'Tagged by inspector'}
                      <span style={{ color:'var(--muted)' }}> — {slot?.name || f.slotId}</span>
                    </div>
                  </div>
                );
              })
            )}

            {(() => {
              const sa = vehicle.slotAssessment || {};
              const rows = slots
                .map(s => ({ s, r: sa[s.id], shots: vehicle.closeups?.[s.id] || [] }))
                .filter(({ r, shots }) => r && (r.rating || r.comment || shots.length));
              if (!rows.length) return null;
              const stateOf = (r?: PointResult) =>
                r?.rating === 'ok' ? { t: 'OK', c: '#1A7A3A' } :
                r?.rating === 'note' ? { t: 'Note', c: '#B07A26' } :
                r?.rating === 'damage' ? { t: 'Damage', c: '#B03226' } : { t: '—', c: '#6E6656' };
              return (
                <>
                  <div className="section-title"><span className="n"><Camera size={11} /> Condition by photo</span><span className="ln" /></div>
                  {rows.map(({ s, r, shots }) => {
                    const st = stateOf(r);
                    return (
                      <div className="finding" key={s.id} style={r?.rating === 'ok' ? { background:'var(--green-bg)', borderLeftColor:'var(--green)' } : undefined}>
                        <div className="h" style={{ color: st.c }}>{s.name} · {st.t}</div>
                        {r?.comment && <div className="l">{r.comment}</div>}
                        {shots.length > 0 && (
                          <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                            {shots.map((src, i) => (
                              <img key={i} src={src} alt="close-up" style={{ width:90, height:68, objectFit:'cover', borderRadius:6, border:'1px solid var(--line)' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}

            {/* Inspection sheet — mechanicals checklist with status dots */}
            <div className="section-title"><span className="n"><ClipboardList size={11} /> Inspection sheet</span><span className="ln" /></div>
            {(() => {
              const pts = vehicle.inspectionPoints || {};
              const rows = (DEFAULT_TEMPLATE.checklistPoints || [])
                .map(p => ({ p, r: pts[p.id] }))
                .filter(({ r }) => r && (r.rating || r.works || r.comment));
              if (!rows.length) {
                return <div className="prose" style={{ fontStyle:'italic' }}>Inspection not completed for this property.</div>;
              }
              const stateLabel = (r?: typeof rows[number]['r'], kind?: string) =>
                kind === 'presence' ? (
                  r?.works === 'yes' ? { t: 'Present', c: '#1A7A3A' } :
                  r?.works === 'no' ? { t: 'Not Present', c: '#B03226' } :
                  { t: '—', c: '#6E6656' }
                ) : kind === 'compliance' ? (
                  r?.works === 'yes' ? { t: 'FSH', c: '#1A7A3A' } :
                  r?.works === 'na' ? { t: 'Partial', c: '#B07A26' } :
                  r?.works === 'no' ? { t: 'None', c: '#B03226' } :
                  { t: '—', c: '#6E6656' }
                ) :
                r?.works === 'yes' ? { t: 'Works', c: '#1A7A3A' } :
                r?.works === 'no' ? { t: 'Faulty', c: '#B03226' } :
                r?.works === 'na' ? { t: 'N/A', c: '#6E6656' } :
                r?.rating === 'ok' ? { t: 'OK', c: '#1A7A3A' } :
                r?.rating === 'note' ? { t: 'Note', c: '#B07A26' } :
                r?.rating === 'damage' ? { t: 'Damage', c: '#B03226' } :
                { t: '—', c: '#6E6656' };
              const flagged = condition.flaggedPoints;
              return (
                <>
                  {flagged.length > 0 && (
                    <div style={{ marginBottom:12 }}>
                      {flagged.map(({ point, res }) => (
                        <div className="finding" key={point.id} style={{ background:'var(--amber-bg)', borderLeftColor:'var(--amber)' }}>
                          <div className="h" style={{ color:'var(--amber)' }}>Disclosure · {point.name}</div>
                          <div className="l">{stateLabel(res, point.kind).t}{res?.comment ? ` — ${res.comment}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="checks">
                    {rows.map(({ p, r }) => {
                      const s = stateLabel(r, p.kind);
                      return (
                        <div className="check" key={p.id}>
                          <span className="dot" style={{ background: s.c }} />
                          <span className="lbl"><span className="grp">{p.group}</span>{p.name} — {s.t}{r?.comment ? ` · ${r.comment}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Gallery */}
            <div className="section-title"><span className="n"><Camera size={11} /> Gallery</span><span className="ln" /></div>
            <div className="gallery">
              {slots.filter(s => vehicle.photos?.[s.id]).slice(0, 12).map(slot => (
                <div className="photo-tile" key={slot.id}>
                  <img src={vehicle.photos[slot.id]} alt={slot.name} />
                  <div className="cap">{slot.name}</div>
                </div>
              ))}
            </div>

            {/* Scope & disclaimers */}
            <div className="section-title"><span className="n"><FileText size={11} /> Scope &amp; disclaimers</span><span className="ln" /></div>
            <div className="card">
              <div className="k">Covered</div>
              <div className="prose" style={{ marginBottom:0 }}>
                A visual inspection of the property's exterior, interior rooms,
                structural elements, systems and accessible documents. Inspection
                conducted with the property unoccupied or with limited access.
                Visible systems checked for condition and functionality where safely
                accessible.
              </div>
            </div>
            <div className="card">
              <div className="k">Not covered</div>
              <div className="prose" style={{ marginBottom:0 }}>
                No invasive testing, no removal of coverings or fixtures, no
                laboratory analysis, no structural depth measurement, no assessment of
                systems in areas not safely or readily accessible, and no evaluation of
                compliance status with local building codes beyond visual observation.
              </div>
            </div>
            <div className="card">
              <div className="k">Compliance &amp; testing</div>
              <div className="prose" style={{ marginBottom:0 }}>
                Carried out only where the checklist above records it. Where an item
                is unanswered or marked not applicable, that check was not performed
                and nothing should be inferred from its absence. Findings describe
                what was observed on the date shown — nothing in this report states
                or implies compliance or condition of any system that was not
                physically tested or visually verified.
              </div>
            </div>

            {/* Inspection summary */}
            <div className="section-title"><span className="n"><Award size={11} /> Inspection summary</span><span className="ln" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div className="card" style={{ marginBottom:0 }}>
                <div className="k">Inspected by</div>
                <div style={{ fontWeight:700 }}>{agencyName}</div>
                {agencyBranch ? <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>{agencyBranch}</div> : null}
                {agencyWa ? <div style={{ fontSize:10, marginTop:6 }}>WhatsApp {agencyWa}</div> : null}
              </div>
              <div className="card" style={{ marginBottom:0 }}>
                <div className="k">Work done</div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>Photos captured: {Object.keys(vehicle.photos || {}).length}</div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>Damage tags: {condition.findings.length}</div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>Checklist answered: {checklistAnswered.length} · flagged: {checklistFlags.length}</div>
              </div>
            </div>
            <div className="card" style={{ marginTop:8 }}>
              <div className="k">Property identity</div>
              <div style={{ fontSize:10.5, color:'var(--ink-2)' }}>
                Erf Number <b style={{ fontFamily:'var(--mono)', color:'var(--ink)' }}>{vehicle.erfNumber || '— not recorded —'}</b>
              </div>
              <div style={{ fontSize:10.5, color:'var(--ink-2)', marginTop:2 }}>
                Listing Ref {vehicle.listingRef || '—'} · {vehicle.propertyType} · {vehicle.suburb}
              </div>
              <div style={{ fontSize:10.5, color:'var(--ink-2)', marginTop:2 }}>Inspected {generatedAt}</div>
            </div>

            {/* Condition scale legend */}
            <div className="section-title"><span className="n">Condition scale</span><span className="ln" /></div>
            <div className="card">
              {CONDITION_SCALE.map(b => (
                <div className="scale-row" key={b.label}>
                  <b className="band" style={{ color:b.color }}>{b.band}</b>
                  <b className="label">{b.label}</b>
                  <span style={{ color:'var(--ink-2)' }}>{b.meaning}</span>
                </div>
              ))}
              <div className="prose" style={{ marginTop:8, marginBottom:0 }}>
                Weighted from recorded findings — damage severity, flagged inspection
                points and function faults. It is not a measure of photo quality.
              </div>
            </div>

            {/* Signature row */}
            <div className="sig-row">
              <div className="sig">
                <div className="line"><span className="name">{vehicle.inspectorName || ''}</span></div>
                <div className="lbl">Inspector — {vehicle.inspectorRole || 'signature'}</div>
              </div>
              <div className="sig">
                <div className="line"><span className="name">&nbsp;</span></div>
                <div className="lbl">Customer acknowledgement</div>
              </div>
            </div>

            <div className="accent" />
            <div className="foot">
              <div>Prepared by <b className="cy">{agencyName}</b> · powered by <b>TruProperty</b></div>
              <div className="lockup-wrap">
                <span style={{ fontFamily:'var(--display)', fontWeight:700, fontSize:11, color:'var(--cyan)' }}>TruProperty</span>
                <span>{reportId}</span>
              </div>
              <div>Visual inspection at a moment in time — not a structural warranty. See Scope.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
