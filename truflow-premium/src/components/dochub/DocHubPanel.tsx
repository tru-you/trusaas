import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, Loader2, AlertTriangle, Upload, ShieldCheck } from "lucide-react";
import type { DealerDocument, Dealership, DocMode, DocStage, Lead } from "../../types";
import { DOC_STAGES, FIXED_STAGE_MODES, DEFAULT_DOC_FLOW } from "../../types";
import { authFetch } from "../../lib/session";
import { createStageDocument, finalizeStageDocument, signDocument, updateLead } from "../../api";

interface Props {
  lead: Lead;
  dealership: Dealership | undefined;
  onLeadRefresh?: () => void;
}

const STAGE_LABEL: Record<DocStage, string> = {
  proforma: "Proforma",
  deed: "Offer to Purchase",
  compliance: "Compliance",
  invoice: "Invoice",
  handover: "Handover",
};

/** Lazy chunk root. All DocHub UI lives inside this file (or files it
 *  imports) so React.lazy() keeps the whole feature out of the mobile bundle.
 *  Nothing here is safe to import at the top of any always-loaded module. */
export default function DocHubPanel({ lead, dealership, onLeadRefresh }: Props) {
  const [docs, setDocs] = useState<DealerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStage, setBusyStage] = useState<DocStage | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ stage: DocStage; fields: string[] } | null>(null);

  const docFlow = dealership?.docFlow || {};
  /* `docStage: null` means two opposite things — never started, or finished the
     last stage with nothing left due. `docFlowCompletedAt` is what tells them
     apart; reading docStage alone rendered a finished deal as if it were sitting
     at Proforma. When complete, every stage is behind us. */
  const isComplete = !!lead.docFlowCompletedAt;
  const currentStage = lead.docStage ?? DOC_STAGES[0];
  const currentIdx = isComplete ? DOC_STAGES.length : DOC_STAGES.indexOf(currentStage);

  /* A failed load must not look like an empty one. Swallowing the error left
     `docs` at [] and the panel then offered an Upload button for every stage,
     including stages that already had a signed document — inviting the dealer
     to file a duplicate. Say so instead. */
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

  const docForStage = (stage: DocStage): DealerDocument | undefined =>
    docs.find((d) => d.stage === stage);

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

  const handleSignAndFinalize = async (doc: DealerDocument) => {
    if (!doc.stage) return;
    setBusyStage(doc.stage);
    setFlashError(null);
    setMissing(null);
    try {
      const who = (window.prompt("Signed by (type name to confirm):") || "").trim();
      if (!who) return;
      if (doc.status !== "Signed") {
        await signDocument(doc.id, `TYPED:${who}`, who);
      }
      await finalizeStageDocument(doc.id);
      await reload();
      onLeadRefresh?.();
    } catch (err) {
      const e = err as Error & { missing?: string[] };
      if (e.missing && doc.stage) {
        setMissing({ stage: doc.stage, fields: e.missing });
      } else {
        setFlashError(e.message || "Finalise failed");
      }
    } finally {
      setBusyStage(null);
    }
  };

  /** Compliance is government paperwork — NATIS from eNatis, roadworthy from
   *  a testing station. There is nothing to generate and nothing to upload
   *  that could be "signed", so this stage is confirmed by ticking the two
   *  flags on the lead's checklist and letting the server verify them. */
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-[rgba(232,234,230,0.72)]">
        <FileText className="w-4 h-4" />
        <span>
          Deal stage:{" "}
          <span className={`font-semibold ${isComplete ? "text-emerald-300" : "text-[color:var(--white)]"}`}>
            {isComplete
              ? `Complete — handed over ${new Date(lead.docFlowCompletedAt!).toLocaleDateString("en-ZA")}`
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
          const done = idx < currentIdx || (doc?.status === "Signed" && idx <= currentIdx);
          const current = idx === currentIdx;
          const upcoming = idx > currentIdx;

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
                      Export CSV
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
                        }}
                        disabled={busyStage === stage}
                      />
                    </label>
                  )}
                  {mode !== "confirm" && doc && doc.status !== "Signed" && (
                    <button
                      type="button"
                      onClick={() => void handleSignAndFinalize(doc)}
                      disabled={busyStage === stage}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-emerald-500 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {busyStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sign & finalise"}
                    </button>
                  )}
                  {doc && doc.status === "Signed" && (
                    <span className="text-xs text-emerald-300">✓ {mode === "confirm" ? "Confirmed" : "Signed"}</span>
                  )}
                </div>
              </div>

              {/* Compliance-specific body: two ticks. NATIS + Roadworthy. */}
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
                    className="self-start inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md bg-emerald-500 text-black text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
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

      {loading && (
        <div className="text-xs text-[rgba(232,234,230,0.5)] flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading documents…
        </div>
      )}
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
