'use client';

import { useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import { BadgeCheck, Heart, Bell, VideoOff, Share2 } from 'lucide-react';
import { useChannelBySlug } from '@/hooks/useChannelBySlug';
import { useAuth } from '@/lib/auth-context';
import { formatCompact } from '@/lib/format';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
} from '@/lib/placeholders';

type Tab = 'Home' | 'About' | 'Videos' | 'Clips';
const TABS: Tab[] = ['Home', 'About', 'Videos', 'Clips'];

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { channel, isLive, isFollowing, isLoading, isError, error, isNotFound, setFollowed } =
    useChannelBySlug(slug);
  const [notifyOn, setNotifyOn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Home');

  async function toggleFollow() {
    if (!channel || !accessToken) {
      router.push('/login');
      return;
    }
    await setFollowed(!isFollowing);
  }

  if (isNotFound) notFound();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading channel…</p>
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <p role="alert" className="text-body-md font-body-md text-error">
          {error ?? 'Channel not found.'}
        </p>
      </div>
    );
  }

  const bannerUrl = channel.banner ?? PLACEHOLDER_THUMBNAIL;
  const avatarUrl = channel.avatar ?? PLACEHOLDER_AVATAR;
  const bio = channel.description ?? MISSING_NAME;
  const followers = formatCompact(channel.followersCount);

  return (
    <div className="relative bg-surface-container-lowest">
      <div className="relative h-48 w-full overflow-hidden border-b border-outline-variant/20 bg-surface-container md:h-64">
        <Image
          src={bannerUrl}
          alt={channel.banner ? `${channel.name} banner` : PLACEHOLDER_ALT}
          fill
          priority
          className="object-cover opacity-80"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90" />
      </div>


      <div className="relative z-10 mx-auto -mt-44 flex max-w-7xl flex-col gap-md border-b border-outline-variant/20 px-layout-gutter pb-md sm:-mt-36 sm:flex-row sm:items-end sm:justify-between md:px-layout-margin">
        <div className="flex items-end gap-md sm:gap-lg">
          <div className="relative h-24 w-24 shrink-0 rounded-full bg-surface-container-lowest p-1 shadow-lg ring-2 ring-outline-variant/50 sm:h-32 sm:w-32">
            <Image
              src={avatarUrl}
              alt={`${channel.name} avatar`}
              fill
              className="rounded-full object-cover grayscale-[20%]"
            />
            <span
              aria-label={isLive ? 'Live' : 'Offline'}
              className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-surface-container-lowest bg-surface-variant sm:h-6 sm:w-6"
            />
          </div>

          <div className="pb-1 sm:pb-2">
            <div className="flex items-center gap-xs">
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
                {channel.name}
              </h1>
              <BadgeCheck className="h-5 w-5 fill-primary text-surface" />
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {followers} Followers
            </p>
            <p className="mt-sm hidden max-w-xl font-body-md text-body-md text-on-surface sm:block">
              {bio}
            </p>
          </div>
        </div>


        <div className="mt-sm flex w-full items-center gap-sm sm:mt-0 sm:w-auto sm:pb-2">
          <button
            type="button"
            onClick={() => void toggleFollow()}
            aria-pressed={isFollowing}
            className={`flex flex-1 items-center justify-center gap-xs rounded-DEFAULT px-lg py-sm text-label-md font-label-md transition-colors duration-150 active:scale-95 sm:flex-none ${
              isFollowing
                ? 'border border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high'
                : 'bg-primary text-on-primary shadow-md shadow-primary/20 hover:bg-primary-fixed'
            }`}
          >
            <Heart className="h-[18px] w-[18px]" fill={isFollowing ? 'currentColor' : 'none'} />
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          <button
            type="button"
            onClick={() => setNotifyOn((v) => !v)}
            aria-pressed={notifyOn}
            aria-label={notifyOn ? 'Turn off notifications' : 'Turn on notifications'}
            className={`flex h-10 w-10 items-center justify-center rounded-DEFAULT border border-outline-variant/30 p-sm transition-colors duration-150 active:scale-95 ${
              notifyOn
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Bell className="h-5 w-5" fill={notifyOn ? 'currentColor' : 'none'} />
          </button>


          <div className="ml-xs flex h-8 items-center gap-xs border-l border-outline-variant/30 pl-sm">
            <button
              type="button"
              aria-label="Share channel"
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <p className="block px-layout-gutter pt-sm font-body-md text-body-md text-on-surface sm:hidden">
        {bio}
      </p>

      <div className="no-scrollbar mx-auto mt-md max-w-7xl overflow-x-auto border-b border-outline-variant/20 px-layout-gutter sm:mt-lg md:px-layout-margin">
        <ul className="flex min-w-max gap-lg">
          {TABS.map((tab) => (
            <li key={tab}>
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative cursor-pointer py-md text-label-md font-label-md transition-colors ${
                  activeTab === tab
                    ? "text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:content-['']"
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto max-w-7xl px-layout-gutter py-lg sm:py-xl md:px-layout-margin">
        {activeTab !== 'Home' ? (
          <div className="flex flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant py-2xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {activeTab} isn&#39;t wired up yet — no data source for it so far.
            </p>
          </div>
        ) : (
          <>
            {!isLive && (
              <div className="group relative mb-xl flex flex-col items-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container p-lg text-center sm:p-xl">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                <div className="relative mb-md flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant/50 bg-surface-variant sm:h-20 sm:w-20">
                  <VideoOff className="h-8 w-8 text-outline sm:h-10 sm:w-10" />
                </div>
                <h2 className="mb-xs font-headline-md text-headline-md text-on-surface">
                  {channel.name} is currently offline
                </h2>
                <p className="mx-auto mb-lg max-w-md font-body-md text-body-md text-on-surface-variant">
                  Follow to get notified when {channel.name} goes live with new high-performance
                  system design sessions!
                </p>
                <button
                  type="button"
                  onClick={() => setNotifyOn(true)}
                  className="flex items-center gap-sm rounded-DEFAULT bg-primary-container px-lg py-sm text-label-md font-label-md text-on-primary-container transition-colors duration-150 hover:bg-primary-fixed active:scale-95"
                >
                  <Bell className="h-[18px] w-[18px]" fill={notifyOn ? 'currentColor' : 'none'} />
                  {notifyOn ? 'Notifications on' : 'Turn on Notifications'}
                </button>
              </div>
            )}

            <div>
              <h3 className="mb-md font-headline-md text-headline-md text-on-surface">
                Recent Broadcasts
              </h3>
              <div className="flex flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant py-2xl text-center">
                <VideoOff className="h-8 w-8 text-outline" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  No broadcasts yet — VODs aren&#39;t available yet.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}