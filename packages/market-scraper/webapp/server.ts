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
import express from "express";
import { fetchValuation, markets } from "../index";

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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
  res.json(Object.keys(markets).map((id) => ({ id, label: LABELS[id] || id })));
});

app.post("/api/valuation", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests — slow down." });
  try {
    const { make, model, year, mileage, market, location } = req.body || {};
    if (!make || !model || !year) {
      return res.status(400).json({ error: "make, model, and year are required" });
    }
    const cfg = markets[market || "za"] || markets.za;
    // Housing passes location as the make hint; cars pass make directly.
    const m = cfg.id === "housingZa" ? (location || make) : make;
    const data = await fetchValuation(String(m), String(model), String(year), {
      mileage: Number(mileage) || undefined,
    }, cfg);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Valuation failed" });
  }
});

// Static frontend (index.html sits at the webapp root, same file Netlify serves).
app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`market value on http://localhost:${PORT}`));
