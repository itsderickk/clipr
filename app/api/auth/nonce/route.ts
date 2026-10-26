import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { jwtSecret } from '@/lib/auth';
import { isSolanaAddress } from '@/lib/solana-address';
import { newNonce, signInMessage } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHALLENGE_COOKIE = 'clipr_siws';

/** Issues the message a wallet must sign. The message rides in a short-lived
 *  signed httpOnly cookie, so the verify step can't be fed a different one. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') || '';
  if (!isSolanaAddress(address)) return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });

  const domain = new URL(process.env.NEXT_PUBLIC_APP_URL || req.url).host;
  const message = signInMessage({ domain, address, nonce: newNonce(), issuedAt: new Date().toISOString() });
  const token = await new SignJWT({ address, message })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(jwtSecret());

  const res = NextResponse.json({ message });
  res.cookies.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 300,
  });
  return res;
}
