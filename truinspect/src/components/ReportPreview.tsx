import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Download, Printer, Share2, Award, AlertTriangle, CheckCircle2,
  Camera, FileText, Wrench, ClipboardList, Clock, Copy, Check, MessageCircle, Box,
} from 'lucide-react';
import { Vehicle, PHOTO_SLOTS, PhotoSlot, QualityReport } from '../types';
import { computeWebReadiness, whatsAppSalesBlurb } from '../lib/readiness';
import { buildWeb3DPackage } from '../lib/web3dPackage';
import { useAuth } from '../contexts/AuthContext';

interface ReportPreviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onVehicleUpdated?: (v: Vehicle) => void;
}

function computeOverallScore(vehicle: Vehicle) {
  const req = PHOTO_SLOTS.filter(s => s.required);
  const opt = PHOTO_SLOTS.filter(s => !s.required);
  let totalWeight = 0, weightedScore = 0;
  let capturedReq = 0, capturedOpt = 0;

  req.forEach(slot => {
    const q = vehicle.quality?.[slot.id];
    if (q) { weightedScore += q.overallScore * 2; capturedReq++; }
    else   { weightedScore += 30 * 2; }
    totalWeight += 2;
  });
  opt.forEach(slot => {
    const q = vehicle.quality?.[slot.id];
    if (q) { weightedScore += q.overallScore * 1; capturedOpt++; totalWeight += 1; }
  });

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  return { score, captured: capturedReq + capturedOpt, required: req.length, optional: opt.length };
}

function scoreForSlots(vehicle: Vehicle, slots: PhotoSlot[]): number | null {
  const captured = slots.map(s => vehicle.quality?.[s.id]).filter(Boolean) as QualityReport[];
  if (captured.length === 0) return null;
  return Math.round(captured.reduce((sum, q) => sum + q.overallScore, 0) / captured.length);
}

function gradeFor(score: number | null) {
  if (score === null) return { grade: '—', label: 'Not captured', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)', sales: 'Incomplete' };
  if (score >= 90) return { grade: 'A',  label: 'Excellent', color: '#22C55E', bg: 'rgba(34,197,94,0.14)', sales: 'List with confidence' };
  if (score >= 80) return { grade: 'A-', label: 'Very good', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', sales: 'List with confidence' };
  if (score >= 70) return { grade: 'B',  label: 'Good', color: '#EAB308', bg: 'rgba(234,179,8,0.14)', sales: 'List after light polish' };
  if (score >= 60) return { grade: 'C',  label: 'Fair · attend', color: '#F97316', bg: 'rgba(249,115,22,0.14)', sales: 'Recon before web' };
  return { grade: 'D', label: 'Substantial issues', color: '#EF4444', bg: 'rgba(239,68,68,0.16)', sales: 'Do not publish yet' };
}

/** TruInspect: severity badge styling for AI damage findings */
function severityMeta(sev: number) {
  if (sev >= 5) return { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' };
  if (sev >= 4) return { label: 'Major', color: '#EA580C', bg: '#FFEDD5' };
  if (sev >= 3) return { label: 'Moderate', color: '#CA8A04', bg: '#FEF9C3' };
  if (sev >= 2) return { label: 'Minor', color: '#64748B', bg: '#F1F5F9' };
  return { label: 'Cosmetic', color: '#94A3B8', bg: '#F8FAFC' };
}

/** TruInspect: overall condition out of 5 from accumulated damage findings */
function computeCondition(vehicle: Vehicle) {
  const all = Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, list]) =>
    (list || []).filter(f => f.status !== 'dismissed').map(f => ({ ...f, slotId }))
  );
  const penalties = [0, 0.1, 0.25, 0.55, 1.0, 1.7];
  const penalty = all.reduce((s, f) => s + (penalties[f.severity] ?? 0.3), 0);
  const stars = Math.max(1, Math.round((5 - Math.min(4, penalty)) * 10) / 10);
  const label =
    all.length === 0 ? 'No visible damage detected' :
    stars >= 4.5 ? 'Excellent — minor blemishes only' :
    stars >= 3.5 ? 'Good — light cosmetic wear' :
    stars >= 2.5 ? 'Fair — visible defects to address' :
    'Poor — significant damage documented';
  return { stars, label, findings: all };
}

const PHASES = [
  { id: 1, name: 'Exterior', key: 'exterior', icon: Camera },
  { id: 3, name: 'Interior', key: 'interior', icon: ClipboardList },
  { id: 4, name: 'Engine', key: 'engine', icon: Wrench },
  { id: 5, name: 'Damage', key: 'damage', icon: AlertTriangle },
  { id: 6, name: 'Documents', key: 'documents', icon: FileText },
];

export default function ReportPreview({ vehicle, onBack, onVehicleUpdated }: ReportPreviewProps) {
  const { user } = useAuth();
  const reportRef = useRef<HTMLDivElement>(null);
  const salesRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const [generating, setGenerating] = useState<'sales' | 'full' | null>(null);
  const [web3dBusy, setWeb3dBusy] = useState(false);
  const [web3dMsg, setWeb3dMsg] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  const dealerName =
    vehicle.dealerName ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('trulens_dealer_name') : null) ||
    'TruLens South Africa';
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

  const readiness = useMemo(() => computeWebReadiness(brandedVehicle), [brandedVehicle]);
  const overall = useMemo(() => computeOverallScore(vehicle), [vehicle]);
  const condition = useMemo(() => computeCondition(vehicle), [vehicle]);
  const overallGrade = gradeFor(overall.score);
  const waBlurb = useMemo(
    () => whatsAppSalesBlurb(brandedVehicle, readiness, { dealerName, waNumber: dealerWa || undefined }),
    [brandedVehicle, readiness, dealerName, dealerWa]
  );

  const embedUrl = vehicle.web3dPublicPath
    ? `/embed/web3d-viewer.html?stock=${encodeURIComponent(vehicle.stockNumber)}`
    : null;

  const phaseScores = PHASES.map(p => {
    const slots = PHOTO_SLOTS.filter(s => s.phase === p.id);
    return { ...p, slots, score: scoreForSlots(vehicle, slots) };
  });

  const allFindings = useMemo(() => {
    const set = new Set<string>();
    const bySlot: { slotId: string; slotName: string; issues: string[] }[] = [];
    PHOTO_SLOTS.forEach(slot => {
      const raw: unknown = vehicle.quality?.[slot.id]?.aiAnalysis?.detectedIssues;
      let issues: string[] = [];
      if (Array.isArray(raw)) {
        issues = raw.map(String).filter((s) => s.trim());
      } else if (typeof raw === 'string' && raw.trim()) {
        issues = [raw.trim()];
      }
      if (issues.length) {
        bySlot.push({ slotId: slot.id, slotName: slot.name, issues });
        issues.forEach(i => set.add(String(i).trim().toLowerCase()));
      }
    });
    return { unique: Array.from(set), bySlot };
  }, [vehicle]);

  const damagePhotos = PHOTO_SLOTS.filter(s => s.phase === 5)
    .map(s => ({ slot: s, src: vehicle.photos?.[s.id], quality: vehicle.quality?.[s.id] }))
    .filter(p => !!p.src);

  const reportId = `TL-${vehicle.stockNumber || vehicle.id.slice(0, 6).toUpperCase()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const runPdf = async (mode: 'sales' | 'full') => {
    const el = mode === 'sales' ? salesRef.current : reportRef.current;
    if (!el) return;
    setGenerating(mode);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: mode === 'sales' ? [6, 8, 6, 8] : [8, 8, 8, 8],
          filename: `TruInspect_${mode === 'sales' ? 'Summary' : 'VIR'}_${vehicle.stockNumber || 'draft'}.pdf`,
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

  const hero = vehicle.photos?.front_3_4 || Object.values(vehicle.photos || {})[0];

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-900 text-slate-100">
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-white/10 no-print">
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[9px] font-bold px-2 py-1 rounded-full border"
              style={{ color: readiness.color, borderColor: readiness.color + '55', background: readiness.color + '18' }}
            >
              {readiness.label}
            </span>
            <button onClick={handleCopyWa} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-[10px] font-bold text-emerald-300">
              {waCopied ? <Check size={12} /> : <MessageCircle size={12} />} WhatsApp blurb
            </button>
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={publishBusy}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-600/20 border border-sky-500/30 rounded-lg text-[10px] font-bold text-sky-300 disabled:opacity-50"
            >
              {publishBusy ? '…' : vehicle.showOnWebsite ? 'Unpublish web' : 'Publish to web'}
            </button>
            <button onClick={handleExportWeb3d} disabled={web3dBusy}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600/20 border border-cyan-500/30 rounded-lg text-[10px] font-bold text-cyan-300 disabled:opacity-50">
              <Box size={12} /> {web3dBusy ? 'Building 3D…' : 'Export web 3D'}
            </button>
            {embedUrl && (
              <button
                type="button"
                onClick={() => window.open(embedUrl, '_blank')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 rounded-lg text-[10px] font-bold text-slate-200"
              >
                Open 3D viewer
              </button>
            )}
            <button onClick={() => runPdf('sales')} disabled={!!generating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 rounded-lg text-[10px] font-bold text-slate-200">
              <Share2 size={12} /> {generating === 'sales' ? '…' : 'Sales PDF'}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 rounded-lg text-[10px] font-bold text-slate-200">
              <Printer size={12} /> Print
            </button>
            <button onClick={() => runPdf('full')} disabled={!!generating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(120deg, #22d3ee, #3B82F6)' }}>
              <Download size={12} /> {generating === 'full' ? '…' : 'Full VIR PDF'}
            </button>
          </div>
        </div>
        {web3dMsg && (
          <div className="text-center text-[10px] text-cyan-300/90 pb-2 no-print">{web3dMsg}</div>
        )}
      </div>

      {/* Hidden-on-screen sales pack used only for PDF (also shown in print if user wants) */}
      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {/* On-screen readiness card */}
        <div className="no-print rounded-xl border border-white/10 bg-slate-950/60 p-3 text-[11px]">
          <div className="flex justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Web readiness</div>
              <div className="font-bold text-sm" style={{ color: readiness.color }}>{readiness.label}</div>
              <div className="text-slate-400 mt-1">
                Required {readiness.requiredTaken}/{readiness.requiredTotal}
                {readiness.overallScore != null ? ` · VIR ${readiness.overallScore}/100` : ''}
              </div>
            </div>
            <div className="text-right text-slate-500 text-[10px] max-w-[200px]">
              {readiness.reasons.length ? readiness.reasons.join(' · ') : 'Meets publish rules for website + DMS.'}
            </div>
          </div>
        </div>

        {/* ── SALES PACK (1 page) ── */}
        <div ref={salesRef} className="tl-sales bg-white text-slate-900 rounded-xl overflow-hidden shadow-xl">
          <style>{`
            .tl-sales { font-family: Inter, system-ui, sans-serif; }
            .tl-sales .band { background: linear-gradient(120deg,#0F172A,#1E3A5F); color:#fff; padding:20px 22px; }
            .tl-sales .grid2 { display:grid; grid-template-columns:1.1fr .9fr; gap:16px; padding:18px 22px; }
            .tl-sales h1 { font-size:22px; font-weight:800; margin:0 0 4px; letter-spacing:-.02em; }
            .tl-sales .muted { color:#64748B; font-size:12px; }
            .tl-sales .price { font-size:26px; font-weight:900; color:#0B5BD7; margin:10px 0; }
            .tl-sales .pill { display:inline-block; padding:4px 10px; border-radius:999px; font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
            .tl-sales .hero { width:100%; border-radius:12px; object-fit:cover; aspect-ratio:16/10; background:#F1F5F9; }
            .tl-sales .box { border:1px solid #E2E8F0; border-radius:12px; padding:12px; }
            .tl-sales .k { font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:#94A3B8; font-weight:700; }
            .tl-sales .v { font-size:13px; font-weight:700; margin-top:3px; }
            .tl-sales .foot { border-top:1px solid #E2E8F0; padding:12px 22px; font-size:10px; color:#94A3B8; display:flex; justify-content:space-between; }
          `}</style>
          <div className="band">
            <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', opacity:.7 }}>
                  {dealerName}{dealerBranch ? ` · ${dealerBranch}` : ''} · Sales pack
                </div>
                <div style={{ fontSize:18, fontWeight:800, marginTop:4 }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
                <div style={{ opacity:.75, fontSize:12 }}>{vehicle.trim} · Stock {vehicle.stockNumber}</div>
                {dealerWa ? (
                  <div style={{ opacity:.7, fontSize:11, marginTop:6 }}>WhatsApp {dealerWa}</div>
                ) : null}
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="pill" style={{ background: overallGrade.color + '33', color:'#fff', border:`1px solid ${overallGrade.color}` }}>
                  {overallGrade.grade} · {overall.score}/100
                </div>
                <div style={{ fontSize:11, marginTop:8, opacity:.85 }}>{overallGrade.sales}</div>
                <div style={{ fontSize:10, marginTop:6, opacity:.7 }}>
                  {vehicle.showOnWebsite ? 'Live on website' : readiness.label}
                </div>
              </div>
            </div>
          </div>
          <div className="grid2">
            <div>
              {hero ? <img className="hero" src={hero} alt="Hero" /> : <div className="hero" />}
              <div className="muted" style={{ marginTop:8 }}>
                Required photos {readiness.requiredTaken}/{readiness.requiredTotal}
                {vehicle.lastWeb3dExportAt ? ' · Web 3D package available' : ''}
              </div>
            </div>
            <div>
              <div className="price">R {Number(vehicle.price || 0).toLocaleString('en-ZA')}</div>
              <div className="box" style={{ marginBottom:10 }}>
                <div className="k">Sales verdict</div>
                <div className="v">{overallGrade.sales}</div>
                <div className="muted" style={{ marginTop:6 }}>
                  {allFindings.unique.length
                    ? `${allFindings.unique.length} note(s) for recon / disclosure`
                    : 'No material issues flagged on captured shots'}
                </div>
              </div>
              <div className="box" style={{ marginBottom:10 }}>
                <div className="k">VIN</div>
                <div className="v" style={{ fontFamily:'ui-monospace,monospace', fontSize:11 }}>{vehicle.vin || '—'}</div>
                <div className="k" style={{ marginTop:8 }}>Colour · type</div>
                <div className="v">{vehicle.color || '—'} · {vehicle.vehicleType || '—'}</div>
              </div>
              <div className="box">
                <div className="k">WhatsApp paste</div>
                <div style={{ whiteSpace:'pre-wrap', fontSize:11, marginTop:6, lineHeight:1.45 }}>{waBlurb}</div>
              </div>
            </div>
          </div>
          <div className="foot">
            <span>Not a mechanical guarantee — visual inspection pack</span>
            <span>{reportId}</span>
          </div>
        </div>

        {/* ── FULL VIR ── */}
        <div ref={reportRef} className="tl-report">
          <style>{`
            .tl-report {
              width: 100%; max-width: 210mm; margin: 0 auto; background: #FFFFFF; color: #0F172A;
              font-family: Inter, system-ui, sans-serif; border-radius: 12px; overflow: hidden;
            }
            .tl-report .cover { padding: 20mm 16mm 12mm; background: linear-gradient(135deg,#0F172A 0%,#1E293B 55%,#0B3B5A 100%); color:#F8FAFC; }
            .tl-report .cover-head { display:flex; justify-content:space-between; gap:16px; margin-bottom:18px; }
            .tl-report .brand { display:flex; align-items:center; gap:12px; }
            .tl-report .brand .mark { width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg,#22d3ee,#3B82F6); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; }
            .tl-report .brand .txt { font-weight:800; font-size:20px; }
            .tl-report .brand .txt em { font-style:normal; color:#93C5FD; }
            .tl-report .meta-row { text-align:right; font-family:ui-monospace,monospace; font-size:10px; color:rgba(248,250,252,.62); line-height:1.6; }
            .tl-report h1 { font-weight:800; font-size:30px; letter-spacing:-.025em; margin:0 0 6px; }
            .tl-report .subhead { font-size:13px; color:rgba(248,250,252,.72); margin-bottom:18px; }
            .tl-report .score-strip { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .tl-report .score-big { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:16px; display:flex; gap:14px; align-items:center; }
            .tl-report .score-ring { width:88px; height:88px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
            .tl-report .vehicle-facts { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:10px 18px; }
            .tl-report .vehicle-facts .k { font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:rgba(248,250,252,.5); font-family:ui-monospace,monospace; }
            .tl-report .vehicle-facts .v { font-weight:700; font-size:13px; margin-top:2px; }
            .tl-report section { padding: 12mm 16mm; }
            .tl-report h2 { font-weight:800; font-size:16px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
            .tl-report .grades { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
            .tl-report .grade { border:1px solid #E2E8F0; border-radius:12px; padding:12px 8px; text-align:center; }
            .tl-report .grade .v { font-weight:800; font-size:22px; }
            .tl-report .grade .n { font-size:10px; color:#475569; margin-top:6px; font-weight:600; }
            .tl-report .finding { background:#FEF3C7; border-left:4px solid #F59E0B; border-radius:0 10px 10px 0; padding:10px 14px; margin-bottom:8px; }
            .tl-report .finding .h { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#B45309; font-family:ui-monospace,monospace; }
            .tl-report .finding .l { font-size:12.5px; color:#78350F; margin-top:4px; font-weight:500; }
            .tl-report .no-issues { background:#DCFCE7; border-left:4px solid #22C55E; border-radius:0 10px 10px 0; padding:12px 14px; color:#166534; font-weight:600; font-size:13px; }
            .tl-report .damage-grid, .tl-report .photo-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .tl-report .photo-grid { grid-template-columns:repeat(3,1fr); }
            .tl-report .damage-card, .tl-report .photo-tile { border:1px solid #E2E8F0; border-radius:12px; overflow:hidden; }
            .tl-report .damage-card img, .tl-report .photo-tile img { width:100%; height:auto; max-height:150px; object-fit:cover; display:block; }
            .tl-report .cap { padding:8px 10px; font-size:11px; }
            .tl-report .checklist { width:100%; border-collapse:collapse; font-size:11px; }
            .tl-report .checklist th, .tl-report .checklist td { border-bottom:1px solid #E2E8F0; padding:7px 6px; text-align:left; }
            .tl-report .checklist th { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#94A3B8; }
            .tl-report .foot { border-top:1px solid #E2E8F0; padding:14px 16mm; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:10px; color:#64748B; text-transform:uppercase; letter-spacing:.08em; font-family:ui-monospace,monospace; }
            @media print {
              .no-print { display:none !important; }
              .tl-sales { break-after: page; }
              body { background:#fff !important; }
            }
          `}</style>

          <div className="cover">
            <div className="cover-head">
              <div className="brand">
                <div className="mark">T</div>
                <div className="txt">
                  Tru<em>Inspect</em> · Vehicle Inspection Report
                  <div style={{ fontSize:11, fontWeight:600, opacity:.75, marginTop:2 }}>{dealerName}</div>
                </div>
              </div>
              <div className="meta-row">
                <div><b style={{color:'#fff'}}>Report ID</b> · {reportId}</div>
                <div><Clock size={9} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/>{generatedAt}</div>
                <div>Web: {readiness.label}</div>
                {dealerBranch ? <div>{dealerBranch}</div> : null}
              </div>
            </div>
            <h1>{vehicle.year} {vehicle.make} {vehicle.model}</h1>
            <div className="subhead">{vehicle.trim} · {vehicle.color} · Stock <b>{vehicle.stockNumber}</b></div>
            <div className="score-strip">
              <div className="score-big">
                <div className="score-ring" style={{ background: `conic-gradient(${overallGrade.color} ${overall.score * 3.6}deg, rgba(255,255,255,.08) 0)` }}>
                  <div style={{ background:'#1E293B', borderRadius:'50%', width:70, height:70, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontWeight:800, fontSize:28, color: overallGrade.color }}>{overall.score}</div>
                    <div style={{ fontSize:9, opacity:.7 }}>/ 100</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', opacity:.55 }}>Overall condition</div>
                  <div style={{ fontWeight:800, fontSize:20, color: overallGrade.color, marginTop:4 }}>{overallGrade.grade} · {overallGrade.label}</div>
                  <div style={{ fontSize:12, opacity:.75, marginTop:4 }}>{overallGrade.sales}</div>
                  <div style={{ fontSize:11, opacity:.65, marginTop:6 }}>
                    {overall.captured} captured · {readiness.requiredTaken}/{readiness.requiredTotal} required
                  </div>
                </div>
              </div>
              <div className="vehicle-facts">
                <div><div className="k">VIN</div><div className="v">{vehicle.vin || '—'}</div></div>
                <div><div className="k">Type</div><div className="v">{vehicle.vehicleType || '—'}</div></div>
                <div><div className="k">Status</div><div className="v">{vehicle.status}</div></div>
                <div><div className="k">List price</div><div className="v">R {Number(vehicle.price || 0).toLocaleString('en-ZA')}</div></div>
              </div>
            </div>
          </div>

          <section>
            <h2><Award size={16} /> Grades by section</h2>
            <div className="grades">
              {phaseScores.map(p => {
                const g = gradeFor(p.score);
                const Icon = p.icon;
                return (
                  <div className="grade" key={p.id} style={{ background: g.bg, borderColor: g.color + '40' }}>
                    <div className="v" style={{ color: g.color }}>{g.grade}</div>
                    <div className="n"><Icon size={11} style={{display:'inline',verticalAlign:'-2px',marginRight:4,color:g.color}}/>{p.name}</div>
                    <div style={{ fontSize:10, color:'#94A3B8', marginTop:4 }}>{p.score !== null ? `${p.score}/100` : '—'}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2><ClipboardList size={16} /> Required photo checklist</h2>
            <table className="checklist">
              <thead>
                <tr><th>Slot</th><th>Status</th><th>Score</th></tr>
              </thead>
              <tbody>
                {PHOTO_SLOTS.filter(s => s.required).map(s => {
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

          <section>
            <h2><AlertTriangle size={16} /> AI damage findings</h2>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12 }}>
              <div style={{ fontWeight:800, fontSize:24, color: condition.stars >= 3.5 ? '#16A34A' : condition.stars >= 2.5 ? '#CA8A04' : '#DC2626' }}>
                {condition.stars.toFixed(1)}<span style={{ fontSize:12, color:'#94A3B8' }}>/5</span>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>Condition score</div>
                <div style={{ fontSize:11.5, color:'#64748B' }}>{condition.label} · {condition.findings.length} finding{condition.findings.length === 1 ? '' : 's'} across {Object.keys(vehicle.damageFindings || {}).length} inspected photos</div>
              </div>
            </div>
            {condition.findings.length === 0 ? (
              <div className="no-issues"><CheckCircle2 size={14} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/> AI inspection found no visible damage on the captured photos.</div>
            ) : (
              condition.findings.map((f, i) => {
                const sev = severityMeta(f.severity);
                const slot = PHOTO_SLOTS.find(s => s.id === f.slotId);
                return (
                  <div className="finding" key={i} style={{ background: sev.bg, borderLeftColor: sev.color }}>
                    <div className="h" style={{ color: sev.color }}>
                      {sev.label} · {f.damageType} · {f.panel}{f.location ? ` (${f.location})` : ''}
                    </div>
                    <div className="l" style={{ color:'#334155' }}>
                      {f.note}
                      <span style={{ color:'#94A3B8' }}> — {slot?.name || f.slotId}, confidence {(f.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })
            )}
            {allFindings.bySlot.length > 0 && (
              <div style={{ marginTop:10, fontSize:11, color:'#64748B' }}>
                Photo-quality notes: {allFindings.bySlot.map(({ slotName, issues }) => `${slotName}: ${issues.join(', ')}`).join(' · ')}
              </div>
            )}
          </section>

          {damagePhotos.length > 0 && (
            <section>
              <h2><AlertTriangle size={16} /> Damage & recon</h2>
              <div className="damage-grid">
                {damagePhotos.map(({ slot, src, quality }) => (
                  <div className="damage-card" key={slot.id}>
                    <img src={src} alt={slot.name} />
                    <div className="cap">
                      <b>{slot.name}</b>
                      <div style={{ color:'#64748B', marginTop:3 }}>
                        {Array.isArray(quality?.aiAnalysis?.detectedIssues)
                          ? quality!.aiAnalysis!.detectedIssues![0]
                          : 'Documented area'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2><Camera size={16} /> Gallery</h2>
            <div className="photo-grid">
              {PHOTO_SLOTS.filter(s => vehicle.photos?.[s.id]).slice(0, 12).map(slot => (
                <div className="photo-tile" key={slot.id}>
                  <img src={vehicle.photos[slot.id]} alt={slot.name} />
                  <div className="cap">{slot.name}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2><Award size={16} /> Dealer & digital readiness</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:'#94A3B8' }}>Dealership</div>
                <div style={{ fontWeight:700, marginTop:4 }}>{dealerName}</div>
                {dealerBranch ? <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{dealerBranch}</div> : null}
                {dealerWa ? <div style={{ fontSize:12, marginTop:6 }}>WhatsApp {dealerWa}</div> : null}
              </div>
              <div className="grade" style={{ textAlign:'left', padding:14 }}>
                <div className="k" style={{ fontSize:9, letterSpacing:'.1em', textTransform:'uppercase', color:'#94A3B8' }}>Digital assets</div>
                <div style={{ fontWeight:700, marginTop:4, color: readiness.color }}>{readiness.label}</div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>
                  Website: {vehicle.showOnWebsite ? 'Published' : 'Not published'}
                </div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>
                  Web 3D: {vehicle.lastWeb3dExportAt ? `Exported ${new Date(vehicle.lastWeb3dExportAt).toLocaleDateString('en-ZA')}` : 'Not exported yet'}
                </div>
                <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>
                  DMS: {vehicle.lastDmsExportAt ? `Synced ${new Date(vehicle.lastDmsExportAt).toLocaleDateString('en-ZA')}` : 'Not exported'}
                </div>
              </div>
            </div>
            {readiness.reasons.length > 0 && (
              <div style={{ marginTop:10, fontSize:12, color:'#92400E', background:'#FFFBEB', borderRadius:10, padding:'10px 12px' }}>
                Next steps: {readiness.reasons.join(' · ')}
              </div>
            )}
          </section>

          <div className="foot">
            <div>Prepared by <b style={{color:'#06b6d4'}}>{dealerName}</b> · powered by TruInspect · TruSaaS</div>
            <div>{reportId}</div>
            <div>Visual inspection at a moment in time — not a mechanical warranty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
