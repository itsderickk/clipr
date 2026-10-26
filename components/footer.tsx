'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';
import { XIcon } from './icons';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/campaigns', label: 'Campaigns' },
      { href: '/campaigns/new', label: 'Launch' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    title: 'Protocol',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/token', label: '$CLIPR' },
      { href: '/docs', label: 'Docs' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: 'https://github.com/lyftical/clipr', label: 'GitHub', external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-ink-800">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
              <span className="font-display text-xl font-bold text-ink-50">Clipr</span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
              The settlement layer for short-form clips. Creators fund campaigns, clippers earn per 1,000 verified views.
            </p>
            <div className="mt-5 flex gap-2">
              <a
                href="https://github.com/lyftical/clipr"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 text-ink-50 transition hover:bg-ink-50/10"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 text-ink-50 transition hover:bg-ink-50/10"
              >
                <XIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[15px] font-bold text-ink-50">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'external' in l ? (
                      <a href={l.href} target="_blank" rel="noreferrer" className="text-[15px] text-ink-500 transition hover:text-ink-50">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-[15px] text-ink-500 transition hover:text-ink-50">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ink-800 pt-6 text-[13px] text-ink-600">
          <span>© 2026 Clipr</span>
          <span>Settled in USDC on Solana · Not affiliated with X Corp.</span>
        </div>
      </div>
    </footer>
  );
}
