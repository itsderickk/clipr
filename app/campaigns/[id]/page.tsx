'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Platform, Submission } from '@/lib/types';
import { fmtNum, fmtUsd, PLATFORMS, shortAddr, timeAgo } from '@/lib/format';
import { EASE, Reveal } from '@/components/motion';
import { Badge, Button, Card, Input, Label, Micro, Progress, Skeleton } from '@/components/ui';
import { PlatformIcon } from '@/components/icons';
import { useAuth } from '@/components/providers';
import { useToast } from '@/components/toast';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [mine, setMine] = useState<Submission[]>([]);
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = () =>
    api<{ campaign: Campaign; isOwner: boolean }>(`/api/campaigns/${id}`)
      .then((d) => {
        setCampaign(d.campaign);
        setIsOwner(d.isOwner);
        setPlatform((p) => p ?? d.campaign.platforms[0] ?? null);
      })
      .catch(() => setNotFound(true));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!user) return setMine([]);
    api<{ submissions: Submission[] }>('/api/submissions/mine')
      .then((d) => setMine(d.submissions.filter((s) => s.campaignId === id)))
      .catch(() => {});
  }, [user, id, justSubmitted]);

  const remaining = useMemo(
    () => (campaign ? Math.max(0, campaign.budgetCents - campaign.spentCents) : 0),
    [campaign]
  );

  async function submitClip() {
    if (!requireAuth('submit a clip')) return;
    if (!platform) return;
    setSubmitting(true);
    try {
      await api(`/api/campaigns/${id}/submissions`, {
        method: 'POST',
        body: { url: url.trim(), platform },
      });
      setUrl('');
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2600);
      toast('success', 'Clip submitted — it is now in review');
      load();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-start justify-center gap-4 px-5 sm:px-8">
        <h1 className="font-display text-3xl text-ink-50">Campaign not found</h1>
        <Button variant="outline" onClick={() => router.push('/campaigns')}>
          Back to campaigns
        </Button>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const c = campaign;

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <Reveal>
        <Link
          href="/campaigns"
          className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-400 transition hover:text-ink-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          All campaigns
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Badge status={c.status} pulse={c.status === 'ACTIVE'} />
          <span className="text-[13px] font-medium text-ink-500">
            by {shortAddr(c.creatorWallet)} · {timeAgo(c.createdAt)}
          </span>
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-ink-50 sm:text-5xl">
          {c.title}
        </h1>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* -------- left: the campaign -------- */}
        <div className="space-y-8">
          <Reveal delay={0.05}>
            <Micro>The campaign</Micro>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-200">
              {c.description}
            </p>
            {c.sourceUrl && (
              <a
                href={c.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="group mt-5 inline-flex items-center gap-2 rounded-lg border border-ink-600 px-4 py-2.5 text-[13px] font-medium text-ink-200 transition hover:border-ink-300"
              >
                <Link2 className="h-3.5 w-3.5" /> Source content
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            )}
          </Reveal>

          {c.requirements && (
            <Reveal delay={0.1}>
              <Micro>Requirements</Micro>
              <ul className="mt-3 space-y-2.5">
                {c.requirements
                  .split('\n')
                  .filter(Boolean)
                  .map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-ink-300">
                      <span className="mt-2 h-1 w-4 shrink-0 bg-ink-500" />
                      {r.replace(/^[-•]\s*/, '')}
                    </li>
                  ))}
              </ul>
            </Reveal>
          )}

          {/* -------- submit -------- */}
          {!isOwner && (
            <Reveal delay={0.15}>
              <Card hover={false} className="relative overflow-hidden p-6 sm:p-8">
                {justSubmitted && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-900/95"
                  >
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    >
                      <CheckCircle2 className="h-10 w-10 text-ink-50" />
                    </motion.div>
                    <p className="text-[13px] font-medium text-ink-300">
                      In review
                    </p>
                  </motion.div>
                )}
                <h3 className="font-display text-xl font-bold text-ink-50">Submit a clip</h3>
                <p className="mt-1.5 text-sm text-ink-400">
                  Post your edit, then drop the public link here. Earnings are computed from
                  verified views at {fmtUsd(c.ratePerThousand)} per 1,000. Payouts land in your Whop
                  balance.
                </p>

                {c.status !== 'ACTIVE' ? (
                  <p className="mt-6 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 text-[13px] font-medium text-ink-400">
                    This campaign is not accepting clips right now
                  </p>
                ) : (
                  <div className="mt-6 space-y-5">
                    <div>
                      <Label>Platform</Label>
                      <div className="flex flex-wrap gap-2">
                        {c.platforms.map((p) => (
                          <button
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-all ${
                              platform === p
                                ? 'border-ink-50 bg-ink-50 text-ink-950'
                                : 'border-ink-600 text-ink-300 hover:border-ink-400'
                            }`}
                          >
                            <PlatformIcon platform={p} className="h-4 w-4" />
                            {PLATFORMS[p].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Clip URL</Label>
                      <Input
                        placeholder={
                          platform === 'youtube'
                            ? 'https://youtube.com/shorts/…'
                            : platform
                              ? `https://${PLATFORMS[platform].hint.split(' ')[0]}/…`
                              : 'https://…'
                        }
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>
                    <Button
                      size="lg"
                      arrow
                      loading={submitting}
                      disabled={!url.trim()}
                      onClick={submitClip}
                    >
                      {!user ? 'Sign in & submit' : 'Submit clip'}
                    </Button>
                  </div>
                )}
              </Card>
            </Reveal>
          )}

          {isOwner && (
            <Reveal delay={0.15}>
              <Card hover={false} className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <p className="font-display text-ink-50">This is your campaign</p>
                  <p className="mt-1 text-sm text-ink-400">
                    Review clips, verify views and settle payouts from your dashboard.
                  </p>
                </div>
                <Link href="/dashboard">
                  <Button arrow>Open dashboard</Button>
                </Link>
              </Card>
            </Reveal>
          )}

          {/* -------- my submissions -------- */}
          {mine.length > 0 && (
            <Reveal delay={0.2}>
              <div className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-700">
                {mine.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-ink-900/60 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <PlatformIcon platform={s.platform} className="h-4 w-4 shrink-0 text-ink-300" />
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-ink-200 transition hover:text-ink-50"
                      >
                        {s.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-xs text-ink-300 tabular">
                      <span>{fmtNum(s.views)} views</span>
                      <span className="text-ink-50">{fmtUsd(s.paidCents > 0 ? s.paidCents : s.earnedCents)}</span>
                      <Badge status={s.paidCents >= s.earnedCents && s.paidCents > 0 ? 'PAID' : s.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        {/* -------- right: budget ledger -------- */}
        <div>
          <Reveal delay={0.1} className="lg:sticky lg:top-24">
            <Card hover={false} className="p-6 sm:p-7">
              <Micro>Rate</Micro>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-semibold text-ink-50 tabular">
                  {fmtUsd(c.ratePerThousand)}
                </span>
                <span className="text-xs font-medium text-ink-400">
                  per 1K views
                </span>
              </div>

              <div className="mt-7 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-400">
                    <span>Budget spent</span>
                    <span className="tabular text-ink-200">
                      {fmtUsd(c.spentCents)} / {fmtUsd(c.budgetCents)}
                    </span>
                  </div>
                  <Progress value={c.budgetCents ? (c.spentCents / c.budgetCents) * 100 : 0} />
                </div>

                <Row k="Remaining budget" v={fmtUsd(remaining)} strong />
                <Row k="Minimum views" v={fmtNum(c.minViews)} />
                {c.maxPayoutCents != null && (
                  <Row k="Max per clip" v={fmtUsd(c.maxPayoutCents)} />
                )}
                <Row k="Clips submitted" v={String(c.submissionCount ?? 0)} />
              </div>

              <div className="mt-7 border-t border-ink-800 pt-5">
                <Micro>Settlement</Micro>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
                  The budget is funded through Whop checkout and credited only when Whop confirms the
                  payment. Approved clips are paid by Whop transfer straight to the clipper&apos;s
                  Whop balance; unspent budget can be withdrawn by the creator.
                </p>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-ink-400">{k}</span>
      <span className={`font-mono text-xs tabular ${strong ? 'text-ink-50' : 'text-ink-200'}`}>{v}</span>
    </div>
  );
}
