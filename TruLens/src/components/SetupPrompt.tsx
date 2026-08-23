/**
 * First-run setup prompt for TruLens — "finish setting up your dealership".
 *
 * Two surfaces, one checklist (fetched via the TruFlow bridge by the caller):
 *  - <SetupPrompt/>        a modal after login while setup is incomplete
 *  - <SetupChecklistCard/> a quiet card on the Dashboard tab that outlives it
 *
 * The identity fields themselves are edited in TruFlow Premium — Lens links
 * there rather than building a second editor ("what lives in Lens lives in
 * Flow"). Demo and legacy shared-code logins never see either surface: the
 * server marks them skipPrompt.
 */

import React, { useState } from 'react';
import { Check, Circle, ArrowRight, X, Store } from 'lucide-react';
import type { SetupStatus } from '../lib/setupStatus';
import { acknowledgeSetup } from '../lib/setupStatus';

interface SetupPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: SetupStatus | null;
  /** Supplies the Bearer token for the acknowledge call. */
  getToken?: () => Promise<string | undefined> | string | undefined;
}

const pending = (s: SetupStatus) => s.items.filter((i) => !i.done);
const doneCount = (s: SetupStatus) => s.items.length - pending(s).length;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function ItemRow({ item }: { item: SetupStatus['items'][number] }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      {item.done ? (
        <Check size={15} className="mt-[3px] shrink-0 text-emerald-400" />
      ) : (
        <Circle size={15} className="mt-[3px] shrink-0 text-[rgba(232,234,230,0.45)]" />
      )}
      <span className="text-[13px] leading-snug min-w-0">
        <span className={item.done ? 'text-[rgba(232,234,230,0.45)] line-through' : 'text-[#E8EAE6]'}>
          {item.label}
        </span>
        {!item.done && item.hint && (
          <span className="block text-[11px] text-[rgba(232,234,230,0.55)]">{item.hint}</span>
        )}
      </span>
      {!item.required && !item.done && (
        <span className="shrink-0 mt-[2px] text-[10px] font-mono uppercase tracking-wider text-[rgba(232,234,230,0.45)] border border-[rgba(232,234,230,0.12)] rounded px-1.5 py-0.5">
          optional
        </span>
      )}
    </li>
  );
}

export default function SetupPrompt({ open, onOpenChange, status, getToken }: SetupPromptProps) {
  const [acking, setAcking] = useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  const visible = open && !!status && !status.complete && !status.skipPrompt;

  const handleLater = async () => {
    setAcking(true);
    try {
      await acknowledgeSetup(getToken);
      onOpenChange(false);
    } catch {
      // Ack failed (offline / bridge down): still close — the dashboard card
      // keeps nudging quietly, which is the right fallback.
      onOpenChange(false);
    } finally {
      setAcking(false);
    }
  };

  // Modal semantics: focus in, Tab trapped, Escape = "later", scroll locked,
  // focus handed back on close.
  React.useEffect(() => {
    if (!visible) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void handleLater();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
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
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || !status) return null;

  const remaining = pending(status);

  return (
    // Same overlay tier as GuidePanel/DealerAssist — above app chrome, below
    // nothing that traps clicks.
    <div
      className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void handleLater();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-prompt-title"
        className="w-full max-w-[420px] rounded-2xl border border-[rgba(232,234,230,0.10)] bg-[rgba(20,24,28,0.97)] shadow-2xl p-5 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <Store size={18} className="text-[#4FE3DC]" />
          <h3 id="setup-prompt-title" className="text-[17px] font-semibold tracking-tight text-[#E8EAE6]">
            Finish setting up your dealership
          </h3>
          <button
            type="button"
            onClick={() => void handleLater()}
            disabled={acking}
            aria-label="Dismiss — I'll do this later"
            className="ml-auto p-1 -m-1 hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
          {doneCount(status)} of {status.items.length} done. These details appear on every invoice,
          agreement and listing you send out — they live in TruFlow, so you set them once for all apps.
        </p>

        <ul className="flex flex-col divide-y divide-[rgba(232,234,230,0.06)]">
          {status.items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <a
            href="https://premium.tru-saas.com"
            target="_blank"
            rel="noreferrer"
            onClick={() => void handleLater()}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-[rgba(79,227,220,0.14)] border border-[rgba(79,227,220,0.30)] text-[#4FE3DC] text-[13px] font-semibold hover:bg-[rgba(79,227,220,0.20)] active:translate-y-[1px] transition-all cursor-pointer select-none flex-1"
          >
            Finish setup in TruFlow
            <ArrowRight size={14} />
          </a>
          <button
            type="button"
            onClick={() => void handleLater()}
            disabled={acking}
            className="min-h-[42px] px-4 py-2 rounded-xl text-[13px] text-[rgba(232,234,230,0.65)] hover:text-[#E8EAE6] cursor-pointer disabled:opacity-50"
          >
            {acking ? 'Saving…' : 'Later'}
          </button>
        </div>
        {remaining.some((i) => !i.required) && (
          <p className="text-[11px] text-[rgba(232,234,230,0.45)]">
            Optional items improve your documents but nothing is blocked without them.
          </p>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  status: SetupStatus | null;
  /** Opens the app's Settings tab where device-local config lives. */
  onSetUp?: () => void;
  /** Hides the card for a week (per-device). */
  onSnooze?: () => void;
}

/** The quiet follow-up once the modal has been dismissed ("Later"). Shows at
 *  the top of the Dashboard tab until required items are done or snoozed for
 *  a week per device. Only REQUIRED gaps keep this alive — optional branding
 *  gaps are nudged exactly once in the modal and never become a badge. */
export function SetupChecklistCard({ status, onSetUp, onSnooze }: CardProps) {
  if (!status || status.skipPrompt || status.requiredComplete) return null;
  const remaining = pending(status);
  if (remaining.length === 0) return null;

  return (
    <div className="rounded-xl border border-[rgba(79,227,220,0.25)] bg-[rgba(79,227,220,0.05)] px-4 py-3 flex items-center gap-3">
      <Store size={15} className="text-[#4FE3DC] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[#E8EAE6]">
          Dealership setup {doneCount(status)}/{status.items.length}
        </div>
        <p className="text-[11px] text-[rgba(232,234,230,0.6)] truncate">
          Still to do: {remaining.map((i) => i.label).join(', ')}
        </p>
      </div>
      {onSetUp && (
        <button
          type="button"
          onClick={onSetUp}
          className="inline-flex items-center gap-1.5 shrink-0 min-h-[32px] px-3 py-1.5 rounded-lg bg-[rgba(79,227,220,0.14)] border border-[rgba(79,227,220,0.30)] text-[#4FE3DC] text-[11px] font-semibold hover:bg-[rgba(79,227,220,0.20)] transition-all cursor-pointer"
        >
          Set up
          <ArrowRight size={12} />
        </button>
      )}
      {onSnooze && (
        <button
          type="button"
          onClick={onSnooze}
          aria-label="Hide for a week"
          className="p-2 shrink-0 text-[rgba(232,234,230,0.55)] hover:text-[#E8EAE6] cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
