import React from 'react';
import { ArrowLeft, Save, ClipboardCheck, Camera, AlertTriangle, Check, MinusCircle, FileCheck } from 'lucide-react';
import { Vehicle, PointResult, ComplianceCert } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { COMPLIANCE_CERTS } from '../template';

/**
 * The inspection sheet — every area of the property gets a place to rate
 * condition, check compliance, and comment. Damage is tagged on the real
 * photo in the damage tagger (reachable from the top button and per point).
 *
 * The report is graded only from what's entered here plus tagged damage — no
 * black-box scoring.
 */
interface InspectionSheetProps {
  vehicle: Vehicle;
  onBack: () => void;
  onSave: (points: Record<string, PointResult>, certs?: Record<string, ComplianceCert>) => Promise<void> | void;
  onTagDamage: () => void;
  onGenerateReport?: () => void;
}

export default function InspectionSheet({ vehicle, onBack, onSave, onTagDamage, onGenerateReport }: InspectionSheetProps) {
  const [points, setPoints] = React.useState<Record<string, PointResult>>(
    () => JSON.parse(JSON.stringify(vehicle.inspectionPoints || {})),
  );
  const [certs, setCerts] = React.useState<Record<string, ComplianceCert>>(
    () => JSON.parse(JSON.stringify(vehicle.complianceCerts || {})),
  );
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);

  const showCompliance = vehicle.inspectionPurpose === 'sale' || vehicle.inspectionPurpose === 'new_build';
  const applicableCerts = COMPLIANCE_CERTS.filter(c =>
    c.requiredFor.includes(vehicle.inspectionPurpose as 'sale' | 'new_build')
  );

  const set = (id: string, patch: Partial<PointResult>) =>
    setPoints((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const checklistPoints = DEFAULT_TEMPLATE.checklistPoints || [];

  const isAnswered = (p: typeof checklistPoints[0]) => {
    const r = points[p.id];
    return p.kind === 'condition' ? !!r?.rating : !!r?.works;
  };
  const answered = checklistPoints.filter(isAnswered).length;

  const flagged = checklistPoints.filter((p) => {
    const r = points[p.id];
    return r?.rating === 'damage' || r?.rating === 'note' || r?.works === 'no';
  }).length;

  const unanswered = checklistPoints.length - answered;

  const markRemainingOk = () => {
    setPoints((prev) => {
      const next = { ...prev };
      for (const p of checklistPoints) {
        if (isAnswered(p)) continue;
        if (p.kind === 'condition') {
          next[p.id] = { ...next[p.id], rating: 'ok' };
        } else {
          next[p.id] = { ...next[p.id], works: 'yes' };
        }
      }
      return next;
    });
  };

  // Damage tags per slot, so a point with a photo can show its count.
  const tagCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const [slot, list] of Object.entries(vehicle.damageFindings || {})) m[slot] = list.length;
    return m;
  }, [vehicle.damageFindings]);

  const grouped = (DEFAULT_TEMPLATE.checklistGroups || []).map((g) => ({
    group: g.name,
    items: checklistPoints.filter((p) => p.group === g.id),
  }));

  const handleSave = async (thenBack: boolean) => {
    setSaving(true);
    try {
      await onSave(points, showCompliance ? certs : undefined);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      if (thenBack) onBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0A1420]/80 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => handleSave(true)} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold tracking-tight flex items-center gap-2 text-white">
              <ClipboardCheck size={15} className="text-[#4FE3DC]" /> Inspection
            </h1>
            <p className="text-[13px] text-white/50 truncate">
              {vehicle.propertyType} — {vehicle.suburb} · {vehicle.listingRef}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-bold text-white/70">{answered}/{checklistPoints.length} done</div>
          <div className={`text-[13px] font-bold ${flagged ? 'text-amber-400' : 'text-emerald-400'}`}>
            {flagged ? `${flagged} to disclose` : 'Nothing flagged'}
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="mx-4 mt-3 flex gap-2">
        <button
          type="button"
          onClick={onTagDamage}
          className="flex-1 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[#0E9D98] text-[13px] font-semibold flex items-center justify-center gap-2"
        >
          <Camera size={15} /> Tag damage
        </button>
        {unanswered > 0 && (
          <button
            type="button"
            onClick={markRemainingOk}
            className="flex-1 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[13px] font-semibold flex items-center justify-center gap-2"
          >
            <Check size={15} /> All OK ({unanswered})
          </button>
        )}
      </div>

      {/* Points */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <h2 className="text-[13px] font-medium text-[rgba(10,20,32,0.50)] mb-2">{group}</h2>
            <div className="space-y-2">
              {items.map((p) => {
                const r = points[p.id] || {};
                const isFlagged = r.rating === 'damage' || r.rating === 'note' || r.works === 'no';
                const tags = p.photoSlotId ? (tagCounts[p.photoSlotId] || 0) : 0;
                const hasPhoto = !!(p.photoSlotId && vehicle.photos?.[p.photoSlotId]);
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-3 ${isFlagged ? 'bg-amber-50 border-amber-500/40' : 'bg-[#EFEDE8] border-[rgba(10,20,32,0.10)]'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#0A1420] leading-snug">{p.name}</p>
                        {p.hint && <p className="text-[13px] text-[rgba(10,20,32,0.45)] mt-0.5">{p.hint}</p>}
                      </div>
                      {hasPhoto && (
                        <img src={vehicle.photos[p.photoSlotId!]} alt="" className="w-10 h-8 rounded object-cover border border-[rgba(10,20,32,0.10)] shrink-0" />
                      )}
                    </div>

                    {/* Rating buttons — shape depends on the point's kind */}
                    {p.kind === 'condition' ? (
                      <div className="flex gap-2 mt-3">
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
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                                    : tone === 'amber'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                                      : 'bg-rose-500/15 border-rose-500/40 text-rose-600'
                                  : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : p.kind === 'presence' ? (
                      <div className="flex gap-2 mt-3">
                        {([['yes', 'Present', Check], ['no', 'Not Present', AlertTriangle]] as const).map(([val, label, Icon]) => {
                          const active = r.works === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => set(p.id, { works: val })}
                              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-semibold border flex items-center justify-center gap-2 transition-colors ${
                                active
                                  ? val === 'yes'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                                    : 'bg-rose-500/15 border-rose-500/40 text-rose-600'
                                  : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                              }`}
                            >
                              <Icon size={14} /> {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : p.kind === 'compliance' ? (
                      <div className="flex gap-2 mt-3">
                        {([['yes', 'Yes'], ['na', 'Partial'], ['no', 'No']] as const).map(([val, label]) => {
                          const active = r.works === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => set(p.id, { works: val })}
                              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-semibold border transition-colors ${
                                active
                                  ? val === 'yes'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                                    : val === 'na'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                                      : 'bg-rose-500/15 border-rose-500/40 text-rose-600'
                                  : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        {([['yes', 'Works', Check], ['no', 'Faulty', AlertTriangle], ['na', 'N/A', MinusCircle]] as const).map(([val, label, Icon]) => {
                          const active = r.works === val;
                          const faulty = val === 'no';
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => set(p.id, { works: val })}
                              className={`flex-1 min-h-[44px] rounded-lg text-[13px] font-semibold border flex items-center justify-center gap-2 transition-colors ${
                                active
                                  ? faulty
                                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-600'
                                    : val === 'yes'
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                                      : 'bg-neutral-700/40 border-neutral-600 text-[rgba(10,20,32,0.72)]'
                                  : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
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
                      className="mt-2 w-full px-3 py-2 bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg text-[13px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] focus:outline-none focus:border-[#0E9D98]/40"
                    />

                    {/* Damage tag indicator for points with a photo */}
                    {p.photoSlotId && (
                      <button
                        type="button"
                        onClick={onTagDamage}
                        disabled={!hasPhoto}
                        className="mt-2 min-h-[36px] text-[13px] text-[rgba(10,20,32,0.45)] hover:text-[#0E9D98] disabled:hover:text-[rgba(10,20,32,0.45)] disabled:cursor-default flex items-center gap-2"
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
        {/* Compliance certificates — sale / new build only */}
        {showCompliance && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileCheck size={14} className="text-[#0E9D98]" />
              <h2 className="text-[13px] font-medium text-[rgba(10,20,32,0.50)]">Compliance certificates</h2>
            </div>
            <div className="space-y-2">
              {applicableCerts.map(cert => {
                const c = certs[cert.id] || { received: false };
                return (
                  <div
                    key={cert.id}
                    className={`rounded-xl border p-3 ${
                      c.received
                        ? 'bg-emerald-50 border-emerald-500/30'
                        : 'bg-[#EFEDE8] border-[rgba(10,20,32,0.10)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#0A1420]">{cert.name}</p>
                        {cert.conditional && (
                          <p className="text-[12px] text-[rgba(10,20,32,0.45)] mt-0.5">{cert.conditional}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCerts(prev => ({
                            ...prev,
                            [cert.id]: { ...prev[cert.id], received: true },
                          }))}
                          className={`min-h-[40px] min-w-[56px] rounded-lg text-[12px] font-semibold border transition-colors ${
                            c.received
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600'
                              : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setCerts(prev => ({
                            ...prev,
                            [cert.id]: { ...prev[cert.id], received: false },
                          }))}
                          className={`min-h-[40px] min-w-[56px] rounded-lg text-[12px] font-semibold border transition-colors ${
                            !c.received && certs[cert.id]
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-600'
                              : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                          }`}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => setCerts(prev => ({
                            ...prev,
                            [cert.id]: { ...prev[cert.id], received: false, note: 'N/A' },
                          }))}
                          className={`min-h-[40px] min-w-[48px] rounded-lg text-[12px] font-semibold border transition-colors ${
                            c.note === 'N/A'
                              ? 'bg-neutral-700/40 border-neutral-600 text-[rgba(10,20,32,0.72)]'
                              : 'bg-[#F5F4F1] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                    {c.received && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <input
                          type="text"
                          value={c.issuer || ''}
                          onChange={(e) => setCerts(prev => ({
                            ...prev,
                            [cert.id]: { ...prev[cert.id], issuer: e.target.value },
                          }))}
                          placeholder="Issuer name"
                          className="px-3 py-2 bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg text-[12px] text-[#0A1420] placeholder-[rgba(10,20,32,0.35)] focus:outline-none focus:border-[#0E9D98]/40"
                        />
                        <input
                          type="date"
                          value={c.date || ''}
                          onChange={(e) => setCerts(prev => ({
                            ...prev,
                            [cert.id]: { ...prev[cert.id], date: e.target.value },
                          }))}
                          className="px-3 py-2 bg-[#F5F4F1] border border-[rgba(10,20,32,0.10)] rounded-lg text-[12px] text-[#0A1420] focus:outline-none focus:border-[#0E9D98]/40"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="shrink-0 p-3 border-t border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]/95 flex gap-2">
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border border-neutral-700 text-[rgba(10,20,32,0.85)] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? 'Saving…' : savedFlash ? 'Saved ✓' : 'Save'}
        </button>
        {onGenerateReport && (
          <button
            type="button"
            onClick={async () => {
              await handleSave(false);
              onGenerateReport();
            }}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#0E9D98] hover:bg-[#0BB5AF] text-white text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ClipboardCheck size={14} /> Generate Report
          </button>
        )}
      </div>
    </div>
  );
}
