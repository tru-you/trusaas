// Server-backed JSON store for a slice of workspace state.
//
// Every slice (leads, invoices, dealerships…) lives in one file on the server
// (data/<key>.json). localStorage is kept as an instant-read cache and offline
// fallback, but the server copy is the source of truth so all devices share it.
// A single user means last-write-wins is the correct policy.

import { apiFetch } from './api';

export const SERVER_STORE_HINT = 'trusaas_server_store_v1';

/** Map a localStorage key back to its server slice name. */
const LOCAL_TO_SLICE: Record<string, string> = {
  trusaas_market_intel_v1: 'dealerships',
  trusaas_modules_v1: 'modules',
};

export function serverSlice(localKey: string): string {
  if (LOCAL_TO_SLICE[localKey]) return LOCAL_TO_SLICE[localKey];
  if (localKey.startsWith('trusaas_crm_v2_')) return localKey.slice('trusaas_crm_v2_'.length);
  if (localKey.startsWith('trusaas_app_state_v2_')) return localKey.slice('trusaas_app_state_v2_'.length);
  return localKey;
}

export async function loadRemote(key: string): Promise<unknown | null> {
  try {
    const res = await apiFetch(`/api/db/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body?.exists ? body.data : null;
  } catch {
    return null;
  }
}

export async function saveRemote(key: string, data: unknown): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/db/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}