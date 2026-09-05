import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Deterministic thousands separator — does NOT use toLocaleString, because
 * Node's ICU and the browser's disagree on the en-ZA grouping character
 * (space vs comma), which breaks SSR hydration. We emit a normal ASCII space,
 * matching South African convention, identically on server and client.
 */
export function formatNum(n: number) {
  const neg = n < 0;
  const digits = Math.abs(Math.trunc(n)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "-" : "") + grouped;
}

/**
 * Locale-safe ZAR formatting — deterministic, hydration-stable.
 */
export function formatPrice(price: number) {
  return `R ${formatNum(price)}`;
}

export function formatKm(km: number) {
  if (km >= 1000) {
    const m = Math.floor(km / 1000);
    const rem = km % 1000;
    return rem > 0 ? `${m}.${(rem / 1000).toFixed(1).slice(2)}m` : `${m}m`;
  }
  return `${km}km`;
}
