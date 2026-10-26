import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { defaultRail } from '@/lib/escrow/rails';
import { connection, feePayer, solanaRail } from '@/lib/escrow/solana';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin-only escrow overview: active rail, fee payer to top up with SOL,
 *  custody totals and every entry still waiting to be settled. */
export async function GET() {
  try {
    const user = await getUser();
    if (!user?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    let payer: { address: string; lamports: number | null } | null = null;
    if (solanaRail.configured()) {
      const address = feePayer().publicKey;
      const lamports = await connection().getBalance(address).catch(() => null);
      payer = { address: address.toBase58(), lamports };
    }
    const [totals] = await db()`
      select coalesce(sum(budget_cents - spent_cents), 0) as held from campaigns
    `;
    const pending = await db()`
      select id, campaign_id, kind, amount_cents, rail, external_ref, destination, created_at
      from ledger_entries where status = 'pending' order by created_at
    `;
    return NextResponse.json({
      rail: defaultRail().id,
      feePayer: payer,
      heldCents: Number(totals.held),
      pending: pending.map((p) => ({ ...p, amount_cents: Number(p.amount_cents) })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load escrow' }, { status: 500 });
  }
}
