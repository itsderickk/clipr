'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Scissors } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign } from '@/lib/types';
import {
  AnimatedNumber,
  EASE,
  Magnetic,
  Reveal,
  Spotlight,
} from '@/components/motion';
import { Button, Card, Micro, Skeleton } from '@/components/ui';
import { CampaignCard } from '@/components/campaign-card';

const TRACE = [
  {
    t: 'T+00:00',
    event: 'ESCROW_FUNDED',
    flag: 'ON-CHAIN',
    title: 'A creator funds the campaign',
    body: 'Checkout runs on Whop — card, Apple Pay, bank transfer, or crypto. The verified payment credits the campaign budget, exactly once.',
    data: <>whop checkout · $500.00 · payment.succeeded</>,
  },
  {
    t: 'T+02:14',
    event: 'CLIP_SUBMITTED',
    flag: 'PENDING',
    title: 'Clippers cut and post',
    body: 'Editors clip the source, post to TikTok, YouTube, Instagram or X, and submit the link against the campaign.',
    data: <>tiktok.com/@nova/video/8412…</>,
  },
  {
    t: 'T+26:40',
    event: 'VIEWS_VERIFIED',
    flag: 'VERIFIED',
    title: 'Views get verified',
    body: 'Submissions are reviewed against the campaign — view counts pull automatically for YouTube, at review time for the rest.',
    data: <>48,210 views · youtube data api</>,
  },
  {
    t: 'T+26:41',
    event: 'PAYOUT_CLEARED',
    flag: 'SETTLED',
    title: 'Settlement in seconds',
    body: "Approved clips earn the posted rate per 1,000 views. Clipr fires an idempotent Whop transfer, and it lands in the clipper's balance.",
    data: <>transfer → clipper · $24.10 · whop balance</>,
  },
];

const CPM = [
  { platform: 'TikTok', range: '$6–13', note: 'avg ads CPM' },
  { platform: 'Instagram', range: '$9–14', note: 'Reels ads CPM' },
  { platform: 'YouTube', range: '$7–12', note: 'Shorts ads CPM' },
];

const STORY = [
  {
    tag: 'The idea',
    title: 'A creator has something worth sharing.',
    body: 'A podcast, launch, stream or moment becomes a campaign. The creator posts the source and sets a rate for every 1,000 verified views.',
  },
  {
    tag: 'The budget',
    title: 'The budget is funded up front.',
    body: 'Whop checkout funds the campaign. The remaining budget is on display, so clippers know the money is there before they edit a frame.',
  },
  {
    tag: 'The network',
    title: 'Clippers pick it up.',
    body: 'Editors browse open campaigns, cut the moments that work for their audience and post them across TikTok, YouTube, Instagram and X.',
  },
  {
    tag: 'The views',
    title: 'Views are verified.',
    body: 'Every submission is reviewed against the campaign. YouTube views pull automatically; other platforms are checked at review time.',
  },
  {
    tag: 'The payout',
    title: 'Everyone gets paid for reach.',
    body: "Approved clips earn the posted rate. A Whop transfer lands in the clipper's balance, and the creator only paid for views that happened.",
  },
];

const ANATOMY = [
  {
    step: 'Funding',
    value: 'Whop checkout · card / Apple Pay / bank / crypto',
    why: "Creators pay through Whop's hosted checkout. Clipr never touches card details, and the campaign id rides on the payment itself.",
  },
  {
    step: 'Credit',
    value: 'signed webhook → budget',
    why: 'Whop cryptographically signs every event. Clipr verifies the signature and credits the budget exactly once per payment — retries and replays are ignored by design.',
  },
  {
    step: 'Amount',
    value: 'owed = earned − already paid',
    why: 'earned = floor(views × rate ÷ 1,000), gated by minimum views and capped per clip. As views grow, each settlement covers only the delta — nothing double-pays.',
  },
  {
    step: 'Transfer',
    value: 'platform balance → clipper',
    why: "Settlement is a Whop transfer into the clipper's own balance, executed with an idempotence key — a retried payout can never pay twice.",
  },
  {
    step: 'Ledger',
    value: 'recorded after Whop confirms',
    why: 'The payout row is written only once the transfer succeeds, so a failed transfer can never fabricate a "paid" record.',
  },
  {
    step: 'Withdrawal',
    value: '241+ territories',
    why: "Clippers withdraw from their Whop balance to banks, cards and wallets worldwide after Whop's KYC. Creators can pull unspent budget back the same way.",
  },
];

function StoryCarousel() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setI((v) => (v + 1) % STORY.length), 5200);
    return () => clearTimeout(t);
  }, [i, reduce]);
  const s = STORY[i];

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto]">
      <Card hover={false} className="relative min-h-[16rem] overflow-hidden p-8 sm:p-10">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="relative"
          >
            <span className="text-xs font-medium text-brand-300">
              {String(i + 1).padStart(2, '0')} / {s.tag}
            </span>
            <h3 className="mt-4 max-w-xl font-display text-2xl font-bold text-ink-50 sm:text-3xl">{s.title}</h3>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-300 sm:text-base">{s.body}</p>
          </motion.div>
        </AnimatePresence>
      </Card>
      <div className="flex gap-2 lg:flex-col">
        {STORY.map((st, k) => (
          <button
            key={st.tag}
            onClick={() => setI(k)}
            aria-label={`Step ${k + 1}: ${st.tag}`}
            className={
              'rounded-lg border px-3 py-2 text-xs font-medium transition ' +
              (k === i ? 'border-brand-400 bg-brand-500/10 text-brand-300' : 'border-ink-700 text-ink-500 hover:text-ink-200')
            }
          >
            {String(k + 1).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- settlement receipt (hero signature) ---------------- */

const RECEIPTS = [
  { id: '0417', platform: 'TikTok', handle: '@novaclips', campaign: 'Podcast — Founder Interviews', views: 48210, rate: 0.05, tx: 'ctt_5Kd9…w2Lp' },
  { id: '0418', platform: 'YouTube', handle: '@reelframe', campaign: 'Keynote — Launch Moments', views: 126400, rate: 0.08, tx: 'ctt_9tQa…c7Rn' },
  { id: '0419', platform: 'X', handle: '@fastcuts', campaign: 'Tournament — Highlight Run', views: 31900, rate: 0.12, tx: 'ctt_3xVe…m4Hd' },
];

function ReceiptRow({ label, delay, children }: { label: string; delay: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      className="flex items-baseline justify-between gap-6 py-1.5"
    >
      <span className="text-xs font-medium text-ink-500">{label}</span>
      <span className="truncate text-right font-mono text-xs text-ink-200">{children}</span>
    </motion.div>
  );
}

function SettlementReceipt() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'verify' | 'settled'>('verify');
  const reduce = useReducedMotion();
  const r = RECEIPTS[idx];
  const payout = (r.views / 1000) * r.rate;

  useEffect(() => {
    setPhase('verify');
    const settle = setTimeout(() => setPhase('settled'), reduce ? 0 : 1900);
    const next = setTimeout(() => setIdx((i) => (i + 1) % RECEIPTS.length), 6400);
    return () => {
      clearTimeout(settle);
      clearTimeout(next);
    };
  }, [idx, reduce]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
      className="relative w-full max-w-md"
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-xl border border-ink-700 bg-ink-900/80 p-6 shadow-[0_0_80px_-24px_rgba(139,92,246,0.25)] backdrop-blur"
      >
        <span aria-hidden className="absolute -left-2 -top-2.5 font-mono text-[10px] text-brand-400/70">+</span>
        <span aria-hidden className="absolute -bottom-2.5 -right-2 font-mono text-[10px] text-brand-400/70">+</span>

        <AnimatePresence mode="wait">
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-300">
                Clipr — settlement
              </span>
              <span className="text-xs font-medium text-ink-500">
                #{r.id} · <span className="text-ink-600">sim</span>
              </span>
            </div>

            <div className="mt-4 border-t border-dashed border-ink-700" />

            <div className="mt-2">
              <ReceiptRow label="Clip" delay={0.05}>{r.platform} · {r.handle}</ReceiptRow>
              <ReceiptRow label="Campaign" delay={0.1}>{r.campaign}</ReceiptRow>
              <ReceiptRow label="Views" delay={0.15}><AnimatedNumber value={r.views} /></ReceiptRow>
              <ReceiptRow label="Rate" delay={0.2}>${r.rate.toFixed(2)} / 1,000</ReceiptRow>
            </div>

            <div className="mt-2 border-t border-dashed border-ink-700" />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: EASE }}
              className="mt-4 flex items-end justify-between"
            >
              <span className="text-xs font-medium text-ink-500">Payout</span>
              <span className="flex flex-col items-end">
                <span className="inline-flex items-baseline gap-2 font-display text-3xl font-semibold tabular-nums text-ink-50">
                  <AnimatedNumber value={payout} format={(v) => '$' + v.toFixed(2)} />
                </span>
              </span>
            </motion.div>

            <div className="mt-4 flex items-center justify-between text-xs font-medium">
              <span className="text-ink-500">Status</span>
              {phase === 'verify' ? (
                <span className="text-ink-300">
                  Verifying<span className="animate-pulse">…</span>
                </span>
              ) : (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-2 text-ink-50"
                >
                  <span className="h-1.5 w-1.5 bg-ink-50" />
                  Settled
                </motion.span>
              )}
            </div>

            <div className="mt-1.5 flex h-4 items-center justify-between text-xs font-medium text-ink-600">
              <span>Tx</span>
              {phase === 'settled' ? (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{r.tx} ↗</motion.span>
              ) : (
                <span>——</span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const traceRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: traceRef,
    offset: ['start 0.75', 'end 0.45'],
  });
  const traceBeam = useSpring(scrollYProgress, { stiffness: 70, damping: 22 });
  const [featured, setFeatured] = useState<Campaign[] | null>(null);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns')
      .then((d) => setFeatured(d.campaigns.filter((c) => c.status === 'ACTIVE').slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  return (
    <div>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden">
        <div className="grid-bg grid-fade absolute inset-0" />
        <div aria-hidden className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-80" />
        <Spotlight />

        <div className="relative mx-auto max-w-7xl px-5 pt-24 sm:px-8 sm:pt-28 lg:pt-32">
          <div className="grid items-center gap-14 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-24">
            <div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="text-[13px] font-medium text-ink-400"
              >
                [ Clip-to-earn marketplace · payments by Whop ]
                <span className="ml-1 inline-block animate-pulse text-brand-300">_</span>
              </motion.p>

              <h1 className="mt-7 font-display font-extrabold leading-[0.94] tracking-tighter">
                <span className="block overflow-hidden">
                  <motion.span
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
                    className="block text-5xl text-ink-50 sm:text-7xl xl:text-[5.25rem] 2xl:text-8xl"
                  >
                    POST A JOB.
                  </motion.span>
                </span>
                <span className="block overflow-hidden">
                  <motion.span
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.22, ease: EASE }}
                    className="block text-5xl text-ink-50 sm:text-7xl xl:text-[5.25rem] 2xl:text-8xl"
                  >
                    MAKE THE CLIP.
                  </motion.span>
                </span>
                <span className="block overflow-hidden">
                  <motion.span
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
                    className="block text-5xl text-brand-500 sm:text-7xl xl:text-[5.25rem] 2xl:text-8xl"
                  >
                    GET PAID.
                  </motion.span>
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
                className="mt-7 max-w-md text-base leading-relaxed text-ink-300 sm:text-lg"
              >
                Hire clippers, or earn by clipping for creators. Budgets are funded through Whop
                checkout, and payouts land in your Whop balance seconds after views are verified —
                withdraw to 241+ territories.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.65, ease: EASE }}
                className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"
              >
                <Magnetic>
                  <Link href="/campaigns">
                    <Button size="lg" arrow>
                      Browse campaigns
                    </Button>
                  </Link>
                </Magnetic>
                <Link
                  href="/campaigns/new"
                  className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-400 transition hover:text-ink-50"
                >
                  Launch a campaign
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <SettlementReceipt />
            </div>
          </div>
        </div>

      </section>

      {/* ---------------- cost of attention ---------------- */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <Micro>The cost of attention</Micro>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-5xl">
            Buy ads, or let the market make clips.
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-ink-700 bg-ink-700 lg:grid-cols-[1fr_auto_1fr]">
            <div className="bg-ink-900 p-8">
              <Micro>Cost per 1,000</Micro>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-lg text-ink-100">Traditional paid ads</span>
                <span className="text-xs font-medium text-ink-500">/ pay for impressions</span>
              </div>
              <div className="mt-6 space-y-4">
                {CPM.map((c) => (
                  <div key={c.platform} className="flex items-end justify-between border-t border-ink-800 pt-4">
                    <div>
                      <div className="font-display text-ink-50">{c.platform}</div>
                      <div className="text-xs font-medium text-ink-500">{c.note}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-semibold tabular text-ink-200">{c.range}</div>
                      <div className="text-xs font-medium text-ink-500">/ 1K impressions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center bg-ink-950 px-6 py-4 text-[13px] font-medium text-ink-500">
              VS
            </div>
            <div className="relative overflow-hidden bg-ink-900 p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="relative">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg text-brand-300">Clipr</span>
                  <span className="text-xs font-medium text-ink-500">/ open market</span>
                </div>
                <p className="mt-6 text-sm text-ink-300">Pay for verified views</p>
                <div className="mt-2 font-display text-6xl font-bold tabular text-ink-50">$0.50–2</div>
                <span className="mt-3 inline-block rounded-full border border-brand-400 px-3 py-1 text-xs font-medium text-brand-300">
                  up to 10× less
                </span>
                <p className="mt-3 text-xs font-medium text-ink-500">Typical rate / 1K verified views</p>
                <p className="mt-6 text-sm leading-relaxed text-ink-400">
                  <span className="text-ink-100">Why Clipr can cost less:</span> creators post the rate they’ll pay,
                  and clippers choose which campaigns to make content for. The market decides what gets clipped.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-500">
            Ads: typical 2025–26 self-serve CPM benchmarks. Clipr: illustrative creator-set rates. Impressions and
            verified views are different measures.
          </p>
        </Reveal>
      </section>

      {/* ---------------- story ---------------- */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal>
          <Micro>Meet Clipr</Micro>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-5xl">
            One video. A whole network of creators.
          </h2>
          <p className="mt-3 text-xs font-medium text-ink-500">The story / 01—05</p>
        </Reveal>
        <StoryCarousel />
      </section>

      {/* ---------------- protocol: settlement trace ---------------- */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Micro>The protocol</Micro>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-5xl">
              Escrow in, clips out,{' '}
              <span className="text-ink-400">views settle the difference.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-400 sm:text-base">
              Four events, one ledger. This is the entire lifecycle of a single clip — from funded
              campaign to cleared payout — exactly as it lands on-chain.
            </p>
          </div>

          <div ref={traceRef} className="relative pl-10">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-ink-800" />
            <motion.div
              style={{ scaleY: traceBeam }}
              className="absolute bottom-2 left-[5px] top-2 w-px origin-top bg-gradient-to-b from-brand-300 via-brand-400 to-brand-500"
            />
            <div className="space-y-14">
              {TRACE.map((e, i) => (
                <Reveal key={e.event} delay={i * 0.04}>
                  <div className="relative">
                    <span
                      aria-hidden
                      className={
                        'absolute -left-10 top-1 h-[11px] w-[11px] border ' +
                        (e.flag === 'SETTLED'
                          ? 'border-brand-300 bg-brand-500'
                          : e.flag === 'PENDING'
                            ? 'border-ink-500 bg-ink-950'
                            : 'border-brand-400 bg-ink-950')
                      }
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px]">
                      <span className="tabular text-ink-500">{e.t}</span>
                      <span className="uppercase tracking-[0.16em] text-brand-300">{e.event}</span>
                      <span
                        className={
                          'rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-micro ' +
                          (e.flag === 'PENDING'
                            ? 'border-ink-600 text-ink-400'
                            : 'border-brand-400/60 text-brand-300')
                        }
                      >
                        {e.flag}
                      </span>
                    </div>
                    <h3 className="mt-2.5 font-display text-xl font-bold text-ink-50">
                      {e.title}
                    </h3>
                    <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-400">{e.body}</p>
                    <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900/60 px-3 py-1.5 font-mono text-[11px] text-ink-300">
                      {e.data}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- audience split ---------------- */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-ink-700 bg-ink-700 lg:grid-cols-2">
          <Reveal className="bg-ink-900 p-8 sm:p-12">
            <Micro>For creators</Micro>
            <h3 className="mt-4 font-display text-2xl font-bold text-ink-50 sm:text-3xl">
              Buy distribution, not promises.
            </h3>
            <ul className="mt-6 space-y-4">
              {[
                'Set your rate per 1,000 views and cap payouts per clip',
                'Budget sits in escrow you can audit and withdraw anytime',
                'Approve exactly the clips that fit the campaign — pay only for verified views',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm leading-relaxed text-ink-300">
                  <span className="mt-2 h-1 w-4 shrink-0 bg-ink-50" />
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/campaigns/new" className="mt-8 inline-block">
              <Button variant="outline" arrow>
                Launch a campaign
              </Button>
            </Link>
          </Reveal>

          <Reveal delay={0.12} className="relative overflow-hidden bg-ink-900 p-8 sm:p-12">
            <div className="grid-bg absolute inset-0 opacity-40" />
            <div className="relative">
              <Micro>For clippers</Micro>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink-50 sm:text-3xl">
                Your edits, priced in public.
              </h3>
              <ul className="mt-6 space-y-4">
                {[
                  'Browse live campaigns with rates and remaining budget on display',
                  'Submit links from TikTok, YouTube, Instagram or X',
                  'Earnings land in your wallet — no invoices, no net-30, no middlemen',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm leading-relaxed text-ink-300">
                    <span className="mt-2 h-1 w-4 shrink-0 bg-ink-50" />
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/campaigns" className="mt-8 inline-block">
                <Button arrow>Browse campaigns</Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- anatomy of a payout ---------------- */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <Micro>How money moves</Micro>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-5xl">
            Anatomy of a payout.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-400 sm:text-base">
            No invoices, no net-30, no chasing. This is exactly what happens — step by step — between a
            creator&apos;s card and a clipper&apos;s balance.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          <div className="overflow-hidden rounded-2xl border border-ink-700">
            <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900/40 px-6 py-4 text-xs font-medium text-ink-500">
              <span>One payout — decomposed</span>
              <span>step · value · why it matters</span>
            </div>
            {ANATOMY.map((row, i) => (
              <div
                key={row.step}
                className="grid gap-2 border-b border-ink-800 px-6 py-5 last:border-b-0 md:grid-cols-[3rem_9rem_16rem_1fr] md:gap-6"
              >
                <span className="font-mono text-[11px] tabular text-ink-500">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-display text-ink-50">{row.step}</span>
                <span className="font-mono text-[11px] text-brand-300">{row.value}</span>
                <span className="text-sm leading-relaxed text-ink-400">{row.why}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 bg-ink-900/40 px-6 py-4 text-xs font-medium text-ink-500">
              <span>Every payout is an auditable Whop transfer</span>
              <span className="text-ink-300">Powered by Whop payments</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- live campaigns ---------------- */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex items-end justify-between">
          <div>
            <Micro>Live now</Micro>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
              Open campaigns
            </h2>
          </div>
          <Link
            href="/campaigns"
            className="group hidden items-center gap-2 text-[13px] font-medium text-ink-400 transition hover:text-ink-50 sm:inline-flex"
          >
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured === null &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
          {featured?.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08}>
              <CampaignCard campaign={c} />
            </Reveal>
          ))}
          {featured?.length === 0 && (
            <Reveal className="md:col-span-2 lg:col-span-3">
              <Card hover={false} className="flex flex-col items-center gap-4 p-12 text-center">
                <Scissors className="h-6 w-6 text-ink-400" />
                <p className="max-w-sm text-sm text-ink-400">
                  No live campaigns yet. Launch the first campaign and put a rate on your views.
                </p>
                <Link href="/campaigns/new">
                  <Button arrow>Launch a campaign</Button>
                </Link>
              </Card>
            </Reveal>
          )}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="relative mx-auto mt-32 max-w-7xl overflow-hidden px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 px-8 py-20 text-center sm:py-28">
            <div className="grid-bg grid-fade absolute inset-0" />
            <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 animate-drift rounded-full bg-brand-500/[0.14] blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-5xl">
                Every view has a price.
                <span className="block text-ink-400">Put yours on-chain.</span>
              </h2>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Magnetic>
                  <Link href="/campaigns">
                    <Button size="lg" arrow>
                      Start clipping
                    </Button>
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="/campaigns/new">
                    <Button size="lg" variant="outline" arrow>
                      Fund a campaign
                    </Button>
                  </Link>
                </Magnetic>
              </div>
              <p className="mt-8 text-xs font-medium text-ink-500">
                <ArrowUpRight className="mr-1 inline h-3 w-3" />
                Running on Solana
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
