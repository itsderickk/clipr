import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [agg] = await db()`
      select
        coalesce((select sum(amount_cents) from payouts), 0) as total_paid,
        (select count(*) from campaigns where status = 'ACTIVE') as active_campaigns,
        (select count(*) from submissions) as total_clips,
        coalesce((select sum(views) from submissions where status = 'APPROVED'), 0) as total_views,
        coalesce((select sum(budget_cents - spent_cents) from campaigns where status = 'ACTIVE'), 0) as escrowed
    `;

    const activity = await db()`
      (select 'payout' as kind, p.amount_cents as amount, coalesce(u.whop_user_id, u.wallet) as wallet, c.title, p.created_at
         from payouts p join users u on u.id = p.clipper_id join campaigns c on c.id = p.campaign_id
         order by p.created_at desc limit 6)
      union all
      (select 'campaign' as kind, c.rate_per_thousand as amount, coalesce(u.whop_user_id, u.wallet) as wallet, c.title, c.created_at
         from campaigns c join users u on u.id = c.creator_id
         where c.status = 'ACTIVE'
         order by c.created_at desc limit 6)
      union all
      (select 'clip' as kind, 0 as amount, coalesce(u.whop_user_id, u.wallet) as wallet, c.title, s.created_at
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
