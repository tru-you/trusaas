/**
 * Kredo API client — CarTrust (VIN history) + CarValue (market valuations).
 * All calls go through the server (key never touches the browser).
 */

export interface CarTrustResult {
  vin: string;
  stolen: boolean;
  writtenOff: boolean;
  financeEncumbered: boolean;
  checkedAt: string;
  raw?: Record<string, unknown>;
}

export interface CarValueResult {
  vin: string;
  tradeValue: number | null;
  retailValue: number | null;
  marketValue: number | null;
  checkedAt: string;
  raw?: Record<string, unknown>;
}

export interface KredoStatus {
  connected: boolean;
  dealerSlug: string;
  hasSandboxKey: boolean;
  hasProductionKey: boolean;
  lastCheckedAt?: string;
}

export async function kredoStatus(token: string): Promise<KredoStatus> {
  const res = await fetch('/api/kredo/status', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load Kredo status');
  return res.json();
}

export async function kredoConnect(
  token: string,
  keys: { sandboxKey?: string; productionKey?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/kredo/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(keys),
  });
  return res.json();
}

export async function kredoDisconnect(token: string): Promise<{ ok: boolean }> {
  const res = await fetch('/api/kredo/disconnect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function kredoLookup(
  token: string,
  vin: string,
): Promise<CarTrustResult | null> {
  const res = await fetch('/api/kredo/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ vin }),
  });
  if (res.status === 404 || res.status === 503) return null;
  if (!res.ok) throw new Error('CarTrust lookup failed');
  return res.json();
}

export async function kredoValuation(
  token: string,
  vin: string,
): Promise<CarValueResult | null> {
  const res = await fetch('/api/kredo/valuation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ vin }),
  });
  if (res.status === 404 || res.status === 503) return null;
  if (!res.ok) throw new Error('CarValue lookup failed');
  return res.json();
}
