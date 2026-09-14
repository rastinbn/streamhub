'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Tv, LayoutGrid, CircleUserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Compass },
  { href: '/following', label: 'Following', icon: Tv },
  { href: '/categories', label: 'Categories', icon: LayoutGrid },
];

/** Mobile/tablet bottom navigation (hidden on lg+ where the sidebar lives). */
export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const profileHref = user?.username
    ? `/profile/${encodeURIComponent(user.username)}`
    : '/login';

  const items = [...NAV_ITEMS, { href: profileHref, label: 'Profile', icon: CircleUserRound }];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
    >
      <div className="flex h-16 items-center justify-around bg-surface/85 px-xs shadow-[0_-1px_12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 transition-colors',
                active
                  ? 'font-bold text-primary-container drop-shadow-[0_0_8px_rgba(145,71,255,0.6)]'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 2} />
              <span className="font-label-sm text-label-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}