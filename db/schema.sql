-- Clipr schema. All money columns are integer cents (USD; 1 USDC = 100 cents).
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet text unique,                         -- Solana address: sign-in identity and payout destination
  whop_user_id text unique,                   -- legacy (Whop sign-in, removed); kept so old rows still load
  username text,
  is_admin boolean not null default false,
  nonce text,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references users(id),
  title text not null,
  description text not null,
  source_url text,
  platforms text[] not null default '{}',
  rate_per_thousand bigint not null,          -- cents per 1,000 views
  budget_cents bigint not null default 0,     -- cached: confirmed deposits minus refunds (see escrow ledger)
  spent_cents bigint not null default 0,      -- cached: pending + confirmed payouts
  min_views bigint not null default 0,
  max_payout_cents bigint,
  requirements text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  constraint spent_within_budget check (spent_cents <= budget_cents)
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  clipper_id uuid not null references users(id),
  url text not null,
  platform text not null,
  status text not null default 'PENDING',
  views bigint not null default 0,
  earned_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, url)
);

-- Legacy Whop-era tables. Nothing writes to them any more; their rows are
-- copied into ledger_entries below so the audit trail stays complete.
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id),
  campaign_id uuid not null references campaigns(id),
  clipper_id uuid not null references users(id),
  amount_cents bigint not null check (amount_cents > 0),
  transfer_id text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  whop_payment_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  creator_id uuid not null references users(id),
  amount_cents bigint not null check (amount_cents > 0),
  transfer_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_campaigns_status on campaigns(status);
create index if not exists idx_campaigns_creator on campaigns(creator_id);
create index if not exists idx_submissions_campaign on submissions(campaign_id);
create index if not exists idx_submissions_clipper on submissions(clipper_id);

/* ======================================================================
   Campaign escrow
   ----------------------------------------------------------------------
   Every campaign gets its own platform-custodied wallet. Creators fund it,
   the platform pays clippers out of it, and unspent budget goes back to the
   creator. The rail (Solana USDC, manual/off-chain, ...) only decides how
   money physically moves; the ledger below is the same for all of them.

   ledger_entries is append-only: a row's amount, kind and campaign never
   change, only its status moves pending -> confirmed | failed, and every
   transition is written to ledger_events. All writes go through the
   escrow_* functions so the balance check, the entry and the cached
   campaign totals change in one atomic statement.
   ====================================================================== */

-- Index source for deriving per-campaign keys from ESCROW_MASTER_SEED.
create sequence if not exists escrow_wallet_index_seq;

create table if not exists escrow_wallets (
  campaign_id uuid primary key references campaigns(id),
  rail text not null,                         -- 'solana' | 'manual'
  currency text not null,                     -- 'USDC' | 'USD'
  address text unique,                        -- public deposit address (null for manual)
  derivation_index bigint unique,             -- re-derives the key from env; the key is never stored
  synced_until text,                          -- rail cursor (e.g. newest seen tx signature)
  created_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  kind text not null check (kind in ('deposit', 'payout', 'refund')),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null check (status in ('pending', 'confirmed', 'failed')),
  rail text not null,
  idempotency_key text not null unique,       -- tx signature for deposits, derived key for sends
  external_ref text,                          -- on-chain signature / bank reference
  submission_id uuid references submissions(id),
  counterparty_id uuid references users(id),  -- clipper paid, or creator refunded / funding
  destination text,                           -- address the money was sent to
  actor_id uuid references users(id),         -- who triggered it (null = system / chain sync)
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ledger_events (
  id bigserial primary key,
  entry_id uuid not null references ledger_entries(id),
  from_status text,
  to_status text not null,
  actor_id uuid references users(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_campaign on ledger_entries(campaign_id, created_at desc);
create index if not exists idx_ledger_pending on ledger_entries(status) where status = 'pending';
create index if not exists idx_ledger_events_entry on ledger_events(entry_id);

/* Credit a confirmed deposit. Idempotent on p_key: a re-synced transaction
   returns the existing row and credits nothing. Activates draft campaigns. */
create or replace function escrow_credit(
  p_campaign uuid, p_amount bigint, p_key text, p_rail text,
  p_ref text, p_counterparty uuid, p_actor uuid, p_memo text
) returns jsonb language plpgsql as $$
declare
  e ledger_entries;
begin
  if p_amount <= 0 then raise exception 'Deposit must be positive'; end if;
  perform 1 from campaigns where id = p_campaign for update;
  if not found then raise exception 'Campaign not found'; end if;

  select * into e from ledger_entries where idempotency_key = p_key;
  if found then return to_jsonb(e) || '{"created": false}'; end if;

  insert into ledger_entries (campaign_id, kind, amount_cents, status, rail, idempotency_key,
                              external_ref, counterparty_id, actor_id, memo)
  values (p_campaign, 'deposit', p_amount, 'confirmed', p_rail, p_key, p_ref, p_counterparty, p_actor, p_memo)
  returning * into e;
  insert into ledger_events (entry_id, from_status, to_status, actor_id, note)
  values (e.id, null, 'confirmed', p_actor, p_memo);

  update campaigns
  set budget_cents = budget_cents + p_amount,
      status = case when status in ('DRAFT', 'COMPLETED') then 'ACTIVE' else status end
  where id = p_campaign;
  return to_jsonb(e) || '{"created": true}';
end $$;

/* Reserve money for an outgoing payout or refund. Locks the campaign,
   checks the available balance, writes a pending entry and moves the cached
   totals so a concurrent send can't spend the same cents. Idempotent on p_key. */
create or replace function escrow_reserve(
  p_campaign uuid, p_kind text, p_amount bigint, p_key text, p_rail text,
  p_submission uuid, p_counterparty uuid, p_destination text, p_actor uuid, p_memo text
) returns jsonb language plpgsql as $$
declare
  c campaigns;
  e ledger_entries;
begin
  if p_kind not in ('payout', 'refund') then raise exception 'Bad kind %', p_kind; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into c from campaigns where id = p_campaign for update;
  if not found then raise exception 'Campaign not found'; end if;

  select * into e from ledger_entries where idempotency_key = p_key;
  if found then return to_jsonb(e) || '{"created": false}'; end if;

  if c.budget_cents - c.spent_cents < p_amount then
    raise exception 'Insufficient escrow balance';
  end if;

  insert into ledger_entries (campaign_id, kind, amount_cents, status, rail, idempotency_key,
                              submission_id, counterparty_id, destination, actor_id, memo)
  values (p_campaign, p_kind, p_amount, 'pending', p_rail, p_key,
          p_submission, p_counterparty, p_destination, p_actor, p_memo)
  returning * into e;
  insert into ledger_events (entry_id, from_status, to_status, actor_id, note)
  values (e.id, null, 'pending', p_actor, p_memo);

  if p_kind = 'payout' then
    update campaigns set spent_cents = spent_cents + p_amount where id = p_campaign;
    if p_submission is not null then
      update submissions set paid_cents = paid_cents + p_amount, updated_at = now() where id = p_submission;
    end if;
  else
    update campaigns set budget_cents = budget_cents - p_amount where id = p_campaign;
  end if;
  return to_jsonb(e) || '{"created": true}';
end $$;

/* Settle a pending payout/refund. 'failed' releases the reservation back
   into the escrow balance. Settling a non-pending entry is a no-op.
   All three functions return the entry as jsonb plus "created": whether this
   call made the change (false = idempotent replay). */
create or replace function escrow_settle(
  p_entry uuid, p_status text, p_ref text, p_actor uuid, p_note text
) returns jsonb language plpgsql as $$
declare
  e ledger_entries;
begin
  if p_status not in ('confirmed', 'failed') then raise exception 'Bad status %', p_status; end if;
  select * into e from ledger_entries where id = p_entry;
  if not found then raise exception 'Entry not found'; end if;
  perform 1 from campaigns where id = e.campaign_id for update;
  select * into e from ledger_entries where id = p_entry for update;
  if e.status <> 'pending' or e.kind = 'deposit' then return to_jsonb(e) || '{"created": false}'; end if;

  update ledger_entries
  set status = p_status, external_ref = coalesce(p_ref, external_ref), updated_at = now()
  where id = p_entry returning * into e;
  insert into ledger_events (entry_id, from_status, to_status, actor_id, note)
  values (e.id, 'pending', p_status, p_actor, p_note);

  if p_status = 'failed' then
    if e.kind = 'payout' then
      update campaigns set spent_cents = spent_cents - e.amount_cents where id = e.campaign_id;
      if e.submission_id is not null then
        update submissions set paid_cents = paid_cents - e.amount_cents, updated_at = now() where id = e.submission_id;
      end if;
    else
      update campaigns set budget_cents = budget_cents + e.amount_cents where id = e.campaign_id;
    end if;
  end if;
  return to_jsonb(e) || '{"created": true}';
end $$;

-- Carry Whop-era money movements into the ledger (no-op when already copied).
insert into ledger_entries (campaign_id, kind, amount_cents, status, rail, idempotency_key, external_ref, memo, created_at)
select campaign_id, 'deposit', amount_cents, 'confirmed', 'whop', 'whop:' || whop_payment_id, whop_payment_id, 'Whop checkout (legacy)', created_at
from deposits on conflict (idempotency_key) do nothing;
insert into ledger_entries (campaign_id, kind, amount_cents, status, rail, idempotency_key, external_ref,
                            submission_id, counterparty_id, memo, created_at)
select campaign_id, 'payout', amount_cents, 'confirmed', 'whop', 'whop:' || transfer_id, transfer_id,
       submission_id, clipper_id, 'Whop transfer (legacy)', created_at
from payouts on conflict (idempotency_key) do nothing;
insert into ledger_entries (campaign_id, kind, amount_cents, status, rail, idempotency_key, external_ref,
                            counterparty_id, memo, created_at)
select campaign_id, 'refund', amount_cents, 'confirmed', 'whop', 'whop:' || transfer_id, transfer_id,
       creator_id, 'Whop refund (legacy)', created_at
from withdrawals on conflict (idempotency_key) do nothing;
