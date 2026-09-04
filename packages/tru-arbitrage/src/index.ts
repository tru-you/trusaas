import { EventEmitter } from 'events';
import { RawFbListing, IngestionBatchResult, ArbitrageDeal } from './types';
import { normalizeListing } from './normalizer/gemini-extractor';
import { fetchLiveMarketValuation } from './engine/valuation';
import { evaluateArbitrageOpportunity } from './engine/arbitrage';
import { matchVariant } from './engine/tu-matcher';
import { db } from './storage/db';
import { dispatchDealAlerts } from './alerts/dispatcher';
import { fetchAllClassifiedsNewest } from './ingestion/cars-autotrader';
import { fetchAllTargets } from './ingestion/targets';
import { fetchDealerWebsitesViaSerp } from './ingestion/serp';
import { dealerRegistry } from './auth/dealers';
import { loadCatalogue } from './engine/tu-matcher';
import { cacheStats } from './engine/fetch-html';
import { CONFIG } from './config';

/** Does this listing text name ANY make from the local TU catalogue?
 *  Distinguishes "the normalizer failed on a known make" from "the make is
 *  off-dictionary" in the drop funnel. Cheap: makes are uppercase keys. */
function mentionsCatalogueMake(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const makes = loadCatalogue();
  for (const mk of Object.keys(makes)) {
    if (mk.length >= 3 && lower.includes(mk.toLowerCase())) return true;
  }
  return false;
}

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
  const CONCURRENCY = 3;
  const result: IngestionBatchResult = {
    totalRaw: rawListings.length,
    validNormalized: 0,
    filteredOut: 0,
    trackedUpdated: 0,
    arbitrageDealsFound: 0,
    staleDealsFound: 0,
    alertsDispatched: 0,
    rawBySource: {},
    droppedNormalizer: 0,
    droppedDamagedWanted: 0,
    droppedMakeUnknown: 0,
    droppedNoComps: 0,
    droppedBelowConfidence: 0,
    droppedBelowMargin: 0,
    sourceHealth: [],
  };
  for (const r of rawListings) {
    const src = r.source || 'unknown';
    result.rawBySource[src] = (result.rawBySource[src] || 0) + 1;
  }
  const alertedFingerprints = new Set<string>(); // dedup alerts
  let processed = 0;

  // Process one listing (the inner body of the old for-loop)
  async function processOne(raw: RawFbListing): Promise<void> {
    // 1. Normalize
    const normalized = await normalizeListing(raw);
    if (!normalized) {
      // Funnel: known make but the normalizer choked vs off-dictionary make.
      if (mentionsCatalogueMake(`${raw.title || ''} ${raw.description || ''}`)) {
        result.droppedNormalizer++;
      } else {
        result.droppedMakeUnknown++;
      }
      result.filteredOut++;
      return;
    }
    if (normalized.isDamagedOrSalvage || normalized.isWantedAd) {
      result.droppedDamagedWanted++;
      result.filteredOut++;
      return;
    }
    if (normalized.confidence < 0.7) {
      result.droppedNormalizer++;
      result.filteredOut++;
      return;
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
      result.droppedNoComps++;
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'no_comps' });
      return;
    }

    // The radar evaluates BUY-side opportunities only — the dealer's own
    // stock is Flow's domain (Stock-needing-action panel there).
    const deal = evaluateArbitrageOpportunity(normalized, valuation, tracked);
    if (!deal) {
      // Funnel: confidence floor vs every other gate (margin / stale / sanity).
      if (valuation.confidence < CONFIG.CONFIDENCE_FLOOR) {
        result.droppedBelowConfidence++;
      } else {
        result.droppedBelowMargin++;
      }
      processed++;
      emitter?.emit('progress', { current: processed, total: rawListings.length, vehicle: `${normalized.year} ${normalized.make} ${normalized.model}`, status: 'below_margin' });
      return;
    }

    // Attach TU specs from the local variant match (no API cost)
    if (tuMatch) {
      deal.mmCode = tuMatch.mmCode;
      deal.tuSpecs = {
        cc: tuMatch.cc,
        kw: tuMatch.kw,
        fuelType: tuMatch.fuelType,
        bodyType: tuMatch.bodyType,
        axle: tuMatch.axle,
        variant: tuMatch.variant,
      };
    }

    db.saveDeal(deal, dealerSlug);
    if (deal.dealCategory === 'stale_floorplan_distress') {
      result.staleDealsFound++;
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

  // Source health — what each lane actually yielded and whether its host is in
  // a circuit-open state. An empty scan becomes diagnosable at a glance.
  const SOURCE_META: Record<string, { name: string; host: string }> = {
    autotrader: { name: 'AutoTrader', host: 'autotrader.co.za' },
    cars_co_za: { name: 'Cars.co.za', host: 'cars.co.za' },
    dealer_direct: { name: 'Dealer sites', host: '' },
  };
  const openHosts = new Set(cacheStats().hostCircuits);
  for (const [src, count] of Object.entries(result.rawBySource)) {
    const meta = SOURCE_META[src] || { name: src, host: '' };
    const hostOk = !meta.host || !openHosts.has(meta.host);
    result.sourceHealth.push({
      name: meta.name,
      listings: count,
      tier: meta.host && !hostOk ? 'circuit-open' : hostOk ? 'ok' : 'unknown',
      hostOk,
    });
  }

  // Flush DB after batch
  await db.flush();

  return result;
}

export async function runFullMultiSourceScan(dealerSlug: string, emitter?: ScanProgress): Promise<IngestionBatchResult> {
  console.log(`\n🌐 [TruArbitrage Multi-Source Radar] Initiating Scan for ${dealerSlug}...`);
  emitter?.emit('phase', { phase: 'ingestion', message: 'Fetching from classifieds, dealer SERP and Flow stock...' });

  // P7 — targeted lane: the dealer's watch targets drive make/model queries
  // (cheapest-first, paginated) so "find deals" actually searches the market
  // instead of sampling the newest 30 cars posted nationally. Without targets,
  // the lane is skipped and the scan behaves exactly as before.
  const targets = Array.from(
    new Set(
      db
        .getSubscriptions(dealerSlug, true)
        .flatMap((s) => s.watchTargets || [])
        .map((t) => String(t).trim())
        .filter(Boolean)
    )
  );

  const [classifiedListings, serpListings, targetListings] = await Promise.all([
    fetchAllClassifiedsNewest().catch((err: any) => { emitter?.emit('error', { source: 'cars_autotrader', message: err?.message }); return []; }),
    // The dealer's own site domain is excluded — their stock in their own
    // radar is noise, not a market deal.
    fetchDealerWebsitesViaSerp([dealerRegistry.getDealer(dealerSlug)?.websiteDomain || '']).catch((err: any) => { emitter?.emit('error', { source: 'serp', message: err?.message }); return []; }),
    // The dealer's own stock is not in the market scan — Flow owns that
    // surface (built-in price checker + Stock-needing-action panel). The
    // radar only surveys BUY-side market opportunities.
    targets.length
      ? fetchAllTargets(targets).catch((err: any) => { emitter?.emit('error', { source: 'targets', message: err?.message }); return []; })
      : Promise.resolve([]),
  ]);

  const allRaw = [...classifiedListings, ...serpListings, ...targetListings];
  console.log(`📦 Loaded ${allRaw.length} listings (Cars/AT: ${classifiedListings.length}, SERP Dealer Sites: ${serpListings.length}${targets.length ? `, targeted: ${targetListings.length}` : ''})`);

  emitter?.emit('phase', { phase: 'processing', message: `Processing ${allRaw.length} listings...` });
  const result = await processListingBatch(allRaw, dealerSlug, emitter);

  emitter?.emit('complete', result);
  return result;
}

/* The My-Stock-only scan is removed: the dealer's own stock is Flow's domain.
 *  Radar is decoupled from Flow (Flow has its own price checker). The radar
 *  only surfaces BUY-side market opportunities — never the dealer's own units.
 */

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
