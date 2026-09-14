'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Video,
  Bell,
  X,
  ShieldCheck,
  LayoutDashboard,
  BarChart3,
  Clapperboard,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isSafeImageSrc } from '@/lib/security';
import { canStream } from '@/lib/roles';

/** Creator entries shown in the profile menu on <lg screens, where the
 * sidebar (which hosts the Creator section) is hidden. Mirrors the sidebar's
 * Creator section list. */
const MOBILE_CREATOR_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/create', label: 'Go live', icon: Video },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/content', label: 'Content', icon: Clapperboard },
  { href: '/dashboard/settings', label: 'Creator settings', icon: Settings },
];

export default function TopNav() {
  const [query, setQuery] = useState('');
  const [mobileQuery, setMobileQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  /** Search routes to the real browse page, which passes `q` to the backend
   * (`GET /streams?search=`). Same contract for desktop and mobile. */
  function submitSearch(value: string) {
    const trimmed = value.trim();
    setMobileSearchOpen(false);
    router.push(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : '/browse');
  }

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

  // Where the "+ Create" / "Go live" buttons should send the user:
  // not signed in → log in first (then return to /become-streamer),
  // signed in but not a streamer → become-streamer gate,
  // streamer+ → the go-live tool.
  const createHref = !user
    ? '/login?redirect=/become-streamer'
    : canStream(user.role)
      ? '/create'
      : '/become-streamer';

  return (
    <nav
      aria-label="Primary"
      className="fixed top-0 z-50 flex h-16 w-full items-center justify-between gap-3 border-b border-outline-variant/30 bg-background/80 px-4 backdrop-blur-md sm:px-6"
    >
      {/* Left */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <Link
          href="/"
          className="shrink-0 font-display text-xl font-bold tracking-tight text-primary transition-opacity hover:opacity-80 sm:text-2xl"
        >
          StreamHub
        </Link>

        {/* Desktop search */}
        <form
          className="relative ml-2 hidden w-64 md:flex lg:w-96"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(query);
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            className="w-full rounded-full border border-outline-variant bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search streams…"
            type="search"
          />
        </form>
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

        <Link
          href={createHref}
          className="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-primary-fixed active:scale-[0.98] sm:flex"
        >
          <Plus className="h-4 w-4" />
          Create
        </Link>

        <Link href={createHref} aria-label="Go live" className={iconBtn}>
          <Video className="h-5 w-5" />
        </Link>

        {/* Notifications are not part of the current MVP (no backend
            endpoints yet) — the bell is intentionally inert. */}
        <button aria-label="Notifications (not available yet)" title="Not available yet" disabled className={`${iconBtn} cursor-not-allowed opacity-40`}>
          <Bell className="h-5 w-5" />
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
              {user.avatar && isSafeImageSrc(user.avatar) ? (
                // Plain <img>, not next/image: avatar URLs are user-supplied
                // (see profile settings) so the fixed set of allow-listed
                // remote hosts next/image requires doesn't apply here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt="User avatar"
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
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
                  href={`/profile/${encodeURIComponent(user.username)}`}
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                >
                  View profile
                </Link>
                {canStream(user.role) && (
                  <>
                    {/* Desktop: the sidebar already hosts the Creator section,
                        so the profile menu keeps a single shortcut. */}
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileMenuOpen(false)}
                      className="hidden px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface lg:block"
                    >
                      Creator dashboard
                    </Link>
                    {/* <lg: no sidebar, so the full Creator section lives here
                        (it used to live in the hamburger drawer). */}
                    <div className="border-t border-outline-variant/30 lg:hidden">
                      <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                        Creator
                      </p>
                      {MOBILE_CREATOR_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
                <Link
                  href="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                >
                  Profile settings
                </Link>
                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-on-surface"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Admin panel
                  </Link>
                )}
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
          <form
            className="relative"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(mobileQuery);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              ref={searchRef}
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              aria-label="Search"
              autoFocus
              type="search"
              className="w-full rounded-full border border-outline-variant bg-surface-container py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search streams…"
            />
          </form>
        </div>
      )}
    </nav>
  );
}
