import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPayment, toCents, verifyWebhook } from '@/lib/whop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Whop payment webhook — the ONLY path that credits a campaign budget.
 * 1. Verify the signature over the raw body (constant time, bounded timestamp).
 * 2. Re-read the payment from the Whop API; never trust amounts in the body.
 * 3. Insert a deposit keyed by the Whop payment id, so retries are no-ops.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(req.headers, raw)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }

  const type = event?.type || event?.action;
  if (type !== 'payment.succeeded') return NextResponse.json({ ok: true, ignored: type ?? null });

  const paymentId = event?.data?.id;
  if (typeof paymentId !== 'string') return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });

  try {
    const payment = await getPayment(paymentId);
    const meta = payment?.metadata || event?.data?.metadata || {};
    const campaignId = meta.campaign_id;
    if (meta.kind !== 'campaign_fund' || typeof campaignId !== 'string') {
      return NextResponse.json({ ok: true, ignored: 'not a campaign fund' });
    }
    if (payment?.status && !['paid', 'succeeded'].includes(payment.status)) {
      return NextResponse.json({ ok: true, ignored: `status ${payment.status}` });
    }
    if (payment?.currency && String(payment.currency).toLowerCase() !== 'usd') {
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 });
    }

    // Credit what the platform actually collected: subtotal before Whop fees
    // is what the buyer paid for the plan.
    const amountCents = toCents(payment?.subtotal ?? payment?.usd_total ?? payment?.total);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Payment has no amount' }, { status: 400 });
    }

    const inserted = await db()`
      insert into deposits (campaign_id, whop_payment_id, amount_cents)
      select ${campaignId}, ${paymentId}, ${amountCents}
      where exists (select 1 from campaigns where id = ${campaignId})
      on conflict (whop_payment_id) do nothing
      returning id
    `;
    if (inserted[0]) {
      await db()`
        update campaigns
        set budget_cents = budget_cents + ${amountCents},
            status = case when status in ('DRAFT', 'COMPLETED') then 'ACTIVE' else status end
        where id = ${campaignId}
      `;
    }
    return NextResponse.json({ ok: true, credited: !!inserted[0] });
  } catch (e: any) {
    // 500 makes Whop retry; the deposit key keeps retries idempotent.
    return NextResponse.json({ error: e.message || 'Webhook failed' }, { status: 500 });
  }
}
