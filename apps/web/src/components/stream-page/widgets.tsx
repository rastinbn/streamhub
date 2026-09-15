'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarClock,
  ExternalLink,
  MessageCircle,
  Globe,
  Heart,
  Radio,
  Users,
} from 'lucide-react';
import type { ChannelPublic, WidgetSettings } from '@streamhub/types';
import { streamsApi } from '@/lib/api';
import { formatCompact, timeAgo } from '@/lib/format';
import { isSafeImageSrc } from '@/lib/security';
import { cn } from '@/lib/utils';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
} from '@/lib/placeholders';

/**
 * Presentational widgets for the customizable stream page. Every widget is
 * a pure function of its props — no fetching except RECENT_STREAMS (one
 * bounded API call). All user-controlled values (image src, URLs, text)
 * are sanitized/validated here AND server-side; React escapes text content,
 * so the residual risk is URL schemes, which `isSafeImageSrc`/link checks
 * below cover.
 */

/** This lucide version ships no brand icons; neutral glyphs per network.
 * Keys stay stable for future icon swaps. */
const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: MessageCircle,
  instagram: MessageCircle,
  youtube: Globe,
  discord: MessageCircle,
  website: Globe,
};

export function ChannelInfoWidget({ channel }: { channel: ChannelPublic | null }) {
  if (!channel) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
        <p className="text-body-sm text-on-surface-variant">Channel information unavailable.</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-md rounded-xl border border-outline-variant/30 bg-surface-container p-md">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
        <Image src={channel.avatar ?? PLACEHOLDER_AVATAR} alt={`${channel.name} avatar`} fill className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-headline-sm text-headline-sm text-on-surface">{channel.name}</p>
        <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
          <Users className="h-3.5 w-3.5" />
          {formatCompact(channel.followersCount)} followers
          {channel.category ? <span className="text-outline-variant">·</span> : null}
          {channel.category}
        </p>
      </div>
    </div>
  );
}

export function AboutWidget({ channel }: { channel: ChannelPublic | null }) {
  const description = channel?.description;
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
      <h3 className="mb-xs font-headline-sm text-headline-sm text-on-surface">About</h3>
      {description ? (
        <p className="whitespace-pre-wrap text-body-md text-on-surface-variant">{description}</p>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          {channel ? `${channel.name} hasn't written an about section yet.` : 'About this channel.'}
        </p>
      )}
    </div>
  );
}

export function SocialLinksWidget({ settings }: { settings?: WidgetSettings }) {
  const entries = (
    [
      ['twitter', settings?.twitter],
      ['instagram', settings?.instagram],
      ['youtube', settings?.youtube],
      ['discord', settings?.discord],
      ['website', settings?.website],
    ] as const
  ).filter(([, url]) => typeof url === 'string' && url.length > 0 && isSafeImageSrc(url as string));

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
        <h3 className="mb-xs font-headline-sm text-headline-sm text-on-surface">Find me elsewhere</h3>
        <p className="text-body-sm text-on-surface-variant">No links added yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
      <h3 className="mb-sm font-headline-sm text-headline-sm text-on-surface">Find me elsewhere</h3>
      <ul className="flex flex-wrap gap-sm">
        {entries.map(([key, url]) => {
          const Icon = SOCIAL_ICONS[key] ?? Globe;
          const href = url as string;
          const external = /^https?:\/\//.test(href);
          return (
            <li key={key}>
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-xs rounded-DEFAULT border border-outline-variant/40 px-sm py-1.5 text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
                <span className="capitalize">{key}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScheduleWidget({ settings }: { settings?: WidgetSettings }) {
  const lines = (settings?.lines ?? []).filter((l) => typeof l === 'string' && l.trim().length > 0);
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
      <h3 className="mb-sm flex items-center gap-xs font-headline-sm text-headline-sm text-on-surface">
        <CalendarClock className="h-4 w-4 text-primary" />
        Schedule
      </h3>
      {lines.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">No scheduled streams yet — follow to get notified.</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-sm text-body-md text-on-surface">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type RecentStream = Pick<
  import('@streamhub/types').StreamPublic,
  'id' | 'title' | 'thumbnail' | 'status' | 'startedAt' | 'endedAt' | 'viewerCount'
>;

/** One bounded request (max 10 rows, enforced server-side). Errors and
 * empty results degrade to a simple empty state. */
export function RecentStreamsWidget({
  channelId,
  limit,
}: {
  channelId: string | null;
  limit?: number;
}) {
  const [streams, setStreams] = useState<RecentStream[] | null>(null);
  const [failed, setFailed] = useState(false);
  const cap = Math.min(Math.max(limit ?? 5, 1), 10);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    streamsApi
      .listByChannel(channelId)
      .then((res) => {
        if (!cancelled) setStreams(res.items.slice(0, cap));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId, cap]);

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-md">
      <h3 className="mb-sm flex items-center gap-xs font-headline-sm text-headline-sm text-on-surface">
        <Radio className="h-4 w-4 text-primary" />
        Recent streams
      </h3>
      {streams === null && !failed ? (
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      ) : failed ? (
        <p className="text-body-sm text-on-surface-variant">Couldn&apos;t load recent streams.</p>
      ) : (streams ?? []).length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">No streams yet — follow so you don&apos;t miss the first one.</p>
      ) : (
        <ul className="grid gap-sm sm:grid-cols-2">
          {(streams ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-sm rounded-lg border border-outline-variant/20 p-sm">
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md">
                <Image
                  src={s.thumbnail ?? PLACEHOLDER_THUMBNAIL}
                  alt={s.title ?? 'Stream thumbnail'}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm text-on-surface">{s.title ?? 'Untitled stream'}</p>
                <p className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                  {s.status === 'LIVE' ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-error" />
                      Live · {formatCompact(s.viewerCount)} watching
                    </>
                  ) : (
                    <>
                      <Heart className="h-3 w-3" />
                      {s.endedAt ?? s.startedAt ? timeAgo((s.endedAt ?? s.startedAt) as string | Date) : 'Not started'}
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ImageWidget({ settings }: { settings?: WidgetSettings }) {
  const src = settings?.src;
  const alt = settings?.alt;
  if (!src || !alt || !isSafeImageSrc(src)) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container p-md">
        <p className="text-body-sm text-on-surface-variant">Image not configured.</p>
      </div>
    );
  }
  return (
    <div className="relative h-full min-h-24 w-full overflow-hidden rounded-xl border border-outline-variant/30">
      <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
    </div>
  );
}

export function TextWidget({ settings }: { settings?: WidgetSettings }) {
  const content = settings?.content ?? '';
  const alignment = settings?.alignment ?? 'left';
  const fontSize = Math.min(Math.max(settings?.fontSize ?? 16, 10), 96);
  if (content.trim().length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container p-md">
        <p className="text-body-sm text-on-surface-variant">Text widget is empty.</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'h-full overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container p-md',
        alignment === 'center' && 'text-center',
        alignment === 'right' && 'text-right',
      )}
    >
      {/* React escapes interpolated text — no HTML injection is possible. */}
      <p className="whitespace-pre-wrap text-on-surface" style={{ fontSize }}>
        {content}
      </p>
    </div>
  );
}

export function WidgetUnavailable({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container p-md">
      <p className="text-body-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

/** Small helper reused by the builder's placeholder tiles. */
export function WidgetShell({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full flex-col rounded-xl border border-outline-variant/30 bg-surface-container p-md', className)}>
      {title ? <h3 className="mb-xs font-headline-sm text-headline-sm text-on-surface">{title}</h3> : null}
      {children}
    </div>
  );
}
