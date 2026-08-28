/**
 * Standalone dealer registry — the source of truth for who may log in and which
 * slug their data is scoped to. A flat JSON file under DATA_DIR (same
 * persistence pattern as arbitrage-store.json). Owner-managed via the sync-key
 * admin routes in server.ts; never exposed to dealers themselves.
 *
 * Access codes are stored as sha256 hashes so a leaked registry file is not a
 * leaked credential.
 *
 * Path is injectable (tests use a throwaway file, exactly like ArbitrageDatabase).
 */
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { CONFIG } from '../config';

export interface DealerRecord {
  slug: string;
  accessCodeHash: string;
  dealerName: string;
  contactNumber: string;
  webhookUrl?: string;
  /** The dealer's own public site domain (e.g. "true-cars.co.za") — excluded
   *  from their own buy-radar SERP scans, because their stock in their radar
   *  is noise, not a market deal. */
  websiteDomain?: string;
  active: boolean;
  createdAt: string;
}

export class DealerRegistry {
  private filePath: string;
  private dealers: Record<string, DealerRecord>;

  constructor(customPath?: string) {
    const dir = customPath ? path.dirname(customPath) : CONFIG.DATA_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.filePath = customPath || path.join(dir, 'dealers.json');
    this.dealers = this.load();
  }

  private load(): Record<string, DealerRecord> {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch (err: any) {
      console.warn('[dealers] Could not load registry, starting empty:', err?.message || err);
    }
    return {};
  }

  private async flush(): Promise<void> {
    try {
      const tmp = `${this.filePath}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(this.dealers, null, 2), 'utf-8');
      await fsp.rename(tmp, this.filePath);
    } catch (err: any) {
      console.error('[dealers] Failed to flush registry:', err?.message || err);
    }
  }

  private hashAccessCode(code: string): string {
    return crypto.createHash('sha256').update(String(code)).digest('hex');
  }

  /** Constant-time verify of slug + access code. */
  public verifyDealer(slug: string, accessCode: string): DealerRecord | null {
    const rec = this.dealers[slug];
    if (!rec || !rec.active) return null;
    const given = Buffer.from(this.hashAccessCode(String(accessCode)));
    const expected = Buffer.from(rec.accessCodeHash);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    return rec;
  }

  public getDealer(slug: string): DealerRecord | null {
    return this.dealers[slug] || null;
  }

  public listDealers(): DealerRecord[] {
    return Object.values(this.dealers);
  }

  /** Create or update a dealer. A new dealer requires an accessCode; an update
   *  may omit it to keep the existing hash. */
  public async upsertDealer(input: {
    slug: string;
    accessCode?: string;
    dealerName?: string;
    contactNumber?: string;
    webhookUrl?: string;
    websiteDomain?: string;
    active?: boolean;
  }): Promise<DealerRecord> {
    const slug = String(input.slug || '').trim();
    if (!slug) throw new Error('slug is required');
    const existing = this.dealers[slug];
    const accessCodeHash = input.accessCode
      ? this.hashAccessCode(input.accessCode)
      : existing
      ? existing.accessCodeHash
      : (() => { throw new Error('accessCode is required for a new dealer'); })();

    const rec: DealerRecord = {
      slug,
      accessCodeHash,
      dealerName: input.dealerName ?? existing?.dealerName ?? slug,
      contactNumber: input.contactNumber ?? existing?.contactNumber ?? '',
      webhookUrl: input.webhookUrl !== undefined ? input.webhookUrl : existing?.webhookUrl,
      websiteDomain: input.websiteDomain !== undefined ? input.websiteDomain.toLowerCase().replace(/^www\./, '').trim() : existing?.websiteDomain,
      active: input.active !== undefined ? !!input.active : existing?.active ?? true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.dealers[slug] = rec;
    await this.flush();
    return rec;
  }

  /** Scrub hashes before anything leaves this module for the API. */
  public toPublicDealer(rec: DealerRecord) {
    const { accessCodeHash, ...rest } = rec;
    void accessCodeHash;
    return rest;
  }
}

export const dealerRegistry = new DealerRegistry();