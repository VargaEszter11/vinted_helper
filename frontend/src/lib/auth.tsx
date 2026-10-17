import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, loadToken, onTokenChange } from '@/lib/api';

type AuthState = { session: string | null; loading: boolean; isAdmin: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState({ session: null as string | null, loading: true });
  // The token the server confirmed as the admin's. Signing out or in as someone else
  // changes the token, so a stale answer can never apply to a different session.
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    loadToken().then((token) => setAuth({ session: token, loading: false }));
    return onTokenChange((token) => setAuth({ session: token, loading: false }));
  }, []);

  // Whether to show the Admin tab. The server enforces it either way.
  useEffect(() => {
    const session = auth.session;
    if (!session) return;
    let cancelled = false;
    api<{ isAdmin: boolean }>('/auth/me')
      .then((me) => !cancelled && setAdminToken(me.isAdmin ? session : null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth.session]);

  const isAdmin = auth.session !== null && adminToken === auth.session;
  return <AuthContext.Provider value={{ ...auth, isAdmin }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
