// TruLive — signalling + session server
// Serves the app, mints single-use walkthrough links, relays WebRTC signalling
// and synced guided-walkthrough state between the dealer and the buyer.
import express from 'express';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const LINK_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// roomId -> { veh, price, buyer, created, buyerJoined, sockets:{dealer,buyer} }
const rooms = new Map();

const newId = () => randomBytes(6).toString('hex');

// --- Health check (Render + suite monitoring convention) ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, product: 'trulive', uptimeSec: Math.round(process.uptime()), ts: new Date().toISOString() });
});

// --- Dealer creates a session, gets a single-use buyer link ---
app.post('/api/session', (req, res) => {
  const { veh = 'Vehicle', price = '', buyer = '' } = req.body || {};
  const id = newId();
  rooms.set(id, { veh, price, buyer, created: Date.now(), buyerJoined: false, sockets: {} });
  res.json({ id, url: `/j/${id}` });
});

// --- Buyer link: validate then serve the app (role decided client-side by path) ---
app.get('/j/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(410).sendFile(path.join(__dirname, 'public', 'expired.html'));
  if (Date.now() - room.created > LINK_TTL_MS) {
    rooms.delete(req.params.id);
    return res.status(410).sendFile(path.join(__dirname, 'public', 'expired.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Vehicle info for the buyer join card ---
app.get('/api/room/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room || Date.now() - room.created > LINK_TTL_MS) return res.status(410).json({ error: 'expired' });
  res.json({ veh: room.veh, price: room.price, buyer: room.buyer });
});

// --- AI walkthrough summary ---
// Uses Claude if ANTHROPIC_API_KEY is set; otherwise returns a structured local summary.
app.post('/api/summary', async (req, res) => {
  const data = req.body || {};
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const summary = await claudeSummary(data);
      return res.json({ summary, source: 'ai' });
    }
  } catch (e) {
    console.error('AI summary failed, falling back:', e.message);
  }
  res.json({ summary: localSummary(data), source: 'local' });
});

async function claudeSummary(d) {
  const model = process.env.TRUVIEW_MODEL || 'claude-sonnet-5';
  const prompt = `You are the inspection assistant for TruView, a live guided vehicle walkthrough tool used by car dealers.
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

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const j = await r.json();
  return j.content?.[0]?.text?.trim() || localSummary(d);
}

function localSummary(d) {
  const pct = d.checksTotal ? Math.round((d.checksDone / d.checksTotal) * 100) : 0;
  const impression = pct >= 90 ? 'Vehicle presented well across the full walkthrough.'
    : pct >= 60 ? 'Vehicle covered in a full walkthrough with a few items to review.'
    : 'Partial walkthrough completed — several areas still to confirm.';
  const flags = (d.flags || []);
  // Concerns are rendered as their own report section — mention them as prose only,
  // never as a list here, or the report duplicates them.
  const concerns = flags.length
    ? ` The buyer raised ${flags.length} point${flags.length > 1 ? 's' : ''} for follow-up (${flags.map(f => f.section).join(', ')}).`
    : ' No concerns were raised during the walkthrough.';
  return `${impression}\n\n`
    + `A live guided walkthrough of the ${d.veh || 'vehicle'} was completed over ${d.duration || 'the session'}, `
    + `covering ${(d.sections || []).length} sections (${(d.sections || []).join(', ')}). `
    + `${d.checksDone}/${d.checksTotal} inspection checkpoints were confirmed on camera (${pct}%).`
    + concerns;
}

// --- WebSocket signalling ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

wss.on('connection', (ws) => {
  ws.meta = { roomId: null, role: null };

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const { type } = msg;

    if (type === 'join') {
      const room = rooms.get(msg.roomId);
      if (!room) return send(ws, { type: 'error', reason: 'expired' });
      if (msg.role === 'buyer' && room.buyerJoined && room.sockets.buyer && room.sockets.buyer.readyState === 1) {
        return send(ws, { type: 'error', reason: 'in-use' });
      }
      ws.meta = { roomId: msg.roomId, role: msg.role };
      room.sockets[msg.role] = ws;
      if (msg.role === 'buyer') room.buyerJoined = true;
      send(ws, { type: 'joined', role: msg.role, veh: room.veh, price: room.price });
      // notify the other party
      const other = msg.role === 'dealer' ? room.sockets.buyer : room.sockets.dealer;
      send(other, { type: 'peer-joined', role: msg.role });
      if (room.sockets.dealer && room.sockets.buyer) {
        send(room.sockets.dealer, { type: 'ready' }); // dealer initiates the offer
      }
      return;
    }

    const room = rooms.get(ws.meta.roomId);
    if (!room) return;
    const peer = ws.meta.role === 'dealer' ? room.sockets.buyer : room.sockets.dealer;

    // relay signalling + synced state to the other party
    if (['offer', 'answer', 'ice', 'state', 'snapshot', 'flag', 'end'].includes(type)) {
      send(peer, msg);
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

// periodic cleanup of expired rooms
setInterval(() => {
  const now = Date.now();
  for (const [id, r] of rooms) if (now - r.created > LINK_TTL_MS) rooms.delete(id);
}, 60 * 60 * 1000);

server.listen(PORT, () => console.log(`TruLive on :${PORT}`));
