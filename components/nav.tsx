'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ChevronDown, LayoutGrid, LogOut, Plus } from 'lucide-react';
import { useAuth } from './providers';
import { Button } from './ui';
import { EASE } from './motion';
import { shortAddr } from '@/lib/format';

const links = [
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/#how', label: 'Protocol' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/token', label: '$CLIPR' },
  { href: '/docs', label: 'Docs' },
];

export function Nav() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const { user, signIn, signingIn, signOut } = useAuth();

  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 12)), [scrollY]);
  useEffect(() => setMenu(false), [pathname]);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-ink-700 bg-ink-950/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-7 rounded-lg border border-ink-700 transition group-hover:border-brand-400"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-ink-50">
              Clipr
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
                  pathname === l.href ? 'text-ink-50' : 'text-ink-400 hover:text-ink-100'
                }`}
              >
                {l.label}
                {pathname === l.href && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-ink-50"
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!user ? (
            <Button size="sm" loading={signingIn} onClick={() => signIn()}>
              Sign in
            </Button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-[11px] text-ink-100 transition hover:border-ink-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ink-50" />
                {user.username || shortAddr(user.whopUserId ?? user.wallet)}
                <ChevronDown className={`h-3 w-3 text-ink-400 transition-transform ${menu ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
                  >
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-200 transition hover:bg-ink-800"
                    >
                      <LayoutGrid className="h-3.5 w-3.5 text-ink-400" /> Dashboard
                    </Link>
                    <Link
                      href="/campaigns/new"
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-200 transition hover:bg-ink-800"
                    >
                      <Plus className="h-3.5 w-3.5 text-ink-400" /> New campaign
                    </Link>
                    <div className="my-1 h-px bg-ink-700" />
                    <button
                      onClick={() => signOut()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-300 transition hover:bg-ink-800 hover:text-ink-50"
                    >
                      <LogOut className="h-3.5 w-3.5 text-ink-400" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
