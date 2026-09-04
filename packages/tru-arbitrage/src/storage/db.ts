import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { TrackedInventoryVehicle, ArbitrageDeal, DealerBuyBox, NormalizedVehicle } from '../types';
import { generateVehicleFingerprint, vehicleFingerprint, calculateUrgencyScore } from '../engine/arbitrage';
import { CONFIG } from '../config';

interface DatabaseSchema {
  trackedVehicles: Record<string, TrackedInventoryVehicle>;
  deals: Record<string, ArbitrageDeal>;
  dealerSubscriptions: Record<string, DealerBuyBox>;
  /* Dealer-pinned watches: `${dealerSlug}:${fingerprint}` → true. Lets a dealer
   *  pin a specific car so its price moves surface first in the watchlist. */
  watches: Record<string, true>;
  /* SERP dealer-domain discovery index — GLOBAL search infrastructure, not
   * tenant data. Deals/tracked stay slug-scoped; this just remembers which
   * independent dealer sites the discovery matrix has met so later scans can
   * deep-hit their stock. */
  discoveredDomains: Record<string, { domain: string; discoveredAt: string }>;
}

const EMPTY_SCHEMA = (): DatabaseSchema => ({
  trackedVehicles: {},
  deals: {},
  dealerSubscriptions: {},
  watches: {},
  discoveredDomains: {},
});

/* Per-dealer isolation: every record key is `${dealerSlug}:${id}`. The dealer's
 * slug rides on their JWT (evidence, not a client claim), so one yard can never
 * read another's deals, tracked stock, or buy-boxes. A demo token's slug is its
 * own unique `demo-<hex>` uid, so demo sessions are isolated from each other
 * and from every real dealer. */
function tenantKey(dealerSlug: string, id: string): string {
  return `${dealerSlug}:${id}`;
}

/** Keep the richer of two cross-source duplicates for the same vehicle. More
 *  photos wins; ties go to the most recently seen/detected row. */
function richerTracked(a: TrackedInventoryVehicle, b: TrackedInventoryVehicle): TrackedInventoryVehicle {
  const ai = Array.isArray(a.images) ? a.images.length : 0;
  const bi = Array.isArray(b.images) ? b.images.length : 0;
  if (ai !== bi) return ai > bi ? a : b;
  return (Date.parse(a.lastSeenAt || '') >= Date.parse(b.lastSeenAt || '')) ? a : b;
}

function richerDeal(a: ArbitrageDeal, b: ArbitrageDeal): ArbitrageDeal {
  const ai = Array.isArray(a.vehicle?.images) ? a.vehicle.images.length : 0;
  const bi = Array.isArray(b.vehicle?.images) ? b.vehicle.images.length : 0;
  if (ai !== bi) return ai > bi ? a : b;
  return (Date.parse(a.detectedAt || '') >= Date.parse(b.detectedAt || '')) ? a : b;
}

export class ArbitrageDatabase {
  private filePath: string;
  private data: DatabaseSchema;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(customPath?: string) {
    const dir = customPath ? path.dirname(customPath) : CONFIG.DATA_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = customPath || path.join(dir, 'arbitrage-store.json');
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        return this.migrate(parsed);
      }
    } catch (err) {
      console.warn('[db] Could not load database file, starting fresh:', err);
    }
    return EMPTY_SCHEMA();
  }

  /** One-time cleanup of legacy/polluted state. Run on every load, idempotent.
   *  1) Mock fixtures (fb_item_* / cars_item_* rawIds, "/mock" images) pollute
   *     real results and are stripped wherever they surface.
   *  2) Pre-tenant keys (no `:` separator) belong to the old flat schema — all
   *     demo/mock data from before per-dealer isolation — and are dropped.
   *  3) Deals are deduped by their (already tenant-scoped) key; a re-ingested
   *     car must update its deal row, never append a duplicate. */
  private migrate(data: DatabaseSchema): DatabaseSchema {
    let changed = false;

    const isTenantKey = (key: string) => typeof key === 'string' && key.includes(':');
    const isMockRawId = (rawId: string) =>
      /^(fb_item_|cars_item_|at_item_|serp_dealer_|gumtree_|fb_item_golf_)/i.test(rawId || '');
    const isMockImages = (images?: string[]) => Array.isArray(images) && images.some((i) => i.includes('mock'));
    const isMockVehicle = (v: { rawId?: string; images?: string[] }) => isMockRawId(v.rawId || '') || isMockImages(v.images);

    const keptTracked: DatabaseSchema['trackedVehicles'] = {};
    for (const [k, v] of Object.entries(data.trackedVehicles || {})) {
      if (!isTenantKey(k)) { changed = true; continue; }
      if (isMockVehicle(v)) { changed = true; continue; }
      // Re-key onto the cross-source fingerprint (make/model/year/km). Legacy
      // keys were salted by seller/source, so the same car across platforms
      // was several rows — collapse them, keeping the richest.
      const slug = k.slice(0, k.indexOf(':'));
      const fp = vehicleFingerprint(v.make, v.model, v.year, v.mileageKm);
      const nk = `${slug}:${fp}`;
      if (nk !== k) changed = true;
      const existing = keptTracked[nk];
      if (existing) changed = true;
      keptTracked[nk] = existing ? { ...richerTracked(existing, v), fingerprint: fp } : { ...v, fingerprint: fp };
    }

    const keptDeals: DatabaseSchema['deals'] = {};
    for (const [k, deal] of Object.entries(data.deals || {})) {
      if (!isTenantKey(k)) { changed = true; continue; }
      if (isMockVehicle(deal.vehicle as { rawId?: string; images?: string[] })) { changed = true; continue; }
      const slug = k.slice(0, k.indexOf(':'));
      const fp = vehicleFingerprint(deal.vehicle.make, deal.vehicle.model, deal.vehicle.year, deal.vehicle.mileageKm);
      const nk = `${slug}:${fp}`;
      if (nk !== k) changed = true;
      const existing = keptDeals[nk];
      if (existing) changed = true;
      keptDeals[nk] = existing ? { ...richerDeal(existing, deal), fingerprint: fp } : { ...deal, fingerprint: fp };
    }

    const keptSubs: DatabaseSchema['dealerSubscriptions'] = {};
    for (const [k, sub] of Object.entries(data.dealerSubscriptions || {})) {
      if (!isTenantKey(k)) { changed = true; continue; }
      keptSubs[k] = sub;
    }

    const keptWatches: DatabaseSchema['watches'] = {};
    for (const [k, v] of Object.entries(data.watches || {})) {
      if (!isTenantKey(k)) { changed = true; continue; }
      keptWatches[k] = v;
    }

    const out: DatabaseSchema = {
      trackedVehicles: keptTracked,
      deals: keptDeals,
      dealerSubscriptions: keptSubs,
      watches: keptWatches,
      discoveredDomains: data.discoveredDomains || {},
    };

    if (changed) {
      this.data = out;
      this.saveSync();
    }
    return out;
  }

  private saveSync(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[db] Failed to save database file:', err);
    }
  }

  private markDirty(): void {
    this.dirty = true;
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.flushToDisk().catch((err) =>
          console.error('[db] Background flush failed:', err)
        );
      }, 2000);
      // Don't keep the process alive just for a deferred write
      if (this.saveTimer && typeof this.saveTimer === 'object' && 'unref' in this.saveTimer) {
        this.saveTimer.unref();
      }
    }
  }

  private async flushToDisk(): Promise<void> {
    if (!this.dirty) return;
    try {
      const tempPath = `${this.filePath}.tmp`;
      await fsp.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      await fsp.rename(tempPath, this.filePath);
      this.dirty = false;
    } catch (err) {
      console.error('[db] Failed to flush database file:', err);
    }
  }

  public async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      await this.flushToDisk();
    }
  }

  // --- Tracked Inventory Operations (tenant-scoped) ---

  public upsertTrackedVehicle(vehicle: NormalizedVehicle, dealerSlug: string, firstSeenAtOverride?: string): TrackedInventoryVehicle {
    const fingerprint = generateVehicleFingerprint(vehicle, dealerSlug);
    const key = tenantKey(dealerSlug, fingerprint);
    const now = new Date().toISOString();
    const existing = this.data.trackedVehicles[key];

    // A structured feed's own timestamp (e.g. Flow stock updatedAt) seeds
    // firstSeenAt so days-on-market reflects real sitting time from scan one —
    // otherwise a first-ever scan reads as 0 days for every vehicle.
    const seedFirstSeen =
      firstSeenAtOverride && !isNaN(Date.parse(firstSeenAtOverride))
        ? new Date(firstSeenAtOverride).toISOString()
        : now;

    if (!existing) {
      const newRecord: TrackedInventoryVehicle = {
        fingerprint,
        rawId: vehicle.rawId,
        source: vehicle.source,
        url: vehicle.url,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        mileageKm: vehicle.mileageKm,
        location: vehicle.location,
        sellerId: vehicle.sellerId,
        sellerName: vehicle.sellerName,
        images: vehicle.images,
        firstSeenAt: seedFirstSeen,
        lastSeenAt: now,
        daysOnMarket: Math.max(0, Math.floor((Date.now() - Date.parse(seedFirstSeen)) / (1000 * 60 * 60 * 24))),
        originalPrice: vehicle.askingPrice,
        currentPrice: vehicle.askingPrice,
        totalPriceDrop: 0,
        priceHistory: [{ price: vehicle.askingPrice, timestamp: seedFirstSeen }],
        urgencyScore: 0,
        status: 'active',
      };
      this.data.trackedVehicles[key] = newRecord;
      this.markDirty();
      return newRecord;
    }

    // Existing vehicle found -> update DOM and price tracking
    const firstSeen = new Date(existing.firstSeenAt).getTime();
    const currentDate = new Date(now).getTime();
    const daysOnMarket = Math.max(0, Math.floor((currentDate - firstSeen) / (1000 * 60 * 60 * 24)));

    let priceHistory = [...existing.priceHistory];
    let totalPriceDrop = existing.totalPriceDrop;
    let status: 'active' | 'price_dropped' = existing.status === 'delisted' ? 'active' : (existing.status as any);

    if (vehicle.askingPrice !== existing.currentPrice) {
      priceHistory.push({ price: vehicle.askingPrice, timestamp: now });
      totalPriceDrop = Math.max(0, existing.originalPrice - vehicle.askingPrice);
      if (vehicle.askingPrice < existing.currentPrice) {
        status = 'price_dropped';
      }
    }

    const urgencyScore = calculateUrgencyScore(daysOnMarket, priceHistory.length, totalPriceDrop, existing.originalPrice);

    // Cross-source dedup merge: when a richer listing of the SAME car arrives
    // (more photos), upgrade the identity fields to it — otherwise the first
    // (often photo-less AutoTrader) row would win and bury the Cars.co.za photo.
    const incomingImages = Array.isArray(vehicle.images) ? vehicle.images : [];
    const upgrade = incomingImages.length > (Array.isArray(existing.images) ? existing.images.length : 0);

    const updatedRecord: TrackedInventoryVehicle = {
      ...existing,
      rawId: upgrade ? vehicle.rawId : existing.rawId,
      source: upgrade ? vehicle.source : existing.source,
      url: upgrade ? vehicle.url : existing.url,
      trim: upgrade && vehicle.trim ? vehicle.trim : existing.trim,
      images: upgrade ? vehicle.images : existing.images,
      sellerId: upgrade && vehicle.sellerId ? vehicle.sellerId : existing.sellerId,
      sellerName: upgrade && vehicle.sellerName ? vehicle.sellerName : existing.sellerName,
      lastSeenAt: now,
      daysOnMarket,
      currentPrice: vehicle.askingPrice,
      totalPriceDrop,
      priceHistory,
      urgencyScore,
      status,
      mileageKm: vehicle.mileageKm || existing.mileageKm,
      location: vehicle.location || existing.location,
    };

    this.data.trackedVehicles[key] = updatedRecord;
    this.markDirty();
    return updatedRecord;
  }

  public getTrackedVehicle(fingerprint: string, dealerSlug: string): TrackedInventoryVehicle | null {
    return this.data.trackedVehicles[tenantKey(dealerSlug, fingerprint)] || null;
  }

  public getTrackedVehicles(filter?: { dealerSlug?: string; minDom?: number; status?: string[] }): TrackedInventoryVehicle[] {
    let list = Object.entries(this.data.trackedVehicles);
    if (filter?.dealerSlug) {
      list = list.filter(([k]) => k.startsWith(`${filter.dealerSlug}:`));
    }
    let rows = list.map(([, v]) => v);
    if (filter?.minDom !== undefined) {
      rows = rows.filter((t) => t.daysOnMarket >= filter.minDom!);
    }
    if (filter?.status && filter.status.length > 0) {
      rows = rows.filter((t) => filter.status!.includes(t.status));
    }
    return rows;
  }

  // --- Arbitrage Deals Operations (tenant-scoped) ---

  public saveDeal(deal: ArbitrageDeal, dealerSlug: string): void {
    // Upsert by tenant+fingerprint: re-ingesting the same vehicle must update
    // the existing deal (fresh detection time, latest margin), never append a
    // duplicate row.
    const key = tenantKey(dealerSlug, deal.fingerprint || deal.id);
    const existing = this.data.deals[key];

    if (existing) {
      const existingImgs = Array.isArray(existing.vehicle?.images) ? existing.vehicle.images.length : 0;
      const newImgs = Array.isArray(deal.vehicle?.images) ? deal.vehicle.images.length : 0;
      const preserved = {
        // Keep the original first-seen/detection identity for alert lifecycle.
        id: existing.id,
        detectedAt: existing.detectedAt,
        status: existing.status === 'new' ? deal.status : existing.status,
        // Cross-source dedup: keep the richer vehicle (more photos) when the
        // same car re-detects from a thinner source.
        vehicle: newImgs > existingImgs ? deal.vehicle : existing.vehicle,
      };
      this.data.deals[key] = {
        ...existing,
        ...deal,
        ...preserved,
      };
    } else {
      this.data.deals[key] = deal;
    }
    this.markDirty();
  }

  public getDeals(filter?: { dealerSlug?: string; status?: string; minMargin?: number; source?: string; dealCategory?: string }): ArbitrageDeal[] {
    let entries = Object.entries(this.data.deals);
    if (filter?.dealerSlug) {
      entries = entries.filter(([k]) => k.startsWith(`${filter.dealerSlug}:`));
    }
    let list = entries.map(([, d]) => d);
    if (filter?.status) {
      list = list.filter((d) => d.status === filter.status);
    }
    if (filter?.minMargin) {
      list = list.filter((d) => d.projectedNetMargin >= filter.minMargin!);
    }
    if (filter?.source) {
      list = list.filter((d) => d.source === filter.source);
    }
    if (filter?.dealCategory) {
      list = list.filter((d) => d.dealCategory === filter.dealCategory);
    }
    return list.sort((a, b) => b.projectedNetMargin - a.projectedNetMargin);
  }

  public updateDealStatus(dealId: string, dealerSlug: string, status: ArbitrageDeal['status']): ArbitrageDeal | null {
    const prefix = `${dealerSlug}:`;
    for (const [k, d] of Object.entries(this.data.deals)) {
      if (k.startsWith(prefix) && d.id === dealId) {
        const updated = { ...d, status };
        this.data.deals[k] = updated;
        this.markDirty();
        return updated;
      }
    }
    return null;
  }

  /** Attach the seller-offer workflow to a deal (tenant-scoped). Regenerating
   *  an offer replaces the previous OTP — only the newest is valid. */
  public attachOffer(dealId: string, dealerSlug: string, offer: { offerText: string; offerOtp: string; offerOtpExpiresAt: string }): ArbitrageDeal | null {
    const prefix = `${dealerSlug}:`;
    for (const [k, d] of Object.entries(this.data.deals)) {
      if (k.startsWith(prefix) && d.id === dealId) {
        const updated: ArbitrageDeal = { ...d, ...offer, offeredAt: new Date().toISOString() };
        this.data.deals[k] = updated;
        this.markDirty();
        return updated;
      }
    }
    return null;
  }

  // --- Subscriptions / Buy-Boxes Operations (tenant-scoped) ---

  public getSubscriptions(dealerSlug: string, activeOnly = true): DealerBuyBox[] {
    const prefix = `${dealerSlug}:`;
    const list = Object.entries(this.data.dealerSubscriptions)
      .filter(([k]) => k.startsWith(prefix))
      .map(([, s]) => s);
    return activeOnly ? list.filter((s) => s.active) : list;
  }

  public saveSubscription(dealerSlug: string, sub: DealerBuyBox): void {
    this.data.dealerSubscriptions[tenantKey(dealerSlug, sub.id)] = sub;
    this.markDirty();
  }

  // --- Watches (dealer-pinned fingerprints, tenant-scoped) ---

  public getWatchedFingerprints(dealerSlug: string): string[] {
    const prefix = `${dealerSlug}:`;
    if (!this.data.watches) this.data.watches = {};
    return Object.keys(this.data.watches)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  /** Toggle a watch on a tracked fingerprint. Returns the new watched state. */
  public toggleWatch(dealerSlug: string, fingerprint: string): boolean {
    const key = tenantKey(dealerSlug, fingerprint);
    if (!this.data.watches) this.data.watches = {};
    if (this.data.watches[key]) {
      delete this.data.watches[key];
      this.markDirty();
      return false;
    }
    this.data.watches[key] = true;
    this.markDirty();
    return true;
  }

  /** Clear data. With a slug: wipes only that tenant (dealer-initiated reset).
   *  Without: wipes everything (admin maintenance). The SERP discovery index
   *  survives a tenant reset — it belongs to the market, not the dealer. */
  public clearAll(dealerSlug?: string): void {
    if (!dealerSlug) {
      this.data = EMPTY_SCHEMA();
      this.markDirty();
      return;
    }
    const prefix = `${dealerSlug}:`;
    const maps = [
      this.data.trackedVehicles || {},
      this.data.deals || {},
      this.data.dealerSubscriptions || {},
      this.data.watches || {}
    ] as Array<Record<string, unknown>>;
    for (const map of maps) {
      for (const k of Object.keys(map)) {
        if (k.startsWith(prefix)) delete map[k];
      }
    }
    this.markDirty();
  }

  // --- SERP dealer-domain discovery index (global) ---

  public recordSerpDomain(domain: string, discoveredAt: string): void {
    if (!domain) return;
    if (!this.data.discoveredDomains) this.data.discoveredDomains = {};
    if (this.data.discoveredDomains[domain]) return;
    this.data.discoveredDomains[domain] = { domain, discoveredAt };
    this.markDirty();
  }

  public getSerpDomains(): string[] {
    return Object.keys(this.data.discoveredDomains || {});
  }
}

export const db = new ArbitrageDatabase();

process.on('beforeExit', () => db.flush());
process.on('SIGINT', () => { db.flush().then(() => process.exit(0)); });
process.on('SIGTERM', () => { db.flush().then(() => process.exit(0)); });