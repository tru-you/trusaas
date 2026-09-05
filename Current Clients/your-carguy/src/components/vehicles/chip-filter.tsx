"use client";

import { cn } from "@/lib/utils";

interface ChipFilterProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export default function ChipFilter({ label, active = false, count, onClick }: ChipFilterProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-brand text-white border-brand shadow-md shadow-brand-glow"
          : "bg-surface text-ink-secondary border-border hover:border-brand/40 hover:bg-brand-muted",
      )}
    >
      {label}
      {count != null && (
        <span className={cn("text-xs", active ? "text-white/80" : "text-ink-muted")}>{count}</span>
      )}
    </button>
  );
}
