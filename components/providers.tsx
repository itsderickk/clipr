'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { ToastProvider, useToast } from './toast';

interface AuthState {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Returns true when signed in; otherwise prompts and starts Whop sign-in. */
  requireAuth: (action: string) => boolean;
}

const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  signingIn: false,
  signIn: () => {},
  signOut: async () => {},
  requireAuth: () => false,
});

export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Surface sign-in errors handed back by the OAuth callback, then clean the URL.
    const url = new URL(window.location.href);
    const err = url.searchParams.get('auth_error');
    if (err) {
      toast('error', err);
      url.searchParams.delete('auth_error');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, [toast]);

  const signIn = useCallback(() => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/whop/start?next=${encodeURIComponent(next)}`;
  }, []);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  const requireAuth = useCallback(
    (action: string) => {
      if (user) return true;
      toast('info', `Sign in with Whop to ${action}`);
      signIn();
      return false;
    },
    [user, toast, signIn]
  );

  const value = useMemo(
    () => ({ user, loading, signingIn: false, signIn, signOut, requireAuth }),
    [user, loading, signIn, signOut, requireAuth]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
