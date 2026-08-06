/**
 * Vehicle make/model/trim tidy-up, shared by the server's write paths and the
 * admin backfill so the two can never drift.
 *
 * Two problems it fixes, both seen in live dealer data:
 *  1. Trailing / doubled whitespace from manual entry ("Volkswagen ",
 *     "Tiguan  2.0  TSI ").
 *  2. The SA licence-disc M&M model string. A disc's model field reads like
 *     "VW 370 - GOLF" (make abbreviation + M&M code + name); the disc scanner
 *     copies it in verbatim (title-cased to "Vw 370 - Golf"). It reaches the
 *     DMS via a TruLens push (TruInspect has the same scanner but does not push
 *     vehicles to the DMS), and nothing downstream cleaned it, so it landed in
 *     the DMS and on the dealer website with the make + code prefix attached.
 */

/** Collapse internal whitespace and trim. Non-strings pass through untouched. */
export function tidyStr(s: any): any {
  return typeof s === "string" ? s.trim().replace(/\s+/g, " ") : s;
}

/**
 * Strip the SA licence-disc M&M prefix from a model name, keeping only the name
 * after the "<abbrev> <code> -" part: "Vw 370 - Golf" -> "Golf", "Au 37x-a3" ->
 * "a3". Deliberately conservative — the shape it matches is 2-3 letters, a
 * space, a short alphanumeric code, then a dash. Real hyphenated or coded
 * models don't have that shape and are left untouched:
 *   CX-5, C-Class, X-Trail, A-Class  (no letters-space-code before the dash)
 *   3 Series                          (starts with a digit)
 *   Golf Sportsvan, Polo, Hilux       (no dash at all)
 * Anything that doesn't match is just whitespace-tidied.
 */
export function cleanModelName(model: any): any {
  const m = tidyStr(model);
  if (typeof m !== "string" || !m) return m;
  const mm = m.match(/^[A-Za-z]{2,3}\s+[A-Za-z0-9]{1,4}\s*-\s*(.+)$/);
  return mm ? tidyStr(mm[1]) : m;
}
