'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Clapperboard,
  MonitorPlay,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/use-require-auth';
import { canStream } from '@/lib/roles';

const PERKS = [
  {
    icon: Radio,
    title: 'Go live in seconds',
    text: 'Create a channel, plug your encoder details and start broadcasting to everyone.',
  },
  {
    icon: BarChart3,
    title: 'Real-time overview',
    text: 'Live viewers, peak viewers, follower growth and watch time on one creator dashboard.',
  },
  {
    icon: Activity,
    title: 'Per-stream analytics',
    text: 'Viewer timelines and aggregates for every broadcast you have ever made.',
  },
  {
    icon: Clapperboard,
    title: 'Content management',
    text: 'Keep your broadcasts organized and your channel page tidy.',
  },
];

export default function BecomeStreamerPage() {
  const { user, loading } = useRequireAuth();
  const { accessToken, becomeStreamer } = useAuth();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (canStream(user.role)) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  async function handleBecomeStreamer() {
    if (!user || !accessToken) return;
    setError(null);
    setBusy(true);
    try {
      await becomeStreamer();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upgrade your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (canStream(user.role)) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
          <MonitorPlay className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-headline-lg text-headline-lg text-on-surface">
          Become a Streamer
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
          You&apos;re one step away from your own creator dashboard. Your account will be
          upgraded to a <span className="font-semibold text-on-surface">Streamer</span> — it
          stays completely free, and you can start broadcasting right away.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PERKS.map((perk) => {
          const Icon = perk.icon;
          return (
            <div
              key={perk.title}
              className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                  {perk.title}
                </h3>
              </div>
              <p className="mt-1.5 text-body-sm text-on-surface-variant">{perk.text}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <p className="text-body-sm text-on-surface-variant">
            Signed in as <span className="font-semibold text-on-surface">{user.username}</span>{' '}
            with role <span className="font-semibold text-on-surface">{user.role}</span>.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleBecomeStreamer()}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Upgrading…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Become a Streamer
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <Link
            href="/"
            className="mt-4 text-label-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Not now — take me back home
          </Link>
        </div>
      </div>
    </div>
  );
}