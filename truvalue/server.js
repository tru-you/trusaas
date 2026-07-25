// TruValue — live video trade-in appraisal: signalling + session server.
// The CUSTOMER shows their own car on camera; the DEALER guides, questions and
// records findings, then issues a trade price (TP) subject to physical viewing.
// The dealer always sets the price — nothing here prices a vehicle.
import express from 'express';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// apprId -> { veh, customer, created, joined, sockets:{dealer,customer} }
const rooms = new Map();
const newId = () => randomBytes(6).toString('hex');

// --- Health (Render + suite monitoring convention) ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'truvalue', uptimeSec: Math.round(process.uptime()), ts: new Date().toISOString() });
});

// --- Dealer opens an appraisal, gets a single-use customer link ---
app.post('/api/appraisal', (req, res) => {
  const { veh = 'Vehicle', customer = '', reg = '' } = req.body || {};
  const id = newId();
  rooms.set(id, { veh, customer, reg, created: Date.now(), joined: false, sockets: {} });
  res.json({ id, url: `/a/${id}` });
});

// --- Customer link ---
app.get('/a/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) {
    rooms.delete(req.params.id);
    return res.status(410).sendFile(path.join(__dirname, 'public', 'expired.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/appraisal/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) return res.status(410).json({ error: 'expired' });
  res.json({ veh: room.veh, customer: room.customer, reg: room.reg });
});

// --- AI appraisal write-up ---
// Summarises CONDITION and the dealer's answers. It must never suggest a price:
// the trade price is the dealer's commercial decision and their liability.
app.post('/api/writeup', async (req, res) => {
  const data = req.body || {};
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      return res.json({ writeup: await claudeWriteup(data), source: 'ai' });
    }
  } catch (e) {
    console.error('AI write-up failed, using local:', e.message);
  }
  res.json({ writeup: localWriteup(data), source: 'local' });
});

async function claudeWriteup(d) {
  const model = process.env.TRUTRADE_MODEL || 'claude-sonnet-5';
  const prompt = `You are the appraisal assistant for TruTrade, a live video trade-in appraisal tool used by South African car dealers.
A dealer has just appraised a customer's vehicle over a live video call. Write the condition write-up for the offer document.

Vehicle: ${d.veh || 'Unknown'}
Registration: ${d.reg || 'n/a'}
Stated mileage: ${d.mileage || 'not stated'}
Duration: ${d.duration || 'n/a'}
Sections inspected: ${(d.sections || []).join(', ') || 'none'}
Defects noted by the dealer: ${(d.defects || []).map(f => `${f.section}: ${f.note}`).join('; ') || 'none noted'}
Customer's answers: ${(d.answers || []).map(a => `${a.q} — ${a.a}`).join('; ') || 'none recorded'}

Write 2 short parts, plain text, no markdown headers, no bulleted list:
(1) one line on overall presented condition,
(2) a short paragraph covering what was seen on camera and what the customer disclosed, naming the defects noted.

CRITICAL: do NOT suggest, estimate or imply any monetary value, trade price or valuation. The dealer sets the price separately. Do not use words like "worth", "value", "estimate" or any figure in Rand. Describe condition only. Note explicitly that the assessment is based on a video call and is subject to physical viewing.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const j = await r.json();
  return j.content?.[0]?.text?.trim() || localWriteup(d);
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

// --- WebSocket signalling ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', (ws) => {
  ws.meta = { roomId: null, role: null };

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const room = rooms.get(msg.roomId);
      if (!room) return send(ws, { type: 'error', reason: 'expired' });
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

    // Relay signalling + synced prompts. 'defect' and 'answer' are dealer-private
    // findings and are deliberately NOT relayed to the customer.
    if (['offer', 'answer-sdp', 'ice', 'state', 'snapshot', 'end'].includes(msg.type)) send(peer, msg);
  });

  ws.on('close', () => {
    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    send(ws.meta.role === 'dealer' ? room.sockets.customer : room.sockets.dealer, { type: 'peer-left', role: ws.meta.role });
    if (room.sockets[ws.meta.role] === ws) delete room.sockets[ws.meta.role];
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms) if (now - r.created > LINK_TTL_MS) rooms.delete(id);
}, 60 * 60 * 1000);

server.listen(PORT, () => console.log(`TruValue on :${PORT}`));
