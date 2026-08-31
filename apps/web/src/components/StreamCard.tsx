import { MoreVertical, Users } from 'lucide-react';

export interface StreamCardProps {
  id: number | string;
  title: string;
  streamerName: string;
  category: string;
  viewerCount: number;
  thumbnailUrl: string;
  thumbnailAlt: string;
  avatarUrl: string;
  avatarAlt: string;
  isLive: boolean;
}

export default function StreamCard({
  id,
  title,
  streamerName,
  category,
  viewerCount,
  thumbnailUrl,
  thumbnailAlt,
  avatarUrl,
  avatarAlt,
  isLive,
}: StreamCardProps) {
  return (
    <div key={id} className="flex flex-col group cursor-pointer">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-container-high border border-surface-container-high transition-all group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-primary">
        <img
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={thumbnailUrl}
          alt={thumbnailAlt}
        />
        {isLive && (
          <div className="absolute top-sm left-sm bg-error text-on-error font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-wider z-10 shadow-sm">
            Live
          </div>
        )}
        <div className="absolute bottom-sm left-sm bg-black/60 backdrop-blur-sm text-white font-label-sm text-label-sm px-2 py-0.5 rounded z-10 flex items-center gap-1 shadow-sm">
          <Users className="w-3 h-3" />
          {viewerCount}k
        </div>
      </div>
      <div className="mt-sm flex gap-sm items-start">
        <div className="w-10 h-10 rounded-full shrink-0 relative mt-1">
          <img
            className="w-full h-full rounded-full object-cover border-2 border-surface-container-lowest relative z-10"
            src={avatarUrl}
            alt={avatarAlt}
          />
          {isLive && (
            <div className="absolute inset-0 bg-error rounded-full blur-[2px] -z-0" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-body-md font-body-md font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant truncate">
            {streamerName}
          </p>
          <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">
            {category}
          </p>
        </div>
        <button
          type="button"
          className="ml-auto mt-1 p-1 rounded hover:bg-surface-variant text-on-surface-variant shrink-0"
          aria-label={`More options for ${title}`}
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
