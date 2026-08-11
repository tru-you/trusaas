import React, { useEffect } from 'react';
import { Monitor, X } from 'lucide-react';

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 h-10 text-sm font-medium tracking-tight transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap';

const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-dim shadow-1 hover:shadow-2',
  accent: 'bg-accent text-white hover:bg-accent-hi shadow-1 hover:shadow-2 hover:shadow-accent/25',
  ghost: 'bg-transparent text-ink-dim hover:bg-slate-soft hover:text-ink border border-line',
  danger: 'bg-danger/10 text-danger hover:bg-danger hover:text-white',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${btnBase} ${btnVariants[variant]} ${className}`} {...rest} />;
}

export function IconButton({
  label,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] text-muted hover:text-ink hover:bg-slate-soft transition-colors ${className}`}
      {...rest}
    />
  );
}

/* ---------------------------------- Card ----------------------------------- */

export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-card rounded-[var(--r-card)] border border-line/70 shadow-1 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------------- Inputs ---------------------------------- */

const fieldBase =
  'w-full h-10 px-3 rounded-[10px] bg-card border border-line text-sm text-ink placeholder:text-faint outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-soft';

export function Input({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${fieldBase} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} h-auto min-h-[80px] py-2.5 resize-y ${className}`} {...rest} />;
}

export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-ink-dim mb-1.5 tracking-tight">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1">{hint}</span>}
    </label>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

export type BadgeTone = 'neutral' | 'teal' | 'slate' | 'red' | 'amber' | 'ink';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-soft text-slate-deep',
  teal: 'bg-accent-soft text-accent',
  slate: 'bg-slate-soft text-slate-deep',
  red: 'bg-danger/10 text-danger',
  amber: 'bg-accent-soft text-accent',
  ink: 'bg-ink text-paper',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-pill)] text-[11px] font-semibold tracking-tight ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] animate-fade"
        onClick={onClose}
      />
      <div
        className={`relative bg-card rounded-[var(--r-card)] shadow-3 border border-line w-full ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        } max-h-[88vh] overflow-y-auto animate-rise`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line/60 sticky top-0 bg-card z-10">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line/60 sticky bottom-0 bg-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Stat ----------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'teal',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'teal' | 'slate' | 'ink' | 'red';
}) {
  const iconTones = {
    teal: 'bg-accent-soft text-accent',
    slate: 'bg-slate-soft text-slate-deep',
    ink: 'bg-ink text-paper',
    red: 'bg-danger/10 text-danger',
  };
  return (
    <Card className="p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-muted tracking-tight uppercase">{label}</p>
        <p className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight text-ink mono">
          {value}
        </p>
        {sub && <p className="mt-2 text-[12.5px] text-muted">{sub}</p>}
      </div>
      {icon && (
        <div
          className={`shrink-0 w-10 h-10 rounded-[12px] flex items-center justify-center ${iconTones[tone]}`}
        >
          {icon}
        </div>
      )}
    </Card>
  );
}

/* --------------------------------- Empty ----------------------------------- */

export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-soft flex items-center justify-center text-slate mb-4">
        <span className="text-2xl leading-none">—</span>
      </div>
      <h3 className="text-[15px] font-semibold text-ink tracking-tight">{title}</h3>
      {hint && <p className="mt-1 text-[13.5px] text-muted max-w-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 rounded-full border-2 border-line border-t-accent animate-spin" />
    </div>
  );
}

export function DesktopOnly({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-soft flex items-center justify-center text-slate mb-4">
        <Monitor size={24} />
      </div>
      <h3 className="text-[15px] font-semibold text-ink tracking-tight">{title}</h3>
      <p className="mt-1 text-[13.5px] text-muted max-w-sm">{hint}</p>
    </div>
  );
}