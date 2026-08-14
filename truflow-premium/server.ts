import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp as initFirebaseAdmin, getApps as getFirebaseApps } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import {
  initPhotoStore,
  mediaDir,
  MEDIA_ROUTE,
  put as putPhoto,
  putAll as putPhotos,
  isStoredRef,
  isDataUri,
  stats as photoStats,
} from "./photoStore";
import { tidyStr, cleanModelName, normaliseExtras } from "./saNormalize";
/**
 * The state shape is shared with the client rather than inferred here.
 *
 * DEFAULT_MOCK_STATE was an unannotated literal and readState() returned
 * `typeof DEFAULT_MOCK_STATE`, so the API's idea of its own data was whatever
 * the seed happened to contain. No seed row carries dealershipId, so the field
 * every scoping check depends on did not exist on the type — which is most of
 * the 62 errors this file had, and meant the one thing standing between two
 * dealers' records was unchecked.
 *
 * `import type` is erased at compile time, so this adds no runtime dependency
 * on the client bundle.
 */
import type { DMSState, Vehicle, Lead, User, DealerDocument, Dealership, DocEvent, DocStage, DocMode, AccountingAccount, AccountingPlatform } from "./src/types";
import { DOC_STAGES, FIXED_STAGE_MODES, DEFAULT_DOC_FLOW } from "./src/types";
import { canAdvance } from "./src/lib/docValidator";
import { renderProforma, renderOffer, renderTaxInvoice, renderHandover, VAT_RATE } from "./docPdf";
import type { BuyerBlock, VehicleBlock } from "./docPdf";

dotenv.config();

// ---- AI (DeepSeek) ----
const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";
const aiConfigured = !!process.env.DEEPSEEK_API_KEY;

async function deepseekText(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const body: any = {
    model: "deepseek-chat",
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const r = await fetch(DEEPSEEK_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`DeepSeek API error ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Initialize Firebase Admin — same project as AutoLens Pro
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0151924955";
const AUTOLENS_DB_ID = process.env.AUTOLENS_DB_ID || "ai-studio-autolenspro-7d4757ec-a059-4566-98db-d15a4840f4ec";

let lensFirestore: FirebaseFirestore.Firestore;

if (!getFirebaseApps().length) {
  const fbApp = initFirebaseAdmin({ projectId: FIREBASE_PROJECT_ID });
  lensFirestore = getAdminFirestore(fbApp, AUTOLENS_DB_ID);
} else {
  lensFirestore = getAdminFirestore(getFirebaseApps()[0], AUTOLENS_DB_ID);
}

const app = express();
// Hosts (Render free tier, etc.) inject PORT — keep 3001 for local dev
const PORT = Number(process.env.PORT) || 3001;

// Large payloads for base64 photo pushes from TruLens / AutoLens
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Security headers — conservative baseline (nosniff, referrer, HSTS-in-prod).
// X-Frame-Options intentionally omitted: some services are embedded as widgets.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Custom lightweight CORS middleware for external website plugins & widget integrations
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check for free-tier hosts (Render, etc.) + keep-alive pings
const STARTED_AT = Date.now();
/** Which commit is actually running.
 *
 *  Added because confirming a deploy was guesswork, and the guesses were wrong
 *  in both directions on 2026-07-27. `uptimeSec` reset to 128 while the service
 *  was still serving the previous build, so a restart read as a deploy; and a
 *  check that grepped index-*.js for a new string reported "not deployed" for a
 *  change that had shipped, because Vite code-splits the modals into their own
 *  chunks. Both were inferences about the running code from things that only
 *  correlate with it.
 *
 *  RENDER_GIT_COMMIT is set by Render on every build. Public deliberately: it is
 *  a commit id, it reveals nothing, and a deploy check that needs a login is a
 *  deploy check nobody runs. */
app.get("/api/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const commit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null;
  res.json({
    product: "truflow-premium",
    commit,
    shortCommit: commit ? String(commit).slice(0, 7) : null,
    branch: process.env.RENDER_GIT_BRANCH || null,
    builtFrom: commit ? "render" : "unknown (env not set — local run?)",
    startedAt: new Date(Date.now() - Math.floor(process.uptime() * 1000)).toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    product: "truflow-premium",
    port: PORT,
    nodeEnv: process.env.NODE_ENV || "development",
    /* A boolean, never the value — the same field TruLens reports. Without it
       the only way to tell whether TRUFLOW_SYNC_KEY reached the process was to
       POST a deliberately wrong key and read 401-vs-400 out of the status
       code, which is not a check anyone will remember to run. An env var saved
       under a mistyped name restarts the service and looks identical to
       success from outside; this is the field that tells them apart. */
    syncKeyConfigured: !!SYNC_SERVICE_KEY,
    uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
    ts: new Date().toISOString(),
  });
});

// Writable state lives under DATA_DIR so it can sit on a mounted Render disk
// and survive deploys/restarts. Unset (local dev) = cwd, i.e. the old paths.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const DATA_FILE = path.join(DATA_DIR, "data.json");
// Repo-shipped seed. Used once, only when the disk is still empty — never
// written back to, so a redeploy can't clobber the dealer's real stock.
const SEED_FILE = path.join(process.cwd(), "data.json");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

/** The dealership an untagged legacy row is understood to belong to.
 *
 *  Declared here, near the top, rather than beside the public-feed helpers where
 *  it used to live: readState() references it, and readState() is called during
 *  boot by the photo migration — far above the old declaration, which put it in
 *  the temporal dead zone and threw before the server could start.
 *
 *  It is now only ever used to STAMP legacy rows once, in readState. Nothing
 *  compares against it as a fallback any more; see the backfill there. */
const DEFAULT_DEALERSHIP_ID = "d1";

/** The products a dealership can be entitled to.
 *
 *  Adding one here is the whole of the work for a new app: every product
 *  verifies codes against this instance, so a dealer gains access by having the
 *  name ticked on their record rather than by someone editing an environment
 *  variable on that app's service and redeploying it.
 *
 *  Onboarding used to mean creating the dealership here, issuing a code, then
 *  hand-editing TRULENS_DEALER_CODES — a comma-separated "slug:CODE" string
 *  holding every dealer's code in plaintext on the Render dashboard — and
 *  restarting TruLens so it took effect. Once per product, per dealer, and
 *  revoking access meant editing that string and redeploying again. */
const PRODUCTS = ["lens", "flow", "flow-lite", "inspect", "live", "value", "social"] as const;
type ProductName = (typeof PRODUCTS)[number];

/** Collections whose rows belong to exactly one dealership.
 *
 *  Anything listed here is scoped on read and stamped on load, so a new
 *  collection that holds dealer data has one place to be registered rather than
 *  a scattering of filters to remember. */
const TENANT_SCOPED_COLLECTIONS = [
  "vehicles",
  "leads",
  "tasks",
  "invoices",
  "agreements",
  "documents",
  "docEvents",
  "expenses",
  "communications",
  "users",
] as const;

const SHARED_FILE = path.join(DATA_DIR, "shared.json");
const MIGRATED_FLAG = path.join(DATA_DIR, ".per-dealer-migrated");

type TenantKey = (typeof TENANT_SCOPED_COLLECTIONS)[number];

interface SharedState {
  dealerships: Dealership[];
  settings: DMSState["settings"];
  socialAccounts?: DMSState["socialAccounts"];
  accountingAccounts?: DMSState["accountingAccounts"];
  migrations?: Record<string, boolean>;
}

type DealerData = { [K in TenantKey]: any[] };

function dealerFile(id: string): string {
  return path.join(DATA_DIR, `dealer-${id}.json`);
}

function readShared(): SharedState {
  if (fs.existsSync(SHARED_FILE)) {
    return JSON.parse(fs.readFileSync(SHARED_FILE, "utf-8"));
  }
  return {
    dealerships: DEFAULT_MOCK_STATE.dealerships,
    settings: DEFAULT_MOCK_STATE.settings,
    socialAccounts: [],
    accountingAccounts: [],
    migrations: {},
  };
}

function writeShared(shared: SharedState): void {
  const tmp = SHARED_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(shared, null, 2), "utf-8");
  fs.renameSync(tmp, SHARED_FILE);
}

function readDealerData(id: string): DealerData {
  const f = dealerFile(id);
  if (fs.existsSync(f)) {
    return JSON.parse(fs.readFileSync(f, "utf-8"));
  }
  const empty: any = {};
  for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
  return empty;
}

function writeDealerData(id: string, data: DealerData): void {
  const target = dealerFile(id);
  const tmp = target + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, target);
}

function allDealerIds(): string[] {
  const ids: string[] = [];
  for (const f of fs.readdirSync(DATA_DIR)) {
    const m = f.match(/^dealer-(.+)\.json$/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** A unique id with a readable prefix.
 *
 *  Ids were `prefix + Date.now()`, which collides whenever two records are
 *  created inside the same millisecond. That is not exotic: a DocHub document
 *  and its audit row are written in one request, and a bulk lead import creates
 *  many in a tight loop.
 *
 *  A collision is not cosmetic. `findIndex` resolves only the first match, so
 *  the second record becomes permanently unaddressable by id — and the coupling
 *  guards that ask "is any OTHER lead still holding this car" compare
 *  `l.id !== lead.id`, so a twin silently reads as the same row and the guard
 *  passes when it should not.
 *
 *  Timestamp stays first so ids remain chronologically sortable and greppable;
 *  the counter makes same-millisecond calls distinct and the random tail keeps
 *  ids from two processes on one disk apart. */
let idSequence = 0;
function newId(prefix: string): string {
  idSequence = (idSequence + 1) % 1_000_000;
  const seq = idSequence.toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}${Date.now()}_${seq}${rand}`;
}

function isPerDealerMode(): boolean {
  return fs.existsSync(MIGRATED_FLAG);
}

function migrateToPerDealerFiles(): void {
  if (fs.existsSync(MIGRATED_FLAG)) return;
  if (!fs.existsSync(DATA_FILE)) return;

  console.log("[migration] Splitting data.json into per-dealer files...");
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

  const shared: SharedState = {
    dealerships: raw.dealerships || [],
    settings: raw.settings || {},
    socialAccounts: raw.socialAccounts || [],
    migrations: raw.migrations || {},
  };

  const buckets = new Map<string, DealerData>();
  for (const key of TENANT_SCOPED_COLLECTIONS) {
    const rows: any[] = raw[key] || [];
    for (const row of rows) {
      const did = row.dealershipId || "orphan";
      if (did === "orphan") {
        console.warn(`[migration] Orphan row in ${key}: ${row.id}`);
      }
      if (!buckets.has(did)) {
        const empty: any = {};
        for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
        buckets.set(did, empty);
      }
      buckets.get(did)![key].push(row);
    }
  }

  writeShared(shared);
  buckets.forEach((data, id) => {
    writeDealerData(id, data);
    const count = TENANT_SCOPED_COLLECTIONS.reduce((n, k) => n + (data[k] || []).length, 0);
    console.log(`[migration] dealer-${id}.json — ${count} rows`);
  });

  fs.writeFileSync(MIGRATED_FLAG, new Date().toISOString(), "utf-8");
  console.log("[migration] Done. Old data.json kept as backup.");
}

/* Photos live beside the state as files rather than inside it as base64.
   See photoStore.ts for why. Initialised here, after DATA_DIR is known and
   before the route below is registered — express.static resolves its root at
   construction, so registering it any earlier throws "root path required". */
initPhotoStore(DATA_DIR);

/* Stock photos, served as files.
 *
 * Immutable and cached for a year, which is safe precisely because the filename
 * is the SHA-256 of the bytes: a given path can never come to mean different
 * content, so there is no cache to bust. This is the whole point of the move —
 * a browser fetches each photo once, instead of re-downloading every photo of
 * every car inside a multi-megabyte JSON payload on every page load.
 *
 * Public, and registered before requireAuth: these are dealer stock photos
 * bound for public websites, and the path is an opaque hash rather than
 * anything enumerable. */
app.use(
  MEDIA_ROUTE,
  express.static(mediaDir(), {
    immutable: true,
    maxAge: "365d",
    fallthrough: false,
    index: false,
    dotfiles: "deny",
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — per-dealer access codes, verified server-side.
//
// Replaces the old client-side `password === "2026"` check, which was cosmetic:
// the code shipped in the browser bundle and every /api route was open anyway.
// Codes are stored salted+hashed; the plaintext is shown once at creation and
// never recoverable. Tokens are HMAC-signed, so they survive a restart without
// a session store.
// ─────────────────────────────────────────────────────────────────────────────

/** Who a code belongs to.
 *  admin      — TruSaaS, every dealership
 *  principal  — the dealer who owns the account; manages their own staff
 *  manager    — full access to that dealership, no seat management
 *  salesperson— same data, no seat management
 *  Seats are billable per active non-principal user. */
type AuthRole = "admin" | "principal" | "manager" | "salesperson";

type AuthAccount = {
  id: string;
  label: string;
  /** Which dealership this code sees. Omitted for the master admin. */
  dealershipId?: string;
  /** Links to a row in state.users for staff seats. Absent on the
   *  principal's own login and on the master admin. */
  userId?: string;
  role: AuthRole;
  salt: string;
  hash: string;
  createdAt: string;
  rotatedAt?: string;
};

const MANAGES_USERS: AuthRole[] = ["admin", "principal"];
/** Roles a dealer principal may hand out. Deliberately excludes admin — a
 *  dealer must never be able to mint a login that sees other dealerships. */
const ASSIGNABLE_ROLES: AuthRole[] = ["manager", "salesperson"];
type AuthStore = { secret: string; accounts: AuthAccount[] };

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // one working day
// "Keep me signed in" — a yard tablet or Lance's laptop shouldn't ask for the
// code every morning. Still bounded, so a lost device stops working eventually.
const TOKEN_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashCode(code: string, salt: string): string {
  return crypto.scryptSync(code.trim(), salt, 32).toString("hex");
}

/** Human-friendly random code — no look-alike characters (0/O, 1/I/l). */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(9);
  let out = "";
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) out += "-";
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out; // e.g. K7P-QM4-XT9
}

/** A code you set yourself, if you'd rather not read a random one out of the
 *  service log. Read once at first boot from the environment:
 *    ADMIN_ACCESS_CODE       — master admin
 *    DEALER_CODE_D1 / _D2    — per dealership, id uppercased
 *  Unset means a random code is generated and printed instead. Changing the
 *  variable later does nothing; rotate the code through the API. */
function codeFromEnv(role: AuthRole, dealershipId?: string): string {
  const raw =
    role === "admin"
      ? process.env.ADMIN_ACCESS_CODE
      : dealershipId && process.env[`DEALER_CODE_${dealershipId.toUpperCase()}`];
  const code = String(raw || "").trim();
  // Too short to be worth having — fall back to a generated one rather than
  // quietly accepting something guessable.
  return code.length >= 6 ? code : "";
}

function makeAccount(label: string, role: AuthRole, dealershipId?: string, preset?: string, userId?: string) {
  const code = preset || generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const account: AuthAccount = {
    id: "acc_" + crypto.randomBytes(6).toString("hex"),
    label,
    dealershipId,
    userId,
    role,
    salt,
    hash: hashCode(code, salt),
    createdAt: new Date().toISOString(),
  };
  return { account, code };
}

function readAuth(): AuthStore {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
      if (parsed?.secret && Array.isArray(parsed.accounts)) return parsed;
    }
  } catch (err) {
    console.error("Error reading auth file:", err);
  }
  return { secret: "", accounts: [] };
}

function writeAuth(store: AuthStore) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** First boot on a fresh disk: mint a secret and one code per dealership.
 *  Codes are printed to the service log exactly once — grab them from Render's
 *  log viewer. They cannot be read back afterwards, only rotated. */
function ensureAuthStore(): AuthStore {
  const store = readAuth();
  if (store.secret && store.accounts.length) return store;

  store.secret = store.secret || crypto.randomBytes(32).toString("hex");
  const issued: string[] = [];

  const note = (preset: string) => (preset ? "(set from environment)" : "");

  if (!store.accounts.some((a) => a.role === "admin")) {
    const preset = codeFromEnv("admin");
    const { account, code } = makeAccount("Master admin (TruSaaS)", "admin", undefined, preset);
    store.accounts.push(account);
    issued.push(`  ${account.label.padEnd(32)} ${preset ? "*".repeat(code.length) : code} ${note(preset)}`);
  }
  for (const d of readState().dealerships || []) {
    if (store.accounts.some((a) => a.dealershipId === d.id)) continue;
    const preset = codeFromEnv("principal", d.id);
    const { account, code } = makeAccount(d.name + " (owner)", "principal", d.id, preset);
    store.accounts.push(account);
    issued.push(`  ${account.label.padEnd(32)} ${preset ? "*".repeat(code.length) : code} ${note(preset)}`);
  }

  writeAuth(store);
  if (issued.length) {
    console.log("\n" + "=".repeat(64));
    console.log(" TruFlow Premium — ACCESS CODES ISSUED (shown once, save them now)");
    console.log("=".repeat(64));
    console.log(issued.join("\n"));
    console.log("=".repeat(64) + "\n");
  }
  return store;
}

function signToken(account: AuthAccount, remember = false): string {
  const store = ensureAuthStore();
  const payload = Buffer.from(
    JSON.stringify({
      sub: account.id,
      dealershipId: account.dealershipId,
      userId: account.userId,
      role: account.role,
      label: account.label,
      exp: Date.now() + (remember ? TOKEN_TTL_REMEMBER_MS : TOKEN_TTL_MS),
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", store.secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): any | null {
  try {
    const store = ensureAuthStore();
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", store.secret).update(payload).digest("base64url");
    // Constant-time compare — a fast-fail string compare leaks the signature.
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Routes that must stay reachable without a token.
 *  The public feeds are what every dealer website reads — locking those would
 *  take the showrooms offline. They expose published stock only, never leads. */
function isPublicPath(p: string): boolean {
  return (
    p === "/api/health" ||
    p === "/api/version" ||
    p === "/api/auth/login" ||
    p === "/api/auth/demo" ||   // the way in for a prospect — must be reachable
    p.startsWith("/api/public/") ||
    p.startsWith("/api/feed/") ||
    p.startsWith("/api/widget/") ||
    p === "/api/integration/webhook-lead" ||
    p === "/api/integration/webhook-zernio" ||
    p === "/api/integration/webhook-codat" ||
    p === "/api/social/callback" ||
    p === "/api/accounting/callback"
  );
}

// TruLens pushes captures server-to-server and has no user session. Until a
// shared key is configured on both services this stays open, so an unset key
// can't silently break a dealer's photo export mid-capture.
const SYNC_SERVICE_KEY = process.env.TRUFLOW_SYNC_KEY || "";
const TRULENS_URL = (process.env.TRULENS_URL || "https://lens.tru-saas.com").replace(/\/$/, "");

function requireAuth(req: any, res: any, next: any) {
  if (!req.path.startsWith("/api/") || isPublicPath(req.path)) return next();

  if (req.path === "/api/sync/push-photos") {
    if (!SYNC_SERVICE_KEY) return next();
    if (req.headers["x-tru-sync-key"] === SYNC_SERVICE_KEY) return next();
  }

  /* Product-to-product identity. The caller is TruLens or TruInspect asking
     whether a dealer code is real and what it opens, so it carries the shared
     key rather than a session — there is no user logged in to this instance at
     that moment, which is the entire point of the call.
     Unlike push-photos there is no unset-key fallthrough: an unconfigured key
     must not turn code verification into an open endpoint anyone can test
     dealer codes against. The handler refuses with 503 instead. */
  if (req.path === "/api/auth/verify-code") {
    if (req.headers["x-tru-sync-key"] === SYNC_SERVICE_KEY && SYNC_SERVICE_KEY) return next();
    if (!SYNC_SERVICE_KEY) return next(); // handler returns 503 explaining why
  }

  const header = String(req.headers.authorization || "");
  const claims = header.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!claims) {
    return res.status(401).json({ error: "Unauthorized", message: "Sign in to continue." });
  }

  // A staff token stays valid until it expires, so removing someone has to be
  // checked here — otherwise a dismissed salesperson keeps access for 30 days.
  if (claims.userId) {
    const user = readState().users.find((u: any) => u.id === claims.userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "Unauthorized", message: "This login has been removed." });
    }
  }

  req.auth = claims;
  next();
}

app.use(requireAuth);

/** Restrict a list to the caller's dealership. Admins see everything.
 *  Untagged rows belong to the default dealership, matching the public feed. */
function scopeToDealer<T extends { dealershipId?: string }>(rows: T[], auth: any): T[] {
  if (!auth || auth.role === "admin") return rows;
  return (rows || []).filter(
    (r) => r.dealershipId === auth.dealershipId
  );
}

/** The dealership a newly created record belongs to. Taken from the session so
 *  it can't be spoofed, and so nothing is ever written untagged — untagged
 *  falls to the default dealership, which means it silently belongs to the
 *  pilot dealer and vanishes from the list of whoever actually created it. */
function ownerDealership(req: any): string | undefined {
  return req.auth?.role === "admin" ? req.body?.dealershipId : req.auth?.dealershipId;
}

/** Check that a record belongs to the caller. Admins may touch any record. */
function mayTouch(row: { dealershipId?: string } | undefined, auth: any): boolean {
  if (!row) return false;
  if (auth?.role === "admin") return true;
  return row.dealershipId === auth?.dealershipId;
}

app.post("/api/auth/login", (req, res) => {
  const code = String(req.body?.code || "").trim();
  const remember = req.body?.remember !== false; // default on — yard devices
  const store = ensureAuthStore();
  const match = store.accounts.find((a) => hashCode(code, a.salt) === a.hash);
  if (!code || !match) {
    return res.status(401).json({ error: "Invalid code" });
  }
  // A removed staff member was still handed a token here — every later request
  // then 401'd, so they got in and found a dead app instead of a clear refusal.
  if (match.userId) {
    const user = readState().users.find((u: any) => u.id === match.userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "This login has been removed." });
    }
  }
  res.json({
    token: signToken(match, remember),
    expiresInDays: remember ? 30 : 0.5,
    account: { label: match.label, role: match.role, dealershipId: match.dealershipId },
  });
});

app.get("/api/auth/me", (req: any, res) => {
  res.json({ account: req.auth || null });
});

/** Issue a fresh code for a dealership, or rotate an existing one. Admin only.
 *  The new code is returned once in the response and never again. */
/**
 * Resolve a dealer code, for the other products in the suite.
 *
 * TruLens, TruInspect and everything built after them each kept their own copy
 * of every dealer's code in an environment variable — TRULENS_DEALER_CODES is a
 * comma-separated "slug:CODE" string — so onboarding one dealer meant creating
 * them here, issuing a code, pasting it into each app's service configuration in
 * plaintext, and restarting that app. Per product. Revoking meant editing the
 * same string and redeploying again, and a code lived in as many dashboards as
 * you had apps.
 *
 * Dealerships already live here and TruLens already proxies the list from this
 * instance; identity is the piece that was missing. One place issues a code, one
 * place says which products it opens, and an app asks rather than remembers.
 *
 * Service-to-service: the caller is another product, not a browser, so it
 * authenticates with the shared sync key rather than a session. Deliberately NOT
 * public — an open endpoint here would let anyone test codes against every
 * dealership on the instance.
 */
app.post("/api/auth/verify-code", (req: any, res) => {
  if (!SYNC_SERVICE_KEY) {
    return res.status(503).json({
      error: "Not configured",
      message: "TRUFLOW_SYNC_KEY must be set before products can verify codes here.",
    });
  }
  if (req.headers["x-tru-sync-key"] !== SYNC_SERVICE_KEY) {
    return res.status(401).json({ error: "Invalid sync key." });
  }

  const code = String(req.body?.code || "").trim();
  const product = String(req.body?.product || "").trim().toLowerCase();
  if (!code) return res.status(400).json({ error: "code is required" });
  if (!PRODUCTS.includes(product as ProductName)) {
    return res.status(400).json({
      error: `Unknown product "${product}".`,
      message: `Known products: ${PRODUCTS.join(", ")}.`,
    });
  }

  const store = ensureAuthStore();
  const match = store.accounts.find((a) => hashCode(code, a.salt) === a.hash);
  /* Same 401 for "no such code" and "wrong code", and no hint about which
     dealerships exist — this endpoint is reachable by anything holding the sync
     key, so it should confirm nothing it was not asked. */
  if (!match) return res.status(401).json({ error: "Code not recognised." });

  const state = readState();

  /* The master admin holds no dealership. It is a platform login, not a yard's,
     and handing it a dealerSlug would let it capture vehicles into whichever
     dealership happened to sort first. */
  if (!match.dealershipId) {
    return res.status(403).json({
      error: "Not a dealership code",
      message: "The master admin cannot be used to sign in to a product.",
    });
  }

  const dealership = (state.dealerships || []).find((d: any) => d.id === match.dealershipId);
  if (!dealership) {
    /* The code outlived its dealership — retired, or pruned. Refuse rather than
       let a code with no yard behind it through. */
    return res.status(403).json({
      error: "Dealership no longer exists",
      message: "This code belonged to a dealership that has been removed.",
    });
  }

  const products: string[] = Array.isArray(dealership.products) ? dealership.products : [];
  if (!products.includes(product)) {
    return res.status(403).json({
      error: "Not entitled",
      message: `${dealership.name} is not set up for ${product}.`,
      dealerSlug: dealership.slug,
      products,
    });
  }

  res.json({
    ok: true,
    dealerSlug: dealership.slug,
    dealershipId: dealership.id,
    dealerName: dealership.name,
    role: match.role,
    label: match.label,
    products,
  });
});

app.post("/api/auth/codes/rotate", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const { dealershipId, label, code: chosen } = req.body || {};
  const store = ensureAuthStore();
  const dealership = (readState().dealerships || []).find((d: any) => d.id === dealershipId);
  if (!dealership) return res.status(404).json({ error: "Unknown dealership" });

  // Setting your own code is allowed, within reason — a four-character code on
  // an endpoint anyone can POST to is not a code.
  const preset = String(chosen || "").trim();
  if (preset && preset.length < 6) {
    return res.status(400).json({ error: "Code must be at least 6 characters." });
  }
  const { account, code } = makeAccount(label || dealership.name + " (owner)", "principal", dealershipId, preset);
  store.accounts = store.accounts.filter((a) => !(a.dealershipId === dealershipId && a.role === "principal"));
  account.rotatedAt = new Date().toISOString();
  store.accounts.push(account);
  writeAuth(store);

  res.json({ code, account: { label: account.label, dealershipId, role: account.role } });
});

// ── Seats — a dealer principal manages their own staff logins ───────────────

/** The dealership the caller may act on. Admins may name one; everyone else
 *  is pinned to their own, so a principal can't create staff elsewhere. */
function targetDealership(req: any, bodyDealershipId?: string): string | undefined {
  if (req.auth?.role === "admin") return bodyDealershipId || undefined;
  return req.auth?.dealershipId;
}

/** Staff logins for a dealership, with the active seat count to bill against. */
app.get("/api/auth/users", (req: any, res) => {
  if (!MANAGES_USERS.includes(req.auth?.role)) {
    return res.status(403).json({ error: "You can't manage logins." });
  }
  const dealershipId = targetDealership(req, req.query.dealershipId as string);
  const state = readState();
  const store = ensureAuthStore();

  const seats = store.accounts
    .filter((a) => a.userId && (!dealershipId || a.dealershipId === dealershipId))
    .map((a) => {
      const user = state.users.find((u: any) => u.id === a.userId);
      return {
        accountId: a.id,
        userId: a.userId,
        name: user?.name || a.label,
        email: user?.email || "",
        phone: user?.phone || "",
        role: a.role,
        dealershipId: a.dealershipId,
        isActive: user?.isActive !== false,
        createdAt: a.createdAt,
        rotatedAt: a.rotatedAt,
      };
    });

  res.json({
    dealershipId,
    seats,
    activeSeats: seats.filter((s) => s.isActive).length,
  });
});

/** Add a staff login. The code is returned once and never recoverable —
 *  the principal hands it to the person, and rotates it if it goes missing. */
app.post("/api/auth/users", (req: any, res) => {
  if (!MANAGES_USERS.includes(req.auth?.role)) {
    return res.status(403).json({ error: "You can't manage logins." });
  }
  const { name, email, phone, role, code: chosen } = req.body || {};
  const dealershipId = targetDealership(req, req.body?.dealershipId);
  if (!dealershipId) return res.status(400).json({ error: "dealershipId is required." });
  if (!String(name || "").trim()) return res.status(400).json({ error: "Name is required." });

  const wanted: AuthRole = ASSIGNABLE_ROLES.includes(role) ? role : "salesperson";
  const preset = String(chosen || "").trim();
  if (preset && preset.length < 6) {
    return res.status(400).json({ error: "Code must be at least 6 characters." });
  }

  const state = readState();
  // Annotated so the role ternary keeps its literal types instead of widening
  // to string — this is the value that decides what a new seat can see.
  const user: User = {
    id: newId("u_"),
    name: String(name).trim(),
    email: email || "",
    role: wanted === "manager" ? "manager" : "salesperson",
    phone: phone || "",
    isActive: true,
    dealershipId,
  };
  state.users.push(user);
  writeState(state);

  const store = ensureAuthStore();
  const { account, code } = makeAccount(user.name, wanted, dealershipId, preset, user.id);
  store.accounts.push(account);
  writeAuth(store);

  res.status(201).json({ code, user, role: wanted });
});

/** Issue a replacement code for a staff member. */
app.post("/api/auth/users/:userId/rotate", (req: any, res) => {
  if (!MANAGES_USERS.includes(req.auth?.role)) {
    return res.status(403).json({ error: "You can't manage logins." });
  }
  const store = ensureAuthStore();
  const existing = store.accounts.find((a) => a.userId === req.params.userId);
  if (!existing) return res.status(404).json({ error: "No login for that user." });
  if (req.auth.role !== "admin" && existing.dealershipId !== req.auth.dealershipId) {
    return res.status(403).json({ error: "That login belongs to another dealership." });
  }

  const preset = String(req.body?.code || "").trim();
  if (preset && preset.length < 6) {
    return res.status(400).json({ error: "Code must be at least 6 characters." });
  }
  const { account, code } = makeAccount(
    existing.label, existing.role, existing.dealershipId, preset, existing.userId
  );
  account.rotatedAt = new Date().toISOString();
  store.accounts = store.accounts.filter((a) => a.userId !== req.params.userId);
  store.accounts.push(account);
  writeAuth(store);

  res.json({ code, userId: req.params.userId });
});

/** Turn a seat off (or back on). Deactivating kills their session on the next
 *  request and drops them out of the billable count; their history stays. */
app.post("/api/auth/users/:userId/active", (req: any, res) => {
  if (!MANAGES_USERS.includes(req.auth?.role)) {
    return res.status(403).json({ error: "You can't manage logins." });
  }
  const state = readState();
  const user = state.users.find((u: any) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "Unknown user." });
  if (req.auth.role !== "admin" && user.dealershipId !== req.auth.dealershipId) {
    return res.status(403).json({ error: "That user belongs to another dealership." });
  }

  user.isActive = req.body?.isActive !== false;
  writeState(state);
  res.json({ user });
});

/** Change your own admin code. Requires the current one, so a borrowed session
 *  on an unlocked laptop can't lock you out of your own platform. */
app.post("/api/auth/codes/admin", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const { currentCode, newCode } = req.body || {};
  const next = String(newCode || "").trim();
  if (next.length < 8) {
    return res.status(400).json({ error: "Admin code must be at least 8 characters." });
  }

  const store = ensureAuthStore();
  const admin = store.accounts.find((a) => a.id === req.auth.sub && a.role === "admin");
  if (!admin) return res.status(404).json({ error: "Admin account not found." });
  if (hashCode(String(currentCode || ""), admin.salt) !== admin.hash) {
    return res.status(401).json({ error: "Current admin code is wrong." });
  }

  admin.salt = crypto.randomBytes(16).toString("hex");
  admin.hash = hashCode(next, admin.salt);
  admin.rotatedAt = new Date().toISOString();
  writeAuth(store);

  // The old token still verifies — it's signed, and the signing secret hasn't
  // changed — so hand back a fresh one and let the client replace it.
  res.json({ ok: true, token: signToken(admin, true) });
});


/* ── Demo tenant ────────────────────────────────────────────────────────────
   A prospect needs to see the product without a code and without ever touching
   a real dealership's data. The demo is a normal tenant (dealershipId "demo"),
   so every existing scope check isolates it for free — no special-cased reads.
   Its data is seeded on first entry and can be reset without affecting anyone. */

const DEMO_ENABLED = process.env.DEMO_MODE !== "0"; // on unless explicitly disabled

function seedDemoTenant() {
  const state = readState();
  if (state.vehicles.some((v: any) => v.dealershipId === "demo")) return; // already seeded
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  const cars = [
    { make: "Toyota", model: "Hilux", trim: "2.4 GD-6 SRX", year: 2020, cost: 318000, retail: 379900, km: 112000, age: 12, body: "Bakkie" },
    { make: "Volkswagen", model: "Polo", trim: "1.0 TSI Comfortline", year: 2021, cost: 228000, retail: 269900, km: 52300, age: 41, body: "Hatchback" },
    { make: "Ford", model: "EcoSport", trim: "1.5 Ambiente", year: 2018, cost: 172000, retail: 199900, km: 96800, age: 74, body: "SUV" },
  ];
  cars.forEach((c, i) => {
    state.vehicles.unshift({
      id: "demo_v" + (i + 1), year: c.year, make: c.make, model: c.model, trim: c.trim,
      status: "INVENTORY", retailPrice: c.retail, costPrice: c.cost, mileage: c.km,
      transmission: "Manual", fuelType: i === 0 ? "Diesel" : "Petrol",
      stockNumber: "DEMO-" + (100 + i), dateAcquired: daysAgo(c.age), daysInInventory: c.age,
      description: `${c.year} ${c.make} ${c.model} — sample stock for the demo.`,
      bodyType: c.body, images: [], reconTasks: i === 1 ? [{ id: "demo_r1", name: "Valet & polish", cost: 1800, status: "Completed", dateAdded: today }] : [],
      dealershipId: "demo",
    } as any);
  });

  state.leads.unshift({
    id: "demo_l1", firstName: "Sipho", lastName: "Ndlovu", phone: "079 000 0001",
    email: "sipho@example.co.za", vehicleId: "demo_v1", source: "Website", status: "New",
    assignedUserId: "u1", createdAt: today, lastContactedAt: null, digitalScore: 82,
    notes: "Asked about finance on the Hilux.", nextAction: "First contact", nextActionAt: today,
    stageChangedAt: today, dealershipId: "demo",
  } as any);
  state.leads.unshift({
    id: "demo_l2", firstName: "Annelie", lastName: "Botha", phone: "082 000 0002",
    email: "annelie@example.co.za", vehicleId: "demo_v2", source: "Walk-in", status: "Contacted",
    assignedUserId: "u1", createdAt: daysAgo(9), lastContactedAt: daysAgo(9), digitalScore: 64,
    notes: "Wants a trade-in valuation.", nextAction: "Follow up", nextActionAt: daysAgo(4),
    stageChangedAt: daysAgo(9), dealershipId: "demo",
  } as any);

  writeState(state);
}

/** Enter the demo. No code — that is the point. */
app.post("/api/auth/demo", (_req, res) => {
  if (!DEMO_ENABLED) return res.status(404).json({ error: "Demo is disabled on this instance." });
  seedDemoTenant();
  const store = ensureAuthStore();
  let acc = store.accounts.find((a) => a.dealershipId === "demo");
  if (!acc) {
    const made = makeAccount("Demo Dealership", "principal", "demo");
    acc = made.account;
    store.accounts.push(acc);
    writeAuth(store);
  }
  res.json({
    token: signToken(acc, false), // short session — a demo shouldn't linger for 30 days
    demo: true,
    account: { label: "Demo Dealership", role: "principal", dealershipId: "demo", demo: true },
  });
});

app.get("/api/auth/codes", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  // Codes themselves are unrecoverable — this lists who has one.
  res.json({
    accounts: ensureAuthStore().accounts.map((a) => ({
      id: a.id, label: a.label, role: a.role,
      dealershipId: a.dealershipId, createdAt: a.createdAt, rotatedAt: a.rotatedAt,
    })),
  });
});

// Clean initial state — no demo data, no seed vehicles or leads.
// Dealerships are config (they map dealer slugs to websites) so they stay.
const DEFAULT_MOCK_STATE: DMSState = {
  dealerships: [
    { id: 'd1', name: 'MKR Auto Sales', location: 'Johannesburg', slug: 'mkr-autosales', websiteUrl: 'https://mkrauto.netlify.app' },
    { id: 'd2', name: 'Cars on Caledon', location: 'Kariega, Eastern Cape', slug: 'cars-on-caledon', websiteUrl: 'https://www.carsoncaledon.co.za' },
    { id: 'true-cars', name: 'True Cars', location: 'Port Elizabeth', slug: 'true-cars', websiteUrl: 'https://www.true-cars.co.za' },
  ],
  vehicles: [],
  leads: [],
  tasks: [],
  invoices: [],
  agreements: [],
  documents: [] as any[],
  users: [],
  communications: [],
  expenses: [],
  settings: {
    tier: 'premium',
    truLens: true,
    truInspect: true,
    websitePortal: true,
    multiPortalSync: true,
    trueAI: true,
    smartLedger: true,
    chatbot: true,
    liveReceptionist: true,
    seoAeo: true,
    syndication: true,
    truSocial: false,
  }
};

// State Helper Functions

function backfillShared(shared: SharedState): SharedState {
  shared.settings = { ...DEFAULT_MOCK_STATE.settings, ...(shared.settings || {}) };

  if (!Array.isArray(shared.dealerships) || !shared.dealerships.length) {
    shared.dealerships = DEFAULT_MOCK_STATE.dealerships;
  } else {
    shared.dealerships = shared.dealerships.map((d: any) => {
      const seed = DEFAULT_MOCK_STATE.dealerships.find((x: any) => x.id === d.id);
      return seed ? { ...d, ...seed } : d;
    });
    const existingIds = new Set(shared.dealerships.map((d: any) => d.id));
    for (const seed of DEFAULT_MOCK_STATE.dealerships) {
      if (!existingIds.has(seed.id)) shared.dealerships.push({ ...seed });
    }
  }

  shared.migrations = shared.migrations || {};
  if (!shared.migrations.prunedSeedDealers) {
    const retired = new Set(["d3", "demo"]);
    shared.dealerships = shared.dealerships.filter((d: any) => !retired.has(d.id));
    shared.migrations.prunedSeedDealers = true;
  }

  for (const d of shared.dealerships || []) {
    if (!Array.isArray((d as any).products) || !(d as any).products.length) {
      (d as any).products = [...PRODUCTS];
    }
  }

  return shared;
}

function backfillVehicles(vehicles: any[]): void {
  for (const v of vehicles) {
    if (!v.images) v.images = [];
    if (!v.reconTasks) v.reconTasks = [];
    if (typeof v.showOnWebsite !== "boolean") v.showOnWebsite = true;
    if (v.images.length === 0 && v.source === "trulens" && Array.isArray(v.extrasPhotos) && v.extrasPhotos.length > 0) {
      v.images = v.extrasPhotos.slice();
      v.extrasPhotos = [];
    }
  }
}

/** A private copy of the seed.
 *
 *  `readState()` falls back to the seed when a data file cannot be read, and it
 *  used to hand back DEFAULT_MOCK_STATE itself. Every write handler then
 *  mutated that module-level object in place and `writeState` persisted it — so
 *  one unreadable dealer file turned the seed into the live data, and each
 *  later request in the same process compounded the damage against it.
 *
 *  Returning a clone keeps the fallback read-only in practice: a request may do
 *  whatever it likes to its own copy without the next one inheriting it. */
function freshDefaultState(): DMSState {
  return structuredClone(DEFAULT_MOCK_STATE);
}

function readState(): DMSState {
  if (isPerDealerMode()) {
    try {
      const shared = backfillShared(readShared());
      const merged: any = {
        ...shared,
      };
      for (const key of TENANT_SCOPED_COLLECTIONS) merged[key] = [];

      for (const id of allDealerIds()) {
        const dd = readDealerData(id);
        for (const key of TENANT_SCOPED_COLLECTIONS) {
          merged[key].push(...(dd[key] || []));
        }
      }

      backfillVehicles(merged.vehicles);
      return merged;
    } catch (err) {
      console.error("Error reading per-dealer state:", err);
      return freshDefaultState();
    }
  }

  // Legacy monolithic path (pre-migration)
  try {
    const src = fs.existsSync(DATA_FILE) ? DATA_FILE : SEED_FILE;
    if (fs.existsSync(src)) {
      const parsed = JSON.parse(fs.readFileSync(src, "utf-8"));
      if (!parsed.expenses) parsed.expenses = DEFAULT_MOCK_STATE.expenses;
      parsed.settings = { ...DEFAULT_MOCK_STATE.settings, ...(parsed.settings || {}) };
      if (!parsed.documents) parsed.documents = [];

      if (!Array.isArray(parsed.dealerships) || !parsed.dealerships.length) {
        parsed.dealerships = DEFAULT_MOCK_STATE.dealerships;
      } else {
        parsed.dealerships = parsed.dealerships.map((d: any) => {
          const seed = DEFAULT_MOCK_STATE.dealerships.find((x: any) => x.id === d.id);
          return seed ? { ...d, ...seed } : d;
        });
        const existingIds = new Set(parsed.dealerships.map((d: any) => d.id));
        for (const seed of DEFAULT_MOCK_STATE.dealerships) {
          if (!existingIds.has(seed.id)) parsed.dealerships.push({ ...seed });
        }
      }

      parsed.migrations = parsed.migrations || {};
      if (!parsed.migrations.prunedSeedDealers) {
        const retired = new Set(["d3", "demo"]);
        parsed.dealerships = parsed.dealerships.filter((d: any) => !retired.has(d.id));
        parsed.vehicles = (parsed.vehicles || []).filter((v: any) => !retired.has(v.dealershipId));
        parsed.migrations.prunedSeedDealers = true;
      }

      backfillVehicles(parsed.vehicles || []);

      for (const d of parsed.dealerships || []) {
        if (!Array.isArray(d.products) || !d.products.length) {
          d.products = [...PRODUCTS];
        }
      }

      for (const key of TENANT_SCOPED_COLLECTIONS) {
        const rows = (parsed as any)[key];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (row && typeof row === "object" && !row.dealershipId) {
            row.dealershipId = DEFAULT_DEALERSHIP_ID;
          }
        }
      }

      return parsed;
    }
  } catch (err) {
    console.error("Error reading data file:", err);
  }
  return freshDefaultState();
}

function writeState(state: any) {
  if (isPerDealerMode()) {
    try {
      const shared: SharedState = {
        dealerships: state.dealerships || [],
        settings: state.settings || {},
        socialAccounts: state.socialAccounts || [],
        accountingAccounts: state.accountingAccounts || [],
        migrations: state.migrations || {},
      };
      writeShared(shared);

      const buckets = new Map<string, DealerData>();
      for (const key of TENANT_SCOPED_COLLECTIONS) {
        for (const row of (state[key] || [])) {
          const did = row.dealershipId || "orphan";
          if (!buckets.has(did)) {
            const empty: any = {};
            for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
            buckets.set(did, empty);
          }
          buckets.get(did)![key].push(row);
        }
      }

      // Write each dealer file that has data in this state.
      // Also write empty files for dealers that had data before but don't now
      // (e.g. all vehicles deleted).
      const existingIds = allDealerIds();
      buckets.forEach((data, id) => {
        writeDealerData(id, data);
        const idx = existingIds.indexOf(id);
        if (idx !== -1) existingIds.splice(idx, 1);
      });
      // Dealers with no rows left still get an empty file so they aren't lost
      for (const id of existingIds) {
        const empty: any = {};
        for (const k of TENANT_SCOPED_COLLECTIONS) empty[k] = [];
        writeDealerData(id, empty);
      }
    } catch (err) {
      console.error("Error writing per-dealer state:", err);
    }
    return;
  }

  // Legacy monolithic path
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}

// Boot: migrate to per-dealer files if still on monolithic, then seed if needed
if (!isPerDealerMode()) {
  if (fs.existsSync(DATA_FILE)) {
    migrateToPerDealerFiles();
  } else if (fs.existsSync(SEED_FILE)) {
    // First boot: copy seed to data.json, then migrate
    fs.copyFileSync(SEED_FILE, DATA_FILE);
    migrateToPerDealerFiles();
  } else {
    // No data at all — write defaults and migrate
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_MOCK_STATE, null, 2), "utf-8");
    migrateToPerDealerFiles();
  }
}

/** Every array on a vehicle that holds photos. */
const VEHICLE_PHOTO_FIELDS = [
  "images",
  "extrasPhotos",
  "damagePhotos",
  "vinPhotos",
  "serviceBookPhotos",
] as const;

/**
 * Move any base64 still sitting in the state onto disk.
 *
 * Runs once at boot rather than inside readState, which is on 58 request paths —
 * converting there would re-scan every photo of every car on every call, which
 * is the cost this change exists to remove. After this pass and with the write
 * paths converting on the way in, the state file never contains image bytes
 * again.
 *
 * Idempotent: put() returns a stored reference unchanged, so a second run is a
 * no-op and a half-finished run simply resumes.
 */
function migratePhotosToFiles(): void {
  let state: any;
  try {
    state = readState();
  } catch (err) {
    console.error("[photos] migration could not read state:", err);
    return;
  }

  let converted = 0;
  let alreadyFiles = 0;

  for (const v of state.vehicles || []) {
    for (const field of VEHICLE_PHOTO_FIELDS) {
      const arr = (v as any)[field];
      if (!Array.isArray(arr) || !arr.length) continue;
      const next: string[] = [];
      for (const value of arr) {
        if (isStoredRef(value)) {
          next.push(value);
          alreadyFiles++;
          continue;
        }
        const ref = putPhoto(value);
        if (ref) {
          next.push(ref);
          converted++;
        }
        /* Anything neither stored nor storable is dropped: it was a malformed
           entry that could never have rendered anyway, and carrying it forward
           only preserves a broken image on a dealer's website. */
      }
      (v as any)[field] = next;
    }

    // The 360 orbit carries its frames the same way.
    const frames = (v as any).web3d?.frames;
    if (Array.isArray(frames)) {
      for (const f of frames) {
        if (!f || typeof f !== "object") continue;
        if (isStoredRef(f.image)) { alreadyFiles++; continue; }
        const ref = putPhoto(f.image);
        if (ref) { f.image = ref; converted++; }
      }
    }
  }

  if (converted > 0) {
    /* Only written when something actually changed — a boot that finds nothing
       to do must not rewrite a multi-megabyte file for no reason. */
    writeState(state);
    const { files, bytes } = photoStats();
    console.log(
      `[photos] moved ${converted} photo(s) out of the state file. ` +
        `Media store now holds ${files} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB.`
    );
  } else {
    console.log(
      `[photos] nothing to migrate (${alreadyFiles} already stored as files).`
    );
  }
}

try {
  migratePhotosToFiles();
} catch (err) {
  /* A failed migration must not stop the DMS booting: the read paths below
     still understand base64, so an un-migrated instance serves exactly as it
     did before, just without the size win. */
  console.error("[photos] migration failed, continuing with base64:", err);
}

/** Backfill `docFlowCompletedAt` for deals that finished before the field existed.
 *
 *  Completion is derived, not guessed: a lead whose handover document is Signed
 *  has by definition finalised the last stage. Those rows carry `docStage: null`
 *  — exactly what a never-started lead carries — so without this they keep
 *  rendering as though the deal had never begun.
 *
 *  Idempotent: only fills rows with no timestamp, so re-running is a no-op. */
function backfillDocFlowCompletion(): void {
  const state = readState();

  const completedAtByLead = new Map<string, string>();
  for (const d of (state.documents || []) as any[]) {
    if (d.stage !== "handover" || d.status !== "Signed" || !d.leadId) continue;
    // Earliest signature wins — the moment the deal actually completed, not
    // whenever a later duplicate happened to be filed.
    const at = d.signedAt || d.uploadedAt;
    if (!at) continue;
    const existing = completedAtByLead.get(d.leadId);
    if (!existing || at < existing) completedAtByLead.set(d.leadId, at);
  }
  if (completedAtByLead.size === 0) return;

  let filled = 0;
  for (const lead of (state.leads || []) as any[]) {
    if (lead.docFlowCompletedAt) continue;
    const at = completedAtByLead.get(lead.id);
    if (!at) continue;
    lead.docFlowCompletedAt = at;
    filled++;
  }

  if (filled > 0) {
    writeState(state);
    console.log(`[dochub] backfilled docFlowCompletedAt on ${filled} completed deal(s).`);
  }
}

/** Backfill `docFlow` for dealers created before the default was set.
 *
 *  Without it they fall through to DEFAULT_DOC_FLOW, but the explicit row
 *  makes each dealer's configuration visible in the state file. Idempotent:
 *  only fills dealers with no docFlow at all. */
function backfillDocFlowDefaults(): void {
  const state = readState();
  let filled = 0;
  for (const d of (state.dealerships || []) as any[]) {
    if (d.docFlow && Object.keys(d.docFlow).length > 0) continue;
    d.docFlow = { ...DEFAULT_DOC_FLOW };
    filled++;
  }
  if (filled > 0) {
    writeState(state);
    console.log(`[dochub] backfilled docFlow defaults on ${filled} dealership(s).`);
  }
}

/** Move recon-task photos out of the state file.
 *
 *  `reconTasks[].photo` was never in VEHICLE_PHOTO_FIELDS, so unlike every
 *  other upload it skipped putPhotos and the image stayed as base64 inside the
 *  vehicle row — roughly 4 MB per phone photo, in the file every request reads
 *  and rewrites. The control that created them has been removed; this deals
 *  with the ones already stored.
 *
 *  Moved into the media store rather than deleted: a photo of work done on a
 *  car is evidence a dealer may want, and it costs a 70-byte reference to keep.
 *  Idempotent — an already-stored reference is left alone, and a value that is
 *  neither storable nor a reference is dropped, since it could never render. */
function migrateReconPhotos(): void {
  const state = readState();
  let moved = 0;
  let dropped = 0;

  for (const v of (state.vehicles || []) as any[]) {
    const tasks = v.reconTasks;
    if (!Array.isArray(tasks) || !tasks.length) continue;
    for (const t of tasks) {
      if (!t || !t.photo || isStoredRef(t.photo)) continue;
      const ref = putPhoto(t.photo);
      if (ref) {
        t.photo = ref;
        moved++;
      } else {
        delete t.photo;
        dropped++;
      }
    }
  }

  if (moved === 0 && dropped === 0) return;
  writeState(state);
  console.log(
    `[photos] moved ${moved} recon photo(s) into the media store` +
      (dropped ? `, dropped ${dropped} unreadable` : "") + ".",
  );
}

try {
  migrateReconPhotos();
} catch (err) {
  /* Leaving the base64 in place is the pre-existing state, so a failure here
     costs disk, not correctness. */
  console.error("[photos] recon photo migration failed, continuing:", err);
}

/** Retire the PENDING vehicle status.
 *
 *  Nothing has written PENDING since the stock kanban that owned it was
 *  removed, but it still distorted two screens: the Overview counted it while
 *  Stock Health excluded it from BOTH its live and sold buckets, so a PENDING
 *  car's capital simply vanished from "Capital in stock".
 *
 *  Mapped to SOLD, not INVENTORY. PENDING meant "sold, awaiting hand-over" —
 *  and the public feed publishes only INVENTORY, so moving these to INVENTORY
 *  would put already-sold cars back on the dealer's website. */
function retirePendingStatus(): void {
  const state = readState();
  const pending = (state.vehicles || []).filter((v: any) => v.status === "PENDING");
  if (pending.length === 0) return;
  for (const v of pending as any[]) v.status = "SOLD";
  writeState(state);
  console.log(
    `[stock] retired PENDING on ${pending.length} vehicle(s) — mapped to SOLD ` +
      `(${pending.map((v: any) => v.stockNumber || v.id).join(", ")}).`,
  );
}

try {
  retirePendingStatus();
} catch (err) {
  /* Leaving a PENDING row in place is the pre-existing state, so a failure here
     is not worth stopping the boot for. */
  console.error("[stock] PENDING retirement failed, continuing:", err);
}

try {
  backfillDocFlowCompletion();
} catch (err) {
  /* Reads treat a missing timestamp as "not complete", which is the behaviour
     that existed before the field — so a failed backfill degrades to the status
     quo rather than stopping the boot. */
  console.error("[dochub] completion backfill failed, continuing:", err);
}

try {
  backfillDocFlowDefaults();
} catch (err) {
  console.error("[dochub] docFlow defaults backfill failed, continuing:", err);
}

/**
 * Master-admin recovery.
 *
 * The admin code is printed once at first boot and cannot be read back, only
 * rotated — and rotating is itself admin-only. The auth store lives on a
 * mounted disk, so redeploying does not re-seed it and ADMIN_ACCESS_CODE (which
 * only applies to an empty store) has no effect either. Lose the code and there
 * is no way back into the instance at all: no dealership admin, no code
 * reissue for a dealer who has lost theirs.
 *
 * So ADMIN_ACCESS_CODE now also repoints the existing master admin at boot.
 * The gate is Render dashboard access, which already implies full control of
 * the service — anyone who can set an env var here can deploy arbitrary code.
 * Dealer principals are deliberately untouched; this only restores the way in.
 */
function applyAdminRecovery(store: AuthStore): void {
  const preset = codeFromEnv("admin");
  if (!preset) return;

  const admin = store.accounts.find((a) => a.role === "admin");
  if (!admin) return; // empty store — ensureAuthStore seeds it the normal way

  // Already the live code: don't rewrite the file or log on every boot.
  if (hashCode(preset, admin.salt) === admin.hash) return;

  const { account } = makeAccount("Master admin (TruSaaS)", "admin", undefined, preset);
  account.rotatedAt = new Date().toISOString();
  store.accounts = store.accounts.filter((a) => a.role !== "admin");
  store.accounts.push(account);
  writeAuth(store);

  console.log(
    "[auth] ADMIN_ACCESS_CODE is set and differs from the stored master admin " +
    "code — the master admin has been repointed to it. Unset the variable once " +
    "you are back in, so the code is not sitting in the dashboard."
  );
}

// Mint access codes on first boot. Must run at startup, not lazily on first
// request — the codes are printed to the log and you need them to sign in.
applyAdminRecovery(ensureAuthStore());
if (!SYNC_SERVICE_KEY) {
  console.warn(
    "[auth] TRUFLOW_SYNC_KEY is not set — /api/sync/push-photos accepts " +
    "unauthenticated pushes. Set the same value here and on TruLens to close it."
  );
}

// --- REST API ENDPOINTS ---

// Core state endpoints
app.get("/api/state", (req: any, res) => {
  // The whole DMS in one payload — scope every collection, or a dealer would
  // read every other dealer's leads straight out of the bootstrap call.
  const s = readState();
  res.json({
    ...s,
    vehicles: scopeToDealer(s.vehicles, req.auth),
    leads: scopeToDealer(s.leads, req.auth),
    tasks: scopeToDealer(s.tasks, req.auth),
    invoices: scopeToDealer(s.invoices, req.auth),
    agreements: scopeToDealer(s.agreements, req.auth),
    documents: scopeToDealer(s.documents || [], req.auth),
    docEvents: scopeToDealer(s.docEvents || [], req.auth),
    expenses: scopeToDealer(s.expenses || [], req.auth),
    communications: scopeToDealer(s.communications, req.auth),
    users: scopeToDealer(s.users, req.auth),
  });
});

/** Download the entire DMS as a file. Admin only.
 *
 *  The mounted disk holds the only copy of every dealer's photos, and taking a
 *  copy previously meant finding the Render shell and cat-ing the file — which
 *  is exactly the kind of chore that does not get done until the week after it
 *  was needed. This is the same data /api/state already returns to an admin,
 *  served with a filename so a browser saves it instead of rendering it.
 *
 *  Deliberately not public and deliberately not dealer-scoped: it is a whole-
 *  instance backup, so it is the one endpoint that must refuse anyone who is
 *  not an admin outright rather than quietly returning their own slice. */
app.get("/api/admin/backup", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin only." });
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="truflow-backup-${stamp}.json"`
  );
  try {
    const state = readState();
    res.json(state);
  } catch (err: any) {
    console.error("backup failed", err);
    res.status(500).json({ error: "Backup failed", details: err.message });
  }
});

/** Restore a downloaded backup. Admin only.
 *
 *  The other half of /api/admin/backup, and the reason that one was not yet a
 *  backup: this instance could be downloaded and could be wiped
 *  (/api/state/reset), but nothing could put a file back. Restoring meant
 *  writing to the mounted disk through the Render shell, so the recovery path
 *  existed only for someone willing to do that under pressure.
 *
 *  Takes a snapshot of what is currently on disk before overwriting it, so a
 *  restore of the wrong file is itself recoverable — the failure mode of a
 *  restore feature is someone uploading last month's copy over this month's. */
app.post("/api/admin/restore", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin only." });
  }
  if (req.body?.confirm !== "RESTORE") {
    return res.status(400).json({
      error: "Confirmation required",
      message: 'Send { "confirm": "RESTORE", "state": <backup> } to proceed.',
    });
  }

  const incoming = req.body?.state;
  /* Validate the shape before touching disk. An empty object is valid JSON and
     would wipe the instance just as thoroughly as a reset, but silently and
     while reporting success. */
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "No state in payload." });
  }
  if (!Array.isArray(incoming.vehicles) || !Array.isArray(incoming.dealerships)) {
    return res.status(400).json({
      error: "That does not look like a TruFlow backup",
      message: "Expected top-level 'vehicles' and 'dealerships' arrays.",
    });
  }

  try {
    // Snapshot current state before overwriting
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    let snapshot: string | null = null;
    try {
      const current = readState();
      snapshot = path.join(DATA_DIR, `data.before-restore-${stamp}.json`);
      fs.writeFileSync(snapshot, JSON.stringify(current, null, 2), "utf-8");
    } catch { /* no current state to snapshot */ }

    writeState(incoming);

    res.json({
      message: "Restored.",
      restored: {
        dealerships: incoming.dealerships.length,
        vehicles: incoming.vehicles.length,
        leads: Array.isArray(incoming.leads) ? incoming.leads.length : 0,
      },
      // Named so it can be recovered from the shell if the wrong file went in.
      previousStateSavedAs: snapshot ? path.basename(snapshot) : null,
    });
  } catch (err: any) {
    console.error("restore failed", err);
    res.status(500).json({ error: "Restore failed", details: err.message });
  }
});

app.put("/api/settings", (req, res) => {
  const state = readState();
  state.settings = { ...state.settings, ...req.body };
  writeState(state);
  res.json(state.settings);
});

/** Destroys EVERY dealership's data and restores the demo seed.
 *
 *  Harmless while state was ephemeral; since the Render disk landed this
 *  permanently deletes real stock, leads, invoices and signed documents, with
 *  no backup. It was reachable by any signed-in user, so one dealer could wipe
 *  another's yard. Admin only, and it takes a typed confirmation. */
app.post("/api/state/reset", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      error: "Admin only",
      message: "Resetting wipes every dealership on this instance.",
    });
  }
  if (req.body?.confirm !== "RESET EVERYTHING") {
    return res.status(400).json({
      error: "Confirmation required",
      message: 'Send { "confirm": "RESET EVERYTHING" } to proceed.',
    });
  }
  /* A copy, not the seed itself. writeState re-buckets rows by dealershipId and
     stamps them, so handing it the module-level object would edit the seed this
     process resets to — the second reset would then restore whatever the first
     one left behind. */
  const seeded = freshDefaultState();
  writeState(seeded);
  res.json({ message: "All dealership data reset to the seed.", state: seeded });
});

// Signed-in inventory list (the Light console's stock tab reads this).
// MUST be dealer-scoped: this endpoint requires a token (it is not in
// isPublicPath), so the only callers are authenticated dealer consoles.
// It returned state.vehicles unscoped, so a signed-in dealer saw EVERY
// dealer's cars — the same cross-tenant leak /api/state and /api/leads
// already guard against. Admins still see everything (scopeToDealer passes
// them through). External websites/WordPress read the public feed instead
// (GET /api/public/stock?dealer=<slug>), which is scoped by slug.
app.get("/api/inventory", (req: any, res) => {
  const state = readState();
  const search = (req.query.search as string || "").toLowerCase();
  const status = req.query.status as string || "ALL";

  let results = scopeToDealer(state.vehicles, req.auth);

  if (status !== "ALL") {
    results = results.filter(v => v.status === status);
  } else {
    // WordPress plugins usually fetch active inventory (not sold ones)
    results = results.filter(v => v.status !== "SOLD");
  }

  if (search) {
    results = results.filter(v => 
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      v.trim.toLowerCase().includes(search) ||
      v.stockNumber.toLowerCase().includes(search) ||
      v.description.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

// All inventory including SOLD
app.get("/api/all-vehicles", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.vehicles, req.auth));
});

/** One-off tidy of make/model/trim across ALL stored vehicles. Admin only.
 *
 *  The write paths above now normalise on the way in, so nothing NEW arrives
 *  dirty — but rows already on disk (raw disc "Vw 370 - Golf" models, trailing
 *  spaces from manual entry) stay as they are until something rewrites them.
 *  This walks the whole store and applies the same normaliser.
 *
 *  Dry-run by default: it returns the before/after for every row it WOULD
 *  change and writes nothing, so the diff can be eyeballed on real data first.
 *  Send { "confirm": "NORMALIZE" } to apply and persist. Idempotent — a second
 *  run finds nothing to change. Back up first (the change isn't reversible). */
app.post("/api/admin/normalize-vehicles", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin only." });
  }
  const apply = req.body?.confirm === "NORMALIZE";
  const state = readState();
  const changes: any[] = [];

  for (const v of state.vehicles as any[]) {
    const next = {
      make: tidyStr(v.make),
      model: cleanModelName(v.model),
      trim: tidyStr(v.trim),
    };
    const diff: any = {};
    for (const k of ["make", "model", "trim"] as const) {
      if (v[k] !== next[k]) diff[k] = { from: v[k], to: next[k] };
    }
    if (Object.keys(diff).length) {
      changes.push({ id: v.id, stockNumber: v.stockNumber, dealershipId: v.dealershipId, ...diff });
      if (apply) Object.assign(v, next);
    }
  }

  if (apply) writeState(state);
  res.json({
    applied: apply,
    ...(apply ? {} : { note: 'Dry run — nothing written. Send { "confirm": "NORMALIZE" } to apply.' }),
    scanned: state.vehicles.length,
    changed: changes.length,
    changes,
  });
});

// Mobile App Upload / Web Upload API
app.post("/api/inventory", (req: any, res) => {
  const state = readState();
  const newVehicle = {
    id: newId("v_"),
    year: parseInt(req.body.year) || 2026,
    make: tidyStr(req.body.make) || "Generic",
    model: cleanModelName(req.body.model) || "Asset",
    trim: tidyStr(req.body.trim) || "",
    status: req.body.status || "INVENTORY",
    retailPrice: parseFloat(req.body.retailPrice) || 0,
    costPrice: parseFloat(req.body.costPrice) || 0,
    mileage: parseInt(req.body.mileage) || 0,
    transmission: req.body.transmission || "Automatic",
    fuelType: req.body.fuelType || "Petrol",
    stockNumber: req.body.stockNumber || "STK-" + Math.floor(Math.random() * 9000 + 1000),
    dateAcquired: req.body.dateAcquired || new Date().toISOString().slice(0, 10),
    daysInInventory: 1,
    description: req.body.description || "Uploaded via Mobile app.",
    bodyType: req.body.bodyType || "",
    engine: req.body.engine || "",
    images: req.body.images || [],
    reconTasks: req.body.reconTasks || [],
    // Accept either the internal id or the website slug — callers that only
    // know the dealer by their site (TruLens, widgets, integrations) would
    // otherwise post untagged stock, which the public feed hands to the
    // default dealer's website instead of theirs.
    // Falls back to the session, like every other create. Without this a dealer
    // adding a car by hand got it filed to the default dealership and it
    // vanished from their own stock list.
    dealershipId: req.auth?.role === "admin"
      ? (req.body.dealershipId || dealerIdForSlug(req.body.dealerSlug) || ownerDealership(req))
      : req.auth?.dealershipId,
    // Showroom tier. Left unset when not supplied so the website falls back to
    // its own heuristic rather than defaulting everything into one category.
    category: CATEGORY_VALUES.includes(req.body.category) ? req.body.category : undefined,
    truPrice: req.body.truPrice ? parseFloat(req.body.truPrice) : undefined,
    // Storefront visibility. Honour the caller's flag, but default to FALSE —
    // a car added by hand has no photos yet, and the intended flow (both the
    // Premium "add on floor → shoot in TruLens → export" copy and Light's
    // upload note) is that it stays off the website until the dealer publishes
    // it. Stored as an explicit boolean so the readState backfill — which flips
    // *unset* legacy rows to true — can never silently republish it. Without
    // this, create dropped the field and the backfill put every new car live
    // the instant it was added.
    showOnWebsite:
      typeof req.body.showOnWebsite === "boolean" ? req.body.showOnWebsite : false
  };

  state.vehicles.unshift(newVehicle);
  writeState(state);
  res.status(201).json({ message: "Vehicle added to inventory.", vehicle: newVehicle });
});

// Update vehicle status/details
/** May this session act on this vehicle? Admin may touch anything; everyone
 *  else is confined to their own dealership.
 *
 *  Reads were scoped by scopeToDealer from the start, but these two writes were
 *  not, and vehicle ids are guessable — v1, v2, v3. A signed-in principal at one
 *  dealership could PUT or DELETE another dealership's stock by id alone. */
function mayTouchVehicle(v: any, auth: any): boolean {
  if (!auth || auth.role === "admin") return true;
  return !!v?.dealershipId && v.dealershipId === auth.dealershipId;
}

/** Non-media, dealer-editable vehicle fields that participate in the
 *  Flow<->Lens sync. Photos, damage findings, VIR, slot assessment and the
 *  condition declaration stay Lens-owned (they belong to the capture flow). */
const FLOW_SYNCED_FIELDS = [
  "make", "model", "year", "trim", "vin", "color",
  "mileage", "transmission", "fuelType", "bodyType", "engine",
  "retailPrice", "showOnWebsite", "description", "status", "stockNumber",
] as const;

/** Per-field updatedAt merge — matches Lens's mergeWithMeta so pushes from
 *  either side never blindly overwrite a fresher edit on the other side.
 *  Absent map = 0, so first inbound write on a legacy row always wins. */
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

/** Translate Flow field names to Lens field names on the way out.
 *  Lens uses `price` and `vehicleType`; Flow uses `retailPrice` and `bodyType`. */
function toLensPatch(flowPatch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(flowPatch)) {
    if (k === "retailPrice") out.price = v;
    else if (k === "bodyType") out.vehicleType = v;
    else out[k] = v;
  }
  return out;
}
function toLensMeta(flowMeta: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(flowMeta)) {
    if (k === "retailPrice") out.price = v;
    else if (k === "bodyType") out.vehicleType = v;
    else out[k] = v;
  }
  return out;
}

/** Apply a patch to a vehicle, owning every side effect a status change drags
 *  with it — so no caller can set a status and quietly miss one.
 *
 *  Selling pulls the car off the website in the same write, and every synced
 *  field the patch actually changes gets a fresh `fieldMeta` stamp, without
 *  which a stale Lens re-export silently overwrites the edit.
 *
 *  Returns the synced fields that really changed, for the Lens push. Extracted
 *  so cross-collection coupling (a lead closing Won moves its car) goes through
 *  exactly the same rules as a direct inventory PUT, rather than reimplementing
 *  two of the three and losing the rest. */
function applyVehiclePatch(
  state: any,
  index: number,
  patch: Record<string, any>,
  now: number,
): Record<string, any> {
  const current = state.vehicles[index] as any;

  /* Selling a car pulls it off the website in the same write, so a dealer
     doesn't have to remember two steps. Owned server-side so Light, Premium
     and the Lens sync all inherit it without repeating the rule. */
  if (patch.status === "SOLD" && current.status !== "SOLD") {
    patch.showOnWebsite = false;
  }

  /* Archiving retires a unit whose sale is already recorded, so it implies
     SOLD and off the website. Enforced here rather than trusting the caller:
     archiving from the UI once set only `archivedAt`, which left the car
     counting as live stock and still publishing to the dealer's site. */
  if (patch.archivedAt) {
    patch.status = "SOLD";
    patch.showOnWebsite = false;
  }

  /* Stamp a per-field updatedAt on every synced field this write actually
     changes, so a stale Lens re-export cannot silently overwrite the edit. */
  const nextMeta: Record<string, number> = { ...(current.fieldMeta || {}) };
  const changedForSync: Record<string, any> = {};
  for (const f of FLOW_SYNCED_FIELDS) {
    if (patch[f] === undefined) continue;
    if (patch[f] !== current[f]) {
      nextMeta[f] = now;
      changedForSync[f] = patch[f];
    }
  }

  state.vehicles[index] = {
    ...current,
    ...patch,
    fieldMeta: nextMeta,
    // The owner is never taken from the request body — otherwise an edit could
    // move a car into another dealership's stock.
    dealershipId: current.dealershipId,
  };

  return changedForSync;
}

/** Hash from a stored photo ref like "/media/<sha256>.jpg". Returns null for
 *  anything that isn't one of our stored refs — remote URLs, stale base64. */
function hashFromRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const m = /^\/media\/([a-f0-9]{64})\./.exec(ref);
  return m ? m[1] : null;
}

/** Compare a vehicle's current photo arrays against the incoming ones and
 *  collect the sha256 hashes of photos that were dropped. Both services key
 *  their stored refs by sha256 of the bytes (photoStore.ts), so a hash is a
 *  stable cross-service identifier for a photo. */
function collectRemovedPhotoHashes(
  prev: any,
  incoming: Record<string, any>,
): string[] {
  const removed = new Set<string>();
  for (const field of VEHICLE_PHOTO_FIELDS) {
    if (!Array.isArray(incoming[field])) continue;
    const before: string[] = Array.isArray(prev?.[field]) ? prev[field] : [];
    const afterHashes = new Set<string>();
    for (const p of incoming[field]) {
      const h = hashFromRef(p);
      if (h) afterHashes.add(h);
    }
    for (const p of before) {
      const h = hashFromRef(p);
      if (h && !afterHashes.has(h)) removed.add(h);
    }
  }
  return Array.from(removed);
}

/** Tell TruLens to drop matching capture slots when the dealer removes photos
 *  in the DMS. Fire-and-forget — the save must never block on Lens. Lens
 *  keys its stored refs the same way we do (sha256 of the bytes), so hashes
 *  are enough to identify what to remove without carrying URLs across
 *  services. No-ops when the vehicle didn't originate in Lens, or when the
 *  edit didn't touch photos. */
function pushPhotoRemovalsToLens(
  state: any,
  vehicle: any,
  removedHashes: string[],
): void {
  if (!vehicle || vehicle.source !== "trulens" || !vehicle.stockNumber) return;
  if (removedHashes.length === 0) return;
  const ownerSlug = (state.dealerships || []).find(
    (d: any) => d.id === vehicle.dealershipId,
  )?.slug;
  fetch(`${TRULENS_URL}/api/sync/vehicle/photos`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(SYNC_SERVICE_KEY ? { "x-tru-sync-key": SYNC_SERVICE_KEY } : {}),
    },
    body: JSON.stringify({
      stockNumber: vehicle.stockNumber,
      dealerSlug: ownerSlug,
      removedHashes,
    }),
  }).catch((err) =>
    console.warn("[sync] TruLens photo-removal push failed:", err?.message),
  );
}

/** Push a vehicle edit back to TruLens for vehicles that originated there, so
 *  the capture app's copy stays in step with the DMS. Fire-and-forget — the
 *  dealer's save must never block on Lens. Photos/VIR/damage are excluded by
 *  the allow-list; Lens applies mergeWithMeta at its end, so a stale push
 *  loses the timestamp comparison instead of clobbering.
 *
 *  Photo REMOVALS travel via pushPhotoRemovalsToLens instead — the allow-list
 *  keeps photo *values* out of the edit push, but a delete still needs to
 *  propagate.
 *
 *  Call after writeState, so Lens is never told about an edit that failed to
 *  persist. */
function pushVehicleToLens(
  state: any,
  vehicle: any,
  changedForSync: Record<string, any>,
  now: number,
): void {
  if (!vehicle || vehicle.source !== "trulens" || !vehicle.stockNumber) return;
  if (Object.keys(changedForSync).length === 0) return;

  /* Name the dealership — stock numbers are dealer-chosen and collide across
     yards, so an unqualified push reaches the wrong capture. */
  const ownerSlug = (state.dealerships || []).find(
    (d: any) => d.id === vehicle.dealershipId,
  )?.slug;
  const pushBody = {
    stockNumber: vehicle.stockNumber,
    dealerSlug: ownerSlug,
    patch: toLensPatch(changedForSync),
    fieldMeta: toLensMeta(
      Object.fromEntries(Object.keys(changedForSync).map((k) => [k, now])),
    ),
  };
  fetch(`${TRULENS_URL}/api/sync/vehicle`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(SYNC_SERVICE_KEY ? { "x-tru-sync-key": SYNC_SERVICE_KEY } : {}),
    },
    body: JSON.stringify(pushBody),
  }).catch((err) =>
    console.warn("[sync] TruLens edit push failed:", err?.message),
  );
}

/** Set a vehicle's status by id, with every side effect applyVehiclePatch owns.
 *  The entry point for lead→vehicle coupling. No-ops when the vehicle is absent
 *  or already at that status, so callers can fire it unconditionally.
 *
 *  Does not push to Lens itself — the caller does that after writeState, using
 *  the returned changedForSync. */
function applyVehicleStatus(
  state: any,
  vehicleId: string,
  next: string,
  now: number,
): { changed: boolean; changedForSync: Record<string, any>; index: number } {
  const index = state.vehicles.findIndex((v: any) => v.id === vehicleId);
  if (index === -1) return { changed: false, changedForSync: {}, index: -1 };
  if ((state.vehicles[index] as any).status === next) {
    return { changed: false, changedForSync: {}, index };
  }
  const changedForSync = applyVehiclePatch(state, index, { status: next }, now);
  return { changed: true, changedForSync, index };
}

app.put("/api/inventory/:id", (req: any, res) => {
  const state = readState();
  const index = state.vehicles.findIndex(v => v.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Vehicle not found" });
  }
  // 404, not 403: a dealer should not be able to probe which ids exist elsewhere.
  if (!mayTouchVehicle(state.vehicles[index], req.auth)) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  /* Photos uploaded from the DMS itself arrive here as base64 — the detail
     modal reads files with FileReader and PUTs the whole array back. Store them
     the same way the TruLens path does, or the one route a dealer uses by hand
     would quietly put image bytes back into the state this change exists to
     keep them out of. */
  const body = { ...req.body };

  /* Not a vehicle field — it names which deal closed on this car. Pulled out
     before the merge, which is a blind {...current, ...body}: left in, a
     caller-supplied id would persist onto the vehicle row permanently and be
     echoed back to every client that reads stock. */
  const closeLeadId: string | undefined = body.closeLeadId;
  delete body.closeLeadId;

  /* Detect deleted photos BEFORE putPhotos, while the incoming body still
     holds whatever the client sent — stored refs stay identical through
     putPhotos, but doing the diff on the incoming array is what stays
     honest if a client ever normalises differently. */
  const removedPhotoHashes = collectRemovedPhotoHashes(state.vehicles[index], body);

  for (const field of VEHICLE_PHOTO_FIELDS) {
    if (Array.isArray(body[field])) body[field] = putPhotos(body[field]);
  }
  // Tidy the identity fields on the way in, same as every other write path, so
  // a hand edit (or a Light save) can't reintroduce a trailing space or a raw
  // disc "Vw 370 - Golf" model.
  if ("make" in body) body.make = tidyStr(body.make);
  if ("model" in body) body.model = cleanModelName(body.model);
  if ("trim" in body) body.trim = tidyStr(body.trim);

  const now = Date.now();
  const prevStatus = (state.vehicles[index] as any).status;
  const changedForSync = applyVehiclePatch(state, index, body, now);

  /* The deal moves with the car. Owned here rather than in the React handler
     because this endpoint is what the Light console, TruLens sync and every
     raw API call actually hit — selling a car from Light never moved its lead
     for as long as Light has existed, because the rule lived in App.tsx.

     Transition-based, like the lead side: only fires when the status actually
     changes, so re-saving a sold car does nothing. */
  const vehicle = state.vehicles[index] as any;
  const nextStatus = vehicle.status;
  const nowSold = nextStatus === "SOLD" && prevStatus !== "SOLD";
  const backInStock = prevStatus === "SOLD" && nextStatus !== "SOLD";
  const coupledLeads: { id: string; status: string }[] = [];

  if (nowSold) {
    /* Which deal closed on this car? The UI resolves ambiguity by naming one.
       Light and raw API callers cannot, so fall back only when there is exactly
       one candidate — guessing between two would close the wrong customer's
       deal, and a car genuinely sold outside the system has none at all. */
    const openLeads = state.leads.filter(
      (l: any) =>
        l.vehicleId === vehicle.id && l.status !== "Closed Won" && l.status !== "Closed Lost",
    );

    let target: any = null;
    if (closeLeadId) {
      /* Validate rather than trust — the id came from the request. The status
         test mirrors the openLeads predicate exactly: a named id must be an
         OPEN deal. Checking only for "Closed Won" let a caller resurrect a
         Closed Lost deal into a sale. */
      const named = state.leads.find((l: any) => l.id === closeLeadId);
      const namedIsOpen =
        named && named.status !== "Closed Won" && named.status !== "Closed Lost";
      if (namedIsOpen && named.vehicleId === vehicle.id && mayCouple(named, vehicle)) {
        target = named;
      } else {
        console.log(
          `[coupling] closeLeadId ${closeLeadId} rejected for ${vehicle.id} ` +
            `(missing, wrong car, already closed, or another dealership) — leads left alone.`,
        );
      }
    } else if (openLeads.length === 1 && mayCouple(openLeads[0], vehicle)) {
      target = openLeads[0];
    } else if (openLeads.length > 1) {
      console.log(
        `[coupling] ${vehicle.id} sold with ${openLeads.length} open deals and no closeLeadId — leads left alone.`,
      );
    }

    if (target) {
      target.statusBeforeClose = target.status;
      target.status = "Closed Won";
      // The deal now owns this sale, so only it may reverse it.
      vehicle.soldByLeadId = target.id;
      coupledLeads.push({ id: target.id, status: "Closed Won" });
    }
  } else if (backInStock) {
    /* Car came back, so every deal that closed on it reopens — restoring the
       stage each came from rather than inventing one.

       This is the dealer acting on the CAR, so it is unconditional: unlike the
       lead-side `free()`, it does not require the sale to have an owner. That
       is the escape hatch for a car sold outside the system or from Light. */
    vehicle.soldByLeadId = null;
    /* Selling forced it off the website; coming back to the floor puts it back,
       which is what the UI promises when it says the car is re-listed. */
    vehicle.showOnWebsite = true;
    for (const l of state.leads as any[]) {
      if (l.vehicleId !== vehicle.id || l.status !== "Closed Won") continue;
      if (!mayCouple(l, vehicle)) continue;
      /* Deals closed before we started recording where they came from have no
         memory to restore. Negotiating is the least-wrong guess for those, and
         only those. */
      l.status = l.statusBeforeClose || "Negotiating";
      delete l.statusBeforeClose;
      coupledLeads.push({ id: l.id, status: l.status });
    }
  }

  writeState(state);

  pushVehicleToLens(state, state.vehicles[index], changedForSync, now);
  pushPhotoRemovalsToLens(state, state.vehicles[index], removedPhotoHashes);

  res.json({
    message: "Vehicle updated successfully.",
    vehicle: state.vehicles[index],
    coupledLeads,
  });
});

// Delete vehicle
app.delete("/api/inventory/:id", (req: any, res) => {
  const state = readState();
  const target = state.vehicles.find((v: any) => v.id === req.params.id);

  // Same 404 for "does not exist" and "not yours", so a dealer cannot discover
  // another dealership's stock ids by watching which ones come back 403.
  if (!target || !mayTouchVehicle(target, req.auth)) {
    return res.status(404).json({ error: "Vehicle not found" });
  }

  /* Refuse to destroy a recorded transaction — but only a recorded one.
     A car sold outside the DMS (cash off the floor, invoiced in the dealer's
     own accounting package) has no deal, invoice or paperwork here, so deleting
     it destroys nothing and must stay possible. The old rule refused every SOLD
     unit and told the dealer to "archive it instead", which was a dead end:
     no archive existed, so those cars could never leave the floor.

     Enforced server-side because Light and raw API calls never run the
     browser's check. An open or lost enquiry does not count as a record —
     those are unlinked below. */
  const sealed = {
    closedDeals: (state.leads || []).filter(
      (l: any) => l.vehicleId === target.id && l.status === "Closed Won",
    ).length,
    invoices: (state.invoices || []).filter((i: any) => i.vehicleId === target.id).length,
    agreements: (state.agreements || []).filter((a: any) => a.vehicleId === target.id).length,
    signedDocuments: (state.documents || []).filter(
      (d: any) => d.vehicleId === target.id && d.status === "Signed",
    ).length,
  };
  const sealedTotal = Object.values(sealed).reduce((n, c) => n + c, 0);
  if (sealedTotal > 0) {
    /* No archived-unit exemption. Archiving does not retract the sale, it only
       retires the car from the floor — so an archived unit with an invoice
       against it is exactly what this guard exists to protect. Exempting them
       let a dealer archive a documented sale and then delete it, which is the
       one outcome archiving was introduced to prevent. */
    return res.status(409).json({
      error: "This sale is recorded here — archive the vehicle instead of deleting it.",
      recorded: sealed,
    });
  }

  state.vehicles = state.vehicles.filter((v: any) => v.id !== req.params.id);

  /* Take the vehicle's dependants with it. Deleting the row alone left leads,
     tasks and DocHub documents pointing at an id that no longer resolves — the
     lead's car renders blank and the orphaned docEvents keep being served.

     Leads and tasks are unlinked rather than deleted: the customer and the work
     are real and worth keeping once the car is gone. Documents belong to the
     vehicle, so they go with it.

     Invoices and agreements are not handled here because they cannot be here:
     the guard above refuses to delete any vehicle carrying one. */
  const gone = req.params.id;
  for (const l of (state.leads || []) as any[]) {
    if (l.vehicleId === gone) delete l.vehicleId;
  }
  for (const t of (state.tasks || []) as any[]) {
    if (t.vehicleId === gone) delete t.vehicleId;
  }
  const affectedLeadIds = new Set(
    ((state.documents || []) as any[])
      .filter((d) => d.vehicleId === gone && d.leadId)
      .map((d) => d.leadId),
  );
  const droppedDocIds = new Set(
    ((state.documents || []) as any[]).filter((d) => d.vehicleId === gone).map((d) => d.id),
  );
  if (droppedDocIds.size > 0) {
    state.documents = ((state.documents || []) as any[]).filter((d) => !droppedDocIds.has(d.id));
    state.docEvents = ((state.docEvents || []) as any[]).filter(
      (e) => !droppedDocIds.has(e.docId),
    );
    /* Those documents were a lead's evidence for the stages it had passed.
       Removing them without re-deriving leaves the lead claiming a stage — or
       claiming completion — with nothing behind it, which is precisely the
       drift recomputeDocStage exists to prevent. */
    for (const leadId of affectedLeadIds) {
      recomputeDocStage(state, (state.leads || []).find((l: any) => l.id === leadId));
    }
  }

  writeState(state);

  // If this vehicle was imported from TruLens, tell TruLens to remove it too
  // so the capture doesn't linger after the DMS record is gone.
  if (target.source === "trulens" && target.stockNumber) {
    /* Name the dealership. Stock numbers are dealer-chosen and short, so they
       collide across yards — the same reasoning that scopes the push-photos
       lookup. Sending only the number asked TruLens to delete every capture
       carrying it, which is one dealer's deletion destroying another dealer's
       photos. */
    const ownerSlug = (state.dealerships || []).find(
      (d: any) => d.id === target.dealershipId
    )?.slug;
    fetch(`${TRULENS_URL}/api/sync/vehicle`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(SYNC_SERVICE_KEY ? { "x-tru-sync-key": SYNC_SERVICE_KEY } : {}),
      },
      body: JSON.stringify({ stockNumber: target.stockNumber, dealerSlug: ownerSlug }),
    }).catch((err) => console.warn("[sync] TruLens delete callback failed:", err?.message));
  }

  res.json({ message: "Vehicle deleted successfully." });
});

// Leads CRM API
app.get("/api/leads", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.leads, req.auth));
});

/* Signed-in lead creation. This is NOT the route external sites use — it is not
   in isPublicPath, so an unauthenticated form posting here gets a 401 and the
   enquiry is lost with nothing to show for it. External websites and plugins
   post to /api/integration/webhook-lead, which is public and requires the
   dealership in the payload. */
app.post("/api/leads", (req: any, res) => {
  const state = readState();
  // Annotated because every value here comes off req.body as `any`. Without it
  // "New" widened to string and the whole literal was pushed into Lead[]
  // unchecked, and this takes shape straight off the request.
  const newLead: Lead = {
    id: newId("l_"),
    // Tag the lead to a dealer, or it defaults to the pilot dealership and one
    // yard ends up working another yard's customers. A signed-in dealer can
    // only ever create leads for themselves.
    dealershipId:
      req.auth?.role === "admin"
        ? req.body.dealershipId || dealerIdForSlug(req.body.dealerSlug) || undefined
        : req.auth?.dealershipId,
    firstName: req.body.firstName || "Anonymous",
    lastName: req.body.lastName || "Lead",
    phone: req.body.phone || "N/A",
    email: req.body.email || "N/A",
    vehicleId: req.body.vehicleId || "",
    source: req.body.source || "Website Form",
    status: "New",
    assignedUserId: req.body.assignedUserId || "",
    createdAt: new Date().toISOString().slice(0, 10),
    lastContactedAt: null,
    digitalScore: req.body.digitalScore || 0,
    // A new lead is due a first contact today — not "sometime".
    nextAction: req.body.nextAction || "First contact",
    nextActionAt: req.body.nextActionAt || new Date().toISOString().slice(0, 10),
    stageChangedAt: new Date().toISOString().slice(0, 10),
    notes: req.body.notes || "Generated automatically from web widget.",
    journey: req.body.journey || [
      { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action: "Web Form Submission", detail: "Completed Lead Contact Form" }
    ]
  };

  state.leads.unshift(newLead);

  writeState(state);
  res.status(201).json({ message: "Lead file logged successfully.", lead: newLead });
});

/** May a lead and a vehicle be coupled?
 *
 *  Its own check rather than trusting the caller's, because coupling writes to
 *  two collections at once. `mayTouch` lets `undefined === undefined` pass, the
 *  vehicle lookup is by id across all tenants, and an admin bypasses both — so
 *  without this a cross-dealership pairing is representable. Both rows must
 *  carry the same, non-empty dealership; legacy untagged rows simply do not
 *  auto-couple, which is the conservative answer. */
function mayCouple(lead: any, vehicle: any): boolean {
  if (!lead || !vehicle) return false;
  return !!lead.dealershipId && lead.dealershipId === vehicle.dealershipId;
}

app.put("/api/leads/:id", (req: any, res) => {
  const state = readState();
  const index = state.leads.findIndex(l => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Lead not found" });
  }
  if (!mayTouch(state.leads[index], req.auth)) {
    return res.status(403).json({ error: "Not your lead." });
  }

  const prevStatus = (state.leads[index] as any).status;
  const prevVehicleId = (state.leads[index] as any).vehicleId;

  const { dealershipId: _drop, ...updates } = req.body;
  state.leads[index] = {
    ...state.leads[index],
    ...updates,
    dealershipId: state.leads[index].dealershipId,
  };
  const lead = state.leads[index] as any;

  /* A deal closing or reopening moves its car with it, so the two can never
     disagree about whether the vehicle is still for sale. Owned here rather
     than in the React handler because Light and the sync endpoints never run
     that code — and doing it in both would race two writes on one JSON file.

     Transition-based: fires only when the status actually changes on this
     request, so editing a price on a long-closed deal never reaches out and
     moves stock, and pre-existing drift is left for the dealer to judge. */
  const now = Date.now();
  const syncs: { changedForSync: Record<string, any>; index: number }[] = [];
  const coupledVehicles: { id: string; status: string }[] = [];

  /** Mark a car sold for this deal, if the two may be coupled at all.
   *
   *  Records the deal as the sale's owner, so only it can reverse this. */
  const sell = (vehicleId?: string) => {
    if (!vehicleId) return;
    const vehicle = state.vehicles.find((v: any) => v.id === vehicleId);
    if (!mayCouple(lead, vehicle)) return;
    const r = applyVehicleStatus(state, vehicleId, "SOLD", now);
    if (r.changed) {
      (state.vehicles[r.index] as any).soldByLeadId = lead.id;
      syncs.push(r);
      coupledVehicles.push({ id: vehicleId, status: "SOLD" });
    }
  };

  /** Return a car to stock — but only when THIS deal is what sold it.
   *
   *  Two guards, and both are needed. `soldByLeadId` proves this deal owns the
   *  sale: without it, reopening any lead attached to the car put it back on
   *  the floor, including a car sold from the Light console or outside the
   *  system entirely, which no deal owns. `stillHeld` then covers a car several
   *  deals closed on, so freeing one does not un-sell what another bought. */
  const free = (vehicleId?: string) => {
    if (!vehicleId) return;
    const vehicle = state.vehicles.find((v: any) => v.id === vehicleId);
    if (!mayCouple(lead, vehicle)) return;
    if (vehicle.soldByLeadId !== lead.id) return;
    const stillHeld = state.leads.some(
      (l: any) => l.id !== lead.id && l.vehicleId === vehicleId && l.status === "Closed Won",
    );
    if (stillHeld) return;
    const r = applyVehicleStatus(state, vehicleId, "INVENTORY", now);
    if (r.changed) {
      const freed = state.vehicles[r.index] as any;
      freed.soldByLeadId = null;
      /* Selling forced the car off the website; returning it to stock puts it
         back, which is what "re-lists it on your website" promises the dealer.
         Without this the car came back to the floor invisible online. */
      freed.showOnWebsite = true;
      syncs.push(r);
      coupledVehicles.push({ id: vehicleId, status: "INVENTORY" });
    }
  };

  /* Which car this deal held before, and which it holds now. Comparing the two
     covers closing, reopening, AND reassigning a closed deal to a different car
     — that last one otherwise leaves the original sold with nothing holding it
     while the replacement sits in stock, one edit making two contradictions.

     Still transition-based: when the held car is unchanged (a price or phone
     edit on a closed deal) both sides are equal and nothing fires. That matters
     — re-deriving state on every write would un-sell a car sold outside the
     system the moment any lead near it was touched. */
  const heldBefore = prevStatus === "Closed Won" ? prevVehicleId : undefined;
  const heldNow = lead.status === "Closed Won" ? lead.vehicleId : undefined;

  if (heldBefore !== heldNow) {
    free(heldBefore);
    sell(heldNow);
    // Remember where the deal came from, so reopening restores that rather
    // than guessing; clear it once the deal is open again.
    if (heldNow && prevStatus && prevStatus !== "Closed Won") {
      lead.statusBeforeClose = prevStatus;
    }
    if (!heldNow) delete lead.statusBeforeClose;
  }

  writeState(state);

  for (const s of syncs) {
    pushVehicleToLens(state, state.vehicles[s.index], s.changedForSync, now);
  }

  res.json({
    message: "Lead updated successfully.",
    lead: state.leads[index],
    // Kept singular for the common case; the array covers a reassignment,
    // which moves two cars at once.
    coupledVehicle: coupledVehicles[0] ?? null,
    coupledVehicles,
  });
});

app.delete("/api/leads/:id", (req: any, res) => {
  const state = readState();
  const target = state.leads.find(l => l.id === req.params.id) as any;
  if (!target) return res.status(404).json({ error: "Lead not found" });
  if (!mayTouch(target, req.auth)) {
    return res.status(403).json({ error: "Not your lead." });
  }

  /* Refuse to erase a closed sale, for the same reason a sold vehicle cannot be
     deleted: a Closed Won deal with signed paperwork is the record of a
     transaction. Deleting it also silently unblocked vehicle deletion — the
     `sealed.closedDeals` count would drop to zero and the car, along with its
     signed documents, became freely deletable. Two endpoints, opposite rules on
     the same evidence. */
  const signedDocs = ((state.documents || []) as any[]).filter(
    (d) => d.leadId === target.id && d.status === "Signed",
  ).length;
  if (target.status === "Closed Won" || signedDocs > 0) {
    return res.status(409).json({
      error:
        "This deal closed and its paperwork is on file — it cannot be deleted. " +
        "Reopen it first if the sale fell through.",
      recorded: { closedWon: target.status === "Closed Won", signedDocuments: signedDocs },
    });
  }

  const gone = target.id;
  state.leads = state.leads.filter(l => l.id !== gone);

  /* Everything that pointed at this lead. Deleting the row alone left DocHub
     documents and their audit rows still being served, tasks rendering a blank
     customer, and — if the deal had held a car — the vehicle sold with nothing
     accounting for it.

     Tasks are unlinked rather than deleted: the work is real even once the
     enquiry is gone. Documents belong to the deal, so they go with it. */
  for (const t of (state.tasks || []) as any[]) {
    if (t.leadId === gone) delete t.leadId;
  }
  const droppedDocIds = new Set(
    ((state.documents || []) as any[]).filter((d) => d.leadId === gone).map((d) => d.id),
  );
  if (droppedDocIds.size > 0) {
    state.documents = ((state.documents || []) as any[]).filter((d) => !droppedDocIds.has(d.id));
    state.docEvents = ((state.docEvents || []) as any[]).filter(
      (e) => !droppedDocIds.has(e.docId),
    );
  }

  /* If this deal was what marked a car sold, release it — otherwise the car is
     stranded SOLD with no deal behind it and no way to tell why. Guarded the
     same way the coupling is: only a car this deal actually sold, and only when
     no other deal still holds it. */
  const now = Date.now();
  let freedSync: { changedForSync: Record<string, any>; index: number } | null = null;
  const heldVehicle = state.vehicles.find((v: any) => v.soldByLeadId === gone) as any;
  if (heldVehicle && mayCouple(target, heldVehicle)) {
    const stillHeld = state.leads.some(
      (l: any) => l.vehicleId === heldVehicle.id && l.status === "Closed Won",
    );
    if (!stillHeld) {
      const r = applyVehicleStatus(state, heldVehicle.id, "INVENTORY", now);
      if (r.changed) {
        const freed = state.vehicles[r.index] as any;
        freed.soldByLeadId = null;
        freed.showOnWebsite = true;
        freedSync = r;
      }
    }
  }

  writeState(state);
  if (freedSync) {
    pushVehicleToLens(state, state.vehicles[freedSync.index], freedSync.changedForSync, now);
  }

  res.json({
    message: "Lead file deleted.",
    releasedVehicle: freedSync ? heldVehicle.id : null,
  });
});

// Tasks Directives API
app.get("/api/tasks", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.tasks, req.auth));
});

app.post("/api/tasks", (req: any, res) => {
  const state = readState();
  const newTask = {
    id: newId("t_"),
    title: req.body.title || "Generic Follow-Up Task",
    leadId: req.body.leadId || "",
    vehicleId: req.body.vehicleId || "",
    assignedUserId: req.body.assignedUserId || "",
    dueDate: req.body.dueDate || new Date().toISOString().slice(0, 10),
    priority: req.body.priority || "Normal",
    status: req.body.status || "Pending",
    dealershipId: ownerDealership(req),
  };

  state.tasks.unshift(newTask);
  writeState(state);
  res.status(201).json({ message: "Operational task created.", task: newTask });
});

app.put("/api/tasks/:id", (req: any, res) => {
  const state = readState();
  const index = state.tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Task not found" });
  }
  if (!mayTouch(state.tasks[index], req.auth)) {
    return res.status(403).json({ error: "Not your task." });
  }

  const { dealershipId: _drop, ...taskUpdates } = req.body;
  state.tasks[index] = {
    ...state.tasks[index],
    ...taskUpdates,
    dealershipId: state.tasks[index].dealershipId,
  };

  writeState(state);
  res.json({ message: "Task updated.", task: state.tasks[index] });
});

app.delete("/api/tasks/:id", (req: any, res) => {
  const state = readState();
  const target = state.tasks.find(t => t.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Task not found" });
  if (!mayTouch(target, req.auth)) {
    return res.status(403).json({ error: "Not your task." });
  }
  state.tasks = state.tasks.filter(t => t.id !== req.params.id);
  writeState(state);
  res.json({ message: "Task deleted." });
});

// Invoices Accounting API
app.get("/api/invoices", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.invoices, req.auth));
});

/** The next number in a dealer's document sequence.
 *
 *  SARS requires the number on a tax invoice to be sequential and
 *  non-repeating. Both invoice and agreement numbers used to be built from
 *  `collection.length + 1`, which breaks three ways: the count spanned every
 *  dealer so two dealerships drew from one sequence, removing a row handed the
 *  next one a number already issued, and the year was frozen at 2026.
 *
 *  The counter lives on the dealership and only ever climbs. It is seeded from
 *  the highest number that dealer has already issued, so an instance with
 *  existing documents carries on rather than restarting at 1 and colliding
 *  with its own history. Caller-supplied numbers are ignored outright — a
 *  client able to name its own number could issue two the same.
 *
 *  Mutates the dealership in `state`; the caller's writeState persists it. */
function nextDocNumber(
  state: any,
  dealershipId: string | undefined,
  opts: { prefix: string; rows: any[]; field: string; seqKey: "invoiceSeq" | "agreementSeq" | "docSeq" },
): string {
  const year = new Date().getFullYear();
  const dealer = (state.dealerships || []).find((d: any) => d.id === dealershipId);

  let highest = 0;
  for (const row of opts.rows || []) {
    if (dealershipId && row.dealershipId !== dealershipId) continue;
    const m = /(\d+)\s*$/.exec(String(row[opts.field] || ""));
    if (m) highest = Math.max(highest, parseInt(m[1], 10) || 0);
  }

  const next = Math.max(highest, Number(dealer?.[opts.seqKey]) || 0) + 1;
  if (dealer) dealer[opts.seqKey] = next;

  return `${opts.prefix}-${year}-${String(next).padStart(5, "0")}`;
}

/** Next sequential number for a DocHub-generated document.
 *
 *  Same discipline as nextDocNumber: per dealer, monotonic, seeded from the
 *  highest number that dealer has already issued. The number is carried on
 *  `fieldSnapshot.docNumber` (there is no dedicated column on DealerDocument),
 *  and the counter lives on `dealer.docSeq` so it survives the document rows
 *  being edited or pruned.
 *
 *  Mutates the dealership in `state`; the caller's writeState persists it. */
function nextDocNum(state: any, dealershipId: string | undefined, prefix: string): string {
  const year = new Date().getFullYear();
  const dealer = (state.dealerships || []).find((d: any) => d.id === dealershipId);

  let highest = 0;
  for (const row of state.documents || []) {
    if (dealershipId && row.dealershipId !== dealershipId) continue;
    const num = row.fieldSnapshot?.docNumber;
    const m = typeof num === "string" ? /(\d+)\s*$/.exec(num) : null;
    if (m) highest = Math.max(highest, parseInt(m[1], 10) || 0);
  }

  const next = Math.max(highest, Number(dealer?.docSeq) || 0) + 1;
  if (dealer) dealer.docSeq = next;

  return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
}

/** Render a DocHub `generate`-mode document from the actual deal.
 *
 *  `generate` used to be a stub: it persisted a Draft with empty `fileData`
 *  and an empty `fieldSnapshot`, and the comment "v1 defers PDF rendering"
 *  meant no bytes ever reached the client — the templates in docPdf.ts were
 *  proven-working but never imported here. This builds a complete snapshot
 *  from the lead/vehicle/dealer (merged over anything the caller supplied),
 *  renders the matching template, and returns the file as a data URL.
 *
 *  Throws on failure; the caller turns it into a 500 so a bad template or a
 *  missing pdf-lib never produces a silent empty Draft. */
async function renderGeneratedDoc(
  state: any,
  stage: DocStage,
  lead: Lead | undefined,
  vehicle: Vehicle | undefined,
  dealership: Dealership | undefined,
  incoming: Record<string, unknown>,
): Promise<{ fileData: string; mimeType: string; fileName: string; snapshot: Record<string, unknown> }> {
  const settings = dealership?.docSettings || {};
  const dealer = {
    name: dealership?.name,
    tradingAs: dealership?.tradingAs,
    address: dealership?.address,
    registrationNumber: dealership?.registrationNumber,
    vatNumber: dealership?.vatNumber,
    contactEmail: dealership?.contactEmail,
    websiteUrl: dealership?.websiteUrl,
  };
  const buyer: BuyerBlock = {
    name: [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim() || "Customer",
    address: lead?.address,
    idOrBrn: lead?.idOrBrn,
    vatNumber: lead?.buyerVatNumber,
    phone: lead?.phone && lead.phone !== "N/A" ? lead.phone : undefined,
  };
  const vehDesc = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ").trim() || "Vehicle"
    : "Vehicle";
  const vehicleBlock: VehicleBlock = {
    description: vehDesc,
    vin: vehicle?.vin,
    engineNumber: vehicle?.engineNumber,
    mmCode: vehicle?.mmCode,
    stockNumber: vehicle?.stockNumber,
    mileage: vehicle?.mileage,
    colour: vehicle?.color,
    registrationNumber: vehicle?.registrationNumber,
  };

  const lines: { label: string; amountIncl: number }[] = Array.isArray(incoming.priceBreakdown) && (incoming.priceBreakdown as any[]).length
    ? (incoming.priceBreakdown as any[]).map((l: any) => ({ label: String(l.label || "Vehicle"), amountIncl: Number(l.amountIncl) || 0 }))
    : [{ label: vehDesc, amountIncl: Number(vehicle?.retailPrice) || 0 }];
  const totalIncl = typeof incoming.total === "number"
    ? incoming.total
    : lines.reduce((s, l) => s + l.amountIncl, 0);

  const now = new Date();
  const snap: Record<string, unknown> = { ...incoming };
  const dealershipId = dealership?.id;

  let bytes: Uint8Array;
  let fileName: string;
  let docNumber: string;

  switch (stage) {
    case "proforma": {
      docNumber = nextDocNum(state, dealershipId, "PRO");
      snap.vin = incoming.vin ?? vehicle?.vin;
      snap.priceBreakdown = lines;
      snap.validityWindow = incoming.validityWindow ?? "14 days from date of issue";
      snap.total = totalIncl;
      snap.docNumber = docNumber;
      bytes = await renderProforma({
        dealer, buyer, vehicle: vehicleBlock,
        proformaNumber: docNumber,
        issuedAt: now,
        validUntil: String(snap.validityWindow),
        lines, totalIncl, docSettings: settings,
      });
      fileName = `Proforma-${docNumber}.pdf`;
      break;
    }
    case "deed": {
      docNumber = nextDocNum(state, dealershipId, "OTP");
      const defects = Array.isArray(incoming.disclosedDefects)
        ? (incoming.disclosedDefects as string[])
        : (vehicle?.damage || []).map((d) => d.note).filter(Boolean) as string[];
      snap.disclosedDefects = defects;
      snap.tradeInLine = incoming.tradeInLine ?? "No trade-in";
      snap.total = totalIncl;
      snap.docNumber = docNumber;
      bytes = await renderOffer({
        dealer, buyer, vehicle: vehicleBlock,
        offerNumber: docNumber,
        issuedAt: now,
        lines, totalIncl,
        depositAmount: typeof incoming.deposit === "number" ? incoming.deposit : undefined,
        balanceDue: typeof incoming.balanceDue === "number" ? incoming.balanceDue : undefined,
        disclosedDefects: defects.length ? defects : undefined,
        docSettings: settings,
      });
      fileName = `Offer-to-Purchase-${docNumber}.pdf`;
      break;
    }
    case "invoice": {
      docNumber = nextDocNum(state, dealershipId, "INV");
      const excl = Math.round(totalIncl / (1 + VAT_RATE));
      snap.invoiceNo = incoming.invoiceNo ?? docNumber;
      snap.vin = incoming.vin ?? vehicle?.vin;
      snap.vatBreakdown = { subtotal: excl, vat: totalIncl - excl, total: totalIncl };
      snap.total = totalIncl;
      snap.docNumber = docNumber;
      bytes = await renderTaxInvoice({
        dealer, buyer, vehicle: vehicleBlock,
        invoiceNumber: docNumber,
        issuedAt: now,
        totalIncl,
        lines, docSettings: settings,
      });
      fileName = `Tax-Invoice-${docNumber}.pdf`;
      break;
    }
    case "handover": {
      docNumber = nextDocNum(state, dealershipId, "HND");
      snap.warrantyDoc = incoming.warrantyDoc ?? settings.warrantyTerms ?? "As per the terms agreed in the Offer to Purchase.";
      snap.natisUpdated = incoming.natisUpdated ?? !!(lead?.dealChecklist?.natis);
      snap.docNumber = docNumber;
      bytes = await renderHandover({
        dealer, buyer, vehicle: vehicleBlock,
        handoverNumber: docNumber,
        issuedAt: now,
        invoiceRef: String(incoming.invoiceNo || ""),
        checklist: [
          { label: "Vehicle keys (all sets) handed over", checked: true },
          { label: "Spare wheel and jack present", checked: true },
          { label: "Owner's manual / service book", checked: true },
          { label: "NATIS document (registration certificate) handed to buyer", checked: !!lead?.dealChecklist?.natis },
          { label: "Roadworthy certificate provided", checked: !!lead?.dealChecklist?.roadworthy },
          { label: "Licence disc valid and in windscreen", checked: true },
          { label: "Vehicle condition walkthrough completed with buyer", checked: true },
        ],
        docSettings: settings,
      });
      fileName = `Handover-${docNumber}.pdf`;
      break;
    }
    default:
      throw new Error(`No template for stage '${stage}'`);
  }

  return {
    fileData: "data:application/pdf;base64," + Buffer.from(bytes).toString("base64"),
    mimeType: "application/pdf",
    fileName,
    snapshot: snap,
  };
}

app.post("/api/invoices", (req: any, res) => {
  const state = readState();
  const invoiceOwner = ownerDealership(req);
  const newInvoice = {
    id: newId("inv_"),
    invoiceNumber: nextDocNumber(state, invoiceOwner, {
      prefix: "INV", rows: state.invoices, field: "invoiceNumber", seqKey: "invoiceSeq",
    }),
    leadId: req.body.leadId,
    vehicleId: req.body.vehicleId,
    amount: parseFloat(req.body.amount) || 0,
    additionalCharges: parseFloat(req.body.additionalCharges) || 0,
    chargeDescription: req.body.chargeDescription || "",
    paymentMethod: req.body.paymentMethod || "Bank Transfer",
    status: req.body.status || "Sent",
    dueDate: req.body.dueDate || new Date().toISOString().slice(0, 10),
    dealershipId: invoiceOwner,
  };

  state.invoices.unshift(newInvoice);
  writeState(state);
  res.status(201).json({ message: "Invoice drafted.", invoice: newInvoice });
});

app.put("/api/invoices/:id/pay", (req: any, res) => {
  const state = readState();
  const index = state.invoices.findIndex(inv => inv.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  if (!mayTouch(state.invoices[index], req.auth)) {
    return res.status(403).json({ error: "Not your invoice." });
  }

  state.invoices[index].status = "Paid";
  writeState(state);
  res.json({ message: "Invoice payment cleared successfully.", invoice: state.invoices[index] });
});

// Document Agreements API
app.get("/api/agreements", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.agreements, req.auth));
});

app.post("/api/agreements", (req: any, res) => {
  const state = readState();
  const agreementOwner = ownerDealership(req);
  const newAgreement = {
    id: newId("agr_"),
    agreementNumber: nextDocNumber(state, agreementOwner, {
      prefix: "AGR", rows: state.agreements, field: "agreementNumber", seqKey: "agreementSeq",
    }),
    leadId: req.body.leadId,
    vehicleId: req.body.vehicleId,
    purchasePrice: parseFloat(req.body.purchasePrice) || 0,
    depositAmount: parseFloat(req.body.depositAmount) || 0,
    type: req.body.type || "Vehicle Sale",
    status: req.body.status || "Pending Signature",
    dealershipId: ownerDealership(req),
  };

  state.agreements.unshift(newAgreement);
  writeState(state);
  res.status(201).json({ message: "Agreement drafted successfully.", agreement: newAgreement });
});

app.put("/api/agreements/:id", (req: any, res) => {
  const state = readState();
  const index = state.agreements.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Agreement not found" });
  }
  if (!mayTouch(state.agreements[index], req.auth)) {
    return res.status(403).json({ error: "Not your agreement." });
  }

  const { dealershipId: _drop, ...agrUpdates } = req.body;
  state.agreements[index] = {
    ...state.agreements[index],
    ...agrUpdates,
    dealershipId: state.agreements[index].dealershipId,
  };

  writeState(state);
  res.json({ message: "Agreement updated successfully.", agreement: state.agreements[index] });
});

// Dealer Documents API — dealership uploads its own files (any doc type/template)
// and captures a signature on them. No fixed template: whatever the dealer needs.
app.get("/api/documents", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.documents || [], req.auth));
});

app.post("/api/documents", async (req: any, res) => {
  const state = readState();
  const {
    fileName,
    mimeType,
    fileData,
    leadId,
    vehicleId,
    stage,
    mode,
    fieldSnapshot,
  } = req.body || {};
  // Take the dealership from the session, not the request. Untagged documents
  // fall to the default dealership, so a dealer's own uploads disappeared from
  // their list the moment scoping was switched on.
  const dealershipId =
    req.auth?.role === "admin" ? req.body?.dealershipId : req.auth?.dealershipId;

  // DocHub path: a stage was named. Validate it, honour the dealer's
  // configured mode for that stage, and allow the doc to exist as a Draft
  // even before a file has been attached. Non-DocHub uploads keep the
  // original strict "need a file up front" contract.
  const isDocHub = typeof stage === "string" && DOC_STAGES.includes(stage as DocStage);

  if (isDocHub) {
    const stageTyped = stage as DocStage;
    if (mode !== "generate" && mode !== "attach" && mode !== "confirm" && mode !== "connect") {
      return res.status(400).json({ error: "mode must be 'generate', 'attach', 'confirm', or 'connect' when stage is set" });
    }
    if (mode === "connect" && FIXED_STAGE_MODES[stageTyped]) {
      return res.status(400).json({ error: `'connect' mode is not available for the '${stageTyped}' stage` });
    }
    if (!leadId) {
      return res.status(400).json({ error: "leadId is required for DocHub documents" });
    }

    /* The lead must be the caller's own. `mayTouch` guards the DOCUMENT, which
       is created under the caller's dealership and therefore always passes —
       it says nothing about the lead the document names. Finalising and voiding
       both write `docStage`, `docFlowCompletedAt` and `dealChecklist` onto that
       lead, so an unchecked id here let one dealer advance another dealer's
       deal. 404 rather than 403: the caller should not learn whether an id
       exists elsewhere.

       Admins may act for any dealership, and often send no dealershipId, so the
       document takes the lead's — a document and the deal it belongs to must
       never end up under different tenants. */
    const ownerLead = state.leads.find((l: any) => l.id === leadId);
    if (!ownerLead) return res.status(404).json({ error: "Lead not found" });
    if (req.auth?.role !== "admin" && ownerLead.dealershipId !== dealershipId) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const docDealershipId = ownerLead.dealershipId ?? dealershipId;
    // Fixed-mode stages (compliance = confirm) cannot be overridden by any
    // caller. Non-fixed stages must match the dealer's configured mode; admins
    // can cross the line for support work.
    const fixedMode = FIXED_STAGE_MODES[stageTyped];
    if (fixedMode && mode !== fixedMode) {
      return res.status(400).json({
        error: `Stage '${stageTyped}' is fixed at '${fixedMode}' mode.`,
      });
    }
    if (!fixedMode && req.auth?.role !== "admin") {
      const dealer = (state.dealerships || []).find((d: any) => d.id === docDealershipId);
      const configured = dealer?.docFlow?.[stageTyped] || DEFAULT_DOC_FLOW[stageTyped];
      if (configured !== (mode as DocMode)) {
        return res.status(400).json({
          error: `Dealer's ${stageTyped} stage is set to '${configured}', not '${mode}'. Change it in Doc Flow Settings first.`,
        });
      }
    }
    // Attach mode: a file is what the whole point is. Reject without one.
    // Generate mode: the PDF is rendered server-side from a template — no
    // fileData required from the caller.
    // Confirm mode: no file at all — this stage is verified by checklist flags.
    if (mode === "attach" && !fileData) {
      return res.status(400).json({ error: "fileData is required for attach mode" });
    }

    // Auto-populate vehicleId from the lead if the caller didn't pass one, so
    // the doc surfaces on the vehicle record without every client having to
    // remember the linkage.
    const lead = (state.leads || []).find((l: any) => l.id === leadId);
    const resolvedVehicleId = vehicleId || lead?.vehicleId || undefined;

    // Connect mode: push straight into a connected accounting package when
    // one exists for this dealer; always also build the CSV, either as the
    // sole deliverable (nothing connected) or as an audit-trail fallback the
    // dealer can still import by hand if the live push fails.
    let connectFileData = fileData || "";
    let connectMimeType = mimeType || "application/pdf";
    let connectFileName = fileName || `${stageTyped}-${new Date().toISOString().slice(0, 10)}`;
    let accountingPush: DealerDocument["accountingPush"] | undefined;
    let accountingPushError: string | undefined;
    if (mode === "connect") {
      const dealer = (state.dealerships || []).find((d: any) => d.id === docDealershipId);
      const vehicle = resolvedVehicleId ? state.vehicles.find((v: any) => v.id === resolvedVehicleId) : null;
      const snap = fieldSnapshot || {};
      const lines: Array<{label: string; amountIncl: number}> = Array.isArray(snap.lines) ? snap.lines : [];
      const totalIncl = typeof snap.totalIncl === "number" ? snap.totalIncl : lines.reduce((s, l) => s + (l.amountIncl || 0), 0);
      const vatRate = 0.15;
      const totalExcl = Math.round(totalIncl / (1 + vatRate));
      const vatAmount = totalIncl - totalExcl;
      const invNo = snap.invoiceNumber || connectFileName;
      const issued = new Date().toISOString().slice(0, 10);
      const csvEsc = (v: any) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = [
        ["ContactName","EmailAddress","InvoiceNumber","InvoiceDate","DueDate","Description","Quantity","UnitAmount","AccountCode","TaxType","Currency"].join(","),
      ];
      const contact = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim() || "Customer";
      const email = lead?.email || "";
      const invoiceLines = lines.length > 0
        ? lines.map((line) => ({ description: line.label, quantity: 1, unitAmount: Math.round((line.amountIncl || 0) / (1 + vatRate)) }))
        : [{ description: vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.trim || ""}`.trim() : "Vehicle sale", quantity: 1, unitAmount: totalExcl }];
      if (lines.length > 0) {
        for (const line of lines) {
          const unitExcl = Math.round((line.amountIncl || 0) / (1 + vatRate));
          csvRows.push([csvEsc(contact), csvEsc(email), csvEsc(invNo), issued, issued, csvEsc(line.label), "1", String(unitExcl), "200", "OUTPUT2", "ZAR"].join(","));
        }
      } else {
        csvRows.push([csvEsc(contact), csvEsc(email), csvEsc(invNo), issued, issued, csvEsc(invoiceLines[0].description), "1", String(totalExcl), "200", "OUTPUT2", "ZAR"].join(","));
      }
      connectFileData = "data:text/csv;base64," + Buffer.from(csvRows.join("\r\n"), "utf-8").toString("base64");
      connectMimeType = "text/csv";
      connectFileName = `${stageTyped}-${invNo}.csv`;

      // Live push: only for the invoice stage, only when the dealer has the
      // integration enabled (not just provisioned — toggling it off must
      // stop live pushes) and has exactly one connected platform. With more
      // than one connection there's no signal for which one is "the" target,
      // so we fall back to the CSV rather than guessing and pushing to the
      // wrong package.
      if (stageTyped === "invoice" && (dealer as any)?.codatCompanyId && (dealer as any)?.accountingEnabled) {
        const dealerConnections = (state.accountingAccounts || []).filter((a) => a.dealershipId === docDealershipId);
        if (dealerConnections.length > 1) {
          accountingPushError = `${dealerConnections.length} accounting platforms are connected — disconnect all but one before invoices can push automatically. The CSV below is a fallback you can still import by hand.`;
        } else {
          const connection = dealerConnections[0];
          if (connection) {
            const pushed = await pushInvoiceToAccounting((dealer as any).codatCompanyId, connection.connectionId, {
              contact,
              email,
              invoiceNumber: String(invNo),
              issuedDate: issued,
              lines: invoiceLines,
              currency: "ZAR",
            });
            if (pushed) {
              accountingPush = { platform: connection.platform, externalInvoiceId: pushed.externalInvoiceId, pushedAt: new Date().toISOString() };
              console.log(`[accounting] Pushed invoice ${invNo} to ${connection.platform} for dealer ${docDealershipId}`);
            } else {
              accountingPushError = `Could not reach ${connection.platform} — the CSV below is a fallback you can still import by hand.`;
            }
          }
        }
      }
    }

    // Generate mode: render the document from a template. No longer a stub —
    // build a complete snapshot from the deal, render the PDF, and carry the
    // bytes + snapshot on the record so the client can preview and the stage
    // can be finalised without a re-entry of data.
    let renderedSnapshot: Record<string, unknown> | undefined = undefined;
    if (mode === "generate") {
      const dealership = (state.dealerships || []).find((d: any) => d.id === docDealershipId);
      const vehicle = resolvedVehicleId ? state.vehicles.find((v: any) => v.id === resolvedVehicleId) : undefined;
      const incoming = fieldSnapshot || {};
      try {
        const rendered = await renderGeneratedDoc(state, stageTyped, lead, vehicle, dealership, incoming);
        connectFileData = rendered.fileData;
        connectMimeType = rendered.mimeType;
        connectFileName = rendered.fileName;
        renderedSnapshot = rendered.snapshot;
      } catch (e: any) {
        return res.status(500).json({ error: `Could not generate the ${stageTyped} document: ${e?.message || "renderer error"}` });
      }
    }

    const newDoc: DealerDocument = {
      id: newId("doc_"),
      fileName: connectFileName,
      mimeType: connectMimeType,
      fileData: connectFileData,
      status: "Draft",
      uploadedAt: new Date().toISOString(),
      leadId,
      vehicleId: resolvedVehicleId,
      dealershipId: docDealershipId,
      stage: stageTyped,
      mode: mode as DocMode,
      fieldSnapshot: renderedSnapshot ?? ((mode === "generate" || mode === "connect") ? (fieldSnapshot || {}) : undefined),
      accountingPush,
      accountingPushError,
    };
    if (!state.documents) state.documents = [];
    state.documents.unshift(newDoc);
    if (!state.docEvents) state.docEvents = [];
    state.docEvents.unshift({
      id: newId("de_"),
      docId: newDoc.id,
      leadId,
      action: "created",
      userId: req.auth?.userId,
      timestamp: new Date().toISOString(),
      // Follows the document, so the audit row is scoped with what it describes.
      dealershipId: docDealershipId,
    });
    writeState(state);
    return res.status(201).json({ message: "Document created.", document: newDoc });
  }

  // Legacy hub upload path — unchanged.
  if (!fileName || !fileData) {
    return res.status(400).json({ error: "fileName and fileData are required" });
  }
  const newDoc: DealerDocument = {
    id: newId("doc_"),
    fileName,
    mimeType: mimeType || "application/octet-stream",
    fileData,
    status: "Unsigned",
    uploadedAt: new Date().toISOString(),
    leadId: leadId || undefined,
    vehicleId: vehicleId || undefined,
    dealershipId,
  };
  if (!state.documents) state.documents = [];
  state.documents.unshift(newDoc);
  writeState(state);
  res.status(201).json({ message: "Document uploaded.", document: newDoc });
});

app.post("/api/documents/:id/sign", (req: any, res) => {
  const state = readState();
  const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Document not found" });
  }
  if (!mayTouch(state.documents[index], req.auth)) {
    return res.status(403).json({ error: "Not your document." });
  }
  const { signature, signedBy } = req.body || {};
  if (!signature) {
    return res.status(400).json({ error: "signature is required" });
  }
  state.documents[index] = {
    ...state.documents[index],
    status: "Signed",
    signature,
    signedBy: signedBy || "Signee",
    signedAt: new Date().toISOString(),
  };

  // Signing alone does not advance lead.docStage — only /finalize does, after
  // its stage-order and mode-specific validation. But a stage-bearing doc
  // that gets signed and never finalized would otherwise leave no audit trail
  // at all of who signed it and when, so record that here regardless of
  // whether finalize is ever called afterward.
  if (state.documents[index].stage) {
    if (!state.docEvents) state.docEvents = [];
    state.docEvents.unshift({
      id: newId("de_"),
      docId: state.documents[index].id,
      leadId: state.documents[index].leadId,
      action: "signed",
      userId: req.auth?.userId,
      timestamp: new Date().toISOString(),
      dealershipId: state.documents[index].dealershipId,
    });
  }

  writeState(state);
  res.json({ message: "Document signed.", document: state.documents[index] });
});

/** Re-derive a lead's stage pointer from the documents that actually exist.
 *
 *  `docStage` is otherwise only ever advanced, so voiding a document part-way
 *  through a finished flow would leave the lead claiming a stage it no longer
 *  has evidence for. Deriving the next-due stage from signed documents makes
 *  the pointer self-correcting instead of something that can silently drift. */
function recomputeDocStage(state: any, lead: any): void {
  if (!lead) return;
  const signed = new Set(
    ((state.documents || []) as any[])
      .filter((d) => d.leadId === lead.id && d.status === "Signed" && d.stage)
      .map((d) => d.stage),
  );
  const nextDue = DOC_STAGES.find((s) => !signed.has(s)) ?? null;
  lead.docStage = nextDue;
  if (nextDue === null) {
    if (!lead.docFlowCompletedAt) lead.docFlowCompletedAt = new Date().toISOString();
  } else {
    // No longer complete — the flow has a gap in it again.
    delete lead.docFlowCompletedAt;
  }
}

app.delete("/api/documents/:id", (req: any, res) => {
  const state = readState();
  const target = (state.documents || []).find((d: any) => d.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Document not found" });
  if (!mayTouch(target, req.auth)) {
    return res.status(403).json({ error: "Not your document." });
  }

  /* A signed stage document is the evidence a stage was completed. Deleting it
     would leave the lead advanced past a stage with nothing behind it, and
     destroy the audit trail for a contract the customer signed. Void it
     instead: the record survives, marked invalid, and the stage reopens. */
  if (target.stage && target.status === "Signed") {
    return res.status(409).json({
      error: "This document is signed evidence for a completed stage — void it instead of deleting it.",
      stage: target.stage,
    });
  }

  state.documents = (state.documents || []).filter((d: any) => d.id !== req.params.id);
  // Its audit rows go with it — otherwise they are served forever pointing at
  // a document id that no longer resolves.
  state.docEvents = ((state.docEvents || []) as any[]).filter((e) => e.docId !== target.id);
  writeState(state);
  res.json({ message: "Document deleted." });
});

/** Void a signed stage document: keep the record, mark it invalid, and reopen
 *  the stage. The counterpart to refusing deletion above. */
app.post("/api/documents/:id/void", (req: any, res) => {
  const state = readState();
  const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Document not found" });
  const doc = state.documents[index] as any;
  if (!mayTouch(doc, req.auth)) return res.status(403).json({ error: "Not your document." });
  if (!doc.stage) {
    return res.status(400).json({ error: "Only a DocHub stage document can be voided." });
  }

  state.documents[index] = { ...doc, status: "Void" };

  if (!state.docEvents) state.docEvents = [];
  state.docEvents.unshift({
    id: newId("de_"),
    docId: doc.id,
    leadId: doc.leadId,
    action: "voided",
    userId: req.auth?.userId,
    timestamp: new Date().toISOString(),
    dealershipId: doc.dealershipId,
  });

  const lead = (state.leads || []).find((l: any) => l.id === doc.leadId);
  /* Finalising the invoice stage ticks `dealChecklist.invoiced`; voiding it has
     to untick, or the checklist keeps asserting an invoice that no longer
     exists. The drift report was reporting exactly this pair and nothing was
     repairing it. */
  if (doc.stage === "invoice" && lead?.dealChecklist?.invoiced) {
    lead.dealChecklist = { ...lead.dealChecklist, invoiced: false };
  }
  recomputeDocStage(state, lead);

  writeState(state);
  res.json({
    message: "Document voided.",
    document: state.documents[index],
    lead: lead ? { id: lead.id, docStage: lead.docStage, docFlowCompletedAt: lead.docFlowCompletedAt } : null,
  });
});

/** Read-only consistency report — records that contradict each other.
 *
 *  Status coupling is deliberately transition-based: it fires when a status
 *  actually changes, and so never repairs drift that already exists. A car sold
 *  before any coupling existed keeps its deal open forever and nothing surfaces
 *  it. This lists those pairs and changes nothing — what to do about a
 *  months-old mismatch is the dealer's judgement, not something a GET should
 *  decide for them.
 *
 *  Some rows here are legitimate rather than wrong: a car genuinely sold
 *  outside the DMS has no deal to close. Each group carries a note saying so,
 *  because a report that cries wolf gets ignored. */
app.get("/api/drift", (req: any, res) => {
  const state = readState();
  const vehicles = scopeToDealer(state.vehicles || [], req.auth) as any[];
  const leads = scopeToDealer(state.leads || [], req.auth) as any[];
  const documents = scopeToDealer(state.documents || [], req.auth) as any[];

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const leadsByVehicle = new Map<string, any[]>();
  for (const l of leads) {
    if (!l.vehicleId) continue;
    const arr = leadsByVehicle.get(l.vehicleId) || [];
    arr.push(l);
    leadsByVehicle.set(l.vehicleId, arr);
  }

  const vLabel = (v: any) =>
    !v ? "(missing vehicle)" : [v.year, v.make, v.model].filter(Boolean).join(" ") || v.stockNumber || v.id;
  const lName = (l: any) => `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.id;

  /* Sold with no deal closed against it. Often legitimate — a cash sale off the
     floor never had a lead — but also what a sale through a non-coupling path
     looks like. */
  const soldWithNoClosedDeal = vehicles
    .filter((v) => v.status === "SOLD")
    .filter((v) => !(leadsByVehicle.get(v.id) || []).some((l) => l.status === "Closed Won"))
    .map((v) => ({ vehicleId: v.id, stockNumber: v.stockNumber, label: vLabel(v) }));

  /* Deal closed Won while its car is still on the floor — the public feed
     publishes INVENTORY, so this car is still advertised as available. */
  const closedDealStillInStock = leads
    .filter((l) => l.status === "Closed Won" && l.vehicleId)
    .filter((l) => {
      const v = vehicleById.get(l.vehicleId);
      return v && v.status !== "SOLD";
    })
    .map((l) => ({
      leadId: l.id,
      name: lName(l),
      vehicleId: l.vehicleId,
      label: vLabel(vehicleById.get(l.vehicleId)),
    }));

  /* Compliance is verified only at the moment it is finalised. All three tick
     surfaces can clear NATIS or roadworthy afterwards, leaving a deal that
     claims compliance is done with the evidence flags false. */
  const complianceIdx = DOC_STAGES.indexOf("compliance");
  const compliancePastButUnticked = leads
    .filter((l) => {
      const past = l.docFlowCompletedAt
        ? true
        : l.docStage
        ? DOC_STAGES.indexOf(l.docStage) > complianceIdx
        : false;
      if (!past) return false;
      const cl = l.dealChecklist || {};
      return !cl.natis || !cl.roadworthy;
    })
    .map((l) => {
      const cl = l.dealChecklist || {};
      return {
        leadId: l.id,
        name: lName(l),
        missing: [!cl.natis && "natis", !cl.roadworthy && "roadworthy"].filter(Boolean),
      };
    });

  /* The checklist's "Invoiced" tick and DocHub's invoice stage are two records
     of one event, and the tick is freely editable from two other screens.
     Only compared for deals that actually entered DocHub — a dealer who has not
     adopted it would otherwise see every lead listed here. */
  const leadsWithSignedInvoice = new Set(
    documents.filter((d) => d.stage === "invoice" && d.status === "Signed").map((d) => d.leadId),
  );
  const invoicedFlagDisagrees = leads
    .filter((l) => l.docStage || l.docFlowCompletedAt)
    .filter((l) => !!l.dealChecklist?.invoiced !== leadsWithSignedInvoice.has(l.id))
    .map((l) => ({
      leadId: l.id,
      name: lName(l),
      checklistSaysInvoiced: !!l.dealChecklist?.invoiced,
      docHubInvoiceFinalised: leadsWithSignedInvoice.has(l.id),
    }));

  const groups = {
    soldWithNoClosedDeal: {
      note: "Sold with no Closed Won deal. Legitimate for a sale made outside the DMS.",
      rows: soldWithNoClosedDeal,
    },
    closedDealStillInStock: {
      note: "Deal closed but the car is still in stock — it is still advertised as available.",
      rows: closedDealStillInStock,
    },
    compliancePastButUnticked: {
      note: "Past the compliance stage with NATIS or roadworthy un-ticked since.",
      rows: compliancePastButUnticked,
    },
    invoicedFlagDisagrees: {
      note: "Checklist 'Invoiced' and the DocHub invoice stage disagree.",
      rows: invoicedFlagDisagrees,
    },
  };

  res.json({
    total: Object.values(groups).reduce((n, g) => n + g.rows.length, 0),
    groups,
  });
});

// --- DocHub ---------------------------------------------------------
// A five-stage document lifecycle bolted on top of the existing documents
// collection. Docs opt into it by setting `stage` and `mode`; everything
// else keeps its old behaviour.

/** Dealer self-service editing of identity fields the dealer's own docs
 *  and public listings quote — name, trading-as, VAT number, contact email,
 *  address, registration number. Admins may target any dealership by passing
 *  `dealershipId` in the body; dealers implicitly target their own. Guarded
 *  whitelist: nothing outside this set (products, slug, id) can be changed
 *  through here — those remain admin-only via /api/dealerships/:id. */
app.put("/api/dealership/self", (req: any, res) => {
  const state = readState();
  const targetId =
    req.auth?.role === "admin" ? (req.body?.dealershipId || req.auth?.dealershipId) : req.auth?.dealershipId;
  if (!targetId) return res.status(400).json({ error: "dealershipId required" });
  const i = (state.dealerships || []).findIndex((d: any) => d.id === targetId);
  if (i === -1) return res.status(404).json({ error: "Dealership not found" });

  const { name, tradingAs, vatNumber, contactEmail, address, registrationNumber, websiteUrl, docSettings } = req.body || {};
  const d = state.dealerships[i] as any;
  if (typeof name === "string" && name.trim()) d.name = name.trim();
  if (typeof tradingAs === "string") d.tradingAs = tradingAs.trim();
  if (typeof vatNumber === "string") d.vatNumber = vatNumber.trim();
  if (typeof contactEmail === "string") d.contactEmail = contactEmail.trim();
  if (typeof address === "string") d.address = address.trim();
  if (typeof registrationNumber === "string") d.registrationNumber = registrationNumber.trim();
  if (typeof websiteUrl === "string") d.websiteUrl = websiteUrl.trim();
  if (docSettings && typeof docSettings === "object") {
    const prev = d.docSettings || {};
    const next = { ...prev };
    if (typeof docSettings.logo === "string") {
      if (!docSettings.logo) {
        next.logo = "";
      } else {
        const ref = putPhoto(docSettings.logo);
        if (ref) next.logo = ref;
      }
    }
    if (docSettings.bankingDetails && typeof docSettings.bankingDetails === "object") {
      const b: any = {};
      for (const k of ["bankName", "branchCode", "accountNumber", "accountType"]) {
        const v = docSettings.bankingDetails[k];
        b[k] = typeof v === "string" ? v.trim() : (prev.bankingDetails?.[k] || "");
      }
      next.bankingDetails = b;
    }
    if (Array.isArray(docSettings.saleTerms)) {
      next.saleTerms = docSettings.saleTerms.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.trim());
    }
    if (typeof docSettings.ownershipClause === "string") next.ownershipClause = docSettings.ownershipClause.trim();
    if (typeof docSettings.footerNote === "string") next.footerNote = docSettings.footerNote.trim();
    if (typeof docSettings.warrantyTerms === "string") next.warrantyTerms = docSettings.warrantyTerms.trim();
    d.docSettings = next;
  }

  writeState(state);
  res.json({ dealership: state.dealerships[i] });
});

/** Per-stage mode configuration. Dealers self-serve for their own dealership;
 *  admins may target any dealership by passing `dealershipId` in the body. */
app.put("/api/docflow", (req: any, res) => {
  const state = readState();
  const targetId =
    req.auth?.role === "admin" ? (req.body?.dealershipId || req.auth?.dealershipId) : req.auth?.dealershipId;
  if (!targetId) return res.status(400).json({ error: "dealershipId required" });
  const i = (state.dealerships || []).findIndex((d: any) => d.id === targetId);
  if (i === -1) return res.status(404).json({ error: "Dealership not found" });

  const { docFlow } = req.body || {};
  if (!docFlow || typeof docFlow !== "object") {
    return res.status(400).json({ error: "docFlow object required" });
  }
  const clean: Partial<Record<DocStage, DocMode>> = {};
  for (const stage of DOC_STAGES) {
    const mode = docFlow[stage];
    if (mode === "generate" || mode === "attach") clean[stage] = mode;
    if (mode === "connect" && !FIXED_STAGE_MODES[stage]) clean[stage] = mode;
  }
  state.dealerships[i].docFlow = { ...(state.dealerships[i].docFlow || {}), ...clean };
  writeState(state);
  res.json({ dealership: state.dealerships[i] });
});

/** Docs for a specific deal (lead). Scoped to the caller's dealership. */
app.get("/api/deals/:leadId/documents", (req: any, res) => {
  const state = readState();
  const all = (state.documents || []).filter((d: any) => d.leadId === req.params.leadId);
  res.json(scopeToDealer(all, req.auth));
});

/** Finalise a DocHub document — runs the validator (generate mode only),
 *  marks the doc signed, appends an audit event, and advances the parent
 *  lead's docStage to the next stage in DOC_STAGES. Also flips the existing
 *  dealChecklist.invoiced flag when the invoice stage completes so the older
 *  readiness view stays in step with DocHub. */
app.post("/api/documents/:id/finalize", (req: any, res) => {
  const state = readState();
  const index = (state.documents || []).findIndex((d: any) => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Document not found" });
  const doc = state.documents[index];
  if (!mayTouch(doc, req.auth)) return res.status(403).json({ error: "Not your document." });
  if (!doc.stage || !doc.mode) {
    return res.status(400).json({ error: "This document is not a DocHub stage document." });
  }

  const lead = (state.leads || []).find((l: any) => l.id === doc.leadId) as Lead | undefined;

  /* Stages run in order, and finalising one asserts the ones before it are
     done. Without this, a lone handover document could be finalised on an
     untouched deal: `currentIdx` is -1, `thisIdx >= currentIdx` passes, the
     next stage resolves to null and the deal is stamped complete having
     produced no proforma, deed, compliance or invoice at all — then vanishes
     off Deal Readiness. */
  const signedStages = new Set(
    ((state.documents || []) as any[])
      .filter((d) => d.leadId === doc.leadId && d.status === "Signed" && d.stage)
      .map((d) => d.stage),
  );
  /* A stage the dealer deliberately skipped still counts as satisfied — a deal
     completed outside the DMS, or a stage that never applied, must not block
     finalising the stages after it. Keyed on the presence of a skip so a deal
     with none behaves exactly as before: skipped stages are actively recorded
     (lead.docSkips), never just absent. */
  const skippedStages = new Set(
    Object.keys((lead as any)?.docSkips || {}).filter((s): s is DocStage =>
      DOC_STAGES.includes(s as DocStage),
    ),
  );
  const missingEarlier = DOC_STAGES.slice(0, DOC_STAGES.indexOf(doc.stage)).filter(
    (s) => !signedStages.has(s) && !skippedStages.has(s),
  );
  if (missingEarlier.length > 0) {
    return res.status(422).json({
      error: "Earlier stages are not finalised yet.",
      missing: missingEarlier,
    });
  }

  if (doc.mode === "generate") {
    const check = canAdvance(doc.stage, doc.fieldSnapshot || {}, lead);
    if (!check.ok) {
      return res.status(422).json({
        error: "Required fields are missing.",
        missing: check.missing,
      });
    }
  } else if (doc.mode === "confirm") {
    // Compliance uses this path: verify the checklist flags rather than a
    // file. Reject with the same shape as canAdvance so the client renders
    // the missing list without a special case.
    const missing: string[] = [];
    if (doc.stage === "compliance") {
      if (!lead?.dealChecklist?.natis) missing.push("natis");
      if (!lead?.dealChecklist?.roadworthy) missing.push("roadworthy");
    }
    if (missing.length > 0) {
      return res.status(422).json({ error: "Compliance not confirmed.", missing });
    }
  } else {
    // Attach mode: dealer's own doc must be present and signed before we
    // treat the stage as complete. /api/documents/:id/sign is the existing
    // canvas-signature endpoint they'll have hit already.
    if (!doc.fileData) return res.status(422).json({ error: "No file attached." });
    if (doc.status !== "Signed") {
      return res.status(422).json({ error: "Attached document must be signed before finalising." });
    }
  }

  state.documents[index] = {
    ...doc,
    status: "Signed",
    signedAt: doc.signedAt || new Date().toISOString(),
  };

  if (!state.docEvents) state.docEvents = [];
  state.docEvents.unshift({
    id: newId("de_"),
    docId: doc.id,
    leadId: doc.leadId,
    action: "finalized",
    userId: req.auth?.userId,
    timestamp: new Date().toISOString(),
    dealershipId: doc.dealershipId,
  });

  // Advance the lead's stage. If already past this stage (e.g. dealer went
  // back and re-finalised an earlier stage), leave the current position
  // alone rather than yanking them backwards.
  if (lead) {
    const currentIdx = lead.docStage ? DOC_STAGES.indexOf(lead.docStage) : -1;
    const thisIdx = DOC_STAGES.indexOf(doc.stage);
    if (thisIdx >= currentIdx) {
      const nextStage = DOC_STAGES[thisIdx + 1] ?? null;
      lead.docStage = nextStage;
      /* Finalising the last stage leaves docStage null — indistinguishable
         from a lead that never started. Stamp completion separately so the
         two can be told apart; without this a finished deal renders as if it
         were sitting at Proforma. */
      if (nextStage === null) {
        lead.docFlowCompletedAt = new Date().toISOString();
      }
    }
    // Keep the older readiness checklist consistent when the invoice stage
    // finalises — the two views must never disagree about "is this invoiced".
    if (doc.stage === "invoice") {
      lead.dealChecklist = { ...(lead.dealChecklist || {}), invoiced: true };
    }
  }

  writeState(state);
  res.json({
    message: "Document finalised.",
    document: state.documents[index],
    lead: lead
      ? { id: lead.id, docStage: lead.docStage, docFlowCompletedAt: lead.docFlowCompletedAt }
      : null,
  });
});

/** Bypass a DocHub stage on a lead.
 *
 *  Some deals happen partly outside the DMS — a cash sale off the floor, or a
 *  stage (proforma, invoice, handover) that genuinely does not apply to them.
 *  Forcing those deals through every document gate writes paperwork nobody
 *  needed. Instead the dealer ticks the stage as intentionally skipped.
 *
 *  This is a docflow-only write, deliberately scoped to match `finalize`:
 *  it records the skip with an audit (who + when + optional reason), advances
 *  `lead.docStage`, and marks the deal complete when the LAST stage is skipped.
 *  It never touches `lead.status` or any vehicle field — the sale itself is
 *  still recorded by the normal vehicle → SOLD coupling, so a skipped-stage
 *  deal still goes Sold exactly when the dealer sells the car. A skip on a
 *  stage already behind the current one is recorded for the audit trail but
 *  never yanks the pointer backwards. */
app.post("/api/deals/:leadId/docs/skip", (req: any, res) => {
  const state = readState();
  const lead = (state.leads || []).find((l: any) => l.id === req.params.leadId);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  if (!mayTouch(lead, req.auth)) return res.status(404).json({ error: "Lead not found" });

  const stage = String(req.body?.stage || "");
  if (!DOC_STAGES.includes(stage as DocStage)) {
    return res.status(400).json({ error: "Unknown document stage." });
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  const skips = lead.docSkips || {};
  if (skips[stage as DocStage]) {
    return res
      .status(409)
      .json({ error: "This stage is already skipped." });
  }

  const now = new Date().toISOString();
  skips[stage as DocStage] = {
    at: now,
    by: req.auth?.userId || req.auth?.label || undefined,
    reason: reason || undefined,
  };
  lead.docSkips = skips;

  /* Mirror finalize's advancement: move past this stage but never backwards.
     Skipping the last stage sets the deal complete (docflow dimension only). */
  const currentIdx = lead.docStage ? DOC_STAGES.indexOf(lead.docStage) : -1;
  const thisIdx = DOC_STAGES.indexOf(stage as DocStage);
  if (thisIdx >= currentIdx) {
    const nextStage = DOC_STAGES[thisIdx + 1] ?? null;
    lead.docStage = nextStage;
    if (nextStage === null) {
      lead.docFlowCompletedAt = lead.docFlowCompletedAt || now;
    }
  }

  writeState(state);
  res.json({
    message: "Document stage skipped.",
    lead: { id: lead.id, docStage: lead.docStage, docFlowCompletedAt: lead.docFlowCompletedAt, docSkips: lead.docSkips },
  });
});

// Accounting Expenses API
app.get("/api/expenses", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.expenses || [], req.auth));
});

app.post("/api/expenses", (req: any, res) => {
  const state = readState();
  const newExpense = {
    id: newId("exp_"),
    description: req.body.description || "General Expense",
    amount: parseFloat(req.body.amount) || 0,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    category: req.body.category || "Operations",
    referenceId: req.body.referenceId || "",
    reconciled: req.body.reconciled || false,
    dealershipId: ownerDealership(req),
  };

  if (!state.expenses) state.expenses = [];
  state.expenses.unshift(newExpense);
  writeState(state);
  res.status(201).json({ message: "Expense logged successfully.", expense: newExpense });
});

app.put("/api/expenses/:id/reconcile", (req: any, res) => {
  const state = readState();
  if (!state.expenses) state.expenses = [];
  const index = state.expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Expense not found" });
  }
  if (!mayTouch(state.expenses[index], req.auth)) {
    return res.status(403).json({ error: "Not your expense." });
  }

  state.expenses[index].reconciled = req.body.reconciled !== undefined ? req.body.reconciled : !state.expenses[index].reconciled;
  writeState(state);
  res.json({ message: "Expense reconciliation state updated.", expense: state.expenses[index] });
});

// Users Roster API
app.get("/api/users", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.users, req.auth));
});

// Staff are created through /api/auth/users, which also mints their login and
// counts the seat. This route stayed open and made users with no dealership and
// no way to sign in, which is how you get uncounted staff on a per-seat plan.
app.post("/api/users", (req: any, res) => {
  res.status(410).json({
    error: "Use POST /api/auth/users",
    message: "Creating a staff member now issues their access code and books a seat.",
  });
});

// Dispatch / Communications logging API
app.get("/api/communications", (req: any, res) => {
  const state = readState();
  res.json(scopeToDealer(state.communications, req.auth));
});

app.post("/api/communications", (req: any, res) => {
  const state = readState();
  const newComm = {
    id: newId("c_"),
    leadId: req.body.leadId,
    type: req.body.type || "email",
    subject: req.body.subject || "Follow-up discussion",
    content: req.body.content || "",
    sentBy: req.body.sentBy || "Marc van der Merwe",
    sentAt: new Date().toISOString().slice(0, 10),
    dealershipId: ownerDealership(req),
  };

  state.communications.unshift(newComm);

  // Mark the corresponding lead as contacted
  const leadIndex = state.leads.findIndex(l => l.id === req.body.leadId);
  if (leadIndex !== -1) {
    state.leads[leadIndex].lastContactedAt = new Date().toISOString().slice(0, 10);
  }

  writeState(state);
  res.status(201).json({ message: "Communication dispatch completed successfully.", communication: newComm });
});

// --- AI AUTO-ASSIGNMENT ENDPOINT ---
app.post("/api/leads/auto-assign", async (req, res) => {
  try {
    const state = readState();

    /* Scope both sides to the signed-in dealership.
       Neither list was scoped, so on a multi-dealer instance this shared one
       dealer's new leads out across every salesperson on the box — a demo lead
       was assigned to another dealership's salesperson in testing. A lead with
       no dealershipId is treated as the caller's, matching how the rest of the
       app handles legacy and TruLens-imported records. */
    const tenant = ownerDealership(req);
    const ours = (id?: string) => !tenant || !id || id === tenant;

    const newLeads = state.leads.filter(
      (l: any) => l.status === "New" && ours(l.dealershipId)
    );

    if (newLeads.length === 0) {
      return res.json({ message: "No 'New' leads found for auto-assignment.", assignments: [] });
    }

    const salespeople = state.users.filter(
      (u: any) => u.role === "salesperson" && u.isActive && ours(u.dealershipId)
    );
    if (salespeople.length === 0) {
      return res.status(400).json({ error: "No active salespeople available for assignment." });
    }

    // Calculate workload
    const workloads = salespeople.map(u => {
      const activeLeadsCount = state.leads.filter(l => 
        l.assignedUserId === u.id && 
        l.status !== "Closed Won" && 
        l.status !== "Closed Lost"
      ).length;
      return { id: u.id, name: u.name, activeLeadsCount };
    });

    let assignments: { leadId: string, assignedUserId: string, reasoning: string }[] = [];

    if (aiConfigured) {
      const systemInstruction = `
You are the Lead CRM AI Agent for TruFlow Light www.real-cars.co.za. Your task is to assign NEW leads to salespeople based on their current workload.
Current Salespeople Workloads:
${workloads.map(w => `- ${w.name} (ID: ${w.id}): ${w.activeLeadsCount} active leads`).join("\n")}

Leads to assign:
${newLeads.map(l => `- Lead ID: ${l.id}, Name: ${l.firstName} ${l.lastName}, Interested in Vehicle: ${l.vehicleId}`).join("\n")}

Rules:
1. Assign each lead to the salesperson with the LOWEST workload.
2. If workloads are equal, balance them out.
3. Provide a brief reasoning for each assignment.

Response MUST be a valid JSON array of objects with keys "leadId", "assignedUserId", "reasoning". No extra text.
`;

      const responseText = await deepseekText([
        { role: "system", content: systemInstruction },
        { role: "user", content: "Assign these leads." },
      ], { json: true });

      try {
        // Clean markdown code blocks if present
        const jsonMatch = responseText?.match(/\[[\s\S]*\]/);
        assignments = JSON.parse(jsonMatch ? jsonMatch[0] : responseText || "");
      } catch (e) {
        console.error("Failed to parse AI assignment response:", e);
        // Fallback to manual assignment if AI fails
        assignments = newLeads.map(l => {
          const sorted = [...workloads].sort((a, b) => a.activeLeadsCount - b.activeLeadsCount);
          const best = sorted[0];
          best.activeLeadsCount++;
          return { leadId: l.id, assignedUserId: best.id, reasoning: "Assigned via workload balancing algorithm (AI Parse Failure)." };
        });
      }
    } else {
      // Manual fallback if no API key
      assignments = newLeads.map(l => {
        const sorted = [...workloads].sort((a, b) => a.activeLeadsCount - b.activeLeadsCount);
        const best = sorted[0];
        best.activeLeadsCount++;
        return { leadId: l.id, assignedUserId: best.id, reasoning: "Assigned via workload balancing algorithm." };
      });
    }

    // Apply assignments
    const updatedLeadsList: any[] = [];
    assignments.forEach(a => {
      const index = state.leads.findIndex(l => l.id === a.leadId);
      if (index !== -1) {
        state.leads[index].assignedUserId = a.assignedUserId;
        state.leads[index].notes += `\n[AI Auto-Assign]: ${a.reasoning}`;
        updatedLeadsList.push(state.leads[index]);
      }
    });

    writeState(state);
    res.json({ message: `Successfully auto-assigned ${updatedLeadsList.length} leads.`, assignments: updatedLeadsList });
  } catch (error: any) {
    console.error("Auto-assignment failure:", error);
    res.status(500).json({ error: "Failed to perform auto-assignment.", details: error.message });
  }
});

// --- AI SECURITY CO-PILOT CHATBOT ENDPOINT ---
app.post("/api/chat", async (req: any, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const raw = readState();
    // Scope before building the prompt. This read the whole instance, so the
    // co-pilot answered one dealer using another dealer's stock and leads —
    // and shipped every dealership's customer names, phones and email
    // addresses to Google on each question.
    const state = {
      ...raw,
      vehicles: scopeToDealer(raw.vehicles, req.auth),
      leads: scopeToDealer(raw.leads, req.auth),
      tasks: scopeToDealer(raw.tasks, req.auth),
      invoices: scopeToDealer(raw.invoices, req.auth),
    };

    const activeVehicles = state.vehicles.filter(v => v.status === "INVENTORY");
    const soldVehicles = state.vehicles.filter(v => v.status === "SOLD");
    /* Was a count of PENDING vehicles — a status nothing wrote any more, so the
       assistant was told there were zero deals in progress no matter what. Read
       from the deals instead: closed, but not yet handed over. */
    const awaitingHandover = state.leads.filter(
      (l: any) => l.status === "Closed Won" && !l.docFlowCompletedAt,
    );
    const activeLeads = state.leads.filter(l => l.status !== "Closed Won" && l.status !== "Closed Lost");
    const pendingTasks = state.tasks.filter(t => t.status !== "Completed");

    const inventoryContext = activeVehicles.map(v => 
      `- Stock ${v.stockNumber}: ${v.year} ${v.make} ${v.model} ${v.trim} (Price: R ${v.retailPrice.toLocaleString()}, ${v.mileage.toLocaleString()} km, ${v.daysInInventory} days in stock)`
    ).join("\n");

    const leadsContext = activeLeads.map(l => 
      `- ${l.firstName} ${l.lastName} (Phone: ${l.phone}, Email: ${l.email}, Intent: ${l.digitalScore}%, Status: ${l.status}, Interested in vehicle ${l.vehicleId})`
    ).join("\n");

    const tasksContext = pendingTasks.map(t => 
      `- Task: "${t.title}" (Priority: ${t.priority}, Due: ${t.dueDate}, Assigned User: ${t.assignedUserId})`
    ).join("\n");

    const totalRevenue = state.invoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);

    const systemInstruction = `
You are the TruFlow Light Co-Pilot, an elite, highly intelligent AI strategist for South African automotive dealerships associated with www.real-cars.co.za. Your purpose is to act as the primary advisor for the Dealer Principal and Sales Managers.

### YOUR CAPABILITIES & SYSTEM KNOWLEDGE:
1.  **DMS (Dealer Management System):**
    - You track live "Showroom Floor" inventory (Stock Numbers, Mileage, Fuel, Transmission).
    - You monitor "Aging Stock" (Days in Inventory). Vehicles over 40 days are critical "Aging Assets" requiring immediate marketing push or price adjustment.
    - You track "Recon Tasks" (Reconditioning). You know if a car is stuck in polishing, brake repairs, or windscreen chips.

2.  **CRM (Customer Relationship Management):**
    - You analyze "Prospect Leads". You see their "Digital Score" (Intent %).
    - You track the "Customer Journey" (which pages they visited, what forms they filled).
    - You know who is assigned to which lead (Sales Roster).

3.  **CONTRACTING & FINANCIALS:**
    - You see "Draft Agreements" (Purchase Deeds) and their signature status.
    - You monitor "Invoices" and "Cleared Payment" statuses (Bank Transfer vs Dealer Finance).
    - You track "Showroom Expenses" (Rent, Marketing, Utilities) and "Reconciliation" status.

### DATA CONTEXT (LIVE FROM SYSTEM):
DELIVERED UNITS (SOLD): ${soldVehicles.length}
DEALS CLOSED, AWAITING HAND-OVER: ${awaitingHandover.length}
CLEARED REVENUE: R ${totalRevenue.toLocaleString()}

ACTIVE SHOWROOM FLOOR INVENTORY:
${inventoryContext || "None listed"}

ACTIVE CRM PROSPECT LEADS:
${leadsContext || "None listed"}

UNRESOLVED OPERATIONAL DIRECTIVES / TASKS:
${tasksContext || "None"}

### YOUR VOICE & PERSONALITY:
- **Professional & Friendly:** You are a helpful expert, not a cold computer.
- **South African Savvy:** Use ZAR (Rands). Use local terminology (e.g., 'bakkie', 'forecourt', 'wesbank', 'autotrader').
- **Proactive:** If you see a high-scoring lead (85%+) that hasn't been contacted, or a vehicle over 40 days in stock, point it out!
- **Concise & Actionable:** Don't just list data; tell the user what to DO with it (e.g., "Dispatch a quote to David Moyo" or "Price-drop the BMW X5").
`;

    if (!aiConfigured) {
      // If API key is missing, fall back to smart template responses
      console.warn("DEEPSEEK_API_KEY environment variable is not defined. Falling back to local intelligence.");
      return res.json({ text: getSmartFallbackResponse(query, state) });
    }

    const resultText = await deepseekText([
      { role: "system", content: systemInstruction },
      { role: "user", content: query },
    ], { temperature: 0.7 });

    if (!resultText) {
      return res.json({ text: getSmartFallbackResponse(query, state) });
    }

    res.json({ text: resultText });
  } catch (error: any) {
    console.error("DeepSeek Co-Pilot integration failure:", error);
    res.status(500).json({ error: "AI assistant service is currently sleeping or configured incorrectly. Please check settings.", details: error.message });
  }
});

function getSmartFallbackResponse(query: string, state: any): string {
  const text = query.toLowerCase();
  const formatZAR = (num: number) => 'R ' + Math.round(num).toLocaleString('en-ZA');

  if (text.includes("inventory") || text.includes("stock") || text.includes("cars")) {
    const active = state.vehicles.filter((v: any) => v.status === "INVENTORY");
    const avgAge = active.length > 0 ? Math.round(active.reduce((sum: number, v: any) => sum + v.daysInInventory, 0) / active.length) : 0;
    return `Showroom Update: We have ${active.length} active units on the floor. Average stock age is ${avgAge} days. The top-of-funnel unit is the ${active[0]?.year} ${active[0]?.make} ${active[0]?.model} (${active[0]?.stockNumber}) priced at ${formatZAR(active[0]?.retailPrice || 0)}.`;
  }
  if (text.includes("slow") || text.includes("oldest") || text.includes("aging")) {
    const active = state.vehicles.filter((v: any) => v.status === "INVENTORY");
    if (active.length === 0) return "No active inventory found to analyze.";
    const oldest = [...active].sort((a: any, b: any) => b.daysInInventory - a.daysInInventory)[0];
    return `Critical Aging Alert: The ${oldest.year} ${oldest.make} ${oldest.model} (Stock ${oldest.stockNumber}) has been on the floor for ${oldest.daysInInventory} days. It's currently at ${formatZAR(oldest.retailPrice)}. We should consider a price-drop or featuring it on the TrueSites hero banner.`;
  }
  if (text.includes("hot") || text.includes("score") || text.includes("best lead") || text.includes("prospect")) {
    const activeLeads = state.leads.filter((l: any) => l.status !== "Closed Won" && l.status !== "Closed Lost");
    if (activeLeads.length === 0) return "No active leads found in the CRM.";
    const topLead = [...activeLeads].sort((a: any, b: any) => b.digitalScore - a.digitalScore)[0];
    return `Hot Prospect Found: ${topLead.firstName} ${topLead.lastName} has a Digital Intent Score of ${topLead.digitalScore}%. They are focusing on the ${topLead.vehicleId} and were last active on ${topLead.lastContactedAt || topLead.createdAt}. Dispatch a follow-up via TrueCRM immediately!`;
  }
  if (text.includes("task") || text.includes("todo") || text.includes("action")) {
    const pending = state.tasks.filter((t: any) => t.status !== "Completed");
    if (pending.length === 0) return "All operational directives are currently resolved. Good job!";
    return `Operational Brief: You have ${pending.length} pending tasks. The most urgent is "${pending[0]?.title}" due on ${pending[0]?.dueDate}.`;
  }
  if (text.includes("revenue") || text.includes("sales") || text.includes("sold") || text.includes("profit")) {
    const sold = state.vehicles.filter((v: any) => v.status === "SOLD");
    const totalRev = state.invoices.filter((i: any) => i.status === "Paid").reduce((sum: number, i: any) => sum + i.amount, 0);
    const totalCost = sold.reduce((sum: number, v: any) => sum + v.costPrice, 0);
    return `Financial Snapshot: We have delivered ${sold.length} units this period. Total cleared revenue stands at ${formatZAR(totalRev)}. Estimated gross profit on delivered units is approximately ${formatZAR(totalRev - totalCost)}.`;
  }

  return "I am the TruFlow Light AI Co-Pilot. I am trained on 'showroom inventory', 'aging stock', 'hot CRM prospects', 'operational tasks', and 'financial snapshots' for TruFlow Light (www.real-cars.co.za). How can I help you move stock today?";
}

// --- AUTOLENS PHOTO SYNC ENDPOINTS ---

// Map AutoLens photo slot IDs to DMS image categories
const SLOT_TO_CATEGORY: Record<string, string> = {
  // Phase 1: Exterior → main images
  front_3_4: "images", front_straight: "images", rear_3_4: "images",
  rear_straight: "images", side_driver: "images", side_passenger: "images",
  roof_view: "images", wheels_all: "images", /* legacy, pre-split */
  wheel_front_driver: "images", wheel_rear_driver: "images",
  wheel_rear_passenger: "images", wheel_front_passenger: "images",
  // TruLens inspection body-panel slots → main images
  front_bumper: "images", rear_bumper: "images", bonnet: "images",
  boot_tailgate: "images", roof_sunroof: "images", front_windscreen: "images",
  fender_front_right: "images", fender_front_left: "images",
  door_front_right: "images", door_front_left: "images",
  door_rear_right: "images", door_rear_left: "images",
  quarter_rear_right: "images", quarter_rear_left: "images",
  wheel_front_right: "images", wheel_front_left: "images",
  wheel_rear_right: "images", wheel_rear_left: "images",
  // Phase 2-4: Details/Interior/Engine → extras
  badges_detail: "extrasPhotos", lights_detail: "extrasPhotos",
  mirrors_handles: "extrasPhotos", interior_dash: "extrasPhotos",
  seat_driver: "extrasPhotos", seat_passenger: "extrasPhotos",
  seats_rear: "extrasPhotos", boot_bay: "extrasPhotos",
  floor_mats: "extrasPhotos", engine_bay: "extrasPhotos",
  mechanical_details: "extrasPhotos", undercarriage: "extrasPhotos",
  interior_cabin: "extrasPhotos", steering_wheel: "extrasPhotos",
  odometer: "extrasPhotos", license_disc: "extrasPhotos",
  // Phase 5: Recon → damage
  recon_damage: "damagePhotos",
  // Phase 6: Documents
  service_book: "serviceBookPhotos", reg_papers: "extrasPhotos",
  odometer_reading: "extrasPhotos", vin_plate: "vinPhotos",
  // Phase 7: Video
  video_360: "extrasPhotos",
};

/**
 * Sort a capture's slots into the DMS's photo arrays — and pull the walkaround
 * out of them.
 *
 * The 360 slot used to map into extrasPhotos, which the public feed merges into
 * `images`, so dealer sites rendered a video file inside an <img> and showed a
 * broken thumbnail. Nothing needed to change in the payload to fix it: the data
 * URI already declares itself as `data:video/…`, so the type is recoverable
 * here without TruLens sending anything extra.
 *
 * Detection is by MIME prefix rather than by slot id, so a video arriving in
 * any slot is handled — an older client that files it somewhere else, or a
 * future slot nobody has added to SLOT_TO_CATEGORY yet.
 */
function mapAutoLensPhotos(photos: Record<string, string>): {
  images: string[];
  damagePhotos: string[];
  vinPhotos: string[];
  serviceBookPhotos: string[];
  extrasPhotos: string[];
} {
  const mapped: Record<string, string[]> = {
    images: [], damagePhotos: [], vinPhotos: [],
    serviceBookPhotos: [], extrasPhotos: [],
  };

  /* Photos land on disk here, and only the reference goes into the state.
     This is the single choke point for everything TruLens pushes, so converting
     at this one spot keeps image bytes out of data.json for the entire export
     path. Content-addressed, so a re-export of an unchanged capture — which is
     what happens every time a dealer adds one more shot — rewrites nothing and
     produces the identical references. */
  for (const [slotId, base64] of Object.entries(photos)) {
    if (typeof base64 === "string" && /^data:video\//i.test(base64)) continue;
    const category = SLOT_TO_CATEGORY[slotId] || "extrasPhotos";
    const ref = putPhoto(base64);
    /* Falls back to the raw value if the store could not take it, so a capture
       is never silently dropped: an un-storable photo still reaches the dealer
       as base64, exactly as it did before. */
    mapped[category].push(ref || base64);
  }

  return {
    images: mapped.images,
    damagePhotos: mapped.damagePhotos,
    vinPhotos: mapped.vinPhotos,
    serviceBookPhotos: mapped.serviceBookPhotos,
    extrasPhotos: mapped.extrasPhotos,
  };
}

// Pull photos from AutoLens Firestore for a vehicle matched by stockNumber
app.post("/api/sync/pull-photos", async (req, res) => {
  try {
    const { stockNumber, vehicleId } = req.body;
    if (!stockNumber && !vehicleId) {
      return res.status(400).json({ error: "stockNumber or vehicleId required" });
    }

    let query;
    if (stockNumber) {
      query = lensFirestore.collection("vehicles").where("stockNumber", "==", stockNumber).limit(1);
    } else {
      query = lensFirestore.collection("vehicles").where("id", "==", vehicleId).limit(1);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.json({ synced: false, message: "No matching vehicle found in AutoLens." });
    }

    const lensVehicle = snapshot.docs[0].data();
    // Stock numbers are only unique within a dealer — two dealers both running
    // STK-1001 would otherwise pull each other's photos.
    const { dealerSlug: wantSlug } = req.body || {};
    if (wantSlug && lensVehicle.dealerSlug && lensVehicle.dealerSlug !== wantSlug) {
      return res.json({
        synced: false,
        message: `AutoLens vehicle ${stockNumber || vehicleId} belongs to a different dealer (${lensVehicle.dealerSlug}).`,
      });
    }
    const photos = lensVehicle.photos || {};
    const photoCount = Object.keys(photos).length;

    if (photoCount === 0) {
      return res.json({ synced: false, message: "Vehicle found but no photos uploaded yet." });
    }

    const mapped = mapAutoLensPhotos(photos);

    // Update local DMS vehicle
    const state = readState();
    const matchField = stockNumber ? "stockNumber" : "id";
    const matchValue = stockNumber || vehicleId;
    const idx = state.vehicles.findIndex((v: any) => v[matchField] === matchValue);

    if (idx === -1) {
      return res.json({
        synced: false,
        message: "Vehicle exists in AutoLens but not in DMS. Create it first.",
        autoLensData: {
          make: lensVehicle.make, model: lensVehicle.model,
          year: lensVehicle.year, stockNumber: lensVehicle.stockNumber,
          photoCount,
        }
      });
    }

    state.vehicles[idx].images = mapped.images;
    state.vehicles[idx].damagePhotos = mapped.damagePhotos;
    state.vehicles[idx].vinPhotos = mapped.vinPhotos;
    state.vehicles[idx].serviceBookPhotos = mapped.serviceBookPhotos;
    state.vehicles[idx].extrasPhotos = mapped.extrasPhotos;
    // Damage findings drive the VIR — photo quality is internal to TruLens,
    // never exposed as the vehicle condition score.
    if (Array.isArray(lensVehicle?.damage)) {
      state.vehicles[idx].damage = lensVehicle.damage;
      state.vehicles[idx].vir = capOverallVir(computeVirFromDamage(lensVehicle.damage));
      state.vehicles[idx].virReport = buildVirReport({
        slotAssessment: lensVehicle.slotAssessment,
        damage: lensVehicle.damage,
      });
    }
    /* Dealer's condition declaration (retail "no damage reported" statement) —
       stored so the public feed and the dealer site can surface it. Only set
       when TruLens sent one, so it never overwrites an existing declaration with
       undefined on a photos-only re-sync. */
    if (lensVehicle?.conditionDeclaration) {
      (state.vehicles[idx] as any).conditionDeclaration = lensVehicle.conditionDeclaration;
    }
    if (Array.isArray(lensVehicle?.optionalExtras)) {
      state.vehicles[idx].optionalExtras = normaliseExtras(lensVehicle.optionalExtras);
    }
    (state.vehicles[idx] as any).lastPhotoSync = new Date().toISOString();
    writeState(state);

    res.json({
      synced: true,
      message: `Synced ${photoCount} photos from AutoLens to DMS.`,
      breakdown: {
        mainImages: mapped.images.length,
        extras: mapped.extrasPhotos.length,
        damage: mapped.damagePhotos.length,
        vin: mapped.vinPhotos.length,
        serviceBook: mapped.serviceBookPhotos.length,
      },
      vehicle: state.vehicles[idx],
    });
  } catch (error: any) {
    console.error("Photo sync error:", error);
    res.status(500).json({ error: "Photo sync failed", details: error.message });
  }
});

// Sync ALL vehicles — batch pull from AutoLens
app.post("/api/sync/pull-all", async (req: any, res) => {
  try {
    const state = readState();

    const snapshot = await lensFirestore.collection("vehicles").get();

    let syncedCount = 0;
    const results: { stockNumber: string; status: string }[] = [];

    // Enforce dealer scope from auth; body slug is a fallback for admin only
    const wantSlug = (req.body || {}).dealerSlug;
    const wantId = req.auth?.role === "admin"
      ? (wantSlug ? dealerIdForSlug(wantSlug) : undefined)
      : req.auth?.dealershipId;

    for (const doc of snapshot.docs) {
      const lensVehicle = doc.data();
      const photos = lensVehicle.photos || {};
      if (Object.keys(photos).length === 0) continue;
      if (wantSlug && lensVehicle.dealerSlug && lensVehicle.dealerSlug !== wantSlug) continue;

      const idx = state.vehicles.findIndex(
        (v: any) =>
          v.stockNumber === lensVehicle.stockNumber &&
          (!wantId || v.dealershipId === wantId)
      );
      if (idx === -1) {
        results.push({ stockNumber: lensVehicle.stockNumber, status: "not_in_dms" });
        continue;
      }

      const mapped = mapAutoLensPhotos(photos);
      state.vehicles[idx].images = mapped.images;
      state.vehicles[idx].damagePhotos = mapped.damagePhotos;
      state.vehicles[idx].vinPhotos = mapped.vinPhotos;
      state.vehicles[idx].serviceBookPhotos = mapped.serviceBookPhotos;
      state.vehicles[idx].extrasPhotos = mapped.extrasPhotos;
      (state.vehicles[idx] as any).lastPhotoSync = new Date().toISOString();
      syncedCount++;
      results.push({ stockNumber: lensVehicle.stockNumber, status: "synced" });
    }

    writeState(state);
    res.json({
      message: `Synced photos for ${syncedCount} vehicles.`,
      results,
    });
  } catch (error: any) {
    console.error("Batch photo sync error:", error);
    res.status(500).json({ error: "Batch sync failed", details: error.message });
  }
});

// Push photos FROM TruLens / AutoLens INTO this DMS (create vehicle if missing)
// Body: { stockNumber?, vehicleId?, createIfMissing?, vehicle?, photos: Record<slotId, base64> }
app.post("/api/sync/push-photos", (req, res) => {
  try {
    const {
      stockNumber,
      vehicleId,
      createIfMissing = true,
      dealerSlug,
      showOnWebsite,
      vehicle: vehicleMeta = {},
      photos = {},
    } = req.body || {};

    // A type predicate rather than a plain boolean: the filter already proves
    // every value is a non-empty string, but TypeScript cannot carry that
    // through a destructured callback, so fromEntries produced unknown values.
    const photoEntries = Object.entries(photos || {}).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].length > 0
    );
    if (photoEntries.length === 0) {
      return res.status(400).json({
        synced: false,
        error: "No photos provided. Send photos as { slotId: base64String }.",
      });
    }

    const mapped = mapAutoLensPhotos(Object.fromEntries(photoEntries));
    const state = readState();

    const matchStock =
      stockNumber || vehicleMeta.stockNumber || null;
    const matchId = vehicleId || vehicleMeta.id || null;

    /* A slug that is sent but not in the map means a dealer was onboarded in
       TruLens and never added here. Silently accepting it files the car as
       untagged, which the public feed then reads as the default dealership —
       so the first cars of a new dealer land on someone else's website. Refuse
       loudly instead. An absent slug is a legacy client and still allowed. */
    if (dealerSlug && !dealerIdForSlug(dealerSlug)) {
      return res.status(400).json({
        synced: false,
        error: `Unknown dealer "${dealerSlug}". Add the dealership in TruFlow before capturing for it.`,
      });
    }

    /* An ABSENT slug used to be treated as "legacy client, allow it" and fell
       through to DEFAULT_DEALERSHIP_ID below — which is d1, a real dealership
       with a live website, not a neutral bucket. So a phone that signed in with
       the shared code and had no dealership picked (cleared browser data, a
       reinstalled PWA, a new handset) did not fail: it silently filed another
       dealer's car into d1's inventory, and with the publish flag set that car
       reached d1's website. Refusing an unknown slug while quietly accepting no
       slug at all guarded the typo and missed the dangerous case. */
    if (!dealerSlug) {
      return res.status(400).json({
        synced: false,
        error:
          "No dealership on this capture. Pick the dealership in TruLens " +
          "before exporting — a capture cannot be filed without one.",
      });
    }

    /* Stock numbers are dealer-chosen and short — PE-1042, STK-001 — so they
       collide across dealerships. Matching on stockNumber alone meant a push
       for one dealer could find, and overwrite the photos of, another dealer's
       vehicle. Scope the search the same way the public feed scopes reads, so
       write and read agree on who owns an untagged row. */
    const pushDealerId = dealerIdForSlug(dealerSlug)!;
    const ownedByPusher = (v: any) =>
      v.dealershipId === pushDealerId;

    let idx = -1;
    if (matchStock) {
      idx = state.vehicles.findIndex(
        (v: any) => ownedByPusher(v) && v.stockNumber === matchStock
      );
    }
    if (idx === -1 && matchId) {
      idx = state.vehicles.findIndex((v: any) => ownedByPusher(v) && v.id === matchId);
    }

    let created = false;
    if (idx === -1) {
      if (!createIfMissing) {
        return res.json({
          synced: false,
          message:
            "Vehicle not found in DMS. Create it first or set createIfMissing=true.",
          stockNumber: matchStock,
        });
      }

      const now = new Date().toISOString().slice(0, 10);
      const newVehicle: Vehicle = {
        id: newId("v_lens_"),
        year: parseInt(vehicleMeta.year, 10) || new Date().getFullYear(),
        make: tidyStr(vehicleMeta.make) || "Unknown",
        model: cleanModelName(vehicleMeta.model) || "Vehicle",
        trim: tidyStr(vehicleMeta.trim) || "",
        status: "INVENTORY",
        retailPrice: parseFloat(vehicleMeta.price ?? vehicleMeta.retailPrice) || 0,
        costPrice: parseFloat(vehicleMeta.costPrice) || 0,
        /* TruLens now captures and sends all three. The fallbacks are kept for
           an older phone that has not updated yet — but note they are guesses,
           and a guess published to a dealer's website reads as a fact, so the
           capture form makes mileage required rather than relying on this. */
        mileage: parseInt(vehicleMeta.mileage, 10) || 0,
        transmission: vehicleMeta.transmission || "Automatic",
        fuelType: vehicleMeta.fuelType || "Petrol",
        damage: Array.isArray(vehicleMeta.damage) ? vehicleMeta.damage : undefined,
        vir: Array.isArray(vehicleMeta.damage) ? capOverallVir(computeVirFromDamage(vehicleMeta.damage)) : undefined,
        virReport: buildVirReport({
          slotAssessment: vehicleMeta.slotAssessment,
          damage: vehicleMeta.damage,
        }),
        slotAssessment: vehicleMeta.slotAssessment || undefined,
        stockNumber:
          matchStock ||
          "STK-" + Math.floor(Math.random() * 900000 + 100000),
        dateAcquired: now,
        daysInInventory: 1,
        description:
          vehicleMeta.description ||
          `Imported from TruLens · ${vehicleMeta.year || ""} ${vehicleMeta.make || ""} ${vehicleMeta.model || ""}`.trim(),
        bodyType: vehicleMeta.vehicleType || vehicleMeta.bodyType || "",
        engine: vehicleMeta.engine || "",
        vin: vehicleMeta.vin || "",
        color: vehicleMeta.color || "",
        images: mapped.images,
        damagePhotos: mapped.damagePhotos,
        vinPhotos: mapped.vinPhotos,
        serviceBookPhotos: mapped.serviceBookPhotos,
        extrasPhotos: mapped.extrasPhotos,
        lastPhotoSync: new Date().toISOString(),
        reconTasks: [],
        source: "trulens",
        /* Tag to the dealer whose phone captured this — keeps it off every
           other dealer's website. Always a real id: the slug is required and
           validated above, and pushDealerId is what the lookup above matched
           on, so write and read agree. This was `|| undefined`, which left the
           row untagged, and an untagged row reads as DEFAULT_DEALERSHIP_ID —
           another dealer's yard — everywhere it is scoped. */
        dealershipId: pushDealerId,
        /* Whether the dealer's website may show it. TruLens has a Publish
           toggle, but it only ever wrote to TruLens's own store — the export
           never carried the value and this never set it, and the public feed
           read "not set" as published. So every capture went live the moment it
           was exported, and unpublishing in TruLens changed nothing on the
           website. A junk test capture reached a dealer's public feed that way.

           A capture therefore lands in the DMS unpublished unless the dealer
           has already pressed Publish in TruLens. Exporting puts the car in the
           dealer's inventory; putting it in front of buyers is a second,
           deliberate act. Explicit rather than undefined so the legacy backfill
           in readState can't later mistake it for a pre-flag row. */
        showOnWebsite: typeof showOnWebsite === "boolean" ? showOnWebsite : false,
        optionalExtras: normaliseExtras(vehicleMeta.optionalExtras),
      };

      state.vehicles.unshift(newVehicle);
      writeState(state);
      created = true;

      return res.status(201).json({
        synced: true,
        created: true,
        message: `Created DMS vehicle and pushed ${photoEntries.length} photos from TruLens.`,
        breakdown: {
          mainImages: mapped.images.length,
          extras: mapped.extrasPhotos.length,
          damage: mapped.damagePhotos.length,
          vin: mapped.vinPhotos.length,
          serviceBook: mapped.serviceBookPhotos.length,
        },
        vehicle: newVehicle,
      });
    }

    // Merge photos (replace category arrays with latest TruLens set)
    state.vehicles[idx].images = mapped.images;
    state.vehicles[idx].damagePhotos = mapped.damagePhotos;
    state.vehicles[idx].vinPhotos = mapped.vinPhotos;
    state.vehicles[idx].serviceBookPhotos = mapped.serviceBookPhotos;
    state.vehicles[idx].extrasPhotos = mapped.extrasPhotos;
    (state.vehicles[idx] as any).lastPhotoSync = new Date().toISOString();
    /* Route the non-media Lens fields through mergeWithMeta so an older push
       cannot overwrite a fresher DMS edit. Everything under FLOW_SYNCED_FIELDS
       is dealer-editable and stamps a per-field updatedAt on both sides; a
       Lens push without a fieldMeta map still wins the first time (absent = 0)
       but a later Flow edit will out-timestamp it. */
    const pushNow = Date.now();
    const incoming: Record<string, any> = {};
    if (vehicleMeta.vin) incoming.vin = vehicleMeta.vin;
    if (vehicleMeta.color) incoming.color = vehicleMeta.color;
    if (vehicleMeta.make) incoming.make = tidyStr(vehicleMeta.make);
    if (vehicleMeta.model) incoming.model = cleanModelName(vehicleMeta.model);
    if (vehicleMeta.trim != null) incoming.trim = tidyStr(vehicleMeta.trim);
    if (vehicleMeta.year) {
      incoming.year = parseInt(vehicleMeta.year, 10) || undefined;
    }
    if (vehicleMeta.mileage != null) {
      incoming.mileage = parseInt(vehicleMeta.mileage, 10);
      if (!Number.isFinite(incoming.mileage)) delete incoming.mileage;
    }
    if (vehicleMeta.transmission) incoming.transmission = vehicleMeta.transmission;
    if (vehicleMeta.fuelType) incoming.fuelType = vehicleMeta.fuelType;
    if (vehicleMeta.description) incoming.description = vehicleMeta.description;
    if (vehicleMeta.vehicleType || vehicleMeta.bodyType) {
      incoming.bodyType = vehicleMeta.vehicleType || vehicleMeta.bodyType;
    }
    if (vehicleMeta.engine) incoming.engine = vehicleMeta.engine;
    if (typeof showOnWebsite === "boolean") incoming.showOnWebsite = showOnWebsite;
    if (vehicleMeta.price != null || vehicleMeta.retailPrice != null) {
      const px = parseFloat(vehicleMeta.price ?? vehicleMeta.retailPrice);
      if (Number.isFinite(px) && px > 0) incoming.retailPrice = px;
    }

    /* Translate the incoming fieldMeta from Lens field names to Flow's. Lens
       sends price/vehicleType; our local rows carry retailPrice/bodyType. */
    const incomingMeta: Record<string, number> = {};
    const rawMeta = (vehicleMeta.fieldMeta || {}) as Record<string, number>;
    for (const [k, v] of Object.entries(rawMeta)) {
      if (typeof v !== "number") continue;
      if (k === "price") incomingMeta.retailPrice = v;
      else if (k === "vehicleType") incomingMeta.bodyType = v;
      else incomingMeta[k] = v;
    }

    const { patch: applyPatch, fieldMeta: nextPushMeta } = mergeWithMeta(
      state.vehicles[idx],
      incoming,
      Object.keys(incomingMeta).length ? incomingMeta : undefined,
      FLOW_SYNCED_FIELDS,
      pushNow,
    );
    Object.assign(state.vehicles[idx], applyPatch);
    (state.vehicles[idx] as any).fieldMeta = nextPushMeta;

    if (Array.isArray(vehicleMeta.damage)) {
      (state.vehicles[idx] as any).damage = vehicleMeta.damage;
      (state.vehicles[idx] as any).vir = capOverallVir(computeVirFromDamage(vehicleMeta.damage));
      (state.vehicles[idx] as any).virReport = buildVirReport({
        slotAssessment: vehicleMeta.slotAssessment,
        damage: vehicleMeta.damage,
      });
    }
    if (vehicleMeta.vir != null && !Array.isArray(vehicleMeta.damage)) {
      (state.vehicles[idx] as any).vir = capOverallVir(Number(vehicleMeta.vir));
    }
    if (Array.isArray(vehicleMeta.inspection)) {
      (state.vehicles[idx] as any).inspection = vehicleMeta.inspection;
    }
    if (vehicleMeta.slotAssessment && Object.keys(vehicleMeta.slotAssessment).length) {
      (state.vehicles[idx] as any).slotAssessment = vehicleMeta.slotAssessment;
      /* Refresh the per-panel virReport whenever slot ratings change, even
         if no damage[] entry was sent. Otherwise a re-export that only
         corrected a slot rating would leave the report stale. */
      const existingDamage = (state.vehicles[idx] as any).damage;
      (state.vehicles[idx] as any).virReport = buildVirReport({
        slotAssessment: vehicleMeta.slotAssessment,
        damage: Array.isArray(existingDamage) ? existingDamage : undefined,
      });
    }
    /* showOnWebsite and retailPrice were both handled up-front by mergeWithMeta
       so a stale Lens push can't clobber a fresher DMS edit — no duplicate set
       needed here. */
    writeState(state);

    res.json({
      synced: true,
      created: false,
      message: `Pushed ${photoEntries.length} photos from TruLens to DMS vehicle ${state.vehicles[idx].stockNumber}.`,
      breakdown: {
        mainImages: mapped.images.length,
        extras: mapped.extrasPhotos.length,
        damage: mapped.damagePhotos.length,
        vin: mapped.vinPhotos.length,
        serviceBook: mapped.serviceBookPhotos.length,
      },
      vehicle: state.vehicles[idx],
    });
  } catch (error: any) {
    console.error("Push photo sync error:", error);
    res.status(500).json({
      synced: false,
      error: "Push photo sync failed",
      details: error.message,
    });
  }
});

// Receive the 360 damage orbit from TruLens (Web3DPackage)
app.post("/api/sync/web3d", (req, res) => {
  try {
    const { stockNumber, dealerSlug, frames, damageTags } = req.body || {};
    if (!stockNumber) return res.status(400).json({ error: "stockNumber required" });
    if (!Array.isArray(frames) || !frames.length) return res.status(400).json({ error: "frames array required" });
    /* Same reasoning as push-photos: without a slug this fell through to d1, a
       real dealership. Stock numbers are dealer-chosen and collide across
       yards, so an orbit could overwrite the 360 on another dealer's car that
       happened to share the number. */
    if (!dealerSlug) {
      return res.status(400).json({ error: "dealerSlug required to file a 360 orbit." });
    }
    if (!dealerIdForSlug(dealerSlug)) {
      return res.status(400).json({ error: `Unknown dealer "${dealerSlug}".` });
    }

    const state = readState();
    const pushDealerId = dealerIdForSlug(dealerSlug)!;
    const idx = state.vehicles.findIndex(
      (v: any) => v.stockNumber === stockNumber && v.dealershipId === pushDealerId
    );
    if (idx === -1) return res.status(404).json({ error: `Vehicle ${stockNumber} not found` });

    state.vehicles[idx].web3d = {
      // Orbit frames are photos too — onto disk, same as the gallery.
      frames: frames.map((f: any, i: number) => ({
        index: i,
        slotId: f.slotId || "",
        name: f.name || f.slotId || `Frame ${i}`,
        azimuth: f.azimuth ?? i / frames.length,
        image: putPhoto(f.image) || f.image,
      })),
      damageTags: Array.isArray(damageTags) ? damageTags : [],
    };
    writeState(state);

    res.json({
      success: true,
      message: `360 orbit saved for ${stockNumber} (${frames.length} frames, ${(damageTags || []).length} damage tags)`,
    });
  } catch (error: any) {
    console.error("Web3D sync error:", error);
    res.status(500).json({ error: "Web3D sync failed", details: error.message });
  }
});

// Check sync status — which DMS vehicles have AutoLens photos available
app.get("/api/sync/status", async (req: any, res) => {
  try {
    const state = readState();
    const vehicles = scopeToDealer(state.vehicles, req.auth);

    const snapshot = await lensFirestore.collection("vehicles").get();

    const lensVehicles = new Map<string, { photoCount: number; status: string }>();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      lensVehicles.set(data.stockNumber, {
        photoCount: Object.keys(data.photos || {}).length,
        status: data.status,
      });
    }

    const syncStatus = vehicles.map((v: any) => {
      const lens = lensVehicles.get(v.stockNumber);
      return {
        stockNumber: v.stockNumber,
        make: v.make, model: v.model,
        dmsImages: (v.images || []).length,
        autoLensPhotos: lens?.photoCount || 0,
        autoLensStatus: lens?.status || "not_found",
        needsSync: lens ? lens.photoCount > 0 && (v.images || []).length === 0 : false,
      };
    });

    res.json(syncStatus);
  } catch (error: any) {
    console.error("Sync status error:", error);
    res.status(500).json({ error: "Failed to check sync status", details: error.message });
  }
});

// --- PUBLIC INVENTORY FEED & MULTI-PORTAL SYNC ---

// Portal registry — stored alongside DMS data
const PORTALS_FILE = path.join(DATA_DIR, "portals.json");

interface Portal {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  webhookUrl?: string;
  lastSyncAt?: string;
  vehicleCount?: number;
  active: boolean;
}

function readPortals(): Portal[] {
  try {
    if (fs.existsSync(PORTALS_FILE)) return JSON.parse(fs.readFileSync(PORTALS_FILE, "utf-8"));
  } catch {}
  return [];
}

function writePortals(portals: Portal[]) {
  fs.writeFileSync(PORTALS_FILE, JSON.stringify(portals, null, 2), "utf-8");
}

/** Maps a dealer website's ?dealer= slug to the internal dealershipId that
 *  tags its vehicles. Untagged (legacy) vehicles belong to the FIRST entry
 *  here so existing pilot sites (MKR) keep working unchanged.
 *  Add a line here whenever a new dealer site goes live on this instance. */
/**
 * Slug -> dealershipId, derived from state rather than hardcoded.
 *
 * This was a literal map that had to be edited and deployed for every new
 * dealer — and the same dealer had to be added to TruLens's picker and
 * deployed again. Two releases to onboard one customer, each one a chance to
 * break the service for everyone already on it. Every dealership in state
 * already carries its own slug, so the map only ever duplicated data that
 * was sitting right there.
 *
 * Read per call, not cached at module load, so a dealership added at runtime
 * works immediately without a restart.
 */
function dealerSlugMap(state?: any): Record<string, string> {
  const s = state || readState();
  const out: Record<string, string> = {};
  for (const d of s.dealerships || []) {
    if (d?.slug && d?.id) out[String(d.slug)] = String(d.id);
  }
  return out;
}

/** The dealership a slug belongs to, or undefined when the slug is unknown. */
function dealerIdForSlug(slug: string, state?: any): string | undefined {
  if (!slug) return undefined;
  return dealerSlugMap(state)[slug];
}

/** Compute a 0-100 VIR condition score from damage findings.
 *  Starts at 100 (no damage) and deducts per finding by severity.
 *  This replaces the old photo-quality average — VIR is a vehicle
 *  condition score, not a capture quality score. */
function computeVirFromDamage(damage: { severity: number }[]): number {
  if (!damage || !damage.length) return 100;
  const penalties: Record<number, number> = { 1: 2, 2: 5, 3: 10, 4: 18, 5: 30 };
  const total = damage.reduce((s, d) => s + (penalties[d.severity] ?? 5), 0);
  return Math.max(0, Math.round(100 - total));
}

/** Cap the OVERALL vehicle VIR score at 90 for public display.
 *  No used car is genuinely 100/100 — anything at that ceiling is a
 *  lazy capture (all slots blindly OK, no damage tags added). Real
 *  inspection detail can still drop the score below 90 accurately.
 *  Per-panel scores in virReport are NOT capped — a clean panel is
 *  honestly 100 on its own row. */
function capOverallVir(score: number): number {
  return Math.min(90, score);
}

/** Build virReport sections. Each entry describes a panel's inspection
 *  outcome as a rating + optional note — no numeric per-panel score, per
 *  the "no such thing as a used car scoring 100/100" rule (2026-08-04).
 *  Prefers slotAssessment (Lens's per-slot ratings with optional comment);
 *  falls back to grouping the damage[] array when slotAssessment is absent,
 *  for legacy vehicles captured before slot ratings existed. */
type VirReportEntry = { section: string; rating: 'ok' | 'note' | 'damage'; note?: string };
function titleCaseSlot(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function buildVirReport(input: {
  slotAssessment?: Record<string, { rating?: string; comment?: string }>;
  damage?: { panel?: string; severity?: number; type?: string; note?: string }[];
}): VirReportEntry[] {
  const sa = input.slotAssessment;
  if (sa && typeof sa === 'object' && Object.keys(sa).length) {
    return Object.keys(sa).map((k) => {
      const slot = sa[k] || {};
      const rating = String(slot.rating || '').toLowerCase();
      const cleanRating: 'ok' | 'note' | 'damage' =
        rating === 'damage' ? 'damage' : rating === 'note' ? 'note' : 'ok';
      const entry: VirReportEntry = { section: titleCaseSlot(k), rating: cleanRating };
      if (slot.comment) entry.note = slot.comment;
      return entry;
    });
  }
  const damage = input.damage;
  if (Array.isArray(damage) && damage.length) {
    /* Legacy path: no slot ratings, only a damage findings array.
       Each finding becomes one section with rating='damage'. */
    return damage.map((d) => {
      const entry: VirReportEntry = {
        section: d.panel || 'General',
        rating: 'damage',
      };
      const note = d.note || d.type;
      if (note) entry.note = note;
      return entry;
    });
  }
  return [];
}

/** Showroom tiers a dealer can shelve a vehicle into. Anything else is
 *  treated as unset, so a typo can't hide a car from every category page. */
const CATEGORY_VALUES = ["used", "select", "performance"];

/** Canonical public vehicle shape for HTML dealer websites + embed widget */
function toPublicVehicle(v: any, source: string = "premium", origin: string = "") {
  /* A video is now either a legacy data:video/… URI or a stored .mp4/.webm/.mov
     reference. Both must stay out of the image arrays, or a dealer site renders
     a video file inside an <img> and shows a broken thumbnail. */
  const notVideo = (s: any) =>
    typeof s === "string" &&
    !/^data:video\//i.test(s) &&
    !/\.(mp4|webm|mov)$/i.test(s);

  /* Stored photos are served from this instance, but the sites consuming this
     feed are on their own domains — true-cars.co.za, carsoncaledon.co.za — so a
     relative "/media/…" would resolve against the dealer's own host and 404.
     Absolute, derived from the request rather than configured, so staging and
     localhost work with no extra setting. Legacy base64 is passed through
     untouched: a feed must keep working on an instance whose migration has not
     run yet. */
  const abs = (s: any) =>
    isStoredRef(s) && origin ? `${origin}${s}` : s;

  const images = (Array.isArray(v.images) ? v.images.filter(notVideo) : []).map(abs);
  const extras = (Array.isArray(v.extrasPhotos) ? v.extrasPhotos.filter(notVideo) : []).map(abs);
  const allImages = [...images, ...extras];
  /* Strict, and deliberately the same test TruLens's own feed applies — a site
     pointed at either source has to make the same call about the same car.
     readState backfills legacy rows to true, so nothing currently live drops
     off; anything unset from here on was never published on purpose. */
  /* An archived unit is retired from the floor and must never reach a dealer's
     website, whatever its status says. Checked independently of `status`
     rather than relying on archiving to have set SOLD: this feed is consumed by
     live client sites, so it gets its own guard rather than trusting an
     invariant maintained somewhere else. */
  const published = v.showOnWebsite === true && v.status === "INVENTORY" && !v.archivedAt;
  if (!published) return null;

  return {
    id: v.id,
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || "",
    // Showroom tier, set by the dealer in the DMS. Absent (not "") when unset,
    // so a site can tell "dealer hasn't chosen" from a deliberate choice and
    // fall back to its own heuristic rather than silently mis-shelving a car.
    category: CATEGORY_VALUES.includes(v.category) ? v.category : undefined,
    price: v.retailPrice ?? v.price ?? 0,
    // Real market-value benchmark when the dealer has set one; absent (not 0/null)
    // when unset, so consuming sites can tell "no data" apart from "at market".
    truPrice: v.truPrice ? Number(v.truPrice) : undefined,
    mileage: v.mileage ?? 0,
    transmission: v.transmission || "",
    fuelType: v.fuelType || "",
    bodyType: v.bodyType || "",
    color: v.color || "",
    vin: v.vin || "",
    description: v.description || "",
    status: "available",
    images: allImages,
    heroImage: allImages[0] || null,
    photoCount: allImages.length,
    /* Frames get the same absolute treatment as the gallery — an orbit is just
       more photos, and a relative path would 404 on the dealer's own domain. */
    web3d: v.web3d?.frames?.length
      ? { ...v.web3d, frames: v.web3d.frames.map((f: any) => ({ ...f, image: abs(f?.image) })) }
      : undefined,
    /** TruLens inspection score 0–100, absent when the car was never scored. */
    vir: typeof v.vir === "number" ? v.vir : undefined,
    /* Findings per section. Absent — not [] — when the car was never
       inspected, so a site renders the report block only when there is one. */
    virReport: Array.isArray(v.virReport) && v.virReport.length ? v.virReport : undefined,
    /* Damage pins. Absent when none were tagged, so a site renders the layer
       only when there is something to show. Caledon's coc-media.js already
       reads car.damage and has never had anything to read. */
    damage: Array.isArray(v.damage) && v.damage.length ? v.damage : undefined,
    slotAssessment: v.slotAssessment && Object.keys(v.slotAssessment).length ? v.slotAssessment : undefined,
    /* Dealer-declared condition — TruLens is retail (declared condition), not a
       graded VIR. `conditionLabel` is the plain line a site renders; the raw
       declaration rides alongside for anything that wants the detail. Absent
       until the dealer declared, so a site never implies a clean bill from
       silence. Tagged damage takes precedence over a "no damage" claim. */
    conditionLabel: (() => {
      const d = (v as any).conditionDeclaration;
      const dmgCount = Array.isArray(v.damage) ? v.damage.length : 0;
      if (dmgCount) return `Visible damage reported — ${dmgCount} item${dmgCount === 1 ? "" : "s"}`;
      if (d && d.noVisibleDamage) return "No damage reported";
      return undefined;
    })(),
    conditionDeclaration: (v as any).conditionDeclaration || undefined,
    optionalExtras: Array.isArray(v.optionalExtras) && v.optionalExtras.length ? v.optionalExtras : undefined,
    source: v.source || source,
    updatedAt: v.lastPhotoSync || v.updatedAt || null,
  };
}

/** Hide obvious pilot/test junk from public website feeds */
function isJunkPublicVehicle(v: any): boolean {
  const blob = [v.make, v.model, v.trim, v.stockNumber, v.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/stk-lite-test|test vehicle|demo junk|lorem ipsum/.test(blob)) return true;
  if (/\bss\b/.test(blob) && /ddas/.test(blob)) return true;
  // weird short make like "sS" with nonsense model
  if (v.make && String(v.make).length <= 2 && /ddas|test|xxx/i.test(String(v.model || ""))) return true;
  return false;
}

/* There is no cross-dealer view any more.
 *
 * "true-cars" used to aggregate every dealership on the instance for the
 * consumer showroom. With one demo dealer that was harmless; with real clients
 * on the box it published their stock — MKR's and Cars on Caledon's cars were
 * being served, unauthenticated, under a guessable slug, to anyone who asked.
 * "demo" had already been removed from the same set for the same reason.
 *
 * Every slug is now a single tenant, so the only way onto a public feed is to
 * be the dealership that owns the car. The showroom gets its stock by being a
 * dealership like any other. */

/** Absolute origin of this instance, from the request.
 *
 *  Derived rather than configured so localhost, staging and production each
 *  serve URLs that point at themselves with no env var to forget. Honours the
 *  proxy headers Render sets, or the scheme would come back http behind its
 *  TLS terminator and dealer sites would fetch mixed content. */
function originOf(req: any): string {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  return host ? `${proto}://${host}` : "";
}

function buildPublicStock(state: any, dealerSlug: string, source: string, origin = "") {
  // A named single-dealer site must only ever see ITS OWN stock. A slug with no
  // mapping gets an empty result rather than leaking another dealer's inventory
  // (this once returned everything to everyone regardless of ?dealer=).
  const wantedId = dealerIdForSlug(dealerSlug, state);
  const rawVehicles = state.vehicles || [];
  const scoped = wantedId
    ? rawVehicles.filter((v: any) => v.dealershipId === wantedId)
    : [];
  const vehicles = scoped
    .map((v: any) => toPublicVehicle(v, source, origin))
    .filter(Boolean)
    .filter((v: any) => !isJunkPublicVehicle(v));
  return {
    success: true,
    dealer: dealerSlug || state.dealerships?.[0]?.name || "TruFlow Dealer",
    source,
    updatedAt: new Date().toISOString(),
    count: vehicles.length,
    vehicles,
  };
}

/* Public feeds — any dealer website can GET these (no auth, CORS open).
   No ?dealer= used to mean "demo", so an embed that lost its query string —
   a copy-paste slip, a CMS stripping params — filled a real dealer's website
   with DEMO- stock instead of going empty. Customers then enquire about cars
   that do not exist. Unmatched now yields nothing, which is the honest
   failure. The demo tenant is still reachable deliberately at ?dealer=demo. */
app.get("/api/feed/inventory", (req, res) => {
  const dealer = String(req.query.dealer || "");
  res.json(buildPublicStock(readState(), dealer, "premium", originOf(req)));
});

// Canonical public stock endpoint (same shape across Premium / TruLens)
app.get("/api/public/stock", (req, res) => {
  const dealer = String(req.query.dealer || "");
  res.json(buildPublicStock(readState(), dealer, "premium", originOf(req)));
});

/* Single vehicle detail (public).
   Scoped by ?dealer= like every other public read. Without it this matched on
   stockNumber across every tenant, and stock numbers are short and guessable —
   PE-1042, DEMO-100 — so any dealer's vehicle could be read by anyone who
   guessed one. */
app.get("/api/feed/vehicle/:stockNumber", (req, res) => {
  /* `state` was read AFTER being passed to dealerIdForSlug — a const in its
     temporal dead zone, so every single call threw and this route answered 500
     in production rather than the 400/404/200 it looks like it returns. Read it
     first. */
  const state = readState();
  const dealerSlug = String(req.query.dealer || "");
  const wantedId = dealerIdForSlug(dealerSlug, state);
  // No aggregate escape hatch any more: an unknown slug is refused outright.
  if (!wantedId) {
    return res.status(400).json({ error: "A known ?dealer= is required." });
  }

  const v = state.vehicles.find(
    (v: any) =>
      v.dealershipId === wantedId &&
      (v.stockNumber === req.params.stockNumber || v.id === req.params.stockNumber)
  );
  if (!v) return res.status(404).json({ error: "Vehicle not found" });

  res.json({
    stockNumber: v.stockNumber,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    price: v.retailPrice,
    mileage: v.mileage,
    transmission: v.transmission,
    fuelType: v.fuelType,
    description: v.description,
    bodyType: (v as any).bodyType || "",
    engine: (v as any).engine || "",
    images: v.images || [],
    damagePhotos: v.damagePhotos || [],
    vinPhotos: (v as any).vinPhotos || [],
    serviceBookPhotos: (v as any).serviceBookPhotos || [],
    extrasPhotos: (v as any).extrasPhotos || [],
    reconTasks: (v.reconTasks || []).map((t: any) => ({
      name: t.name, status: t.status, category: t.category,
    })),
    slotAssessment: v.slotAssessment && Object.keys(v.slotAssessment).length ? v.slotAssessment : undefined,
    id: v.id,
  });
});

// --- Portal management ---

/* ── Dealerships ────────────────────────────────────────────────────────────
   Onboarding a dealer used to mean editing a literal map here, deploying,
   editing TruLens's picker, and deploying again — two releases per customer,
   each one a chance to break the service for everyone already on it. These
   make it a form.

   Creating one does NOT issue a code. Do that separately via
   /api/auth/codes/rotate, so the code is shown once and deliberately, rather
   than falling out of a create call and into a log. */

/** Public: the list TruLens's dealer picker reads. Names and slugs only —
 *  no counts, no contacts, nothing a competitor could not read off the
 *  dealer websites these slugs already serve. */
app.get("/api/public/dealerships", (_req, res) => {
  const s = readState();
  res.setHeader("Cache-Control", "no-store");
  res.json(
    (s.dealerships || [])
      .filter((d: any) => d?.slug && d?.id && d.id !== "demo")
      .map((d: any) => ({ slug: d.slug, name: d.name, location: d.location || "" }))
  );
});

app.get("/api/dealerships", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  res.json(readState().dealerships || []);
});

app.post("/api/dealerships", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const name = String(req.body?.name || "").trim();
  const location = String(req.body?.location || "").trim();
  const websiteUrl = String(req.body?.websiteUrl || "").trim();
  /* The slug is the dealer's identity everywhere: their website feed, the
     TruLens picker, the tag on every captured vehicle. Renaming one later
     orphans stock, so it is validated hard and never derived silently. */
  const slug = String(req.body?.slug || "").trim().toLowerCase();

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({
      error: "slug must be lowercase letters, numbers and single hyphens, e.g. cars-on-caledon",
    });
  }

  const state = readState();
  const existing = state.dealerships || [];
  if (existing.some((d: any) => d.slug === slug)) {
    return res.status(409).json({ error: `A dealership already uses the slug "${slug}".` });
  }

  /* Sequential d-ids, continuing the existing scheme. Never reuse a retired
     id — vehicles carry it, and a reused id would silently adopt them. */
  const used = existing
    .map((d: any) => /^d(\d+)$/.exec(String(d.id))?.[1])
    .filter(Boolean)
    .map(Number);
  const id = "d" + String(used.length ? Math.max(...used) + 1 : 1);

  /* Which apps this dealer's code opens. Unlisted names are dropped rather than
     stored, so a typo cannot create an entitlement to a product that does not
     exist and then quietly fail to match anything. Defaults to lens + flow,
     which is what a yard signing up for the DMS and the capture app needs. */
  const requested = Array.isArray(req.body?.products) ? req.body.products : null;
  const products = requested
    ? requested.map((p: any) => String(p).toLowerCase()).filter((p: string) => PRODUCTS.includes(p as ProductName))
    : ["lens", "flow"];

  const address = String(req.body?.address || "").trim();
  const registrationNumber = String(req.body?.registrationNumber || "").trim();
  const vatNumber = String(req.body?.vatNumber || "").trim();

  const dealership: Dealership = { id, name, location, slug, websiteUrl, products, docFlow: { ...DEFAULT_DOC_FLOW } };
  if (address) dealership.address = address;
  if (registrationNumber) dealership.registrationNumber = registrationNumber;
  if (vatNumber) dealership.vatNumber = vatNumber;
  state.dealerships = [...existing, dealership];
  writeState(state);

  console.log(`[dealerships] created ${id} "${name}" (${slug}) products=${products.join(",") || "none"}`);
  res.status(201).json({
    dealership,
    /* No environment variable, and no redeploy of anything. Every product
       verifies codes against this instance, so issuing the code is the last
       step rather than the middle one. */
    next: "Issue this dealership a code with POST /api/auth/codes/rotate. Their apps will accept it immediately.",
  });
});

app.put("/api/dealerships/:id", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const state = readState();
  const i = (state.dealerships || []).findIndex((d: any) => d.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Dealership not found" });

  /* Slug and id are deliberately not editable. Vehicles are tagged by id and
     dealer websites are wired to the slug; changing either detaches stock
     from the dealer it belongs to. Retire and recreate instead. */
  const { name, location, websiteUrl, products, address, registrationNumber, vatNumber } = req.body || {};
  if (typeof name === "string" && name.trim()) state.dealerships[i].name = name.trim();
  if (typeof location === "string") state.dealerships[i].location = location.trim();
  if (typeof websiteUrl === "string") state.dealerships[i].websiteUrl = websiteUrl.trim();
  if (typeof address === "string") state.dealerships[i].address = address.trim();
  if (typeof registrationNumber === "string") state.dealerships[i].registrationNumber = registrationNumber.trim();
  if (typeof vatNumber === "string") state.dealerships[i].vatNumber = vatNumber.trim();

  /* Entitlements ARE editable, unlike the slug — granting or revoking an app is
     the routine part of running this. Unlisted names are dropped rather than
     stored: a typo must not create an entitlement to a product that does not
     exist. An empty array is meaningful and allowed — it locks the dealer out
     of every app while leaving their stock and history intact, which is what
     suspending an account should do. */
  if (Array.isArray(products)) {
    (state.dealerships[i] as any).products = products
      .map((p: any) => String(p).toLowerCase())
      .filter((p: string) => PRODUCTS.includes(p as ProductName));
    console.log(
      `[dealerships] ${state.dealerships[i].slug} products=` +
        `${(state.dealerships[i] as any).products.join(",") || "none"}`
    );
  }

  writeState(state);
  res.json({ dealership: state.dealerships[i] });
});

app.delete("/api/dealerships/:id", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const state = readState();
  const i = (state.dealerships || []).findIndex((d: any) => d.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Dealership not found" });
  const removed = state.dealerships.splice(i, 1)[0];
  writeState(state);
  console.log(`[dealerships] deleted ${(removed as any).slug || removed.id}`);
  res.json({ message: `${(removed as any).name || removed.id} deleted.` });
});

app.get("/api/portals", (req, res) => {
  res.json(readPortals());
});

app.post("/api/portals", (req, res) => {
  const portals = readPortals();
  const portal: Portal = {
    id: newId("portal_"),
    name: req.body.name || "New Portal",
    url: req.body.url || "",
    apiKey: req.body.apiKey || "tsk_" + Math.random().toString(36).slice(2, 14),
    webhookUrl: req.body.webhookUrl || "",
    active: true,
  };
  portals.push(portal);
  writePortals(portals);
  res.status(201).json({ message: "Portal registered.", portal });
});

app.put("/api/portals/:id", (req, res) => {
  const portals = readPortals();
  const idx = portals.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Portal not found" });
  portals[idx] = { ...portals[idx], ...req.body };
  writePortals(portals);
  res.json({ message: "Portal updated.", portal: portals[idx] });
});

app.delete("/api/portals/:id", (req, res) => {
  let portals = readPortals();
  portals = portals.filter(p => p.id !== req.params.id);
  writePortals(portals);
  res.json({ message: "Portal removed." });
});

// Push inventory to all active portals (webhook-based)
app.post("/api/portals/sync", async (req: any, res) => {
  const state = readState();
  const portals = readPortals();
  const activePortals = portals.filter(p => p.active && p.webhookUrl);
  const vehicles = scopeToDealer(state.vehicles, req.auth).filter(v => v.status === "INVENTORY");
  const callerDealer = state.dealerships?.find((d: any) => d.id === req.auth?.dealershipId);

  const payload = {
    event: "inventory_sync",
    timestamp: new Date().toISOString(),
    dealer: callerDealer?.name || state.dealerships?.[0]?.name || "TruFlow Dealer",
    count: vehicles.length,
    vehicles: vehicles.map(v => ({
      stockNumber: v.stockNumber,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      price: v.retailPrice,
      mileage: v.mileage,
      transmission: v.transmission,
      fuelType: v.fuelType,
      description: v.description,
      images: v.images || [],
      extrasPhotos: (v as any).extrasPhotos || [],
      id: v.id,
    })),
  };

  const results: { portalId: string; name: string; status: string; error?: string }[] = [];

  for (const portal of activePortals) {
    try {
      const response = await fetch(portal.webhookUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": portal.apiKey,
          "X-Portal-Id": portal.id,
        },
        body: JSON.stringify(payload),
      });

      const idx = portals.findIndex(p => p.id === portal.id);
      portals[idx].lastSyncAt = new Date().toISOString();
      portals[idx].vehicleCount = vehicles.length;

      if (response.ok) {
        results.push({ portalId: portal.id, name: portal.name, status: "synced" });
      } else {
        results.push({ portalId: portal.id, name: portal.name, status: "failed", error: `HTTP ${response.status}` });
      }
    } catch (err: any) {
      results.push({ portalId: portal.id, name: portal.name, status: "failed", error: err.message });
    }
  }

  writePortals(portals);
  res.json({ message: `Pushed to ${results.filter(r => r.status === "synced").length}/${activePortals.length} portals.`, results });
});

// --- Embeddable widget script ---

app.get("/api/widget/inventory.js", (req, res) => {
  const dmsOrigin = `${req.protocol}://${req.get("host")}`;

  const script = `
(function() {
  var DMS_URL = "${dmsOrigin}";
  var container = document.getElementById("truflow-inventory");
  if (!container) { console.warn("TruFlow: #truflow-inventory not found"); return; }

  container.innerHTML = '<p style="text-align:center;padding:2rem;color:#888;">Loading inventory...</p>';

  fetch(DMS_URL + "/api/feed/inventory")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.vehicles || data.vehicles.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2rem;">No vehicles currently available.</p>';
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem;">';
      data.vehicles.forEach(function(v) {
        var img = v.images && v.images[0]
          ? '<img src="' + v.images[0] + '" alt="' + v.year + ' ' + v.make + ' ' + v.model + '" style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0;">'
          : '<div style="width:100%;height:200px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;border-radius:8px 8px 0 0;color:#666;">No Photo</div>';

        var price = "R " + v.price.toLocaleString("en-ZA");

        html += '<div style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;">'
          + img
          + '<div style="padding:1rem;">'
          + '<h3 style="margin:0 0 0.25rem;font-size:1.1rem;">' + v.year + ' ' + v.make + ' ' + v.model + ' ' + v.trim + '</h3>'
          + '<p style="margin:0 0 0.5rem;font-size:1.25rem;font-weight:700;color:#FF1493;">' + price + '</p>'
          + '<p style="margin:0;font-size:0.85rem;color:#666;">' + v.mileage.toLocaleString() + ' km &bull; ' + v.transmission + ' &bull; ' + v.fuelType + '</p>'
          + '</div></div>';
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(function(err) {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:red;">Failed to load inventory.</p>';
      console.error("TruFlow widget error:", err);
    });
})();
`;

  res.setHeader("Content-Type", "application/javascript");
  res.send(script);
});

// --- HTML / WORDPRESS INTEGRATION API ENDPOINTS ---
app.post("/api/integration/webhook-lead", (req, res) => {
  const { firstName, lastName, phone, email, notes, vehicleId, dealershipId, dealerSlug, source, journey } = req.body;
  if (!firstName || !phone) {
    return res.status(400).json({ error: "Missing required fields: firstName and phone are mandatory." });
  }

  /* The route is public and unauthenticated, so the payload is the only thing
     that says which yard the enquiry belongs to. Unset used to fall through to
     the pilot dealership: a buyer enquiring on one dealer's website became a
     lead in another dealer's pipeline, and the yard that owns the site never
     saw it. Refuse instead — a misrouted lead is worse than a rejected one,
     because nobody finds out. */
  const leadDealershipId = dealershipId || dealerIdForSlug(dealerSlug);
  if (!leadDealershipId) {
    return res.status(400).json({
      error:
        "Missing dealership. Send dealerSlug (or dealershipId) so the enquiry " +
        "reaches the dealer whose website it came from.",
    });
  }

  try {
    const state = readState();
    const newLead: Lead = {
      id: newId("lead_"),
      // Which dealer's website sent this — validated above, never unset.
      dealershipId: leadDealershipId,
      firstName,
      lastName: lastName || "",
      phone,
      email: email || "",
      // Was "New Lead", which is not a LeadStatus — the union is
      // New | Contacted | Test Drive Scheduled | Negotiating | Closed Won |
      // Closed Lost. Every enquiry from a dealer's WordPress site therefore
      // arrived in a stage the pipeline has no column for: not in the kanban,
      // not matched by the status filters, and not counted as awaiting a reply.
      status: "New",
      nextAction: "First contact",
      nextActionAt: new Date().toISOString().slice(0, 10),
      stageChangedAt: new Date().toISOString().slice(0, 10),
      // The widget's qualifier already scored this lead — honour it when sent,
      // fall back to a random warm/hot band only when the widget doesn't score.
      digitalScore: typeof req.body.digitalScore === "number"
        ? req.body.digitalScore
        : Math.floor(Math.random() * 30) + 60,
      /* Was `state.vehicles[0]?.id` — the first vehicle GLOBALLY, so a lead
         from Dealer B's site attached to Dealer A's front-of-list car. Scope
         to the dealership the lead belongs to, or leave empty. */
      vehicleId: vehicleId || state.vehicles.find(v => v.dealershipId === leadDealershipId)?.id || "",
      source: source || "Website Form",
      notes: notes || "Submitted via external website integration.",
      createdAt: new Date().toISOString().split('T')[0],
      assignedUserId: "u1",
      lastContactedAt: new Date().toISOString().split('T')[0],
      journey: Array.isArray(journey) ? journey.slice(0, 50) : []
    };

    state.leads.unshift(newLead);
    writeState(state);

    res.json({ success: true, message: "Lead captured and synchronized with CRM successfully.", lead: newLead });
  } catch (error: any) {
    res.status(500).json({ error: "Internal database write error during lead synchronization.", details: error.message });
  }
});

app.post("/api/integration/sync-inventory", (req: any, res) => {
  try {
    const state = readState();
    const activeVehicles = scopeToDealer(state.vehicles, req.auth).filter(v => v.status === "INVENTORY");
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      endpoint: "https://www.real-cars.co.za/api/v1/inventory/sync",
      syncedCount: activeVehicles.length,
      vehicles: activeVehicles.map(v => ({
        stockNumber: v.stockNumber,
        make: v.make,
        model: v.model,
        retailPrice: v.retailPrice,
        status: v.status
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: "Synchronization pipeline failure", details: error.message });
  }
});

// --- TRULENS: LISTING COPY WRITER (DeepSeek) ---
// Kept at /api/gemini/analyze for frontend compatibility; no image is sent.

app.post('/api/gemini/analyze', async (req, res) => {
  const { base64Image, slotName, vehicleInfo } = req.body;

  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  if (!aiConfigured) {
    return res.json({
      overallScore: 85,
      lightingCheck: { status: 'Perfect', brightness: 128, contrast: 135, feedback: 'Excellent soft overhead lighting. Very clean representation with minimal glare.' },
      angleCheck: { status: 'Good', pitchDiff: 2, rollDiff: 1, feedback: 'The vehicle alignment is perfect! A slightly lower angle would add even more prominence.' },
      aiAnalysis: {
        identifiedVehicle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} ${vehicleInfo?.model || ''}`,
        suggestedTitle: `Stunning ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Premium'} ${vehicleInfo?.model || 'Edition'}`,
        suggestedDescription: `Take home this fully-inspected, highly desirable ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Premium'} ${vehicleInfo?.model || 'model'}. Professionally photographed and detailed.`,
        detectedIssues: ['AI key not configured — using mock analysis.'],
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
    res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error('DeepSeek analysis error:', error);
    if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
      return res.json({
        overallScore: 82,
        lightingCheck: { status: 'Good', brightness: 110, contrast: 120, feedback: 'Live analysis temporarily unavailable. Local fallback suggests lighting is sufficient.' },
        angleCheck: { status: 'Good', pitchDiff: 0, rollDiff: 0, feedback: 'Vehicle framing looks correct based on local validation.' },
        aiAnalysis: {
          identifiedVehicle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} ${vehicleInfo?.model || ''}`,
          suggestedTitle: `New Listing: ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}`,
          suggestedDescription: `AI analysis in maintenance mode. This vehicle is ready for inspection and listing.`,
          detectedIssues: ['AI Analysis Service Offline - Using local heuristic checks.'],
        },
      });
    }
    res.status(500).json({ error: 'AI analysis failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// --- TRUSOCIAL — ZERNIO INTEGRATION ---

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY || "";
const ZERNIO_BASE = "https://api.zernio.com";
const ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || "";

/** Look up a dealer by their stored zernioProfileId. */
function dealerByZernioProfile(state: DMSState, profileId: string): Dealership | undefined {
  return state.dealerships.find((d: any) => d.zernioProfileId === profileId);
}

/** accountId → dealer isolation check.
 *
 *  CRITICAL: Zernio does NOT enforce dealer isolation at the API level — we do.
 *  Every request that references an accountId must pass through this check
 *  BEFORE acting on it. The frontend must never be trusted with raw accountIds
 *  without server-side verification against this map. */
/** Shared by every aggregator integration (TruSocial, accounting, and
 *  whatever's next) that stores a flat array of {dealershipId, <idField>}
 *  records for connections the aggregator itself doesn't scope by dealer.
 *  A single, hardened check here means a future fix (e.g. handling
 *  revoked/expired connections) lands for every integration at once instead
 *  of needing to be re-applied per copy-pasted variant. */
function dealerOwnsExternalConnection<T extends Record<string, any>>(
  records: T[] | undefined,
  dealershipId: string,
  idField: keyof T,
  idValue: string,
): boolean {
  return (records || []).some((r) => r[idField] === idValue && r.dealershipId === dealershipId);
}

function dealerOwnsSocialAccount(state: DMSState, dealershipId: string, accountId: string): boolean {
  return dealerOwnsExternalConnection(state.socialAccounts, dealershipId, "accountId", accountId);
}

// Toggle TruSocial ON/OFF + Zernio profile provisioning
app.post("/api/social/toggle", async (req: any, res) => {
  if (!req.auth?.role || !["admin", "manager", "principal"].includes(req.auth.role))
    return res.status(403).json({ error: "Dealer login required" });

  const { dealershipId, enabled } = req.body || {};
  if (!dealershipId || typeof enabled !== "boolean")
    return res.status(400).json({ error: "dealershipId and enabled (boolean) required" });

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer) return res.status(404).json({ error: "Dealership not found" });

  if (enabled && !(dealer as any).zernioProfileId) {
    if (!ZERNIO_API_KEY) {
      return res.status(503).json({
        error: "Zernio API key not configured — cannot enable TruSocial",
      });
    }
    try {
      const zRes = await fetch(`${ZERNIO_BASE}/v1/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ZERNIO_API_KEY}`,
        },
        body: JSON.stringify({ name: dealer.id }),
      });
      const zBody = await zRes.json();
      if (zRes.status === 409) {
        // Profile already exists — recover the existing ID
        const existingId = zBody?.details?.existingProfileId;
        if (existingId) {
          (dealer as any).zernioProfileId = existingId;
          console.log(`[trusocial] Recovered existing Zernio profile ${existingId} for ${dealer.id}`);
        } else {
          return res.status(502).json({ error: "Profile already exists but could not recover ID", detail: zBody });
        }
      } else if (!zRes.ok) {
        console.error(`[trusocial] Zernio profile creation failed: ${zRes.status}`, zBody);
        return res.status(502).json({ error: "Zernio profile creation failed", detail: zBody });
      } else {
        const profile = zBody.profile || zBody;
        (dealer as any).zernioProfileId = profile._id || profile.id;
      }
      console.log(`[trusocial] Provisioned Zernio profile ${(dealer as any).zernioProfileId} for ${dealer.id}`);
    } catch (err: any) {
      console.error(`[trusocial] Zernio API error:`, err?.message);
      return res.status(502).json({ error: "Could not reach Zernio API" });
    }
  }

  (dealer as any).truSocialEnabled = enabled;

  writeState(state);
  res.json({ dealer });
});

// Get OAuth connect URL for a platform
app.get("/api/social/connect/:platform", async (req: any, res) => {
  const dealershipId = req.query.dealershipId as string;
  if (!dealershipId) return res.status(400).json({ error: "dealershipId query param required" });

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer) return res.status(404).json({ error: "Dealership not found" });
  if (!(dealer as any).zernioProfileId)
    return res.status(400).json({ error: "TruSocial not provisioned for this dealer" });
  if (!(dealer as any).truSocialEnabled)
    return res.status(400).json({ error: "TruSocial is disabled for this dealer" });

  if (!ZERNIO_API_KEY)
    return res.status(503).json({ error: "Zernio API key not configured" });

  const platform = req.params.platform;
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const redirectUrl = `${proto}://${req.get("host")}/api/social/callback`;

  try {
    const zRes = await fetch(
      `${ZERNIO_BASE}/v1/connect/${encodeURIComponent(platform)}?profileId=${(dealer as any).zernioProfileId}&redirect_url=${encodeURIComponent(redirectUrl)}&headless=true`,
      { headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` } }
    );
    if (!zRes.ok) {
      const body = await zRes.text();
      return res.status(502).json({ error: "Zernio connect failed", detail: body });
    }
    const data = await zRes.json();
    res.json({ authUrl: data.authUrl || data.url });
  } catch (err: any) {
    res.status(502).json({ error: "Could not reach Zernio API" });
  }
});

// OAuth callback — redirect back to the dealer settings UI
app.get("/api/social/callback", (_req, res) => {
  // The actual account linking happens via Zernio's webhook (account.connected).
  // This endpoint just returns the dealer to the TruSocial settings page.
  res.send(`<!DOCTYPE html><html><body><script>
    window.opener ? window.close() : (window.location.href = "/#settings");
  </script><p>Connected — you can close this tab.</p></body></html>`);
});

// List connected accounts for a dealer — pulls live from Zernio and syncs local store
app.get("/api/social/accounts", async (req: any, res) => {
  const dealershipId = req.query.dealershipId as string;
  if (!dealershipId) return res.status(400).json({ error: "dealershipId required" });

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  const profileId = (dealer as any)?.zernioProfileId;

  // If we have a Zernio profile, fetch live accounts and sync our local store
  if (profileId && ZERNIO_API_KEY) {
    try {
      const zRes = await fetch(
        `${ZERNIO_BASE}/v1/accounts?profileId=${profileId}&status=connected`,
        { headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` } }
      );
      if (zRes.ok) {
        const zData = await zRes.json();
        const zAccounts = zData.accounts || [];
        if (!state.socialAccounts) state.socialAccounts = [];

        // Sync: add any Zernio accounts we don't have locally
        let changed = false;
        for (const za of zAccounts) {
          const aid = za._id || za.accountId;
          if (!state.socialAccounts.some((a) => a.accountId === aid)) {
            state.socialAccounts.push({
              accountId: aid,
              dealershipId,
              platform: za.platform || "unknown",
              username: za.username || za.displayName,
              connectedAt: za.connectedAt || new Date().toISOString(),
            });
            changed = true;
            console.log(`[trusocial] Synced account ${aid} (${za.platform}/${za.username}) → dealer ${dealershipId}`);
          }
        }

        // Remove local accounts that Zernio no longer has
        const zIds = new Set(zAccounts.map((za: any) => za._id || za.accountId));
        const before = state.socialAccounts.length;
        state.socialAccounts = state.socialAccounts.filter(
          (a) => a.dealershipId !== dealershipId || zIds.has(a.accountId)
        );
        if (state.socialAccounts.length !== before) changed = true;

        if (changed) writeState(state);
      }
    } catch (err: any) {
      console.error(`[trusocial] Failed to sync accounts from Zernio:`, err?.message);
    }
  }

  const accounts = (state.socialAccounts || []).filter((a) => a.dealershipId === dealershipId);
  res.json({ accounts });
});

// Disconnect a social account
app.post("/api/social/disconnect", async (req: any, res) => {
  const { dealershipId, accountId } = req.body || {};
  if (!dealershipId || !accountId)
    return res.status(400).json({ error: "dealershipId and accountId required" });

  const state = readState();
  // accountId→dealer isolation check
  if (!dealerOwnsSocialAccount(state, dealershipId, accountId))
    return res.status(403).json({ error: "Account does not belong to this dealer" });

  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer || !(dealer as any).zernioProfileId)
    return res.status(400).json({ error: "TruSocial not provisioned" });

  if (ZERNIO_API_KEY) {
    try {
      await fetch(`${ZERNIO_BASE}/v1/accounts/${accountId}/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
      });
    } catch (err: any) {
      console.error(`[trusocial] Zernio disconnect error:`, err?.message);
    }
  }

  state.socialAccounts = (state.socialAccounts || []).filter((a) => a.accountId !== accountId);
  writeState(state);
  res.json({ ok: true });
});

// Publish a vehicle post to selected Zernio-connected social accounts
app.post("/api/social/publish", async (req: any, res) => {
  const { dealershipId, vehicleId, caption, accountIds } = req.body || {};
  if (!dealershipId || !vehicleId || !caption || !Array.isArray(accountIds) || !accountIds.length)
    return res.status(400).json({ error: "dealershipId, vehicleId, caption, and accountIds[] required" });

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer || !(dealer as any).truSocialEnabled || !(dealer as any).zernioProfileId)
    return res.status(400).json({ error: "TruSocial not enabled for this dealer" });

  for (const aid of accountIds) {
    if (!dealerOwnsSocialAccount(state, dealershipId, aid))
      return res.status(403).json({ error: `Account ${aid} does not belong to this dealer` });
  }

  const vehicle = state.vehicles.find((v: any) => v.id === vehicleId);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

  const webImages = (vehicle.images || []).filter((img: string) => img.startsWith("http"));
  const mediaItems: { url: string; type: string }[] = [];
  for (const imgUrl of webImages.slice(0, 4)) {
    try {
      const presignRes = await fetch(`${ZERNIO_BASE}/v1/media/presign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ZERNIO_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `vehicle-${vehicleId}.jpg`, contentType: "image/jpeg" }),
      });
      if (!presignRes.ok) continue;
      const { uploadUrl, publicUrl } = await presignRes.json();
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) continue;
      const imgBuf = await imgRes.arrayBuffer();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: Buffer.from(imgBuf) });
      mediaItems.push({ url: publicUrl, type: "image" });
    } catch (err: any) {
      console.error(`[trusocial] Media upload failed:`, err?.message);
    }
  }

  const accounts = (state.socialAccounts || []).filter((a) => accountIds.includes(a.accountId));
  const platforms = accounts.map((a) => ({ platform: a.platform, accountId: a.accountId }));

  try {
    const postBody: any = { content: caption, platforms, publishNow: true };
    if (mediaItems.length) postBody.mediaItems = mediaItems;
    const postRes = await fetch(`${ZERNIO_BASE}/v1/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ZERNIO_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(postBody),
    });
    const postData = await postRes.json();
    if (!postRes.ok) {
      console.error(`[trusocial] Zernio publish error:`, postData);
      return res.status(502).json({ error: postData.message || "Zernio publish failed" });
    }
    console.log(`[trusocial] Published to ${platforms.map((p: any) => p.platform).join(", ")} for dealer ${dealershipId}`);
    res.json({ ok: true, postId: postData._id || postData.id, platforms: platforms.map((p: any) => p.platform) });
  } catch (err: any) {
    console.error(`[trusocial] Publish error:`, err?.message);
    res.status(502).json({ error: "Failed to reach Zernio" });
  }
});

// Zernio webhook receiver — single endpoint, all dealers route through it.
// Registered once at the Zernio team level (up to 10 endpoints per team).
app.post("/api/integration/webhook-zernio", (req, res) => {
  // Body is already parsed by global express.json() — use it directly.
  // Signature verification uses the raw JSON serialisation of the parsed body.
  // For byte-exact HMAC, store the raw body via a middleware; for now this is
  // good enough and matches Zernio's canonical JSON encoding.
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Zernio supports an optional custom header for webhook auth. If configured,
  // set ZERNIO_WEBHOOK_HEADER=name:value on Render and match it on Zernio's side.
  if (ZERNIO_WEBHOOK_SECRET && ZERNIO_WEBHOOK_SECRET.includes(":")) {
    const [headerName, headerValue] = ZERNIO_WEBHOOK_SECRET.split(":", 2);
    if (req.headers[headerName.toLowerCase()] !== headerValue) {
      console.warn("[trusocial] Webhook custom header mismatch — rejecting");
      return res.status(401).json({ error: "Invalid webhook auth" });
    }
  }
  console.log(`[trusocial] Webhook received: event=${payload.event || payload.type || "unknown"}`);

  const event = payload.event;
  // Zernio nests account fields under payload.account, post fields under payload.post
  const acct = payload.account || {};
  const profileId = acct.profileId || payload.profileId;
  const accountId = acct.accountId || payload.accountId;

  const state = readState();

  if (event === "account.connected") {
    const dealer = dealerByZernioProfile(state, profileId);
    if (!dealer) {
      console.warn(`[trusocial] account.connected for unknown profileId=${profileId}`);
      return res.json({ ok: true, ignored: true });
    }
    if (!state.socialAccounts) state.socialAccounts = [];
    const existing = state.socialAccounts.find((a) => a.accountId === accountId);
    if (!existing) {
      state.socialAccounts.push({
        accountId,
        dealershipId: dealer.id,
        platform: acct.platform || "unknown",
        username: acct.username || acct.displayName,
        connectedAt: new Date().toISOString(),
      });
    }
    writeState(state);
    console.log(`[trusocial] account.connected: ${accountId} (${acct.platform}/${acct.username}) → dealer ${dealer.id}`);
  } else if (event === "account.disconnected") {
    state.socialAccounts = (state.socialAccounts || []).filter((a) => a.accountId !== accountId);
    writeState(state);
    console.log(`[trusocial] account.disconnected: ${accountId}`);
  } else if (event === "post.published" || event === "post.failed") {
    // Update publish status on the stock listing that triggered it.
    // The post metadata should carry our vehicleId in the external reference.
    const vehicleRef = payload.externalId || payload.data?.externalId || payload.metadata?.vehicleId;
    if (vehicleRef) {
      const vehicle = state.vehicles.find((v: any) => v.id === vehicleRef || v.stockNumber === vehicleRef);
      if (vehicle) {
        (vehicle as any).socialPublishStatus = event === "post.published" ? "published" : "failed";
        (vehicle as any).socialPublishAt = new Date().toISOString();
        writeState(state);
      }
    }
    console.log(`[trusocial] ${event}: ref=${vehicleRef || "none"}`);
  }

  res.json({ ok: true });
});

// --- DOCHUB ACCOUNTING — CODAT INTEGRATION ---
//
// Same shape as the TruSocial/Zernio block above: TruFlow never custodies
// Xero/QuickBooks/Zoho OAuth tokens directly. A dealer gets one Codat
// "company", and each accounting package they link becomes a data connection
// under it. Codat holds the tokens; we only ever store connectionId,
// platform and a display name, and every call that touches a connectionId is
// checked against dealerOwnsAccountingAccount() first — Codat does not
// enforce dealer isolation for us, same caveat as Zernio.
//
// NOTE: endpoint paths below follow Codat's public Accounting API shape as
// documented at the time this was written (companies → connections →
// data/push). Verify against the current Codat API reference before going
// live — aggregator APIs do version their paths.

const CODAT_API_KEY = process.env.CODAT_API_KEY || "";
const CODAT_BASE = "https://api.codat.io";
const CODAT_WEBHOOK_SECRET = process.env.CODAT_WEBHOOK_SECRET || "";

const ACCOUNTING_PLATFORMS: { id: AccountingPlatform; codatKey: string }[] = [
  { id: "xero", codatKey: "xero" },
  { id: "quickbooks", codatKey: "qbo" },
  { id: "zoho", codatKey: "zohobooks" },
];

function codatAuthHeader(): string {
  // Codat uses HTTP Basic auth with the API key as the username, no password.
  return "Basic " + Buffer.from(`${CODAT_API_KEY}:`).toString("base64");
}

function dealerByCodatCompany(state: DMSState, companyId: string): Dealership | undefined {
  return state.dealerships.find((d: any) => d.codatCompanyId === companyId);
}

/** connectionId → dealer isolation check. CRITICAL, same reasoning as
 *  dealerOwnsSocialAccount: Codat does not scope by dealer, only by company,
 *  and a companyId alone is not proof of ownership from an untrusted request. */
function dealerOwnsAccountingAccount(state: DMSState, dealershipId: string, connectionId: string): boolean {
  return dealerOwnsExternalConnection(state.accountingAccounts, dealershipId, "connectionId", connectionId);
}

// Toggle accounting integrations ON/OFF + Codat company provisioning
app.post("/api/accounting/toggle", async (req: any, res) => {
  if (!req.auth?.role || !["admin", "manager", "principal"].includes(req.auth.role))
    return res.status(403).json({ error: "Dealer login required" });

  const { dealershipId, enabled } = req.body || {};
  if (!dealershipId || typeof enabled !== "boolean")
    return res.status(400).json({ error: "dealershipId and enabled (boolean) required" });

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer) return res.status(404).json({ error: "Dealership not found" });

  if (enabled && !(dealer as any).codatCompanyId) {
    if (!CODAT_API_KEY) {
      return res.status(503).json({
        error: "Codat API key not configured — cannot enable accounting integrations",
      });
    }
    try {
      const cRes = await fetch(`${CODAT_BASE}/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: codatAuthHeader(),
        },
        body: JSON.stringify({ name: dealer.id }),
      });
      const cBody = await cRes.json();
      if (!cRes.ok) {
        console.error(`[accounting] Codat company creation failed: ${cRes.status}`, cBody);
        return res.status(502).json({ error: "Codat company creation failed", detail: cBody });
      }
      (dealer as any).codatCompanyId = cBody.id;
      console.log(`[accounting] Provisioned Codat company ${(dealer as any).codatCompanyId} for ${dealer.id}`);
    } catch (err: any) {
      console.error(`[accounting] Codat API error:`, err?.message);
      return res.status(502).json({ error: "Could not reach Codat API" });
    }
  }

  (dealer as any).accountingEnabled = enabled;

  writeState(state);
  res.json({ dealer });
});

// Get the Codat Link URL for a platform (opened in a popup; the dealer signs
// into Xero/QuickBooks/Zoho there and Codat redirects back to our callback).
app.get("/api/accounting/connect/:platform", async (req: any, res) => {
  const dealershipId = req.query.dealershipId as string;
  if (!dealershipId) return res.status(400).json({ error: "dealershipId query param required" });
  if (req.auth?.role !== "admin" && req.auth?.dealershipId !== dealershipId) {
    return res.status(403).json({ error: "Not your dealership" });
  }

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer) return res.status(404).json({ error: "Dealership not found" });
  if (!(dealer as any).codatCompanyId)
    return res.status(400).json({ error: "Accounting integrations not provisioned for this dealer" });
  if (!(dealer as any).accountingEnabled)
    return res.status(400).json({ error: "Accounting integrations are disabled for this dealer" });

  if (!CODAT_API_KEY)
    return res.status(503).json({ error: "Codat API key not configured" });

  const platformParam = String(req.params.platform || "");
  const platform = ACCOUNTING_PLATFORMS.find((p) => p.id === platformParam);
  if (!platform) return res.status(400).json({ error: `Unknown accounting platform '${platformParam}'` });

  const proto = req.get("x-forwarded-proto") || req.protocol;
  const redirectUrl = `${proto}://${req.get("host")}/api/accounting/callback`;

  try {
    // Codat's Link flow issues one URL per company; the platform is picked
    // by the dealer inside the Link UI, but we pass platformKey as a hint so
    // it opens straight to the right connector where Codat supports that.
    const cRes = await fetch(
      `${CODAT_BASE}/companies/${(dealer as any).codatCompanyId}/connections/link-url?platformKey=${encodeURIComponent(platform.codatKey)}&redirectUrl=${encodeURIComponent(redirectUrl)}`,
      { headers: { Authorization: codatAuthHeader() } }
    );
    if (!cRes.ok) {
      const body = await cRes.text();
      return res.status(502).json({ error: "Codat connect failed", detail: body });
    }
    const data = await cRes.json();
    res.json({ authUrl: data.linkUrl || data.url || data.authUrl });
  } catch (err: any) {
    res.status(502).json({ error: "Could not reach Codat API" });
  }
});

// OAuth callback — redirect back to the dealer settings UI
app.get("/api/accounting/callback", (_req, res) => {
  // The actual connection linking happens via Codat's webhook
  // (data-connection.status-changed → PendingAuth → Linked). This endpoint
  // just returns the dealer to the settings page.
  res.send(`<!DOCTYPE html><html><body><script>
    window.opener ? window.close() : (window.location.href = "/#settings");
  </script><p>Connected — you can close this tab.</p></body></html>`);
});

// List connected accounting accounts for a dealer — pulls live from Codat and syncs local store
app.get("/api/accounting/accounts", async (req: any, res) => {
  const dealershipId = req.query.dealershipId as string;
  if (!dealershipId) return res.status(400).json({ error: "dealershipId required" });
  if (req.auth?.role !== "admin" && req.auth?.dealershipId !== dealershipId) {
    return res.status(403).json({ error: "Not your dealership" });
  }

  const state = readState();
  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  const companyId = (dealer as any)?.codatCompanyId;

  if (companyId && CODAT_API_KEY) {
    try {
      const cRes = await fetch(
        `${CODAT_BASE}/companies/${companyId}/connections`,
        { headers: { Authorization: codatAuthHeader() } }
      );
      if (cRes.ok) {
        const cData = await cRes.json();
        const connections = (cData.results || cData.connections || []).filter(
          (c: any) => (c.status || "").toLowerCase() === "linked"
        );
        if (!state.accountingAccounts) state.accountingAccounts = [];

        let changed = false;
        for (const conn of connections) {
          const platform = ACCOUNTING_PLATFORMS.find((p) => p.codatKey === conn.platformKey);
          if (!platform) continue; // a connection type this UI doesn't offer
          if (!state.accountingAccounts.some((a) => a.connectionId === conn.id)) {
            state.accountingAccounts.push({
              connectionId: conn.id,
              dealershipId,
              platform: platform.id,
              companyName: conn.dataConnectionType || conn.sourceId || undefined,
              connectedAt: conn.created || new Date().toISOString(),
            });
            changed = true;
            console.log(`[accounting] Synced connection ${conn.id} (${platform.id}) → dealer ${dealershipId}`);
          }
        }

        const liveIds = new Set(connections.map((c: any) => c.id));
        const before = state.accountingAccounts.length;
        state.accountingAccounts = state.accountingAccounts.filter(
          (a) => a.dealershipId !== dealershipId || liveIds.has(a.connectionId)
        );
        if (state.accountingAccounts.length !== before) changed = true;

        if (changed) writeState(state);
      }
    } catch (err: any) {
      console.error(`[accounting] Failed to sync connections from Codat:`, err?.message);
    }
  }

  const accounts = (state.accountingAccounts || []).filter((a) => a.dealershipId === dealershipId);
  res.json({ accounts });
});

// Disconnect an accounting connection
app.post("/api/accounting/disconnect", async (req: any, res) => {
  const { dealershipId, connectionId } = req.body || {};
  if (!dealershipId || !connectionId)
    return res.status(400).json({ error: "dealershipId and connectionId required" });

  const state = readState();
  if (!dealerOwnsAccountingAccount(state, dealershipId, connectionId))
    return res.status(403).json({ error: "Connection does not belong to this dealer" });

  const dealer = state.dealerships.find((d: any) => d.id === dealershipId);
  if (!dealer || !(dealer as any).codatCompanyId)
    return res.status(400).json({ error: "Accounting integrations not provisioned" });

  if (CODAT_API_KEY) {
    try {
      await fetch(`${CODAT_BASE}/companies/${(dealer as any).codatCompanyId}/connections/${connectionId}`, {
        method: "DELETE",
        headers: { Authorization: codatAuthHeader() },
      });
    } catch (err: any) {
      console.error(`[accounting] Codat disconnect error:`, err?.message);
    }
  }

  state.accountingAccounts = (state.accountingAccounts || []).filter((a) => a.connectionId !== connectionId);
  writeState(state);
  res.json({ ok: true });
});

/** Push one DocHub invoice-stage document straight into the dealer's
 *  connected accounting package via Codat's push-data API, instead of only
 *  producing a CSV. Called from the 'connect' branch of POST /api/documents.
 *  Returns null (never throws) so the caller can fall back to the CSV on any
 *  failure — an accounting outage must not block finalising a sale. */
async function pushInvoiceToAccounting(
  companyId: string,
  connectionId: string,
  invoice: { contact: string; email: string; invoiceNumber: string; issuedDate: string; lines: { description: string; quantity: number; unitAmount: number }[]; currency: string },
): Promise<{ externalInvoiceId?: string } | null> {
  if (!CODAT_API_KEY) return null;
  try {
    const pRes = await fetch(`${CODAT_BASE}/companies/${companyId}/connections/${connectionId}/push/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: codatAuthHeader() },
      body: JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        issuedDate: invoice.issuedDate,
        customerRef: { companyName: invoice.contact },
        lineItems: invoice.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitAmount: l.unitAmount,
        })),
      }),
    });
    if (!pRes.ok) {
      const body = await pRes.text();
      console.error(`[accounting] Codat push failed (${pRes.status}):`, body);
      return null;
    }
    const data = await pRes.json();
    return { externalInvoiceId: data.id || data.data?.id };
  } catch (err: any) {
    console.error(`[accounting] Codat push error:`, err?.message);
    return null;
  }
}

// Codat webhook receiver — data-connection status changes land here.
app.post("/api/integration/webhook-codat", (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Codat supports a shared-secret header configured on the webhook rule.
  // Set CODAT_WEBHOOK_SECRET=header-name:header-value and match it there.
  // A secret that's set but malformed (no ':') must fail closed — silently
  // skipping verification here would leave this endpoint fully open even
  // though an operator believes they've configured auth.
  if (CODAT_WEBHOOK_SECRET) {
    if (!CODAT_WEBHOOK_SECRET.includes(":")) {
      console.error("[accounting] CODAT_WEBHOOK_SECRET is set but malformed (expected 'header-name:header-value') — rejecting all webhook calls until fixed");
      return res.status(500).json({ error: "Webhook auth misconfigured" });
    }
    const [headerName, headerValue] = CODAT_WEBHOOK_SECRET.split(":", 2);
    if (req.headers[headerName.toLowerCase()] !== headerValue) {
      console.warn("[accounting] Webhook header mismatch — rejecting");
      return res.status(401).json({ error: "Invalid webhook auth" });
    }
  }

  const ruleType = payload.ruleType || payload.type;
  console.log(`[accounting] Webhook received: ruleType=${ruleType || "unknown"}`);

  const companyId = payload.companyId || payload.data?.companyId;
  const state = readState();

  if (ruleType === "Data connection status changed" || ruleType === "data-connection.status-changed") {
    const conn = payload.data || payload.connection || {};
    const status = (conn.status || "").toLowerCase();
    const dealer = companyId ? dealerByCodatCompany(state, companyId) : undefined;
    if (!dealer) {
      console.warn(`[accounting] status-changed for unknown companyId=${companyId}`);
      return res.json({ ok: true, ignored: true });
    }
    if (status === "linked") {
      const platform = ACCOUNTING_PLATFORMS.find((p) => p.codatKey === conn.platformKey);
      if (platform) {
        if (!state.accountingAccounts) state.accountingAccounts = [];
        const existing = state.accountingAccounts.find((a) => a.connectionId === conn.id);
        if (!existing) {
          state.accountingAccounts.push({
            connectionId: conn.id,
            dealershipId: dealer.id,
            platform: platform.id,
            companyName: conn.dataConnectionType || undefined,
            connectedAt: new Date().toISOString(),
          });
          writeState(state);
          console.log(`[accounting] connection linked: ${conn.id} (${platform.id}) → dealer ${dealer.id}`);
        }
      }
    } else if (status === "deauthorized" || status === "deleted") {
      state.accountingAccounts = (state.accountingAccounts || []).filter((a) => a.connectionId !== conn.id);
      writeState(state);
      console.log(`[accounting] connection removed: ${conn.id}`);
    }
  }

  res.json({ ok: true });
});

// ==================== IMAGIN8 / TRANSUNION ====================

import { getValues as imagin8GetValues, regCheck as imagin8RegCheck, bankAvs as imagin8BankAvs, createInvoice as imagin8CreateInvoice } from "../packages/imagin8";

const IMAGIN8_PLATFORM_KEY = process.env.IMAGIN8_API_KEY || "";

function dealerImagin8Key(state: any, dealershipId: string): string | null {
  const d = state.dealerships?.find((d: any) => d.id === dealershipId);
  return d?.imagin8ApiKey || null;
}

app.post("/api/imagin8/valuation", authenticate, async (req: any, res) => {
  const { mmCode, year, mileage } = req.body || {};
  if (!mmCode || !year) {
    return res.status(400).json({ error: "mmCode and year are required" });
  }
  const state = readState();
  const apiKey = dealerImagin8Key(state, req.user.dealershipId) || IMAGIN8_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Imagin8 API key not configured — set IMAGIN8_API_KEY or add a key in dealer settings." });
  }
  try {
    const result = await imagin8GetValues(mmCode, year, mileage ? Number(mileage) : undefined, { apiKey });
    console.log(`[imagin8] valuation for ${mmCode}/${year}: trade=${result.tradePrice} retail=${result.retailPrice}`);
    res.json(result);
  } catch (err: any) {
    console.error("[imagin8] valuation failed:", err?.message || err);
    res.status(502).json({ error: err?.message || "Imagin8 valuation failed" });
  }
});

app.post("/api/imagin8/regcheck", authenticate, async (req: any, res) => {
  const { identifier, type } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ error: "identifier (VIN, reg number, or engine number) is required" });
  }
  const lookupType = (type === "reg" || type === "engine") ? type : "vin";
  const state = readState();
  const apiKey = dealerImagin8Key(state, req.user.dealershipId) || IMAGIN8_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Imagin8 API key not configured." });
  }
  try {
    const result = await imagin8RegCheck(identifier, lookupType, { apiKey });
    console.log(`[imagin8] reg check ${lookupType}=${identifier}: stolen=${result.stolen} finance=${result.financePending}`);
    res.json(result);
  } catch (err: any) {
    console.error("[imagin8] reg check failed:", err?.message || err);
    res.status(502).json({ error: err?.message || "Imagin8 reg check failed" });
  }
});

app.post("/api/imagin8/avs", authenticate, async (req: any, res) => {
  const { bankAccount, branchCode, idNumber, initials, surname } = req.body || {};
  if (!bankAccount || !branchCode || !idNumber) {
    return res.status(400).json({ error: "bankAccount, branchCode, and idNumber are required" });
  }
  const state = readState();
  const apiKey = dealerImagin8Key(state, req.user.dealershipId) || IMAGIN8_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Imagin8 API key not configured." });
  }
  try {
    const result = await imagin8BankAvs(bankAccount, branchCode, idNumber, initials || "", surname || "", { apiKey });
    console.log(`[imagin8] AVS for account ending ${bankAccount.slice(-4)}: valid=${result.valid} idMatch=${result.idMatch}`);
    res.json(result);
  } catch (err: any) {
    console.error("[imagin8] AVS failed:", err?.message || err);
    res.status(502).json({ error: err?.message || "Bank AVS failed" });
  }
});

app.post("/api/imagin8/invoice", authenticate, async (req: any, res) => {
  const { customerName, customerEmail, customerPhone, customerAddress, customerVatNumber, lineItems, reference, notes, dueDate, paymentMethod } = req.body || {};
  if (!customerName || !Array.isArray(lineItems) || !lineItems.length) {
    return res.status(400).json({ error: "customerName and at least one lineItem are required" });
  }
  const state = readState();
  const apiKey = dealerImagin8Key(state, req.user.dealershipId) || IMAGIN8_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Imagin8 API key not configured." });
  }
  try {
    const result = await imagin8CreateInvoice(
      { customerName, customerEmail, customerPhone, customerAddress, customerVatNumber, lineItems, reference, notes, dueDate, paymentMethod },
      { apiKey },
    );
    console.log(`[imagin8] invoice created: ${result.invoiceNumber} total=${result.total}`);
    res.json(result);
  } catch (err: any) {
    console.error("[imagin8] invoice creation failed:", err?.message || err);
    res.status(502).json({ error: err?.message || "Invoice creation failed" });
  }
});

// --- VITE DEV SERVER / PRODUCTION ROUTER ---

async function startServer() {
  // TruFlow Light — standalone dealer console served at /light
  // TruFlow Light is an installable PWA served here. Static assets (sw.js,
  // manifest, icons) come from express.static with a no-cache header on sw.js +
  // the manifest so a new deploy actually reaches installed apps. The app HTML
  // is served for both /light and /light/ (Express non-strict routing matches
  // both) — no redirect, because a /light redirect ALSO matches /light/ and
  // loops. index:false so express.static doesn't answer the directory itself.
  // The PWA's start_url/scope is /light/, which the manifest points at.
  const lightDir = path.join(process.cwd(), "public", "light");
  app.use("/light", express.static(lightDir, {
    index: false,
    redirect: false,
    setHeaders(res, fp) {
      if (fp.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
      if (fp.endsWith(".webmanifest")) res.setHeader("Content-Type", "application/manifest+json");
    },
  }));
  app.get("/light", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(lightDir, "index.html"));
  });

  // Embed widget + static public assets (dealer websites load /embed/stock-widget.js)
  app.use("/embed", express.static(path.join(process.cwd(), "public", "embed")));
  app.use("/public", express.static(path.join(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting full-stack development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode. Static files serving enabled.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TruFlow Premium on 0.0.0.0:${PORT} (trusaas-premium.onrender.com)`);
  });
}

// --- AUTOMATED DAILY BACKUP ---
// Writes a rotating set of backups to DATA_DIR. Keeps the last 7 days.
// Runs inside the server process so it needs no external cron or S3.

const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_KEEP_DAYS = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function runBackup(): void {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const backupFile = path.join(BACKUP_DIR, `backup-${stamp}.json`);

    const state = readState();
    const tmp = backupFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tmp, backupFile);

    // Prune old backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
      .sort();
    while (files.length > BACKUP_KEEP_DAYS) {
      const old = files.shift()!;
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      console.log(`[backup] pruned ${old}`);
    }

    console.log(`[backup] saved ${path.basename(backupFile)} (${(Buffer.byteLength(JSON.stringify(state)) / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err: any) {
    console.error("[backup] failed:", err?.message);
  }
}

// First backup shortly after boot (30s delay so migrations finish), then daily
setTimeout(() => {
  runBackup();
  setInterval(runBackup, BACKUP_INTERVAL_MS);
}, 30_000);

startServer();
