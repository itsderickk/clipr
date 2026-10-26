import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Clipr',
  description:
    'The settlement layer for short-form clips. Creators fund a campaign through Whop, clippers post and earn per 1,000 verified views, payouts land in their Whop balance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <div className="pb-[53px] lg:pb-0 lg:pl-[88px] xl:pl-[275px]">
            <main className="pt-14 lg:pt-0">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
