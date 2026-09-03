import { vehicleTemplate, motoTemplate } from '../template';
import type { InspectionTemplate } from '../template';

const TEMPLATES: Record<string, InspectionTemplate> = {
  [vehicleTemplate.id]: vehicleTemplate,
  [motoTemplate.id]: motoTemplate,
};

/**
 * Resolve an inspection template by id.
 */
export function getTemplate(id: string = vehicleTemplate.id): InspectionTemplate {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown inspection template: ${id}`);
  return t;
}

/**
 * Resolve the default template for a given vertical.
 */
export function getTemplateForVertical(vertical?: string | null): InspectionTemplate {
  if (vertical === 'moto') return motoTemplate;
  return vehicleTemplate;
}

export const DEFAULT_TEMPLATE = getTemplate();

