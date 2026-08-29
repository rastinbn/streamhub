'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, Plus, Video, Bell, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface TopNavProps {
  onMenuClick: () => void;
  /** Whether the mobile drawer this button controls is currently open. */
  menuOpen: boolean;
}

export default function TopNav({ onMenuClick, menuOpen }: TopNavProps) {
  const [query, setQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [profileMenuOpen]);

  async function handleLogout() {
    setProfileMenuOpen(false);
    await logout();
    router.push('/');
  }

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

        {!loading && !user && (
          <div className="ml-1 flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        )}

        {!loading && user && (
          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-label="Open profile menu"
              aria-expanded={profileMenuOpen}
              className="rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
            >
              {user.avatar ? (
                // Plain <img>, not next/image: avatar URLs are user-supplied
                // (see profile settings) so the fixed set of allow-listed
                // remote hosts next/image requires doesn't apply here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt="User avatar"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full border border-outline-variant object-cover transition-shadow hover:ring-2 hover:ring-primary"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-variant text-sm font-semibold uppercase text-on-surface transition-shadow hover:ring-2 hover:ring-primary">
                  {user.username.slice(0, 1)}
                </span>
              )}
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low shadow-xl">
                <div className="border-b border-outline-variant/30 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-on-surface">{user.username}</p>
                  <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                >
                  Profile settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full px-4 py-2.5 text-left text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
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
