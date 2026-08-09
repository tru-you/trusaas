import React from 'react';
import { ChevronLeft, Save, RotateCcw, Check, AlertTriangle, MinusCircle, Camera, X } from 'lucide-react';
import { Vehicle, PointResult } from '../types';
import { usePropertySlots } from '../lib/usePropertySlots';

/**
 * Review & assess a shot the moment it's taken — this is where the condition
 * score and note happen, not in a sheet at the end. If there's damage, the
 * inspector says so and adds close-up photos of it right here.
 *
 * Everything saved is the real shot plus a person's judgement — no fabrication,
 * because it lands on a graded report.
 */
interface SlotReviewProps {
  vehicle: Vehicle;
  slotId: string;
  imageSrc: string;
  onBack: () => void;
  onSave: (mainImage: string, assessment: PointResult, closeups: string[]) => void;
  onNavigateSlot?: (slotId: string) => void;
}

export default function SlotReview({ vehicle, slotId, imageSrc, onBack, onSave, onNavigateSlot }: SlotReviewProps) {
  const slots = usePropertySlots(vehicle);
  const slot = slots.find((s) => s.id === slotId);
  const slotIndex = slots.findIndex((s) => s.id === slotId);
  const nextSlot = slots.find((s, i) => i > slotIndex && !vehicle.photos?.[s.id]);
  const capturedNeighbours = slots.filter((s) => !!vehicle.photos?.[s.id] && s.id !== slotId);
  const existing = vehicle.slotAssessment?.[slotId];
  const [rating, setRating] = React.useState<PointResult['rating']>(existing?.rating);
  const [note, setNote] = React.useState(existing?.comment || '');
  const [closeups, setCloseups] = React.useState<string[]>(vehicle.closeups?.[slotId] || []);
  const [rotation, setRotation] = React.useState(0);
  const closeupInputRef = React.useRef<HTMLInputElement | null>(null);
  const neighbourStripRef = React.useRef<HTMLDivElement | null>(null);

  const isDamage = rating === 'damage';

  const addCloseup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) setCloseups((prev) => [...prev, ev.target!.result as string]);
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    const assessment: PointResult = { rating, comment: note.trim() || undefined };
    const finalMain = rotation === 0 ? imageSrc : await rotateDataUrl(imageSrc, rotation);
    onSave(finalMain, assessment, isDamage ? closeups : []);
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0A1420]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[14px] font-semibold text-[#4FE3DC] truncate">{slot?.name || 'Review shot'}</p>
          <p className="text-[12px] text-white/50">Shot {slotIndex + 1} of {slots.length}</p>
        </div>
        <div className="w-11" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* The real photo */}
        <div className="photo-review bg-black flex items-center justify-center p-3 relative" style={{ minHeight: 200 }}>
          <img
            src={imageSrc}
            alt={slot?.name}
            style={{ transform: `rotate(${rotation}deg)` }}
            className="max-w-full max-h-[42vh] object-contain transition-transform"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white/80 border border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)] flex items-center justify-center"
            aria-label="Rotate"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Condition score */}
          <div>
            <p className="text-[12px] text-[rgba(10,20,32,0.50)] mb-2">Condition</p>
            <div className="flex gap-2">
              {([['ok', 'OK', Check], ['note', 'Note', MinusCircle], ['damage', 'Damage', AlertTriangle]] as const).map(([val, label, Icon]) => {
                const active = rating === val;
                const costsMoney = val === 'damage';
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRating(active ? undefined : val)}
                    className={`flex-1 min-h-[46px] rounded-xl text-[13px] border flex items-center justify-center gap-2 transition-colors ${
                      active
                        ? costsMoney
                          ? 'bg-rose-500/12 border-rose-500/45 text-rose-300 font-medium'
                          : 'bg-cyan-500/10 border-cyan-500/55 text-[#0E9D98] font-medium'
                        : 'bg-[rgba(10,20,32,0.04)] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.50)]'
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-[12px] text-[rgba(10,20,32,0.50)] mb-2">Note</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you see — e.g. 15cm scratch, lower door"
              className="w-full px-3 min-h-[46px] bg-[#F0F4F8] border border-[rgba(10,20,32,0.10)] rounded-xl text-[14px] text-[#0A1420] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {/* Damage → close-ups */}
          {isDamage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-3">
              <p className="text-[13px] font-semibold text-rose-300 flex items-center gap-2">
                <AlertTriangle size={13} /> Add a close-up of the damage
              </p>
              <div className="flex flex-wrap gap-2">
                {closeups.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`close-up ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-neutral-700" />
                    <button
                      type="button"
                      onClick={() => setCloseups((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#F0F4F8] border border-neutral-700 flex items-center justify-center text-[rgba(10,20,32,0.72)]"
                      aria-label="Remove close-up"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => closeupInputRef.current?.click()}
                  className="w-16 min-h-[64px] rounded-lg border-2 border-dashed border-rose-500/40 text-rose-300 flex flex-col items-center justify-center gap-0.5"
                >
                  <Camera size={16} />
                  <span className="text-[12px] font-medium">Close-up</span>
                </button>
              </div>
              <input
                ref={closeupInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={addCloseup}
              />
            </div>
          )}
          {/* Up next */}
          {nextSlot && (
            <div className="flex items-center gap-2 rounded-xl bg-[rgba(10,20,32,0.04)] border border-[rgba(10,20,32,0.10)] px-3.5 py-2.5">
              <span className="text-[12px] text-[rgba(10,20,32,0.50)]">Up next</span>
              <span className="text-[13px] font-medium text-[#0A1420] truncate">{nextSlot.name}</span>
            </div>
          )}

          {/* Neighbour thumbnails */}
          {capturedNeighbours.length > 0 && onNavigateSlot && (
            <div>
              <p className="text-[12px] text-[rgba(10,20,32,0.50)] mb-2">Captured shots</p>
              <div ref={neighbourStripRef} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {capturedNeighbours.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onNavigateSlot(s.id)}
                    className="shrink-0 w-[60px] rounded-lg overflow-hidden border border-[rgba(10,20,32,0.10)] hover:border-cyan-500/40 transition-colors"
                  >
                    <img src={vehicle.photos![s.id]} alt={s.name} className="w-full h-[44px] object-cover" referrerPolicy="no-referrer" />
                    <p className="text-[10px] text-[rgba(10,20,32,0.50)] px-1 py-0.5 truncate text-center">{s.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]/95 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 min-h-[56px] rounded-xl bg-[rgba(10,20,32,0.04)] border border-[rgba(10,20,32,0.10)] text-[#0A1420] text-[14px] font-medium flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> Retake
        </button>
        <button
          type="button"
          onClick={save}
          className="flex-[1.3] min-h-[56px] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500"
        >
          <Save size={15} /> Keep & next
        </button>
      </div>
    </div>
  );
}

/** Re-encode an image data URL rotated by 90/180/270°, preserving its pixels. */
function rotateDataUrl(src: string, deg: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const swap = deg === 90 || deg === 270;
      canvas.width = swap ? img.naturalHeight : img.naturalWidth;
      canvas.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
