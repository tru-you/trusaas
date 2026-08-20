import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Download, Printer, Star, Pen, Clock } from 'lucide-react';
import { Vehicle, DamageFinding } from '../types';
import {
  InspectionItem, ValuationState, TradeInData,
  computeOverallRating, deriveReportId,
} from '../types/inspection';
import { DEFAULT_TEMPLATE } from '../templates';

/**
 * Pick the largest html2canvas scale that keeps the rasterised report within
 * mobile canvas limits. Android Chrome caps a canvas at ~16.7M pixels (and
 * ~65k per side) and runs out of memory well before that on a long report — at
 * a hard-coded scale of 2 a full A4 appraisal blows past the cap and html2pdf
 * throws, which is the "PDF failed" the dealer sees. We size the scale to the
 * node's real dimensions so it renders at the best quality that still fits,
 * clamped to [1, 2] so a short report still looks crisp.
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
  const dealerBranch = localStorage.getItem('trulens_dealer_branch') || '';
  const dealerAddress = localStorage.getItem('trulens_dealer_address') || '';
  const dealerVat = localStorage.getItem('trulens_dealer_vat') || '';
  const dealerEmail = localStorage.getItem('trulens_dealer_email') || '';

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
      isSmokerVehicle: vehicle.tradeInData?.vehicleDetails?.isSmokerVehicle,
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
          html2canvas: { scale: safePdfScale(el), useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 15000 },
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

  /* Worst condition in the category wins the pill — a category with one
     "Poor" item should not read as Good because the rest are fine. */
  const conditionRank: Record<string, number> = { Good: 0, Fair: 1, 'Needs Recon': 2, Poor: 3 };
  const categoryGrade = (catItems: InspectionItem[]): { label: string; cls: string } => {
    if (!catItems.length) return { label: '—', cls: 'good' };
    const worst = catItems.reduce((w, i) => (conditionRank[i.condition] > conditionRank[w] ? i.condition : w), 'Good');
    if (worst === 'Good') return { label: 'Good', cls: 'good' };
    if (worst === 'Fair') return { label: 'Fair', cls: 'fair' };
    return { label: worst === 'Needs Recon' ? 'Needs Recon' : 'Poor', cls: 'poor' };
  };

  /* Valuation build-up: market average, then each item carrying a recon
   * deduction, then the final offer. The dealer margin is applied inside
   * finalTradeInValue but never itemised here — margin is dealer-only. */
  const reconAdjustments = items.filter(i => i.estimatedRepairCost > 0);
  const linkedVirId = deriveReportId(vehicle, 'VIR');
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass p-4 border-b border-cyan-500/20 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[16px] font-semibold tracking-tight">Trade-in summary</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportHtml}
            disabled={exporting}
            title="Downloads a single file with every photo embedded — opens offline and survives being emailed"
            className="px-3 min-h-[38px] rounded-lg border border-neutral-700 text-neutral-300 text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={13} /> HTML
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 min-h-[38px] rounded-lg border border-neutral-700 text-neutral-300 text-[12px] font-medium flex items-center gap-1.5"
          >
            <Printer size={13} /> Print
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-3 min-h-[38px] rounded-lg text-[#0B0F17] text-[12px] font-medium flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(120deg, #7FF0EA, #4FE3DC)' }}
          >
            <Download size={13} /> {exporting ? 'Exporting…' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* ===== PRINTABLE REPORT (white bg for export) ===== */}
        <div ref={reportRef} className="ti-report">
          {/* ── Palette note ──────────────────────────────────────────────
              This document is WHITE paper. The app shell around it is
              near-black. Every colour token below is dark ink on white
              (--ink / --ink-2 / --muted / --faint), never the app's light
              on-dark text tokens — a light token on this page prints as
              blank paper. */}
          <style>{`
            .ti-report {
              --paper:#FFFFFF; --ink:#121A26; --ink-2:#3A4553; --muted:#6E6656; --faint:#A79D8C;
              --line:rgba(18,26,38,.12); --line-soft:rgba(18,26,38,.06);
              --cyan:#07889B; --cyan-bg:rgba(7,136,155,.06); --cyan-lit:#00E0F5;
              --green:#1A7A3A; --green-bg:rgba(26,122,58,.08);
              --amber:#B07A26; --amber-bg:rgba(176,122,38,.08);
              --red:#B03226; --red-bg:rgba(176,50,38,.08);
              --night:#080C14;
              --sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
              --display: Georgia, 'Times New Roman', serif;
              --mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
              width: 100%; max-width: 210mm; margin: 0 auto; background: var(--paper); color: var(--ink);
              font-family: var(--sans); font-size: 12px; line-height: 1.5; box-sizing: border-box;
              padding: 12mm 14mm; border-radius: 12px; overflow: hidden;
            }
            .ti-report *, .ti-report *::before, .ti-report *::after { box-sizing: border-box; }
            .ti-report h1, .ti-report h2, .ti-report h3, .ti-report h4 { font-family: var(--display); font-weight: 400; letter-spacing: -0.02em; }

            /* Header */
            .ti-report .ti-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid var(--ink); margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .ti-hdr-left .dealer { font-size: 11px; font-weight: 600; color: var(--muted); margin-top: 4px; }
            .ti-report .ti-hdr-right { text-align: right; }
            .ti-report .ti-hdr-right .doc-type { font-family: var(--mono); font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--amber); font-weight: 700; }
            .ti-report .ti-hdr-right .doc-id { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-top: 4px; }

            /* Valuation hero */
            .ti-report .val-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .val-box { padding: 16px 18px; border-radius: 8px; text-align: center; }
            .ti-report .val-box.market { background: var(--cyan-bg); border: 1px solid rgba(7,136,155,.25); }
            .ti-report .val-box.offer { background: linear-gradient(178deg, var(--night), #132132); border: 1px solid rgba(7,136,155,.5); }
            .ti-report .val-box .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: .2em; text-transform: uppercase; margin-bottom: 8px; }
            .ti-report .val-box.market .lbl { color: var(--cyan); }
            .ti-report .val-box.offer .lbl { color: var(--cyan-lit); }
            .ti-report .val-box .price { font-family: var(--display); line-height: 1; letter-spacing: -0.02em; }
            .ti-report .val-box.market .price { font-size: 30px; color: var(--ink); }
            .ti-report .val-box.offer .price { font-size: 34px; color: #fff; }
            .ti-report .val-box .price .sym { font-family: var(--display); font-style: italic; font-size: 18px; }
            .ti-report .val-box.market .price .sym { color: var(--amber); }
            .ti-report .val-box.offer .price .sym { color: var(--cyan-lit); }
            .ti-report .val-box .sub { font-size: 10px; margin-top: 8px; }
            .ti-report .val-box.market .sub { color: var(--ink-2); }
            .ti-report .val-box.offer .sub { color: rgba(245,241,232,.6); }

            /* Vehicle info */
            .ti-report .vehicle { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 20px; }
            .ti-report .vehicle .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--line-soft); }
            .ti-report .vehicle .row .k { font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
            .ti-report .vehicle .row .v { font-size: 12px; font-weight: 600; color: var(--ink); text-align: right; }

            /* Section titles */
            .ti-report .section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; break-after: avoid; page-break-after: avoid; }
            .ti-report .section-title .n { font-family: var(--mono); font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--amber); font-weight: 600; }
            .ti-report .section-title .ln { flex: 1; height: 1px; background: var(--line); }

            /* Photo grid */
            .ti-report .photos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .photo { aspect-ratio: 4/3; border-radius: 4px; border: 1px solid var(--line); overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .ti-report .photo .cap { position: relative; margin-top: -22px; padding: 3px 6px; font-size: 9px; font-weight: 600; color: #fff; background: linear-gradient(to top, rgba(8,12,20,.75), transparent); }
            .ti-report .photo.hero { grid-column: span 2; grid-row: span 2; }

            /* Condition summary */
            .ti-report .cond-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; margin-bottom: 20px; }
            .ti-report .cond { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .cond .lbl { font-size: 11px; color: var(--ink-2); }
            .ti-report .cond .grade { font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 3px 8px; border-radius: 100px; }
            .ti-report .cond .grade.good { color: var(--green); background: var(--green-bg); }
            .ti-report .cond .grade.fair { color: var(--amber); background: var(--amber-bg); }
            .ti-report .cond .grade.poor { color: var(--red); background: var(--red-bg); }
            .ti-report .cond-overall { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 2px solid; border-radius: 8px; margin-bottom: 12px; }

            /* Damage findings */
            .ti-report .dmg-finding { border-radius: 0 6px 6px 0; padding: 8px 12px; margin-bottom: 6px; border-left: 3px solid var(--muted); break-inside: avoid; page-break-inside: avoid; }
            .ti-report .dmg-finding .dmg-h { font-family: var(--mono); font-size: 8px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; }
            .ti-report .dmg-finding .dmg-l { font-size: 10.5px; color: var(--ink-2); margin-top: 3px; font-weight: 500; }
            .ti-report .dmg-none { font-size: 11px; color: var(--muted); font-style: italic; margin-bottom: 16px; }

            /* Valuation build-up */
            .ti-report .adjustments { margin-bottom: 20px; }
            .ti-report .adj { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line-soft); }
            .ti-report .adj .desc { font-size: 11px; color: var(--ink-2); }
            .ti-report .adj .recon-note { display: block; margin-top: 2px; font-size: 10px; line-height: 1.4; color: var(--muted); font-style: italic; }
            .ti-report .adj .impact { font-family: var(--mono); font-size: 11px; font-weight: 600; text-align: right; }
            .ti-report .adj .impact.neg { color: var(--red); }
            .ti-report .adj .impact.pos { color: var(--green); }
            .ti-report .adj .impact.neutral { color: var(--muted); }
            .ti-report .adj.total { border-bottom: 2px solid var(--ink); padding: 9px 0; }
            .ti-report .adj.total .desc { font-weight: 700; color: var(--ink); font-size: 12.5px; }
            .ti-report .adj.total .impact { font-size: 12.5px; color: var(--ink); }

            /* Validity */
            .ti-report .validity { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; padding: 12px 14px; background: var(--cyan-bg); border-radius: 6px; margin-bottom: 20px; break-inside: avoid; page-break-inside: avoid; }
            .ti-report .validity .item .k { font-family: var(--mono); font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--cyan); margin-bottom: 3px; }
            .ti-report .validity .item .v { font-size: 11.5px; font-weight: 600; color: var(--ink); }

            /* Dealer sign-off */
            .ti-report .signoff { break-inside: avoid; page-break-inside: avoid; margin-bottom: 4px; }
            .ti-report .signoff table { width: 100%; font-size: 12px; border-collapse: collapse; }
            .ti-report .signoff td { padding: 4px 0; }
            .ti-report .signoff td.k { color: var(--muted); width: 140px; }
            .ti-report .signoff td.v { font-weight: 600; color: var(--ink); }

            /* Signature row */
            .ti-report .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line); break-inside: avoid; page-break-inside: avoid; }
            .ti-report .sig { padding-top: 8px; min-height: 54px; }
            .ti-report .sig img.sig-img { height: 48px; display: block; margin-bottom: 4px; }
            .ti-report .sig .line { border-top: 1px solid var(--ink); padding-top: 4px; }
            .ti-report .sig .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }

            /* Disclaimer + footer */
            .ti-report .disclaimer { font-size: 9.5px; line-height: 1.5; color: var(--faint); margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line-soft); }
            .ti-report .ti-foot { margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-family: var(--mono); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
            .ti-report .ti-foot .am { color: var(--amber); }

            @media (max-width: 720px) {
              .ti-report { padding: 6mm 5mm; }
              .ti-report .vehicle, .ti-report .cond-grid, .ti-report .validity, .ti-report .sig-row { grid-template-columns: 1fr; }
              .ti-report .photos { grid-template-columns: repeat(2, 1fr); }
              .ti-report .photo.hero { grid-column: span 2; grid-row: span 1; }
            }
            @media print {
              .no-print { display: none !important; }
              body, html { background: #fff !important; margin: 0; padding: 0; overflow: visible !important; }
              .ti-report { max-width: 100% !important; width: 100% !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 8mm 10mm !important; }
              .ti-report .ti-hdr { break-inside: avoid; page-break-inside: avoid; }
              .ti-report .val-hero { break-inside: avoid; page-break-inside: avoid; }
              .ti-report .photos { break-inside: avoid; page-break-inside: avoid; }
              .ti-report .photo, .ti-report .cond, .ti-report .signoff, .ti-report .sig-row, .ti-report .validity { break-inside: avoid; page-break-inside: avoid; }
              .ti-report .section-title { break-after: avoid; page-break-after: avoid; }
              .ti-report img { max-height: 120px; }
            }
          `}</style>

          {/* Hidden SVG defs for logo gradients */}
          <svg width="0" height="0" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
            <defs>
              <linearGradient id="c1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#94A3B8"/><stop offset="100%" stopColor="#121A26"/></linearGradient>
              <linearGradient id="c2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#22B8CC"/><stop offset="100%" stopColor="#065F73"/></linearGradient>
            </defs>
          </svg>

          {/* Header */}
          <div className="ti-hdr">
            <div className="ti-hdr-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24, flexShrink: 0 }}>
                <path d="M55 60 L100 35 L100 80 L75 95 L75 145 L55 132 Z" fill="url(#c1)"/>
                <path d="M100 80 L145 60 L145 132 L100 160 L100 115 L125 100 L100 85 Z" fill="url(#c2)"/>
              </svg>
              <div style={{ lineHeight: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--ink)' }}>Tru</span>
                <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--cyan)' }}>Inspect</span>
                {dealerName && <div className="dealer">{dealerName}{dealerBranch ? ` · ${dealerBranch}` : ''}</div>}
              </div>
            </div>
            <div className="ti-hdr-right">
              <div className="doc-type">Trade-in Valuation</div>
              <div className="doc-id">{deriveReportId(vehicle)} · {now}</div>
              <div style={{ display: 'inline-block', marginTop: 5, fontFamily: 'var(--mono)', fontSize: '8px', fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase' as const, color: 'var(--cyan)', background: 'var(--cyan-bg)', border: '1px solid rgba(7,136,155,.25)', borderRadius: 100, padding: '3px 8px' }}>
                ◷ {photosWithLabel.length}-shot inspection
              </div>
            </div>
          </div>

          {/* Valuation hero */}
          <div className="val-hero">
            <div className="val-box market">
              <div className="lbl">Market average</div>
              <div className="price">
                <span className="sym">R </span>
                {valuation.averageRetailPrice != null ? valuation.averageRetailPrice.toLocaleString('en-ZA') : '—'}
              </div>
              <div className="sub">Based on current market retail pricing</div>
            </div>
            <div className="val-box offer">
              <div className="lbl">Trade-in offer</div>
              <div className="price"><span className="sym">R </span>{valuation.finalTradeInValue.toLocaleString('en-ZA')}</div>
              <div className="sub">Condition-adjusted · valid {validUntil}</div>
            </div>
          </div>

          {/* Vehicle info */}
          <div className="vehicle">
            <div className="row"><span className="k">Make / Model</span><span className="v">{vehicle.year} {vehicle.make} {vehicle.model}</span></div>
            <div className="row"><span className="k">Variant</span><span className="v">{vehicle.trim || '—'}</span></div>
            <div className="row"><span className="k">VIN</span><span className="v">{vehicle.vin || '—'}</span></div>
            <div className="row"><span className="k">Stock #</span><span className="v">{vehicle.stockNumber || '—'}</span></div>
            <div className="row"><span className="k">Colour</span><span className="v">{vehicle.color || '—'}</span></div>
            <div className="row"><span className="k">Odometer</span><span className="v">{(vehicle.mileage || 0).toLocaleString('en-ZA')} km</span></div>
            {vehicle.warranty && <div className="row"><span className="k">Warranty</span><span className="v">{vehicle.warranty}</span></div>}
            {vehicle.servicePlan && <div className="row"><span className="k">Service plan</span><span className="v">{vehicle.servicePlan}</span></div>}
            {vehicle.extras && <div className="row"><span className="k">Extras</span><span className="v">{vehicle.extras}</span></div>}
            <div className="row"><span className="k">Appraising dealer</span><span className="v">{dealerName || '—'}{dealerBranch ? ` · ${dealerBranch}` : ''}</span></div>
          </div>

          {/* Photo gallery */}
          {photosWithLabel.length > 0 && (
            <>
              <div className="section-title"><span className="n">Inspection Photos ({photosWithLabel.length})</span><span className="ln"></span></div>
              <div className="photos">
                {photosWithLabel.map((it, i) => (
                  <div key={it.id} className={`photo${i === 0 ? ' hero' : ''}`}>
                    <img src={it.photoUrl!} alt={it.label} />
                    <div className="cap">{it.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Condition summary */}
          <div className="section-title"><span className="n">Condition Summary</span><span className="ln"></span></div>
          <div className="cond-overall" style={{ borderColor: ratingColor }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>Overall condition</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: ratingColor }}>
              {overallRating.toFixed(1)} / 5.0 · {ratingLabel}
            </span>
          </div>
          <div className="cond-grid">
            {categories.map((cat) => {
              const g = categoryGrade(cat.items);
              return (
                <div className="cond" key={cat.name}>
                  <span className="lbl">{cat.name}</span>
                  <span className={`grade ${g.cls}`}>{g.label}</span>
                </div>
              );
            })}
          </div>

          {/* Smoker vehicle flag */}
          {vehicle.tradeInData?.vehicleDetails?.isSmokerVehicle && (
            <div style={{ margin: '10px 0', padding: '8px 12px', background: 'rgba(227,154,91,0.10)', borderLeft: '3px solid #E39A5B', borderRadius: 6, fontSize: 13, color: '#E39A5B', fontWeight: 600 }}>
              Ex-smoker's vehicle — interior may require deep cleaning or ozone treatment
            </div>
          )}

          {/* Damage findings from inspector tags */}
          {(() => {
            const SEVERITY_META: Record<number, { label: string; color: string; bg: string }> = {
              1: { label: 'Cosmetic', color: '#4FE3DC', bg: 'rgba(79,227,220,0.08)' },
              2: { label: 'Minor', color: '#7DD3A8', bg: 'rgba(125,211,168,0.08)' },
              3: { label: 'Moderate', color: '#E7C46B', bg: 'rgba(231,196,107,0.08)' },
              4: { label: 'Major', color: '#E39A5B', bg: 'rgba(227,154,91,0.10)' },
              5: { label: 'Structural', color: '#C07676', bg: 'rgba(192,118,118,0.10)' },
            };
            const all = Object.entries(vehicle.damageFindings || {}).flatMap(([slotId, list]) =>
              (list as DamageFinding[]).map(f => ({ ...f, slotId, panel: DEFAULT_TEMPLATE.slots.find(s => s.id === slotId)?.name || slotId }))
            );
            if (!all.length) return null;
            return (
              <>
                <div className="section-title"><span className="n">Damage Findings ({all.length})</span><span className="ln"></span></div>
                {all.map((f, i) => {
                  const sev = SEVERITY_META[f.severity] || SEVERITY_META[2];
                  return (
                    <div className="dmg-finding" key={i} style={{ background: sev.bg, borderLeftColor: sev.color }}>
                      <div className="dmg-h" style={{ color: sev.color }}>
                        {sev.label} · {f.damageType} · {f.panel}
                      </div>
                      <div className="dmg-l">
                        {f.note || 'Tagged by inspector'}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginBottom: 20 }} />
              </>
            );
          })()}

          {/* Valuation build-up */}
          <div className="section-title"><span className="n">Valuation Build-up</span><span className="ln"></span></div>
          <div className="adjustments">
            <div className="adj">
              <span className="desc">Market average</span>
              <span className="impact neutral">
                {valuation.averageRetailPrice != null ? fmt(valuation.averageRetailPrice) : '—'}
              </span>
            </div>
            {reconAdjustments.map((it) => (
              <div className="adj" key={it.id}>
                <span className="desc">
                  {it.label} — {it.status.replace(/_/g, ' ').toLowerCase()}
                  {it.reconNote && it.reconNote.trim() && (
                    <span className="recon-note">{it.reconNote.trim()}</span>
                  )}
                </span>
                <span className="impact neg">− {fmt(it.estimatedRepairCost)}</span>
              </div>
            ))}
            <div className="adj total">
              <span className="desc">Trade-in offer</span>
              <span className="impact">{fmt(valuation.finalTradeInValue)}</span>
            </div>
          </div>

          {/* Validity strip */}
          <div className="validity">
            <div className="item"><div className="k">Offer valid</div><div className="v">7 days from inspection</div></div>
            <div className="item"><div className="k">Expires</div><div className="v">{validUntil}</div></div>
            <div className="item"><div className="k">Linked VIR</div><div className="v">{linkedVirId}</div></div>
          </div>

          {/* Dealer sign-off */}
          <div className="section-title"><span className="n">Dealer Sign-Off</span><span className="ln"></span></div>
          <div className="signoff">
            <table>
              <tbody>
                <tr><td className="k">Dealership</td><td className="v">{dealerName || '—'}{dealerBranch ? ` · ${dealerBranch}` : ''}</td></tr>
                <tr><td className="k">Inspector</td><td className="v">{inspectorName || '—'}</td></tr>
                <tr><td className="k">Contact</td><td className="v">{contactPhone || '—'}</td></tr>
                {dealerEmail && <tr><td className="k">Email</td><td className="v">{dealerEmail}</td></tr>}
                {dealerAddress && <tr><td className="k">Address</td><td className="v">{dealerAddress}</td></tr>}
                {dealerVat && <tr><td className="k">VAT No.</td><td className="v">{dealerVat}</td></tr>}
                <tr><td className="k">Date</td><td className="v">{now}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Signature row */}
          <div className="sig-row">
            <div className="sig">
              {signatureUrl && <img className="sig-img" src={signatureUrl} alt="Dealer signature" />}
              <div className="line"><div className="lbl">Dealer representative</div></div>
            </div>
            <div className="sig">
              <div className="line"><div className="lbl">Vehicle owner</div></div>
            </div>
          </div>

          <div className="disclaimer">
            This valuation is based on current market data and the physical condition observed during inspection. It is not a guarantee of resale value. The trade-in offer is subject to final verification of vehicle documentation, outstanding finance settlement, and registration transfer. Offer expires on the date stated above. Full inspection report available under the linked VIR reference.
          </div>

          <div className="ti-foot">
            <span className="am">TruInspect · Trade-in Valuation · powered by TruDealer</span>
            <span>{deriveReportId(vehicle)} · {now}</span>
          </div>
        </div>

        {/* === APP-ONLY SECTIONS (not in export ref) === */}
        <div className="p-4 space-y-4">
          {/* Dealer sign-off fields */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
            <h3 className="text-[13px] font-medium text-cyan-400">Inspector details</h3>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Inspector name…"
              className="w-full px-3 min-h-[46px] bg-neutral-950/80 border border-neutral-800 rounded-lg text-[14px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Contact phone…"
              className="w-full px-3 min-h-[46px] bg-neutral-950/80 border border-neutral-800 rounded-lg text-[14px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {/* Digital signature canvas */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-medium text-cyan-400 flex items-center gap-2">
                <Pen size={14} /> Digital signature
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
          className="btn-primary on-fill w-full min-h-[52px] text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Trade-In Appraisal'}
        </button>
      </div>
    </div>
  );
}
