import Image from 'next/image';
import { Users } from 'lucide-react';

export interface LiveCard {
  id: string;
  channelName: string;
  streamTitle: string;
  tags: string[];
  viewerCount: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  avatarUrl: string;
  avatarAlt: string;
}

export default function LiveCardItem({ stream }: { stream: LiveCard }) {
  return (
    <div className="flex flex-col group cursor-pointer">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-container-high border border-surface-container-high transition-all group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-primary">
        <Image
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={stream.thumbnailUrl}
          alt={stream.thumbnailAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-sm left-sm bg-error text-on-error font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-wider z-10 shadow-sm font-bold">
          Live
        </div>
        <div className="absolute bottom-sm left-sm bg-black/60 backdrop-blur-sm text-white font-label-sm text-label-sm px-2 py-0.5 rounded z-10 flex items-center gap-1 shadow-sm">
          <Users className="w-3 h-3" />
          {stream.viewerCount}
        </div>
      </div>

      {/* Channel info */}
      <div className="mt-sm flex gap-sm items-start">
        <div className="w-10 h-10 rounded-full shrink-0 relative mt-1">
          <Image
            className="w-full h-full rounded-full object-cover border-2 border-surface-container-lowest relative z-10"
            src={stream.avatarUrl}
            alt={stream.avatarAlt}
            width={40}
            height={40}
          />
          <div className="absolute inset-0 bg-error rounded-full blur-[2px] -z-0" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <h3 className="text-body-md font-body-md font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {stream.channelName}
          </h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant truncate">
            {stream.streamTitle}
          </p>
          {stream.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {stream.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-surface-variant rounded-full font-label-sm text-label-sm text-outline"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
