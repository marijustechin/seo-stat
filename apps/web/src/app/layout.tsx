import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GlobalNav } from '@/widgets/global-nav/global-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'seo-stat',
  description: 'Project-first SEO content workspace.',
  manifest: '/seo-stat/branding/site.webmanifest',
  icons: {
    icon: [
      { url: '/seo-stat/branding/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/seo-stat/branding/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/seo-stat/branding/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="brand">seo-stat</span>
          <GlobalNav />
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          Scheduling and external publishing are not implemented yet.
        </footer>
      </body>
    </html>
  );
}
