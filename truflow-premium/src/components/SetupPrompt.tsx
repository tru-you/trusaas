/**
 * First-run setup prompt — the "finish setting up your dealership" nudge.
 *
 * Two surfaces, one checklist (fetched live from the server by the caller):
 *  - <SetupPrompt/>        a modal after login while setup is incomplete
 *  - <SetupChecklistCard/> a quiet dashboard card that outlives the modal
 *
 * Deliberately NOT a multi-step wizard: Settings is already a stack of
 * self-contained cards, so the prompt just points at it and gets out of the
 * way. Salespeople never see either surface — they can't reach Settings.
 */

import React, { useState } from "react";
import { Check, Circle, ArrowRight, X, Store } from "lucide-react";
import type { SetupStatus } from "../lib/setupStatus";
import { acknowledgeSetup } from "../lib/setupStatus";

interface SetupPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: SetupStatus | null;
  /** Jump into the Settings section (and scroll top). */
  onGoToSettings: () => void;
  /** Only passed for master admins targeting a scoped dealer. */
  dealershipId?: string;
}

const pending = (s: SetupStatus) => s.items.filter((i) => !i.done);
const doneCount = (s: SetupStatus) => s.items.length - pending(s).length;

/** Shared row renderer — tick for done, hollow circle + hint for todo. */
function ItemRow({ item }: { item: SetupStatus["items"][number] }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      {item.done ? (
        <Check size={15} className="mt-[3px] shrink-0 text-emerald-400" />
      ) : (
        <Circle size={15} className="mt-[3px] shrink-0 text-[color:var(--muted)]" />
      )}
      <span className="text-[13px] leading-snug">
        <span className={item.done ? "text-[rgba(232,234,230,0.45)] line-through" : "text-[color:var(--white)]"}>
          {item.label}
        </span>
        {!item.done && item.hint && (
          <span className="block text-[11px] text-[color:var(--muted)]">{item.hint}</span>
        )}
      </span>
      {!item.required && !item.done && (
        <span className="ml-auto mt-[2px] shrink-0 text-[10px] font-mono uppercase tracking-wider text-[color:var(--muted)] border border-[color:var(--glass-line)] rounded px-1.5 py-0.5">
          optional
        </span>
      )}
    </li>
  );
}

export default function SetupPrompt({ open, onOpenChange, status, onGoToSettings, dealershipId }: SetupPromptProps) {
  const [acking, setAcking] = useState(false);
  if (!open || !status || status.complete || status.skipPrompt) return null;

  const remaining = pending(status);

  const handleLater = async () => {
    setAcking(true);
    try {
      await acknowledgeSetup(dealershipId);
      onOpenChange(false);
    } catch {
      // Ack failed (offline / expired session): still close — the card on the
      // dashboard keeps nudging quietly, which is the right fallback.
      onOpenChange(false);
    } finally {
      setAcking(false);
    }
  };

  return (
    // z-index sits above the sticky header but below form modals that stack
    // on top of everything (z-[200]) — setup should never trap a click.
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[480px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-5 md:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Store size={18} className="text-[color:var(--cyan-bright)]" />
          <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">
            Finish setting up your dealership
          </h3>
          <button
            onClick={() => void handleLater()}
            disabled={acking}
            aria-label="Dismiss"
            className="ml-auto text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
          {doneCount(status)} of {status.items.length} done. These details appear on every invoice,
          agreement and listing you send out.
        </p>

        <ul className="flex flex-col divide-y divide-white/5">
          {status.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onGoToSettings();
            }}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold"
          >
            Set up now
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => void handleLater()}
            disabled={acking}
            className="px-4 py-2 min-h-[40px] text-sm text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] rounded-md cursor-pointer disabled:opacity-50"
          >
            I'll do this later
          </button>
        </div>
        {remaining.some((i) => !i.required) && (
          <p className="text-[11px] text-[color:var(--muted)]">
            Optional items improve your documents but nothing is blocked without them.
          </p>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  status: SetupStatus | null;
  onGoToSettings: () => void;
  onSnooze: () => void;
}

/** The quiet follow-up once the modal has been dismissed ("later"). Shows on
 *  the Overview until setup completes or the dealer snoozes it for a week.
 *  Only REQUIRED gaps keep this card alive — missing optional branding is
 *  nudged exactly once (in the modal) and never becomes a permanent badge. */
export function SetupChecklistCard({ status, onGoToSettings, onSnooze }: CardProps) {
  if (!status || status.skipPrompt || status.requiredComplete) return null;
  const remaining = pending(status);
  if (remaining.length === 0) return null;

  return (
    <div className="card px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-3 border-[color:var(--cyan-soft)]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Store size={14} className="text-[color:var(--cyan-bright)] shrink-0" />
          <h3 className="font-semibold text-[14px] text-[color:var(--white)]">Finish dealership setup</h3>
          <span className="text-[11px] font-mono text-[color:var(--muted)]">
            {doneCount(status)}/{status.items.length}
          </span>
        </div>
        <p className="text-[12px] text-[color:var(--muted)] mt-1 truncate">
          Still to do: {remaining.map((i) => i.label).join(", ")}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onGoToSettings} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-[12px] font-semibold">
          Open Settings
          <ArrowRight size={13} />
        </button>
        <button
          onClick={onSnooze}
          aria-label="Hide for a week"
          className="p-2 text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)] cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
