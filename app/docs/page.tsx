'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { EASE, Reveal } from '@/components/motion';
import { Micro } from '@/components/ui';

/* ---------- shared bits ---------- */

function SplitBar({
  segments,
}: {
  segments: { label: string; pct: number; bar: string; text: string }[];
}) {
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-ink-700">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            className={'h-full ' + s.bar}
            initial={{ width: 0 }}
            whileInView={{ width: s.pct + '%' }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs font-medium">
        {segments.map((s) => (
          <span key={s.label} className={s.text}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[0.85em] text-ink-200">
      {children}
    </span>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm leading-relaxed text-ink-300 sm:text-[15px]">{children}</p>;
}

/* ---------- content ---------- */

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'The lifecycle' },
  { id: 'escrow', label: 'Custody' },
  { id: 'payouts', label: 'How a payout is decided' },
  { id: 'roles', label: 'Roles & permissions' },
  { id: 'trust', label: 'Trust model' },
  { id: 'tokenomics', label: 'Fees & tokenomics' },
];

export default function DocsPage() {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    TOC.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="mx-auto min-h-[80vh] max-w-7xl px-5 py-14 sm:px-8">
      <Reveal>
        <Micro>Documentation</Micro>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
          How Clipr works
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
          Everything under the hood — the money flow, the payout gates, who can do what, where the
          trust actually sits, and the token economics that fund it all.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-14 lg:grid-cols-[220px_1fr] lg:gap-20">
        {/* ---- toc ---- */}
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1 border-l border-ink-800">
            {TOC.map((s, i) => (
              <a
                key={s.id}
                href={'#' + s.id}
                className={
                  '-ml-px flex items-baseline gap-2.5 border-l py-1.5 pl-4 text-[13px] font-medium transition ' +
                  (active === s.id
                    ? 'border-brand-400 text-ink-50'
                    : 'border-transparent text-ink-500 hover:text-ink-200')
                }
              >
                <span className="tabular text-ink-600">0{i + 1}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ---- body ---- */}
        <div className="max-w-3xl">
          {/* 01 overview */}
          <section id="overview" className="scroll-mt-28">
            <Micro>01 / Overview</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              A settlement layer for clips
            </h2>
            <P>
              Clipr is a marketplace where creators buy distribution and clippers get paid for it.
              A creator posts a campaign with a rate per 1,000 views and funds a budget through
              Whop checkout. Clippers cut the source content, post it to TikTok, YouTube,
              Instagram or X, and submit their links. Approved clips earn the posted rate on
              verified views, and payouts land in the clipper&apos;s Whop balance — no invoices,
              no net-30, no middlemen.
            </P>
            <P>
              Identity is your Whop account: signing in is a standard Whop OAuth sign-in, and the
              Whop account you sign in with is the one that gets paid.
            </P>
          </section>

          {/* 02 lifecycle */}
          <section id="lifecycle" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>02 / The lifecycle</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              Four events, one ledger
            </h2>
            <P>
              Every clip lives through the same trace, the one animated on the landing page:{' '}
              <Mono>ESCROW_FUNDED</Mono> — the creator pays through Whop checkout and the signed
              payment webhook credits the campaign budget; <Mono>CLIP_SUBMITTED</Mono> — a clipper
              posts and files the link, which sits pending with no money moving;{' '}
              <Mono>VIEWS_VERIFIED</Mono> — the submission is reviewed against the campaign and a
              view count is attached, automatically from the YouTube Data API for YouTube links
              and at review time for other platforms; and <Mono>PAYOUT_CLEARED</Mono> — Clipr
              fires an idempotent Whop transfer and it lands in the clipper&apos;s balance, with the
              transfer id as the receipt.
            </P>
          </section>

          {/* 03 custody */}
          <section id="escrow" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>03 / Custody</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              One budget per campaign, Whop as the rails
            </h2>
            <P>
              Creators pay through Whop&apos;s hosted checkout — card, Apple Pay, bank transfer or
              crypto. Clipr never sees card details. The campaign id rides on the payment as
              metadata, so every dollar is tied to the campaign it funds.
            </P>
            <P>
              The budget moves only when Whop says so. Clipr verifies the signature on every
              webhook, re-reads the payment from the Whop API rather than trusting the event
              body, and records each payment id once — <Mono>budget = sum of confirmed
              payments</Mono>. Retries and replays are ignored by design. If a campaign
              can&apos;t cover the full amount owed on a clip, it pays what it can, records the
              partial, and leaves the remainder owed for the next top-up.
            </P>
          </section>

          {/* 04 payouts */}
          <section id="payouts" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>04 / Payouts</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              How a payout is decided
            </h2>
            <P>
              No money moves automatically. Payment is the last of a chain of gates. Submitting a
              clip creates a pending record — nothing else. A reviewer (the campaign&apos;s creator,
              or a platform admin) then judges the clip against the campaign and attaches a view
              count; YouTube counts can be pulled live from the YouTube Data API, other platforms
              are entered at review. Approval runs a deterministic formula:
            </P>
            <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900/60 px-5 py-4 font-mono text-[12px] leading-relaxed text-ink-200">
              earned = floor(views × rate ÷ 1,000)
              <br />
              <span className="text-ink-500">
                · zero below the campaign&apos;s minimum views · clipped to the per-clip cap · never
                revised below what&apos;s already been paid
              </span>
            </div>
            <P>
              Even approval moves nothing — it records what&apos;s earned. When the reviewer presses
              Pay, the server computes <Mono>owed = earned − paid</Mono> and sends a Whop transfer
              for exactly that delta to the clipper&apos;s Whop account, keyed by an idempotence key
              derived from the ledger so a double click or retry can&apos;t pay twice. Only after
              Whop accepts the transfer is the ledger written: the payout row, the clip&apos;s paid
              total, the campaign&apos;s spend. Whop first, ledger second — a failed transfer can
              never fabricate a &quot;paid&quot; record. Because views keep growing, the cycle repeats:
              refresh or re-approve with a higher count and the next Pay settles just the
              difference.
            </P>
          </section>

          {/* 05 roles */}
          <section id="roles" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>05 / Roles</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              Who can do what
            </h2>
            <div className="mt-5 divide-y divide-ink-800 rounded-xl border border-ink-800">
              {[
                {
                  role: 'Creators',
                  body: 'Own their campaigns end to end: fund and top up the budget, pause and resume the campaign, review submissions, set view counts, settle payouts \u2014 and withdraw the unspent budget back to their own Whop balance at any time.',
                },
                {
                  role: 'Clippers',
                  body: 'Browse live campaigns, submit links from the campaign\u2019s platforms, and track views, earnings and Whop transfer receipts from the dashboard. Payment arrives in the Whop account they signed in with.',
                },
                {
                  role: 'Admins',
                  body: 'Platform operators. A Review tab covers every campaign: they can approve or reject clips, verify views, pause campaigns, and settle payouts from any budget \u2014 but deposits and withdrawals stay creator-only, and payouts they trigger can only go to the submitting clipper\u2019s Whop account.',
                },
              ].map((r) => (
                <div key={r.role} className="grid gap-2 px-5 py-5 sm:grid-cols-[120px_1fr] sm:gap-6">
                  <span className="text-[13px] font-medium text-brand-300">
                    {r.role}
                  </span>
                  <p className="text-sm leading-relaxed text-ink-300">{r.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 06 trust */}
          <section id="trust" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>06 / Trust model</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              Where the trust actually sits
            </h2>
            <P>
              Clipr is custodial in this release, and the docs would be dishonest not to spell out
              what that means. Campaign budgets sit in the platform&apos;s Whop balance; Clipr&apos;s
              ledger tracks how much of it belongs to each campaign. What it gives you: regulated
              payment rails, per-campaign accounting, and a Whop transfer id for every settlement.
              What it does not give you: trustlessness.
            </P>
            <P>
              Three layers, plainly. First, the admin role has no direct path to budget money —
              there is no endpoint that pays an admin, and withdrawals only ever return funds to
              the campaign&apos;s creator. Second, review power is indirect spending power: whoever
              decides a clip&apos;s view count decides what the budget owes, so admins are bounded by
              visibility — transfer receipts, a payout ledger, and creators who can pause or
              withdraw the moment something looks wrong — rather than by code. Third, the
              platform operator controls the Whop company that holds the funds: that is what
              custodial means.
            </P>
          </section>

          {/* 07 tokenomics */}
          <section id="tokenomics" className="mt-12 scroll-mt-28 border-t border-ink-800 pt-12">
            <Micro>07 / Fees & tokenomics</Micro>
            <h2 className="mt-3 font-display text-2xl font-bold text-ink-50">
              10% in — 60% back into the chart
            </h2>
            <P>
              Clipr charges exactly one fee: <span className="text-ink-50">10% of each
              payout</span>, taken at the moment of settlement. Clippers keep 90% of everything
              they earn. There are no listing fees, no subscriptions, and no cut of creator
              deposits — an unspent budget withdraws in full.
            </P>
            <div className="mt-6 space-y-7">
              <SplitBar
                segments={[
                  { label: 'Clippers · 90%', pct: 90, bar: 'bg-brand-500', text: 'text-brand-300' },
                  { label: 'Protocol · 10%', pct: 10, bar: 'bg-ink-50', text: 'text-ink-200' },
                ]}
              />
              <SplitBar
                segments={[
                  { label: '$CLIPR buybacks · 60%', pct: 60, bar: 'bg-brand-500', text: 'text-brand-300' },
                  { label: 'Clipr campaigns · 30%', pct: 30, bar: 'bg-brand-300', text: 'text-brand-400' },
                  { label: 'Operations · 10%', pct: 10, bar: 'bg-ink-50', text: 'text-ink-200' },
                ]}
              />
            </div>
            <P>
              The second split is the token engine, and it runs three ways.{' '}
              <span className="text-ink-50">
                60% of protocol profits buy $CLIPR back on the open market
              </span>{' '}
              — straight back into the chart.{' '}
              <span className="text-ink-50">
                30% funds Clipr-run campaigns on this marketplace
              </span>{' '}
              — protocol-funded campaigns that pay clippers directly, making the protocol
              its own biggest creator. The remaining 10% covers operations. Put together, for
              every{' '}
              <span className="text-ink-50">$1.00</span> that settles, $0.10 flows to the protocol:
              up to $0.06 returns as $CLIPR buy pressure and $0.03 is recycled into fresh campaigns — fee volume literally funds the
              next round of clipper payouts.
            </P>
            <p className="mt-6 rounded-xl border border-ink-800 bg-ink-900/50 px-5 py-4 font-mono text-[11px] leading-relaxed text-ink-400">
              Status: $CLIPR is pre-listing — until it trades, protocol fees accrue to the
              treasury and the token page charts SOL. Fee routing activates in a later release;
              the current build settles 100% of payouts to clippers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
