'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Campaign, Platform } from '@/lib/types';
import { fmtUsd, PLATFORMS, usdToCents } from '@/lib/format';
import { EASE } from '@/components/motion';
import { Button, Card, Input, Label, Micro, Textarea } from '@/components/ui';
import { PlatformIcon } from '@/components/icons';
import { useAuth } from '@/components/providers';
import { CurrencyInput } from '@/components/currency-input';
import { useToast } from '@/components/toast';

const stepLabels = ['Campaign', 'Economics', 'Review', 'Fund budget'];
const DRAFT_KEY = 'clipr:new-campaign';

export default function NewCampaign() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [requirements, setRequirements] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [rate, setRate] = useState('0.05');
  const [minViews, setMinViews] = useState('1000');
  const [maxPayout, setMaxPayout] = useState('');

  const [creating, setCreating] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [deposit, setDeposit] = useState('1');
  const [funding, setFunding] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [funded, setFunded] = useState<number | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  // Signing in leaves the page for Whop, so keep the draft across the round trip.
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (d) {
        setTitle(d.title ?? '');
        setDescription(d.description ?? '');
        setSourceUrl(d.sourceUrl ?? '');
        setRequirements(d.requirements ?? '');
        setPlatforms(d.platforms ?? []);
        setRate(d.rate ?? '0.05');
        setMinViews(d.minViews ?? '1000');
        setMaxPayout(d.maxPayout ?? '');
        setStep(2);
      }
    } catch {}
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, []);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const stepValid =
    step === 0
      ? title.trim().length >= 3 && description.trim().length >= 10
      : step === 1
        ? platforms.length > 0 && Number(rate) >= 0.01
        : true;

  async function createCampaign() {
    if (!user) {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ title, description, sourceUrl, requirements, platforms, rate, minViews, maxPayout })
        );
      } catch {}
      requireAuth('create a campaign');
      return;
    }

    setCreating(true);
    try {
      const { campaign: c } = await api<{ campaign: Campaign }>('/api/campaigns', {
        method: 'POST',
        body: {
          title,
          description,
          sourceUrl: sourceUrl.trim() || null,
          requirements: requirements.trim() || null,
          platforms,
          ratePerThousand: Number(rate),
          minViews: Number(minViews) || 0,
          maxPayout: maxPayout.trim() === '' ? null : Number(maxPayout),
        },
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      setCampaign(c);
      toast('success', 'Campaign created');
      go(3);
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setCreating(false);
    }
  }

  async function fundBudget() {
    if (!campaign) return;
    const amountCents = usdToCents(Number(deposit));
    if (!Number.isFinite(amountCents) || amountCents < 100) return toast('error', 'Minimum deposit is $1');

    setFunding(true);
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/api/campaigns/${campaign.id}/fund`, {
        method: 'POST',
        body: { amountCents },
      });
      window.open(checkoutUrl, '_blank', 'noopener');
      setWaiting(true);
      // The budget is credited by Whop's signed webhook; watch for it to land.
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(async () => {
        try {
          const { campaign: c } = await api<{ campaign: Campaign }>(`/api/campaigns/${campaign.id}`);
          if (c.budgetCents > 0) {
            if (poll.current) clearInterval(poll.current);
            setCampaign(c);
            setFunded(c.budgetCents - c.spentCents);
            setWaiting(false);
            toast('success', `Budget funded with ${fmtUsd(c.budgetCents)} — campaign is live`);
          }
        } catch {}
      }, 4000);
    } catch (e: any) {
      toast('error', e.message || 'Could not start checkout');
    } finally {
      setFunding(false);
    }
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * 44, filter: 'blur(6px)' }),
    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: (d: number) => ({ opacity: 0, x: d * -44, filter: 'blur(6px)' }),
  };

  return (
    <div className="mx-auto min-h-[80vh] max-w-3xl px-5 py-14 sm:px-8">
      <Link
        href="/campaigns"
        className="group inline-flex items-center gap-2 text-[13px] font-medium text-ink-400 transition hover:text-ink-50"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Cancel
      </Link>

      <div className="mt-8">
        <Micro>New campaign</Micro>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink-50">
          Put a rate on your views
        </h1>
      </div>

      {/* step rail */}
      <div className="mt-10 flex items-center gap-2">
        {stepLabels.map((l, i) => (
          <div key={l} className="flex flex-1 flex-col gap-2">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-ink-700">
              <motion.div
                className="h-full bg-ink-50"
                initial={false}
                animate={{ width: step >= i ? '100%' : '0%' }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
            <span
              className={`text-[11px] font-medium ${
                step >= i ? 'text-ink-100' : 'text-ink-500'
              }`}
            >
              {l}
            </span>
          </div>
        ))}
      </div>

      <div className="relative mt-10 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          {/* ---------- 1 · brief ---------- */}
          {step === 0 && (
            <motion.div
              key="s0"
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: EASE }}
              className="space-y-6"
            >
              <div>
                <Label>Campaign title</Label>
                <Input
                  placeholder="Clip my podcast into viral shorts"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>What should clippers make?</Label>
                <Textarea
                  rows={5}
                  placeholder="Describe the content, the tone you want, what a winning clip looks like…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label>Source content URL (optional)</Label>
                <Input
                  placeholder="https://youtube.com/watch?v=…"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
              <div>
                <Label>Requirements — one per line (optional)</Label>
                <Textarea
                  rows={4}
                  placeholder={'Keep clips under 60 seconds\nCaption every clip\nTag @myhandle'}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                />
              </div>
            </motion.div>
          )}

          {/* ---------- 2 · economics ---------- */}
          {step === 1 && (
            <motion.div
              key="s1"
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: EASE }}
              className="space-y-6"
            >
              <div>
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
                    const on = platforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() =>
                          setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : [...cur, p]))
                        }
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-all ${
                          on
                            ? 'border-ink-50 bg-ink-50 text-ink-950'
                            : 'border-ink-600 text-ink-300 hover:border-ink-400'
                        }`}
                      >
                        <PlatformIcon platform={p} className="h-4 w-4" />
                        {PLATFORMS[p].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label>Rate per 1,000 views</Label>
                  <CurrencyInput usd={rate} onUsd={setRate} step="0.01" />
                </div>
                <div>
                  <Label>Minimum views to qualify</Label>
                  <Input
                    type="number"
                    step="100"
                    min="0"
                    value={minViews}
                    onChange={(e) => setMinViews(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Max payout per clip (optional)</Label>
                <CurrencyInput usd={maxPayout} onUsd={setMaxPayout} step="1" placeholder="No cap" />
              </div>
              <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-400">
                A clip with 100K verified views earns{' '}
                <span className="text-ink-50 tabular">{fmtUsd(usdToCents((Number(rate) || 0) * 100))}</span>{' '}
                at this rate.
              </div>
            </motion.div>
          )}

          {/* ---------- 3 · review ---------- */}
          {step === 2 && (
            <motion.div
              key="s2"
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: EASE }}
            >
              <Card hover={false} className="divide-y divide-ink-800">
                <ReviewRow k="Title" v={title} />
                <ReviewRow k="Platforms" v={platforms.map((p) => PLATFORMS[p].label).join(' · ')} />
                <ReviewRow k="Rate" v={`$${rate} per 1,000 views`} />
                <ReviewRow k="Min views" v={Number(minViews || 0).toLocaleString()} />
                <ReviewRow k="Max per clip" v={maxPayout ? `$${maxPayout}` : 'No cap'} />
                <ReviewRow k="Created by" v={user ? user.username || user.whopUserId || 'You' : 'Sign in with Whop at create'} />
              </Card>
              <p className="mt-4 text-[13px] leading-relaxed text-ink-400">
                Creating the campaign saves it as a draft. Nothing is charged until you fund it
                through Whop checkout in the next step.
              </p>
            </motion.div>
          )}

          {/* ---------- 4 · fund ---------- */}
          {step === 3 && campaign && (
            <motion.div
              key="s3"
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: EASE }}
            >
              {funded == null ? (
                <Card hover={false} className="p-7">
                  <h3 className="font-display text-xl font-bold text-ink-50">Fund the budget</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-400">
                    Pay through Whop checkout — card, Apple Pay, bank transfer or crypto. The campaign
                    goes live the moment Whop confirms the payment, and you can top up or withdraw
                    the unspent budget later.
                  </p>
                  <div className="mt-6 max-w-sm">
                    <Label>Deposit amount</Label>
                    <CurrencyInput usd={deposit} onUsd={setDeposit} step="1" />
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button size="lg" arrow loading={funding} onClick={fundBudget}>
                      Pay with Whop
                    </Button>
                    <Button size="lg" variant="ghost" onClick={() => router.push('/dashboard?tab=campaigns')}>
                      Fund later
                    </Button>
                  </div>
                  {waiting && (
                    <p className="mt-5 border-t border-ink-800 pt-4 font-mono text-[11px] text-ink-400">
                      Waiting for Whop to confirm your payment<span className="animate-pulse">…</span> Finish
                      checkout in the new tab; this page updates by itself.
                    </p>
                  )}
                </Card>
              ) : (
                <Card hover={false} className="p-10 text-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-ink-500"
                  >
                    <CheckCircle2 className="h-8 w-8 text-ink-50" />
                  </motion.div>
                  <h3 className="mt-6 font-display text-2xl font-bold text-ink-50">
                    Campaign is live
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
                    {fmtUsd(funded)} is in the campaign budget. Clippers can see your campaign on the
                    marketplace now.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button size="lg" arrow>
                        View live campaign
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* nav */}
      {step < 3 && (
        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {step < 2 ? (
            <Button arrow disabled={!stepValid} onClick={() => go(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button size="lg" arrow loading={creating} onClick={createCampaign}>
              {user ? 'Create campaign' : 'Sign in & create'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 px-6 py-4">
      <span className="text-xs font-medium text-ink-400">{k}</span>
      <span className={`text-right text-sm text-ink-100 ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {v || '—'}
      </span>
    </div>
  );
}
