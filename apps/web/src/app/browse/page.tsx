'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StreamCard from '@/components/StreamCard';
import { useStreams } from '@/hooks/useStreams';
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
import type { StreamListItem } from '@/lib/types';

type FilterId = 'all' | 'live' | 'categories' | 'most-viewed' | 'recent' | 'recommended';

const FILTERS: { id: FilterId; label: string; icon?: LucideIcon; liveDot?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live Now', liveDot: true },
  { id: 'categories', label: 'Categories', icon: LayoutGrid },
  { id: 'most-viewed', label: 'Most Viewed', icon: Eye },
  { id: 'recent', label: 'Recently Started', icon: Clock },
  { id: 'recommended', label: 'Recommended', icon: Sparkles },
];


const FILTERABLE: FilterId[] = ['all', 'live'];

type SortKey = 'viewers-desc' | 'viewers-asc' | 'alpha';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'viewers-desc', label: 'Most Viewers' },
  { key: 'viewers-asc', label: 'Fewest Viewers' },
  { key: 'alpha', label: 'A–Z' },
];

const FALLBACK_AVATAR =
  'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23323538%22/%3E%3Ctext x=%2250%25%22 y=%2254%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2218%22 fill=%22%23968da1%22%3E?%3C/text%3E%3C/svg%3E';

function streamToCardProps(stream: StreamListItem) {
  const fallbackTitle = stream.channel.name || 'Untitled stream';
  const streamerName = stream.channel.owner.username || stream.channel.name;
  const avatar =
    stream.channel.owner.avatar || stream.channel.avatar || FALLBACK_AVATAR;
  return {
    id: stream.id,
    title: stream.title || fallbackTitle,
    streamerName,
    category: stream.category || 'Just Chatting',
    viewerCount: stream.viewerCount,
    thumbnailUrl: stream.thumbnail || FALLBACK_AVATAR,
    thumbnailAlt: `${streamerName}'s stream — ${stream.title || fallbackTitle}`,
    avatarUrl: avatar,
    avatarAlt: `${streamerName}'s avatar`,
    isLive: stream.status === 'LIVE',
  };
}

export default function Browse() {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [sortBy, setSortBy] = useState<SortKey>('viewers-desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const { streams, isLoading, isError, error } = useStreams('LIVE', {
    pollInterval: 60_000,
  });


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

  const cards = useMemo(() => streams.map(streamToCardProps), [streams]);
  const liveCount = streams.length;

  const visibleCards = useMemo(() => {
    const filtered = activeFilter === 'live' ? cards.filter((c) => c.isLive) : cards;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'alpha') return a.title.localeCompare(b.title);
      if (sortBy === 'viewers-asc') return a.viewerCount - b.viewerCount;
      return b.viewerCount - a.viewerCount;
    });
  }, [activeFilter, sortBy, cards]);

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
            {isLoading ? 'Loading…' : `${liveCount} stream${liveCount === 1 ? '' : 's'} live now`}
          </p>
        </div>

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
      {isLoading ? (
        <div className="grid grid-cols-1 gap-layout-gutter sm:grid-cols-2 md:gap-lg lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video w-full rounded-lg bg-surface-container-high" />
              <div className="mt-sm flex gap-sm items-start">
                <div className="h-10 w-10 shrink-0 rounded-full bg-surface-container-high" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 w-3/4 rounded bg-surface-container-high" />
                  <div className="h-3 w-1/2 rounded bg-surface-container-high" />
                  <div className="h-3 w-1/3 rounded bg-surface-container-high" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-error py-2xl text-center">
          <Radio className="h-8 w-8 text-error" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            {error || 'Something went wrong.'}
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
              <StreamCard {...stream} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
