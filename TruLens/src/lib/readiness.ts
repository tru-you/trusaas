import { PHOTO_SLOTS, Vehicle, QualityReport } from '../types';

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
  const required = PHOTO_SLOTS.filter((s) => s.required);
  const optional = PHOTO_SLOTS.filter((s) => !s.required);
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
  const scoreOk = score === null || score >= 70;
  const canExportDms = Object.keys(photos).length > 0;
  // Explicit publish flag preferred; still "structurally ready" when shots+score ok
  const canPublishWeb =
    allRequired &&
    scoreOk &&
    vehicle.showOnWebsite === true;

  let level: WebReadinessLevel = 'capture';
  let label = 'Capture in progress';
  let color = '#F59E0B';

  if (vehicle.status === 'Listed' || vehicle.lastDmsExportAt) {
    level = 'listed';
    label = canPublishWeb ? 'Listed · web ready' : 'Exported · finish shots for web';
    color = canPublishWeb ? '#0EA5E9' : '#06b6d4';
  } else if (allRequired && scoreOk && vehicle.showOnWebsite === true) {
    level = 'web-ready';
    label = 'Published to web';
    color = '#10B981';
  } else if (allRequired) {
    level = 'ready';
    label = scoreOk ? 'Ready to publish' : 'Shots complete · improve quality';
    color = scoreOk ? '#22C55E' : '#F97316';
    if (scoreOk && vehicle.showOnWebsite !== true) {
      reasons.push('Not published to website yet');
    }
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
  const required = PHOTO_SLOTS.filter((s) => s.required);
  const allRequired = required.every((s) => !!photos[s.id]);
  const reports = Object.values(vehicle.quality || {}) as QualityReport[];
  const score = reports.length
    ? Math.round(reports.reduce((a, r) => a + (r.overallScore || 0), 0) / reports.length)
    : null;
  return allRequired && (score === null || score >= 70);
}
