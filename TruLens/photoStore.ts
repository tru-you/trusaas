/**
 * COPY. Canonical version lives in truflow-premium/photoStore.ts — edit there
 * and copy across, the same convention this repo already uses for brand.css and
 * assets/brand/tokens.css. The two apps build separately and there is no npm
 * workspace, so a shared import is not available yet; extracting these into one
 * package is Tier 4 work.
 *
 * Keep the two byte-identical below this header. A divergence here means the
 * same photo could be addressed differently by each product.
 */
/**
 * Photos as files, not as database rows.
 *
 * Every photo in this system is currently a base64 data URI stored inside
 * data.json. One vehicle with a full 22-shot capture makes its dealer's public
 * feed 3.4 MB and 2.9 seconds; readState() parses the whole file — every photo
 * of every car — on each of 58 request paths; and writeState() serialises it all
 * back on every save. That is the wall this system hits at its third dealer.
 *
 * Photos move to files here, and the state keeps a short path instead.
 *
 * **Content-addressed.** The filename is the SHA-256 of the bytes, so:
 *   - the same photo pushed twice is stored once, which matters because TruLens
 *     re-exports the entire capture every time a dealer adds one more shot;
 *   - a re-export is idempotent — identical bytes resolve to the identical path,
 *     so nothing is rewritten and no URL changes;
 *   - the URL can be cached permanently by the browser, because a given path can
 *     never point at different bytes.
 *
 * **Storage is deliberately behind this module.** Files land on the mounted disk
 * today, which costs nothing and is already provisioned. Moving to R2 or S3 later
 * means reimplementing `put` and `remove` here — not touching the 88 call sites
 * that handle photo arrays.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

/** Where the bytes live. Under DATA_DIR so they sit on the mounted disk and
 *  survive a deploy, exactly like data.json does. */
let MEDIA_DIR = "";

/** The URL prefix these are served from. Public and unauthenticated: they are
 *  dealer stock photos destined for public websites, and the path is an opaque
 *  hash, so it leaks nothing and is not enumerable. */
export const MEDIA_ROUTE = "/media";

export function initPhotoStore(dataDir: string) {
  MEDIA_DIR = path.join(dataDir, "media");
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  } catch (err) {
    console.error("[photoStore] could not create media dir:", err);
  }
  return MEDIA_DIR;
}

export function mediaDir() {
  return MEDIA_DIR;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** A stored reference looks like "/media/<64 hex>.<ext>". Deliberately strict:
 *  this is what decides whether a value gets rewritten on migration, and a loose
 *  test would let a data URI through as though it were already a file. */
const STORED_RE = new RegExp(`^${MEDIA_ROUTE}/[a-f0-9]{64}\\.[a-z0-9]{2,5}$`);

export function isStoredRef(value: unknown): value is string {
  return typeof value === "string" && STORED_RE.test(value);
}

export function isDataUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

/** Anything the system currently treats as "a photo" — either form. */
export function isPhotoValue(value: unknown): value is string {
  return isStoredRef(value) || isDataUri(value);
}

/**
 * Write a data URI to disk and return its stored path.
 *
 * Returns the input unchanged when it is already a stored reference, so callers
 * can run this over a whole vehicle repeatedly without checking first — which is
 * what makes the migration and the push path safe to re-run.
 *
 * Returns null for anything that is neither, rather than throwing: a malformed
 * entry in one photo slot should not fail an entire capture.
 */
export function put(value: unknown): string | null {
  if (isStoredRef(value)) return value;
  if (!isDataUri(value)) return null;

  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(value as string);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) return null; // not a media type we serve

  let buf: Buffer;
  try {
    buf = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
  if (!buf.length) return null;

  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const name = `${hash}.${ext}`;
  const dest = path.join(MEDIA_DIR, name);

  /* Existence is the dedupe: identical bytes hash identically, so a re-export of
     an unchanged capture rewrites nothing. */
  try {
    if (!fs.existsSync(dest)) {
      /* Written to a temp name and renamed, so a crash mid-write cannot leave a
         truncated file sitting at a hash that claims to be the whole photo —
         which would then be served forever, since the name implies the content. */
      const tmp = `${dest}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, dest);
    }
  } catch (err) {
    console.error("[photoStore] write failed:", err);
    return null;
  }

  return `${MEDIA_ROUTE}/${name}`;
}

/** Convert an array of photo values, keeping anything already usable.
 *
 *  A remote http(s) URL is a valid photo everywhere else in this system —
 *  isValidPhotoData accepts one, dealer sites and seed records carry them — but
 *  it is not ours to store, so put() returns null for it. An earlier version
 *  treated that null as "unusable" and dropped the entry, which meant any save
 *  carrying URL-backed images silently lost them. Only genuinely unusable
 *  values are discarded now. */
export function putAll(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    const ref = put(v);
    if (ref) { out.push(ref); continue; }
    if (isStoredRef(v)) { out.push(v); continue; }
    // Not ours to store, but still a real image the record should keep.
    if (typeof v === "string" && /^https?:\/\//i.test(v)) out.push(v);
  }
  return out;
}

/** Absolute path for a stored reference, or null if it is not one of ours.
 *  Rejects anything with a separator so a crafted value cannot escape the dir. */
export function resolveRef(ref: string): string | null {
  if (!isStoredRef(ref)) return null;
  const name = ref.slice(MEDIA_ROUTE.length + 1);
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return path.join(MEDIA_DIR, name);
}

/**
 * Read a stored reference back into a data URI.
 *
 * The export path between products still speaks base64: TruLens posts a
 * { slotId: dataUri } map to TruFlow's push-photos. Once photos are files on the
 * sending side, something has to reconstitute them, and doing it at the edge
 * keeps the wire format unchanged while both sides move independently.
 *
 * This is a transitional shape, not the destination — the destination is the
 * sender posting references and the receiver fetching them, which is what makes
 * the upload itself small. Until then this keeps exports working.
 */
export function toDataUri(ref: string): string | null {
  const file = resolveRef(ref);
  if (!file) return null;
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = Object.keys(EXT_BY_MIME).find((m) => EXT_BY_MIME[m] === ext);
  if (!mime) return null;
  try {
    return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Whatever form a value is in, give me a data URI. Passes data URIs straight
 *  through, so callers need not know which era a record came from. */
export function asDataUri(value: unknown): string | null {
  if (isDataUri(value)) return value as string;
  if (isStoredRef(value)) return toDataUri(value);
  return null;
}

/** Bytes currently on disk, for reporting migration progress. */
export function stats(): { files: number; bytes: number } {
  try {
    const names = fs.readdirSync(MEDIA_DIR);
    let bytes = 0;
    for (const n of names) {
      try {
        bytes += fs.statSync(path.join(MEDIA_DIR, n)).size;
      } catch {
        /* raced with a write; not worth failing a stats call over */
      }
    }
    return { files: names.length, bytes };
  } catch {
    return { files: 0, bytes: 0 };
  }
}
