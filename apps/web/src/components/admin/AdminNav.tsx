'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/channels', label: 'Channels' },
  { href: '/admin/streams', label: 'Streams' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/reports', label: 'Reports' },
];

const activeClasses =
  'bg-primary-container text-on-primary-container font-semibold';
const idleClasses = 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface';

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="mb-lg flex flex-col gap-md md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-headline-md font-semibold text-on-surface">Admin</h1>
        <p className="text-body-sm text-on-surface-variant">Platform management</p>
      </div>
      <nav aria-label="Admin sections" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {LINKS.map((link) => {
          const active = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors ${
                active ? activeClasses : idleClasses
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}