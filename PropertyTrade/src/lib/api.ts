const TOKEN_KEY = 'flowprop.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface ApiInit {
  method?: string;
  body?: unknown;
}

export async function api<T = unknown>(path: string, init?: ApiInit): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method: init?.method || 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    if (!location.hash.includes('#/login')) location.hash = '#/login';
    throw new Error('Signed out.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: string }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const apiGet = <T = unknown>(path: string) => api<T>(path);