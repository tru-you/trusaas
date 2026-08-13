import React, { useState } from "react";
import { Check, Loader2, Upload, FileText, Link2 } from "lucide-react";
import type { Dealership, DocMode, DocStage } from "../../types";
import { DOC_STAGES, FIXED_STAGE_MODES, DEFAULT_DOC_FLOW } from "../../types";
import { updateDocFlow } from "../../api";

interface Props {
  dealership: Dealership;
  isAdmin?: boolean;
  onSaved?: (updated: Dealership) => void;
}

const STAGE_LABEL: Record<DocStage, string> = {
  proforma: "Proforma",
  deed: "Offer to Purchase",
  compliance: "Compliance",
  invoice: "Invoice",
  handover: "Handover",
};

const STAGE_DESC: Record<DocStage, string> = {
  proforma: "Preliminary offer — VIN, price, validity window.",
  deed: "Offer to purchase. NCA disclosure if financed.",
  compliance: "NATIS + roadworthy — government-issued, tick-box only.",
  invoice: "Tax invoice for the sale.",
  handover: "Warranty + NATIS-updated confirmation on release.",
};

/** Per-dealer DocHub configuration. Modes per stage:
 *  `generate` (TruFlow renders a PDF from the deal data using the templates
 *              in docPdf.ts — generated docs carry a full fieldSnapshot so they
 *              can be finalised immediately),
 *  `attach`   (dealer uploads their own signed doc),
 *  `confirm`  (checkboxes only — fixed for compliance; NATIS/RWC are
 *              government paperwork and cannot be produced by the dealer). */
export default function DocFlowSettings({ dealership, isAdmin, onSaved }: Props) {
  const [flow, setFlow] = useState<Partial<Record<DocStage, DocMode>>>(() => {
    const initial: Partial<Record<DocStage, DocMode>> = {};
    for (const s of DOC_STAGES) {
      // Fixed stages ignore stored config — always render as the fixed mode.
      initial[s] = FIXED_STAGE_MODES[s] || dealership.docFlow?.[s] || DEFAULT_DOC_FLOW[s];
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
      const updated = await updateDocFlow(flow, isAdmin ? dealership.id : undefined);
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
          <span className="text-[color:var(--white)] font-semibold">{dealership.name}</span>
        </span>
      </div>

      <p className="text-xs text-[rgba(232,234,230,0.55)] leading-relaxed">
        Choose how each stage's document is produced. <b>Attach</b> lets you upload your own
        signed document; <b>Generate</b> renders one from a TruFlow template;
        <b>Connect</b> pushes the invoice straight into Xero, QuickBooks or Zoho once you've
        linked one in Accounting Integrations settings — otherwise it exports a CSV you can
        import by hand.
      </p>
      <p className="text-xs text-[rgba(232,234,230,0.4)] -mt-2">
        Logo, banking details and clause text for generated documents live in{" "}
        <b className="text-[rgba(232,234,230,0.6)]">Document settings</b>, under Settings.
      </p>

      <div className="flex flex-col gap-2">
        {DOC_STAGES.map((stage) => {
          const mode = flow[stage] || DEFAULT_DOC_FLOW[stage];
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
                  /* Not a choice. Compliance is NATIS and a roadworthy — both
                     issued by government, so there is nothing for the dealer to
                     generate or attach. Rendering the buttons here let the row
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
                      className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors cursor-pointer ${
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
                      onClick={() => handleChange(stage, "generate")}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        mode === "generate"
                          ? "bg-[color:var(--cyan)] text-black"
                          : "bg-white/5 text-[rgba(232,234,230,0.72)] hover:bg-white/10"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange(stage, "connect")}
                      title="Pushes live to a connected Xero, QuickBooks or Zoho account; exports a CSV otherwise"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        mode === "connect"
                          ? "bg-[color:var(--cyan)] text-black"
                          : "bg-white/5 text-[rgba(232,234,230,0.72)] hover:bg-white/10"
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Connect
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
