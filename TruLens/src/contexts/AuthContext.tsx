import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const DEMO_KEY = 'trulens_demo_session';

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
    getIdToken: async () => 'local-demo-token',
    getIdTokenResult: async () =>
      ({
        token: 'local-demo-token',
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemo: false,
  enterDemoMode: () => {},
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

  const signOut = async () => {
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
    <AuthContext.Provider value={{ user, loading, isDemo, enterDemoMode, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
