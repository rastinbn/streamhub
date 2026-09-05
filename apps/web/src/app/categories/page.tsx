'use client';

import CategoryCard, { type CategoryCardProps } from '@/components/channel/CategoryCard';
import { useCategories } from '@/hooks/useCategories';
import { MISSING_NAME, PLACEHOLDER_ALT, PLACEHOLDER_THUMBNAIL } from '@/lib/placeholders';
import { LayoutGrid } from 'lucide-react';
import type { CategoryPublic } from '@streamhub/types';

// The API exposes a category's name/slug/description/thumbnail but no
// viewing/badge stats — render neutral placeholders for those.
function toCard(category: CategoryPublic): CategoryCardProps {
  return {
    name: category.name,
    badge: 'Category',
    viewers: MISSING_NAME,
    liveChannels: MISSING_NAME,
    image: category.thumbnail ?? PLACEHOLDER_THUMBNAIL,
    alt: PLACEHOLDER_ALT,
  };
}

export default function Categories() {
  const { categories, isLoading, isError } = useCategories();

  return (
    <div className="mx-auto w-full max-w-[1920px] flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      <h1 className="mb-lg text-display-lg-mobile font-display-lg-mobile text-on-surface md:text-display-lg md:font-display-lg">
        Categories
      </h1>

      {/* Filter chips — a single "All Categories" chip now, since the API has
      no badge dimension to filter on. */}
      <div className="no-scrollbar mb-lg flex gap-sm overflow-x-auto pb-2">
        <button
          type="button"
          aria-pressed
          className="flex shrink-0 items-center gap-xs whitespace-nowrap rounded-full border-transparent bg-primary-container px-4 py-1.5 font-semibold text-label-md font-label-md text-on-primary-container transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          All Categories
        </button>
      </div>

      {/* Category grid */}
      {isLoading ? (
        <p className="text-body-sm text-on-surface-variant">Loading categories…</p>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <LayoutGrid className="h-8 w-8 text-outline" />
          <p role="alert" className="text-body-md font-body-md text-error">
            Failed to load categories.
          </p>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-sm rounded-lg border border-dashed border-outline-variant py-2xl text-center">
          <LayoutGrid className="h-8 w-8 text-outline" />
          <p className="text-body-md font-body-md text-on-surface-variant">
            No categories yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {categories.map((card, i) => (
            <div
              key={card.name}
              className="motion-safe:animate-[fade-in-up_400ms_ease-out_backwards]"
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            >
              <CategoryCard {...toCard(card)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}