import Image from 'next/image';
import { Users } from 'lucide-react';

export interface HomeStreamCardData {
  id: string;
  title: string;
  streamerName: string;
  category: string;
  viewerCount: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  avatarUrl: string;
  avatarAlt: string;
  /** Responsive visibility */
  showFrom: 'all' | 'sm' | 'lg';
}

export function getResponsiveClass(showFrom: 'all' | 'sm' | 'lg') {
  if (showFrom === 'lg') return 'hidden lg:block';
  if (showFrom === 'sm') return 'hidden sm:block';
  return '';
}

export default function HomeStreamCard({ stream }: { stream: HomeStreamCardData }) {
  return (
    <article className="flex flex-col gap-sm group cursor-pointer">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container group-hover:border-primary transition-colors">
        <Image
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={stream.thumbnailUrl}
          alt={stream.thumbnailAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-2 left-2 bg-error text-on-error font-label-sm text-label-sm px-1.5 py-0.5 rounded font-bold tracking-wider z-10 shadow-sm">
          Live
        </div>
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white font-label-sm text-label-sm px-1.5 py-0.5 rounded z-10 flex items-center gap-1 shadow-sm">
          <Users className="w-3 h-3" />
          {stream.viewerCount}
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-sm items-start">
        <div className="w-10 h-10 rounded-full shrink-0 relative mt-0.5">
          <Image
            className="w-full h-full rounded-full object-cover border-2 border-surface-container-lowest relative z-10"
            src={stream.avatarUrl}
            alt={stream.avatarAlt}
            width={40}
            height={40}
          />
          <div className="absolute inset-0 bg-error rounded-full blur-[2px] -z-0" />
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-body-md font-body-md font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {stream.title}
          </h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant truncate">
            {stream.streamerName}
          </p>
          <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">
            {stream.category}
          </p>
        </div>
      </div>
    </article>
  );
}
