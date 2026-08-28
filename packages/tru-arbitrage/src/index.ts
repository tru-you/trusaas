import { EventEmitter } from 'events';
import { RawFbListing, IngestionBatchResult, ArbitrageDeal } from './types';
import { normalizeListing } from './normalizer/gemini-extractor';
import { fetchLiveMarketValuation } from './engine/valuation';
import { evaluateArbitrageOpportunity, evaluateOverpricedStock } from './engine/arbitrage';
import { matchVariant } from './engine/tu-matcher';
import { db } from './storage/db';
import { dispatchDealAlerts } from './alerts/dispatcher';
import { fetchAllClassifiedsNewest } from './ingestion/cars-autotrader';
import { fetchDealerWebsitesViaSerp } from './ingestion/serp';
import { fetchFlowStockBySlugs } from './ingestion/flow-stock';
import { dealerRegistry } from './auth/dealers';

export class ScanProgress extends EventEmitter {
  scanId: string;
  constructor(scanId: string) {
    super();
    this.scanId = scanId;
  }
}

export async function processListingBatch(
  rawListings: RawFbListing[],
  dealerSlug: string,
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
    overpricedStockFound: 0,
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

    // 2. Resolve exact TransUnion variant (local lookup, zero API cost)
    const tuMatch = matchVariant(normalized.make, normalized.model, normalized.year, normalized.title, normalized.trim);
    if (tuMatch) {
      // Upgrade trim to the exact TU variant description for precise comp filtering
      normalized.trim = tuMatch.trim;
      console.log(`[tu-match] ${normalized.title} → ${tuMatch.variant} (${tuMatch.mmCode}, ${tuMatch.cc}cc, ${tuMatch.kw}kW, new R${tuMatch.newListPrice?.toLocaleString()}, score ${tuMatch.matchScore.toFixed(2)})`);
    }

    // 3. Track (tenant-scoped — this dealer's DOM/price history).
    // DOM seeds from the strongest date signal each source carries:
    //  - dealer_direct (Flow stock): daysInInventory — the DMS's own days-held,
    //    i.e. the real "dealer has held it long" statistic.
    //  - classifieds: the listing's own date where the source exposes one
    //    (Cars.co.za createdDate) — a seller whose ad has run long is motivated.
    //  - everything else: engine-first-seen (no date available; honest default).
    let firstSeenOverride: string | undefined = raw.date_posted;
    if (normalized.source === 'dealer_direct' && typeof raw.days_listed === 'number' && raw.days_listed >= 0) {
      firstSeenOverride = new Date(Date.now() - raw.days_listed * 86400000).toISOString();
    }
    const tracked = db.upsertTrackedVehicle(normalized, dealerSlug, firstSeenOverride);
    result.trackedUpdated++;

    // 4. Valuate (mmCode enables the surgical TU backstop when comps are thin;
    // the dealer's slug scopes the chargeable deduction to THEIR bundle)
    const valuation = await fetchLiveMarketValuation(
      normalized.make,
      normalized.model,
      normalized.year,
      normalized.mileageKm,
      normalized.trim,
      tuMatch?.mmCode,
      dealerSlug
    );

    // Sanity cap: if TU gives us a new list price, the average retail should never
    // exceed it — a used car can't be worth more than new (barring classic/collectible).
    if (tuMatch?.newListPrice && valuation?.averageRetailPrice && valuation.averageRetailPrice > tuMatch.newListPrice) {
      console.log(`[valuation-cap] Capping ${normalized.title} retail from R${valuation.averageRetailPrice.toLocaleString()} to new list R${tuMatch.newListPrice.toLocaleString()}`);
      valuation.averageRetailPrice = tuMatch.newListPrice;
    }
    if (!valuation || !valuation.averageRetailPrice) {
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'no_comps' });
      return;
    }

    // 4. Evaluate — the dealer's own stock gets the inverted gate (overpriced +
    // stale), everything else gets the buy gate (underpriced / distress).
    const isMyStock = normalized.source === 'flow_stock';
    const deal = isMyStock
      ? evaluateOverpricedStock(normalized, valuation, tracked)
      : evaluateArbitrageOpportunity(normalized, valuation, tracked);
    if (!deal) {
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: isMyStock ? 'healthy_stock' : 'below_margin' });
      return;
    }

    db.saveDeal(deal, dealerSlug);
    if (deal.dealCategory === 'stale_floorplan_distress') {
      result.staleDealsFound++;
    } else if (deal.dealCategory === 'overpriced_stale_stock') {
      result.overpricedStockFound++;
    } else {
      result.arbitrageDealsFound++;
    }
    emitter?.emit('deal_found', deal);

    // 5. Dispatch alerts (with dedup) — this dealer's active buy-boxes only
    if (!alertedFingerprints.has(deal.fingerprint)) {
      alertedFingerprints.add(deal.fingerprint);
      const subs = db.getSubscriptions(dealerSlug, true);
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

export async function runFullMultiSourceScan(dealerSlug: string, emitter?: ScanProgress): Promise<IngestionBatchResult> {
  console.log(`\n🌐 [TruArbitrage Multi-Source Radar] Initiating Scan for ${dealerSlug}...`);
  emitter?.emit('phase', { phase: 'ingestion', message: 'Fetching from classifieds, dealer SERP and Flow stock...' });

  const [classifiedListings, serpListings] = await Promise.all([
    fetchAllClassifiedsNewest().catch((err: any) => { emitter?.emit('error', { source: 'cars_autotrader', message: err?.message }); return []; }),
    // The dealer's own site domain is excluded — their stock in their own
    // radar is noise, not a market deal.
    fetchDealerWebsitesViaSerp([dealerRegistry.getDealer(dealerSlug)?.websiteDomain || '']).catch((err: any) => { emitter?.emit('error', { source: 'serp', message: err?.message }); return []; }),
    // Flow-stock lane deliberately NOT in the market scan: the dealer's own
    // stock is Flow's domain (Stock-needing-action panel there), and scanning
    // it here burns scraper calls on data the buy radar never shows. The lane
    // stays alive for the Flow bolt-on via POST /api/mystock/scan.
  ]);

  const allRaw = [...classifiedListings, ...serpListings];
  console.log(`📦 Loaded ${allRaw.length} listings (Cars/AT: ${classifiedListings.length}, SERP Dealer Sites: ${serpListings.length})`);

  emitter?.emit('phase', { phase: 'processing', message: `Processing ${allRaw.length} listings...` });
  const result = await processListingBatch(allRaw, dealerSlug, emitter);

  emitter?.emit('complete', result);
  return result;
}

/** My-Stock-only scan — the dealer's own Flow feed, no classifieds. Light and
 *  fast, so it can run on a tighter cadence than the full multi-source radar. */
export async function runMyStockScan(dealerSlug: string, emitter?: ScanProgress): Promise<IngestionBatchResult> {
  console.log(`\n📦 [TruArbitrage My-Stock Scan] Repricing ${dealerSlug}'s published stock...`);
  emitter?.emit('phase', { phase: 'ingestion', message: 'Fetching Flow stock feed...' });

  const flowStockListings = await fetchFlowStockBySlugs([dealerSlug]).catch((err: any) => {
    emitter?.emit('error', { source: 'flow_stock', message: err?.message });
    return [];
  });
  console.log(`📦 Loaded ${flowStockListings.length} vehicles from Flow stock feed`);

  emitter?.emit('phase', { phase: 'processing', message: `Processing ${flowStockListings.length} vehicles...` });
  const result = await processListingBatch(flowStockListings, dealerSlug, emitter);

  emitter?.emit('complete', result);
  return result;
}

// CLI Execution runner
async function main() {
  try {
    // CLI runs are dev/admin operations — scoped under the 'cli' tenant so they
    // never pollute a real dealer's partition. Data lands in 'cli:*' keys.
    const metrics = await runFullMultiSourceScan('cli');

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
