import React, { useState } from "react";
import { Check, Loader2, Upload, FileText } from "lucide-react";
import type { Agency, DocMode, DocStage } from "../../types";
import { DOC_STAGES, FIXED_STAGE_MODES } from "../../types";
import { updateDocFlow } from "../../api";

interface Props {
  agency: Agency;
  isAdmin?: boolean;
  onSaved?: (updated: Agency) => void;
}

const STAGE_LABEL: Record<DocStage, string> = {
  offer: "offer",
  transfer: "Offer to Purchase",
  compliance: "Compliance",
  invoice: "Invoice",
  occupation: "occupation",
};

const STAGE_DESC: Record<DocStage, string> = {
  offer: "Preliminary offer — erf ref, price, validity window.",
  transfer: "Offer to purchase. NCA disclosure if financed.",
  compliance: "Electrical COC + compliance — tick-box only.",
  invoice: "Tax invoice for the sale.",
  occupation: "Occupation certificate + transfer confirmation on handover.",
};

/** Per-agency DocHub configuration. Modes per stage:
 *  `generate` (PropInspect renders a PDF from a template — deferred in v1),
 *  `attach`   (agency uploads their own signed doc),
 *  `confirm`  (checkboxes only — fixed for compliance; Electrical CoC and
 *              beetle clearance are issued by external certifiers, not produced
 *              by the agency). */
export default function DocFlowSettings({ agency, isAdmin, onSaved }: Props) {
  const [flow, setFlow] = useState<Partial<Record<DocStage, DocMode>>>(() => {
    const initial: Partial<Record<DocStage, DocMode>> = {};
    for (const s of DOC_STAGES) {
      // Fixed stages ignore stored config — always render as the fixed mode.
      initial[s] = FIXED_STAGE_MODES[s] || agency.docFlow?.[s] || "attach";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (stage: DocStage, mode: DocMode) => {
    setFlow((f) => ({ ...f, [stage]: mode }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDocFlow(flow, isAdmin ? agency.id : undefined);
      onSaved?.(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-[rgba(232,234,230,0.72)]">
        <FileText className="w-4 h-4" />
        <span>
          DocHub flow —{" "}
          <span className="text-[color:var(--white)] font-semibold">{agency.name}</span>
        </span>
      </div>

      <p className="text-xs text-[rgba(232,234,230,0.55)] leading-relaxed">
        Choose how each stage's document is produced. <b>Attach</b> lets you upload your own
        signed document; <b>Generate</b> renders one from a PropInspect template
        (coming in the next release).
      </p>

      <div className="flex flex-col gap-2">
        {DOC_STAGES.map((stage) => {
          const mode = flow[stage] || "attach";
          return (
            <div
              key={stage}
              className="flex items-start gap-3 rounded-lg border border-[rgba(138,162,184,0.15)] bg-white/2 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[color:var(--white)]">
                  {STAGE_LABEL[stage]}
                </div>
                <div className="text-xs text-[rgba(232,234,230,0.55)]">{STAGE_DESC[stage]}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {FIXED_STAGE_MODES[stage] ? (
                  /* Not a choice. Compliance is the Electrical CoC and beetle
                     clearance — both issued by external certifiers, so there is
                     nothing for the agency to generate or attach. Rendering the
                     buttons here let the row
                     be clicked into a mode DocHubPanel then ignored, so the
                     settings screen disagreed with the actual behaviour. */
                  <span
                    className="inline-flex items-center px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold bg-white/5 text-[rgba(232,234,230,0.55)]"
                    title="Government-issued — confirmed with tick-boxes on the deal, not a document"
                  >
                    Tick-box only
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleChange(stage, "attach")}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors ${
                        mode === "attach"
                          ? "bg-[color:var(--cyan)] text-black"
                          : "bg-white/5 text-[rgba(232,234,230,0.72)] hover:bg-white/10"
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Attach
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Templates coming soon"
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold bg-white/2 text-[rgba(232,234,230,0.35)] cursor-not-allowed"
                    >
                      Generate <span className="text-[10px]">(soon)</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-md bg-[color:var(--cyan)] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save
        </button>
        {saved && !saving && (
          <span className="text-xs text-emerald-300">Saved.</span>
        )}
      </div>
    </div>
  );
}
