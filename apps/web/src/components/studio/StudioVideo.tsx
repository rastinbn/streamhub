'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, MonitorPlay } from 'lucide-react';
import { streamHlsUrl } from '@/lib/hls';
import { cn } from '@/lib/utils';

/**
 * Live preview panel for the studio. Plays the streamer's own HLS output
 * while publishing (autoplayed muted, matching the viewer player) and shows
 * a "Not live" placeholder otherwise. Kept lean on purpose — this is a
 * monitor, not the full watch-page player.
 */
export default function StudioVideo({
  title,
  playbackPath,
  isLive,
}: {
  title: string;
  playbackPath?: string | null;
  isLive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = useState(true);
  const hlsUrl = streamHlsUrl(isLive ? playbackPath : null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) {
      setBuffering(true);
      return;
    }

    setBuffering(true);
    video.muted = true;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ liveDurationInfinity: true, liveSyncDurationCount: 2 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => undefined));
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      void video.play().catch(() => undefined);
    }

    const onPlaying = () => setBuffering(false);
    const onWaiting = () => setBuffering(true);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      hls?.destroy();
    };
  }, [hlsUrl]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-primary-container/25 via-surface-container-high to-surface-variant">
      {hlsUrl ? (
        <>
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            playsInline
            onClick={(e) => {
              const v = e.currentTarget;
              if (v.paused) void v.play().catch(() => undefined);
              else v.pause();
            }}
          />
          {buffering && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-on-surface-variant/80">
          <MonitorPlay className="h-12 w-12" />
          <p className="font-label-sm text-label-sm uppercase tracking-widest">Not live</p>
          <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant/70">{title}</p>
        </div>
      )}

      {/* Status chip */}
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <span
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 font-label-sm text-label-sm font-bold uppercase tracking-widest shadow-md',
            isLive ? 'bg-live text-white' : 'bg-surface-container-lowest/90 text-on-surface-variant',
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'animate-pulse bg-white' : 'bg-on-surface-variant/60')}
          />
          {isLive ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
    </div>
  );
}