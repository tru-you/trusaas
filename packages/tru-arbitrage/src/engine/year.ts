/**
 * Model-year extraction from classifieds card text.
 *
 * WHY THIS EXISTS — the bug it replaces:
 *
 * AutoTrader renders each listing tile's text with NO whitespace between
 * fields. A real card reads:
 *
 *   16R 669 000Fair Price2025 Toyota Hilux2.8GD-6 Raider autoUsed23 000 km
 *                        ^ no space
 *
 * The old pattern was /\b(19|20)\d{2}\b/. \b is a WORD boundary: between 'e'
 * (Price) and '2' (2025) both characters are word characters, so there is no
 * boundary and the pattern never matches. Measured across 800 live AutoTrader
 * cards spanning 5 make/models: 0 matches. Not degraded — non-functional.
 *
 * Worse, the caller treated "no match" as "no year filter needed", so every
 * card passed: a 2004 Hilux counted as a comp for a 2021 Hilux. That widened
 * the price IQR, which drove `tightness` to -0.1 in confidence.ts, which
 * pushed thin samples under CONFIDENCE_FLOOR — so deals silently stopped
 * firing. An empty deals board was the visible symptom; this was the cause.
 *
 * The fix uses DIGIT boundaries, not word boundaries: a year is a 4-digit run
 * in 19xx/20xx not preceded or followed by another digit. "Price2025" matches;
 * "2000cc" would too, so results are plausibility-checked AND the make-anchored
 * form is preferred (the year sits directly before the make name on AutoTrader
 * cards). Recovery: 31/32 cards.
 */

/** A plausible model year. Anchored low at 1995 (older than that is a
 *  different market) and one year ahead of today (new/announced stock). */
export function plausibleYear(year: number, now = new Date()): boolean {
  return Number.isFinite(year) && year >= 1995 && year <= now.getFullYear() + 1;
}

const MIN_YEAR = 1995;

/** Escape regex metacharacters so a literal make/model can be embedded. */
export function escapeRegex(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A 4-digit run in 19xx/20xx bounded by NON-digits (not word boundaries).
 * Global so callers can walk every candidate; lastIndex is always reset.
 */
const YEAR_RUN_RE = /(?<![0-9])(19[0-9]{2}|20[0-9]{2})(?![0-9])/g;

/** All plausible years in `text`, in document order. Never throws. */
export function allYears(text: string, now = new Date()): number[] {
  if (!text) return [];
  const out: number[] = [];
  YEAR_RUN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_RUN_RE.exec(text)) !== null) {
    const y = parseInt(m[1], 10);
    if (plausibleYear(y, now)) out.push(y);
  }
  YEAR_RUN_RE.lastIndex = 0;
  return out;
}

/**
 * The model year of a classifieds card.
 *
 * Preference order, because a card can carry several 4-digit runs (engine
 * capacity "2000cc", mileage, an image count):
 *   1. The year immediately preceding the make name — that is the card's
 *      title position on AutoTrader ("Price2025 Toyota Hilux"). Unambiguous.
 *   2. Otherwise the first plausible year in the text.
 *
 * Returns null when nothing plausible is present. Callers MUST treat null as
 * "year unknown" and decide explicitly — silently accepting (the old
 * behaviour) is how wrong-year comps entered every valuation.
 */
export function findCardYear(text: string, make?: string, now = new Date()): number | null {
  if (!text) return null;

  // 1. Make-anchored: "<year> <make>" (whitespace optional — cards concatenate).
  const makeKey = (make || '').trim();
  if (makeKey.length >= 2) {
    const anchored = new RegExp(
      `(?<![0-9])(19[0-9]{2}|20[0-9]{2})(?![0-9])\\s*${escapeRegex(makeKey)}`,
      'i',
    );
    const m = text.match(anchored);
    if (m) {
      const y = parseInt(m[1], 10);
      if (plausibleYear(y, now)) return y;
    }
  }

  // 2. First plausible year anywhere in the text.
  const years = allYears(text, now);
  return years.length ? years[0] : null;
}

/**
 * Does this card belong to the subject's year band?
 *
 * `tolerance` 0 = exact year only. Returns FALSE when the year is unknown —
 * an unreadable year must not widen a year-specific comp set. Verified cost:
 * 1 of 32 cards per page is unreadable (~3% of the sample).
 */
export function yearInBand(
  cardYear: number | null,
  subjectYear: number,
  tolerance: number,
): boolean {
  if (cardYear == null || !Number.isFinite(cardYear)) return false;
  if (!Number.isFinite(subjectYear) || subjectYear <= 0) return true;
  const tol = Math.max(0, Math.floor(tolerance || 0));
  return Math.abs(cardYear - subjectYear) <= tol;
}

export { MIN_YEAR };
