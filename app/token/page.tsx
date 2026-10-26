'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtNum } from '@/lib/format';
import { EASE, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { Card, CopyChip, Input, Label, Micro, Skeleton } from '@/components/ui';
import { CLIPR_MINT, dexscreenerTokenUrl, solscanTokenUrl } from '@/lib/token';

const RANGES = [7, 30, 90, 365] as const;

type ChartData = {
  coinId: string;
  days: number;
  prices: [number, number][] | null;
  current?: number;
  changePct?: number;
};

/* ---------- price chart (data by CoinGecko) ---------- */

function PriceChart() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<ChartData | null | 'error'>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    setData(null);
    setHover(null);
    api<ChartData>('/api/token/chart?days=' + days)
      .then((d) => setData(d.prices?.length ? d : 'error'))
      .catch(() => setData('error'));
  }, [days]);

  const pts = useMemo(() => {
    if (!data || data === 'error' || !data.prices) return [];
    const raw = data.prices;
    const stride = Math.max(1, Math.floor(raw.length / 240));
    const sampled = raw.filter((_, i) => i % stride === 0 || i === raw.length - 1);
    const vals = sampled.map((p) => p[1]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const W = 800;
    const H = 260;
    const PAD = 14;
    return sampled.map((p, i) => ({
      t: p[0],
      v: p[1],
      x: (i / (sampled.length - 1)) * W,
      y: PAD + (1 - (p[1] - min) / span) * (H - PAD * 2),
    }));
  }, [data]);

  const line = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const area = line ? line + ' L800 260 L0 260 Z' : '';
  const h = hover != null ? pts[hover] : null;
  const up = data !== 'error' && data?.changePct != null && data.changePct >= 0;
  const pendingSol = data !== 'error' && data?.coinId === 'solana';

  return (
    <Card hover={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-800 px-6 py-5 sm:px-7">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-lg font-semibold text-ink-50">
              {pendingSol ? 'SOL' : '$CLIPR'}
            </span>
            {pendingSol && (
              <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs font-medium text-ink-400">
                $CLIPR listing pending · charting SOL
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            {data === null && <Skeleton className="h-8 w-36" />}
            {data === 'error' && (
              <span className="font-mono text-sm text-ink-400">Chart unavailable right now</span>
            )}
            {data !== null && data !== 'error' && (
              <>
                <span className="font-display text-3xl font-semibold tabular text-ink-50">
                  ${data.current! >= 100 ? fmtNum(Math.round(data.current!)) : data.current!.toFixed(2)}
                </span>
                <span className={`font-mono text-xs tabular ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {up ? '+' : ''}
                  {data.changePct!.toFixed(2)}% · {days}D
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                days === r ? 'bg-ink-50 text-ink-950' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              {r === 365 ? '1Y' : r + 'D'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative px-2 pb-2 pt-4">
        {data === null && <Skeleton className="mx-4 h-[260px]" />}
        {data === 'error' && (
          <div className="mx-4 flex h-[260px] items-center justify-center rounded-xl border border-dashed border-ink-700 text-[13px] font-medium text-ink-500">
            CoinGecko unreachable — try again shortly
          </div>
        )}
        {pts.length > 0 && (
          <div className="relative">
            <svg
              viewBox="0 0 800 260"
              preserveAspectRatio="none"
              className="h-[260px] w-full cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                setHover(Math.round(frac * (pts.length - 1)));
              }}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d={area}
                fill="url(#chartFill)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: EASE }}
              />
              <motion.path
                d={line}
                fill="none"
                stroke="#A78BFA"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: EASE }}
              />
              {h && (
                <>
                  <line
                    x1={h.x}
                    x2={h.x}
                    y1="0"
                    y2="260"
                    stroke="#8C7FBD"
                    strokeDasharray="3 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={h.x} cy={h.y} r="4" fill="#C4B5FD" />
                </>
              )}
            </svg>
            {h && (
              <div
                className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-1.5 font-mono text-[11px] text-ink-100"
                style={{ left: (h.x / 800) * 100 + '%' }}
              >
                ${h.v.toFixed(2)}
                <span className="ml-2 text-ink-500">
                  {new Date(h.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-4 pb-2 pt-1 text-xs font-medium text-ink-500">
          <span>
            {pts.length
              ? new Date(pts[0].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''}
          </span>
          <a
            href="https://www.coingecko.com"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-ink-200"
          >
            Data by CoinGecko
          </a>
          <span>
            {pts.length
              ? new Date(pts[pts.length - 1].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''}
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ---------- 90 / 10 split calculator ---------- */

function SplitCalculator() {
  const [views, setViews] = useState('100000');
  const [rate, setRate] = useState('0.05');

  const gross = ((Number(views) || 0) / 1000) * (Number(rate) || 0);
  const fee = gross * 0.1;
  const net = gross - fee;
  const rows = [
    { k: 'Gross payout', v: gross, cls: 'text-ink-200' },
    { k: 'Protocol · 10%', v: fee, cls: 'text-ink-400' },
    { k: 'Clipper receives', v: net, cls: 'text-ink-50', strong: true },
  ];

  return (
    <Card hover={false} className="p-6 sm:p-7">
      <Micro>Run the numbers</Micro>
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="w-40">
          <Label>Verified views</Label>
          <Input type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} />
        </div>
        <div className="w-40">
          <Label>Rate · $ / 1K</Label>
          <Input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 divide-y divide-ink-800 rounded-xl border border-ink-800">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between px-4 py-3.5">
            <span className="text-xs font-medium text-ink-500">{r.k}</span>
            <motion.span
              key={r.v}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`inline-flex items-center gap-1.5 font-mono tabular ${r.strong ? 'text-base' : 'text-sm'} ${r.cls}`}
            >
              ${r.v.toFixed(2)}
            </motion.span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- page ---------- */

export default function TokenPage() {
  return (
    <div className="mx-auto min-h-[80vh] max-w-7xl px-5 py-14 sm:px-8">
      <Reveal>
        <Micro>Token</Micro>
        <div className="mt-3 flex items-center gap-4">
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl border border-ink-700" />
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
            $CLIPR
          </h1>
        </div>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
          The economic layer of Clipr. Every settlement that clears through a campaign budget
          routes <span className="text-ink-50">10% to the protocol</span> — clippers keep the other
          90%, paid straight to their Whop balance.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Micro>Contract</Micro>
          <CopyChip value={CLIPR_MINT} />
          <a
            href={solscanTokenUrl(CLIPR_MINT)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-ink-400 transition hover:text-ink-50"
          >
            Solscan ↗
          </a>
          <a
            href={dexscreenerTokenUrl(CLIPR_MINT)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-ink-400 transition hover:text-ink-50"
          >
            Dexscreener ↗
          </a>
        </div>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <PriceChart />
      </Reveal>

      {/* tokenomics */}
      <section className="mt-20">
        <Reveal>
          <Micro>Tokenomics</Micro>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
            Every payout splits <span className="text-brand-300">90 / 10.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-ink-700">
            <motion.div
              className="h-full bg-ink-50"
              initial={{ width: 0 }}
              whileInView={{ width: '90%' }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE }}
            />
            <motion.div
              className="h-full bg-ink-50"
              initial={{ width: 0 }}
              whileInView={{ width: '10%' }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.15, ease: EASE }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs font-medium">
            <span className="text-ink-50">Clippers · 90%</span>
            <span className="text-ink-200">Protocol · 10%</span>
          </div>
        </Reveal>

        <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'A fee on settlement, nothing else',
              body: 'The only take is 10% of each payout at the moment it settles. No listing fees, no subscriptions, no cut of creator deposits — unspent budgets withdraw in full.',
            },
            {
              title: 'Revenue follows views',
              body: 'The protocol earns only when clippers do. Fee volume scales with verified views settled, which keeps Clipr aligned with the editors doing the distribution.',
            },
            {
              title: 'Profits split 60 / 30 / 10',
              body: '60% of protocol profits buy $CLIPR back on the open market — straight into the chart. 30% funds Clipr-run campaigns on this very marketplace, paying clippers from protocol-owned budgets. 10% covers operations.',
            },
          ].map((c) => (
            <StaggerItem key={c.title}>
              <Card hover={false} className="h-full p-7">
                <h3 className="font-display text-lg font-bold text-ink-50">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{c.body}</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.05} className="mt-10">
          <SplitCalculator />
        </Reveal>

        <Reveal delay={0.05} className="mt-10">
          <p className="rounded-xl border border-ink-800 bg-ink-900/50 px-5 py-4 font-mono text-[11px] leading-relaxed text-ink-400">
            $CLIPR is pre-listing. Until it trades, this page charts SOL. Fee routing is not live
            yet: the current build settles 100% of payouts to clippers.
          </p>
        </Reveal>
      </section>
    </div>
  );
}
