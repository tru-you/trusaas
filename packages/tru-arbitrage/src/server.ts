import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from './config';
import { db } from './storage/db';
import { processListingBatch, runFullMultiSourceScan, runMyStockScan, ScanProgress } from './index';
import { DealerBuyBox, IngestionBatchResult } from './types';
import { signDealerToken, signDemoToken, HAS_REAL_TOKEN_SECRET } from './auth/jwt';
import { requireAuth, rateLimitAuth, requireSyncKey } from './auth/middleware';
import { dealerRegistry } from './auth/dealers';
import { formatSellerOfferTemplate } from './alerts/alert-text';
import { listMakes, listModels, titleCaseVehicle } from './engine/tu-matcher';
import { fetchLiveComps } from './engine/valuation';

const app = express();

if (!HAS_REAL_TOKEN_SECRET) {
  console.warn(
    '\n⚠️  [TruRadar] No JWT_SECRET or TRUFLOW_SYNC_KEY configured.\n' +
    '   Token signing falls back to a constant — tokens are forgeable.\n' +
    '   Set JWT_SECRET before anything real runs on this instance.\n'
  );
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve standalone webapp frontend
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health Check
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'TruRadar Engine', timestamp: new Date().toISOString() });
});

// ── Auth (standalone dealer JWT layer) ─────────────────────────────────────

// Dealer login — slug + access code from the registry (data/dealers.json).
app.post('/api/auth/login', rateLimitAuth, (req: Request, res: Response) => {
  const slug = String(req.body?.dealerSlug || '').trim();
  const code = String(req.body?.accessCode || '');
  const dealer = dealerRegistry.verifyDealer(slug, code);
  if (!dealer) {
    return res.status(401).json({ error: 'Invalid dealer slug or access code.' });
  }
  res.json({
    token: signDealerToken(slug),
    dealerSlug: slug,
    dealerName: dealer.dealerName,
    expiresInDays: 7,
  });
});

// Prospect demo — no code, isolated data (per-uid tenant), 24h TTL.
app.post('/api/auth/demo', rateLimitAuth, (_req: Request, res: Response) => {
  if (!CONFIG.DEMO_ENABLED) return res.status(404).json({ error: 'Demo is not available.' });
  const uid = 'demo-' + crypto.randomBytes(8).toString('hex');
  const token = signDemoToken(uid);
  res.json({ token, uid, demo: true, expiresInHours: 24 });
});

// ── Price check — static catalogue dropdowns + cheapest-in-country lookup ──
// Dropdowns come from the local TU catalogue (free, zero API cost); the lookup
// runs the same live comp scan the valuation engine uses, returned CHEAPEST
// FIRST with deep links where the extractor could capture one.

app.get('/api/lookup/makes', requireAuth, (_req: Request, res: Response) => {
  res.json({ makes: listMakes() });
});

app.get('/api/lookup/models', requireAuth, (req: Request, res: Response) => {
  const make = String(req.query.make || '');
  if (!make) return res.status(400).json({ error: 'make is required' });
  res.json({ models: listModels(make) });
});

app.get('/api/lookup/cheapest', requireAuth, async (req: Request, res: Response) => {
  const make = String(req.query.make || '').trim();
  const model = String(req.query.model || '').trim();
  const year = Number(req.query.year);
  if (!make || !model || !Number.isFinite(year) || year < 1990 || year > new Date().getFullYear() + 1) {
    return res.status(400).json({ error: 'make, model and a valid year are required' });
  }
  try {
    // Title-case for the classifieds search URLs — the catalogue is UPPERCASE
    // but AutoTrader/Cars.co.za match proper case more reliably.
    // skipTuBackstop: TU is the book, not live asking prices — a thin sample
    // here reports honestly instead of spending a credit on a book figure.
    const { valuation, comps } = await fetchLiveComps(titleCaseVehicle(make), titleCaseVehicle(model), year, null, undefined, undefined, undefined, { skipTuBackstop: true });

    // "Spot on" doctrine for the ranked list: a row the dealer acts on must be
    // a REAL listing, not a page fragment. css-selector comps carry neither km
    // nor a link — demote them whenever enough verified comps exist.
    const verified = comps.filter((c) => c.km || c.url);
    const ranked = verified.length >= 5 ? verified : comps;

    res.json({
      query: { make: titleCaseVehicle(make), model: titleCaseVehicle(model), year },
      market: {
        averageRetailPrice: valuation.averageRetailPrice,
        listingsFound: valuation.listingsFound,
        confidence: valuation.confidence,
        sources: valuation.sources,
      },
      comps: ranked.slice(0, 30),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Lookup failed' });
  }
});

// ── Dealer registry (owner/admin only, sync-key gated) ────────────────────

app.get('/api/dealers', requireSyncKey, (_req: Request, res: Response) => {
  res.json({ dealers: dealerRegistry.listDealers().map((d) => dealerRegistry.toPublicDealer(d)) });
});

app.put('/api/dealers/:slug', requireSyncKey, async (req: Request, res: Response) => {
  try {
    const rec = await dealerRegistry.upsertDealer({
      slug: String(req.params.slug || '').trim(),
      accessCode: req.body?.accessCode ? String(req.body.accessCode) : undefined,
      dealerName: req.body?.dealerName ? String(req.body.dealerName) : undefined,
      contactNumber: req.body?.contactNumber ? String(req.body.contactNumber) : undefined,
      webhookUrl: req.body?.webhookUrl !== undefined ? String(req.body.webhookUrl) : undefined,
      websiteDomain: req.body?.websiteDomain !== undefined ? String(req.body.websiteDomain) : undefined,
      active: req.body?.active !== undefined ? Boolean(req.body.active) : undefined,
    });
    res.json({ success: true, dealer: dealerRegistry.toPublicDealer(rec) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to save dealer.' });
  }
});


// 1. Ingestion Webhook (Push from Bright Data / External Scrapers) — scoped to the token's dealer
app.post('/api/ingest/webhook', requireAuth, async (req: Request, res: Response) => {
  try {
    const rawListings = Array.isArray(req.body) ? req.body : req.body?.data || [req.body];
    if (!rawListings || rawListings.length === 0) {
      return res.status(400).json({ error: 'No listing payload provided.' });
    }

    console.log(`[webhook] Received batch of ${rawListings.length} listings for ${req.user!.dealerSlug}.`);
    const result = await processListingBatch(rawListings, req.user!.dealerSlug);
    return res.json({ success: true, metrics: result });
  } catch (err: any) {
    console.error('[webhook] Error processing batch:', err?.message || err);
    return res.status(500).json({ error: 'Failed to process listing batch.' });
  }
});

// Scan state tracking for non-blocking pipeline + SSE
interface ScanState {
  id: string;
  status: 'running' | 'complete' | 'error';
  dealerSlug: string;
  result?: IngestionBatchResult;
  error?: string;
  emitter: ScanProgress;
}
const scans = new Map<string, ScanState>();

// 2. Trigger Ingestion Run (Non-blocking — returns scanId for SSE subscription)
app.post('/api/ingest/trigger', requireAuth, (req: Request, res: Response) => {
  const scanId = `scan_${Date.now()}`;
  const dealerSlug = req.user!.dealerSlug;
  const emitter = new ScanProgress(scanId);
  const state: ScanState = { id: scanId, status: 'running', dealerSlug, emitter };
  scans.set(scanId, state);

  // Fire and forget — process in background
  runFullMultiSourceScan(dealerSlug, emitter)
    .then(result => { state.status = 'complete'; state.result = result; })
    .catch(err => { state.status = 'error'; state.error = err?.message || String(err); });

  res.json({ scanId, status: 'started' });
});

// 2d. My-Stock-only scan — the dealer's own Flow feed, no classifieds
app.post('/api/mystock/scan', requireAuth, (req: Request, res: Response) => {
  const scanId = `scan_${Date.now()}`;
  const dealerSlug = req.user!.dealerSlug;
  const emitter = new ScanProgress(scanId);
  const state: ScanState = { id: scanId, status: 'running', dealerSlug, emitter };
  scans.set(scanId, state);

  runMyStockScan(dealerSlug, emitter)
    .then(result => { state.status = 'complete'; state.result = result; })
    .catch(err => { state.status = 'error'; state.error = err?.message || String(err); });

  res.json({ scanId, status: 'started' });
});

// 2b. SSE endpoint — stream live scan progress events
app.get('/api/scan/:id/events', requireAuth, (req: Request, res: Response) => {
  const state = scans.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Scan not found' });
  if (state.dealerSlug !== req.user!.dealerSlug) return res.status(403).json({ error: 'Not your scan' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // If already complete, send result and close
  if (state.status === 'complete') {
    send('complete', state.result);
    res.end();
    return;
  }
  if (state.status === 'error') {
    send('error', { message: state.error });
    res.end();
    return;
  }

  // Subscribe to live events
  const onPhase = (data: any) => send('phase', data);
  const onProgress = (data: any) => send('progress', data);
  const onDeal = (data: any) => send('deal_found', data);
  const onError = (data: any) => send('error', data);
  const onComplete = (data: any) => { send('complete', data); res.end(); };

  state.emitter.on('phase', onPhase);
  state.emitter.on('progress', onProgress);
  state.emitter.on('deal_found', onDeal);
  state.emitter.on('error', onError);
  state.emitter.on('complete', onComplete);

  // Cleanup on client disconnect
  req.on('close', () => {
    state.emitter.off('phase', onPhase);
    state.emitter.off('progress', onProgress);
    state.emitter.off('deal_found', onDeal);
    state.emitter.off('error', onError);
    state.emitter.off('complete', onComplete);
  });
});

// 2c. Poll fallback — check scan status without SSE
app.get('/api/scan/:id/status', requireAuth, (req: Request, res: Response) => {
  const state = scans.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Scan not found' });
  if (state.dealerSlug !== req.user!.dealerSlug) return res.status(403).json({ error: 'Not your scan' });
  res.json({ id: state.id, status: state.status, result: state.result, error: state.error });
});

// 3. Active Arbitrage & Stale Floorplan Deals Feed — scoped to the token's dealer
app.get('/api/deals', requireAuth, (req: Request, res: Response) => {
  const dealerSlug = req.user!.dealerSlug;
  const minMargin = req.query.minMargin ? Number(req.query.minMargin) : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const dealCategory = typeof req.query.dealCategory === 'string' ? req.query.dealCategory : undefined;

  const deals = db.getDeals({ dealerSlug, minMargin, status, source: source && source !== 'ALL' ? source : undefined, dealCategory: dealCategory && dealCategory !== 'ALL' ? dealCategory : undefined });

  res.json({ total: deals.length, deals });
});

// 3b. Reset — clear THIS dealer's deals + tracked vehicles
app.delete('/api/deals/reset', requireAuth, async (req: Request, res: Response) => {
  db.clearAll(req.user!.dealerSlug);
  await db.flush();
  res.json({ success: true, message: `Deals and tracked vehicles cleared for ${req.user!.dealerSlug}.` });
});

// 3c. Deal lifecycle — claim / archive (tenant-scoped)
app.put('/api/deals/:id', requireAuth, async (req: Request, res: Response) => {
  const status = String(req.body?.status || '');
  if (!['new', 'alerted', 'claimed', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'status must be one of new | alerted | claimed | archived' });
  }
  const updated = db.updateDealStatus(req.params.id, req.user!.dealerSlug, status as any);
  if (!updated) return res.status(404).json({ error: 'Deal not found' });
  await db.flush();
  res.json({ success: true, deal: updated });
});

// 3d. Make an offer on a deal — generates the offer text + a 6-digit OTP the
// seller can verify when the dealer makes contact. OTP lives 15 minutes;
// regenerating replaces the previous one (only the newest is valid).
app.post('/api/deals/:id/offer', requireAuth, async (req: Request, res: Response) => {
  const deal = db.getDeals({ dealerSlug: req.user!.dealerSlug }).find((d) => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const dealer = dealerRegistry.getDealer(req.user!.dealerSlug);
  const offerText = formatSellerOfferTemplate(deal, dealer?.dealerName || req.user!.dealerSlug);
  const otp = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const updated = db.attachOffer(deal.id, req.user!.dealerSlug, { offerText, offerOtp: otp, offerOtpExpiresAt: expiresAt });
  if (!updated) return res.status(404).json({ error: 'Deal not found' });
  res.json({ success: true, offerText, otp, expiresAt, deal: updated });
});

// 4. Tracked Inventory (Days on Market & Aging) — scoped. `status` filters by
// comma-separated tracked statuses (price_dropped | stale_floorplan | delisted | active).
app.get('/api/tracked', requireAuth, (req: Request, res: Response) => {
  const minDom = req.query.minDom ? Number(req.query.minDom) : undefined;
  const status = typeof req.query.status === 'string' && req.query.status
    ? req.query.status.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const tracked = db.getTrackedVehicles({ dealerSlug: req.user!.dealerSlug, minDom, status });

  res.json({ total: tracked.length, tracked });
});

// 4b. Watch a tracked car (dealer-pinned) — toggle + read. Pinning a car makes
// its price moves surface first in the watchlist.
app.get('/api/watched', requireAuth, (req: Request, res: Response) => {
  res.json({ watched: db.getWatchedFingerprints(req.user!.dealerSlug) });
});

app.post('/api/watched/:fingerprint', requireAuth, (req: Request, res: Response) => {
  const fingerprint = String(req.params.fingerprint || '').trim();
  if (!fingerprint) return res.status(400).json({ error: 'fingerprint is required' });
  const watched = db.toggleWatch(req.user!.dealerSlug, fingerprint);
  res.json({ success: true, watched });
});

// 5. Dealer Buy-Box Subscriptions Management — scoped
app.get('/api/buybox', requireAuth, (req: Request, res: Response) => {
  const subscriptions = db.getSubscriptions(req.user!.dealerSlug, false);
  res.json({ subscriptions });
});

app.post('/api/buybox', requireAuth, (req: Request, res: Response) => {
  const body = req.body as DealerBuyBox;
  if (!body.dealerName || !body.contactNumber) {
    return res.status(400).json({ error: 'dealerName and contactNumber are required.' });
  }

  const newSub: DealerBuyBox = {
    id: body.id || `sub_${Date.now()}`,
    dealerName: body.dealerName,
    contactNumber: body.contactNumber,
    webhookUrl: body.webhookUrl,
    provinces: body.provinces || ['Gauteng'],
    allowedMakes: body.allowedMakes,
    maxPrice: body.maxPrice || 350000,
    maxMileageKm: body.maxMileageKm || 180000,
    minNetMargin: body.minNetMargin || CONFIG.MIN_ARBITRAGE_MARGIN,
    active: body.active !== false,
  };

  db.saveSubscription(req.user!.dealerSlug, newSub);
  return res.json({ success: true, subscription: newSub });
});

export function startServer(port = CONFIG.PORT) {
  return app.listen(port, () => {
    console.log(`🚀 [TruRadar Engine] Listening on port ${port}`);

    // ── Auto-scan scheduler ──────────────────────────────────────────────
    if (CONFIG.AUTO_SCAN_ENABLED) {
      let autoScanRunning = false;
      const intervalHrs = (CONFIG.SCAN_INTERVAL_MS / 3600000).toFixed(1);
      console.log(`📡 [auto-scan] Scheduled every ${intervalHrs}h for all active dealers`);

      const runAutoScan = async () => {
        if (autoScanRunning) {
          console.log('[auto-scan] Skipping — previous scan still running');
          return;
        }
        autoScanRunning = true;
        const dealers = dealerRegistry.listDealers().filter(d => d.active);
        console.log(`[auto-scan] Starting scan for ${dealers.length} active dealer(s)`);
        for (const dealer of dealers) {
          try {
            const emitter = new ScanProgress(`auto-${dealer.slug}-${Date.now()}`);
            await runFullMultiSourceScan(dealer.slug, emitter);
            await db.flush();
            console.log(`[auto-scan] Completed: ${dealer.slug}`);
          } catch (err: any) {
            console.warn(`[auto-scan] Failed for ${dealer.slug}:`, err?.message || err);
          }
        }
        autoScanRunning = false;
        console.log('[auto-scan] Cycle complete');
      };

      setInterval(runAutoScan, CONFIG.SCAN_INTERVAL_MS);
      // Also run first scan 30s after boot (let the server warm up)
      setTimeout(runAutoScan, 30_000);
    }
  });
}

if (process.argv[1]?.includes('server')) {
  startServer();
}

export default app;
