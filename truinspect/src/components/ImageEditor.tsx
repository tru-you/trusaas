import React from 'react';
import { ChevronLeft, Save, RotateCcw, Check } from 'lucide-react';
import { Vehicle, QualityReport } from '../types';

interface ImageEditorProps {
  vehicle: Vehicle;
  slotId: string;
  imageSrc: string;
  qualityReport: QualityReport;
  onBack: () => void;
  onSave: (processedImage: string, updatedReport: QualityReport) => void;
}

/**
 * Review the shot — keep it or retake it. Nothing else.
 *
 * This is a graded inspection report, so a photo on it must be exactly what the
 * camera saw. We deliberately do NOT composite studio backgrounds, cut the car
 * out, "enhance" exposure, or auto-write listing copy — all of that would put
 * something on the record that isn't the real vehicle. Rotate is the only
 * change offered, because orientation doesn't alter what's shown.
 */
export default function ImageEditor({
  slotId,
  imageSrc,
  qualityReport,
  onBack,
  onSave,
}: ImageEditorProps) {
  const [rotation, setRotation] = React.useState(0); // 0 | 90 | 180 | 270

  const rotate = () => setRotation((r) => (r + 90) % 360);

  const save = async () => {
    if (rotation === 0) {
      onSave(imageSrc, qualityReport); // untouched original
      return;
    }
    // Apply only the rotation, re-encode, keep everything else as shot.
    const out = await rotateDataUrl(imageSrc, rotation);
    onSave(out, qualityReport);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      <div className="bg-neutral-950 px-4 py-3 flex items-center justify-between border-b border-neutral-850 shrink-0">
        <button onClick={onBack} className="p-1 rounded-full hover:bg-neutral-800 text-neutral-300" aria-label="Retake">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-[13px] font-bold tracking-wide text-cyan-400">Review shot</p>
          <p className="text-[12px] text-neutral-400">Keep it or retake — nothing is altered</p>
        </div>
        <button
          type="button"
          onClick={save}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-[13px] font-semibold text-[#06080D] flex items-center gap-1"
        >
          <Check size={13} /> Keep
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black overflow-hidden p-3">
        <img
          src={imageSrc}
          alt={slotId}
          style={{ transform: `rotate(${rotation}deg)` }}
          className="max-w-full max-h-full object-contain transition-transform"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={rotate}
          className="py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> Rotate
        </button>
        <button
          type="button"
          onClick={save}
          className="py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          <Save size={15} /> Keep &amp; next
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
