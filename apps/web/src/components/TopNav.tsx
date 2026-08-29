'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Menu, Search, Plus, Video, Bell, X } from 'lucide-react';

interface TopNavProps {
  onMenuClick: () => void;
  /** Whether the mobile drawer this button controls is currently open. */
  menuOpen: boolean;
}

export const USER_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBM3abTFYQKXujoBpv1aiz86lNqQiEuZKCYFIN5EAup8mfVpbXSthFpBhsSUp_S5mjAOfntME9gSjUuOslTE9eSppx_DELe5HZy0UhIHoLx3Ba2A4vz-NgX56gm2uVAmWWKudVmGfuHPZGrpD71ELaKTjdpIeLcSkmXmNml5IvJrw0L-nplx3LiFasJjHlFBf-l_GAzL9PTWDAGPxaWhZL7De7bXRcsjUX2knKdPF56lilEw15kJYh2hQ';

export default function TopNav({ onMenuClick, menuOpen }: TopNavProps) {
  const [query, setQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileSearchOpen) searchRef.current?.focus();
  }, [mobileSearchOpen]);

  const iconBtn =
    'inline-flex items-center justify-center w-10 h-10 text-on-surface-variant rounded-full ' +
    'transition-colors duration-150 hover:bg-surface-variant/50 hover:text-on-surface ' +
    'active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <nav
      aria-label="Primary"
      className="fixed top-0 z-50 flex h-16 w-full items-center justify-between gap-3 border-b border-outline-variant/30 bg-background/80 px-4 backdrop-blur-md sm:px-6"
    >
      {/* Left */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        {/* Hamburger (mobile/tablet) */}
        <button
          onClick={onMenuClick}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          className={`${iconBtn} lg:hidden`}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link
          href="/"
          className="shrink-0 font-display text-xl font-bold tracking-tight text-primary transition-opacity hover:opacity-80 sm:text-2xl"
        >
          StreamHub
        </Link>

        {/* Desktop search */}
        <div className="relative ml-2 hidden w-64 md:flex lg:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            className="w-full rounded-full border border-outline-variant bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search..."
            type="search"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Mobile search toggle */}
        <button
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-label="Toggle search"
          aria-expanded={mobileSearchOpen}
          className={`${iconBtn} md:hidden`}
        >
          {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </button>

        <button className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-primary-fixed active:scale-[0.98] sm:flex">
          <Plus className="h-4 w-4" />
          Create
        </button>

        <button aria-label="Go live" className={iconBtn}>
          <Video className="h-5 w-5" />
        </button>

        <button aria-label="Notifications, 1 unread" className={`${iconBtn} relative`}>
          <Bell className="h-5 w-5" />
          <span
            aria-hidden
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error ring-2 ring-background"
          />
        </button>

        <button
          aria-label="Open profile menu"
          className="rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
        >
          <Image
            src={USER_AVATAR}
            alt="User avatar"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-outline-variant object-cover transition-shadow hover:ring-2 hover:ring-primary"
          />
        </button>
      </div>

      {/* Mobile expanding search bar */}
      {mobileSearchOpen && (
        <div className="absolute top-full left-0 w-full animate-[slide-down_150ms_ease-out] border-b border-outline-variant/30 bg-background/95 px-4 pb-3 backdrop-blur-md md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              ref={searchRef}
              aria-label="Search"
              autoFocus
              type="search"
              className="w-full rounded-full border border-outline-variant bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search..."
            />
          </div>
        </div>
      )}
    </nav>
  );
}
