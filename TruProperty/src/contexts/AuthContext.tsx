import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const DEMO_KEY = 'truestate_demo_session';
const DEVICE_TOKEN_KEY = 'truestate_device_token';

/** Minimal User-like object for offline / PC demo mode */
export function createDemoUser(): User {
  return {
    uid: 'local-demo-user',
    email: 'demo@truestate.local',
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
    /* Falls back to the legacy literal only while no access code is set on the
       server — with one configured that string is simply a wrong token. */
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

  /** Swap the inspector access code for a signed device token. */
  const signInWithCode = async (code: string) => {
    const res = await fetch('/api/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not sign in on this device.');
    localStorage.setItem(DEVICE_TOKEN_KEY, data.token);
    // Reuses the offline session shape — the difference is the token it now
    // carries, which is the thing the server actually checks.
    enterDemoMode();
  };

  const signOut = async () => {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
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
