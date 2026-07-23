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
  role: "dealer" | "admin";
  dealershipId?: string;
};

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

/** Exchange an access code for a session token. Throws with a readable
 *  message on a bad code so the login screen can show it as-is. */
export async function login(code: string): Promise<Account> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
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

/**
 * fetch() with the session token attached.
 *
 * A 401 means the token expired or was revoked, so the session is cleared and
 * the page reloads to the login screen rather than leaving the UI in a broken
 * half-loaded state.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined") window.location.reload();
  }
  return res;
}
