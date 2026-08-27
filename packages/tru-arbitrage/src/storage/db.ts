import fs from 'fs';
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
        return JSON.parse(raw);
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

  private save(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[db] Failed to save database file:', err);
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
      this.save();
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
    this.save();
    return updatedRecord;
  }

  public getTrackedVehicle(fingerprint: string): TrackedInventoryVehicle | null {
    return this.data.trackedVehicles[fingerprint] || null;
  }

  // --- Arbitrage Deals Operations ---

  public saveDeal(deal: ArbitrageDeal): void {
    this.data.deals[deal.id] = deal;
    this.save();
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
    this.save();
  }

  public clearAll(): void {
    this.data = { trackedVehicles: {}, deals: {}, dealerSubscriptions: this.getDefaultSubscriptions() };
    this.save();
  }
}

export const db = new ArbitrageDatabase();
