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
  /** Returns true when signed in; otherwise prompts and starts wallet sign-in. */
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

/** Minimal injected Solana wallet (Phantom, Solflare, Backpack all expose this). */
interface InjectedWallet {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(msg: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
}

function injectedWallet(): InjectedWallet | null {
  const w = window as any;
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? w.solana ?? null;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)));

function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    api<{ user: User | null }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async () => {
    const wallet = injectedWallet();
    if (!wallet) {
      toast('error', 'Install a Solana wallet such as Phantom to sign in');
      window.open('https://phantom.com/download', '_blank', 'noopener');
      return;
    }
    setSigningIn(true);
    try {
      const { publicKey } = await wallet.connect();
      const address = publicKey.toString();
      const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
      const signed = await wallet.signMessage(new TextEncoder().encode(message), 'utf8');
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      const { user } = await api<{ user: User }>('/api/auth/wallet', {
        method: 'POST',
        body: { address, signature: toBase64(signature) },
      });
      setUser(user);
    } catch (e: any) {
      toast('error', /reject|cancel/i.test(e?.message || '') ? 'Sign-in cancelled' : e?.message || 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  const requireAuth = useCallback(
    (action: string) => {
      if (user) return true;
      toast('info', `Connect your wallet to ${action}`);
      signIn();
      return false;
    },
    [user, toast, signIn]
  );

  const value = useMemo(
    () => ({ user, loading, signingIn, signIn, signOut, requireAuth }),
    [user, loading, signingIn, signIn, signOut, requireAuth]
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
