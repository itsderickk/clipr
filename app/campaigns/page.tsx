'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Platform } from '@/lib/types';
import { PLATFORMS } from '@/lib/format';
import { EASE, Reveal } from '@/components/motion';
import { Micro, Skeleton } from '@/components/ui';
import { CampaignCard } from '@/components/campaign-card';
import { PlatformIcon } from '@/components/icons';

type Sort = 'newest' | 'rate' | 'budget';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [sort, setSort] = useState<Sort>('newest');

  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns')
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => setCampaigns([]));
  }, []);

  const filtered = useMemo(() => {
    if (!campaigns) return null;
    let list = campaigns.filter((c) => platform === 'all' || c.platforms.includes(platform));
    if (sort === 'rate') list = [...list].sort((a, b) => b.ratePerThousand - a.ratePerThousand);
    if (sort === 'budget')
      list = [...list].sort(
        (a, b) => b.budgetCents - b.spentCents - (a.budgetCents - a.spentCents)
      );
    return list;
  }, [campaigns, platform, sort]);

  const platformKeys = Object.keys(PLATFORMS) as Platform[];

  return (
    <div className="mx-auto min-h-[70vh] max-w-7xl px-5 py-16 sm:px-8">
      <Reveal>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
          Open campaigns
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-400">
          Every campaign shows its rate per 1,000 views and the budget remaining. Pick one,
          clip it, submit the link.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={platform === 'all'} onClick={() => setPlatform('all')}>
            All
          </FilterChip>
          {platformKeys.map((p) => (
            <FilterChip key={p} active={platform === p} onClick={() => setPlatform(p)}>
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {PLATFORMS[p].label}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {(['newest', 'rate', 'budget'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition ${
                sort === s ? 'text-ink-950' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {sort === s && (
                <motion.span
                  layoutId="sort-pill"
                  className="absolute inset-0 rounded-md bg-ink-50"
                  transition={{ duration: 0.3, ease: EASE }}
                />
              )}
              <span className="relative">{s === 'rate' ? 'Top rate' : s === 'budget' ? 'Budget' : 'Newest'}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered === null && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72" />)}
        <AnimatePresence mode="popLayout">
          {filtered?.map((c, i) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.4), ease: EASE }}
            >
              <CampaignCard campaign={c} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered?.length === 0 && (
        <Reveal className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-6 w-6 text-ink-500" />
          <p className="text-sm text-ink-400">
            No campaigns match this filter yet. Try another platform.
          </p>
        </Reveal>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? 'border-ink-50 bg-ink-50 text-ink-950'
          : 'border-ink-600 text-ink-300 hover:border-ink-400 hover:text-ink-50'
      }`}
    >
      {children}
    </button>
  );
}
