# StreamHub API Contract

Base URL: `http://localhost:4000/api/v1` (see `.env` → `NEXT_PUBLIC_API_URL`)

All responses use a consistent envelope:

```json
// success
{ "success": true, "data": { /* ... */ } }

// error
{ "success": false, "error": { "code": "...", "message": "..." }, "path": "...", "timestamp": "..." }
```

Authenticated routes require `Authorization: Bearer <accessToken>`.

---

## Auth — `/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Create an account, returns tokens (a verification email is also sent) |
| POST | `/auth/verify-email` | — | Consume an emailed verification token; returns a fresh session |
| POST | `/auth/resend-verification` | — | Re-send the verification email (always generic success) |
| POST | `/auth/login` | — | Log in with username/email + password |
| POST | `/auth/refresh` | — | Exchange a refresh token for a new pair |
| POST | `/auth/logout` | Bearer | Revoke a refresh token |
| GET | `/auth/me` | Bearer | Current authenticated user |

### POST `/auth/register`

```json
// request
{ "username": "codeninja", "email": "cn@example.com", "password": "correct-horse-1", "confirmPassword": "correct-horse-1" }

// 201 response
{ "success": true, "data": { "user": { "id": "...", "username": "codeninja", "email": "cn@example.com", "role": "USER", "...": "..." }, "accessToken": "...", "refreshToken": "..." } }
```

Errors: `400` invalid input, `409` username or email already taken.

### POST `/auth/verify-email`

```json
{ "token": "<raw token from the emailed link>" }
```

Returns the same session shape as register/login. `400` for an unknown, expired, or already-consumed token.

### POST `/auth/resend-verification`

```json
{ "email": "cn@example.com" }
```

Always returns `{ "sent": true }` — unknown emails and already-verified accounts are deliberately silent so the endpoint can't enumerate registered addresses.

### POST `/auth/login`

```json
{ "identifier": "codeninja", "password": "correct-horse-1" }
```

Same response shape as register. `401 Invalid credentials` for a wrong password or unknown identifier (deliberately identical message — no account enumeration).

### POST `/auth/refresh`

```json
{ "refreshToken": "..." }
```

Returns a new `{ accessToken, refreshToken, user }`. The old refresh token is invalidated (rotation) — reusing it returns `401`.

### POST `/auth/logout`

Requires `Authorization` header. Body: `{ "refreshToken": "..." }`. Revokes that refresh token server-side.

### GET `/auth/me`

Returns the caller's own `UserPublic` (never includes `passwordHash`).

---

## Users — `/users`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/users/me/channel` | Bearer | The caller's own channel |
| GET | `/users/me/following` | Bearer | Channels the caller follows *(Phase 7)* |
| GET | `/users/:username` | — | Public profile by username |
| PATCH | `/users/me` | Bearer | Update the caller's own profile |

> Route order matters: `me/channel` and `me/following` are registered before
> `:username` so neither is swallowed by the parameterized route (in
> practice Nest/Express match by segment count, so this is defensive rather
> than strictly required).

### GET `/users/:username`

Public. `404` if the username doesn't exist. Returns `UserPublic` (id, username, email, displayName, avatar, bio, role, createdAt, updatedAt — no `passwordHash`).

### PATCH `/users/me`

Body (all optional): `{ "displayName", "avatar", "bio" }`. Returns the updated `UserPublic`. `401` if unauthenticated.

### GET `/users/me/channel`

Returns the caller's own `ChannelPublic`. `404 "You do not have a channel yet"` if they haven't created one (see below).

### GET `/users/me/following` *(Phase 7)*

Requires `Authorization`. Paginated (`?page=&limit=`, see Pagination below) list of `ChannelPublic` the caller follows, newest-followed first. `200` with `{ items, total, page, limit }`; an empty `items` array if following nobody.

---

## Channels — `/channels` *(Phase 3, extended Phase 7)*

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/channels` | — | Browse/search channels *(Phase 7)* |
| POST | `/channels` | Bearer | Create the caller's channel (one per user) |
| GET | `/channels/:slug` | — | Public channel lookup by slug |
| PATCH | `/channels/:id` | Bearer, owner-only | Update a channel |
| POST | `/channels/:id/follow` | Bearer | Follow a channel *(Phase 7)* |
| DELETE | `/channels/:id/follow` | Bearer | Unfollow a channel *(Phase 7)* |
| GET | `/channels/:id/followers` | — | Paginated list of a channel's followers *(Phase 7)* |

### Channel shape (`ChannelPublic`)

```ts
{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  category: string | null;
  followersCount: number;   // maintained transactionally by the follows module (Phase 7)
  ownerId: string;
  createdAt: string;        // ISO 8601
  updatedAt: string;
}
```

### GET `/channels` *(Phase 7)*

Public. Query params (all optional, see Pagination below for `page`/`limit`):

| Param | Rules | Effect |
| --- | --- | --- |
| `search` | string, ≤50 chars | Case-insensitive substring match against `name` |
| `category` | string, ≤50 chars | Exact match against `category` |
| `sortBy` | `followersCount` \| `createdAt` (default `followersCount`) | |
| `order` | `asc` \| `desc` (default `desc`) | |

`200` with `{ items: ChannelPublic[], total, page, limit }`. Not cached — see Performance below.

### POST `/channels`

Requires `Authorization`. Body:

```json
{
  "name": "Code Ninja",
  "slug": "code-ninja",
  "description": "Software, streamed live.",
  "avatar": "https://...",
  "banner": "https://...",
  "category": "Programming"
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `name` | yes | string, 3–50 chars |
| `slug` | yes | string, 3–30 chars, `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase, digits, single hyphens, no leading/trailing hyphen) |
| `description` | no | string, ≤500 chars |
| `avatar` / `banner` | no | string (URL), ≤500 chars |
| `category` | no | string, ≤50 chars |

Responses:
- `201` — created; returns `ChannelPublic`.
- `400` — validation failure (bad slug format, name too short, etc).
- `401` — no/invalid access token.
- `409 "You already have a channel"` — the caller already owns one (`Channel.ownerId` is unique — one channel per user).
- `409 "Slug already taken"` — another channel already uses that slug.

### GET `/channels/:slug`

Public, no auth required. `200` with `ChannelPublic`, or `404 "Channel not found"`.

### PATCH `/channels/:id`

Requires `Authorization`. Body: any subset of `{ name, slug, description, avatar, banner, category }`, same validation rules as create. Omitted fields are left unchanged.

Responses:
- `200` — updated `ChannelPublic`.
- `400` — validation failure.
- `401` — no/invalid access token.
- `403 "You do not have permission to modify this channel"` — caller is authenticated but is not the channel's owner. Role does not override this (no admin/moderator override is implemented yet).
- `404 "Channel not found"` — no channel with that id.
- `409 "Slug already taken"` — renaming to a slug already in use by another channel.

### POST `/channels/:id/follow` *(Phase 7)*

Requires `Authorization`. No body — the follower is always the authenticated caller, never a request field. `201` with `{ following: true }`.

Responses:
- `201` — followed.
- `401` — no/invalid access token.
- `403 "You cannot follow your own channel"` — caller owns the target channel.
- `404 "Channel not found"`.
- `409 "Already following this channel"` — duplicate follow. Also enforced at the schema level (`@@unique([followerId, channelId])` on `Follow`) — this 409 is a friendlier pre-check in front of that constraint, not the only thing preventing a duplicate.

### DELETE `/channels/:id/follow` *(Phase 7)*

Requires `Authorization`. `200` with `{ following: false }`.

Responses:
- `200` — unfollowed.
- `401` — no/invalid access token.
- `404 "You are not following this channel"` — no existing follow to remove.

### GET `/channels/:id/followers` *(Phase 7)*

Public, no auth required. Paginated (see below). `200` with `{ items: FollowerEntry[], total, page, limit }`, where each entry is `UserPublic & { followedAt: string }`, newest follower first. `404 "Channel not found"` for an unknown channel id.

---

## Categories — `/categories` *(Phase 7)*

An admin-managed catalog of browse/stream categories (e.g. "Gaming", "Just Chatting"). Deliberately **not** a hard foreign key from `Channel.category` / `Stream.category` — both remain freeform strings carried over from earlier phases. See `docs/domain-model.md` §5 for why.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/categories` | — | Browse/search categories |
| POST | `/categories` | Bearer, `ADMIN` only | Create a category |
| PATCH | `/categories/:id` | Bearer, `ADMIN` only | Update a category |
| DELETE | `/categories/:id` | Bearer, `ADMIN` only | Delete a category |

### Category shape (`CategoryPublic`)

```ts
{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### GET `/categories`

Public. Query params: `search` (string, ≤50 chars, case-insensitive substring against `name`/`slug`) plus pagination (`page`/`limit`, see below). `200` with `{ items, total, page, limit }`, sorted alphabetically by `name`.

**Cached** — see Performance below. A write (create/update/delete) invalidates every cached page/search combination immediately, so a stale read is bounded by, at most, the cache TTL (60s) even if invalidation itself somehow failed.

### POST `/categories`

Requires `Authorization` **and** the `ADMIN` role. Body:

```json
{ "name": "Gaming", "slug": "gaming", "description": "Video games", "thumbnail": "https://..." }
```

| Field | Required | Rules |
| --- | --- | --- |
| `name` | yes | string, 2–50 chars, unique |
| `slug` | yes | string, 2–50 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, unique |
| `description` / `thumbnail` | no | string, ≤500 chars |

Responses:
- `201` — created; returns `CategoryPublic`.
- `400` — validation failure.
- `401` — no/invalid access token.
- `403` — authenticated but not `ADMIN`.
- `409` — `name` or `slug` already in use.

### PATCH `/categories/:id`

Requires `Authorization` **and** `ADMIN`. Body: any subset of `{ name, slug, description, thumbnail }`. Same `400`/`401`/`403`/`409` cases as create, plus `404 "Category not found"`.

### DELETE `/categories/:id`

Requires `Authorization` **and** `ADMIN`. `200` with `{ deleted: true }`, or `404 "Category not found"`.

---

## Pagination *(Phase 7)*

Every list endpoint (`/categories`, `/channels`, `/streams`, `/channels/:id/followers`, `/users/me/following`) shares the same query params and response envelope:

| Param | Default | Rules |
| --- | --- | --- |
| `page` | `1` | integer, ≥1 |
| `limit` | `20` | integer, 1–50 |

```ts
{
  items: T[];
  total: number;  // total matching rows, not just this page — for computing page count
  page: number;
  limit: number;
}
```

---

## Streams — `/streams` *(Phase 5, extended Phase 7)*

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/streams` | — | Browse/search streams *(Phase 7)* |
| GET | `/streams/live` | — | Shorthand for `/streams?status=LIVE` *(Phase 7)* |
| POST | `/streams` | Bearer, owner-only | Create a stream session for the caller's own channel |
| GET | `/streams/:id` | — | Public stream metadata |
| PATCH | `/streams/:id` | Bearer, owner-only | Update stream metadata |
| POST | `/streams/:id/rotate-key` | Bearer, owner-only | Issue a new stream key, invalidating the old one |
| POST | `/streams/:id/revoke-key` | Bearer, owner-only | Invalidate the current stream key without replacing it |
| GET | `/streams/:id/status` | — | Public, lightweight status/viewer-count poll |
| POST | `/streams/webhooks/mediamtx/publish` | Shared secret | MediaMTX → API: a publish started |
| POST | `/streams/webhooks/mediamtx/unpublish` | Shared secret | MediaMTX → API: a publish stopped |

> Route order: `GET /streams/live` is registered before `GET /streams/:id` —
> both are one path segment, and being a static path, `live` must come
> first or it would be captured as an `:id` value instead.

"Owner-only" here means the caller must be authenticated **and** be the owner of the
channel the stream belongs to (looked up via `Stream.channelId → Channel.ownerId`) — the
same ownership model `PATCH /channels/:id` uses. There is no moderator/admin override yet.

### GET `/streams` *(Phase 7)*

Public. Query params (all optional, see Pagination above for `page`/`limit`):

| Param | Rules | Effect |
| --- | --- | --- |
| `search` | string, ≤140 chars | Case-insensitive substring match against `title` |
| `category` | string, ≤50 chars | Exact match against `category` |
| `status` | `OFFLINE` \| `LIVE` \| `ENDED` | Exact match against `status` |
| `sortBy` | `viewerCount` \| `startedAt` \| `createdAt` (default `viewerCount`) | |
| `order` | `asc` \| `desc` (default `desc`) | |

`200` with `{ items: StreamPublic[], total, page, limit }`. **Not cached** — see Performance below.

### GET `/streams/live` *(Phase 7)*

Identical to `GET /streams` with `status` forced to `LIVE` (any `status` query param is ignored); all other params (`search`, `category`, `sortBy`, `order`, pagination) still apply.

### Stream shape (`StreamPublic`)

```ts
{
  id: string;
  channelId: string;
  title: string | null;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  status: "OFFLINE" | "LIVE" | "ENDED";
  startedAt: string | null;   // ISO 8601, set when MediaMTX reports a publish
  endedAt: string | null;     // ISO 8601, set when MediaMTX reports an unpublish
  viewerCount: number;        // refreshed by the analytics flush (~30s) while LIVE (Phase 8)
  createdAt: string;
  updatedAt: string;
}
```

`streamKeyHash` (the SHA-256 digest of the stream key) is **never** included in any
response. The raw stream key itself is never persisted at all — see "Stream keys" below.

### Stream lifecycle

A `Stream` row represents one broadcast **session**, not a channel's permanent state:

```
create (OFFLINE) ──MediaMTX publish──▶ LIVE ──MediaMTX unpublish──▶ ENDED
```

- Creating a stream does **not** make a channel live — it issues a session + key and
  leaves `status: "OFFLINE"` until OBS actually starts publishing.
- A channel may only have **one `LIVE` stream at a time** — `POST /streams` returns `409`
  if the caller's channel already has one.
- Once a stream reaches `ENDED`, it is done — to broadcast again, create a new stream
  (new session, new key). `Stream` rows are not reused/reset back to `OFFLINE`.
- Revoking a key on a currently-`LIVE` stream also ends it immediately (`status` →
  `"ENDED"`, `endedAt` set) — an owner should not be able to invalidate a key while a
  broadcast is still nominally "running" under it.

### Stream keys

- Generated server-side (`crypto.randomBytes`, prefixed `sk_live_`) — never chosen by
  the client.
- Returned as `streamKey` **only** in the response body of `POST /streams` and
  `POST /streams/:id/rotate-key` — exactly once, at the moment of issuance/rotation. No
  endpoint ever returns it again afterward.
- Persisted only as `streamKeyHash` (`sha256(rawKey)`), which is what the MediaMTX
  publish webhook looks the stream up by. A database leak alone can never be used to
  reconstruct a usable key.
- `revoke-key` sets `streamKeyHash` to `null`; the stream cannot authenticate a publish
  again until `rotate-key` is called.

### POST `/streams`

Requires `Authorization`. Body (all optional):

```json
{
  "title": "Refactoring the auth module",
  "description": "Live coding session.",
  "category": "Programming",
  "thumbnail": "https://..."
}
```

| Field | Required | Rules |
| --- | --- | --- |
| `title` | no | string, ≤140 chars |
| `description` | no | string, ≤1000 chars |
| `category` | no | string, ≤50 chars |
| `thumbnail` | no | string (URL), ≤500 chars |

The owning channel is always the caller's own — derived from `Channel.ownerId`, never
accepted in the body.

Responses:
- `201` — created; returns `StreamPublic & { streamKey: string }`.
- `400` — validation failure.
- `401` — no/invalid access token.
- `404 "You do not have a channel yet"` — the caller hasn't created a channel.
- `409 "This channel already has a live stream"` — the channel already has a `LIVE`
  stream; end it first.

### GET `/streams/:id`

Public, no auth required. `200` with `StreamPublic`, or `404 "Stream not found"`.

### GET `/streams/:id/status`

Public, no auth required — a lightweight endpoint for polling live status/viewer count
without fetching full metadata. `200`:

```json
{ "id": "...", "status": "LIVE", "viewerCount": 0, "startedAt": "...", "endedAt": null }
```

`404 "Stream not found"` for an unknown id.

### PATCH `/streams/:id`

Requires `Authorization`, owner-only. Body: any subset of
`{ title, description, category, thumbnail }`, same validation rules as create.
Omitted fields are left unchanged. Does not accept `status` — status is only ever
changed via the MediaMTX webhooks or `revoke-key`.

Responses:
- `200` — updated `StreamPublic`.
- `400` — validation failure.
- `401` — no/invalid access token.
- `403 "You do not have permission to manage this stream"` — caller is authenticated
  but does not own the stream's channel.
- `404 "Stream not found"`.

### POST `/streams/:id/rotate-key`

Requires `Authorization`, owner-only. No body. `201` with `StreamPublic & { streamKey: string }`
(the new raw key). Same `401`/`403`/`404` cases as `PATCH`.

### POST `/streams/:id/revoke-key`

Requires `Authorization`, owner-only. No body. `201` with `StreamPublic` (no key — there
isn't one anymore). If the stream was `LIVE`, it is also transitioned to `ENDED`. Same
`401`/`403`/`404` cases as `PATCH`.

### POST `/streams/webhooks/mediamtx/publish` / `.../unpublish`

Called by MediaMTX itself (see `infrastructure/streaming/mediamtx.yml`'s `runOnPublish`
/ `runOnUnpublish`), never by end users or the web app. Authenticated via a static
shared secret in the `x-webhook-secret` header (`MEDIAMTX_WEBHOOK_SECRET` env var on
both sides) rather than a user JWT.

Body:

```json
{ "streamKey": "sk_live_..." }
```

`publish`:
- `201` — key matched a stream; that stream is now `LIVE` (idempotent — re-notifying an
  already-`LIVE` stream is a no-op, `startedAt` is not overwritten).
- `401 "Unknown or revoked stream key"` — no stream has a matching (non-revoked) key.
- `401` (from `MediaMtxWebhookGuard`) — missing/incorrect `x-webhook-secret`.

`unpublish`:
- `201` — always, whether or not the key matched anything. An unrecognized key or a
  stream that's already `OFFLINE`/`ENDED` is a normal occurrence (e.g. a duplicate
  disconnect notification), not an error — `data` is `null` in the "unrecognized key"
  case. A matching `LIVE` stream transitions to `ENDED` with `endedAt` set.
- `401` (from `MediaMtxWebhookGuard`) — missing/incorrect `x-webhook-secret`.

---

## Analytics — `/analytics` *(Phase 8)*

Streamer analytics: viewers, peak/average viewers, views, followers gained, duration and watch time. Full architecture in `docs/analytics.md`. The short version: viewer heartbeats touch **Redis only**; a background pipeline samples each live stream into Postgres every ~30s (`viewer_metrics` + a pre-aggregated `stream_analytics` row per stream), so every read below is a sum over pre-aggregated rows, not a computation from raw events.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/analytics/streams/:streamId/heartbeat` | — (public) | Viewer presence ping from a stream player |
| GET | `/analytics/overview` | Bearer, owner | Channel totals/averages/peaks over a trailing window |
| GET | `/analytics/streams` | Bearer, owner | Paginated per-stream analytics |
| GET | `/analytics/streams/:streamId` | Bearer, owner | One stream's analytics |
| GET | `/analytics/viewers` | Bearer, owner | Per-stream viewer-over-time timeline |

"Owner" = the caller must own the channel whose analytics they read (resolved via `Channel.ownerId`). A streamer can never see another channel's numbers: reading someone else's real stream returns `403`, a nonexistent stream `404`, and overview/streams `404 "You do not have a channel yet"` for users without a channel. There is no moderator/admin override.

### POST `/analytics/streams/:streamId/heartbeat`

```json
{ "viewerId": "<client-generated anonymous id, 8-128 chars>" }
```

`201` with `{ accepted: true }` while the stream is live; `{ accepted: false }` (still 201) for a stream that exists but isn't live. `404 "Stream not found"` for an unknown stream id, `400` for a malformed body. Counts a new **view** only when a viewer's presence key was absent (re-joins after 60s without a ping count again); nothing is written to Postgres per heartbeat.

### GET `/analytics/overview`

Query params: `days` (integer 1–90, default 30). `200`:

```json
{
  "range": { "from": "...", "to": "...", "days": 30 },
  "totals": { "streams": 12, "views": 3214, "watchTimeSeconds": 93433, "durationSeconds": 12355, "followersGained": 42 },
  "averages": { "viewers": 7.56, "viewsPerStream": 267.8, "durationSecondsPerStream": 1029.6, "followersGainedPerStream": 3.5 },
  "peaks": { "viewers": 128 },
  "live": { "streams": 1, "viewers": 3 }
}
```

`averages.viewers` is duration-weighted (total watch time ÷ total duration). `live` reflects the channel's currently-live streams (Redis presence at request time).

### GET `/analytics/streams`

Bearer + owner. Paginated (`page`/`limit`, see Pagination above), newest stream first. `200` with `{ items, total, page, limit }`, each item:

```ts
{
  streamId: string;
  title: string | null;
  status: "OFFLINE" | "LIVE" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  currentViewers: number;          // Redis presence, meaningful while LIVE
  totals: { views: number; watchTimeSeconds: number; durationSeconds: number; followersGained: number };
  viewers: { peak: number; average: number };
}
```

Only streams that actually went live have rows (a created-but-never-broadcast stream never appears).

### GET `/analytics/streams/:streamId`

Bearer + owner. Same shape as one list item. `403` for another channel's stream, `404 "Stream not found"` for an unknown id, `404 "Analytics not found for this stream yet"` for the caller's own never-broadcast stream.

### GET `/analytics/viewers`

Bearer + owner. Query params: `streamId` (required). Returns the stream's viewer-over-time timeline, minute-bucketed (hour-bucketed for streams > 48h), capped at 480 points:

```ts
{
  streamId: string;
  bucket: "minute" | "hour";
  points: [
    { t: "2026-09-01T12:00:00.000Z", peakViewers: 20, averageViewers: 15, samples: 2 }
    // ...
  ];
}
```

Same `403`/`404` rules as `streams/:streamId`.

---

## Error codes

The `error.code` field is the HTTP status name (e.g. `BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`). `error.message` is safe to show to end users; 500-level errors always return a generic `"Internal server error"` message regardless of the underlying cause (see `AllExceptionsFilter`).

## Rate limiting

All routes are subject to a global limit of 20 requests / 60 seconds per IP (`ThrottlerModule`). Exceeding it returns `429`.

## Performance *(Phase 7)*

Redis caching is applied in exactly one place: **`GET /categories`**, with a 60-second TTL, explicitly invalidated on every `POST`/`PATCH`/`DELETE /categories`. This is deliberately the *only* cached read in the API. Everything else that could plausibly be cached carries state that changes as a side effect of an unrelated write and would go stale in a way that's actively misleading:

- `GET /streams`, `GET /streams/live`, `GET /streams/:id`, `GET /streams/:id/status` — `status`/`viewerCount`/`startedAt` change on every MediaMTX publish/unpublish webhook. A cached page could show a stream as `LIVE` after it ended, or omit one that just went live.
- `GET /channels`, `GET /channels/:slug`, `GET /channels/:id/followers` — `followersCount` changes on every follow/unfollow, and followers lists change just as often.

Categories are the opposite profile: a small, admin-curated catalog that changes rarely (an occasional create/rename/delete, not per-request), so a short-TTL cache with write-time invalidation has a very low staleness window and a real payoff (`GET /categories` is likely the single most frequently hit browse endpoint, since every stream/channel browse UI needs the category list for its filter chips).

Analytics reads (`GET /analytics/*`) are not cached either — they are cheap by construction (sums over pre-aggregated rows, bounded timeline folds) and a streamer expects fresh numbers on every dashboard load; see `docs/analytics.md` for the write-side batching that makes that possible.
