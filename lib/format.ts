import type { Platform } from './types';

export const usdToCents = (usd: number) => Math.round(usd * 100);
export const centsToUsd = (cents: number) => cents / 100;

export function fmtUsd(cents: number, _digits = 2): string {
  const usd = centsToUsd(cents);
  const whole = Number.isInteger(usd);
  return (
    '$' +
    usd.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })
  );
}

export function fmtViews(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return v.toLocaleString('en-US');
}

export const fmtNum = fmtViews;

export const shortAddr = (a?: string | null, n = 4) =>
  !a ? '—' : `${a.slice(0, n)}…${a.slice(-n)}`;

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const PLATFORMS: Record<Platform, { label: string; hint: string }> = {
  tiktok: { label: 'TikTok', hint: 'tiktok.com' },
  youtube: { label: 'YouTube', hint: 'youtube.com · youtu.be' },
  instagram: { label: 'Instagram', hint: 'instagram.com' },
  x: { label: 'X', hint: 'x.com · twitter.com' },
};

const PLATFORM_HOSTS: Record<Platform, RegExp> = {
  tiktok: /(^|\.)tiktok\.com$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  instagram: /(^|\.)instagram\.com$/,
  x: /(^|\.)(x\.com|twitter\.com)$/,
};

export function urlMatchesPlatform(url: string, platform: Platform): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return PLATFORM_HOSTS[platform].test(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}
