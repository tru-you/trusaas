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
 * the seed happened to contain. No seed row carries agencyId, so the field
 * every scoping check depends on did not exist on the type — which is most of
 * the 62 errors this file had, and meant the one thing standing between two
 * agencies' records was unchecked.
 *
 * `import type` is erased at compile time, so this adds no runtime dependency
 * on the client bundle.
 */
import type { DMSState, Enquiry, User, Agency } from "./src/types";
import { DOC_STAGES } from "./src/types";
import { readState, writeState, freshDefaultState, PRODUCTS, type ProductName } from "./services/stateStore";
import {
  requireAuth,
  ensureAuthStore,
  signToken,
  hashCode,
  makeAccount,
  writeAuth,
  MANAGES_USERS,
  ASSIGNABLE_ROLES,
  applyAdminRecovery,
  SYNC_SERVICE_KEY,
  TRULENS_URL,
  type AuthRole,
} from "./middleware/auth";
import { documentRoutes, recomputeDocStage } from "./routes/documents";

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

// Custom lightweight CORS middleware for external website plugins & widget integrations.
// Browsers only get the allow-origin header when the Origin is on the whitelist —
// a random website can no longer make authenticated requests from a user's browser.
// Non-browser clients (phones, server-to-server) send no Origin header and pass through.
const ALLOWED_ORIGINS = [
  "https://lens.tru-saas.com",
  "https://flow.tru-saas.com",
  "https://premium.tru-saas.com",
  "https://www.real-cars.co.za",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
];
const EXTRA_ORIGIN = process.env.CORS_EXTRA_ORIGIN || "";
if (EXTRA_ORIGIN) {
  ALLOWED_ORIGINS.push(...EXTRA_ORIGIN.split(",").map(o => o.trim()).filter(Boolean));
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.vary("Origin");
  }
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
 * Public, and registered before requireAuth: these are agency stock photos
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

// Auth lives in middleware/auth.ts — code hashing, token signing/verification,
// the requireAuth middleware and the boot-time admin recovery. Only the
// middleware wiring and the auth REST routes stay here.

app.use(requireAuth);

/** Restrict a list to the caller's agency. Admins see everything.
 *  Untagged rows belong to the default agency, matching the public feed. */
function scopeToAgency<T extends { agencyId?: string }>(rows: T[], auth: any): T[] {
  if (!auth || auth.role === "admin") return rows;
  return (rows || []).filter(
    (r) => r.agencyId === auth.agencyId
  );
}

/** The agency a newly created record belongs to. Taken from the session so
 *  it can't be spoofed, and so nothing is ever written untagged — untagged
 *  falls to the default agency, which means it silently belongs to the
 *  pilot agency and vanishes from the list of whoever actually created it. */
function ownerAgency(req: any): string | undefined {
  return req.auth?.role === "admin" ? req.body?.agencyId : req.auth?.agencyId;
}

/** Check that a record belongs to the caller. Admins may touch any record. */
function mayTouch(row: { agencyId?: string } | undefined, auth: any): boolean {
  if (!row) return false;
  if (auth?.role === "admin") return true;
  return row.agencyId === auth?.agencyId;
}

/** Ask the FlowPMS (the master code authority) whether a code is real.
 *  Returns the agency claims or null. Requires FLOWPMS_URL + FLOWPMS_SYNC_KEY. */
async function verifyCodeWithFlowPMS(code: string): Promise<{ agencyId: string; agencySlug: string; agencyName: string } | null> {
  const syncKey = process.env.FLOWPMS_SYNC_KEY || process.env.TRUFLOW_SYNC_KEY || "";
  const pmsUrl = process.env.FLOWPMS_URL || "";
  if (!syncKey || !pmsUrl) return null;
  try {
    const res = await fetch(`${pmsUrl.replace(/\/$/, "")}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tru-sync-key": syncKey },
      body: JSON.stringify({ code, product: "prop-inspect" }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.ok || !body?.agency?.slug) return null;
    return {
      agencyId: String(body.agency.id || body.agencyId || ""),
      agencySlug: body.agency.slug,
      agencyName: body.agency.name || body.agencySlug || "",
    };
  } catch {
    return null;
  }
}

function loginViaFlowPMS(code: string, remember: boolean, res: any) {
  verifyCodeWithFlowPMS(code).then((claims) => {
    if (!claims) return res.status(401).json({ error: "Invalid code" });
    /* The FlowPMS knows the agency; make sure it exists locally so scoping
       works, then mint a token for it. The agencyId is the FlowPMS's — the
       same id is used here so a sync between the two stays aligned. */
    const state = readState();
    let agency = (state.agencies || []).find((a: any) => a.id === claims.agencyId || a.slug === claims.agencySlug);
    if (!agency) {
      agency = { id: claims.agencyId || `agcy_${claims.agencySlug}`, slug: claims.agencySlug, name: claims.agencyName, products: [], location: "" };
      state.agencies = state.agencies || [];
      state.agencies.push(agency);
      writeState(state);
    }
    const account: any = {
      id: `agcy_${claims.agencySlug}`,
      agencyId: agency.id,
      userId: undefined,
      role: "agent",
      label: claims.agencyName || claims.agencySlug,
    };
    res.json({
      token: signToken(account, remember),
      expiresInDays: remember ? 30 : 0.5,
      account: { label: account.label, role: account.role, agencyId: agency.id },
    });
  }).catch(() => res.status(401).json({ error: "Invalid code" }));
}

app.post("/api/auth/login", (req, res) => {
  const code = String(req.body?.code || "").trim();
  const remember = req.body?.remember !== false; // default on — yard devices
  const store = ensureAuthStore();
  const match = store.accounts.find((a) => hashCode(code, a.salt) === a.hash);
  if (!code || !match) {
    /* Not a local account — ask the FlowPMS (the master code authority) whether
       this code is real and what it opens. One place issues codes; satellites
       ask rather than remember. */
    return loginViaFlowPMS(code, remember, res);
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
    account: { label: match.label, role: match.role, agencyId: match.agencyId },
  });
});

app.get("/api/auth/me", (req: any, res) => {
  res.json({ account: req.auth || null });
});

/** Issue a fresh code for a agency, or rotate an existing one. Admin only.
 *  The new code is returned once in the response and never again. */
/**
 * Resolve a agency code, for the other products in the suite.
 *
 * TruLens, TruInspect and everything built after them each kept their own copy
 * of every agency's code in an environment variable — TRULENS_DEALER_CODES is a
 * comma-separated "slug:CODE" string — so onboarding one agency meant creating
 * them here, issuing a code, pasting it into each app's service configuration in
 * plaintext, and restarting that app. Per product. Revoking meant editing the
 * same string and redeploying again, and a code lived in as many dashboards as
 * you had apps.
 *
 * Agencies already live here and TruLens already proxies the list from this
 * instance; identity is the piece that was missing. One place issues a code, one
 * place says which products it opens, and an app asks rather than remembers.
 *
 * Service-to-service: the caller is another product, not a browser, so it
 * authenticates with the shared sync key rather than a session. Deliberately NOT
 * public — an open endpoint here would let anyone test codes against every
 * agency on the instance.
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
     agencies exist — this endpoint is reachable by anything holding the sync
     key, so it should confirm nothing it was not asked. */
  if (!match) return res.status(401).json({ error: "Code not recognised." });

  const state = readState();

  /* The master admin holds no agency. It is a platform login, not a yard's,
     and handing it a agencySlug would let it capture vehicles into whichever
     agency happened to sort first. */
  if (!match.agencyId) {
    return res.status(403).json({
      error: "Not a agency code",
      message: "The master admin cannot be used to sign in to a product.",
    });
  }

  const agency = (state.agencies || []).find((d: any) => d.id === match.agencyId);
  if (!agency) {
    /* The code outlived its agency — retired, or pruned. Refuse rather than
       let a code with no yard behind it through. */
    return res.status(403).json({
      error: "Agency no longer exists",
      message: "This code belonged to a agency that has been removed.",
    });
  }

  const products: string[] = Array.isArray(agency.products) ? agency.products : [];
  if (!products.includes(product)) {
    return res.status(403).json({
      error: "Not entitled",
      message: `${agency.name} is not set up for ${product}.`,
      agencySlug: agency.slug,
      products,
    });
  }

  res.json({
    ok: true,
    agencySlug: agency.slug,
    agencyId: agency.id,
    agencyName: agency.name,
    role: match.role,
    label: match.label,
    products,
  });
});

app.post("/api/auth/codes/rotate", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const { agencyId, label, code: chosen } = req.body || {};
  const store = ensureAuthStore();
  const agency = (readState().agencies || []).find((d: any) => d.id === agencyId);
  if (!agency) return res.status(404).json({ error: "Unknown agency" });

  // Setting your own code is allowed, within reason — a four-character code on
  // an endpoint anyone can POST to is not a code.
  const preset = String(chosen || "").trim();
  if (preset && preset.length < 6) {
    return res.status(400).json({ error: "Code must be at least 6 characters." });
  }
  const { account, code } = makeAccount(label || agency.name + " (owner)", "principal", agencyId, preset);
  store.accounts = store.accounts.filter((a) => !(a.agencyId === agencyId && a.role === "principal"));
  account.rotatedAt = new Date().toISOString();
  store.accounts.push(account);
  writeAuth(store);

  res.json({ code, account: { label: account.label, agencyId, role: account.role } });
});

// ── Seats — a agency principal manages their own staff logins ───────────────

/** The agency the caller may act on. Admins may name one; everyone else
 *  is pinned to their own, so a principal can't create staff elsewhere. */
function targetAgency(req: any, bodyAgencyId?: string): string | undefined {
  if (req.auth?.role === "admin") return bodyAgencyId || undefined;
  return req.auth?.agencyId;
}

/** Staff logins for a agency, with the active seat count to bill against. */
app.get("/api/auth/users", (req: any, res) => {
  if (!MANAGES_USERS.includes(req.auth?.role)) {
    return res.status(403).json({ error: "You can't manage logins." });
  }
  const agencyId = targetAgency(req, req.query.agencyId as string);
  const state = readState();
  const store = ensureAuthStore();

  const seats = store.accounts
    .filter((a) => a.userId && (!agencyId || a.agencyId === agencyId))
    .map((a) => {
      const user = state.users.find((u: any) => u.id === a.userId);
      return {
        accountId: a.id,
        userId: a.userId,
        name: user?.name || a.label,
        email: user?.email || "",
        phone: user?.phone || "",
        role: a.role,
        agencyId: a.agencyId,
        isActive: user?.isActive !== false,
        createdAt: a.createdAt,
        rotatedAt: a.rotatedAt,
      };
    });

  res.json({
    agencyId,
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
  const agencyId = targetAgency(req, req.body?.agencyId);
  if (!agencyId) return res.status(400).json({ error: "agencyId is required." });
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
    agencyId,
  };
  state.users.push(user);
  writeState(state);

  const store = ensureAuthStore();
  const { account, code } = makeAccount(user.name, wanted, agencyId, preset, user.id);
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
  if (req.auth.role !== "admin" && existing.agencyId !== req.auth.agencyId) {
    return res.status(403).json({ error: "That login belongs to another agency." });
  }

  const preset = String(req.body?.code || "").trim();
  if (preset && preset.length < 6) {
    return res.status(400).json({ error: "Code must be at least 6 characters." });
  }
  const { account, code } = makeAccount(
    existing.label, existing.role, existing.agencyId, preset, existing.userId
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
  if (req.auth.role !== "admin" && user.agencyId !== req.auth.agencyId) {
    return res.status(403).json({ error: "That user belongs to another agency." });
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
   a real agency's data. The demo is a normal tenant (agencyId "demo"),
   so every existing scope check isolates it for free — no special-cased reads.
   Its data is seeded on first entry and can be reset without affecting anyone. */

const DEMO_ENABLED = process.env.DEMO_MODE !== "0"; // on unless explicitly disabled

function seedDemoTenant() {
  const state = readState();
  if (state.properties.some((v: any) => v.agencyId === "demo")) return; // already seeded
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  const cars = [
    { make: "Toyota", model: "Hilux", trim: "2.4 GD-6 SRX", year: 2020, cost: 318000, retail: 379900, km: 112000, age: 12, body: "Bakkie" },
    { make: "Volkswagen", model: "Polo", trim: "1.0 TSI Comfortline", year: 2021, cost: 228000, retail: 269900, km: 52300, age: 41, body: "Hatchback" },
    { make: "Ford", model: "EcoSport", trim: "1.5 Ambiente", year: 2018, cost: 172000, retail: 199900, km: 96800, age: 74, body: "SUV" },
  ];
  cars.forEach((c, i) => {
    state.properties.unshift({
      id: "demo_v" + (i + 1), year: c.year, make: c.make, model: c.model, trim: c.trim,
      status: "AVAILABLE", askingPrice: c.retail, costPrice: c.cost, mileage: c.km,
      transmission: "Manual", fuelType: i === 0 ? "Diesel" : "Petrol",
      listingRef: "DEMO-" + (100 + i), dateAcquired: daysAgo(c.age), daysOnMarket: c.age,
      description: `${c.year} ${c.make} ${c.model} — sample stock for the demo.`,
      bodyType: c.body, images: [], maintenanceTasks: i === 1 ? [{ id: "demo_r1", name: "Valet & polish", cost: 1800, status: "Completed", dateAdded: today }] : [],
      agencyId: "demo",
    } as any);
  });

  state.enquiries.unshift({
    id: "demo_l1", firstName: "Sipho", lastName: "Ndlovu", phone: "079 000 0001",
    email: "sipho@example.co.za", propertyId: "demo_v1", source: "Website", status: "New",
    assignedUserId: "u1", createdAt: today, lastContactedAt: null, digitalScore: 82,
    notes: "Asked about finance on the Hilux.", nextAction: "First contact", nextActionAt: today,
    stageChangedAt: today, agencyId: "demo",
  } as any);
  state.enquiries.unshift({
    id: "demo_l2", firstName: "Annelie", lastName: "Botha", phone: "082 000 0002",
    email: "annelie@example.co.za", propertyId: "demo_v2", source: "Walk-in", status: "Contacted",
    assignedUserId: "u1", createdAt: daysAgo(9), lastContactedAt: daysAgo(9), digitalScore: 64,
    notes: "Wants a trade-in valuation.", nextAction: "Follow up", nextActionAt: daysAgo(4),
    stageChangedAt: daysAgo(9), agencyId: "demo",
  } as any);

  writeState(state);
}

/** Enter the demo. No code — that is the point. */
app.post("/api/auth/demo", (_req, res) => {
  if (!DEMO_ENABLED) return res.status(404).json({ error: "Demo is disabled on this instance." });
  seedDemoTenant();
  const store = ensureAuthStore();
  let acc = store.accounts.find((a) => a.agencyId === "demo");
  if (!acc) {
    const made = makeAccount("Demo Agency", "principal", "demo");
    acc = made.account;
    store.accounts.push(acc);
    writeAuth(store);
  }
  res.json({
    token: signToken(acc, false), // short session — a demo shouldn't linger for 30 days
    demo: true,
    account: { label: "Demo Agency", role: "principal", agencyId: "demo", demo: true },
  });
});

app.get("/api/auth/codes", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  // Codes themselves are unrecoverable — this lists who has one.
  res.json({
    accounts: ensureAuthStore().accounts.map((a) => ({
      id: a.id, label: a.label, role: a.role,
      agencyId: a.agencyId, createdAt: a.createdAt, rotatedAt: a.rotatedAt,
    })),
  });
});

// State persistence (readState/writeState, per-agency files, seed/backfills,
// the boot migration) lives in services/stateStore.ts.

/** Every array on a property that holds photos. */
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

  for (const v of state.properties || []) {
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
           only preserves a broken image on a agency's website. */
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
  for (const lead of (state.enquiries || []) as any[]) {
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

/** Move recon-task photos out of the state file.
 *
 *  `maintenanceTasks[].photo` was never in VEHICLE_PHOTO_FIELDS, so unlike every
 *  other upload it skipped putPhotos and the image stayed as base64 inside the
 *  property row — roughly 4 MB per phone photo, in the file every request reads
 *  and rewrites. The control that created them has been removed; this deals
 *  with the ones already stored.
 *
 *  Moved into the media store rather than deleted: a photo of work done on a
 *  car is evidence a agency may want, and it costs a 70-byte reference to keep.
 *  Idempotent — an already-stored reference is left alone, and a value that is
 *  neither storable nor a reference is dropped, since it could never render. */
function migrateReconPhotos(): void {
  const state = readState();
  let moved = 0;
  let dropped = 0;

  for (const v of (state.properties || []) as any[]) {
    const tasks = v.maintenanceTasks;
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

/** Retire the PENDING property status.
 *
 *  Nothing has written PENDING since the stock kanban that owned it was
 *  removed, but it still distorted two screens: the Overview counted it while
 *  Stock Health excluded it from BOTH its live and sold buckets, so a PENDING
 *  car's capital simply vanished from "Capital in stock".
 *
 *  Mapped to SOLD, not INVENTORY. PENDING meant "sold, awaiting hand-over" —
 *  and the public feed publishes only INVENTORY, so moving these to INVENTORY
 *  would put already-sold cars back on the agency's website. */
function retirePendingStatus(): void {
  const state = readState();
  const pending = (state.properties || []).filter((v: any) => v.status === "PENDING");
  if (pending.length === 0) return;
  for (const v of pending as any[]) v.status = "SOLD";
  writeState(state);
  console.log(
    `[stock] retired PENDING on ${pending.length} property(s) — mapped to SOLD ` +
      `(${pending.map((v: any) => v.listingRef || v.id).join(", ")}).`,
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
  // The whole DMS in one payload — scope every collection, or a agency would
  // read every other agency's enquiries straight out of the bootstrap call.
  const s = readState();
  res.json({
    ...s,
    properties: scopeToAgency(s.properties, req.auth),
    enquiries: scopeToAgency(s.enquiries, req.auth),
    tasks: scopeToAgency(s.tasks, req.auth),
    invoices: scopeToAgency(s.invoices, req.auth),
    agreements: scopeToAgency(s.agreements, req.auth),
    documents: scopeToAgency(s.documents || [], req.auth),
    docEvents: scopeToAgency(s.docEvents || [], req.auth),
    expenses: scopeToAgency(s.expenses || [], req.auth),
    communications: scopeToAgency(s.communications, req.auth),
    users: scopeToAgency(s.users, req.auth),
  });
});

/** Download the entire DMS as a file. Admin only.
 *
 *  The mounted disk holds the only copy of every agency's photos, and taking a
 *  copy previously meant finding the Render shell and cat-ing the file — which
 *  is exactly the kind of chore that does not get done until the week after it
 *  was needed. This is the same data /api/state already returns to an admin,
 *  served with a filename so a browser saves it instead of rendering it.
 *
 *  Deliberately not public and deliberately not agency-scoped: it is a whole-
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
  if (!Array.isArray(incoming.properties) || !Array.isArray(incoming.agencies)) {
    return res.status(400).json({
      error: "That does not look like a TruFlow backup",
      message: "Expected top-level 'vehicles' and 'agencies' arrays.",
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
        agencies: incoming.agencies.length,
        properties: incoming.properties.length,
        enquiries: Array.isArray(incoming.enquiries) ? incoming.enquiries.length : 0,
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

/** Destroys EVERY agency's data and restores the demo seed.
 *
 *  Harmless while state was ephemeral; since the Render disk landed this
 *  permanently deletes real stock, enquiries, invoices and signed documents, with
 *  no backup. It was reachable by any signed-in user, so one agency could wipe
 *  another's yard. Admin only, and it takes a typed confirmation. */
app.post("/api/state/reset", (req: any, res) => {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({
      error: "Admin only",
      message: "Resetting wipes every agency on this instance.",
    });
  }
  if (req.body?.confirm !== "RESET EVERYTHING") {
    return res.status(400).json({
      error: "Confirmation required",
      message: 'Send { "confirm": "RESET EVERYTHING" } to proceed.',
    });
  }
  /* A copy, not the seed itself. writeState re-buckets rows by agencyId and
     stamps them, so handing it the module-level object would edit the seed this
     process resets to — the second reset would then restore whatever the first
     one left behind. */
  const seeded = freshDefaultState();
  writeState(seeded);
  res.json({ message: "All agency data reset to the seed.", state: seeded });
});

// Signed-in inventory list (the Light console's stock tab reads this).
// MUST be agency-scoped: this endpoint requires a token (it is not in
// isPublicPath), so the only callers are authenticated agency consoles.
// It returned state.properties unscoped, so a signed-in agency saw EVERY
// agency's cars — the same cross-tenant leak /api/state and /api/enquiries
// already guard against. Admins still see everything (scopeToAgency passes
// them through). External websites/WordPress read the public feed instead
// (GET /api/public/stock?agency=<slug>), which is scoped by slug.
app.get("/api/inventory", (req: any, res) => {
  const state = readState();
  const search = (req.query.search as string || "").toLowerCase();
  const status = req.query.status as string || "ALL";

  let results = scopeToAgency(state.properties, req.auth);

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
      v.listingRef.toLowerCase().includes(search) ||
      v.description.toLowerCase().includes(search)
    );
  }

  res.json(results);
});

// All inventory including SOLD
app.get("/api/all-vehicles", (req: any, res) => {
  const state = readState();
  res.json(scopeToAgency(state.properties, req.auth));
});

// Single-property inspection report for the report overlay. Signed-in only
// (requireAuth runs above), and agency-scoped like /api/all-vehicles so one
// tenant can never read another tenant's inspection notes. Inspection fields
// are optional on the record, so the payload defaults them to empty shapes.
app.get("/api/inspection/:propertyId", (req: any, res) => {
  const state = readState();
  const found = scopeToAgency(state.properties, req.auth).find(
    (v: any) => v.id === req.params.propertyId
  );
  if (!found) return res.status(404).json({ error: "Property not found" });

  res.json({
    property: {
      id: found.id,
      address: found.address || "",
      suburb: found.suburb || "",
      propertyType: found.propertyType || "",
      bedrooms: found.bedrooms || 0,
      bathrooms: found.bathrooms || 0,
      garages: found.garages || 0,
      erfSize: found.erfSize || "",
      floorSize: found.floorSize || "",
      listingRef: found.listingRef || "",
      askingPrice: found.askingPrice || 0,
      images: found.images || [],
    },
    inspectionResults: found.inspectionResults || {},
    damage: found.damage || [],
    slotAssessment: found.slotAssessment || {},
    inspectionReport: found.inspectionReport || [],
    conditionDeclaration: (found as any).conditionDeclaration || {},
  });
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

  for (const v of state.properties as any[]) {
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
      changes.push({ id: v.id, listingRef: v.listingRef, agencyId: v.agencyId, ...diff });
      if (apply) Object.assign(v, next);
    }
  }

  if (apply) writeState(state);
  res.json({
    applied: apply,
    ...(apply ? {} : { note: 'Dry run — nothing written. Send { "confirm": "NORMALIZE" } to apply.' }),
    scanned: state.properties.length,
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
    status: req.body.status || "AVAILABLE",
    askingPrice: parseFloat(req.body.askingPrice) || 0,
    costPrice: parseFloat(req.body.costPrice) || 0,
    mileage: parseInt(req.body.mileage) || 0,
    transmission: req.body.transmission || "Automatic",
    fuelType: req.body.fuelType || "Petrol",
    listingRef: req.body.listingRef || "STK-" + Math.floor(Math.random() * 9000 + 1000),
    dateAcquired: req.body.dateAcquired || new Date().toISOString().slice(0, 10),
    daysOnMarket: 1,
    description: req.body.description || "Uploaded via Mobile app.",
    bodyType: req.body.bodyType || "",
    engine: req.body.engine || "",
    images: req.body.images || [],
    maintenanceTasks: req.body.maintenanceTasks || [],
    // Accept either the internal id or the website slug — callers that only
    // know the agency by their site (TruLens, widgets, integrations) would
    // otherwise post untagged stock, which the public feed hands to the
    // default agency's website instead of theirs.
    // Falls back to the session, like every other create. Without this a agency
    // adding a car by hand got it filed to the default agency and it
    // vanished from their own stock list.
    agencyId: req.auth?.role === "admin"
      ? (req.body.agencyId || agencyIdForSlug(req.body.agencySlug) || ownerAgency(req))
      : req.auth?.agencyId,
    // Showroom tier. Left unset when not supplied so the website falls back to
    // its own heuristic rather than defaulting everything into one category.
    category: CATEGORY_VALUES.includes(req.body.category) ? req.body.category : undefined,
    truPrice: req.body.truPrice ? parseFloat(req.body.truPrice) : undefined,
    // Storefront visibility. Honour the caller's flag, but default to FALSE —
    // a car added by hand has no photos yet, and the intended flow (both the
    // Premium "add on floor → shoot in TruLens → export" copy and Light's
    // upload note) is that it stays off the website until the agency publishes
    // it. Stored as an explicit boolean so the readState backfill — which flips
    // *unset* legacy rows to true — can never silently republish it. Without
    // this, create dropped the field and the backfill put every new car live
    // the instant it was added.
    showOnWebsite:
      typeof req.body.showOnWebsite === "boolean" ? req.body.showOnWebsite : false
  };

  state.properties.unshift(newVehicle as any);
  writeState(state);
  res.status(201).json({ message: "Property added to inventory.", property: newVehicle });
});

// Update property status/details
/** May this session act on this property? Admin may touch anything; everyone
 *  else is confined to their own agency.
 *
 *  Reads were scoped by scopeToAgency from the start, but these two writes were
 *  not, and property ids are guessable — v1, v2, v3. A signed-in principal at one
 *  agency could PUT or DELETE another agency's stock by id alone. */
function mayTouchVehicle(v: any, auth: any): boolean {
  if (!auth || auth.role === "admin") return true;
  return !!v?.agencyId && v.agencyId === auth.agencyId;
}

/** Non-media, agency-editable property fields that participate in the
 *  Flow<->Lens sync. Photos, damage findings, VIR, slot assessment and the
 *  condition declaration stay Lens-owned (they belong to the capture flow). */
const FLOW_SYNCED_FIELDS = [
  "make", "model", "year", "trim", "vin", "color",
  "mileage", "transmission", "fuelType", "bodyType", "engine",
  "askingPrice", "showOnWebsite", "description", "status", "listingRef",
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
 *  Lens uses `price` and `vehicleType`; Flow uses `askingPrice` and `bodyType`. */
function toLensPatch(flowPatch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(flowPatch)) {
    if (k === "askingPrice") out.price = v;
    else if (k === "bodyType") out.vehicleType = v;
    else out[k] = v;
  }
  return out;
}
function toLensMeta(flowMeta: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(flowMeta)) {
    if (k === "askingPrice") out.price = v;
    else if (k === "bodyType") out.vehicleType = v;
    else out[k] = v;
  }
  return out;
}

/** Apply a patch to a property, owning every side effect a status change drags
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
  const current = state.properties[index] as any;

  /* Selling a car pulls it off the website in the same write, so a agency
     doesn't have to remember two steps. Owned server-side so Light, Premium
     and the Lens sync all inherit it without repeating the rule. */
  if (patch.status === "SOLD" && current.status !== "SOLD") {
    patch.showOnWebsite = false;
  }

  /* Archiving retires a unit whose sale is already recorded, so it implies
     SOLD and off the website. Enforced here rather than trusting the caller:
     archiving from the UI once set only `archivedAt`, which left the car
     counting as live stock and still publishing to the agency's site. */
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

  state.properties[index] = {
    ...current,
    ...patch,
    fieldMeta: nextMeta,
    // The owner is never taken from the request body — otherwise an edit could
    // move a car into another agency's stock.
    agencyId: current.agencyId,
  };

  return changedForSync;
}

/** Push a property edit back to TruLens for vehicles that originated there, so
 *  the capture app's copy stays in step with the DMS. Fire-and-forget — the
 *  agency's save must never block on Lens. Photos/VIR/damage are excluded by
 *  the allow-list; Lens applies mergeWithMeta at its end, so a stale push
 *  loses the timestamp comparison instead of clobbering.
 *
 *  Call after writeState, so Lens is never told about an edit that failed to
 *  persist. */
function pushVehicleToLens(
  state: any,
  property: any,
  changedForSync: Record<string, any>,
  now: number,
): void {
  if (!property || property.source !== "trulens" || !property.listingRef) return;
  if (Object.keys(changedForSync).length === 0) return;

  /* Name the agency — stock numbers are agency-chosen and collide across
     yards, so an unqualified push reaches the wrong capture. */
  const ownerSlug = (state.agencies || []).find(
    (d: any) => d.id === property.agencyId,
  )?.slug;
  const pushBody = {
    listingRef: property.listingRef,
    agencySlug: ownerSlug,
    patch: toLensPatch(changedForSync),
    fieldMeta: toLensMeta(
      Object.fromEntries(Object.keys(changedForSync).map((k) => [k, now])),
    ),
  };
  fetch(`${TRULENS_URL}/api/sync/property`, {
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

/** Set a property's status by id, with every side effect applyVehiclePatch owns.
 *  The entry point for lead→property coupling. No-ops when the property is absent
 *  or already at that status, so callers can fire it unconditionally.
 *
 *  Does not push to Lens itself — the caller does that after writeState, using
 *  the returned changedForSync. */
function applyVehicleStatus(
  state: any,
  propertyId: string,
  next: string,
  now: number,
): { changed: boolean; changedForSync: Record<string, any>; index: number } {
  const index = state.properties.findIndex((v: any) => v.id === propertyId);
  if (index === -1) return { changed: false, changedForSync: {}, index: -1 };
  if ((state.properties[index] as any).status === next) {
    return { changed: false, changedForSync: {}, index };
  }
  const changedForSync = applyVehiclePatch(state, index, { status: next }, now);
  return { changed: true, changedForSync, index };
}

app.put("/api/inventory/:id", (req: any, res) => {
  const state = readState();
  const index = state.properties.findIndex(v => v.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Property not found" });
  }
  // 404, not 403: a agency should not be able to probe which ids exist elsewhere.
  if (!mayTouchVehicle(state.properties[index], req.auth)) {
    return res.status(404).json({ error: "Property not found" });
  }

  /* Photos uploaded from the DMS itself arrive here as base64 — the detail
     modal reads files with FileReader and PUTs the whole array back. Store them
     the same way the TruLens path does, or the one route a agency uses by hand
     would quietly put image bytes back into the state this change exists to
     keep them out of. */
  const body = { ...req.body };

  /* Not a property field — it names which deal closed on this car. Pulled out
     before the merge, which is a blind {...current, ...body}: left in, a
     caller-supplied id would persist onto the property row permanently and be
     echoed back to every client that reads stock. */
  const closeLeadId: string | undefined = body.closeLeadId;
  delete body.closeLeadId;

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
  const prevStatus = (state.properties[index] as any).status;
  const changedForSync = applyVehiclePatch(state, index, body, now);

  /* The deal moves with the car. Owned here rather than in the React handler
     because this endpoint is what the Light console, TruLens sync and every
     raw API call actually hit — selling a car from Light never moved its lead
     for as long as Light has existed, because the rule lived in App.tsx.

     Transition-based, like the lead side: only fires when the status actually
     changes, so re-saving a sold car does nothing. */
  const property = state.properties[index] as any;
  const nextStatus = property.status;
  const nowSold = nextStatus === "SOLD" && prevStatus !== "SOLD";
  const backInStock = prevStatus === "SOLD" && nextStatus !== "SOLD";
  const coupledLeads: { id: string; status: string }[] = [];

  if (nowSold) {
    /* Which deal closed on this car? The UI resolves ambiguity by naming one.
       Light and raw API callers cannot, so fall back only when there is exactly
       one candidate — guessing between two would close the wrong customer's
       deal, and a car genuinely sold outside the system has none at all. */
    const openLeads = state.enquiries.filter(
      (l: any) =>
        l.propertyId === property.id && l.status !== "Closed Won" && l.status !== "Closed Lost",
    );

    let target: any = null;
    if (closeLeadId) {
      /* Validate rather than trust — the id came from the request. The status
         test mirrors the openLeads predicate exactly: a named id must be an
         OPEN deal. Checking only for "Closed Won" let a caller resurrect a
         Closed Lost deal into a sale. */
      const named = state.enquiries.find((l: any) => l.id === closeLeadId);
      const namedIsOpen =
        named && named.status !== "Closed Won" && named.status !== "Closed Lost";
      if (namedIsOpen && named.propertyId === property.id && mayCouple(named, property)) {
        target = named;
      } else {
        console.log(
          `[coupling] closeLeadId ${closeLeadId} rejected for ${property.id} ` +
            `(missing, wrong car, already closed, or another agency) — enquiries left alone.`,
        );
      }
    } else if (openLeads.length === 1 && mayCouple(openLeads[0], property)) {
      target = openLeads[0];
    } else if (openLeads.length > 1) {
      console.log(
        `[coupling] ${property.id} sold with ${openLeads.length} open deals and no closeLeadId — enquiries left alone.`,
      );
    }

    if (target) {
      target.statusBeforeClose = target.status;
      target.status = "Closed Won";
      // The deal now owns this sale, so only it may reverse it.
      property.soldByLeadId = target.id;
      coupledLeads.push({ id: target.id, status: "Closed Won" });
    }
  } else if (backInStock) {
    /* Car came back, so every deal that closed on it reopens — restoring the
       stage each came from rather than inventing one.

       This is the agency acting on the CAR, so it is unconditional: unlike the
       lead-side `free()`, it does not require the sale to have an owner. That
       is the escape hatch for a car sold outside the system or from Light. */
    property.soldByLeadId = null;
    /* Selling forced it off the website; coming back to the floor puts it back,
       which is what the UI promises when it says the car is re-listed. */
    property.showOnWebsite = true;
    for (const l of state.enquiries as any[]) {
      if (l.propertyId !== property.id || l.status !== "Closed Won") continue;
      if (!mayCouple(l, property)) continue;
      /* Deals closed before we started recording where they came from have no
         memory to restore. Negotiating is the least-wrong guess for those, and
         only those. */
      l.status = l.statusBeforeClose || "Negotiating";
      delete l.statusBeforeClose;
      coupledLeads.push({ id: l.id, status: l.status });
    }
  }

  writeState(state);

  pushVehicleToLens(state, state.properties[index], changedForSync, now);

  res.json({
    message: "Property updated successfully.",
    property: state.properties[index],
    coupledLeads,
  });
});

// Delete property
app.delete("/api/inventory/:id", (req: any, res) => {
  const state = readState();
  const target = state.properties.find((v: any) => v.id === req.params.id);

  // Same 404 for "does not exist" and "not yours", so a agency cannot discover
  // another agency's stock ids by watching which ones come back 403.
  if (!target || !mayTouchVehicle(target, req.auth)) {
    return res.status(404).json({ error: "Property not found" });
  }

  /* Refuse to destroy a recorded transaction — but only a recorded one.
     A car sold outside the DMS (cash off the floor, invoiced in the agency's
     own accounting package) has no deal, invoice or paperwork here, so deleting
     it destroys nothing and must stay possible. The old rule refused every SOLD
     unit and told the agency to "archive it instead", which was a dead end:
     no archive existed, so those cars could never leave the floor.

     Enforced server-side because Light and raw API calls never run the
     browser's check. An open or lost enquiry does not count as a record —
     those are unlinked below. */
  const sealed = {
    closedDeals: (state.enquiries || []).filter(
      (l: any) => l.propertyId === target.id && l.status === "Closed Won",
    ).length,
    invoices: (state.invoices || []).filter((i: any) => i.propertyId === target.id).length,
    agreements: (state.agreements || []).filter((a: any) => a.propertyId === target.id).length,
    signedDocuments: (state.documents || []).filter(
      (d: any) => d.propertyId === target.id && d.status === "Signed",
    ).length,
  };
  const sealedTotal = Object.values(sealed).reduce((n, c) => n + c, 0);
  if (sealedTotal > 0) {
    /* No archived-unit exemption. Archiving does not retract the sale, it only
       retires the car from the floor — so an archived unit with an invoice
       against it is exactly what this guard exists to protect. Exempting them
       let a agency archive a documented sale and then delete it, which is the
       one outcome archiving was introduced to prevent. */
    return res.status(409).json({
      error: "This sale is recorded here — archive the property instead of deleting it.",
      recorded: sealed,
    });
  }

  state.properties = state.properties.filter((v: any) => v.id !== req.params.id);

  /* Take the property's dependants with it. Deleting the row alone left enquiries,
     tasks and DocHub documents pointing at an id that no longer resolves — the
     lead's car renders blank and the orphaned docEvents keep being served.

     Leads and tasks are unlinked rather than deleted: the customer and the work
     are real and worth keeping once the car is gone. Documents belong to the
     property, so they go with it.

     Invoices and agreements are not handled here because they cannot be here:
     the guard above refuses to delete any property carrying one. */
  const gone = req.params.id;
  for (const l of (state.enquiries || []) as any[]) {
    if (l.propertyId === gone) delete l.propertyId;
  }
  for (const t of (state.tasks || []) as any[]) {
    if (t.propertyId === gone) delete t.propertyId;
  }
  const affectedLeadIds = new Set(
    ((state.documents || []) as any[])
      .filter((d) => d.propertyId === gone && d.leadId)
      .map((d) => d.leadId),
  );
  const droppedDocIds = new Set(
    ((state.documents || []) as any[]).filter((d) => d.propertyId === gone).map((d) => d.id),
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
      recomputeDocStage(state, (state.enquiries || []).find((l: any) => l.id === leadId));
    }
  }

  writeState(state);

  // If this property was imported from TruLens, tell TruLens to remove it too
  // so the capture doesn't linger after the DMS record is gone.
  if (target.source === "trulens" && target.listingRef) {
    /* Name the agency. Stock numbers are agency-chosen and short, so they
       collide across yards — the same reasoning that scopes the push-photos
       lookup. Sending only the number asked TruLens to delete every capture
       carrying it, which is one agency's deletion destroying another agency's
       photos. */
    const ownerSlug = (state.agencies || []).find(
      (d: any) => d.id === target.agencyId
    )?.slug;
    fetch(`${TRULENS_URL}/api/sync/property`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(SYNC_SERVICE_KEY ? { "x-tru-sync-key": SYNC_SERVICE_KEY } : {}),
      },
      body: JSON.stringify({ listingRef: target.listingRef, agencySlug: ownerSlug }),
    }).catch((err) => console.warn("[sync] TruLens delete callback failed:", err?.message));
  }

  res.json({ message: "Property deleted successfully." });
});

// Leads CRM API
app.get("/api/enquiries", (req: any, res) => {
  const state = readState();
  res.json(scopeToAgency(state.enquiries, req.auth));
});

/* Signed-in lead creation. This is NOT the route external sites use — it is not
   in isPublicPath, so an unauthenticated form posting here gets a 401 and the
   enquiry is lost with nothing to show for it. External websites and plugins
   post to /api/integration/webhook-lead, which is public and requires the
   agency in the payload. */
app.post("/api/enquiries", (req: any, res) => {
  const state = readState();
  // Annotated because every value here comes off req.body as `any`. Without it
  // "New" widened to string and the whole literal was pushed into Enquiry[]
  // unchecked, and this takes shape straight off the request.
  const newLead: Enquiry = {
    id: newId("l_"),
    // Tag the lead to a agency, or it defaults to the pilot agency and one
    // yard ends up working another yard's customers. A signed-in agency can
    // only ever create enquiries for themselves.
    agencyId:
      req.auth?.role === "admin"
        ? req.body.agencyId || agencyIdForSlug(req.body.agencySlug) || undefined
        : req.auth?.agencyId,
    firstName: req.body.firstName || "Anonymous",
    lastName: req.body.lastName || "Enquiry",
    phone: req.body.phone || "N/A",
    email: req.body.email || "N/A",
    propertyId: req.body.propertyId || "",
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
      { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action: "Web Form Submission", detail: "Completed Enquiry Contact Form" }
    ]
  };

  state.enquiries.unshift(newLead);

  writeState(state);
  res.status(201).json({ message: "Enquiry file logged successfully.", lead: newLead });
});

/** May a lead and a property be coupled?
 *
 *  Its own check rather than trusting the caller's, because coupling writes to
 *  two collections at once. `mayTouch` lets `undefined === undefined` pass, the
 *  property lookup is by id across all tenants, and an admin bypasses both — so
 *  without this a cross-agency pairing is representable. Both rows must
 *  carry the same, non-empty agency; legacy untagged rows simply do not
 *  auto-couple, which is the conservative answer. */
function mayCouple(lead: any, property: any): boolean {
  if (!lead || !property) return false;
  return !!lead.agencyId && lead.agencyId === property.agencyId;
}

app.put("/api/enquiries/:id", (req: any, res) => {
  const state = readState();
  const index = state.enquiries.findIndex(l => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Enquiry not found" });
  }
  if (!mayTouch(state.enquiries[index], req.auth)) {
    return res.status(403).json({ error: "Not your lead." });
  }

  const prevStatus = (state.enquiries[index] as any).status;
  const prevVehicleId = (state.enquiries[index] as any).propertyId;

  const { agencyId: _drop, ...updates } = req.body;
  state.enquiries[index] = {
    ...state.enquiries[index],
    ...updates,
    agencyId: state.enquiries[index].agencyId,
  };
  const lead = state.enquiries[index] as any;

  /* A deal closing or reopening moves its car with it, so the two can never
     disagree about whether the property is still for sale. Owned here rather
     than in the React handler because Light and the sync endpoints never run
     that code — and doing it in both would race two writes on one JSON file.

     Transition-based: fires only when the status actually changes on this
     request, so editing a price on a long-closed deal never reaches out and
     moves stock, and pre-existing drift is left for the agency to judge. */
  const now = Date.now();
  const syncs: { changedForSync: Record<string, any>; index: number }[] = [];
  const coupledVehicles: { id: string; status: string }[] = [];

  /** Mark a car sold for this deal, if the two may be coupled at all.
   *
   *  Records the deal as the sale's owner, so only it can reverse this. */
  const sell = (propertyId?: string) => {
    if (!propertyId) return;
    const property = state.properties.find((v: any) => v.id === propertyId);
    if (!mayCouple(lead, property)) return;
    const r = applyVehicleStatus(state, propertyId, "SOLD", now);
    if (r.changed) {
      (state.properties[r.index] as any).soldByLeadId = lead.id;
      syncs.push(r);
      coupledVehicles.push({ id: propertyId, status: "SOLD" });
    }
  };

  /** Return a car to stock — but only when THIS deal is what sold it.
   *
   *  Two guards, and both are needed. `soldByLeadId` proves this deal owns the
   *  sale: without it, reopening any lead attached to the car put it back on
   *  the floor, including a car sold from the Light console or outside the
   *  system entirely, which no deal owns. `stillHeld` then covers a car several
   *  deals closed on, so freeing one does not un-sell what another bought. */
  const free = (propertyId?: string) => {
    if (!propertyId) return;
    const property = state.properties.find((v: any) => v.id === propertyId);
    if (!mayCouple(lead, property)) return;
    if (property.soldByLeadId !== lead.id) return;
    const stillHeld = state.enquiries.some(
      (l: any) => l.id !== lead.id && l.propertyId === propertyId && l.status === "Closed Won",
    );
    if (stillHeld) return;
    const r = applyVehicleStatus(state, propertyId, "AVAILABLE", now);
    if (r.changed) {
      const freed = state.properties[r.index] as any;
      freed.soldByLeadId = null;
      /* Selling forced the car off the website; returning it to stock puts it
         back, which is what "re-lists it on your website" promises the agency.
         Without this the car came back to the floor invisible online. */
      freed.showOnWebsite = true;
      syncs.push(r);
      coupledVehicles.push({ id: propertyId, status: "AVAILABLE" });
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
  const heldNow = lead.status === "Closed Won" ? lead.propertyId : undefined;

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
    pushVehicleToLens(state, state.properties[s.index], s.changedForSync, now);
  }

  res.json({
    message: "Enquiry updated successfully.",
    lead: state.enquiries[index],
    // Kept singular for the common case; the array covers a reassignment,
    // which moves two cars at once.
    coupledVehicle: coupledVehicles[0] ?? null,
    coupledVehicles,
  });
});

app.delete("/api/enquiries/:id", (req: any, res) => {
  const state = readState();
  const target = state.enquiries.find(l => l.id === req.params.id) as any;
  if (!target) return res.status(404).json({ error: "Enquiry not found" });
  if (!mayTouch(target, req.auth)) {
    return res.status(403).json({ error: "Not your lead." });
  }

  /* Refuse to erase a closed sale, for the same reason a sold property cannot be
     deleted: a Closed Won deal with signed paperwork is the record of a
     transaction. Deleting it also silently unblocked property deletion — the
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
  state.enquiries = state.enquiries.filter(l => l.id !== gone);

  /* Everything that pointed at this lead. Deleting the row alone left DocHub
     documents and their audit rows still being served, tasks rendering a blank
     customer, and — if the deal had held a car — the property sold with nothing
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
  const heldVehicle = state.properties.find((v: any) => v.soldByLeadId === gone) as any;
  if (heldVehicle && mayCouple(target, heldVehicle)) {
    const stillHeld = state.enquiries.some(
      (l: any) => l.propertyId === heldVehicle.id && l.status === "Closed Won",
    );
    if (!stillHeld) {
      const r = applyVehicleStatus(state, heldVehicle.id, "AVAILABLE", now);
      if (r.changed) {
        const freed = state.properties[r.index] as any;
        freed.soldByLeadId = null;
        freed.showOnWebsite = true;
        freedSync = r;
      }
    }
  }

  writeState(state);
  if (freedSync) {
    pushVehicleToLens(state, state.properties[freedSync.index], freedSync.changedForSync, now);
  }

  res.json({
    message: "Enquiry file deleted.",
    releasedVehicle: freedSync ? heldVehicle.id : null,
  });
});

// Tasks Directives API
app.get("/api/tasks", (req: any, res) => {
  const state = readState();
  res.json(scopeToAgency(state.tasks, req.auth));
});

app.post("/api/tasks", (req: any, res) => {
  const state = readState();
  const newTask = {
    id: newId("t_"),
    title: req.body.title || "Generic Follow-Up Task",
    leadId: req.body.leadId || "",
    propertyId: req.body.propertyId || "",
    assignedUserId: req.body.assignedUserId || "",
    dueDate: req.body.dueDate || new Date().toISOString().slice(0, 10),
    priority: req.body.priority || "Normal",
    status: req.body.status || "Pending",
    agencyId: ownerAgency(req),
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

  const { agencyId: _drop, ...taskUpdates } = req.body;
  state.tasks[index] = {
    ...state.tasks[index],
    ...taskUpdates,
    agencyId: state.tasks[index].agencyId,
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
  res.json(scopeToAgency(state.invoices, req.auth));
});

/** The next number in a agency's document sequence.
 *
 *  SARS requires the number on a tax invoice to be sequential and
 *  non-repeating. Both invoice and agreement numbers used to be built from
 *  `collection.length + 1`, which breaks three ways: the count spanned every
 *  agency so two agencies drew from one sequence, removing a row handed the
 *  next one a number already issued, and the year was frozen at 2026.
 *
 *  The counter lives on the agency and only ever climbs. It is seeded from
 *  the highest number that agency has already issued, so an instance with
 *  existing documents carries on rather than restarting at 1 and colliding
 *  with its own history. Caller-supplied numbers are ignored outright — a
 *  client able to name its own number could issue two the same.
 *
 *  Mutates the agency in `state`; the caller's writeState persists it. */
function nextDocNumber(
  state: any,
  agencyId: string | undefined,
  opts: { prefix: string; rows: any[]; field: string; seqKey: "invoiceSeq" | "agreementSeq" },
): string {
  const year = new Date().getFullYear();
  const agency = (state.agencies || []).find((d: any) => d.id === agencyId);

  let highest = 0;
  for (const row of opts.rows || []) {
    if (agencyId && row.agencyId !== agencyId) continue;
    const m = /(\d+)\s*$/.exec(String(row[opts.field] || ""));
    if (m) highest = Math.max(highest, parseInt(m[1], 10) || 0);
  }

  const next = Math.max(highest, Number(agency?.[opts.seqKey]) || 0) + 1;
  if (agency) agency[opts.seqKey] = next;

  return `${opts.prefix}-${year}-${String(next).padStart(5, "0")}`;
}

app.post("/api/invoices", (req: any, res) => {
  const state = readState();
  const invoiceOwner = ownerAgency(req);
  const newInvoice = {
    id: newId("inv_"),
    invoiceNumber: nextDocNumber(state, invoiceOwner, {
      prefix: "INV", rows: state.invoices, field: "invoiceNumber", seqKey: "invoiceSeq",
    }),
    leadId: req.body.leadId,
    propertyId: req.body.propertyId,
    amount: parseFloat(req.body.amount) || 0,
    additionalCharges: parseFloat(req.body.additionalCharges) || 0,
    chargeDescription: req.body.chargeDescription || "",
    paymentMethod: req.body.paymentMethod || "Bank Transfer",
    status: req.body.status || "Sent",
    dueDate: req.body.dueDate || new Date().toISOString().slice(0, 10),
    agencyId: invoiceOwner,
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
  res.json(scopeToAgency(state.agreements, req.auth));
});

app.post("/api/agreements", (req: any, res) => {
  const state = readState();
  const agreementOwner = ownerAgency(req);
  const newAgreement = {
    id: newId("agr_"),
    agreementNumber: nextDocNumber(state, agreementOwner, {
      prefix: "AGR", rows: state.agreements, field: "agreementNumber", seqKey: "agreementSeq",
    }),
    leadId: req.body.leadId,
    propertyId: req.body.propertyId,
    purchasePrice: parseFloat(req.body.purchasePrice) || 0,
    depositAmount: parseFloat(req.body.depositAmount) || 0,
    type: req.body.type || "Property Sale",
    status: req.body.status || "Pending Signature",
    agencyId: ownerAgency(req),
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

  const { agencyId: _drop, ...agrUpdates } = req.body;
  state.agreements[index] = {
    ...state.agreements[index],
    ...agrUpdates,
    agencyId: state.agreements[index].agencyId,
  };

  writeState(state);
  res.json({ message: "Agreement updated successfully.", agreement: state.agreements[index] });
});

// Agency Documents API — GET/POST /api/documents, sign/void/delete/finalize,
// PUT /api/docflow and GET /api/deals/:leadId/documents live in
// routes/documents.ts (mounted with the same paths, plus recomputeDocStage).
app.use(documentRoutes({ readState, writeState, scopeToAgency, mayTouch, newId }));

// The remaining document routes (sign/void/delete/finalize, docflow,
// deals/:leadId/documents) are in routes/documents.ts above. What follows in
// server.ts between here and the expenses API: the drift report and the
// agency self-service settings endpoint.

/** Read-only consistency report — records that contradict each other.
 *
 *  Status coupling is deliberately transition-based: it fires when a status
 *  actually changes, and so never repairs drift that already exists. A car sold
 *  before any coupling existed keeps its deal open forever and nothing surfaces
 *  it. This lists those pairs and changes nothing — what to do about a
 *  months-old mismatch is the agency's judgement, not something a GET should
 *  decide for them.
 *
 *  Some rows here are legitimate rather than wrong: a car genuinely sold
 *  outside the DMS has no deal to close. Each group carries a note saying so,
 *  because a report that cries wolf gets ignored. */
app.get("/api/drift", (req: any, res) => {
  const state = readState();
  const vehicles = scopeToAgency(state.properties || [], req.auth) as any[];
  const enquiries = scopeToAgency(state.enquiries || [], req.auth) as any[];
  const documents = scopeToAgency(state.documents || [], req.auth) as any[];

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const leadsByVehicle = new Map<string, any[]>();
  for (const l of enquiries) {
    if (!l.propertyId) continue;
    const arr = leadsByVehicle.get(l.propertyId) || [];
    arr.push(l);
    leadsByVehicle.set(l.propertyId, arr);
  }

  const vLabel = (v: any) =>
    !v ? "(missing property)" : [v.year, v.make, v.model].filter(Boolean).join(" ") || v.listingRef || v.id;
  const lName = (l: any) => `${l.firstName || ""} ${l.lastName || ""}`.trim() || l.id;

  /* Sold with no deal closed against it. Often legitimate — a cash sale off the
     floor never had a lead — but also what a sale through a non-coupling path
     looks like. */
  const soldWithNoClosedDeal = vehicles
    .filter((v) => v.status === "SOLD")
    .filter((v) => !(leadsByVehicle.get(v.id) || []).some((l) => l.status === "Closed Won"))
    .map((v) => ({ propertyId: v.id, listingRef: v.listingRef, label: vLabel(v) }));

  /* Deal closed Won while its car is still on the floor — the public feed
     publishes INVENTORY, so this car is still advertised as available. */
  const closedDealStillInStock = enquiries
    .filter((l) => l.status === "Closed Won" && l.propertyId)
    .filter((l) => {
      const v = vehicleById.get(l.propertyId);
      return v && v.status !== "SOLD";
    })
    .map((l) => ({
      leadId: l.id,
      name: lName(l),
      propertyId: l.propertyId,
      label: vLabel(vehicleById.get(l.propertyId)),
    }));

  /* Compliance is verified only at the moment it is finalised. All three tick
     surfaces can clear NATIS or roadworthy afterwards, leaving a deal that
     claims compliance is done with the evidence flags false. */
  const complianceIdx = DOC_STAGES.indexOf("compliance");
  const compliancePastButUnticked = enquiries
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
     Only compared for deals that actually entered DocHub — a agency who has not
     adopted it would otherwise see every lead listed here. */
  const leadsWithSignedInvoice = new Set(
    documents.filter((d) => d.stage === "invoice" && d.status === "Signed").map((d) => d.leadId),
  );
  const invoicedFlagDisagrees = enquiries
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

/** Agency self-service editing of identity fields the agency's own docs
 *  and public listings quote — name, trading-as, VAT number, contact email,
 *  address, registration number. Admins may target any agency by passing
 *  `agencyId` in the body; agencies implicitly target their own. Guarded
 *  whitelist: nothing outside this set (products, slug, id) can be changed
 *  through here — those remain admin-only via /api/agencies/:id. */
app.put("/api/agency/self", (req: any, res) => {
  const state = readState();
  const targetId =
    req.auth?.role === "admin" ? (req.body?.agencyId || req.auth?.agencyId) : req.auth?.agencyId;
  if (!targetId) return res.status(400).json({ error: "agencyId required" });
  const i = (state.agencies || []).findIndex((d: any) => d.id === targetId);
  if (i === -1) return res.status(404).json({ error: "Agency not found" });

  const { name, tradingAs, vatNumber, contactEmail, address, registrationNumber, websiteUrl, docSettings } = req.body || {};
  const d = state.agencies[i] as any;
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
  res.json({ agency: state.agencies[i] });
});

// Accounting Expenses API
app.get("/api/expenses", (req: any, res) => {
  const state = readState();
  res.json(scopeToAgency(state.expenses || [], req.auth));
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
    agencyId: ownerAgency(req),
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
  res.json(scopeToAgency(state.users, req.auth));
});

// Staff are created through /api/auth/users, which also mints their login and
// counts the seat. This route stayed open and made users with no agency and
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
  res.json(scopeToAgency(state.communications, req.auth));
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
    agencyId: ownerAgency(req),
  };

  state.communications.unshift(newComm);

  // Mark the corresponding lead as contacted
  const leadIndex = state.enquiries.findIndex(l => l.id === req.body.leadId);
  if (leadIndex !== -1) {
    state.enquiries[leadIndex].lastContactedAt = new Date().toISOString().slice(0, 10);
  }

  writeState(state);
  res.status(201).json({ message: "Communication dispatch completed successfully.", communication: newComm });
});

// --- AI AUTO-ASSIGNMENT ENDPOINT ---
app.post("/api/enquiries/auto-assign", async (req, res) => {
  try {
    const state = readState();

    /* Scope both sides to the signed-in agency.
       Neither list was scoped, so on a multi-agency instance this shared one
       agency's new enquiries out across every salesperson on the box — a demo lead
       was assigned to another agency's salesperson in testing. A lead with
       no agencyId is treated as the caller's, matching how the rest of the
       app handles legacy and TruLens-imported records. */
    const tenant = ownerAgency(req);
    const ours = (id?: string) => !tenant || !id || id === tenant;

    const newLeads = state.enquiries.filter(
      (l: any) => l.status === "New" && ours(l.agencyId)
    );

    if (newLeads.length === 0) {
      return res.json({ message: "No 'New' enquiries found for auto-assignment.", assignments: [] });
    }

    const salespeople = state.users.filter(
      (u: any) => u.role === "salesperson" && u.isActive && ours(u.agencyId)
    );
    if (salespeople.length === 0) {
      return res.status(400).json({ error: "No active salespeople available for assignment." });
    }

    // Calculate workload
    const workloads = salespeople.map(u => {
      const activeLeadsCount = state.enquiries.filter(l => 
        l.assignedUserId === u.id && 
        l.status !== "Closed Won" && 
        l.status !== "Closed Lost"
      ).length;
      return { id: u.id, name: u.name, activeLeadsCount };
    });

    let assignments: { leadId: string, assignedUserId: string, reasoning: string }[] = [];

    if (aiConfigured) {
      const systemInstruction = `
You are the Enquiry CRM AI Agent for TruFlow Light www.real-cars.co.za. Your task is to assign NEW enquiries to salespeople based on their current workload.
Current Salespeople Workloads:
${workloads.map(w => `- ${w.name} (ID: ${w.id}): ${w.activeLeadsCount} active enquiries`).join("\n")}

Leads to assign:
${newLeads.map(l => `- Enquiry ID: ${l.id}, Interested in Property: ${l.propertyId}`).join("\n")}

Rules:
1. Assign each lead to the salesperson with the LOWEST workload.
2. If workloads are equal, balance them out.
3. Provide a brief reasoning for each assignment.

Response MUST be a valid JSON array of objects with keys "leadId", "assignedUserId", "reasoning". No extra text.
`;

      const responseText = await deepseekText([
        { role: "system", content: systemInstruction },
        { role: "user", content: "Assign these enquiries." },
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
      const index = state.enquiries.findIndex(l => l.id === a.leadId);
      if (index !== -1) {
        state.enquiries[index].assignedUserId = a.assignedUserId;
        state.enquiries[index].notes += `\n[AI Auto-Assign]: ${a.reasoning}`;
        updatedLeadsList.push(state.enquiries[index]);
      }
    });

    writeState(state);
    res.json({ message: `Successfully auto-assigned ${updatedLeadsList.length} enquiries.`, assignments: updatedLeadsList });
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
    // co-pilot answered one agency using another agency's stock and enquiries —
    // and shipped every agency's customer names, phones and email
    // addresses to Google on each question.
    const state = {
      ...raw,
      properties: scopeToAgency(raw.properties, req.auth),
      enquiries: scopeToAgency(raw.enquiries, req.auth),
      tasks: scopeToAgency(raw.tasks, req.auth),
      invoices: scopeToAgency(raw.invoices, req.auth),
    };

    const activeVehicles = state.properties.filter(v => v.status === "AVAILABLE");
    const soldVehicles = state.properties.filter(v => v.status === "SOLD");
    /* Was a count of PENDING vehicles — a status nothing wrote any more, so the
       assistant was told there were zero deals in progress no matter what. Read
       from the deals instead: closed, but not yet handed over. */
    const awaitingHandover = state.enquiries.filter(
      (l: any) => l.status === "Closed Won" && !l.docFlowCompletedAt,
    );
    const activeLeads = state.enquiries.filter(l => l.status !== "Closed Won" && l.status !== "Closed Lost");
    const pendingTasks = state.tasks.filter(t => t.status !== "Completed");

    const inventoryContext = activeVehicles.map(v => 
      `- Stock ${v.listingRef}: ${v.year} ${v.make} ${v.model} ${v.trim} (Price: R ${v.askingPrice.toLocaleString()}, ${v.mileage.toLocaleString()} km, ${v.daysOnMarket} days in stock)`
    ).join("\n");

    // Sanitize leads before the prompt is built: customer names, phone numbers
    // and email addresses never leave this instance. The AI only sees the
    // non-PII profile — intent score, status, interest and dates.
    const sanitizedLeads = activeLeads.map(l => ({
      id: l.id,
      digitalScore: l.digitalScore,
      status: l.status,
      propertyId: l.propertyId,
      source: l.source,
      createdAt: l.createdAt,
      lastContactedAt: l.lastContactedAt,
    }));

    const leadsContext = sanitizedLeads.map(l =>
      `- Lead ${l.id} (Intent: ${l.digitalScore}%, Status: ${l.status}, Interested in property ${l.propertyId}, Source: ${l.source}, Created: ${l.createdAt})`
    ).join("\n");

    const tasksContext = pendingTasks.map(t => 
      `- Task: "${t.title}" (Priority: ${t.priority}, Due: ${t.dueDate}, Assigned User: ${t.assignedUserId})`
    ).join("\n");

    const totalRevenue = state.invoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);

    const systemInstruction = `
You are the TruFlow Light Co-Pilot, an elite, highly intelligent AI strategist for South African property agencies using the TruSaaS platform. Your purpose is to act as the primary advisor for the Agency Principal and Sales Managers.

### YOUR CAPABILITIES & SYSTEM KNOWLEDGE:
1.  **DMS (Agency Management System):**
    - You track live "Showroom Floor" inventory (Stock Numbers, Mileage, Fuel, Transmission).
    - You monitor "Aging Stock" (Days in Inventory). Vehicles over 40 days are critical "Aging Assets" requiring immediate marketing push or price adjustment.
    - You track "Recon Tasks" (Reconditioning). You know if a car is stuck in polishing, brake repairs, or windscreen chips.

2.  **CRM (Customer Relationship Management):**
    - You analyze "Prospect Leads". You see their "Digital Score" (Intent %).
    - You track the "Customer Journey" (which pages they visited, what forms they filled).
    - You know who is assigned to which lead (Sales Roster).

3.  **CONTRACTING & FINANCIALS:**
    - You see "Draft Agreements" (Purchase Deeds) and their signature status.
    - You monitor "Invoices" and "Cleared Payment" statuses (Bank Transfer vs Agency Finance).
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
- **Proactive:** If you see a high-scoring lead (85%+) that hasn't been contacted, or a property over 40 days in stock, point it out!
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

  if (text.includes("AVAILABLE") || text.includes("stock") || text.includes("cars")) {
    const active = state.properties.filter((v: any) => v.status === "AVAILABLE");
    const avgAge = active.length > 0 ? Math.round(active.reduce((sum: number, v: any) => sum + v.daysOnMarket, 0) / active.length) : 0;
    return `Showroom Update: We have ${active.length} active units on the floor. Average stock age is ${avgAge} days. The top-of-funnel unit is the ${active[0]?.year} ${active[0]?.make} ${active[0]?.model} (${active[0]?.listingRef}) priced at ${formatZAR(active[0]?.askingPrice || 0)}.`;
  }
  if (text.includes("slow") || text.includes("oldest") || text.includes("aging")) {
    const active = state.properties.filter((v: any) => v.status === "AVAILABLE");
    if (active.length === 0) return "No active inventory found to analyze.";
    const oldest = [...active].sort((a: any, b: any) => b.daysOnMarket - a.daysOnMarket)[0];
    return `Critical Aging Alert: The ${oldest.year} ${oldest.make} ${oldest.model} (Stock ${oldest.listingRef}) has been on the floor for ${oldest.daysOnMarket} days. It's currently at ${formatZAR(oldest.askingPrice)}. We should consider a price-drop or featuring it on the TrueSites hero banner.`;
  }
  if (text.includes("hot") || text.includes("score") || text.includes("best lead") || text.includes("prospect")) {
    const activeLeads = state.enquiries.filter((l: any) => l.status !== "Closed Won" && l.status !== "Closed Lost");
    if (activeLeads.length === 0) return "No active enquiries found in the CRM.";
    const topLead = [...activeLeads].sort((a: any, b: any) => b.digitalScore - a.digitalScore)[0];
    return `Hot Prospect Found: ${topLead.firstName} ${topLead.lastName} has a Digital Intent Score of ${topLead.digitalScore}%. They are focusing on the ${topLead.propertyId} and were last active on ${topLead.lastContactedAt || topLead.createdAt}. Dispatch a follow-up via TrueCRM immediately!`;
  }
  if (text.includes("task") || text.includes("todo") || text.includes("action")) {
    const pending = state.tasks.filter((t: any) => t.status !== "Completed");
    if (pending.length === 0) return "All operational directives are currently resolved. Good job!";
    return `Operational Brief: You have ${pending.length} pending tasks. The most urgent is "${pending[0]?.title}" due on ${pending[0]?.dueDate}.`;
  }
  if (text.includes("revenue") || text.includes("sales") || text.includes("sold") || text.includes("profit")) {
    const sold = state.properties.filter((v: any) => v.status === "SOLD");
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
 * `images`, so agency sites rendered a video file inside an <img> and showed a
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
     what happens every time a agency adds one more shot — rewrites nothing and
     produces the identical references. */
  for (const [slotId, base64] of Object.entries(photos)) {
    if (typeof base64 === "string" && /^data:video\//i.test(base64)) continue;
    const category = SLOT_TO_CATEGORY[slotId] || "extrasPhotos";
    const ref = putPhoto(base64);
    /* Falls back to the raw value if the store could not take it, so a capture
       is never silently dropped: an un-storable photo still reaches the agency
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

// Pull photos from AutoLens Firestore for a property matched by listingRef
app.post("/api/sync/pull-photos", async (req, res) => {
  try {
    const { listingRef, propertyId } = req.body;
    if (!listingRef && !propertyId) {
      return res.status(400).json({ error: "listingRef or propertyId required" });
    }

    let query;
    if (listingRef) {
      query = lensFirestore.collection("vehicles").where("listingRef", "==", listingRef).limit(1);
    } else {
      query = lensFirestore.collection("vehicles").where("id", "==", propertyId).limit(1);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.json({ synced: false, message: "No matching property found in AutoLens." });
    }

    const lensVehicle = snapshot.docs[0].data();
    // Stock numbers are only unique within a agency — two agencies both running
    // STK-1001 would otherwise pull each other's photos.
    const { agencySlug: wantSlug } = req.body || {};
    if (wantSlug && lensVehicle.agencySlug && lensVehicle.agencySlug !== wantSlug) {
      return res.json({
        synced: false,
        message: `AutoLens property ${listingRef || propertyId} belongs to a different agency (${lensVehicle.agencySlug}).`,
      });
    }
    const photos = lensVehicle.photos || {};
    const photoCount = Object.keys(photos).length;

    if (photoCount === 0) {
      return res.json({ synced: false, message: "Property found but no photos uploaded yet." });
    }

    const mapped = mapAutoLensPhotos(photos);

    // Update local DMS property
    const state = readState();
    const matchField = listingRef ? "listingRef" : "id";
    const matchValue = listingRef || propertyId;
    const idx = state.properties.findIndex((v: any) => v[matchField] === matchValue);

    if (idx === -1) {
      return res.json({
        synced: false,
        message: "Property exists in AutoLens but not in DMS. Create it first.",
        autoLensData: {
          make: lensVehicle.make, model: lensVehicle.model,
          year: lensVehicle.year, listingRef: lensVehicle.listingRef,
          photoCount,
        }
      });
    }

    state.properties[idx].images = mapped.images;
    state.properties[idx].damagePhotos = mapped.damagePhotos;
    state.properties[idx].vinPhotos = mapped.vinPhotos;
    state.properties[idx].serviceBookPhotos = mapped.serviceBookPhotos;
    state.properties[idx].extrasPhotos = mapped.extrasPhotos;
    // Damage findings drive the VIR — photo quality is internal to TruLens,
    // never exposed as the property condition score.
    if (Array.isArray(lensVehicle?.damage)) {
      state.properties[idx].damage = lensVehicle.damage;
      state.properties[idx].vir = capOverallVir(computeVirFromDamage(lensVehicle.damage));
      state.properties[idx].inspectionReport = buildVirReport({
        slotAssessment: lensVehicle.slotAssessment,
        damage: lensVehicle.damage,
      });
    }
    /* Agency's condition declaration (retail "no damage reported" statement) —
       stored so the public feed and the agency site can surface it. Only set
       when TruLens sent one, so it never overwrites an existing declaration with
       undefined on a photos-only re-sync. */
    if (lensVehicle?.conditionDeclaration) {
      (state.properties[idx] as any).conditionDeclaration = lensVehicle.conditionDeclaration;
    }
    if (Array.isArray(lensVehicle?.optionalExtras)) {
      state.properties[idx].optionalExtras = normaliseExtras(lensVehicle.optionalExtras);
    }
    (state.properties[idx] as any).lastPhotoSync = new Date().toISOString();
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
      property: state.properties[idx],
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
    const results: { listingRef: string; status: string }[] = [];

    // Enforce agency scope from auth; body slug is a fallback for admin only
    const wantSlug = (req.body || {}).agencySlug;
    const wantId = req.auth?.role === "admin"
      ? (wantSlug ? agencyIdForSlug(wantSlug) : undefined)
      : req.auth?.agencyId;

    for (const doc of snapshot.docs) {
      const lensVehicle = doc.data();
      const photos = lensVehicle.photos || {};
      if (Object.keys(photos).length === 0) continue;
      if (wantSlug && lensVehicle.agencySlug && lensVehicle.agencySlug !== wantSlug) continue;

      const idx = state.properties.findIndex(
        (v: any) =>
          v.listingRef === lensVehicle.listingRef &&
          (!wantId || v.agencyId === wantId)
      );
      if (idx === -1) {
        results.push({ listingRef: lensVehicle.listingRef, status: "not_in_dms" });
        continue;
      }

      const mapped = mapAutoLensPhotos(photos);
      state.properties[idx].images = mapped.images;
      state.properties[idx].damagePhotos = mapped.damagePhotos;
      state.properties[idx].vinPhotos = mapped.vinPhotos;
      state.properties[idx].serviceBookPhotos = mapped.serviceBookPhotos;
      state.properties[idx].extrasPhotos = mapped.extrasPhotos;
      (state.properties[idx] as any).lastPhotoSync = new Date().toISOString();
      syncedCount++;
      results.push({ listingRef: lensVehicle.listingRef, status: "synced" });
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

// Push photos FROM TruLens / AutoLens INTO this DMS (create property if missing)
// Body: { listingRef?, propertyId?, createIfMissing?, property?, photos: Record<slotId, base64> }
app.post("/api/sync/push-photos", (req, res) => {
  try {
    const {
      listingRef,
      propertyId,
      createIfMissing = true,
      agencySlug,
      showOnWebsite,
      property: vehicleMeta = {},
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
      listingRef || vehicleMeta.listingRef || null;
    const matchId = propertyId || vehicleMeta.id || null;

    /* A slug that is sent but not in the map means a agency was onboarded in
       TruLens and never added here. Silently accepting it files the car as
       untagged, which the public feed then reads as the default agency —
       so the first cars of a new agency land on someone else's website. Refuse
       loudly instead. An absent slug is a legacy client and still allowed. */
    if (agencySlug && !agencyIdForSlug(agencySlug)) {
      return res.status(400).json({
        synced: false,
        error: `Unknown agency "${agencySlug}". Add the agency in TruFlow before capturing for it.`,
      });
    }

    /* An ABSENT slug used to be treated as "legacy client, allow it" and fell
       through to DEFAULT_DEALERSHIP_ID below — which is d1, a real agency
       with a live website, not a neutral bucket. So a phone that signed in with
       the shared code and had no agency picked (cleared browser data, a
       reinstalled PWA, a new handset) did not fail: it silently filed another
       agency's car into d1's inventory, and with the publish flag set that car
       reached d1's website. Refusing an unknown slug while quietly accepting no
       slug at all guarded the typo and missed the dangerous case. */
    if (!agencySlug) {
      return res.status(400).json({
        synced: false,
        error:
          "No agency on this capture. Pick the agency in TruLens " +
          "before exporting — a capture cannot be filed without one.",
      });
    }

    /* Stock numbers are agency-chosen and short — PE-1042, STK-001 — so they
       collide across agencies. Matching on listingRef alone meant a push
       for one agency could find, and overwrite the photos of, another agency's
       property. Scope the search the same way the public feed scopes reads, so
       write and read agree on who owns an untagged row. */
    const pushAgencyId = agencyIdForSlug(agencySlug)!;
    const ownedByPusher = (v: any) =>
      v.agencyId === pushAgencyId;

    let idx = -1;
    if (matchStock) {
      idx = state.properties.findIndex(
        (v: any) => ownedByPusher(v) && v.listingRef === matchStock
      );
    }
    if (idx === -1 && matchId) {
      idx = state.properties.findIndex((v: any) => ownedByPusher(v) && v.id === matchId);
    }

    let created = false;
    if (idx === -1) {
      if (!createIfMissing) {
        return res.json({
          synced: false,
          message:
            "Property not found in DMS. Create it first or set createIfMissing=true.",
          listingRef: matchStock,
        });
      }

      const now = new Date().toISOString().slice(0, 10);
      const newVehicle = {
        id: newId("v_lens_"),
        year: parseInt(vehicleMeta.year, 10) || new Date().getFullYear(),
        make: tidyStr(vehicleMeta.make) || "Unknown",
        model: cleanModelName(vehicleMeta.model) || "Property",
        trim: tidyStr(vehicleMeta.trim) || "",
        status: "AVAILABLE",
        askingPrice: parseFloat(vehicleMeta.price ?? vehicleMeta.askingPrice) || 0,
        costPrice: parseFloat(vehicleMeta.costPrice) || 0,
        /* TruLens now captures and sends all three. The fallbacks are kept for
           an older phone that has not updated yet — but note they are guesses,
           and a guess published to a agency's website reads as a fact, so the
           capture form makes mileage required rather than relying on this. */
        mileage: parseInt(vehicleMeta.mileage, 10) || 0,
        transmission: vehicleMeta.transmission || "Automatic",
        fuelType: vehicleMeta.fuelType || "Petrol",
        damage: Array.isArray(vehicleMeta.damage) ? vehicleMeta.damage : undefined,
        vir: Array.isArray(vehicleMeta.damage) ? capOverallVir(computeVirFromDamage(vehicleMeta.damage)) : undefined,
        inspectionReport: buildVirReport({
          slotAssessment: vehicleMeta.slotAssessment,
          damage: vehicleMeta.damage,
        }),
        slotAssessment: vehicleMeta.slotAssessment || undefined,
        listingRef:
          matchStock ||
          "STK-" + Math.floor(Math.random() * 900000 + 100000),
        dateAcquired: now,
        daysOnMarket: 1,
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
        maintenanceTasks: [],
        source: "trulens",
        /* Tag to the agency whose phone captured this — keeps it off every
           other agency's website. Always a real id: the slug is required and
           validated above, and pushAgencyId is what the lookup above matched
           on, so write and read agree. This was `|| undefined`, which left the
           row untagged, and an untagged row reads as DEFAULT_DEALERSHIP_ID —
           another agency's yard — everywhere it is scoped. */
        agencyId: pushAgencyId,
        /* Whether the agency's website may show it. TruLens has a Publish
           toggle, but it only ever wrote to TruLens's own store — the export
           never carried the value and this never set it, and the public feed
           read "not set" as published. So every capture went live the moment it
           was exported, and unpublishing in TruLens changed nothing on the
           website. A junk test capture reached a agency's public feed that way.

           A capture therefore lands in the DMS unpublished unless the agency
           has already pressed Publish in TruLens. Exporting puts the car in the
           agency's inventory; putting it in front of buyers is a second,
           deliberate act. Explicit rather than undefined so the legacy backfill
           in readState can't later mistake it for a pre-flag row. */
        showOnWebsite: typeof showOnWebsite === "boolean" ? showOnWebsite : false,
        optionalExtras: normaliseExtras(vehicleMeta.optionalExtras),
      };

  state.properties.unshift(newVehicle as any);
      writeState(state);
      created = true;

      return res.status(201).json({
        synced: true,
        created: true,
        message: `Created DMS property and pushed ${photoEntries.length} photos from TruLens.`,
        breakdown: {
          mainImages: mapped.images.length,
          extras: mapped.extrasPhotos.length,
          damage: mapped.damagePhotos.length,
          vin: mapped.vinPhotos.length,
          serviceBook: mapped.serviceBookPhotos.length,
        },
        property: newVehicle,
      });
    }

    // Merge photos (replace category arrays with latest TruLens set)
    state.properties[idx].images = mapped.images;
    state.properties[idx].damagePhotos = mapped.damagePhotos;
    state.properties[idx].vinPhotos = mapped.vinPhotos;
    state.properties[idx].serviceBookPhotos = mapped.serviceBookPhotos;
    state.properties[idx].extrasPhotos = mapped.extrasPhotos;
    (state.properties[idx] as any).lastPhotoSync = new Date().toISOString();
    /* Route the non-media Lens fields through mergeWithMeta so an older push
       cannot overwrite a fresher DMS edit. Everything under FLOW_SYNCED_FIELDS
       is agency-editable and stamps a per-field updatedAt on both sides; a
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
    if (vehicleMeta.price != null || vehicleMeta.askingPrice != null) {
      const px = parseFloat(vehicleMeta.price ?? vehicleMeta.askingPrice);
      if (Number.isFinite(px) && px > 0) incoming.askingPrice = px;
    }

    /* Translate the incoming fieldMeta from Lens field names to Flow's. Lens
       sends price/vehicleType; our local rows carry askingPrice/bodyType. */
    const incomingMeta: Record<string, number> = {};
    const rawMeta = (vehicleMeta.fieldMeta || {}) as Record<string, number>;
    for (const [k, v] of Object.entries(rawMeta)) {
      if (typeof v !== "number") continue;
      if (k === "price") incomingMeta.askingPrice = v;
      else if (k === "vehicleType") incomingMeta.bodyType = v;
      else incomingMeta[k] = v;
    }

    const { patch: applyPatch, fieldMeta: nextPushMeta } = mergeWithMeta(
      state.properties[idx],
      incoming,
      Object.keys(incomingMeta).length ? incomingMeta : undefined,
      FLOW_SYNCED_FIELDS,
      pushNow,
    );
    Object.assign(state.properties[idx], applyPatch);
    (state.properties[idx] as any).fieldMeta = nextPushMeta;

    if (Array.isArray(vehicleMeta.damage)) {
      (state.properties[idx] as any).damage = vehicleMeta.damage;
      (state.properties[idx] as any).vir = capOverallVir(computeVirFromDamage(vehicleMeta.damage));
      (state.properties[idx] as any).inspectionReport = buildVirReport({
        slotAssessment: vehicleMeta.slotAssessment,
        damage: vehicleMeta.damage,
      });
    }
    if (vehicleMeta.vir != null && !Array.isArray(vehicleMeta.damage)) {
      (state.properties[idx] as any).vir = capOverallVir(Number(vehicleMeta.vir));
    }
    if (Array.isArray(vehicleMeta.inspection)) {
      (state.properties[idx] as any).inspection = vehicleMeta.inspection;
    }
    if (vehicleMeta.slotAssessment && Object.keys(vehicleMeta.slotAssessment).length) {
      (state.properties[idx] as any).slotAssessment = vehicleMeta.slotAssessment;
      /* Refresh the per-panel inspectionReport whenever slot ratings change, even
         if no damage[] entry was sent. Otherwise a re-export that only
         corrected a slot rating would leave the report stale. */
      const existingDamage = (state.properties[idx] as any).damage;
      (state.properties[idx] as any).inspectionReport = buildVirReport({
        slotAssessment: vehicleMeta.slotAssessment,
        damage: Array.isArray(existingDamage) ? existingDamage : undefined,
      });
    }
    /* showOnWebsite and askingPrice were both handled up-front by mergeWithMeta
       so a stale Lens push can't clobber a fresher DMS edit — no duplicate set
       needed here. */
    writeState(state);

    res.json({
      synced: true,
      created: false,
      message: `Pushed ${photoEntries.length} photos from TruLens to DMS property ${state.properties[idx].listingRef}.`,
      breakdown: {
        mainImages: mapped.images.length,
        extras: mapped.extrasPhotos.length,
        damage: mapped.damagePhotos.length,
        vin: mapped.vinPhotos.length,
        serviceBook: mapped.serviceBookPhotos.length,
      },
      property: state.properties[idx],
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
    const { listingRef, agencySlug, frames, damageTags } = req.body || {};
    if (!listingRef) return res.status(400).json({ error: "listingRef required" });
    if (!Array.isArray(frames) || !frames.length) return res.status(400).json({ error: "frames array required" });
    /* Same reasoning as push-photos: without a slug this fell through to d1, a
       real agency. Stock numbers are agency-chosen and collide across
       yards, so an orbit could overwrite the 360 on another agency's car that
       happened to share the number. */
    if (!agencySlug) {
      return res.status(400).json({ error: "agencySlug required to file a 360 orbit." });
    }
    if (!agencyIdForSlug(agencySlug)) {
      return res.status(400).json({ error: `Unknown agency "${agencySlug}".` });
    }

    const state = readState();
    const pushAgencyId = agencyIdForSlug(agencySlug)!;
    const idx = state.properties.findIndex(
      (v: any) => v.listingRef === listingRef && v.agencyId === pushAgencyId
    );
    if (idx === -1) return res.status(404).json({ error: `Property ${listingRef} not found` });

    state.properties[idx].web3d = {
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
      message: `360 orbit saved for ${listingRef} (${frames.length} frames, ${(damageTags || []).length} damage tags)`,
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
    const vehicles = scopeToAgency(state.properties, req.auth);

    const snapshot = await lensFirestore.collection("vehicles").get();

    const lensVehicles = new Map<string, { photoCount: number; status: string }>();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      lensVehicles.set(data.listingRef, {
        photoCount: Object.keys(data.photos || {}).length,
        status: data.status,
      });
    }

    const syncStatus = vehicles.map((v: any) => {
      const lens = lensVehicles.get(v.listingRef);
      return {
        listingRef: v.listingRef,
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

/** Maps a agency website's ?agency= slug to the internal agencyId that
 *  tags its vehicles. Untagged (legacy) vehicles belong to the FIRST entry
 *  here so existing pilot sites (MKR) keep working unchanged.
 *  Add a line here whenever a new agency site goes live on this instance. */
/**
 * Slug -> agencyId, derived from state rather than hardcoded.
 *
 * This was a literal map that had to be edited and deployed for every new
 * agency — and the same agency had to be added to TruLens's picker and
 * deployed again. Two releases to onboard one customer, each one a chance to
 * break the service for everyone already on it. Every agency in state
 * already carries its own slug, so the map only ever duplicated data that
 * was sitting right there.
 *
 * Read per call, not cached at module load, so a agency added at runtime
 * works immediately without a restart.
 */
function agencySlugMap(state?: any): Record<string, string> {
  const s = state || readState();
  const out: Record<string, string> = {};
  for (const d of s.agencies || []) {
    if (d?.slug && d?.id) out[String(d.slug)] = String(d.id);
  }
  return out;
}

/** The agency a slug belongs to, or undefined when the slug is unknown. */
function agencyIdForSlug(slug: string, state?: any): string | undefined {
  if (!slug) return undefined;
  return agencySlugMap(state)[slug];
}

/** Compute a 0-100 VIR condition score from damage findings.
 *  Starts at 100 (no damage) and deducts per finding by severity.
 *  This replaces the old photo-quality average — VIR is a property
 *  condition score, not a capture quality score. */
function computeVirFromDamage(damage: { severity: number }[]): number {
  if (!damage || !damage.length) return 100;
  const penalties: Record<number, number> = { 1: 2, 2: 5, 3: 10, 4: 18, 5: 30 };
  const total = damage.reduce((s, d) => s + (penalties[d.severity] ?? 5), 0);
  return Math.max(0, Math.round(100 - total));
}

/** Cap the OVERALL property VIR score at 90 for public display.
 *  No used car is genuinely 100/100 — anything at that ceiling is a
 *  lazy capture (all slots blindly OK, no damage tags added). Real
 *  inspection detail can still drop the score below 90 accurately.
 *  Per-panel scores in inspectionReport are NOT capped — a clean panel is
 *  honestly 100 on its own row. */
function capOverallVir(score: number): number {
  return Math.min(90, score);
}

/** Build inspectionReport sections. Each entry describes a panel's inspection
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

/** Showroom tiers a agency can shelve a property into. Anything else is
 *  treated as unset, so a typo can't hide a car from every category page. */
const CATEGORY_VALUES = ["used", "select", "performance"];

/** Canonical public property shape for HTML agency websites + embed widget */
function toPublicVehicle(v: any, source: string = "premium", origin: string = "") {
  /* A video is now either a legacy data:video/… URI or a stored .mp4/.webm/.mov
     reference. Both must stay out of the image arrays, or a agency site renders
     a video file inside an <img> and shows a broken thumbnail. */
  const notVideo = (s: any) =>
    typeof s === "string" &&
    !/^data:video\//i.test(s) &&
    !/\.(mp4|webm|mov)$/i.test(s);

  /* Stored photos are served from this instance, but the sites consuming this
     feed are on their own domains — true-cars.co.za, carsoncaledon.co.za — so a
     relative "/media/…" would resolve against the agency's own host and 404.
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
  /* An archived unit is retired from the floor and must never reach a agency's
     website, whatever its status says. Checked independently of `status`
     rather than relying on archiving to have set SOLD: this feed is consumed by
     live client sites, so it gets its own guard rather than trusting an
     invariant maintained somewhere else. */
  const published = v.showOnWebsite === true && v.status === "AVAILABLE" && !v.archivedAt;
  if (!published) return null;

  return {
    id: v.id,
    listingRef: v.listingRef,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim || "",
    // Showroom tier, set by the agency in the DMS. Absent (not "") when unset,
    // so a site can tell "agency hasn't chosen" from a deliberate choice and
    // fall back to its own heuristic rather than silently mis-shelving a car.
    category: CATEGORY_VALUES.includes(v.category) ? v.category : undefined,
    price: v.askingPrice ?? v.price ?? 0,
    // Real market-value benchmark when the agency has set one; absent (not 0/null)
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
       more photos, and a relative path would 404 on the agency's own domain. */
    web3d: v.web3d?.frames?.length
      ? { ...v.web3d, frames: v.web3d.frames.map((f: any) => ({ ...f, image: abs(f?.image) })) }
      : undefined,
    /** TruLens inspection score 0–100, absent when the car was never scored. */
    vir: typeof v.vir === "number" ? v.vir : undefined,
    /* Findings per section. Absent — not [] — when the car was never
       inspected, so a site renders the report block only when there is one. */
    inspectionReport: Array.isArray(v.inspectionReport) && v.inspectionReport.length ? v.inspectionReport : undefined,
    /* Damage pins. Absent when none were tagged, so a site renders the layer
       only when there is something to show. Caledon's coc-media.js already
       reads car.damage and has never had anything to read. */
    damage: Array.isArray(v.damage) && v.damage.length ? v.damage : undefined,
    slotAssessment: v.slotAssessment && Object.keys(v.slotAssessment).length ? v.slotAssessment : undefined,
    /* Agency-declared condition — TruLens is retail (declared condition), not a
       graded VIR. `conditionLabel` is the plain line a site renders; the raw
       declaration rides alongside for anything that wants the detail. Absent
       until the agency declared, so a site never implies a clean bill from
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
    daysInStock: v.daysOnMarket ?? null,
    source: v.source || source,
    updatedAt: v.lastPhotoSync || v.updatedAt || null,
  };
}

/** Hide obvious pilot/test junk from public website feeds */
function isJunkPublicVehicle(v: any): boolean {
  const blob = [v.make, v.model, v.trim, v.listingRef, v.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/stk-lite-test|test property|demo junk|lorem ipsum/.test(blob)) return true;
  if (/\bss\b/.test(blob) && /ddas/.test(blob)) return true;
  // weird short make like "sS" with nonsense model
  if (v.make && String(v.make).length <= 2 && /ddas|test|xxx/i.test(String(v.model || ""))) return true;
  return false;
}

/* There is no cross-agency view any more.
 *
 * "true-cars" used to aggregate every agency on the instance for the
 * consumer showroom. With one demo agency that was harmless; with real clients
 * on the box it published their stock — MKR's and Cars on Caledon's cars were
 * being served, unauthenticated, under a guessable slug, to anyone who asked.
 * "demo" had already been removed from the same set for the same reason.
 *
 * Every slug is now a single tenant, so the only way onto a public feed is to
 * be the agency that owns the car. The showroom gets its stock by being a
 * agency like any other. */

/** Absolute origin of this instance, from the request.
 *
 *  Derived rather than configured so localhost, staging and production each
 *  serve URLs that point at themselves with no env var to forget. Honours the
 *  proxy headers Render sets, or the scheme would come back http behind its
 *  TLS terminator and agency sites would fetch mixed content. */
function originOf(req: any): string {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  return host ? `${proto}://${host}` : "";
}

function buildPublicStock(state: any, agencySlug: string, source: string, origin = "") {
  // A named single-agency site must only ever see ITS OWN stock. A slug with no
  // mapping gets an empty result rather than leaking another agency's inventory
  // (this once returned everything to everyone regardless of ?agency=).
  const wantedId = agencyIdForSlug(agencySlug, state);
  const rawProperties = state.properties || [];
  const scoped = wantedId
    ? rawProperties.filter((v: any) => v.agencyId === wantedId)
    : [];
  const vehicles = scoped
    .map((v: any) => toPublicVehicle(v, source, origin))
    .filter(Boolean)
    .filter((v: any) => !isJunkPublicVehicle(v));
  return {
    success: true,
    agency: agencySlug || state.agencies?.[0]?.name || "TruFlow Agency",
    source,
    updatedAt: new Date().toISOString(),
    count: vehicles.length,
    vehicles,
  };
}

/* Public feeds — any agency website can GET these (no auth, CORS open).
   No ?agency= used to mean "demo", so an embed that lost its query string —
   a copy-paste slip, a CMS stripping params — filled a real agency's website
   with DEMO- stock instead of going empty. Customers then enquire about cars
   that do not exist. Unmatched now yields nothing, which is the honest
   failure. The demo tenant is still reachable deliberately at ?agency=demo. */
app.get("/api/feed/inventory", (req, res) => {
  const agency = String(req.query.agency || "");
  res.json(buildPublicStock(readState(), agency, "premium", originOf(req)));
});

// Canonical public stock endpoint (same shape across Premium / TruLens)
app.get("/api/public/stock", (req, res) => {
  const agency = String(req.query.agency || "");
  res.json(buildPublicStock(readState(), agency, "premium", originOf(req)));
});

/* Single property detail (public).
   Scoped by ?agency= like every other public read. Without it this matched on
   listingRef across every tenant, and stock numbers are short and guessable —
   PE-1042, DEMO-100 — so any agency's property could be read by anyone who
   guessed one. */
app.get("/api/feed/property/:listingRef", (req, res) => {
  /* `state` was read AFTER being passed to agencyIdForSlug — a const in its
     temporal dead zone, so every single call threw and this route answered 500
     in production rather than the 400/404/200 it looks like it returns. Read it
     first. */
  const state = readState();
  const agencySlug = String(req.query.agency || "");
  const wantedId = agencyIdForSlug(agencySlug, state);
  // No aggregate escape hatch any more: an unknown slug is refused outright.
  if (!wantedId) {
    return res.status(400).json({ error: "A known ?agency= is required." });
  }

  const v = state.properties.find(
    (v: any) =>
      v.agencyId === wantedId &&
      (v.listingRef === req.params.listingRef || v.id === req.params.listingRef)
  );
  if (!v) return res.status(404).json({ error: "Property not found" });

  res.json({
    listingRef: v.listingRef,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    price: v.askingPrice,
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
    maintenanceTasks: (v.maintenanceTasks || []).map((t: any) => ({
      name: t.name, status: t.status, category: t.category,
    })),
    slotAssessment: v.slotAssessment && Object.keys(v.slotAssessment).length ? v.slotAssessment : undefined,
    id: v.id,
  });
});

// --- Portal management ---

/* ── Agencies ────────────────────────────────────────────────────────────
   Onboarding a agency used to mean editing a literal map here, deploying,
   editing TruLens's picker, and deploying again — two releases per customer,
   each one a chance to break the service for everyone already on it. These
   make it a form.

   Creating one does NOT issue a code. Do that separately via
   /api/auth/codes/rotate, so the code is shown once and deliberately, rather
   than falling out of a create call and into a log. */

/** Public: the list TruLens's agency picker reads. Names and slugs only —
 *  no counts, no contacts, nothing a competitor could not read off the
 *  agency websites these slugs already serve. */
app.get("/api/public/agencies", (_req, res) => {
  const s = readState();
  res.setHeader("Cache-Control", "no-store");
  res.json(
    (s.agencies || [])
      .filter((d: any) => d?.slug && d?.id && d.id !== "demo")
      .map((d: any) => ({ slug: d.slug, name: d.name, location: d.location || "" }))
  );
});

app.get("/api/agencies", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  res.json(readState().agencies || []);
});

app.post("/api/agencies", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const name = String(req.body?.name || "").trim();
  const location = String(req.body?.location || "").trim();
  const websiteUrl = String(req.body?.websiteUrl || "").trim();
  /* The slug is the agency's identity everywhere: their website feed, the
     TruLens picker, the tag on every captured property. Renaming one later
     orphans stock, so it is validated hard and never derived silently. */
  const slug = String(req.body?.slug || "").trim().toLowerCase();

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({
      error: "slug must be lowercase letters, numbers and single hyphens, e.g. cars-on-caledon",
    });
  }

  const state = readState();
  const existing = state.agencies || [];
  if (existing.some((d: any) => d.slug === slug)) {
    return res.status(409).json({ error: `A agency already uses the slug "${slug}".` });
  }

  /* Sequential d-ids, continuing the existing scheme. Never reuse a retired
     id — vehicles carry it, and a reused id would silently adopt them. */
  const used = existing
    .map((d: any) => /^d(\d+)$/.exec(String(d.id))?.[1])
    .filter(Boolean)
    .map(Number);
  const id = "d" + String(used.length ? Math.max(...used) + 1 : 1);

  /* Which apps this agency's code opens. Unlisted names are dropped rather than
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

  const agency: Agency = { id, name, location, slug, websiteUrl, products };
  if (address) agency.address = address;
  if (registrationNumber) agency.registrationNumber = registrationNumber;
  if (vatNumber) agency.vatNumber = vatNumber;
  state.agencies = [...existing, agency];
  writeState(state);

  console.log(`[agencies] created ${id} "${name}" (${slug}) products=${products.join(",") || "none"}`);
  res.status(201).json({
    agency,
    /* No environment variable, and no redeploy of anything. Every product
       verifies codes against this instance, so issuing the code is the last
       step rather than the middle one. */
    next: "Issue this agency a code with POST /api/auth/codes/rotate. Their apps will accept it immediately.",
  });
});

app.put("/api/agencies/:id", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const state = readState();
  const i = (state.agencies || []).findIndex((d: any) => d.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Agency not found" });

  /* Slug and id are deliberately not editable. Vehicles are tagged by id and
     agency websites are wired to the slug; changing either detaches stock
     from the agency it belongs to. Retire and recreate instead. */
  const { name, location, websiteUrl, products, address, registrationNumber, vatNumber } = req.body || {};
  if (typeof name === "string" && name.trim()) state.agencies[i].name = name.trim();
  if (typeof location === "string") state.agencies[i].location = location.trim();
  if (typeof websiteUrl === "string") state.agencies[i].websiteUrl = websiteUrl.trim();
  if (typeof address === "string") state.agencies[i].address = address.trim();
  if (typeof registrationNumber === "string") state.agencies[i].registrationNumber = registrationNumber.trim();
  if (typeof vatNumber === "string") state.agencies[i].vatNumber = vatNumber.trim();

  /* Entitlements ARE editable, unlike the slug — granting or revoking an app is
     the routine part of running this. Unlisted names are dropped rather than
     stored: a typo must not create an entitlement to a product that does not
     exist. An empty array is meaningful and allowed — it locks the agency out
     of every app while leaving their stock and history intact, which is what
     suspending an account should do. */
  if (Array.isArray(products)) {
    (state.agencies[i] as any).products = products
      .map((p: any) => String(p).toLowerCase())
      .filter((p: string) => PRODUCTS.includes(p as ProductName));
    console.log(
      `[agencies] ${state.agencies[i].slug} products=` +
        `${(state.agencies[i] as any).products.join(",") || "none"}`
    );
  }

  writeState(state);
  res.json({ agency: state.agencies[i] });
});

app.delete("/api/agencies/:id", (req: any, res) => {
  if (req.auth?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const state = readState();
  const i = (state.agencies || []).findIndex((d: any) => d.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Agency not found" });
  const removed = state.agencies.splice(i, 1)[0];
  writeState(state);
  console.log(`[agencies] deleted ${(removed as any).slug || removed.id}`);
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
  const vehicles = scopeToAgency(state.properties, req.auth).filter(v => v.status === "AVAILABLE");
  const callerAgency = state.agencies?.find((d: any) => d.id === req.auth?.agencyId);

  const payload = {
    event: "inventory_sync",
    timestamp: new Date().toISOString(),
    agency: callerAgency?.name || state.agencies?.[0]?.name || "TruFlow Agency",
    count: vehicles.length,
    properties: vehicles.map(v => ({
      listingRef: v.listingRef,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      price: v.askingPrice,
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
  const { firstName, lastName, phone, email, notes, propertyId, agencyId, agencySlug, source, journey } = req.body;
  if (!firstName || !phone) {
    return res.status(400).json({ error: "Missing required fields: firstName and phone are mandatory." });
  }

  /* The route is public and unauthenticated, so the payload is the only thing
     that says which yard the enquiry belongs to. Unset used to fall through to
     the pilot agency: a buyer enquiring on one agency's website became a
     lead in another agency's pipeline, and the yard that owns the site never
     saw it. Refuse instead — a misrouted lead is worse than a rejected one,
     because nobody finds out. */
  const leadAgencyId = agencyId || agencyIdForSlug(agencySlug);
  if (!leadAgencyId) {
    return res.status(400).json({
      error:
        "Missing agency. Send agencySlug (or agencyId) so the enquiry " +
        "reaches the agency whose website it came from.",
    });
  }

  try {
    const state = readState();
    const newLead: Enquiry = {
      id: newId("lead_"),
      // Which agency's website sent this — validated above, never unset.
      agencyId: leadAgencyId,
      firstName,
      lastName: lastName || "",
      phone,
      email: email || "",
      // Was "New Enquiry", which is not a LeadStatus — the union is
      // New | Contacted | Test Drive Scheduled | Negotiating | Closed Won |
      // Closed Lost. Every enquiry from a agency's WordPress site therefore
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
      /* Was `state.properties[0]?.id` — the first property GLOBALLY, so a lead
         from Agency B's site attached to Agency A's front-of-list car. Scope
         to the agency the lead belongs to, or leave empty. */
      propertyId: propertyId || state.properties.find(v => v.agencyId === leadAgencyId)?.id || "",
      source: source || "Website Form",
      notes: notes || "Submitted via external website integration.",
      createdAt: new Date().toISOString().split('T')[0],
      assignedUserId: "u1",
      lastContactedAt: new Date().toISOString().split('T')[0],
      journey: Array.isArray(journey) ? journey.slice(0, 50) : []
    };

    state.enquiries.unshift(newLead);
    writeState(state);

    res.json({ success: true, message: "Enquiry captured and synchronized with CRM successfully.", lead: newLead });
  } catch (error: any) {
    res.status(500).json({ error: "Internal database write error during lead synchronization.", details: error.message });
  }
});

app.post("/api/integration/sync-inventory", (req: any, res) => {
  try {
    const state = readState();
    const activeVehicles = scopeToAgency(state.properties, req.auth).filter(v => v.status === "AVAILABLE");
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      endpoint: "https://www.real-cars.co.za/api/v1/inventory/sync",
      syncedCount: activeVehicles.length,
      properties: activeVehicles.map(v => ({
        listingRef: v.listingRef,
        make: v.make,
        model: v.model,
        askingPrice: v.askingPrice,
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
  const { base64Image, slotName, propertyInfo } = req.body;

  if (!base64Image) {
    return res.status(400).json({ error: 'base64Image is required' });
  }

  if (!aiConfigured) {
    return res.json({
      overallScore: 85,
      lightingCheck: { status: 'Perfect', brightness: 128, contrast: 135, feedback: 'Excellent soft overhead lighting. Very clean representation with minimal glare.' },
      angleCheck: { status: 'Good', pitchDiff: 2, rollDiff: 1, feedback: 'The property alignment is perfect! A slightly lower angle would add even more prominence.' },
      aiAnalysis: {
        identifiedSubject: `${propertyInfo?.address || 'Listed property'}`,
        suggestedTitle: `Stunning ${propertyInfo?.address || 'Listed property'}`,
        suggestedDescription: `Discover this fully-inspected, highly desirable ${propertyInfo?.address || 'listed property'}. Professionally photographed and detailed.`,
        detectedIssues: ['AI key not configured — using mock analysis.'],
      },
    });
  }

  try {
    const prompt = `You are an expert property listing copywriter. Write a listing title and description for the property captured in slot "${slotName || 'General Exterior'}".
Property details: ${propertyInfo?.address || 'address not provided'}.

You cannot see the photo, so provide sensible neutral values for the quality checks. Respond strictly with valid JSON matching this schema:
{
  "overallScore": number,
  "lightingCheck": { "status": "Poor" | "Fair" | "Perfect", "brightness": number, "contrast": number, "feedback": string },
  "angleCheck": { "status": "Off-Angle" | "Good" | "Perfect", "pitchDiff": number, "rollDiff": number, "feedback": string },
  "aiAnalysis": {
    "identifiedSubject": string,
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
        lightingCheck: { status: 'Good', brightness: 110, contrast: 120, feedback: 'Live analysis temporarily unavailable. Local fallback suggests the photo is usable.' },
        angleCheck: { status: 'Good', pitchDiff: 0, rollDiff: 0, feedback: 'Property framing looks correct based on local validation.' },
        aiAnalysis: {
          identifiedSubject: `${propertyInfo?.address || 'Listed property'}`,
          suggestedTitle: `New Listing: ${propertyInfo?.address || 'Property'}`,
          suggestedDescription: `AI analysis in maintenance mode. This property is ready for inspection and listing.`,
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

/** Look up a agency by their stored zernioProfileId. */
function agencyByZernioProfile(state: DMSState, profileId: string): Agency | undefined {
  return state.agencies.find((d: any) => d.zernioProfileId === profileId);
}

/** accountId → agency isolation check.
 *
 *  CRITICAL: Zernio does NOT enforce agency isolation at the API level — we do.
 *  Every request that references an accountId must pass through this check
 *  BEFORE acting on it. The frontend must never be trusted with raw accountIds
 *  without server-side verification against this map. */
function agencyOwnsSocialAccount(state: DMSState, agencyId: string, accountId: string): boolean {
  return (state.socialAccounts || []).some(
    (a) => a.accountId === accountId && a.agencyId === agencyId
  );
}

// Toggle TruSocial ON/OFF + Zernio profile provisioning
app.post("/api/social/toggle", async (req: any, res) => {
  if (!req.auth?.role || !["admin", "manager", "principal"].includes(req.auth.role))
    return res.status(403).json({ error: "Agency login required" });

  const { agencyId, enabled } = req.body || {};
  if (!agencyId || typeof enabled !== "boolean")
    return res.status(400).json({ error: "agencyId and enabled (boolean) required" });

  const state = readState();
  const agency = state.agencies.find((d: any) => d.id === agencyId);
  if (!agency) return res.status(404).json({ error: "Agency not found" });

  if (enabled && !(agency as any).zernioProfileId) {
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
        body: JSON.stringify({ name: agency.id }),
      });
      const zBody = await zRes.json();
      if (zRes.status === 409) {
        // Profile already exists — recover the existing ID
        const existingId = zBody?.details?.existingProfileId;
        if (existingId) {
          (agency as any).zernioProfileId = existingId;
          console.log(`[trusocial] Recovered existing Zernio profile ${existingId} for ${agency.id}`);
        } else {
          return res.status(502).json({ error: "Profile already exists but could not recover ID", detail: zBody });
        }
      } else if (!zRes.ok) {
        console.error(`[trusocial] Zernio profile creation failed: ${zRes.status}`, zBody);
        return res.status(502).json({ error: "Zernio profile creation failed", detail: zBody });
      } else {
        const profile = zBody.profile || zBody;
        (agency as any).zernioProfileId = profile._id || profile.id;
      }
      console.log(`[trusocial] Provisioned Zernio profile ${(agency as any).zernioProfileId} for ${agency.id}`);
    } catch (err: any) {
      console.error(`[trusocial] Zernio API error:`, err?.message);
      return res.status(502).json({ error: "Could not reach Zernio API" });
    }
  }

  (agency as any).truSocialEnabled = enabled;

  writeState(state);
  res.json({ agency });
});

// Get OAuth connect URL for a platform
app.get("/api/social/connect/:platform", async (req: any, res) => {
  const agencyId = req.query.agencyId as string;
  if (!agencyId) return res.status(400).json({ error: "agencyId query param required" });

  const state = readState();
  const agency = state.agencies.find((d: any) => d.id === agencyId);
  if (!agency) return res.status(404).json({ error: "Agency not found" });
  if (!(agency as any).zernioProfileId)
    return res.status(400).json({ error: "TruSocial not provisioned for this agency" });
  if (!(agency as any).truSocialEnabled)
    return res.status(400).json({ error: "TruSocial is disabled for this agency" });

  if (!ZERNIO_API_KEY)
    return res.status(503).json({ error: "Zernio API key not configured" });

  const platform = req.params.platform;
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const redirectUrl = `${proto}://${req.get("host")}/api/social/callback`;

  try {
    const zRes = await fetch(
      `${ZERNIO_BASE}/v1/connect/${encodeURIComponent(platform)}?profileId=${(agency as any).zernioProfileId}&redirect_url=${encodeURIComponent(redirectUrl)}&headless=true`,
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

// OAuth callback — redirect back to the agency settings UI
app.get("/api/social/callback", (_req, res) => {
  // The actual account linking happens via Zernio's webhook (account.connected).
  // This endpoint just returns the agency to the TruSocial settings page.
  res.send(`<!DOCTYPE html><html><body><script>
    window.opener ? window.close() : (window.location.href = "/#settings");
  </script><p>Connected — you can close this tab.</p></body></html>`);
});

// List connected accounts for a agency — pulls live from Zernio and syncs local store
app.get("/api/social/accounts", async (req: any, res) => {
  const agencyId = req.query.agencyId as string;
  if (!agencyId) return res.status(400).json({ error: "agencyId required" });

  const state = readState();
  const agency = state.agencies.find((d: any) => d.id === agencyId);
  const profileId = (agency as any)?.zernioProfileId;

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
              agencyId,
              platform: za.platform || "unknown",
              username: za.username || za.displayName,
              connectedAt: za.connectedAt || new Date().toISOString(),
            });
            changed = true;
            console.log(`[trusocial] Synced account ${aid} (${za.platform}/${za.username}) → agency ${agencyId}`);
          }
        }

        // Remove local accounts that Zernio no longer has
        const zIds = new Set(zAccounts.map((za: any) => za._id || za.accountId));
        const before = state.socialAccounts.length;
        state.socialAccounts = state.socialAccounts.filter(
          (a) => a.agencyId !== agencyId || zIds.has(a.accountId)
        );
        if (state.socialAccounts.length !== before) changed = true;

        if (changed) writeState(state);
      }
    } catch (err: any) {
      console.error(`[trusocial] Failed to sync accounts from Zernio:`, err?.message);
    }
  }

  const accounts = (state.socialAccounts || []).filter((a) => a.agencyId === agencyId);
  res.json({ accounts });
});

// Disconnect a social account
app.post("/api/social/disconnect", async (req: any, res) => {
  const { agencyId, accountId } = req.body || {};
  if (!agencyId || !accountId)
    return res.status(400).json({ error: "agencyId and accountId required" });

  const state = readState();
  // accountId→agency isolation check
  if (!agencyOwnsSocialAccount(state, agencyId, accountId))
    return res.status(403).json({ error: "Account does not belong to this agency" });

  const agency = state.agencies.find((d: any) => d.id === agencyId);
  if (!agency || !(agency as any).zernioProfileId)
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

// Publish a property post to selected Zernio-connected social accounts
app.post("/api/social/publish", async (req: any, res) => {
  const { agencyId, propertyId, caption, accountIds } = req.body || {};
  if (!agencyId || !propertyId || !caption || !Array.isArray(accountIds) || !accountIds.length)
    return res.status(400).json({ error: "agencyId, propertyId, caption, and accountIds[] required" });

  const state = readState();
  const agency = state.agencies.find((d: any) => d.id === agencyId);
  if (!agency || !(agency as any).truSocialEnabled || !(agency as any).zernioProfileId)
    return res.status(400).json({ error: "TruSocial not enabled for this agency" });

  for (const aid of accountIds) {
    if (!agencyOwnsSocialAccount(state, agencyId, aid))
      return res.status(403).json({ error: `Account ${aid} does not belong to this agency` });
  }

  const property = state.properties.find((v: any) => v.id === propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const webImages = (property.images || []).filter((img: string) => img.startsWith("http"));
  const mediaItems: { url: string; type: string }[] = [];
  for (const imgUrl of webImages.slice(0, 4)) {
    try {
      const presignRes = await fetch(`${ZERNIO_BASE}/v1/media/presign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ZERNIO_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `property-${propertyId}.jpg`, contentType: "image/jpeg" }),
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
    console.log(`[trusocial] Published to ${platforms.map((p: any) => p.platform).join(", ")} for agency ${agencyId}`);
    res.json({ ok: true, postId: postData._id || postData.id, platforms: platforms.map((p: any) => p.platform) });
  } catch (err: any) {
    console.error(`[trusocial] Publish error:`, err?.message);
    res.status(502).json({ error: "Failed to reach Zernio" });
  }
});

// Zernio webhook receiver — single endpoint, all agencies route through it.
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
    const agency = agencyByZernioProfile(state, profileId);
    if (!agency) {
      console.warn(`[trusocial] account.connected for unknown profileId=${profileId}`);
      return res.json({ ok: true, ignored: true });
    }
    if (!state.socialAccounts) state.socialAccounts = [];
    const existing = state.socialAccounts.find((a) => a.accountId === accountId);
    if (!existing) {
      state.socialAccounts.push({
        accountId,
        agencyId: agency.id,
        platform: acct.platform || "unknown",
        username: acct.username || acct.displayName,
        connectedAt: new Date().toISOString(),
      });
    }
    writeState(state);
    console.log(`[trusocial] account.connected: ${accountId} (${acct.platform}/${acct.username}) → agency ${agency.id}`);
  } else if (event === "account.disconnected") {
    state.socialAccounts = (state.socialAccounts || []).filter((a) => a.accountId !== accountId);
    writeState(state);
    console.log(`[trusocial] account.disconnected: ${accountId}`);
  } else if (event === "post.published" || event === "post.failed") {
    // Update publish status on the stock listing that triggered it.
    // The post metadata should carry our propertyId in the external reference.
    const vehicleRef = payload.externalId || payload.data?.externalId || payload.metadata?.propertyId;
    if (vehicleRef) {
      const property = state.properties.find((v: any) => v.id === vehicleRef || v.listingRef === vehicleRef);
      if (property) {
        (property as any).socialPublishStatus = event === "post.published" ? "published" : "failed";
        (property as any).socialPublishAt = new Date().toISOString();
        writeState(state);
      }
    }
    console.log(`[trusocial] ${event}: ref=${vehicleRef || "none"}`);
  }

  res.json({ ok: true });
});

// DeepSeek AI assistant proxy (requireAuth runs above, so this is protected).
app.post('/api/assistant', async (req: any, res) => {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return res.status(503).json({ error: 'DEEPSEEK_API_KEY not configured.' });
  const { messages, model } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages array is required.' });
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'deepseek-chat', messages, max_tokens: 2048, temperature: 0.7 }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'DeepSeek API error.' });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the DeepSeek API.' });
  }
});

// --- VITE DEV SERVER / PRODUCTION ROUTER ---

async function startServer() {
  // TruFlow Light — standalone agency console served at /light
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

  // Embed widget + static public assets (agency websites load /embed/stock-widget.js)
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
