import Image from 'next/image';
import { VideoOff } from 'lucide-react';

export interface OfflineCard {
  id: string;
  channelName: string;
  lastSeen: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  avatarUrl: string;
  avatarAlt: string;
}

export default function OfflineCardItem({ channel }: { channel: OfflineCard }) {
  return (
    <div className="flex flex-col group cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
      {/* Thumbnail */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2 border border-outline-variant/30">
        <Image
          className="w-full h-full object-cover grayscale blur-[2px] group-hover:blur-none transition-all duration-300"
          src={channel.thumbnailUrl}
          alt={channel.thumbnailAlt}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <VideoOff className="h-8 w-8 text-outline" />
        </div>
      </div>

      {/* Channel info */}
      <div className="flex items-center gap-sm">
        <Image
          className="w-8 h-8 rounded-full object-cover ring-1 ring-outline grayscale shrink-0"
          src={channel.avatarUrl}
          alt={channel.avatarAlt}
          width={32}
          height={32}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-body-sm font-body-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {channel.channelName}
          </h3>
          <p className="text-label-sm font-label-sm text-outline truncate">
            Last seen {channel.lastSeen}
          </p>
        </div>
      </div>
    </div>
  );
}
