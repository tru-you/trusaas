import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
const TOKEN_SECRET =
  process.env.TRUINSPECT_TOKEN_SECRET ||
  crypto.createHash('sha256').update(ACCESS_CODE || 'truinspect-dev').digest('hex');
const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a month on the yard phone

/** Constant-time compare, so a wrong code can't be found one character at a time. */
function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signDeviceToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ k: 'device', exp: Date.now() + DEVICE_TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyDeviceToken(token: string): boolean {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return false;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return claims.k === 'device' && claims.exp > Date.now();
  } catch {
    return false;
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
  console.log(' TruInspect LOCAL PC MODE');
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

// Middleware to verify Firebase ID Token — falls back to local/demo user on PC
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  // A signed device token, issued by POST /api/auth/device in exchange for the
  // inspector access code.
  if (ACCESS_CODE && verifyDeviceToken(idToken)) {
    req.user = { uid: 'device', email: 'device@truinspect.local', local: true };
    return next();
  }

  // Explicit demo / local tokens from the frontend offline login. These are an
  // unconditional way in, so they only survive while no access code is
  // configured — i.e. local development. With one set, `Bearer demo` is just a
  // wrong token.
  if (
    !ACCESS_CODE &&
    (idToken === 'local-demo-token' || idToken === 'demo' || idToken.startsWith('local-'))
  ) {
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

  // Local PC: accept any Bearer JWT and extract uid, or use demo user.
  // LOCAL_MODE is on in production too (there is no Firestore there), so this
  // branch accepted ANY bearer string — it has to close as soon as an access
  // code exists, or configuring one would change nothing.
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

/** Move an inspection's photos onto disk, leaving references in the record.
 *
 *  Every write goes through saveVehicle, so this one place keeps image bytes out
 *  of local-inventory.json and out of Firestore documents — the latter matters
 *  more than it looks, since a Firestore document has a hard 1 MiB ceiling that
 *  a couple of base64 photos will breach.
 *
 *  Idempotent: put() hands back a reference unchanged, so re-saving an already
 *  converted inspection costs a map and nothing else. */
function storeVehiclePhotos(vehicle: any): any {
  const photos = vehicle?.photos;
  if (!photos || typeof photos !== 'object') return vehicle;
  const next: Record<string, string> = {};
  for (const [slotId, value] of Object.entries(photos)) {
    const ref = putPhoto(value);
    /* Falls back to the original value when the store cannot take it, so an
       inspection is never silently lost — it simply stays base64. */
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
/**
 * Exchange the inspector access code for a signed device token.
 * Mirrors TruLens's /api/auth/device so both yard apps sign in the same way.
 */
app.post('/api/auth/device', (req, res) => {
  if (!ACCESS_CODE) {
    return res.status(503).json({ error: 'No access code configured on this server.' });
  }
  const given = String(req.body?.code || '');
  if (!codeMatches(given, ACCESS_CODE)) {
    return res.status(401).json({ error: 'That code is not recognised.' });
  }
  res.json({ token: signDeviceToken(), expiresInDays: 30 });
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
/** Absolute origin of this instance, taken from the request.
 *
 *  Derived rather than configured so localhost, staging and production each
 *  advertise URLs pointing at themselves with no env var to forget. Honours the
 *  proxy headers Render sets, or the scheme comes back http behind its TLS
 *  terminator and consuming pages fetch mixed content. */
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
  /* Stored photos are served by this instance, but a report or dealer page
     reading this feed is on its own domain — a relative "/media/…" would
     resolve against that host and 404. Legacy base64 passes through untouched. */
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

  return {
    id: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || '',
    price: v.price || 0,
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
    daysInStock: null,
    source: 'trulens',
    updatedAt: v.updatedAt || v.lastDmsExportAt || null,
  };
}

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
    res.json({ success: true, package: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/public/stock — website feed from TruLens (lens-only dealers)
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
    const publicList = vehicles.map((v: any) => toPublicFromLens(v, originOf(req))).filter(Boolean);
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

// ==================== TRUINSPECT: AI DAMAGE DETECTION ====================

// POST /api/inspect/damage — analyze one photo for visible damage.
// Returns { aiMode, findings: DamageFinding[] }. Mock mode (no GEMINI_API_KEY)
// returns empty findings so the manual Basic tier still works end-to-end.
app.post('/api/inspect/damage', async (req, res) => {
  const { base64Image, slotId, slotName, vehicleInfo } = req.body || {};
  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }
  const base64Data = String(base64Image).replace(/^data:image\/\w+;base64,/, '');

  if (!ai) {
    return res.json({ aiMode: false, slotId: slotId || null, findings: [] });
  }

  try {
    const prompt = `You are a professional vehicle damage inspector for a used-car virtual inspection report.
Examine this photo (capture slot: "${slotName || slotId || 'unspecified'}") of a ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}.
List ONLY clearly visible damage or defects: scratches, dents, stone chips, rust, cracks (glass/lights/trim), hail damage, paint defects (fade, overspray, mismatch), abnormal wear (seats, pedals, steering wheel), or missing parts.
Do NOT report reflections, dirt, water drops, shadows, or normal styling lines as damage. If the photo shows no damage, return an empty list.
For each finding give: panel (e.g. "front bumper", "driver door", "windscreen"), damageType (scratch|dent|chip|rust|crack|hail|paint|wear|missing|other), severity 1-5 (1 = minor cosmetic blemish, 3 = clearly visible defect a buyer would query, 5 = structural or safety concern), confidence 0-1, location words (e.g. "lower left corner"), a short factual note with approximate size where visible (e.g. "~15cm scratch through clearcoat"), and x and y — the centre of the damage as a fraction of the image (0-1, x from left, y from top).`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  panel: { type: Type.STRING },
                  damageType: { type: Type.STRING },
                  severity: { type: Type.INTEGER },
                  confidence: { type: Type.NUMBER },
                  location: { type: Type.STRING },
                  note: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
                required: ['panel', 'damageType', 'severity', 'confidence', 'note'],
              },
            },
          },
          required: ['findings'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"findings":[]}');
    const clamp01 = (n: any) => Math.min(1, Math.max(0, Number(n)));
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
      .filter((f: any) => f && f.panel && f.note)
      .map((f: any, i: number) => {
        const loc = f.location ? String(f.location) : '';
        return {
          id: `ai_${Date.now().toString(36)}_${i}`,
          panel: String(f.panel),
          damageType: String(f.damageType || 'other'),
          severity: Math.min(5, Math.max(1, Math.round(Number(f.severity) || 1))),
          // Fold the model's location words into the note so the human sees them;
          // the client type carries no separate confidence/location field.
          note: loc ? `${String(f.note)} (${loc})` : String(f.note),
          x: Number.isFinite(Number(f.x)) ? clamp01(f.x) : 0.5,
          y: Number.isFinite(Number(f.y)) ? clamp01(f.y) : 0.5,
          source: 'ai',
          confirmed: false,
        };
      });

    res.json({ aiMode: true, slotId: slotId || null, findings });
  } catch (error: any) {
    console.error('Damage detection error:', error);
    // Never block the capture flow on AI failure — report gracefully
    res.json({
      aiMode: false,
      slotId: slotId || null,
      findings: [],
      error: error instanceof Error ? error.message : String(error),
    });
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

app.post('/api/export/dms', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const {
      vehicleId,
      dmsUrl: dmsUrlOverride,
      createIfMissing = true,
    } = req.body || {};

    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicleId is required' });
    }

    const vehicle = await getVehicle(vehicleId, userId);
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

    const dmsRes = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
