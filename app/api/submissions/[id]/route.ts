import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapSubmission } from '@/lib/types';
import { computeEarned } from '@/lib/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (s.creator_id !== user.id && !user.isAdmin)
      return NextResponse.json({ error: 'Only the campaign creator or an admin can review this' }, { status: 403 });

    const body = await req.json();
    const status = body.status as string;
    if (!['APPROVED', 'REJECTED'].includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    let views = Number(s.views);
    let earned = 0;
    if (status === 'APPROVED') {
      views = Math.max(0, Math.floor(Number(body.views ?? s.views) || 0));
      earned = computeEarned(
        views,
        Number(s.rate_per_thousand),
        Number(s.min_views),
        s.max_payout_cents == null ? null : Number(s.max_payout_cents)
      );
      // never drop earned below what has already been paid out
      earned = Math.max(earned, Number(s.paid_cents));
    }

    const updated = await db()`
      update submissions
      set status = ${status}, views = ${views}, earned_cents = ${earned}, updated_at = now()
      where id = ${params.id}
      returning *
    `;
    return NextResponse.json({ submission: mapSubmission(updated[0]) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Review failed' }, { status: 500 });
  }
}
