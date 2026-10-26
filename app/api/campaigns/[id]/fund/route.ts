import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureWallet } from '@/lib/escrow/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns (creating on first call) the campaign's escrow wallet so the
 * creator can send funds to it. Nothing is credited here: deposits land in
 * the ledger only once the rail confirms them (chain sync or admin record).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const c = (await db()`select * from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.creator_id !== user.id)
      return NextResponse.json({ error: 'Only the campaign creator can fund it' }, { status: 403 });

    const wallet = await ensureWallet(c.id);
    return NextResponse.json({ wallet });
  } catch (e: any) {
    const status = /not configured/i.test(e?.message || '') ? 503 : 500;
    return NextResponse.json({ error: e.message || 'Could not open the escrow wallet' }, { status });
  }
}
