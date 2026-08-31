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
| POST | `/auth/register` | — | Create an account, returns tokens |
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
| GET | `/users/:username` | — | Public profile by username |
| PATCH | `/users/me` | Bearer | Update the caller's own profile |

> Route order matters: `me/channel` is registered before `:username` so it
> isn't swallowed by the parameterized route (in practice Nest/Express match
> by segment count, so this is defensive rather than strictly required).

### GET `/users/:username`

Public. `404` if the username doesn't exist. Returns `UserPublic` (id, username, email, displayName, avatar, bio, role, createdAt, updatedAt — no `passwordHash`).

### PATCH `/users/me`

Body (all optional): `{ "displayName", "avatar", "bio" }`. Returns the updated `UserPublic`. `401` if unauthenticated.

### GET `/users/me/channel`

Returns the caller's own `ChannelPublic`. `404 "You do not have a channel yet"` if they haven't created one (see below).

---

## Channels — `/channels` *(Phase 3)*

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/channels` | Bearer | Create the caller's channel (one per user) |
| GET | `/channels/:slug` | — | Public channel lookup by slug |
| PATCH | `/channels/:id` | Bearer, owner-only | Update a channel |

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
  followersCount: number;   // maintained by the follows module (future phase); always 0 for now
  ownerId: string;
  createdAt: string;        // ISO 8601
  updatedAt: string;
}
```

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

---

<<<<<<< HEAD
## Streams — `/streams` *(Phase 5)*

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/streams` | Bearer, owner-only | Create a stream session for the caller's own channel |
| GET | `/streams/:id` | — | Public stream metadata |
| PATCH | `/streams/:id` | Bearer, owner-only | Update stream metadata |
| POST | `/streams/:id/rotate-key` | Bearer, owner-only | Issue a new stream key, invalidating the old one |
| POST | `/streams/:id/revoke-key` | Bearer, owner-only | Invalidate the current stream key without replacing it |
| GET | `/streams/:id/status` | — | Public, lightweight status/viewer-count poll |
| POST | `/streams/webhooks/mediamtx/publish` | Shared secret | MediaMTX → API: a publish started |
| POST | `/streams/webhooks/mediamtx/unpublish` | Shared secret | MediaMTX → API: a publish stopped |

"Owner-only" here means the caller must be authenticated **and** be the owner of the
channel the stream belongs to (looked up via `Stream.channelId → Channel.ownerId`) — the
same ownership model `PATCH /channels/:id` uses. There is no moderator/admin override yet.

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
  viewerCount: number;        // denormalized; real-time increments are a future phase
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

=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000
## Error codes

The `error.code` field is the HTTP status name (e.g. `BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`). `error.message` is safe to show to end users; 500-level errors always return a generic `"Internal server error"` message regardless of the underlying cause (see `AllExceptionsFilter`).

## Rate limiting

All routes are subject to a global limit of 20 requests / 60 seconds per IP (`ThrottlerModule`). Exceeding it returns `429`.
