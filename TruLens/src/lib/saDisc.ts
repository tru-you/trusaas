/**
 * South African vehicle licence disc — PDF417 barcode parser.
 *
 * The disc on the windscreen carries a PDF417 barcode whose payload is a
 * plaintext, %-delimited string (unlike the driving-licence card, which is
 * encrypted). The documented field order around the vehicle details is:
 *
 *   … description, make, model, colour, VIN, engine, expiry(CCYY-MM-DD)
 *
 * Rather than trust absolute field offsets — which vary between disc versions
 * and reg authorities — we ANCHOR on the VIN (a 17-char code with a fixed
 * alphabet) and read the surrounding fields relative to it. That is far harder
 * to get wrong across disc variants.
 *
 * Everything returned is a best effort and every field the caller fills stays
 * editable: a scan should save typing, never lock in a wrong value.
 */

export interface DiscScan {
  make?: string;
  model?: string;
  colour?: string;
  vin?: string;
  engine?: string;
  registration?: string;
  description?: string;   // e.g. "Motorcar (excl. minibus...)"
  expiry?: string;        // CCYY-MM-DD as printed on the disc
  year?: number;          // derived from the VIN
  raw: string;            // the decoded payload, so an off parse is fixable
}

/** VIN alphabet excludes I, O, Q. 17 chars. */
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The VIN's 10th character encodes the model year. Codes cycle every 30
 *  years; we resolve to the most recent plausible year (used cars are recent,
 *  and a future year is impossible), which disambiguates the repeat. */
const YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005,
  '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

export function yearFromVin(vin?: string): number | undefined {
  if (!vin || vin.length < 10) return undefined;
  let y = YEAR_CODES[vin[9].toUpperCase()];
  if (!y) return undefined;
  // Resolve the 30-year cycle to the most recent year not in the future.
  const now = new Date().getFullYear();
  while (y > now) y -= 30;
  return y;
}

const clean = (s?: string) =>
  (s || '').trim().replace(/\s+/g, ' ') || undefined;

/**
 * Parse a decoded SA vehicle-disc payload. Returns whatever it can find;
 * `raw` always carries the decoded string so a mis-parse can be corrected.
 */
export function parseSaDisc(payload: string): DiscScan {
  const result: DiscScan = { raw: payload };
  if (!payload) return result;

  // Split on the % delimiter, keep non-empty trimmed fields in order.
  const fields = payload.split('%').map((f) => f.trim()).filter(Boolean);

  // Anchor: the VIN is the field matching the 17-char VIN shape.
  let vinIdx = fields.findIndex((f) => VIN_RE.test(f));

  if (vinIdx !== -1) {
    result.vin = fields[vinIdx];
    // Documented order: … description, make, model, colour, VIN, engine, …
    result.colour = clean(fields[vinIdx - 1]);
    result.model = clean(fields[vinIdx - 2]);
    result.make = clean(fields[vinIdx - 3]);
    result.description = clean(fields[vinIdx - 4]);
    result.engine = clean(fields[vinIdx + 1]);
  }

  // Expiry: the CCYY-MM-DD field (there may also be an issue date; take the
  // latest, which is the expiry).
  const dates = fields.filter((f) => DATE_RE.test(f)).sort();
  if (dates.length) result.expiry = dates[dates.length - 1];

  // Registration: a short plate-like field before the description, if present.
  if (vinIdx > 4) {
    const cand = fields[vinIdx - 5];
    if (cand && cand.length <= 10 && /[A-Z0-9]/i.test(cand)) result.registration = clean(cand);
  }

  result.year = yearFromVin(result.vin);
  return result;
}
