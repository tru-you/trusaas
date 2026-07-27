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
  stats as photoStats,
} from './photoStore';

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
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(safe, null, 2), 'utf-8');
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

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Increase payload limits for Base64 vehicle photos
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// ==================== INVENTORY HELPERS ====================

async function listVehicles(userId: string): Promise<any[]> {
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    // PC demo: show all local vehicles (owner may differ between Firebase login vs demo)
    const isDemo = userId === 'local-demo-user';
    const list = store.vehicles
      .filter((v) => isDemo || !v.ownerId || v.ownerId === userId)
      .map(normalizeVehicle)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }
  const snapshot = await fdb
    .collection('vehicles')
    .where('ownerId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .get();
  return snapshot.docs.map((doc) => normalizeVehicle(doc.data()));
}

async function getVehicle(id: string, userId?: string): Promise<any | null> {
  if (LOCAL_MODE || !fdb) {
    const found = readLocalStore().vehicles.find((v) => v.id === id);
    if (!found) return null;
    // Demo / local: allow open even if ownerId differs
    if (
      userId &&
      userId !== 'local-demo-user' &&
      found.ownerId &&
      found.ownerId !== userId
    ) {
      return null;
    }
    return normalizeVehicle(found);
  }
  const doc = await fdb.collection('vehicles').doc(id).get();
  return doc.exists ? normalizeVehicle(doc.data()) : null;
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

app.post('/api/auth/device', async (req, res) => {
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
    mode: LOCAL_MODE ? 'local' : 'cloud',
    dmsUrl: DEFAULT_DMS_URL,
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
    'front_3_4', 'front_straight', 'side_driver', 'side_passenger',
    'rear_3_4', 'rear_straight', 'interior_dash', 'engine_bay',
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
  const requiredIds = [
    'front_3_4', 'front_straight', 'rear_3_4', 'rear_straight',
    'side_driver', 'side_passenger', 'wheels_all',
    'interior_dash', 'seat_driver', 'seats_rear', 'boot_bay',
    'engine_bay', 'service_book', 'reg_papers', 'odometer_reading',
    'vin_plate', 'video_360',
  ];
  // badges_detail is optional in guide; seat_passenger required in types - keep practical web gate
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
        const v = await getVehicle(vehicleId, req.user.uid);
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
    const dealer = String(req.query.dealer || 'demo');
    let vehicles: any[] = [];
    if (LOCAL_MODE || !fdb) {
      vehicles = readLocalStore().vehicles.map(normalizeVehicle);
    } else {
      const snapshot = await fdb.collection('vehicles').get();
      vehicles = snapshot.docs.map((d) => normalizeVehicle(d.data()));
    }
    // A named dealer site must only ever see its OWN captures. Vehicles
    // captured before dealer tagging existed carry no slug — those fall to the
    // pilot dealer rather than being shown to everyone. "demo" sees all.
    const scoped =
      dealer === 'demo'
        ? vehicles
        : vehicles.filter(
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
    const vehicles = await listVehicles(req.user.uid);
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
    const existing = await getVehicle(vehicleData.id, userId);

    if (existing) {
      if (!LOCAL_MODE && existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updatedVehicle = {
        ...existing,
        ...vehicleData,
        ownerId: existing.ownerId || userId,
        updatedAt: now,
        photos: vehicleData.photos ?? existing.photos ?? {},
        quality: vehicleData.quality ?? existing.quality ?? {},
      };
      const saved = await saveVehicle(updatedVehicle);
      return res.json({ success: true, vehicle: saved });
    }

    const newVehicle = {
      ...vehicleData,
      ownerId: userId,
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
    const { vehicleId, slotId, base64Image, qualityReport } = req.body;
    const userId = req.user.uid;

    if (!vehicleId || !slotId || !base64Image) {
      return res.status(400).json({ error: 'vehicleId, slotId, and base64Image are required' });
    }

    const existingData = await getVehicle(vehicleId, userId);
    if (!existingData) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    // Local demo can edit any local vehicle; cloud still enforces owner
    if (
      !LOCAL_MODE &&
      existingData.ownerId &&
      existingData.ownerId !== userId
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const photos = { ...(existingData.photos || {}), [slotId]: base64Image };
    const quality = { ...(existingData.quality || {}) };
    if (qualityReport) {
      quality[slotId] = qualityReport;
    }

    const now = new Date().toISOString();
    const requiredSlots = [
      'front_3_4', 'front_straight', 'rear_3_4', 'rear_straight',
      'side_driver', 'side_passenger', 'wheels_all', 'badges_detail',
      'interior_dash', 'seat_driver', 'seats_rear', 'boot_bay',
      'engine_bay', 'service_book', 'reg_papers', 'odometer_reading',
      'vin_plate', 'video_360',
    ];
    const hasAllRequired = requiredSlots.every((slot) => !!photos[slot]);
    let status = existingData.status;
    if (hasAllRequired && status === 'In-Progress') {
      status = 'Ready';
    }

    const updated = {
      ...existingData,
      photos,
      quality,
      status,
      updatedAt: now,
    };
    await saveVehicle(updated);
    res.json({ success: true, vehicle: updated });
  } catch (error) {
    console.error('POST /api/inventory/upload-photo - Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Delete vehicle
app.delete('/api/inventory/:id', authenticate, async (req: any, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.uid;
    const data = await getVehicle(id, userId);
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

// 5. AI Photo Quality Inspection & Listing Description Writer (Gemini)
app.post('/api/gemini/analyze', async (req, res) => {
  const { base64Image, slotName, vehicleInfo } = req.body;

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
    const prompt = `You are an expert automotive quality inspection agent. Examine the provided car photo (captured in slot: "${slotName || 'General Exterior'}").
Analyze the photo for listing quality, and provide precise JSON feedback on:
1. Overall score (0-100).
2. Lighting evaluation: Status ("Poor", "Fair", "Perfect"), and a short feedback message warning about shadows, glare, or darkness.
3. Angle/framing evaluation: Status ("Off-Angle", "Good", "Perfect"), and feedback on whether the vehicle complies with standard automotive photography guides.
4. Auto-identification and marketing generator: Guess/confirm the car details based on the image, write an attention-grabbing listing Title, a highly compelling dealer marketplace listing Description, and list any visible cosmetic issues or reflections.

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
    "identifiedVehicle": string,
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
                identifiedVehicle: { type: Type.STRING },
                suggestedTitle: { type: Type.STRING },
                suggestedDescription: { type: Type.STRING },
                detectedIssues: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['identifiedVehicle', 'suggestedTitle', 'suggestedDescription', 'detectedIssues'],
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
  front_3_4: 'images', front_straight: 'images', rear_3_4: 'images',
  rear_straight: 'images', side_driver: 'images', side_passenger: 'images',
  roof_view: 'images', wheels_all: 'images',
  badges_detail: 'extrasPhotos', lights_detail: 'extrasPhotos',
  mirrors_handles: 'extrasPhotos', interior_dash: 'extrasPhotos',
  seat_driver: 'extrasPhotos', seat_passenger: 'extrasPhotos',
  seats_rear: 'extrasPhotos', boot_bay: 'extrasPhotos',
  floor_mats: 'extrasPhotos', engine_bay: 'extrasPhotos',
  mechanical_details: 'extrasPhotos', undercarriage: 'extrasPhotos',
  recon_damage: 'damagePhotos',
  service_book: 'serviceBookPhotos', reg_papers: 'extrasPhotos',
  odometer_reading: 'extrasPhotos', vin_plate: 'vinPhotos',
  video_360: 'extrasPhotos',
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
       what stops a mis-set picker filing a car into another dealer's yard. */
    const dealerSlug = req.user?.dealerSlug || claimedDealerSlug;
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

    const vehicle = await getVehicle(vehicleId, userId);
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
      showOnWebsite: typeof vehicle.showOnWebsite === "boolean" ? vehicle.showOnWebsite : undefined,
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
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
        description: vehicle.aiListingDescription || undefined,
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

    const exportMeta: any = {
      // Remember which dealer this capture belongs to. Without it this app's
      // own public feed can't tell one dealer's stock from another's.
      dealerSlug: dealerSlug || vehicle.dealerSlug || undefined,
      lastDmsExportAt: new Date().toISOString(),
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
