import React from 'react';
import { Check, X, ArrowLeft, Globe, Upload, Camera, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Vehicle } from '../types';
import { computeWebReadiness } from '../lib/readiness';
import { DEFAULT_TEMPLATE } from '../templates';

type ReviewStatus = 'ok' | 'damaged';

interface PublishGateProps {
  vehicle: Vehicle;
  onBack: () => void;
  onPublish: () => void;
  onExport: () => Promise<{ success: boolean; error?: string }>;
  onTagDamage?: () => void;
  onSwapPhotos?: (slotA: string, slotB: string) => Promise<Vehicle | null>;
}

export default function PublishGate({ vehicle, onBack, onPublish, onExport, onTagDamage, onSwapPhotos }: PublishGateProps) {
  const readiness = computeWebReadiness(vehicle);
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState<string | null>(null);
  // Review state
  const [reviewed, setReviewed] = React.useState<Record<string, ReviewStatus>>({});
  const [activeSlot, setActiveSlot] = React.useState<string | null>(null);
  const [swapSource, setSwapSource] = React.useState<string | null>(null);

  const doExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      const r = await onExport();
      if (r && r.success === false) setExportErr(r.error || 'Export failed — try again.');
    } catch {
      setExportErr('Export failed — try again.');
    } finally {
      setExporting(false);
    }
  };

  const photos = vehicle?.photos || {};
  const slots = DEFAULT_TEMPLATE.slots;
  const filledSlots = slots.filter(s => !!photos[s.id]);
  const reviewedCount = filledSlots.filter(s => !!reviewed[s.id]).length;
  const allReviewed = filledSlots.length > 0 && reviewedCount === filledSlots.length;

  const exteriorSlots = slots.filter(s => s.tier === 'core' && s.id !== 'interior_cabin' && s.id !== 'odometer');
  const exteriorPresent = exteriorSlots.filter(s => !!photos[s.id]).length;
  const nonCore = slots.filter(s => s.tier !== 'core');
  const nonCoreTaken = nonCore.filter(s => !!photos[s.id]).length;

  const conditions: { label: string; met: boolean }[] = [
    {
      label: `${readiness.coreTaken} of ${readiness.coreTotal} core shots captured`,
      met: readiness.coreTotal > 0 && readiness.coreTaken === readiness.coreTotal,
    },
    {
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
      label: `${reviewedCount} of ${filledSlots.length} photos reviewed`,
      met: allReviewed,
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

  // Active review slot
  const activeSlotDef = activeSlot ? slots.find(s => s.id === activeSlot) : null;
  const activePhoto = activeSlot ? photos[activeSlot] : null;
  const filledSlotIds = filledSlots.map(s => s.id);
  const activeIndexInFilled = activeSlot ? filledSlotIds.indexOf(activeSlot) : -1;

  const markReview = (status: ReviewStatus) => {
    if (!activeSlot) return;
    setReviewed(prev => ({ ...prev, [activeSlot]: status }));
    // Auto-advance to next unreviewed photo
    const nextUnreviewed = filledSlotIds.find((id, i) => i > activeIndexInFilled && !reviewed[id] && id !== activeSlot);
    const anyUnreviewed = filledSlotIds.find(id => !reviewed[id] && id !== activeSlot);
    if (nextUnreviewed) {
      setActiveSlot(nextUnreviewed);
    } else if (anyUnreviewed) {
      setActiveSlot(anyUnreviewed);
    } else {
      setActiveSlot(null);
    }
  };

  const handleGridTap = (slotId: string) => {
    if (swapSource && swapSource !== slotId) {
      if (onSwapPhotos) {
        onSwapPhotos(swapSource, slotId).then(() => {
          setReviewed(prev => {
            const next = { ...prev };
            delete next[swapSource!];
            delete next[slotId];
            return next;
          });
        });
      }
      setSwapSource(null);
      return;
    }
    setSwapSource(null);
    if (photos[slotId]) {
      setActiveSlot(slotId);
    }
  };

  const navigateReview = (dir: -1 | 1) => {
    if (activeIndexInFilled < 0) return;
    const next = activeIndexInFilled + dir;
    if (next >= 0 && next < filledSlotIds.length) {
      setActiveSlot(filledSlotIds[next]);
    }
  };

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
          <div className="flex-1 min-w-0">
            <h1 className="text-[16px] font-semibold tracking-tight">Review &amp; publish</h1>
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-[13px] font-bold ${allReviewed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {reviewedCount}/{filledSlots.length} reviewed
            </div>
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

        {/* Swap mode banner */}
        {swapSource && (
          <div className="rounded-xl px-4 py-3 border border-amber-500/40 bg-amber-500/10 flex items-center gap-3">
            <ArrowLeftRight size={16} className="text-amber-400 shrink-0" />
            <p className="text-[13px] font-medium text-amber-300 flex-1">
              Tap another photo to swap with <strong>{slots.find(s => s.id === swapSource)?.name}</strong>
            </p>
            <button onClick={() => setSwapSource(null)} className="text-[12px] text-amber-400 underline">
              Cancel
            </button>
          </div>
        )}

        {/* Interactive photo grid */}
        <div>
          <p className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">
            Tap each photo to review · {filledSlots.length} uploaded
          </p>
          <div className="grid grid-cols-4 gap-2">
            {slots.map((slot) => {
              const photo = photos[slot.id];
              const status = reviewed[slot.id];
              const isSwapTarget = swapSource && swapSource !== slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleGridTap(slot.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                    swapSource === slot.id
                      ? 'border-amber-400 ring-2 ring-amber-400/40'
                      : isSwapTarget && photo
                        ? 'border-amber-500/40 hover:border-amber-400'
                        : photo
                          ? status
                            ? status === 'ok'
                              ? 'border-cyan-500/50'
                              : 'border-rose-500/50'
                            : 'border-[rgba(232,234,230,0.14)] hover:border-cyan-500/40'
                          : slot.tier === 'core'
                            ? 'border-rose-500/40 bg-rose-500/5'
                            : 'border-[rgba(232,234,230,0.08)] bg-[rgba(232,234,230,0.03)]'
                  }`}
                >
                  {photo ? (
                    <>
                      <img src={photo} alt={slot.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {status && (
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                          status === 'ok' ? 'bg-cyan-500' : 'bg-rose-500'
                        }`}>
                          {status === 'ok'
                            ? <Check size={12} className="text-white" strokeWidth={3} />
                            : <X size={12} className="text-white" strokeWidth={3} />
                          }
                        </div>
                      )}
                      {!status && (
                        <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 tl-attention-pulse" />
                      )}
                    </>
                  ) : (
                    <span className="text-[8px] text-[rgba(232,234,230,0.35)] flex items-center justify-center h-full px-0.5 text-center leading-tight">
                      {slot.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Review overlay */}
      {activeSlot && activeSlotDef && activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="shrink-0 px-4 py-3 flex items-center gap-3">
            <button onClick={() => setActiveSlot(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10">
              <X size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-semibold truncate">{activeSlotDef.name}</h2>
              <p className="text-[12px] text-[rgba(232,234,230,0.55)]">
                {activeIndexInFilled + 1} of {filledSlots.length} · {activeSlotDef.tier === 'core' ? 'Core shot' : 'Optional'}
              </p>
            </div>
            {reviewed[activeSlot] && (
              <div className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                reviewed[activeSlot] === 'ok' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {reviewed[activeSlot] === 'ok' ? '✓ OK' : '⚠ Damaged'}
              </div>
            )}
          </div>

          <div className="flex-1 relative min-h-0 flex items-center justify-center px-4">
            <img src={activePhoto} alt={activeSlotDef.name} className="max-w-full max-h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
            {activeIndexInFilled > 0 && (
              <button
                onClick={() => navigateReview(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {activeIndexInFilled < filledSlotIds.length - 1 && (
              <button
                onClick={() => navigateReview(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          <div className="shrink-0 p-4 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => markReview('ok')}
                className={`flex-1 min-h-[52px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 border transition-colors ${
                  reviewed[activeSlot] === 'ok'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-cyan-500/40'
                }`}
              >
                <Check size={16} strokeWidth={3} /> OK
              </button>
              <button
                type="button"
                onClick={() => markReview('damaged')}
                className={`flex-1 min-h-[52px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 border transition-colors ${
                  reviewed[activeSlot] === 'damaged'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-rose-500/40'
                }`}
              >
                <X size={16} strokeWidth={3} /> Damaged
              </button>
            </div>
            <div className="flex gap-2">
              {onTagDamage && (
                <button
                  type="button"
                  onClick={() => { setActiveSlot(null); onTagDamage(); }}
                  className="flex-1 min-h-[46px] rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[13px] font-semibold flex items-center justify-center gap-2"
                >
                  <Camera size={14} /> Tag damage
                </button>
              )}
              {onSwapPhotos && (
                <button
                  type="button"
                  onClick={() => { setSwapSource(activeSlot); setActiveSlot(null); }}
                  className="flex-1 min-h-[46px] rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 text-[13px] font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeftRight size={14} /> Swap
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95 space-y-2">
        <button
          type="button"
          disabled={!readiness.canPublishWeb || !allReviewed}
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
          disabled={!readiness.canExportDms || exporting || !allReviewed}
          onClick={doExport}
          className="w-full min-h-[52px] rounded-xl bg-[rgba(232,234,230,0.055)] border border-[rgba(232,234,230,0.14)] text-[#E8EAE6] text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Upload size={15} />{' '}
          {exporting
            ? 'Sending to DMS…'
            : (vehicle as any).lastDmsExportAt
            ? 'Re-Export to DMS'
            : 'Send to DMS'}
        </button>
        {!allReviewed && filledSlots.length > 0 && (
          <p className="text-[12px] text-amber-400 text-center">
            Review all {filledSlots.length} photos before publishing
          </p>
        )}
      </div>
    </div>
  );
}

