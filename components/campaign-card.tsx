'use client';

import Link from 'next/link';
import { ArrowUpRight, Eye, Scissors } from 'lucide-react';
import type { Campaign } from '@/lib/types';
import { fmtNum, fmtUsd, shortAddr } from '@/lib/format';
import { Badge, Card, Micro, Progress } from './ui';
import { PlatformIcon } from './icons';

export function CampaignCard({ campaign: c }: { campaign: Campaign }) {
  const remaining = Math.max(0, c.budgetCents - c.spentCents);
  const pct = c.budgetCents > 0 ? (c.spentCents / c.budgetCents) * 100 : 0;

  return (
    <Link href={`/campaigns/${c.id}`} className="group block h-full">
      <Card className="flex h-full flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-ink-300">
            {c.platforms.map((p) => (
              <PlatformIcon key={p} platform={p} className="h-4 w-4 transition-colors group-hover:text-ink-50" />
            ))}
          </div>
          <Badge status={c.status} pulse={c.status === 'ACTIVE'} />
        </div>

        <h3 className="mt-4 font-display text-lg font-medium leading-snug text-ink-50">
          {c.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-400">{c.description}</p>

        <div className="mt-5 flex items-end justify-between border-t border-ink-800 pt-4">
          <div>
            <Micro>Rate</Micro>
            <div className="mt-1 flex items-center gap-1.5 font-display text-xl font-semibold text-ink-50">
              <span className="tabular">{fmtUsd(c.ratePerThousand)}</span>
              <span className="font-mono text-[10px] uppercase tracking-micro text-ink-400">/ 1K views</span>
            </div>
          </div>
          <div className="text-right">
            <Micro>Remaining</Micro>
            <div className="mt-1 font-mono text-sm text-ink-200 tabular">{fmtUsd(remaining)}</div>
          </div>
        </div>

        <div className="mt-4">
          <Progress value={pct} />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-micro text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Scissors className="h-3 w-3" /> {c.submissionCount ?? 0} clips
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> min {fmtNum(c.minViews)}
            </span>
            <span>{shortAddr(c.creatorWallet)}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 transition-colors group-hover:text-ink-50">
          <span>Open campaign</span>
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </Card>
    </Link>
  );
}
