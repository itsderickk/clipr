import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { sendOut } from '@/lib/escrow/ledger';
import { mapSubmission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Pays what an approved clip is owed from the campaign's escrow wallet. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rows = await db()`
      select s.*, c.creator_id, c.title as campaign_title, c.budget_cents, c.spent_cents,
             c.status as campaign_status, u.wallet as clipper_wallet,
             (select count(*) from ledger_entries e where e.submission_id = s.id and e.kind = 'payout') as attempts
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
    if (!s.clipper_wallet)
      return NextResponse.json({ error: 'This clipper has no payout wallet' }, { status: 400 });

    const earned = Number(s.earned_cents);
    const paid = Number(s.paid_cents);
    const owed = earned - paid;
    if (owed <= 0) return NextResponse.json({ error: 'Nothing owed on this clip' }, { status: 400 });

    const remaining = Number(s.budget_cents) - Number(s.spent_cents);
    const amountCents = Math.min(owed, remaining);
    if (amountCents <= 0) return NextResponse.json({ error: 'Campaign budget is used up — top it up first' }, { status: 400 });

    const entry = await sendOut({
      campaignId: s.campaign_id,
      kind: 'payout',
      amountCents,
      // Tied to ledger state: a double click before the ledger moves maps to
      // the same reservation, so the clipper is paid once. A failed attempt
      // bumps the count, so the next press can retry.
      key: `payout:${s.id}:${Number(s.attempts)}`,
      destination: s.clipper_wallet,
      submissionId: s.id,
      counterpartyId: s.clipper_id,
      actorId: user.id,
      memo: `Payout: ${s.campaign_title}`.slice(0, 200),
    });
    const updated = await db()`select * from submissions where id = ${s.id}`;

    return NextResponse.json({
      submission: mapSubmission(updated[0]),
      payout: {
        amountCents: entry.amountCents,
        transferId: entry.externalRef,
        status: entry.status,
        partial: entry.amountCents < owed,
      },
    });
  } catch (e: any) {
    const status = /insufficient escrow/i.test(e?.message || '') ? 400 : 500;
    return NextResponse.json({ error: e.message || 'Payout failed' }, { status });
  }
}
