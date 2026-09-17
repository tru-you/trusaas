import React from 'react';
import { Check, X, ArrowLeft, Globe, Upload, Camera, ArrowLeftRight, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
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
  onDeletePhoto?: (slotId: string) => Promise<Vehicle | null>;
  onUploadPhoto?: (slotId: string, base64Image: string) => Promise<Vehicle | null>;
  onVehicleUpdated?: (vehicle: Vehicle) => Promise<void> | void;
}

export default function PublishGate({ vehicle, onBack, onPublish, onExport, onTagDamage, onSwapPhotos, onDeletePhoto, onUploadPhoto, onVehicleUpdated }: PublishGateProps) {
  const readiness = computeWebReadiness(vehicle);
  const [exporting, setExporting] = React.useState(false);
  const [exportErr, setExportErr] = React.useState<string | null>(null);
  // Review state — initialized from vehicle's saved slotAssessments
  const [reviewed, setReviewed] = React.useState<Record<string, ReviewStatus>>(() => {
    const init: Record<string, ReviewStatus> = {};
    if (vehicle.slotAssessment) {
      for (const [slot, point] of Object.entries(vehicle.slotAssessment)) {
        if (point?.rating === 'damage') {
          init[slot] = 'damaged';
        } else if (point?.rating === 'ok') {
          init[slot] = 'ok';
        }
      }
    }
    return init;
  });
  const [activeSlot, setActiveSlot] = React.useState<string | null>(null);
  const [swapSource, setSwapSource] = React.useState<string | null>(null);
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});
  const [deletingSlot, setDeletingSlot] = React.useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = React.useState<string | null>(null);
  const [targetUploadSlot, setTargetUploadSlot] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxDim = 1920, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const slotId = targetUploadSlot || activeSlot;
    if (!file || !slotId || !onUploadPhoto) return;
    setUploadingSlot(slotId);
    try {
      const base64 = await compressImage(file);
      await onUploadPhoto(slotId, base64);
      setImageErrors(prev => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setReviewed(prev => ({ ...prev, [slotId]: 'ok' }));
    } catch (err) {
      console.error('Failed to upload replacement photo:', err);
      alert('Photo upload failed. Please check image format and try again.');
    } finally {
      setUploadingSlot(null);
      setTargetUploadSlot(null);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!onDeletePhoto) return;
    const slotDef = slots.find(s => s.id === slotId);
    const label = slotDef ? slotDef.name : slotId;
    if (!window.confirm(`Delete photo for "${label}"?`)) return;
    setDeletingSlot(slotId);
    try {
      await onDeletePhoto(slotId);
      setReviewed(prev => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setImageErrors(prev => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      if (activeSlot === slotId) {
        setActiveSlot(null);
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
    } finally {
      setDeletingSlot(null);
    }
  };

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
    const currentSlot = activeSlot;
    setReviewed(prev => ({ ...prev, [currentSlot]: status }));

    // Persist to vehicle.slotAssessment so reviewed status survives unmount / refresh
    const nextSlotAss = {
      ...(vehicle.slotAssessment || {}),
      [currentSlot]: {
        rating: status === 'damaged' ? ('damage' as const) : ('ok' as const),
      },
    };
    onVehicleUpdated?.({
      ...vehicle,
      slotAssessment: nextSlotAss,
    });

    // Auto-advance to next unreviewed photo
    const nextUnreviewed = filledSlotIds.find((id, i) => i > activeIndexInFilled && !reviewed[id] && id !== currentSlot);
    const anyUnreviewed = filledSlotIds.find(id => !reviewed[id] && id !== currentSlot);
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
    } else {
      // Direct file upload to empty slot
      setTargetUploadSlot(slotId);
      fileInputRef.current?.click();
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
        {/* 1-10 Condition VIR Score Selector */}
        <div className="rounded-xl p-4 border border-white/10 bg-white/[0.03] space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-[rgba(232,234,230,0.55)] uppercase tracking-wider">
                Overall Condition (VIR Rating)
              </span>
              <p className="text-[13px] font-medium text-[#E8EAE6] mt-0.5">
                {vehicle.vir ? `VIR ${vehicle.vir}/100 Rating` : "Select vehicle condition"}
              </p>
            </div>
            <span className="text-[14px] font-mono font-bold text-cyan-400">
              {vehicle.vir ? `${Math.round(vehicle.vir / 10)}/10` : "Not set"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const currentScore = vehicle.vir != null ? Math.round(vehicle.vir / 10) : null;
              const isSelected = currentScore === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    const newVir = num * 10;
                    onVehicleUpdated?.({
                      ...vehicle,
                      vir: newVir,
                    });
                  }}
                  className={`flex-1 min-w-[30px] h-8 rounded-lg text-[13px] font-semibold font-mono flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500 text-neutral-950 shadow-sm"
                      : "bg-white/5 border border-white/10 text-neutral-300 hover:border-cyan-400/50 hover:text-white"
                  }`}
                  title={`Condition ${num}/10 (VIR ${num * 10})`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-[rgba(232,234,230,0.55)]">
            Score out of 10 for showroom display (e.g. 8 = VIR 80 on website, 10 = VIR 100).
          </p>
        </div>

        {/* Friendly Photo Guidance Note */}
        <div className="rounded-xl px-4 py-3 border border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${filledSlots.length >= 10 ? 'bg-cyan-400' : filledSlots.length >= 6 ? 'bg-amber-400' : 'bg-neutral-500'}`} />
            <p className="text-[13px] text-[#E8EAE6] truncate">
              {filledSlots.length >= 10
                ? `${filledSlots.length} photos captured · Ideal showroom pack`
                : filledSlots.length >= 6
                ? `${filledSlots.length} photos · Web-ready (10 photos recommended)`
                : `${filledSlots.length} photos · Capture at least 6 for web listing`}
            </p>
          </div>
          <span className="text-[12px] font-mono text-cyan-400 shrink-0">
            {filledSlots.length}/10
          </span>
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-[rgba(232,234,230,0.55)]">
              Tap a photo to review / delete · Tap empty slot to add
            </p>
            <span className="text-[12px] font-medium text-cyan-400">
              {filledSlots.length} of {slots.length} filled
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {slots.map((slot) => {
              const photo = photos[slot.id];
              const status = reviewed[slot.id];
              const isSwapTarget = swapSource && swapSource !== slot.id;
              const hasError = imageErrors[slot.id];
              const isUploadingThis = uploadingSlot === slot.id;
              const isDeletingThis = deletingSlot === slot.id;

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleGridTap(slot.id)}
                  title={photo ? (hasError ? `${slot.name} (Missing image - Tap to replace or delete)` : `Review ${slot.name}`) : `Add photo for ${slot.name}`}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                    swapSource === slot.id
                      ? 'border-amber-400 ring-2 ring-amber-400/40'
                      : isSwapTarget && photo
                        ? 'border-amber-500/40 hover:border-amber-400'
                        : hasError
                          ? 'border-neutral-700 bg-neutral-900/50'
                          : photo
                            ? status
                              ? status === 'ok'
                                ? 'border-cyan-500/50'
                                : 'border-amber-500/50'
                              : 'border-[rgba(232,234,230,0.14)] hover:border-cyan-500/40'
                            : 'border-[rgba(232,234,230,0.08)] bg-[rgba(232,234,230,0.03)] hover:border-cyan-400/60'
                  }`}
                >
                  {isUploadingThis ? (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-cyan-300">
                      <RefreshCw size={16} className="animate-spin" />
                      <span className="text-[9px]">Uploading…</span>
                    </div>
                  ) : isDeletingThis ? (
                    <div className="flex flex-col items-center justify-center h-full gap-1 text-rose-300">
                      <RefreshCw size={16} className="animate-spin" />
                      <span className="text-[9px]">Deleting…</span>
                    </div>
                  ) : photo ? (
                    <>
                      {hasError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1 bg-red-950/40 text-center">
                          <AlertTriangle size={16} className="text-red-400 mb-0.5" />
                          <span className="text-[8px] font-bold text-red-300 leading-none">Missing</span>
                          <span className="text-[7px] text-red-400/80 leading-tight mt-0.5 truncate max-w-full px-0.5">{slot.name}</span>
                        </div>
                      ) : (
                        <img 
                          src={photo} 
                          alt={slot.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          onError={() => setImageErrors(prev => ({ ...prev, [slot.id]: true }))}
                        />
                      )}
                      {status && !hasError && (
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                          status === 'ok' ? 'bg-cyan-500' : 'bg-rose-500'
                        }`}>
                          {status === 'ok'
                            ? <Check size={12} className="text-white" strokeWidth={3} />
                            : <X size={12} className="text-white" strokeWidth={3} />
                          }
                        </div>
                      )}
                      {!status && !hasError && (
                        <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 tl-attention-pulse" />
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-1 text-center group">
                      <Plus size={14} className="text-[rgba(232,234,230,0.35)] group-hover:text-cyan-400 mb-0.5 transition-colors" />
                      <span className="text-[8px] text-[rgba(232,234,230,0.45)] group-hover:text-white leading-tight line-clamp-2 transition-colors">
                        {slot.name}
                      </span>
                    </div>
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
            {reviewed[activeSlot] && !imageErrors[activeSlot] && (
              <div className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                reviewed[activeSlot] === 'ok' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {reviewed[activeSlot] === 'ok' ? '✓ OK' : '⚠ Damaged'}
              </div>
            )}
          </div>

          <div className="flex-1 relative min-h-0 flex items-center justify-center px-4">
            {imageErrors[activeSlot] ? (
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm rounded-2xl bg-red-950/40 border border-red-500/40 shadow-xl">
                <AlertTriangle size={40} className="text-red-400 mb-2" />
                <h3 className="text-[16px] font-bold text-red-200">Photo Missing from Server (404)</h3>
                <p className="text-[13px] text-red-300/80 mt-1 mb-4 leading-relaxed">
                  The image file for <strong>{activeSlotDef.name}</strong> was not found on the server. You can upload a new photo or delete this slot reference.
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetUploadSlot(activeSlot);
                      fileInputRef.current?.click();
                    }}
                    className="btn-primary on-fill flex-1 py-3 text-[14px] flex items-center justify-center gap-2"
                  >
                    <Upload size={16} /> Replace photo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(activeSlot)}
                    disabled={deletingSlot === activeSlot}
                    className="py-3 px-4 rounded-xl bg-red-900/50 border border-red-500/50 text-red-200 hover:bg-red-900/70 text-[14px] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <img 
                src={activePhoto} 
                alt={activeSlotDef.name} 
                className="max-w-full max-h-full object-contain rounded-xl" 
                referrerPolicy="no-referrer" 
                onError={() => setImageErrors(prev => ({ ...prev, [activeSlot]: true }))}
              />
            )}
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
            <div className="grid grid-cols-4 gap-2">
              {onTagDamage && (
                <button
                  type="button"
                  onClick={() => { setActiveSlot(null); onTagDamage(); }}
                  className="min-h-[46px] rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[12px] font-semibold flex items-center justify-center gap-1.5"
                  title="Tag damage on this photo"
                >
                  <Camera size={14} /> Damage
                </button>
              )}
              {onSwapPhotos && (
                <button
                  type="button"
                  onClick={() => { setSwapSource(activeSlot); setActiveSlot(null); }}
                  className="min-h-[46px] rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 text-[12px] font-semibold flex items-center justify-center gap-1.5"
                  title="Swap with another slot"
                >
                  <ArrowLeftRight size={14} /> Swap
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setTargetUploadSlot(activeSlot);
                  fileInputRef.current?.click();
                }}
                disabled={uploadingSlot === activeSlot}
                className="min-h-[46px] rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/50 text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Replace photo with another image"
              >
                {uploadingSlot === activeSlot ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                Replace
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSlot(activeSlot)}
                disabled={deletingSlot === activeSlot}
                className="min-h-[46px] rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 hover:bg-red-950/50 text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Delete photo from this slot"
              >
                {deletingSlot === activeSlot ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for slot uploads/replacements */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

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

