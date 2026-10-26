'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { ToastProvider, useToast } from './toast';

interface AuthState {
  user: User | null;
  /** Address of the connected wallet, known even if the server session failed. */
  wallet: string | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  /** Returns true when signed in; otherwise prompts and starts wallet sign-in. */
  requireAuth: (action: string) => boolean;
}

const AuthCtx = createContext<AuthState>({
  user: null,
  wallet: null,
  loading: true,
  signingIn: false,
  signIn: () => {},
  signOut: async () => {},
  requireAuth: () => false,
});

export const useAuth = () => useContext(AuthCtx);

/** Minimal injected Solana wallet (Phantom, Solflare, Backpack all expose this). */
interface InjectedWallet {
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } } | void>;
  disconnect?(): Promise<void>;
  publicKey?: { toString(): string } | null;
  signMessage(msg: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
}

function injectedWallet(): InjectedWallet | null {
  const w = window as any;
  return w.phantom?.solana ?? w.solflare ?? w.backpack ?? w.solana ?? null;
}

const WALLET_KEY = 'clipr:wallet';

/** Phantom returns { publicKey }; some wallets resolve void and set wallet.publicKey. */
async function connectWallet(wallet: InjectedWallet, onlyIfTrusted = false): Promise<string> {
  const res = await wallet.connect(onlyIfTrusted ? { onlyIfTrusted } : undefined);
  const key = (res && 'publicKey' in res ? res.publicKey : null) ?? wallet.publicKey;
  if (!key) throw new Error('Wallet did not share an address');
  return key.toString();
}

/** Turn server errors into something a person can act on. */
function signInError(e: any): string {
  const msg = String(e?.message || '');
  if (/reject|cancel|denied/i.test(msg)) return 'Sign-in cancelled';
  if (/DATABASE_URL|JWT_SECRET|not set|Request failed \(5/i.test(msg))
    return 'Wallet connected, but the server could not save your sign-in. The site is missing its database settings.';
  return msg || 'Sign-in failed';
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)));

function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [signingIn, setSigningIn] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);

  const rememberWallet = useCallback((address: string | null) => {
    setWallet(address);
    try {
      if (address) localStorage.setItem(WALLET_KEY, address);
      else localStorage.removeItem(WALLET_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    api<{ user: User | null }>('/api/auth/me')
      .then((d) => {
        setUser(d.user);
        if (d.user?.wallet) rememberWallet(d.user.wallet);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Show a wallet connected on an earlier visit without prompting again.
    try {
      if (localStorage.getItem(WALLET_KEY)) {
        const w = injectedWallet();
        if (w) connectWallet(w, true).then(rememberWallet).catch(() => {});
      }
    } catch {}
  }, [rememberWallet]);

  const signIn = useCallback(async () => {
    const wallet = injectedWallet();
    if (!wallet) {
      toast('error', 'Install a Solana wallet such as Phantom to sign in');
      window.open('https://phantom.com/download', '_blank', 'noopener');
      return;
    }
    setSigningIn(true);
    try {
      const address = await connectWallet(wallet);
      rememberWallet(address);
      const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
      const signed = await wallet.signMessage(new TextEncoder().encode(message), 'utf8');
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      const { user } = await api<{ user: User }>('/api/auth/wallet', {
        method: 'POST',
        body: { address, signature: toBase64(signature) },
      });
      setUser(user);
      toast('success', 'Signed in');
    } catch (e: any) {
      toast('error', signInError(e));
    } finally {
      setSigningIn(false);
    }
  }, [toast, rememberWallet]);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await injectedWallet()?.disconnect?.().catch(() => {});
    setUser(null);
    rememberWallet(null);
  }, [rememberWallet]);

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
    () => ({ user, wallet, loading, signingIn, signIn, signOut, requireAuth }),
    [user, wallet, loading, signingIn, signIn, signOut, requireAuth]
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
