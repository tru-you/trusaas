import { Property, QualityReport } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

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
  /** Agency has answered the condition declaration (no-damage / damage-shown).
   *  Not a hard gate on export — Lens stays permissive — but a listing isn't
   *  "ready" until the agency has made the honest statement. */
  conditionDeclared: boolean;
  listingReady: boolean;
  overallScore: number | null;
  canExport: boolean;
  canPublishWeb: boolean;
  reasons: string[];
}

function overallScore(property: Property): number | null {
  const reports = Object.values(property.quality || {}) as QualityReport[];
  if (!reports.length) return null;
  const sum = reports.reduce((a, r) => a + (r.overallScore || 0), 0);
  return Math.round(sum / reports.length);
}

/** Shared Ready-for-web rules across PropLens → PMS → website */
export function computeWebReadiness(property: Property): WebReadiness {
  const photos = property.photos || {};

  // Core = the honest listing minimum (the exterior lap + interior + erfSize).
  const core = DEFAULT_TEMPLATE.slots.filter((s) => s.tier === 'core');
  const coreTaken = core.filter((s) => !!photos[s.id]).length;
  const missingCore = core.filter((s) => !photos[s.id]).map((s) => s.name);
  const conditionDeclared = property.conditionDeclaration != null;
  /* Listing-ready = the core photo set (10 shots, uploaded or taken). The
     condition declaration is a separate, optional step that feeds the website's
     "No defects reported" line — it no longer gates readiness. */
  const listingReady = missingCore.length === 0;

  const score = overallScore(property);
  const reasons: string[] = [];

  if (missingCore.length) {
    reasons.push(`${missingCore.length} core shot${missingCore.length === 1 ? '' : 's'} still to take`);
  }
  if (score !== null && score < 70) {
    reasons.push(`Photo-quality score ${score}/100 is below 70`);
  }
  if (!Object.keys(photos).length) {
    reasons.push('No photos captured');
  }

  const hasPhotos = Object.keys(photos).length > 0;
  const scoreOk = score === null || score >= 70;
  // Export stays permissive by design — a light shoot must sync as cleanly as a
  // full one — so this gates on photos, not on core/declaration.
  const canExport = hasPhotos;
  const canPublishWeb =
    hasPhotos &&
    scoreOk &&
    property.showOnWebsite === true;

  let level: WebReadinessLevel = 'capture';
  let label = 'Capture in progress';
  let color = '#8B8D89';

  if (property.status === 'Listed' || property.lastPmsExportAt) {
    level = 'listed';
    label = canPublishWeb ? 'Listed · web ready' : 'Exported to PMS';
    color = '#4FE3DC';
  } else if (hasPhotos && scoreOk && property.showOnWebsite === true) {
    level = 'web-ready';
    label = listingReady ? 'Published to web' : 'Published to web · finish core shots';
    color = '#4FE3DC';
  } else if (hasPhotos && scoreOk) {
    level = 'ready';
    label = listingReady
      ? 'Listing-ready'
      : `Getting there · ${missingCore.length} core shot${missingCore.length === 1 ? '' : 's'} to take`;
    color = listingReady ? '#4FE3DC' : '#8B8D89';
    if (property.showOnWebsite !== true && listingReady) {
      reasons.push('Not published to website yet');
    }
  }

  return {
    level,
    label,
    color,
    coreTotal: core.length,
    coreTaken,
    missingCore,
    conditionDeclared,
    listingReady,
    overallScore: score,
    canExport,
    canPublishWeb,
    reasons,
  };
}

export function whatsAppSalesBlurb(
  property: Property,
  readiness: WebReadiness,
  opts?: { agencyName?: string; waNumber?: string }
): string {
  const price = Number(property.price || 0).toLocaleString('en-ZA');
  const score = readiness.overallScore != null ? `${readiness.overallScore}/100` : 'pending';
  const agency = opts?.agencyName || property.agencyName || 'Our agency';
  return (
    `*${property.address} ${property.suburb}*\n` +
    `${property.propertyType || 'House'} · ${property.bedrooms != null ? `${property.bedrooms} bed` : ''}\n` +
    `Listing *${property.listingRef}* · R ${price}\n` +
    `PropLens inspection report: ${score} · ${readiness.label}\n` +
    `Photos: ${readiness.coreTaken}/${readiness.coreTotal} core shots\n` +
    `\n${agency}` +
    (opts?.waNumber || property.agencyWhatsApp
      ? `\nWhatsApp: ${opts?.waNumber || property.agencyWhatsApp}`
      : '') +
    `\n— PropLens inspection pack`
  );
}

/** Structural readiness (shots+score) without requiring publish flag */
export function isStructurallyWebReady(property: Property): boolean {
  const photos = property.photos || {};
  const hasPhotos = Object.keys(photos).length > 0;
  const reports = Object.values(property.quality || {}) as QualityReport[];
  const score = reports.length
    ? Math.round(reports.reduce((a, r) => a + (r.overallScore || 0), 0) / reports.length)
    : null;
  return hasPhotos && (score === null || score >= 70);
}
