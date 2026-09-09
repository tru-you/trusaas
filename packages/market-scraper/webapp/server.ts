/**
 * Market Value webapp — public API + frontend for the valuation engine.
 *
 *   GET  /api/markets          -> [{ id, label }]
 *   POST /api/valuation        -> ValuationResult  ({ make, model, year, mileage?, market?, location? })
 *   GET  /                     -> the frontend page
 *
 * Keys are env-driven (each instance sets its own):
 *   BRIGHTDATA_API_KEY  +  SCRAPER_UNLOCKER_ENABLED=1   → unblocks US/UK/other anti-bot sites
 *   SERP_API_KEY / SERP_PROVIDER / SERP_ZONE            → Google SERP fallback tier
 *   SCRAPER_SERVICE_URLS                                → headless render workers
 *   PORT (default 4300)
 *
 * Public by design: no auth, CORS open, per-IP throttle. The paid Unlocker/SERP
 * tiers only engage when the owning instance has configured a key.
 */
import * as fs from "fs";
import * as path from "path";

for (const envPath of [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, ".env"),
  path.join(process.cwd(), ".env"),
]) {
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        const val = v.join("=").trim().replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {}
  }
}

import express from "express";
import { fetchValuation, markets, activeMarkets } from "../index";
import { listMakes, listModels, listVariants } from "../../tru-arbitrage/src/engine/catalogue";

const PORT = Number(process.env.PORT || 4300);
const API_KEY = process.env.API_KEY || "";

const LABELS: Record<string, string> = {
  za: "South Africa — cars",
  us: "United States — cars",
  uk: "United Kingdom — cars",
  housingZa: "South Africa — property",
};

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// CORS open — public embed-friendly.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

if (API_KEY) {
  const checkAuth = (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${API_KEY}`) return res.status(401).json({ error: "Unauthorized" });
    next();
  };
  app.use("/api/valuation", checkAuth);
  app.use("/api/fsbo", checkAuth);
  app.use("/api/agency/crawl", checkAuth);
}

// Per-IP throttle (in-memory; resets on restart — fine for a public form).
const hits = new Map<string, { n: number; ts: number }>();
const THROTTLE_WINDOW = 60_000, THROTTLE_MAX = 12;
// Prune stale entries every 5 minutes to prevent unbounded Map growth.
setInterval(() => {
  const cutoff = Date.now() - THROTTLE_WINDOW;
  for (const [ip, e] of hits) {
    if (e.ts < cutoff) hits.delete(ip);
  }
}, 5 * 60_000).unref();
function throttled(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > THROTTLE_WINDOW) { hits.set(ip, { n: 1, ts: now }); return false; }
  e.n++;
  return e.n > THROTTLE_MAX;
}

app.get("/api/markets", (_req, res) => {
  res.json(Object.keys(activeMarkets).map((id) => ({ id, label: LABELS[id] || id })));
});

app.get("/api/catalogue/makes", (req, res) => {
  try {
    res.json({ makes: listMakes("cars") });
  } catch {
    res.json({ makes: ["Toyota", "Volkswagen", "Ford", "BMW", "Mercedes-Benz", "Hyundai", "Nissan", "Audi", "Kia", "Isuzu", "Mazda", "Renault", "Suzuki", "Havill", "Chery"] });
  }
});

app.get("/api/catalogue/models", (req, res) => {
  try {
    const make = String(req.query.make || "").trim();
    if (!make) return res.status(400).json({ error: "make is required" });
    res.json({ models: listModels("cars", make) });
  } catch {
    res.json({ models: [] });
  }
});

app.get("/api/catalogue/variants", (req, res) => {
  try {
    const make = String(req.query.make || "").trim();
    const model = String(req.query.model || "").trim();
    if (!make || !model) return res.status(400).json({ error: "make and model are required" });
    res.json({ variants: listVariants("cars", make, model) });
  } catch {
    res.json({ variants: [] });
  }
});

app.post(["/api/valuation", "/valuation", "/scraper/valuation", "/api/scraper/valuation"], async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests — slow down." });
  try {
    const { make, model, variant, year, mileage, market, location } = req.body || {};
    if (!make || !model || !year) {
      return res.status(400).json({ error: "make, model, and year are required" });
    }
    const cfg = activeMarkets[market || "za"] || markets.za;
    // Housing passes location as the make hint; cars pass make directly.
    const m = cfg.id === "housingZa" ? (location || make) : make;
    const data = await fetchValuation(String(m), String(model), String(year), {
      mileage: Number(mileage) || undefined,
      variant: variant ? String(variant) : undefined,
    }, cfg);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Valuation failed" });
  }
});

app.post("/api/fsbo", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests — slow down." });
  try {
    const { suburb, city, limit } = req.body || {};
    if (!suburb) return res.status(400).json({ error: "suburb is required" });
    const { extractFsboLeads } = await import("../fsbo-extractor");
    const cleanLimit = Math.min(25, Math.max(1, Number(limit) || 8));
    const data = await extractFsboLeads(String(suburb).trim(), String(city || "").trim(), cleanLimit);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "FSBO extraction failed" });
  }
});

app.post("/api/agency/crawl", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests — slow down." });
  try {
    const { city = "Durban", industry = "plumbers", country = "za", limit = 10 } = req.body || {};
    const { crawlLegacySites } = await import("../legacy-finder/crawler");
    const data = await crawlLegacySites({
      city: String(city).trim(),
      industry: String(industry).trim(),
      country: country === "uk" ? "uk" : "za",
      maxResults: Math.min(25, Math.max(1, Number(limit) || 10)),
    });
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Legacy site crawl failed" });
  }
});

// Static frontend (index.html sits at the webapp root, same file Netlify serves).
app.use(express.static(__dirname));

const server = app.listen(PORT, () => console.log(`market value on http://localhost:${PORT}`));
process.on("SIGTERM", () => {
  console.log("[scraper] SIGTERM received, draining...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
});
