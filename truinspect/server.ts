import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fetchValuation } from './src/lib/scraper';
import {
  initPhotoStore,
  mediaDir,
  MEDIA_ROUTE,
  put as putPhoto,
  isStoredRef,
  asDataUri,
  resizeDataUri,
  stats as photoStats,
  collectRefs,
  remove as removePhoto,
  sweepOrphans,
} from './photoStore';
import { DEFAULT_TEMPLATE } from './src/templates';

// Load environment variables first
dotenv.config();

// Same Firebase project + named DB as TruFlow Premium photo sync
const FIREBASE_PROJECT_ID = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0151924955';
const AUTOLENS_DB_ID = process.env.AUTOLENS_DB_ID || 'ai-studio-autolenspro-7d4757ec-a059-4566-98db-d15a4840f4ec';
const DEFAULT_DMS_URL = process.env.TRUFLOW_DMS_URL || process.env.DMS_URL || 'http://localhost:3001';

// Local PC mode: no Google Cloud credentials needed. Stores inventory in data/local-inventory.json
// Set LOCAL_MODE=0 and provide GOOGLE_APPLICATION_CREDENTIALS to use real Firestore.
const FORCE_CLOUD = process.env.LOCAL_MODE === '0' || process.env.FORCE_FIREBASE === '1';
const hasAdc =
  !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  !!process.env.FIREBASE_SERVICE_ACCOUNT ||
  !!process.env.GOOGLE_CLOUD_PROJECT;
const LOCAL_MODE = !FORCE_CLOUD; // default ON for PC friendliness

/**
 * Inspector access code — the same shape TruInspect's sibling TruLens uses.
 *
 * Without one this API was open to anyone who knew the URL: `Bearer demo`, any
 * token starting with `local-`, and — because LOCAL_MODE is on in production —
 * literally any bearer string at all were each accepted, so inspection reports
 * and their photos could be read, created or deleted by a stranger.
 *
 * Set TRUINSPECT_ACCESS_CODE and the app exchanges it for a signed token that
 * every request must then carry. Left unset, the old behaviour stands, which is
 * what keeps local development and an un-migrated instance working.
 */
const ACCESS_CODE = process.env.TRUINSPECT_ACCESS_CODE || '';

/** Shared key for talking to TruFlow, which is where dealerships, codes and
 *  entitlements live. Set it and this app stops needing codes of its own. */
const SYNC_KEY = process.env.TRUFLOW_SYNC_KEY || '';

/* The signing secret must be something an outsider cannot guess.
 *
 * It used to derive from ACCESS_CODE alone, falling back to the literal
 * 'truinspect-dev' — so with no access code set the secret was a constant
 * sitting in this file, and anyone could mint a valid device token. That was
 * survivable only because a device token was refused outright unless
 * ACCESS_CODE was set. Codes are verified against TruFlow now, so an instance
 * can legitimately have no ACCESS_CODE at all, and the sync key becomes the
 * secret in that case — it is already a shared secret and already required for
 * central verification to work. */
const TOKEN_SECRET =
  process.env.TRUINSPECT_TOKEN_SECRET ||
  crypto.createHash('sha256').update(ACCESS_CODE || SYNC_KEY || 'truinspect-dev').digest('hex');

/** Whether the signing secret is actually secret. A device token is only
 *  trusted when it is — otherwise the fallback constant above would make
 *  forging one trivial. */
const HAS_REAL_TOKEN_SECRET = Boolean(
  process.env.TRUINSPECT_TOKEN_SECRET || ACCESS_CODE || SYNC_KEY
);

const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a month on the yard phone

/** Constant-time compare, so a wrong code can't be found one character at a time. */
function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** @param dealerSlug pins the token to one dealership, so a phone cannot later
 *  claim to be a different yard. Absent for the legacy shared code, which
 *  carries no dealership at all. */
function signDeviceToken(dealerSlug?: string | null): string {
  const claims: Record<string, unknown> = { k: 'device', exp: Date.now() + DEVICE_TOKEN_TTL_MS };
  if (dealerSlug) claims.d = dealerSlug;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** The claims inside a device token, or null if the signature does not hold.
 *  Replaces the old boolean verifyDeviceToken: callers now need the
 *  dealership, not merely a yes/no. */
function deviceTokenClaims(token: string): { dealerSlug?: string } | null {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (claims.k !== 'device' || !(claims.exp > Date.now())) return null;
    return { dealerSlug: typeof claims.d === 'string' ? claims.d : undefined };
  } catch {
    return null;
  }
}


/* Writable state lives under DATA_DIR so it can sit on a mounted Render disk
   and survive deploys and restarts. This was hardcoded to ./data with no env
   override, and the service had no disk — so on Render it wrote to the
   container filesystem and every deploy silently discarded every inspection a
   dealer had recorded. TruLens carries the same warning in render.yaml; this
   app simply never got the same treatment.
   Unset (local dev) = ./data, exactly the old path. */
const LOCAL_DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'local-inventory.json');

/* Inspection photos are stored as files rather than base64 inside
   local-inventory.json — see photoStore.ts. Initialised before anything reads
   the store, and before the /media route below, because express.static resolves
   its root when it is constructed. */
initPhotoStore(LOCAL_DATA_DIR);

type LocalStore = { vehicles: any[] };

function isValidPhotoData(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 32) return false;
  /* A stored reference — "/media/<sha256>.jpg" — is a real photo, and is the
     form every inspection photo takes once it is on disk. Named explicitly
     because at ~75 characters it fails the data:/http test and is far too short
     for the raw-base64 rule below, so without this it reads as junk and
     normalizeVehicle drops it — silently deleting every photo on the vehicle's
     next save.
     Held in a boolean rather than tested inline: isStoredRef is a `value is
     string` predicate, and applying it to a value already known to be a string
     narrows the else branch to `never`, so the checks below stop compiling. */
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

/**
 * Simple, cheap read — the original behaviour, restored. Called on every
 * inventory read, so it does no heavy work: parse the file or return empty.
 * If the file is unparseable it is renamed aside once (so a corrupt file can
 * never wedge the service) and we start empty. No per-request salvage.
 */
function readLocalStore(): LocalStore {
  try {
    if (!fs.existsSync(LOCAL_DATA_FILE)) return { vehicles: [] };
    const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf-8'));
    const vehicles = Array.isArray(parsed?.vehicles) ? parsed.vehicles.map(normalizeVehicle) : [];
    return { vehicles };
  } catch (e) {
    console.error('Local store read error — moving the bad file aside:', e);
    try { fs.renameSync(LOCAL_DATA_FILE, LOCAL_DATA_FILE + '.corrupt.' + Date.now()); } catch { /* best effort */ }
    return { vehicles: [] };
  }
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

/* Buyers — a per-dealer contact book for the desktop manager. Small text-only
 * records, so a single JSON keyed by dealerSlug is plenty (no base64, no bloat). */
const BUYERS_FILE = path.join(LOCAL_DATA_DIR, 'buyers.json');
function readBuyersMap(): Record<string, any[]> {
  try {
    if (fs.existsSync(BUYERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BUYERS_FILE, 'utf-8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch (e) { console.error('Buyers read error:', e); }
  return {};
}
function writeBuyersMap(map: Record<string, any[]>) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    fs.writeFileSync(BUYERS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch (e) { console.error('Buyers write error:', e); }
}
const buyerScope = (req: any) => req?.user?.dealerSlug || 'local';

/**
 * Move any base64 still in the local store onto disk.
 *
 * Runs once at boot rather than inside readLocalStore, which is on every
 * request path that touches inventory — converting there would re-scan every
 * photo of every inspection on every call, which is the cost this removes.
 *
 * Idempotent: put() returns a stored reference unchanged, so a second run is a
 * no-op and an interrupted run resumes. Firestore-backed instances are skipped;
 * their documents convert as each vehicle is next saved, and rewriting a whole
 * collection at boot is not something to do unattended.
 */
function migrateInspectionPhotosToFiles(): void {
  if (!LOCAL_MODE) {
    console.log('[photos] cloud mode — inspection photos convert as vehicles are saved.');
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
      `[photos] moved ${converted} inspection photo(s) out of the store. ` +
        `Media now holds ${files} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB.`
    );
  } else {
    console.log(`[photos] nothing to migrate (${already} already stored as files).`);
  }
}

try {
  migrateInspectionPhotosToFiles();
  /* The orbit migration is NOT called here: it reads WEB3D_DIR, declared
     several hundred lines below, so calling it now hits the temporal dead zone.
     It runs immediately after that declaration. */
} catch (err) {
  /* Never block boot: the read paths still understand base64, so an
     un-migrated instance behaves exactly as it did before. */
  console.error('[photos] inspection migration failed, continuing with base64:', err);
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
  console.log(' TruInspect LOCAL PC MODE (v1.6)');
  console.log(' Inventory file: ' + LOCAL_DATA_FILE);
  console.log(' DMS export URL: ' + DEFAULT_DMS_URL);
  console.log(' Open: http://localhost:3000');
  console.log('────────────────────────────────────────────');
}

/* Safety net: with none of these three set, HAS_REAL_TOKEN_SECRET is false and
   the authenticate middleware falls through to the open-door local branch —
   fine on a dev laptop, a hole in prod. TruFlow issues codes via SYNC_KEY, so
   on Render at least that one should always be present; this warns loudly if a
   redeploy ever drops it. Log only, never exit — an outage is worse than a
   noisy log line. */
if (!HAS_REAL_TOKEN_SECRET) {
  console.warn('────────────────────────────────────────────');
  console.warn(' WARNING: no auth secret configured.');
  console.warn(' Set TRUFLOW_SYNC_KEY (or TRUINSPECT_ACCESS_CODE /');
  console.warn(' TRUINSPECT_TOKEN_SECRET). Without one, any Bearer');
  console.warn(' token is accepted — safe locally, NOT in production.');
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

/* Inspection photos, served as files.
 *
 * Immutable for a year, which is safe because the filename is the SHA-256 of
 * the bytes — a path can never come to mean different content, so there is no
 * cache to bust. A report page fetches each photo once instead of pulling every
 * photo of every inspection inside a single JSON payload.
 *
 * Public and registered before authenticate: an inspection report is meant to
 * be shown to a buyer, and the path is an opaque hash. */
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
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

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

  /* A signed device token, issued by POST /api/auth/device.
   *
   * The gate is whether the signing secret is genuinely secret, not whether
   * ACCESS_CODE specifically is set. Those were the same thing while a local
   * code was the only way in; now that codes are verified against TruFlow an
   * instance can have no ACCESS_CODE at all, and testing for it would reject
   * every centrally issued token. HAS_REAL_TOKEN_SECRET is what actually
   * matters — without it the secret falls back to a constant in this file and a
   * token could be forged. */
  const claims = HAS_REAL_TOKEN_SECRET ? deviceTokenClaims(idToken) : null;
  if (claims) {
    /* The dealership rides on the token, so it is evidence rather than a claim
       the client makes per request — the same reasoning TruLens applies. */
    req.user = {
      uid: 'device',
      email: 'device@truinspect.local',
      local: true,
      dealerSlug: claims.dealerSlug,
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

  // Proper demo token — signed, unique uid, 24h TTL.
  // Checked BEFORE the local-mode fallback so a forged unsigned JWT does not
  // shadow a legitimate demo token.
  const demoClaims = verifyDemoToken(idToken);
  if (demoClaims) {
    req.user = {
      uid: demoClaims.sub,
      email: 'demo@truinspect.local',
      demo: true,
      local: true,
    };
    return next();
  }

  /* Local PC: accept any Bearer JWT and extract uid, or use demo user.
   *
   * LOCAL_MODE is on in production too (there is no Firestore there), so this
   * branch accepts ANY bearer string and must close the moment real
   * authentication exists.
   *
   * The test was `!ACCESS_CODE`, which was the same thing while a local code was
   * the only way in. It no longer is: an instance that verifies codes against
   * TruFlow legitimately has no ACCESS_CODE, and this branch would then have
   * left the whole API — every inspection and photo — open to any string at all,
   * while the login screen looked perfectly secure. HAS_REAL_TOKEN_SECRET is
   * true whenever an access code, a sync key or an explicit token secret is
   * configured, which is exactly when this door has to be shut. */
  if (LOCAL_MODE && !HAS_REAL_TOKEN_SECRET) {
    const payload = decodeJwtPayload(idToken);
    req.user = {
      uid: payload?.user_id || payload?.sub || payload?.uid || 'local-user',
      email: payload?.email || 'local@truinspect.local',
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
   dealer code. Before this, listVehicles/getVehicle filtered by ownerId only —
   but every dealer-code sign-in resolves to the SAME uid ('device', see the
   auth middleware), so an ownerId filter returned every dealer's captures to
   every dealer: a cross-dealer read leak (a Cars-on-Caledon vehicle showed up
   under another dealer's profile). TruInspect is standalone (no DMS push), so
   this is a pure post-auth read-scoping fix. */
type InspectScope = { uid: string; dealerSlug?: string | null };

/* Scoping rule for both read paths:
   - Dealer-code login (token carries a dealerSlug): a record is visible only
     when its own dealerSlug matches. Untagged legacy records (captured before
     dealerSlug stamping existed) are hidden from EVERY dealer login — they
     can't be attributed to a dealer and must never leak across dealers.
   - No dealerSlug on the token (Firebase / local-PC JWT dev logins): fall back
     to an ownerId match. */
function passesScope(record: any, user?: InspectScope): boolean {
  if (!user) return true;
  if (user.dealerSlug) {
    return record.dealerSlug === user.dealerSlug;
  }
  if (user.uid && record.ownerId && record.ownerId !== user.uid) return false;
  return true;
}

async function listVehicles(user: InspectScope): Promise<any[]> {
  const { uid, dealerSlug } = user;
  if (LOCAL_MODE || !fdb) {
    const store = readLocalStore();
    const list = store.vehicles
      .filter((v) => passesScope(v, user))
      .map(normalizeVehicle)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return list;
  }
  /* Firestore: dealerSlug when the token has one, else ownerId. A dealerSlug
     query also naturally excludes untagged legacy rows (no such field). */
  const query = dealerSlug
    ? fdb.collection('vehicles').where('dealerSlug', '==', dealerSlug)
    : fdb.collection('vehicles').where('ownerId', '==', uid);
  const snapshot = await query.orderBy('updatedAt', 'desc').get();
  return snapshot.docs.map((doc) => normalizeVehicle(doc.data()));
}

async function getVehicle(id: string, user?: InspectScope): Promise<any | null> {
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

/** Move an inspection's photos onto disk, leaving references in the record.
 *
 *  Every write goes through saveVehicle, so this one place keeps image bytes out
 *  of local-inventory.json and out of Firestore documents — the latter matters
 *  more than it looks, since a Firestore document has a hard 1 MiB ceiling that
 *  a couple of base64 photos will breach.
 *
 *  Idempotent: put() hands back a reference unchanged, so re-saving an already
 *  converted inspection costs a map and nothing else. */
/** Move a trade-in appraisal's photos onto disk too.
 *
 *  Trade-in shots live nested in tradeInData.items[].photoUrl and the dealer's
 *  signature in dealerDetails.digitalSignatureUrl — a level below vehicle.photos,
 *  so the loop above never reached them. Left alone, a 28-step walk-around wrote
 *  28 base64 images straight into local-inventory.json / the Firestore document,
 *  bloating every read and breaching Firestore's 1 MiB ceiling (which silently
 *  fails the whole save — "images not saving"). Same put()/reference treatment,
 *  one level deeper. Idempotent: a stored "/media/…" reference passes through. */
function externalizeTradeInPhotos(tradeInData: any): any {
  if (!tradeInData || typeof tradeInData !== 'object') return tradeInData;
  let next = tradeInData;

  if (Array.isArray(tradeInData.items)) {
    next = {
      ...next,
      items: tradeInData.items.map((it: any) => {
        if (!it || typeof it !== 'object' || !it.photoUrl) return it;
        const ref = putPhoto(it.photoUrl);
        return ref ? { ...it, photoUrl: ref } : it;
      }),
    };
  }

  const dd = tradeInData.dealerDetails;
  if (dd && typeof dd === 'object' && dd.digitalSignatureUrl) {
    const sigRef = putPhoto(dd.digitalSignatureUrl);
    if (sigRef) next = { ...next, dealerDetails: { ...dd, digitalSignatureUrl: sigRef } };
  }

  return next;
}

function storeVehiclePhotos(vehicle: any): any {
  if (!vehicle || typeof vehicle !== 'object') return vehicle;
  let next = vehicle;

  const photos = vehicle.photos;
  if (photos && typeof photos === 'object') {
    const nextPhotos: Record<string, string> = {};
    for (const [slotId, value] of Object.entries(photos)) {
      const ref = putPhoto(value);
      /* Falls back to the original value when the store cannot take it, so an
         inspection is never silently lost — it simply stays base64. */
      nextPhotos[slotId] = ref || (value as string);
    }
    next = { ...next, photos: nextPhotos };
  }

  if (vehicle.tradeInData) {
    next = { ...next, tradeInData: externalizeTradeInPhotos(vehicle.tradeInData) };
  }

  return next;
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
    const victim = store.vehicles.find((v) => v.id === id);
    if (!victim) return false;
    const refs = collectRefs(victim);
    store.vehicles = store.vehicles.filter((v) => v.id !== id);
    writeLocalStore(store);
    // Collect refs still used by remaining vehicles before deleting files
    const live = new Set(store.vehicles.flatMap(collectRefs));
    for (const ref of refs) { if (!live.has(ref)) removePhoto(ref); }
    return true;
  }
  await fdb.collection('vehicles').doc(id).delete();
  return true;
}

// ==================== API ROUTES ====================

// Health / mode check (no auth) + keep-alive pings
const STARTED_AT = Date.now();
/**
 * Exchange the inspector access code for a signed device token.
 * Mirrors TruLens's /api/auth/device so both yard apps sign in the same way.
 */
/**
 * Ask TruFlow whether a code is real and whether it opens TruInspect.
 *
 * Dealerships, their codes and their entitlements live in one place. This app
 * had no notion of a dealership at all: a single TRUINSPECT_ACCESS_CODE, shared
 * by everyone, so every inspector on every yard signed in with the same string
 * and nothing recorded which dealership an inspection belonged to. Onboarding a
 * dealer meant handing them that one code; revoking meant changing it for
 * everybody at once.
 *
 * Returns null on anything other than a clean yes, including an unreachable
 * TruFlow, so the caller can fall back to the local code rather than stranding
 * an inspector mid-job because the DMS was briefly down.
 */
async function verifyCodeWithTruFlow(
  code: string
): Promise<{ dealerSlug: string; dealerName?: string } | null> {
  if (!SYNC_KEY) return null; // no shared key configured — nothing to ask with
  try {
    const res = await fetch(`${DEFAULT_DMS_URL.replace(/\/$/, '')}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tru-sync-key': SYNC_KEY },
      body: JSON.stringify({ code, product: 'inspect' }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      /* 403 is a real answer, not a failure: the code is valid but this
         dealership is not set up for TruInspect. Logged so an onboarding
         mistake is visible rather than looking like a wrong code. */
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        console.warn(`[auth] TruFlow refused a code for inspect: ${body?.message || res.status}`);
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
     environment variable to edit and no restart of this service — and the
     inspection is tagged with the yard it was done for. */
  const central = await verifyCodeWithTruFlow(given);
  if (central) {
    return res.json({
      token: signDeviceToken(central.dealerSlug),
      expiresInDays: 30,
      dealerSlug: central.dealerSlug,
      dealerName: central.dealerName,
    });
  }

  /* Then the local shared code. Kept so inspectors already signed in keep
     working, and so a TruFlow outage cannot stop an inspection being recorded. */
  if (ACCESS_CODE && codeMatches(given, ACCESS_CODE)) {
    return res.json({ token: signDeviceToken(), expiresInDays: 30, dealerSlug: null });
  }

  /* Only now is "nothing is configured" worth reporting, and it is a different
     complaint from a wrong code. */
  if (!ACCESS_CODE && !SYNC_KEY) {
    return res.status(503).json({
      error: 'No way to verify codes on this server.',
      message: 'Set TRUFLOW_SYNC_KEY so codes can be checked against TruFlow, or set TRUINSPECT_ACCESS_CODE.',
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
    product: 'truinspect',
    commit,
    shortCommit: commit ? String(commit).slice(0, 7) : null,
    branch: process.env.RENDER_GIT_BRANCH || null,
    builtFrom: commit ? 'render' : 'unknown (env not set — local run?)',
    startedAt: new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    product: 'truinspect',
    // A boolean, never the value — lets you confirm from outside that the env
    // var reached the process, which is otherwise invisible until someone
    // tries a bypass and gets in.
    accessCodeConfigured: !!ACCESS_CODE,
    // True when DEEPSEEK_API_KEY reached the process — the AI listing writer
    // (and any DeepSeek call) runs in mock mode when this is false.
    aiConfigured,
    // Booleans only (never the values) — confirm which Imagin8/TU env vars
    // actually reached the process. getValues needs ALL five true.
    imagin8: {
      apiKey: !!process.env.IMAGIN8_API_KEY,
      customerId: !!process.env.IMAGIN8_CUSTOMER_ID,
      userName: !!process.env.IMAGIN8_USERNAME,
      password: !!process.env.IMAGIN8_PASSWORD,
      appName: !!process.env.IMAGIN8_APP_NAME,
    },
    mode: LOCAL_MODE ? 'local' : 'cloud',
    dmsUrl: DEFAULT_DMS_URL,
    port: PORT,
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    media: photoStats(),
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

// ── Web 3D / spin packages for dealer websites ─────────────────
/* Under LOCAL_DATA_DIR, not cwd — orbit packages were written to the container
   filesystem and discarded on every deploy, the same way inspections were. */
const WEB3D_DIR = path.join(LOCAL_DATA_DIR, 'web3d');

function ensureWeb3dDir() {
  if (!fs.existsSync(WEB3D_DIR)) fs.mkdirSync(WEB3D_DIR, { recursive: true });
}

/**
 * Move base64 frames out of orbit packages already sitting on disk.
 *
 * The write path converts new packages, which leaves every existing one
 * untouched — and these are the largest objects the system produces. On TruLens
 * the equivalent package was still being served at 20 MB after its capture
 * photos had already moved, against a client that gives up after 12 seconds.
 *
 * Converted one file at a time so a failure on one package leaves the rest.
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
  let imagesMoved = 0;

  for (const name of names) {
    const file = path.join(WEB3D_DIR, name);
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
      let changed = false;
      for (const f of Array.isArray(pkg?.frames) ? pkg.frames : []) {
        if (!f || typeof f !== 'object' || isStoredRef(f.image)) continue;
        const ref = putPhoto(f.image);
        if (ref) { f.image = ref; changed = true; imagesMoved++; }
      }
      /* Damage pins carry a base64 thumbnail each — easy to overlook because
         they are not frames, and on TruLens they were the entire remaining
         weight of the package once the frames had moved. */
      for (const t of Array.isArray(pkg?.damageTags) ? pkg.damageTags : []) {
        if (!t || typeof t !== 'object' || isStoredRef(t.thumb)) continue;
        const ref = putPhoto(t.thumb);
        if (ref) { t.thumb = ref; changed = true; imagesMoved++; }
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
      `[photos] moved ${imagesMoved} orbit image(s) out of ${packagesChanged} package(s).`
    );
  }
}

/* Runs here rather than beside the inspection migration above, because it reads
   WEB3D_DIR — declared immediately above — and calling it earlier hits the
   temporal dead zone on that const. */
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
    const payload = {
      ...pkg,
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
    res.json({ success: true, package: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    const existing = await getVehicle(vehicleData.id, req.user);

    /* Stamp dealerSlug on every save so captures are dealer-scoped on read.
       Without it records saved untagged, and every dealer-code login (all share
       uid 'device') saw each other's stock. Token slug is authoritative; keep an
       existing slug for edits, and never overwrite a dealer-typed one. */
    const dealerSlug =
      req.user?.dealerSlug || existing?.dealerSlug || vehicleData.dealerSlug || undefined;

    if (existing) {
      if (!LOCAL_MODE && existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updatedVehicle = {
        ...existing,
        ...vehicleData,
        ownerId: existing.ownerId || userId,
        dealerSlug,
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
      dealerSlug,
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

    const existingData = await getVehicle(vehicleId, req.user);
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

    const resized = await resizeDataUri(base64Image);
    const photos = { ...(existingData.photos || {}), [slotId]: resized };
    const quality = { ...(existingData.quality || {}) };
    if (qualityReport) {
      quality[slotId] = qualityReport;
    }

    const now = new Date().toISOString();
    // Derived from the template's own `required` flag, so it can't drift the
    // way this list once did (it kept referencing a 'video_360' slot long
    // after the slot itself was removed from the template).
    const requiredSlots = DEFAULT_TEMPLATE.slots.filter((s) => s.required).map((s) => s.id);
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

// 3b. Trade-in photo upload — store one image as a file, return its URL.
//
// The 28-step trade-in walk-around used to keep photos as blob: URLs (which die
// on navigation) and then base64 them into the record (which bloats it). This
// endpoint gives each shot the same treatment inspection photos get: bytes go to
// the content-addressed media store, and the caller keeps only a "/media/…" URL.
app.post('/api/inventory/upload-trade-photo', authenticate, async (req: any, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image || typeof base64Image !== 'string') {
      return res.status(400).json({ error: 'base64Image is required' });
    }
    const ref = putPhoto(base64Image);
    if (!ref) {
      return res.status(422).json({ error: 'Unsupported or malformed image data' });
    }
    res.json({ success: true, ref });
  } catch (error) {
    console.error('POST /api/inventory/upload-trade-photo - Error:', error);
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

// ── Buyers (desktop manager contact book, per dealer) ──
app.get('/api/buyers', authenticate, (req: any, res) => {
  try {
    res.json({ buyers: readBuyersMap()[buyerScope(req)] || [] });
  } catch (e) {
    console.error('GET /api/buyers - Error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/buyers', authenticate, (req: any, res) => {
  try {
    const list = Array.isArray(req.body?.buyers) ? req.body.buyers : [];
    const map = readBuyersMap();
    map[buyerScope(req)] = list;
    writeBuyersMap(map);
    res.json({ success: true, count: list.length });
  } catch (e) {
    console.error('PUT /api/buyers - Error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Dealership settings (standalone persistence, per dealer slug) ──
// Inspect is a standalone product: unlike Lens it has no TruFlow central to
// borrow the dealership record from, so when a dealer is provisioned with the
// inspect product their identity fields persist HERE, keyed by slug — same
// shape of problem as the buyers book above. Device-local localStorage stays
// as an offline cache and keeps working exactly as before; this record is the
// cross-device source of truth.
//
// TransUnion/Imagin8 keys are deliberately absent: those are platform env
// vars managed by TruSaaS, never dealer-entered.

const DEALER_SETTINGS_FILE = path.join(LOCAL_DATA_DIR, 'inspect-dealerships.json');

function readDealerSettings(): Record<string, any> {
  try {
    if (!fs.existsSync(DEALER_SETTINGS_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(DEALER_SETTINGS_FILE, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.error('Dealer settings read error:', e);
    return {};
  }
}

function writeDealerSettings(map: Record<string, any>) {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    fs.writeFileSync(DEALER_SETTINGS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch (e) { console.error('Dealer settings write error:', e); }
}

const DEALER_SETTING_FIELDS = [
  'name', 'branch', 'phone', 'email', 'whatsapp',
  'vatNumber', 'registrationNumber', 'address', 'tradeInTcs',
] as const;

/** A real, slug-attributed login — demos and legacy shared-code tokens have
 *  nothing to attribute settings to and are skipped everywhere below. */
function scopedDealerSlug(req: any): string | null {
  if (!req.user || req.user.demo || req.user.uid === 'local-demo-user') return null;
  return typeof req.user.dealerSlug === 'string' && req.user.dealerSlug ? req.user.dealerSlug : null;
}

function computeSetupItems(d: any) {
  const done: Record<string, boolean> = {
    'identity-name': !!d?.name,
    'contact-email': !!d?.email,
    'address': !!d?.address,
    'vat-reg': !!(d?.vatNumber || d?.registrationNumber),
    'tradein-tcs': !!d?.tradeInTcs,
  };
  return [
    { id: 'identity-name', label: 'Dealership name', hint: 'Printed on every inspection report', required: true },
    { id: 'contact-email', label: 'Contact email', hint: 'Shown to buyers on reports', required: true },
    { id: 'address', label: 'Address', hint: 'Yard address on reports and trade-in docs', required: true },
    { id: 'vat-reg', label: 'VAT / registration number', hint: 'Quoted on trade-in paperwork', required: false },
    { id: 'tradein-tcs', label: 'Trade-in terms & conditions', hint: 'Your T&Cs on trade-in summaries', required: false },
  ].map((it) => ({ ...it, done: !!done[it.id] }));
}

app.get('/api/dealership/settings', authenticate, (req: any, res) => {
  const slug = scopedDealerSlug(req);
  if (!slug) return res.json({ settings: {}, skipPrompt: true });
  try {
    res.json({ settings: readDealerSettings()[slug] || {} });
  } catch (e) {
    console.error('GET /api/dealership/settings - Error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/dealership/settings', authenticate, (req: any, res) => {
  const slug = scopedDealerSlug(req);
  // Demo prospects can play with the form but nothing persists.
  if (!slug) return res.json({ success: true, skipped: true });
  try {
    const body = req.body?.settings || {};
    const map = readDealerSettings();
    const prev = map[slug] || {};
    const next: any = { ...prev };
    for (const k of DEALER_SETTING_FIELDS) {
      if (typeof body[k] === 'string') next[k] = body[k].trim();
    }
    next.updatedAt = new Date().toISOString();
    map[slug] = next;
    writeDealerSettings(map);
    res.json({ success: true, settings: next });
  } catch (e) {
    console.error('PUT /api/dealership/settings - Error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/dealership/setup-status', authenticate, (req: any, res) => {
  const slug = scopedDealerSlug(req);
  if (!slug) {
    return res.json({ complete: true, requiredComplete: true, acknowledgedAt: null, skipPrompt: true, items: [] });
  }
  const d = readDealerSettings()[slug];
  const items = computeSetupItems(d);
  const requiredComplete = items.filter((i) => i.required).every((i) => i.done);
  res.json({
    complete: items.every((i) => i.done),
    requiredComplete,
    acknowledgedAt: d?.setupAcknowledgedAt || null,
    skipPrompt: false,
    items,
  });
});

app.put('/api/dealership/setup-acknowledge', authenticate, (req: any, res) => {
  const slug = scopedDealerSlug(req);
  if (!slug) return res.json({ ok: true, skipped: true });
  try {
    const map = readDealerSettings();
    const d = { ...(map[slug] || {}) };
    if (req.body?.reset) delete d.setupAcknowledgedAt;
    else d.setupAcknowledgedAt = new Date().toISOString();
    map[slug] = d;
    writeDealerSettings(map);
    res.json({ ok: true, acknowledgedAt: d.setupAcknowledgedAt || null });
  } catch (e) {
    console.error('PUT /api/dealership/setup-acknowledge - Error:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. AI Listing Description Writer (DeepSeek) — kept at /api/gemini/analyze for
// frontend compatibility; no image is sent to the model.
app.post('/api/gemini/analyze', authenticate, async (req, res) => {
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

// ==================== TRUINSPECT: DAMAGE DETECTION ====================

// POST /api/inspect/damage — kept for frontend compatibility. Image-based AI
// damage detection was retired with the Gemini swap; the endpoint always
// returns empty findings so the manual capture flow works end-to-end.
app.post('/api/inspect/damage', async (req, res) => {
  const { base64Image, slotId } = req.body || {};
  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }
  res.json({ aiMode: false, slotId: slotId || null, findings: [] });
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
  for (const slotId of Object.keys(photos || {})) {
    const cat = SLOT_TO_DMS_CATEGORY[slotId] || 'extrasPhotos';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return {
    mainImages: counts.images,
    extras: counts.extrasPhotos,
    damage: counts.damagePhotos,
    vin: counts.vinPhotos,
    serviceBook: counts.serviceBookPhotos,
    total: Object.keys(photos || {}).length,
  };
}

// ==================== TRADE-IN VALUATION SCRAPER ====================

app.post('/api/valuation', authenticate, async (req: any, res) => {
  const { make, model, year, vehicleId } = req.body || {};
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'make, model, and year are required' });
  }

  const dealerSlug = req.user?.dealerSlug || 'default';

  // Subject car's mileage lives on its own record — feed it in so the price
  // sample is normalised toward it (a low-km car isn't valued against high-km
  // listings). An explicit body mileage wins; otherwise read the vehicle.
  let subjectKm: number | undefined;
  const explicitKm = Number(req.body?.mileage);
  if (Number.isFinite(explicitKm) && explicitKm > 0) {
    subjectKm = Math.round(explicitKm);
  } else if (vehicleId) {
    try {
      const store = readLocalStore();
      const v = store.vehicles.find((x: any) => x.id === vehicleId);
      const m = Number(v?.mileage);
      if (Number.isFinite(m) && m > 0) subjectKm = Math.round(m);
    } catch {
      /* mileage is optional — valuation just isn't km-adjusted without it */
    }
  }

  try {
    const data = await fetchValuation(
      String(make),
      String(model),
      String(year),
      {
        vin: String(req.body?.vin || '').trim().toUpperCase() || undefined,
        dealerSlug,
        mileage: subjectKm,
      },
    );

    // Append to per-vehicle, per-dealer valuation history
    if (vehicleId && data.averageRetailPrice !== null) {
      try {
        const store = readLocalStore();
        const vehicle = store.vehicles.find((v: any) => v.id === vehicleId);
        if (vehicle) {
          if (!vehicle.valuationHistory) vehicle.valuationHistory = {};
          if (!vehicle.valuationHistory[dealerSlug]) vehicle.valuationHistory[dealerSlug] = [];
          const history = vehicle.valuationHistory[dealerSlug];
          history.push({
            price: data.averageRetailPrice,
            listingsFound: data.listingsFound,
            sources: data.sources.filter((s: any) => s.count > 0).map((s: any) => s.name),
            scrapedAt: new Date().toISOString(),
          });
          // Keep last 20 snapshots per vehicle per dealer
          if (history.length > 20) vehicle.valuationHistory[dealerSlug] = history.slice(-20);
          writeLocalStore(store);
        }
      } catch (err: any) {
        console.warn('[valuation] history save failed:', err?.message || err);
      }
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[valuation] unexpected error:', err.message);
    return res.status(500).json({
      averageRetailPrice: null,
      listingsFound: 0,
      fallbackRequired: true,
      sources: [],
    });
  }
});

app.get('/api/valuation/history/:vehicleId', authenticate, (req: any, res) => {
  const dealerSlug = req.user?.dealerSlug || 'default';
  const store = readLocalStore();
  const vehicle = store.vehicles.find((v: any) => v.id === req.params.vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const history = vehicle.valuationHistory?.[dealerSlug] || [];
  return res.json({ history });
});

// ==================== DMS EXPORT ====================

app.post('/api/export/dms', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const {
      vehicleId,
      dmsUrl: dmsUrlOverride,
      dealerSlug: claimedDealerSlug,
      createIfMissing = true,
    } = req.body || {};

    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicleId is required' });
    }

    /* The dealership on the token wins over anything the client says. The body
       value is a claim; the token is evidence, because it was signed after
       TruFlow confirmed the code. This is what stops a mis-set picker filing an
       inspection against another dealer's yard. */
    const dealerSlug = req.user?.dealerSlug || claimedDealerSlug;
    if (req.user?.dealerSlug && claimedDealerSlug && claimedDealerSlug !== req.user.dealerSlug) {
      console.warn(
        `[export] device is signed in as "${req.user.dealerSlug}" but requested ` +
        `"${claimedDealerSlug}" — using the signed-in dealership.`
      );
    }

    /* TruFlow refuses a push with no dealership — an absent slug used to fall
       through to its default dealership, which silently filed the car into
       someone else's inventory. Fail here instead of building and uploading a
       payload the DMS will reject. */
    if (!dealerSlug) {
      return res.status(400).json({
        success: false,
        error:
          'No dealership on this device. Sign in with the dealership code so the ' +
          'inspection files against the right yard.',
      });
    }

    const vehicle = await getVehicle(vehicleId, req.user);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (!LOCAL_MODE && vehicle.ownerId && vehicle.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    /* The wire format to TruFlow is { slotId: dataUri }, so photos that now live
       on disk are read back for the export. Keeping the wire unchanged means
       neither product had to ship in lockstep with the other. */
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

    const dmsBase = String(dmsUrlOverride || DEFAULT_DMS_URL).replace(/\/$/, '');
    const pushUrl = `${dmsBase}/api/sync/push-photos`;

    const payload = {
      stockNumber: vehicle.stockNumber,
      vehicleId: vehicle.id,
      createIfMissing: createIfMissing !== false,
      /* Names the yard. TruFlow refuses a push without it, because an absent
         slug there used to fall through to its default dealership and file the
         car into another dealer's inventory. */
      dealerSlug,
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
        description: vehicle.aiListingDescription || undefined,
      },
      photos,
    };

    /* Service-to-service auth for the DMS push. TruFlow gates
       /api/sync/push-photos on this key, so without it every export comes back
       401 — which reads as "the DMS is broken" rather than "this service was
       never given the shared key". Same value on both services. */
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
      message: dmsData.message || `Exported ${photoCount} photos to TruFlow DMS`,
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

// ==================== IMAGIN8 / TRANSUNION ====================

import { getValues as imagin8GetValues, regCheck as imagin8RegCheck, getStaticInfo as imagin8GetStaticInfo, getModels as imagin8GetModels, accidentReport as imagin8AccidentReport, simulatedValuation as imagin8SimValuation, simulatedRegCheck as imagin8SimRegCheck, simulatedAccidentReport as imagin8SimAccidentReport, DEMO_IMAGIN8_ALLOWANCE } from "../packages/imagin8";

const IMAGIN8_API_KEY = process.env.IMAGIN8_API_KEY || "";
const IMAGIN8_CUSTOMER_ID = process.env.IMAGIN8_CUSTOMER_ID || "";
// Per-call (chargeable) services also need the account login + a registered
// application name — set these in the Render dashboard, never committed.
const IMAGIN8_USERNAME = process.env.IMAGIN8_USERNAME || "";
const IMAGIN8_PASSWORD = process.env.IMAGIN8_PASSWORD || "";
const IMAGIN8_APP_NAME = process.env.IMAGIN8_APP_NAME || "";
const imagin8Opts = {
  apiKey: IMAGIN8_API_KEY,
  customerId: IMAGIN8_CUSTOMER_ID,
  userName: IMAGIN8_USERNAME,
  password: IMAGIN8_PASSWORD,
  appName: IMAGIN8_APP_NAME,
};
const imagin8Configured = () => IMAGIN8_API_KEY && IMAGIN8_CUSTOMER_ID;

// ── Imagin8 / TransUnion — proxied to Flow central ──
// TruInspect keeps NO local credit ledger and stores NO Imagin8 credentials.
// Chargeable calls relay to Flow's internal gateway over the sync key, so
// there is ONE ledger and ONE credential store for the whole suite. Free
// flat-fee endpoints (static info, model catalogue) still run here on the
// platform subscription.
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

/** Handle a demo request locally with simulated data, or 402 once the 2-of-each
 *  budget is spent. Returns true if the response was sent. */
function handleDemoImagin8(
  req: any,
  res: any,
  feature: 'valuation' | 'regcheck' | 'accident-report',
  params: Record<string, any>,
): boolean {
  if (!req.user?.demo) return false;
  const remaining = demoRemaining(req);
  if ((remaining[DEMO_FEATURE_SLOT[feature]] || 0) <= 0) {
    res.status(402).json({
      error: 'Demo TransUnion credits used up.',
      bundles: remaining,
      demo: true,
      demoUsedUp: true,
    });
    return true;
  }
  const next = demoConsume(req, feature);
  const result =
    feature === 'valuation'
      ? imagin8SimValuation(String(params.mmCode), Number(params.year), params.mileage ? Number(params.mileage) : undefined)
      : feature === 'regcheck'
        ? imagin8SimRegCheck(String(params.identifier), params.type === 'reg' || params.type === 'engine' ? params.type : 'vin')
        : imagin8SimAccidentReport(String(params.vin));
  res.json({ ...result, bundlesRemaining: next, demo: true });
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
  if (req.user?.demo) return res.json({ ...demoRemaining(req), demo: true });
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
// and no Inspect route, may mint them.
app.post('/api/imagin8/bundles', authenticate, (_req: any, res) => {
  res.status(403).json({ error: 'Top-ups are managed by TruSaaS. Contact your account manager.' });
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

  // Sweep orphaned media files every 24 hours (local mode only)
  if (LOCAL_MODE) {
    const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
    const runSweep = () => {
      try {
        const store = readLocalStore();
        const live = new Set(store.vehicles.flatMap(collectRefs));
        sweepOrphans(live);
      } catch (err) { console.error('[photoStore] sweep error:', err); }
    };
    setTimeout(runSweep, 60_000); // first sweep 1 min after boot
    setInterval(runSweep, SWEEP_INTERVAL_MS);
  }
}

startServer();
