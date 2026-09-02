import Image from 'next/image';
import { Users, Play, Volume2, Settings, Maximize, MonitorPlay } from 'lucide-react';
import type { WatchStream } from './types';

export default function VideoPlayer({ stream }: { stream: WatchStream }) {
  return (
    <section className="w-full aspect-video bg-surface-container relative rounded-lg border border-surface-variant overflow-hidden group shadow-lg">
      <Image
        className="w-full h-full object-cover"
        src={stream.thumbnailUrl}
        alt={stream.thumbnailAlt}
        fill
        sizes="100vw"
      />

      {/* Top overlays */}
      <div className="absolute top-md left-md flex items-center gap-sm z-10">
        <div className="bg-error text-on-error font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-widest font-bold shadow-md flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-on-error rounded-full animate-pulse" />
          LIVE
        </div>
        <div className="bg-black/60 backdrop-blur-md text-white font-label-sm text-label-sm px-2.5 py-1 rounded shadow-md flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          {stream.viewerCount}
        </div>
        <div className="bg-black/60 backdrop-blur-md text-white font-label-sm text-label-sm px-2.5 py-1 rounded shadow-md flex items-center gap-1.5">
          <MonitorPlay className="w-3.5 h-3.5" />
          {stream.duration}
        </div>
      </div>

      {/* Bottom controls (reveal on hover) */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-md pt-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end z-10">
        {/* Progress bar */}
        <div className="w-full h-1 bg-surface-variant/50 rounded-full mb-3 cursor-pointer overflow-hidden flex">
          <div className="h-full bg-primary relative" style={{ width: '66%' }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow" />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button type="button" className="hover:text-primary transition-colors">
              <Play className="w-7 h-7 fill-current" />
            </button>
            <div className="flex items-center gap-2 group/volume">
              <button type="button" className="hover:text-primary transition-colors">
                <Volume2 className="w-5 h-5" />
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 ease-in-out flex items-center">
                <div className="w-full h-1 bg-surface-variant/80 rounded-full ml-1">
                  <div className="w-3/4 h-full bg-white rounded-full" />
                </div>
              </div>
            </div>
            <span className="font-label-sm text-label-sm opacity-80 ml-2">LIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="hover:text-primary transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button type="button" className="hover:text-primary transition-colors">
              <MonitorPlay className="w-5 h-5" />
            </button>
            <button type="button" className="hover:text-primary transition-colors">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
