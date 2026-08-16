// TruTrade — live video trade-in appraisal: signalling + session server.
// The CUSTOMER shows their own car on camera; the DEALER guides, questions and
// records findings, then issues a trade price (TP) subject to physical viewing.
// The dealer always sets the price — nothing here prices a vehicle.
import express from 'express';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAuthStore, verifyToken, loginWithCode, requireAuth } from './lib/auth.js';
import { saveRoom, loadRoom, loadAllRooms, cleanupExpired, listDealerRooms } from './lib/persist.js';
import { getIceServers, rateLimit } from './lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 30 }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';

const apprId = () => randomBytes(6).toString('hex');

// In-memory rooms (live sockets). Persisted to disk for restart survival.
const rooms = new Map();

// Restore persisted rooms on boot
for (const r of loadAllRooms(DATA_DIR)) {
  r.sockets = {};
  r.joined = false;
  rooms.set(r.id, r);
}
console.log(`[trutrade] Restored ${rooms.size} room(s) from disk.`);

// --- Auth middleware ---
app.use(requireAuth(DATA_DIR));

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, product: 'trutrade',
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

// --- Dealer opens an appraisal ---
app.post('/api/appraisal', (req, res) => {
  const { veh = 'Vehicle', customer = '', reg = '', mileage = '' } = req.body || {};
  const id = apprId();
  const room = {
    id, veh, customer, reg, mileage,
    dealerId: req.auth?.sub || null,
    dealerName: req.auth?.label || null,
    created: Date.now(), joined: false, sockets: {},
    defects: [], answers: [], snaps: [],
    sectionsCompleted: 0, tradePrice: null, status: 'live',
  };
  rooms.set(id, room);
  saveRoom(DATA_DIR, id, room);
  res.json({ id, url: `/a/${id}` });
});

// --- Dealer session history ---
app.get('/api/sessions', (req, res) => {
  const dealerId = req.auth?.sub;
  const list = dealerId
    ? listDealerRooms(DATA_DIR, dealerId)
    : loadAllRooms(DATA_DIR);
  res.json(list.map(r => ({
    id: r.id, veh: r.veh, customer: r.customer, reg: r.reg,
    created: r.created, status: r.status || 'unknown',
    tradePrice: r.tradePrice, _savedAt: r._savedAt,
  })));
});

// --- Customer link ---
app.get('/a/:id', (req, res) => {
  const room = loadRoom(DATA_DIR, req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) {
    return res.status(410).sendFile(path.join(__dirname, 'public', 'expired.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/appraisal/:id', (req, res) => {
  const room = loadRoom(DATA_DIR, req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) {
    return res.status(410).json({ error: 'expired' });
  }
  res.json({ veh: room.veh, customer: room.customer, reg: room.reg });
});

// --- AI write-up (DeepSeek) ---
app.post('/api/writeup', async (req, res) => {
  const data = req.body || {};
  try {
    if (DEEPSEEK_KEY) {
      return res.json({ writeup: await aiWriteup(data), source: 'deepseek' });
    }
  } catch (e) {
    console.error('AI write-up failed, using local:', e.message);
  }
  res.json({ writeup: localWriteup(data), source: 'local' });
});

async function aiWriteup(d) {
  const prompt = `You are the appraisal assistant for TruTrade, a live video trade-in appraisal tool used by South African car dealers.
A dealer has just appraised a customer's vehicle over a live video call. Write the condition write-up for the offer document.

Vehicle: ${d.veh || 'Unknown'}
Registration: ${d.reg || 'n/a'}
Stated mileage: ${d.mileage || 'not stated'}
Duration: ${d.duration || 'n/a'}
Sections inspected: ${(d.sections || []).join(', ') || 'none'}
Defects noted by the dealer: ${(d.defects || []).map(f => `${f.section}: ${f.note}`).join('; ') || 'none noted'}
Customer's answers: ${(d.answers || []).map(a => `${a.q} — ${a.a}`).join('; ') || 'none recorded'}

Write 2 short parts, plain text only:
(1) one line on overall presented condition,
(2) a short paragraph covering what was seen on camera and what the customer disclosed, naming the defects noted.

FORMATTING RULES (follow strictly):
- NEVER use markdown headers (# ## ### ####). Plain text only.
- NEVER use bulleted or numbered lists. Write in prose.
- NEVER use multiple exclamation marks (!! or !!!). Prefer full stops.
- Refer to the vehicle by its name (e.g. "the 2019 Golf 7 R"), not "the vehicle" generically.
- Refer to the customer by name if known, not "the customer".

CRITICAL: do NOT suggest, estimate or imply any monetary value, trade price or valuation. The dealer sets the price separately. Do not use words like "worth", "value", "estimate" or any figure in Rand. Describe condition only. Note explicitly that the assessment is based on a video call and is subject to physical viewing.`;

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      stream: false, max_tokens: 700,
    }),
  });
  if (!r.ok) throw new Error('deepseek ' + r.status);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || localWriteup(d);
}

function localWriteup(d) {
  const defects = d.defects || [];
  const answers = d.answers || [];
  const impression = defects.length === 0
    ? 'Presented in good order on the video appraisal, with no defects noted by the dealer.'
    : defects.length <= 2
      ? 'Presented in fair order, with a small number of defects noted.'
      : 'Presented with several defects noted that will require attention.';
  const seen = `The ${d.veh || 'vehicle'} was appraised over a live video call${d.duration ? ` lasting ${d.duration}` : ''}, `
    + `covering ${(d.sections || []).length} section(s)${d.mileage ? `, with mileage stated as ${d.mileage}` : ''}. `;
  const dl = defects.length
    ? `Defects noted: ${defects.map(f => `${f.section} — ${f.note}`).join('; ')}. `
    : 'No defects were noted during the call. ';
  const al = answers.length
    ? `Customer disclosed: ${answers.map(a => `${a.q} — ${a.a}`).join('; ')}. `
    : '';
  return `${impression}\n\n${seen}${dl}${al}This assessment is based on a video call only and is subject to physical viewing and verification.`;
}

// --- Save completed appraisal ---
app.post('/api/appraisal/:id/complete', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });

  const { tradePrice, validityDays, defects, answers, snaps, sections, duration } = req.body || {};
  room.tradePrice = tradePrice;
  room.validityDays = validityDays || 7;
  room.defects = defects || [];
  room.answers = answers || [];
  room.snaps = snaps || [];
  room.sections = sections || [];
  room.duration = duration;
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
      const room = rooms.get(msg.roomId) || loadRoom(DATA_DIR, msg.roomId);
      if (!room) return send(ws, { type: 'error', reason: 'expired' });
      if (!rooms.has(msg.roomId)) {
        room.sockets = {};
        room.joined = false;
        rooms.set(msg.roomId, room);
      }
      if (msg.role === 'customer' && room.joined && room.sockets.customer?.readyState === 1) {
        return send(ws, { type: 'error', reason: 'in-use' });
      }
      ws.meta = { roomId: msg.roomId, role: msg.role };
      room.sockets[msg.role] = ws;
      if (msg.role === 'customer') room.joined = true;
      send(ws, { type: 'joined', role: msg.role, veh: room.veh, reg: room.reg });
      send(msg.role === 'dealer' ? room.sockets.customer : room.sockets.dealer, { type: 'peer-joined', role: msg.role });
      if (room.sockets.dealer && room.sockets.customer) send(room.sockets.dealer, { type: 'ready' });
      return;
    }

    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    const peer = ws.meta.role === 'dealer' ? room.sockets.customer : room.sockets.dealer;

    // Relay signalling + synced prompts. 'defect' and 'answer' are dealer-private.
    if (['offer', 'answer-sdp', 'ice', 'state', 'snapshot', 'end'].includes(msg.type)) send(peer, msg);

    // Persist after key events
    if (['state', 'snapshot', 'end'].includes(msg.type)) saveRoom(DATA_DIR, room.id, room);
  });

  ws.on('close', () => {
    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    send(ws.meta.role === 'dealer' ? room.sockets.customer : room.sockets.dealer, { type: 'peer-left', role: ws.meta.role });
    if (room.sockets[ws.meta.role] === ws) delete room.sockets[ws.meta.role];
  });
});

// Periodic cleanup
setInterval(() => {
  cleanupExpired(DATA_DIR);
  const now = Date.now();
  for (const [id, r] of rooms) {
    if (now - r.created > LINK_TTL_MS) rooms.delete(id);
  }
}, 60 * 60 * 1000);

// Expose TURN servers to the client
app.get('/api/ice-servers', (_req, res) => {
  res.json({ iceServers: getIceServers() });
});

server.listen(PORT, () => console.log(`TruTrade on :${PORT}`));
