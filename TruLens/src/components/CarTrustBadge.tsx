import React from 'react';
import { Shield, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { CarTrustResult } from '../lib/kredo';

interface Props {
  result: CarTrustResult | null | undefined;
  loading?: boolean;
  compact?: boolean;
}

export default function CarTrustBadge({ result, loading, compact }: Props) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
        <Loader2 size={10} className="animate-spin" /> Checking…
      </span>
    );
  }

  if (!result) return null;

  const hasFlag = result.stolen || result.writtenOff || result.financeEncumbered;

  if (compact) {
    return hasFlag ? (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 text-[11px] font-semibold text-red-300 border border-red-500/20" title="CarTrust flags found">
        <AlertTriangle size={10} /> CarTrust
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-[11px] font-semibold text-emerald-400 border border-emerald-500/15" title="CarTrust clear">
        <Shield size={10} /> Clear
      </span>
    );
  }

  return (
    <div className={`rounded-lg border px-3 py-2 space-y-1 ${
      hasFlag
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-emerald-500/5 border-emerald-500/15'
    }`}>
      <div className="flex items-center gap-1.5">
        {hasFlag ? (
          <AlertTriangle size={12} className="text-red-400" />
        ) : (
          <CheckCircle2 size={12} className="text-emerald-400" />
        )}
        <span className={`text-[12px] font-bold ${hasFlag ? 'text-red-300' : 'text-emerald-300'}`}>
          Kredo CarTrust
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <Flag label="Stolen" flagged={result.stolen} />
        <Flag label="Written off" flagged={result.writtenOff} />
        <Flag label="Finance" flagged={result.financeEncumbered} />
      </div>
      <div className="text-[10px] text-neutral-600">
        Checked {new Date(result.checkedAt).toLocaleDateString('en-ZA')}
      </div>
    </div>
  );
}

function Flag({ label, flagged }: { label: string; flagged: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${flagged ? 'text-red-300' : 'text-neutral-500'}`}>
      {flagged ? '⚠' : '✓'} {label}
    </span>
  );
}
