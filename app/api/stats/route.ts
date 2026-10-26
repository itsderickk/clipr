import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [agg] = await db()`
      select
        coalesce((select sum(amount_cents) from ledger_entries where kind = 'payout' and status = 'confirmed'), 0) as total_paid,
        (select count(*) from campaigns where status = 'ACTIVE') as active_campaigns,
        (select count(*) from submissions) as total_clips,
        coalesce((select sum(views) from submissions where status = 'APPROVED'), 0) as total_views,
        coalesce((select sum(budget_cents - spent_cents) from campaigns where status = 'ACTIVE'), 0) as escrowed
    `;

    const activity = await db()`
      (select e.kind, e.amount_cents as amount, u.wallet as wallet, c.title, e.created_at
         from ledger_entries e left join users u on u.id = e.counterparty_id join campaigns c on c.id = e.campaign_id
         where e.status = 'confirmed' and e.kind in ('payout', 'deposit')
         order by e.created_at desc limit 8)
      union all
      (select 'campaign' as kind, c.rate_per_thousand as amount, u.wallet as wallet, c.title, c.created_at
         from campaigns c join users u on u.id = c.creator_id
         where c.status = 'ACTIVE'
         order by c.created_at desc limit 6)
      union all
      (select 'clip' as kind, 0 as amount, u.wallet as wallet, c.title, s.created_at
         from submissions s join users u on u.id = s.clipper_id join campaigns c on c.id = s.campaign_id
         order by s.created_at desc limit 6)
      order by created_at desc
      limit 12
    `;

    return NextResponse.json({
      stats: {
        totalPaidCents: Number(agg.total_paid),
        activeCampaigns: Number(agg.active_campaigns),
        totalClips: Number(agg.total_clips),
        totalViews: Number(agg.total_views),
        escrowedCents: Number(agg.escrowed),
      },
      activity: activity.map((a) => ({
        kind: a.kind,
        amount: Number(a.amount),
        wallet: a.wallet,
        title: a.title,
        createdAt: a.created_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load stats' }, { status: 500 });
  }
}
