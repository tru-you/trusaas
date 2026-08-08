// TruLive — live guided vehicle walkthrough: signalling + session server.
// Serves the app, mints single-use walkthrough links, relays WebRTC signalling
// and synced guided-walkthrough state between the dealer and the buyer.
import express from 'express';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAuthStore, verifyToken, loginWithCode, requireAuth } from '../packages/tru-shared/auth.js';
import { saveRoom, loadRoom, loadAllRooms, cleanupExpired, listDealerRooms } from '../packages/tru-shared/persist.js';
import { getIceServers, rateLimit } from '../packages/tru-shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 30 }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

const newId = () => randomBytes(6).toString('hex');

// In-memory rooms (live sockets). Persisted to disk for restart survival.
const rooms = new Map();

for (const r of loadAllRooms(DATA_DIR)) {
  r.sockets = {};
  r.buyerJoined = false;
  rooms.set(r.id, r);
}
console.log(`[trulive] Restored ${rooms.size} room(s) from disk.`);

// --- Auth middleware ---
app.use(requireAuth(DATA_DIR));

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, product: 'trulive',
    deepseek: !!DEEPSEEK_KEY,
    rooms: rooms.size, uptimeSec: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
});

// --- Login ---
app.post('/api/auth/login', (req, res) => {
  const result = loginWithCode(req.body?.code, DATA_DIR);
  if (!result) return res.status(401).json({ error: 'Invalid code.' });
  res.json(result);
});

// --- Dealer creates a session ---
app.post('/api/session', (req, res) => {
  const { veh = 'Vehicle', price = '', buyer = '' } = req.body || {};
  const id = newId();
  const room = {
    id, veh, price, buyer,
    dealerId: req.auth?.sub || null,
    dealerName: req.auth?.label || null,
    created: Date.now(), buyerJoined: false, sockets: {},
    checkState: null, sectionsCovered: 0, snaps: [], flags: [],
    status: 'live',
  };
  rooms.set(id, room);
  saveRoom(DATA_DIR, id, room);
  res.json({ id, url: `/j/${id}` });
});

// --- Dealer session history ---
app.get('/api/sessions', (req, res) => {
  const dealerId = req.auth?.sub;
  const list = dealerId
    ? listDealerRooms(DATA_DIR, dealerId)
    : loadAllRooms(DATA_DIR);
  res.json(list.map(r => ({
    id: r.id, veh: r.veh, price: r.price, buyer: r.buyer,
    created: r.created, status: r.status || 'unknown', _savedAt: r._savedAt,
  })));
});

// --- Buyer link ---
app.get('/j/:id', (req, res) => {
  const room = loadRoom(DATA_DIR, req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) {
    return res.status(410).sendFile(path.join(__dirname, 'public', 'expired.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Room info for buyer join card ---
app.get('/api/room/:id', (req, res) => {
  const room = loadRoom(DATA_DIR, req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) {
    return res.status(410).json({ error: 'expired' });
  }
  res.json({ veh: room.veh, price: room.price, buyer: room.buyer });
});

// --- AI walkthrough summary (DeepSeek) ---
app.post('/api/summary', async (req, res) => {
  const data = req.body || {};
  try {
    if (DEEPSEEK_KEY) {
      return res.json({ summary: await aiSummary(data), source: 'deepseek' });
    }
  } catch (e) {
    console.error('AI summary failed, using local:', e.message);
  }
  res.json({ summary: localSummary(data), source: 'local' });
});

async function aiSummary(d) {
  const prompt = `You are the inspection assistant for TruLive, a live guided vehicle walkthrough tool used by car dealers.
Write a concise, professional inspection summary for the buyer's record based on this completed live walkthrough.

Vehicle: ${d.veh || 'Unknown'}
Price: ${d.price || 'n/a'}
Duration: ${d.duration || 'n/a'}
Checks passed: ${d.checksDone}/${d.checksTotal}
Sections covered: ${(d.sections || []).join(', ')}
Buyer-flagged concerns: ${(d.flags || []).map(f => `${f.section}: ${f.note}`).join('; ') || 'none'}

Write exactly 2 short parts: (1) a one-line overall impression, then (2) a short paragraph on the condition covered, weaving in any flagged concerns as prose.
Do NOT output a "Points to follow up" list or any bulleted list — the report already renders the flagged concerns as its own separate section, so a list here would duplicate it.
Keep it factual and neutral. No markdown headers, plain text.`;

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      stream: false, max_tokens: 600,
    }),
  });
  if (!r.ok) throw new Error('deepseek ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || localSummary(d);
}

function localSummary(d) {
  const pct = d.checksTotal ? Math.round((d.checksDone / d.checksTotal) * 100) : 0;
  const impression = pct >= 90 ? 'Vehicle presented well across the full walkthrough.'
    : pct >= 60 ? 'Vehicle covered in a full walkthrough with a few items to review.'
    : 'Partial walkthrough completed — several areas still to confirm.';
  const flags = (d.flags || []);
  const concerns = flags.length
    ? ` The buyer raised ${flags.length} point${flags.length > 1 ? 's' : ''} for follow-up (${flags.map(f => f.section).join(', ')}).`
    : ' No concerns were raised during the walkthrough.';
  return `${impression}\n\n`
    + `A live guided walkthrough of the ${d.veh || 'vehicle'} was completed over ${d.duration || 'the session'}, `
    + `covering ${(d.sections || []).length} sections (${(d.sections || []).join(', ')}). `
    + `${d.checksDone}/${d.checksTotal} inspection checkpoints were confirmed on camera (${pct}%).`
    + concerns;
}

// --- Save completed walkthrough ---
app.post('/api/session/:id/complete', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });

  const { checkState, sections, snaps, flags, duration, checksDone, checksTotal } = req.body || {};
  room.checkState = checkState;
  room.sections = sections;
  room.snaps = snaps || [];
  room.flags = flags || [];
  room.duration = duration;
  room.checksDone = checksDone;
  room.checksTotal = checksTotal;
  room.status = 'completed';
  room.completedAt = Date.now();
  saveRoom(DATA_DIR, room.id, room);

  res.json({ ok: true, status: 'completed' });
});

// --- WebSocket signalling ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', (ws) => {
  ws.meta = { roomId: null, role: null };

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const rId = msg.roomId;
      const room = rooms.get(rId) || loadRoom(DATA_DIR, rId);
      if (!room) return send(ws, { type: 'error', reason: 'expired' });
      if (!rooms.has(rId)) {
        room.sockets = {};
        room.buyerJoined = false;
        rooms.set(rId, room);
      }
      if (msg.role === 'buyer' && room.buyerJoined && room.sockets.buyer?.readyState === 1) {
        return send(ws, { type: 'error', reason: 'in-use' });
      }
      ws.meta = { roomId: rId, role: msg.role };
      room.sockets[msg.role] = ws;
      if (msg.role === 'buyer') room.buyerJoined = true;
      send(ws, { type: 'joined', role: msg.role, veh: room.veh, price: room.price });
      const other = msg.role === 'dealer' ? room.sockets.buyer : room.sockets.dealer;
      send(other, { type: 'peer-joined', role: msg.role });
      if (room.sockets.dealer && room.sockets.buyer) send(room.sockets.dealer, { type: 'ready' });
      return;
    }

    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    const peer = ws.meta.role === 'dealer' ? room.sockets.buyer : room.sockets.dealer;

    if (['offer', 'answer', 'ice', 'state', 'snapshot', 'flag', 'end'].includes(msg.type)) {
      send(peer, msg);
      if (['state', 'snapshot', 'flag', 'end'].includes(msg.type)) {
        saveRoom(DATA_DIR, room.id, room);
      }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    const peer = ws.meta.role === 'dealer' ? room.sockets.buyer : room.sockets.dealer;
    send(peer, { type: 'peer-left', role: ws.meta.role });
    if (room.sockets[ws.meta.role] === ws) delete room.sockets[ws.meta.role];
  });
});

setInterval(() => {
  cleanupExpired(DATA_DIR);
  const now = Date.now();
  for (const [id, r] of rooms) {
    if (now - r.created > LINK_TTL_MS) rooms.delete(id);
  }
}, 60 * 60 * 1000);

app.get('/api/ice-servers', (_req, res) => {
  res.json({ iceServers: getIceServers() });
});

server.listen(PORT, () => console.log(`TruLive on :${PORT}`));
