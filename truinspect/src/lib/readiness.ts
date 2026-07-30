import { Vehicle, QualityReport } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

/**
 * Inspection progress, not merchandising readiness.
 *
 * This file was copied from TruLens and kept its language: "Ready to publish",
 * "Published to web", "Not published to website yet". TruInspect is standalone
 * and produces a VIR — it does not publish anything to a dealer website, so
 * every one of those labels described something the app cannot do.
 *
 *   capture    photos still outstanding
 *   inspecting photos done, checklist not started or part-done
 *   signed     an inspector has put their name to it
 *   issued     the VIR has been exported / shared
 */
export type WebReadinessLevel = 'capture' | 'inspecting' | 'signed' | 'issued';

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
  const scoreOk = score === null || score >= 70;
  const canExportDms = Object.keys(photos).length > 0;
  // Explicit publish flag preferred; still "structurally ready" when shots+score ok
  const canPublishWeb =
    allRequired &&
    scoreOk &&
    vehicle.showOnWebsite === true;

  const checklistAnswered = Object.keys(vehicle.inspectionChecklist || {}).length;
  const signedOff = !!(vehicle.inspectorName && vehicle.inspectorName.trim());

  if (allRequired && checklistAnswered === 0) {
    reasons.push('Checklist not started');
  }
  if (allRequired && checklistAnswered > 0 && !signedOff) {
    reasons.push('No inspector named — the VIR signature block prints blank');
  }

  let level: WebReadinessLevel = 'capture';
  let label = `Photos ${requiredTaken}/${required.length}`;
  let color = '#F59E0B';

  if (vehicle.lastDmsExportAt) {
    level = 'issued';
    label = 'VIR issued';
    color = '#0EA5E9';
  } else if (allRequired && signedOff) {
    level = 'signed';
    label = 'Signed off · VIR ready';
    color = '#22C55E';
  } else if (allRequired) {
    level = 'inspecting';
    label = checklistAnswered === 0 ? 'Photos done · checklist next' : 'Awaiting sign-off';
    color = checklistAnswered === 0 ? '#06B6D4' : '#F97316';
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
    `TruInspect VIR: ${score} · ${readiness.label}\n` +
    `Photos: ${readiness.requiredTaken}/${readiness.requiredTotal} required\n` +
    `\n${dealer}` +
    (opts?.waNumber || vehicle.dealerWhatsApp
      ? `\nWhatsApp: ${opts?.waNumber || vehicle.dealerWhatsApp}`
      : '') +
    `\n— TruInspect inspection pack`
  );
}

/** Structural readiness (shots+score) without requiring publish flag */
export function isStructurallyWebReady(vehicle: Vehicle): boolean {
  const photos = vehicle.photos || {};
  const required = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
  const allRequired = required.every((s) => !!photos[s.id]);
  const reports = Object.values(vehicle.quality || {}) as QualityReport[];
  const score = reports.length
    ? Math.round(reports.reduce((a, r) => a + (r.overallScore || 0), 0) / reports.length)
    : null;
  return allRequired && (score === null || score >= 70);
}
