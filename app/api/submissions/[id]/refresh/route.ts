import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapSubmission } from '@/lib/types';
import { computeEarned } from '@/lib/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rows = await db()`
      select s.*, c.creator_id, c.rate_per_thousand, c.min_views, c.max_payout_cents
      from submissions s join campaigns c on c.id = s.campaign_id
      where s.id = ${params.id}
    `;
    const s = rows[0];
    if (!s) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    if (s.creator_id !== user.id && s.clipper_id !== user.id && !user.isAdmin)
      return NextResponse.json({ error: 'Not your submission' }, { status: 403 });

    const key = process.env.YOUTUBE_API_KEY;
    if (s.platform !== 'youtube' || !key) {
      return NextResponse.json({
        error:
          s.platform === 'youtube'
            ? 'Set YOUTUBE_API_KEY to enable automatic view tracking'
            : 'Automatic tracking is available for YouTube links; other platforms are verified at review time',
      }, { status: 400 });
    }

    const vid = youtubeId(s.url);
    if (!vid) return NextResponse.json({ error: 'Could not parse a video ID from this URL' }, { status: 400 });

    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${vid}&key=${key}`,
      { cache: 'no-store' }
    );
    const data = await r.json();
    const views = Number(data?.items?.[0]?.statistics?.viewCount);
    if (!Number.isFinite(views))
      return NextResponse.json({ error: 'YouTube did not return view data for this video' }, { status: 502 });

    let earned = Number(s.earned_cents);
    if (s.status === 'APPROVED') {
      earned = Math.max(
        computeEarned(
          views,
          Number(s.rate_per_thousand),
          Number(s.min_views),
          s.max_payout_cents == null ? null : Number(s.max_payout_cents)
        ),
        Number(s.paid_cents)
      );
    }

    const updated = await db()`
      update submissions set views = ${views}, earned_cents = ${earned}, updated_at = now()
      where id = ${params.id} returning *
    `;
    return NextResponse.json({ submission: mapSubmission(updated[0]) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Refresh failed' }, { status: 500 });
  }
}
