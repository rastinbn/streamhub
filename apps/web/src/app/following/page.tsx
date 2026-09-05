'use client';

import Link from 'next/link';
import { Camera } from 'lucide-react';
import LiveCardItem, { LiveCard } from '@/components/streams/LiveCardItem';
import OfflineCardItem, { OfflineCard } from '@/components/streams/OfflineCardItem';
import { useFollowingOverview } from '@/hooks/useFollowingOverview';
import { useAuth } from '@/lib/auth-context';
import { formatCompact } from '@/lib/format';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
  UNTITLED,
} from '@/lib/placeholders';
import type { ChannelPublic, StreamPublic } from '@streamhub/types';

function toLiveCard(channel: ChannelPublic, stream?: StreamPublic): LiveCard {
  const tags = Array.from(
    new Set([stream?.category, channel.category].filter((v): v is string => Boolean(v))),
  );
  return {
    id: channel.id,
    channelName: channel.name,
    streamTitle: stream?.title ?? UNTITLED,
    tags,
    viewerCount: stream ? formatCompact(stream.viewerCount) : MISSING_NAME,
    thumbnailUrl: stream?.thumbnail ?? channel.banner ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: channel.avatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
  };
}

function toOfflineCard(channel: ChannelPublic): OfflineCard {
  return {
    id: channel.id,
    channelName: channel.name,
    lastSeen: MISSING_NAME,
    thumbnailUrl: channel.banner ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: channel.avatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
  };
}

export default function Following() {
  const { user, loading: authLoading } = useAuth();
  const { followed, liveByChannel, isLoading, error } = useFollowingOverview();

  const liveChannels = followed.filter((ch) => liveByChannel.has(ch.id));
  const offlineChannels = followed.filter((ch) => !liveByChannel.has(ch.id));

  const notSignedIn = !authLoading && !user;

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface md:text-headline-lg md:font-headline-lg">
          Following
        </h1>
        <p className="mt-xs text-body-md font-body-md text-on-surface-variant">
          Channels you love, live and offline.
        </p>
      </div>

      {notSignedIn ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Camera className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>{' '}
            to see channels you follow.
          </p>
        </div>
      ) : authLoading || (isLoading && error === null) ? (
        <p className="text-body-sm text-on-surface-variant">Loading followed channels…</p>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Camera className="h-8 w-8 text-outline" />
          <p role="alert" className="text-body-md font-body-md text-error">
            {error}
          </p>
        </div>
      ) : (
        <>
          {/* Live Now */}
          <section className="mb-xl">
            <div className="flex items-center gap-3 mb-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Live Now</h2>
              <span className="h-2.5 w-2.5 rounded-full bg-error animate-pulse shadow-[0_0_8px_rgba(255,180,171,0.5)]" />
            </div>

            {liveChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
                <Camera className="h-8 w-8 text-outline" />
                <p className="text-body-md font-body-md text-on-surface-variant">
                  No channels you follow are live right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-layout-gutter">
                {liveChannels.map((channel, i) => (
                  <div
                    key={channel.id}
                    className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <LiveCardItem stream={toLiveCard(channel, liveByChannel.get(channel.id))} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Offline Channels */}
          {offlineChannels.length > 0 && (
            <section>
              <div className="mb-md border-t border-outline-variant/30 pt-lg">
                <h2 className="font-headline-md text-headline-md text-outline">Offline Channels</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-layout-gutter">
                {offlineChannels.map((channel, i) => (
                  <div
                    key={channel.id}
                    className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
                    style={{ animationDelay: `${Math.min(i + liveChannels.length, 14) * 40}ms` }}
                  >
                    <OfflineCardItem channel={toOfflineCard(channel)} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}