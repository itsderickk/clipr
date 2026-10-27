'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Bookmark,
  Check,
  ChevronLeft,
  Globe,
  Heart,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Play,
  Share2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PlatformIcon } from './icons';

/* Screens for the scroll story. Each one shows the step being done in the app it happens in,
   driven by `t`, the 0..1 progress through that step. */

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

const CAPTION = 'he gave away $1,000,000 in 60 seconds 🤯 #mrbeast #clips #fyp';
const VIEWS = 184_000;
const RATE = 1.2; // dollars per 1,000 views
const PAYOUT = (VIEWS / 1000) * RATE;

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto aspect-[9/19] h-[min(34rem,58vh)] rounded-[2.6rem] border border-ink-700 bg-ink-950 p-2 shadow-[0_30px_80px_-20px_rgba(124,58,237,0.35)]">
      <div className="absolute left-1/2 top-3.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-ink-900">{children}</div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-ink-50">
      <span className="tabular">9:41</span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-3 rounded-[2px] bg-ink-50" />
      </span>
    </div>
  );
}

function Thumb({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br from-brand-700 via-ink-800 to-[#25F4EE]/40 ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Play className="h-5 w-5 fill-white text-white" />
      </div>
      <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white tabular">0:58</span>
    </div>
  );
}

/* ---------- 1. posting the clip on TikTok ---------- */
function PostScreen({ t }: { t: number }) {
  const typed = CAPTION.slice(0, Math.round(seg(t, 0.05, 0.5) * CAPTION.length));
  const tapped = t > 0.55;
  const upload = seg(t, 0.58, 0.85);
  const posted = t > 0.86;
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-4 py-2">
        <ChevronLeft className="h-5 w-5 text-ink-50" />
        <span className="text-[14px] font-bold text-ink-50">Post</span>
        <span className="w-5" />
      </div>
      <div className="flex gap-3 border-b border-ink-800 px-4 pb-4 pt-2">
        <p className="min-h-[5.5rem] flex-1 text-[13px] leading-snug text-ink-50">
          {typed}
          {!tapped && <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-[#FE2C55]" />}
        </p>
        <Thumb className="h-24 w-[4.5rem] shrink-0" />
      </div>
      <div className="flex gap-2 px-4 py-3">
        {['# Hashtags', '@ Mention'].map((c) => (
          <span key={c} className="rounded bg-ink-800 px-2 py-1 text-[11px] font-semibold text-ink-200">
            {c}
          </span>
        ))}
      </div>
      <div className="divide-y divide-ink-800 border-y border-ink-800 text-[13px] text-ink-50">
        {[
          { icon: AtSign, label: 'Tag people' },
          { icon: MapPin, label: 'Location' },
          { icon: Globe, label: 'Everyone can view this post' },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon className="h-4 w-4 text-ink-400" /> {r.label}
          </div>
        ))}
      </div>
      <div className="mt-auto px-4 pb-6">
        <AnimatePresence mode="wait">
          {!tapped ? (
            <motion.div key="buttons" exit={{ opacity: 0 }} className="flex gap-2">
              <span className="flex h-10 flex-1 items-center justify-center rounded-md bg-ink-800 text-[13px] font-bold text-ink-50">Drafts</span>
              <motion.span
                animate={{ scale: t > 0.5 ? 0.94 : 1 }}
                className="flex h-10 flex-1 items-center justify-center rounded-md bg-[#FE2C55] text-[13px] font-bold text-white"
              >
                Post
              </motion.span>
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between text-[12px] font-semibold text-ink-50">
                <span className="flex items-center gap-1.5">
                  {posted ? <Check className="h-3.5 w-3.5 text-[#25F4EE]" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {posted ? 'Posted' : 'Posting…'}
                </span>
                <span className="tabular text-ink-400">{Math.round(upload * 100)}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-800">
                <div className="h-full rounded-full bg-[#FE2C55]" style={{ width: `${upload * 100}%` }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- 2. views climbing in TikTok analytics ---------- */
const CHART = [2, 3, 5, 9, 16, 26, 41, 58, 72, 84, 93, 100];

function GrowScreen({ t }: { t: number }) {
  const g = seg(t, 0.05, 0.9);
  const views = Math.round(g * g * VIEWS);
  const shown = Math.max(2, Math.ceil(g * CHART.length));
  const partial = CHART.slice(0, shown)
    .map((v, i) => `${(i / (CHART.length - 1)) * 100},${100 - v * 0.9}`)
    .join(' ');
  const stats = [
    { icon: Heart, v: Math.round(views * 0.11) },
    { icon: MessageCircle, v: Math.round(views * 0.006) },
    { icon: Bookmark, v: Math.round(views * 0.018) },
    { icon: Share2, v: Math.round(views * 0.009) },
  ];
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center justify-between px-4 py-2">
        <ChevronLeft className="h-5 w-5 text-ink-50" />
        <span className="text-[14px] font-bold text-ink-50">Post analytics</span>
        <span className="w-5" />
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <Thumb className="h-14 w-10 shrink-0" />
        <div className="min-w-0 text-[11px] text-ink-400">
          <div className="truncate text-[12px] font-semibold text-ink-50">{CAPTION}</div>
          Posted 2h ago
        </div>
      </div>
      <div className="px-4 pt-4">
        <div className="text-[12px] text-ink-400">Video views</div>
        <div className="font-display text-4xl font-extrabold tracking-tight text-ink-50 tabular">{views.toLocaleString('en-US')}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#25F4EE]">
          <ArrowUpRight className="h-3 w-3" /> {Math.round(g * 4800).toLocaleString('en-US')}% vs. your average
        </div>
      </div>
      <div className="mx-4 mt-4 h-28">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="grow-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FE2C55" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#FE2C55" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#2F3336" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={`0,100 ${partial} ${((shown - 1) / (CHART.length - 1)) * 100},100`} fill="url(#grow-fill)" />
          <polyline points={partial} fill="none" stroke="#FE2C55" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mx-4 mt-4 grid grid-cols-4 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="rounded-lg bg-ink-800/70 py-2 text-center">
            <s.icon className="mx-auto h-3.5 w-3.5 text-ink-300" />
            <div className="mt-1 text-[11px] font-bold text-ink-50 tabular">{s.v >= 1000 ? `${(s.v / 1000).toFixed(1)}K` : s.v}</div>
          </div>
        ))}
      </div>
      <div className="mx-4 mt-4 text-[11px] text-ink-400">
        Traffic source
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full w-[92%] rounded-full bg-ink-50" />
          </div>
          <span className="font-semibold text-ink-50">For You 92%</span>
        </div>
      </div>
      <AnimatePresence>
        {t > 0.6 && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute inset-x-2 top-9 z-10 flex items-center gap-2.5 rounded-2xl bg-ink-800/95 p-3 shadow-lg backdrop-blur"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black">
              <PlatformIcon platform="tiktok" className="h-4 w-4" />
            </span>
            <div className="text-[11px] leading-tight text-ink-200">
              <div className="font-bold text-ink-50">Your video is trending 🔥</div>
              It&apos;s being shown to more people on For You.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- 3. Clippa verifying the submission ---------- */
const CHECKS = [
  { label: 'Account ownership verified', at: 0.3 },
  { label: `${VIEWS.toLocaleString('en-US')} views confirmed`, at: 0.45 },
  { label: 'Posted after campaign start', at: 0.6 },
  { label: 'Captions and tag present', at: 0.75 },
];
const LINK = 'tiktok.com/@you/video/7698435898240683295';

function VerifyScreen({ t }: { t: number }) {
  const link = LINK.slice(0, Math.round(seg(t, 0.02, 0.18) * LINK.length));
  const approved = t > 0.85;
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex items-center gap-2 px-4 py-2">
        <img src="/logo.png" alt="" className="h-6 w-6 rounded-md" />
        <span className="text-[14px] font-bold text-ink-50">Submit clip</span>
      </div>
      <div className="mx-4 mt-2 rounded-xl border border-ink-800 bg-ink-950 p-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform="tiktok" className="h-4 w-4" />
          <span className="text-[12px] font-bold text-ink-50">MrBeast — Best moments</span>
        </div>
        <div className="mt-1 text-[11px] text-brand-300">$1.20 per 1K views</div>
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-brand-500/50 bg-ink-950 px-3 py-2.5">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
        <span className="truncate text-[11px] text-ink-50">{link || <span className="text-ink-500">Paste your clip link</span>}</span>
      </div>
      <div className="mx-4 mt-4 space-y-2.5">
        {CHECKS.map((c) => {
          const state = t > c.at ? 'done' : t > c.at - 0.13 ? 'running' : 'waiting';
          return (
            <div key={c.label} className={`flex items-center gap-2.5 text-[12px] ${state === 'waiting' ? 'text-ink-600' : 'text-ink-50'}`}>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  state === 'done' ? 'bg-brand-500 text-white' : 'border border-ink-700'
                }`}
              >
                {state === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : state === 'running' ? <Loader2 className="h-3 w-3 animate-spin text-brand-300" /> : null}
              </span>
              {c.label}
            </div>
          );
        })}
      </div>
      <div className="mt-auto px-4 pb-6">
        <AnimatePresence mode="wait">
          {approved ? (
            <motion.div
              key="ok"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="rounded-xl bg-brand-500/15 p-3 text-center"
            >
              <div className="flex items-center justify-center gap-1.5 text-[14px] font-bold text-brand-200">
                <BadgeCheck className="h-4 w-4" /> Approved
              </div>
              <div className="mt-0.5 text-[11px] text-ink-300 tabular">${PAYOUT.toFixed(2)} earned</div>
            </motion.div>
          ) : (
            <motion.div key="wait" exit={{ opacity: 0 }} className="flex h-10 items-center justify-center rounded-full bg-ink-50 text-[13px] font-bold text-ink-950">
              {t > 0.18 ? 'Verifying…' : 'Submit'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- 4. USDC landing in the wallet ---------- */
const BALANCE = 1204.1;
const HISTORY = [
  { label: 'Received', sub: 'Clippa escrow', amt: '+96.40', ago: '3d' },
  { label: 'Sent', sub: '7xKX…9fQa', amt: '−40.00', ago: '5d' },
  { label: 'Received', sub: 'Clippa escrow', amt: '+152.10', ago: '1w' },
];

function PaidScreen({ t }: { t: number }) {
  const arrived = t > 0.2;
  const bal = BALANCE + PAYOUT * seg(t, 0.25, 0.6);
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <AnimatePresence>
        {arrived && t < 0.8 && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute inset-x-2 top-9 z-10 flex items-center gap-2.5 rounded-2xl bg-ink-800/95 p-3 shadow-lg backdrop-blur"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2775CA] text-[10px] font-bold text-white">$</span>
            <div className="text-[11px] leading-tight text-ink-200">
              <div className="font-bold text-ink-50">Received {PAYOUT.toFixed(2)} USDC</div>
              From Clippa escrow · Solana
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-4 py-2 text-center text-[13px] font-bold text-ink-50">Wallet</div>
      <div className="px-4 pt-4 text-center">
        <div className="font-display text-4xl font-extrabold tracking-tight text-ink-50 tabular">
          ${bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`mt-1 text-[12px] font-semibold tabular ${arrived ? 'text-[#14F195]' : 'text-ink-500'}`}>
          {arrived ? `+$${PAYOUT.toFixed(2)} today` : '+$0.00 today'}
        </div>
      </div>
      <div className="mx-4 mt-5 flex items-center gap-3 rounded-xl bg-ink-800/70 p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2775CA] text-[12px] font-bold text-white">$</span>
        <div className="flex-1 text-[12px]">
          <div className="font-bold text-ink-50">USDC</div>
          <div className="text-ink-400">Solana</div>
        </div>
        <span className="text-[12px] font-bold text-ink-50 tabular">{bal.toFixed(2)}</span>
      </div>
      <div className="mx-4 mt-5 text-[11px] font-semibold text-ink-400">Activity</div>
      <div className="mx-4 mt-2 space-y-1">
        <AnimatePresence initial={false}>
          {t > 0.3 && (
            <motion.div
              key="new"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl bg-brand-500/10 p-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#14F195]/15 text-[#14F195]">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 text-[11px]">
                  <div className="font-bold text-ink-50">Received</div>
                  <div className="text-ink-400">{t > 0.6 ? 'Confirmed · 4mKp…Xq2Z' : 'Clippa escrow'}</div>
                </div>
                <div className="text-right text-[11px]">
                  <div className="font-bold text-[#14F195] tabular">+{PAYOUT.toFixed(2)}</div>
                  <div className="text-ink-500">now</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {HISTORY.map((h, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-ink-300">
              {h.label === 'Sent' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownLeft className="h-3.5 w-3.5" />}
            </span>
            <div className="flex-1 text-[11px]">
              <div className="font-bold text-ink-50">{h.label}</div>
              <div className="text-ink-400">{h.sub}</div>
            </div>
            <div className="text-right text-[11px]">
              <div className="font-bold text-ink-50 tabular">{h.amt}</div>
              <div className="text-ink-500">{h.ago}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SCREENS = [PostScreen, GrowScreen, VerifyScreen, PaidScreen];

export function StepScreen({ stage, t }: { stage: number; t: number }) {
  const Screen = SCREENS[stage];
  return (
    <Phone>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
        >
          <Screen t={t} />
        </motion.div>
      </AnimatePresence>
    </Phone>
  );
}
