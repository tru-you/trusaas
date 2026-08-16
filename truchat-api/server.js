/**
 * TruChat API — multi-app DeepSeek chat brain (zero-dependency Node).
 *
 * Serves different personas depending on the calling app:
 *   app:"website"   → customer-facing sales bot (stock search, lead capture, WhatsApp handoff)
 *   app:"mobile"    → dealer staff assistant (stock insights, lead tips, platform help)
 *   app:"trulens"   → TruLens assistant (photo capture, quality scores, damage, DMS export)
 *   app:"truinspect" → TruInspect assistant (inspections, checklists, trade-ins, reports)
 *
 * POST /api/chat  { app?, messages, session, catalog } -> { reply, actions, session, suggestions, source }
 * GET  /api/health
 */

import http from 'node:http';

/* ---- Config ------------------------------------------------------------- */
const CFG = {
  port:          parseInt(process.env.PORT, 10) || 10000,
  apiKey:        process.env.DEEPSEEK_API_KEY || '',
  model:         process.env.TRUCHAT_MODEL || 'deepseek-chat',
  assistantName: process.env.ASSISTANT_NAME || 'True',
  dealerName:    process.env.DEALER_NAME || 'TruSaaS',
  salesWhatsApp: (process.env.SALES_WHATSAPP || '447476995694').replace(/\D/g, ''),
  stockApi:      process.env.STOCK_API || 'https://premium.tru-saas.com/api/public/stock?dealer=true-cars',
  stockApiFallback: process.env.STOCK_API_FALLBACK || 'https://premium.tru-saas.com/api/public/stock?dealer=demo',
  locale:        process.env.TRUCHAT_LOCALE || 'en-ZA',
  currency:      process.env.TRUCHAT_CURRENCY || 'ZAR',
  market:        process.env.TRUCHAT_MARKET || 'South Africa',
  maxTurns:      6,
};

const priceFmt = (() => {
  try { return new Intl.NumberFormat(CFG.locale, { style: 'currency', currency: CFG.currency, maximumFractionDigits: 0 }); }
  catch { return { format: n => `${CFG.currency} ${Number(n).toLocaleString()}` }; }
})();

/* ---- TruSaaS platform knowledge (shared across dealer-staff apps) ------- */
const PLATFORM_KNOWLEDGE = `
The dealer platform includes these apps (refer to them by name, not by vendor):
- TruLens — guided 27-slot photo capture with AI quality scoring. Each photo scored for sharpness, exposure, framing. Damage tagger. One-tap export to DMS.
- TruInspect — condition inspection app. Walk-around camera, inspection checklist (pass/fail/N/A), damage tagger with severity, trade-in appraisal, PDF condition reports.
- TruFlow — DMS: stock management, leads/pipeline CRM, deal tracker, finance, web publishing, settings.
- TruFlow Mobile — mobile companion. Dashboard KPIs, leads with call/WhatsApp/note, stock browser.
- TruOrbit — 360° vehicle spin viewer from TruLens photos.
- TruAfford — affordability calculator (soft credit check, no bureau hit).

All apps share the same vehicle database. Photos in TruLens appear in TruInspect and TruFlow. Stock published in TruFlow appears on the website.
`.trim();

/* ---- Tone rules (shared across all modes) ------------------------------- */
const TONE_RULES = `
TONE RULES (follow strictly):
- Never use hashtags (#). Ever.
- Maximum one exclamation mark per message. Prefer full stops.
- No emoji spam — one emoji per message at most, and only if natural.
- No marketing speak, no hype, no "amazing", "incredible", "game-changer".
- Write like a calm, knowledgeable colleague — not a brand account.
- Short paragraphs. 1-3 sentences each. No walls of text.
- Use **bold** sparingly — for vehicle names, prices, or key actions only.
- Do not introduce yourself unless directly asked who you are.
`.trim();

/* ---- App-specific system prompts ---------------------------------------- */
function websitePrompt(stockText) {
  return [
    `You are ${CFG.assistantName}, the AI assistant on the ${CFG.dealerName} website — a live demonstration of TruChat, the 24/7 AI module in the TruSaaS dealer platform. The dealership serves the ${CFG.market} market.`,
    ``,
    TONE_RULES,
    ``,
    `Be warm and concise, and mirror the customer's language and local tone for the ${CFG.market} market. Quote prices in the local currency as shown in the stock list. Never quote guaranteed finance rates or approvals — finance is always subject to lender assessment.`,
    ``,
    `You can:`,
    `- Show live vehicles from the demo dealership using the search_stock tool.`,
    `- Explain how TruSaaS works for an independent dealer.`,
    `- Capture a lead (name, mobile, email) with capture_lead when someone wants a walkthrough, finance or a callback.`,
    `- Hand off to a human on WhatsApp with request_whatsapp_handoff once the person is qualified or asks for a person.`,
    ``,
    `Ask for name, mobile and email before capturing a lead. Use the tools rather than inventing stock or contact details.`,
    stockText ? `\nCurrent demo stock (a sample):\n${stockText}` : `\nLive stock is briefly unavailable — offer a walkthrough or WhatsApp handoff instead of inventing vehicles.`,
  ].join('\n');
}

function mobilePrompt(stockText) {
  return [
    `You are Dealer Assist, a helpful AI inside a dealer's mobile app. You're talking to a dealer staff member (salesperson, manager, or principal), NOT a customer.`,
    ``,
    TONE_RULES,
    ``,
    `Be direct and knowledgeable. Short answers.`,
    ``,
    PLATFORM_KNOWLEDGE,
    ``,
    `You can help with:`,
    `- Stock questions — use search_stock to find vehicles, check pricing, days-in-stock, what's selling.`,
    `- Lead advice — how to follow up, what to say, prioritisation tips.`,
    `- Platform how-tos — how features work, where to find settings, how the apps connect.`,
    `- Sales coaching — objection handling, closing tips, finance explainers for customers.`,
    `- Market knowledge — general ${CFG.market} used-car market awareness.`,
    ``,
    `If they need hands-on help beyond what you can do, offer to connect them to support on WhatsApp.`,
    stockText ? `\nDealership stock:\n${stockText}` : '',
  ].join('\n');
}

function trulensPrompt() {
  return [
    `You are Dealer Assist, a helpful AI inside the photo-capture app. You're talking to a dealer staff member who is photographing vehicles.`,
    ``,
    TONE_RULES,
    ``,
    `Be direct and helpful. Short answers. You're the expert on vehicle photography.`,
    ``,
    PLATFORM_KNOWLEDGE,
    ``,
    `**TruLens deep knowledge:**`,
    `- **27-slot walk-around**: front ¾ left, front ¾ right, front straight, rear ¾ left, rear ¾ right, rear straight, left side, right side, left front wheel, right front wheel, left rear wheel, right rear wheel, dashboard, steering wheel, front seats, rear seats, centre console, infotainment, odometer, engine bay, boot/trunk, roof, sunroof, key fob, and 3 extras.`,
    `- **Quality scores**: each photo is scored for sharpness, exposure, and framing. Green = good, amber = acceptable, red = reshoot. The overall vehicle readiness badge shows when enough quality photos are captured.`,
    `- **Damage tagger**: AI-assisted damage detection. Tap a photo to tag dents, scratches, chips, cracks, rust, or missing parts. Severity: minor, moderate, severe. These feed into the TruInspect condition report.`,
    `- **Photo editor**: crop, rotate, brightness, contrast adjustments before saving.`,
    `- **Bulk upload**: drag-and-drop multiple photos at once, then assign to slots.`,
    `- **DMS export**: one tap sends all photos + quality data + damage tags to TruFlow Premium. The vehicle becomes "listing ready" in TruFlow once enough slots are filled.`,
    `- **Close-up photos**: each slot supports additional close-up shots for detail (damage evidence, feature highlights).`,
    ``,
    `**Photography tips you should share when asked:**`,
    `- Shoot in daylight or under bright showroom lights — avoid harsh shadows.`,
    `- Keep the vehicle centred in frame with some background margin.`,
    `- For ¾ angles: stand at the corner, step back 3-4 metres, camera at bumper height.`,
    `- Clean the vehicle before shooting — fingerprints on paint show in photos.`,
    `- For interiors: open all doors for light, shoot from the passenger side to show dashboard + steering wheel.`,
    `- Odometer: turn ignition to ON so the display lights up.`,
    `- Engine bay: prop the bonnet, shoot straight down from above.`,
    ``,
    `If they need help beyond what you can answer, offer to connect them to support on WhatsApp.`,
  ].join('\n');
}

function truinspectPrompt() {
  return [
    `You are Dealer Assist, a helpful AI inside the vehicle inspection app. You're talking to a dealer staff member doing inspections or trade-in appraisals.`,
    ``,
    TONE_RULES,
    ``,
    `Be direct and helpful. Short answers. You're the expert on vehicle inspections.`,
    ``,
    PLATFORM_KNOWLEDGE,
    ``,
    `**TruInspect deep knowledge:**`,
    `- **Walk-around capture**: same 27-slot guided camera as TruLens — photos are shared between apps. A photo taken in TruLens appears in TruInspect and vice versa.`,
    `- **Inspection checklist**: categorised check items — exterior, interior, mechanical, electrical, tyres, glass, lights. Each item: pass ✅, fail ❌, or N/A. Failed items get notes and photos.`,
    `- **Damage tagger**: AI-assisted. Tag damage type (dent, scratch, chip, crack, rust, missing), set severity (minor/moderate/severe), attach evidence photos. Damage findings appear in the condition report.`,
    `- **Trade-in appraisal**: structured walk-around for trade-in vehicles. Capture condition at each point, then enter market valuation (retail, trade, auction values). Generates a trade-in summary with photos + valuation.`,
    `- **Condition report (PDF)**: generated from inspection data — all photos, checklist results, damage findings, trade-in valuation if applicable. Can be shared/downloaded as PDF.`,
    `- **Sign-off status**: vehicles are "unsigned" until inspection is complete and a manager signs off. Signed-off vehicles show a green badge in the inventory list.`,
    `- **Completion review**: before finishing, review all slots — which have photos, which need attention, overall completeness percentage.`,
    ``,
    `**Inspection tips you should share when asked:**`,
    `- Start with the exterior walk-around (photos), then checklist, then damage tagging — this order builds the report naturally.`,
    `- For trade-ins: photograph everything, even minor damage — it protects the dealer if the customer disputes later.`,
    `- Check tyre tread depth, not just tyre condition — a "good condition" tyre can still be below legal limit.`,
    `- Test all electrical: windows, mirrors, locks, infotainment, climate control, heated seats.`,
    `- Always photograph the VIN plate and service book for verification.`,
    `- For engine bay: look for leaks, check fluid levels, note any aftermarket modifications.`,
    ``,
    `If they need help beyond what you can answer, offer to connect them to support on WhatsApp.`,
  ].join('\n');
}

/* ---- Knowledge-first FAQ layer (website mode only) ---------------------- */
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
  if (/\d{7,}/.test(t)) return null;
  if (t.includes('@')) return null;
  if (/\b(book|test drive|come see|come in|apply for)\b/.test(t) && /\d/.test(t)) return null;
  if (t.split(/\s+/).length > 16) return null;

  let best = null, bestScore = 0;
  for (const intent of faqIntents()) {
    let score = 0;
    for (const k of intent.keys) if (t.includes(k)) score += k.includes(' ') ? 2 : 1;
    if (score > bestScore) { bestScore = score; best = intent; }
  }
  if (!best || bestScore < 1) return null;
  return { reply: best.reply, actions: best.actions || [], suggestions: best.suggestions || [] };
}

/* ---- Tool definitions (OpenAI function-calling format) ------------------ */
function websiteTools() {
  return [
    { type: 'function', function: {
      name: 'search_stock',
      description: 'Search current dealership stock by make, model, body type, fuel or budget. Returns matching vehicles which the customer will see as cards.',
      parameters: { type: 'object', properties: {
        query: { type: 'string', description: "What the customer is after, e.g. 'Ford Ranger diesel', 'bakkie under 300k', 'automatic hatchback'" },
      }, required: ['query'] },
    }},
    { type: 'function', function: {
      name: 'capture_lead',
      description: 'Log an interested lead (wants a walkthrough, finance, or a callback). Call once you have name, mobile and email.',
      parameters: { type: 'object', properties: {
        name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' },
        interest: { type: 'string' }, finance: { type: 'boolean' },
      }, required: ['name','phone','email'] },
    }},
    { type: 'function', function: {
      name: 'request_whatsapp_handoff',
      description: 'Signal that the customer is qualified and wants a real person on WhatsApp. The client opens WhatsApp with a full ticket.',
      parameters: { type: 'object', properties: {}, required: [] },
    }},
  ];
}

function mobileTools() {
  return [
    { type: 'function', function: {
      name: 'search_stock',
      description: 'Search the dealer stock by make, model, body type, fuel, price range, or days in stock.',
      parameters: { type: 'object', properties: {
        query: { type: 'string', description: "e.g. 'Ford Ranger', 'SUV under 400k', 'diesel bakkie', 'oldest stock'" },
      }, required: ['query'] },
    }},
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

/* ---- DeepSeek call (OpenAI-compatible) ---------------------------------- */
async function deepseek(messages, system, tools) {
  if (!CFG.apiKey) return { error: 'no_key' };
  try {
    const apiMessages = [
      { role: 'system', content: system },
      ...messages,
    ];
    const body = {
      model: CFG.model,
      max_tokens: 1024,
      messages: apiMessages,
    };
    if (tools && tools.length) body.tools = tools;
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CFG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { error: data?.error?.message || `HTTP ${res.status}` };
    return { data };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

/* ---- WhatsApp handoff --------------------------------------------------- */
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
  const app = String(body?.app || 'website').toLowerCase();
  const session = Object.assign({
    name: '', phone: '', email: '', vehicleInterest: '',
    financeInterest: false, qualified: false,
  }, (body && typeof body.session === 'object' && body.session) || {});

  const actions = [];

  // Stock: load for website and mobile modes; not needed for trulens/truinspect
  let stock = [];
  const needsStock = app === 'website' || app === 'mobile';
  if (needsStock) {
    stock = await loadStock();
    if (stock === null) stock = Array.isArray(body?.catalog) ? body.catalog : [];
  }

  // Build app-specific system prompt and tools
  let system, tools;
  if (app === 'trulens') {
    system = trulensPrompt();
    tools = null;
  } else if (app === 'truinspect') {
    system = truinspectPrompt();
    tools = null;
  } else if (app === 'mobile') {
    system = mobilePrompt(stockSummary(stock));
    tools = mobileTools();
  } else {
    system = websitePrompt(stockSummary(stock));
    tools = websiteTools();
  }

  // Normalise history
  let messages = [];
  for (const m of (body?.messages || [])) {
    if (!m || !m.role || m.content == null) continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    messages.push({ role: m.role, content: m.content });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) return { reply: '', actions: [], session };

  // Knowledge-first FAQ (website mode only — staff apps always go to LLM)
  if (app === 'website') {
    let lastUser = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && typeof messages[i].content === 'string') { lastUser = messages[i].content; break; }
    }
    const faq = faqMatch(lastUser);
    if (faq) return finalize(faq.reply, faq.actions, session, { suggestions: faq.suggestions, source: 'knowledge' });
  }

  let finalText = '';

  for (let turn = 0; turn < CFG.maxTurns; turn++) {
    const { data, error } = await deepseek(messages, system, tools);
    if (error) {
      console.error('[TruChat]', error);
      if (app === 'website') {
        return finalize(
          "I can't reach my brain this second — tap below to carry on with a human on WhatsApp, or try again in a moment.",
          [{ type: 'whatsapp' }], session, { source: 'fallback' }
        );
      }
      return finalize("Sorry, I couldn't process that — the AI service is temporarily unavailable. Try again in a moment.", [], session, { source: 'fallback' });
    }

    const choice = data.choices?.[0];
    if (!choice) break;

    const msg = choice.message;
    if (msg.content) finalText = msg.content.trim();

    if (choice.finish_reason !== 'tool_calls' || !msg.tool_calls?.length) break;

    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });

    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      let input = {};
      try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}
      let resultText = 'done';

      if (fnName === 'search_stock') {
        const matches = matchStock(stock, input.query || '');
        actions.push({ type: 'stock', vehicles: matches });
        if (matches.length && !session.vehicleInterest) session.vehicleInterest = `${matches[0].brand} ${matches[0].model}`;
        resultText = matches.length
          ? `Showing ${matches.length} vehicle(s).`
          : 'No matching stock found.';

      } else if (fnName === 'capture_lead') {
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

      } else if (fnName === 'request_whatsapp_handoff') {
        session.qualified = true;
        actions.push({ type: 'whatsapp' });
        resultText = 'WhatsApp handoff shown to the customer.';
      }

      messages.push({ role: 'tool', tool_call_id: tc.id, content: resultText });
    }
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
