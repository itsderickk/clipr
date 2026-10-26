import { useId } from 'react';
import type { Platform } from '@/lib/types';

const base = 'inline-block shrink-0';

const TIKTOK_PATH =
  'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';

/* Brand logos: TikTok's cyan/red split, YouTube red, Instagram gradient. `mono` falls back to currentColor. */
export function TikTokIcon({ className = 'w-4 h-4', mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="-1 -1 26 26" className={`${base} ${className}`} aria-hidden>
      {mono ? (
        <path d={TIKTOK_PATH} fill="currentColor" />
      ) : (
        <>
          <path d={TIKTOK_PATH} fill="#25F4EE" transform="translate(-0.7 -0.7)" />
          <path d={TIKTOK_PATH} fill="#FE2C55" transform="translate(0.7 0.7)" />
          <path d={TIKTOK_PATH} fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
}

export function YouTubeIcon({ className = 'w-4 h-4', mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} aria-hidden>
      <path
        fill={mono ? 'currentColor' : '#FF0000'}
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill={mono ? '#000' : '#FFF'} d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'w-4 h-4', mono }: { className?: string; mono?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (mono) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} aria-hidden>
      <defs>
        <radialGradient id={`ig${id}`} cx="0.3" cy="1.07" r="1.3">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.1" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
        <radialGradient id={`ig2${id}`} cx="-0.17" cy="0.07" r="0.6">
          <stop offset="0" stopColor="#3771C8" />
          <stop offset="0.13" stopColor="#3771C8" />
          <stop offset="1" stopColor="#6600FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#ig${id})`} />
      <rect width="24" height="24" rx="6" fill={`url(#ig2${id})`} />
      <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
    </svg>
  );
}

export function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden>
      <path d="M17.7 3H21l-7.3 8.3L22.2 21h-6.7l-5.2-6.4L4.3 21H1l7.8-8.9L2 3h6.9l4.7 5.8L17.7 3zm-1.2 16h1.9L7.1 4.9H5.1L16.5 19z" />
    </svg>
  );
}

export function SolMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden>
      <path d="M5.6 15.9c.15-.15.36-.24.58-.24h13.5c.36 0 .55.44.29.7l-2.57 2.6a.83.83 0 0 1-.59.25H3.32a.41.41 0 0 1-.29-.7l2.57-2.6zm0-11.1c.16-.15.37-.24.58-.24h13.5c.36 0 .55.44.29.7l-2.57 2.6a.83.83 0 0 1-.59.24H3.32a.41.41 0 0 1-.29-.7l2.57-2.6zm12.8 5.5a.83.83 0 0 0-.58-.24H4.32a.41.41 0 0 0-.29.7l2.57 2.6c.15.16.36.25.58.25h13.5c.37 0 .55-.45.29-.7l-2.57-2.6z" />
    </svg>
  );
}

export function PlatformIcon({ platform, className, mono }: { platform: Platform; className?: string; mono?: boolean }) {
  switch (platform) {
    case 'tiktok':
      return <TikTokIcon className={className} mono={mono} />;
    case 'youtube':
      return <YouTubeIcon className={className} mono={mono} />;
    case 'instagram':
      return <InstagramIcon className={className} mono={mono} />;
    case 'x':
      return <XIcon className={className} />;
  }
}
