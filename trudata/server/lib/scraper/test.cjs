var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// engine.ts
var import_axios = __toESM(require("axios"));
var cheerio = __toESM(require("cheerio"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var CANONICAL_MAKES = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "land rover": "Land Rover",
  landrover: "Land Rover",
  "alfa romeo": "Alfa Romeo",
  alfa: "Alfa Romeo"
};
function urlMake(make) {
  return CANONICAL_MAKES[String(make).toLowerCase().trim()] || String(make);
}
var USER_AGENT = process.env.SCRAPER_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
var REQUEST_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 8e3;
var CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1e3;
var MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES) || 2;
var WORKER_URLS = (process.env.SCRAPER_SERVICE_URLS || process.env.SCRAPER_SERVICE_URL || process.env.TRUCRM_SCRAPER_URL || "").split(",").map((u) => u.trim()).filter(Boolean);
var workerIndex = 0;
var WORKER_TIMEOUT_MS = Number(process.env.SCRAPER_WORKER_TIMEOUT_MS) || 3e4;
var DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-ZA,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache"
};
var DEALER_FINAL_THRESHOLD = Math.max(3, Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20);
var MIN_HTTP_LISTINGS = Number(process.env.SCRAPER_MIN_HTTP_LISTINGS) || 8;
var CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
var SERP_TRIGGER_MAX = Math.max(0, Number(process.env.SERP_TRIGGER_MAX) || 6);
var TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 2e4;
var SERP_API_URL = process.env.SERP_API_URL || "";
var SERP_API_KEY = process.env.SERP_API_KEY || "";
var SERP_ZONE = process.env.SERP_ZONE || "serp";
var SERP_PROVIDER = (process.env.SERP_PROVIDER || (SERP_API_URL.includes("brightdata") ? "brightdata" : SERP_API_URL.includes("serpapi") ? "serpapi" : "")).toLowerCase();
var SERP_TIMEOUT_MS = Number(process.env.SERP_TIMEOUT_MS) || 12e3;
var BD_API_KEY = process.env.BRIGHTDATA_API_KEY || SERP_API_KEY;
var UNLOCKER_ZONE = process.env.UNLOCKER_ZONE || process.env.BRIGHTDATA_UNLOCKER_ZONE || "unlocker";
var UNLOCKER_ENABLED = /^(1|true|yes)$/i.test(process.env.SCRAPER_UNLOCKER_ENABLED || "");
var UNLOCKER_TIMEOUT_MS = Number(process.env.UNLOCKER_TIMEOUT_MS) || 2e4;
var UNLOCKER_MAX_PAGES = Math.max(1, Number(process.env.UNLOCKER_MAX_PAGES) || 1);
async function fetchWithRetry(url, config, retries = MAX_RETRIES) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await import_axios.default.get(url, config);
      return res.data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
function num(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var MODEL_NOISE_RE = /(?:\b\d+\.\d+\b|\b\d+\s*(?:l|lit|litre|liter|cc)\b|\b(?:sport|sports|rs|gti|gtd|tdi|tsi|tfsi|ttsi|vvti|vvt-i|dsg|dsgi|touring|tourer|premium|flagship|executive|luxury|limited|edition|baseline|active|elegance|comfort|urban|ambition|advance|adventure|4x4|4wd|automatic|auto|manual|fwd|awd|rwd|style|storage|extras)\b)/gi;
function modelCore(text) {
  const s = String(text || "").trim().toLowerCase();
  if (!s || s === "any" || s === "-") return "";
  return s.replace(/[-_]/g, " ").replace(MODEL_NOISE_RE, " ").replace(/\s+/g, " ").trim();
}
var MAKE_ALIASES = {
  vw: ["volkswagen"],
  volkswagen: ["vw"],
  "mercedes-benz": ["mercedes", "benz"],
  mercedes: ["mercedes-benz", "benz"],
  "land rover": ["landrover"],
  landrover: ["land rover"],
  "alfa romeo": ["alfa"],
  alfa: ["alfa romeo"]
};
function makeVariants(make) {
  const m = String(make).toLowerCase().trim();
  return [m, ...MAKE_ALIASES[m] || []];
}
var YEAR_TOLERANCE = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 3;
function titleMentionsVehicle(title, make, model, year, match) {
  const t = String(title || "");
  const y = parseInt(String(year), 10);
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/\b(?:19|20)\d{2}\b/);
    if (ym && Math.abs(parseInt(ym[0], 10) - y) > YEAR_TOLERANCE) return false;
  }
  const makeOk = makeVariants(make).some((kw) => new RegExp(escapeRegex(kw), "i").test(t));
  const q = modelCore(model);
  const modelOk = !q || modelCore(t).includes(q);
  const matchOk = !match || new RegExp(escapeRegex(String(match)), "i").test(t);
  return makeOk && modelOk && matchOk;
}
var CIRCUIT_BREAKER_THRESHOLD = 3;
var CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1e3;
var workerFailCount = 0;
var workerCircuitOpenUntil = 0;
async function renderViaWorker(url, maxMs) {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerCircuitOpenUntil) return null;
  const timeoutMs = Math.max(1, Math.min(WORKER_TIMEOUT_MS, maxMs ?? WORKER_TIMEOUT_MS));
  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await fetch(`${worker.replace(/\/$/, "")}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.ok && typeof body.html === "string") {
        workerFailCount = 0;
        return body.html;
      }
    } catch (err) {
      console.warn(`[scraper] headless render failed on ${worker} for ${url}:`, err?.message || err);
    }
  }
  workerFailCount++;
  if (workerFailCount >= CIRCUIT_BREAKER_THRESHOLD) {
    workerCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[scraper] circuit breaker open \u2014 skipping headless for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1e3}s`);
  }
  return null;
}
async function brightDataFetch(targetUrl, zone, country, timeoutMs) {
  if (!BD_API_KEY) return null;
  try {
    const res = await fetch(SERP_API_URL || "https://api.brightdata.com/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${BD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url: targetUrl, format: "raw", country }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
      console.warn(`[scraper] brightDataFetch HTTP ${res.status} on ${targetUrl}`);
      return null;
    }
    const text = await res.text();
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const maybe = parsed?.body ?? parsed?.html ?? parsed?.result;
        if (typeof maybe === "string" && maybe.length > 0) return maybe;
      } catch {
      }
    }
    return text;
  } catch (err) {
    console.warn("[scraper] brightDataFetch failed:", err?.message || err);
    return null;
  }
}
function unlockerConfigured() {
  return UNLOCKER_ENABLED && !!BD_API_KEY;
}
async function renderViaUnlocker(url, country, maxMs) {
  if (!unlockerConfigured()) return null;
  return brightDataFetch(url, UNLOCKER_ZONE, country, Math.max(1, Math.min(UNLOCKER_TIMEOUT_MS, maxMs ?? UNLOCKER_TIMEOUT_MS)));
}
function serpConfigured() {
  return !!SERP_API_KEY && (SERP_PROVIDER === "brightdata" || SERP_PROVIDER === "serpapi");
}
function parseSerpResults(json, make, model, year, cfg) {
  if (!json || typeof json !== "object") return [];
  const out = [];
  const consider = (title, snippet, structuredPrice) => {
    const text = `${String(title || "")} ${String(snippet || "")}`.trim();
    if (!text) return;
    if (!yearTolerant(cfg, text, make, model, year)) return;
    let price = typeof structuredPrice === "number" ? jsonPrice(structuredPrice, cfg) : null;
    if (price == null) price = priceFromText(text, cfg);
    if (price != null) out.push({ price });
  };
  const organic = json.organic_results || json.organic || [];
  for (const r of Array.isArray(organic) ? organic : []) {
    consider(r?.title, r?.snippet ?? r?.description ?? r?.desc);
  }
  const shopping = json.shopping_results || json.shopping || [];
  for (const r of Array.isArray(shopping) ? shopping : []) {
    consider(r?.title, r?.snippet ?? r?.description, r?.extracted_price ?? r?.price);
  }
  const seen = /* @__PURE__ */ new Set();
  return out.filter((l) => seen.has(l.price) ? false : (seen.add(l.price), true));
}
async function fetchSerpListings(make, model, year, cfg) {
  if (!serpConfigured()) return [];
  const q = `${year} ${make} ${model} for sale ${cfg.googleQuerySuffix} price`;
  try {
    let json = null;
    if (SERP_PROVIDER === "brightdata") {
      const googleUrl = `https://${cfg.googleDomain}/search?q=${encodeURIComponent(q)}&${cfg.googleGl}&num=20&brd_json=1`;
      const res = await fetch(SERP_API_URL || "https://api.brightdata.com/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${SERP_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ zone: SERP_ZONE, url: googleUrl, format: "raw" }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS)
      });
      if (!res.ok) return [];
      const body = await res.text();
      try {
        json = JSON.parse(body);
      } catch {
        return [];
      }
    } else {
      const base = SERP_API_URL || "https://serpapi.com/search.json";
      const url = `${base}?engine=google&google_domain=${cfg.googleDomain}&${cfg.googleGl}&num=20&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(SERP_API_KEY)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
      if (!res.ok) return [];
      json = await res.json();
    }
    return parseSerpResults(json, make, model, year, cfg);
  } catch (err) {
    console.warn("[scraper] SERP layer failed:", err?.message || err);
    return [];
  }
}
function priceScanRe(cfg) {
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?(\\d{1,3}(?:[ ,]\\d{3})+|\\d{5,7})`, "g");
}
function priceReg(cfg) {
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?((?:\\d{1,3}(?:[ ,]\\d{3})*)|\\d{6,7})`);
}
function priceFromText(text, cfg) {
  const m = String(text).match(priceReg(cfg));
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
  return val >= cfg.minPrice && val <= cfg.maxPrice ? val : null;
}
function jsonPrice(v, cfg) {
  let n;
  if (typeof v === "number") n = v;
  else n = parseFloat(String(v ?? "").replace(/[^\d.,]/g, ""));
  return Number.isFinite(n) && n >= cfg.minPrice && n <= cfg.maxPrice ? Math.round(n) : null;
}
function extractPricesFromText(text, cfg) {
  const prices = [];
  const re = priceScanRe(cfg);
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
    if (val >= cfg.minPrice && val <= cfg.maxPrice) prices.push(val);
  }
  return prices;
}
function extractPrices(html, selectors, cfg) {
  const $ = cheerio.load(html);
  const prices = [];
  for (const sel of selectors) {
    $(sel.trim()).each((_, el) => {
      const val = parseInt($(el).text().replace(/[^\d]/g, ""), 10);
      if (val >= cfg.minPrice && val <= cfg.maxPrice) prices.push(val);
    });
  }
  if (prices.length === 0) return extractPricesFromText($.text(), cfg);
  return prices;
}
function extractJsonLd(html, cfg) {
  const $ = cheerio.load(html);
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of jsonLdNodes(parsed)) {
      const types = [].concat(node["@type"] || []);
      const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
      if (!types.some((t) => VEHICLE_TYPE_RE.test(String(t))) && !offer) continue;
      const price = num(offer?.price ?? offer?.lowPrice ?? node.price);
      if (price == null || price < cfg.minPrice || price > cfg.maxPrice) continue;
      const odo = node.mileageFromOdometer;
      const km = num(odo && typeof odo === "object" ? odo.value : odo);
      out.push({
        price: Math.round(price),
        km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0
      });
    }
  });
  return out;
}
function jsonLdNodes(root) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    out.push(n);
    if (Array.isArray(n["@graph"])) n["@graph"].forEach(visit);
  };
  visit(root);
  return out;
}
var VEHICLE_TYPE_RE = /car|vehicle|motorcycle|product/i;
function yearTolerant(cfg, title, make, model, year, match) {
  const fn = cfg.titleMatch || titleMentionsVehicle;
  return fn(title, make, model, year, match);
}
function extractNextDataListings(html, make, model, year, cfg) {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").contents().text() || $("#__NEXT_DATA__").text();
  if (!raw) return [];
  let root;
  try {
    root = JSON.parse(raw);
  } catch {
    return [];
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = (n) => {
    if (n == null) return;
    if (typeof n === "string") {
      const s = n.trim();
      if ((s[0] === "{" || s[0] === "[") && s.includes('"price"')) {
        try {
          visit(JSON.parse(s));
        } catch {
        }
      }
      return;
    }
    if (typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    const price = typeof n.price === "number" ? n.price : null;
    if (price != null && price >= cfg.minPrice && price <= cfg.maxPrice && (n.make || n.model || n.title)) {
      const title = String(n.title || `${n.year ?? ""} ${n.make ?? ""} ${n.model ?? ""}`);
      if (yearTolerant(cfg, title, make, model, year)) {
        const key = `${n.reference ?? n.id ?? ""}|${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          const km = num(n.mileage ?? n.km ?? n.odometer);
          out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0 });
        }
      }
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  return out;
}
function adjustForMileage(listings, targetKm) {
  const raw = listings.map((l) => l.price);
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) return raw;
  const withKm = listings.filter((l) => typeof l.km === "number");
  if (withKm.length < 3) return raw;
  const mx = withKm.reduce((s, l) => s + l.km, 0) / withKm.length;
  const my = withKm.reduce((s, l) => s + l.price, 0) / withKm.length;
  let numr = 0, den = 0;
  for (const l of withKm) {
    numr += (l.km - mx) * (l.price - my);
    den += (l.km - mx) ** 2;
  }
  let slope = den ? numr / den : 0;
  const medPrice = median(withKm.map((l) => l.price)) ?? my;
  const defaultSlope = -(medPrice * 0.03) / 2e4;
  if (!(slope < -0.2 && slope > -3)) slope = defaultSlope;
  return listings.map((l) => {
    if (typeof l.km !== "number") return l.price;
    const adj = l.price + slope * (targetKm - l.km);
    return Math.round(Math.min(l.price * 1.2, Math.max(l.price * 0.8, adj)));
  });
}
function iqrFilter(prices) {
  if (prices.length < 4) return prices;
  const s = [...prices].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const filtered = s.filter((v) => v >= lo && v <= hi);
  return filtered.length >= 2 ? filtered : s;
}
function robustAverage(prices) {
  if (!prices.length) return null;
  const s = iqrFilter(prices);
  if (s.length <= 12) {
    const mid = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
  }
  const trim = Math.max(1, Math.floor(s.length * 0.1));
  const core = s.slice(trim, s.length - trim);
  return Math.round(core.reduce((a, b) => a + b, 0) / core.length);
}
function expandDealerUrl(source, make, model, year, page = 1) {
  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
  const y = String(year);
  const base = source.url.replace(/\{make\}/g, m).replace(/\{model\}/g, mo).replace(/\{year\}/g, y);
  if (page <= 1) return base;
  const param = source.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}
function loadDealerSources(cfg) {
  try {
    const p = cfg?.priceSourcesPath || process.env.PRICE_SOURCES_PATH || import_path.default.join(process.cwd(), "data", "price-sources.json");
    if (!import_fs.default.existsSync(p)) return [];
    const raw = import_fs.default.readFileSync(p, "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.dealers) ? parsed.dealers : [];
    return list.filter((d) => d && d.enabled !== false).filter((d) => d && typeof d.url === "string" && /^https?:\/\//i.test(d.url)).map((d) => ({
      name: String(d.name || d.url),
      url: d.url,
      match: typeof d.match === "string" ? d.match : void 0,
      cardSelector: typeof d.cardSelector === "string" ? d.cardSelector : void 0,
      enabled: d.enabled !== false,
      pages: typeof d.pages === "number" && d.pages >= 1 ? Math.round(d.pages) : void 0,
      pageParam: typeof d.pageParam === "string" ? d.pageParam : void 0,
      json: d.json && typeof d.json === "object" && typeof d.json.url === "string" ? d.json : void 0
    }));
  } catch (err) {
    console.warn("[scraper] could not read dealer price sources:", err?.message || err);
    return [];
  }
}
function extractDealerPrices(html, source, make, model, year, cfg) {
  const $ = cheerio.load(html);
  const prices = [];
  const cardSelector = source.cardSelector || 'article, .vehicle, .stock-item, .listing, [class*="card"], [class*="vehicle"]';
  $(cardSelector).each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text() || $el.text();
    if (!titleMentionsVehicle(title, make, model, year, source.match)) return;
    const val = priceFromText($el.text(), cfg);
    if (val !== null) prices.push(val);
  });
  return prices;
}
function jsonListingArray(body, cfg) {
  if (Array.isArray(body)) return body;
  let node = body;
  for (const key of (cfg.resultsPath || "results").split(".").filter(Boolean)) {
    if (node == null) return [];
    node = node[key];
  }
  return Array.isArray(node) ? node : [];
}
async function fetchJsonDealerPrices(source, make, model, year, cfg) {
  const jcfg = source.json;
  const url = new URL(jcfg.url);
  for (const [k, rawV] of Object.entries(jcfg.params || {})) {
    const v = rawV.replace(/\{make\}/g, urlMake(make)).replace(/\{model\}/g, String(model)).replace(/\{year\}/g, String(year));
    url.searchParams.set(k, v);
  }
  const headers = {
    ...DEFAULT_HEADERS,
    "Accept-Language": cfg.acceptLanguage,
    Accept: "application/json"
  };
  if (jcfg.auth) {
    const aRes = await fetchWithRetry(jcfg.auth.url, { timeout: REQUEST_TIMEOUT, headers });
    const aBody = typeof aRes === "string" ? JSON.parse(aRes) : aRes;
    let tok = aBody;
    for (const k of (jcfg.auth.tokenPath || "Data.AuthToken").split(".").filter(Boolean)) {
      tok = tok?.[k];
    }
    if (typeof tok === "string" && tok) headers[jcfg.auth.tokenHeader || "Authorization-Token"] = tok;
    for (const [k, v] of Object.entries(jcfg.auth.headers || {})) headers[k] = v;
  }
  const res = await fetchWithRetry(url.toString(), { timeout: REQUEST_TIMEOUT, headers });
  const body = typeof res === "string" ? JSON.parse(res) : res;
  const items = jsonListingArray(body, jcfg);
  const listings = [];
  for (const item of items) {
    const itemMake = String(item[jcfg.makeField || "make"] ?? "").toLowerCase();
    const itemModel = String(item[jcfg.modelField || "model"] ?? "").toLowerCase();
    const itemTitle = String(item[jcfg.titleField || "title"] ?? "").toLowerCase();
    const itemYear = Number(item[jcfg.yearField || "year"] ?? NaN);
    const makeOk = makeVariants(make).some((kw) => itemMake.includes(kw));
    const q = modelCore(String(model));
    const modelOk = !q || modelCore(itemModel).includes(q) || modelCore(itemTitle).includes(q);
    const qYear = parseInt(year, 10);
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= YEAR_TOLERANCE;
    if (!makeOk || !modelOk || !yearOk) continue;
    const val = jsonPrice(item[jcfg.priceField || "price"], cfg);
    if (val === null) continue;
    const kmRaw = jcfg.kmField ? item[jcfg.kmField] : item.mileage ?? item.km ?? item.odometer;
    const km = num(kmRaw);
    listings.push({ price: val, km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0 });
  }
  const seen = /* @__PURE__ */ new Set();
  return listings.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
async function fetchPageForParsing(url, cfg) {
  const c = cfg || { id: "za", country: "za", acceptLanguage: "en-ZA,en;q=0.9" };
  const rendered = await renderViaWorker(url);
  if (rendered) return rendered;
  const unlocked = await renderViaUnlocker(url, c.country);
  if (unlocked) return unlocked;
  try {
    return await fetchWithRetry(url, {
      timeout: REQUEST_TIMEOUT,
      headers: { ...DEFAULT_HEADERS, "Accept-Language": c.acceptLanguage }
    });
  } catch (err) {
    console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
    return null;
  }
}
function buildSourcesFor(cfg) {
  return cfg.classifieds.map((s) => ({
    ...s,
    fetchConfig: { ...s.fetchConfig, headers: { ...DEFAULT_HEADERS, "Accept-Language": cfg.acceptLanguage } }
  }));
}

// markets/sa.ts
var AUTO_SELECTORS = '[class^="e-price__"]';
var CARSSELECTORS = ".vehicle-price";
var sa = {
  id: "za",
  currency: "R",
  country: "za",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "South Africa",
  minPrice: 1e4,
  maxPrice: 5e7,
  acceptLanguage: "en-ZA,en;q=0.9",
  classifieds: [
    {
      name: "AutoTrader",
      url: (make, model, year) => `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&year=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_AUTOTRADER_SELECTORS || AUTO_SELECTORS).split(",")
    },
    {
      name: "Cars.co.za",
      url: (make, model, year) => `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_CARSCOZA_SELECTORS || CARSSELECTORS).split(",")
    }
  ],
  searchUrl: (make, model, year) => `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&year=${year}`,
  secondaryUrl: (make, model, year) => `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
  secondarySourceName: "Cars.co.za"
};

// markets/us.ts
var us = {
  id: "us",
  currency: "$",
  country: "us",
  googleDomain: "google.com",
  googleGl: "gl=us&hl=en",
  googleQuerySuffix: "USA",
  minPrice: 1e3,
  maxPrice: 3e6,
  acceptLanguage: "en-US,en;q=0.9",
  classifieds: [
    {
      name: "Autotrader.com",
      url: (make, model, year) => `https://www.autotrader.com/cars-for-sale/${encodeURIComponent(make)}-${encodeURIComponent(model)}-${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(",")
    },
    {
      name: "Cars.com",
      url: (make, model, year) => `https://www.cars.com/shopping/results/?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year_purchase=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [data-testid="price"]'.split(",")
    }
  ],
  searchUrl: (make, model, year) => `https://www.autotrader.com/cars-for-sale/${encodeURIComponent(make)}-${encodeURIComponent(model)}-${year}`
};

// markets/uk.ts
var uk = {
  id: "uk",
  currency: "\xA3",
  country: "gb",
  googleDomain: "google.co.uk",
  googleGl: "gl=uk&hl=en",
  googleQuerySuffix: "United Kingdom",
  minPrice: 1e3,
  maxPrice: 3e6,
  acceptLanguage: "en-GB,en;q=0.9",
  classifieds: [
    {
      name: "AutoTrader UK",
      url: (make, model, year) => `https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${year}&year-to=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(",")
    },
    {
      name: "Parkers",
      url: (make, model, year) => `https://www.parkers.co.uk/cars-for-sale/${encodeURIComponent(make)}/${encodeURIComponent(model)}/?year=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="listing-price"]'.split(",")
    }
  ],
  searchUrl: (make, model, year) => `https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${year}&year-to=${year}`
};

// markets/housing.ts
function propertyTitleMatch(title, make, model, _year) {
  const t = String(title || "").toLowerCase();
  const q = [make, model].filter(Boolean).map((s) => String(s).toLowerCase().trim());
  if (q.length && !q.every((term) => t.includes(term))) return false;
  return /\b\d{1,4}\b/.test(t) || /(apartment|flat|house|villa|townhouse|unit|sectional|plot|stand)/.test(t);
}
var housingZa = {
  id: "housing-za",
  currency: "R",
  country: "za",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "property for sale",
  minPrice: 3e5,
  maxPrice: 2e8,
  acceptLanguage: "en-ZA,en;q=0.9",
  titleMatch: propertyTitleMatch,
  classifieds: [
    {
      name: "Private Property",
      url: (make, model, year) => `https://www.privateproperty.co.za/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}?from=${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(",")
    },
    {
      name: "Property24",
      url: (make, model, year) => `https://www.property24.com/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}/${year}`,
      fetchConfig: {},
      selectors: '[class*="price"], [class*="Price"]'.split(",")
    }
  ],
  searchUrl: (make, model, year) => `https://www.property24.com/for-sale/${encodeURIComponent(model || "all")}/${encodeURIComponent(make || "")}/${year}`
};

// index.ts
var markets = { sa, us, uk, housingZa };
var DEFAULT_MARKET = sa;
var CACHE_TTL_MS2 = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1e3;
var TOTAL_BUDGET_MS2 = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 2e4;
var MIN_DEALER_LISTINGS = Number(process.env.SCRAPER_MIN_DEALER_LISTINGS) || 3;
var DEALER_FINAL_THRESHOLD2 = Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20;
var CLASSIFIEDS_PAGES2 = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
var SERP_TRIGGER_MAX2 = Number(process.env.SERP_TRIGGER_MAX) || 6;
var cache = /* @__PURE__ */ new Map();
function cacheKey(marketId, make, model, year, vin, dealerSlug) {
  return `${marketId}|${(dealerSlug || "default").toLowerCase()}|${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || "novin").toUpperCase()}`;
}
function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS2) {
    cache.delete(key);
    return null;
  }
  return e.data;
}
function cachePut(key, data) {
  cache.set(key, { data, ts: Date.now() });
}
async function mapPool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}
function pageUrl(src, make, model, year, page) {
  const base = src.url(make, model, year);
  if (page <= 1) return base;
  const param = src.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}
function classifiedParser(cfg, make, model, year) {
  return (html, selectors) => {
    const nd = extractNextDataListings(html, make, model, year, cfg);
    if (nd.length) return nd;
    return htmlToAnyListings(html, selectors, cfg);
  };
}
function htmlToAnyListings(html, selectors, cfg) {
  const jl = extractJsonLd(html, cfg);
  if (jl.length) return jl;
  return extractPrices(html, selectors, cfg).map((price) => ({ price }));
}
async function fetchValuation(make, model, year, opts = {}, market = DEFAULT_MARKET) {
  const cfg = market;
  const baseModel = modelCore(model);
  const key = cacheKey(cfg.id, make, baseModel, year, opts.vin, opts.dealerSlug);
  const cached = cacheGet(key);
  if (cached) return cached;
  const y = String(year);
  const deadline = Date.now() + TOTAL_BUDGET_MS2;
  const budgetLeft = () => deadline - Date.now();
  const dealers = loadDealerSources(cfg);
  const jsonDealers = dealers.filter((d) => !!d.json);
  const htmlDealers = dealers.filter((d) => !d.json);
  const collect = async (d) => {
    try {
      const listings = d.json ? await fetchJsonDealerPrices(d, make, baseModel, y, cfg) : await (async () => {
        const pages = Math.max(1, d.pages ?? 2);
        const found = [];
        for (let p = 1; p <= pages; p++) {
          if (budgetLeft() <= 0) break;
          const url = expandDealerUrl(d, make, baseModel, y, p);
          let html = null;
          let prices2 = [];
          try {
            html = await fetchPageForParsing(url, cfg);
          } catch (err) {
            console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
          }
          if (html) prices2 = extractDealerPrices(html, d, make, baseModel, y, cfg);
          if (prices2.length === 0) break;
          found.push(...prices2);
        }
        return [...new Set(found)].map((price) => ({ price }));
      })();
      const prices = listings.map((l) => l.price);
      return {
        name: `Dealer \xB7 ${d.name}`,
        count: prices.length,
        avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
        listings
      };
    } catch (err) {
      console.warn(`[scraper] dealer ${d.name} failed:`, err?.message || err);
      return { name: `Dealer \xB7 ${d.name}`, count: 0, avg: null, listings: [] };
    }
  };
  const jsonResults = await Promise.all(jsonDealers.map(collect));
  const jsonListings = jsonResults.flatMap((r) => r.listings);
  let htmlResults = [];
  if (jsonListings.length < MIN_DEALER_LISTINGS && htmlDealers.length) {
    htmlResults = await mapPool(htmlDealers, 2, collect);
  }
  const dealerResults = [...jsonResults, ...htmlResults];
  const dealerListings = dealerResults.flatMap((r) => r.listings);
  const dealerSources = dealerResults.map(({ name, count, avg }) => ({ name, count, avg }));
  const targetKm = Number(opts.mileage);
  const kmOf = (ls) => median(ls.map((l) => l.km).filter((k) => typeof k === "number"));
  if (dealerListings.length >= DEALER_FINAL_THRESHOLD2) {
    const adjusted = adjustForMileage(dealerListings, targetKm);
    const data2 = {
      averageRetailPrice: robustAverage(adjusted),
      listingsFound: adjusted.length,
      fallbackRequired: false,
      sources: dealerSources,
      mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && dealerListings.some((l) => typeof l.km === "number"),
      sampleMedianKm: kmOf(dealerListings)
    };
    cachePut(key, data2);
    return data2;
  }
  const sources = buildSourcesFor(cfg);
  const parse = classifiedParser(cfg, make, baseModel, y);
  const perSource = await Promise.all(
    sources.map(async (src) => {
      const acc = [];
      for (let p = 1; p <= CLASSIFIEDS_PAGES2; p++) {
        if (budgetLeft() <= 0) break;
        const url = pageUrl(src, make, baseModel, y, p);
        let listings = [];
        try {
          const html = await fetchPageForParsing(url, cfg);
          if (html) listings = parse(html, src.selectors);
        } catch (err) {
          console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
        }
        if (listings.length === 0) break;
        acc.push(...listings);
      }
      const seen = /* @__PURE__ */ new Set();
      const deduped = acc.filter((l) => {
        const k = `${l.price}|${l.km ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { name: src.name, listings: deduped };
    })
  );
  const classifiedListings = [];
  const sourcesOutput = [];
  for (const { name, listings } of perSource) {
    classifiedListings.push(...listings);
    const prices = listings.map((l) => l.price);
    sourcesOutput.push({ name, count: prices.length, avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null });
  }
  let serpListings = [];
  if (dealerListings.length + classifiedListings.length < SERP_TRIGGER_MAX2 && serpConfigured()) {
    serpListings = await fetchSerpListings(make, baseModel, y, cfg);
    if (serpListings.length) {
      sourcesOutput.push({ name: "Google (SERP)", count: serpListings.length, avg: Math.round(serpListings.reduce((s, l) => s + l.price, 0) / serpListings.length) });
    }
  }
  const combined = [...dealerListings, ...classifiedListings, ...serpListings];
  const crossSeen = /* @__PURE__ */ new Set();
  const allListings = combined.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}`;
    if (crossSeen.has(k)) return false;
    crossSeen.add(k);
    return true;
  });
  const finalSources = [...dealerSources, ...sourcesOutput];
  const searchUrl = cfg.searchUrl(make, baseModel, y);
  const carsUrl = cfg.secondarySourceName && sources.some((s) => s.name === cfg.secondarySourceName) ? cfg.secondaryUrl?.(make, baseModel, y) : void 0;
  if (allListings.length === 0) {
    const data2 = { averageRetailPrice: null, listingsFound: 0, fallbackRequired: true, searchUrl, carsUrl, sources: finalSources, mileageAdjusted: false, sampleMedianKm: null };
    cachePut(key, data2);
    return data2;
  }
  const adjustedAll = adjustForMileage(allListings, targetKm);
  const data = {
    averageRetailPrice: robustAverage(adjustedAll),
    listingsFound: adjustedAll.length,
    fallbackRequired: dealerListings.length < MIN_DEALER_LISTINGS,
    searchUrl,
    carsUrl,
    sources: finalSources,
    mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && allListings.some((l) => typeof l.km === "number"),
    sampleMedianKm: kmOf(allListings)
  };
  cachePut(key, data);
  return data;
}

// scripts/test-markets.ts
var cases = [
  { label: "ZA (car)", make: "Volkswagen", model: "Golf", year: "2021", mileage: 4e4, market: markets.sa },
  { label: "US (car)", make: "Honda", model: "Civic", year: "2021", mileage: 4e4, market: markets.us },
  { label: "UK (car)", make: "Ford", model: "Fiesta", year: "2021", mileage: 4e4, market: markets.uk },
  { label: "Housing ZA", make: "Cape Town", model: "apartment", year: "2024", market: markets.housingZa }
];
async function main() {
  for (const c of cases) {
    console.log(`
=== ${c.label} ===`);
    const t0 = Date.now();
    try {
      const r = await fetchValuation(c.make, c.model, c.year, { mileage: c.mileage }, c.market);
      console.log(`time: ${((Date.now() - t0) / 1e3).toFixed(1)}s`);
      console.log(JSON.stringify({
        avg: r.averageRetailPrice,
        listings: r.listingsFound,
        fallback: r.fallbackRequired,
        searchUrl: r.searchUrl,
        carsUrl: r.carsUrl,
        sources: r.sources
      }, null, 2));
    } catch (e) {
      console.log(`time: ${((Date.now() - t0) / 1e3).toFixed(1)}s \u2014 ERROR: ${e?.message}`);
    }
  }
}
main();
