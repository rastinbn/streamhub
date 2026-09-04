import { useState } from 'react';
import Image from 'next/image';
import { Star, Heart, MoreVertical } from 'lucide-react';
import type { WatchStream } from './types';

export default function StreamInfo({
  stream,
  isFollowing,
  onFollow,
}: {
  stream: WatchStream;
  isFollowing?: boolean;
  onFollow?: () => void;
}) {
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <section className="flex flex-col gap-md">
      <h1 className="font-headline-lg text-headline-lg text-on-background leading-tight">
        {stream.title}
      </h1>

      {/* Creator row */}
      <div className="flex flex-wrap items-center justify-between gap-md py-sm">
        <div className="flex items-center gap-md">
          <div className="relative">
            <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-error to-primary-container">
              <div className="w-full h-full rounded-full border-2 border-background overflow-hidden">
                <Image
                  className="w-full h-full object-cover"
                  src={stream.streamer.avatarUrl}
                  alt={stream.streamer.avatarAlt}
                  width={56}
                  height={56}
                />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-headline-md text-headline-md text-on-surface-variant text-[20px]">
                {stream.streamer.name}
              </h3>
              {stream.streamer.verified && (
                <Star className="w-[18px] h-[18px] text-primary fill-primary" />
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant/70">
              {stream.streamer.followers} Followers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={onFollow}
            aria-pressed={isFollowing}
            className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-6 py-2 rounded-full font-label-md text-label-md transition-colors flex items-center gap-2 font-bold shadow-md"
          >
            <Heart className="w-[18px] h-[18px]" fill={isFollowing ? 'currentColor' : 'none'} />
            {isFollowing ? 'Following' : 'Follow'}
          </button>
          <button
            type="button"
            className="border border-outline hover:bg-surface-variant text-on-surface px-6 py-2 rounded-full font-label-md text-label-md transition-colors flex items-center gap-2"
          >
            <Star className="w-[18px] h-[18px]" />
            Subscribe
          </button>
          <button
            type="button"
            className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Category & Tags */}
      <div className="flex flex-wrap gap-sm mt-2">
        <a
          href="#"
          className="bg-surface-container-high hover:bg-surface-bright text-primary px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-colors flex items-center gap-1.5 border border-surface-variant"
        >
          {stream.category}
        </a>
        {stream.tags.map((tag) => (
          <span
            key={tag}
            className="bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full font-label-sm text-label-sm border border-outline-variant/30"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Description */}
      <div
        className="bg-surface-container-low border border-outline-variant/20 p-md rounded-xl mt-sm group hover:bg-surface-container transition-colors cursor-pointer relative overflow-hidden"
        onClick={() => setDescExpanded((v) => !v)}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-container-low pointer-events-none group-hover:to-surface-container" />
        <p
          className={`font-body-sm text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-line relative z-10 ${
            descExpanded ? '' : 'max-h-20 overflow-hidden'
          }`}
        >
          {stream.description}
        </p>
        {!descExpanded && (
          <button
            type="button"
            className="absolute bottom-2 right-4 z-20 text-primary font-label-sm text-label-sm font-bold bg-surface-container-low px-2 rounded group-hover:bg-surface-container"
          >
            Show More
          </button>
        )}
      </div>
    </section>
  );
}
