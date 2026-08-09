import { useMemo } from 'react';
import { Property } from '../types';
import { getDefaultSlotIds, getPropertySlots } from '../templates';
import type { TemplateSlot } from '../templates';

export function resolveSlots(property: Property): TemplateSlot[] {
  const ids = property.activeSlotIds || getDefaultSlotIds(property.propertyType);
  return getPropertySlots(ids);
}

export function usePropertySlots(property: Property): TemplateSlot[] {
  return useMemo(
    () => resolveSlots(property),
    [property.activeSlotIds, property.propertyType],
  );
}
