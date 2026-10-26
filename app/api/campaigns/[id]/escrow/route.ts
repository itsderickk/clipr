import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getWallet, listEntries } from '@/lib/escrow/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public view of a campaign's escrow: wallet, balance and ledger. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const c = (await db()`select id, budget_cents, spent_cents from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const [wallet, entries] = await Promise.all([getWallet(c.id), listEntries(c.id)]);
    const budget = Number(c.budget_cents);
    const spent = Number(c.spent_cents);
    return NextResponse.json({
      wallet,
      balance: { fundedCents: budget, spentCents: spent, availableCents: budget - spent },
      entries,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load escrow' }, { status: 500 });
  }
}
