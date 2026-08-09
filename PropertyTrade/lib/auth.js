import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { newId } from './id.js';

const TOKEN_TTL = 12 * 60 * 60 * 1000;
const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function ensureAuthStore(dataDir) {
  ensureDir(dataDir);
  const file = path.join(dataDir, 'auth.json');

  let store = { secret: '', agents: [] };
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (raw?.secret && Array.isArray(raw.agents)) store = raw;
    }
  } catch { /* corrupt file — re-seed */ }

  if (!store.secret) {
    store.secret = crypto.randomBytes(32).toString('hex');

    const agencyId = newId('agency');
    const agentId = newId('agent');
    const code = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
    const salt = crypto.randomBytes(16).toString('hex');

    store.agency = {
      id: agencyId,
      name: 'Demo Agency',
      slug: 'demo-agency',
      createdAt: new Date().toISOString(),
    };

    store.agents = [{
      id: agentId,
      agencyId,
      label: 'Master admin',
      role: 'admin',
      salt,
      hash: crypto.scryptSync(code, salt, 32).toString('hex'),
      assignedPropertyIds: [],
      active: true,
      createdAt: new Date().toISOString(),
    }];

    console.log(`\n${'='.repeat(56)}`);
    console.log(' FLOW PROP — ACCESS CODE (save this — shown once)');
    console.log('='.repeat(56));
    console.log(`  Master admin:  ${code}`);
    console.log(`  Agency:        ${store.agency.name}`);
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

export function getAuthFile(dataDir) {
  return path.join(dataDir, 'auth.json');
}

export function readStore(dataDir) {
  return ensureAuthStore(dataDir);
}

export function saveStore(dataDir, store) {
  writeAuth(getAuthFile(dataDir), store);
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

export function signToken(agent, dataDir, remember = false) {
  const store = ensureAuthStore(dataDir);
  const payload = Buffer.from(JSON.stringify({
    sub: agent.id,
    agencyId: agent.agencyId,
    role: agent.role,
    label: agent.label,
    assignedPropertyIds: agent.assignedPropertyIds || [],
    exp: Date.now() + (remember ? REMEMBER_TTL : TOKEN_TTL),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', store.secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function loginWithCode(code, dataDir) {
  const store = ensureAuthStore(dataDir);
  const trimmed = String(code).trim();
  const match = store.agents.find(a =>
    a.active !== false &&
    crypto.scryptSync(trimmed, a.salt, 32).toString('hex') === a.hash
  );
  if (!match) return null;
  return {
    token: signToken(match, dataDir),
    account: {
      id: match.id,
      label: match.label,
      role: match.role,
      agencyId: match.agencyId,
      agencyName: store.agency?.name || '',
    },
  };
}

export function createAgentCode(dataDir, agentData) {
  const store = ensureAuthStore(dataDir);
  const code = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
  const salt = crypto.randomBytes(16).toString('hex');
  const agent = {
    id: newId('agent'),
    agencyId: agentData.agencyId,
    label: agentData.name,
    role: agentData.role || 'agent',
    salt,
    hash: crypto.scryptSync(code, salt, 32).toString('hex'),
    assignedPropertyIds: agentData.assignedPropertyIds || [],
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.agents.push(agent);
  saveStore(dataDir, store);
  return { agent, code };
}

export function requireAuth(dataDir) {
  return (req, res, next) => {
    const p = req.path;
    if (p === '/api/health' || p === '/api/auth/login') {
      return next();
    }

    const header = String(req.headers.authorization || '');
    const claims = header.startsWith('Bearer ')
      ? verifyToken(header.slice(7), dataDir)
      : null;
    if (!claims) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    req.auth = claims;
    next();
  };
}
