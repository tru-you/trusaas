import { Vehicle, QualityReport } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';
import { formatMoney, marketById, type MarketDisplay } from '../components/market';

export type WebReadinessLevel = 'capture' | 'ready' | 'web-ready' | 'listed';

export interface WebReadiness {
  level: WebReadinessLevel;
  label: string;
  color: string;
  /** Core = the honest listing minimum (tier === 'core'). This is what
   *  "listing-ready" is measured against now, not the toothless all-optional
   *  required[] set. */
  coreTotal: number;
  coreTaken: number;
  missingCore: string[];
  /** Dealer has answered the condition declaration (no-damage / damage-shown).
   *  Not a hard gate on export — Lens stays permissive — but a listing isn't
   *  "ready" until the dealer has made the honest statement. */
  conditionDeclared: boolean;
  listingReady: boolean;
  overallScore: number | null;
  canExportDms: boolean;
  canPublishWeb: boolean;
  reasons: string[];
}

function overallScore(vehicle: Vehicle): number | null {
  const reports = Object.values(vehicle.quality || {}) as QualityReport[];
  if (!reports.length) return null;
  const sum = reports.reduce((a, r) => a + (r.overallScore || 0), 0);
  return Math.round(sum / reports.length);
}

export const MIN_LISTING_PHOTOS = 6;
export const RECOMMENDED_LISTING_PHOTOS = 10;

/** Shared Ready-for-web rules across TruLens → DMS → website */
export function computeWebReadiness(vehicle: Vehicle): WebReadiness {
  const photos = vehicle.photos || {};
  const photoCount = Object.keys(photos).length;

  // Core = template slots; photoCount >= 6 is now Web Ready!
  const core = DEFAULT_TEMPLATE.slots.filter((s) => s.tier === 'core');
  const coreTaken = core.filter((s) => !!photos[s.id]).length;
  const missingCore = core.filter((s) => !photos[s.id]).map((s) => s.name);
  const conditionDeclared = vehicle.conditionDeclaration != null;
  /* Listing-ready = 6+ photos captured (Harmonized with TruFlow DMS).
     6 photos is Web Ready; ~10 photos is an optimal recommendation. */
  const listingReady = photoCount >= MIN_LISTING_PHOTOS;

  const score = overallScore(vehicle);
  const reasons: string[] = [];

  if (photoCount < MIN_LISTING_PHOTOS) {
    const remaining = MIN_LISTING_PHOTOS - photoCount;
    reasons.push(`${remaining} more photo${remaining === 1 ? '' : 's'} needed for Web Ready`);
  }
  if (score !== null && score < 70) {
    reasons.push(`Photo-quality score ${score}/100 is below 70`);
  }
  if (!photoCount) {
    reasons.push('No photos captured');
  }

  const hasPhotos = photoCount > 0;
  const scoreOk = score === null || score >= 70;
  // Export stays permissive by design — a light shoot must sync as cleanly as a
  // full one — so this gates on photos, not on core/declaration.
  const canExportDms = hasPhotos;
  const canPublishWeb =
    hasPhotos &&
    scoreOk &&
    vehicle.showOnWebsite === true;

  let level: WebReadinessLevel = 'capture';
  let label = 'Capture in progress';
  let color = '#8B8D89';

  if (vehicle.status === 'Listed' || vehicle.lastDmsExportAt) {
    level = 'listed';
    label = canPublishWeb ? 'Listed · web ready' : 'Exported to DMS';
    color = '#4FE3DC';
  } else if (hasPhotos && scoreOk && vehicle.showOnWebsite === true) {
    level = 'web-ready';
    label = listingReady ? 'Published to web' : `Published to web · ${MIN_LISTING_PHOTOS - photoCount} to web-ready`;
    color = '#4FE3DC';
  } else if (hasPhotos && scoreOk) {
    level = 'ready';
    label = listingReady
      ? 'Web-ready'
      : `Getting there · ${photoCount}/${MIN_LISTING_PHOTOS} photos captured`;
    color = listingReady ? '#4FE3DC' : '#8B8D89';
    if (vehicle.showOnWebsite !== true && listingReady) {
      reasons.push('Not published to website yet');
    }
  }

  return {
    level,
    label,
    color,
    coreTotal: MIN_LISTING_PHOTOS,
    coreTaken: Math.min(photoCount, MIN_LISTING_PHOTOS),
    missingCore,
    conditionDeclared,
    listingReady,
    overallScore: score,
    canExportDms,
    canPublishWeb,
    reasons,
  };
}

export function whatsAppSalesBlurb(
  vehicle: Vehicle,
  readiness: WebReadiness,
  opts?: { dealerName?: string; waNumber?: string; market?: MarketDisplay }
): string {
  const m = opts?.market || marketById('za');
  const price = formatMoney(Number(vehicle.price || 0), { currency: m.currency, locale: m.locale });
  const score = readiness.overallScore != null ? `${readiness.overallScore}/100` : 'pending';
  const dealer = opts?.dealerName || vehicle.dealerName || 'Our dealership';
  return (
    `*${vehicle.year} ${vehicle.make} ${vehicle.model}*\n` +
    `${vehicle.trim || 'Standard'} · ${vehicle.color || ''}\n` +
    `Stock *${vehicle.stockNumber}* · ${price}\n` +
    `TruLens VIR: ${score} · ${readiness.label}\n` +
    `Photos: ${readiness.coreTaken}/${readiness.coreTotal} core shots\n` +
    `\n${dealer}` +
    (opts?.waNumber || vehicle.dealerWhatsApp
      ? `\nWhatsApp: ${opts?.waNumber || vehicle.dealerWhatsApp}`
      : '') +
    `\n— TruLens inspection pack`
  );
}

/** Structural readiness (shots+score) without requiring publish flag */
export function isStructurallyWebReady(vehicle: Vehicle): boolean {
  const photos = vehicle.photos || {};
  const hasPhotos = Object.keys(photos).length > 0;
  const reports = Object.values(vehicle.quality || {}) as QualityReport[];
  const score = reports.length
    ? Math.round(reports.reduce((a, r) => a + (r.overallScore || 0), 0) / reports.length)
    : null;
  return hasPhotos && (score === null || score >= 70);
}
