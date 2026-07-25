/**
 * Session handling for TruFlow Premium.
 *
 * The old login compared a hardcoded password in the browser and set a boolean,
 * which meant the "gate" was decoration — every /api route answered without it.
 * Now the code goes to the server, comes back as a signed token, and that token
 * rides on every API call. The server decides what the caller may see.
 */

const TOKEN_KEY = "truflow_session_token";
const ACCOUNT_KEY = "truflow_session_account";

export type Account = {
  label: string;
  /** Mirrors AuthRole on the server. This said "dealer" | "admin", neither of
   *  which the server has issued for some time — every real account is a
   *  principal. The effect was that TypeScript treated the role checks driving
   *  the owner/manager/salesperson view as impossible comparisons, so the one
   *  place that decides what a user can see had no type checking at all. */
  role: "admin" | "principal" | "manager" | "salesperson";
  dealershipId?: string;
};

/** Is there a usable session? Reads the token's own expiry so a stale one
 *  sends you to the login screen instead of a dashboard that 401s on load. */
export function hasValidSession(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const claims = JSON.parse(atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    return !!claims.exp && claims.exp > Date.now();
  } catch {
    return false;
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* private browsing — nothing to clear */
  }
}

/** Enter the sandbox demo — no code. Lands in an isolated tenant seeded with
 *  sample stock and leads, so a prospect never sees a real dealership. */
export async function enterDemo(): Promise<Account> {
  const res = await fetch("/api/auth/demo", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Demo is unavailable right now.");
  try {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data.account));
  } catch { /* ignore */ }
  return data.account as Account;
}

/** Exchange an access code for a session token. Throws with a readable
 *  message on a bad code so the login screen can show it as-is. */
export async function login(code: string, remember = true): Promise<Account> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, remember }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "That code isn't recognised." : "Sign-in failed. Try again.");
  }
  const data = await res.json();
  try {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data.account));
  } catch {
    /* token still works for this page view */
  }
  return data.account as Account;
}

/** Fired when the server rejects our token, so the app can show the login
 *  screen. Deliberately not a page reload: a background poll that 401s would
 *  reload, mount, poll, 401 and reload again — the screen just flashes. */
export const SESSION_EXPIRED_EVENT = "truflow:session-expired";

/**
 * fetch() with the session token attached.
 *
 * A 401 means the token expired or was revoked. The session is cleared and an
 * event is raised; React unmounts to the login screen on its own.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && getToken()) {
    clearSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  }
  return res;
}
