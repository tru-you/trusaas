import { createContext, useContext } from 'react';

interface AuthContextType {
  user: null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: false });

export const useAuth = () => useContext(AuthContext);
