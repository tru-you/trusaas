/**
 * Client side of the first-run setup checklist for TruLens.
 *
 * The dealership record itself lives ONLY in TruFlow central ("what lives in
 * Lens lives in Flow"), so completeness is never computed here — this module
 * just talks to the server's bridge routes, which proxy to TruFlow with the
 * sync key. Demo tokens and legacy shared-code logins get skipPrompt:true
 * back, decided server-side where the token type is actually known (the
 * client's isDemo flag misreads after a refresh).
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
  /** Demo logins, slugless legacy logins, or the bridge being unavailable. */
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

/** Fetch the dealership's setup checklist via the TruFlow bridge.
 *
 *  `getToken` supplies the Bearer token (Lens auth hands out Firebase-shaped
 *  handles whose getIdToken() actually returns our signed device/demo token).
 *  Any failure resolves to "nothing to do" — a nudge must never block
 *  capturing cars. */
export async function fetchSetupStatus(
  getToken?: () => Promise<string | undefined> | string | undefined,
): Promise<SetupStatus> {
  try {
    const t = await getToken?.();
    const res = await fetch('/api/setup/status', {
      headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    });
    if (!res.ok) return SETUP_SKIPPED;
    return (await res.json()) as SetupStatus;
  } catch {
    return SETUP_SKIPPED;
  }
}

/** Record "I'll do this later" on the shared Flow record — account-level,
 *  so the prompt stays dismissed on every device and every app in the suite. */
export async function acknowledgeSetup(
  getToken?: () => Promise<string | undefined> | string | undefined,
): Promise<void> {
  const t = await getToken?.();
  const res = await fetch('/api/setup/acknowledge', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Setup acknowledge failed (${res.status})`);
}

// --- Dashboard-card snooze (per-device, short) ------------------------

const SNOOZE_KEY = 'trulens_setup_snoozed_until';

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
