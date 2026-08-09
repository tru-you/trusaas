import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

// import.meta.url is undefined in the esbuild CJS bundle; __dirname is already
// a global in CJS so we use it directly when available.
const serverDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(new URL(import.meta.url).pathname);

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

  const SCRAPE_TIMEOUT_MS = 15000;
  const MAX_CRAWL_PAGES = 5;
  const HEADLESS_ENABLED = process.env.ENABLE_HEADLESS === "true";

  const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  ];

  const INVENTORY_PATH_RE =
    /\/(used|pre-owned|preowned|second-hand|new|stock|inventory|vehicles?|cars?|for-sale|forsale|showroom|gallery)\/?(\?.*)?$/i;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function pickUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async function fetchHtmlWithRetries(url: string, retries = 3): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "User-Agent": pickUserAgent(),
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,af;q=0.8,en-ZA;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            "Upgrade-Insecure-Requests": "1",
            Referer: new URL(url).origin + "/",
          },
        });
        if (!response.ok) {
          // Don't retry hard client errors (404, 403); retry 5xx and 429.
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Site returned HTTP ${response.status}`);
          }
          if (attempt < retries - 1) {
            lastError = new Error(`Site returned HTTP ${response.status}`);
            await sleep(600 * (attempt + 1));
            continue;
          }
          throw new Error(`Site returned HTTP ${response.status}`);
        }
        const html = await response.text();
        if (html.length < 200) {
          throw new Error("Empty or too-small response body");
        }
        return html;
      } catch (e: any) {
        lastError = e;
        if (e?.name === "AbortError") lastError = new Error("Request timed out");
        if (attempt < retries - 1) {
          await sleep(600 * (attempt + 1));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError || new Error("Failed to fetch page");
  }

  // Lazy singleton headless browser (puppeteer). Only used when ENABLE_HEADLESS=true.
  let headlessBrowser: any = null;
  let lastHeadlessUsedAt = 0;
  const HEADLESS_IDLE_MS = 90000;

  async function getHeadlessBrowser(): Promise<any> {
    // Close an idle browser so the container doesn't sit at peak memory
    // between scrapes (Render starter = 512 MB).
    if (headlessBrowser && Date.now() - lastHeadlessUsedAt > HEADLESS_IDLE_MS) {
      headlessBrowser.close().catch(() => {});
      headlessBrowser = null;
    }
    if (!headlessBrowser) {
      headlessBrowser = await (async () => {
        const { default: puppeteer } = await import("puppeteer");
        try {
          // @sparticuz/chromium ships a statically-linked Chromium inside the
          // npm package, so it runs on Render without apt-installed system
          // libs (apt-get is unavailable in Render build/pre-deploy phases).
          // Launch it with puppeteer's own defaults + minimal flags: the
          // Lambda-oriented sparticuz args (--single-process, --headless='shell',
          // SwiftShader graphics) are memory-heavy and crash a 512 MB instance.
          const chromiumModule: any = await import("@sparticuz/chromium");
          const chromium = chromiumModule.default ?? chromiumModule;
          return await puppeteer.launch({
            headless: true,
            executablePath: await chromium.executablePath(),
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-extensions",
            ],
          });
        } catch (e: any) {
          console.warn(
            "[scraper] @sparticuz/chromium unavailable, falling back to bundled Chrome:",
            e?.message
          );
        }
        return puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-extensions",
          ],
        });
      })().catch((e) => {
        console.error("[scraper] headless browser failed to launch:", e?.message);
        headlessBrowser = null;
        throw e;
      });
    }
    lastHeadlessUsedAt = Date.now();
    return headlessBrowser;
  }

  async function renderWithHeadless(url: string): Promise<string | null> {
    // Prefer the dedicated scraper worker (trusaas-crm-scraper): Chromium +
    // Node together exceed a 512 MB Render instance, so running the browser
    // in-process crashed the whole CRM service. The worker has its own
    // instance and only renders pages on request.
    const workerUrl = (process.env.SCRAPER_SERVICE_URL || "").trim();
    if (workerUrl) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60000);
        const res = await fetch(`${workerUrl}/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data: any = await res.json();
        return data?.ok && typeof data?.html === "string" ? data.html : null;
      } catch (e: any) {
        console.warn("[scraper] remote headless render failed, falling back to local:", e?.message);
      }
    }
    let page: any;
    try {
      const browser = await getHeadlessBrowser();
      page = await browser.newPage();
      await page.setUserAgent(pickUserAgent());
      await page.setViewport({ width: 1366, height: 900 });
      // domcontentloaded + fixed settle time instead of networkidle2, which
      // hangs forever on sites with long-polling / websockets.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
      const html = await page.content();
      if (html.length < 200) return null;
      return html;
    } catch (e: any) {
      console.warn(`[scraper] headless render failed for ${url}:`, e?.message);
      // Browser process may have crashed (OOM etc.) — force a relaunch next time.
      headlessBrowser = null;
      return null;
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  const cleanHtmlText = (html: string) =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const deobfuscate = (s: string) =>
    s
      .replace(/\s*\[?\(?at\)?\]?\s*/gi, "@")
      .replace(/\s*\[?\(?dot\)?\]?\s*/gi, ".")
      .replace(/\s*\[?\(?com\)?\]?\s*/gi, ".com")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".");

  function extractEmails(text: string): string[] {
    const found = new Set<string>();
    const plain: string[] = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    plain.forEach((e) => found.add(e.toLowerCase()));
    const obfuscated = deobfuscate(text);
    const obfuscatedMatches: string[] = obfuscated.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    obfuscatedMatches.forEach((e) => found.add(e.toLowerCase()));
    return Array.from(found)
      .map((e) => e.replace(/\.{2,}/g, "."))
      .filter((e) => {
        const [local, domain] = e.split("@");
        if (!local || !domain) return false;
        if (!/[a-zA-Z]/.test(local)) return false;
        if (local.length < 2 || local.length > 40) return false;
        if (domain.length > 40 || !/^[a-z0-9.-]+$/.test(domain)) return false;
        if (!isPlausibleDomain(domain)) return false;
        return !e.includes("example") && !e.includes(".png") && !e.includes(".jpg") && !e.includes(".webp");
      })
      .slice(0, 5);
  }

  // Reject junk like "ions.if" while accepting co.za / org.za / web.za domains.
  function isPlausibleDomain(domain: string): boolean {
    const parts = domain.split(".");
    const tld = parts[parts.length - 1];
    if (tld === "za") {
      const sld = parts[parts.length - 2];
      return ["co", "org", "web", "gov", "ac", "net"].includes(sld);
    }
    const COMMON_TLDS = ["com", "net", "org", "info", "biz", "me", "io", "co", "za", "cc", "tv", "website", "site"];
    return COMMON_TLDS.includes(tld);
  }

  function extractPhones(text: string): string[] {
    const found = new Map<string, string>();
    const patterns = [
      /(?:\+27|0)(?:\s?\d{2}){4}\d{1,2}/g,
      /\+27\s?\(?\d{2}\)?\s?\d{3}\s?\d{4}/g,
      /0\s?\d{2}\s?\d{3}\s?\d{4}/g,
    ];
    patterns.forEach((re) => {
      const matches: string[] = text.match(re) || [];
      matches.forEach((p) => {
        const cleaned = p.replace(/\s+/g, " ").trim();
        const digits = cleaned.replace(/[^0-9]/g, "");
        // SA numbers only: 0xx xxx xxxx (10 digits) or +27xx xxx xxxx (9 after code).
        const isSa = /^0[1-8]\d{8}$/.test(digits) || /^27[1-8]\d{8}$/.test(digits);
        if (isSa) {
          // Dedupe by last 9 digits: "074 409 3780" and "74 409 3780" are the same.
          const key = digits.slice(-9);
          if (!found.has(key)) found.set(key, cleaned);
        }
      });
    });
    return Array.from(found.values()).slice(0, 5);
  }

  function extractJsonLd(html: string): Record<string, unknown>[] {
    const blocks = (html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []);
    const results: Record<string, unknown>[] = [];
    for (const block of blocks) {
      const raw = (block.replace(/<script[^>]*>/, "").replace(/<\/script>/i, "")).trim();
      try {
        const parsed = JSON.parse(raw);
        const graph = parsed["@graph"] || [];
        const items = Array.isArray(graph) ? graph : Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item: any) => {
          if (item && typeof item === "object" && item["@type"]) results.push(item);
        });
      } catch {
        // ignore malformed JSON-LD blocks
      }
    }
    return results;
  }

  function structuredFromJsonLd(html: string): { name?: string; location?: string; phones?: string[]; emails?: string[] } | null {
    const items = extractJsonLd(html);
    if (items.length === 0) return null;
    const dealer = items.find(
      (i: any) => i["@type"] === "AutoDealer" || i["@type"] === "AutomotiveBusiness"
    );
    const source = (dealer as any) || items[0] as any;
    const addr = source.address || {};
    const contactPoint = Array.isArray(source.contactPoint) ? source.contactPoint[0] : source.contactPoint;
    const phones: string[] = [];
    const emails: string[] = [];
    if (typeof source.telephone === "string") phones.push(source.telephone);
    if (typeof contactPoint?.telephone === "string") phones.push(contactPoint.telephone);
    if (typeof contactPoint?.email === "string") emails.push(contactPoint.email);
    if (typeof source.email === "string") emails.push(source.email);
    const location = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") || undefined;
    return {
      name: typeof source.name === "string" ? source.name : undefined,
      location,
      phones,
      emails,
    };
  }

  const absoluteUrl = (base: string, href: string): string => {
    try {
      return new URL(href, base).toString();
    } catch {
      return "";
    }
  };

  async function scrapeWebsite(rawUrl: string, options?: { crawl?: boolean; onPage?: (page: string) => void; headless?: boolean }) {
    const url = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return { url, ok: false, error: "Invalid URL (must start with http:// or https://)" };
    }

    const crawl = options?.crawl !== false;
    const useHeadless = options?.headless !== false && HEADLESS_ENABLED;

    const pagesToFetch: string[] = [url];
    if (crawl) {
      const origin = new URL(url).origin;
      pagesToFetch.push(`${origin}/contact`, `${origin}/contact-us`, `${origin}/contactus`);
    }

    const fetched: { pageUrl: string; html: string; ok: boolean; error?: string }[] = [];
    let lastError: string | null = null;

    for (let i = 0; i < pagesToFetch.length && fetched.length < MAX_CRAWL_PAGES; i++) {
      const pageUrl = pagesToFetch[i];
      try {
        const html = await fetchHtmlWithRetries(pageUrl);
        fetched.push({ pageUrl, html, ok: true });
        options?.onPage?.(pageUrl);
      } catch (e: any) {
        lastError = e?.message || "Failed to fetch page";
        fetched.push({ pageUrl, html: "", ok: false, error: lastError });
        // Homepage unreachable (bot-blocked / DNS-blocked): contact pages will
        // fail the same way — bail to the headless fallback immediately.
        if (i === 0 && useHeadless) break;
      }
    }

    let home = fetched.find((f) => f.ok && new URL(f.pageUrl).pathname === "/") || fetched.find((f) => f.ok) || fetched[0];
    let usedHeadless = false;

    // Fallback 1: everything failed (bot-blocked / JS-gated) — render the main URL.
    if ((!home || !home.ok) && useHeadless) {
      const rendered = await renderWithHeadless(url);
      if (rendered) {
        home = { pageUrl: url, html: rendered, ok: true };
        usedHeadless = true;
      }
    }

    if (!home || !home.ok) {
      return { url, ok: false, error: lastError || "Site did not respond to scraping" };
    }

    const origin = new URL(url).origin;
    const allTexts = fetched.filter((f) => f.ok).map((f) => f.html);
    if (usedHeadless) allTexts.push(home.html);
    const combinedHtml = allTexts.join("\n");
    const emails = new Set<string>();
    const phones = new Map<string, string>();
    const stockLinks = new Set<string>();

    const addPhone = (p: string) => {
      const digits = p.replace(/[^0-9]/g, "");
      const isSa = /^0[1-8]\d{8}$/.test(digits) || /^27[1-8]\d{8}$/.test(digits);
      if (isSa) {
        // Dedupe by last 9 digits: "074 409 3780" and "+27744093780" are the same.
        const key = digits.slice(-9);
        if (!phones.has(key)) phones.set(key, p);
      }
    };

    const ingestPage = (html: string) => {
      const text = cleanHtmlText(html);
      extractEmails(text).forEach((e) => emails.add(e));
      extractPhones(text).forEach((p) => addPhone(p));
      const linkRe = /href=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) !== null) {
        const href = m[1];
        if (href.startsWith("mailto:")) {
          const email = decodeURIComponent(href.slice(7)).toLowerCase();
          if (/@/.test(email)) emails.add(email);
        } else if (/^tel:/.test(href)) {
          const phone = href.slice(4).replace(/[^0-9+]/g, "");
          addPhone(phone);
        } else if (INVENTORY_PATH_RE.test(href) || /(vehicle|stock|inventory)/i.test(href)) {
          const abs = absoluteUrl(origin, href);
          if (abs && new URL(abs).origin === origin) stockLinks.add(abs);
        }
      }
    };

    for (const f of fetched) {
      if (!f.ok) continue;
      ingestPage(f.html);
    }
    if (usedHeadless) ingestPage(home.html);

    const titleMatch = home.html.match(/<title[^>]*>([^<]*)<\/title>/i);
    let title = (titleMatch && titleMatch[1]?.trim()) || "";
    const metaDescMatch = home.html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    let metaDesc = (metaDescMatch && metaDescMatch[1]?.trim()) || "";

    // Fallback 2: page loaded but content is thin (SPA renders via JS) or the
    // most valuable field (email) is missing — render and re-parse.
    if (useHeadless && !usedHeadless && (!title || emails.size === 0 || (phones.size === 0 && stockLinks.size === 0))) {      const rendered = await renderWithHeadless(url);
      if (rendered) {
        usedHeadless = true;
        home = { pageUrl: url, html: rendered, ok: true };
        ingestPage(rendered);
        const rt = rendered.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (rt && rt[1]?.trim()) title = rt[1].trim();
        const rm = rendered.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
        if (rm && rm[1]?.trim()) metaDesc = rm[1].trim();
      }
    }

    const firstEmails = Array.from(emails).slice(0, 5);
    const firstPhones = Array.from(phones.values()).slice(0, 5);
    const firstStockLinks = Array.from(stockLinks).slice(0, 8);

    // Prefer JSON-LD structured fields; fall back to regex/meta.
    const ld = structuredFromJsonLd(combinedHtml);

    const cleanText = cleanHtmlText(home.html).slice(0, 6000);

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
      pagesScanned: number;
      renderedWithHeadless?: boolean;
      message?: string;
      error?: string;
    } = {
      ok: true,
      url,
      title,
      description: metaDesc || cleanText.slice(0, 300),
      emails: firstEmails,
      phones: firstPhones,
      stockLinks: firstStockLinks,
      fetchedAt: new Date().toISOString(),
      pagesScanned: fetched.filter((f) => f.ok).length,
      renderedWithHeadless: usedHeadless,
    };

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      base.structured = ld
        ? { name: ld.name, location: ld.location, brands: [], inventoryEstimate: null, keyProducts: [] }
        : null;
      base.message = "Add DEEPSEEK_API_KEY for enhanced structured extraction.";
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
      const socketId: string | undefined = typeof req.body?.socketId === "string" ? req.body.socketId : undefined;
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
      let done = 0;
      const total = urls.length;

      const emit = (payload: Record<string, unknown>) => {
        if (socketId) {
          io.to(socketId).emit("scrape:progress", payload);
        }
      };

      const worker = async () => {
        while (cursor < urls.length) {
          const url = urls[cursor++];
          try {
            const r = await scrapeWebsite(url, { crawl: true, onPage: (page) => emit({ event: "page", url, page, done, total }) });
            results.push({ url, ok: r.ok, error: r.ok ? undefined : r.error, ...(r.ok ? r : {}) });
          } catch (e: any) {
            results.push({
              url,
              ok: false,
              error: e?.name === "AbortError" ? "Timed out" : e?.message || "Failed",
            });
          }
          done++;
          const last = results[results.length - 1];
          emit({ event: "done", url, ok: last.ok, error: last.error, done, total });
        }
      };

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      if (socketId) {
        io.to(socketId).emit("scrape:complete", { total, succeeded: results.filter((r) => r.ok).length });
      }

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
