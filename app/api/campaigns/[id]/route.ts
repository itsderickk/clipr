import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapCampaign } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await db()`
      select c.*, u.wallet as creator_wallet,
        (select count(*) from submissions s where s.campaign_id = c.id) as submission_count,
        (select count(*) from submissions s where s.campaign_id = c.id and s.status = 'PENDING') as pending_count
      from campaigns c join users u on u.id = c.creator_id
      where c.id = ${params.id}
    `;
    if (!rows[0]) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const user = await getUser();
    const campaign = mapCampaign(rows[0]);
    const isOwner = !!user && user.id === campaign.creatorId;
    if (campaign.status === 'DRAFT' && !isOwner && !user?.isAdmin) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json({ campaign, isOwner });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load campaign' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rows = await db()`select * from campaigns where id = ${params.id}`;
    if (!rows[0]) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (rows[0].creator_id !== user.id && !user.isAdmin)
      return NextResponse.json({ error: 'Only the campaign creator or an admin can do this' }, { status: 403 });

    const { status } = await req.json();
    if (!['ACTIVE', 'PAUSED', 'COMPLETED'].includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    if (status === 'ACTIVE' && Number(rows[0].budget_cents) <= 0)
      return NextResponse.json({ error: 'Fund the budget before activating' }, { status: 400 });

    const updated = await db()`
      update campaigns set status = ${status} where id = ${params.id} returning *
    `;
    return NextResponse.json({ campaign: mapCampaign(updated[0]) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}
