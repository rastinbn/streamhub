/**
 * Phase — Customizable Stream Page (Stream Layout Builder).
 *
 * Shared shapes for the versioned stream-page layout document. The backend
 * is the source of truth: it validates this document before persisting it
 * (see `apps/api/src/modules/layouts/layout-validation.ts`) and the public
 * channel page renders the published layout verbatim. Keep in sync with the
 * Prisma `StreamPageLayout` model.
 */

/** Widget types the renderer knows how to draw. Deliberately closed — no
 * arbitrary/HTML widgets for security reasons. */
export const WIDGET_TYPES = [
  'STREAM_PLAYER',
  'CHAT',
  'CHANNEL_INFO',
  'ABOUT',
  'SOCIAL_LINKS',
  'SCHEDULE',
  'RECENT_STREAMS',
  'IMAGE',
  'TEXT',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Settings each widget type accepts. Values are plain JSON — validated by
 * the backend's per-widget settings schema before persistence. */
export type WidgetSettings = {
  /** IMAGE — safe http(s)/local-path source (validated; never `data:`/`javascript:`). */
  src?: string;
  /** IMAGE — accessibility text (required with src). */
  alt?: string;
  /** TEXT — the content shown inside the widget. */
  content?: string;
  /** TEXT — left/center/right. */
  alignment?: 'left' | 'center' | 'right';
  /** TEXT — font size in px (bounded by validation). */
  fontSize?: number;
  /** SOCIAL_LINKS — display labels + URLs (http(s) only). */
  twitter?: string;
  instagram?: string;
  youtube?: string;
  discord?: string;
  website?: string;
  /** SCHEDULE — free-form markdown-free lines ("Fri 19:00 — Weekly dev stream"). */
  lines?: string[];
  /** How many items RECENT_STREAMS shows (bounded by validation). */
  limit?: number;
};

export interface LayoutWidget {
  /** Unique, non-empty, ≤64 chars. Duplicates are rejected. */
  id: string;
  type: WidgetType;
  /** Grid coordinates on the 12-column canvas. Integers ≥ 0. */
  x: number;
  y: number;
  /** Width in grid columns (1–12), height in grid rows (≥1). Integers > 0. */
  w: number;
  h: number;
  /** Optional bounds hints (integers, clamped by validation). */
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  settings?: WidgetSettings;
}

export interface LayoutGrid {
  /** Fixed at 12 columns for now — the validator rejects other values. */
  columns: number;
  /** Pixel height of one grid row. */
  rowHeight: number;
}

/** The versioned layout document stored as JSON in Postgres. */
export interface StreamPageLayoutDocument {
  version: 1;
  grid: LayoutGrid;
  widgets: LayoutWidget[];
}

/** A stored layout row as returned by the API. */
export interface StreamPageLayout {
  channelId: string;
  version: number;
  layout: StreamPageLayoutDocument;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /channels/:slug/layout — published layout for a public channel page. */
export interface ChannelLayoutResponse {
  channelId: string;
  version: number;
  layout: StreamPageLayoutDocument;
  updatedAt: string;
}

/**
 * GET /users/me/channel/layout — the streamer's working view: published
 * state plus the current draft (which may or may not equal the published
 * layout).
 */
export interface MyChannelLayout {
  channelId: string;
  isPublished: boolean;
  publishedLayout: StreamPageLayoutDocument | null;
  draftLayout: StreamPageLayoutDocument;
  updatedAt: string;
}

/** PUT /users/me/channel/layout body. */
export type PutLayoutInput = { layout: StreamPageLayoutDocument };

/** POST /users/me/channel/layout/publish response. */
export interface PublishLayoutResponse {
  channelId: string;
  version: number;
  layout: StreamPageLayoutDocument;
  isPublished: boolean;
  updatedAt: string;
}

/** POST /users/me/channel/layout/reset response. */
export interface ResetLayoutResponse {
  channelId: string;
  draftLayout: StreamPageLayoutDocument;
}

/** Payload of one row in the RECENT_STREAMS widget (from GET /streams?channelId=). */
export interface RecentStreamItem {
  id: string;
  title: string | null;
  thumbnail: string | null;
  status: 'OFFLINE' | 'LIVE' | 'ENDED';
  startedAt: string | null;
  endedAt: string | null;
  viewerCount: number;
}
