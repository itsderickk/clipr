import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { syncDeposits } from '@/lib/escrow/ledger';
import { mapCampaign } from '@/lib/types';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Scan the campaign wallet for new deposits and credit them. Safe to call
 *  repeatedly: each on-chain transaction credits at most once. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const credited = await syncDeposits(params.id);
    const row = (await db()`select * from campaigns where id = ${params.id}`)[0];
    if (!row) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ credited, campaign: mapCampaign(row) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 500 });
  }
}
