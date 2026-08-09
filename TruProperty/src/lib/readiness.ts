import { Property } from '../types';
import { getDefaultSlotIds, getPropertySlots } from '../templates';

/**
 * Inspection progress for TrueState property inspections.
 *
 *   capture    photos still outstanding
 *   inspecting photos done, checklist not started or part-done
 *   signed     an inspector has put their name to it
 *   issued     the report has been exported / shared
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

export function computeInspectionReadiness(property: Property): InspectionReadiness {
  const photos = property.photos || {};
  const slotIds = property.activeSlotIds || getDefaultSlotIds(property.propertyType);
  const slots = getPropertySlots(slotIds);
  const required = slots.filter((s) => s.required);
  const optional = slots.filter((s) => !s.required);
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
  const checklistAnswered = Object.keys(property.inspectionChecklist || {}).length;
  const signedOff = !!(property.inspectorName && property.inspectorName.trim());

  if (allRequired && checklistAnswered === 0) {
    reasons.push('Checklist not started');
  }
  if (allRequired && checklistAnswered > 0 && !signedOff) {
    reasons.push('No inspector named — the report signature block prints blank');
  }

  let level: InspectionReadinessLevel = 'capture';
  let label = `Photos ${requiredTaken}/${required.length}`;
  let color = '#F59E0B';

  if (allRequired && signedOff) {
    level = 'signed';
    label = 'Signed off · report ready';
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
