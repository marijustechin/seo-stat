'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GLOBAL_NAV_ITEMS, isGlobalNavActive } from '@/shared/config/app';

export function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Global">
      <ul>
        {GLOBAL_NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isGlobalNavActive(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
