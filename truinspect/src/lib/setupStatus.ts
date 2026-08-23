/**
 * Client side of the first-run setup checklist for TruInspect.
 *
 * TruInspect is a STANDALONE product: there is no TruFlow central to borrow a
 * dealership record from, so completeness is derived server-side from this
 * app's own persisted record (inspect-dealerships.json, keyed by slug).
 * Demo tokens and legacy shared-code logins get skipPrompt:true back,
 * decided server-side where the token type is actually known.
 */

export interface SetupItem {
  id: string;
  label: string;
  hint?: string;
  done: boolean;
  required: boolean;
}

export interface SetupStatus {
  complete: boolean;
  /** True when everything REQUIRED is done — recommended items never nag. */
  requiredComplete: boolean;
  acknowledgedAt: string | null;
  skipPrompt: boolean;
  items: SetupItem[];
}

export const SETUP_SKIPPED: SetupStatus = {
  complete: true,
  requiredComplete: true,
  acknowledgedAt: null,
  skipPrompt: true,
  items: [],
};

type TokenGetter = () => Promise<string | undefined> | string | undefined;

async function authedFetch(getToken: TokenGetter | undefined, url: string, init?: RequestInit) {
  const t = await getToken?.();
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
}

/** Fetch the dealership's setup checklist. Any failure resolves to "nothing
 *  to do" — a nudge must never block inspecting cars. */
export async function fetchSetupStatus(getToken?: TokenGetter): Promise<SetupStatus> {
  try {
    const res = await authedFetch(getToken, '/api/dealership/setup-status');
    if (!res.ok) return SETUP_SKIPPED;
    return (await res.json()) as SetupStatus;
  } catch {
    return SETUP_SKIPPED;
  }
}

/** Record "I'll do this later" — persists per dealer slug on this instance,
 *  so the prompt stays dismissed across devices. */
export async function acknowledgeSetup(getToken?: TokenGetter): Promise<void> {
  const res = await authedFetch(getToken, '/api/dealership/setup-acknowledge', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Setup acknowledge failed (${res.status})`);
}

// --- Dashboard-card snooze (per-device, short) ------------------------

const SNOOZE_KEY = 'truinspect_setup_snoozed_until';

export function setupSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

/** Hide the dashboard card for a few days. The modal uses the server-side
 *  acknowledgement instead — that one should survive devices; this one
 *  shouldn't outlive the browser for long. */
export function snoozeSetup(days = 7): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  } catch {
    /* private browsing — card just comes back next load */
  }
}
