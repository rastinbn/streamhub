'use client';

import Link from 'next/link';
import { Lock, LogIn, UserPlus } from 'lucide-react';

/**
 * Shown in place of the player + chat when a signed-out visitor lands on a
 * watch page. Watching requires an account, so the visitor is asked to log
 * in or sign up and is returned to this same stream afterwards (`returnTo`
 * is validated by `safeRedirect` before it is ever used as a link target).
 */
export default function WatchGate({ returnTo }: { returnTo: string }) {
  const loginHref = `/login?redirect=${encodeURIComponent(returnTo)}`;
  const signUpHref = `/register?redirect=${encodeURIComponent(returnTo)}`;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-md">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-lg text-center shadow-xl md:p-xl">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/20 text-primary">
          <Lock className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-headline-md text-headline-md text-on-surface">Sign in to watch</h1>
        <p className="mt-2 text-body-md font-body-md text-on-surface-variant">
          Watching streams on StreamHub requires an account. Log in — or create one in a minute — and land
          right back on this stream.
        </p>
        <div className="mt-6 flex flex-col gap-sm">
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <LogIn className="h-4 w-4" />
            Log in
          </Link>
          <Link
            href={signUpHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          >
            <UserPlus className="h-4 w-4" />
            Sign up
          </Link>
          <Link
            href="/browse"
            className="rounded-lg py-2 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Keep browsing
          </Link>
        </div>
      </div>
    </div>
  );
}