'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StreamCard, { StreamCardProps } from '@/components/streams/StreamCard';
import { useStreams } from '@/hooks/useStreams';
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

// The API returns a stream's title/category/viewers/thumbnail/status but no
// channel name or avatar — render neutral placeholders for those.
function toCard(stream: StreamPublic): StreamCardProps {
  return {
    id: stream.id,
    title: stream.title ?? UNTITLED,
    streamerName: MISSING_NAME,
    category: stream.category ?? MISSING_NAME,
    viewerCount: Number((stream.viewerCount / 1000).toFixed(1)),
    thumbnailUrl: stream.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    avatarUrl: PLACEHOLDER_AVATAR,
    avatarAlt: PLACEHOLDER_ALT,
    isLive: stream.status === 'LIVE',
  };
}

function buildQuery(activeFilter: FilterId, sortBy: SortKey): StreamListQuery {
  const query: StreamListQuery = {};

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
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sortBy, setSortBy] = useState<SortKey>('viewers-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const query = useMemo(() => buildQuery(activeFilter, sortBy), [activeFilter, sortBy]);
  const { streams, isLoading, isError, error } = useStreams(query);

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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
            </span>
            {liveTotal} streams live now
          </p>
        </div>

        {/* Sort dropdown */}
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
                {filter.liveDot && <span className="h-2 w-2 rounded-full bg-error" />}
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
            Nothing live right now — check back soon.
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
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}