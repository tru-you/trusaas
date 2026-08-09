import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== AUTH ====================

const ACCESS_CODE = process.env.TRUCRM_ACCESS_CODE || '';

const TOKEN_SECRET =
  process.env.TRUCRM_TOKEN_SECRET ||
  crypto.createHash('sha256').update(ACCESS_CODE || 'trucrm-dev').digest('hex');

const HAS_REAL_TOKEN_SECRET = Boolean(process.env.TRUCRM_TOKEN_SECRET || ACCESS_CODE);

const DEVICE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function codeMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signDeviceToken(): string {
  const claims = { k: 'device', exp: Date.now() + DEVICE_TOKEN_TTL_MS };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyDeviceToken(token: string): boolean {
  try {
    const [payload, sig] = String(token).split('.');
    if (!payload || !sig) return false;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return claims.k === 'device' && claims.exp > Date.now();
  } catch {
    return false;
  }
}

const authenticate = (req: any, res: any, next: any) => {
  if (!HAS_REAL_TOKEN_SECRET) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!verifyDeviceToken(authHeader.slice(7))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ==================== PERSISTENCE ====================

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readStore<T>(filename: string, fallback: T): T {
  try {
    const file = path.join(DATA_DIR, filename);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
    }
  } catch (e) {
    console.error(`[store] read error ${filename}:`, e);
  }
  return fallback;
}

function writeStore(filename: string, data: unknown): void {
  ensureDataDir();
  const file = path.join(DATA_DIR, filename);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// Write auth.json so a health check can confirm auth state without exposing secrets.
function writeAuthState(): void {
  try {
    ensureDataDir();
    writeStore('auth.json', {
      codeConfigured: !!ACCESS_CODE,
      secretConfigured: HAS_REAL_TOKEN_SECRET,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[auth] could not write auth.json:', e);
  }
}

// ==================== AI (DeepSeek) ====================

const DEEPSEEK_BASE = "https://api.deepseek.com/chat/completions";

async function deepseekChat(opts: {
  model: string;
  systemMessage?: string;
  userMessage: string;
  jsonMode?: boolean;
  thinking?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<{ content: string; thinking?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { content: "" };
  }

  const messages: Record<string, string>[] = [];
  if (opts.systemMessage) {
    messages.push({ role: "system", content: opts.systemMessage });
  }
  messages.push({ role: "user", content: opts.userMessage });

  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    stream: false,
  };

  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (opts.thinking) {
    body.thinking = { type: "enabled" };
    body.reasoning_effort = opts.reasoningEffort ?? "high";
  }

  const response = await fetch(DEEPSEEK_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek API error ${response.status}`);
  }

  const msg = data.choices[0].message;
  return {
    content: msg.content ?? "",
    thinking: msg.reasoning_content ?? "",
  };
}

// ==================== SERVER ====================

async function startServer() {
  writeAuthState();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = Number(process.env.PORT) || 3000;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  app.use(express.json({ limit: "10mb" }));

  // Auth gate on all /api/* except /api/health and /api/auth/device.
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path === '/health' || req.path === '/auth/device') return next();
    authenticate(req, res, next);
  });

  // ── Auth ─────────────────────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      product: 'trucrm',
      accessCodeConfigured: !!ACCESS_CODE,
      port: PORT,
      ts: new Date().toISOString(),
    });
  });

  app.post("/api/auth/device", (req, res) => {
    const given = String(req.body?.code || '');

    if (!ACCESS_CODE) {
      return res.status(503).json({
        error: 'No access code configured on this server.',
        message: 'Set TRUCRM_ACCESS_CODE.',
      });
    }

    if (!codeMatches(given, ACCESS_CODE)) {
      return res.status(401).json({ error: 'That code is not recognised.' });
    }

    res.json({ token: signDeviceToken(), expiresInDays: 30 });
  });

  // ── Leads ─────────────────────────────────────────────────────────────────

  app.get("/api/leads", (_req, res) => {
    const leads = readStore<any[]>('leads.json', []);
    res.json(leads);
  });

  app.post("/api/leads", (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body required' });
    }
    const leads = readStore<any[]>('leads.json', []);
    const id = body.id || `lead-${Date.now()}`;
    const now = new Date().toISOString();
    const existing = leads.findIndex((l: any) => l.id === id);
    if (existing !== -1) {
      leads[existing] = { ...leads[existing], ...body, id, updatedAt: now };
      writeStore('leads.json', leads);
      return res.json(leads[existing]);
    }
    const lead = { ...body, id, createdAt: body.createdAt || now, updatedAt: now };
    leads.unshift(lead);
    writeStore('leads.json', leads);
    res.status(201).json(lead);
  });

  app.get("/api/leads/:id", (req, res) => {
    const leads = readStore<any[]>('leads.json', []);
    const lead = leads.find((l: any) => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  });

  app.put("/api/leads/:id", (req, res) => {
    const leads = readStore<any[]>('leads.json', []);
    const idx = leads.findIndex((l: any) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    leads[idx] = { ...leads[idx], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    writeStore('leads.json', leads);
    res.json(leads[idx]);
  });

  app.delete("/api/leads/:id", (req, res) => {
    const leads = readStore<any[]>('leads.json', []);
    const filtered = leads.filter((l: any) => l.id !== req.params.id);
    if (filtered.length === leads.length) return res.status(404).json({ error: 'Not found' });
    writeStore('leads.json', filtered);
    res.json({ ok: true });
  });

  // ── Contacts ──────────────────────────────────────────────────────────────

  app.get("/api/contacts", (_req, res) => {
    const contacts = readStore<any[]>('contacts.json', []);
    res.json(contacts);
  });

  app.post("/api/contacts", (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body required' });
    }
    const contacts = readStore<any[]>('contacts.json', []);
    const id = body.id || `contact-${Date.now()}`;
    const now = new Date().toISOString();
    const existing = contacts.findIndex((c: any) => c.id === id);
    if (existing !== -1) {
      contacts[existing] = { ...contacts[existing], ...body, id, updatedAt: now };
      writeStore('contacts.json', contacts);
      return res.json(contacts[existing]);
    }
    const contact = { ...body, id, createdAt: body.createdAt || now, updatedAt: now };
    contacts.unshift(contact);
    writeStore('contacts.json', contacts);
    res.status(201).json(contact);
  });

  app.get("/api/contacts/:id", (req, res) => {
    const contacts = readStore<any[]>('contacts.json', []);
    const contact = contacts.find((c: any) => c.id === req.params.id);
    if (!contact) return res.status(404).json({ error: 'Not found' });
    res.json(contact);
  });

  app.put("/api/contacts/:id", (req, res) => {
    const contacts = readStore<any[]>('contacts.json', []);
    const idx = contacts.findIndex((c: any) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    contacts[idx] = { ...contacts[idx], ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    writeStore('contacts.json', contacts);
    res.json(contacts[idx]);
  });

  app.delete("/api/contacts/:id", (req, res) => {
    const contacts = readStore<any[]>('contacts.json', []);
    const filtered = contacts.filter((c: any) => c.id !== req.params.id);
    if (filtered.length === contacts.length) return res.status(404).json({ error: 'Not found' });
    writeStore('contacts.json', filtered);
    res.json({ ok: true });
  });

  // ── AI: Dealership Prospect Search ────────────────────────────────────────

  app.post("/api/cardealer/search-prospects", async (req, res) => {
    try {
      const { query } = req.body;

      const result = await deepseekChat({
        model: "deepseek-v4-flash",
        jsonMode: true,
        userMessage: `Find 10 real car dealerships in or near ${query}.
For each dealership, provide:
1. Name
2. Full Address
3. Phone number
4. Website URL
5. Brand focus (e.g., Luxury, Toyota, Used Cars)
6. Estimated inventory size (if available)

Return the data strictly as a JSON object with a "prospects" array of objects with these keys:
name, address, phone, website, brands (array), inventorySize (number), location (city name).

Example format:
{
  "prospects": [
    {
      "name": "Dealership Name",
      "address": "123 Main St",
      "phone": "+27 11 555 0000",
      "website": "https://example.com",
      "brands": ["Toyota", "Ford"],
      "inventorySize": 80,
      "location": "Johannesburg"
    }
  ]
}`,
      });

      if (!result.content) {
        return res.json({
          prospects: [],
          message: "API key not configured. Add DEEPSEEK_API_KEY to your environment."
        });
      }

      const parsed = JSON.parse(result.content);
      res.json(parsed);
    } catch (error: any) {
      console.error("Error in /api/cardealer/search-prospects:", error);
      res.status(500).json({ error: "Failed to search prospects", message: error.message });
    }
  });

  // ── AI: Dealership Strategy Analysis ──────────────────────────────────────

  app.post("/api/cardealer/analyze-dealership", async (req, res) => {
    try {
      const { dealershipData } = req.body;

      const result = await deepseekChat({
        model: "deepseek-v4-pro",
        thinking: true,
        reasoningEffort: "high",
        userMessage: `Perform a deep strategic sales analysis for this car dealership prospect.
Dealership Data:
${JSON.stringify(dealershipData, null, 2)}

Provide a comprehensive report covering:
1. Market Positioning & Competitor Context
2. Potential Pain Points in their current digital presence
3. Specific Sales Angles for our SaaS (CRM, Project Management, Accounting integration)
4. A 30-60-90 day engagement plan

Format the output in clear Markdown.`,
      });

      if (!result.content) {
        return res.json({
          analysis: "Thinking Mode requires a configured DeepSeek API key (deepseek-v4-pro).",
          thought: "Config check failed."
        });
      }

      res.json({
        analysis: result.content,
        thought: result.thinking ?? "",
      });
    } catch (error: any) {
      console.error("Error in /api/cardealer/analyze-dealership:", error);
      res.status(500).json({ error: "Failed to analyze dealership", message: error.message });
    }
  });

  // ── Scraper ───────────────────────────────────────────────────────────────

  async function scrapeWebsite(rawUrl: string) {
    const url = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return { url, ok: false, error: "Invalid URL (must start with http:// or https://)" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { url, ok: false, error: `Site returned HTTP ${response.status}` };
    }

    const html = await response.text();

    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || "";
    const metaDesc =
      (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1]?.trim() ||
      "";
    const emails = Array.from(
      new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map((e) => e.toLowerCase()))
    ).slice(0, 5);
    const phones = Array.from(
      new Set((html.match(/(?:\+27|0)(?:\s?\d{2}){4}\d{1,2}/g) || []))
    ).slice(0, 5);
    const stockLinks = Array.from(
      new Set((html.match(/\/used\/(?:vehicles|cars|stock)[^"'\s]*/gi) || []) as string[])
    ).slice(0, 8);

    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);

    const base: {
      ok: boolean;
      url: string;
      title: string;
      description: string;
      emails: string[];
      phones: string[];
      stockLinks: string[];
      fetchedAt: string;
      structured?: Record<string, unknown> | null;
      message?: string;
      error?: string;
    } = {
      ok: true,
      url,
      title,
      description: metaDesc || cleanText.slice(0, 300),
      emails,
      phones,
      stockLinks,
      fetchedAt: new Date().toISOString(),
    };

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      base.structured = null;
      base.message = "Add DEEPSEEK_API_KEY for structured extraction.";
      return base;
    }

    const structured = await deepseekChat({
      model: "deepseek-v4-flash",
      jsonMode: true,
      userMessage: `This is text scraped from a car dealership's website. Extract a prospect record.
Return JSON:
{
  "name": "Dealership name",
  "location": "City / area",
  "brands": ["Toyota", "Ford"],
  "inventoryEstimate": Number or null,
  "keyProducts": ["list of obvious products/services"]
}

Scraped text:
${cleanText}`,
    });

    if (structured.content) {
      try {
        base.structured = JSON.parse(structured.content);
      } catch {
        base.structured = null;
      }
    }

    return base;
  }

  app.post("/api/cardealer/scrape-website", async (req, res) => {
    try {
      const result = await scrapeWebsite(req.body?.url);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      const { ok, ...payload } = result;
      res.json(payload);
    } catch (error: any) {
      console.error("Error in /api/cardealer/scrape-website:", error);
      res.status(500).json({
        error: "Failed to scrape website",
        message: error.name === "AbortError" ? "Request timed out." : error.message,
      });
    }
  });

  app.post("/api/cardealer/scrape-batch", async (req, res) => {
    try {
      const rawUrls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];
      const urls = rawUrls
        .map((l) => String(l))
        .map((l) => {
          const m = l.match(/(https?:\/\/[^\s]+)/i);
          return m ? m[1].replace(/[,;]+$/, "") : "";
        })
        .filter(Boolean)
        .slice(0, 200);

      if (urls.length === 0) {
        return res.status(400).json({ error: "No valid URLs provided." });
      }

      const CONCURRENCY = 4;
      const results: Record<string, unknown>[] = [];
      let cursor = 0;

      const worker = async () => {
        while (cursor < urls.length) {
          const url = urls[cursor++];
          try {
            const r = await scrapeWebsite(url);
            results.push({ url, ok: r.ok, error: r.ok ? undefined : r.error, ...(r.ok ? r : {}) });
          } catch (e: any) {
            results.push({
              url,
              ok: false,
              error: e?.name === "AbortError" ? "Timed out" : e?.message || "Failed",
            });
          }
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      res.json({ total: results.length, succeeded: results.filter((r) => r.ok).length, results });
    } catch (error: any) {
      console.error("Error in /api/cardealer/scrape-batch:", error);
      res.status(500).json({ error: "Failed to run batch scrape", message: error.message });
    }
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`TruCRM server running on http://0.0.0.0:${PORT}`);
    if (!HAS_REAL_TOKEN_SECRET) {
      console.warn('[auth] WARNING: no TRUCRM_ACCESS_CODE set — API is open. Set it on Render.');
    }
  });
}

startServer();
