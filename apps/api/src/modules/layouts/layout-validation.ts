import type {
  LayoutGrid,
  LayoutWidget,
  StreamPageLayoutDocument,
  WidgetSettings,
  WidgetType,
} from '@streamhub/types';
import { WIDGET_TYPES } from '@streamhub/types';

/**
 * Server-side validation for the stream-page layout document. Every field
 * is re-derived here — the DTO layer only guarantees "it's a JSON object";
 * the document's internals are untrusted JSON from the client.
 *
 * Design limits (also documented in docs/stream-page-layout.md):
 *   - schema version 1 only
 *   - exactly 12 grid columns
 *   - max 30 widgets per layout
 *   - width 1..12, height 1..60 rows, x within the 12-column canvas
 *   - TEXT/IMAGE settings strings bounded (5k / 300 chars) — no HTML is
 *     ever rendered from them (React escapes text; IMAGE src is
 *     scheme-checked by both this validator and the frontend).
 *
 * Throws `LayoutValidationError` with a human-readable message the
 * controller maps to 400/422.
 */

export const LAYOUT_SCHEMA_VERSION = 1;
export const GRID_COLUMNS = 12;
export const MIN_ROW_HEIGHT = 16;
export const MAX_ROW_HEIGHT = 120;
export const MAX_WIDGETS = 30;
export const MIN_WIDGET_W = 1;
export const MAX_WIDGET_W = 12;
export const MIN_WIDGET_H = 1;
export const MAX_WIDGET_H = 60;
export const MAX_WIDGET_ID_LENGTH = 64;
export const MAX_TEXT_CONTENT_LENGTH = 5000;
export const MAX_IMAGE_ALT_LENGTH = 300;
export const MAX_URL_LENGTH = 2000;
export const MAX_SCHEDULE_LINES = 20;
export const MAX_SCHEDULE_LINE_LENGTH = 140;
export const MAX_TEXT_FONT_SIZE = 96;

const WIDGET_TYPE_SET: ReadonlySet<string> = new Set<string>(WIDGET_TYPES);

export class LayoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

/** http(s) or app-local path (`/foo`, never `//host`) — the same policy the
 * web client enforces in `lib/security.ts`; enforced here too because the
 * backend must not rely on client-side checks. */
export function isSafeWidgetUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateWidgetSettings(type: WidgetType, raw: unknown): WidgetSettings | undefined {
  if (raw === undefined) {
    // TEXT is the one type with a required setting (its content) — a TEXT
    // widget with no settings object would render nothing.
    if (type === 'TEXT') {
      throw new LayoutValidationError(`Widget TEXT requires "content" in settings.`);
    }
    return undefined;
  }
  if (!isRecord(raw)) throw new LayoutValidationError(`Widget settings must be an object (widget type ${type}).`);

  const settings: WidgetSettings = {};
  const out = settings as Record<string, unknown>;

  const copyText = (key: 'content' | 'alt', max: number, required: boolean): void => {
    const value = raw[key];
    if (value === undefined) {
      if (required) throw new LayoutValidationError(`Widget ${type} requires "${key}" in settings.`);
      return;
    }
    if (typeof value !== 'string') throw new LayoutValidationError(`Widget ${type} "${key}" must be a string.`);
    if (value.length > max) {
      throw new LayoutValidationError(`Widget ${type} "${key}" exceeds ${max} characters.`);
    }
    out[key] = value;
  };

  const copyUrl = (key: 'src' | 'twitter' | 'instagram' | 'youtube' | 'discord' | 'website'): void => {
    const value = raw[key];
    if (value === undefined) return;
    if (typeof value !== 'string' || value.length === 0) {
      throw new LayoutValidationError(`Widget ${type} "${key}" must be a non-empty string.`);
    }
    if (!isSafeWidgetUrl(value)) {
      throw new LayoutValidationError(`Widget ${type} "${key}" must be an http(s) URL or an app-local path.`);
    }
    out[key] = value;
  };

  switch (type) {
    case 'TEXT': {
      copyText('content', MAX_TEXT_CONTENT_LENGTH, true);
      const alignment = raw.alignment;
      if (alignment !== undefined) {
        if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') {
          throw new LayoutValidationError(`Widget TEXT "alignment" must be left, center or right.`);
        }
        out.alignment = alignment;
      }
      const fontSize = raw.fontSize;
      if (fontSize !== undefined) {
        if (!isFiniteInt(fontSize) || fontSize < 10 || fontSize > MAX_TEXT_FONT_SIZE) {
          throw new LayoutValidationError(`Widget TEXT "fontSize" must be an integer between 10 and ${MAX_TEXT_FONT_SIZE}.`);
        }
        out.fontSize = fontSize;
      }
      break;
    }
    case 'IMAGE': {
      copyUrl('src');
      if (out.src !== undefined) copyText('alt', MAX_IMAGE_ALT_LENGTH, true);
      const known = Object.keys(raw).filter((k) => k !== 'src' && k !== 'alt');
      if (known.length > 0) {
        throw new LayoutValidationError(`Widget IMAGE does not support setting(s): ${known.join(', ')}.`);
      }
      break;
    }
    case 'SOCIAL_LINKS': {
      for (const key of ['twitter', 'instagram', 'youtube', 'discord', 'website'] as const) copyUrl(key);
      const known = Object.keys(raw).filter(
        (k) => !['twitter', 'instagram', 'youtube', 'discord', 'website'].includes(k),
      );
      if (known.length > 0) {
        throw new LayoutValidationError(`Widget SOCIAL_LINKS does not support setting(s): ${known.join(', ')}.`);
      }
      break;
    }
    case 'SCHEDULE': {
      const lines = raw.lines;
      if (lines !== undefined) {
        if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
          throw new LayoutValidationError(`Widget SCHEDULE "lines" must be an array of strings.`);
        }
        if (lines.length > MAX_SCHEDULE_LINES) {
          throw new LayoutValidationError(`Widget SCHEDULE supports at most ${MAX_SCHEDULE_LINES} lines.`);
        }
        for (const line of lines as string[]) {
          if (line.length > MAX_SCHEDULE_LINE_LENGTH) {
            throw new LayoutValidationError(`Widget SCHEDULE lines are limited to ${MAX_SCHEDULE_LINE_LENGTH} characters.`);
          }
        }
        out.lines = lines as string[];
      }
      const known = Object.keys(raw).filter((k) => k !== 'lines');
      if (known.length > 0) {
        throw new LayoutValidationError(`Widget SCHEDULE does not support setting(s): ${known.join(', ')}.`);
      }
      break;
    }
    case 'RECENT_STREAMS': {
      const limit = raw.limit;
      if (limit !== undefined) {
        if (!isFiniteInt(limit) || limit < 1 || limit > 10) {
          throw new LayoutValidationError(`Widget RECENT_STREAMS "limit" must be an integer between 1 and 10.`);
        }
        out.limit = limit;
      }
      const known = Object.keys(raw).filter((k) => k !== 'limit');
      if (known.length > 0) {
        throw new LayoutValidationError(`Widget RECENT_STREAMS does not support setting(s): ${known.join(', ')}.`);
      }
      break;
    }
    case 'STREAM_PLAYER':
    case 'CHAT':
    case 'CHANNEL_INFO':
    case 'ABOUT': {
      const known = Object.keys(raw);
      if (known.length > 0) {
        throw new LayoutValidationError(`Widget ${type} does not support setting(s): ${known.join(', ')}.`);
      }
      break;
    }
  }

  return Object.keys(out).length > 0 ? settings : undefined;
}

function validateWidget(raw: unknown, index: number, seenIds: Set<string>): LayoutWidget {
  if (!isRecord(raw)) throw new LayoutValidationError(`Widget at index ${index} must be an object.`);

  const id = raw.id;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_WIDGET_ID_LENGTH) {
    throw new LayoutValidationError(
      `Widget at index ${index} must have a non-empty "id" of at most ${MAX_WIDGET_ID_LENGTH} characters.`,
    );
  }
  if (seenIds.has(id)) {
    throw new LayoutValidationError(`Duplicate widget id "${id}".`);
  }
  seenIds.add(id);

  const type = raw.type;
  if (typeof type !== 'string' || !WIDGET_TYPE_SET.has(type)) {
    throw new LayoutValidationError(`Widget "${id}" has an unsupported type: ${String(type)}.`);
  }

  const bounds: Array<[string, number, number]> = [
    ['x', 0, GRID_COLUMNS - 1],
    ['y', 0, 100000],
    ['w', MIN_WIDGET_W, MAX_WIDGET_W],
    ['h', MIN_WIDGET_H, MAX_WIDGET_H],
  ];
  const geometry: Record<string, number> = {};
  for (const [key, min, max] of bounds) {
    const value = raw[key];
    if (!isFiniteInt(value) || value < min || value > max) {
      throw new LayoutValidationError(
        `Widget "${id}" has an invalid "${key}": expected an integer between ${min} and ${max}.`,
      );
    }
    geometry[key] = value;
  }

  if (geometry['x']! + geometry['w']! > GRID_COLUMNS) {
    throw new LayoutValidationError(`Widget "${id}" extends beyond the ${GRID_COLUMNS}-column grid.`);
  }

  const optionalBounds: Array<[string, number, number]> = [
    ['minW', MIN_WIDGET_W, MAX_WIDGET_W],
    ['minH', MIN_WIDGET_H, MAX_WIDGET_H],
    ['maxW', MIN_WIDGET_W, MAX_WIDGET_W],
    ['maxH', MIN_WIDGET_H, MAX_WIDGET_H],
  ];
  const optional: Record<string, number | undefined> = {};
  for (const [key, min, max] of optionalBounds) {
    const value = raw[key];
    if (value === undefined) continue;
    if (!isFiniteInt(value) || value < min || value > max) {
      throw new LayoutValidationError(
        `Widget "${id}" has an invalid "${key}": expected an integer between ${min} and ${max}.`,
      );
    }
    optional[key] = value;
  }
  if (
    optional['minW'] !== undefined &&
    optional['maxW'] !== undefined &&
    optional['minW'] > optional['maxW']
  ) {
    throw new LayoutValidationError(`Widget "${id}" has minW greater than maxW.`);
  }
  if (
    optional['minH'] !== undefined &&
    optional['maxH'] !== undefined &&
    optional['minH'] > optional['maxH']
  ) {
    throw new LayoutValidationError(`Widget "${id}" has minH greater than maxH.`);
  }
  if (optional['minW'] !== undefined && optional['minW'] > geometry['w']!) {
    throw new LayoutValidationError(`Widget "${id}" has minW greater than w.`);
  }
  if (optional['minH'] !== undefined && optional['minH'] > geometry['h']!) {
    throw new LayoutValidationError(`Widget "${id}" has minH greater than h.`);
  }
  if (optional['maxW'] !== undefined && optional['maxW'] < geometry['w']!) {
    throw new LayoutValidationError(`Widget "${id}" has maxW smaller than w.`);
  }
  if (optional['maxH'] !== undefined && optional['maxH'] < geometry['h']!) {
    throw new LayoutValidationError(`Widget "${id}" has maxH smaller than h.`);
  }

  const settings = validateWidgetSettings(type as WidgetType, raw.settings);

  return {
    id,
    type: type as WidgetType,
    x: geometry['x']!,
    y: geometry['y']!,
    w: geometry['w']!,
    h: geometry['h']!,
    ...(optional['minW'] !== undefined ? { minW: optional['minW'] } : {}),
    ...(optional['minH'] !== undefined ? { minH: optional['minH'] } : {}),
    ...(optional['maxW'] !== undefined ? { maxW: optional['maxW'] } : {}),
    ...(optional['maxH'] !== undefined ? { maxH: optional['maxH'] } : {}),
    ...(settings !== undefined ? { settings } : {}),
  };
}

function validateGrid(raw: unknown): LayoutGrid {
  if (!isRecord(raw)) throw new LayoutValidationError('Layout "grid" must be an object.');
  const columns = raw.columns;
  if (!isFiniteInt(columns) || columns !== GRID_COLUMNS) {
    throw new LayoutValidationError(`Layout "grid.columns" must be ${GRID_COLUMNS}.`);
  }
  const rowHeight = raw.rowHeight;
  if (!isFiniteInt(rowHeight) || rowHeight < MIN_ROW_HEIGHT || rowHeight > MAX_ROW_HEIGHT) {
    throw new LayoutValidationError(
      `Layout "grid.rowHeight" must be an integer between ${MIN_ROW_HEIGHT} and ${MAX_ROW_HEIGHT}.`,
    );
  }
  return { columns, rowHeight };
}

/**
 * Validates an untrusted value as a layout document. Throws
 * `LayoutValidationError` on any violation; returns a clean, normalized
 * document (only known fields, defaults omitted) on success.
 */
export function validateLayoutDocument(raw: unknown): StreamPageLayoutDocument {
  if (!isRecord(raw)) throw new LayoutValidationError('Layout must be a JSON object.');

  if (raw.version !== LAYOUT_SCHEMA_VERSION) {
    throw new LayoutValidationError(`Layout "version" must be ${LAYOUT_SCHEMA_VERSION}.`);
  }

  const grid = validateGrid(raw.grid);

  if (!Array.isArray(raw.widgets)) throw new LayoutValidationError('Layout "widgets" must be an array.');
  if (raw.widgets.length > MAX_WIDGETS) {
    throw new LayoutValidationError(`Layout supports at most ${MAX_WIDGETS} widgets.`);
  }

  const seenIds = new Set<string>();
  const widgets = raw.widgets.map((w, i) => validateWidget(w, i, seenIds));

  return { version: LAYOUT_SCHEMA_VERSION, grid, widgets };
}
