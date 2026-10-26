import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapSubmission } from '@/lib/types';
import { urlMatchesPlatform } from '@/lib/format';
import type { Platform } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const c = (await db()`select creator_id from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.creator_id !== user.id && !user.isAdmin)
      return NextResponse.json({ error: 'Only the campaign creator or an admin can review submissions' }, { status: 403 });

    const rows = await db()`
      select s.*, u.wallet as clipper_wallet,
        (select p.transfer_id from payouts p where p.submission_id = s.id order by p.created_at desc limit 1) as last_tx
      from submissions s join users u on u.id = s.clipper_id
      where s.campaign_id = ${params.id}
      order by (s.status = 'PENDING') desc, s.created_at desc
    `;
    return NextResponse.json({ submissions: rows.map(mapSubmission) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load submissions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const c = (await db()`select * from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.status !== 'ACTIVE')
      return NextResponse.json({ error: 'This campaign is not accepting clips right now' }, { status: 400 });
    if (c.creator_id === user.id)
      return NextResponse.json({ error: 'You cannot clip your own campaign' }, { status: 400 });

    const { url, platform } = await req.json();
    if (!url || !platform)
      return NextResponse.json({ error: 'Clip URL and platform required' }, { status: 400 });
    if (!(c.platforms as string[]).includes(platform))
      return NextResponse.json({ error: 'That platform is not part of this campaign' }, { status: 400 });
    if (!urlMatchesPlatform(url, platform as Platform))
      return NextResponse.json({ error: `That link does not look like a ${platform} URL` }, { status: 400 });

    const dupe = await db()`
      select id from submissions where campaign_id = ${params.id} and url = ${url}
    `;
    if (dupe[0]) return NextResponse.json({ error: 'This clip was already submitted' }, { status: 409 });

    const rows = await db()`
      insert into submissions (campaign_id, clipper_id, url, platform)
      values (${params.id}, ${user.id}, ${url}, ${platform})
      returning *
    `;
    return NextResponse.json({ submission: mapSubmission(rows[0]) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Submission failed' }, { status: 500 });
  }
}
