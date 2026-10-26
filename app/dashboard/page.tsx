'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Submission } from '@/lib/types';
import { fmtNum, fmtUsd, shortAddr, timeAgo } from '@/lib/format';
import { EASE, Reveal } from '@/components/motion';
import { Badge, Button, Card, Input, Label, Micro, Modal, Skeleton } from '@/components/ui';
import { PlatformIcon } from '@/components/icons';
import { useAuth } from '@/components/providers';
import { useToast } from '@/components/toast';
import { EscrowPanel } from '@/components/escrow-panel';

type Tab = 'earnings' | 'campaigns' | 'review';

export default function Dashboard() {
  const { user, loading, signIn, signingIn } = useAuth();
  const [tab, setTab] = useState<Tab>('earnings');

  // ?tab=campaigns|review deep-links (e.g. "Fund later" from the wizard).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'earnings' || t === 'campaigns' || t === 'review') setTab(t);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-8 h-96" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-5 sm:px-8">
        <Reveal>
          <Card hover={false} className="max-w-md p-10 text-center">
            <Wallet className="mx-auto h-7 w-7 text-ink-300" />
            <h1 className="mt-5 font-display text-2xl font-bold text-ink-50">
              Your ledger lives here
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-400">
              Connect your Solana wallet to open your dashboard — earnings, campaigns and
              settlements in one place.
            </p>
            <div className="mt-7 flex justify-center">
              <Button size="lg" loading={signingIn} onClick={() => signIn()}>
                Connect wallet
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
    );
  }

  const tabs: Tab[] = user.isAdmin ? ['earnings', 'campaigns', 'review'] : ['earnings', 'campaigns'];

  return (
    <div className="mx-auto min-h-[80vh] max-w-7xl px-5 py-14 sm:px-8">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Micro>Dashboard</Micro>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink-50">
            {user.username || shortAddr(user.wallet, 5)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {user.wallet && (
            <a
              href={`https://solscan.io/account/${user.wallet}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-xs font-medium text-ink-300 transition hover:text-ink-50"
            >
              Wallet ↗
            </a>
          )}
          <Link href="/campaigns/new">
            <Button arrow>
              <Plus className="h-3.5 w-3.5" /> New campaign
            </Button>
          </Link>
        </div>
      </Reveal>

      {/* tabs */}
      <div className="mt-10 flex gap-1 border-b border-ink-700">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-5 py-3 text-[13px] font-medium transition ${
              tab === t ? 'text-ink-50' : 'text-ink-500 hover:text-ink-200'
            }`}
          >
            {t === 'earnings' ? 'Clipping' : t === 'campaigns' ? 'Creating' : 'Review'}
            {tab === t && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-ink-50"
                transition={{ duration: 0.3, ease: EASE }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-8"
        >
          {tab === 'earnings' ? <Earnings /> : tab === 'campaigns' ? <Campaigns /> : <AdminReview />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ==================== clipper side ==================== */

function Earnings() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ submissions: Submission[] }>('/api/submissions/mine')
      .then((d) => setSubs(d.submissions))
      .catch(() => setSubs([]));
  }, []);
  useEffect(load, [load]);

  const totals = useMemo(() => {
    const s = subs ?? [];
    return {
      earned: s.reduce((a, x) => a + x.earnedCents, 0),
      paid: s.reduce((a, x) => a + x.paidCents, 0),
      pending: s.filter((x) => x.status === 'PENDING').length,
      views: s.filter((x) => x.status === 'APPROVED').reduce((a, x) => a + x.views, 0),
    };
  }, [subs]);

  async function refreshViews(id: string) {
    setRefreshing(id);
    try {
      const { submission } = await api<{ submission: Submission }>(
        `/api/submissions/${id}/refresh`,
        { method: 'POST' }
      );
      setSubs((cur) => cur?.map((s) => (s.id === id ? { ...s, ...submission } : s)) ?? null);
      toast('success', `Views updated — ${fmtNum(submission.views)} verified`);
    } catch (e: any) {
      toast('info', e.message);
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Settled to your wallet" usd value={totals.paid} strong />
        <Stat label="Approved earnings" usd value={totals.earned} />
        <Stat label="Verified views" value={totals.views} />
        <Stat label="Clips in review" value={totals.pending} />
      </div>

      <div className="mt-8">
        {subs === null && <Skeleton className="h-64" />}
        {subs?.length === 0 && (
          <Card hover={false} className="flex flex-col items-center gap-4 p-12 text-center">
            <p className="max-w-sm text-sm text-ink-400">
              No clips yet. Find a campaign, post your edit, and your earnings ledger starts here.
            </p>
            <Link href="/campaigns">
              <Button arrow>Browse campaigns</Button>
            </Link>
          </Card>
        )}
        {!!subs?.length && (
          <div className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-700">
            {subs.map((s, i) => {
              const settled = s.paidCents >= s.earnedCents && s.paidCents > 0;
              const owed = Math.max(0, s.earnedCents - s.paidCents);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: EASE }}
                  className="grid gap-3 bg-ink-900/60 px-5 py-4 transition-colors hover:bg-ink-850 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={s.platform} className="h-4 w-4 shrink-0 text-ink-300" />
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs text-ink-100 transition hover:text-ink-50"
                      >
                        {s.url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-ink-500">
                      {s.campaignTitle} · {timeAgo(s.createdAt)}
                      {s.ratePerThousand ? ` · ${fmtUsd(s.ratePerThousand)} / 1K` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular">
                    <span className="text-ink-300">{fmtNum(s.views)} views</span>
                    <span className="text-ink-50">{fmtUsd(settled ? s.paidCents : s.earnedCents)}</span>
                    {owed > 0 && s.status === 'APPROVED' && (
                      <span className="text-[10px] uppercase tracking-micro text-ink-400">
                        {fmtUsd(owed)} owed
                      </span>
                    )}
                    {s.platform === 'youtube' && s.status !== 'REJECTED' && (
                      <button
                        onClick={() => refreshViews(s.id)}
                        className="rounded-md border border-ink-600 p-1.5 text-ink-400 transition hover:border-ink-300 hover:text-ink-50"
                        title="Refresh view count"
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshing === s.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    {s.lastTx && (
                      <span className="text-[10px] text-ink-500" title="Last payout transaction">
                        transfer {shortAddr(s.lastTx, 6)}
                      </span>
                    )}
                    <Badge status={settled ? 'PAID' : s.status} pulse={s.status === 'PENDING'} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== creator side ==================== */

function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  const load = useCallback(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns?mine=1')
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => setCampaigns([]));
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      {campaigns === null && <Skeleton className="h-64" />}
      {campaigns?.length === 0 && (
        <Card hover={false} className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="max-w-sm text-sm text-ink-400">
            You have not launched a campaign yet. Fund a campaign and let clippers do the distribution.
          </p>
          <Link href="/campaigns/new">
            <Button arrow>Launch a campaign</Button>
          </Link>
        </Card>
      )}
      <div className="space-y-4">
        {campaigns?.map((c) => <CampaignRow key={c.id} campaign={c} onChange={load} />)}
      </div>
    </div>
  );
}

function AdminReview() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  const load = useCallback(() => {
    api<{ campaigns: Campaign[] }>('/api/campaigns?admin=1')
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => setCampaigns([]));
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      <p className="mb-5 text-xs font-medium text-ink-500">
        Admin — every campaign on the platform, pending reviews first. Approve clips and settle
        payouts from each campaign's budget.
      </p>
      {campaigns === null && <Skeleton className="h-64" />}
      {campaigns?.length === 0 && (
        <Card hover={false} className="p-12 text-center">
          <p className="text-sm text-ink-400">No campaigns on the platform yet.</p>
        </Card>
      )}
      <div className="space-y-4">
        {campaigns?.map((c) => (
          <CampaignRow key={c.id} campaign={c} onChange={load} admin />
        ))}
      </div>
    </div>
  );
}

function CampaignRow({
  campaign: c,
  onChange,
  admin,
}: {
  campaign: Campaign;
  onChange: () => void;
  admin?: boolean;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.id === c.creatorId;
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [review, setReview] = useState<Submission | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<'withdraw' | 'status' | null>(null);

  const remaining = Math.max(0, c.budgetCents - c.spentCents);

  const loadSubs = useCallback(() => {
    api<{ submissions: Submission[] }>(`/api/campaigns/${c.id}/submissions`)
      .then((d) => setSubs(d.submissions))
      .catch(() => setSubs([]));
  }, [c.id]);

  useEffect(() => {
    if (open && subs === null) loadSubs();
  }, [open, subs, loadSubs]);

  async function pay(s: Submission) {
    setPaying(s.id);
    try {
      const res = await api<{ submission: Submission; payout: { amountCents: number; partial: boolean; status: string } }>(
        `/api/submissions/${s.id}/pay`,
        { method: 'POST' }
      );
      toast(
        'success',
        `${fmtUsd(res.payout.amountCents)} ${res.payout.status === 'confirmed' ? 'sent' : 'queued'} to ${shortAddr(s.clipperWallet)}${res.payout.partial ? ' (partial — budget low)' : ''}`
      );
      loadSubs();
      onChange();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setPaying(null);
    }
  }

  async function withdraw() {
    setBusy('withdraw');
    try {
      const res = await api<{ amountCents: number }>(`/api/campaigns/${c.id}/withdraw`, { method: 'POST' });
      toast('success', `${fmtUsd(res.amountCents)} refunded to your wallet`);
      onChange();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(status: 'ACTIVE' | 'PAUSED') {
    setBusy('status');
    try {
      await api(`/api/campaigns/${c.id}`, { method: 'PATCH', body: { status } });
      toast('success', status === 'PAUSED' ? 'Campaign paused' : 'Campaign resumed');
      onChange();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card hover={false} className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-ink-850"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-lg font-bold text-ink-50">{c.title}</h3>
            <Badge status={c.status} pulse={c.status === 'ACTIVE'} />
            {admin && !isOwner && (
              <span className="rounded-full border border-ink-700 px-2 py-0.5 font-mono text-[10px] text-ink-400">
                by {shortAddr(c.creatorWallet)}
              </span>
            )}
            {!!c.pendingCount && (
              <span className="rounded-full bg-ink-50 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-950">
                {c.pendingCount} to review
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs font-medium text-ink-500">
            {fmtUsd(c.ratePerThousand)} / 1K · {c.submissionCount ?? 0} clips ·{' '}
            {timeAgo(c.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <Micro>Remaining</Micro>
            <div className="font-mono text-sm text-ink-50 tabular">{fmtUsd(remaining)}</div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-ink-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-ink-800 px-6 py-6">
              <div className="mb-6">
                <EscrowPanel campaignId={c.id} owner={isOwner} onFunded={onChange} />
              </div>

              {/* treasury controls */}
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
                <div className="ml-auto flex flex-wrap gap-2">
                  {c.status === 'ACTIVE' && (
                    <Button variant="outline" loading={busy === 'status'} onClick={() => setStatus('PAUSED')}>
                      Pause
                    </Button>
                  )}
                  {c.status === 'PAUSED' && (
                    <Button variant="outline" loading={busy === 'status'} onClick={() => setStatus('ACTIVE')}>
                      Resume
                    </Button>
                  )}
                  {isOwner && (
                    <Button variant="danger" loading={busy === 'withdraw'} onClick={withdraw} disabled={remaining <= 0}>
                      Withdraw remaining
                    </Button>
                  )}
                  <Link href={`/campaigns/${c.id}`}>
                    <Button variant="ghost">
                      View campaign <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* submissions */}
              <div className="mt-6">
                <Micro>Submissions</Micro>
                {subs === null && <Skeleton className="mt-3 h-24" />}
                {subs?.length === 0 && (
                  <p className="mt-3 text-sm text-ink-500">No clips submitted yet.</p>
                )}
                {!!subs?.length && (
                  <div className="mt-3 divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-800">
                    {subs.map((s) => {
                      const owed = Math.max(0, s.earnedCents - s.paidCents);
                      const settled = s.paidCents > 0 && owed === 0;
                      return (
                        <div
                          key={s.id}
                          className="grid gap-3 bg-ink-900/40 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                              <PlatformIcon platform={s.platform} className="h-4 w-4 shrink-0 text-ink-300" />
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-mono text-xs text-ink-100 hover:text-ink-50"
                              >
                                {s.url.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                            <p className="mt-1 text-xs font-medium text-ink-500">
                              {shortAddr(s.clipperWallet)} · {timeAgo(s.createdAt)} · {fmtNum(s.views)} views
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {s.status === 'PENDING' && (
                              <>
                                <Button size="sm" onClick={() => setReview(s)}>
                                  Review
                                </Button>
                                <Badge status="PENDING" pulse />
                              </>
                            )}
                            {s.status === 'APPROVED' && (
                              <>
                                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-50 tabular">
                                  {fmtUsd(s.earnedCents)}
                                </span>
                                {owed > 0 ? (
                                  <Button size="sm" loading={paying === s.id} onClick={() => pay(s)}>
                                    Pay {fmtUsd(owed)}
                                  </Button>
                                ) : settled ? (
                                  <Badge status="PAID" />
                                ) : (
                                  <Badge status="APPROVED" />
                                )}
                                <button
                                  onClick={() => setReview(s)}
                                  className="text-xs font-medium text-ink-500 transition hover:text-ink-100"
                                >
                                  Edit views
                                </button>
                                {s.lastTx && (
                                  <span className="font-mono text-[10px] text-ink-500" title="Last payout transaction">
                                    {shortAddr(s.lastTx, 6)}
                                  </span>
                                )}
                              </>
                            )}
                            {s.status === 'REJECTED' && <Badge status="REJECTED" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReviewModal
        submission={review}
        campaign={c}
        onClose={() => setReview(null)}
        onDone={() => {
          setReview(null);
          loadSubs();
          onChange();
        }}
      />
    </Card>
  );
}

/* ---------- review modal ---------- */

function ReviewModal({
  submission: s,
  campaign: c,
  onClose,
  onDone,
}: {
  submission: Submission | null;
  campaign: Campaign;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [views, setViews] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'refresh' | null>(null);

  useEffect(() => {
    if (s) setViews(String(s.views || ''));
  }, [s]);

  if (!s) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const v = Math.max(0, Math.floor(Number(views) || 0));
  let preview = v >= c.minViews ? Math.floor((v * c.ratePerThousand) / 1000) : 0;
  if (c.maxPayoutCents != null) preview = Math.min(preview, c.maxPayoutCents);

  async function act(status: 'APPROVED' | 'REJECTED') {
    setBusy(status === 'APPROVED' ? 'approve' : 'reject');
    try {
      await api(`/api/submissions/${s!.id}`, {
        method: 'PATCH',
        body: { status, views: v },
      });
      toast('success', status === 'APPROVED' ? 'Clip approved — earnings locked in' : 'Clip rejected');
      onDone();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(null);
    }
  }

  async function pullViews() {
    setBusy('refresh');
    try {
      const { submission } = await api<{ submission: Submission }>(
        `/api/submissions/${s!.id}/refresh`,
        { method: 'POST' }
      );
      setViews(String(submission.views));
      toast('success', 'View count pulled from YouTube');
    } catch (e: any) {
      toast('info', e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={!!s} onClose={onClose} title="Review clip">
      <div className="space-y-5">
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-4 py-3 transition hover:border-ink-400"
        >
          <PlatformIcon platform={s.platform} className="h-4 w-4 text-ink-300" />
          <span className="truncate font-mono text-xs text-ink-100">
            {s.url.replace(/^https?:\/\//, '')}
          </span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-400" />
        </a>

        <div>
          <Label>Verified views</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="100"
              value={views}
              onChange={(e) => setViews(e.target.value)}
            />
            {s.platform === 'youtube' && (
              <Button variant="outline" loading={busy === 'refresh'} onClick={pullViews}>
                <RefreshCw className="h-3.5 w-3.5" /> Pull
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
            Open the clip, confirm the view count, and enter it here.
            {c.minViews > 0 ? ` Clips under ${fmtNum(c.minViews)} views earn 0.` : ''}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-4 py-3">
          <Micro>Payout at {fmtUsd(c.ratePerThousand)} / 1K</Micro>
          <motion.span
            key={preview}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-lg font-semibold text-ink-50 tabular"
          >
            {fmtUsd(preview)}
          </motion.span>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" loading={busy === 'approve'} onClick={() => act('APPROVED')}>
            Approve
          </Button>
          <Button variant="danger" className="flex-1" loading={busy === 'reject'} onClick={() => act('REJECTED')}>
            Reject
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- shared ---------- */

function Stat({
  label,
  value,
  usd,
  strong,
}: {
  label: string;
  value: number;
  usd?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="bg-ink-900/95 p-6">
      <Micro>{label}</Micro>
      <div
        className={`mt-2 flex items-baseline gap-1.5 font-display text-2xl font-semibold tabular ${
          strong ? 'text-ink-50' : 'text-ink-100'
        }`}
      >
        {usd ? fmtUsd(value) : fmtNum(value)}
      </div>
    </div>
  );
}
