import { Vehicle, QualityReport } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

export type WebReadinessLevel = 'capture' | 'ready' | 'web-ready' | 'listed';

export interface WebReadiness {
  level: WebReadinessLevel;
  label: string;
  color: string;
  requiredTotal: number;
  requiredTaken: number;
  optionalTaken: number;
  overallScore: number | null;
  missingRequired: string[];
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

/** Shared Ready-for-web rules across TruLens → DMS → website */
export function computeWebReadiness(vehicle: Vehicle): WebReadiness {
  const photos = vehicle.photos || {};
  const required = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
  const optional = DEFAULT_TEMPLATE.slots.filter((s) => !s.required);
  const requiredTaken = required.filter((s) => !!photos[s.id]).length;
  const optionalTaken = optional.filter((s) => !!photos[s.id]).length;
  const missingRequired = required.filter((s) => !photos[s.id]).map((s) => s.name);
  const score = overallScore(vehicle);
  const reasons: string[] = [];

  if (missingRequired.length) {
    reasons.push(`${missingRequired.length} required shots missing`);
  }
  if (score !== null && score < 70) {
    reasons.push(`VIR score ${score}/100 is below 70`);
  }
  if (!Object.keys(photos).length) {
    reasons.push('No photos captured');
  }

  const allRequired = missingRequired.length === 0;
  const hasPhotos = Object.keys(photos).length > 0;
  const scoreOk = score === null || score >= 70;
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
    label = allRequired ? 'Published to web' : 'Published to web · finish remaining shots';
    color = '#4FE3DC';
  } else if (hasPhotos && scoreOk) {
    level = 'ready';
    label = allRequired ? 'Ready to publish' : 'Ready to publish · more shots recommended';
    color = '#4FE3DC';
    if (vehicle.showOnWebsite !== true) {
      reasons.push('Not published to website yet');
    }
  } else if (allRequired) {
    level = 'ready';
    label = 'Shots complete · improve quality';
    color = '#8B8D89';
  }

  return {
    level,
    label,
    color,
    requiredTotal: required.length,
    requiredTaken,
    optionalTaken,
    overallScore: score,
    missingRequired,
    canExportDms,
    canPublishWeb,
    reasons,
  };
}

export function whatsAppSalesBlurb(
  vehicle: Vehicle,
  readiness: WebReadiness,
  opts?: { dealerName?: string; waNumber?: string }
): string {
  const price = Number(vehicle.price || 0).toLocaleString('en-ZA');
  const score = readiness.overallScore != null ? `${readiness.overallScore}/100` : 'pending';
  const dealer = opts?.dealerName || vehicle.dealerName || 'Our dealership';
  return (
    `*${vehicle.year} ${vehicle.make} ${vehicle.model}*\n` +
    `${vehicle.trim || 'Standard'} · ${vehicle.color || ''}\n` +
    `Stock *${vehicle.stockNumber}* · R ${price}\n` +
    `TruLens VIR: ${score} · ${readiness.label}\n` +
    `Photos: ${readiness.requiredTaken}/${readiness.requiredTotal} required\n` +
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
