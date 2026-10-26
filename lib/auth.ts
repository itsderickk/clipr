import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';
import type { User } from './types';

export const SESSION_COOKIE = 'cuts_session';
/**
 * Signing key for session + sign-in challenge JWTs. The dev fallback is public (it's
 * in this repo), so production refuses to run without a real JWT_SECRET rather
 * than silently signing tokens anyone could forge.
 */
export function jwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(value || 'dev-secret-change-me');
}
const secret = jwtSecret;

/** Wallet addresses granted platform-admin powers via env, comma-separated. */
export function adminWallets(): string[] {
  return (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
}

export function walletIsEnvAdmin(wallet: string | null | undefined): boolean {
  if (!wallet) return false;
  return adminWallets().includes(wallet);
}

export async function createSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db()`
    select id, wallet, username, is_admin, created_at from users where id = ${id}
  `;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    wallet: rows[0].wallet,
    username: rows[0].username,
    isAdmin: !!rows[0].is_admin || walletIsEnvAdmin(rows[0].wallet),
    createdAt: rows[0].created_at,
  };
}

export async function getUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return await getUserById(payload.sub);
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}
