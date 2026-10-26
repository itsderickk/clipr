import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { credit, ensureWallet } from '@/lib/escrow/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CENTS = 10_000_000; // $100,000 per entry

/** Admin-only: record an off-chain deposit (manual rail) once the money is
 *  in the platform account. `reference` (bank / processor id) is the
 *  idempotency key, so recording the same transfer twice credits once. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const c = (await db()`select id, creator_id from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const wallet = await ensureWallet(c.id);
    if (wallet.rail !== 'manual')
      return NextResponse.json({ error: 'On-chain deposits are credited by sync, not by hand' }, { status: 400 });

    const b = await req.json().catch(() => ({}));
    const amountCents = Math.floor(Number(b.amountCents));
    const reference = String(b.reference || '').trim();
    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_CENTS)
      return NextResponse.json({ error: 'Amount must be between $0.01 and $100,000' }, { status: 400 });
    if (reference.length < 3) return NextResponse.json({ error: 'A payment reference is required' }, { status: 400 });

    const entry = await credit({
      campaignId: c.id,
      amountCents,
      key: `manual:${reference}`,
      rail: 'manual',
      ref: reference,
      counterpartyId: c.creator_id,
      actorId: user.id,
      memo: String(b.memo || 'Manual deposit').slice(0, 200),
    });
    return NextResponse.json({ entry }, { status: entry.created ? 201 : 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not record deposit' }, { status: 500 });
  }
}
