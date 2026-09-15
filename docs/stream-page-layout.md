# Stream Page Layout (Customizable Channel Page)

Each streamer can customize the layout of their public channel page
(`/channel/{slug}`) with a drag-and-drop builder. The backend owns and
validates the layout; the public page renders the **published** document.

```
Streamer
   ↓
Layout Builder UI  (/dashboard/channel/layout)
   ↓
NestJS API  (validation + ownership)
   ↓
PostgreSQL (stream_page_layouts)
   ↓
GET /channels/:slug/layout   (Redis-cached)
   ↓
Public channel page → WidgetRenderer
```

## Layout JSON schema (version 1)

```json
{
  "version": 1,
  "grid": { "columns": 12, "rowHeight": 40 },
  "widgets": [
    { "id": "stream-player", "type": "STREAM_PLAYER", "x": 0, "y": 0, "w": 9, "h": 9 },
    { "id": "chat",          "type": "CHAT",          "x": 9, "y": 0, "w": 3, "h": 14 }
  ]
}
```

Shared TypeScript definitions live in `packages/types/src/layout.ts`
(`StreamPageLayoutDocument`, `LayoutWidget`, `WidgetType`, `WidgetSettings`).
The web app and the API both import them — there are no mirrored
incompatible interfaces.

## Widget types

| Type | Settings | Notes |
| --- | --- | --- |
| `STREAM_PLAYER` | — | Real HLS player (`VideoPlayer`); slot filled only when the channel is live |
| `CHAT` | — | Real WebSocket chat (`useWatchChat` inside `ChatPanel`); no second chat system |
| `CHANNEL_INFO` | — | Avatar, name, followers, category from the channel |
| `ABOUT` | — | Renders the channel's existing `description` — no duplicated data |
| `SOCIAL_LINKS` | `twitter`, `instagram`, `youtube`, `discord`, `website` | http(s) URLs only |
| `SCHEDULE` | `lines: string[]` (≤20 × 140 chars) | Free-form schedule lines |
| `RECENT_STREAMS` | `limit: number` (1–10) | One bounded call to `GET /streams/channel/:channelId` |
| `IMAGE` | `src` (http(s)/local path), `alt` (required with src) | Scheme-validated on both ends |
| `TEXT` | `content` (required, ≤5000 chars), `alignment`, `fontSize` (10–96) | Rendered as escaped React text — no HTML |

Deliberately absent: `CUSTOM_HTML` / arbitrary embeds. Security beats
flexibility; there is no path from layout JSON to script execution.

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/channels/:slug/layout` | — | Published layout (default layout if none) |
| GET | `/users/me/channel/layout` | Bearer | Caller's draft + published state |
| PUT | `/users/me/channel/layout` | Bearer | Save/replace the draft (body: `{ layout }`) |
| POST | `/users/me/channel/layout/publish` | Bearer | Copy draft → published, bump `version`, invalidate cache |
| POST | `/users/me/channel/layout/reset` | Bearer | Draft := default layout (published page untouched) |

Errors: `400` invalid layout (validator message names the exact problem),
`401` missing/invalid token, `404` unknown channel or caller has no channel,
`429` throttled like every other route.

## Validation rules (backend, `layout-validation.ts`)

The `layout` field is untrusted JSON. The DTO layer only asserts "object";
the deep validator enforces:

- `version` must be exactly `1`; `grid.columns` exactly `12`;
  `grid.rowHeight` 16–120.
- At most **30 widgets**; widget ids unique, non-empty, ≤64 chars.
- Geometry: `x` 0–11, `w` 1–12 with `x + w ≤ 12`, `y` ≥ 0, `h` 1–60; all
  integers. `minW/minH/maxW/maxH` must be consistent with `w`/`h` and each
  other.
- Widget `type` must be one of the nine supported types.
- Per-widget settings are strict: unknown keys rejected, URLs must be
  http(s) or app-local (`/path`, never `//host`, `javascript:`, `data:`),
  lengths bounded (TEXT 5k, alt 300, schedule lines 20×140, URLs 2000).

The same validator re-checks every document read from the database; a row
that fails (e.g. written by a future version) degrades to the default
layout instead of breaking the page.

## Draft / publish flow

- `PUT` writes **only** the draft column (`draftLayout`). The public page
  keeps serving the published `layout` column — dragging a widget never
  changes what visitors see.
- `publish` copies draft → `layout`, clears the draft, sets
  `hasPublished`, increments `version`, and deletes the
  `channel:layout:{channelId}` Redis cache key.
- `reset` copies the default document into the draft only; publishing the
  reset is an explicit second step.
- Rows are created lazily on first save/publish; a channel with no row
  serves the default layout (`version: 0` sentinel).

## Caching

Published layouts are read on every public page view and change rarely —
cached under `channel:layout:{channelId}` (TTL 300s), invalidated on
publish. Draft reads are never cached. Redis failures degrade to direct DB
reads (cache is best-effort, mirroring the categories pattern).

## Responsive behavior

Public page and preview share one render path (`LayoutCanvas`) with three
variants selected by the `variant` prop (`auto` | `desktop` | `mobile`):

- Desktop/tablet (`md`+, `variant="desktop"` forces it): the CSS grid
  described by the document (`gridTemplateColumns: repeat(12, 1fr)`,
  `gridAutoRows: rowHeight`).
- Mobile (`variant="mobile"` forces it): a single-column stack in a fixed
  widget-priority order (player → chat → info → about → schedule → social →
  recent → image → text, shared with the builder via
  `lib/widget-order.ts`) with sensible minimum heights — widgets are
  re-ordered, not shrunk.
- `variant="auto"` (the public page) picks between the two at the `md`
  CSS breakpoint; no JS resize listener is involved.

The builder mirrors this on both sides:

- **Canvas** — at `md`+ it is a react-grid-layout v2 `ResponsiveGridLayout`
  (12 cols, rowHeight 40, no compaction; layout math matches the public
  renderer exactly). Below `md` the drag grid is replaced by the same
  single-column priority stack the public mobile page uses — phone users
  can add/select/remove widgets there, but precise drag placement needs a
  tablet/desktop (a 12-column drag surface is ~25px/column on a phone).
- **Preview** has an explicit Desktop/Mobile device toggle so the two
  responsive variants are verifiable from any screen; the toggle defaults
  to the editor's own screen class.
- **Panes** order canvas-first on small screens (widget library and
  settings follow); the three-pane layout is restored at `lg`.

## Security considerations

- Ownership: the channel is resolved from the JWT subject via the unique
  `Channel.ownerId`; no endpoint accepts a channel/user id from the client.
- No HTML/JS widget types; all text renders through React's escaping.
- URL fields accept only http(s)/app-local schemes, enforced server-side
  (the frontend re-checks with `isSafeImageSrc` for defense in depth).
- Payload size bounded structurally: ≤30 widgets, ≤5k chars per text, ≤2000
  chars per URL — no single field can inflate the JSON document.
- Public endpoint exposes only the published document — drafts and version
  metadata never leak.

## Adding a new widget

1. Add the type to `WIDGET_TYPES` in `packages/types/src/layout.ts` and
   extend `WidgetSettings`.
2. Enforce its settings in the backend validator's `validateWidgetSettings`
   switch.
3. Add a case in `apps/web/src/components/stream-page/WidgetRenderer.tsx`
   and (optionally) a builder tile icon in
   `apps/web/src/app/dashboard/channel/layout/page.tsx`.
4. Add tests: validator unit tests + an e2e save/publish round-trip.

Both the public page and the builder go through `WidgetRenderer`, so step 3
is the only UI change needed.
