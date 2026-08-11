import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { readState } from "../services/stateStore";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — per-agency access codes, verified server-side.
//
// Replaces the old client-side `password === "2026"` check, which was cosmetic:
// the code shipped in the browser bundle and every /api route was open anyway.
// Codes are stored salted+hashed; the plaintext is shown once at creation and
// never recoverable. Tokens are HMAC-signed, so they survive a restart without
// a session store.
// ─────────────────────────────────────────────────────────────────────────────

/** Who a code belongs to.
 *  admin      — TruSaaS, every agency
 *  principal  — the agency who owns the account; manages their own staff
 *  manager    — full access to that agency, no seat management
 *  salesperson— same data, no seat management
 *  Seats are billable per active non-principal user. */
export type AuthRole = "admin" | "principal" | "manager" | "salesperson";

export type AuthAccount = {
  id: string;
  label: string;
  /** Which agency this code sees. Omitted for the master admin. */
  agencyId?: string;
  /** Links to a row in state.users for staff seats. Absent on the
   *  principal's own login and on the master admin. */
  userId?: string;
  role: AuthRole;
  salt: string;
  hash: string;
  createdAt: string;
  rotatedAt?: string;
};

export const MANAGES_USERS: AuthRole[] = ["admin", "principal"];
/** Roles a agency principal may hand out. Deliberately excludes admin — a
 *  agency must never be able to mint a login that sees other agencies. */
export const ASSIGNABLE_ROLES: AuthRole[] = ["manager", "salesperson"];
export type AuthStore = { secret: string; accounts: AuthAccount[] };

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // one working day
// "Keep me signed in" — a yard tablet or Lance's laptop shouldn't ask for the
// code every morning. Still bounded, so a lost device stops working eventually.
const TOKEN_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashCode(code: string, salt: string): string {
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
 *    DEALER_CODE_D1 / _D2    — per agency, id uppercased
 *  Unset means a random code is generated and printed instead. Changing the
 *  variable later does nothing; rotate the code through the API. */
function codeFromEnv(role: AuthRole, agencyId?: string): string {
  const raw =
    role === "admin"
      ? process.env.ADMIN_ACCESS_CODE
      : agencyId && process.env[`DEALER_CODE_${agencyId.toUpperCase()}`];
  const code = String(raw || "").trim();
  // Too short to be worth having — fall back to a generated one rather than
  // quietly accepting something guessable.
  return code.length >= 6 ? code : "";
}

export function makeAccount(label: string, role: AuthRole, agencyId?: string, preset?: string, userId?: string) {
  const code = preset || generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  const account: AuthAccount = {
    id: "acc_" + crypto.randomBytes(6).toString("hex"),
    label,
    agencyId,
    userId,
    role,
    salt,
    hash: hashCode(code, salt),
    createdAt: new Date().toISOString(),
  };
  return { account, code };
}

// Writable state lives under DATA_DIR so it can sit on a mounted Render disk
// and survive deploys/restarts. Unset (local dev) = cwd, i.e. the old paths.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

const AUTH_FILE = path.join(DATA_DIR, "auth.json");

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

export function writeAuth(store: AuthStore) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** First boot on a fresh disk: mint a secret and one code per agency.
 *  Codes are printed to the service log exactly once — grab them from Render's
 *  log viewer. They cannot be read back afterwards, only rotated. */
export function ensureAuthStore(): AuthStore {
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
  for (const d of readState().agencies || []) {
    if (store.accounts.some((a) => a.agencyId === d.id)) continue;
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

export function signToken(account: AuthAccount, remember = false): string {
  const store = ensureAuthStore();
  const payload = Buffer.from(
    JSON.stringify({
      sub: account.id,
      agencyId: account.agencyId,
      userId: account.userId,
      role: account.role,
      label: account.label,
      exp: Date.now() + (remember ? TOKEN_TTL_REMEMBER_MS : TOKEN_TTL_MS),
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", store.secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): any | null {
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
 *  The public feeds are what every agency website reads — locking those would
 *  take the showrooms offline. They expose published stock only, never enquiries. */
export function isPublicPath(p: string): boolean {
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
    p === "/api/social/callback"
  );
}

// TruLens pushes captures server-to-server and has no user session. Until a
// shared key is configured on both services this stays open, so an unset key
// can't silently break a agency's photo export mid-capture.
export const SYNC_SERVICE_KEY = process.env.TRUFLOW_SYNC_KEY || "";
export const TRULENS_URL = (process.env.TRULENS_URL || "https://lens.tru-saas.com").replace(/\/$/, "");

export function requireAuth(req: any, res: any, next: any) {
  if (!req.path.startsWith("/api/") || isPublicPath(req.path)) return next();

  if (req.path === "/api/sync/push-photos") {
    if (!SYNC_SERVICE_KEY) return next();
    if (req.headers["x-tru-sync-key"] === SYNC_SERVICE_KEY) return next();
  }

  /* Product-to-product identity. The caller is TruLens or TruInspect asking
     whether a agency code is real and what it opens, so it carries the shared
     key rather than a session — there is no user logged in to this instance at
     that moment, which is the entire point of the call.
     Unlike push-photos there is no unset-key fallthrough: an unconfigured key
     must not turn code verification into an open endpoint anyone can test
     agency codes against. The handler refuses with 503 instead. */
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

/**
 * Master-admin recovery.
 *
 * The admin code is printed once at first boot and cannot be read back, only
 * rotated — and rotating is itself admin-only. The auth store lives on a
 * mounted disk, so redeploying does not re-seed it and ADMIN_ACCESS_CODE (which
 * only applies to an empty store) has no effect either. Lose the code and there
 * is no way back into the instance at all: no agency admin, no code
 * reissue for a agency who has lost theirs.
 *
 * So ADMIN_ACCESS_CODE now also repoints the existing master admin at boot.
 * The gate is Render dashboard access, which already implies full control of
 * the service — anyone who can set an env var here can deploy arbitrary code.
 * Agency principals are deliberately untouched; this only restores the way in.
 */
export function applyAdminRecovery(store: AuthStore): void {
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
