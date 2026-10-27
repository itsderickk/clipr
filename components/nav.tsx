'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Coins,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  Scissors,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from './providers';
import { Button } from './ui';
import { shortAddr } from '@/lib/format';

type NavLink = { href: string; label: string; icon: LucideIcon; mobile?: boolean };

const links: NavLink[] = [
  { href: '/', label: 'Home', icon: Home, mobile: true },
  { href: '/campaigns', label: 'Campaigns', icon: Scissors, mobile: true },
  { href: '/#how', label: 'Protocol', icon: Workflow },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid, mobile: true },
  { href: '/token', label: '$CLIPR', icon: Coins, mobile: true },
  { href: '/docs', label: 'Docs', icon: BookOpen, mobile: true },
];

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : !href.includes('#') && pathname.startsWith(href);

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink-700 font-bold uppercase text-ink-50 ${
        size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
      }`}
    >
      {name.replace(/^@/, '').charAt(0) || 'C'}
    </span>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      aria-label="Clippa home"
      className="flex h-[52px] w-[52px] items-center justify-center rounded-full transition hover:bg-ink-50/10"
    >
      <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
    </Link>
  );
}

/** Account chip pinned to the bottom of the sidebar, with an X-style popover menu. */
function AccountChip() {
  const { user, wallet, signIn, signingIn, signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const address = user?.wallet ?? wallet;
  if (!address && !user) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          className="hidden w-full xl:inline-flex"
          size="lg"
          loading={signingIn}
          onClick={() => signIn()}
        >
          Sign in
        </Button>
        <button
          onClick={() => signIn()}
          aria-label="Sign in"
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-ink-600 text-sm font-bold text-ink-50 transition hover:bg-ink-50/10 xl:hidden"
        >
          In
        </button>
      </div>
    );
  }

  const name = user?.username || shortAddr(address);
  return (
    <div ref={ref} className="relative w-full">
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-2xl bg-ink-950 py-3 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          >
            {!user && (
              <button
                onClick={() => signIn()}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-bold text-ink-50 transition hover:bg-ink-50/[0.04]"
              >
                <LogIn className="h-5 w-5" /> Finish sign-in
              </button>
            )}
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-[15px] font-bold text-ink-50 transition hover:bg-ink-50/[0.04]">
              <LayoutGrid className="h-5 w-5" /> Dashboard
            </Link>
            <Link href="/campaigns/new" className="flex items-center gap-3 px-4 py-3 text-[15px] font-bold text-ink-50 transition hover:bg-ink-50/[0.04]">
              <Plus className="h-5 w-5" /> New campaign
            </Link>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-bold text-ink-50 transition hover:bg-ink-50/[0.04]"
            >
              <LogOut className="h-5 w-5" /> {user ? 'Log out' : 'Disconnect'} {user?.username ? `@${user.username}` : ''}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setMenu((m) => !m)}
        className="flex w-full items-center gap-3 rounded-full p-3 text-left transition hover:bg-ink-50/10"
      >
        <Avatar name={name} />
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-[15px] font-bold leading-5 text-ink-50">{name}</span>
          <span className="block truncate text-[15px] leading-5 text-ink-500">
            {user?.username ? `@${user.username}` : user ? shortAddr(address, 6) : signingIn ? 'Signing in…' : 'Not signed in'}
          </span>
        </span>
        <MoreHorizontal className="hidden h-5 w-5 text-ink-50 xl:block" />
      </button>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, wallet, signIn, signingIn } = useAuth();
  const address = user?.wallet ?? wallet;

  return (
    <>
      {/* ---------- desktop: X-style left rail ---------- */}
      <header className="fixed inset-y-0 left-0 z-50 hidden w-[88px] flex-col items-center border-r border-ink-700 bg-ink-950 px-2 py-2 lg:flex xl:w-[275px] xl:items-stretch xl:px-3">
        <Logo />
        <nav className="mt-1 flex w-full flex-col items-center gap-1 xl:items-stretch">
          {links.map((l) => {
            const active = isActive(pathname, l.href);
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group flex xl:block" title={l.label}>
                <span
                  className={`inline-flex items-center gap-5 rounded-full p-3 text-xl transition group-hover:bg-ink-50/10 xl:pr-6 ${
                    active ? 'font-bold text-ink-50' : 'text-ink-50'
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-[26px] w-[26px]" strokeWidth={active ? 2.75 : 1.75} />
                    {active && (
                      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-500 xl:hidden" />
                    )}
                  </span>
                  <span className="hidden xl:inline">{l.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <Link href="/campaigns/new" className="mt-4 w-full" aria-label="Launch a campaign">
          <span className="hidden h-[52px] w-full items-center justify-center rounded-full bg-ink-50 text-[17px] font-bold text-ink-950 transition hover:bg-ink-200 xl:flex">
            Launch campaign
          </span>
          <span className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ink-50 text-ink-950 transition hover:bg-ink-200 xl:hidden">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
        </Link>

        <div className="mt-auto flex w-full justify-center pb-2">
          <AccountChip />
        </div>
      </header>

      {/* ---------- mobile: top bar ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-ink-700 bg-ink-950/70 px-4 backdrop-blur-md lg:hidden">
        <div className="w-20">
          {address && (
            <Link href="/dashboard" aria-label="Dashboard">
              <Avatar name={user?.username || address} size="sm" />
            </Link>
          )}
        </div>
        <Link href="/" aria-label="Clippa home">
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
        </Link>
        <div className="flex w-20 justify-end">
          {!user && !address && (
            <Button size="sm" variant="outline" loading={signingIn} onClick={() => signIn()}>
              Sign in
            </Button>
          )}
          {!user && address && (
            <button
              onClick={() => signIn()}
              className="truncate font-mono text-[12px] text-ink-300"
              title="Finish sign-in"
            >
              {shortAddr(address)}
            </button>
          )}
        </div>
      </header>

      {/* ---------- mobile: bottom tab bar + compose FAB ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[53px] items-stretch justify-around border-t border-ink-700 bg-ink-950/85 backdrop-blur-md lg:hidden">
        {links
          .filter((l) => l.mobile)
          .map((l) => {
            const active = isActive(pathname, l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-label={l.label}
                className="relative flex flex-1 items-center justify-center text-ink-50"
              >
                <Icon className="h-[26px] w-[26px]" strokeWidth={active ? 2.75 : 1.75} />
                {active && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-500" />}
              </Link>
            );
          })}
      </nav>
      <Link
        href="/campaigns/new"
        aria-label="Launch a campaign"
        className="fixed bottom-[72px] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink-50 text-ink-950 shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition hover:bg-ink-200 lg:hidden"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </Link>
    </>
  );
}
