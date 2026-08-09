import React from 'react';
import { Check, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { Vehicle } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { usePropertySlots } from '../lib/usePropertySlots';

interface CompletionReviewProps {
  vehicle: Vehicle;
  onBack: () => void;
  onSubmit: () => void;
  onRetakeSlot: (slotId: string) => void;
}

export default function CompletionReview({ vehicle, onBack, onSubmit, onRetakeSlot }: CompletionReviewProps) {
  const photos = vehicle?.photos || {};
  const slots = usePropertySlots(vehicle);
  const phases = DEFAULT_TEMPLATE.phases;

  const totalSlots = slots.length;
  const capturedCount = slots.filter(s => !!photos[s.id]).length;
  const requiredSlots = slots.filter(s => s.required);
  const requiredCaptured = requiredSlots.filter(s => !!photos[s.id]).length;
  const flaggedCount = Object.values(vehicle.slotAssessment || {}).filter(a => a?.rating === 'damage').length;

  const allRequiredDone = requiredCaptured === requiredSlots.length;

  return (
    <div className="flex flex-col h-full bg-[#F5F4F1] text-[#0A1420] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0A1420]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]"
          >
            <RotateCcw size={18} />
          </button>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-white">Review & submit</h1>
            <p className="text-[12px] text-white/50">
              {vehicle.propertyType} — {vehicle.suburb}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Summary card */}
        <div className="rounded-[18px] bg-[rgba(10,20,32,0.04)] border border-[rgba(10,20,32,0.10)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium">{capturedCount} of {totalSlots} shots</span>
            {allRequiredDone ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[#0E9D98]">
                <Check size={14} strokeWidth={3} /> All required done
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px] text-rose-400">
                <AlertCircle size={14} /> {requiredSlots.length - requiredCaptured} required missing
              </span>
            )}
          </div>
          {flaggedCount > 0 && (
            <p className="text-[12px] text-rose-400">{flaggedCount} flagged as damage</p>
          )}
        </div>

        {/* Phase tiles */}
        <div className="space-y-2">
          {phases.map(phase => {
            const phaseSlots = slots.filter(s => s.phase === phase.id);
            const phaseCaptured = phaseSlots.filter(s => !!photos[s.id]).length;
            const allDone = phaseCaptured === phaseSlots.length;
            return (
              <div
                key={phase.id}
                className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
                  allDone
                    ? 'bg-cyan-500/8 border-cyan-500/30'
                    : 'bg-[rgba(10,20,32,0.04)] border-[rgba(10,20,32,0.10)]'
                }`}
              >
                <div>
                  <p className="text-[13px] font-medium">{phase.name}</p>
                  <p className="text-[12px] text-[rgba(10,20,32,0.50)]">{phaseCaptured} of {phaseSlots.length}</p>
                </div>
                {allDone && <Check size={16} className="text-[#0E9D98]" strokeWidth={3} />}
              </div>
            );
          })}
        </div>

        {/* 6-column shot grid */}
        <div>
          <p className="text-[12px] text-[rgba(10,20,32,0.50)] mb-2">All shots</p>
          <div className="grid grid-cols-6 gap-1.5">
            {slots.map((slot) => {
              const photo = photos[slot.id];
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => photo && onRetakeSlot(slot.id)}
                  className={`aspect-square rounded-lg overflow-hidden border relative ${
                    photo
                      ? 'border-[rgba(10,20,32,0.10)]'
                      : slot.required
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-[rgba(10,20,32,0.06)] bg-[rgba(10,20,32,0.03)]'
                  }`}
                >
                  {photo ? (
                    <img src={photo} alt={slot.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[9px] text-[rgba(10,20,32,0.35)] flex items-center justify-center h-full px-0.5 text-center leading-tight">
                      {slot.name}
                    </span>
                  )}
                  {vehicle.slotAssessment?.[slot.id]?.rating === 'damage' && (
                    <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky submit */}
      <div className="shrink-0 p-3 border-t border-[rgba(10,20,32,0.06)] bg-[#F5F4F1]/95">
        <button
          type="button"
          disabled={!allRequiredDone}
          onClick={onSubmit}
          className="w-full min-h-[56px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          Submit inspection <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
