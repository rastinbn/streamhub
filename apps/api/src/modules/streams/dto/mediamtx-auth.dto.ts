import { IsOptional, IsString } from 'class-validator';

/**
 * Body shape MediaMTX posts to the delegated-auth endpoint for every client
 * action (`authMethod: http`, see infrastructure/streaming/mediamtx.yml):
 *
 *   {user, password, token, ip, action, path, protocol, id, query, userAgent}
 *
 * Every field is declared (optional) because the global ValidationPipe runs
 * with `forbidNonWhitelisted: true` — an undeclared field would reject the
 * whole callback. Only `action`, `path` and `password` drive authorization;
 * the rest are carried so real MediaMTX payloads validate cleanly. All are
 * optional because MediaMTX legitimately sends empty values (anonymous HLS
 * reads carry no user/password).
 */
export class MediaMtxAuthDto {
  /** Which action the client wants: publish | read | playback | api | metrics | pprof. */
  @IsOptional()
  @IsString()
  action?: string;

  /** RTMP path / HLS path the action targets — for publish this IS the raw stream key. */
  @IsOptional()
  @IsString()
  path?: string;

  /** Username part of the presented credentials (informational). */
  @IsOptional()
  @IsString()
  user?: string;

  /** Password part of the presented credentials (Control API secret check). */
  @IsOptional()
  @IsString()
  password?: string;

  /** Bearer-style token, when the client presents one (informational). */
  @IsOptional()
  @IsString()
  token?: string;

  /** Client IP as seen by MediaMTX (informational). */
  @IsOptional()
  @IsString()
  ip?: string;

  /** Ingest protocol: rtsp | rtmp | hls | webrtc | srt. */
  @IsOptional()
  @IsString()
  protocol?: string;

  /** MediaMTX connection/session id (informational). */
  @IsOptional()
  @IsString()
  id?: string;

  /** Raw query string of the client's URL (informational). */
  @IsOptional()
  @IsString()
  query?: string;

  /** Client User-Agent (informational). */
  @IsOptional()
  @IsString()
  userAgent?: string;
}
