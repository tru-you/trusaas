import { useState, useEffect, useCallback } from 'react';

export function useFormAutoSave<T extends Record<string, any>>(
  formKey: string,
  initialValues: T
): [T, (values: T | ((prev: T) => T)) => void, () => void, boolean, string | null] {
  const storageKey = `truesaas_autosave_${formKey}`;

  // State
  const [values, setValues] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialValues, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load auto-saved form from localStorage', e);
    }
    return initialValues;
  });

  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    return !!localStorage.getItem(storageKey);
  });

  const [lastSaved, setLastSaved] = useState<string | null>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? 'Restored from draft' : null;
  });

  // Save on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
      setHasDraft(true);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSaved(`Auto-saved at ${timeStr}`);
    } catch (e) {
      console.error('Failed to auto-save form to localStorage', e);
    }
  }, [values, storageKey]);

  // Clear draft method on successful submission
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setValues(initialValues);
      setHasDraft(false);
      setLastSaved(null);
    } catch (e) {
      console.error('Failed to clear auto-save draft', e);
    }
  }, [storageKey, initialValues]);

  return [values, setValues, clearDraft, hasDraft, lastSaved];
}
