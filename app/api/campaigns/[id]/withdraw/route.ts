import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { transferToUser, whopConfigured } from '@/lib/whop';
import { mapCampaign } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Returns the unspent budget to the creator's own Whop account and closes the campaign. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!whopConfigured()) return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });

    const c = (await db()`select * from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.creator_id !== user.id)
      return NextResponse.json({ error: 'Only the campaign creator can withdraw' }, { status: 403 });
    if (!user.whopUserId) return NextResponse.json({ error: 'Sign in with Whop to withdraw' }, { status: 400 });

    const budget = Number(c.budget_cents);
    const spent = Number(c.spent_cents);
    const amountCents = budget - spent;
    if (amountCents <= 0) return NextResponse.json({ error: 'Nothing left to withdraw' }, { status: 400 });

    // Stop new payouts first, so the amount we transfer can't be spent underneath us.
    await db()`update campaigns set status = 'COMPLETED' where id = ${c.id}`;

    // Key is tied to ledger state: a retry with the same budget maps to the same transfer.
    const transfer = await transferToUser({
      destinationUserId: user.whopUserId,
      amountCents,
      idempotenceKey: `withdraw:${c.id}:${budget}:${spent}`,
      notes: `Clipr refund: ${c.title}`,
      metadata: { kind: 'campaign_withdraw', campaign_id: c.id },
    });

    const inserted = await db()`
      insert into withdrawals (campaign_id, creator_id, amount_cents, transfer_id)
      values (${c.id}, ${user.id}, ${amountCents}, ${transfer.id})
      on conflict (transfer_id) do nothing
      returning id
    `;
    let row = c;
    if (inserted[0]) {
      row = (await db()`
        update campaigns set budget_cents = budget_cents - ${amountCents}
        where id = ${c.id} returning *
      `)[0];
    }
    return NextResponse.json({ campaign: mapCampaign(row), amountCents, transferId: transfer.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Withdraw failed' }, { status: 500 });
  }
}
