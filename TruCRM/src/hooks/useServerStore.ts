import { useEffect, useRef, useState } from 'react';
import { loadRemote, saveRemote, serverSlice } from '../lib/serverStore';

/**
 * State slice synced to the server (source of truth) with localStorage as an
 * instant cache / offline fallback. Single user → last-write-wins.
 *
 * Hydration rules:
 *  - Server has the slice  → adopt the server copy (phone sees desktop data).
 *  - Server is empty but this browser has data → upload it once (first-time
 *    migration of the existing local workspace).
 *  - Neither → keep the seed (demo data).
 */
export function useServerStore<T>(localKey: string, seed: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const readLocal = (): T => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? (JSON.parse(raw) as T) : seed;
    } catch {
      return seed;
    }
  };

  const [value, setValue] = useState<T>(readLocal);
  const hydratedRef = useRef(false);
  const hasLocalRef = useRef<boolean | null>(null);
  if (hasLocalRef.current === null) {
    try {
      hasLocalRef.current = localStorage.getItem(localKey) !== null;
    } catch {
      hasLocalRef.current = false;
    }
  }

  // One-shot hydration from the server on mount.
  useEffect(() => {
    let cancelled = false;
    const slice = serverSlice(localKey);
    loadRemote(slice).then((remote) => {
      if (cancelled) return;
      if (remote !== null) {
        setValue(remote as T);
        try {
          localStorage.setItem(localKey, JSON.stringify(remote));
        } catch {
          // storage unavailable — state still lives in memory
        }
      } else if (hasLocalRef.current) {
        // First run anywhere: push this browser's copy up so other
        // devices can see it too.
        saveRemote(slice, readLocal());
      }
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced persist after the user edits (or after adoption).
  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(localKey, JSON.stringify(value));
      } catch {
        // storage unavailable — drop the cache, keep the server copy
      }
      saveRemote(serverSlice(localKey), value);
    }, 400);
    return () => clearTimeout(timer);
  }, [value, localKey]);

  return [value, setValue];
}