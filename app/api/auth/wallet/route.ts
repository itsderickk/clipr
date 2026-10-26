import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { createSession, getUserById, jwtSecret, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { verifySignature } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHALLENGE_COOKIE = 'clipr_siws';

/** Verifies the signed challenge from /api/auth/nonce and starts a session.
 *  The wallet is both the account and where payouts and refunds are sent. */
export async function POST(req: NextRequest) {
  const fail = (error: string, status = 401) => {
    const res = NextResponse.json({ error }, { status });
    res.cookies.set(CHALLENGE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return res;
  };

  let challenge: { address: string; message: string };
  try {
    const { payload } = await jwtVerify(req.cookies.get(CHALLENGE_COOKIE)?.value || '', jwtSecret());
    challenge = payload as any;
  } catch {
    return fail('Sign-in expired, please try again');
  }

  const b = await req.json().catch(() => ({}));
  if (b.address !== challenge.address) return fail('Wallet changed during sign-in');
  if (typeof b.signature !== 'string' || !verifySignature(challenge.address, challenge.message, b.signature))
    return fail('Signature did not match this wallet');

  try {
    const rows = await db()`
      insert into users (wallet) values (${challenge.address})
      on conflict (wallet) do update set wallet = excluded.wallet
      returning id
    `;
    const res = NextResponse.json({ user: await getUserById(rows[0].id) });
    res.cookies.set(SESSION_COOKIE, await createSession(rows[0].id), sessionCookieOptions());
    res.cookies.set(CHALLENGE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return res;
  } catch (e: any) {
    return fail(e.message || 'Sign-in failed', 500);
  }
}
