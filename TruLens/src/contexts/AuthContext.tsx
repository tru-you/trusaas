import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const DEMO_KEY = 'trulens_demo_session';
/** Signed token from POST /api/auth/device, exchanged for the dealership's
 *  access code. Requests used to send the literal string 'local-demo-token',
 *  which the server accepted from anyone. */
const DEVICE_TOKEN_KEY = 'trulens_device_token';

/** Minimal User-like object for offline / PC demo mode */
export function createDemoUser(uid?: string, token?: string): User {
  const demoUid = uid || 'local-demo-user';
  const demoToken = token || 'local-demo-token';
  return {
    uid: demoUid,
    email: 'demo@trulens.local',
    emailVerified: true,
    isAnonymous: false,
    displayName: 'Demo Inspector',
    photoURL: null,
    phoneNumber: null,
    providerId: 'demo',
    metadata: {} as any,
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => localStorage.getItem(DEVICE_TOKEN_KEY) || demoToken,
    getIdTokenResult: async () =>
      ({
        token: localStorage.getItem(DEVICE_TOKEN_KEY) || demoToken,
        claims: { uid: demoUid },
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 86400000).toISOString(),
        signInProvider: 'demo',
        signInSecondFactor: null,
      }) as any,
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  enterDemoMode: () => Promise<void>;
  signInWithCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemo: false,
  enterDemoMode: async () => {},
  signInWithCode: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const enterDemoMode = async () => {
    /* No fake-fallback here, deliberately: the old catch-block minted a local
       pseudo-user with a junk token whenever the server refused demo (prod has
       DEMO_ENABLED off unless set), leaving users "logged in" to an app where
       every request 401s — and it persisted DEMO_KEY='1', so reloads resumed
       the broken session forever. If the server says no, that is the truth. */
    const res = await fetch('/api/auth/demo', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Demo is not available here.');
    localStorage.setItem(DEMO_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    localStorage.setItem(DEVICE_TOKEN_KEY, data.token);
    setIsDemo(true);
    setUser(createDemoUser(data.uid, data.token));
    setLoading(false);
  };

  /** Swap the dealership's access code for a signed device token. */
  const signInWithCode = async (code: string) => {
    const res = await fetch('/api/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not sign in on this device.');
    localStorage.setItem(DEVICE_TOKEN_KEY, data.token);

    /* A per-dealership code already establishes the yard, so there is nothing
       for the picker to ask. Recording it here means the phone agrees with the
       token; the server ignores this value on export either way. A shared code
       returns no slug and the picker still runs. */
    if (data.dealerSlug) {
      localStorage.setItem('trulens_dealer_slug', data.dealerSlug);
      localStorage.setItem('trulens_dealer_confirmed', '1');
      /* Pinned by the code itself. The server takes the dealership from the
         token regardless of what this phone sends, so Settings must show it as
         fixed rather than offering a choice that would be ignored. */
      localStorage.setItem('trulens_dealer_pinned', '1');
    } else {
      localStorage.removeItem('trulens_dealer_pinned');
    }

    localStorage.setItem(DEMO_KEY, '1');
    setIsDemo(false);
    setUser(createDemoUser());
    setLoading(false);
  };

  const signOut = async () => {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem('trulens_dealer_pinned');
    setIsDemo(false);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if never signed into Firebase
    }
  };

  useEffect(() => {
    /* A REAL demo session stores an expiry timestamp from the server mint.
       The legacy '1' marker only ever came from the removed fake-fallback —
       poison it out on sight so stuck browsers land on login instead of
       resurrecting a user whose token no server would accept. */
    if (localStorage.getItem(DEMO_KEY) === '1') {
      localStorage.removeItem(DEMO_KEY);
      localStorage.removeItem(DEVICE_TOKEN_KEY);
    }
    const realDemoSession = () => {
      const marker = localStorage.getItem(DEMO_KEY);
      if (!marker || marker === '1') return false;
      const stored = localStorage.getItem(DEVICE_TOKEN_KEY) || '';
      return Number(marker) > Date.now() && stored !== '' && !stored.startsWith('local-demo');
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (realDemoSession()) {
        // Resume a genuine server-minted demo session
        setIsDemo(true);
        setUser(createDemoUser());
        setLoading(false);
        return;
      }
      setIsDemo(false);
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, enterDemoMode, signInWithCode, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
