import express from "express";

// Dedicated headless-Chromium renderer for the TruCRM scraper. Runs as its own
// Render service (trusaas-crm-scraper) so a browser launch/render can never
// take down the CRM service: Chromium + Node together exceed a 512 MB
// Render instance, and Render restarts instances that exceed their memory.
//
// The CRM calls POST /scrape { url } and expects { ok, html, url } back.

const app = express();
app.use(express.json({ limit: "50kb" }));

let headlessBrowser: any = null;
let lastHeadlessUsedAt = 0;
const HEADLESS_IDLE_MS = 90000;

// Renders are serialized: a heavy JS site can push Chromium past ~300 MB, and
// concurrent renders on a 512 MB instance OOM the whole worker process.
let renderQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(fn, fn);
  renderQueue = run.catch(() => {});
  return run;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function getBrowser(): Promise<any> {
  // Close an idle browser so the instance doesn't sit at peak memory between
  // scrapes (Render starter = 512 MB).
  if (headlessBrowser && Date.now() - lastHeadlessUsedAt > HEADLESS_IDLE_MS) {
    headlessBrowser.close().catch(() => {});
    headlessBrowser = null;
  }
  if (!headlessBrowser) {
    const { default: puppeteer } = await import("puppeteer");
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
    ];
    try {
      // @sparticuz/chromium ships a statically-linked Chromium for Linux
      // (Render/Lambda). It has no Windows binary, so fall back to puppeteer's
      // bundled Chrome on other platforms.
      const chromiumModule: any = await import("@sparticuz/chromium");
      const chromium = chromiumModule.default ?? chromiumModule;
      headlessBrowser = await puppeteer.launch({
        headless: true,
        executablePath: await chromium.executablePath(),
        args,
      });
    } catch (e: any) {
      console.warn("[trucrm-scraper] @sparticuz/chromium unavailable, falling back to bundled Chrome:", e?.message);
      headlessBrowser = await puppeteer.launch({ headless: true, args });
    }
  }
  return headlessBrowser;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, product: "trucrm-scraper", ts: new Date().toISOString() });
});

app.post("/scrape", async (req, res) => {
  const url = String(req.body?.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Invalid URL (must start with http:// or https://)" });
  }
  try {
    const html = await serialized(async () => {
      let page: any;
      try {
        const browser = await getBrowser();
        page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1366, height: 900 });
        // domcontentloaded + fixed settle time instead of networkidle2, which
        // hangs forever on sites with long-polling / websockets.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2000));
        lastHeadlessUsedAt = Date.now();
        return await page.content();
      } catch (e: any) {
        throw e;
      } finally {
        if (page) await page.close().catch(() => {});
      }
    });
    res.json({ ok: html.length >= 200, html, url });
  } catch (e: any) {
    console.warn(`[trucrm-scraper] render failed for ${url}:`, e?.message);
    // Browser may have crashed — force a relaunch on the next request.
    headlessBrowser = null;
    res.status(502).json({ ok: false, error: e?.message || "Render failed" });
  }
});

const port = Number(process.env.PORT || 10010);
app.listen(port, () => console.log(`[trucrm-scraper] listening on ${port}`));
