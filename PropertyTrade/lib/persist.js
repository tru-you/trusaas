import fs from 'fs';
import path from 'path';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function entityDir(dataDir, type) {
  return path.join(dataDir, type);
}

function entityFile(dataDir, type, id) {
  return path.join(entityDir(dataDir, type), `${id}.json`);
}

export function save(dataDir, type, id, data) {
  const dir = entityDir(dataDir, type);
  ensureDir(dir);
  const out = { ...data, _savedAt: Date.now() };
  delete out.sockets;
  const tmp = entityFile(dataDir, type, id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2), 'utf-8');
  fs.renameSync(tmp, entityFile(dataDir, type, id));
}

export function load(dataDir, type, id) {
  const f = entityFile(dataDir, type, id);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch {
    return null;
  }
}

export function remove(dataDir, type, id) {
  const f = entityFile(dataDir, type, id);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

export function loadAll(dataDir, type, filter) {
  const dir = entityDir(dataDir, type);
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (!filter || filter(data)) results.push(data);
    } catch { /* skip corrupt */ }
  }
  return results;
}

export function query(dataDir, type, agencyId, extraFilter) {
  return loadAll(dataDir, type, (d) => {
    if (d.agencyId !== agencyId) return false;
    return extraFilter ? extraFilter(d) : true;
  });
}

export function count(dataDir, type, agencyId, extraFilter) {
  return query(dataDir, type, agencyId, extraFilter).length;
}
