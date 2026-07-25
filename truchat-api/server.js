/**
 * TruChat API — hosted Claude tool-use chat brain (zero-dependency Node).
 *
 * Ported from the WordPress plugin (truchat/wordpress-plugin/truchat/includes/chat.php)
 * so static sites — the TruSaaS marketing bot and any HTML dealer embed — get the
 * same brain the WordPress dealers have, without WordPress.
 *
 * POST /api/chat  { messages, session, catalog } -> { reply, actions, session, suggestions, source }
 * GET  /api/health
 *
 * The ANTHROPIC_API_KEY never leaves the server. If it is missing or Claude errors,
 * the bot degrades to a knowledge/WhatsApp fallback rather than breaking.
 */

import http from 'node:http';

/* ---- Config (env-driven, safe defaults for the True-Cars demo) ---------- */
const CFG = {
  port:          parseInt(process.env.PORT, 10) || 10000,
  apiKey:        process.env.ANTHROPIC_API_KEY || '',
  model:         process.env.TRUCHAT_MODEL || 'claude-haiku-4-5',
  assistantName: process.env.ASSISTANT_NAME || 'True',
  dealerName:    process.env.DEALER_NAME || 'TruSaaS',
  salesWhatsApp: (process.env.SALES_WHATSAPP || '27620502091').replace(/\D/g, ''),
  stockApi:      process.env.STOCK_API || 'https://premium.tru-saas.com/api/public/stock?dealer=true-cars',
  stockApiFallback: process.env.STOCK_API_FALLBACK || 'https://premium.tru-saas.com/api/public/stock?dealer=demo',
  // Market/locale — SA is the launch market, but every market-specific string is
  // env-driven so one deployment serves anywhere. Override per region, don't hard-code.
  locale:        process.env.TRUCHAT_LOCALE || 'en-ZA',       // number/price formatting
  currency:      process.env.TRUCHAT_CURRENCY || 'ZAR',        // ISO 4217; drives the symbol
  market:        process.env.TRUCHAT_MARKET || 'South Africa', // named in the system prompt
  maxTurns:      6,
};

// Price formatter for the active market (e.g. R 619,000 / £24,995 / $18,500).
const priceFmt = (() => {
  try { return new Intl.NumberFormat(CFG.locale, { style: 'currency', currency: CFG.currency, maximumFractionDigits: 0 }); }
  catch { return { format: n => `${CFG.currency} ${Number(n).toLocaleString()}` }; }
})();

/* ---- Knowledge-first FAQ layer (answers common questions with NO API call) */
function faqIntents() {
  return [
    { keys: ['hi','hello','hey','howzit','hallo','good morning','good afternoon','good day'],
      reply: `Howzit! 👋 I'm **${CFG.assistantName}**, the AI assistant on **${CFG.dealerName}**. I can show you **live stock**, explain how **TruSaaS** runs a dealership, or put you onto a human. What are you after?`,
      suggestions: ['Browse stock','How TruSaaS works','Book a walkthrough'] },
    { keys: ['thanks','thank you','thank u','cheers','dankie','appreciate','lekker','awesome'],
      reply: `Pleasure! 🙌 Anything else — stock, a demo, or how the platform fits your dealership?`,
      suggestions: ['Browse stock','Book a walkthrough'] },
    { keys: ['what is trusaas','how does trusaas','about trusaas','what do you do','how it works','what is this'],
      reply: `**TruSaaS** is the operating system for independent dealers — capture (TruLens), condition reports (TruInspect), the DMS/pipeline (TruFlow), the website (TruShowroom), 24/7 AI (TruChat, that's me) and live video (TruLive). One stack, buy what you need. Want a walkthrough on your own stock?`,
      suggestions: ['Book a walkthrough','Browse stock'] },
    { keys: ['walkthrough','demo','book','call','get started','pricing','how much','cost'],
      reply: `Happy to set up a walkthrough on the same stack that runs the live demo — with your currency, integrations and stock plugged in. Tap below to grab a slot, or share your **name, number and email** and I'll have someone reach out.`,
      suggestions: ['Browse stock'],
      actions: [{ type: 'whatsapp' }] },
  ];
}

function faqMatch(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  if (/\d{7,}/.test(t)) return null;          // looks like a phone number → let LLM drive
  if (t.includes('@')) return null;            // an email → LLM
  if (/\b(book|test drive|come see|come in|apply for)\b/.test(t) && /\d/.test(t)) return null;
  if (t.split(/\s+/).length > 16) return null; // long/complex → LLM

  let best = null, bestScore = 0;
  for (const intent of faqIntents()) {
    let score = 0;
    for (const k of intent.keys) if (t.includes(k)) score += k.includes(' ') ? 2 : 1;
    if (score > bestScore) { bestScore = score; best = intent; }
  }
  if (!best || bestScore < 1) return null;
  return { reply: best.reply, actions: best.actions || [], suggestions: best.suggestions || [] };
}

/* ---- Tool definitions --------------------------------------------------- */
function tools() {
  return [
    { name: 'search_stock',
      description: 'Search current dealership stock by make, model, body type, fuel or budget. Returns matching vehicles which the customer will see as cards.',
      input_schema: { type: 'object', properties: {
        query: { type: 'string', description: "What the customer is after, e.g. 'Ford Ranger diesel', 'bakkie under 300k', 'automatic hatchback'" },
      }, required: ['query'] } },
    { name: 'capture_lead',
      description: 'Log an interested lead (wants a walkthrough, finance, or a callback). Call once you have name, mobile and email.',
      input_schema: { type: 'object', properties: {
        name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
        interest: { type: 'string' }, finance: { type: 'boolean' },
      }, required: ['name','phone','email'] } },
    { name: 'request_whatsapp_handoff',
      description: 'Signal that the customer is qualified and wants a real person on WhatsApp. The client opens WhatsApp with a full ticket.',
      input_schema: { type: 'object', properties: {}, required: [] } },
  ];
}

/* ---- Stock feed --------------------------------------------------------- */
async function loadStock() {
  const urls = [CFG.stockApi, CFG.stockApiFallback].filter(Boolean);
  for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      const list = data.vehicles || data.stock || [];
      if (!list.length) continue;
      const out = list.slice(0, 40).map(v => ({
        id:    v.stockNumber ?? v.id ?? '',
        brand: String(v.make ?? v.brand ?? '').toUpperCase(),
        model: v.model ?? v.trim ?? '',
        year:  v.year ?? '',
        price: parseInt(v.price ?? v.retailPrice ?? 0, 10) || 0,
        km:    v.mileage ? `${v.mileage} km` : (v.km ?? ''),
        fuel:  v.fuelType ?? v.fuel ?? '',
      }));
      if (out.length) return out;
    } catch { /* try next url */ }
  }
  return null;
}

function stockSummary(list) {
  if (!list || !list.length) return '';
  return list.slice(0, 25).map(v =>
    `- ${`${v.year} ${v.brand} ${v.model}`.trim()} — ${priceFmt.format(v.price)}${v.km ? ' · ' + v.km : ''}`
  ).join('\n');
}

function matchStock(list, query) {
  const q = String(query || '').toLowerCase();
  if (!q) return list.slice(0, 5);
  const words = q.split(/\s+/).filter(w => w.length > 2);
  const scored = [];
  for (const v of list) {
    const blob = `${v.year} ${v.brand} ${v.model} ${v.fuel}`.toLowerCase();
    let hits = 0;
    for (const w of words) if (blob.includes(w)) hits++;
    if (hits > 0) scored.push({ v, hits });
  }
  scored.sort((a, b) => b.hits - a.hits);
  if (!scored.length) return list.slice(0, 6);
  return scored.slice(0, 6).map(s => s.v);
}

/* ---- System prompt ------------------------------------------------------ */
function systemPrompt(stockText) {
  return [
    `You are ${CFG.assistantName}, the AI assistant on the ${CFG.dealerName} website — a live demonstration of TruChat, the 24/7 AI module in the TruSaaS dealer platform. The dealership serves the ${CFG.market} market.`,
    `Be warm and concise, and mirror the customer's language and local tone for the ${CFG.market} market. Short paragraphs. Quote prices in the local currency as shown in the stock list. Never quote guaranteed finance rates or approvals — finance is always subject to lender assessment.`,
    ``,
    `You can:`,
    `- Show live vehicles from the demo dealership using the search_stock tool.`,
    `- Explain how TruSaaS works for an independent dealer (capture, condition reports, DMS/pipeline, website, AI, live video).`,
    `- Capture a lead (name, mobile, email) with capture_lead when someone wants a walkthrough, finance or a callback.`,
    `- Hand off to a human on WhatsApp with request_whatsapp_handoff once the person is qualified or asks for a person.`,
    ``,
    `Ask for name, mobile and email before capturing a lead. Use the tools rather than inventing stock or contact details.`,
    stockText ? `\nCurrent demo stock (a sample):\n${stockText}` : `\nLive stock is briefly unavailable — offer a walkthrough or WhatsApp handoff instead of inventing vehicles.`,
  ].join('\n');
}

/* ---- Anthropic call ----------------------------------------------------- */
async function anthropic(messages, system, toolDefs) {
  if (!CFG.apiKey) return { error: 'no_key' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CFG.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CFG.model,
        max_tokens: 1024,
        // Cache the system prompt so repeat turns read it at ~10% cost.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools: toolDefs,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data?.error?.message || `HTTP ${res.status}` };
    return { data };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

/* ---- WhatsApp handoff (free tap-to-chat) -------------------------------- */
function whatsappText(s) {
  const name = String(s.name || '').trim();
  const greet = name ? `Hi, I'm ${name}.` : 'Hi there!';
  let intent;
  if (s.financeInterest) intent = `I'm interested in finance${s.vehicleInterest ? ' on the ' + s.vehicleInterest : ''}.`;
  else if (s.vehicleInterest) intent = `I'm interested in the ${s.vehicleInterest}.`;
  else intent = `I'd like a TruSaaS walkthrough.`;
  const contact = [];
  if (s.phone) contact.push(`my number is ${s.phone}`);
  if (s.email) contact.push(`email ${s.email}`);
  const contactLine = contact.length ? ' ' + contact.join(', ').replace(/^./, c => c.toUpperCase()) + '.' : '';
  return `${greet} ${intent}${contactLine}\n\n(Sent from the ${CFG.dealerName} website chat)`.trim();
}

function finalize(reply, actions, session, extra = {}) {
  for (const a of actions) {
    if (a.type === 'whatsapp') { a.text = whatsappText(session); a.phone = CFG.salesWhatsApp; }
  }
  return { reply, actions, session, ...extra };
}

/* ---- Main handler ------------------------------------------------------- */
async function handleChat(body) {
  const session = Object.assign({
    name: '', phone: '', email: '', vehicleInterest: '',
    financeInterest: false, qualified: false,
  }, (body && typeof body.session === 'object' && body.session) || {});

  const actions = [];

  let stock = await loadStock();
  if (stock === null) stock = Array.isArray(body?.catalog) ? body.catalog : [];

  const system = systemPrompt(stockSummary(stock));
  const toolDefs = tools();

  // Normalise history; Anthropic requires the first message to be role "user".
  let messages = [];
  for (const m of (body?.messages || [])) {
    if (!m || !m.role || m.content == null) continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    messages.push({ role: m.role, content: m.content });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return { reply: '', actions: [], session };

  // Knowledge-first: try to answer the last user message for free.
  let lastUser = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && typeof messages[i].content === 'string') { lastUser = messages[i].content; break; }
  }
  const faq = faqMatch(lastUser);
  if (faq) return finalize(faq.reply, faq.actions, session, { suggestions: faq.suggestions, source: 'knowledge' });

  let finalText = '';

  for (let turn = 0; turn < CFG.maxTurns; turn++) {
    const { data, error } = await anthropic(messages, system, toolDefs);
    if (error) {
      console.error('[TruChat]', error);
      // Graceful degrade — keep the conversation alive via WhatsApp.
      return finalize(
        "I can't reach my brain this second — tap below to carry on with a human on WhatsApp, or try again in a moment.",
        [{ type: 'whatsapp' }], session, { source: 'fallback' }
      );
    }

    const content = data.content || [];
    const texts = content.filter(b => b.type === 'text').map(b => b.text);
    if (texts.length) finalText = texts.join('\n').trim();

    if (data.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content });

    const toolResults = [];
    for (const b of content) {
      if (b.type !== 'tool_use') continue;
      const input = b.input || {};
      let resultText = 'done';

      if (b.name === 'search_stock') {
        const matches = matchStock(stock, input.query || '');
        actions.push({ type: 'stock', vehicles: matches });
        if (matches.length && !session.vehicleInterest) session.vehicleInterest = `${matches[0].brand} ${matches[0].model}`;
        resultText = matches.length
          ? `Showing ${matches.length} vehicle(s) to the customer.`
          : 'No matching stock. Suggest alternatives or invite them to browse the website.';

      } else if (b.name === 'capture_lead') {
        session.name  = input.name  || session.name;
        session.phone = input.phone || session.phone;
        session.email = input.email || session.email;
        if (input.interest) session.vehicleInterest = input.interest;
        session.financeInterest = !!input.finance || session.financeInterest;
        session.qualified = true;
        console.log('[TruChat lead]', JSON.stringify({ ...session, at: new Date().toISOString() }));
        actions.push({ type: 'lead' });
        actions.push({ type: 'whatsapp' });
        resultText = 'Lead logged. Confirm warmly and offer the WhatsApp handoff.';

      } else if (b.name === 'request_whatsapp_handoff') {
        session.qualified = true;
        actions.push({ type: 'whatsapp' });
        resultText = 'WhatsApp handoff shown to the customer.';
      }

      toolResults.push({ type: 'tool_result', tool_use_id: b.id, content: resultText });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return finalize(finalText || 'Sorry — could you say that again?', actions, session);
}

/* ---- HTTP server -------------------------------------------------------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}
function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url.startsWith('/api/health')) {
    return json(res, 200, { ok: true, product: 'truchat', keyConfigured: !!CFG.apiKey, model: CFG.model, ts: new Date().toISOString() });
  }

  if (req.method === 'POST' && req.url.startsWith('/api/chat')) {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(raw || '{}'); }
      catch { return json(res, 400, { error: 'Invalid JSON' }); }
      try {
        const out = await handleChat(body);
        return json(res, 200, out);
      } catch (e) {
        console.error('[TruChat fatal]', e);
        return json(res, 200, {
          reply: "Sorry, I hit a snag. Please try again, or tap below for WhatsApp.",
          actions: [{ type: 'whatsapp', phone: CFG.salesWhatsApp, text: 'Hi — I was chatting on the TruSaaS site.' }],
          session: (body && body.session) || {},
          source: 'error',
        });
      }
    });
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(CFG.port, () => {
  console.log(`TruChat API listening on :${CFG.port} · model ${CFG.model} · key ${CFG.apiKey ? 'set' : 'MISSING'}`);
});
