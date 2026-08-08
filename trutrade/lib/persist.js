import fs from 'fs';
import path from 'path';

const ROOM_TTL = 24 * 60 * 60 * 1000;

function roomFile(dataDir, id) {
  return path.join(dataDir, 'rooms', `${id}.json`);
}

export function saveRoom(dataDir, id, data) {
  const dir = path.join(dataDir, 'rooms');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const out = { ...data, _savedAt: Date.now() };
  const tmp = roomFile(dataDir, id) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(out), 'utf-8');
  fs.renameSync(tmp, roomFile(dataDir, id));
}

export function loadRoom(dataDir, id) {
  const f = roomFile(dataDir, id);
  if (!fs.existsSync(f)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
    if (Date.now() - data.created > ROOM_TTL) {
      deleteRoom(dataDir, id);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function deleteRoom(dataDir, id) {
  const f = roomFile(dataDir, id);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

export function loadAllRooms(dataDir) {
  const dir = path.join(dataDir, 'rooms');
  if (!fs.existsSync(dir)) return [];
  const now = Date.now();
  const rooms = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (now - data.created > ROOM_TTL) {
        fs.unlinkSync(path.join(dir, f));
        continue;
      }
      rooms.push(data);
    } catch { /* corrupt room file */ }
  }
  return rooms;
}

export function cleanupExpired(dataDir) {
  const dir = path.join(dataDir, 'rooms');
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (now - data.created > ROOM_TTL) fs.unlinkSync(path.join(dir, f));
    } catch {
      fs.unlinkSync(path.join(dir, f));
    }
  }
}

export function listDealerRooms(dataDir, dealerId) {
  const all = loadAllRooms(dataDir);
  return all.filter(r => r.dealerId === dealerId);
}
