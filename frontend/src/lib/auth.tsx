import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, loadToken, onTokenChange } from '@/lib/api';

type AuthState = { session: string | null; loading: boolean; isAdmin: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState({ session: null as string | null, loading: true });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadToken().then((token) => setAuth({ session: token, loading: false }));
    return onTokenChange((token) => setAuth({ session: token, loading: false }));
  }, []);

  // Whether to show the Admin tab. The server enforces it either way.
  useEffect(() => {
    if (!auth.session) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    api<{ isAdmin: boolean }>('/auth/me')
      .then((me) => !cancelled && setIsAdmin(me.isAdmin))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth.session]);

  return <AuthContext.Provider value={{ ...auth, isAdmin }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
