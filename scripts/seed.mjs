/**
 * Seeds a Clipr creator + one campaign per platform (TikTok, YouTube, Instagram, X),
 * each asking clippers to post about Clipr itself. The creator's wallet is a placeholder nobody holds a key for, so nobody
 * can sign in as it, and its campaigns have no escrow wallet — their budgets
 * are display-only.
 *
 *   DATABASE_URL=postgresql://... node scripts/seed.mjs
 *
 * Idempotent: exits if a 'clipr' user already exists.
 * To remove the demo rows later, run the reset block in db/seed.sql.
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Money is integer cents; rate is cents per 1,000 views. Four campaigns × $1,250 = $5,000 live budget.
const CAMPAIGNS = [
  {
    title: 'Clipr — TikTok launch clips',
    description:
      'Make short TikToks about Clipr: creators fund a campaign, clippers post, and every verified 1,000 views pays out. Show the dashboard or a payout moment in the first 3 seconds.',
    source: 'https://github.com/itsderickk/clipr',
    platforms: '{tiktok}',
    rate: 100,
    budget: 125000,
    minViews: 1000,
    cap: 25000,
    reqs: 'Vertical 9:16 · captions on · tag @clipr',
  },
  {
    title: 'Clipr — YouTube Shorts explainers',
    description:
      'Explain Clipr in under 60 seconds on YouTube Shorts: how campaigns are funded, how views are verified, and how clippers get paid in USDC.',
    source: 'https://github.com/itsderickk/clipr',
    platforms: '{youtube}',
    rate: 150,
    budget: 125000,
    minViews: 1000,
    cap: 25000,
    reqs: 'Vertical 9:16 · under 60s · link clipr in the description',
  },
  {
    title: 'Clipr — Instagram Reels',
    description:
      'Reels about clipping for Clipr campaigns: a day of clipping, first payout, or picking a campaign. Keep it fast and caption every line.',
    source: 'https://github.com/itsderickk/clipr',
    platforms: '{instagram}',
    rate: 80,
    budget: 125000,
    minViews: 1000,
    cap: 25000,
    reqs: 'Vertical 9:16 · captions on · tag @clipr',
  },
  {
    title: 'Clipr — Posts on X',
    description:
      'Post clips or short videos on X that show what Clipr is and why clippers use it. Threads with an attached clip count if the clip is yours.',
    source: 'https://github.com/itsderickk/clipr',
    platforms: '{x}',
    rate: 120,
    budget: 125000,
    minViews: 1000,
    cap: 25000,
    reqs: 'Native video · mention @clipr · no reposted footage',
  },
];

const client = await pool.connect();
try {
  const existing = await client.query("select id from users where username = 'clipr' limit 1");
  if (existing.rows.length) {
    console.log('Demo data already present — nothing to do.');
    process.exit(0);
  }
  await client.query('begin');
  const { rows } = await client.query(
    "insert into users (wallet, username) values ('C1iprCampaignSeedCreator1111111111111111111', 'clipr') returning id"
  );
  const creatorId = rows[0].id;
  for (const c of CAMPAIGNS) {
    await client.query(
      `insert into campaigns
        (creator_id, title, description, source_url, platforms, rate_per_thousand,
         budget_cents, min_views, max_payout_cents, requirements, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE')`,
      [creatorId, c.title, c.description, c.source, c.platforms, c.rate, c.budget, c.minViews, c.cap, c.reqs]
    );
  }
  await client.query('commit');
  console.log(`Seeded Clipr creator + ${CAMPAIGNS.length} campaigns.`);
} catch (e) {
  await client.query('rollback');
  console.error(e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
