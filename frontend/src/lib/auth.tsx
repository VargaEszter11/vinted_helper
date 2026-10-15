import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { loadToken, onTokenChange } from '@/lib/api';

type AuthState = { session: string | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    loadToken().then((token) => setState({ session: token, loading: false }));
    return onTokenChange((token) => setState({ session: token, loading: false }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
