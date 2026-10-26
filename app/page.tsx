'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Scissors,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Platform, PlatformStats } from '@/lib/types';
import { fmtNum, fmtUsd, shortAddr, timeAgo } from '@/lib/format';
import { AnimatedNumber, EASE, Marquee, Reveal } from '@/components/motion';
import { Button } from '@/components/ui';
import { PlatformIcon } from '@/components/icons';

type Activity = { kind: 'payout' | 'campaign' | 'clip'; amount: number; wallet: string | null; title: string; createdAt: string };

/* Shown in the ticker only until real campaigns exist; every card is labelled "Example". */
const EXAMPLES: Pick<Campaign, 'id' | 'title' | 'platforms' | 'ratePerThousand' | 'budgetCents' | 'spentCents'>[] = [
  { id: 'ex1', title: 'Podcast — Founder Interviews', platforms: ['tiktok', 'youtube'], ratePerThousand: 100, budgetCents: 50000, spentCents: 12400 },
  { id: 'ex2', title: 'Keynote — Launch Moments', platforms: ['youtube', 'x'], ratePerThousand: 150, budgetCents: 120000, spentCents: 30100 },
  { id: 'ex3', title: 'Tournament — Highlight Run', platforms: ['tiktok', 'instagram'], ratePerThousand: 80, budgetCents: 25000, spentCents: 4200 },
  { id: 'ex4', title: 'Stream — Best Reactions', platforms: ['tiktok', 'x'], ratePerThousand: 120, budgetCents: 60000, spentCents: 21800 },
  { id: 'ex5', title: 'Album — Studio Sessions', platforms: ['instagram', 'youtube'], ratePerThousand: 200, budgetCents: 200000, spentCents: 51000 },
];

const LEDGER = [
  ['campaign_id', 'uuid', 'rides on the Whop payment itself'],
  ['budget_cents', 'int64', 'credited once per signed webhook'],
  ['rate_per_1k', 'int64', 'set by the creator, public to clippers'],
  ['min_views', 'int64', 'clips under it earn nothing'],
  ['max_payout', 'int64 | null', 'optional cap per clip'],
  ['earned', 'int64', 'floor(views × rate ÷ 1,000)'],
  ['paid', 'int64', 'written only after Whop confirms'],
  ['owed', 'int64', 'earned − paid, so nothing double-pays'],
];

const STEPS = [
  { n: '01', title: 'Fund', body: 'A creator posts the source, sets a rate per 1,000 views and funds the budget through Whop checkout.' },
  { n: '02', title: 'Clip', body: 'Clippers cut the moments that work, post to TikTok, YouTube, Instagram or X and submit the link.' },
  { n: '03', title: 'Verify', body: 'Each submission is reviewed against the campaign. YouTube views pull automatically.' },
  { n: '04', title: 'Get paid', body: "Approved clips earn the posted rate. A Whop transfer lands in the clipper's balance in seconds." },
];

const FAQ = [
  { q: 'Who pays, and how?', a: 'Creators fund campaigns through Whop checkout: card, Apple Pay, bank transfer or crypto. Clipr never touches card details.' },
  { q: 'How are clippers paid?', a: "Approved clips earn the posted rate per 1,000 verified views, sent as a Whop transfer into the clipper's own balance. Withdraw to banks, cards and wallets in 241+ territories." },
  { q: 'What if a clip keeps getting views?', a: 'Each settlement pays only the difference between what a clip has earned and what it has already been paid, up to the campaign cap.' },
  { q: 'Can creators get unspent budget back?', a: 'Yes. Remaining budget can be withdrawn from the campaign at any time.' },
];

/* ---------------- small building blocks ---------------- */

function SectionHead({ eyebrow, title, sub, action }: { eyebrow: string; title: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p className="text-[13px] font-medium text-ink-500">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-[2.75rem] sm:leading-[1.1]">{title}</h2>
        {sub && <p className="mt-4 text-[15px] leading-relaxed text-ink-400">{sub}</p>}
      </div>
      {action}
    </Reveal>
  );
}

function OpenLink({ href, label = 'Open' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-full border border-ink-700 px-3 py-1 text-[13px] font-semibold text-ink-50 transition hover:bg-ink-50/10"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Tile({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-ink-800 bg-gradient-to-b from-ink-900 to-ink-950 p-6 sm:p-7 ${className}`}>
      {children}
    </div>
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

/* ---------------- campaign ticker ---------------- */

function TickerCard({ c, example }: { c: (typeof EXAMPLES)[number]; example?: boolean }) {
  const remaining = Math.max(0, c.budgetCents - c.spentCents);
  const body = (
    <div className="mx-2 flex w-[20.5rem] items-center gap-4 rounded-2xl border border-ink-800 bg-ink-900/70 p-4 transition hover:border-ink-600">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-950 text-ink-50">
        <PlatformIcon platform={c.platforms[0] as Platform} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-ink-50">{c.title}</div>
        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-500">
          <span className="tabular text-ink-200">{fmtUsd(c.ratePerThousand)}/1K</span>
          <span>·</span>
          <span className="tabular">{fmtUsd(remaining)} left</span>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${example ? 'border border-ink-700 text-ink-500' : 'bg-ink-50 text-ink-950'}`}>
        {example ? 'Example' : 'Live'}
      </span>
    </div>
  );
  return example ? body : <Link href={`/campaigns/${c.id}`}>{body}</Link>;
}

/* ---------------- payout preview ---------------- */

const RECEIPTS = [
  { id: '0417', platform: 'tiktok' as Platform, handle: '@novaclips', views: 48210, rate: 0.05 },
  { id: '0418', platform: 'youtube' as Platform, handle: '@reelframe', views: 126400, rate: 0.08 },
  { id: '0419', platform: 'x' as Platform, handle: '@fastcuts', views: 31900, rate: 0.12 },
];

function PayoutPreview() {
  const [idx, setIdx] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % RECEIPTS.length), 4200);
    return () => clearTimeout(t);
  }, [idx, reduce]);
  const r = RECEIPTS[idx];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={r.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between rounded-2xl border border-ink-800 bg-ink-950 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-ink-50">
              <PlatformIcon platform={r.platform} className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[15px] font-bold text-ink-50">{r.handle}</div>
              <div className="text-[13px] text-ink-500 tabular">{r.views.toLocaleString('en-US')} views · ${r.rate.toFixed(2)}/1K</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-ink-50 tabular">${((r.views / 1000) * r.rate).toFixed(2)}</div>
            <div className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-300">
              <BadgeCheck className="h-3.5 w-3.5" /> Sent
            </div>
          </div>
        </div>
        <p className="text-[12px] text-ink-600">Illustrative payout · #{r.id}</p>
      </motion.div>
    </AnimatePresence>
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
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(activity.length / perPage));
  const shown = useMemo(() => activity.slice(page * perPage, page * perPage + perPage), [activity, page]);

  const statItems = [
    { label: 'Paid to clippers', value: stats?.totalPaidCents ?? 0, fmt: (v: number) => fmtUsd(Math.round(v)) },
    { label: 'Live budgets', value: stats?.escrowedCents ?? 0, fmt: (v: number) => fmtUsd(Math.round(v)) },
    { label: 'Clips submitted', value: stats?.totalClips ?? 0 },
    { label: 'Verified views', value: stats?.totalViews ?? 0, fmt: (v: number) => fmtNum(Math.round(v)) },
  ];

  return (
    <div className="overflow-x-clip">
      {/* ---------------- hero ---------------- */}
      <section className="relative">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[38rem]" />
        <div aria-hidden className="dot-bg pointer-events-none absolute inset-x-0 top-0 h-[38rem]" />

        <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-20 text-center sm:px-8 sm:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-[13px] font-medium text-ink-300 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-400" />
            Clip-to-earn marketplace · payments by Whop
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            className="mx-auto mt-7 max-w-4xl font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tighter text-ink-50 sm:text-7xl lg:text-[5.25rem]"
          >
            Pay clippers for
            <span className="block text-ink-500">every view they earn.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
            className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-400"
          >
            Creators fund a campaign and set a rate per 1,000 views. Clippers post, views get verified, and payouts
            land in their Whop balance in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
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
        </div>

        {/* campaign ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="relative [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <Marquee>
            {ticker.map((c) => (
              <TickerCard key={c.id} c={c} example={!live} />
            ))}
          </Marquee>
        </motion.div>
        <div className="mt-5 flex justify-center">
          <Link href="/campaigns" className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-300 transition hover:text-ink-50">
            Explore campaigns <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ---------------- bento ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <SectionHead eyebrow="Product" title="Everything between a view and a payout." />
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-3">
            <Tile className="h-full">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink-50">Payouts</h3>
                  <p className="mt-1 text-[15px] text-ink-400">Approved clips settle straight to Whop.</p>
                </div>
                <OpenLink href="/dashboard" />
              </div>
              <div className="mt-6">
                <PayoutPreview />
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.06} className="md:col-span-3">
            <Tile className="h-full">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink-50">Launch</h3>
                  <p className="mt-1 text-[15px] text-ink-400">Post a source, set a rate, fund it.</p>
                </div>
                <OpenLink href="/campaigns/new" label="Launch" />
              </div>
              <div className="mt-6 rounded-2xl border border-ink-800 bg-ink-950 p-4">
                <div className="text-[13px] font-medium text-ink-500">Campaign setup</div>
                <dl className="mt-3 space-y-2.5 text-[14px]">
                  {[
                    ['Rate', '$1.00 per 1K views'],
                    ['Budget', '$500.00'],
                    ['Min views', '1,000'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-ink-500">{k}</dt>
                      <dd className="font-semibold text-ink-50 tabular">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-500">Platforms</dt>
                    <dd className="flex gap-2 text-ink-50">
                      {(['tiktok', 'youtube', 'instagram', 'x'] as Platform[]).map((p) => (
                        <PlatformIcon key={p} platform={p} className="h-4 w-4" />
                      ))}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2 border-t border-ink-800 pt-3 text-[13px] font-semibold text-ink-50">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Ready to launch
                </div>
              </div>
            </Tile>
          </Reveal>

          <Reveal delay={0.1} className="md:col-span-2">
            <Tile className="h-full">
              <Scissors className="h-6 w-6 text-ink-50" />
              <h3 className="mt-5 font-display text-lg font-bold text-ink-50">Open marketplace</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-400">Rates and remaining budget are public, so clippers know the money is there.</p>
            </Tile>
          </Reveal>
          <Reveal delay={0.14} className="md:col-span-2">
            <Tile className="h-full">
              <Eye className="h-6 w-6 text-ink-50" />
              <h3 className="mt-5 font-display text-lg font-bold text-ink-50">Verified views</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-400">Every clip is reviewed against the campaign before a cent moves.</p>
            </Tile>
          </Reveal>
          <Reveal delay={0.18} className="md:col-span-2">
            <Tile className="h-full">
              <Wallet className="h-6 w-6 text-ink-50" />
              <h3 className="mt-5 font-display text-lg font-bold text-ink-50">Withdraw anywhere</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-400">Banks, cards and wallets in 241+ territories through Whop.</p>
            </Tile>
          </Reveal>
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <Reveal>
          <div className="grid grid-cols-2 overflow-hidden rounded-3xl border border-ink-800 lg:grid-cols-4">
            {statItems.map((s, i) => (
              <div
                key={s.label}
                className={`p-6 sm:p-8 ${i % 2 === 1 ? 'border-l border-ink-800' : ''} ${i >= 2 ? 'border-t border-ink-800 lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
              >
                <div className="text-[13px] font-medium text-ink-500">{s.label}</div>
                <div className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
                  <AnimatedNumber value={s.value} format={s.fmt} />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-28 sm:px-8">
        <SectionHead eyebrow="How it works" title="Four steps. One ledger." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.05}>
              <Tile className="h-full">
                <span className="font-mono text-[13px] text-ink-500">{s.n}</span>
                <h3 className="mt-6 font-display text-xl font-bold text-ink-50">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-400">{s.body}</p>
              </Tile>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- ledger / technical ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <p className="text-[13px] font-medium text-ink-500">Protocol</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-[2.75rem] sm:leading-[1.1]">
              Settlement is per clip.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
              Every submission carries its own ledger. As views grow, each settlement covers only the difference, so a
              retried payout can never pay twice.
            </p>
            <div className="mt-8 space-y-5">
              <div>
                <h3 className="text-[15px] font-bold text-ink-50">Funding</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-400">
                  Whop signs every payment event. Clipr verifies the signature and credits the budget exactly once.
                </p>
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-ink-50">Transfers</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-400">
                  Payouts run with an idempotence key, and the payout row is written only after Whop confirms.
                </p>
              </div>
            </div>
            <div className="mt-8">
              <OpenLink href="/docs" label="Read the docs" />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-3xl border border-ink-800 bg-ink-950">
              <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
                <span className="font-mono text-[13px] text-ink-50">submission.ledger</span>
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
                </span>
              </div>
              <div className="divide-y divide-ink-800/70 font-mono text-[12.5px]">
                {LEDGER.map(([field, type, note]) => (
                  <div key={field} className="grid grid-cols-[7.5rem_1fr] gap-3 px-5 py-3 sm:grid-cols-[8.5rem_6.5rem_1fr]">
                    <span className="text-ink-50">{field}</span>
                    <span className="hidden text-brand-300 sm:block">{type}</span>
                    <span className="text-ink-500">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- live activity ---------------- */}
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <SectionHead
          eyebrow="Live"
          title="Recent activity"
          action={activity.length > perPage ? <Pager i={page} n={pages} set={setPage} /> : undefined}
        />
        <Reveal delay={0.06} className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-ink-800">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                <p className="text-[15px] text-ink-400">No activity yet. The first funded campaign shows up here.</p>
                <Link href="/campaigns/new">
                  <Button variant="outline">Launch a campaign</Button>
                </Link>
              </div>
            ) : (
              shown.map((a, i) => (
                <div key={page + '-' + i} className="flex items-center gap-4 border-b border-ink-800 px-5 py-4 last:border-b-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-800 text-ink-50">
                    {a.kind === 'payout' ? <Wallet className="h-4 w-4" /> : a.kind === 'clip' ? <Scissors className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-ink-50">
                      <span className="font-bold">{shortAddr(a.wallet)}</span>{' '}
                      <span className="text-ink-400">
                        {a.kind === 'payout' ? 'was paid for' : a.kind === 'clip' ? 'submitted a clip to' : 'launched'}
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
              ))
            )}
          </div>
        </Reveal>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="mx-auto max-w-3xl px-5 pt-28 sm:px-8">
        <SectionHead eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-8 divide-y divide-ink-800 border-y border-ink-800">
          {FAQ.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setFaq(faq === i ? null : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-bold text-ink-50"
                aria-expanded={faq === i}
              >
                {f.q}
                <span className={`text-2xl font-light text-ink-500 transition-transform ${faq === i ? 'rotate-45' : ''}`}>+</span>
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
      <section className="mx-auto max-w-6xl px-5 pt-28 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-ink-800 px-8 py-20 text-center">
            <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold tracking-tighter text-ink-50 sm:text-6xl">
                Every view has a price.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[17px] text-ink-400">Set yours, or start earning from someone else&apos;s.</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
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
