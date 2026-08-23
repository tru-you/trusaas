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
      <span className="text-[13px] leading-snug min-w-0">
        <span className={item.done ? "text-[rgba(232,234,230,0.45)] line-through" : "text-[color:var(--white)]"}>
          {item.label}
        </span>
        {!item.done && item.hint && (
          <span className="block text-[11px] text-[color:var(--muted)]">{item.hint}</span>
        )}
      </span>
      {!item.required && !item.done && (
        <span className="shrink-0 mt-[2px] text-[10px] font-mono uppercase tracking-wider text-[color:var(--muted)] border border-[color:var(--glass-line)] rounded px-1.5 py-0.5">
          optional
        </span>
      )}
    </li>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function SetupPrompt({ open, onOpenChange, status, onGoToSettings, dealershipId }: SetupPromptProps) {
  const [acking, setAcking] = useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  const visible = open && !!status && !status.complete && !status.skipPrompt;

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

  // Modal semantics: move focus in, keep it trapped, let Escape mean
  // "later" (the same as the X), lock background scroll, and hand focus back
  // on close. All no-ops while hidden.
  React.useEffect(() => {
    if (!visible) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleLater();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || !status) return null;

  const remaining = pending(status);

  return (
    // z-index sits above the sticky header but below form modals that stack
    // on top of everything (z-[200]) — setup should never trap a click.
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void handleLater();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-prompt-title"
        className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[480px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-5 md:p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <Store size={18} className="text-[color:var(--cyan-bright)]" />
          <h3 id="setup-prompt-title" className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">
            Finish setting up your dealership
          </h3>
          <button
            type="button"
            onClick={() => void handleLater()}
            disabled={acking}
            aria-label="Dismiss — I'll do this later"
            className="ml-auto p-1 -m-1 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"
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

        <div className="flex flex-wrap items-center gap-2 pt-1">
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
            {acking ? "Saving…" : "I'll do this later"}
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
        <button type="button" onClick={onGoToSettings} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-[12px] font-semibold">
          Open Settings
          <ArrowRight size={13} />
        </button>
        <button
          type="button"
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
