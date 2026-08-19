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

/**
 * Known vehicle makes as they print on the disc (UPPERCASE, no spaces/dashes
 * for matching). The disc's field order around the vehicle block drifts between
 * reg authorities — sometimes there's an extra class/series field or a blank
 * between the description and the VIN — so counting fixed offsets back from the
 * VIN lands make/model on the wrong (often empty) slot. Anchoring the make by
 * CONTENT is far more reliable: whichever field IS a known make is the make,
 * and model/series follow it. Anything not listed still falls back to the
 * positional read, so an unlisted make degrades, it doesn't break.
 */
const KNOWN_MAKES: string[] = [
  'TOYOTA', 'VOLKSWAGEN', 'VW', 'FORD', 'NISSAN', 'HYUNDAI', 'KIA', 'RENAULT',
  'SUZUKI', 'MAZDA', 'HONDA', 'MERCEDESBENZ', 'MERCEDES', 'BMW', 'AUDI',
  'ISUZU', 'MITSUBISHI', 'CHEVROLET', 'OPEL', 'PEUGEOT', 'CITROEN', 'FIAT',
  'LANDROVER', 'RANGEROVER', 'JEEP', 'VOLVO', 'DATSUN', 'CHERY', 'HAVAL',
  'GWM', 'MAHINDRA', 'TATA', 'PROTON', 'DAIHATSU', 'SUBARU', 'MINI',
  'PORSCHE', 'LEXUS', 'JAGUAR', 'ALFAROMEO', 'SSANGYONG', 'DODGE', 'CHRYSLER',
  'BENTLEY', 'FERRARI', 'LAMBORGHINI', 'MASERATI', 'ROLLSROYCE', 'ASTONMARTIN',
  'CADILLAC', 'HUMMER', 'INFINITI', 'SMART', 'SEAT', 'SKODA', 'FOTON', 'JAC',
  'BAIC', 'OMODA', 'JAECOO', 'BYD', 'CHANA', 'FORCE', 'HINO', 'SCANIA', 'MAN',
  'IVECO', 'FREIGHTLINER', 'FAW', 'POWERSTAR', 'GONOW', 'JMC', 'DFSK',
  'MG', 'LDV',
];
const MAKE_SET = new Set(KNOWN_MAKES);

/** Strip to letters+digits, uppercase — so "MERCEDES-BENZ" and "Mercedes Benz"
 *  both match "MERCEDESBENZ". */
const makeKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Is this field a recognised make (whole field, or its first word)? */
function makeMatch(field: string): boolean {
  const k = makeKey(field);
  if (!k) return false;
  if (MAKE_SET.has(k)) return true;
  const firstWord = makeKey(field.trim().split(/\s+/)[0] || '');
  return firstWord.length >= 2 && MAKE_SET.has(firstWord);
}

/** Colours as printed on the disc (often bilingual, e.g. "White / Wit"). We
 *  match if any word in the field is a known colour, so the model field isn't
 *  mistaken for colour and vice-versa. */
const COLOURS = new Set([
  'WHITE', 'WIT', 'BLACK', 'SWART', 'SILVER', 'SILWER', 'GREY', 'GRAY', 'GRYS',
  'BLUE', 'BLOU', 'RED', 'ROOI', 'GREEN', 'GROEN', 'YELLOW', 'GEEL', 'GOLD',
  'GOUD', 'BROWN', 'BRUIN', 'BEIGE', 'ORANGE', 'ORANJE', 'MAROON', 'PURPLE',
  'PERS', 'PINK', 'ROOS', 'BRONZE', 'BURGUNDY', 'CREAM', 'ROOM', 'CHARCOAL',
  'TURQUOISE', 'MULTICOLOUR', 'MULTICOLOR',
]);
function isColour(field: string): boolean {
  return field
    .toUpperCase()
    .split(/[^A-Z]+/)
    .some((w) => w && COLOURS.has(w));
}

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
    // Engine is the field straight after the VIN — that anchor is stable.
    result.engine = clean(fields[vinIdx + 1]);
  }

  // --- Make / model / series / colour ---------------------------------------
  // Prefer CONTENT over position: find the field that IS a known make. On the
  // disc the block reads roughly:  <class/description> <make> <model> <series>
  // <colour?> <VIN>. The number of fields between description and VIN drifts, so
  // once we've located the make by name, model and series are simply the next
  // non-empty fields, regardless of how far the VIN sits.
  const searchEnd = vinIdx === -1 ? fields.length : vinIdx; // don't scan the VIN/engine tail
  let makeIdx = -1;
  for (let i = 0; i < searchEnd; i++) {
    if (makeMatch(fields[i])) { makeIdx = i; break; }
  }

  if (makeIdx !== -1) {
    result.make = clean(fields[makeIdx]);
    // The class/description sits just before the make.
    if (makeIdx > 0) result.description = clean(fields[makeIdx - 1]);
    // The fields between the make and the VIN are model, series, and (on some
    // discs) colour. Colour is detected by content — a colour word — because
    // its position isn't reliable; whatever's left becomes the model (series
    // folded in, so "COROLLA 1.6" survives rather than dropping the variant).
    const between = fields
      .slice(makeIdx + 1, vinIdx === -1 ? makeIdx + 4 : vinIdx)
      .map((f) => f.trim())
      .filter(Boolean);
    const modelParts: string[] = [];
    for (const f of between) {
      if (!result.colour && isColour(f)) result.colour = clean(f);
      else modelParts.push(f);
    }
    if (modelParts.length) result.model = clean(modelParts.join(' '));
  } else if (vinIdx !== -1) {
    // Fallback to the documented positional layout for makes we don't list.
    // … description, make, model, colour, VIN, engine, …
    result.colour = clean(fields[vinIdx - 1]);
    result.model = clean(fields[vinIdx - 2]);
    result.make = clean(fields[vinIdx - 3]);
    result.description = clean(fields[vinIdx - 4]);
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
