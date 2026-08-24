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
import { SignaturePad } from './signature-pad';
import trulensLockup from '../assets/images/trulens-wordmark.png';
import trudealerLockup from '../assets/images/trudealer-lockup.png';

interface ReportPreviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onVehicleUpdated?: (v: Vehicle) => void;
}

/**
 * Pick the largest html2canvas scale that keeps the rasterised report within
 * mobile canvas limits. Android Chrome caps a canvas at ~16.7M pixels (and
 * ~65k per side) and runs out of memory well before that on a long report — at
 * a hard-coded scale of 2 a full report blows past the cap and html2pdf throws,
 * which is the "PDF failed" the dealer sees. We size the scale to the node's
 * real dimensions so it renders at the best quality that still fits, clamped to
 * [1, 2] so a short report still looks crisp.
 */
function safePdfScale(el: HTMLElement): number {
  const cssW = el.scrollWidth || el.getBoundingClientRect().width || 794;
  const cssH = el.scrollHeight || el.getBoundingClientRect().height || 1123;
  const MAX_AREA = 12_000_000; // stay comfortably under the ~16.7M mobile cap
  const MAX_SIDE = 12_000;
  const byArea = Math.sqrt(MAX_AREA / (cssW * cssH));
  const bySide = Math.min(MAX_SIDE / cssW, MAX_SIDE / cssH);
  const ideal = Math.min(2, window.devicePixelRatio || 1.5);
  return Math.max(1, Math.min(ideal, byArea, bySide));
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

  /* TruLens is not a graded VIR (that's TruInspect) — this report states a plain,
     dealer-declared condition. `clear` = dealer declared no visible damage;
     `damage` = visible damage tagged and shown; `undeclared` = not answered yet,
     so silence is never presented as a clean bill. */
  const findings = condition.findings;
  const declared = vehicle.conditionDeclaration || null;
  const conditionState: 'clear' | 'damage' | 'undeclared' =
    findings.length > 0 ? 'damage' : declared?.noVisibleDamage ? 'clear' : 'undeclared';
  const conditionText =
    conditionState === 'clear'
      ? 'No damage reported'
      : conditionState === 'damage'
      ? `Visible damage reported — ${findings.length} item${findings.length === 1 ? '' : 's'}`
      : 'Condition not declared';
  const condColor = conditionState === 'clear' ? '#16A34A' : conditionState === 'damage' ? '#B03226' : '#6E6656';
  const coreSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.tier === 'core');
  const waBlurb = useMemo(
    () => whatsAppSalesBlurb(brandedVehicle, readiness, { dealerName, waNumber: dealerWa || undefined }),
    [brandedVehicle, readiness, dealerName, dealerWa]
  );

  const embedUrl = vehicle.web3dPublicPath
    ? `/embed/web3d-viewer.html?stock=${encodeURIComponent(vehicle.stockNumber)}`
    : null;

  const capturedPhotos = DEFAULT_TEMPLATE.slots.filter(s => vehicle.photos?.[s.id]);

  const reportId = `TL-${(vehicle.stockNumber || vehicle.id).toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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
          if (!src || src.startsWith('data:')) return;
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
            /* One unreachable photo must not cost the whole report */
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
          html2canvas: { scale: safePdfScale(el), useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 15000 },
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
      /* Frames drive the 360 spin (one exterior-panel capture per orbit
         position). Damage tags are optional overlays placed ON the spin,
         not what makes it work — so the message names them separately. */
      setWeb3dMsg(
        `Web 3D ready · ${data.frames ?? pkg.frames.length} panel frames · ${data.damageTags ?? pkg.damageTags.length} damage overlays · ${pkg.background}`
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

  /* The dealer's condition declaration — the honest core of a TruLens report.
     One explicit statement rather than a graded score, so "no damage reported"
     is a claim the dealer made, not silence we dressed up. */
  const declareCondition = (noVisibleDamage: boolean) => {
    onVehicleUpdated?.({
      ...vehicle,
      conditionDeclaration: {
        noVisibleDamage,
        declaredAt: new Date().toISOString(),
        declaredBy: vehicle.capturedBy || undefined,
      },
    });
  };

  const hero = vehicle.photos?.front_bumper || Object.values(vehicle.photos || {})[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#06080D] text-[#E8EAE6]">
      {/* Signed off by — on-screen only */}
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
          {/* Drawn signature — mirrors the trade-in and VIR pads. Stored on the
              vehicle as a PNG data URL and rendered inline on the printed
              shoot report. */}
          <div className="mt-3">
            <SignaturePad
              value={vehicle.capturedBySignatureUrl || null}
              onChange={(url) => onVehicleUpdated?.({ ...vehicle, capturedBySignatureUrl: url ?? undefined })}
              label="Photographer signature"
            />
          </div>
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
              style={{ color: condColor, borderColor: condColor + '55', background: condColor + '18' }}
            >
              {conditionText}
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
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-bold text-[#0B0F17]"
              style={{ background: 'linear-gradient(120deg, #7FF0EA, #4FE3DC)' }}>
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
              <div className="font-bold text-[16px]" style={{ color: condColor }}>{conditionText}</div>
              <div className="text-[rgba(232,234,230,0.55)] mt-1">
                Core photos {coreSlots.filter((s) => vehicle.photos?.[s.id]).length}/{coreSlots.length}
                {` · ${findings.length} damage tag${findings.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="text-right text-[rgba(232,234,230,0.55)] text-[13px] max-w-[200px]">
              {readiness.reasons.length ? readiness.reasons.join(' · ') : 'Ready for website.'}
            </div>
          </div>

          {/* Condition declaration — the dealer's explicit statement. Disabled to
              "no visible damage" once damage is tagged, since that would be a
              false claim; the report then reads "visible damage reported". */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">Condition declaration</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => declareCondition(true)}
                disabled={findings.length > 0}
                className={`flex-1 py-2 rounded-lg text-[13px] font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  conditionState === 'clear'
                    ? 'bg-emerald-600/25 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-[rgba(232,234,230,0.72)] hover:bg-white/10'
                }`}
              >
                No visible damage
              </button>
              <button
                type="button"
                onClick={() => declareCondition(false)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-bold border transition-colors ${
                  conditionState === 'damage' || (declared && !declared.noVisibleDamage)
                    ? 'bg-amber-600/25 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/10 text-[rgba(232,234,230,0.72)] hover:bg-white/10'
                }`}
              >
                Damage tagged below
              </button>
            </div>
            {conditionState === 'undeclared' && (
              <p className="text-[12px] text-amber-300/90 mt-2">
                Declare the vehicle's condition — a listing isn't ready until this is stated.
              </p>
            )}
            {findings.length > 0 && (
              <p className="text-[12px] text-[rgba(232,234,230,0.55)] mt-2">
                {findings.length} damage tag{findings.length === 1 ? '' : 's'} recorded — the report shows them below.
              </p>
            )}
          </div>
        </div>

        {/* ── PRINTABLE CONDITION REPORT ── */}
        <div ref={reportRef} className="tl-report">
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

            /* Capture quality grades */
            .tl-report .quality-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:18px; }
            .tl-report .q-card { padding:10px 8px; border:1px solid var(--line); border-radius:6px; background:var(--paper); text-align:center; break-inside:avoid; }
            .tl-report .q-card .phase-name { font-family:var(--mono); font-size:7.2px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:4px; }
            .tl-report .q-card .q-label { font-size:11px; font-weight:700; }
            .tl-report .q-card .q-score { font-family:var(--mono); font-size:9px; color:var(--muted); margin-top:3px; }
            @media (max-width:720px) { .tl-report .quality-grid { grid-template-columns:repeat(3,1fr); } }

            /* Panel condition grades */
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

            /* Damage / findings */
            .tl-report .finding { border-radius:0 8px 8px 0; padding:10px 14px; margin-bottom:8px; border-left:4px solid var(--muted); overflow-wrap:break-word; break-inside:avoid; }
            .tl-report .finding .h { font-family:var(--mono); font-size:7.8px; letter-spacing:.1em; text-transform:uppercase; }
            .tl-report .finding .l { font-size:10.5px; color:var(--ink-2); margin-top:4px; font-weight:500; }
            .tl-report .no-issues { background:var(--green-bg); border-left:4px solid var(--green); border-radius:0 8px 8px 0; padding:10px 14px; color:var(--green); font-weight:700; font-size:11px; }

            /* Damage photo grid with pins */
            .tl-report .damage-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:18px; }
            .tl-report .damage-card { border:1px solid var(--line); border-radius:8px; overflow:hidden; break-inside:avoid; }
            .tl-report .damage-card img { width:100%; height:auto; max-height:150px; object-fit:cover; display:block; }
            .tl-report .damage-card .cap { padding:8px 10px; font-size:9.5px; color:var(--ink-2); overflow-wrap:break-word; }
            .tl-report .damage-pin { position:absolute; width:18px; height:18px; border-radius:50%; border:2px solid #fff; transform:translate(-50%,-50%); display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:800; color:#fff; box-shadow:0 1px 4px rgba(0,0,0,.4); }

            /* Checklist table */
            .tl-report table.checklist { width:100%; border-collapse:collapse; font-size:9.5px; table-layout:fixed; margin-bottom:14px; }
            .tl-report table.checklist th, .tl-report table.checklist td { border-bottom:1px solid var(--line-soft); padding:6px 6px; text-align:left; overflow-wrap:break-word; }
            .tl-report table.checklist th { font-family:var(--mono); font-size:7.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }

            /* Gallery */
            .tl-report .gallery { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:18px; break-inside:avoid; page-break-inside:avoid; }
            .tl-report .photo-tile { border:1px solid var(--line); border-radius:6px; overflow:hidden; break-inside:avoid; }
            .tl-report .photo-tile img { width:100%; height:auto; max-height:130px; object-fit:cover; display:block; }
            .tl-report .photo-tile .cap { padding:6px 8px; font-size:9px; color:var(--ink-2); font-family:var(--mono); overflow-wrap:break-word; }
            @media (max-width:720px) { .tl-report .gallery { grid-template-columns:repeat(2,1fr); } }

            /* Prose & cards */
            .tl-report .prose { font-size:10px; color:var(--ink-2); margin-bottom:8px; line-height:1.6; overflow-wrap:break-word; }
            .tl-report .prose b { color:var(--ink); }
            .tl-report .card { border:1px solid var(--line); border-radius:8px; padding:12px 14px; margin-bottom:10px; break-inside:avoid; }
            .tl-report .card .k { font-family:var(--mono); font-size:7.8px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }

            /* Condition scale legend */
            .tl-report .scale-row { display:flex; gap:8px; font-size:10px; color:var(--ink-2); padding:4px 0; border-bottom:1px solid var(--line-soft); align-items:baseline; flex-wrap:wrap; }
            .tl-report .scale-row b.band { min-width:60px; font-family:var(--mono); }
            .tl-report .scale-row b.label { min-width:60px; color:var(--ink); }

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
              .tl-report .damage-grid { break-inside:avoid; page-break-inside:avoid; }
              .tl-report .section-title { break-after:avoid; page-break-after:avoid; }
              .tl-report .panel, .tl-report .finding, .tl-report .photo-tile, .tl-report .photo, .tl-report .card, .tl-report .q-card, .tl-report .damage-card, .tl-report .sig-row { break-inside:avoid; page-break-inside:avoid; }
              .tl-report table { break-inside:auto; }
              .tl-report tr { break-inside:avoid; }
            }
          `}</style>

          <div className="doc-body">
            {/* Header band */}
            <div className="hdr">
              <div className="hdr-left">
                <img className="logo" src={trulensLockup} alt="TruLens" />
                <img className="lockup" src={trudealerLockup} alt="TruDealer" />
                {(dealerName || dealerBranch) && (
                  <div className="dealer">
                    {dealerName && <b>{dealerName}</b>}
                    {dealerBranch ? <> · {dealerBranch}</> : null}
                  </div>
                )}
              </div>
              <div className="hdr-right">
                <div className="doc-type">Vehicle Condition Report</div>
                <div className="doc-id">{reportId} · {generatedAt}</div>
              </div>
            </div>

            {/* Condition banner — a dealer declaration, not a graded score */}
            {(() => {
              const verdictClass = conditionState === 'clear' ? 'pass' : conditionState === 'damage' ? 'caution' : 'unknown';
              const VerdictIcon = conditionState === 'clear' ? CheckCircle2 : conditionState === 'damage' ? AlertTriangle : ClipboardList;
              const sub =
                conditionState === 'clear'
                  ? 'Dealer reports no visible damage on the captured photos.'
                  : conditionState === 'damage'
                  ? 'Visible damage tagged and shown below.'
                  : 'Condition not yet declared by the dealer.';
              return (
                <div className={`verdict ${verdictClass}`}>
                  <div className="icon"><VerdictIcon size={18} /></div>
                  <div className="body">
                    <h3>{conditionText}</h3>
                    <p>{sub} · {coreSlots.filter((s) => vehicle.photos?.[s.id]).length}/{coreSlots.length} core photos captured.</p>
                  </div>
                </div>
              );
            })()}

            {/* Vehicle title */}
            <div style={{ fontFamily:'var(--display)', fontWeight:600, fontSize:20, color:'var(--ink)', marginBottom:4, lineHeight:1.2 }}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--muted)', marginBottom:14 }}>
              {vehicle.trim} · {vehicle.color}
              {vehicle.mileage ? ` · ${Number(vehicle.mileage).toLocaleString('en-ZA')} km` : ''}
              {vehicle.transmission ? ` · ${vehicle.transmission}` : ''}
              {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ''}
              {' · Stock '}{vehicle.stockNumber}
            </div>

            {/* Vehicle info grid */}
            <div className="vehicle">
              <div className="row"><span className="k">Make / Model</span><span className="v">{vehicle.make} {vehicle.model}</span></div>
              <div className="row"><span className="k">Year</span><span className="v">{vehicle.year || '—'}</span></div>
              <div className="row"><span className="k">VIN</span><span className="v">{vehicle.vin || '—'}</span></div>
              <div className="row"><span className="k">Stock</span><span className="v">{vehicle.stockNumber || '—'}</span></div>
              <div className="row"><span className="k">Trim</span><span className="v">{vehicle.trim || '—'}</span></div>
              <div className="row"><span className="k">Colour</span><span className="v">{vehicle.color || '—'}</span></div>
              <div className="row"><span className="k">Type</span><span className="v">{vehicle.vehicleType || '—'}</span></div>
              <div className="row"><span className="k">List price</span><span className="v">R {Number(vehicle.price || 0).toLocaleString('en-ZA')}</span></div>
              <div className="row"><span className="k">Mileage</span><span className="v">{vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString('en-ZA')} km` : '—'}</span></div>
              <div className="row"><span className="k">Photos</span><span className="v">{capturedPhotos.length} of {DEFAULT_TEMPLATE.slots.length}</span></div>
            </div>

            {/* Photo grid — hero + slots */}
            {(() => {
              const ordered = DEFAULT_TEMPLATE.slots;
              const heroSlot = ordered.find(s => vehicle.photos?.[s.id] === hero) || ordered[0];
              const rest = ordered.filter(s => s.id !== heroSlot?.id && vehicle.photos?.[s.id]).slice(0, 6);
              const tiles = heroSlot ? [heroSlot, ...rest] : rest;
              if (!tiles.length) return null;
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

            {/* Panel condition grades */}
            {(() => {
              const sa = vehicle.slotAssessment || {};
              const rows = DEFAULT_TEMPLATE.slots
                .map(s => ({ s, r: sa[s.id] }))
                .filter(({ r }) => r && (r.rating || r.comment));
              if (!rows.length) return null;
              const gradeOf = (r?: { rating?: string; comment?: string }) =>
                r?.rating === 'ok' ? { t: 'Good', cls: 'good' } :
                r?.rating === 'note' ? { t: 'Fair', cls: 'fair' } :
                r?.rating === 'damage' ? { t: 'Poor', cls: 'poor' } : { t: '—', cls: 'na' };
              return (
                <>
                  <div className="section-title"><span className="n"><ClipboardList size={11} /> Panel condition</span><span className="ln" /></div>
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
                </>
              );
            })()}

            {/* Damage findings */}
            <div className="section-title"><span className="n"><AlertTriangle size={11} /> Damage findings</span><span className="ln" /></div>
            {condition.findings.length === 0 ? (
              <div className="no-issues"><CheckCircle2 size={13} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/> {conditionState === 'clear' ? 'No damage reported — dealer declared the vehicle free of visible damage.' : 'No damage tagged on the captured photos.'}</div>
            ) : (
              condition.findings.map((f, i) => {
                const sev = severityMeta(f.severity);
                const slot = DEFAULT_TEMPLATE.slots.find(s => s.id === f.slotId);
                return (
                  <div className="finding" key={i} style={{ background: sev.bg, borderLeftColor: sev.color }}>
                    <div className="h" style={{ color: sev.color }}>
                      {sev.label} · {f.damageType} · {f.panel}
                    </div>
                    <div className="l">
                      {f.note || 'Tagged during capture'}
                      <span style={{ color:'var(--muted)' }}> — {slot?.name || f.slotId}</span>
                    </div>
                  </div>
                );
              })
            )}

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
                <>
                  <div className="section-title"><span className="n"><Camera size={11} /> Damage locations</span><span className="ln" /></div>
                  <div className="damage-grid">
                    {slotsWithDamage.map(({ slot, src, findings }) => (
                      <div className="damage-card" key={slot!.id}>
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
                          <b style={{ color:'var(--ink)' }}>{slot!.name}</b>
                          <div style={{ marginTop:3 }}>
                            {findings.length} tag{findings.length === 1 ? '' : 's'}
                            {findings.length === 1 ? ` · ${findings[0].damageType}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Core photo checklist — the honest listing minimum. Shows exactly
                which of the core shots are on the car so a gap is visible, not
                hidden. Photo-quality grading was removed — this is about coverage,
                not how the images scored. */}
            {coreSlots.length > 0 && (
              <>
                <div className="section-title"><span className="n"><ClipboardList size={11} /> Core photos</span><span className="ln" /></div>
                <table className="checklist">
                  <thead>
                    <tr><th>Shot</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {coreSlots.map(s => {
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
              </>
            )}

            {/* Gallery */}
            {capturedPhotos.length > 0 && (
              <>
                <div className="section-title"><span className="n"><Camera size={11} /> Gallery</span><span className="ln" /></div>
                <div className="gallery">
                  {capturedPhotos.slice(0, 15).map(slot => (
                    <div className="photo-tile" key={slot.id}>
                      <img src={vehicle.photos[slot.id]} alt={slot.name} />
                      <div className="cap">{slot.name}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Report details — dealer & vehicle identity */}
            <div className="section-title"><span className="n"><Award size={11} /> Report details</span><span className="ln" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="card">
                <div className="k">Dealership</div>
                <div style={{ fontWeight:700, fontSize:11 }}>{dealerName || '—'}</div>
                {dealerBranch && <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>{dealerBranch}</div>}
                {dealerWa && <div style={{ fontSize:10, marginTop:6 }}>WhatsApp {dealerWa}</div>}
              </div>
              <div className="card">
                <div className="k">Vehicle identity</div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:4 }}>
                  VIN <b style={{ fontFamily:'var(--mono)' }}>{vehicle.vin || '— not recorded —'}</b>
                </div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>
                  Stock {vehicle.stockNumber || '—'} · {vehicle.year} {vehicle.make} {vehicle.model}
                </div>
                <div style={{ fontSize:10, color:'var(--ink-2)', marginTop:2 }}>
                  Captured {generatedAt}
                </div>
              </div>
            </div>

            {/* Scope & disclaimers */}
            <div className="card" style={{ marginTop:10 }}>
              <div className="k">Scope & disclaimers</div>
              <div className="prose">
                This report documents the <b>visual condition</b> of the vehicle at a single moment in time, based on photographs captured during the TruLens session.
                It is <b>not</b> a mechanical inspection, roadworthiness assessment, or warranty. Damage tags and condition scores reflect only what was visible
                and recorded in the photographs provided. Internal, mechanical, and structural defects are outside the scope of this report.
              </div>
            </div>

            {/* Signature row — drawn signature renders inline; falls back to the
                typed name so a report never ships with a blank line when the
                photographer has signed. */}
            <div className="sig-row">
              <div className="sig">
                <div className="line">
                  {vehicle.capturedBySignatureUrl ? (
                    <img src={vehicle.capturedBySignatureUrl} alt="Photographer signature" style={{ maxHeight: 48, maxWidth: '100%', display: 'block' }} />
                  ) : (
                    <div className="name">{vehicle.capturedBy || ''}</div>
                  )}
                </div>
                <div className="lbl">{vehicle.capturedBy || 'Signed off'} — photographer</div>
              </div>
              <div className="sig">
                <div className="line">
                  <div className="name">{generatedAt}</div>
                </div>
                <div className="lbl">Date</div>
              </div>
            </div>

            {/* Footer */}
            <div className="accent" />
            <div className="foot">
              <div>Prepared by <span className="cy">{dealerName}</span> · powered by <b>TruLens</b></div>
              <div className="lockup-wrap">
                <img className="lockup" src={trudealerLockup} alt="TruDealer" />
              </div>
              <div>{reportId}</div>
              <div>Visual condition at a moment in time — not a mechanical warranty</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
