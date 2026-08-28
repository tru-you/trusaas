import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { TrackedInventoryVehicle, ArbitrageDeal, DealerBuyBox, NormalizedVehicle } from '../types';
import { generateVehicleFingerprint, calculateUrgencyScore } from '../engine/arbitrage';
import { CONFIG } from '../config';

interface DatabaseSchema {
  trackedVehicles: Record<string, TrackedInventoryVehicle>;
  deals: Record<string, ArbitrageDeal>;
  dealerSubscriptions: Record<string, DealerBuyBox>;
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
    return {
      trackedVehicles: {},
      deals: {},
      dealerSubscriptions: this.getDefaultSubscriptions(),
    };
  }

  /** One-time cleanup of legacy/polluted state. Run on every load, idempotent. */
  private migrate(data: DatabaseSchema): DatabaseSchema {
    let changed = false;

    // A listing is "mock" if its payload obviously came from the SA mock fixtures
    // (fb_item_* / cars_item_* / at_item_* / serp_dealer_* / gumtree_* rawIds, or
    // image URLs containing "/mock"). These pollute real results and must go.
    const isMockRawId = (rawId: string) =>
      /^(fb_item_|cars_item_|at_item_|serp_dealer_|gumtree_|fb_item_golf_)/i.test(rawId || '');
    const isMockImages = (images?: string[]) => Array.isArray(images) && images.some((i) => i.includes('mock'));
    const isMockVehicle = (v: { rawId?: string; images?: string[] }) => isMockRawId(v.rawId || '') || isMockImages(v.images);

    const keptTracked: DatabaseSchema['trackedVehicles'] = {};
    for (const [k, v] of Object.entries(data.trackedVehicles || {})) {
      if (isMockVehicle(v)) { changed = true; continue; }
      keptTracked[k] = v;
    }

    // Rebuild deals: drop mock vehicles, then dedupe by fingerprint (keep newest — a
    // re-ingested car must update its deal row, never append a duplicate like the old
    // saveDeal did).
    const keptDeals: DatabaseSchema['deals'] = {};
    for (const deal of Object.values(data.deals || {})) {
      if (isMockVehicle(deal.vehicle as { rawId?: string; images?: string[] })) { changed = true; continue; }
      const key = deal.fingerprint || deal.id;
      const existing = keptDeals[key];
      if (!existing || (deal.detectedAt || '') >= (existing.detectedAt || '')) {
        keptDeals[key] = deal;
        if (existing) changed = true;
      }
    }

    if (changed) {
      const out: DatabaseSchema = {
        trackedVehicles: keptTracked,
        deals: keptDeals,
        dealerSubscriptions: data.dealerSubscriptions || this.getDefaultSubscriptions(),
      };
      this.data = out;
      this.saveSync();
      return out;
    }
    return data;
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

  private getDefaultSubscriptions(): Record<string, DealerBuyBox> {
    return {
      'sub_demo_gauteng': {
        id: 'sub_demo_gauteng',
        dealerName: 'Apex Auto Motors (Demo)',
        contactNumber: '+27821234567',
        provinces: ['Gauteng', 'Johannesburg', 'Pretoria', 'Randburg', 'Sandton', 'Centurion'],
        allowedMakes: ['Volkswagen', 'Toyota', 'Ford', 'Hyundai', 'Suzuki'],
        maxPrice: 300000,
        maxMileageKm: 160000,
        minNetMargin: 25000,
        active: true,
      },
    };
  }

  // --- Tracked Inventory Operations ---

  public upsertTrackedVehicle(vehicle: NormalizedVehicle): TrackedInventoryVehicle {
    const fingerprint = generateVehicleFingerprint(vehicle);
    const now = new Date().toISOString();
    const existing = this.data.trackedVehicles[fingerprint];

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
        firstSeenAt: now,
        lastSeenAt: now,
        daysOnMarket: 0,
        originalPrice: vehicle.askingPrice,
        currentPrice: vehicle.askingPrice,
        totalPriceDrop: 0,
        priceHistory: [{ price: vehicle.askingPrice, timestamp: now }],
        urgencyScore: 0,
        status: 'active',
      };
      this.data.trackedVehicles[fingerprint] = newRecord;
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

    const updatedRecord: TrackedInventoryVehicle = {
      ...existing,
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

    this.data.trackedVehicles[fingerprint] = updatedRecord;
    this.markDirty();
    return updatedRecord;
  }

  public getTrackedVehicle(fingerprint: string): TrackedInventoryVehicle | null {
    return this.data.trackedVehicles[fingerprint] || null;
  }

  // --- Arbitrage Deals Operations ---

  public saveDeal(deal: ArbitrageDeal): void {
    // Upsert by fingerprint: re-ingesting the same vehicle must update the existing
    // deal (fresh detection time, latest margin), never append a duplicate row.
    const key = deal.fingerprint || deal.id;
    const existing = this.data.deals[key];

    if (existing) {
      const preserved = {
        // Keep the original first-seen/detection identity for alert lifecycle.
        id: existing.id,
        detectedAt: existing.detectedAt,
        status: existing.status === 'new' ? deal.status : existing.status,
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

  public getDeals(filter?: { status?: string; minMargin?: number }): ArbitrageDeal[] {
    let list = Object.values(this.data.deals);
    if (filter?.status) {
      list = list.filter((d) => d.status === filter.status);
    }
    if (filter?.minMargin) {
      list = list.filter((d) => d.projectedNetMargin >= filter.minMargin!);
    }
    return list.sort((a, b) => b.projectedNetMargin - a.projectedNetMargin);
  }

  // --- Subscriptions / Buy-Boxes Operations ---

  public getSubscriptions(activeOnly = true): DealerBuyBox[] {
    const list = Object.values(this.data.dealerSubscriptions);
    return activeOnly ? list.filter((s) => s.active) : list;
  }

  public saveSubscription(sub: DealerBuyBox): void {
    this.data.dealerSubscriptions[sub.id] = sub;
    this.markDirty();
  }

  public clearAll(): void {
    this.data = { trackedVehicles: {}, deals: {}, dealerSubscriptions: this.getDefaultSubscriptions() };
    this.markDirty();
  }

  public getTrackedVehicles(filter?: { minDom?: number }): TrackedInventoryVehicle[] {
    let list = Object.values(this.data.trackedVehicles);
    if (filter?.minDom !== undefined) {
      list = list.filter((t) => t.daysOnMarket >= filter.minDom!);
    }
    return list;
  }
}

export const db = new ArbitrageDatabase();

process.on('beforeExit', () => db.flush());
process.on('SIGINT', () => { db.flush().then(() => process.exit(0)); });
process.on('SIGTERM', () => { db.flush().then(() => process.exit(0)); });
