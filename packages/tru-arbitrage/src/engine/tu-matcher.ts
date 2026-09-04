/**
 * TransUnion variant matcher — resolves a listing title to an exact MM code
 * using the static CodesAndDescriptions data file (flat-fee retainer, no per-call cost).
 *
 * The lookup is keyed by make (uppercase) → array of variants. Each variant has:
 *   c: mmCode, mk: make, md: model, v: variant description, y: latest year,
 *   cc: cubic capacity, kw: kilowatts, nl: new list price, f: fuel type,
 *   b: body type, ax: axle config (4X2/4X4)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TuVariant {
  c: string;   // mmCode
  mk: string;  // make
  md: string;  // master model (e.g. "D-MAX")
  v: string;   // full variant (e.g. "D-MAX 1.9 Ddi HR S/C P/U")
  y: number;   // latest registration year
  cc: number;  // cubic capacity
  kw: number;  // kilowatts
  nl: number;  // new list price (ZAR)
  f: string;   // fuel type (P/D)
  b: string;   // body type
  ax: string;  // axle (4X2/4X4)
}

export interface ResolvedVariant {
  mmCode: string;
  make: string;
  model: string;
  variant: string;
  trim: string;       // variant minus model prefix (e.g. "1.9 Ddi HR S/C P/U")
  cc: number;
  kw: number;
  newListPrice: number;
  fuelType: string;
  bodyType: string;
  axle: string;
  matchScore: number;  // 0-1 confidence
}

let catalogue: Record<string, TuVariant[]> | null = null;

/** Resolve tu-variants.json across run modes:
 *  - bundled dist/server.cjs → __dirname = <pkg>/dist, data at ../data
 *  - tsx dev (src/engine)    → __dirname = <pkg>/src/engine, data at ../../data
 *  - odd cwd runs            → <cwd>/data
 *  The catalogue silently loading empty disabled TU matching AND the
 *  new-list-price cap in dev — this resolver is what makes it impossible. */
function resolveCataloguePath(): string | null {
  const candidates = [
    path.join(__dirname, '..', 'data', 'tu-variants.json'),
    path.join(__dirname, '..', '..', 'data', 'tu-variants.json'),
    path.join(process.cwd(), 'data', 'tu-variants.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function loadCatalogue(): Record<string, TuVariant[]> {
  if (catalogue) return catalogue;

  const dataPath = resolveCataloguePath();
  if (!dataPath) {
    console.warn('[tu-matcher] tu-variants.json not found in any known location — TU matching disabled');
    catalogue = {};
    return catalogue;
  }

  try {
    catalogue = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const totalVariants = Object.values(catalogue!).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[tu-matcher] Loaded ${totalVariants} variants across ${Object.keys(catalogue!).length} makes (${dataPath})`);
  } catch (err: any) {
    console.error('[tu-matcher] Failed to load tu-variants.json:', err?.message);
    catalogue = {};
  }

  return catalogue!;
}

/** Normalize text for matching: lowercase, strip punctuation, collapse whitespace */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Count how many tokens from `needle` appear in `haystack` */
function tokenOverlap(needleTokens: string[], haystackNorm: string): number {
  let hits = 0;
  for (const t of needleTokens) {
    if (haystackNorm.includes(t)) hits++;
  }
  return hits;
}

/** Extract engine displacement from variant string (e.g. "1.9" from "D-MAX 1.9 Ddi") */
function extractDisplacement(s: string): string | null {
  const m = s.match(/\b(\d\.\d)\b/);
  return m ? m[1] : null;
}

/** All makes in the static catalogue (dropdown source — free, local, no API). */
export function listMakes(): string[] {
  const cat = loadCatalogue();
  return Object.keys(cat).sort();
}

/** Models for one make, from the static catalogue (title-cased for the UI). */
export function listModels(make: string): string[] {
  const cat = loadCatalogue();
  const variants = cat[String(make || '').toUpperCase()] || [];
  const models = new Set<string>();
  for (const v of variants) {
    if (v.md) models.add(v.md);
  }
  return Array.from(models).sort();
}

/** "MERCEDES-BENZ" -> "Mercedes-Benz", "BMW" -> "BMW", "POLO" -> "Polo".
 *  Short tokens (≤3 chars) stay uppercase — they're acronyms, not words. */
export function titleCaseVehicle(s: string): string {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split('-')
        .map((part) =>
          part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join('-')
    )
    .join(' ');
}

/**
 * Match a normalized vehicle against the TransUnion catalogue.
 * Returns the best-matching variant or null if no confident match.
 */
export function matchVariant(
  make: string,
  model: string,
  year: number,
  title: string,
  trim?: string
): ResolvedVariant | null {
  const cat = loadCatalogue();
  
  // Try exact make match, then common aliases
  const makeKey = make.toUpperCase();
  const MAKE_ALIASES: Record<string, string> = {
    'VW': 'VOLKSWAGEN',
    'MERC': 'MERCEDES-BENZ',
    'MERCEDES': 'MERCEDES-BENZ',
    'CHEV': 'CHEVROLET',
    'CHEVY': 'CHEVROLET',
    'LANDROVER': 'LAND ROVER',
    'RANGE ROVER': 'LAND ROVER',
  };
  
  const variants = cat[makeKey] || cat[MAKE_ALIASES[makeKey] || ''] || [];
  if (variants.length === 0) return null;

  // Build search text from all available info
  const searchText = norm([title, model, trim || ''].join(' '));
  
  // Filter to matching model first
  const modelNorm = norm(model);
  const modelCandidates = variants.filter(v => {
    const vModelNorm = norm(v.md);
    return vModelNorm.includes(modelNorm) || modelNorm.includes(vModelNorm);
  });

  if (modelCandidates.length === 0) return null;

  // Extract displacement from title/trim for precise matching
  const titleDisplacement = extractDisplacement(title) || (trim ? extractDisplacement(trim) : null);

  // Score each candidate
  let bestScore = 0;
  let bestMatch: TuVariant | null = null;

  for (const v of modelCandidates) {
    const variantNorm = norm(v.v);
    const variantTokens = variantNorm.split(' ').filter(t => t.length >= 2);
    
    // Base score: token overlap between variant description and search text
    const overlap = tokenOverlap(variantTokens, searchText);
    let score = variantTokens.length > 0 ? overlap / variantTokens.length : 0;

    // Bonus for engine displacement match
    const variantDisplacement = extractDisplacement(v.v);
    if (titleDisplacement && variantDisplacement) {
      if (titleDisplacement === variantDisplacement) {
        score += 0.3; // Strong match on engine size
      } else {
        score -= 0.4; // Penalty for wrong engine — this is the key differentiator
      }
    }

    // Bonus for axle config match (4x4 mentioned in title)
    const has4x4 = /4x4|4wd|awd/i.test(title);
    if (has4x4 && v.ax === '4X4') score += 0.1;
    if (!has4x4 && v.ax === '4X4') score -= 0.05;

    // Bonus for body type match
    if (/double\s?cab|d\/c/i.test(title) && v.b === 'D/C') score += 0.1;
    if (/single\s?cab|s\/c/i.test(title) && v.b === 'S/C') score += 0.1;
    if (/extended\s?cab|x\/c/i.test(title) && v.b === 'X/C') score += 0.1;

    // Bonus for auto/manual match
    if (/auto|a\/t|dsg|tiptronic/i.test(title) && v.v.includes('A/T')) score += 0.1;
    if (/manual|m\/t/i.test(title) && v.v.includes('M/T')) score += 0.05;

    // Year proximity bonus
    const yearDiff = Math.abs(v.y - year);
    if (yearDiff <= 1) score += 0.05;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = v;
    }
  }

  if (!bestMatch || bestScore < 0.3) return null;

  // Extract trim from variant (remove model prefix)
  const variantTrim = bestMatch.v
    .replace(new RegExp(`^${bestMatch.md}\\s*`, 'i'), '')
    .trim();

  return {
    mmCode: bestMatch.c,
    make: bestMatch.mk,
    model: bestMatch.md,
    variant: bestMatch.v,
    trim: variantTrim || bestMatch.v,
    cc: bestMatch.cc,
    kw: bestMatch.kw,
    newListPrice: bestMatch.nl,
    fuelType: bestMatch.f,
    bodyType: bestMatch.b,
    axle: bestMatch.ax,
    matchScore: Math.min(bestScore, 1),
  };
}
