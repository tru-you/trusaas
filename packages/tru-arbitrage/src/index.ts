import { RawFbListing, IngestionBatchResult, ArbitrageDeal } from './types';
import { normalizeListing } from './normalizer/gemini-extractor';
import { fetchLiveMarketValuation } from './engine/valuation';
import { evaluateArbitrageOpportunity } from './engine/arbitrage';
import { db } from './storage/db';
import { dispatchDealAlerts } from './alerts/dispatcher';
import { fetchFacebookMarketplaceListings } from './ingestion/brightdata';
import { fetchAllClassifiedsNewest } from './ingestion/cars-autotrader';
import { fetchDealerWebsitesViaSerp } from './ingestion/serp';

export async function processListingBatch(rawListings: RawFbListing[]): Promise<IngestionBatchResult> {
  const result: IngestionBatchResult = {
    totalRaw: rawListings.length,
    validNormalized: 0,
    filteredOut: 0,
    trackedUpdated: 0,
    arbitrageDealsFound: 0,
    staleDealsFound: 0,
    alertsDispatched: 0,
  };

  const subscriptions = db.getSubscriptions(true);

  for (const raw of rawListings) {
    // 1. Normalize
    const normalized = await normalizeListing(raw);
    if (!normalized) {
      result.filteredOut++;
      continue;
    }

    // 2. Filter damage / wanted ads
    if (normalized.isDamagedOrSalvage || normalized.isWantedAd) {
      result.filteredOut++;
      continue;
    }

    result.validNormalized++;

    // 3. Upsert into Tracked Inventory (Days on Market & Price Velocity)
    const tracked = db.upsertTrackedVehicle(normalized);
    result.trackedUpdated++;

    // 4. Run Live Market Valuation Benchmark
    const valuation = await fetchLiveMarketValuation(
      normalized.make,
      normalized.model,
      normalized.year,
      normalized.mileageKm
    );

    if (!valuation.averageRetailPrice) {
      // Caller decision: no live market benchmark → cannot price a dip, so we
      // cannot responsibly flag an opportunity. Log it (not silently) and skip.
      console.log(
        `[ingest] Skipping ${normalized.year} ${normalized.make} ${normalized.model} — ` +
        `no live comps (fallbackRequired=${valuation.fallbackRequired === true})`
      );
      continue;
    }

    // 5. Evaluate Arbitrage / Stale Floorplan Opportunity
    const deal = evaluateArbitrageOpportunity(normalized, valuation, tracked);
    if (!deal) {
      continue;
    }

    if (deal.dealCategory === 'stale_floorplan_distress') {
      result.staleDealsFound++;
    } else {
      result.arbitrageDealsFound++;
    }

    db.saveDeal(deal);

    // 6. Match and Dispatch Buy-Box Alerts
    const alerts = await dispatchDealAlerts(deal, subscriptions);
    result.alertsDispatched += alerts;
  }

  return result;
}

export async function runFullMultiSourceScan(): Promise<IngestionBatchResult> {
  console.log('\n🌐 [TruArbitrage Multi-Source Radar] Initiating Scan across all platforms...');

  const [fbListings, classifiedListings, serpListings] = await Promise.all([
    fetchFacebookMarketplaceListings({ useMockIfNoKey: true }).catch(() => []),
    fetchAllClassifiedsNewest().catch(() => []),
    fetchDealerWebsitesViaSerp().catch(() => []),
  ]);

  const allRaw = [...fbListings, ...classifiedListings, ...serpListings];
  console.log(`📦 Loaded ${allRaw.length} listings (FB: ${fbListings.length}, Cars/AT: ${classifiedListings.length}, SERP Dealer Sites: ${serpListings.length})`);

  return processListingBatch(allRaw);
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
