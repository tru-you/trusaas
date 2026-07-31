import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Upload } from 'lucide-react';
import { Vehicle } from '../types';
import {
  InspectionItem, InspectionCondition,
  TRADE_IN_ITEMS, createDefaultItems, getStatusOptions, needsReconCost,
  computeOverallRating,
} from '../types/inspection';

interface TradeInWalkAroundProps {
  vehicle: Vehicle;
  onBack: () => void;
  onComplete: (items: InspectionItem[]) => void;
  /** Store one photo under the given item id and resolve to its "/media/…" URL
   *  (null if it couldn't). Item ids are the same 27 slot ids the Inspect
   *  workflow uses, so this writes into the vehicle's shared `photos` store —
   *  a shot taken here shows up in Inspect too, and vice versa. */
  onUploadPhoto: (itemId: string, base64Image: string) => Promise<string | null>;
}

/** Read a File into a base64 data URL so it can be posted to the photo store. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TradeInWalkAround({ vehicle, onBack, onComplete, onUploadPhoto }: TradeInWalkAroundProps) {
  const [items, setItems] = React.useState<InspectionItem[]>(() => {
    const base: InspectionItem[] = vehicle.tradeInData?.items?.length
      ? JSON.parse(JSON.stringify(vehicle.tradeInData.items))
      : createDefaultItems();
    // Inspect and Trade-in share one 27-slot id vocabulary on purpose — if the
    // Inspect workflow already captured this angle, use it instead of making
    // the appraiser re-shoot it.
    return base.map((it) => {
      if (it.photoUrl) return it;
      const shared = vehicle.photos?.[it.id];
      return shared ? { ...it, photoUrl: shared, isCompleted: true } : it;
    });
  });
  const [currentStep, setCurrentStep] = React.useState(0);
  /** Item ids whose photo is still uploading — Continue waits for these. */
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const item = items[currentStep];
  const statusOptions = getStatusOptions(item.id);
  const totalRecon = items.reduce((s, i) => s + i.estimatedRepairCost, 0);
  const completedCount = items.filter((i) => i.isCompleted).length;

  const updateItem = (patch: Partial<InspectionItem>) => {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== currentStep) return it;
      const updated = { ...it, ...patch };
      if (patch.status !== undefined) {
        if (!needsReconCost(updated.status)) {
          updated.estimatedRepairCost = 0;
          updated.condition = 'Good';
        } else {
          updated.condition = 'Needs Recon';
        }
      }
      const hasPhoto = !!updated.photoUrl;
      const flagged = needsReconCost(updated.status);
      if (updated.id === 'odometer') {
        updated.isCompleted = hasPhoto;
      } else if (flagged) {
        updated.isCompleted = hasPhoto;
      } else {
        updated.isCompleted = true;
      }
      return updated;
    }));
  };

  /** Set photoUrl on a specific item by id (async-safe: the current step may
   *  change while an upload is in flight). */
  const setItemPhoto = (itemId: string, photoUrl: string) => {
    setItems((prev) => prev.map((it) =>
      it.id === itemId ? { ...it, photoUrl, isCompleted: true } : it
    ));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file still fires onChange.
    e.target.value = '';
    if (!file) return;

    const itemId = item.id;
    // Instant preview from a local blob URL — replaced by the stored URL below.
    const blobUrl = URL.createObjectURL(file);
    updateItem({ photoUrl: blobUrl, isCompleted: true });

    // Upload in the background; keep the URL (not base64) in state.
    setUploading((u) => ({ ...u, [itemId]: true }));
    try {
      const dataUrl = await fileToDataUrl(file);
      const ref = await onUploadPhoto(itemId, dataUrl);
      if (ref) {
        setItemPhoto(itemId, ref);
        URL.revokeObjectURL(blobUrl);
      }
      /* If the upload failed, the blob URL stays as a visible preview; App
         converts that lone shot to base64 on Continue so it is not lost. */
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next[itemId];
        return next;
      });
    }
  };

  const isUploading = Object.values(uploading).some(Boolean);

  const canSubmit = items.every((it) => {
    if (it.id === 'odometer') return !!it.photoUrl;
    if (needsReconCost(it.status)) return !!it.photoUrl;
    return true;
  });

  const categories = [
    { name: 'Front & Engine' as const, items: items.filter((i) => i.category === 'Front & Engine') },
    { name: 'Clockwise Exterior' as const, items: items.filter((i) => i.category === 'Clockwise Exterior') },
    { name: 'Interior, History & Verification' as const, items: items.filter((i) => i.category === 'Interior, History & Verification') },
  ];

  const categoryForStep = TRADE_IN_ITEMS[currentStep]?.category || '';

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass p-4 border-b border-cyan-500/20 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold tracking-tight">Trade-in appraisal</h1>
              <p className="text-[13px] text-neutral-400 truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[13px] font-medium text-[#E8EAE6]">{completedCount}/{items.length}</div>
            <div className="text-[13px] text-cyan-400 font-semibold">
              R {totalRecon.toLocaleString('en-ZA')} recon
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-neutral-800 rounded-full h-2">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>

        {/* Category label */}
        <p className="text-[12px] text-[rgba(232,234,230,0.55)] mt-2">{categoryForStep}</p>
      </div>

      {/* Current step card */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-[#E8EAE6]">
              Step {currentStep + 1}: {item.label}
            </h2>
            {item.isCompleted && (
              <CheckCircle2 size={20} className="text-[#4FE3DC] shrink-0" />
            )}
          </div>

          {/* Photo */}
          <div className="mb-4">
            {(() => {
              const photoRequired = item.id === 'odometer' || needsReconCost(item.status);
              return item.photoUrl ? (
                <div className="relative">
                  <img src={item.photoUrl} alt={item.label} className="w-full h-48 object-cover rounded-xl border border-neutral-700" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/70 text-[12px] text-cyan-300 border border-cyan-500/30"
                  >
                    Retake
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
                    photoRequired
                      ? 'border-rose-500/50 text-rose-400 hover:border-rose-400'
                      : 'border-neutral-700 text-neutral-500 hover:border-cyan-500/40 hover:text-cyan-300'
                  }`}
                >
                  <Camera size={32} />
                  <span className="text-[13px] font-semibold">
                    {photoRequired ? 'Photo required — a cost is entered' : 'Photo optional — tap to add'}
                  </span>
                </button>
              );
            })()}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* Status toggles */}
          <div className="mb-4">
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => {
                const active = item.status === opt.value;
                const isGood = opt.value === 'OK' || opt.value === 'PRESENT' || opt.value === 'VALID' || opt.value === 'FSH';
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateItem({ status: opt.value })}
                    className={`flex-1 min-w-[120px] min-h-[46px] rounded-lg text-[13px] font-medium border transition-colors ${
                      active
                        ? isGood
                          ? 'bg-cyan-500/10 border-cyan-500/55 text-cyan-300'
                          : 'bg-rose-500/12 border-rose-500/45 text-rose-300'
                        : 'bg-[rgba(232,234,230,0.055)] border-[rgba(232,234,230,0.14)] text-[rgba(232,234,230,0.55)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Condition */}
          <div className="mb-4">
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">Condition</p>
            <div className="flex gap-2">
              {(['Good', 'Fair', 'Poor', 'Needs Recon'] as InspectionCondition[]).map((c) => {
                const active = item.condition === c;
                const acceptable = c === 'Good' || c === 'Fair';
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateItem({ condition: c })}
                    className={`flex-1 min-h-[46px] rounded-lg text-[12px] font-medium border transition-colors ${
                      active
                        ? acceptable
                          ? 'bg-[#4FE3DC]/15 border-[#4FE3DC]/50 text-[#4FE3DC]'
                          : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recon cost */}
          <div>
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] mb-2">Estimated repair / replacement cost (R)</p>
            <input
              type="number"
              min={0}
              value={item.estimatedRepairCost || ''}
              onChange={(e) => updateItem({ estimatedRepairCost: Math.max(0, Number(e.target.value) || 0) })}
              placeholder="0"
              autoFocus={needsReconCost(item.status)}
              className={`w-full px-4 min-h-[46px] rounded-xl text-[15px] font-medium border focus:outline-none ${
                needsReconCost(item.status)
                  ? 'bg-red-950/30 border-red-500/50 text-red-200 placeholder-red-400/50 focus:border-red-400'
                  : 'bg-neutral-950/80 border-neutral-800 text-[#E8EAE6] placeholder-neutral-600 focus:border-cyan-500/40'
              }`}
            />
          </div>
        </div>

        {/* Step navigator (dots) */}
        <div className="mt-4 flex items-center gap-1 justify-center flex-wrap">
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className={`w-3 h-3 rounded-full transition-colors ${
                idx === currentStep
                  ? 'bg-cyan-400 ring-2 ring-cyan-400/30'
                  : it.isCompleted
                    ? 'bg-cyan-500/60'
                    : 'bg-neutral-700'
              }`}
              title={`${idx + 1}. ${it.label}`}
            />
          ))}
        </div>

      </div>

      {/* Bottom nav */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95 flex gap-2">
        <button
          type="button"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => s - 1)}
          className="flex-1 min-h-[52px] rounded-xl border border-[rgba(232,234,230,0.14)] text-[#E8EAE6] text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-30"
        >
          <ArrowLeft size={14} /> Prev
        </button>
        {currentStep < items.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((s) => s + 1)}
            className="flex-1 min-h-[52px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSubmit || isUploading}
            onClick={() => onComplete(items)}
            className="flex-1 min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[#E8EAE6] text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <CheckCircle2 size={14} /> {isUploading ? 'Saving photos…' : 'Continue to Valuation'}
          </button>
        )}
      </div>
    </div>
  );
}
