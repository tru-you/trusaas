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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function getBrowser(): Promise<any> {
  if (!headlessBrowser) {
    const { default: puppeteer } = await import("puppeteer");
    const chromiumModule: any = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default ?? chromiumModule;
    headlessBrowser = await puppeteer.launch({
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
    const html = await page.content();
    res.json({ ok: html.length >= 200, html, url });
  } catch (e: any) {
    console.warn(`[trucrm-scraper] render failed for ${url}:`, e?.message);
    // Browser may have crashed — force a relaunch on the next request.
    headlessBrowser = null;
    res.status(502).json({ ok: false, error: e?.message || "Render failed" });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

const port = Number(process.env.PORT || 10010);
app.listen(port, () => console.log(`[trucrm-scraper] listening on ${port}`));
