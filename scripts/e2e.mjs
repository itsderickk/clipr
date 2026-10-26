/**
 * End-to-end test of the Clipr API against a running instance.
 * Users are created straight in the database and given session cookies
 * signed with JWT_SECRET (the Whop OAuth hop is skipped). Covers campaign
 * creation, clip submission, review/approval math, auth boundaries and
 * webhook signature rejection. Whop-touching calls are asserted up to the
 * API boundary.
 *
 *   DATABASE_URL=... JWT_SECRET=... BASE=http://127.0.0.1:3100 node scripts/e2e.mjs
 */
import { SignJWT } from 'jose';
import pg from 'pg';

const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
let passed = 0;

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL -', msg); process.exit(1); }
  passed++; console.log('ok   -', msg);
};

async function userCookie(name) {
  const whopId = `user_e2e${Math.random().toString(36).slice(2, 10)}`;
  const { rows } = await pool.query(
    'insert into users (whop_user_id, username) values ($1, $2) returning id', [whopId, name]
  );
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(rows[0].id)
    .setIssuedAt().setExpirationTime('1h').sign(secret);
  return { id: rows[0].id, whopId, cookie: `cuts_session=${jwt}` };
}

async function call(u, path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(u ? { cookie: u.cookie } : {}), ...headers },
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    redirect: 'manual',
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const creator = await userCookie('e2e-creator');
const clipper = await userCookie('e2e-clipper');

let r = await call(creator, '/api/auth/me');
assert(r.data.user?.whopUserId === creator.whopId, 'session resolves to the Whop user');
r = await call(null, '/api/auth/me');
assert(r.data.user === null, 'no cookie, no user');

r = await call(null, '/api/campaigns', { method: 'POST', body: { title: 'x' } });
assert(r.status === 401, 'anonymous cannot create campaigns');

r = await call(creator, '/api/campaigns', {
  method: 'POST',
  body: {
    title: 'E2E campaign', description: 'An end-to-end test campaign.', platforms: ['youtube', 'tiktok'],
    ratePerThousand: '1.20', minViews: 1000, maxPayout: '5',
  },
});
assert(r.status === 201, 'creator creates a campaign');
const camp = r.data.campaign;
assert(camp.ratePerThousand === 120 && camp.maxPayoutCents === 500, 'dollar inputs stored as cents');
assert(camp.status === 'DRAFT' && camp.budgetCents === 0, 'new campaign is an unfunded draft');

r = await call(creator, `/api/campaigns/${camp.id}`, { method: 'PATCH', body: { status: 'ACTIVE' } });
assert(r.status === 400, 'cannot activate without budget');

r = await call(clipper, `/api/campaigns/${camp.id}/fund`, { method: 'POST', body: { amountCents: 1000 } });
assert(r.status === 403 || r.status === 503, 'only the creator can fund');

// Simulate a credited deposit (the webhook path needs a live Whop payment).
await pool.query("update campaigns set status='ACTIVE', budget_cents=2000 where id=$1", [camp.id]);

r = await call(creator, `/api/campaigns/${camp.id}/submissions`, {
  method: 'POST', body: { url: 'https://youtube.com/shorts/abc123', platform: 'youtube' },
});
assert(r.status === 400, 'creator cannot clip own campaign');

r = await call(clipper, `/api/campaigns/${camp.id}/submissions`, {
  method: 'POST', body: { url: 'https://evil.example/abc', platform: 'youtube' },
});
assert(r.status === 400, 'URL must match the platform');

r = await call(clipper, `/api/campaigns/${camp.id}/submissions`, {
  method: 'POST', body: { url: 'https://youtube.com/shorts/abc123', platform: 'youtube' },
});
assert(r.status === 201, 'clipper submits a clip');
const sub = r.data.submission;

r = await call(clipper, `/api/campaigns/${camp.id}/submissions`, {
  method: 'POST', body: { url: 'https://youtube.com/shorts/abc123', platform: 'youtube' },
});
assert(r.status === 409, 'duplicate clip rejected');

r = await call(clipper, `/api/submissions/${sub.id}`, { method: 'PATCH', body: { status: 'APPROVED', views: 1e9 } });
assert(r.status === 403, 'clipper cannot approve own clip');

r = await call(creator, `/api/submissions/${sub.id}`, { method: 'PATCH', body: { status: 'APPROVED', views: 2500 } });
assert(r.status === 200 && r.data.submission.earnedCents === 300, '2,500 views × $1.20/1K = $3.00');

r = await call(creator, `/api/submissions/${sub.id}`, { method: 'PATCH', body: { status: 'APPROVED', views: 100000 } });
assert(r.data.submission.earnedCents === 500, 'earnings capped at max payout');

r = await call(clipper, `/api/submissions/${sub.id}/pay`, { method: 'POST' });
assert(r.status === 403 || r.status === 503, 'clipper cannot pay themselves');

r = await call(clipper, `/api/campaigns/${camp.id}/withdraw`, { method: 'POST' });
assert(r.status === 403 || r.status === 503, 'only the creator can withdraw');

r = await call(null, '/api/webhooks/whop', {
  method: 'POST',
  body: JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_fake', metadata: { kind: 'campaign_fund', campaign_id: camp.id } } }),
  headers: { 'content-type': 'application/json', 'webhook-id': 'msg_1', 'webhook-timestamp': String(Math.floor(Date.now() / 1000)), 'webhook-signature': 'v1,AAAA' },
});
assert(r.status === 401, 'unsigned webhook rejected');
const { rows } = await pool.query('select budget_cents from campaigns where id=$1', [camp.id]);
assert(Number(rows[0].budget_cents) === 2000, 'forged webhook did not credit budget');

r = await call(clipper, '/api/submissions/mine');
assert(r.data.submissions?.some((s) => s.id === sub.id), 'clipper sees their clip');

// cleanup
await pool.query('delete from submissions where campaign_id=$1', [camp.id]);
await pool.query('delete from campaigns where id=$1', [camp.id]);
await pool.query('delete from users where id = any($1)', [[creator.id, clipper.id]]);
await pool.end();
console.log(`\n${passed} checks passed`);
