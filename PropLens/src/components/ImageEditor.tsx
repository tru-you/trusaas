import React from 'react';
import { ChevronLeft, Save, RotateCcw, Check, AlertTriangle, MinusCircle } from 'lucide-react';
import { Vehicle, QualityReport, PointResult } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

interface ImageEditorProps {
  vehicle: Vehicle;
  slotId: string;
  imageSrc: string;
  qualityReport: QualityReport;
  onBack: () => void;
  onSave: (processedImage: string, updatedReport: QualityReport, assessment: PointResult, closeups: string[]) => void;
}

export default function ImageEditor({
  vehicle,
  slotId,
  imageSrc,
  qualityReport,
  onBack,
  onSave,
}: ImageEditorProps) {
  const slot = DEFAULT_TEMPLATE.slots.find((s) => s.id === slotId);
  const existing = vehicle.slotAssessment?.[slotId];
  const [rating, setRating] = React.useState<PointResult['rating']>(existing?.rating);
  const [note, setNote] = React.useState(existing?.comment || '');
  const [rotation, setRotation] = React.useState(0);

  const save = async () => {
    const assessment: PointResult = { rating, comment: note.trim() || undefined };
    const finalImage = rotation === 0 ? imageSrc : await rotateDataUrl(imageSrc, rotation);
    onSave(finalImage, qualityReport, assessment, []);
  };

  const qualityBand = qualityReport.overallScore >= 80 ? 'text-emerald-600' :
    qualityReport.overallScore >= 60 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0A1420]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/[0.08]" aria-label="Retake">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[13px] font-bold tracking-wide text-[#4FE3DC] truncate">{slot?.name || 'Review shot'}</p>
          <p className="text-[13px] text-white/50">Assess condition & keep</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-[13px] font-bold ${qualityBand}`}>{qualityReport.overallScore}/100</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* The photo */}
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
          {/* Condition rating */}
          <div>
            <p className="text-[13px] text-[rgba(10,20,32,0.55)] font-bold mb-2">Condition of this part</p>
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
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700'
                          : tone === 'amber'
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-700'
                            : 'bg-rose-500/15 border-rose-500/50 text-rose-700'
                        : 'bg-white border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
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
            <p className="text-[13px] text-[rgba(10,20,32,0.55)] font-bold mb-2">Note</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you see — e.g. 15cm scratch, lower door"
              className="w-full px-3 py-3 bg-white border border-[rgba(10,20,32,0.10)] rounded-xl text-[13px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] focus:outline-none focus:border-[#0E9D98]/40"
            />
          </div>

          {/* Damage hint */}
          {rating === 'damage' && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2">
              <p className="text-[13px] text-rose-700 flex items-center gap-2">
                <AlertTriangle size={13} /> Damage tagger opens after you save this shot
              </p>
            </div>
          )}

          {/* Quality feedback */}
          <div className="rounded-xl border border-[rgba(10,20,32,0.10)] bg-white p-3">
            <p className="text-[13px] text-[rgba(10,20,32,0.55)] font-bold mb-2">Capture quality</p>
            <div className="flex gap-4 text-[13px]">
              <div>
                <span className="text-[rgba(10,20,32,0.55)]">Lighting</span>{' '}
                <span className={qualityReport.lightingCheck.status === 'Perfect' ? 'text-emerald-600' : qualityReport.lightingCheck.status === 'Fair' ? 'text-amber-600' : 'text-rose-600'}>
                  {qualityReport.lightingCheck.status}
                </span>
              </div>
              <div>
                <span className="text-[rgba(10,20,32,0.55)]">Angle</span>{' '}
                <span className={qualityReport.angleCheck.status === 'Perfect' ? 'text-emerald-600' : qualityReport.angleCheck.status === 'Good' ? 'text-amber-600' : 'text-rose-600'}>
                  {qualityReport.angleCheck.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-[rgba(10,20,32,0.10)] bg-white/95 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="py-3 rounded-xl bg-[#EFEDE8] border border-[rgba(10,20,32,0.10)] text-[#0A1420] text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> Rotate
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!rating}
          className={`py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 ${
            rating
              ? 'bg-[#0E9D98] hover:bg-[#0C8A85] text-white'
              : 'bg-[#EFEDE8] text-[rgba(10,20,32,0.35)] cursor-not-allowed'
          }`}
        >
          <Save size={15} /> {rating ? 'Keep & next' : 'Rate it first'}
        </button>
      </div>
    </div>
  );
}

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
