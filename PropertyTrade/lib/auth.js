import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { newId } from './id.js';

const TOKEN_TTL = 12 * 60 * 60 * 1000;
const REMEMBER_TTL = 30 * 24 * 60 * 60 * 1000;

/** Property products a master admin can assign to an agency (mirrors dealer PRODUCTS). */
export const PRODUCTS = ['flowpms', 'prop-lens', 'prop-inspect', 'prop-website', 'trusocial'];

/**
 * Requests that need no login. Everything else is behind requireAuth.
 * Public paths are read-only or insert-only — they never leak rows.
 */
const PUBLIC_PATHS = [
  /^\/api\/health$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/verify-code$/,
  /^\/api\/prop\/public\//,
  /^\/api\/prop\/webhook\//,
  /^\/api\/prop\/widget\//,
  /^\/api\/social\/callback$/,
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugOk(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}

/** Backfill the agencies registry from the legacy single-agency shape. */
function ensureAgencyRegistry(store) {
  let changed = false;
  if (!Array.isArray(store.agencies) || store.agencies.length === 0) {
    if (store.agency && store.agency.id) {
      store.agencies = [{ ...store.agency, products: store.agency.products || [] }];
      changed = true;
    } else {
      store.agencies = [];
    }
  }
  // Role v2: the seeded/agency admin becomes the agency's principal; a NEW
  // 'admin' (no agencyId) is the TruSaaS master above all agencies.
  if (!store.roleV2) {
    for (const a of store.agents || []) {
      if (a.agencyId && a.role === 'admin') a.role = 'principal';
    }
    store.roleV2 = true;
    changed = true;
  }
  return changed;
}

export function ensureAuthStore(dataDir) {
  ensureDir(dataDir);
  const file = path.join(dataDir, 'auth.json');

  let store = { secret: '', agents: [], agencies: [] };
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (raw?.secret && Array.isArray(raw.agents)) store = raw;
    }
  } catch { /* corrupt file — re-seed */ }

  let changed = false;

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
      role: 'principal',
      salt,
      hash: crypto.scryptSync(code, salt, 32).toString('hex'),
      assignedPropertyIds: [],
      active: true,
      createdAt: new Date().toISOString(),
    }];

    console.log(`\n${'='.repeat(56)}`);
    console.log(' FLOW PROP — ACCESS CODE (save this — shown once)');
    console.log('='.repeat(56));
    console.log(`  Principal:     ${code}`);
    console.log(`  Agency:        ${store.agency.name}`);
    console.log('='.repeat(56) + '\n');
    changed = true;
  }

  if (ensureAgencyRegistry(store)) changed = true;

  // FLOWPMS_ACCESS_CODE wins over any seeded random: forces the principal's
  // code on every boot so Render can set it and re-login.
  const envCode = String(process.env.FLOWPMS_ACCESS_CODE || '').trim();
  if (envCode) {
    const master =
      store.agents.find(a => a.label === 'Master admin') ||
      (store.agencies[0]?.id
        ? store.agents.find(a => a.role === 'principal' && a.agencyId === store.agencies[0].id)
        : null) ||
      store.agents[0];
    if (master) {
      master.salt = crypto.randomBytes(16).toString('hex');
      master.hash = crypto.scryptSync(envCode, master.salt, 32).toString('hex');
      master.active = true;
      changed = true;
      console.log(`\n-- FLOWPMS_ACCESS_CODE set: principal code = ${envCode}`);
    }
  }

  // FLOWPMS_MASTER_CODE: the TruSaaS master login (role admin, no agencyId).
  const envMaster = String(process.env.FLOWPMS_MASTER_CODE || '').trim();
  if (envMaster) {
    let master = store.agents.find(a => a.role === 'admin' && !a.agencyId);
    if (!master) {
      master = {
        id: newId('agent'),
        agencyId: null,
        label: 'TruSaaS master',
        role: 'admin',
        salt: crypto.randomBytes(16).toString('hex'),
        hash: '',
        assignedPropertyIds: [],
        active: true,
        createdAt: new Date().toISOString(),
      };
      store.agents.push(master);
    }
    master.salt = crypto.randomBytes(16).toString('hex');
    master.hash = crypto.scryptSync(envMaster, master.salt, 32).toString('hex');
    master.active = true;
    changed = true;
    console.log(`\n-- FLOWPMS_MASTER_CODE set: master login = ${envMaster}`);
  }

  if (changed) writeAuth(file, store);
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

/* ------------------------------ agency lookups ---------------------------- */

export function listAgencies(dataDir) {
  return ensureAuthStore(dataDir).agencies || [];
}

export function agencyById(dataDir, id) {
  return (ensureAuthStore(dataDir).agencies || []).find(a => a.id === id);
}

export function agencyForSlug(dataDir, slug) {
  if (!slug) return undefined;
  return (ensureAuthStore(dataDir).agencies || []).find(a => a.slug === slug);
}

/** Create an agency (master only). Returns { agency, code } — code shows once. */
export function createAgency(dataDir, { name, slug, products = [], websiteUrl = '' }) {
  const store = ensureAuthStore(dataDir);
  const cleanName = String(name || '').trim().slice(0, 100);
  if (!cleanName) return { error: 'Name is required.' };
  if (!slugOk(slug)) {
    return { error: 'Slug must be lowercase letters, numbers and dashes (e.g. stone-heights).' };
  }
  if (agencyForSlug(dataDir, slug) || store.agency?.slug === slug) {
    return { error: 'Slug already taken.' };
  }
  const cleanProducts = Array.isArray(products)
    ? products.filter(p => PRODUCTS.includes(p))
    : [];

  const agency = {
    id: newId('agency'),
    name: cleanName,
    slug,
    products: cleanProducts,
    websiteUrl: String(websiteUrl || '').trim().slice(0, 300),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.agencies.push(agency);

  const code = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
  const salt = crypto.randomBytes(16).toString('hex');
  store.agents.push({
    id: newId('agent'),
    agencyId: agency.id,
    label: `${cleanName} principal`,
    role: 'principal',
    salt,
    hash: crypto.scryptSync(code, salt, 32).toString('hex'),
    assignedPropertyIds: [],
    active: true,
    createdAt: new Date().toISOString(),
  });

  saveStore(dataDir, store);
  return { agency, code };
}

/** Rotate an agency's principal code (master only). Returns { code }. */
export function rotateAgencyCode(dataDir, agencyId) {
  const store = ensureAuthStore(dataDir);
  const agency = store.agencies.find(a => a.id === agencyId);
  if (!agency) return null;
  const principal = store.agents.find(a => a.agencyId === agencyId && a.role === 'principal')
    || store.agents.find(a => a.agencyId === agencyId);
  if (!principal) return null;
  const code = crypto.randomBytes(6).toString('hex').slice(0, 8).toUpperCase();
  principal.salt = crypto.randomBytes(16).toString('hex');
  principal.hash = crypto.scryptSync(code, principal.salt, 32).toString('hex');
  principal.active = true;
  principal.rotatedAt = new Date().toISOString();
  saveStore(dataDir, store);
  return { code };
}

/* --------------------------------- tokens --------------------------------- */

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
    agencyId: agent.agencyId ?? null,
    role: agent.role,
    label: agent.label,
    assignedPropertyIds: agent.assignedPropertyIds || [],
    exp: Date.now() + (remember ? REMEMBER_TTL : TOKEN_TTL),
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', store.secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function findAgentByCode(store, trimmed) {
  return (store.agents || []).find(a => {
    if (a.active === false) return false;
    if (!a.salt || !a.hash) return false;
    try {
      const computed = crypto.scryptSync(trimmed, a.salt, 32).toString('hex');
      return computed === a.hash;
    } catch {
      return false;
    }
  });
}

export function loginWithCode(code, dataDir) {
  const store = ensureAuthStore(dataDir);
  const trimmed = String(code).trim();
  const match = findAgentByCode(store, trimmed);
  if (!match) return null;

  let agencyName = '';
  if (match.agencyId) {
    const agency = store.agencies.find(a => a.id === match.agencyId) || store.agency;
    agencyName = agency?.name || '';
  }
  return {
    token: signToken(match, dataDir),
    account: {
      id: match.id,
      label: match.label,
      role: match.role,
      agencyId: match.agencyId ?? null,
      agencyName,
    },
  };
}

/** Satellite verification: does this code open `product` for its agency? */
export function verifyCodeWithProduct(code, product, dataDir) {
  const store = ensureAuthStore(dataDir);
  const match = findAgentByCode(store, String(code || '').trim());
  if (!match) return { refused: 'unknown' };
  if (!match.agencyId) return { refused: 'master' };
  const agency = store.agencies.find(a => a.id === match.agencyId)
    || store.agencies.find(a => a.id === store.agency?.id);
  if (!agency) return { refused: 'unknown' };
  const products = Array.isArray(agency.products) ? agency.products : [];
  if (!products.includes(product)) {
    return { refused: 'product', products };
  }
  return {
    ok: true,
    agent: { id: match.id, label: match.label, role: match.role },
    agency: { id: agency.id, slug: agency.slug, name: agency.name, websiteUrl: agency.websiteUrl || '' },
    products,
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
    if (PUBLIC_PATHS.some(re => re.test(req.path))) {
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