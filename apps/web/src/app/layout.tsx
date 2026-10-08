import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GlobalNav } from '@/widgets/global-nav/global-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'seo-stat',
  description: 'Project-first SEO content workspace.',
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
          Scheduling and content generation are not implemented yet.
        </footer>
      </body>
    </html>
  );
}
