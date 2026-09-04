/**
 * Imagin8 catalogue refresh — writes data/tu-years.json (mmCode → years[]).
 *
 * TruRadar's local TU dump (data/tu-variants.json) stores only each variant's
 * LATEST registration year. The live getModels endpoint (flat-fee, unlimited —
 * this is the retainer you already pay for) returns per-variant intro/discon
 * years, which is what turns the price-check year dropdown into real ranges
 * instead of a derived window.
 *
 *   npm run catalogue:refresh
 *
 * Requires IMAGIN8_API_KEY + IMAGIN8_CUSTOMER_ID (see .env.example). Runs once
 * per make (~312 calls, tolerant of failures, polite 120ms between makes); the
 * output file is COMMITTED so prod deploys without a live run. The server never
 * calls Imagin8 at request time — it only reads the committed overlay.
 *
 * The local dump stays the single source of truth for variant rows; this script
 * only ENRICHES year ranges keyed by mmCode. Variants the live API no longer
 * returns keep their derived window.
 */

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { getModels } from '../../imagin8';
import { loadCatalogue } from '../src/engine/tu-matcher';

const apiKey = process.env.IMAGIN8_API_KEY || '';
const customerId = process.env.IMAGIN8_CUSTOMER_ID || '';

const opts = {
  apiKey,
  customerId,
  userName: process.env.IMAGIN8_USERNAME || '',
  password: process.env.IMAGIN8_PASSWORD || '',
  appName: process.env.IMAGIN8_APP_NAME || 'Flow',
  timeout: 30000,
};

// ── Output path across cwd variants (mirror resolveCataloguePath) ─────────
function outputPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'tu-years.json'),
    path.join(__dirname, '..', 'data', 'tu-years.json'),
  ];
  return candidates[0];
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const y = parseInt(String(dateStr).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

function toYearSet(intro: number | null, discon: number | null): number[] {
  const first = intro || discon;
  const last = discon || intro;
  if (!first) return [];
  const clamp = (y: number) => Math.max(1980, Math.min(new Date().getFullYear() + 1, y));
  const lo = clamp(Math.min(first, last));
  const hi = clamp(Math.max(first, last));
  const years: number[] = [];
  for (let y = lo; y <= hi; y++) years.push(y);
  return years;
}

async function main() {
  if (!apiKey || !customerId) {
    console.error('[refresh] IMAGIN8_API_KEY and IMAGIN8_CUSTOMER_ID are required (see .env.example).');
    process.exit(1);
  }

  const catalogue = loadCatalogue();
  const makes = Object.keys(catalogue);
  console.log(`[refresh] ${makes.length} makes to refresh (Imagin8 getModels, flat-fee retainer)`);

  const overlay: Record<string, number[]> = {};
  let joinedRows = 0;
  let matchedMakes = 0;
  const failedMakes: string[] = [];

  for (let i = 0; i < makes.length; i++) {
    const make = makes[i];
    const expected = catalogue[make].length;
    try {
      const rows = await getModels(make, opts);
      // Some makes (e.g. SPECIALTY) return no live rows — skip quietly.
      if (!rows.length) {
        failedMakes.push(`${make} (0 live rows)`);
        continue;
      }
      let joined = 0;
      for (const row of rows) {
        if (!row.mmCode) continue;
        const years = toYearSet(
          row.introDate ? yearOf(row.introDate) : null,
          row.disconDate ? yearOf(row.disconDate) : null
        );
        if (years.length) overlay[row.mmCode] = years;
        joined++;
      }
      matchedMakes++;
      joinedRows += joined;
      // The catalogue makes may not split cleanly per-make on live (BMW cars +
      // bikes come back under one getModels call), so coverage is by mmCode.
      console.log(`[refresh] ${String(i + 1).padStart(3)}/${makes.length} ${make} — ${joined} rows`);
    } catch (err: any) {
      failedMakes.push(make);
      console.warn(`[refresh] ${make} FAILED: ${err?.message || err}`);
    }

    // Polite pacing — flat-fee but don't hammer the channel.
    await new Promise((r) => setTimeout(r, 120));
  }

  const out = outputPath();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(overlay, null, 1));

  const totalCodes = Object.keys(overlay).length;
  const expectedTotal = makes.reduce((a, m) => a + catalogue[m].length, 0);
  const coverage = expectedTotal ? Math.round((totalCodes / expectedTotal) * 10000) / 100 : 0;
  console.log(`\n[refresh] Done: ${matchedMakes}/${makes.length} makes OK, ${totalCodes} mmCodes (${coverage}% of ${expectedTotal} variants).`);
  console.log(`[refresh] Wrote ${out}`);
  if (failedMakes.length) {
    console.warn(`[refresh] Skipped/failed makes (${failedMakes.length}): ${failedMakes.slice(0, 20).join(', ')}`);
  }
  // A make that the live API no longer serves (consolidated/renumbered) is a
  // normal drift condition, not a failure — exit 0 whenever the overlay built.
  process.exit(totalCodes > 0 ? 0 : 1);
}

main();