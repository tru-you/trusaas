/**
 * Vertical-aware TransUnion catalogue index — TruRadar's structural upgrade.
 *
 * The raw TU dump (data/tu-variants.json) is a flat 312-make / 27,503-variant
 * list with NO category field. Dealers can't navigate it, and a flat make list
 * makes scraper queries vague. This module classifies every variant into one of
 * seven categories (cars, moto, trucks, marine, caravans, agri, specialty) using
 * deterministic rules derived from the data itself, then exposes the cascade
 * the price-check UI + scraper both consume:
 *
 *   Category → Make → Model → Variant → Year(s) (+ mmCode)
 *
 * Classification is per-VARIANT (not per-make) on purpose — BMW carries 2,614
 * car rows next to 206 motorcycle rows, so a make-level bucket would misroute
 * bikes into cars. Rule order is precedence-ordered; each is falsifiable
 * against the data (see the classifier test suite).
 *
 * The catalogue is a build-time/single-load structure — no API calls per
 * keystroke. Real per-variant production year ranges come from the optional
 * data/tu-years.json overlay (written by `npm run catalogue:refresh`, the
 * Imagin8 getModels pipeline). Without the overlay, a variant falls back to
 * its latest-registration-year window — tight, honest, and enough to drive the
 * ±1 scraper band.
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadCatalogue, TuVariant } from './tu-matcher';

export type CategoryId = 'cars' | 'moto' | 'trucks' | 'marine' | 'caravans' | 'agri' | 'specialty';

export interface CatalogueCategory {
  id: CategoryId;
  label: string;
  blurb: string;
  makeCount: number;
  modelCount: number;
}

export interface CatalogueVariant {
  mmCode: string;
  make: string;
  model: string;        // master model (v.md)
  variant: string;      // full variant (v.v)
  cc: number;
  kw: number;
  fuel: string;
  body: string;
  axle: string;
  newListPrice: number;
  latestYear: number;
  /** Real production years from tu-years.json when present; else derived window. */
  years: number[];
  category: CategoryId;
}

export const CATEGORY_IDS: CategoryId[] = ['cars', 'moto', 'trucks', 'marine', 'caravans', 'agri', 'specialty'];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  cars: 'Cars & Bakkies',
  moto: 'Motorcycles, Quads & SxS',
  trucks: 'Trucks, Buses & Vans',
  marine: 'Boats & Jetskis',
  caravans: 'Caravans & Trailers',
  agri: 'Tractors & Agri',
  specialty: 'Specialty',
};

// ── Classifier rule tables (verified against the 2026-09 data dump) ────────

/** SPECIALTY pseudo-make: model name → category. */
const SPECIALTY_MODEL_CATEGORY: Record<string, CategoryId> = {
  BICYCLE: 'specialty',
  'BOAT/JETSKI': 'marine',
  CARAVAN: 'caravans',
  GENERATOR: 'specialty',
  'GOLF CART': 'specialty',
  TRAILER: 'caravans',
  'YELLOW METAL': 'agri',
};

/** Motorcycle body codes (road + off-road + quads/SxS). */
const MOTO_BODIES = new Set(['R/D', 'O/F', 'S/S', '3/W', '4/W', '6/W', 'ATV']);
/** Motorcycle axles (2-wheel + scooter 2x1). 3-wheeler axles ride on body 3/W. */
const MOTO_AXLES = new Set(['1X1', '2X1']);

/** Tractor/agri makes — REQUIRED because agri rows carry blank body AND axle. */
const AGRI_MAKES = new Set([
  'JOHN DEERE', 'KUBOTA', 'CATERPILLAR', 'MASSEY FERGUSON', 'NEW HOLLAND',
  'AGCO ALLIS (AGROTEC)', 'BELARUS', 'CLAAS', 'LANDINI', 'VALTRA (VALMET)',
  'CASE INTERNATIONAL', 'ANGLO INTERNATIONAL',
]);

/** Commercial (truck/bus) makes — force the whole make to trucks. */
const TRUCK_MAKES = new Set([
  'SCANIA', 'IVECO', 'HINO', 'UD TRUCKS', 'TATA', 'ASHOK LEYLAND', 'SHACMAN',
  'LEYLAND', 'MACK', 'INTERNATIONAL', 'FREIGHTLINER', 'PETERBILT',
  'WESTERN STAR', 'FUSO', 'FOTON', 'GOLDEN DRAGON',
]);

/** Commercial body codes — B/S bus, D/S dropside, P/V panel van, C/C truck,
 *  T/T truck-tractor, C/M concrete mixer, TIP tipper, REF refrigerated,
 *  F/C fire, M/X mixer. */
const TRUCK_BODIES = new Set(['C/C', 'T/T', 'C/M', 'TIP', 'B/S', 'D/S', 'P/V', 'REF', 'F/C', 'M/X']);
/** Multi-axle configs — the tell-tale truck axle. */
const TRUCK_AXLES = new Set(['3X2', '6X2', '6X4', '6X6', '8X4', '8X8']);

/** Rare special bodies (mostly unique to the SPECIALTY pseudo-make). */
const MARINE_BODIES = new Set(['B/J']);
const CARAVAN_BODIES = new Set(['C/V', 'T/F', 'R/V']);
const SPECIALTY_BODIES = new Set(['G/E', 'G/C', 'B/C']);
const AGRI_BODIES = new Set(['Y/M']);

function classify(v: TuVariant): CategoryId {
  const make = String(v.mk || '').toUpperCase().trim();
  const body = String(v.b || '').toUpperCase().trim();
  const axle = String(v.ax || '').toUpperCase().trim();

  // 1. SPECIALTY pseudo-make — category is encoded in the model name.
  if (make === 'SPECIALTY') {
    return SPECIALTY_MODEL_CATEGORY[String(v.md || '').toUpperCase()] || 'specialty';
  }

  // 2. The motorcycle catch-all aggregator make.
  if (make === 'MULTIPLE MOTORCYCLE MANUFACTURERS') return 'moto';

  // 3. Moto by body/axle (catches BMW bikes beside BMW cars).
  if (MOTO_BODIES.has(body) || MOTO_AXLES.has(axle)) return 'moto';

  // 4. Agri makes — blank-body tractors can't be caught heuristically.
  if (AGRI_MAKES.has(make)) return 'agri';

  // 5. Commercial makes / bodies / axles.
  if (TRUCK_MAKES.has(make) || TRUCK_BODIES.has(body) || TRUCK_AXLES.has(axle)) return 'trucks';

  // 6. Rare special bodies (marine/caravan/specialty/agri).
  if (MARINE_BODIES.has(body)) return 'marine';
  if (CARAVAN_BODIES.has(body)) return 'caravans';
  if (SPECIALTY_BODIES.has(body)) return 'specialty';
  if (AGRI_BODIES.has(body)) return 'agri';

  // 7. Everything else is a car/bakkie — SUVs, sedans, hatches, bakkies.
  return 'cars';
}

// ── Data loading ───────────────────────────────────────────────────────────

interface IndexedMake {
  models: Map<string, CatalogueVariant[]>;
}

let index: Map<string, IndexedMake> | null = null;

function resolveYearsPath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'data', 'tu-years.json'),
    path.join(__dirname, '..', '..', 'data', 'tu-years.json'),
    path.join(process.cwd(), 'data', 'tu-years.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** mmCode → real production years[] (from the Imagin8 getModels refresh). */
function loadYearsOverlay(): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const p = resolveYearsPath();
  if (!p) return out;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    for (const [mmCode, years] of Object.entries(raw)) {
      if (Array.isArray(years) && years.length) out.set(mmCode, years.map(Number).filter(Boolean));
    }
  } catch (err: any) {
    console.warn('[catalogue] Failed to load tu-years.json overlay:', err?.message);
  }
  return out;
}

function buildIndex(): void {
  if (index) return;
  const cat = loadCatalogue();
  const yearsOverlay = loadYearsOverlay();
  const map = new Map<string, IndexedMake>();

  for (const [make, variants] of Object.entries(cat)) {
    const mkEntry: IndexedMake = { models: new Map() };
    map.set(make, mkEntry);
    for (const v of variants) {
      const category = classify(v);
      const modelKey = String(v.md || '').trim() || String(v.v || '').trim();
      if (!modelKey) continue;
      let list = mkEntry.models.get(modelKey);
      if (!list) {
        list = [];
        mkEntry.models.set(modelKey, list);
      }
      list.push({
        mmCode: v.c,
        make,
        model: modelKey,
        variant: v.v,
        cc: v.cc,
        kw: v.kw,
        fuel: v.f,
        body: v.b,
        axle: v.ax,
        newListPrice: v.nl,
        latestYear: v.y,
        years: yearsOverlay.get(v.c) || derivedYears(v.y),
        category,
      });
    }
  }

  index = map;
  if (yearsOverlay.size) {
    const total = [...map.values()].reduce((acc, m) => acc + [...m.models.values()].reduce((a, xs) => a + xs.length, 0), 0);
    console.log(`[catalogue] Indexed ${total} variants across ${map.size} makes (${yearsOverlay.size} mmCodes have real year ranges)`);
  } else {
    console.warn('[catalogue] tu-years.json overlay not found — variant years are derived windows. Run `npm run catalogue:refresh` for real intro/discon ranges.');
  }
}

/** Derived fallback when the live-intro/discon overlay is missing: the variant's
 *  latest registration year and one back. Real codes vary trim by trim-year, so
 *  a tight window is more honest than inventing a decade. The ±1 scraper band
 *  rides on top. */
function derivedYears(latestYear: number): number[] {
  const y = Number(latestYear) || new Date().getFullYear();
  return y >= 1996 ? [y - 1, y] : [y];
}

function ensureIndex(): Map<string, IndexedMake> {
  buildIndex();
  return index!;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function isCategoryId(s: string): s is CategoryId {
  return (CATEGORY_IDS as string[]).includes(s);
}

export function listCategories(): CatalogueCategory[] {
  const idx = ensureIndex();
  const stats = new Map<CategoryId, { makes: Set<string>; models: Set<string> }>();
  for (const id of CATEGORY_IDS) stats.set(id, { makes: new Set(), models: new Set() });

  for (const [make, mkEntry] of idx) {
    for (const [model, variants] of mkEntry.models) {
      const cats = new Set<CategoryId>(variants.map((v) => v.category));
      for (const c of cats) {
        stats.get(c)!.makes.add(make);
        stats.get(c)!.models.add(`${make}::${model}`);
      }
    }
  }

  return CATEGORY_IDS.map((id) => {
    const s = stats.get(id)!;
    return {
      id,
      label: CATEGORY_LABELS[id],
      blurb: '',
      makeCount: s.makes.size,
      modelCount: s.models.size,
    };
  });
}

/** Makes having ≥1 variant in the category. No category → all makes. */
export function listMakes(category?: CategoryId): string[] {
  const idx = ensureIndex();
  const out: string[] = [];
  for (const [make, mkEntry] of idx) {
    if (!category) {
      out.push(make);
      continue;
    }
    for (const variants of mkEntry.models.values()) {
      if (variants.some((v) => v.category === category)) {
        out.push(make);
        break;
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Models for a make that have ≥1 variant in the category. No category → all. */
export function listModels(category: CategoryId | undefined, make: string): string[] {
  const idx = ensureIndex();
  const mkEntry = idx.get(String(make || '').toUpperCase());
  if (!mkEntry) return [];
  const out: string[] = [];
  for (const [model, variants] of mkEntry.models) {
    if (!category || variants.some((v) => v.category === category)) out.push(model);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Full variant list for a make+model (optionally category-filtered), each with
 *  its mmCode and production-year range. */
export function listVariants(category: CategoryId | undefined, make: string, model: string): CatalogueVariant[] {
  const idx = ensureIndex();
  const mkEntry = idx.get(String(make || '').toUpperCase());
  if (!mkEntry) return [];
  const variants = mkEntry.models.get(String(model || ''));
  if (!variants) return [];
  const filtered = category ? variants.filter((v) => v.category === category) : variants;
  return filtered
    .map((v) => ({ ...v, years: [...v.years].sort((a, b) => b - a) }))
    .sort((a, b) => a.variant.localeCompare(b.variant));
}

/** Resolve a variant by exact M&M code from the whole index. */
export function resolveByMmCode(mmCode: string): CatalogueVariant | null {
  if (!mmCode) return null;
  const idx = ensureIndex();
  const code = String(mmCode).trim().toUpperCase();
  for (const mkEntry of idx.values()) {
    for (const variants of mkEntry.models.values()) {
      const hit = variants.find((v) => v.mmCode.toUpperCase() === code);
      if (hit) return hit;
    }
  }
  return null;
}

/** Category of the first variant under a make — best-effort fallback when a
 *  deal has no mmCode (mixed makes resolve to their dominant rule's bucket;
 *  most makes are single-vertical so this is exact in practice). */
export function categoryOfMake(make: string): CategoryId | null {
  const idx = ensureIndex();
  const variants = idx.get(String(make || '').toUpperCase())?.models.values().next().value;
  return variants && variants.length ? variants[0].category : null;
}

/** Resolve {make, model, variant} (all case-insensitive) to a concrete variant —
 *  lets the price-check lookup get the mmCode even when only text was sent. */
export function resolveVariant(category: CategoryId | undefined, make: string, model: string, variant: string): CatalogueVariant | null {
  const list = listVariants(category, make, model);
  const target = String(variant || '').trim().toUpperCase();
  if (!target) return list.length ? list[0] : null;
  return (
    list.find((v) => v.variant.toUpperCase() === target) ||
    list.find((v) => v.variant.toUpperCase().includes(target)) ||
    null
  );
}