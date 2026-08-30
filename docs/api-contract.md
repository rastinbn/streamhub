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

## Error codes

The `error.code` field is the HTTP status name (e.g. `BAD_REQUEST`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`). `error.message` is safe to show to end users; 500-level errors always return a generic `"Internal server error"` message regardless of the underlying cause (see `AllExceptionsFilter`).

## Rate limiting

All routes are subject to a global limit of 20 requests / 60 seconds per IP (`ThrottlerModule`). Exceeding it returns `429`.
