import { Vehicle } from '../types';
import { DEFAULT_TEMPLATE } from '../templates';

/**
 * Inspection progress for a standalone VIR + trade-in tool. TruInspect does
 * not publish anything to a dealer website — that is TruLens's job, and this
 * file used to be a straight copy of TruLens's own "web readiness" module,
 * language and all ("Ready to publish", "Published to web", a photo-quality
 * score gating whether a vehicle counted as ready). None of that describes
 * what TruInspect does, so it has been stripped rather than relabelled.
 *
 *   capture    photos still outstanding
 *   inspecting photos done, checklist not started or part-done
 *   signed     an inspector has put their name to it
 *   issued     the VIR has been exported / shared
 */
export type InspectionReadinessLevel = 'capture' | 'inspecting' | 'signed' | 'issued';

export interface InspectionReadiness {
  level: InspectionReadinessLevel;
  label: string;
  color: string;
  requiredTotal: number;
  requiredTaken: number;
  optionalTaken: number;
  missingRequired: string[];
  reasons: string[];
}

export function computeInspectionReadiness(vehicle: Vehicle): InspectionReadiness {
  const photos = vehicle.photos || {};
  const required = DEFAULT_TEMPLATE.slots.filter((s) => s.required);
  const optional = DEFAULT_TEMPLATE.slots.filter((s) => !s.required);
  const requiredTaken = required.filter((s) => !!photos[s.id]).length;
  const optionalTaken = optional.filter((s) => !!photos[s.id]).length;
  const missingRequired = required.filter((s) => !photos[s.id]).map((s) => s.name);
  const reasons: string[] = [];

  if (missingRequired.length) {
    reasons.push(`${missingRequired.length} required shots missing`);
  }
  if (!Object.keys(photos).length) {
    reasons.push('No photos captured');
  }

  const allRequired = missingRequired.length === 0;
  const checklistAnswered = Object.keys(vehicle.inspectionChecklist || {}).length;
  const signedOff = !!(vehicle.inspectorName && vehicle.inspectorName.trim());

  if (allRequired && checklistAnswered === 0) {
    reasons.push('Checklist not started');
  }
  if (allRequired && checklistAnswered > 0 && !signedOff) {
    reasons.push('No inspector named — the VIR signature block prints blank');
  }

  let level: InspectionReadinessLevel = 'capture';
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
    missingRequired,
    reasons,
  };
}
