import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const SESSION_KEY = 'truinspect_session';
const DEVICE_TOKEN_KEY = 'truinspect_device_token';
const DEALER_NAME_KEY = 'truinspect_dealer_name';

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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithCode: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    setUser(createDeviceUser(dealerName));
    setLoading(false);
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(DEALER_NAME_KEY);
    setUser(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if never signed into Firebase
    }
  };

  useEffect(() => {
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
    <AuthContext.Provider value={{ user, loading, signInWithCode, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
