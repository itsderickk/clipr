import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { transferToUser, whopConfigured } from '@/lib/whop';
import { mapSubmission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!whopConfigured()) return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });

    const rows = await db()`
      select s.*, c.creator_id, c.title as campaign_title, c.budget_cents, c.spent_cents,
             c.status as campaign_status, u.whop_user_id as clipper_whop_id
      from submissions s
      join campaigns c on c.id = s.campaign_id
      join users u on u.id = s.clipper_id
      where s.id = ${params.id}
    `;
    const s = rows[0];
    if (!s) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    if (s.creator_id !== user.id && !user.isAdmin)
      return NextResponse.json({ error: 'Only the campaign creator or an admin can pay this out' }, { status: 403 });
    if (s.status !== 'APPROVED')
      return NextResponse.json({ error: 'Approve the clip before paying' }, { status: 400 });
    if (s.campaign_status === 'COMPLETED')
      return NextResponse.json({ error: 'This campaign is closed' }, { status: 400 });
    if (!s.clipper_whop_id)
      return NextResponse.json({ error: 'This clipper has no Whop account linked' }, { status: 400 });

    const earned = Number(s.earned_cents);
    const paid = Number(s.paid_cents);
    const owed = earned - paid;
    if (owed <= 0) return NextResponse.json({ error: 'Nothing owed on this clip' }, { status: 400 });

    const remaining = Number(s.budget_cents) - Number(s.spent_cents);
    const amountCents = Math.min(owed, remaining);
    if (amountCents <= 0) return NextResponse.json({ error: 'Campaign budget is used up — top it up first' }, { status: 400 });

    // Key is tied to ledger state: a double click or retry before the ledger
    // moves maps to the same Whop transfer, so the clipper is paid once.
    const transfer = await transferToUser({
      destinationUserId: s.clipper_whop_id,
      amountCents,
      idempotenceKey: `payout:${s.id}:${paid}:${amountCents}`,
      notes: `Clipr payout: ${s.campaign_title}`,
      metadata: { kind: 'clip_payout', submission_id: s.id, campaign_id: s.campaign_id },
    });

    // Ledger is written only after Whop accepted the transfer; the unique
    // transfer id stops a retried request from counting it twice.
    const inserted = await db()`
      insert into payouts (submission_id, campaign_id, clipper_id, amount_cents, transfer_id)
      values (${s.id}, ${s.campaign_id}, ${s.clipper_id}, ${amountCents}, ${transfer.id})
      on conflict (transfer_id) do nothing
      returning id
    `;
    if (inserted[0]) {
      await db()`update submissions set paid_cents = paid_cents + ${amountCents}, updated_at = now() where id = ${s.id}`;
      await db()`update campaigns set spent_cents = spent_cents + ${amountCents} where id = ${s.campaign_id}`;
    }
    const updated = await db()`select * from submissions where id = ${s.id}`;

    return NextResponse.json({
      submission: mapSubmission(updated[0]),
      payout: { amountCents, transferId: transfer.id, status: transfer.status, partial: amountCents < owed },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Payout failed' }, { status: 500 });
  }
}
