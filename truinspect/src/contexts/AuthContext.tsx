import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const SESSION_KEY = 'truinspect_session';
const DEVICE_TOKEN_KEY = 'truinspect_device_token';
const DEALER_NAME_KEY = 'truinspect_dealer_name';
const DEMO_KEY = 'truinspect_demo_session';

/** Minimal User-like object for device-token sessions. */
function createDeviceUser(dealerName?: string): User {
  const label = dealerName || 'Inspector';
  return {
    uid: 'device',
    email: null,
    emailVerified: false,
    isAnonymous: false,
    displayName: label,
    photoURL: null,
    phoneNumber: null,
    providerId: 'device',
    metadata: {} as any,
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => localStorage.getItem(DEVICE_TOKEN_KEY) || '',
    getIdTokenResult: async () =>
      ({
        token: localStorage.getItem(DEVICE_TOKEN_KEY) || '',
        claims: { uid: 'device' },
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 86400000).toISOString(),
        signInProvider: 'device',
        signInSecondFactor: null,
      }) as any,
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

/** Minimal User-like object for demo mode */
function createDemoUser(uid: string, token: string): User {
  return {
    uid,
    email: 'demo@truinspect.local',
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
    getIdToken: async () => token,
    getIdTokenResult: async () =>
      ({
        token,
        claims: { uid },
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
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Demo unavailable');
      localStorage.setItem(DEMO_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
      localStorage.setItem(DEVICE_TOKEN_KEY, data.token);
      setIsDemo(true);
      setUser(createDemoUser(data.uid, data.token));
      setLoading(false);
    } catch (e) {
      // Fallback
      setIsDemo(true);
      setUser(createDemoUser('local-demo-user', 'local-demo-token'));
      setLoading(false);
    }
  };

  const signInWithCode = async (code: string) => {
    const res = await fetch('/api/auth/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not sign in on this device.');
    localStorage.setItem(DEVICE_TOKEN_KEY, data.token);
    const dealerName = data.dealerName || '';
    if (dealerName) localStorage.setItem(DEALER_NAME_KEY, dealerName);
    localStorage.setItem(SESSION_KEY, '1');
    setIsDemo(false);
    setUser(createDeviceUser(dealerName));
    setLoading(false);
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(DEALER_NAME_KEY);
    localStorage.removeItem(DEMO_KEY);
    setIsDemo(false);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if never signed into Firebase
    }
  };

  useEffect(() => {
    // Check for existing demo session
    const demoRaw = localStorage.getItem(DEMO_KEY);
    if (demoRaw && Number(demoRaw) > Date.now() && localStorage.getItem(DEVICE_TOKEN_KEY)) {
      setIsDemo(true);
      setUser(createDemoUser('demo-resumed', localStorage.getItem(DEVICE_TOKEN_KEY) || ''));
      setLoading(false);
      return;
    }
    if (localStorage.getItem(SESSION_KEY) === '1' && localStorage.getItem(DEVICE_TOKEN_KEY)) {
      const dealerName = localStorage.getItem(DEALER_NAME_KEY) || '';
      setUser(createDeviceUser(dealerName));
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (localStorage.getItem(SESSION_KEY) === '1' && localStorage.getItem(DEVICE_TOKEN_KEY)) {
        const dealerName = localStorage.getItem(DEALER_NAME_KEY) || '';
        setUser(createDeviceUser(dealerName));
        setLoading(false);
        return;
      }
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
