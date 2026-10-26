import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Whop money + identity client. All money movement runs through Whop:
 *  checkout funds a campaign, transfers pay clippers and refund creators,
 *  and the payment webhook is the only thing that credits a budget. */

const BASE = process.env.WHOP_API_BASE || 'https://api.whop.com/api/v1';
const OAUTH_BASE = process.env.WHOP_OAUTH_BASE || 'https://api.whop.com/oauth';

export function whopConfigured(): boolean {
  return !!(process.env.WHOP_API_KEY && process.env.WHOP_COMPANY_ID);
}

export function whopOAuthConfigured(): boolean {
  return !!process.env.WHOP_CLIENT_ID;
}

export function whopCompanyId(): string {
  return process.env.WHOP_COMPANY_ID || '';
}

async function whop<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.WHOP_API_KEY}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.message || body?.error || `Whop API ${res.status}`);
  }
  return body as T;
}

/** Whop amounts are major units (dollars); Clipr stores integer cents. */
const toDollars = (cents: number) => Math.round(cents) / 100;
export const toCents = (dollars: unknown) => Math.round(Number(dollars) * 100);

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/** One-time checkout link that funds a specific campaign. The campaign id
 *  rides in metadata, which Whop copies onto the resulting payment — the
 *  webhook uses it to credit the right budget. */
export async function createCampaignCheckout(opts: {
  amountCents: number;
  campaignId: string;
  title: string;
  redirectUrl?: string;
}): Promise<{ checkoutUrl: string; planId: string }> {
  const res = await whop<any>('/checkout_configurations', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'payment',
      plan: {
        company_id: whopCompanyId(),
        currency: 'usd',
        plan_type: 'one_time',
        initial_price: toDollars(opts.amountCents),
        title: `Fund: ${opts.title}`.slice(0, 80),
      },
      metadata: { kind: 'campaign_fund', campaign_id: opts.campaignId },
      ...(opts.redirectUrl ? { redirect_url: opts.redirectUrl } : {}),
    }),
  });
  const checkoutUrl = res?.purchase_url;
  if (!checkoutUrl) throw new Error('Whop did not return a checkout link');
  return { checkoutUrl, planId: res?.plan?.id || '' };
}

/** Re-read a payment from Whop so the webhook never trusts its own body for
 *  the amount, status or campaign. */
export async function getPayment(id: string): Promise<any> {
  return whop<any>(`/payments/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* Transfers                                                           */
/* ------------------------------------------------------------------ */

/** Move funds from the platform's Whop balance to a user's Whop balance.
 *  `idempotenceKey` must be derived from ledger state so a retried or
 *  concurrent request maps to the same transfer instead of paying twice. */
export async function transferToUser(opts: {
  destinationUserId: string;
  amountCents: number;
  idempotenceKey: string;
  notes: string;
  metadata?: Record<string, string>;
}): Promise<{ id: string; status: string }> {
  if (!Number.isInteger(opts.amountCents) || opts.amountCents <= 0) throw new Error('Invalid transfer amount');
  const res = await whop<any>('/transfers', {
    method: 'POST',
    headers: { 'idempotency-key': opts.idempotenceKey },
    body: JSON.stringify({
      type: 'balance',
      origin_id: whopCompanyId(),
      destination_id: opts.destinationUserId,
      amount: toDollars(opts.amountCents),
      currency: 'usd',
      idempotence_key: opts.idempotenceKey,
      notes: opts.notes.slice(0, 50),
      metadata: opts.metadata || {},
    }),
  });
  if (!res?.id) throw new Error('Whop did not return a transfer id');
  if (res.status === 'failed') throw new Error('Whop rejected the transfer');
  return { id: res.id, status: res.status || 'processing' };
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

const WEBHOOK_TOLERANCE_S = 5 * 60;

function webhookKey(): Buffer {
  const raw = process.env.WHOP_WEBHOOK_SECRET || '';
  if (raw.startsWith('whsec_')) return Buffer.from(raw.slice(6), 'base64');
  return Buffer.from(raw, 'utf8');
}

/** Verify a Standard Webhooks signature (webhook-id / webhook-timestamp /
 *  webhook-signature: "v1,<base64 hmac-sha256>"). Constant-time compare,
 *  bounded timestamp. Returns false on anything malformed. */
export function verifyWebhook(headers: Headers, body: string): boolean {
  if (!process.env.WHOP_WEBHOOK_SECRET) return false;
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature');
  if (!id || !ts || !sigHeader) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > WEBHOOK_TOLERANCE_S) return false;

  const expected = createHmac('sha256', webhookKey()).update(`${id}.${ts}.${body}`).digest();
  for (const part of sigHeader.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const given = Buffer.from(sig, 'base64');
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* OAuth 2.1 + PKCE ("Sign in with Whop")                              */
/* ------------------------------------------------------------------ */

const b64url = (buf: Buffer) => buf.toString('base64url');

export function newPkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)) };
}

export function authorizeUrl(opts: { redirectUri: string; state: string; nonce: string; challenge: string }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOP_CLIENT_ID || '',
    redirect_uri: opts.redirectUri,
    scope: 'openid profile email',
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
  });
  return `${OAUTH_BASE}/authorize?${p.toString()}`;
}

export async function exchangeCode(opts: { code: string; redirectUri: string; verifier: string }): Promise<string> {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: process.env.WHOP_CLIENT_ID,
      ...(process.env.WHOP_CLIENT_SECRET ? { client_secret: process.env.WHOP_CLIENT_SECRET } : {}),
      code_verifier: opts.verifier,
    }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    throw new Error(body?.error_description || body?.error || 'Whop sign-in failed');
  }
  return body.access_token as string;
}

export async function fetchUserInfo(accessToken: string): Promise<{ id: string; username: string | null }> {
  const res = await fetch(`${OAUTH_BASE}/userinfo`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body?.sub !== 'string' || !body.sub.startsWith('user_')) {
    throw new Error('Could not read your Whop profile');
  }
  return { id: body.sub, username: body.preferred_username || body.name || null };
}

export function appOrigin(reqUrl: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(reqUrl).origin).replace(/\/$/, '');
}
