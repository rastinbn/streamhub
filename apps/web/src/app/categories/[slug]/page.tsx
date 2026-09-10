'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import StreamCard, { StreamCardProps } from '@/components/streams/StreamCard';
import { useCategories } from '@/hooks/useCategories';
import { usePaginatedStreams } from '@/hooks/usePaginatedStreams';
import { formatCompact } from '@/lib/format';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
  UNTITLED,
} from '@/lib/placeholders';
import { ArrowLeft, LayoutGrid, Radio, VideoOff } from 'lucide-react';
import type { StreamPublic } from '@streamhub/types';

// Streams from the API carry their channel's slug/name/avatar, so cards
// link straight to /watch/{channelSlug}/{streamId}. Missing bits fall back
// to neutral placeholders.
function toCard(stream: StreamPublic): StreamCardProps {
  return {
    id: stream.id,
    title: stream.title ?? UNTITLED,
    streamerName: stream.channelName ?? MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    viewerCount: Number((stream.viewerCount / 1000).toFixed(1)),
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: stream.channelAvatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    isLive: stream.status === 'LIVE',
    href: stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : undefined,
  };
}

function StreamGrid({ streams, emptyLabel }: { streams: StreamPublic[]; emptyLabel: string }) {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant py-2xl text-center">
        <VideoOff className="h-8 w-8 text-outline" />
        <p className="font-body-md text-body-md text-on-surface-variant">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-layout-gutter sm:grid-cols-2 md:gap-lg lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {streams.map((stream, i) => (
        <div
          key={stream.id}
          className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
          style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
        >
          <StreamCard {...toCard(stream)} />
        </div>
      ))}
    </div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { categories, isLoading: isCategoriesLoading } = useCategories();

  const category = useMemo(() => categories.find((c) => c.slug === slug), [categories, slug]);

  // Streams in this category come from the same /streams endpoint the rest of
  // the app browses; the list is split client-side by status. Pages accumulate
  // server-side so long lists never truncate at the default 20.
  const { streams, total, hasMore, isLoading: isStreamsLoading, isLoadingMore, isError, error, loadMore } =
    usePaginatedStreams(category ? { category: category.name } : {});

  const live = useMemo(() => streams.filter((s) => s.status === 'LIVE'), [streams]);
  const past = useMemo(() => streams.filter((s) => s.status === 'ENDED'), [streams]);

  if (!isCategoriesLoading && !category) notFound();

  if (isCategoriesLoading || !category) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading category…</p>
      </div>
    );
  }

  const thumbnailUrl = category.thumbnail ?? PLACEHOLDER_THUMBNAIL;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-container-lowest">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-surface-container-high md:h-60">
        <Image
          src={thumbnailUrl}
          alt={category.name}
          fill
          priority
          className="object-cover opacity-60"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-layout-gutter md:px-layout-margin">
        {/* Header */}
        <div className="pb-lg pt-md">
          <Link
            href="/categories"
            className="inline-flex items-center gap-xs font-label-md text-label-md text-primary transition-colors hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            All Categories
          </Link>

          <div className="mt-md flex flex-wrap items-end gap-x-lg gap-y-md">
            <div className="flex items-center gap-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-2 ring-surface-container-lowest shadow-lg">
                <Image
                  src={thumbnailUrl}
                  alt={category.name}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface md:font-display-lg md:text-display-lg">
                {category.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-sm pb-1">
              {live.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-live px-3 py-1 font-label-md text-label-md font-semibold text-on-live shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-live opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-on-live" />
                  </span>
                  {formatCompact(live.length)} live
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full border border-outline-variant/50 bg-surface-container px-3 py-1 font-label-md text-label-md text-on-surface-variant">
                <LayoutGrid className="h-3.5 w-3.5" />
                {total} stream{total === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {category.description && (
            <p className="mt-sm max-w-2xl font-body-md text-body-md text-on-surface-variant">
              {category.description}
            </p>
          )}
        </div>

        {/* Streams */}
        <section className="pb-xl">
          <h2 className="mb-md flex items-center gap-sm font-headline-md text-headline-md text-on-surface">
            {live.length > 0 && <span className="h-3 w-3 animate-pulse rounded-full bg-live" />}
            Live Now
          </h2>

          {isStreamsLoading && streams.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Loading streams…</p>
          ) : isError && streams.length === 0 ? (
            <p role="alert" className="font-body-md text-body-md text-error">
              {error ?? 'Failed to load streams.'}
            </p>
          ) : (
            <StreamGrid streams={live} emptyLabel="Nothing live in this category right now — check back soon." />
          )}
        </section>

        <section className="pb-xl">
          <h2 className="mb-md flex items-center gap-sm font-headline-md text-headline-md text-on-surface">
            <Radio className="h-4 w-4 text-on-surface-variant" />
            Past Streams
          </h2>

          {isStreamsLoading && streams.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Loading streams…</p>
          ) : isError && streams.length === 0 ? (
            <p role="alert" className="font-body-md text-body-md text-error">
              {error ?? 'Failed to load streams.'}
            </p>
          ) : (
            <StreamGrid streams={past} emptyLabel="No past streams in this category yet." />
          )}

          {hasMore && (
            <div className="mt-lg flex flex-col items-center gap-sm border-t border-outline-variant pt-lg">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Showing {streams.length} of {total} streams
              </p>
              {isLoadingMore ? (
                <p className="font-body-sm text-body-sm text-on-surface-variant">Loading more…</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="rounded-lg border border-outline-variant bg-surface px-lg py-sm font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
                >
                  Load more streams
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}