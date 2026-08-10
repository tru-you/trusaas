import { propertyTemplate } from '../template';
import type { InspectionTemplate } from '../template';

const TEMPLATES: Record<string, InspectionTemplate> = {
  [propertyTemplate.id]: propertyTemplate,
};

export function getTemplate(id: string = propertyTemplate.id): InspectionTemplate {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown inspection template: ${id}`);
  return t;
}

export const DEFAULT_TEMPLATE = getTemplate();
