/**
 * HLS playback helpers. The stream's `playbackPath` is the MediaMTX path
 * (identical to the raw stream key OBS publishes to); MediaMTX serves the
 * master playlist at `{HLS_BASE}/{playbackPath}/index.m3u8`.
 */
export const HLS_BASE_URL = process.env.NEXT_PUBLIC_HLS_URL ?? 'http://localhost:8888';

/**
 * RTMP ingest base URL OBS publishes to. The full publish target is
 * `{RTMP_BASE_URL}/{streamKey}` — in OBS: Server = base URL, Key = streamKey.
 */
export const RTMP_BASE_URL = process.env.NEXT_PUBLIC_RTMP_URL ?? 'rtmp://localhost:1935';

export function streamHlsUrl(playbackPath?: string | null): string | null {
  if (!playbackPath) return null;
  return `${HLS_BASE_URL}/${playbackPath}/index.m3u8`;
}