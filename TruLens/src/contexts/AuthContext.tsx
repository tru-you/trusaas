import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const DEMO_KEY = 'trulens_demo_session';
/** Signed token from POST /api/auth/device, exchanged for the dealership's
 *  access code. Requests used to send the literal string 'local-demo-token',
 *  which the server accepted from anyone. */
const DEVICE_TOKEN_KEY = 'trulens_device_token';

/** Minimal User-like object for offline / PC demo mode */
export function createDemoUser(): User {
  return {
    uid: 'local-demo-user',
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
    getIdToken: async () => localStorage.getItem(DEVICE_TOKEN_KEY) || 'local-demo-token',
    getIdTokenResult: async () =>
      ({
        token: localStorage.getItem(DEVICE_TOKEN_KEY) || 'local-demo-token',
        claims: { uid: 'local-demo-user' },
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
  enterDemoMode: () => void;
  signInWithCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemo: false,
  enterDemoMode: () => {},
  signInWithCode: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const enterDemoMode = () => {
    localStorage.setItem(DEMO_KEY, '1');
    setIsDemo(true);
    setUser(createDemoUser());
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

    enterDemoMode();
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
    // Restore offline demo session immediately
    if (localStorage.getItem(DEMO_KEY) === '1') {
      setIsDemo(true);
      setUser(createDemoUser());
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (localStorage.getItem(DEMO_KEY) === '1') {
        // Stay in demo if user chose offline mode
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
