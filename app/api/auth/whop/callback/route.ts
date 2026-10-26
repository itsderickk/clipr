import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { createSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { appOrigin, exchangeCode, fetchUserInfo } from '@/lib/whop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_COOKIE = 'clipr_oauth';
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');

export async function GET(req: NextRequest) {
  const origin = appOrigin(req.url);
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`);
    res.cookies.set(OAUTH_COOKIE, '', { path: '/api/auth/whop', maxAge: 0 });
    return res;
  };

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (req.nextUrl.searchParams.get('error')) return fail('Whop sign-in was cancelled');
  if (!code || !state) return fail('Missing sign-in code');

  let flow: { verifier: string; state: string; next: string };
  try {
    const { payload } = await jwtVerify(req.cookies.get(OAUTH_COOKIE)?.value || '', secret());
    flow = payload as any;
  } catch {
    return fail('Sign-in expired, please try again');
  }
  if (flow.state !== state) return fail('Sign-in state mismatch');

  try {
    const accessToken = await exchangeCode({
      code,
      redirectUri: `${origin}/api/auth/whop/callback`,
      verifier: flow.verifier,
    });
    const profile = await fetchUserInfo(accessToken);

    const rows = await db()`
      insert into users (whop_user_id, username)
      values (${profile.id}, ${profile.username})
      on conflict (whop_user_id) do update set username = coalesce(excluded.username, users.username)
      returning id
    `;
    const session = await createSession(rows[0].id);
    const res = NextResponse.redirect(`${origin}${flow.next || '/dashboard'}`);
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    res.cookies.set(OAUTH_COOKIE, '', { path: '/api/auth/whop', maxAge: 0 });
    return res;
  } catch (e: any) {
    return fail(e.message || 'Whop sign-in failed');
  }
}
