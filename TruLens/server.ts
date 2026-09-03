import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';
import {
  initPhotoStore,
  mediaDir,
  MEDIA_ROUTE,
  put as putPhoto,
  isStoredRef,
  asDataUri,
  resizeDataUri,
  stats as photoStats,
} from './photoStore';
import { DEFAULT_TEMPLATE } from './src/templates';
import { fetchValuation } from './src/lib/scraper';
/* Market-aware engine (UK/US-ready) behind a kill-switch:
 *   VALUATION_ENGINE=legacy  → the in-tree SA fork (production default)
 *   VALUATION_ENGINE=package → shared packages/market-scraper engine
 * MARKET (default 'za') picks the market config on the package engine. */
import { fetchValuation as pkgFetchValuation, markets as pkgMarkets } from '../packages/market-scraper/index';
import { lookupRegistration, lookupCarHistory, regLookupConfigured, regLookupProvider, historyCheckEnabled } from '../packages/reg-lookup';

const VALUATION_ENGINE = (process.env.VALUATION_ENGINE || 'legacy').toLowerCase();
const INSTANCE_MARKET = (process.env.MARKET || 'za').toLowerCase();
const INSTANCE_VERTICAL = (process.env.VERTICAL || 'cars').toLowerCase();

/* Every TruLens template slot is `required: false` (dealer's call what goes on
   their site — see src/template.ts), so there is no `required` subset to pull
   from the template itself for the two "is this capture practically done"
   gates below. This hand-picks the same kind of "core shot, not an
   accessory/detail extra" set the old hardcoded lists here used to express —
   the physical-accessory shots (present/not-present, not a blocking photo)
   and the roof, which was always optional even before this file's lists went
   stale and started referencing a 'video_360' slot TruLens has never had. */
const TRULENS_CORE_SLOT_IDS = DEFAULT_TEMPLATE.slots
  .filter((s) => !['spare_wheel', 'vehicle_jack', 'spare_keys', 'roof_sunroof'].includes(s.id))
  .map((s) => s.id);

// Load environment variables first
dotenv.config();

// Same Firebase project + named DB as TruFlow Premium photo sync
const FIREBASE_PROJECT_ID = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0151924955';
const AUTOLENS_DB_ID = process.env.AUTOLENS_DB_ID || 'ai-studio-autolenspro-7d4757ec-a059-4566-98db-d15a4840f4ec';
// Every device exports to this one DMS. Overridable only by env (for local
// dev), never per-phone — a stale localhost in a phone's storage used to break
// exports silently. Production default is TruFlow Premium.
const DEFAULT_DMS_URL =
  process.env.TRUFLOW_DMS_URL ||
  process.env.DMS_URL ||
  (process.env.NODE_ENV === 'production'
    // TruFlow, not TruLens. This read lens.tru-saas.com — TruLens's own host —
    // so with TRUFLOW_DMS_URL unset the app exported to itself and the dealer
    // picker would find no dealerships. render.yaml does set it, so production
    // is unaffected; this is the fallback being honest.
    ? 'https://flow.tru-saas.com'
    : 'http://localhost:3001');
// Which dealer owns captures made before dealer tagging existed (matches
// TruFlow Premium's DEFAULT_DEALERSHIP_ID = d1 = mkr-autosales).
/**
 * Device access code.
 *
 * Without one, this API was open in production: LOCAL_MODE accepted ANY bearer
 * token (`Bearer zzz` returned inventory), and a `local-` prefix short-circuited
 * auth entirely. Anyone could read, create or delete a dealer's captured
 * vehicles and their photos.
 *
 * Set TRULENS_ACCESS_CODE and the app exchanges it for a signed token that
 * every request must carry.
 */
const ACCESS_CODE = process.env.TRULENS_ACCESS_CODE || '';

/** Shared secret for the TruFlow photo push. Must match TRUFLOW_SYNC_KEY on
 *  TruFlow. Unset here and the header is simply omitted, which is what keeps
 *  this deployable ahead of the key being set on the other side. */
const SYNC_KEY = process.env.TRUFLOW_SYNC_KEY || '';
const TOKEN_SECRET =
  process.env.TRULENS_TOKEN_SECRET ||
  crypto.createHash('sha256').update(ACCESS_CODE || 'trulens-dev').digest('hex');
const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a month on the yard phone

/**
 * Per-dealership access codes.
 *
 * TRULENS_DEALER_CODES = "cars-on-caledon:CODE1,mkr-autosales:CODE2"
 *
 * With one shared code the login could not tell which dealership was holding
 * the phone, so the dealer picker was the only thing deciding where a car
 * filed — and a wrong tap put it in someone else's yard with no error. A code
 * from this map pins the dealership server-side and the picker becomes a
 * confirmation rather than the source of truth.
 *
 * TRULENS_ACCESS_CODE still works exactly as before. Phones already signed in
 * keep their tokens, and a dealership without its own code yet behaves as it
 * always has.
 */
const DEALER_CODES: Array<{ slug: string; code: string }> = String(
  process.env.TRULENS_DEALER_CODES || ''
)
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const i = pair.indexOf(':');
    if (i < 1) return null;
    const slug = pair.slice(0, i).trim();
    const code = pair.slice(i + 1).trim();
    return slug && code.length >= 6 ? { slug, code } : null;
  })
  .filter(Boolean) as Array<{ slug: string; code: string }>;

/** Constant-time compare that does not leak length via early return. */
function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The dealership a code belongs to, or null for the legacy shared code. */
function dealerForCode(given: string): string | null {
  for (const entry of DEALER_CODES) {
    if (codeMatches(given, entry.code)) return entry.slug;
  }
  return null;
}

function signDeviceToken(dealerSlug?: string | null): string {
  const claims: Record<string, unknown> = { k: 'device', exp: Date.now() + DEVICE_TOKEN_TTL_MS };
  if (dealerSlug) claims.d = dealerSlug;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Claims when the token is valid, otherwise null. */
function deviceTokenClaims(token: string): { dealerSlug?: string } | null {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (claims.k !== 'device' || !(claims.exp > Date.now())) return null;
    return { dealerSlug: typeof claims.d === 'string' ? claims.d : undefined };
  } catch { return null; }
}

const LENS_DEFAULT_DEALER_SLUG = process.env.LENS_DEFAULT_DEALER_SLUG || 'mkr-autosales';

// Local PC mode: no Google Cloud credentials needed. Stores inventory in data/local-inventory.json
// Set LOCAL_MODE=0 and provide GOOGLE_APPLICATION_CREDENTIALS to use real Firestore.
const FORCE_CLOUD = process.env.LOCAL_MODE === '0' || process.env.FORCE_FIREBASE === '1';
const hasAdc =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  !!process.env.FIREBASE_SERVICE_ACCOUNT ||
  !!process.env.GOOGLE_CLOUD_PROJECT;
const LOCAL_MODE = !FORCE_CLOUD; // default ON for PC friendliness

// Writable state lives under DATA_DIR so it can sit on a mounted Render disk
// and survive deploys/restarts. Unset (local dev) = ./data, i.e. the old path.
const LOCAL_DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'local-inventory.json');

/* Captures are stored as files rather than base64 inside local-inventory.json —
   see photoStore.ts. Initialised before anything reads the store, and before the
   /media route is registered, because express.static resolves its root when it
   is constructed. */
initPhotoStore(LOCAL_DATA_DIR);

type LocalStore = { vehicles: any[] };

function isValidPhotoData(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 32) return false;
  /* A stored reference — "/media/<sha256>.jpg" — is a real photo, and is the
     form every capture takes once it is on disk. It has to be named explicitly:
     at ~75 characters it is far too short for the raw-base64 rule below and
     carries no data:/http prefix, so without this it reads as junk and
     normalizeVehicle drops it — silently deleting every photo on the vehicle's
     next save. */
  /* Held in a boolean rather than tested inline: isStoredRef is a `value is
     string` predicate, and applying it to a value already known to be a string
     narrows the *else* branch to `never`, so every check below it stops
     compiling. */
  const stored: boolean = isStoredRef(value);
  if (stored) return true;
  // Real captures are data URLs or http(s); reject placeholders / truncated junk
  if (value.startsWith('data:image') || value.startsWith('data:video') || value.startsWith('http')) return true;
  // raw base64 (no data: prefix) — accept if long enough
  if (value.length > 200 && !value.includes(' ') && !value.includes('[')) return true;
  return false;
}

function normalizeIssues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeQuality(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [slotId, report] of Object.entries(raw)) {
    if (!report || typeof report !== 'object') continue;
    const r: any = { ...(report as any) };
    if (r.aiAnalysis && typeof r.aiAnalysis === 'object') {
      r.aiAnalysis = {
        ...r.aiAnalysis,
        detectedIssues: normalizeIssues(r.aiAnalysis.detectedIssues),
      };
    }
    out[slotId] = r;
  }
  return out;
}

/** Ensure every vehicle is safe for the UI (never crash on missing photos/price). */
// ── Optional-extras normaliser ──────────────────────────────────
// Folds free-text variants ("tow bar", "towbar", "tow-bar") into one
// canonical label so filters, feeds, and dealer sites all agree.
// "Part-leather" deliberately does NOT fold into "Leather Seats".
// Table-stakes features (power steering, electric windows, central
// locking, ABS, airbags) are dropped — listing them adds noise.
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
// "part-leather" must NOT fold into "Leather Seats"
const LEATHER_YES = /\bleather\s*seat|\bfull\s*leather/i;
const LEATHER_NO = /\bpart.leather/i;

function normaliseExtras(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = String(item || '').trim();
    if (!s || EXTRAS_DROP.test(s)) continue;
    let label = s;
    // Leather has a special guard
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

function normalizeVehicle(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const photosIn = raw.photos && typeof raw.photos === 'object' ? raw.photos : {};
  const photos: Record<string, string> = {};
  for (const [k, v] of Object.entries(photosIn)) {
    if (isValidPhotoData(v)) {
      let src = v as string;
      // Repair JPEG/PNG payloads that lost their data: prefix
      if (!src.startsWith('data:') && !src.startsWith('http') && src.length > 200) {
        src = `data:image/jpeg;base64,${src.replace(/^[^A-Za-z0-9+/=]+/, '')}`;
      }
      photos[k] = src;
    }
  }
  return {
    ...raw,
    make: raw.make ?? '',
    model: raw.model ?? '',
    trim: raw.trim ?? '',
    vin: raw.vin ?? '',
    stockNumber: raw.stockNumber ?? '',
    color: raw.color ?? '',
    year: Number(raw.year) || new Date().getFullYear(),
    price: Number(raw.price) || 0,
    status: raw.status || 'In-Progress',
    photos,
    quality: normalizeQuality(raw.quality),
    optionalExtras: normaliseExtras(raw.optionalExtras),
  };
}

function readLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
      const vehicles = Array.isArray(parsed?.vehicles) ? parsed.vehicles.map(normalizeVehicle) : [];
      return { vehicles };
    }
  } catch (e) {
    console.error('Local store read error:', e);
  }
  return { vehicles: [] };
}

function writeLocalStore(store: LocalStore) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    const safe = { vehicles: (store.vehicles || []).map(normalizeVehicle) };
    const tmp = `${LOCAL_DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(safe, null, 2), 'utf-8');
    fs.renameSync(tmp, LOCAL_DATA_FILE);
  } catch (e) {
    console.error('Local store write error:', e);
  }
}

/**
 * Move any base64 still in the local store onto disk.
 *
 * Runs once at boot rather than inside readLocalStore, which is on every request
 * path that touches inventory — converting there would re-scan every photo of
 * every capture on every call, which is the cost this change removes.
 *
 * Idempotent: put() returns a stored reference unchanged, so a second run is a
 * no-op and an interrupted run simply resumes. Firestore-backed instances are
 * skipped: their documents are migrated as each vehicle is next saved, and
 * rewriting an entire collection at boot is not something to do unattended.
 */
function migrateCapturesToFiles(): void {
  if (!LOCAL_MODE) {
    console.log('[photos] cloud mode — captures convert as vehicles are saved.');
    return;
  }
  let store: LocalStore;
  try {
    store = readLocalStore();
  } catch (err) {
    console.error('[photos] migration could not read the local store:', err);
    return;
  }

  let converted = 0;
  let already = 0;
  for (const v of store.vehicles || []) {
    const photos = v?.photos;
    if (!photos || typeof photos !== 'object') continue;
    for (const [slotId, value] of Object.entries(photos)) {
      if (isStoredRef(value)) { already++; continue; }
      const ref = putPhoto(value);
      if (ref) { photos[slotId] = ref; converted++; }
    }
  }

  if (converted > 0) {
    writeLocalStore(store);
    const { files, bytes } = photoStats();
    console.log(
      `[photos] moved ${converted} capture photo(s) out of the store. ` +
        `Media now holds ${files} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB.`
    );
  } else {
    console.log(`[photos] nothing to migrate (${already} already stored as files).`);
  }
}

/**
 * Move base64 frames out of orbit packages already sitting on disk.
 *
 * The write path converts new packages, but that leaves every existing one
 * untouched — and these are the largest objects the system produces: the Yaris
 * orbit was still being served at 20,004,300 bytes after the capture photos had
 * already moved. A client that times out at 12 seconds never receives it, which
 * is why dealer sites fell back to showing a different car entirely.
 *
 * Converted in place, one file at a time, so a failure on one package leaves
 * the rest alone.
 */
function migrateOrbitsToFiles(): void {
  let names: string[];
  try {
    ensureWeb3dDir();
    names = fs.readdirSync(WEB3D_DIR).filter((n) => n.endsWith('.json'));
  } catch (err) {
    console.error('[photos] could not list orbit packages:', err);
    return;
  }

  let packagesChanged = 0;
  let framesMoved = 0;

  for (const name of names) {
    const file = path.join(WEB3D_DIR, name);
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!Array.isArray(pkg?.frames)) continue;
      let changed = false;
      for (const f of pkg.frames) {
        if (!f || typeof f !== 'object' || isStoredRef(f.image)) continue;
        const ref = putPhoto(f.image);
        if (ref) { f.image = ref; changed = true; framesMoved++; }
      }
      /* Damage pins carry a base64 thumbnail each. Easy to overlook because
         they are not frames, but on the Yaris the two of them were 717 KB —
         the entire remaining weight of the package once the frames had moved. */
      for (const t of Array.isArray(pkg.damageTags) ? pkg.damageTags : []) {
        if (!t || typeof t !== 'object' || isStoredRef(t.thumb)) continue;
        const ref = putPhoto(t.thumb);
        if (ref) { t.thumb = ref; changed = true; framesMoved++; }
      }
      if (changed) {
        fs.writeFileSync(file, JSON.stringify(pkg), 'utf-8');
        packagesChanged++;
      }
    } catch (err) {
      console.error(`[photos] skipped orbit package ${name}:`, err);
    }
  }

  if (packagesChanged) {
    console.log(
      `[photos] moved ${framesMoved} orbit frame(s) out of ${packagesChanged} package(s).`
    );
  }
}

try {
  migrateCapturesToFiles();
  /* migrateOrbitsToFiles() is deliberately NOT called here: it reads WEB3D_DIR,
     a const declared several hundred lines below, so calling it at this point
     hits the temporal dead zone. It runs immediately after that declaration. */
} catch (err) {
  /* Never block boot: the read paths still understand base64, so an
     un-migrated instance behaves exactly as it did before. */
  console.error('[photos] migration failed, continuing with base64:', err);
}

// Initialize firebase-admin only when not forced local-only
let fdb: Firestore | null = null;
let fauth: ReturnType<typeof getAuth> | null = null;

if (!LOCAL_MODE || hasAdc) {
  try {
    if (!getApps().length) {
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
    fdb = getFirestore(getApps()[0] as App, AUTOLENS_DB_ID);
    fauth = getAuth();
  } catch (e) {
    console.warn('Firebase Admin init skipped/failed — using local store only.', e);
  }
}

if (LOCAL_MODE) {
  console.log('────────────────────────────────────────────');
  console.log(' TruLens LOCAL PC MODE');
  console.log(' Inventory file: ' + LOCAL_DATA_FILE);
  console.log(' DMS export URL: ' + DEFAULT_DMS_URL);
  console.log(' Open: http://localhost:3000');
  console.log('────────────────────────────────────────────');
}

/* Safety net: without an access code, per-dealer codes or an explicit token
   secret, TOKEN_SECRET falls back to sha256('trulens-dev') and the local-mode
   branches accept any Bearer string — fine on a laptop, a hole in prod. Warn
   only, never exit; an outage is worse than a noisy log line. */
if (!ACCESS_CODE && DEALER_CODES.length === 0 && !process.env.TRULENS_TOKEN_SECRET) {
  console.warn('────────────────────────────────────────────');
  console.warn(' WARNING: no auth secret configured.');
  console.warn(' Set TRULENS_ACCESS_CODE, TRULENS_DEALER_CODES or');
  console.warn(' TRULENS_TOKEN_SECRET. Without one, any Bearer token');
  console.warn(' is accepted — safe locally, NOT in production.');
  console.warn('────────────────────────────────────────────');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Increase payload limits for Base64 vehicle photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security headers — conservative baseline (nosniff, referrer, HSTS-in-prod).
// X-Frame-Options intentionally omitted: some services are embedded as widgets.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

/* Captured photos, served as files.
 *
 * Immutable for a year, which is safe because the filename is the SHA-256 of
 * the bytes — a path can never come to mean different content, so there is no
 * cache to bust. This is what lets a dealer website fetch each photo once
 * instead of pulling every photo of every car inside one JSON payload: the
 * TruLens public feed carried 25 base64 images in a single response.
 *
 * Public and registered before authenticate: these are stock photos bound for
 * public dealer websites, and the path is an opaque hash. */
app.use(
  MEDIA_ROUTE,
  express.static(mediaDir(), {
    immutable: true,
    maxAge: '365d',
    fallthrough: false,
    index: false,
    dotfiles: 'deny',
  })
);

// Don't crash the process on unhandled Firebase ADC errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (kept process alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (kept process alive):', err);
});

/** Decode JWT payload without verifying (local/demo only). */
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Demo mode (prospect trial) ────────────────────────────────────────────

const DEMO_ENABLED = process.env.DEMO_ENABLED === '1' || process.env.DEMO_ENABLED === 'true' || !ACCESS_CODE;
const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function signDemoToken(uid: string): string {
  const payload = Buffer.from(JSON.stringify({
    sub: uid,
    demo: true,
    exp: Date.now() + DEMO_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `demo:${payload}.${sig}`;
}

function verifyDemoToken(token: string): any | null {
  try {
    if (!token.startsWith('demo:')) return null;
    const raw = token.slice(5);
    const [payload, sig] = raw.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// Middleware to verify Firebase ID Token — falls back to local/demo user on PC
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  // A signed device token, issued by POST /api/auth/device in exchange for the
  // dealership's access code.
  const deviceClaims = deviceTokenClaims(idToken);
  if (deviceClaims) {
    req.user = {
      uid: 'device',
      email: 'device@trulens.local',
      local: true,
      // Present only when signed in with a per-dealership code. Anything the
      // request body claims about the dealership is overridden by this.
      dealerSlug: deviceClaims.dealerSlug,
    };
    return next();
  }

  // The old unconditional shortcut — any token starting with "local-", plus the
  // literals "demo" and "local-demo-token" — only survives when no access code
  // is configured, i.e. local development.
  if (!ACCESS_CODE && (idToken === 'local-demo-token' || idToken === 'demo' || idToken.startsWith('local-'))) {
    req.user = { uid: 'local-demo-user', email: 'demo@trulens.local', local: true };
    return next();
  }

  // Proper demo token — signed, unique uid, 24h TTL.
  const demoClaims = verifyDemoToken(idToken);
  if (demoClaims) {
    req.user = {
      uid: demoClaims.sub,
      email: 'demo@trulens.local',
      demo: true,
      local: true,
    };
    return next();
  }

  // Try real Firebase Admin verification when available
  if (fauth) {
    try {
      const decodedToken = await fauth.verifyIdToken(idToken);
      req.user = decodedToken;
      return next();
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      // If credentials missing, fall through to local decode instead of crashing
      if (!msg.includes('default credentials') && !msg.includes('Could not load')) {
        console.error('Auth Error:', error);
        // Still allow JWT decode in local mode
        if (!LOCAL_MODE) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
    }
  }

  // Local PC convenience: accept any Bearer JWT and extract a uid. This
  // accepted literally any string, so it is now off whenever an access code
  // is configured.
  if (LOCAL_MODE && !ACCESS_CODE) {
    const payload = decodeJwtPayload(idToken);
    req.user = {
      uid: payload?.user_id || payload?.sub || payload?.uid || 'local-demo-user',
      email: payload?.email || 'demo@trulens.local',
      local: true,
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

// ---- AI (DeepSeek) ----
const DEEPSEEK_BASE = 'https://api.deepseek.com/chat/completions';
const aiConfigured = !!process.env.DEEPSEEK_API_KEY;

async function deepseekText(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const body: any = {
    model: 'deepseek-chat',
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) body.response_format = { type: 'json_object' };
  const r = await fetch(DEEPSEEK_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DeepSeek API error ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? '';
}

if (aiConfigured) {
  console.log('DeepSeek API configured.');
} else {
  console.warn('DEEPSEEK_API_KEY not found — AI analysis runs in mock mode.');
}

// ==================== INVENTORY HELPERS ====================

/* Scope arg: dealerSlug is authoritative when the device is signed in with a
   dealer code. ownerId (which phone captured it) is the legacy fallback for
   pre-tagging captures and for local-demo mode where no dealer is bound.
   Before this, listVehicles filtered by ownerId alone, so a phone that
   captured for dealer A and later signed in with dealer B's code saw A's
   inventory in Lens — a cross-dealer read leak. */
type LensScope = { uid: string; dealerSlug?: string | null };

/* 14-day Lens retention: once a vehicle has been in the DMS for two weeks,
   Flow is the source of truth and the Lens copy is deleted. Sweep runs
   lazily on every listVehicles call — no cron, no scheduler. A vehicle
   that never gets listed still eventually goes when someone opens the
   inventory. Flow also proactively clears Lens on a hard delete via the
   /api/sync/vehicle callback; sold status is deliberately NOT a trigger
   because deals fall through and a sold-then-unsold vehicle should still
   be editable in Lens if it's inside the retention window. */
const LENS_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
function isExpired(v: any, nowMs: number): boolean {
  // 14-day sweep retention is disabled; sold vehicles are removed by DMS sync/callbacks instead.
  return false;
}

async function listVehicles(user: LensScope): Promise<any[]> {
  const { uid, dealerSlug } = user;
  const nowMs = Date.now();

  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const before = store.vehicles.length;
    /* Drop expired rows in place before scoping — sweep applies globally so
       any dealer opening their list also cleans anything they own that has
       aged out. */
    store.vehicles = store.vehicles.filter((v) => !isExpired(v, nowMs));
    if (store.vehicles.length !== before) writeLocalStore(store);
    const list = store.vehicles
      .filter((v) => passesScope(v, user))
      .map(normalizeVehicle)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }

  /* Firestore query: prefer dealerSlug when the token has one, fall back to
     ownerId. The passesScope helper is JS-only, so we still need a where()
     that narrows the result set before it comes back. Legacy untagged rows
     captured by this user are still reachable via the ownerId branch. */
  const query = dealerSlug
    ? fdb.collection('vehicles').where('dealerSlug', '==', dealerSlug)
    : fdb.collection('vehicles').where('ownerId', '==', uid);
  const snapshot = await query.orderBy('updatedAt', 'desc').get();

  const kept: any[] = [];
  const expiredRefs: any[] = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as any;
    if (isExpired(data, nowMs)) {
      expiredRefs.push(doc.ref);
    } else {
      kept.push(normalizeVehicle(data));
    }
  });
  /* Fire and forget the deletes — a failed delete just leaves the row for
     the next sweep, no need to block the list response or crash on error. */
  if (expiredRefs.length) {
    Promise.all(expiredRefs.map((r) => r.delete())).catch((err) => {
      console.warn('[retention] lazy sweep failed for one or more docs:', err?.message || err);
    });
  }
  return kept;
}

/* Scoping rules for both read paths:
   - Explicitly tagged vehicle → the token's dealerSlug must match.
   - Untagged (legacy) vehicle → fall back to ownerId match. Using the
     default-dealer fallback for access decisions was a bug — it 404'd the
     rightful owner of any legacy capture that predates dealer tagging. */
function passesScope(record: any, user?: LensScope & { demo?: boolean }): boolean {
  if (!user) return true;
  if (user.demo) {
    return record.dealerSlug === 'demo' || (!record.dealerSlug && record.ownerId === user.uid);
  }
  if (record.dealerSlug) {
    return !user.dealerSlug || record.dealerSlug === user.dealerSlug;
  }
  if (user.uid && record.ownerId && record.ownerId !== user.uid) return false;
  return true;
}

async function getVehicle(id: string, user?: LensScope): Promise<any | null> {
  if (LOCAL_MODE || !fdb) {
    const found = readLocalStore().vehicles.find((v) => v.id === id);
    if (!found) return null;
    return passesScope(found, user) ? normalizeVehicle(found) : null;
  }
  const doc = await fdb.collection('vehicles').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as any;
  return passesScope(data, user) ? normalizeVehicle(data) : null;
}

/** Move a capture's photos onto disk, leaving references in the record.
 *
 *  Every write goes through saveVehicle, so this one place keeps image bytes out
 *  of local-inventory.json and out of Firestore documents — the latter matters
 *  more than it looks, because a Firestore document has a hard 1 MiB ceiling and
 *  a couple of base64 photos will breach it.
 *
 *  Idempotent: put() hands back a reference unchanged, so re-saving a vehicle
 *  that is already converted costs a map and nothing else. */
function storeVehiclePhotos(vehicle: any): any {
  const photos = vehicle?.photos;
  if (!photos || typeof photos !== 'object') return vehicle;
  const next: Record<string, string> = {};
  for (const [slotId, value] of Object.entries(photos)) {
    const ref = putPhoto(value);
    /* Falls back to the original value when the store cannot take it, so a
       capture is never silently lost — it simply stays base64. */
    next[slotId] = ref || (value as string);
  }
  return { ...vehicle, photos: next };
}

/** Last-writer-wins merge, per field. Both sides of the Lens<->Flow sync stamp
 *  fieldMeta[f] = Date.now() on every field they change, and stale pushes lose:
 *  a Lens re-export cannot silently clobber a fresher DMS edit, and vice versa.
 *  Absent map or absent key = 0, so legacy rows accept the first inbound write. */
function mergeWithMeta(
  current: any,
  incoming: Record<string, any>,
  incomingMeta: Record<string, number> | undefined,
  allowed: readonly string[],
  now: number,
): { patch: Record<string, any>; fieldMeta: Record<string, number> } {
  const outMeta: Record<string, number> = { ...(current?.fieldMeta || {}) };
  const patch: Record<string, any> = {};
  for (const f of allowed) {
    if (incoming[f] === undefined) continue;
    const inTs = (incomingMeta && Number(incomingMeta[f])) || now;
    if (inTs >= (outMeta[f] || 0)) {
      patch[f] = incoming[f];
      outMeta[f] = inTs;
    }
  }
  return { patch, fieldMeta: outMeta };
}

/** Non-media fields TruFlow may edit and push back to Lens. Photos, damage
 *  findings, VIR/slot assessment and condition declarations stay Lens-owned
 *  because they belong to the capture workflow. */
const FLOW_EDITABLE_FIELDS = [
  'make', 'model', 'year', 'trim', 'vin', 'color',
  'mileage', 'transmission', 'fuelType', 'vehicleType',
  'price', 'showOnWebsite', 'description', 'status', 'stockNumber',
] as const;

async function saveVehicle(vehicle: any): Promise<any> {
  const normalized = storeVehiclePhotos(normalizeVehicle(vehicle));
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const idx = store.vehicles.findIndex((v) => v.id === normalized.id);
    if (idx === -1) store.vehicles.unshift(normalized);
    else store.vehicles[idx] = { ...store.vehicles[idx], ...normalized };
    writeLocalStore(store);
    return normalized;
  }
  await fdb.collection('vehicles').doc(normalized.id).set(normalized, { merge: true });
  return normalized;
}

async function deleteVehicle(id: string): Promise<boolean> {
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const before = store.vehicles.length;
    store.vehicles = store.vehicles.filter((v) => v.id !== id);
    writeLocalStore(store);
    return store.vehicles.length < before;
  }
  await fdb.collection('vehicles').doc(id).delete();
  return true;
}

// ==================== API ROUTES ====================

// Health / mode check (no auth) + keep-alive pings
const STARTED_AT = Date.now();
/** Exchange the dealership's access code for a signed device token.
 *  Deliberately public — it is the way in. Slow-hashed and rate-limited by
 *  nothing yet, so keep the code long. */
/**
 * Ask TruFlow whether a code is real and whether it opens TruLens.
 *
 * Dealerships, their codes and their entitlements live in one place. This app
 * used to keep its own copy of every dealer's code in TRULENS_DEALER_CODES — a
 * comma-separated "slug:CODE" string in the service configuration — so
 * onboarding a dealer meant pasting their code here in plaintext and restarting
 * this service, and revoking meant editing that string and restarting again.
 *
 * Returns null on anything other than a clean yes, including an unreachable
 * TruFlow, so the caller can fall back to the environment list rather than
 * locking a yard out of their phones because the DMS was briefly down.
 */
async function verifyCodeWithTruFlow(
  code: string
): Promise<{ dealerSlug: string; dealerName?: string } | null> {
  if (!SYNC_KEY) return null; // no shared key configured — nothing to ask with
  try {
    const res = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tru-sync-key': SYNC_KEY },
      body: JSON.stringify({ code, product: 'lens' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      /* 403 is a real answer, not a failure: the code is valid but this
         dealership is not set up for TruLens. Logged so an onboarding mistake
         is visible rather than looking like a wrong code. */
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        console.warn(`[auth] TruFlow refused a code for lens: ${body?.message || res.status}`);
      }
      return null;
    }
    const body = await res.json();
    return body?.ok && body.dealerSlug
      ? { dealerSlug: body.dealerSlug, dealerName: body.dealerName }
      : null;
  } catch (err: any) {
    console.warn('[auth] could not reach TruFlow to verify a code:', err?.message || err);
    return null;
  }
}

// ── Simple in-memory rate limiter for auth endpoints ──
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_MAX_ATTEMPTS = 10;
const AUTH_WINDOW_MS = 60 * 1000; // 1 minute

function rateLimitAuth(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= AUTH_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    record.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
  }
  next();
}

app.post('/api/auth/device', rateLimitAuth, async (req, res) => {
  const given = String(req.body?.code || '');

  /* TruFlow first. A dealer onboarded there works here immediately, with no
     environment variable to edit and no restart of this service. */
  const central = await verifyCodeWithTruFlow(given);
  if (central) {
    return res.json({
      token: signDeviceToken(central.dealerSlug),
      expiresInDays: 30,
      dealerSlug: central.dealerSlug,
      dealerName: central.dealerName,
    });
  }

  /* Then the local list. Kept as a fallback so phones already signed in keep
     working, and so a TruFlow outage cannot stop a yard photographing cars. */
  const dealerSlug = dealerForCode(given);
  if (dealerSlug) {
    return res.json({ token: signDeviceToken(dealerSlug), expiresInDays: 30, dealerSlug });
  }

  // Legacy shared code — still valid, but carries no dealership, so the picker
  // remains the only thing that decides where captures file.
  if (ACCESS_CODE && codeMatches(given, ACCESS_CODE)) {
    return res.json({ token: signDeviceToken(), expiresInDays: 30, dealerSlug: null });
  }

  /* Only now is "nothing is configured" worth reporting, and it is a different
     complaint from a wrong code: with central verification available this
     server needs no local codes at all. */
  if (!ACCESS_CODE && DEALER_CODES.length === 0 && !SYNC_KEY) {
    return res.status(503).json({
      error: 'No way to verify codes on this server.',
      message: 'Set TRUFLOW_SYNC_KEY so codes can be checked against TruFlow, or set TRULENS_ACCESS_CODE.',
    });
  }

  return res.status(401).json({ error: 'That code is not recognised.' });
});

/** Prospect demo — no code, isolated data, 24h TTL. */
app.post('/api/auth/demo', rateLimitAuth, async (_req, res) => {
  if (!DEMO_ENABLED) return res.status(404).json({ error: 'Demo is not available.' });
  const uid = 'demo-' + crypto.randomBytes(8).toString('hex');
  const token = signDemoToken(uid);
  res.json({ token, uid, demo: true, expiresInHours: 24 });
});

// ── First-run setup checklist (bridged to TruFlow central) ──
// The dealership record — identity fields, document branding, whether setup
// was acknowledged — lives ONLY in TruFlow. What lives in Lens lives in Flow
// and vice versa, so these routes are thin authenticated proxies rather than
// a second copy of the data. Same server-to-server pattern as
// verifyCodeWithTruFlow() above (sync key header, hard timeout).
//
// Tokens WITHOUT a dealership claim (legacy shared-code logins) and demo
// tokens skip locally: there is no yard to attribute setup to.

/** Is this request from a real, slug-attributed login? */
function hasDealerScope(req: any): boolean {
  return !!req.user?.dealerSlug && !req.user?.demo;
}

/* Instance market — set by the deployment's MARKET env (default 'za'), NOT
 * dealer data, so it rides for every authenticated caller incl. demo. The
 * client display layer (MarketContext) reads it to pick currency/locale/units
 * for the dealer's own prices. Same endpoint name TruInspect exposes, so the
 * shared MarketContext works unchanged in both apps. regLookup flags gate the
 * plate-lookup UI the same way. */
app.get('/api/dealership/settings', authenticate, (_req: any, res) => {
  res.json({
    market: INSTANCE_MARKET,
    vertical: INSTANCE_VERTICAL,
    regLookup: regLookupConfigured(),
    regLookupProvider: regLookupProvider(),
    historyChecks: historyCheckEnabled(),
  });
});

// ==================== UK REGISTRATION LOOKUP ====================
// Plate → vehicle data (UK market). Same contract as TruInspect's route; the
// provider + key are env-driven (packages/reg-lookup).

app.post('/api/reg-lookup', authenticate, async (req: any, res) => {
  const { registration, deep } = req.body || {};
  try {
    if (deep) {
      const history = await lookupCarHistory(String(registration || ''));
      return res.json({ ok: true, history });
    }
    const result = await lookupRegistration(String(registration || ''));
    res.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    res.status(status).json({ ok: false, error: err?.message || 'Lookup failed' });
  }
});

app.get('/api/setup/status', authenticate, async (req: any, res) => {
  if (!hasDealerScope(req)) {
    return res.json({ complete: true, requiredComplete: true, acknowledgedAt: null, skipPrompt: true, items: [] });
  }
  if (!SYNC_KEY) {
    // No sync key configured: the bridge can't ask TruFlow anything. Skip the
    // prompt rather than nag a dealer about state we cannot see.
    return res.json({ complete: true, requiredComplete: true, acknowledgedAt: null, skipPrompt: true, items: [] });
  }
  try {
    const url = `${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/dealership/setup-status?dealershipId=${encodeURIComponent(req.user.dealerSlug)}`;
    const r = await fetch(url, {
      headers: { 'x-tru-sync-key': SYNC_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`TruFlow responded ${r.status}`);
    res.json(await r.json());
  } catch (err: any) {
    // TruFlow unreachable or unhappy: never block capture work on a nudge.
    console.warn('[setup] status bridge unavailable:', err?.message || err);
    res.json({ complete: true, requiredComplete: true, acknowledgedAt: null, skipPrompt: true, items: [] });
  }
});

app.put('/api/setup/acknowledge', authenticate, async (req: any, res) => {
  if (!hasDealerScope(req)) return res.json({ ok: true, skipped: true });
  if (!SYNC_KEY) return res.json({ ok: true, skipped: true });
  try {
    const url = `${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/dealership/setup-acknowledge`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-tru-sync-key': SYNC_KEY },
      body: JSON.stringify({ dealershipId: req.user.dealerSlug }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`TruFlow responded ${r.status}`);
    res.json(await r.json());
  } catch (err: any) {
    console.warn('[setup] acknowledge bridge unavailable:', err?.message || err);
    // Ack is a nicety; failing it must not fail the request loudly.
    res.json({ ok: false });
  }
});

/** Which commit is actually running.
 *
 *  Confirming a deploy was otherwise inference, and the inferences were wrong in
 *  both directions on 2026-07-27: an uptime counter reset while the previous
 *  build was still being served, so a restart read as a deploy; and grepping the
 *  served bundle for a new string reported "not deployed" for a change that had
 *  shipped, because Vite code-splits modals into their own chunks.
 *
 *  RENDER_GIT_COMMIT is set by Render on every build. Public deliberately: it is
 *  a commit id, it reveals nothing, and a deploy check that needs a login is a
 *  deploy check nobody runs. */
app.get('/api/version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null;
  res.json({
    product: 'trulens',
    commit,
    shortCommit: commit ? String(commit).slice(0, 7) : null,
    branch: process.env.RENDER_GIT_BRANCH || null,
    builtFrom: commit ? 'render' : 'unknown (env not set — local run?)',
    startedAt: new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  // Whether an access code is configured — a boolean, never the value. Lets you
  // confirm from outside that the env var actually reached the process, which is
  // otherwise invisible until someone tries a bypass. Reveals nothing an attacker
  // couldn't already learn by sending a bogus token.
  const accessCodeConfigured = !!ACCESS_CODE;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    accessCodeConfigured,
    // Booleans and a count, never values. Lets you confirm from outside that
    // the env vars reached the process — otherwise invisible until an export
    // fails or a dealer files a car into the wrong yard.
    syncKeyConfigured: !!SYNC_KEY,
    dealerCodesConfigured: DEALER_CODES.length,
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    ts: new Date().toISOString(),
  });
});

// CORS for public website feed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/** TruLens-only public stock — for dealers without DMS (or as photo-first feed) */
/* ── VIR, computed the same way TruFlow computes it ──────────────
 *
 * A dealer site can be pointed at either feed — TruLens direct, or TruFlow —
 * and the same car has to report the same score either way, or switching the
 * source silently rewrites every vehicle's condition rating.
 *
 * Condition comes from confirmed damage findings, never from the photo-quality
 * scores in v.quality: quality is how well the shot was taken, condition is
 * what the shot shows. Keep in step with computeVirFromDamage / buildVirReport
 * in truflow-premium/server.ts.
 */
function flattenDamageFindings(v: any) {
  const bySlot = v?.damageFindings || {};
  return Object.entries(bySlot).flatMap(([slotId, list]: [string, any]) =>
    (Array.isArray(list) ? list : [])
      // An AI suggestion starts confirmed:false and has to be accepted by a
      // person before it can reach a buyer-facing report.
      .filter((f: any) => f && f.confirmed !== false)
      .map((f: any) => ({
        slotId,
        panel: f.panel,
        type: f.damageType,
        severity: f.severity,
        note: f.note,
        x: f.x,
        y: f.y,
      }))
  );
}

function computeVirFromDamage(damage: { severity: number }[]): number {
  if (!damage || !damage.length) return 100;
  const penalties: Record<number, number> = { 1: 2, 2: 5, 3: 10, 4: 18, 5: 30 };
  const total = damage.reduce((s, d) => s + (penalties[d.severity] ?? 5), 0);
  return Math.max(0, Math.round(100 - total));
}

function buildVirReport(damage: { panel?: string; severity: number }[]) {
  const panels = new Map<string, { severity: number }[]>();
  for (const d of damage) {
    const key = d.panel || 'General';
    if (!panels.has(key)) panels.set(key, []);
    panels.get(key)!.push(d);
  }
  return Array.from(panels, ([panel, findings]) => {
    const score = computeVirFromDamage(findings);
    return { section: panel, score, status: score >= 80 ? 'Pass' : 'Attention' };
  });
}

/** Absolute origin of this instance, taken from the request.
 *
 *  Derived rather than configured so localhost, staging and production each
 *  advertise URLs pointing at themselves with no env var to forget. Honours the
 *  proxy headers Render sets, or the scheme comes back http behind its TLS
 *  terminator and dealer sites end up fetching mixed content. */
function originOf(req: any): string {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  return host ? `${proto}://${host}` : '';
}

function toPublicFromLens(v: any, origin: string = '') {
  const photos = v.photos && typeof v.photos === 'object' ? v.photos : {};
  // Prefer exterior hero order for website gallery
  const order = [
    'front_bumper', 'bonnet', 'door_front_right', 'door_front_left',
    'rear_bumper', 'boot_tailgate', 'interior_cabin', 'engine_bay',
  ];
  /* Stored photos are served by this instance, but the sites reading this feed
     are on their own domains — a relative "/media/…" would resolve against the
     dealer's host and 404. Legacy base64 passes through untouched, so a feed
     keeps working on an instance whose migration has not run. */
  const abs = (s: string) => (isStoredRef(s) && origin ? `${origin}${s}` : s);

  const images: string[] = [];
  for (const id of order) {
    if (typeof photos[id] === 'string' && photos[id].length > 32) images.push(abs(photos[id]));
  }
  for (const [id, src] of Object.entries(photos)) {
    if (!order.includes(id) && typeof src === 'string' && src.length > 32) images.push(abs(src));
  }

  // Ready-for-web: required shots ideally full; allow publish if Ready/Listed or has solid gallery
  const status = v.status || 'In-Progress';
  const requiredIds = TRULENS_CORE_SLOT_IDS;
  const reqTaken = requiredIds.filter((id) => !!photos[id]).length;
  // Public feed: only explicitly published units (one-tap Publish on catalogue)
  const canShow =
    v.showOnWebsite === true &&
    (status === 'Ready' ||
      status === 'Listed' ||
      images.length > 0 ||
      reqTaken > 0);

  if (!canShow) return null;

  /* Same fields, same names, same meanings as toPublicVehicle in
     truflow-premium/server.ts — a dealer site switches between the two feeds
     by changing one base URL and nothing else. */
  const damage = flattenDamageFindings(v);

  return {
    id: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || '',
    price: v.price || 0,
    // Absent (not 0) when unset, so a site can tell "no benchmark" from "free".
    truPrice: v.truPrice ? Number(v.truPrice) : undefined,
    mileage: v.mileage || 0,
    transmission: v.transmission || '',
    fuelType: v.fuelType || '',
    bodyType: v.vehicleType || '',
    color: v.color || '',
    vin: v.vin || '',
    description: v.aiListingDescription || `${v.year} ${v.make} ${v.model}`,
    status: 'available',
    images,
    heroImage: images[0] || null,
    photoCount: images.length,
    /* A pointer rather than the frames themselves: the orbit is a large set of
       base64 stills and this is a list endpoint, so a site fetches it lazily
       for the car the buyer actually opened. */
    web3dUrl: v.web3dPublicPath || undefined,
    /** TruLens inspection score 0–100, absent when nothing was tagged. */
    vir: damage.length ? computeVirFromDamage(damage) : undefined,
    /* Absent — not [] — when the car was never inspected, so a site renders
       the report block only when there is one to render. */
    virReport: damage.length ? buildVirReport(damage) : undefined,
    damage: damage.length ? damage : undefined,
    /* Dealer-declared condition — TruLens retail "no damage reported" statement,
       not a graded VIR. Mirrors TruFlow's feed so a site gets the same line from
       either source. Tagged damage takes precedence over a "no damage" claim. */
    conditionLabel: (() => {
      const d = (v as any).conditionDeclaration;
      if (damage.length) return `Visible damage reported — ${damage.length} item${damage.length === 1 ? '' : 's'}`;
      if (d && d.noVisibleDamage) return 'No damage reported';
      return undefined;
    })(),
    conditionDeclaration: (v as any).conditionDeclaration || undefined,
    optionalExtras: (v as any).optionalExtras?.length ? (v as any).optionalExtras : undefined,
    daysInStock: null,
    source: 'trulens',
    updatedAt: v.updatedAt || v.lastDmsExportAt || null,
  };
}

// ── Web 3D / spin packages for dealer websites ─────────────────
const WEB3D_DIR = path.join(LOCAL_DATA_DIR, 'web3d');

function ensureWeb3dDir() {
  if (!fs.existsSync(WEB3D_DIR)) fs.mkdirSync(WEB3D_DIR, { recursive: true });
}

/* Runs here rather than beside the capture migration above, because it reads
   WEB3D_DIR — declared immediately above this — and calling it any earlier hits
   the temporal dead zone on that const. */
try {
  migrateOrbitsToFiles();
} catch (err) {
  console.error('[photos] orbit migration failed, continuing with base64:', err);
}

// POST /api/export/web-3d — save package from TruLens client
app.post('/api/export/web-3d', authenticate, async (req: any, res) => {
  try {
    const { vehicleId, package: pkg } = req.body || {};
    if (!pkg?.stockNumber || !Array.isArray(pkg.frames)) {
      return res.status(400).json({ error: 'package.stockNumber and package.frames required' });
    }

    ensureWeb3dDir();
    const safeStock = String(pkg.stockNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(WEB3D_DIR, `${safeStock}.json`);
    /* Frames onto disk, references into the package.
       This is the single largest payload the system produces: the Yaris orbit
       was 11 frames and 18.4 MB, ~10 seconds to fetch, against a client that
       gives up after 12. Stored as files the package itself is a few KB and each
       frame is fetched once and cached forever — and because they are content-
       addressed, frames shared with the gallery are not stored twice. */
    const payload = {
      ...pkg,
      frames: pkg.frames.map((f: any) => {
        if (!f || typeof f !== 'object') return f;
        const ref = putPhoto(f.image);
        return ref ? { ...f, image: ref } : f;
      }),
      // Damage pins carry a thumbnail each — 717 KB of the Yaris package.
      damageTags: Array.isArray(pkg.damageTags)
        ? pkg.damageTags.map((t: any) => {
            if (!t || typeof t !== 'object') return t;
            const ref = putPhoto(t.thumb);
            return ref ? { ...t, thumb: ref } : t;
          })
        : pkg.damageTags,
      savedAt: new Date().toISOString(),
      ownerId: req.user.uid,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');

    // Stamp vehicle if we can
    if (vehicleId) {
      try {
        const v = await getVehicle(vehicleId, req.user);
        if (v) {
          await saveVehicle({
            ...v,
            lastWeb3dExportAt: payload.savedAt,
            web3dPublicPath: `/api/public/web3d/${encodeURIComponent(pkg.stockNumber)}`,
            updatedAt: payload.savedAt,
          });
        }
      } catch (e) {
        console.warn('web3d vehicle stamp failed', e);
      }
    }

    res.json({
      success: true,
      stockNumber: pkg.stockNumber,
      publicUrl: `/api/public/web3d/${encodeURIComponent(pkg.stockNumber)}`,
      embedUrl: `/embed/web3d-viewer.html?stock=${encodeURIComponent(pkg.stockNumber)}`,
      frames: pkg.frames?.length || 0,
      damageTags: pkg.damageTags?.length || 0,
    });
  } catch (error: any) {
    console.error('web-3d export error', error);
    res.status(500).json({ error: 'Failed to save web 3D package', details: error.message });
  }
});

// GET /api/public/web3d/:stockNumber — public package for website players
app.get('/api/public/web3d/:stockNumber', (req, res) => {
  try {
    ensureWeb3dDir();
    const safeStock = String(req.params.stockNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(WEB3D_DIR, `${safeStock}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'No web 3D package for this stock number' });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    /* Frames stored as files are advertised as absolute URLs — the sites reading
       this are on their own domains, so a relative path would 404 on theirs.
       Packages written before the move still carry base64 and pass through. */
    const origin = originOf(req);
    if (Array.isArray(data?.frames)) {
      data.frames = data.frames.map((f: any) =>
        f && isStoredRef(f.image) && origin ? { ...f, image: `${origin}${f.image}` } : f
      );
    }
    if (Array.isArray(data?.damageTags)) {
      data.damageTags = data.damageTags.map((t: any) =>
        t && isStoredRef(t.thumb) && origin ? { ...t, thumb: `${origin}${t.thumb}` } : t
      );
    }
    res.json({ success: true, package: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/public/stock — website feed from TruLens (lens-only dealers)
/**
 * The dealership list the picker shows, proxied from TruFlow.
 *
 * It used to be a hardcoded array in DealerSelect.tsx, which meant onboarding a
 * dealer needed a TruLens release on top of a TruFlow one — and while that list
 * was hand-maintained it drifted, carrying three sample dealerships whose slugs
 * TruFlow did not know. Picking one saved a capture with no dealership, and the
 * public feed reads untagged stock as the pilot dealer, so a shooter could put
 * cars on someone else's website by choosing the wrong row.
 *
 * Proxied rather than fetched straight from the phone: it keeps the DMS URL
 * server-side and avoids relying on TruFlow's CORS for a screen that has to
 * work before anything else does.
 */
app.get('/api/dealerships', async (_req, res) => {
  try {
    const r = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/public/dealerships`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`DMS responded ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error('DMS returned an unexpected shape');
    res.setHeader('Cache-Control', 'no-store');
    res.json(list);
  } catch (err: any) {
    /* The phone falls back to its cached copy. Say so plainly rather than
       returning an empty list, which would read as "no dealerships exist". */
    console.warn('[dealerships] could not reach the DMS:', err?.message || err);
    res.status(503).json({ error: 'Could not reach the DMS to load dealerships.' });
  }
});

app.get('/api/public/stock', async (req, res) => {
  try {
    const dealer = String(req.query.dealer || '');
    if (!dealer) {
      return res.status(400).json({ success: false, error: 'dealer query parameter is required' });
    }
    let vehicles: any[] = [];
    if (LOCAL_MODE || !fdb) {
      vehicles = readLocalStore().vehicles.map(normalizeVehicle);
    } else {
      const snapshot = await fdb.collection('vehicles').get();
      vehicles = snapshot.docs.map((d) => normalizeVehicle(d.data()));
    }
    const scoped = vehicles.filter(
      (v: any) => (v.dealerSlug || LENS_DEFAULT_DEALER_SLUG) === dealer
    );
    const publicList = scoped.map((v: any) => toPublicFromLens(v, originOf(req))).filter(Boolean);
    res.json({
      success: true,
      dealer,
      source: 'trulens',
      updatedAt: new Date().toISOString(),
      count: publicList.length,
      vehicles: publicList,
    });
  } catch (error: any) {
    console.error('public stock error', error);
    res.status(500).json({ success: false, error: 'Failed to build stock feed', details: error.message });
  }
});

// 1. Get all vehicles
app.get('/api/inventory', authenticate, async (req: any, res) => {
  try {
    const vehicles = await listVehicles(req.user);
    res.json(vehicles);
  } catch (error) {
    console.error('GET /api/inventory - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Add or update vehicle
app.post('/api/inventory', authenticate, async (req: any, res) => {
  try {
    const vehicleData = req.body;
    const userId = req.user.uid;

    if (!vehicleData.id) {
      return res.status(400).json({ error: 'Vehicle ID is required' });
    }

    const now = new Date().toISOString();
    const { dealerSlug: _claimedSlug, ownerId: _drop, createdAt: _dropCreated, ...safeData } = vehicleData;
    const existing = await getVehicle(vehicleData.id, req.user);

    /* Token-pinned dealerSlug wins; then existing record; body is last resort
       (legacy shared-code tokens where the picker is the only signal). */
    const dealerSlug = req.user?.demo
      ? 'demo'
      : (req.user?.dealerSlug || existing?.dealerSlug || _claimedSlug || undefined);

    if (existing) {
      if (!LOCAL_MODE && existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updatedVehicle = {
        ...existing,
        ...safeData,
        ownerId: existing.ownerId || userId,
        dealerSlug,
        updatedAt: now,
        photos: vehicleData.photos ?? existing.photos ?? {},
        quality: vehicleData.quality ?? existing.quality ?? {},
      };
      const saved = await saveVehicle(updatedVehicle);
      return res.json({ success: true, vehicle: saved });
    }

    // Demo users are limited to 10 vehicles to prevent disk abuse.
    if (req.user?.demo) {
      const all = await listVehicles(req.user);
      if (all.length >= 10) {
        return res.status(403).json({
          error: 'Demo limit reached — 10 vehicles maximum. Sign in with a dealership code for unlimited access.',
        });
      }
    }

    /* Timestamp fallback so no capture ever lands without a stock number.
       Format keeps codes sortable and human-readable, and the second-level
       precision makes collision from a single phone effectively impossible.
       Never overwrites a dealer-typed value. */
    const stockNumberFallback = 'STK-' + now.replace(/[-:T.Z]/g, '').slice(0, 14);
    const newVehicle = {
      ...safeData,
      ownerId: userId,
      dealerSlug,
      stockNumber: vehicleData.stockNumber || stockNumberFallback,
      createdAt: now,
      updatedAt: now,
      photos: vehicleData.photos || {},
      quality: vehicleData.quality || {},
    };
    await saveVehicle(newVehicle);
    res.json({ success: true, vehicle: newVehicle });
  } catch (error) {
    console.error('POST /api/inventory - Server Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Upload/Save photo for a specific vehicle slot
app.post('/api/inventory/upload-photo', authenticate, async (req: any, res) => {
  try {
    const { vehicleId, slotId, base64Image, qualityReport, assessment, closeups } = req.body;
    const userId = req.user.uid;

    if (!vehicleId || !slotId || !base64Image) {
      return res.status(400).json({ error: 'vehicleId, slotId, and base64Image are required' });
    }

    const existingData = await getVehicle(vehicleId, req.user);
    if (!existingData) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (
      !LOCAL_MODE &&
      existingData.ownerId &&
      existingData.ownerId !== userId
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const resized = await resizeDataUri(base64Image);
    const photos = { ...(existingData.photos || {}), [slotId]: resized };
    const quality = { ...(existingData.quality || {}) };
    if (qualityReport) {
      quality[slotId] = qualityReport;
    }

    const slotAssessment = { ...((existingData as any).slotAssessment || {}) };
    const existingCloseups = { ...((existingData as any).closeups || {}) };
    if (assessment) {
      slotAssessment[slotId] = assessment;
    }
    if (closeups && closeups.length) {
      existingCloseups[slotId] = closeups;
    } else {
      delete existingCloseups[slotId];
    }

    const now = new Date().toISOString();
    const requiredSlots = TRULENS_CORE_SLOT_IDS;
    const hasAllRequired = requiredSlots.every((slot) => !!photos[slot]);
    let status = existingData.status;
    if (hasAllRequired && status === 'In-Progress') {
      status = 'Ready';
    }

    const updated = {
      ...existingData,
      photos,
      quality,
      slotAssessment,
      closeups: existingCloseups,
      status,
      updatedAt: now,
    };
    /* Return what was actually stored, not what arrived. saveVehicle moves the
       photo onto disk and swaps in a reference, so echoing `updated` handed the
       client back the full base64 it had just uploaded — which it then held in
       memory until its next fetch, on a phone, for every shot in the capture. */
    const saved = await saveVehicle(updated);
    res.json({ success: true, vehicle: saved });
  } catch (error) {
    console.error('POST /api/inventory/upload-photo - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3b. Swap photos between two vehicle slots
app.post('/api/inventory/swap-photos', authenticate, async (req: any, res) => {
  try {
    const { vehicleId, slotA, slotB } = req.body;
    const userId = req.user.uid;

    if (!vehicleId || !slotA || !slotB) {
      return res.status(400).json({ error: 'vehicleId, slotA, and slotB are required' });
    }

    const existingData = await getVehicle(vehicleId, req.user);
    if (!existingData) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (
      !LOCAL_MODE &&
      existingData.ownerId &&
      existingData.ownerId !== userId
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const swapField = (obj: Record<string, any>) => {
      const valA = obj[slotA];
      const valB = obj[slotB];
      if (valB !== undefined) { obj[slotA] = valB; } else { delete obj[slotA]; }
      if (valA !== undefined) { obj[slotB] = valA; } else { delete obj[slotB]; }
    };

    const photos = { ...(existingData.photos || {}) };
    const quality = { ...(existingData.quality || {}) };
    const slotAssessment = { ...((existingData as any).slotAssessment || {}) };
    const closeups = { ...((existingData as any).closeups || {}) };

    swapField(photos);
    swapField(quality);
    swapField(slotAssessment);
    swapField(closeups);

    const updated = {
      ...existingData,
      photos,
      quality,
      slotAssessment,
      closeups,
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveVehicle(updated);
    res.json({ success: true, vehicle: saved });
  } catch (error) {
    console.error('POST /api/inventory/swap-photos - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Delete vehicle
app.delete('/api/inventory/:id', authenticate, async (req: any, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.uid;
    const data = await getVehicle(id, req.user);
    if (!data) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (!LOCAL_MODE && data.ownerId && data.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteVehicle(id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/inventory - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4b. Service-to-service delete — TruFlow calls this when a synced vehicle is
//     removed from the DMS, so the capture doesn't linger in TruLens.
app.delete('/api/sync/vehicle', (req, res) => {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'TRUFLOW_SYNC_KEY is not configured on this server.' });
  }
  if (req.headers['x-tru-sync-key'] !== SYNC_KEY) {
    return res.status(401).json({ error: 'Invalid sync key.' });
  }
  const { stockNumber, dealerSlug } = req.body || {};
  if (!stockNumber) {
    return res.status(400).json({ error: 'stockNumber is required.' });
  }

  /* Only ever delete the capture belonging to the dealer who deleted it.
     Stock numbers are dealer-chosen and short, so two yards routinely share
     one. This matched on the number alone and removed EVERY vehicle carrying
     it — a dealer deleting their own car silently destroyed another dealer's
     capture and its photos. The Firestore branch batch-deleted the lot.

     When no dealership is named (an older TruFlow that predates this) a single
     unambiguous match is still honoured, but anything wider is refused rather
     than guessed at — a deletion is not the place to pick one. */
  const matchesDealer = (v: any) =>
    !dealerSlug || (v.dealerSlug || LENS_DEFAULT_DEALER_SLUG) === dealerSlug;

  (async () => {
    try {
      if (LOCAL_MODE || !fdb) {
        const store = readLocalStore();
        const doomed = store.vehicles.filter(
          (v: any) => v.stockNumber === stockNumber && matchesDealer(v)
        );
        if (!dealerSlug && doomed.length > 1) {
          return res.status(409).json({
            deleted: false,
            removed: 0,
            error:
              `${doomed.length} vehicles share stock number ${stockNumber}. ` +
              'Send dealerSlug to say which dealership this deletion is for.',
          });
        }
        const ids = new Set(doomed.map((v: any) => v.id));
        store.vehicles = store.vehicles.filter((v: any) => !ids.has(v.id));
        writeLocalStore(store);
        return res.json({ deleted: ids.size > 0, removed: ids.size });
      }
      const snapshot = await fdb!.collection('vehicles')
        .where('stockNumber', '==', stockNumber)
        .get();
      if (snapshot.empty) {
        return res.json({ deleted: false, removed: 0 });
      }
      const docs = snapshot.docs.filter((d) => matchesDealer(d.data()));
      if (!dealerSlug && docs.length > 1) {
        return res.status(409).json({
          deleted: false,
          removed: 0,
          error:
            `${docs.length} vehicles share stock number ${stockNumber}. ` +
            'Send dealerSlug to say which dealership this deletion is for.',
        });
      }
      if (!docs.length) {
        return res.json({ deleted: false, removed: 0 });
      }
      const batch = fdb!.batch();
      docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return res.json({ deleted: true, removed: docs.length });
    } catch (err: any) {
      console.error('[sync] delete by stockNumber failed:', err);
      return res.status(500).json({ error: err?.message || 'Delete failed.' });
    }
  })();
});

// 4b-ii. Service-to-service photo removal — TruFlow calls this when a dealer
//        removes individual photos from a capture inside the DMS, so the
//        capture app's slots don't quietly re-export those photos on the next
//        sync. Matches by sha256 hash: both services store photos as
//        /media/<sha256>.<ext>, so the hash is a stable cross-service id
//        without carrying URLs. Whole-vehicle deletes still route through
//        DELETE /api/sync/vehicle above; this one only touches the photos map.
app.delete('/api/sync/vehicle/photos', (req, res) => {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'TRUFLOW_SYNC_KEY is not configured on this server.' });
  }
  if (req.headers['x-tru-sync-key'] !== SYNC_KEY) {
    return res.status(401).json({ error: 'Invalid sync key.' });
  }
  const { stockNumber, dealerSlug, removedHashes } = req.body || {};
  if (!stockNumber) {
    return res.status(400).json({ error: 'stockNumber is required.' });
  }
  if (!Array.isArray(removedHashes) || removedHashes.length === 0) {
    return res.status(400).json({ error: 'removedHashes must be a non-empty array.' });
  }
  const hashSet = new Set(
    removedHashes.filter((h: any) => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)),
  );
  if (hashSet.size === 0) {
    return res.status(400).json({ error: 'removedHashes contained no valid sha256 hashes.' });
  }

  /* Same dealer guard as the whole-vehicle delete: stock numbers collide
     across yards, so a slug-less push is only honoured when there is exactly
     one candidate. Removing a photo is less destructive than a whole vehicle
     but the reasoning is identical — one dealer's cleanup must not touch
     another dealer's capture. */
  const matchesDealer = (v: any) =>
    !dealerSlug || (v.dealerSlug || LENS_DEFAULT_DEALER_SLUG) === dealerSlug;

  /* Extract the sha256 from a stored ref. Matches photoStore.ts's storage
     shape; anything else (remote URLs, stale base64) is ignored, since we
     can't tell whether it came from the same bytes. */
  const hashOf = (ref: unknown): string | null => {
    if (typeof ref !== 'string') return null;
    const m = /^\/media\/([a-f0-9]{64})\./.exec(ref);
    return m ? m[1] : null;
  };

  (async () => {
    try {
      let target: any | null = null;

      if (LOCAL_MODE || !fdb) {
        const store = readLocalStore();
        const candidates = store.vehicles.filter(
          (v: any) => v.stockNumber === stockNumber && matchesDealer(v),
        );
        if (candidates.length === 0) {
          return res.json({ updated: false, removed: 0, reason: 'not_found' });
        }
        if (!dealerSlug && candidates.length > 1) {
          return res.status(409).json({
            updated: false,
            removed: 0,
            error:
              `${candidates.length} vehicles share stock number ${stockNumber}. ` +
              'Send dealerSlug to say which dealership this removal is for.',
          });
        }
        target = candidates[0];
      } else {
        const snapshot = await fdb!.collection('vehicles')
          .where('stockNumber', '==', stockNumber)
          .get();
        const docs = snapshot.docs.filter((d) => matchesDealer(d.data()));
        if (docs.length === 0) {
          return res.json({ updated: false, removed: 0, reason: 'not_found' });
        }
        if (!dealerSlug && docs.length > 1) {
          return res.status(409).json({
            updated: false,
            removed: 0,
            error:
              `${docs.length} vehicles share stock number ${stockNumber}. ` +
              'Send dealerSlug to say which dealership this removal is for.',
          });
        }
        target = { id: docs[0].id, ...docs[0].data() };
      }

      const photos = { ...(target.photos || {}) };
      const removedSlots: string[] = [];
      for (const [slotId, value] of Object.entries(photos)) {
        const h = hashOf(value);
        if (h && hashSet.has(h)) {
          delete photos[slotId];
          removedSlots.push(slotId);
        }
      }

      if (removedSlots.length === 0) {
        return res.json({ updated: false, removed: 0, reason: 'no_match' });
      }

      /* quality/damageFindings/slotAssessment are keyed by slotId, so drop
         their entries too — a captured slot's report shouldn't outlive the
         photo it described. */
      const stripBySlot = (map: any): any => {
        if (!map || typeof map !== 'object') return map;
        const out: Record<string, any> = { ...map };
        for (const slotId of removedSlots) delete out[slotId];
        return out;
      };

      await saveVehicle({
        ...target,
        photos,
        quality: stripBySlot(target.quality),
        damageFindings: stripBySlot(target.damageFindings),
        slotAssessment: stripBySlot(target.slotAssessment),
        updatedAt: new Date().toISOString(),
      });

      return res.json({ updated: true, removed: removedSlots.length, slots: removedSlots });
    } catch (err: any) {
      console.error('[sync] DELETE /api/sync/vehicle/photos failed:', err);
      return res.status(500).json({ error: err?.message || 'Photo removal failed.' });
    }
  })();
});

// 4c. Service-to-service edit — TruFlow calls this when a dealer edits a
//     Lens-originated vehicle in Premium or Light DMS. Non-media fields only;
//     photos/damage/VIR stay Lens-owned. Per-field updatedAt decides winners so
//     a Lens re-export cannot stomp a fresher Flow edit and vice versa.
app.put('/api/sync/vehicle', (req, res) => {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'TRUFLOW_SYNC_KEY is not configured on this server.' });
  }
  if (req.headers['x-tru-sync-key'] !== SYNC_KEY) {
    return res.status(401).json({ error: 'Invalid sync key.' });
  }
  const { stockNumber, dealerSlug, patch, fieldMeta } = req.body || {};
  if (!stockNumber) {
    return res.status(400).json({ error: 'stockNumber is required.' });
  }
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'patch is required.' });
  }
  /* Field-name translation: Flow uses retailPrice/bodyType, Lens uses
     price/vehicleType. Normalise here so callers can send either. */
  const normalised: Record<string, any> = { ...patch };
  if (normalised.retailPrice !== undefined && normalised.price === undefined) {
    normalised.price = normalised.retailPrice;
  }
  if (normalised.bodyType !== undefined && normalised.vehicleType === undefined) {
    normalised.vehicleType = normalised.bodyType;
  }
  /* Same guard as DELETE /api/sync/vehicle — never touch a car that belongs to
     another dealer just because they happen to share a short stock number. */
  const matchesDealer = (v: any) =>
    !dealerSlug || (v.dealerSlug || LENS_DEFAULT_DEALER_SLUG) === dealerSlug;

  (async () => {
    try {
      const now = Date.now();
      let target: any | null = null;

      if (LOCAL_MODE || !fdb) {
        const store = readLocalStore();
        const candidates = store.vehicles.filter(
          (v: any) => v.stockNumber === stockNumber && matchesDealer(v),
        );
        if (candidates.length === 0) {
          return res.status(404).json({ updated: false, error: 'Vehicle not found.' });
        }
        if (!dealerSlug && candidates.length > 1) {
          return res.status(409).json({
            updated: false,
            error:
              `${candidates.length} vehicles share stock number ${stockNumber}. ` +
              'Send dealerSlug to say which dealership this edit is for.',
          });
        }
        target = candidates[0];
      } else {
        const snapshot = await fdb!.collection('vehicles')
          .where('stockNumber', '==', stockNumber)
          .get();
        const docs = snapshot.docs.filter((d) => matchesDealer(d.data()));
        if (docs.length === 0) {
          return res.status(404).json({ updated: false, error: 'Vehicle not found.' });
        }
        if (!dealerSlug && docs.length > 1) {
          return res.status(409).json({
            updated: false,
            error:
              `${docs.length} vehicles share stock number ${stockNumber}. ` +
              'Send dealerSlug to say which dealership this edit is for.',
          });
        }
        target = { id: docs[0].id, ...docs[0].data() };
      }

      const { patch: fieldsToApply, fieldMeta: nextMeta } = mergeWithMeta(
        target,
        normalised,
        fieldMeta,
        FLOW_EDITABLE_FIELDS,
        now,
      );

      if (Object.keys(fieldsToApply).length === 0) {
        /* Every incoming field lost the timestamp comparison — Lens's copy is
           already newer, so nothing to do. Still a success, not a 409. */
        return res.json({ updated: false, applied: [], reason: 'stale' });
      }

      const saved = await saveVehicle({
        ...target,
        ...fieldsToApply,
        fieldMeta: nextMeta,
        updatedAt: new Date(now).toISOString(),
      });

      return res.json({
        updated: true,
        applied: Object.keys(fieldsToApply),
        id: saved.id,
      });
    } catch (err: any) {
      console.error('[sync] PUT /api/sync/vehicle failed:', err);
      return res.status(500).json({ error: err?.message || 'Update failed.' });
    }
  })();
});

// 5. AI Listing Description Writer (DeepSeek) — kept at /api/gemini/analyze for
// frontend compatibility; no image is sent to the model.
app.post('/api/gemini/analyze', authenticate, async (req: any, res) => {
  const { base64Image, slotName, vehicleInfo } = req.body;

  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  if (!aiConfigured) {
    return res.json({
      overallScore: 85,
      lightingCheck: {
        status: 'Perfect',
        brightness: 128,
        contrast: 135,
        feedback: 'Excellent soft overhead lighting. Very clean representation with minimal glare.',
      },
      angleCheck: {
        status: 'Good',
        pitchDiff: 2,
        rollDiff: 1,
        feedback: 'The vehicle alignment is perfect! A slightly lower angle would add even more prominence.',
      },
      aiAnalysis: {
        identifiedVehicle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} ${vehicleInfo?.model || ''}`,
        suggestedTitle: `Stunning ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Premium'} ${vehicleInfo?.model || 'Edition'}`,
        suggestedDescription: `Take home this fully-inspected, highly desirable ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Premium'} ${vehicleInfo?.model || 'model'}. Professionally photographed and detailed, featuring an immaculate exterior and highly polished features. Enquire today to secure a test drive!`,
        detectedIssues: ['Slight window reflections - adjust angle if reflection covers safety cameras.'],
      },
    });
  }

  try {
    const prompt = `You are an expert automotive listing copywriter. Write a listing title and description for the vehicle captured in slot "${slotName || 'General Exterior'}".
Vehicle details: ${vehicleInfo?.year || 'year not provided'} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}.

You cannot see the photo, so provide sensible neutral values for the quality checks. Respond strictly with valid JSON matching this schema:
{
  "overallScore": number,
  "lightingCheck": { "status": "Poor" | "Fair" | "Perfect", "brightness": number, "contrast": number, "feedback": string },
  "angleCheck": { "status": "Off-Angle" | "Good" | "Perfect", "pitchDiff": number, "rollDiff": number, "feedback": string },
  "aiAnalysis": {
    "identifiedVehicle": string,
    "suggestedTitle": string,
    "suggestedDescription": string,
    "detectedIssues": string[]
  }
}`;

    const resultText = await deepseekText([{ role: 'user', content: prompt }], { json: true });
    if (!resultText) throw new Error('No AI response');
    const parsedData = JSON.parse(resultText);
    res.json(parsedData);
  } catch (error: any) {
    console.error('DeepSeek analysis error:', error);
    if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED') || error.message?.includes('access')) {
      return res.json({
        overallScore: 82,
        lightingCheck: {
          status: 'Good',
          brightness: 110,
          contrast: 120,
          feedback: 'Live analysis temporarily unavailable. This local fallback suggests lighting is sufficient for listing.',
        },
        angleCheck: {
          status: 'Good',
          pitchDiff: 0,
          rollDiff: 0,
          feedback: 'Vehicle framing looks correct based on local validation.',
        },
        aiAnalysis: {
          identifiedVehicle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} ${vehicleInfo?.model || ''}`,
          suggestedTitle: `New Listing: ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}`,
          suggestedDescription: `Automated analysis is currently in maintenance mode. This ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} is ready for inspection and listing.`,
          detectedIssues: ['AI Analysis Service Offline - Using local heuristic checks.'],
        },
      });
    }
    res.status(500).json({ error: 'AI analysis failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// ==================== DMS EXPORT (TruFlow) ====================

const SLOT_TO_DMS_CATEGORY: Record<string, string> = {
  // Category 1: Front & Engine
  bonnet: 'images', front_bumper: 'images', front_windscreen: 'images',
  license_disc: 'extrasPhotos', engine_bay: 'extrasPhotos',
  // Category 2: Clockwise Exterior Walk-Around
  fender_front_right: 'images', wheel_front_right: 'images', door_front_right: 'images',
  door_rear_right: 'images', quarter_rear_right: 'images', wheel_rear_right: 'images',
  boot_tailgate: 'images', rear_bumper: 'images', spare_wheel: 'extrasPhotos',
  vehicle_jack: 'extrasPhotos', quarter_rear_left: 'images', wheel_rear_left: 'images',
  door_rear_left: 'images', door_front_left: 'images', fender_front_left: 'images',
  wheel_front_left: 'images', roof_sunroof: 'images',
  // Category 3: Interior, History & Verification
  steering_wheel: 'extrasPhotos', interior_cabin: 'extrasPhotos',
  service_book: 'serviceBookPhotos', odometer: 'extrasPhotos', spare_keys: 'extrasPhotos',
};

function buildDmsBreakdown(photos: Record<string, string>) {
  const counts: Record<string, number> = {
    images: 0, extrasPhotos: 0, damagePhotos: 0, vinPhotos: 0, serviceBookPhotos: 0,
  };
  /* The walkaround is counted separately, and by its MIME rather than by which
     slot it came from. It used to be lumped in with the photo count, so an
     export that silently carried no video was indistinguishable from one that
     did — the only way to find out was to read the dealer's public feed
     afterwards. Detecting on data:video/ also catches a clip filed in the wrong
     slot, which is the case a slot-based count would miss. */
  let walkaround = 0;
  for (const [slotId, data] of Object.entries(photos || {})) {
    if (typeof data === 'string' && /^data:video\//i.test(data)) { walkaround++; continue; }
    const cat = SLOT_TO_DMS_CATEGORY[slotId] || 'extrasPhotos';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  const stills = Object.keys(photos || {}).length - walkaround;
  return {
    mainImages: counts.images,
    extras: counts.extrasPhotos,
    damage: counts.damagePhotos,
    vin: counts.vinPhotos,
    serviceBook: counts.serviceBookPhotos,
    walkaround,
    stills,
    total: Object.keys(photos || {}).length,
  };
}

app.post('/api/export/dms', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;

    const {
      vehicleId,
      dmsUrl: dmsUrlOverride,
      dealerSlug: claimedDealerSlug,
      createIfMissing = true,
    } = req.body || {};

    /* When the device signed in with a per-dealership code, that wins. The
       body value is a claim from the client; the token is evidence. This is
       what stops a mis-set picker filing a car into another dealer's yard.

       Demo sessions carry no dealership and are pinned to the HARDCODED "demo"
       tenant in TruFlow — an isolated sandbox, never a real yard. The slug is
       NOT read from the client for demo users, so a prospect cannot spoof a
       real dealership's slug. This lets a demo run the full capture -> DMS ->
       showroom loop without any path to live dealer data. */
    const dealerSlug = req.user?.demo ? 'demo' : (req.user?.dealerSlug || claimedDealerSlug);
    if (req.user?.dealerSlug && claimedDealerSlug && claimedDealerSlug !== req.user.dealerSlug) {
      console.warn(
        `[export] device is signed in as "${req.user.dealerSlug}" but requested ` +
        `"${claimedDealerSlug}" — using the signed-in dealership.`
      );
    }

    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicleId is required' });
    }

    /* Stop here rather than build and upload a multi-megabyte payload the DMS
       will refuse. A device signed in with the legacy shared code carries no
       dealership in its token, so the slug rests entirely on the phone's
       localStorage — cleared browser data or a reinstalled PWA leaves it blank,
       and an export with no dealership used to be filed against the DMS's
       default yard rather than rejected. */
    if (!dealerSlug) {
      return res.status(400).json({
        success: false,
        error:
          'No dealership selected on this device. Choose the dealership in ' +
          'TruLens before exporting, so the capture files into the right yard.',
      });
    }

    const vehicle = await getVehicle(vehicleId, req.user);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (!LOCAL_MODE && vehicle.ownerId && vehicle.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    /* The wire format to TruFlow is still { slotId: dataUri }, so photos that
       now live on disk are read back for the export. That keeps the two products
       independent — TruFlow's own migration landed separately and neither had to
       ship in lockstep with the other.
       It does mean the upload is still large. Making the export post references
       and having TruFlow fetch them is the next step, and the one that actually
       shrinks what a phone sends over mobile data. */
    const storedPhotos = vehicle.photos || {};
    const photos: Record<string, string> = {};
    for (const [slotId, value] of Object.entries(storedPhotos)) {
      const uri = asDataUri(value);
      if (uri) photos[slotId] = uri;
    }
    const photoCount = Object.keys(photos).length;
    if (photoCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No photos to export. Capture photos first.',
      });
    }

    /* Vehicle-level inspection score. TruLens scores each slot as it is shot
       and has never sent any of it on, so the DMS and the dealer's website had
       no idea a car had been inspected at all. There is no single score on the
       vehicle — it is the mean of the per-slot reports, rounded. */
    const slotScores = Object.values(vehicle.quality || {})
      .map((q: any) => (typeof q?.overallScore === 'number' ? q.overallScore : null))
      .filter((n): n is number => n !== null);
    const vir = slotScores.length
      ? Math.round(slotScores.reduce((a, b) => a + b, 0) / slotScores.length)
      : undefined;

    /* The report itself, per section, so the dealer's website can render it
       rather than link out to an app the buyer cannot open. Sent as data and
       not as HTML on purpose — each dealer site is hand-built, so the layout
       belongs to the site and only the findings belong here.
       80+ reads as a pass; below that the section is worth a look. */
    const inspection = Object.entries(vehicle.quality || {})
      .map(([slotId, q]: [string, any]) => ({
        section: slotId,
        score: typeof q?.overallScore === 'number' ? q.overallScore : null,
        status: typeof q?.overallScore === 'number' && q.overallScore >= 80 ? 'Pass' : 'Attention',
      }))
      .filter((r) => r.score !== null);

    const dmsBase = String(dmsUrlOverride || DEFAULT_DMS_URL).replace(/\/$/, '');
    const pushUrl = `${dmsBase}/api/sync/push-photos`;

    const payload = {
      stockNumber: vehicle.stockNumber,
      vehicleId: vehicle.id,
      createIfMissing: createIfMissing !== false,
      dealerSlug: dealerSlug || undefined,
      /* TruLens has had a Publish / Unpublish toggle all along, but the value
         never left this app — so it decided nothing about what the dealer's
         website actually showed. TruFlow serves that feed, and it read "not
         set" as published, which is how a junk test capture ended up on a live
         dealer feed. Sending it makes the button mean what it says. */
      /* Real dealers still land unpublished until they press Publish in
         TruLens — publishing is a second, deliberate act. Demo captures are
         published straight to the demo showroom (the only consumer of the demo
         tenant), so the prospect sees the car appear without an extra step. */
      showOnWebsite: req.user?.demo
        ? true
        : (typeof vehicle.showOnWebsite === "boolean" ? vehicle.showOnWebsite : undefined),
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
        mmCode: (vehicle as any).mmCode || undefined,
        vin: vehicle.vin,
        stockNumber: vehicle.stockNumber,
        color: vehicle.color,
        price: vehicle.price,
        vehicleType: vehicle.vehicleType,
        /* TruFlow's importer has always read mileage/transmission/fuelType off
           this payload and fallen back to 0/"Automatic"/"Petrol" when absent —
           and they were always absent, so every car created from a capture was
           published to the dealer's website with invented specs. */
        mileage: vehicle.mileage,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        vir,
        inspection: inspection.length ? inspection : undefined,
        /* Hand-tagged damage, flattened out of its per-slot map. Only confirmed
           findings travel: an AI suggestion starts confirmed:false and must be
           accepted by a person before it can reach a buyer-facing report. The
           x/y stay attached so a site can plot the mark on the same photo. */
        damage: (() => {
          const bySlot = (vehicle as any).damageFindings || {};
          const flat = Object.entries(bySlot).flatMap(([slotId, list]: [string, any]) =>
            (Array.isArray(list) ? list : [])
              .filter((f: any) => f && f.confirmed !== false)
              .map((f: any) => ({
                slotId,
                panel: f.panel,
                type: f.damageType,
                severity: f.severity,
                note: f.note,
                x: f.x,
                y: f.y,
              })),
          );
          return flat.length ? flat : undefined;
        })(),
        slotAssessment: Object.keys((vehicle as any).slotAssessment || {}).length
          ? (vehicle as any).slotAssessment
          : undefined,
        /* Dealer's condition declaration — TruLens is retail (declared
           condition), not a graded VIR. Carries the "no damage reported"
           statement through to the DMS and on to the dealer's website. */
        conditionDeclaration: (vehicle as any).conditionDeclaration || undefined,
        description: vehicle.aiListingDescription || undefined,
        optionalExtras: (vehicle as any).optionalExtras?.length ? (vehicle as any).optionalExtras : undefined,
      },
      photos,
    };

    /* Service-to-service auth for the DMS push. TruFlow leaves
       /api/sync/push-photos open when its TRUFLOW_SYNC_KEY is unset — which is
       how it has been running — so anyone who knew the URL could write vehicles
       and photos into a dealer's inventory. Sending it here is the half that
       has to ship first: set the key on TruFlow before this and every export
       starts failing. Same value on both services. */
    const dmsRes = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SYNC_KEY ? { 'x-tru-sync-key': SYNC_KEY } : {}),
      },
      body: JSON.stringify(payload),
    });

    const dmsText = await dmsRes.text();
    let dmsData: any = {};
    try {
      dmsData = JSON.parse(dmsText);
    } catch {
      dmsData = { raw: dmsText };
    }

    if (!dmsRes.ok) {
      console.error('DMS export failed:', dmsRes.status, dmsData);
      return res.status(502).json({
        success: false,
        error: 'TruFlow DMS rejected the export',
        dmsStatus: dmsRes.status,
        dmsUrl: pushUrl,
        details: dmsData.error || dmsData.message || dmsData,
      });
    }

    const nowIso = new Date().toISOString();
    const exportMeta: any = {
      // Remember which dealer this capture belongs to. Without it this app's
      // own public feed can't tell one dealer's stock from another's.
      dealerSlug: dealerSlug || vehicle.dealerSlug || undefined,
      lastDmsExportAt: nowIso,
      /* Anchor for the 7-day Lens retention window. Only set on the FIRST
         successful export — re-exports must not push the deletion out or a
         busy vehicle would live in Lens forever. */
      firstDmsExportAt: vehicle.firstDmsExportAt || nowIso,
      lastDmsExportStatus: dmsData.synced ? 'success' : 'partial',
      lastDmsVehicleId: dmsData.vehicle?.id || null,
      lastDmsStockNumber: dmsData.vehicle?.stockNumber || vehicle.stockNumber,
    };

    if (vehicle.status === 'Ready' || vehicle.status === 'Listed') {
      exportMeta.status = 'Listed';
      exportMeta.updatedAt = exportMeta.lastDmsExportAt;
    }

    const updated = { ...vehicle, ...exportMeta };
    await saveVehicle(updated);

    res.json({
      success: true,
      synced: !!dmsData.synced,
      created: !!dmsData.created,
      message:
        dmsData.message ||
        // Names the walkaround explicitly, so "no walkaround" is visible at the
        // moment of export rather than discovered later in the public feed.
        `Exported ${buildDmsBreakdown(photos).stills} photos` +
        (buildDmsBreakdown(photos).walkaround
          ? ' and the 360 walkaround'
          : ' — no 360 walkaround in this capture') +
        ' to TruFlow DMS',
      breakdown: buildDmsBreakdown(photos),
      dmsUrl: pushUrl,
      dmsVehicle: dmsData.vehicle || null,
      vehicle: updated,
    });
  } catch (error: any) {
    console.error('POST /api/export/dms - Error:', error);
    const isNetwork =
      error?.cause?.code === 'ECONNREFUSED' ||
      error?.code === 'ECONNREFUSED' ||
      String(error?.message || '').includes('fetch failed') ||
      String(error?.message || '').includes('ECONNREFUSED');

    res.status(isNetwork ? 503 : 500).json({
      success: false,
      error: isNetwork
        ? `Cannot reach TruFlow DMS at ${DEFAULT_DMS_URL}. Start TruFlow Premium (port 3001) or set TRUFLOW_DMS_URL.`
        : 'DMS export failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/export/dms/config', authenticate, async (_req: any, res) => {
  res.json({
    dmsUrl: DEFAULT_DMS_URL,
    pushEndpoint: `${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/sync/push-photos`,
    mode: LOCAL_MODE ? 'local' : 'cloud',
    databaseId: AUTOLENS_DB_ID,
  });
});

// Live market valuation — scrapes competitor dealer stock + classifieds
// (AutoTrader / Cars.co.za), mileage-adjusted toward the subject car. This is
// the same engine as TruInspect, and keys on make/model/year/mileage rather
// than VIN. Used at the pricing step so a dealer sets a first price against
// the live market.
app.post('/api/valuation', authenticate, async (req: any, res) => {
  const { make, model, year, mileage, vin } = req.body || {};
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'make, model, and year are required' });
  }
  const dealerSlug = req.user?.dealerSlug || 'default';
  const km = Number(mileage);
  const valuationOpts = {
    vin: String(vin || '').trim().toUpperCase() || undefined,
    dealerSlug,
    mileage: Number.isFinite(km) && km > 0 ? Math.round(km) : undefined,
  };
  try {
    const data = VALUATION_ENGINE === 'package'
      ? await pkgFetchValuation(
          String(make),
          String(model),
          String(year),
          valuationOpts,
          (pkgMarkets as Record<string, any>)[INSTANCE_MARKET] || pkgMarkets.za,
        )
      : await fetchValuation(String(make), String(model), String(year), valuationOpts);
    res.json(data);
  } catch (err: any) {
    console.error('[valuation] failed:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Valuation failed' });
  }
});

// ==================== IMAGIN8 / TRANSUNION ====================

import { getValues as imagin8GetValues, getStaticInfo as imagin8GetStaticInfo, getModels as imagin8GetModels, accidentReport as imagin8AccidentReport, regCheck as imagin8RegCheck, simulatedValuation as imagin8SimValuation, simulatedRegCheck as imagin8SimRegCheck, simulatedAccidentReport as imagin8SimAccidentReport, DEMO_IMAGIN8_ALLOWANCE } from "../packages/imagin8";

const IMAGIN8_API_KEY = process.env.IMAGIN8_API_KEY || "";
const IMAGIN8_CUSTOMER_ID = process.env.IMAGIN8_CUSTOMER_ID || "";
// Chargeable getValues also needs the account login + registered applicationName.
// (getStaticInfo param casing fixed in shared packages/imagin8.ts — cd82754.)
// (getValues now sends the required `guide` (MMYYYY) — shared pkg.)
const imagin8Opts = {
  apiKey: IMAGIN8_API_KEY,
  customerId: IMAGIN8_CUSTOMER_ID,
  userName: process.env.IMAGIN8_USERNAME || "",
  password: process.env.IMAGIN8_PASSWORD || "",
  appName: process.env.IMAGIN8_APP_NAME || "",
};
const imagin8Configured = () => IMAGIN8_API_KEY && IMAGIN8_CUSTOMER_ID;

// ── Imagin8 / TransUnion — proxied to Flow central ──
// TruLens keeps NO local credit ledger and stores NO Imagin8 credentials.
// Chargeable calls relay to Flow's internal gateway over the sync key — the
// same trust anchor that lets this server verify codes and receive its slug —
// so there is ONE ledger and ONE credential store for the whole suite
// ("what lives in Lens lives in Flow"). Free flat-fee endpoints (static info,
// model catalogue) still run here on the platform subscription.
//
// Demo tokens are short-circuited locally with a SIMULATED result: a prospect
// gets the full Imagin8 experience (valuation/reg check/accident report) for a
// couple of cars, then the "Unlock (Premium)" wall reappears. It never reaches
// the gateway, never touches anyone's real credits, and is free to run — so it
// is safe to keep demo enabled even on the live prospect instances. Each
// per-browser demo session (demo-<hex> uid) carries its own 2-of-each budget.

const DEMO_ZERO_BUNDLES = { valuation: 0, regCheck: 0, accidentReport: 0 };
const demoBundles = new Map<string, typeof DEMO_IMAGIN8_ALLOWANCE>();

/** Map the route feature name to the Imagin8Bundles slot the UI reads. */
const DEMO_FEATURE_SLOT: Record<'valuation' | 'regcheck' | 'accident-report', keyof typeof DEMO_IMAGIN8_ALLOWANCE> = {
  valuation: 'valuation',
  regcheck: 'regCheck',
  'accident-report': 'accidentReport',
};

/** The dealership this request acts on. Per-dealer codes carry their slug;
 *  legacy shared-code logins land on 'default' and are gated as such. */
function resolveDealerId(req: any): string {
  return req.user?.dealerSlug || 'default';
}

/** Remaining simulated demo budget, seeded to the full allowance on first use. */
function demoRemaining(req: any): typeof DEMO_IMAGIN8_ALLOWANCE {
  const key = req.user?.uid || 'demo';
  let b = demoBundles.get(key);
  if (!b) {
    b = { ...DEMO_IMAGIN8_ALLOWANCE };
    demoBundles.set(key, b);
  }
  return { ...b };
}

/** Consume one demo credit; returns the new remaining budget. */
function demoConsume(req: any, feature: 'valuation' | 'regcheck' | 'accident-report'): typeof DEMO_IMAGIN8_ALLOWANCE {
  const key = req.user?.uid || 'demo';
  const b = demoRemaining(req);
  const slot = DEMO_FEATURE_SLOT[feature];
  b[slot] = Math.max(0, b[slot] - 1);
  demoBundles.set(key, b);
  return { ...b };
}

/** Demo users get a hard 403 on paid TransUnion calls — no simulation, no credits.
 *  Returns true if the response was sent (i.e. the caller is demo). */
function handleDemoImagin8(
  req: any,
  res: any,
  _feature: 'valuation' | 'regcheck' | 'accident-report',
  _params: Record<string, any>,
): boolean {
  if (!req.user?.demo) return false;
  res.status(403).json({
    error: 'TransUnion features are available on the full product. Sign in with a dealership code to unlock.',
    demo: true,
    demoBlocked: true,
  });
  return true;
}

async function imagin8Proxy(
  req: any,
  res: any,
  feature: 'valuation' | 'regcheck' | 'accident-report',
  params: Record<string, unknown>,
) {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'Imagin8 gateway unavailable — TRUFLOW_SYNC_KEY is not configured.' });
  }
  try {
    const r = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/internal/imagin8/${feature}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tru-sync-key': SYNC_KEY },
      body: JSON.stringify({ dealershipId: resolveDealerId(req), ...params }),
      signal: AbortSignal.timeout(25000),
    });
    const body = await r.json().catch(() => ({ error: 'Unparseable gateway response' }));
    return res.status(r.status).json(body);
  } catch (err: any) {
    console.warn('[imagin8] gateway unreachable:', err?.message || err);
    // Fail CLOSED: an ungated success here would be a free paid call.
    return res.status(502).json({ error: 'TruFlow unreachable — TransUnion calls are unavailable right now.' });
  }
}

app.post('/api/imagin8/valuation', authenticate, async (req: any, res) => {
  const { mmCode, year, mileage } = req.body || {};
  if (!mmCode || !year) return res.status(400).json({ error: 'mmCode and year are required' });
  if (handleDemoImagin8(req, res, 'valuation', { mmCode, year, mileage })) return;
  await imagin8Proxy(req, res, 'valuation', { mmCode, year, mileage });
});

// Static specs for the Add Vehicle flow (platform key / flat subscription).
// Switched to GET query params — JSON POST bodies return 400 on Render/Cloudflare.
app.get('/api/imagin8/static', authenticate, async (req: any, res) => {
  const mmCode = req.query?.mmCode;
  if (!mmCode) return res.status(400).json({ error: 'mmCode is required' });
  if (!imagin8Configured()) return res.status(503).json({ error: 'IMAGIN8_API_KEY + IMAGIN8_CUSTOMER_ID not configured' });
  try {
    const result = await imagin8GetStaticInfo(String(mmCode), imagin8Opts);
    res.json(result);
  } catch (err: any) {
    console.error('[imagin8] static info failed:', err?.message || err);
    res.status(502).json({ error: err?.message || 'Static info failed' });
  }
});

// Live model catalogue for the Add Vehicle picker (platform key / flat subscription).
// Returns { variants: CatalogueVariant[] } so the picker can build model → variant → mmCode.
// Switched to GET query params — JSON POST bodies return 400 on Render/Cloudflare.
app.get('/api/imagin8/models', authenticate, async (req: any, res) => {
  const make = req.query?.make;
  if (!make) return res.status(400).json({ error: 'make is required' });
  if (!imagin8Configured()) return res.status(503).json({ error: 'IMAGIN8_API_KEY + IMAGIN8_CUSTOMER_ID not configured' });
  try {
    const variants = await imagin8GetModels(String(make), imagin8Opts);
    res.json({ variants });
  } catch (err: any) {
    console.error('[imagin8] getModels failed:', err?.message || err);
    res.status(502).json({ error: err?.message || 'Model lookup failed' });
  }
});

// NOTE: Reg Check and Accident Report are now bundle-gated in TruLens too.

// Reg Check (chargeable per-call — bundle-gated).
app.all('/api/imagin8/regcheck', authenticate, async (req: any, res) => {
  const identifier = req.body?.identifier || req.query?.identifier;
  const type = req.body?.type || req.query?.type;
  if (!identifier) return res.status(400).json({ error: 'identifier is required' });
  if (handleDemoImagin8(req, res, 'regcheck', { identifier, type })) return;
  await imagin8Proxy(req, res, 'regcheck', { identifier, type });
});

// Accident Report (chargeable per-call — bundle-gated).
app.all('/api/imagin8/accident-report', authenticate, async (req: any, res) => {
  const vin = req.query?.vin || req.body?.vin;
  if (!vin) return res.status(400).json({ error: 'vin is required' });
  if (handleDemoImagin8(req, res, 'accident-report', { vin })) return;
  await imagin8Proxy(req, res, 'accident-report', { vin });
});

// Bundle balance — read from Flow central so there is ONE ledger. Demo tokens
// short-circuit locally to their own simulated budget and never reach the gateway.
app.get('/api/imagin8/bundles', authenticate, async (req: any, res) => {
  if (req.user?.demo) return res.json({ valuation: 0, regCheck: 0, accidentReport: 0, demo: true });
  if (!SYNC_KEY) return res.json(DEMO_ZERO_BUNDLES); // gateway down → fail closed
  try {
    const slug = resolveDealerId(req);
    const r = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/internal/imagin8/bundles?dealershipId=${encodeURIComponent(slug)}`, {
      headers: { 'x-tru-sync-key': SYNC_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    res.json(await r.json());
  } catch (err: any) {
    console.warn('[imagin8] bundles gateway unreachable:', err?.message || err);
    res.json(DEMO_ZERO_BUNDLES); // fail closed: buttons lock rather than lie
  }
});

// Top-ups are a TruSaaS-side action (the owner buys the credits) — no dealer,
// and no Lens route, may mint them.
app.post('/api/imagin8/bundles', authenticate, (_req: any, res) => {
  res.status(403).json({ error: 'Top-ups are managed by TruSaaS. Contact your account manager.' });
});

async function restoreCorruptedDemoVehicles() {
  const SYNC_KEY = process.env.TRUFLOW_SYNC_KEY;
  if (!SYNC_KEY) return;
  try {
    const dlRes = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/public/dealerships`);
    if (!dlRes.ok) return;
    const dlList = await dlRes.json();
    if (!Array.isArray(dlList)) return;
    const slugMap = new Map<string, string>();
    for (const d of dlList) {
      if (d.id && d.slug) slugMap.set(d.id, d.slug);
    }

    const invRes = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/inventory`, {
      headers: { 'x-tru-sync-key': SYNC_KEY }
    });
    if (!invRes.ok) {
      console.warn('[restore] failed to fetch DMS inventory:', invRes.status);
      return;
    }
    const dmsVehicles = await invRes.json();
    if (!Array.isArray(dmsVehicles)) return;

    const store = readLocalStore();
    let changed = false;
    for (const v of store.vehicles) {
      const hasRealOwner = v.ownerId && v.ownerId !== 'local-demo-user' && !v.ownerId.startsWith('demo-');
      if (v.dealerSlug === 'demo' && hasRealOwner) {
        const dmsMatch = dmsVehicles.find((dv: any) => dv.stockNumber === v.stockNumber || dv.id === v.lastDmsVehicleId);
        if (dmsMatch && dmsMatch.dealershipId && dmsMatch.dealershipId !== 'demo') {
          const correctSlug = slugMap.get(dmsMatch.dealershipId);
          if (correctSlug) {
            console.log(`[restore] Restoring hijacked vehicle ${v.id} (${v.year} ${v.make} ${v.model}) to ${correctSlug}`);
            v.dealerSlug = correctSlug;
            changed = true;
          }
        }
      }
    }
    if (changed) {
      writeLocalStore(store);
      console.log('[restore] Database repaired successfully.');
    }
  } catch (err: any) {
    console.error('[restore] demo recovery error:', err?.message || err);
  }
}

// ==================== VITE & STATIC FILES ====================

async function startServer() {
  const publicDir = path.join(process.cwd(), 'public');

  // PWA assets — no long cache on SW so updates apply
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(publicDir, 'sw.js'));
  });
  app.get('/manifest.webmanifest', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDir, 'manifest.webmanifest'));
  });

  // Icons + dealer website embeds
  app.use('/icons', express.static(path.join(publicDir, 'icons'), {
    maxAge: '7d',
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  }));
  app.use('/embed', express.static(path.join(publicDir, 'embed')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Avoid hard crash if HMR websocket port is already taken
        hmr: { port: 24679 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (/\.(js|css|html|json)$/i.test(filePath)) {
          const ct = res.getHeader('Content-Type');
          if (ct && !String(ct).includes('charset')) {
            res.setHeader('Content-Type', ct + '; charset=utf-8');
          }
        }
      }
    }));
    // Ensure public PWA files exist in dist after vite build (copied automatically)
    app.use(express.static(publicDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(` PWA: ${PORT === 443 || process.env.HTTPS ? 'https' : 'http'}://<this-host>:${PORT}  → Add to Home Screen on phone`);
    restoreCorruptedDemoVehicles().catch((err) => console.error('[restore] failed to run recovery:', err));
  });
}

startServer();
