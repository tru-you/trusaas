// API access for the single-user TruCRM.
//
// The server signs a 30-day device token when the access code is presented
// (/api/auth/device). Every /api call must carry it as a Bearer token once the
// server has TRUCRM_ACCESS_CODE configured. When the code isn't configured the
// server leaves the API open, and this wrapper simply never sends a header.

const TOKEN_KEY = 'trusaas_device_token';

export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable — token lives for this page load only
  }
}

export function clearDeviceToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function hasDeviceToken(): boolean {
  return Boolean(getDeviceToken());
}

/** fetch() that attaches the device token to calls against the same origin. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const token = getDeviceToken();
  const url = String(input);
  // Only attach to same-origin API routes; public /esig and /tru-sign stay open.
  if (token && url.startsWith('/api/')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export interface HealthInfo {
  ok?: boolean;
  product?: string;
  accessCodeConfigured?: boolean;
  aiConfigured?: boolean;
}

export async function fetchHealth(): Promise<HealthInfo> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Exchange the access code for a device token. Throws with a readable message. */
export async function loginWithAccessCode(code: string): Promise<void> {
  const res = await fetch('/api/auth/device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(data.error || data.message || 'That code is not recognised.');
  }
  setDeviceToken(data.token);
}