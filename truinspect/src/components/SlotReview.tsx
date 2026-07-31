import React from 'react';
import { ChevronLeft, Save, RotateCcw, Check, AlertTriangle, MinusCircle, Camera, X } from 'lucide-react';
import { Vehicle, PointResult } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

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
}

export default function SlotReview({ vehicle, slotId, imageSrc, onBack, onSave }: SlotReviewProps) {
  const slot = DEFAULT_TEMPLATE.slots.find((s) => s.id === slotId);
  const existing = vehicle.slotAssessment?.[slotId];
  const [rating, setRating] = React.useState<PointResult['rating']>(existing?.rating);
  const [note, setNote] = React.useState(existing?.comment || '');
  const [closeups, setCloseups] = React.useState<string[]>(vehicle.closeups?.[slotId] || []);
  const [rotation, setRotation] = React.useState(0);
  const closeupInputRef = React.useRef<HTMLInputElement | null>(null);

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
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-950 px-4 py-3 flex items-center justify-between border-b border-neutral-850 shrink-0">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-300" aria-label="Retake">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[13px] font-bold tracking-wide text-cyan-400 truncate">{slot?.name || 'Review shot'}</p>
          <p className="text-[13px] text-neutral-400">Assess it now — condition & note</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* The real photo */}
        <div className="photo-review bg-black flex items-center justify-center p-3" style={{ minHeight: 200 }}>
          <img
            src={imageSrc}
            alt={slot?.name}
            style={{ transform: `rotate(${rotation}deg)` }}
            className="max-w-full max-h-[42vh] object-contain transition-transform"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="p-4 space-y-4">
          {/* Condition score */}
          <div>
            <p className="text-[13px] text-neutral-500 font-bold mb-2">Condition of this part</p>
            <div className="flex gap-2">
              {([['ok', 'OK', Check, 'emerald'], ['note', 'Note', MinusCircle, 'amber'], ['damage', 'Damage', AlertTriangle, 'rose']] as const).map(([val, label, Icon, tone]) => {
                const active = rating === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRating(val)}
                    className={`flex-1 py-3 rounded-xl text-[13px] font-semibold border flex items-center justify-center gap-2 transition-colors ${
                      active
                        ? tone === 'emerald'
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                          : tone === 'amber'
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                            : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400'
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
            <p className="text-[13px] text-neutral-500 font-bold mb-2">Note</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you see — e.g. 15cm scratch, lower door"
              className="w-full px-3 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
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
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-300"
                      aria-label="Remove close-up"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => closeupInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-rose-500/40 text-rose-300 flex flex-col items-center justify-center gap-0.5"
                >
                  <Camera size={16} />
                  <span className="text-[13px] font-bold">Close-up</span>
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
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> Rotate
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!rating}
          className={`py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 ${
            rating
              ? 'bg-cyan-600 hover:bg-cyan-500 text-[#06080D]'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
          }`}
        >
          <Save size={15} /> {rating ? 'Keep & next' : 'Rate it first'}
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
