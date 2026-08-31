import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, FileText, Loader2, AlertTriangle, Upload, ShieldCheck, ExternalLink, SkipForward, RotateCcw, PenLine, X, Banknote } from "lucide-react";
import type { AccountingPlatform, DealerDocument, Dealership, DocMode, DocStage, Lead } from "../../types";
import { DOC_STAGES, FIXED_STAGE_MODES, DEFAULT_DOC_FLOW } from "../../types";
import { authFetch } from "../../lib/session";
import { useMarket } from "../../contexts/MarketContext";
import { createStageDocument, finalizeStageDocument, signDocument, updateLead, skipDocStage } from "../../api";

interface Props {
  lead: Lead;
  dealership: Dealership | undefined;
  onLeadRefresh?: () => void;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Decode a `data:...;base64,...` URL into a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64 = ""] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);base64/)?.[1] || "application/pdf";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Open a finished document for View / Print.
 *
 * The document's fileData is a `data:application/pdf;base64,…` URL. Browsers —
 * and installed PWAs especially — BLOCK top-level navigation to a data: URL as
 * an anti-phishing measure, which is why "View / Print" opened a blank page.
 * Converting to a blob: URL first is allowed, so the PDF actually renders. Falls
 * back to a download if a popup blocker stops the new tab.
 */
function openDocumentFile(fileData: string, filename = "document.pdf") {
  try {
    if (!fileData.startsWith("data:")) {
      window.open(fileData, "_blank", "noopener,noreferrer");
      return;
    }
    const url = URL.createObjectURL(dataUrlToBlob(fileData));
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — hand it over as a download instead of failing silently.
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Give the new tab time to load before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    /* nothing we can safely do; the caller's UI stays put */
  }
}

const STAGE_LABEL: Record<DocStage, string> = {
  proforma: "Proforma",
  deed: "Offer to Purchase",
  compliance: "Compliance",
  invoice: "Invoice",
  handover: "Handover",
};

const ACCOUNTING_LABEL: Record<AccountingPlatform, string> = {
  xero: "Xero",
  quickbooks: "QuickBooks",
  zoho: "Zoho Books",
};

export default function DocHubPanel({ lead, dealership, onLeadRefresh }: Props) {
  const market = useMarket();
  const [docs, setDocs] = useState<DealerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStage, setBusyStage] = useState<DocStage | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ stage: DocStage; fields: string[] } | null>(null);

  // Inline sign UI state
  const [signStage, setSignStage] = useState<DocStage | null>(null);
  const [signMode, setSignMode] = useState<"draw" | "type">("type");
  const [signName, setSignName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Imagin8 invoice
  const [imagin8Busy, setImagin8Busy] = useState(false);
  const handleImagin8Invoice = async () => {
    setImagin8Busy(true);
    setFlashError(null);
    try {
      const vehicle = (lead as any).vehicleId ? undefined : undefined;
      const res = await authFetch("/api/imagin8/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Customer",
          customerEmail: lead.email,
          customerPhone: lead.phone,
          reference: `Deal ${lead.id?.slice(0, 8)}`,
          lineItems: [{ description: `Vehicle sale — ${lead.vehicleInterest || "vehicle"}`, quantity: 1, unitPrice: 0 }],
          notes: "Issued via TruFlow",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlashError(null);
      alert(`Imagin8 invoice created: ${data.invoiceNumber || data.invoiceId || "OK"}`);
    } catch (err: any) {
      setFlashError(err?.message || "Imagin8 invoice failed");
    } finally {
      setImagin8Busy(false);
    }
  };

  // Inline skip UI state
  const [skipStage, setSkipStage] = useState<DocStage | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const docFlow = dealership?.docFlow || {};
  const isComplete = !!lead.docFlowCompletedAt;
  const currentStage = lead.docStage ?? DOC_STAGES[0];
  const currentIdx = isComplete ? DOC_STAGES.length : DOC_STAGES.indexOf(currentStage);

  const reload = async () => {
    try {
      const res = await authFetch(`/api/deals/${lead.id}/documents`);
      if (!res.ok) throw new Error(`Could not load documents (${res.status})`);
      const list = (await res.json()) as DealerDocument[];
      setDocs(list.filter((d) => d.stage));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const docForStage = (stage: DocStage): DealerDocument | undefined => {
    const candidates = docs.filter((d) => d.stage === stage);
    return candidates.find((d) => d.status === "Signed") || candidates[0];
  };

  const modeForStage = (stage: DocStage): DocMode =>
    FIXED_STAGE_MODES[stage] || docFlow[stage] || DEFAULT_DOC_FLOW[stage];

  const handleGenerateOrConnect = async (stage: DocStage, mode: DocMode) => {
    setBusyStage(stage);
    setFlashError(null);
    try {
      await createStageDocument({
        leadId: lead.id,
        vehicleId: lead.vehicleId,
        stage,
        mode,
        fileName: `${stage}-${new Date().toISOString().slice(0, 10)}`,
        mimeType: mode === "connect" ? "text/csv" : "application/pdf",
      });
      await reload();
    } catch (err) {
      setFlashError(err instanceof Error ? err.message : `${mode} failed`);
    } finally {
      setBusyStage(null);
    }
  };

  const handleAttach = async (stage: DocStage, file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setFlashError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — please upload files under 15 MB.`);
      return;
    }
    setBusyStage(stage);
    setFlashError(null);
    try {
      const fileData = await fileToDataUrl(file);
      await createStageDocument({
        leadId: lead.id,
        vehicleId: lead.vehicleId,
        stage,
        mode: "attach",
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileData,
      });
      await reload();
    } catch (err) {
      setFlashError(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setBusyStage(null);
    }
  };

  // --- Inline sign flow ---------------------------------------------------

  const openSignFlow = (stage: DocStage) => {
    setSignStage(stage);
    setSignMode("type");
    setSignName("");
    setFlashError(null);
    setMissing(null);
  };

  const closeSignFlow = () => {
    setSignStage(null);
    setSignName("");
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a0e14";
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    if ("touches" in e) e.preventDefault();
  };

  const stopDrawing = () => setIsDrawing(false);

  const handleSignSubmit = async () => {
    if (!signStage) return;
    const doc = docForStage(signStage);
    if (!doc) return;

    let signatureData = "";
    const who = signName.trim();

    if (signMode === "draw") {
      signatureData = canvasRef.current?.toDataURL() || "";
      if (!signatureData || signatureData === "data:,") {
        setFlashError("Please draw a signature before submitting.");
        return;
      }
    } else {
      if (!who) {
        setFlashError("Please type a name to sign.");
        return;
      }
      signatureData = `TYPED:${who}`;
    }

    setBusyStage(signStage);
    setFlashError(null);
    setMissing(null);
    try {
      if (doc.status !== "Signed") {
        await signDocument(doc.id, signatureData, who || "Signee");
      }
      await finalizeStageDocument(doc.id);
      closeSignFlow();
      await reload();
      onLeadRefresh?.();
    } catch (err) {
      const e = err as Error & { missing?: string[] };
      if (e.missing && signStage) {
        setMissing({ stage: signStage, fields: e.missing });
      } else {
        setFlashError(e.message || "Finalise failed");
      }
    } finally {
      setBusyStage(null);
    }
  };

  // --- Inline skip flow ---------------------------------------------------

  const openSkipFlow = (stage: DocStage) => {
    setSkipStage(stage);
    setSkipReason("");
    setFlashError(null);
    setMissing(null);
  };

  const closeSkipFlow = () => {
    setSkipStage(null);
    setSkipReason("");
  };

  const handleSkipSubmit = async () => {
    if (!skipStage) return;
    setBusyStage(skipStage);
    setFlashError(null);
    setMissing(null);
    try {
      await skipDocStage(lead.id, skipStage, skipReason.trim() || undefined);
      closeSkipFlow();
      await reload();
      onLeadRefresh?.();
    } catch (err) {
      setFlashError((err as Error).message || "Skip failed");
    } finally {
      setBusyStage(null);
    }
  };

  // --- Compliance ---------------------------------------------------------

  const handleComplianceConfirm = async () => {
    setBusyStage("compliance");
    setFlashError(null);
    try {
      const existing = docForStage("compliance");
      const docId = existing
        ? existing.id
        : (
            await createStageDocument({
              leadId: lead.id,
              vehicleId: lead.vehicleId,
              stage: "compliance",
              mode: "confirm",
            })
          ).id;
      await finalizeStageDocument(docId);
      await reload();
      onLeadRefresh?.();
    } catch (err) {
      const e = err as Error & { missing?: string[] };
      if (e.missing) {
        setMissing({ stage: "compliance", fields: e.missing });
      } else {
        setFlashError(e.message || "Confirm failed");
      }
    } finally {
      setBusyStage(null);
    }
  };

  const patchChecklist = async (patch: Partial<NonNullable<Lead["dealChecklist"]>>) => {
    await updateLead(lead.id, {
      dealChecklist: { ...(lead.dealChecklist || {}), ...patch } as Lead["dealChecklist"],
    });
    onLeadRefresh?.();
  };

  const natis = !!lead.dealChecklist?.natis;
  const roadworthy = !!lead.dealChecklist?.roadworthy;
  const complianceReady = natis && roadworthy;

  // --- Render -------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[rgba(232,234,230,0.55)]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading documents…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-[rgba(232,234,230,0.72)]">
        <FileText className="w-4 h-4" />
        <span>
          Deal stage:{" "}
          <span className={`font-semibold ${isComplete ? "text-emerald-300" : "text-[color:var(--white)]"}`}>
            {isComplete
              ? `Complete — handed over ${new Date(lead.docFlowCompletedAt!).toLocaleDateString(market.locale)}`
              : lead.docStage
              ? STAGE_LABEL[lead.docStage]
              : "Not started"}
          </span>
        </span>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {loadError} — the stages below may be incomplete, so do not file a replacement
            document until this loads.
          </span>
        </div>
      )}

      {flashError && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{flashError}</span>
        </div>
      )}

      {missing && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <span className="font-semibold">{STAGE_LABEL[missing.stage]} — required:</span>
          <ul className="list-disc list-inside">
            {missing.fields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {DOC_STAGES.map((stage, idx) => {
          const mode = modeForStage(stage);
          const doc = docForStage(stage);
          const stageFinalised = doc?.status === "Signed";
          const done = idx < currentIdx || (stageFinalised && isComplete);
          const current = idx === currentIdx && !isComplete;
          const upcoming = idx > currentIdx && !isComplete;

          return (
            <div
              key={stage}
              className={`flex flex-col gap-2 rounded-lg border px-3 py-2 transition-colors ${
                current
                  ? "border-[color:var(--cyan)] bg-[color:var(--cyan-faint)]"
                  : done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-[rgba(138,162,184,0.15)] bg-white/2"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className={`w-5 h-5 ${current ? "text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.35)]"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[color:var(--white)]">{STAGE_LABEL[stage]}</div>
                  <div className="text-xs text-[rgba(232,234,230,0.55)]">
                    Mode: <span className="uppercase tracking-wide">{mode}</span>
                    {doc && ` · ${doc.status}`}
                    {doc?.fileName && mode !== "confirm" && ` · ${doc.fileName}`}
                  </div>
                  {doc?.accountingPush && (
                    <div className="text-xs text-emerald-300/80 mt-0.5">
                      ✓ Sent to {ACCOUNTING_LABEL[doc.accountingPush.platform]}
                    </div>
                  )}
                  {doc?.accountingPushError && (
                    <div className="text-xs text-amber-300/80 mt-0.5">{doc.accountingPushError}</div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {mode === "generate" && !doc && !upcoming && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateOrConnect(stage, "generate")}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-[color:var(--cyan)] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      Generate
                    </button>
                  )}
                  {mode === "connect" && !doc && !upcoming && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateOrConnect(stage, "connect")}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-[color:var(--cyan)] text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      {stage === "invoice" && dealership?.accountingEnabled && dealership?.codatCompanyId ? "Send to accounting" : "Export CSV"}
                    </button>
                  )}
                  {mode === "attach" && !doc && !upcoming && (
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-[color:var(--cyan)] text-black text-xs font-semibold hover:opacity-90">
                      {busyStage === stage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleAttach(stage, f);
                          e.target.value = "";
                        }}
                        disabled={busyStage === stage}
                      />
                     </label>
                   )}
                   {stage === "invoice" && !done && !upcoming && (
                     <button
                       type="button"
                       onClick={handleImagin8Invoice}
                       disabled={imagin8Busy}
                       className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
                     >
                       {imagin8Busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
                       Issue via Imagin8
                     </button>
                   )}
                   {!done && !stageFinalised && !(lead.docSkips as any)?.[stage] && (
                     <button
                       type="button"
                       onClick={() => openSkipFlow(stage)}
                       disabled={busyStage === stage}
                       className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/10 disabled:opacity-50 cursor-pointer"
                     >
                       {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                       Skip
                     </button>
                   )}
                   {mode !== "confirm" && doc && doc.status !== "Signed" && (
                    <button
                      type="button"
                      onClick={() => openSignFlow(stage)}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-emerald-500 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                      Sign & finalise
                    </button>
                  )}
                  {mode !== "confirm" && doc && doc.fileData && (
                    <button
                      type="button"
                      onClick={() => openDocumentFile(doc.fileData!, `${STAGE_LABEL[stage]}.pdf`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md border border-white/15 text-xs font-semibold hover:bg-white/5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View / Print
                    </button>
                  )}
                  {doc && doc.status === "Signed" && (
                    <span className="text-xs text-emerald-300">✓ {mode === "confirm" ? "Confirmed" : "Signed"}</span>
                  )}
                  {!stageFinalised && (lead.docSkips as any)?.[stage] && (
                    <span className="text-xs text-amber-300/70">Skipped</span>
                  )}
                </div>
              </div>

              {/* Inline sign panel */}
              {signStage === stage && (
                <div className="flex flex-col gap-3 pl-8 pt-2 pb-1 border-t border-white/5 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                      <PenLine className="w-3.5 h-3.5" />
                      Sign & finalise — {STAGE_LABEL[stage]}
                    </div>
                    <button
                      type="button"
                      onClick={closeSignFlow}
                      className="p-1 rounded hover:bg-white/10 text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSignMode("type")}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                        signMode === "type"
                          ? "bg-[color:var(--cyan)] text-black"
                          : "bg-white/5 text-[rgba(232,234,230,0.72)] hover:bg-white/10"
                      }`}
                    >
                      Type name
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignMode("draw")}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                        signMode === "draw"
                          ? "bg-[color:var(--cyan)] text-black"
                          : "bg-white/5 text-[rgba(232,234,230,0.72)] hover:bg-white/10"
                      }`}
                    >
                      Draw
                    </button>
                  </div>

                  {signMode === "type" ? (
                    <input
                      type="text"
                      value={signName}
                      onChange={(e) => setSignName(e.target.value)}
                      placeholder="Full name to sign"
                      autoFocus
                      className="px-3 py-2.5 rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-sm text-[color:var(--white)] placeholder-[rgba(232,234,230,0.35)] focus:border-[color:var(--cyan)] focus:outline-none"
                      style={{ fontFamily: "cursive" }}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSignSubmit(); }}
                    />
                  ) : (
                    <>
                      <div className="bg-white rounded-md overflow-hidden border border-[rgba(138,162,184,0.15)]">
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={120}
                          className="w-full touch-none cursor-crosshair"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-[rgba(232,234,230,0.55)] hover:bg-white/10 hover:text-[color:var(--white)]"
                        >
                          <RotateCcw className="w-3 h-3" /> Clear
                        </button>
                      </div>
                      <input
                        type="text"
                        value={signName}
                        onChange={(e) => setSignName(e.target.value)}
                        placeholder="Signee's full name (for the record)"
                        className="px-3 py-2 rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-xs text-[color:var(--white)] placeholder-[rgba(232,234,230,0.35)] focus:border-[color:var(--cyan)] focus:outline-none"
                      />
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSignSubmit()}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[36px] rounded-md bg-emerald-500 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                      Confirm & finalise
                    </button>
                    <button
                      type="button"
                      onClick={closeSignFlow}
                      className="px-3 py-2 min-h-[36px] rounded-md text-xs font-semibold text-[rgba(232,234,230,0.55)] hover:bg-white/5 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Inline skip panel */}
              {skipStage === stage && (
                <div className="flex flex-col gap-3 pl-8 pt-2 pb-1 border-t border-white/5 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <SkipForward className="w-3.5 h-3.5" />
                      Skip — {STAGE_LABEL[stage]}
                    </div>
                    <button
                      type="button"
                      onClick={closeSkipFlow}
                      className="p-1 rounded hover:bg-white/10 text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-[rgba(232,234,230,0.55)] leading-relaxed">
                    Skipping records this stage as intentionally bypassed. This is logged in the audit trail.
                  </p>

                  <input
                    type="text"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    placeholder="Reason (optional)"
                    autoFocus
                    className="px-3 py-2 rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-xs text-[color:var(--white)] placeholder-[rgba(232,234,230,0.35)] focus:border-amber-500/50 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSkipSubmit(); }}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSkipSubmit()}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[36px] rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                      Confirm skip
                    </button>
                    <button
                      type="button"
                      onClick={closeSkipFlow}
                      className="px-3 py-2 min-h-[36px] rounded-md text-xs font-semibold text-[rgba(232,234,230,0.55)] hover:bg-white/5 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Compliance-specific body */}
              {stage === "compliance" && mode === "confirm" && (!doc || doc.status !== "Signed") && (
                <div className="flex flex-col gap-2 pl-8 pt-1 border-t border-white/5 mt-1">
                  <label className="flex items-center gap-2 text-xs text-[rgba(232,234,230,0.72)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={natis}
                      onChange={(e) => void patchChecklist({ natis: e.target.checked })}
                      className="w-4 h-4 accent-[color:var(--cyan)]"
                    />
                    NATIS in hand
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[rgba(232,234,230,0.72)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roadworthy}
                      onChange={(e) => void patchChecklist({ roadworthy: e.target.checked })}
                      className="w-4 h-4 accent-[color:var(--cyan)]"
                    />
                    Roadworthy certificate on file
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleComplianceConfirm()}
                    disabled={!complianceReady || busyStage === "compliance"}
                    className="self-start inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-emerald-500 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {busyStage === "compliance" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    Confirm compliance
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
