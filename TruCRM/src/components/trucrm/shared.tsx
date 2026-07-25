import React from 'react';
import { LeadStageId, LeadTemperature, FinanceStatus, LEAD_STAGES } from '../../types/trucrm';

/** Negatives read as -R185, never R-185. */
export const money = (n: number, currency = 'R') => {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(rounded).toLocaleString('en-ZA')}`;
};

/** Compact relative time, e.g. "12m", "3h", "5d". */
export const ago = (iso?: string) => {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - +new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/* Status without a traffic light.
   Three registers only, per the brand system:
     live   — cyan, for the states you want the eye pulled to
     quiet  — muted text on a hairline, the default for everything else
     grave  — the one dusty red, reserved for genuinely bad outcomes
   A board of nine differently-coloured pills is decoration, not information. */
const live = 'text-[color:var(--cyan)] border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)]';
const quiet = 'text-[color:var(--muted)] border-[color:var(--glass-line)] bg-[color:var(--glass)]';
const grave = 'text-[color:var(--danger)] border-[rgba(184,106,106,0.35)] bg-[rgba(184,106,106,0.08)]';

const chipBase = 'px-2 py-0.5 rounded-md text-[length:var(--t-micro)] font-medium border whitespace-nowrap';

const STAGE_TONE: Record<LeadStageId, string> = {
  new: live,
  contacted: quiet,
  appointment: quiet,
  showed: quiet,
  demo: quiet,
  writeup: quiet,
  finance: quiet,
  delivered: live,
  lost: grave,
};

export const StageChip: React.FC<{ stage: LeadStageId; className?: string }> = ({ stage, className = '' }) => (
  <span className={`${chipBase} ${STAGE_TONE[stage]} ${className}`}>
    {LEAD_STAGES.find((s) => s.id === stage)?.short || stage}
  </span>
);

/* Temperature earns a mark rather than a colour: three dots, filled to degree.
   It reads at a glance across a list without adding a third and fourth hue. */
export const TempChip: React.FC<{ temp: LeadTemperature }> = ({ temp }) => {
  const filled = temp === 'Hot' ? 3 : temp === 'Warm' ? 2 : 1;
  return (
    <span
      className="inline-flex items-center gap-[3px] align-middle"
      title={`${temp} lead`}
      aria-label={`${temp} lead`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-full"
          style={{
            background: i < filled ? 'var(--cyan)' : 'transparent',
            border: i < filled ? 'none' : '1px solid var(--faint)',
          }}
        />
      ))}
    </span>
  );
};

const FINANCE_TONE: Record<FinanceStatus, string> = {
  'Not Started': quiet,
  'Docs Outstanding': quiet,
  Submitted: quiet,
  Approved: live,
  Conditional: quiet,
  Declined: grave,
};

export const FinanceChip: React.FC<{ status: FinanceStatus }> = ({ status }) => (
  <span className={`${chipBase} ${FINANCE_TONE[status]}`}>{status}</span>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <span className="text-[length:var(--t-micro)] text-[color:var(--muted)] block mb-0.5">{label}</span>
    <div className="text-[length:var(--t-small)] text-[color:var(--white)]">{children}</div>
  </div>
);

export const inputClass =
  'w-full bg-[color:var(--ink)] border border-[color:var(--glass-line)] rounded-[8px] px-3 py-2 text-[length:var(--t-small)] text-[color:var(--white)] placeholder-[color:var(--faint)] focus:outline-none focus:border-[color:var(--cyan-soft)] transition-colors';

export const labelClass = 'text-[length:var(--t-micro)] text-[color:var(--muted)] block mb-1.5';

/* Section heading. Sentence case, medium weight — the caps-and-tracking label
   is the single most recognisable tell of a generated dashboard. */
export const sectionLabel =
  'text-[length:var(--t-micro)] font-medium text-[color:var(--muted)]';
