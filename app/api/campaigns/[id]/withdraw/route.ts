import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { sendOut } from '@/lib/escrow/ledger';
import { mapCampaign } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Refunds the unspent escrow balance to the creator's wallet and closes the campaign. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const c = (await db()`
      select c.*, (select count(*) from ledger_entries e where e.campaign_id = c.id and e.kind = 'refund') as attempts
      from campaigns c where c.id = ${params.id}
    `)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.creator_id !== user.id)
      return NextResponse.json({ error: 'Only the campaign creator can withdraw' }, { status: 403 });
    if (!user.wallet) return NextResponse.json({ error: 'Connect a wallet to withdraw' }, { status: 400 });

    const budget = Number(c.budget_cents);
    const spent = Number(c.spent_cents);
    const amountCents = budget - spent;
    if (amountCents <= 0) return NextResponse.json({ error: 'Nothing left to withdraw' }, { status: 400 });

    // Stop new payouts first so nothing else reserves against this balance.
    await db()`update campaigns set status = 'COMPLETED' where id = ${c.id}`;

    const entry = await sendOut({
      campaignId: c.id,
      kind: 'refund',
      amountCents,
      // Tied to ledger state: a retry before the ledger moves maps to the same refund.
      key: `refund:${c.id}:${Number(c.attempts)}`,
      destination: user.wallet,
      counterpartyId: user.id,
      actorId: user.id,
      memo: `Refund: ${c.title}`.slice(0, 200),
    });
    const row = (await db()`select * from campaigns where id = ${c.id}`)[0];
    return NextResponse.json({ campaign: mapCampaign(row), amountCents: entry.amountCents, entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Withdraw failed' }, { status: 500 });
  }
}
