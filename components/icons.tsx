import type { Platform } from '@/lib/types';

const base = 'inline-block shrink-0';

export function TikTokIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden>
      <path d="M19.6 7.1a5.3 5.3 0 0 1-3.1-1V15a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3a2.7 2.7 0 1 0 1.9 2.6V2h2.9a5.3 5.3 0 0 0 3.1 4.1z" />
    </svg>
  );
}

export function YouTubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`} aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.2V8.8L15.5 12z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${base} ${className}`} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
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

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  switch (platform) {
    case 'tiktok':
      return <TikTokIcon className={className} />;
    case 'youtube':
      return <YouTubeIcon className={className} />;
    case 'instagram':
      return <InstagramIcon className={className} />;
    case 'x':
      return <XIcon className={className} />;
  }
}
