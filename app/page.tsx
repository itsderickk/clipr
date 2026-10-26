'use client';

import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, ChevronLeft, ChevronRight, Scissors, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Platform, PlatformStats } from '@/lib/types';
import { fmtNum, fmtUsd, shortAddr, timeAgo } from '@/lib/format';
import { AnimatedNumber, EASE, Marquee, Reveal } from '@/components/motion';
import { Button } from '@/components/ui';
import { PlatformIcon } from '@/components/icons';
import { StepScreen } from '@/components/step-screens';

type Activity = { kind: 'payout' | 'deposit' | 'campaign' | 'clip'; amount: number; wallet: string | null; title: string; createdAt: string };

/* Shown in the ticker only until real campaigns exist. */
const EXAMPLES: Pick<Campaign, 'id' | 'title' | 'platforms' | 'ratePerThousand' | 'budgetCents' | 'spentCents'>[] = [
  { id: 'ex1', title: 'Clipr — TikTok launch clips', platforms: ['tiktok'], ratePerThousand: 100, budgetCents: 125000, spentCents: 0 },
  { id: 'ex2', title: 'Clipr — YouTube Shorts explainers', platforms: ['youtube'], ratePerThousand: 150, budgetCents: 125000, spentCents: 0 },
  { id: 'ex3', title: 'Clipr — Instagram Reels', platforms: ['instagram'], ratePerThousand: 80, budgetCents: 125000, spentCents: 0 },
  { id: 'ex4', title: 'Clipr — Posts on X', platforms: ['x'], ratePerThousand: 120, budgetCents: 125000, spentCents: 0 },
];
/* $5,000 across the four Clipr campaigns; shown as the live budget until real stats exist. */
const EXAMPLE_BUDGET_CENTS = EXAMPLES.reduce((t, c) => t + c.budgetCents - c.spentCents, 0);

/* Simulated clips for the hero board. Purely illustrative. */
const SIM = [
  { handle: '@example', platform: 'tiktok' as Platform, rate: 1.0, speed: 1.0 },
  { handle: '@example', platform: 'youtube' as Platform, rate: 1.5, speed: 0.7 },
  { handle: '@example', platform: 'x' as Platform, rate: 1.2, speed: 0.55 },
  { handle: '@example', platform: 'instagram' as Platform, rate: 0.8, speed: 0.85 },
  { handle: '@sidechannelexample', platform: 'tiktok' as Platform, rate: 1.1, speed: 1.25 },
  { handle: '@sidechannelexample', platform: 'youtube' as Platform, rate: 0.9, speed: 0.6 },
];
const SIM_START = [48210, 126400, 31900, 72300, 18800, 95200];

const LEDGER = [
  ['campaign_id', 'uuid', 'one escrow wallet per campaign'],
  ['budget_cents', 'int64', 'credited once per deposit'],
  ['rate_per_1k', 'int64', 'set by the creator, public to clippers'],
  ['min_views', 'int64', 'clips under it earn nothing'],
  ['max_payout', 'int64 | null', 'optional cap per clip'],
  ['earned', 'int64', 'floor(views × rate ÷ 1,000)'],
  ['paid', 'int64', 'reserved, then settled on chain'],
  ['owed', 'int64', 'earned − paid, so nothing double-pays'],
];

const FAQ = [
  { q: 'How does a campaign get funded?', a: "Creators send USDC to the campaign's own escrow wallet. Clipr holds it and pays clippers from it, and every movement is on the ledger." },
  { q: 'How are clippers paid?', a: "Approved clips earn the posted rate per 1,000 verified views, sent as USDC from the campaign wallet straight to the clipper's own wallet." },
  { q: 'What if a clip keeps getting views?', a: 'Each settlement pays only the difference between what a clip has earned and what it has already been paid, up to the campaign cap.' },
  { q: 'Can creators get unspent budget back?', a: 'Yes. Remaining budget can be withdrawn from the campaign at any time.' },
];

/* TikTok's official embed player, muted and looping. Swap the id to feature a different video. */
const TIKTOK_VIDEO_ID = '7698435898240683295';
const TIKTOK_EMBED = `https://www.tiktok.com/player/v1/${TIKTOK_VIDEO_ID}?autoplay=1&loop=1&muted=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;

const CLIP_LOOP_MS = 12_000;

const STAGES = ['Post the clip.', 'Watch it grow.', 'Get verified.', 'Get paid.'];

/* ---------------- hooks ---------------- */

/** Ticks simulated view counts upward at different speeds. */
function useSimViews() {
  const reduce = useReducedMotion();
  const [views, setViews] = useState(SIM_START);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      setViews((v) => v.map((n, i) => n + Math.round((40 + Math.random() * 160) * SIM[i].speed)));
    }, 180);
    return () => clearInterval(t);
  }, [reduce]);
  return views;
}

/* ---------------- pieces ---------------- */

function Rolling({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden tabular ${className}`}>
      {value.split('').map((ch, i) => (
        <span key={i} className="relative inline-block">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch + i}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function SimBoard() {
  const views = useSimViews();
  const earned = views.map((v, i) => (v / 1000) * SIM[i].rate);
  const total = earned.reduce((a, b) => a + b, 0);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-ink-800 bg-ink-950/80 p-5 backdrop-blur sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative flex items-end justify-between gap-4">
        <span className="flex items-center gap-2 text-[13px] font-medium text-ink-500">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand-400" /> Simulated
        </span>
        <Rolling value={'$' + total.toFixed(2)} className="font-display text-3xl font-extrabold tracking-tight text-ink-50 sm:text-4xl" />
      </div>
      <div className="relative mt-5 divide-y divide-ink-800/80">
        {SIM.map((s, i) => {
          const pct = (views[i] % 25000) / 250;
          return (
            <div key={i} className="flex items-center gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900">
                <PlatformIcon platform={s.platform} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[14px] font-bold text-ink-50">{s.handle}</span>
                  <span className="font-display text-[14px] font-bold text-ink-50 tabular">${earned[i].toFixed(2)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" animate={{ width: `${pct}%` }} transition={{ duration: 0.18, ease: 'linear' }} />
                  </div>
                  <span className="w-16 text-right text-[12px] text-ink-500 tabular">{fmtNum(views[i])}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickerCard({ c, example }: { c: (typeof EXAMPLES)[number]; example?: boolean }) {
  const remaining = Math.max(0, c.budgetCents - c.spentCents);
  const body = (
    <div className="mx-2 flex w-[19rem] items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900/70 p-4 transition hover:border-brand-500/50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-950">
        <PlatformIcon platform={c.platforms[0] as Platform} className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-ink-50">{c.title}</div>
        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-500">
          <span className="tabular text-brand-300">{fmtUsd(c.ratePerThousand)}/1K</span>
          <span>·</span>
          <span className="tabular">{fmtUsd(remaining)} left</span>
        </div>
      </div>
    </div>
  );
  return example ? body : <Link href={`/campaigns/${c.id}`}>{body}</Link>;
}

/** The MrBeast clip going from posted to paid, on a loop. */
function ClipCard() {
  const reduce = useReducedMotion();
  const [p, setP] = useState(1);
  useEffect(() => {
    if (reduce) return;
    const start = Date.now();
    const t = setInterval(() => setP(((Date.now() - start) % CLIP_LOOP_MS) / CLIP_LOOP_MS), 60);
    return () => clearInterval(t);
  }, [reduce]);

  const growth = Math.min(1, Math.max(0, (p - 0.05) / 0.6));
  const views = Math.round(growth * growth * 184_000);
  const earned = (views / 1000) * 1.2;
  const verified = p > 0.55;
  const paid = p > 0.78;

  return (
    <div className="relative mx-auto w-full max-w-[17rem] sm:max-w-[18.5rem]">
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="48" fill="none" stroke="#16181C" strokeWidth="0.6" />
        <motion.circle cx="50" cy="50" r="48" fill="none" stroke="#A78BFA" strokeWidth="0.6" strokeLinecap="round" animate={{ pathLength: p }} transition={{ duration: 0.1, ease: 'linear' }} />
      </svg>
      <motion.div
        animate={{ scale: paid ? [1, 1.04, 1] : 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-ink-800 bg-ink-950"
      >
        <div className="relative aspect-[9/16] bg-ink-900">
          <iframe
            src={TIKTOK_EMBED}
            title="MrBeast on TikTok"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            className="absolute inset-0 h-full w-full border-0"
          />
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-ink-950/70 px-2.5 py-1 backdrop-blur">
            <PlatformIcon platform="tiktok" className="h-4 w-4" />
            <span className="text-[13px] font-bold text-ink-50">@mrbeast</span>
          </div>
          <AnimatePresence>
            {verified && (
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white"
              >
                <BadgeCheck className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 via-ink-950/50 to-transparent p-5 pt-16">
            <div className="font-display text-4xl font-extrabold tracking-tight text-ink-50 tabular">{views.toLocaleString('en-US')}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-300">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-400" /> views
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-ink-800 px-5 py-4">
          <span className="font-display text-2xl font-bold text-ink-50 tabular">${earned.toFixed(2)}</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={paid ? 'paid' : 'pending'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`rounded-full px-3 py-1 text-[13px] font-bold ${paid ? 'bg-brand-500 text-white' : 'border border-ink-700 text-ink-400'}`}
            >
              {paid ? 'Paid' : verified ? 'Verified' : 'Earning'}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/** Scroll-driven story: one clip goes from posted to paid as the section scrolls past. */
function ClipJourney() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setP(v));

  const stage = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
  const t = Math.min(1, p * STAGES.length - stage);

  return (
    <section ref={ref} id="how" className="relative h-[320vh] scroll-mt-0">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="relative h-[7.5rem] sm:h-[9rem]">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={stage}
                  initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -40, filter: 'blur(8px)' }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="absolute inset-0 font-display text-5xl font-extrabold leading-[1.02] tracking-tighter text-ink-50 sm:text-7xl"
                >
                  {STAGES[stage].split(' ').slice(0, -1).join(' ')}{' '}
                  <span className={stage === STAGES.length - 1 ? 'text-brand-400' : 'text-ink-500'}>
                    {STAGES[stage].split(' ').slice(-1)}
                  </span>
                </motion.h2>
              </AnimatePresence>
            </div>
            <div className="mt-8 flex gap-2">
              {STAGES.map((_, i) => (
                <div key={i} className="h-1 w-12 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className="h-full bg-brand-400"
                    animate={{ width: i < stage ? '100%' : i === stage ? `${((p * STAGES.length) % 1) * 100}%` : '0%' }}
                    transition={{ duration: 0.1, ease: 'linear' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <StepScreen stage={stage} t={t} />
        </div>
      </div>
    </section>
  );
}

function Pager({ i, n, set }: { i: number; n: number; set: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-ink-500">
      <button aria-label="Previous" onClick={() => set((i - 1 + n) % n)} className="rounded-full border border-ink-700 p-1.5 text-ink-50 transition hover:bg-ink-50/10">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="tabular w-10 text-center">{i + 1} / {n}</span>
      <button aria-label="Next" onClick={() => set((i + 1) % n)} className="rounded-full border border-ink-700 p-1.5 text-ink-50 transition hover:bg-ink-50/10">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function Landing() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [page, setPage] = useState(0);
  const [faq, setFaq] = useState<number | null>(0);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns')
      .then((d) => setCampaigns(d.campaigns.filter((c) => c.status === 'ACTIVE')))
      .catch(() => setCampaigns([]));
    api<{ stats: PlatformStats; activity: Activity[] }>('/api/stats')
      .then((d) => {
        setStats(d.stats);
        setActivity(d.activity);
      })
      .catch(() => {});
  }, []);

  const live = !!campaigns && campaigns.length > 0;
  const ticker = live ? campaigns! : EXAMPLES;
  const half = Math.ceil(ticker.length / 2);
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(activity.length / perPage));
  const shown = useMemo(() => activity.slice(page * perPage, page * perPage + perPage), [activity, page]);

  const statItems = [
    { label: 'Paid to clippers', value: stats?.totalPaidCents ?? 0, fmt: (v: number) => fmtUsd(Math.round(v)) },
    { label: 'Live budgets', value: stats?.escrowedCents || EXAMPLE_BUDGET_CENTS, fmt: (v: number) => fmtUsd(Math.round(v)) },
    { label: 'Clips submitted', value: stats?.totalClips ?? 0 },
    { label: 'Verified views', value: stats?.totalViews ?? 0, fmt: (v: number) => fmtNum(Math.round(v)) },
  ];

  return (
    <div className="overflow-x-clip">
      {/* ---------------- hero ---------------- */}
      <section className="relative">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[44rem] animate-glow" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tighter text-ink-50 sm:text-7xl"
            >
              Pay clippers for
              <span className="block bg-gradient-to-r from-ink-50 via-brand-300 to-ink-500 bg-[length:200%_auto] bg-clip-text text-transparent animate-sheen">
                every view.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
              className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-ink-400 lg:mx-0"
            >
              Creators fund a campaign and set a rate per 1,000 views. Clippers post, views get verified, and the money
              moves on its own.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <Link href="/campaigns">
                <Button size="lg">Start clipping</Button>
              </Link>
              <Link href="/campaigns/new">
                <Button size="lg" variant="outline">
                  Launch a campaign
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-10 flex items-center justify-center gap-5 lg:justify-start"
            >
              {(['tiktok', 'youtube', 'instagram', 'x'] as Platform[]).map((p, i) => (
                <motion.span
                  key={p}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.35, ease: 'easeInOut' }}
                >
                  <PlatformIcon platform={p} className="h-7 w-7" />
                </motion.span>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }}>
            <ClipCard />
          </motion.div>
        </div>

        {/* campaign ticker, two rows moving opposite ways */}
        <div className="relative space-y-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <Marquee slow>
            {ticker.slice(0, half).concat(ticker.slice(0, half)).map((c, i) => (
              <TickerCard key={c.id + i} c={c} example={!live} />
            ))}
          </Marquee>
          <Marquee slow reverse>
            {ticker.slice(half).concat(ticker.slice(half)).map((c, i) => (
              <TickerCard key={c.id + i} c={c} example={!live} />
            ))}
          </Marquee>
        </div>
        <div className="mt-6 flex justify-center">
          <Link href="/campaigns" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-300 transition hover:text-brand-300">
            Explore campaigns <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {statItems.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06} className="text-center">
              <div className="font-display text-4xl font-extrabold tracking-tight text-ink-50 sm:text-6xl">
                <AnimatedNumber value={s.value} format={s.fmt} />
              </div>
              <div className="mt-2 text-[15px] text-ink-500">{s.label}</div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mx-auto mt-16 max-w-xl">
          <SimBoard />
        </Reveal>
      </section>

      {/* ---------------- scroll story ---------------- */}
      <ClipJourney />

      {/* ---------------- ledger ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <h2 className="font-display text-4xl font-extrabold tracking-tighter text-ink-50 sm:text-5xl">
              Settlement is <span className="text-brand-400">per clip.</span>
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-400">
              Every submission carries its own ledger. As views grow, each settlement covers only the difference, so
              nothing ever pays twice.
            </p>
            <div className="mt-8">
              <Link href="/docs" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-50 transition hover:text-brand-300">
                Read the docs <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-3xl border border-ink-800 bg-ink-950 shadow-[0_0_80px_-30px_rgba(139,92,246,0.45)]">
              <div className="flex items-center gap-1.5 border-b border-ink-800 px-5 py-3.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
              </div>
              <div className="divide-y divide-ink-800/70 font-mono text-[12.5px]">
                {LEDGER.map(([field, type, note], i) => (
                  <motion.div
                    key={field}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
                    className="grid grid-cols-[7.5rem_1fr] gap-3 px-5 py-3 sm:grid-cols-[8.5rem_6.5rem_1fr]"
                  >
                    <span className="text-ink-50">{field}</span>
                    <span className="hidden text-brand-300 sm:block">{type}</span>
                    <span className="text-ink-500">{note}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- live activity ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-32 sm:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter text-ink-50 sm:text-5xl">Happening now</h2>
          {activity.length > perPage && <Pager i={page} n={pages} set={setPage} />}
        </Reveal>
        <Reveal delay={0.06} className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-ink-800">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                <p className="text-[15px] text-ink-400">Nothing yet. The first funded campaign shows up here.</p>
                <Link href="/campaigns/new">
                  <Button variant="outline">Launch a campaign</Button>
                </Link>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={page} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  {shown.map((a, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-ink-800 px-5 py-4 last:border-b-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-300">
                        {a.kind === 'payout' || a.kind === 'deposit' ? <Wallet className="h-4 w-4" /> : a.kind === 'clip' ? <Scissors className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] text-ink-50">
                          <span className="font-bold">{shortAddr(a.wallet)}</span>{' '}
                          <span className="text-ink-400">
                            {a.kind === 'payout' ? 'was paid for' : a.kind === 'deposit' ? 'funded' : a.kind === 'clip' ? 'submitted a clip to' : 'launched'}
                          </span>{' '}
                          {a.title}
                        </div>
                        <div className="text-[13px] text-ink-500">{timeAgo(a.createdAt)}</div>
                      </div>
                      {a.kind !== 'clip' && (
                        <span className="shrink-0 font-display text-[15px] font-bold text-ink-50 tabular">
                          {fmtUsd(a.amount)}
                          {a.kind === 'campaign' && <span className="text-[13px] font-medium text-ink-500">/1K</span>}
                        </span>
                      )}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </Reveal>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="mx-auto max-w-3xl px-5 pt-32 sm:px-8">
        <Reveal>
          <h2 className="font-display text-4xl font-extrabold tracking-tighter text-ink-50 sm:text-5xl">Questions.</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-ink-800 border-y border-ink-800">
          {FAQ.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setFaq(faq === i ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-bold text-ink-50 transition hover:text-brand-200"
                aria-expanded={faq === i}
              >
                {f.q}
                <span className={`text-2xl font-light transition-transform ${faq === i ? 'rotate-45 text-brand-400' : 'text-ink-500'}`}>+</span>
              </button>
              <AnimatePresence initial={false}>
                {faq === i && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden pb-5 text-[15px] leading-relaxed text-ink-400"
                  >
                    {f.a}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-32 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-ink-800 px-8 py-24 text-center">
            <div aria-hidden className="hero-glow animate-glow pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-5xl font-extrabold tracking-tighter text-ink-50 sm:text-7xl">
                Every view has a <span className="text-brand-400">price.</span>
              </h2>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link href="/campaigns">
                  <Button size="lg">Start clipping</Button>
                </Link>
                <Link href="/campaigns/new">
                  <Button size="lg" variant="outline">
                    Fund a campaign
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
