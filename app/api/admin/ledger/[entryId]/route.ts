import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { reconcile, settle } from '@/lib/escrow/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only: settle a pending payout/refund.
 *   {}                                   re-check with the rail (on-chain sends)
 *   { status: 'confirmed', reference }   money was sent by hand (manual rail)
 *   { status: 'failed', note }           money did not move; releases the funds
 */
export async function PATCH(req: NextRequest, { params }: { params: { entryId: string } }) {
  try {
    const user = await getUser();
    if (!user?.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    const b = await req.json().catch(() => ({}));

    if (!b.status) return NextResponse.json({ entry: await reconcile(params.entryId, user.id) });
    if (b.status !== 'confirmed' && b.status !== 'failed')
      return NextResponse.json({ error: 'status must be confirmed or failed' }, { status: 400 });

    const entry = await settle(params.entryId, b.status, {
      ref: b.reference ? String(b.reference).slice(0, 200) : null,
      actorId: user.id,
      note: String(b.note || `Marked ${b.status} by admin`).slice(0, 500),
    });
    return NextResponse.json({ entry });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not settle entry' }, { status: 500 });
  }
}
