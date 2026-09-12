'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Hls from 'hls.js';
import { Users, Play, Pause, Volume2, VolumeX, Maximize, MonitorPlay, Loader2, Radio } from 'lucide-react';
import type { WatchStream } from './types';

/**
 * Real HLS player for live streams (hls.js + Low-Latency HLS from MediaMTX).
 *
 * - `hlsUrl` present  → plays the live broadcast, autoplayed muted
 *   (browsers block unmuted autoplay), with working play/pause, mute and
 *   fullscreen controls.
 * - no `hlsUrl`       → the stream is offline/ended: poster + status overlay.
 * - HLS dies while watching (publisher stopped) → retries a few times, then
 *   shows "Stream has ended" instead of an infinite spinner.
 */
export default function VideoPlayer({ stream }: { stream: WatchStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [ended, setEnded] = useState(false);
  const retriesRef = useRef(0);

  const hasSource = Boolean(stream.hlsUrl);
  const isLive = hasSource && !ended;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream.hlsUrl) return;

    setEnded(false);
    setBuffering(true);
    retriesRef.current = 0;
    setMuted(true);
    video.muted = true;

    const onPlaying = () => {
      setPlaying(true);
      setBuffering(false);
    };
    const onWaiting = () => setBuffering(true);
    const onPause = () => setPlaying(false);

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        liveDurationInfinity: true,
        liveSyncDurationCount: 2,
        maxLiveSyncPlaybackRate: 0.75,
      });
      hls.loadSource(stream.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retriesRef.current < 4) {
          retriesRef.current += 1;
          setTimeout(() => hls?.startLoad(), 1200 * retriesRef.current);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls?.recoverMediaError();
        } else {
          setEnded(true);
          setBuffering(false);
          setPlaying(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.hlsUrl;
      void video.play().catch(() => undefined);
    }

    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('pause', onPause);
      hls?.destroy();
    };
  }, [stream.hlsUrl]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  return (
    <section
      ref={containerRef}
      className="group relative w-full aspect-video overflow-hidden rounded-lg border border-surface-variant bg-black shadow-lg"
    >
      {!hasSource || ended ? (
        <div className="absolute inset-0">
          <Image
            className="w-full h-full object-cover opacity-80"
            src={stream.thumbnailUrl}
            alt={stream.thumbnailAlt}
            fill
            sizes="100vw"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-sm bg-black/55 text-white">
            <Radio className="h-10 w-10 text-white/80" />
            <p className="font-headline-md text-headline-md">{ended ? 'Stream has ended' : 'Offline'}</p>
            <p className="text-body-sm font-body-sm text-white/70">
              {ended
                ? 'This broadcast is no longer live.'
                : 'This stream is not live right now — it will appear here when the streamer goes live.'}
            </p>
          </div>
          {!ended && (
            <div className="absolute top-md left-md flex items-center gap-sm">
              <div className="bg-surface text-on-surface font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-widest font-bold shadow-md">
                OFFLINE
              </div>
            </div>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster={stream.thumbnailUrl}
          playsInline
          onClick={togglePlay}
        />
      )}

      {isLive && (
        <>
          {/* Top overlays */}
          <div className="absolute top-md left-md flex items-center gap-sm z-10">
            <div className="bg-live text-on-live font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-widest font-bold shadow-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-on-live rounded-full animate-pulse" />
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

          {/* Buffering spinner */}
          {buffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}

          {/* Bottom controls (reveal on hover / while playing) */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-md pt-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10 pointer-events-none">
            <div className="pointer-events-auto flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="hover:text-primary transition-colors"
                >
                  {playing ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="hover:text-primary transition-colors"
                >
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <span className="font-label-sm text-label-sm opacity-80 ml-2">LIVE</span>
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
                className="hover:text-primary transition-colors"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}