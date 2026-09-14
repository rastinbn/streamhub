'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera, SlidersHorizontal, BellRing, Bell, BellOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

type FollowFilter = 'all' | 'live' | 'offline';

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
    href:
      stream && channel.slug
        ? `/watch/${channel.slug}/${stream.id}`
        : channel.slug
          ? `/channel/${channel.slug}`
          : undefined,
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
    href: channel.slug ? `/channel/${channel.slug}` : undefined,
  };
}

/** Notification bell micro-interaction (mobile/offline rows). */
function NotificationBell() {
  const [state, setState] = useState<'off' | 'notify' | 'active'>('active');

  const map: Record<typeof state, { icon: LucideIcon; label: string; text: string }> = {
    active: { icon: BellRing, label: 'Notifications on', text: 'notifications_active' },
    notify: { icon: Bell, label: 'Notifications muted', text: 'notifications' },
    off: { icon: BellOff, label: 'Notifications off', text: 'notifications_off' },
  };

  const next = state === 'active' ? 'notify' : state === 'notify' ? 'off' : 'active';
  const { icon: Icon, label, text } = map[state];

  return (
    <button
      type="button"
      onClick={() => setState(next)}
      aria-label={label}
      aria-pressed={state === 'active'}
      title={text}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-95"
    >
      <Icon className={`h-[18px] w-[18px] ${state === 'active' ? 'text-primary' : ''}`} />
    </button>
  );
}

export default function Following() {
  const { user, loading: authLoading } = useAuth();
  const { followed, liveByChannel, isLoading, error } = useFollowingOverview();
  const [filter, setFilter] = useState<FollowFilter>('all');

  const liveChannels = followed.filter((ch) => liveByChannel.has(ch.id));
  const offlineChannels = followed.filter((ch) => !liveByChannel.has(ch.id));

  const notSignedIn = !authLoading && !user;

  const tabs: { id: FollowFilter; label: string; count: number; live?: boolean }[] = [
    { id: 'all', label: 'All', count: followed.length },
    { id: 'live', label: 'Live', count: liveChannels.length, live: true },
    { id: 'offline', label: 'Offline', count: offlineChannels.length },
  ];

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md md:p-lg lg:p-xl">
      {/* Header */}
      <div className="mb-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline-lg-mobile font-headline-lg-mobile text-on-surface md:text-headline-lg md:font-headline-lg">
              Following
            </h1>
            <p className="mt-xs text-body-md font-body-md text-on-surface-variant">
              Channels you love, live and offline.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle compact mode"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-all hover:bg-surface-container-highest active:scale-95"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Filter toggle tabs */}
        <div className="mt-md flex items-center gap-xs rounded-xl bg-surface-container-lowest p-xs">
          {tabs.map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                aria-pressed={isActive}
                className={`flex flex-1 items-center justify-center gap-xs rounded-lg px-xs py-sm font-label-md text-label-md transition-all ${
                  isActive
                    ? 'bg-surface-container-highest font-semibold text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.live && (
                  <span
                    className={`h-2 w-2 rounded-full ${isActive ? 'bg-live animate-pulse' : 'bg-error/60'}`}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 font-label-sm text-label-sm ${
                    tab.live
                      ? 'bg-live/15 text-live'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
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
          {(filter === 'all' || filter === 'live') && (
            <section className="mb-xl">
              <div className="mb-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="font-headline-md text-headline-md text-on-surface">Live Now</h2>
                  <span className="flex items-center gap-xs">
                    <span className="h-2.5 w-2.5 rounded-full bg-live animate-pulse shadow-[0_0_8px_rgba(255,75,75,0.5)]" />
                    <span className="rounded-full bg-live/15 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-live">
                      {liveChannels.length}
                    </span>
                  </span>
                </div>
              </div>

              {liveChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
                  <Camera className="h-8 w-8 text-outline" />
                  <p className="text-body-md font-body-md text-on-surface-variant">
                    No channels you follow are live right now.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-layout-gutter sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          )}

          {/* Offline Channels */}
          {offlineChannels.length > 0 && (filter === 'all' || filter === 'offline') && (
            <section>
              <div className="mb-md border-t border-outline-variant/30 pt-lg">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-md text-headline-md text-outline">
                    Offline Channels
                  </h2>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                    {offlineChannels.length}
                  </span>
                </div>
              </div>

              {/* Compact rows — mobile only */}
              <div className="flex flex-col gap-xs rounded-xl bg-surface-container-low p-xs md:hidden">
                {offlineChannels.map((channel) => {
                  const row = (
                    <div className="flex items-center justify-between rounded-lg p-sm transition-colors hover:bg-surface-container">
                      <div className="flex min-w-0 items-center gap-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-high text-on-surface-variant ring-1 ring-outline-variant/40">
                          {channel.avatar ? (
                            <Image
                              className="h-full w-full object-cover"
                              src={channel.avatar}
                              alt={PLACEHOLDER_ALT}
                              width={40}
                              height={40}
                            />
                          ) : (
                            <span className="font-label-md text-label-md font-bold">
                              {channel.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-xs">
                            <p className="truncate font-label-md text-label-md font-semibold text-on-surface">
                              {channel.name}
                            </p>
                          </div>
                          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                            {channel.category ?? 'Offline'}
                          </p>
                        </div>
                      </div>
                      <NotificationBell />
                    </div>
                  );
                  const href = channel.slug ? `/channel/${channel.slug}` : undefined;
                  return href ? (
                    <Link key={channel.id} href={href}>
                      {row}
                    </Link>
                  ) : (
                    <div key={channel.id}>{row}</div>
                  );
                })}
              </div>

              {/* Card grid — sm+ */}
              <div className="hidden grid-cols-2 gap-layout-gutter sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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