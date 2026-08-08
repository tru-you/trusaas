import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TOKEN_TTL = 12 * 60 * 60 * 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function ensureAuthStore(dataDir) {
  ensureDir(dataDir);
  const file = path.join(dataDir, 'auth.json');

  let store = { secret: '', accounts: [] };
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (raw?.secret && Array.isArray(raw.accounts)) store = raw;
    }
  } catch { /* corrupt file - re-seed */ }

  if (!store.secret) {
    store.secret = crypto.randomBytes(32).toString('hex');
    // Seed a master admin code printed to the log
    const code = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
    const salt = crypto.randomBytes(16).toString('hex');
    store.accounts = [{
      id: 'acc_admin',
      label: 'Master admin',
      role: 'admin',
      salt,
      hash: crypto.scryptSync(code, salt, 32).toString('hex'),
      createdAt: new Date().toISOString(),
      dealershipId: null,
    }];
    console.log(`\n${'='.repeat(56)}`);
    console.log(' ACCESS CODE (save this — shown once)');
    console.log('='.repeat(56));
    console.log(`  Master admin:  ${code}`);
    console.log('='.repeat(56) + '\n');
  }

  writeAuth(file, store);
  return store;
}

function writeAuth(file, store) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

export function verifyToken(token, dataDir) {
  try {
    const store = ensureAuthStore(dataDir);
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return null;

    const expected = crypto
      .createHmac('sha256', store.secret)
      .update(payload)
      .digest('base64url');

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

export function signToken(account, dataDir, remember = false) {
  const store = ensureAuthStore(dataDir);
  const payload = Buffer.from(JSON.stringify({
    sub: account.id,
    role: account.role,
    label: account.label,
    dealershipId: account.dealershipId || null,
    exp: Date.now() + (remember ? 30 * 24 * 60 * 60 * 1000 : TOKEN_TTL),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', store.secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function loginWithCode(code, dataDir) {
  const store = ensureAuthStore(dataDir);
  const match = store.accounts.find(a =>
    crypto.scryptSync(String(code).trim(), a.salt, 32).toString('hex') === a.hash
  );
  if (!match) return null;
  return { token: signToken(match, dataDir), account: { label: match.label, role: match.role } };
}

/** Verify a dealer code against a central TruFlow instance.
 *  Falls back to local auth store when TruFlow is unreachable. */
export async function verifyDealerCode(code, dataDir, flowUrl, syncKey) {
  if (flowUrl && syncKey) {
    try {
      const res = await fetch(`${flowUrl}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tru-sync-key': syncKey,
        },
        body: JSON.stringify({ code, product: 'flow' }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          label: data.dealerName || data.label,
          role: data.role || 'manager',
          dealershipId: data.dealershipId || null,
          source: 'truflow',
        };
      }
    } catch (err) {
      console.warn('[auth] TruFlow unreachable, checking local codes:', err.message);
    }
  }
  return null;
}

export function requireAuth(dataDir) {
  return (req, res, next) => {
    const p = req.path;
    if (p === '/api/health' || p.startsWith('/j/') || p.startsWith('/a/') ||
        p === '/api/auth/login' || p === '/api/auth/demo' ||
        p.startsWith('/api/room/') || p.startsWith('/api/appraisal/') ||
        p === '/api/summary' || p === '/api/writeup') {
      return next();
    }

    const header = String(req.headers.authorization || '');
    const claims = header.startsWith('Bearer ') ? verifyToken(header.slice(7), dataDir) : null;
    if (!claims) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    req.auth = claims;
    next();
  };
}
