'use client';

import Link from 'next/link';
import HeroSection, { HeroData } from '@/components/home/HeroSection';
import HomeStreamCard, { HomeStreamCardData } from '@/components/home/HomeStreamCard';
import { useStreams } from '@/hooks/useStreams';
import { formatCompact } from '@/lib/format';
import { MISSING_NAME, PLACEHOLDER_ALT, PLACEHOLDER_AVATAR, PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import { ChevronDown, Radio } from 'lucide-react';
import type { StreamPublic } from '@streamhub/types';

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

export default function HomeFeed() {
  const { streams, isLoading, isError, error } = useStreams({}, { liveOnly: true });
  const hasStreams = streams.length > 0;
  const hero = streams[0] ? toHero(streams[0]) : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-layout-margin">
      <div className="flex flex-col gap-xl">
        {/* Featured hero (top live stream) */}
        {hero && (
          <div className="rounded-xl motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]">
            <HeroSection hero={hero} />
          </div>
        )}

        {/* Live Now */}
        <section className="flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-sm">
            <span className="h-3 w-3 rounded-full bg-live animate-pulse" />
            Live Now
          </h2>

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
                  <div key={card.id} className={card.showFrom === 'all' ? '' : card.showFrom === 'sm' ? 'hidden sm:block' : 'hidden lg:block'}>
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

          <Link
            href="/browse"
            className="mt-4 self-center md:self-start text-primary font-label-md text-label-md hover:underline font-bold flex items-center gap-1"
          >
            Show More
            <ChevronDown className="h-[18px] w-[18px]" />
          </Link>
        </section>
      </div>
    </div>
  );
}