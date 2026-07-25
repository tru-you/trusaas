import React from 'react';
import { ArrowLeft, Save, ClipboardCheck, Camera, AlertTriangle, Check, MinusCircle } from 'lucide-react';
import { Vehicle, PointResult, INSPECTION_POINTS } from '../types';

/**
 * The inspection sheet — every part of the car gets a place to rate condition,
 * check that it works, and comment. Damage on a part is tagged on its real
 * photo in the damage tagger (reachable from the top button and per point).
 *
 * The report is graded only from what's entered here plus tagged damage — no
 * black-box scoring.
 */
interface InspectionSheetProps {
  vehicle: Vehicle;
  onBack: () => void;
  onSave: (points: Record<string, PointResult>) => Promise<void> | void;
  onTagDamage: () => void;
}

const GROUP_ORDER = [
  'Exterior', 'Glass & lights', 'Wheels & tyres', 'Interior', 'Engine & underbody', 'Identity & documents',
];

export default function InspectionSheet({ vehicle, onBack, onSave, onTagDamage }: InspectionSheetProps) {
  const [points, setPoints] = React.useState<Record<string, PointResult>>(
    () => JSON.parse(JSON.stringify(vehicle.inspectionPoints || {})),
  );
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);

  const set = (id: string, patch: Partial<PointResult>) =>
    setPoints((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const answered = INSPECTION_POINTS.filter((p) => {
    const r = points[p.id];
    return p.kind === 'condition' ? !!r?.rating : !!r?.works;
  }).length;

  // Anything the buyer must be told about.
  const flagged = INSPECTION_POINTS.filter((p) => {
    const r = points[p.id];
    return r?.rating === 'damage' || r?.rating === 'note' || r?.works === 'no';
  }).length;

  // Damage tags per slot, so a point with a photo can show its count.
  const tagCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const [slot, list] of Object.entries(vehicle.damageFindings || {})) m[slot] = list.length;
    return m;
  }, [vehicle.damageFindings]);

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: INSPECTION_POINTS.filter((p) => p.group === g),
  }));

  const handleSave = async (thenBack: boolean) => {
    setSaving(true);
    try {
      await onSave(points);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      if (thenBack) onBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-[#E8EAE6] overflow-hidden">
      {/* Header */}
      <div className="tl-glass p-4 border-b border-cyan-500/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => handleSave(true)} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
              <ClipboardCheck size={15} className="text-cyan-400" /> Inspection
            </h1>
            <p className="text-[13px] text-neutral-400 truncate">
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.stockNumber}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-bold text-neutral-300">{answered}/{INSPECTION_POINTS.length} done</div>
          <div className={`text-[13px] font-bold ${flagged ? 'text-amber-400' : 'text-emerald-400'}`}>
            {flagged ? `${flagged} to disclose` : 'Nothing flagged'}
          </div>
        </div>
      </div>

      {/* Tag-on-photo shortcut */}
      <button
        type="button"
        onClick={onTagDamage}
        className="mx-4 mt-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[13px] font-semibold flex items-center justify-center gap-2"
      >
        <Camera size={15} /> Tag damage on the photos
      </button>

      {/* Points */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <h2 className="text-[13px] font-semibold tracking-[0.15em] text-cyan-400 mb-2">{group}</h2>
            <div className="space-y-2">
              {items.map((p) => {
                const r = points[p.id] || {};
                const isFlagged = r.rating === 'damage' || r.rating === 'note' || r.works === 'no';
                const tags = p.photoSlotId ? (tagCounts[p.photoSlotId] || 0) : 0;
                const hasPhoto = !!(p.photoSlotId && vehicle.photos?.[p.photoSlotId]);
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-3 ${isFlagged ? 'bg-amber-950/25 border-amber-500/40' : 'bg-neutral-900/70 border-neutral-800'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-neutral-100 leading-snug">{p.name}</p>
                        {p.hint && <p className="text-[12px] text-neutral-500 mt-0.5">{p.hint}</p>}
                      </div>
                      {hasPhoto && (
                        <img src={vehicle.photos[p.photoSlotId!]} alt="" className="w-10 h-8 rounded object-cover border border-neutral-800 shrink-0" />
                      )}
                    </div>

                    {/* Condition rating OR works check */}
                    {p.kind === 'condition' ? (
                      <div className="flex gap-1.5 mt-2.5">
                        {([['ok', 'OK', 'emerald'], ['note', 'Note', 'amber'], ['damage', 'Damage', 'rose']] as const).map(([val, label, tone]) => {
                          const active = r.rating === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => set(p.id, { rating: val })}
                              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-semibold border transition-colors ${
                                active
                                  ? tone === 'emerald'
                                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                    : tone === 'amber'
                                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                      : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex gap-1.5 mt-2.5">
                        {([['yes', 'Works', Check], ['no', 'Faulty', AlertTriangle], ['na', 'N/A', MinusCircle]] as const).map(([val, label, Icon]) => {
                          const active = r.works === val;
                          const faulty = val === 'no';
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => set(p.id, { works: val })}
                              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                                active
                                  ? faulty
                                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                                    : val === 'yes'
                                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                      : 'bg-neutral-700/40 border-neutral-600 text-neutral-300'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                              }`}
                            >
                              <Icon size={14} /> {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Comment */}
                    <input
                      type="text"
                      value={r.comment || ''}
                      onChange={(e) => set(p.id, { comment: e.target.value })}
                      placeholder="Comment (what / where / detail)…"
                      className="mt-2 w-full px-3 py-2 bg-neutral-950/80 border border-neutral-800 rounded-lg text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-cyan-500/40"
                    />

                    {/* Damage tag indicator for points with a photo */}
                    {p.photoSlotId && (
                      <button
                        type="button"
                        onClick={onTagDamage}
                        disabled={!hasPhoto}
                        className="mt-2 min-h-[36px] text-[12px] text-neutral-500 hover:text-cyan-300 disabled:hover:text-neutral-500 disabled:cursor-default flex items-center gap-1.5"
                      >
                        <Camera size={13} />
                        {hasPhoto
                          ? tags > 0 ? `${tags} damage tag${tags === 1 ? '' : 's'} on this photo` : 'Tag damage on this photo'
                          : 'No photo yet — capture it to tag damage'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save bar */}
      <div className="shrink-0 p-3 border-t border-neutral-900 bg-neutral-950/95">
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? 'Saving…' : savedFlash ? 'Saved ✓' : 'Save inspection'}
        </button>
      </div>
    </div>
  );
}
