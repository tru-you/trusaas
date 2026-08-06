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

// ── Optional-extras normaliser ──────────────────────────────────
const EXTRAS_ALIASES: [RegExp, string][] = [
  [/\btow\s*-?\s*bar\b|\btow\s*-?\s*hitch\b/i, 'Towbar'],
  [/\bcarplay\b|\bandroid\s*auto\b|\bsmartphone\s*mirror/i, 'Apple CarPlay / Android Auto'],
  [/\bpdc\b|\bparking\s*sensor/i, 'Park Distance Control'],
  [/\bpark\s*assist\b/i, 'Park Distance Control'],
  [/\bsat\s*-?\s*nav\b|\bgps\b|\bbuilt.in\s*nav/i, 'Navigation'],
  [/\bbi.xenon\b|\bhid\b|\bled\s*head/i, 'LED / Xenon Headlights'],
  [/\breverse\s*cam|\brear\s*cam|\bback.up\s*cam/i, 'Reverse Camera'],
  [/\b360.?\s*cam/i, '360° Camera'],
  [/\bblind\s*spot/i, 'Blind Spot Monitor'],
  [/\blane\s*(keep|assist|depart)/i, 'Lane Assist'],
  [/\badaptive\s*cruise/i, 'Adaptive Cruise Control'],
  [/\bheated\s*seat/i, 'Heated Seats'],
  [/\belectric\s*seat|\bpower\s*seat/i, 'Electric Seats'],
  [/\bkeyless/i, 'Keyless Entry & Start'],
  [/\bdual.zone|\bclimate\s*control/i, 'Dual-Zone Climate Control'],
  [/\bsunroof|\bpanoramic/i, 'Sunroof / Panoramic Roof'],
  [/\balloy\s*wheel|\bmag\s*wheel/i, 'Alloy Wheels'],
  [/\broof\s*rail/i, 'Roof Rails'],
  [/\btint/i, 'Tinted Windows'],
  [/\bdigital\s*cockpit|\bvirtual\s*cockpit/i, 'Digital Cockpit'],
  [/\bawd\b|\b4wd\b|\b4x4\b|\ball.wheel/i, 'AWD / 4WD'],
  [/\bbluetooth/i, 'Bluetooth'],
];
const EXTRAS_DROP = /\bpower\s*steer|\belectric\s*window|\bcentral\s*lock|\b[ae]\.?b\.?s\b|\bairbag/i;
const LEATHER_YES = /\bleather\s*seat|\bfull\s*leather/i;
const LEATHER_NO = /\bpart.leather/i;

export function normaliseExtras(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = String(item || '').trim();
    if (!s || EXTRAS_DROP.test(s)) continue;
    let label = s;
    if (LEATHER_YES.test(s) && !LEATHER_NO.test(s)) {
      label = 'Leather Seats';
    } else {
      for (const [re, canonical] of EXTRAS_ALIASES) {
        if (re.test(s)) { label = canonical; break; }
      }
    }
    const key = label.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(label); }
  }
  return out.length ? out : undefined;
}
