/**
 * End-to-end test of the Clippa API against a running instance.
 * Covers wallet sign-in (real ed25519 signatures), campaign creation, clip
 * submission, review/approval math, auth boundaries and the escrow ledger on
 * the manual rail: deposits, idempotent credits, payout reservations,
 * concurrent pay clicks, settlement, failure release and refunds.
 *
 *   DATABASE_URL=... JWT_SECRET=... BASE=http://127.0.0.1:3100 node scripts/e2e.mjs
 */
import { generateKeyPairSync, sign } from 'crypto';
import bs58 from 'bs58';
import pg from 'pg';

const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let passed = 0;

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL -', msg); process.exit(1); }
  passed++; console.log('ok   -', msg);
};

function newWallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  return { address: bs58.encode(raw), sign: (msg) => sign(null, Buffer.from(msg, 'utf8'), privateKey) };
}

const cookieOf = (res, name) => (res.headers.getSetCookie?.() || []).find((c) => c.startsWith(`${name}=`))?.split(';')[0];

/** Full sign-in: nonce → sign → verify. Returns a user with a session cookie. */
async function signIn(name) {
  const w = newWallet();
  let res = await fetch(`${BASE}/api/auth/nonce?address=${w.address}`);
  const { message } = await res.json();
  const challenge = cookieOf(res, 'clipr_siws');
  res = await fetch(`${BASE}/api/auth/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: challenge },
    body: JSON.stringify({ address: w.address, signature: w.sign(message).toString('base64') }),
  });
  const data = await res.json();
  const session = cookieOf(res, 'cuts_session');
  if (name) await pool.query('update users set username = $1 where id = $2', [name, data.user?.id]);
  return { id: data.user?.id, wallet: w.address, cookie: session, status: res.status, w };
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

const campaignRow = async (id) => (await pool.query('select * from campaigns where id=$1', [id])).rows[0];

/* ---------------- sign-in ---------------- */

const creator = await signIn('e2e-creator');
const clipper = await signIn('e2e-clipper');
const admin = await signIn('e2e-admin');
await pool.query('update users set is_admin = true where id = $1', [admin.id]);
assert(creator.status === 200 && creator.cookie, 'wallet signature starts a session');

let r = await call(creator, '/api/auth/me');
assert(r.data.user?.wallet === creator.wallet, 'session resolves to the signing wallet');
r = await call(null, '/api/auth/me');
assert(r.data.user === null, 'no cookie, no user');

{
  // A signature from a different wallet must not open the session.
  const victim = newWallet();
  const attacker = newWallet();
  let res = await fetch(`${BASE}/api/auth/nonce?address=${victim.address}`);
  const { message } = await res.json();
  res = await fetch(`${BASE}/api/auth/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieOf(res, 'clipr_siws') },
    body: JSON.stringify({ address: victim.address, signature: attacker.sign(message).toString('base64') }),
  });
  assert(res.status === 401, 'signature from another wallet is rejected');
  res = await fetch(`${BASE}/api/auth/wallet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: victim.address, signature: victim.sign(message).toString('base64') }),
  });
  assert(res.status === 401, 'signature without the issued challenge is rejected');
}

/* ---------------- campaign ---------------- */

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

/* ---------------- escrow: open + fund ---------------- */

r = await call(clipper, `/api/campaigns/${camp.id}/fund`, { method: 'POST' });
assert(r.status === 403, 'only the creator can open the escrow wallet');
r = await call(creator, `/api/campaigns/${camp.id}/fund`, { method: 'POST' });
assert(r.status === 200 && r.data.wallet?.rail === 'manual', 'creator opens a manual-rail escrow wallet');
const again = await call(creator, `/api/campaigns/${camp.id}/fund`, { method: 'POST' });
assert(JSON.stringify(again.data.wallet) === JSON.stringify(r.data.wallet), 'one wallet per campaign');

r = await call(creator, `/api/campaigns/${camp.id}/escrow/deposits`, { method: 'POST', body: { amountCents: 2000, reference: 'bank-1' } });
assert(r.status === 403, 'creator cannot self-credit a deposit');
r = await call(admin, `/api/campaigns/${camp.id}/escrow/deposits`, { method: 'POST', body: { amountCents: 2000, reference: 'bank-1' } });
assert(r.status === 201 && r.data.entry.status === 'confirmed', 'admin records a $20 deposit');
r = await call(admin, `/api/campaigns/${camp.id}/escrow/deposits`, { method: 'POST', body: { amountCents: 2000, reference: 'bank-1' } });
assert(r.status === 200, 'recording the same reference again is a no-op');
let c = await campaignRow(camp.id);
assert(Number(c.budget_cents) === 2000 && c.status === 'ACTIVE', 'deposit credited once and campaign activated');

/* ---------------- clips ---------------- */

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

/* ---------------- escrow: payouts ---------------- */

r = await call(clipper, `/api/submissions/${sub.id}/pay`, { method: 'POST' });
assert(r.status === 403, 'clipper cannot pay themselves');

const clicks = await Promise.all(Array.from({ length: 5 }, () => call(creator, `/api/submissions/${sub.id}/pay`, { method: 'POST' })));
const ok = clicks.filter((x) => x.status === 200);
assert(ok.length >= 1 && ok.every((x) => x.data.payout.amountCents === 500), 'pay reserves the $5 owed');
let { rows: payouts } = await pool.query("select * from ledger_entries where submission_id=$1 and kind='payout'", [sub.id]);
assert(payouts.length === 1 && payouts[0].status === 'pending', 'five concurrent clicks make exactly one pending payout');
assert(payouts[0].destination === clipper.wallet, 'payout is addressed to the clipper wallet');
c = await campaignRow(camp.id);
assert(Number(c.spent_cents) === 500, 'reservation counts against the budget');

r = await call(creator, `/api/admin/ledger/${payouts[0].id}`, { method: 'PATCH', body: { status: 'confirmed' } });
assert(r.status === 403, 'creator cannot settle ledger entries');
r = await call(admin, `/api/admin/ledger/${payouts[0].id}`, { method: 'PATCH', body: { status: 'failed', note: 'bounced' } });
assert(r.data.entry?.status === 'failed', 'admin marks the payout failed');
c = await campaignRow(camp.id);
let s = (await pool.query('select paid_cents from submissions where id=$1', [sub.id])).rows[0];
assert(Number(c.spent_cents) === 0 && Number(s.paid_cents) === 0, 'failure releases the reservation');

r = await call(creator, `/api/submissions/${sub.id}/pay`, { method: 'POST' });
assert(r.status === 200 && r.data.payout.status === 'pending', 'a failed payout can be retried');
({ rows: payouts } = await pool.query("select * from ledger_entries where submission_id=$1 and kind='payout' and status='pending'", [sub.id]));
r = await call(admin, `/api/admin/ledger/${payouts[0].id}`, { method: 'PATCH', body: { status: 'confirmed', reference: 'wire-42' } });
assert(r.data.entry?.status === 'confirmed' && r.data.entry.externalRef === 'wire-42', 'admin confirms with a reference');
r = await call(admin, `/api/admin/ledger/${payouts[0].id}`, { method: 'PATCH', body: { status: 'failed' } });
assert(r.data.entry?.status === 'confirmed', 'a settled entry cannot be flipped');

r = await call(creator, `/api/submissions/${sub.id}/pay`, { method: 'POST' });
assert(r.status === 400, 'nothing owed after the payout');

/* ---------------- escrow: refund ---------------- */

r = await call(clipper, `/api/campaigns/${camp.id}/withdraw`, { method: 'POST' });
assert(r.status === 403, 'only the creator can withdraw');
r = await call(creator, `/api/campaigns/${camp.id}/withdraw`, { method: 'POST' });
assert(r.status === 200 && r.data.amountCents === 1500, 'creator withdraws the $15 left');
c = await campaignRow(camp.id);
assert(c.status === 'COMPLETED' && Number(c.budget_cents) - Number(c.spent_cents) === 0, 'campaign closed with nothing left');

/* ---------------- audit ---------------- */

r = await call(null, `/api/campaigns/${camp.id}/escrow`);
assert(r.status === 200 && r.data.entries.length === 4, 'public ledger lists deposit, two payouts and the refund');
assert(r.data.balance.availableCents === 0 && r.data.balance.fundedCents === 500, 'public balance matches');
const { rows: events } = await pool.query(
  'select count(*)::int as n from ledger_events where entry_id in (select id from ledger_entries where campaign_id=$1)', [camp.id]);
assert(events[0].n === 6, 'every status change is in the audit trail');
const { rows: sum } = await pool.query(`
  select coalesce(sum(case when kind='deposit' then amount_cents else -amount_cents end), 0)::int as bal
  from ledger_entries where campaign_id=$1 and status <> 'failed'`, [camp.id]);
assert(sum[0].bal === Number(c.budget_cents) - Number(c.spent_cents), 'ledger sum equals cached campaign balance');

r = await call(clipper, '/api/submissions/mine');
assert(r.data.submissions?.some((x) => x.id === sub.id), 'clipper sees their clip');

// cleanup
await pool.query('delete from ledger_events where entry_id in (select id from ledger_entries where campaign_id=$1)', [camp.id]);
await pool.query('delete from ledger_entries where campaign_id=$1', [camp.id]);
await pool.query('delete from escrow_wallets where campaign_id=$1', [camp.id]);
await pool.query('delete from submissions where campaign_id=$1', [camp.id]);
await pool.query('delete from campaigns where id=$1', [camp.id]);
await pool.query('delete from users where id = any($1)', [[creator.id, clipper.id, admin.id]]);
await pool.end();
console.log(`\n${passed} checks passed`);
