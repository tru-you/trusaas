import { EventEmitter } from 'events';
import { RawFbListing, IngestionBatchResult, ArbitrageDeal } from './types';
import { normalizeListing } from './normalizer/gemini-extractor';
import { fetchLiveMarketValuation } from './engine/valuation';
import { evaluateArbitrageOpportunity } from './engine/arbitrage';
import { db } from './storage/db';
import { dispatchDealAlerts } from './alerts/dispatcher';
import { fetchFacebookMarketplaceListings } from './ingestion/brightdata';
import { fetchAllClassifiedsNewest } from './ingestion/cars-autotrader';
import { fetchDealerWebsitesViaSerp } from './ingestion/serp';

export class ScanProgress extends EventEmitter {
  scanId: string;
  constructor(scanId: string) {
    super();
    this.scanId = scanId;
  }
}

export async function processListingBatch(
  rawListings: RawFbListing[],
  emitter?: ScanProgress
): Promise<IngestionBatchResult> {
  const CONCURRENCY = 5;
  const result: IngestionBatchResult = {
    totalRaw: rawListings.length,
    validNormalized: 0,
    filteredOut: 0,
    trackedUpdated: 0,
    arbitrageDealsFound: 0,
    staleDealsFound: 0,
    alertsDispatched: 0,
  };
  const alertedFingerprints = new Set<string>(); // dedup alerts
  let processed = 0;

  // Process one listing (the inner body of the old for-loop)
  async function processOne(raw: RawFbListing): Promise<void> {
    // 1. Normalize
    const normalized = await normalizeListing(raw);
    if (!normalized) { result.filteredOut++; return; }
    if (normalized.isDamagedOrSalvage || normalized.isWantedAd || normalized.confidence < 0.7) {
      result.filteredOut++; return;
    }
    result.validNormalized++;

    // 2. Track
    const tracked = db.upsertTrackedVehicle(normalized);
    result.trackedUpdated++;

    // 3. Valuate
    const valuation = await fetchLiveMarketValuation(
      normalized.make,
      normalized.model,
      normalized.year,
      normalized.mileageKm
    );
    if (!valuation || !valuation.averageRetailPrice) {
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'no_comps' });
      return;
    }

    // 4. Evaluate arbitrage
    const deal = evaluateArbitrageOpportunity(normalized, valuation, tracked);
    if (!deal) {
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'below_margin' });
      return;
    }

    db.saveDeal(deal);
    if (deal.dealCategory === 'stale_floorplan_distress') {
      result.staleDealsFound++;
    } else {
      result.arbitrageDealsFound++;
    }
    emitter?.emit('deal_found', deal);

    // 5. Dispatch alerts (with dedup)
    if (!alertedFingerprints.has(deal.fingerprint)) {
      alertedFingerprints.add(deal.fingerprint);
      const subs = db.getSubscriptions(true);
      const alerts = await dispatchDealAlerts(deal, subs);
      result.alertsDispatched += alerts;
    }

    processed++;
    emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'deal_found' });
  }

  // Concurrent pool: process CONCURRENCY items at a time
  const queue = [...rawListings];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        try {
          await processOne(item);
        } catch (err: any) {
          console.warn('[pipeline] Error processing listing:', err?.message || err);
          result.filteredOut++;
          processed++;
          emitter?.emit('progress', { current: processed, total: rawListings.length, status: 'error', error: err?.message });
        }
      }
    })());
  }
  await Promise.all(workers);

  // Flush DB after batch
  await db.flush();

  return result;
}

export async function runFullMultiSourceScan(emitter?: ScanProgress): Promise<IngestionBatchResult> {
  console.log('\n🌐 [TruArbitrage Multi-Source Radar] Initiating Scan across all platforms...');
  emitter?.emit('phase', { phase: 'ingestion', message: 'Fetching from Facebook Marketplace...' });

  const [fbListings, classifiedListings, serpListings] = await Promise.all([
    fetchFacebookMarketplaceListings({ useMockIfNoKey: true }).catch((err: any) => { emitter?.emit('error', { source: 'facebook', message: err?.message }); return []; }),
    fetchAllClassifiedsNewest().catch((err: any) => { emitter?.emit('error', { source: 'cars_autotrader', message: err?.message }); return []; }),
    fetchDealerWebsitesViaSerp().catch((err: any) => { emitter?.emit('error', { source: 'serp', message: err?.message }); return []; }),
  ]);

  const allRaw = [...fbListings, ...classifiedListings, ...serpListings];
  console.log(`📦 Loaded ${allRaw.length} listings (FB: ${fbListings.length}, Cars/AT: ${classifiedListings.length}, SERP Dealer Sites: ${serpListings.length})`);

  emitter?.emit('phase', { phase: 'processing', message: `Processing ${allRaw.length} listings...` });
  const result = await processListingBatch(allRaw, emitter);

  emitter?.emit('complete', result);
  return result;
}

// CLI Execution runner
async function main() {
  try {
    const metrics = await runFullMultiSourceScan();

    console.log('\n📊 [MULTI-SOURCE INGESTION METRICS SUMMARY]');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`• Total Listings Scanned:         ${metrics.totalRaw}`);
    console.log(`• Successfully Normalized:        ${metrics.validNormalized}`);
    console.log(`• Spam / Non-runner Filtered:     ${metrics.filteredOut}`);
    console.log(`• Tracked Inventory (DOM) Updated: ${metrics.trackedUpdated}`);
    console.log(`• High-Margin Arbitrage Deals:    ${metrics.arbitrageDealsFound}`);
    console.log(`• Stale Floorplan Distress Deals: ${metrics.staleDealsFound}`);
    console.log(`• Buy-Box WhatsApp Alerts Sent:   ${metrics.alertsDispatched}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const activeDeals = db.getDeals();
    if (activeDeals.length > 0) {
      console.log(`⭐ Top Arbitrage Deal: ${activeDeals[0].vehicle.year} ${activeDeals[0].vehicle.make} ${activeDeals[0].vehicle.model} [${activeDeals[0].source}] - Net Margin: R${activeDeals[0].projectedNetMargin.toLocaleString('en-ZA')}`);
    }
  } catch (err: any) {
    console.error('Fatal pipeline error:', err?.message || err);
  }
}

if (process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js')) {
  main();
}
