import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { db } from './storage/db';
import { processListingBatch, runFullMultiSourceScan, ScanProgress } from './index';
import { DealerBuyBox, IngestionBatchResult } from './types';

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Serve standalone webapp frontend
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Health Check
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'TruArbitrage Engine', timestamp: new Date().toISOString() });
});


// 1. Ingestion Webhook (Push from Bright Data / External Scrapers)
app.post('/api/ingest/webhook', async (req: Request, res: Response) => {
  try {
    const rawListings = Array.isArray(req.body) ? req.body : req.body?.data || [req.body];
    if (!rawListings || rawListings.length === 0) {
      return res.status(400).json({ error: 'No listing payload provided.' });
    }

    console.log(`[webhook] Received batch of ${rawListings.length} listings.`);
    const result = await processListingBatch(rawListings);
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
  result?: IngestionBatchResult;
  error?: string;
  emitter: ScanProgress;
}
const scans = new Map<string, ScanState>();

// 2. Trigger Ingestion Run (Non-blocking — returns scanId for SSE subscription)
app.post('/api/ingest/trigger', (_req: Request, res: Response) => {
  const scanId = `scan_${Date.now()}`;
  const emitter = new ScanProgress(scanId);
  const state: ScanState = { id: scanId, status: 'running', emitter };
  scans.set(scanId, state);

  // Fire and forget — process in background
  runFullMultiSourceScan(emitter)
    .then(result => { state.status = 'complete'; state.result = result; })
    .catch(err => { state.status = 'error'; state.error = err?.message || String(err); });

  res.json({ scanId, status: 'started' });
});

// 2b. SSE endpoint — stream live scan progress events
app.get('/api/scan/:id/events', (req: Request, res: Response) => {
  const state = scans.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Scan not found' });

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
app.get('/api/scan/:id/status', (req: Request, res: Response) => {
  const state = scans.get(req.params.id);
  if (!state) return res.status(404).json({ error: 'Scan not found' });
  res.json({ id: state.id, status: state.status, result: state.result, error: state.error });
});

// 3. Active Arbitrage & Stale Floorplan Deals Feed
app.get('/api/deals', (req: Request, res: Response) => {
  const minMargin = req.query.minMargin ? Number(req.query.minMargin) : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const dealCategory = typeof req.query.dealCategory === 'string' ? req.query.dealCategory : undefined;

  let deals = db.getDeals({ minMargin, status });
  if (source && source !== 'ALL') {
    deals = deals.filter((d) => d.source === source);
  }
  if (dealCategory && dealCategory !== 'ALL') {
    deals = deals.filter((d) => d.dealCategory === dealCategory);
  }

  res.json({ total: deals.length, deals });
});


// 4. Tracked Inventory (Days on Market & Aging)
app.get('/api/tracked', (req: Request, res: Response) => {
  const minDom = req.query.minDom ? Number(req.query.minDom) : undefined;
  const tracked = db.getTrackedVehicles(minDom !== undefined ? { minDom } : undefined);

  res.json({ total: tracked.length, tracked });
});

// 5. Dealer Buy-Box Subscriptions Management
app.get('/api/buybox', (_req: Request, res: Response) => {
  const subscriptions = db.getSubscriptions(false);
  res.json({ subscriptions });
});

app.post('/api/buybox', (req: Request, res: Response) => {
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

  db.saveSubscription(newSub);
  return res.json({ success: true, subscription: newSub });
});

export function startServer(port = CONFIG.PORT) {
  return app.listen(port, () => {
    console.log(`🚀 [TruArbitrage SaaS Engine] Listening on port ${port}`);
  });
}

if (process.argv[1]?.includes('server')) {
  startServer();
}

export default app;

