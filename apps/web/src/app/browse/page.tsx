'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import StreamCard, { StreamCardProps } from '@/components/streams/StreamCard';
import { useStreams } from '@/hooks/useStreams';
import { usePaginatedStreams } from '@/hooks/usePaginatedStreams';
import type { StreamListQuery } from '@/lib/api';
import { MISSING_NAME, PLACEHOLDER_ALT, PLACEHOLDER_AVATAR, PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import type { StreamPublic } from '@streamhub/types';
import {
  ChevronDown,
  Radio,
  LayoutGrid,
  Eye,
  Clock,
  Sparkles,
  Check,
  ArrowUpDown,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type FilterId = 'all' | 'live' | 'categories' | 'most-viewed' | 'recent' | 'recommended';

const FILTERS: { id: FilterId; label: string; icon?: LucideIcon; liveDot?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live Now', liveDot: true },
  { id: 'categories', label: 'Categories', icon: LayoutGrid },
  { id: 'most-viewed', label: 'Most Viewed', icon: Eye },
  { id: 'recent', label: 'Recently Started', icon: Clock },
  { id: 'recommended', label: 'Recommended', icon: Sparkles },
];

// 'all'/'live' map to a status filter; 'most-viewed'/'recent' map to the
// streams sortBy/order params. 'categories' and 'recommended' have no
// equivalent endpoint, so they stay disabled rather than pretending to work.
const FILTERABLE: FilterId[] = ['all', 'live', 'most-viewed', 'recent'];

type SortKey = 'viewers-desc' | 'viewers-asc' | 'alpha';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'viewers-desc', label: 'Most Viewers' },
  { key: 'viewers-asc', label: 'Fewest Viewers' },
  { key: 'alpha', label: 'A–Z' },
];

// Streams from the API carry their channel's slug/name/avatar, so cards
// link straight to /watch/{channelSlug}/{streamId}. Missing bits fall back
// to neutral placeholders.
function toCard(stream: StreamPublic): StreamCardProps {
  return {
    id: stream.id,
    title: stream.title ?? UNTITLED,
    streamerName: stream.channelName ?? MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    viewerCount: stream.viewerCount,
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: stream.channelAvatar ?? PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    isLive: stream.status === 'LIVE',
    href: stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : undefined,
  };
}

function buildQuery(activeFilter: FilterId, sortBy: SortKey, search: string | undefined): StreamListQuery {
  const query: StreamListQuery = {};

  if (search) query.search = search;
  if (activeFilter === 'live') query.status = 'LIVE';
  if (activeFilter === 'most-viewed') {
    query.sortBy = 'viewerCount';
    query.order = 'desc';
  }
  if (activeFilter === 'recent') {
    query.sortBy = 'startedAt';
    query.order = 'desc';
  }

  if (sortBy === 'viewers-asc') {
    query.sortBy = 'viewerCount';
    query.order = 'asc';
  }
  if (sortBy === 'viewers-desc') {
    query.sortBy = 'viewerCount';
    query.order = 'desc';
  }

  return query;
}

export default function Browse() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
          <p className="text-body-sm text-on-surface-variant">Loading streams…</p>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}

function BrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?q=` comes from the TopNav search box (and stays shareable/bookmarkable);
  // the backend matches it against stream titles.
  const searchQuery = searchParams.get('q')?.trim() || undefined;

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sortBy, setSortBy] = useState<SortKey>('viewers-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchQuery ?? '');
  const sortRef = useRef<HTMLDivElement>(null);

  // Keep the in-page box in sync when the URL changes (nav from TopNav).
  useEffect(() => {
    setSearchDraft(searchQuery ?? '');
  }, [searchQuery]);

  function applySearch(value: string) {
    const trimmed = value.trim();
    router.push(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : '/browse');
  }

  const query = useMemo(
    () => buildQuery(activeFilter, sortBy, searchQuery),
    [activeFilter, sortBy, searchQuery],
  );
  const { streams, total, hasMore, isLoading, isLoadingMore, isError, error, loadMore } =
    usePaginatedStreams(query);

  // Header count of live streams — a separate, lightweight call for `total`.
  const { total: liveTotal } = useStreams({ limit: 1 }, { liveOnly: true });

  // Close the sort dropdown on outside click or Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSortOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [sortOpen]);

  const cards = useMemo(() => streams.map(toCard), [streams]);

  const visibleCards = useMemo(
    () => (sortBy === 'alpha' ? [...cards].sort((a, b) => a.title.localeCompare(b.title)) : cards),
    [cards, sortBy],
  );

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label;

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      {/* Header */}
      <div className="mb-lg flex flex-col gap-md justify-between md:mb-xl md:flex-row md:items-end">
        <div>
          <h1 className="mb-xs  text-headline-lg-mobile font-headline-lg-mobile text-on-surface md:text-headline-lg md:font-headline-lg">
            Browse Streams
          </h1>
          <p className="flex items-center gap-xs text-body-md font-body-md text-on-surface-variant">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
            </span>
            {liveTotal} streams live now
          </p>
        </div>

        {/* Search (server-side via GET /streams?search=) + sort dropdown */}
        <div className="flex w-full flex-col gap-sm md:w-auto md:flex-row md:items-center">
          <form
            role="search"
            className="relative md:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              applySearch(searchDraft);
            }}
          >
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="Search streams"
              placeholder="Search streams…"
              className="w-full rounded-lg border border-outline-variant bg-surface px-md py-sm text-body-sm font-body-sm text-on-surface placeholder:text-outline transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchDraft && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => applySearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-outline transition-colors hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

        <div ref={sortRef} className="relative w-full md:w-auto">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            className="flex w-full items-center justify-between gap-sm rounded-lg border border-outline-variant bg-surface px-md py-sm text-body-sm font-body-sm transition-colors hover:border-primary md:w-56"
          >
            <span className="flex items-center gap-xs text-on-surface">
              <ArrowUpDown className="h-3.5 w-3.5 text-on-surface-variant" />
              Sort: <strong className="font-semibold">{currentSortLabel}</strong>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-on-surface-variant transition-transform ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sortOpen && (
            <ul
              role="listbox"
              className="absolute right-0 z-10 mt-xs w-full min-w-[12rem] overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg md:w-56"
            >
              {SORT_OPTIONS.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sortBy === option.key}
                    onClick={() => {
                      setSortBy(option.key);
                      setSortOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-md py-sm text-left text-body-sm font-body-sm text-on-surface transition-colors hover:bg-surface-variant"
                  >
                    {option.label}
                    {sortBy === option.key && <Check className="h-4 w-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      </div>

      {/* Active search indicator */}
      {searchQuery && (
        <p className="-mt-md mb-lg text-body-sm text-on-surface-variant">
          Results for <strong className="font-semibold text-on-surface">“{searchQuery}”</strong>{' '}
          ({total}) —{' '}
          <Link href="/browse" className="text-primary hover:underline">
            clear
          </Link>
        </p>
      )}

      {/* Filter chips */}
      <div className="no-scrollbar mb-lg w-full overflow-x-auto pb-sm">
        <div className="flex min-w-max items-center gap-sm">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            const isFilterable = FILTERABLE.includes(filter.id);
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => isFilterable && setActiveFilter(filter.id)}
                title={isFilterable ? undefined : 'Coming soon'}
                className={`flex items-center gap-xs rounded-full px-md py-sm text-label-md font-label-md transition-colors ${
                  isActive
                    ? 'bg-primary-container font-semibold tracking-wide text-on-primary-container'
                    : 'border border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                } ${!isFilterable ? 'opacity-60' : ''}`}
              >
                {filter.liveDot && <span className="h-2 w-2 rounded-full bg-live" />}
                {Icon && <Icon className="h-4 w-4" />}
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stream grid */}
      {isLoading && visibleCards.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Loading streams…</p>
      ) : isError && visibleCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Radio className="h-8 w-8 text-outline" />
          <p role="alert" className="text-body-md font-body-md text-error">
            {error ?? 'Failed to load streams.'}
          </p>
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <Radio className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            {searchQuery
              ? `No streams match “${searchQuery}”.`
              : 'Nothing live right now — check back soon.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-layout-gutter sm:grid-cols-2 md:gap-lg lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleCards.map((stream, i) => (
            <div
              key={stream.id}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <StreamCard
                id={stream.id}
                title={stream.title}
                streamerName={stream.streamerName}
                category={stream.category}
                viewerCount={stream.viewerCount}
                thumbnailUrl={stream.thumbnailUrl}
                thumbnailAlt={stream.thumbnailAlt}
                avatarUrl={stream.avatarUrl}
                avatarAlt={stream.avatarAlt}
                isLive={stream.isLive}
                href={stream.href}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-lg flex flex-col items-center gap-sm border-t border-outline-variant pt-lg">
          <p className="text-body-sm text-on-surface-variant">
            Showing {streams.length} of {total} streams
          </p>
          {isLoadingMore ? (
            <p className="text-body-sm text-on-surface-variant">Loading more…</p>
          ) : (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="rounded-lg border border-outline-variant bg-surface px-lg py-sm text-body-sm font-body-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
            >
              Load more streams
            </button>
          )}
        </div>
      )}
    </div>
  );
}