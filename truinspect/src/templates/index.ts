import { vehicleTemplate } from '../template';
import type { InspectionTemplate } from '../template';

const TEMPLATES: Record<string, InspectionTemplate> = {
  [vehicleTemplate.id]: vehicleTemplate,
};

/** Only ever called with one id today — shaped so a future template (e.g. a
 *  property/tenancy one) can be added as a sibling without touching any of
 *  this file's callers. */
export function getTemplate(id: string = vehicleTemplate.id): InspectionTemplate {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown inspection template: ${id}`);
  return t;
}

export const DEFAULT_TEMPLATE = getTemplate();
