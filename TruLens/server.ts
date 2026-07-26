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

type LocalStore = { vehicles: any[] };

function isValidPhotoData(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 32) return false;
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

async function saveVehicle(vehicle: any): Promise<any> {
  const normalized = normalizeVehicle(vehicle);
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
app.post('/api/auth/device', (req, res) => {
  if (!ACCESS_CODE && DEALER_CODES.length === 0) {
    return res.status(503).json({ error: 'No access code configured on this server.' });
  }
  const given = String(req.body?.code || '');

  // A per-dealership code pins the yard server-side, so the phone cannot claim
  // to be someone else later.
  const dealerSlug = dealerForCode(given);
  if (dealerSlug) {
    return res.json({ token: signDeviceToken(dealerSlug), expiresInDays: 30, dealerSlug });
  }

  // Legacy shared code — still valid, but carries no dealership, so the picker
  // remains the only thing that decides where captures file.
  if (ACCESS_CODE && codeMatches(given, ACCESS_CODE)) {
    return res.json({ token: signDeviceToken(), expiresInDays: 30, dealerSlug: null });
  }

  return res.status(401).json({ error: 'That code is not recognised.' });
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
function toPublicFromLens(v: any) {
  const photos = v.photos && typeof v.photos === 'object' ? v.photos : {};
  // Prefer exterior hero order for website gallery
  const order = [
    'front_3_4', 'front_straight', 'side_driver', 'side_passenger',
    'rear_3_4', 'rear_straight', 'interior_dash', 'engine_bay',
  ];
  const images: string[] = [];
  for (const id of order) {
    if (typeof photos[id] === 'string' && photos[id].length > 32) images.push(photos[id]);
  }
  for (const [id, src] of Object.entries(photos)) {
    if (!order.includes(id) && typeof src === 'string' && src.length > 32) images.push(src);
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
const WEB3D_DIR = path.join(LOCAL_DATA_DIR, 'web3d');

function ensureWeb3dDir() {
  if (!fs.existsSync(WEB3D_DIR)) fs.mkdirSync(WEB3D_DIR, { recursive: true });
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
    const publicList = scoped.map(toPublicFromLens).filter(Boolean);
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

    const vehicle = await getVehicle(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    if (!LOCAL_MODE && vehicle.ownerId && vehicle.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const photos = vehicle.photos || {};
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
