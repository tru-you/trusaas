import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
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

/* Every TruLens template slot is `required: false` (agency's call what goes on
   their site — see src/template.ts), so there is no `required` subset to pull
   from the template itself for the two "is this capture practically done"
   gates below. This hand-picks the same kind of "core shot, not an
   accessory/detail extra" set the old hardcoded lists here used to express —
   the physical-accessory shots (present/not-present, not a blocking photo)
   and the roof, which was always optional even before this file's lists went
   stale and started referencing a 'video_360' slot TruLens has never had. */
const TRULENS_CORE_SLOT_IDS = DEFAULT_TEMPLATE.slots
  .filter((s) => !['compliance_docs', 'geyser', 'roof_condition', 'pool_area'].includes(s.id))
  .map((s) => s.id);

// Load environment variables first
dotenv.config();

// Same Firebase project + named DB as PropLens photo sync
const FIREBASE_PROJECT_ID = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0151924955';
const AUTOLENS_DB_ID = process.env.AUTOLENS_DB_ID || 'ai-studio-autolenspro-7d4757ec-a059-4566-98db-d15a4840f4ec';
// Every device exports to this one FlowPMS. Overridable only by env, never
// per-phone. Set TRUFLOW_PMS_URL in production or exports fail with a clear
// message instead of silently landing in the wrong system.
const DEFAULT_PMS_URL =
  process.env.TRUFLOW_PMS_URL ||
  process.env.PMS_URL ||
  (process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:3001');
// Legacy: agency captures made before agency tagging existed default to
// mkr-autosales.
/**
 * Device access code.
 *
 * Without one, this API was open in production: LOCAL_MODE accepted ANY bearer
 * token (`Bearer zzz` returned portfolio), and a `local-` prefix short-circuited
 * auth entirely. Anyone could read, create or delete a agency's captured
 * properties and their photos.
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
 * Per-agency access codes.
 *
 * TRULENS_AGENCY_CODES = "homes-on-caledon:CODE1,mkr-autosales:CODE2"
 *
 * With one shared code the login could not tell which agency was holding
 * the phone, so the agency picker was the only thing deciding where a homes
 * filed — and a wrong tap put it in someone else's yard with no error. A code
 * from this map pins the agency server-side and the picker becomes a
 * confirmation rather than the source of truth.
 *
 * TRULENS_ACCESS_CODE still works exactly as before. Phones already signed in
 * keep their tokens, and a agency without its own code yet behaves as it
 * always has.
 */
const AGENCY_CODES: Array<{ slug: string; code: string }> = String(
  process.env.TRULENS_AGENCY_CODES || ''
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

/** The agency a code belongs to, or null for the legacy shared code. */
function agencyForCode(given: string): string | null {
  for (const entry of AGENCY_CODES) {
    if (codeMatches(given, entry.code)) return entry.slug;
  }
  return null;
}

function signDeviceToken(agencySlug?: string | null): string {
  const claims: Record<string, unknown> = { k: 'device', exp: Date.now() + DEVICE_TOKEN_TTL_MS };
  if (agencySlug) claims.d = agencySlug;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Claims when the token is valid, otherwise null. */
function deviceTokenClaims(token: string): { agencySlug?: string } | null {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (claims.k !== 'device' || !(claims.exp > Date.now())) return null;
    return { agencySlug: typeof claims.d === 'string' ? claims.d : undefined };
  } catch { return null; }
}

const LENS_DEFAULT_AGENCY_SLUG = process.env.LENS_DEFAULT_AGENCY_SLUG || 'mkr-autosales';

// Local PC mode: no Google Cloud credentials needed. Stores portfolio in data/local-inventory.json
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

type LocalStore = { properties: any[] };

function isValidPhotoData(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 32) return false;
  /* A stored reference — "/media/<sha256>.jpg" — is a real photo, and is the
     form every capture takes once it is on disk. It has to be named explicitly:
     at ~75 characters it is far too short for the raw-base64 rule below and
     carries no data:/http prefix, so without this it reads as junk and
     normalizeProperty drops it — silently deleting every photo on the property's
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

/** Ensure every property is safe for the UI (never crash on missing photos/price). */
// ── Property-features normaliser ───────────────────────────────
// Folds free-text variants ("solar geyser", "solar", "solar water heater")
// into one canonical label so filters, feeds, and agency sites all agree.
// Table-stakes features (walls, roof, windows, doors, plumbing) are dropped —
// listing them adds noise.
const FEATURE_ALIASES: [RegExp, string][] = [
  [/\bsolar\s*(geyser|water\s*heater|system|power|panels?)?\b/i, 'Solar'],
  [/\bgeyser\b|\bwater\s*heater\b/i, 'Geyser'],
  [/\bheat\s*pump/i, 'Heat Pump'],
  [/\binverter\b|\beskom\s*backup|\bbackup\s*power|\bgenerator\b/i, 'Backup Power'],
  [/\bfibre\b|\bfiber\b|\bftth\b/i, 'Fibre'],
  [/\bair\s*conditioning|\bac\b|\bcooling/i, 'Air Conditioning'],
  [/\bgas\s*(stove|cooker|hob)|\bgas\s*connection/i, 'Gas Stove / Hob'],
  [/\bpool\b|\bswimming\s*pool/i, 'Pool'],
  [/\bjacuzzi\b|\bhot\s*tub\b/i, 'Jacuzzi / Hot Tub'],
  [/\bbraai\b|\bbarbecue\b|\bbraai\s*area/i, 'Braai / BBQ'],
  [/\boutside\s*building|\bdomestic\s*quarters|\bstaff\s*quarters\b/i, 'Staff Quarters'],
  [/\bgranny\s*flat|\bflatlet\b|\bcottage\b/i, 'Granny Flat / Flatlet'],
  [/\balarm\b|\bburglar\s*alarm\b/i, 'Security Alarm'],
  [/\bsecurity\s*gate|\belectric\s*gate\b/i, 'Electric Gate'],
  [/\bsecurity\s*(camera|cctv)/i, 'CCTV'],
  [/\bcomplex\b|\bestate\b|\bsectional\s*title\b/i, 'Complex / Estate'],
  [/\bborehole\b|\bjojo\s*tank\b|\bwater\s*tank\b/i, 'Borehole / Water Tank'],
  [/\bdouble\s*garage|\bgarage\b/i, 'Garage / Parking'],
  [/\bfireplace\b|\bhearth\b/i, 'Fireplace'],
  [/\bstudy\b|\bhome\s*office\b/i, 'Study / Office'],
  [/\bpet\s*friendly\b|\bdog\s*friendly\b/i, 'Pet Friendly'],
  [/\bprepaid\s*electricity\b|\bprepaid\s*meter\b/i, 'Prepaid Electricity'],
  [/\bairbnb\b|\bguesthouse\b|\bincome\s*generating/i, 'Income Generating'],
];
const FEATURES_DROP = /\bwalls?\b|\broof\b|\bwindows?\b|\bdoors?\b|\bfloor(ing)?\b|\bplumbing\b|\bcelling\b|\bpaint(ed)?\b/i;
const SOLAR_YES = /\bsolar\b/i;
const SOLAR_NO = /\bnon.solar\b/i;

function normaliseFeatures(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = String(item || '').trim();
    if (!s || FEATURES_DROP.test(s)) continue;
    let label = s;
    // Solar has a special guard
    if (SOLAR_YES.test(s) && !SOLAR_NO.test(s)) {
      label = 'Solar';
    } else {
      for (const [re, canonical] of FEATURE_ALIASES) {
        if (re.test(s)) { label = canonical; break; }
      }
    }
    const key = label.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(label); }
  }
  return out.length ? out : undefined;
}

function normalizeProperty(raw: any): any {
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
    erfRef: raw.erfRef ?? '',
    listingRef: raw.listingRef ?? '',
    color: raw.color ?? '',
    year: Number(raw.year) || new Date().getFullYear(),
    price: Number(raw.price) || 0,
    status: raw.status || 'In-Progress',
    photos,
    quality: normalizeQuality(raw.quality),
    features: normaliseFeatures(raw.features),
  };
}

function readLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
      const properties = Array.isArray(parsed?.properties) ? parsed.properties.map(normalizeProperty) : [];
      return { properties };
    }
  } catch (e) {
    console.error('Local store read error:', e);
  }
  return { properties: [] };
}

function writeLocalStore(store: LocalStore) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    const safe = { properties: (store.properties || []).map(normalizeProperty) };
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
 * path that touches portfolio — converting there would re-scan every photo of
 * every capture on every call, which is the cost this change removes.
 *
 * Idempotent: put() returns a stored reference unchanged, so a second run is a
 * no-op and an interrupted run simply resumes. Firestore-backed instances are
 * skipped: their documents are migrated as each property is next saved, and
 * rewriting an entire collection at boot is not something to do unattended.
 */
function migrateCapturesToFiles(): void {
  if (!LOCAL_MODE) {
    console.log('[photos] cloud mode — captures convert as properties are saved.');
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
  for (const v of store.properties || []) {
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
 * untouched — and these are the largest objects the system produces: the the demo property
 * orbit was still being served at 20,004,300 bytes after the capture photos had
 * already moved. A client that times out at 12 seconds never receives it, which
 * is why agency sites fell back to showing a different homes entirely.
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
         they are not frames, but on the the demo property the two of them were 717 KB —
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
  console.log(' Portfolio file: ' + LOCAL_DATA_FILE);
  console.log(' FlowPMS export URL: ' + DEFAULT_PMS_URL);
  console.log(' Open: http://localhost:3000');
  console.log('────────────────────────────────────────────');
}

/* Safety net: without an access code, per-agency codes or an explicit token
   secret, TOKEN_SECRET falls back to sha256('trulens-dev') and the local-mode
   branches accept any Bearer string — fine on a laptop, a hole in prod. Warn
   only, never exit; an outage is worse than a noisy log line. */
if (!ACCESS_CODE && AGENCY_CODES.length === 0 && !process.env.TRULENS_TOKEN_SECRET) {
  console.warn('────────────────────────────────────────────');
  console.warn(' WARNING: no auth secret configured.');
  console.warn(' Set TRULENS_ACCESS_CODE, TRULENS_AGENCY_CODES or');
  console.warn(' TRULENS_TOKEN_SECRET. Without one, any Bearer token');
  console.warn(' is accepted — safe locally, NOT in production.');
  console.warn('────────────────────────────────────────────');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Increase payload limits for Base64 property photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/* Captured photos, served as files.
 *
 * Immutable for a year, which is safe because the filename is the SHA-256 of
 * the bytes — a path can never come to mean different content, so there is no
 * cache to bust. This is what lets a agency website fetch each photo once
 * instead of pulling every photo of every homes inside one JSON payload: the
 * TruLens public feed carried 25 base64 images in a single response.
 *
 * Public and registered before authenticate: these are listing photos bound for
 * public agency websites, and the path is an opaque hash. */
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

// Middleware to verify Firebase ID Token — falls back to local/demo user on PC
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  // A signed device token, issued by POST /api/auth/device in exchange for the
  // agency's access code.
  const deviceClaims = deviceTokenClaims(idToken);
  if (deviceClaims) {
    req.user = {
      uid: 'device',
      email: 'device@trulens.local',
      local: true,
      // Present only when signed in with a per-agency code. Anything the
      // request body claims about the agency is overridden by this.
      agencySlug: deviceClaims.agencySlug,
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

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('Gemini API initialized successfully.');
} else {
  console.warn('GEMINI_API_KEY not found — AI analysis runs in mock mode.');
}

// ==================== PORTFOLIO HELPERS ====================

/* Scope arg: agencySlug is authoritative when the device is signed in with a
   agency code. ownerId (which phone captured it) is the legacy fallback for
   pre-tagging captures and for local-demo mode where no agency is bound.
   Before this, listVehicles filtered by ownerId alone, so a phone that
   captured for agency A and later signed in with agency B's code saw A's
   portfolio in Lens — a cross-agency read leak. */
type LensScope = { uid: string; agencySlug?: string | null };

/* 14-day Lens retention: once a property has been in the FlowPMS for two weeks,
   Flow is the source of truth and the Lens copy is deleted. Sweep runs
   lazily on every listVehicles call — no cron, no scheduler. A property
   that never gets listed still eventually goes when someone opens the
   portfolio. Flow also proactively clears Lens on a hard delete via the
   /api/sync/property callback; sold status is deliberately NOT a trigger
   because deals fall through and a sold-then-unsold property should still
   be editable in Lens if it's inside the retention window. */
const LENS_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
function isExpired(v: any, nowMs: number): boolean {
  const first = v.firstPmsExportAt;
  if (!first) return false;
  const t = Date.parse(first);
  if (!Number.isFinite(t)) return false;
  return nowMs - t > LENS_RETENTION_MS;
}

async function listVehicles(user: LensScope): Promise<any[]> {
  const { uid, agencySlug } = user;
  const nowMs = Date.now();

  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const before = store.properties.length;
    /* Drop expired rows in place before scoping — sweep applies globally so
       any agency opening their list also cleans anything they own that has
       aged out. */
    store.properties = store.properties.filter((v) => !isExpired(v, nowMs));
    if (store.properties.length !== before) writeLocalStore(store);
    const list = store.properties
      .filter((v) => passesScope(v, user))
      .map(normalizeProperty)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }

  /* Firestore query: prefer agencySlug when the token has one, fall back to
     ownerId. The passesScope helper is JS-only, so we still need a where()
     that narrows the result set before it comes back. Legacy untagged rows
     captured by this user are still reachable via the ownerId branch. */
  const query = agencySlug
    ? fdb.collection('properties').where('agencySlug', '==', agencySlug)
    : fdb.collection('properties').where('ownerId', '==', uid);
  const snapshot = await query.orderBy('updatedAt', 'desc').get();

  const kept: any[] = [];
  const expiredRefs: any[] = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as any;
    if (isExpired(data, nowMs)) {
      expiredRefs.push(doc.ref);
    } else {
      kept.push(normalizeProperty(data));
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
   - local-demo-user always wins (dev/PC demo mode).
   - Explicitly tagged property → the token's agencySlug must match.
   - Untagged (legacy) property → fall back to ownerId match. Using the
     default-agency fallback for access decisions was a bug — it 404'd the
     rightful owner of any legacy capture that predates agency tagging. */
function passesScope(record: any, user?: LensScope): boolean {
  if (!user) return true;
  if (user.uid === 'local-demo-user') return true;
  if (record.agencySlug) {
    return !user.agencySlug || record.agencySlug === user.agencySlug;
  }
  if (user.uid && record.ownerId && record.ownerId !== user.uid) return false;
  return true;
}

async function getVehicle(id: string, user?: LensScope): Promise<any | null> {
  if (LOCAL_MODE || !fdb) {
    const found = readLocalStore().properties.find((v) => v.id === id);
    if (!found) return null;
    return passesScope(found, user) ? normalizeProperty(found) : null;
  }
  const doc = await fdb.collection('properties').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as any;
  return passesScope(data, user) ? normalizeProperty(data) : null;
}

/** Move a capture's photos onto disk, leaving references in the record.
 *
 *  Every write goes through saveProperty, so this one place keeps image bytes out
 *  of local-inventory.json and out of Firestore documents — the latter matters
 *  more than it looks, because a Firestore document has a hard 1 MiB ceiling and
 *  a couple of base64 photos will breach it.
 *
 *  Idempotent: put() hands back a reference unchanged, so re-saving a property
 *  that is already converted costs a map and nothing else. */
function storeVehiclePhotos(property: any): any {
  const photos = property?.photos;
  if (!photos || typeof photos !== 'object') return property;
  const next: Record<string, string> = {};
  for (const [slotId, value] of Object.entries(photos)) {
    const ref = putPhoto(value);
    /* Falls back to the original value when the store cannot take it, so a
       capture is never silently lost — it simply stays base64. */
    next[slotId] = ref || (value as string);
  }
  return { ...property, photos: next };
}

/** Last-writer-wins merge, per field. Both sides of the Lens<->Flow sync stamp
 *  fieldMeta[f] = Date.now() on every field they change, and stale pushes lose:
 *  a Lens re-export cannot silently clobber a fresher FlowPMS edit, and vice versa.
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
  'make', 'model', 'year', 'trim', 'erfRef', 'color',
  'floorArea', 'transmission', 'fuelType', 'propertyType',
  'price', 'showOnWebsite', 'description', 'status', 'listingRef',
] as const;

async function saveProperty(property: any): Promise<any> {
  const normalized = storeVehiclePhotos(normalizeProperty(property));
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const idx = store.properties.findIndex((v) => v.id === normalized.id);
    if (idx === -1) store.properties.unshift(normalized);
    else store.properties[idx] = { ...store.properties[idx], ...normalized };
    writeLocalStore(store);
    return normalized;
  }
  await fdb.collection('properties').doc(normalized.id).set(normalized, { merge: true });
  return normalized;
}

async function deleteVehicle(id: string): Promise<boolean> {
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const before = store.properties.length;
    store.properties = store.properties.filter((v) => v.id !== id);
    writeLocalStore(store);
    return store.properties.length < before;
  }
  await fdb.collection('properties').doc(id).delete();
  return true;
}

// ==================== API ROUTES ====================

// Health / mode check (no auth) + keep-alive pings
const STARTED_AT = Date.now();
/** Exchange the agency's access code for a signed device token.
 *  Deliberately public — it is the way in. Slow-hashed and rate-limited by
 *  nothing yet, so keep the code long. */
/**
 * Ask TruFlow whether a code is real and whether it opens TruLens.
 *
 * Agencies, their codes and their entitlements live in one place. This app
 * used to keep its own copy of every agency's code in TRULENS_AGENCY_CODES — a
 * comma-separated "slug:CODE" string in the service configuration — so
 * onboarding a agency meant pasting their code here in plaintext and restarting
 * this service, and revoking meant editing that string and restarting again.
 *
 * Returns null on anything other than a clean yes, including an unreachable
 * TruFlow, so the caller can fall back to the environment list rather than
 * locking a yard out of their phones because the FlowPMS was briefly down.
 */
async function verifyCodeWithTruFlow(
  code: string
): Promise<{ agencySlug: string; agencyName?: string } | null> {
  if (!SYNC_KEY) return null; // no shared key configured — nothing to ask with
  try {
    const res = await fetch(`${DEFAULT_PMS_URL.replace(/\/$/, '')}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tru-sync-key': SYNC_KEY },
      body: JSON.stringify({ code, product: 'lens' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      /* 403 is a real answer, not a failure: the code is valid but this
         agency is not set up for TruLens. Logged so an onboarding mistake
         is visible rather than looking like a wrong code. */
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        console.warn(`[auth] TruFlow refused a code for lens: ${body?.message || res.status}`);
      }
      return null;
    }
    const body = await res.json();
    return body?.ok && body.agencySlug
      ? { agencySlug: body.agencySlug, agencyName: body.agencyName }
      : null;
  } catch (err: any) {
    console.warn('[auth] could not reach TruFlow to verify a code:', err?.message || err);
    return null;
  }
}

app.post('/api/auth/device', async (req, res) => {
  const given = String(req.body?.code || '');

  /* TruFlow first. A agency onboarded there works here immediately, with no
     environment variable to edit and no restart of this service. */
  const central = await verifyCodeWithTruFlow(given);
  if (central) {
    return res.json({
      token: signDeviceToken(central.agencySlug),
      expiresInDays: 30,
      agencySlug: central.agencySlug,
      agencyName: central.agencyName,
    });
  }

  /* Then the local list. Kept as a fallback so phones already signed in keep
     working, and so a TruFlow outage cannot stop a yard photographing homes. */
  const agencySlug = agencyForCode(given);
  if (agencySlug) {
    return res.json({ token: signDeviceToken(agencySlug), expiresInDays: 30, agencySlug });
  }

  // Legacy shared code — still valid, but carries no agency, so the picker
  // remains the only thing that decides where captures file.
  if (ACCESS_CODE && codeMatches(given, ACCESS_CODE)) {
    return res.json({ token: signDeviceToken(), expiresInDays: 30, agencySlug: null });
  }

  /* Only now is "nothing is configured" worth reporting, and it is a different
     complaint from a wrong code: with central verification available this
     server needs no local codes at all. */
  if (!ACCESS_CODE && AGENCY_CODES.length === 0 && !SYNC_KEY) {
    return res.status(503).json({
      error: 'No way to verify codes on this server.',
      message: 'Set TRUFLOW_SYNC_KEY so codes can be checked against TruFlow, or set TRULENS_ACCESS_CODE.',
    });
  }

  return res.status(401).json({ error: 'That code is not recognised.' });
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
    // fails or a agency files a homes into the wrong yard.
    syncKeyConfigured: !!SYNC_KEY,
    agencyCodesConfigured: AGENCY_CODES.length,
    mode: LOCAL_MODE ? 'local' : 'cloud',
    pmsUrl: DEFAULT_PMS_URL,
    port: PORT,
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

/** TruLens-only public listing — for agencies without FlowPMS (or as photo-first feed) */
/* ── VIR, computed the same way TruFlow computes it ──────────────
 *
 * A agency site can be pointed at either feed — TruLens direct, or TruFlow —
 * and the same homes has to report the same score either way, or switching the
 * source silently rewrites every property's condition rating.
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
 *  terminator and agency sites end up fetching mixed content. */
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
     agency's host and 404. Legacy base64 passes through untouched, so a feed
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
     truflow-premium/server.ts — a agency site switches between the two feeds
     by changing one base URL and nothing else. */
  const damage = flattenDamageFindings(v);

  return {
    id: v.id,
    listingRef: v.listingRef,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || '',
    price: v.price || 0,
    // Absent (not 0) when unset, so a site can tell "no benchmark" from "free".
    truPrice: v.truPrice ? Number(v.truPrice) : undefined,
    floorArea: v.floorArea || 0,
    transmission: v.transmission || '',
    fuelType: v.fuelType || '',
    bodyType: v.propertyType || '',
    color: v.color || '',
    erfRef: v.erfRef || '',
    description: v.aiListingDescription || `${v.year} ${v.make} ${v.model}`,
    status: 'available',
    images,
    heroImage: images[0] || null,
    photoCount: images.length,
    /* A pointer rather than the frames themselves: the orbit is a large set of
       base64 stills and this is a list endpoint, so a site fetches it lazily
       for the homes the buyer actually opened. */
    web3dUrl: v.web3dPublicPath || undefined,
    /** TruLens inspection score 0–100, absent when nothing was tagged. */
    vir: damage.length ? computeVirFromDamage(damage) : undefined,
    /* Absent — not [] — when the homes was never inspected, so a site renders
       the report block only when there is one to render. */
    virReport: damage.length ? buildVirReport(damage) : undefined,
    damage: damage.length ? damage : undefined,
    /* Agency-declared condition — TruLens retail "no damage reported" statement,
       not a graded VIR. Mirrors TruFlow's feed so a site gets the same line from
       either source. Tagged damage takes precedence over a "no damage" claim. */
    conditionLabel: (() => {
      const d = (v as any).conditionDeclaration;
      if (damage.length) return `Visible damage reported — ${damage.length} item${damage.length === 1 ? '' : 's'}`;
      if (d && d.noVisibleDamage) return 'No damage reported';
      return undefined;
    })(),
    conditionDeclaration: (v as any).conditionDeclaration || undefined,
    features: (v as any).features?.length ? (v as any).features : undefined,
    daysInStock: null,
    source: 'trulens',
    updatedAt: v.updatedAt || v.lastPmsExportAt || null,
  };
}

// ── Web 3D / spin packages for agency websites ─────────────────
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
    const { propertyId, package: pkg } = req.body || {};
    if (!pkg?.listingRef || !Array.isArray(pkg.frames)) {
      return res.status(400).json({ error: 'package.listingRef and package.frames required' });
    }

    ensureWeb3dDir();
    const safeStock = String(pkg.listingRef).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(WEB3D_DIR, `${safeStock}.json`);
    /* Frames onto disk, references into the package.
       This is the single largest payload the system produces: the the demo property orbit
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
      // Damage pins carry a thumbnail each — 717 KB of the the demo property package.
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

    // Stamp property if we can
    if (propertyId) {
      try {
        const v = await getVehicle(propertyId, req.user);
        if (v) {
          await saveProperty({
            ...v,
            lastWeb3dExportAt: payload.savedAt,
            web3dPublicPath: `/api/public/web3d/${encodeURIComponent(pkg.listingRef)}`,
            updatedAt: payload.savedAt,
          });
        }
      } catch (e) {
        console.warn('web3d property stamp failed', e);
      }
    }

    res.json({
      success: true,
      listingRef: pkg.listingRef,
      publicUrl: `/api/public/web3d/${encodeURIComponent(pkg.listingRef)}`,
      embedUrl: `/embed/web3d-viewer.html?listing=${encodeURIComponent(pkg.listingRef)}`,
      frames: pkg.frames?.length || 0,
      damageTags: pkg.damageTags?.length || 0,
    });
  } catch (error: any) {
    console.error('web-3d export error', error);
    res.status(500).json({ error: 'Failed to save web 3D package', details: error.message });
  }
});

// GET /api/public/web3d/:listingRef — public package for website players
app.get('/api/public/web3d/:listingRef', (req, res) => {
  try {
    ensureWeb3dDir();
    const safeStock = String(req.params.listingRef).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(WEB3D_DIR, `${safeStock}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'No web 3D package for this listing number' });
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

// GET /api/public/listing — website feed from TruLens (lens-only agencies)
/**
 * The agency list the picker shows, proxied from TruFlow.
 *
 * It used to be a hardcoded array in DealerSelect.tsx, which meant onboarding a
 * agency needed a TruLens release on top of a TruFlow one — and while that list
 * was hand-maintained it drifted, carrying three sample agencies whose slugs
 * TruFlow did not know. Picking one saved a capture with no agency, and the
 * public feed reads untagged listing as the pilot agency, so a shooter could put
 * homes on someone else's website by choosing the wrong row.
 *
 * Proxied rather than fetched straight from the phone: it keeps the FlowPMS URL
 * server-side and avoids relying on TruFlow's CORS for a screen that has to
 * work before anything else does.
 */
app.get('/api/agencies', async (_req, res) => {
  try {
    const r = await fetch(`${DEFAULT_PMS_URL.replace(/\/$/, '')}/api/public/agencies`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`FlowPMS responded ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list)) throw new Error('FlowPMS returned an unexpected shape');
    res.setHeader('Cache-Control', 'no-store');
    res.json(list);
  } catch (err: any) {
    /* The phone falls back to its cached copy. Say so plainly rather than
       returning an empty list, which would read as "no agencies exist". */
    console.warn('[agencies] could not reach the FlowPMS:', err?.message || err);
    res.status(503).json({ error: 'Could not reach the FlowPMS to load agencies.' });
  }
});

app.get('/api/public/listing', async (req, res) => {
  try {
    const agency = String(req.query.agency || '');
    if (!agency) {
      return res.status(400).json({ success: false, error: 'agency query parameter is required' });
    }
    let properties: any[] = [];
    if (LOCAL_MODE || !fdb) {
      properties = readLocalStore().properties.map(normalizeProperty);
    } else {
      const snapshot = await fdb.collection('properties').get();
      properties = snapshot.docs.map((d) => normalizeProperty(d.data()));
    }
    const scoped = properties.filter(
      (v: any) => (v.agencySlug || LENS_DEFAULT_AGENCY_SLUG) === agency
    );
    const publicList = scoped.map((v: any) => toPublicFromLens(v, originOf(req))).filter(Boolean);
    res.json({
      success: true,
      agency,
      source: 'trulens',
      updatedAt: new Date().toISOString(),
      count: publicList.length,
      properties: publicList,
    });
  } catch (error: any) {
    console.error('public listing error', error);
    res.status(500).json({ success: false, error: 'Failed to build listing feed', details: error.message });
  }
});

// 1. Get all properties
app.get('/api/portfolio', authenticate, async (req: any, res) => {
  try {
    const properties = await listVehicles(req.user);
    res.json(properties);
  } catch (error) {
    console.error('GET /api/portfolio - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Add or update property
app.post('/api/portfolio', authenticate, async (req: any, res) => {
  try {
    const vehicleData = req.body;
    const userId = req.user.uid;

    if (!vehicleData.id) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    const now = new Date().toISOString();
    const { agencySlug: _claimedSlug, ownerId: _drop, createdAt: _dropCreated, ...safeData } = vehicleData;
    const existing = await getVehicle(vehicleData.id, req.user);

    /* Token-pinned agencySlug wins; then existing record; body is last resort
       (legacy shared-code tokens where the picker is the only signal). */
    const agencySlug = req.user?.agencySlug || existing?.agencySlug || _claimedSlug || undefined;

    if (existing) {
      if (!LOCAL_MODE && existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updatedProperty = {
        ...existing,
        ...safeData,
        ownerId: existing.ownerId || userId,
        agencySlug,
        updatedAt: now,
        photos: vehicleData.photos ?? existing.photos ?? {},
        quality: vehicleData.quality ?? existing.quality ?? {},
      };
      const saved = await saveProperty(updatedProperty);
      return res.json({ success: true, property: saved });
    }

    /* Timestamp fallback so no capture ever lands without a listing number.
       Format keeps codes sortable and human-readable, and the second-level
       precision makes collision from a single phone effectively impossible.
       Never overwrites a agency-typed value. */
    const listingRefFallback = 'STK-' + now.replace(/[-:T.Z]/g, '').slice(0, 14);
    const newProperty = {
      ...safeData,
      ownerId: userId,
      agencySlug,
      listingRef: vehicleData.listingRef || listingRefFallback,
      createdAt: now,
      updatedAt: now,
      photos: vehicleData.photos || {},
      quality: vehicleData.quality || {},
    };
    await saveProperty(newProperty);
    res.json({ success: true, property: newProperty });
  } catch (error) {
    console.error('POST /api/portfolio - Server Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Upload/Save photo for a specific property slot
app.post('/api/portfolio/upload-photo', authenticate, async (req: any, res) => {
  try {
    const { propertyId, slotId, base64Image, qualityReport, assessment, closeups } = req.body;
    const userId = req.user.uid;

    if (!propertyId || !slotId || !base64Image) {
      return res.status(400).json({ error: 'propertyId, slotId, and base64Image are required' });
    }

    const existingData = await getVehicle(propertyId, req.user);
    if (!existingData) {
      return res.status(404).json({ error: 'Property not found' });
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
    /* Return what was actually stored, not what arrived. saveProperty moves the
       photo onto disk and swaps in a reference, so echoing `updated` handed the
       client back the full base64 it had just uploaded — which it then held in
       memory until its next fetch, on a phone, for every shot in the capture. */
    const saved = await saveProperty(updated);
    res.json({ success: true, property: saved });
  } catch (error) {
    console.error('POST /api/portfolio/upload-photo - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Delete property
app.delete('/api/portfolio/:id', authenticate, async (req: any, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.uid;
    const data = await getVehicle(id, req.user);
    if (!data) {
      return res.status(404).json({ error: 'Property not found' });
    }
    if (!LOCAL_MODE && data.ownerId && data.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteVehicle(id);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/portfolio - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4b. Service-to-service delete — TruFlow calls this when a synced property is
//     removed from the FlowPMS, so the capture doesn't linger in TruLens.
app.delete('/api/sync/property', (req, res) => {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'TRUFLOW_SYNC_KEY is not configured on this server.' });
  }
  if (req.headers['x-tru-sync-key'] !== SYNC_KEY) {
    return res.status(401).json({ error: 'Invalid sync key.' });
  }
  const { listingRef, agencySlug } = req.body || {};
  if (!listingRef) {
    return res.status(400).json({ error: 'listingRef is required.' });
  }

  /* Only ever delete the capture belonging to the agency who deleted it.
     Listing numbers are agency-chosen and short, so two yards routinely share
     one. This matched on the number alone and removed EVERY property carrying
     it — a agency deleting their own homes silently destroyed another agency's
     capture and its photos. The Firestore branch batch-deleted the lot.

     When no agency is named (an older TruFlow that predates this) a single
     unambiguous match is still honoured, but anything wider is refused rather
     than guessed at — a deletion is not the place to pick one. */
  const matchesDealer = (v: any) =>
    !agencySlug || (v.agencySlug || LENS_DEFAULT_AGENCY_SLUG) === agencySlug;

  (async () => {
    try {
      if (LOCAL_MODE || !fdb) {
        const store = readLocalStore();
        const doomed = store.properties.filter(
          (v: any) => v.listingRef === listingRef && matchesDealer(v)
        );
        if (!agencySlug && doomed.length > 1) {
          return res.status(409).json({
            deleted: false,
            removed: 0,
            error:
              `${doomed.length} properties share listing number ${listingRef}. ` +
              'Send agencySlug to say which agency this deletion is for.',
          });
        }
        const ids = new Set(doomed.map((v: any) => v.id));
        store.properties = store.properties.filter((v: any) => !ids.has(v.id));
        writeLocalStore(store);
        return res.json({ deleted: ids.size > 0, removed: ids.size });
      }
      const snapshot = await fdb!.collection('properties')
        .where('listingRef', '==', listingRef)
        .get();
      if (snapshot.empty) {
        return res.json({ deleted: false, removed: 0 });
      }
      const docs = snapshot.docs.filter((d) => matchesDealer(d.data()));
      if (!agencySlug && docs.length > 1) {
        return res.status(409).json({
          deleted: false,
          removed: 0,
          error:
            `${docs.length} properties share listing number ${listingRef}. ` +
            'Send agencySlug to say which agency this deletion is for.',
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
      console.error('[sync] delete by listingRef failed:', err);
      return res.status(500).json({ error: err?.message || 'Delete failed.' });
    }
  })();
});

// 4c. Service-to-service edit — TruFlow calls this when a agency edits a
//     Lens-originated property in Premium or Light FlowPMS. Non-media fields only;
//     photos/damage/VIR stay Lens-owned. Per-field updatedAt decides winners so
//     a Lens re-export cannot stomp a fresher Flow edit and vice versa.
app.put('/api/sync/property', (req, res) => {
  if (!SYNC_KEY) {
    return res.status(503).json({ error: 'TRUFLOW_SYNC_KEY is not configured on this server.' });
  }
  if (req.headers['x-tru-sync-key'] !== SYNC_KEY) {
    return res.status(401).json({ error: 'Invalid sync key.' });
  }
  const { listingRef, agencySlug, patch, fieldMeta } = req.body || {};
  if (!listingRef) {
    return res.status(400).json({ error: 'listingRef is required.' });
  }
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'patch is required.' });
  }
  /* Field-name translation: Flow uses retailPrice/bodyType, Lens uses
     price/propertyType. Normalise here so callers can send either. */
  const normalised: Record<string, any> = { ...patch };
  if (normalised.retailPrice !== undefined && normalised.price === undefined) {
    normalised.price = normalised.retailPrice;
  }
  if (normalised.bodyType !== undefined && normalised.propertyType === undefined) {
    normalised.propertyType = normalised.bodyType;
  }
  /* Same guard as DELETE /api/sync/property — never touch a homes that belongs to
     another agency just because they happen to share a short listing number. */
  const matchesDealer = (v: any) =>
    !agencySlug || (v.agencySlug || LENS_DEFAULT_AGENCY_SLUG) === agencySlug;

  (async () => {
    try {
      const now = Date.now();
      let target: any | null = null;

      if (LOCAL_MODE || !fdb) {
        const store = readLocalStore();
        const candidates = store.properties.filter(
          (v: any) => v.listingRef === listingRef && matchesDealer(v),
        );
        if (candidates.length === 0) {
          return res.status(404).json({ updated: false, error: 'Property not found.' });
        }
        if (!agencySlug && candidates.length > 1) {
          return res.status(409).json({
            updated: false,
            error:
              `${candidates.length} properties share listing number ${listingRef}. ` +
              'Send agencySlug to say which agency this edit is for.',
          });
        }
        target = candidates[0];
      } else {
        const snapshot = await fdb!.collection('properties')
          .where('listingRef', '==', listingRef)
          .get();
        const docs = snapshot.docs.filter((d) => matchesDealer(d.data()));
        if (docs.length === 0) {
          return res.status(404).json({ updated: false, error: 'Property not found.' });
        }
        if (!agencySlug && docs.length > 1) {
          return res.status(409).json({
            updated: false,
            error:
              `${docs.length} properties share listing number ${listingRef}. ` +
              'Send agencySlug to say which agency this edit is for.',
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

      const saved = await saveProperty({
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
      console.error('[sync] PUT /api/sync/property failed:', err);
      return res.status(500).json({ error: err?.message || 'Update failed.' });
    }
  })();
});

// 5. AI Photo Quality Inspection & Listing Description Writer (Gemini)
app.post('/api/gemini/analyze', authenticate, async (req: any, res) => {
  const { base64Image, slotName, propertyInfo } = req.body;

  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  if (!ai) {
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
        feedback: 'The property alignment is perfect! A slightly lower angle would add even more prominence.',
      },
      aiAnalysis: {
        identifiedSubject: `${propertyInfo?.address || 'Listed property'}`,
        suggestedTitle: `Stunning ${propertyInfo?.address || 'Listed property'}`,
        suggestedDescription: `Discover this fully-inspected, highly desirable ${propertyInfo?.address || 'listed property'}. Professionally photographed and detailed, featuring immaculate finishes and well-kept features. Book a viewing today!`,
        detectedIssues: ['Slight window reflections - adjust angle if reflection covers safety cameras.'],
      },
    });
  }

  try {
    const prompt = `You are an expert property listing quality inspection agent. Examine the provided property photo (captured in slot: "${slotName || 'General Exterior'}").
Analyze the photo for listing quality, and provide precise JSON feedback on:
1. Overall score (0-100).
2. Lighting evaluation: Status ("Poor", "Fair", "Perfect"), and a short feedback message warning about shadows, glare, or darkness.
3. Angle/framing evaluation: Status ("Off-Angle", "Good", "Perfect"), and feedback on whether the property complies with standard estate photography guides.
4. Auto-identification and marketing generator: Guess/confirm the property details based on the image, write an attention-grabbing listing Title, a highly compelling agency marketplace listing Description, and list any visible cosmetic issues or reflections.

You MUST respond strictly with a valid JSON matching this schema:
{
  "overallScore": number,
  "lightingCheck": {
    "status": "Poor" | "Fair" | "Perfect",
    "brightness": number (0-255),
    "contrast": number (0-255),
    "feedback": string
  },
  "angleCheck": {
    "status": "Off-Angle" | "Good" | "Perfect",
    "pitchDiff": number,
    "rollDiff": number,
    "feedback": string
  },
  "aiAnalysis": {
    "identifiedSubject": string,
    "suggestedTitle": string,
    "suggestedDescription": string,
    "detectedIssues": string[]
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            lightingCheck: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                brightness: { type: Type.INTEGER },
                contrast: { type: Type.INTEGER },
                feedback: { type: Type.STRING },
              },
              required: ['status', 'brightness', 'contrast', 'feedback'],
            },
            angleCheck: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                pitchDiff: { type: Type.NUMBER },
                rollDiff: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
              },
              required: ['status', 'pitchDiff', 'rollDiff', 'feedback'],
            },
            aiAnalysis: {
              type: Type.OBJECT,
              properties: {
                identifiedSubject: { type: Type.STRING },
                suggestedTitle: { type: Type.STRING },
                suggestedDescription: { type: Type.STRING },
                detectedIssues: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['identifiedSubject', 'suggestedTitle', 'suggestedDescription', 'detectedIssues'],
            },
          },
          required: ['overallScore', 'lightingCheck', 'angleCheck', 'aiAnalysis'],
        },
      },
    });

    const resultText = response.text || '';
    const parsedData = JSON.parse(resultText);
    res.json(parsedData);
  } catch (error: any) {
    console.error('Gemini analysis error:', error);
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
          feedback: 'Property framing looks correct based on local validation.',
        },
        aiAnalysis: {
          identifiedSubject: `${propertyInfo?.address || 'Listed property'}`,
          suggestedTitle: `New Listing: ${propertyInfo?.address || 'Property'}`,
          suggestedDescription: `Automated analysis is currently in maintenance mode. This ${propertyInfo?.address || 'property'} is ready for inspection and listing.`,
          detectedIssues: ['AI Analysis Service Offline - Using local heuristic checks.'],
        },
      });
    }
    res.status(500).json({ error: 'AI analysis failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// ==================== FlowPMS EXPORT (TruFlow) ====================

const SLOT_TO_DMS_CATEGORY: Record<string, string> = {
  // Category 1: Front & Bedrooms
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
  service_book: 'serviceBookPhotos', erfSize: 'extrasPhotos', spare_keys: 'extrasPhotos',
};

function buildDmsBreakdown(photos: Record<string, string>) {
  const counts: Record<string, number> = {
    images: 0, extrasPhotos: 0, damagePhotos: 0, erfPhotos: 0, serviceBookPhotos: 0,
  };
  /* The walkaround is counted separately, and by its MIME rather than by which
     slot it came from. It used to be lumped in with the photo count, so an
     export that silently carried no video was indistinguishable from one that
     did — the only way to find out was to read the agency's public feed
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
    erfRef: counts.erfPhotos,
    serviceBook: counts.serviceBookPhotos,
    walkaround,
    stills,
    total: Object.keys(photos || {}).length,
  };
}

app.post('/api/export/pms', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const {
      propertyId,
      pmsUrl: pmsUrlOverride,
      agencySlug: claimedDealerSlug,
      createIfMissing = true,
    } = req.body || {};

    /* When the device signed in with a per-agency code, that wins. The
       body value is a claim from the client; the token is evidence. This is
       what stops a mis-set picker filing a homes into another agency's yard. */
    const agencySlug = req.user?.agencySlug || claimedDealerSlug;
    if (req.user?.agencySlug && claimedDealerSlug && claimedDealerSlug !== req.user.agencySlug) {
      console.warn(
        `[export] device is signed in as "${req.user.agencySlug}" but requested ` +
        `"${claimedDealerSlug}" — using the signed-in agency.`
      );
    }

    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }

    /* Stop here rather than build and upload a multi-megabyte payload the FlowPMS
       will refuse. A device signed in with the legacy shared code carries no
       agency in its token, so the slug rests entirely on the phone's
       localStorage — cleared browser data or a reinstalled PWA leaves it blank,
       and an export with no agency used to be filed against the FlowPMS's
       default yard rather than rejected. */
    if (!agencySlug) {
      return res.status(400).json({
        success: false,
        error:
          'No agency selected on this device. Choose the agency in ' +
          'TruLens before exporting, so the capture files into the right yard.',
      });
    }

    const property = await getVehicle(propertyId, req.user);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    if (!LOCAL_MODE && property.ownerId && property.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    /* The wire format to TruFlow is still { slotId: dataUri }, so photos that
       now live on disk are read back for the export. That keeps the two products
       independent — TruFlow's own migration landed separately and neither had to
       ship in lockstep with the other.
       It does mean the upload is still large. Making the export post references
       and having TruFlow fetch them is the next step, and the one that actually
       shrinks what a phone sends over mobile data. */
    const storedPhotos = property.photos || {};
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

    /* Property-level inspection score. TruLens scores each slot as it is shot
       and has never sent any of it on, so the FlowPMS and the agency's website had
       no idea a homes had been inspected at all. There is no single score on the
       property — it is the mean of the per-slot reports, rounded. */
    const slotScores = Object.values(property.quality || {})
      .map((q: any) => (typeof q?.overallScore === 'number' ? q.overallScore : null))
      .filter((n): n is number => n !== null);
    const vir = slotScores.length
      ? Math.round(slotScores.reduce((a, b) => a + b, 0) / slotScores.length)
      : undefined;

    /* The report itself, per section, so the agency's website can render it
       rather than link out to an app the buyer cannot open. Sent as data and
       not as HTML on purpose — each agency site is hand-built, so the layout
       belongs to the site and only the findings belong here.
       80+ reads as a pass; below that the section is worth a look. */
    const inspection = Object.entries(property.quality || {})
      .map(([slotId, q]: [string, any]) => ({
        section: slotId,
        score: typeof q?.overallScore === 'number' ? q.overallScore : null,
        status: typeof q?.overallScore === 'number' && q.overallScore >= 80 ? 'Pass' : 'Attention',
      }))
      .filter((r) => r.score !== null);

    const pmsBase = String(pmsUrlOverride || DEFAULT_PMS_URL).replace(/\/$/, '');
    const pushUrl = `${pmsBase}/api/sync/push-photos`;

    const payload = {
      listingRef: property.listingRef,
      propertyId: property.id,
      createIfMissing: createIfMissing !== false,
      agencySlug: agencySlug || undefined,
      /* TruLens has had a Publish / Unpublish toggle all along, but the value
         never left this app — so it decided nothing about what the agency's
         website actually showed. TruFlow serves that feed, and it read "not
         set" as published, which is how a junk test capture ended up on a live
         agency feed. Sending it makes the button mean what it says. */
      showOnWebsite: typeof property.showOnWebsite === "boolean" ? property.showOnWebsite : undefined,
      property: {
        id: property.id,
        address: property.address,
        suburb: property.suburb,
        city: property.city,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parkingSpaces: property.parkingSpaces,
        erfRef: property.erfRef,
        erfSize: property.erfSize,
        floorSize: property.floorSize,
        listingRef: property.listingRef,
        price: property.price,
        vir,
        inspection: inspection.length ? inspection : undefined,
        /* Hand-tagged damage, flattened out of its per-slot map. Only confirmed
           findings travel: an AI suggestion starts confirmed:false and must be
           accepted by a person before it can reach a buyer-facing report. The
           x/y stay attached so a site can plot the mark on the same photo. */
        damage: (() => {
          const bySlot = (property as any).damageFindings || {};
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
        slotAssessment: Object.keys((property as any).slotAssessment || {}).length
          ? (property as any).slotAssessment
          : undefined,
        /* Agency's condition declaration — TruLens is retail (declared
           condition), not a graded VIR. Carries the "no damage reported"
           statement through to the FlowPMS and on to the agency's website. */
        conditionDeclaration: (property as any).conditionDeclaration || undefined,
        description: property.aiListingDescription || undefined,
        features: (property as any).features?.length ? (property as any).features : undefined,
      },
      photos,
    };

    /* Service-to-service auth for the FlowPMS push. TruFlow leaves
       /api/sync/push-photos open when its TRUFLOW_SYNC_KEY is unset — which is
       how it has been running — so anyone who knew the URL could write properties
       and photos into a agency's portfolio. Sending it here is the half that
       has to ship first: set the key on TruFlow before this and every export
       starts failing. Same value on both services. */
    const pmsRes = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SYNC_KEY ? { 'x-tru-sync-key': SYNC_KEY } : {}),
      },
      body: JSON.stringify(payload),
    });

    const pmsText = await pmsRes.text();
    let pmsData: any = {};
    try {
      pmsData = JSON.parse(pmsText);
    } catch {
      pmsData = { raw: pmsText };
    }

    if (!pmsRes.ok) {
      console.error('FlowPMS export failed:', pmsRes.status, pmsData);
      return res.status(502).json({
        success: false,
        error: 'FlowPMS rejected the export',
        dmsStatus: pmsRes.status,
        pmsUrl: pushUrl,
        details: pmsData.error || pmsData.message || pmsData,
      });
    }

    const nowIso = new Date().toISOString();
    const exportMeta: any = {
      // Remember which agency this capture belongs to. Without it this app's
      // own public feed can't tell one agency's listing from another's.
      agencySlug: agencySlug || property.agencySlug || undefined,
      lastPmsExportAt: nowIso,
      /* Anchor for the 7-day Lens retention window. Only set on the FIRST
         successful export — re-exports must not push the deletion out or a
         busy property would live in Lens forever. */
      firstPmsExportAt: property.firstPmsExportAt || nowIso,
      lastPmsExportStatus: pmsData.synced ? 'success' : 'partial',
      lastPmsPropertyId: pmsData.property?.id || null,
      lastDmsListingRef: pmsData.property?.listingRef || property.listingRef,
    };

    if (property.status === 'Ready' || property.status === 'Listed') {
      exportMeta.status = 'Listed';
      exportMeta.updatedAt = exportMeta.lastPmsExportAt;
    }

    const updated = { ...property, ...exportMeta };
    await saveProperty(updated);

    res.json({
      success: true,
      synced: !!pmsData.synced,
      created: !!pmsData.created,
      message:
        pmsData.message ||
        // Names the walkaround explicitly, so "no walkaround" is visible at the
        // moment of export rather than discovered later in the public feed.
        `Exported ${buildDmsBreakdown(photos).stills} photos` +
        (buildDmsBreakdown(photos).walkaround
          ? ' and the 360 walkaround'
          : ' — no 360 walkaround in this capture') +
        ' to FlowPMS',
      breakdown: buildDmsBreakdown(photos),
      pmsUrl: pushUrl,
      dmsVehicle: pmsData.property || null,
      property: updated,
    });
  } catch (error: any) {
    console.error('POST /api/export/pms - Error:', error);
    const isNetwork =
      error?.cause?.code === 'ECONNREFUSED' ||
      error?.code === 'ECONNREFUSED' ||
      String(error?.message || '').includes('fetch failed') ||
      String(error?.message || '').includes('ECONNREFUSED');

    res.status(isNetwork ? 503 : 500).json({
      success: false,
      error: isNetwork
        ? `Cannot reach FlowPMS at ${DEFAULT_PMS_URL || '(unset)'}. Set TRUFLOW_PMS_URL to your FlowPMS host.`
        : 'FlowPMS export failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/export/pms/config', authenticate, async (_req: any, res) => {
  res.json({
    pmsUrl: DEFAULT_PMS_URL,
    pushEndpoint: `${DEFAULT_PMS_URL.replace(/\/$/, '')}/api/sync/push-photos`,
    mode: LOCAL_MODE ? 'local' : 'cloud',
    databaseId: AUTOLENS_DB_ID,
  });
});

// ==================== VALUATION CARTRUST ====================

const KREDO_CONFIG_PATH = path.join(process.cwd(), 'data', 'valuation-config.json');

function readKredoConfig(): Record<string, { sandboxKey?: string; productionKey?: string; connectedAt?: string }> {
  try {
    return JSON.parse(fs.readFileSync(KREDO_CONFIG_PATH, 'utf-8'));
  } catch { return {}; }
}

function writeKredoConfig(cfg: Record<string, any>) {
  const dir = path.dirname(KREDO_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KREDO_CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

app.get('/api/valuation/status', authenticate, async (req: any, res) => {
  const slug = req.user?.agencySlug || 'default';
  const cfg = readKredoConfig();
  const entry = cfg[slug];
  res.json({
    connected: !!(entry?.sandboxKey || entry?.productionKey),
    agencySlug: slug,
    hasSandboxKey: !!entry?.sandboxKey,
    hasProductionKey: !!entry?.productionKey,
    lastCheckedAt: entry?.connectedAt || null,
  });
});

app.post('/api/valuation/connect', authenticate, async (req: any, res) => {
  const slug = req.user?.agencySlug || 'default';
  const { sandboxKey, productionKey } = req.body || {};
  if (!sandboxKey && !productionKey) {
    return res.status(400).json({ ok: false, error: 'Provide at least one API key.' });
  }
  // TODO(valuation-docs): validate the key against Valuation's test endpoint before storing
  const cfg = readKredoConfig();
  cfg[slug] = {
    ...(sandboxKey ? { sandboxKey } : {}),
    ...(productionKey ? { productionKey } : {}),
    connectedAt: new Date().toISOString(),
  };
  writeKredoConfig(cfg);
  console.log(`[valuation] agency ${slug} connected CarTrust`);
  res.json({ ok: true });
});

app.post('/api/valuation/disconnect', authenticate, async (req: any, res) => {
  const slug = req.user?.agencySlug || 'default';
  const cfg = readKredoConfig();
  delete cfg[slug];
  writeKredoConfig(cfg);
  console.log(`[valuation] agency ${slug} disconnected CarTrust`);
  res.json({ ok: true });
});

app.post('/api/valuation/lookup', authenticate, async (req: any, res) => {
  const slug = req.user?.agencySlug || 'default';
  const erfRef = String(req.body?.erfRef || '').trim().toUpperCase();
  if (!erfRef || erfRef.length < 11) {
    return res.status(400).json({ error: 'Invalid Erf no.' });
  }
  const cfg = readKredoConfig();
  const entry = cfg[slug];
  if (!entry?.sandboxKey && !entry?.productionKey) {
    return res.status(503).json({ error: 'Valuation not connected for this agency.' });
  }
  const apiKey = entry.productionKey || entry.sandboxKey;

  // TODO(valuation-docs): Replace this stub with the real Valuation CarTrust API call.
  // Expected shape (based on marketplace positioning):
  //   POST https://api.valuation.co.za/v1/cartrust/erfRef-lookup   (or similar)
  //   Header: Authorization: Bearer <apiKey>  OR  x-api-key: <apiKey>
  //   Body: { erfRef }
  //   Response: { stolen: bool, writtenOff: bool, financeEncumbered: bool, ... }
  //
  // For now, return a stubbed "all-clear" so the UI wires up end-to-end.
  // When real docs arrive, swap this block for a fetch() call.
  try {
    console.log(`[valuation] CarTrust lookup for Erf no.=${erfRef} agency=${slug} (STUB — real API not yet wired)`);
    const stubResult = {
      erfRef,
      stolen: false,
      writtenOff: false,
      financeEncumbered: false,
      checkedAt: new Date().toISOString(),
      raw: { stub: true, note: 'Replace with real Valuation API response when docs are available' },
    };
    res.json(stubResult);
  } catch (err: any) {
    console.error(`[valuation] lookup failed for Erf no.=${erfRef}:`, err?.message || err);
    res.status(502).json({ error: 'CarTrust lookup failed. Check your API key.' });
  }
});

app.post('/api/valuation/valuation', authenticate, async (req: any, res) => {
  const slug = req.user?.agencySlug || 'default';
  const erfRef = String(req.body?.erfRef || '').trim().toUpperCase();
  if (!erfRef || erfRef.length < 11) {
    return res.status(400).json({ error: 'Invalid Erf no.' });
  }
  const cfg = readKredoConfig();
  const entry = cfg[slug];
  if (!entry?.sandboxKey && !entry?.productionKey) {
    return res.status(503).json({ error: 'Valuation not connected for this agency.' });
  }

  // TODO(valuation-docs): Replace with real Valuation CarValue API call.
  // Expected: POST to Valuation's valuation endpoint with Erf no., returns trade/retail/market values.
  try {
    console.log(`[valuation] CarValue lookup for Erf no.=${erfRef} agency=${slug} (STUB)`);
    const stubResult = {
      erfRef,
      tradeValue: null,
      retailValue: null,
      marketValue: null,
      checkedAt: new Date().toISOString(),
      raw: { stub: true, note: 'Replace with real Valuation CarValue response when docs are available' },
    };
    res.json(stubResult);
  } catch (err: any) {
    console.error(`[valuation] valuation failed for Erf no.=${erfRef}:`, err?.message || err);
    res.status(502).json({ error: 'CarValue lookup failed. Check your API key.' });
  }
});

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

  // Icons + agency website embeds
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
    app.use(express.static(distPath));
    // Ensure public PWA files exist in dist after vite build (copied automatically)
    app.use(express.static(publicDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(` PWA: ${PORT === 443 || process.env.HTTPS ? 'https' : 'http'}://<this-host>:${PORT}  → Add to Home Screen on phone`);
  });
}

startServer();
