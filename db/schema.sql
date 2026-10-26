-- Clipr schema. All money columns are integer cents (USD).
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet text unique,
  whop_user_id text unique,
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
  budget_cents bigint not null default 0,     -- credited only by the Whop webhook
  spent_cents bigint not null default 0,      -- payouts + creator withdrawals
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

-- One row per Whop transfer to a clipper.
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id),
  campaign_id uuid not null references campaigns(id),
  clipper_id uuid not null references users(id),
  amount_cents bigint not null check (amount_cents > 0),
  transfer_id text not null unique,
  created_at timestamptz not null default now()
);

-- One row per Whop payment that funded a campaign. The unique payment id
-- makes webhook retries harmless.
create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  whop_payment_id text not null unique,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

-- Remaining budget returned to a creator by Whop transfer.
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
create index if not exists idx_payouts_submission on payouts(submission_id);
create index if not exists idx_deposits_campaign on deposits(campaign_id);
