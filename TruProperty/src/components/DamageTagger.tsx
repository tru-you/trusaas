import React from 'react';
import { ArrowLeft, Save, Trash2, Plus, AlertTriangle, Check, Sparkles, Loader2, ClipboardCheck } from 'lucide-react';
import { Vehicle, DamageFinding } from '../types';
import { usePropertySlots } from '../lib/usePropertySlots';

/**
 * Manual damage tagging — the inspector taps the exact spot on a REAL captured
 * photo and records what's wrong. Nothing is inferred: every tag is a person's
 * judgement, because this goes on a report a buyer relies on.
 *
 * Tags are stored per photo slot on `vehicle.damageFindings`, each pinned to an
 * x/y position (0–1) so the report can plot the mark on the same photo.
 */

interface DamageTaggerProps {
  vehicle: Vehicle;
  onBack: () => void;
  onSave: (damageFindings: Record<string, DamageFinding[]>) => Promise<void> | void;
  onContinueToChecklist?: () => void;
}

const TYPES: DamageFinding['damageType'][] = [
  'rising_damp', 'mould', 'efflorescence', 'spalling', 'settlement_crack', 'water_stain',
  'termite', 'rot', 'crack', 'paint', 'wear', 'missing', 'other',
];

const SEVERITY_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Cosmetic', color: '#4FE3DC' },
  2: { label: 'Minor', color: '#7DD3A8' },
  3: { label: 'Moderate', color: '#E7C46B' },
  4: { label: 'Major', color: '#E39A5B' },
  5: { label: 'Structural', color: '#C07676' },
};

const newId = () => `dmg_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

export default function DamageTagger({ vehicle, onBack, onSave, onContinueToChecklist }: DamageTaggerProps) {
  const slots = usePropertySlots(vehicle);

  // Only slots that actually have a photo can be tagged.
  const shotSlots = React.useMemo(
    () => slots.filter((s) => vehicle.photos?.[s.id]),
    [vehicle.photos, slots],
  );

  const [findings, setFindings] = React.useState<Record<string, DamageFinding[]>>(
    () => JSON.parse(JSON.stringify(vehicle.damageFindings || {})),
  );
  const [slotId, setSlotId] = React.useState<string>(shotSlots[0]?.id || '');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [scanMsg, setScanMsg] = React.useState<string | null>(null);
  const imgWrapRef = React.useRef<HTMLDivElement | null>(null);

  const slot = slots.find((s) => s.id === slotId);
  const photo = vehicle.photos?.[slotId];
  const slotTags = findings[slotId] || [];
  const editing = slotTags.find((t) => t.id === editingId) || null;

  const totalTags = Object.keys(findings).reduce((n, k) => n + findings[k].length, 0);

  const updateTag = (id: string, patch: Partial<DamageFinding>) => {
    setFindings((prev) => ({
      ...prev,
      [slotId]: (prev[slotId] || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const removeTag = (id: string) => {
    setFindings((prev) => {
      const list = (prev[slotId] || []).filter((t) => t.id !== id);
      const next = { ...prev };
      if (list.length) next[slotId] = list;
      else delete next[slotId];
      return next;
    });
    if (editingId === id) setEditingId(null);
  };

  // Tap the photo to drop a new mark where the damage is.
  const handlePhotoTap = (e: React.MouseEvent) => {
    if (!imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const tag: DamageFinding = {
      id: newId(),
      panel: slot?.name || 'Property',
      damageType: 'crack',
      severity: 2,
      note: '',
      x,
      y,
    };
    setFindings((prev) => ({ ...prev, [slotId]: [...(prev[slotId] || []), tag] }));
    setEditingId(tag.id);
  };

  // Real vision assist: ask the model to look at THIS photo and suggest damage.
  // Suggestions land as provisional marks the inspector must confirm — nothing
  // AI-guessed reaches the report until a human says so.
  const scanWithAI = async () => {
    if (scanning || !photo) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch('/api/inspect/damage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: photo,
          slotId,
          slotName: slot?.name,
          propertyInfo: { type: vehicle.propertyType, suburb: vehicle.suburb, yearBuilt: vehicle.yearBuilt },
        }),
      });
      const data = await res.json();
      const suggestions: DamageFinding[] = Array.isArray(data.findings) ? data.findings : [];
      if (!data.aiMode) {
        setScanMsg('AI vision is off on the server — tag by hand, or add a GEMINI key to enable it.');
      } else if (!suggestions.length) {
        setScanMsg('AI saw no clear damage in this photo. Tag anything it missed by hand.');
      } else {
        setFindings((prev) => ({ ...prev, [slotId]: [...(prev[slotId] || []), ...suggestions] }));
        setScanMsg(`AI suggested ${suggestions.length} — review each, then confirm or remove.`);
      }
    } catch {
      setScanMsg('Could not reach the AI service. Tag by hand.');
    } finally {
      setScanning(false);
      setTimeout(() => setScanMsg(null), 4000);
    }
  };

  const handleSave = async (thenBack: boolean) => {
    setSaving(true);
    try {
      // Only what a human stands behind goes on the record: manual tags, plus AI
      // suggestions the inspector confirmed. Unconfirmed AI marks are dropped.
      const clean: Record<string, DamageFinding[]> = {};
      for (const [sid, list] of Object.entries(findings)) {
        const kept = (list as DamageFinding[]).filter((t) => t.source !== 'ai' || t.confirmed);
        if (kept.length) clean[sid] = kept;
      }
      await onSave(clean);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      if (thenBack) onBack();
    } finally {
      setSaving(false);
    }
  };

  if (!shotSlots.length) {
    return (
      <div className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420]">
        <div className="bg-[#0A1420]/80 backdrop-blur-xl border-b border-white/[0.06] p-4 flex items-center gap-3 shrink-0">
          <button onClick={onBack} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[16px] font-bold text-white">Tag damage</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center text-[rgba(10,20,32,0.55)]">
          <AlertTriangle size={22} className="text-amber-400" />
          <p className="text-[13px]">Take some photos first — then tap the damage on each photo to tag it.</p>
        </div>
      </div>
    );
  }

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
              <AlertTriangle size={15} className="text-[#4FE3DC]" /> Tag damage
            </h1>
            <p className="text-[13px] text-white/50 truncate">
              {vehicle.propertyType} — {vehicle.suburb} · {vehicle.listingRef}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-bold text-white/70">{totalTags} tag{totalTags === 1 ? '' : 's'}</div>
          <div className="text-[13px] text-white/45">across {shotSlots.length} photos</div>
        </div>
      </div>

      {/* Photo picker */}
      <div className="flex gap-2 overflow-x-auto p-3 border-b border-[rgba(10,20,32,0.06)] shrink-0">
        {shotSlots.map((s) => {
          const count = (findings[s.id] || []).length;
          const active = s.id === slotId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setSlotId(s.id); setEditingId(null); }}
              className={`relative shrink-0 w-16 rounded-lg overflow-hidden border-2 ${active ? 'border-[#0E9D98]' : 'border-[rgba(10,20,32,0.10)]'}`}
            >
              <img src={vehicle.photos[s.id]} alt={s.name} className="w-16 h-12 object-cover" />
              <span className="block text-[13px] leading-tight px-1 py-0.5 text-[rgba(10,20,32,0.72)] truncate bg-[#F0F4F8]">{s.name}</span>
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[13px] font-semibold flex items-center justify-center">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Photo with tap-to-tag */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={imgWrapRef}
          onClick={handlePhotoTap}
          className="relative w-full bg-black select-none cursor-crosshair"
        >
          {photo && <img src={photo} alt={slot?.name} className="w-full h-auto block pointer-events-none" />}
          {slotTags.map((t, i) => {
            const meta = SEVERITY_META[t.severity];
            const isEditing = t.id === editingId;
            const prov = t.source === 'ai' && !t.confirmed;
            return (
              <button
                key={t.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingId(t.id); }}
                style={{
                  left: `${t.x * 100}%`, top: `${t.y * 100}%`,
                  borderColor: meta.color, background: `${meta.color}22`,
                  borderStyle: prov ? 'dashed' : 'solid',
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[13px] font-bold text-white ${isEditing ? 'ring-2 ring-white' : ''} ${prov ? 'animate-pulse' : ''}`}
              >
                {i + 1}
              </button>
            );
          })}
          {!slotTags.length && (
            <div className="absolute inset-x-0 bottom-0 p-2 text-center text-[13px] text-white bg-black/40">
              Tap the photo where the damage is
            </div>
          )}
        </div>

        {/* Editor for the selected mark */}
        {editing && (
          <div className="p-4 space-y-3 border-t border-[rgba(10,20,32,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[rgba(10,20,32,0.72)] flex items-center gap-2">
                Mark on {editing.panel}
                {editing.source === 'ai' && !editing.confirmed && (
                  <span className="text-[13px] font-bold text-[#0E9D98] border border-[#0E9D98]/25 rounded px-2 py-0.5 flex items-center gap-1">
                    <Sparkles size={9} /> AI suggested
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeTag(editing.id)}
                className="flex items-center gap-1 text-[13px] text-red-500 hover:text-red-600"
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
            {editing.source === 'ai' && !editing.confirmed && (
              <p className="text-[13px] text-[#0E9D98]/80 leading-relaxed">
                The model flagged this. Check it against the photo — drag isn’t needed, just confirm what’s real. Only confirmed marks reach the buyer’s report.
              </p>
            )}

            <div>
              <label className="text-[13px] text-[rgba(10,20,32,0.45)] font-bold block mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateTag(editing.id, { damageType: t })}
                    className={`px-3 py-1 rounded-full text-[13px] font-semibold border capitalize ${
                      editing.damageType === t
                        ? 'bg-[#0E9D98]/12 border-[#0E9D98]/40 text-[#0E9D98]'
                        : 'bg-[#F0F4F8] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[rgba(10,20,32,0.45)] font-bold block mb-2">Severity</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const meta = SEVERITY_META[n];
                  const active = editing.severity === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateTag(editing.id, { severity: n as DamageFinding['severity'] })}
                      style={active ? { background: `${meta.color}22`, borderColor: meta.color, color: meta.color } : undefined}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-bold border ${active ? '' : 'bg-[#F0F4F8] border-[rgba(10,20,32,0.10)] text-[rgba(10,20,32,0.55)]'}`}
                    >
                      {n}<span className="block text-[13px] font-medium">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[13px] text-[rgba(10,20,32,0.45)] font-bold block mb-2">Note (what / where / size)</label>
              <input
                type="text"
                value={editing.note}
                onChange={(e) => updateTag(editing.id, { note: e.target.value })}
                placeholder="e.g. 15cm scratch through clearcoat, lower door"
                className="w-full px-3 py-2 bg-[#F0F4F8] border border-[rgba(10,20,32,0.10)] rounded-lg text-[13px] text-[#0A1420] placeholder-neutral-400 focus:outline-none focus:border-[#0E9D98]/40"
              />
            </div>

            {editing.source === 'ai' && !editing.confirmed ? (
              <button
                type="button"
                onClick={() => { updateTag(editing.id, { confirmed: true }); setEditingId(null); }}
                className="w-full py-3 rounded-lg bg-[#0E9D98] hover:bg-[#0BB5AF] text-[13px] font-semibold text-white flex items-center justify-center gap-2"
              >
                <Check size={14} /> Confirm — this damage is real
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="w-full py-2 rounded-lg bg-[#F0F4F8] border border-[rgba(10,20,32,0.10)] text-[13px] font-semibold text-[rgba(10,20,32,0.72)] flex items-center justify-center gap-2"
              >
                <Check size={14} /> Done with this mark
              </button>
            )}
          </div>
        )}

        {!editing && (
          <p className="px-4 py-3 text-[13px] text-[rgba(10,20,32,0.45)] flex items-center gap-2">
            <Plus size={13} /> Tap the photo to add a mark, or tap an existing mark to edit it.
          </p>
        )}
      </div>

      {/* Save bar */}
      <div className="shrink-0 p-3 border-t border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]/95 space-y-2">
        {scanMsg && (
          <p className="text-[13px] text-[#0E9D98]/90 text-center leading-snug">{scanMsg}</p>
        )}
        <button
          type="button"
          onClick={scanWithAI}
          disabled={scanning || !photo}
          className="w-full py-3 rounded-xl bg-[#F0F4F8] border border-[#0E9D98]/20 text-[#0E9D98] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {scanning ? <><Loader2 size={14} className="animate-spin" /> Scanning this photo…</> : <><Sparkles size={14} /> Scan this photo with AI</>}
        </button>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#0E9D98] hover:bg-[#0BB5AF] text-white text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? 'Saving…' : savedFlash ? 'Saved ✓' : 'Save damage tags'}
        </button>
        {onContinueToChecklist && (
          <button
            type="button"
            onClick={async () => { await handleSave(false); onContinueToChecklist(); }}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#F0F4F8] border border-[#0E9D98]/20 text-[#0E9D98] text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ClipboardCheck size={14} /> Continue to Checklist
          </button>
        )}
      </div>
    </div>
  );
}
