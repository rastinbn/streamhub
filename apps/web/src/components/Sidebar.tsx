'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home, Compass, LayoutGrid, Bell, Settings, CircleHelp } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type Channel = {
  name: string;
  avatar: string;
  isLive: boolean;
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

export const FOLLOWED_CHANNELS: Channel[] = [
  {
    name: 'NeonNinja',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBwntjf1FdYBJ2OkgRsxwaPgXNNYVobhF12T0fi8O8TuOlMyPoPADa4FISRPyl-1F5vGz-iFWS5lPMAlS6iiKAJ0N2lG4aa2MHU8I4yO2O9D6rxY6R2PBdqQGdX7PtpKVI-a1eUNKKNyHih6CF82YOwS0BOKmQlDbx4C6jPPbM6Qhi8SWr7OTsIilYIOWMPOVySR6iQZetw4s9F9MRGbM88wD70_lM5-CBfgFlNaFR3syg4olt8DEeNDA',
    isLive: true,
  },
  {
    name: 'ProGamerX',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDq1ZqzcNa1ubRO5RIDb-ycJy6y70aT9xqU6Cn0dwcH3EjL3YxsU6pmVAuGRlDrtQL8QxkgOC06uSZb0n2PWLGBo94PvxcoQBZ63_MQmOKip4Y7EGrAgkVqd81krX9IkG2lN10Ut20PCLUOBpB04Li3irAnzDj8FSgDHZH6NpqxTvThzlt5dWTWevI1lGY_1Wjh8gMNqq2Q1z0ErriPpqYd_r0JmifNPKjEa596162t0G3XZEBZjhRonQ',
    isLive: true,
  },
  {
    name: 'ArtStream',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCJ2lCuBLUWJpSAmP48x721z9arytyD2TCkVmFRnlp-pyNWYa3e8X_F7-np_zgnAAwP-H37vDJ8FkNv-AwcFN7Xg7uwNHSCc17c0pgTUdXuSVwFXDSqncAweFIGJPxFidH8-nZvq_DPI_YW8dNCEiGvSjL81M4b-HOtYKH54_Tyyw6SyFhKucUH0Qtjt7D_QTUolTnQ7XVn62-4g2UtY5ik97DIDd_BVtXIB7Dlhv0mA3PmWKg7vFgG5g',
    isLive: false,
  },
];

interface SideBarProps {
  /** Controlled by the layout: drawer is open on < lg screens */
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SideBarProps) {
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href)),
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // lock scroll while drawer is open
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
      {/* Backdrop (mobile/tablet only) */}
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

        <div className="mt-6 px-4">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-outline">
            Followed Channels
          </h3>
          <ul className="flex flex-col gap-1">
            {FOLLOWED_CHANNELS.map((ch) => (
              <li key={ch.name}>
                <button
                  type="button"
                  className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Image
                      src={ch.avatar}
                      alt=""
                      width={24}
                      height={24}
                      className={`h-6 w-6 shrink-0 rounded-full object-cover ${
                        ch.isLive ? 'ring-2 ring-error' : 'opacity-60 grayscale ring-2 ring-outline'
                      }`}
                    />
                    <span className="truncate text-sm text-on-surface transition-colors group-hover:text-primary">
                      {ch.name}
                    </span>
                  </span>
                  {ch.isLive && (
                    <span aria-label="Live" className="h-2 w-2 shrink-0 rounded-full bg-error" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto border-t border-outline-variant/30 px-2 pt-4">
          {renderItems(FOOTER_ITEMS)}
        </div>
      </aside>
    </>
  );
}
