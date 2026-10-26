/**
 * Seeds a demo creator + three demo campaigns so the marketplace isn't empty.
 * The demo creator's wallet is a placeholder nobody holds a key for, so nobody
 * can sign in as it, and its campaigns have no escrow wallet — their budgets
 * are display-only.
 *
 *   DATABASE_URL=postgresql://... node scripts/seed.mjs
 *
 * Idempotent: exits if a 'demo-creator' user already exists.
 * To remove the demo rows later, run the reset block in db/seed.sql.
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Money is integer cents; rate is cents per 1,000 views.
const CAMPAIGNS = [
  {
    title: 'Clip our AI keynote',
    description:
      'Demo campaign. Cut the strongest moments from the keynote: reveals, live demos, crowd reactions. Hooks in the first 2 seconds, captions on, vertical crop.',
    source: 'https://youtube.com/@example',
    platforms: '{tiktok,youtube}',
    rate: 120,
    budget: 50000,
    minViews: 1000,
    cap: 25000,
    reqs: 'Vertical 9:16 · burned-in captions · official footage only',
  },
  {
    title: 'Podcast highlights — ep. 42',
    description:
      'Demo campaign. Pull the 30–60s moments that make people want the full episode. Speaker labels and captions required.',
    source: 'https://youtube.com/@example',
    platforms: '{tiktok,instagram,youtube}',
    rate: 80,
    budget: 120000,
    minViews: 500,
    cap: null,
    reqs: 'Captions on · tag the show · no full-episode re-uploads',
  },
  {
    title: 'Launch-day stream, best-ofs',
    description:
      'Demo campaign. Best plays, chat reactions and launch moments from the stream VOD. Meme edits welcome if the moment stays visible.',
    source: 'https://twitch.tv/example',
    platforms: '{x,tiktok}',
    rate: 250,
    budget: 30000,
    minViews: 2500,
    cap: 50000,
    reqs: '15–45s · credit the streamer · CTA in caption',
  },
];

const client = await pool.connect();
try {
  const existing = await client.query("select id from users where username = 'demo-creator' limit 1");
  if (existing.rows.length) {
    console.log('Demo data already present — nothing to do.');
    process.exit(0);
  }
  await client.query('begin');
  const { rows } = await client.query(
    "insert into users (wallet, username) values ('C1iprDemoSeedCreator11111111111111111111111', 'demo-creator') returning id"
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
  console.log(`Seeded demo creator + ${CAMPAIGNS.length} campaigns.`);
} catch (e) {
  await client.query('rollback');
  console.error(e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
