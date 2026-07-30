import React from 'react';
import { ArrowLeft, ClipboardList, AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { Vehicle, ChecklistAnswer } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

interface InspectionChecklistProps {
  vehicle: Vehicle;
  onBack: () => void;
  onSave: (answers: Record<string, ChecklistAnswer>) => Promise<void> | void;
}

const ANSWER_OPTIONS: { value: ChecklistAnswer['answer']; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
];

export default function InspectionChecklist({ vehicle, onBack, onSave }: InspectionChecklistProps) {
  const [answers, setAnswers] = React.useState<Record<string, ChecklistAnswer>>(
    () => ({ ...(vehicle.inspectionChecklist || {}) })
  );
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);

  const totalItems = (DEFAULT_TEMPLATE.disclosureQuestions || []).reduce((n, s) => n + s.items.length, 0);
  const answered = Object.keys(answers).filter(id => answers[id]?.answer).length;
  const flagged = (DEFAULT_TEMPLATE.disclosureQuestions || []).flatMap(s => s.items)
    .filter(it => answers[it.id]?.answer === it.flagWhen).length;

  const setAnswer = (id: string, answer: ChecklistAnswer['answer']) => {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], answer } }));
  };
  const setNote = (id: string, note: string) => {
    setAnswers(prev => ({ ...prev, [id]: { answer: prev[id]?.answer || 'na', note } }));
  };

  const handleSave = async (thenBack: boolean) => {
    setSaving(true);
    try {
      await onSave(answers);
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
        <div className="flex items-center gap-3">
          <button onClick={() => handleSave(true)} className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 shrink-0 rounded-lg hover:bg-white/5" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[16px] font-bold tracking-tight flex items-center gap-2 font-display">
              <ClipboardList size={15} className="text-cyan-400" /> Inspection checklist
            </h1>
            <p className="text-[13px] text-neutral-400">
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.stockNumber}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-bold text-neutral-300">{answered}/{totalItems} answered</div>
          <div className={`text-[13px] font-bold ${flagged ? 'text-amber-400' : 'text-emerald-400'}`}>
            {flagged ? `${flagged} flagged for report` : 'Nothing flagged'}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        {(DEFAULT_TEMPLATE.disclosureQuestions || []).map(section => (
          <div key={section.section}>
            <h2 className="text-[13px] font-semibold  tracking-[0.2em] text-cyan-400 mb-2">
              {section.section}
            </h2>
            <div className="space-y-2">
              {section.items.map(item => {
                const a = answers[item.id];
                const isFlagged = a?.answer === item.flagWhen;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isFlagged
                        ? 'bg-amber-950/30 border-amber-500/40'
                        : a?.answer
                          ? 'bg-neutral-900/70 border-emerald-500/25'
                          : 'bg-neutral-900/70 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-medium text-neutral-200 leading-snug flex-1">
                        {item.q}
                      </p>
                      {isFlagged
                        ? <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                        : a?.answer
                          ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                          : null}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {ANSWER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswer(item.id, opt.value)}
                          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold tracking-normal border transition-colors ${
                            a?.answer === opt.value
                              ? opt.value === item.flagWhen
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {isFlagged && (
                      <input
                        type="text"
                        value={a?.note || ''}
                        onChange={e => setNote(item.id, e.target.value)}
                        placeholder="Add detail for the report (what / where / size)…"
                        className="mt-2 w-full px-3 py-2 bg-neutral-950/80 border border-amber-500/25 rounded-lg text-[13px] text-[#E8EAE6] placeholder-neutral-600 focus:outline-none focus:border-amber-400/50"
                      />
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
          className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#E8EAE6] text-[13px] font-semibold  tracking-widest flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? 'Saving…' : savedFlash ? 'Saved ✓' : 'Save checklist'}
        </button>
      </div>
    </div>
  );
}
