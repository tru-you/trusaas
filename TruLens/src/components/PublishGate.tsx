import React from 'react';
import { Check, X, ArrowRight, ArrowLeft, Globe, Upload } from 'lucide-react';
import { Vehicle } from '../types';
import { computeWebReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';

interface PublishGateProps {
  vehicle: Vehicle;
  onBack: () => void;
  onPublish: () => void;
  /** Runs the real DMS push and resolves with its outcome so the gate can show
   *  a Sending state and surface a failure rather than navigating away blind. */
  onExport: () => Promise<{ success: boolean; error?: string }>;
}

export default function PublishGate({ vehicle, onBack, onPublish, onExport }: PublishGateProps) {
  const readiness = computeWebReadiness(vehicle);
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState<string | null>(null);

  const doExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      const r = await onExport();
      // On success the parent navigates away; only a failure stays to report.
      if (r && r.success === false) setExportErr(r.error || 'Export failed — try again.');
    } catch {
      setExportErr('Export failed — try again.');
    } finally {
      setExporting(false);
    }
  };
  const photos = vehicle?.photos || {};
  const slots = DEFAULT_TEMPLATE.slots;
  const exteriorSlots = slots.filter(s => s.category === 'exterior' || s.phase === 2);
  const exteriorPresent = exteriorSlots.filter(s => !!photos[s.id]).length;
  const nonCore = slots.filter(s => s.tier !== 'core');
  const nonCoreTaken = nonCore.filter(s => !!photos[s.id]).length;

  const conditions: { label: string; met: boolean }[] = [
    {
      // Core, not the old required[] set — every slot is optional, so
      // requiredTaken/requiredTotal read "0 of 0" and falsely showed green.
      label: `${readiness.coreTaken} of ${readiness.coreTotal} core shots captured`,
      met: readiness.coreTotal > 0 && readiness.coreTaken === readiness.coreTotal,
    },
    {
      // TruLens states a dealer-declared condition, not a graded VIR score.
      label: readiness.conditionDeclared
        ? 'Condition declared'
        : 'Condition not declared — state it on the report',
      met: readiness.conditionDeclared,
    },
    {
      label: `${exteriorPresent} of ${exteriorSlots.length} exterior panels present`,
      met: exteriorPresent === exteriorSlots.length,
    },
    {
      label: (() => {
        const skipped = nonCore.length - nonCoreTaken;
        return skipped > 0
          ? `${skipped} optional shots skipped — listing still publishes`
          : `All ${nonCore.length} optional shots captured`;
      })(),
      met: true,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass px-4 py-3 border-b border-cyan-500/20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight">Publish gate</h1>
            <p className="text-[12px] text-[rgba(232,234,230,0.55)]">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Readiness conditions */}
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div
              key={i}
              className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${
                c.met
                  ? 'bg-cyan-500/8 border-cyan-500/30'
                  : 'bg-rose-500/5 border-rose-500/30'
              }`}
            >
              {c.met ? (
                <Check size={16} className="text-cyan-400 mt-0.5 shrink-0" strokeWidth={3} />
              ) : (
                <X size={16} className="text-rose-400 mt-0.5 shrink-0" strokeWidth={3} />
              )}
              <p className="text-[13px] font-medium">{c.label}</p>
            </div>
          ))}
        </div>

        {/* 6-column shot grid */}
        <div>
          <p className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">All shots</p>
          <div className="grid grid-cols-6 gap-1.5">
            {slots.map((slot) => {
              const photo = photos[slot.id];
              return (
                <div
                  key={slot.id}
                  className={`aspect-square rounded-lg overflow-hidden border ${
                    photo
                      ? 'border-[rgba(232,234,230,0.14)]'
                      : slot.required
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-[rgba(232,234,230,0.08)] bg-[rgba(232,234,230,0.03)]'
                  }`}
                >
                  {photo ? (
                    <img src={photo} alt={slot.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[9px] text-[rgba(232,234,230,0.35)] flex items-center justify-center h-full px-0.5 text-center leading-tight">
                      {slot.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95 space-y-2">
        <button
          type="button"
          disabled={!readiness.canPublishWeb}
          onClick={onPublish}
          className="w-full min-h-[52px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Globe size={15} /> Publish to website feed
        </button>
        {exportErr && (
          <p className="text-[13px] text-rose-300 text-center px-2">{exportErr}</p>
        )}
        <button
          type="button"
          disabled={!readiness.canExportDms || exporting}
          onClick={doExport}
          className="w-full min-h-[52px] rounded-xl bg-[rgba(232,234,230,0.055)] border border-[rgba(232,234,230,0.14)] text-[#E8EAE6] text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {/* State-aware label: Sending while the push runs, then first push =
             "Send to DMS" / subsequent = "Re-Export to DMS". */}
          <Upload size={15} />{' '}
          {exporting
            ? 'Sending to DMS…'
            : (vehicle as any).lastDmsExportAt
            ? 'Re-Export to DMS'
            : 'Send to DMS'}
        </button>
      </div>
    </div>
  );
}
