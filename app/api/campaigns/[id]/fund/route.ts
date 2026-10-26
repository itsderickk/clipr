import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { appOrigin, createCampaignCheckout, whopConfigured } from '@/lib/whop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_CENTS = 100; // $1
const MAX_CENTS = 10_000_000; // $100,000 per checkout

/**
 * Creates a Whop checkout that funds this campaign. Nothing is credited here:
 * the budget only moves when the signed payment webhook arrives.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!whopConfigured()) return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });

    const c = (await db()`select * from campaigns where id = ${params.id}`)[0];
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (c.creator_id !== user.id)
      return NextResponse.json({ error: 'Only the campaign creator can fund it' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const amountCents = Math.floor(Number(body.amountCents));
    if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS)
      return NextResponse.json({ error: 'Amount must be between $1 and $100,000' }, { status: 400 });

    const { checkoutUrl } = await createCampaignCheckout({
      amountCents,
      campaignId: c.id,
      title: c.title,
      redirectUrl: `${appOrigin(req.url)}/campaigns/${c.id}?funded=1`,
    });
    return NextResponse.json({ checkoutUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Could not start checkout' }, { status: 500 });
  }
}
