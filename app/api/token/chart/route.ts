import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Coin charted on /token. Defaults to SOL (the settlement currency) until
 *  $CLIPR is listed — then set TOKEN_COINGECKO_ID to the listing's id. */
const COIN_ID = () => process.env.TOKEN_COINGECKO_ID || 'solana';

const cache = new Map<string, { at: number; body: any }>();

export async function GET(req: NextRequest) {
  const days = ['7', '30', '90', '365'].includes(req.nextUrl.searchParams.get('days') || '')
    ? (req.nextUrl.searchParams.get('days') as string)
    : '30';
  const key = `${COIN_ID()}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return NextResponse.json(hit.body);

  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${COIN_ID()}/market_chart?vs_currency=usd&days=${days}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    const d = await r.json();
    const prices: [number, number][] = Array.isArray(d?.prices) ? d.prices : [];
    if (!prices.length) throw new Error('no data');

    const first = prices[0][1];
    const last = prices[prices.length - 1][1];
    const body = {
      coinId: COIN_ID(),
      days: Number(days),
      prices,
      current: last,
      changePct: first > 0 ? ((last - first) / first) * 100 : 0,
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(hit?.body ?? { coinId: COIN_ID(), days: Number(days), prices: null });
  }
}
