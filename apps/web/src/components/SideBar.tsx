'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home, Compass, LayoutGrid, Bell, Settings, CircleHelp } from 'lucide-react';
import FollowedChannels from './FollowedChannels';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Compass },
  { href: '/categories', label: 'Categories', icon: LayoutGrid },
  { href: '/following', label: 'Following', icon: Bell },
];

export const FOOTER_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: CircleHelp },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href)),
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const itemClasses = (active: boolean) =>
    `mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 active:opacity-80 ` +
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active
        ? 'bg-primary-container font-semibold text-on-primary-container'
        : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
    }`;

  const renderItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onClose}
              className={itemClasses(active)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="truncate text-sm">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 top-16 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Sidebar navigation"
        className={`fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] w-60 flex-col gap-1 overflow-y-auto border-r border-outline-variant/30 bg-surface-container-low py-4 shadow-xl transition-transform duration-200 ease-out
          lg:translate-x-0 lg:shadow-none
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {renderItems(NAV_ITEMS)}

        {/* Was a hardcoded mock array + <a type="button"> (invalid HTML —
            `type` isn't an anchor attribute) rendered inline. Split out
            since it now owns real loading/auth/unsupported states instead
            of just a static list. See FollowedChannels.tsx. */}
        <FollowedChannels />

        <div className="mt-auto border-t border-outline-variant/30 px-2 pt-4">
          {renderItems(FOOTER_ITEMS)}
        </div>
      </aside>
    </>
  );
}
