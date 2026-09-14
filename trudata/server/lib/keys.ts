import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  key: string;
  email: string;
  name: string;
  tier: 'paygo' | 'pro' | 'enterprise';
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
}

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

let keysMemoryStore: Map<string, ApiKey> = new Map();

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[TruData:keys] Could not create DATA_DIR:', err);
  }
}

export function initApiKeys(): void {
  try {
    ensureDataDir();
    if (fs.existsSync(KEYS_FILE)) {
      const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
      const list: ApiKey[] = JSON.parse(raw);
      keysMemoryStore.clear();
      list.forEach((k) => keysMemoryStore.set(k.key, k));
      console.log(`[TruData:keys] Initialized ${keysMemoryStore.size} API keys.`);
    }
  } catch (err) {
    console.warn('[TruData:keys] Error reading keys file:', err);
  }
}

function persistKeys(): void {
  try {
    ensureDataDir();
    const list = Array.from(keysMemoryStore.values());
    fs.writeFileSync(KEYS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TruData:keys] Error saving keys file:', err);
  }
}

export function createApiKey(email: string, name: string = 'Default Key', tier: ApiKey['tier'] = 'paygo'): ApiKey {
  const normEmail = String(email || '').trim().toLowerCase();
  const id = 'key_' + crypto.randomBytes(8).toString('hex');
  const secret = crypto.randomBytes(24).toString('hex');
  const key = `td_live_${secret}`;

  const record: ApiKey = {
    id,
    key,
    email: normEmail,
    name: name || 'Default Key',
    tier,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  keysMemoryStore.set(key, record);
  persistKeys();
  return record;
}

export function verifyApiKey(key: string): ApiKey | null {
  if (!key) return null;
  const record = keysMemoryStore.get(key);
  if (!record || record.status !== 'active') return null;

  record.lastUsedAt = new Date().toISOString();
  persistKeys();
  return record;
}

export function getApiKeysByEmail(email: string): ApiKey[] {
  const normEmail = String(email || '').trim().toLowerCase();
  return Array.from(keysMemoryStore.values())
    .filter((k) => k.email === normEmail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function revokeApiKey(keyId: string, email: string): boolean {
  const normEmail = String(email || '').trim().toLowerCase();
  for (const [keyStr, record] of keysMemoryStore.entries()) {
    if (record.id === keyId && record.email === normEmail) {
      record.status = 'revoked';
      persistKeys();
      return true;
    }
  }
  return false;
}
