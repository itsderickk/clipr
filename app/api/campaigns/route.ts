import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapCampaign } from '@/lib/types';
import { usdToCents } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PLATFORMS = ['tiktok', 'youtube', 'instagram', 'x'];

export async function GET(req: NextRequest) {
  try {
    const admin = req.nextUrl.searchParams.get('admin') === '1';
    if (admin) {
      const user = await getUser();
      if (!user?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
      const rows = await db()`
        select c.*, u.wallet as creator_wallet,
          (select count(*) from submissions s where s.campaign_id = c.id) as submission_count,
          (select count(*) from submissions s where s.campaign_id = c.id and s.status = 'PENDING') as pending_count
        from campaigns c join users u on u.id = c.creator_id
        order by pending_count desc, c.created_at desc
      `;
      return NextResponse.json({ campaigns: rows.map(mapCampaign) });
    }

    const mine = req.nextUrl.searchParams.get('mine') === '1';
    if (mine) {
      const user = await getUser();
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      const rows = await db()`
        select c.*, u.wallet as creator_wallet,
          (select count(*) from submissions s where s.campaign_id = c.id) as submission_count,
          (select count(*) from submissions s where s.campaign_id = c.id and s.status = 'PENDING') as pending_count
        from campaigns c join users u on u.id = c.creator_id
        where c.creator_id = ${user.id}
        order by c.created_at desc
      `;
      return NextResponse.json({ campaigns: rows.map(mapCampaign) });
    }

    const rows = await db()`
      select c.*, u.wallet as creator_wallet,
        (select count(*) from submissions s where s.campaign_id = c.id) as submission_count
      from campaigns c join users u on u.id = c.creator_id
      where c.status in ('ACTIVE', 'PAUSED', 'COMPLETED')
      order by (c.status = 'ACTIVE') desc, c.created_at desc
      limit 60
    `;
    return NextResponse.json({ campaigns: rows.map(mapCampaign) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const b = await req.json();
    const title = String(b.title || '').trim();
    const description = String(b.description || '').trim();
    const platforms: string[] = Array.isArray(b.platforms)
      ? b.platforms.filter((p: string) => VALID_PLATFORMS.includes(p))
      : [];
    // Rates and caps arrive in dollars from the form; store integer cents.
    const rateCents = usdToCents(Number(b.ratePerThousand));
    const minViews = Math.max(0, Math.floor(Number(b.minViews) || 0));
    const maxPayoutCents =
      b.maxPayout == null || b.maxPayout === '' ? null : usdToCents(Number(b.maxPayout));
    const sourceUrl = b.sourceUrl ? String(b.sourceUrl).trim() : null;

    if (title.length < 3) return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 });
    if (description.length < 10) return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 });
    if (platforms.length === 0) return NextResponse.json({ error: 'Pick at least one platform' }, { status: 400 });
    if (!Number.isInteger(rateCents) || rateCents < 1) return NextResponse.json({ error: 'Rate must be at least $0.01 per 1K views' }, { status: 400 });
    if (maxPayoutCents != null && (!Number.isInteger(maxPayoutCents) || maxPayoutCents < 1))
      return NextResponse.json({ error: 'Max payout must be greater than 0' }, { status: 400 });
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
      return NextResponse.json({ error: 'Source link must start with http(s)://' }, { status: 400 });

    const rows = await db()`
      insert into campaigns
        (creator_id, title, description, source_url, platforms, rate_per_thousand,
         min_views, max_payout_cents, requirements, status)
      values
        (${user.id}, ${title}, ${description}, ${sourceUrl}, ${platforms},
         ${rateCents}, ${minViews}, ${maxPayoutCents}, ${b.requirements || null}, 'DRAFT')
      returning *
    `;
    return NextResponse.json({ campaign: mapCampaign(rows[0]) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create campaign' }, { status: 500 });
  }
}
