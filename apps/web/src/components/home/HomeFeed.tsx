'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import HeroSection, { HeroData } from '@/components/home/HeroSection';
import HomeStreamCard, { HomeStreamCardData } from '@/components/home/HomeStreamCard';
import CategoryCard from '@/components/channel/CategoryCard';
import { useCategories } from '@/hooks/useCategories';
import { useStreams } from '@/hooks/useStreams';
import { formatCompact } from '@/lib/format';
import { MISSING_NAME, PLACEHOLDER_ALT, PLACEHOLDER_AVATAR, PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import { ChevronDown, Radio } from 'lucide-react';
import type { StreamPublic } from '@streamhub/types';
import { cn } from '@/lib/utils';

// The hero is the top live stream from the API — fully real, clicks through
// to its watch page. The grid below it is the same live-streams feed.
function toHero(stream: StreamPublic): HeroData {
  return {
    title: stream.title ?? UNTITLED,
    streamerName: stream.channelName ?? MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    tags: [stream.category].filter((v): v is string => Boolean(v)),
    viewerCount: formatCompact(stream.viewerCount),
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: stream.channelAvatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    href: stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : undefined,
  };
}

// Streams from the API carry their channel's slug/name/avatar, so cards
// link straight to /watch/{channelSlug}/{streamId}. Missing bits fall back
// to neutral placeholders.
function toHomeCard(stream: StreamPublic, index: number): HomeStreamCardData {
  return {
    id: stream.id,
    title: stream.title ?? UNTITLED,
    streamerName: stream.channelName ?? MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    viewerCount: formatCompact(stream.viewerCount),
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: stream.channelAvatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    href: stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : undefined,
    showFrom: index < 2 ? 'all' : index < 4 ? 'sm' : 'lg',
  };
}

interface CreatorRailItem {
  key: string;
  name: string;
  avatarUrl: string;
  avatarAlt: string;
  viewers: string;
  href?: string;
}

export default function HomeFeed() {
  const { streams, isLoading, isError, error } = useStreams({}, { liveOnly: true });
  const { categories } = useCategories();
  const hasStreams = streams.length > 0;
  const hero = streams[0] ? toHero(streams[0]) : null;

  // Mobile "Recommended Creators" rail — one entry per live channel,
  // deduplicated across the current live feed.
  const creators = useMemo<CreatorRailItem[]>(() => {
    const seen = new Map<string, CreatorRailItem>();
    for (const stream of streams) {
      const key = stream.channelSlug ?? stream.channelName ?? stream.channelId;
      if (!key || seen.has(key)) continue;
      seen.set(key, {
        key,
        name: stream.channelName ?? MISSING_NAME,
        avatarUrl: stream.channelAvatar ?? PLACEHOLDER_AVATAR,
        avatarAlt: PLACEHOLDER_ALT,
        viewers: formatCompact(stream.viewerCount),
        href: stream.channelSlug ? `/channel/${stream.channelSlug}` : undefined,
      });
    }
    return [...seen.values()].slice(0, 12);
  }, [streams]);

  const categoryPills = categories.slice(0, 8);
  const popularCategories = categories.slice(0, 6);

  const liveCards = (
    <>
      {isLoading && !hasStreams ? (
        <p className="text-body-sm text-on-surface-variant">Loading live streams…</p>
      ) : isError && !hasStreams ? (
        <p role="alert" className="text-body-sm text-error">
          {error ?? 'Failed to load live streams.'}
        </p>
      ) : !hasStreams ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Radio className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            Nothing live right now — check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-lg">
          {streams.map((stream, i) => {
            const card = toHomeCard(stream, i);
            return (
              <div
                key={card.id}
                className={cn(card.showFrom === 'all' ? '' : card.showFrom === 'sm' ? 'hidden sm:block' : 'hidden lg:block')}
              >
                <div
                  className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
                  style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                >
                  <HomeStreamCard stream={card} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 p-md md:p-lg lg:p-layout-margin">
      <div className="flex flex-col gap-xl">
        {/* Featured hero (top live stream) */}
        {hero && (
          <div className="rounded-xl motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]">
            <HeroSection hero={hero} />
          </div>
        )}

        {/* Category quick pills — mobile only */}
        <section className="-mx-md mt-2 px-md md:hidden">
          <div className="no-scrollbar flex gap-sm overflow-x-auto pb-xs">
            <div className="flex min-w-max items-center gap-sm">
              <Link
                href="/browse"
                className="flex shrink-0 items-center whitespace-nowrap rounded-full bg-primary-container px-md py-sm font-label-md text-label-md font-semibold text-on-primary-container transition-colors"
              >
                All
              </Link>
              {categoryPills.map((category) => (
                <Link
                  key={category.id}
                  href={category.slug ? `/categories/${category.slug}` : '/categories'}
                  className="flex shrink-0 items-center whitespace-nowrap rounded-full border border-outline-variant bg-transparent px-md py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Recommended creators rail — mobile only */}
        {creators.length > 0 && (
          <section className="-mx-md mt-5 md:hidden">
            <div className="mb-sm flex items-center justify-between px-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Recommended Creators</h2>
            </div>
            <div className="no-scrollbar flex gap-lg overflow-x-auto px-md pb-xs">
              {creators.map((creator) => {
                const avatar = (
                  <>
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-error via-primary to-secondary">
                        <div className="w-full h-full rounded-full bg-surface-container-lowest overflow-hidden">
                          <Image
                            className="w-full h-full rounded-full object-cover"
                            src={creator.avatarUrl}
                            alt={creator.avatarAlt}
                            width={64}
                            height={64}
                          />
                        </div>
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-live ring-2 ring-background" />
                    </div>
                    <span className="mt-sm max-w-[5.5rem] truncate font-label-md text-label-md font-semibold text-on-surface">
                      {creator.name}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{creator.viewers} viewers</span>
                  </>
                );
                return creator.href ? (
                  <Link key={creator.key} href={creator.href} className="flex w-24 shrink-0 flex-col items-center gap-0.5">
                    {avatar}
                  </Link>
                ) : (
                  <div key={creator.key} className="flex w-24 shrink-0 flex-col items-center gap-0.5">
                    {avatar}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Live Now */}
        <section className="flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
            <span className="h-3 w-3 rounded-full bg-live animate-pulse" />
            Live Now
          </h2>

          {liveCards}

          <Link
            href="/browse"
            className="mt-4 self-center md:self-start text-primary font-label-md text-label-md hover:underline font-bold flex items-center gap-1"
          >
            Show More
            <ChevronDown className="h-[18px] w-[18px]" />
          </Link>
        </section>

        {/* Popular categories — mobile only */}
        {popularCategories.length > 0 && (
          <section className="md:hidden">
            <div className="mb-sm flex items-center justify-between px-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface">Popular Categories</h2>
              <Link
                href="/categories"
                className="font-label-md text-label-md font-bold text-primary transition-colors hover:text-primary-fixed"
              >
                See all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-md">
              {popularCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  badge="Category"
                  viewers={MISSING_NAME}
                  liveChannels={MISSING_NAME}
                  image={category.thumbnail ?? PLACEHOLDER_THUMBNAIL}
                  alt={PLACEHOLDER_ALT}
                  href={category.slug ? `/categories/${category.slug}` : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}