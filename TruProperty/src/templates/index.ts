import { propertyTemplate, SLOT_LIBRARY, COMPLIANCE_CERTS, getDefaultSlotIds, getPropertySlots } from '../template';
import type { InspectionTemplate, TemplateSlot, ComplianceCertDef, MediaType } from '../template';

export { SLOT_LIBRARY, COMPLIANCE_CERTS, getDefaultSlotIds, getPropertySlots };
export type { TemplateSlot, ComplianceCertDef, MediaType };

const TEMPLATES: Record<string, InspectionTemplate> = {
  [propertyTemplate.id]: propertyTemplate,
};

export function getTemplate(id: string = propertyTemplate.id): InspectionTemplate {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown inspection template: ${id}`);
  return t;
}

export const DEFAULT_TEMPLATE = getTemplate();
