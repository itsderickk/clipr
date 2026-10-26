'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { EASE, Reveal } from './motion';
import { SolMark } from './icons';

const LETTERS = 'CLIPR'.split('');

function Watermark() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const letters = (bright: boolean) => (
    <div className="flex justify-center font-display text-[24vw] font-bold leading-[0.78] tracking-tighter md:text-[19rem]">
      {LETTERS.map((l, i) => (
        <span key={i} className="overflow-hidden">
          {bright ? (
            <span className="block bg-gradient-to-b from-brand-300 via-brand-400 to-brand-700 bg-clip-text text-transparent">
              {l}
            </span>
          ) : (
            <motion.span
              initial={{ y: '105%' }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '0px 0px -8% 0px' }}
              transition={{ duration: 0.7, delay: i * 0.055, ease: EASE }}
              className="text-outline block"
            >
              {l}
            </motion.span>
          )}
        </span>
      ))}
    </div>
  );

  const mask = pos
    ? `radial-gradient(240px circle at ${pos.x}px ${pos.y}px, black 35%, transparent 75%)`
    : undefined;

  return (
    <div
      aria-hidden
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseLeave={() => setPos(null)}
      className="relative -mb-[5vw] mt-2 select-none md:-mb-16"
    >
      <div className="horizon-glow pointer-events-none absolute inset-x-0 bottom-0 h-[70%]" />
      <div className="relative">{letters(false)}</div>
      <div
        className={
          'pointer-events-none absolute inset-0 transition-opacity duration-300 ' +
          (pos ? 'opacity-100' : 'opacity-0')
        }
        style={{ WebkitMaskImage: mask, maskImage: mask }}
      >
        {letters(true)}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-ink-700">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <Reveal>
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg border border-ink-700" />
                <span className="font-display text-xl font-semibold text-ink-50">Clipr</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                The settlement layer for short-form clips. Creators fund escrow, clippers earn per
                1,000 views, Solana clears the rest.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-2 gap-x-16 gap-y-3 text-[13px] font-medium">
              <Link href="/campaigns" className="text-ink-400 transition hover:text-ink-50">Campaigns</Link>
              <Link href="/dashboard" className="text-ink-400 transition hover:text-ink-50">Dashboard</Link>
              <Link href="/campaigns/new" className="text-ink-400 transition hover:text-ink-50">Launch</Link>
              <Link href="/#how" className="text-ink-400 transition hover:text-ink-50">Protocol</Link>
              <Link href="/token" className="text-ink-400 transition hover:text-ink-50">$CLIPR</Link>
              <Link href="/docs" className="text-ink-400 transition hover:text-ink-50">Docs</Link>
              <a href="https://github.com/lyftical/clipr" target="_blank" rel="noreferrer" className="text-ink-400 transition hover:text-ink-50">GitHub</a>
            </div>
          </Reveal>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ink-800 pt-6 text-xs font-medium text-ink-500">
          <span className="inline-flex items-center gap-2">
            <SolMark className="h-3 w-3" /> Settled on Solana
          </span>
          <span>© 2026 Clipr — every view accounted for</span>
        </div>
      </div>

      <Watermark />
    </footer>
  );
}
