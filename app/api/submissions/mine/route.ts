import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { mapSubmission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rows = await db()`
      select s.*, c.title as campaign_title, c.rate_per_thousand,
        (select p.transfer_id from payouts p where p.submission_id = s.id order by p.created_at desc limit 1) as last_tx
      from submissions s join campaigns c on c.id = s.campaign_id
      where s.clipper_id = ${user.id}
      order by s.created_at desc
    `;
    return NextResponse.json({ submissions: rows.map(mapSubmission) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load submissions' }, { status: 500 });
  }
}
