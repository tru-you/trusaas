/**
 * Client side of the first-run setup checklist.
 *
 * Completeness lives on the server (derived live from the dealership record by
 * /api/dealership/setup-status), so every device agrees on it. The only thing
 * this file keeps locally is a short snooze for the dashboard card — the
 * account-level "I'll do this later" is stored on the dealership record via
 * the acknowledge endpoint, not here.
 */

import { authFetch } from "./session";

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
  /** Demo accounts and admins with no scoped dealer have nothing to set up. */
  skipPrompt: boolean;
  items: SetupItem[];
}

const EMPTY_STATUS: SetupStatus = {
  complete: true,
  requiredComplete: true,
  acknowledgedAt: null,
  skipPrompt: true,
  items: [],
};

/** Fetch the dealership's setup checklist. `dealershipId` is only needed for
 *  a master admin looking at a scoped dealer; dealer logins omit it. Any
 *  failure resolves to "nothing to do" — setup nudging must never block the
 *  app from working. */
export async function fetchSetupStatus(dealershipId?: string): Promise<SetupStatus> {
  try {
    const qs = dealershipId ? `?dealershipId=${encodeURIComponent(dealershipId)}` : "";
    const res = await authFetch(`/api/dealership/setup-status${qs}`);
    if (!res.ok) return EMPTY_STATUS;
    return (await res.json()) as SetupStatus;
  } catch {
    return EMPTY_STATUS;
  }
}

/** Record "later" on the dealership record — account-level, cross-device. */
export async function acknowledgeSetup(dealershipId?: string): Promise<void> {
  const res = await authFetch("/api/dealership/setup-acknowledge", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dealershipId ? { dealershipId } : {}),
  });
  if (!res.ok) throw new Error(`Setup acknowledge failed (${res.status})`);
}

// --- Dashboard-card snooze (per-device, short) ------------------------

const SNOOZE_KEY = "truflow_setup_snoozed_until";

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
