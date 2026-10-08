import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteNav } from '@/widgets/site-nav/site-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'seo-stat',
  description: 'SEO content scheduling and reporting (foundation).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="brand">seo-stat</span>
          <SiteNav />
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">Scheduling is not implemented yet.</footer>
      </body>
    </html>
  );
}
