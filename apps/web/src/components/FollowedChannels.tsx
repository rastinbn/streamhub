'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useFollowedChannels } from '@/hooks/useFollowedChannels';

export default function FollowedChannels() {
  const { user, loading: authLoading } = useAuth();
  const { channels, isLoading, isSupported } = useFollowedChannels();

  return (
    <div className="mt-6 px-4">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-outline">
        Followed Channels
      </h3>

      {authLoading || isLoading ? (
        <p className="px-1 text-xs text-on-surface-variant">Loading…</p>
      ) : !user ? (
        <p className="px-1 text-xs text-on-surface-variant">
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>{' '}
          to see who you follow.
        </p>
      ) : !isSupported ? (
        // Honest placeholder — there's no backend support for this yet.
        // See hooks/useFollowedChannels.ts for exactly what's missing.
        <p className="px-1 text-xs text-on-surface-variant">Coming soon.</p>
      ) : channels.length === 0 ? (
        <p className="px-1 text-xs text-on-surface-variant">
          You're not following anyone yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {channels.map((channel) => (
            <li key={channel.id}>
              <Link
                href={`/channel/${channel.slug}`}
                className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Image
                    src={channel.avatar ?? '/default-avatar.png'}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 shrink-0 rounded-full object-cover ring-2 ring-outline"
                  />
                  <span className="truncate text-sm text-on-surface transition-colors group-hover:text-primary">
                    {channel.name}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
