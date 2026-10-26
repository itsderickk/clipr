import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { appOrigin, authorizeUrl, newPkce, whopOAuthConfigured } from '@/lib/whop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_COOKIE = 'clipr_oauth';
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export async function GET(req: NextRequest) {
  const origin = appOrigin(req.url);
  if (!whopOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent('Whop sign-in is not configured')}`);
  }
  const { verifier, challenge, state, nonce } = newPkce();
  const next = req.nextUrl.searchParams.get('next') || '/dashboard';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  // PKCE verifier + state live in a short-lived signed, httpOnly cookie.
  const token = await new SignJWT({ verifier, state, next: safeNext })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10m')
    .sign(secret());

  const res = NextResponse.redirect(
    authorizeUrl({ redirectUri: `${origin}/api/auth/whop/callback`, state, nonce, challenge })
  );
  res.cookies.set(OAUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/whop',
    maxAge: 600,
  });
  return res;
}
