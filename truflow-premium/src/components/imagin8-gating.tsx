import React from "react";

/** Per-dealer bundle counts for Imagin8 paid APIs. An `unlimited: true` flag
 *  (own-yard dealerships like true-cars) renders plain, always-active buttons
 *  with no count badge — no 9999 sentinel numbers anywhere. */
export interface Imagin8Bundles {
  valuation: number;
  regCheck: number;
  accidentReport: number;
  bankAvs: number;
  unlimited?: boolean;
}

export type Imagin8Feature = Exclude<keyof Imagin8Bundles, "unlimited">;

/** Labels shown on gated buttons. */
export const FEATURE_LABELS: Record<Imagin8Feature, string> = {
  valuation: "TransUnion Valuation",
  regCheck: "Verify Registration",
  accidentReport: "Accident Report",
  bankAvs: "Verify Bank Account",
};

/** Default empty bundles. */
export const ZERO_BUNDLES: Imagin8Bundles = {
  valuation: 0,
  regCheck: 0,
  accidentReport: 0,
  bankAvs: 0,
};

/** Hook that wraps bundle state with persistence. */
export function useImagin8Gating(
  initial: Imagin8Bundles | (() => Imagin8Bundles),
  onConsume?: (next: Imagin8Bundles) => void | Promise<void>,
) {
  const [bundles, setBundles] = React.useState<Imagin8Bundles>(initial);

  const canUse = React.useCallback(
    (feature: Imagin8Feature) => !!bundles.unlimited || bundles[feature] > 0,
    [bundles],
  );

  const consume = React.useCallback(
    async (feature: Imagin8Feature): Promise<boolean> => {
      if (!canUse(feature)) return false;
      const next: Imagin8Bundles = { ...bundles };
      if (!bundles.unlimited) next[feature] = bundles[feature] - 1;
      setBundles(next);
      await onConsume?.(next);
      return true;
    },
    [bundles, canUse, onConsume],
  );

  return { bundles, canUse, consume };
}

/* ── Gated Button ── */

export interface Imagin8GatedButtonProps {
  feature: Imagin8Feature;
  bundles: Imagin8Bundles;
  onClick: () => void;
  onUnlock?: () => void; // shown when bundles === 0
  className?: string;
  icon?: React.ReactNode;
  label?: string;
}

/** A button that stays visible when bundles run out, but flips to an enticing
 *  "Unlock" state instead of disabling/graying out. Uses the existing TruSaaS
 *  glassmorphic + cyan accent design system. */
export const Imagin8GatedButton: React.FC<Imagin8GatedButtonProps> = ({
  feature,
  bundles,
  onClick,
  onUnlock,
  className = "",
  icon,
  label,
}) => {
  const unlimited = !!bundles.unlimited;
  const available = unlimited || (bundles[feature] || 0) > 0;
  const displayLabel = label || FEATURE_LABELS[feature];

  if (available) {
    const showCount = !unlimited && (bundles[feature] || 0) < 999;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          inline-flex items-center justify-center gap-2
          min-h-[42px] px-3.5 py-2 rounded-xl
          bg-[rgba(79,227,220,0.10)] border border-[rgba(79,227,220,0.25)]
          text-[#4FE3DC] text-[13px] font-medium
          hover:bg-[rgba(79,227,220,0.16)] hover:border-[rgba(79,227,220,0.40)]
          active:translate-y-[1px]
          transition-all cursor-pointer select-none
          ${className}
        `}
      >
        {icon}
        <span className="truncate">{displayLabel}</span>
        {showCount && (
          <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(79,227,220,0.15)] text-[#4FE3DC] shrink-0">
            {bundles[feature]}
          </span>
        )}
      </button>
    );
  }

  // Gated / "Unlock" state — glassmorphic, enticing, never disabled-looking
  return (
    <button
      type="button"
      onClick={onUnlock}
      className={`
        inline-flex items-center justify-center gap-2
        min-h-[42px] px-3.5 py-2 rounded-xl
        bg-[rgba(232,234,230,0.04)] border border-[rgba(232,234,230,0.10)]
        text-[rgba(232,234,230,0.65)] text-[13px] font-medium
        hover:bg-[rgba(232,234,230,0.08)] hover:border-[rgba(232,234,230,0.18)]
        active:translate-y-[1px]
        transition-all cursor-pointer select-none
        ${className}
      `}
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="text-[rgba(232,234,230,0.45)] shrink-0"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="truncate">{displayLabel}</span>
      <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[rgba(232,234,230,0.08)] text-[rgba(232,234,230,0.45)] shrink-0">
        Unlock
      </span>
    </button>
  );
};
