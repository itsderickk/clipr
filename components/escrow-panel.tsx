'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtUsd, shortAddr, timeAgo } from '@/lib/format';
import { AnimatedNumber, EASE } from './motion';
import { CopyChip } from './ui';

interface Wallet {
  rail: string;
  currency: string;
  address: string | null;
  details: Record<string, string>;
}

interface Entry {
  id: string;
  kind: 'deposit' | 'payout' | 'refund';
  amountCents: number;
  status: 'pending' | 'confirmed' | 'failed';
  rail: string;
  externalRef: string | null;
  destination: string | null;
  createdAt: string;
}

interface Escrow {
  wallet: Wallet | null;
  balance: { fundedCents: number; spentCents: number; availableCents: number };
  entries: Entry[];
}

const ICON = { deposit: ArrowDownLeft, payout: ArrowUpRight, refund: RotateCcw };

function explorer(rail: string, ref: string, cluster?: string) {
  if (rail !== 'solana') return null;
  const q = cluster && cluster !== 'mainnet-beta' ? `?cluster=${cluster}` : '';
  return `https://solscan.io/tx/${ref}${q}`;
}

/**
 * Live view of a campaign's escrow wallet: balance, deposit address and the
 * ledger. `owner` opens the wallet (creating it on first view) and watches
 * the chain for deposits.
 */
export function EscrowPanel({
  campaignId,
  owner = false,
  onFunded,
}: {
  campaignId: string;
  owner?: boolean;
  onFunded?: (availableCents: number) => void;
}) {
  const [escrow, setEscrow] = useState<Escrow | null>(null);

  const load = useCallback(async () => {
    const d = await api<Escrow>(`/api/campaigns/${campaignId}/escrow`).catch(() => null);
    if (d) setEscrow(d);
    return d;
  }, [campaignId]);

  // Owners get the wallet opened for them; everyone gets the ledger.
  useEffect(() => {
    (owner ? api(`/api/campaigns/${campaignId}/fund`, { method: 'POST' }).catch(() => null) : Promise.resolve()).then(load);
  }, [campaignId, owner, load]);

  // While an owner is looking, poll the chain so deposits show up by themselves.
  useEffect(() => {
    if (!owner || escrow?.wallet?.rail !== 'solana') return;
    let before = escrow.balance.fundedCents;
    const t = setInterval(async () => {
      const r = await api<{ credited: Entry[] }>(`/api/campaigns/${campaignId}/escrow/sync`, { method: 'POST' }).catch(() => null);
      if (!r?.credited.length) return;
      const d = await load();
      if (d && d.balance.fundedCents > before) {
        before = d.balance.fundedCents;
        onFunded?.(d.balance.availableCents);
      }
    }, 8000);
    return () => clearInterval(t);
  }, [owner, escrow?.wallet?.rail, escrow?.balance.fundedCents, campaignId, load, onFunded]);

  if (!escrow) return <div className="h-40 animate-pulse rounded-2xl bg-ink-900" />;
  const { wallet, balance, entries } = escrow;
  const spentPct = balance.fundedCents ? Math.min(100, (balance.spentCents / balance.fundedCents) * 100) : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-950">
      <div className="relative p-6">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ink-50/[0.06] blur-3xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="flex items-baseline gap-3">
          <AnimatedNumber
            value={balance.availableCents}
            format={(v) => fmtUsd(Math.round(v))}
            className="font-display text-4xl font-bold text-ink-50"
          />
          <span className="font-mono text-xs text-ink-500">{wallet?.currency ?? 'USD'}</span>
          <motion.span
            className="ml-auto h-2 w-2 rounded-full bg-ink-50"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            title="Live"
          />
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink-800">
          <motion.div
            className="h-full bg-ink-50"
            initial={{ width: 0 }}
            animate={{ width: `${spentPct}%` }}
            transition={{ duration: 1.2, ease: EASE }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-500">
          <span>↑ <AnimatedNumber value={balance.spentCents} format={(v) => fmtUsd(Math.round(v))} /></span>
          <span>↓ <AnimatedNumber value={balance.fundedCents} format={(v) => fmtUsd(Math.round(v))} /></span>
        </div>

        {owner && wallet && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            {wallet.address ? (
              <>
                <CopyChip value={wallet.address} label={shortAddr(wallet.address, 6)} />
                <span className="font-mono text-[11px] text-ink-500">
                  {wallet.currency} · Solana{wallet.details.network && wallet.details.network !== 'mainnet-beta' ? ` ${wallet.details.network}` : ''}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-ink-400">{wallet.details.instructions}</span>
            )}
          </motion.div>
        )}
      </div>

      {entries.length > 0 && (
        <ul className="border-t border-ink-800">
          <AnimatePresence initial={false}>
            {entries.slice(0, 8).map((e) => {
              const Icon = ICON[e.kind];
              const href = e.externalRef ? explorer(e.rail, e.externalRef, wallet?.details.network) : null;
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: e.status === 'failed' ? 0.4 : 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="flex items-center gap-3 px-6 py-3 text-[13px]"
                >
                  <Icon className={`h-4 w-4 ${e.kind === 'deposit' ? 'text-ink-50' : 'text-ink-400'}`} />
                  <span className={`font-mono tabular ${e.kind === 'deposit' ? 'text-ink-50' : 'text-ink-300'}`}>
                    {e.kind === 'deposit' ? '+' : '−'}
                    {fmtUsd(e.amountCents)}
                  </span>
                  {e.status === 'pending' && (
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-ink-300"
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      title="Pending"
                    />
                  )}
                  {e.status === 'failed' && <span className="line-through text-ink-500">failed</span>}
                  <span className="ml-auto text-ink-500">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="hover:text-ink-50">
                        {timeAgo(e.createdAt)} ↗
                      </a>
                    ) : (
                      timeAgo(e.createdAt)
                    )}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
