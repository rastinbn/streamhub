# StreamHub — Domain Model

The domain model is defined in `packages/database/prisma/schema.prisma` (Prisma +
PostgreSQL). This is a **Phase 1 structural foundation**: models and relationships
exist; fine-grained constraints, indexes, and business rules are refined per-phase as
each NestJS module is implemented.

The API surface mirrors these aggregates one-to-one via the modules in
`apps/api/src/modules` (`auth`, `users`, `channels`, `streams`, `chat`, `follows`,
`notifications`, `moderation`, `analytics`).

---

## 1. Aggregates & Entities

### User
The account that owns a channel, follows channels, sends chat, and receives
notifications.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `username` | String | Unique; used in URLs (`/profile` future) |
| `email` | String | Unique |
| `passwordHash` | String | Required — set at registration (see `auth` module) |
| `displayName` | String? | |
| `avatar` | String? | Avatar image URL |
| `bio` | String? | Free-text profile bio |
| `role` | Role | `USER` \| `STREAMER` \| `MODERATOR` \| `ADMIN`; default `USER` |
| `createdAt` / `updatedAt` | DateTime | |

Relations: `channel` (1:1), `follows` (as follower), `messages` (ChatMessage author),
`notifications` (recipient).

### Channel
A creator's public broadcast identity. One per user; the unit that is followed and
streamed.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `slug` | String | Unique; URL segment `/channel/[slug]`; lowercase, hyphenated |
| `name` | String | Display name for the channel |
| `description` | String? | |
| `avatar` | String? | Channel avatar image URL |
| `banner` | String? | Channel banner image URL |
| `category` | String? | Free-text category (e.g. "Programming"); indexed for browse/filter |
| `followersCount` | Int | Denormalized count, default `0`; maintained by the `follows` module (not yet implemented) |
| `ownerId` | String | Unique FK → `User.id` (one channel per user) |
| `createdAt` / `updatedAt` | DateTime | |

Relations: `owner` (User), `streams` (1:N), `followers` (Follow), `chatMessages` (1:N).

### Stream
A single live (or past) broadcast session belonging to a channel. This is the
metadata record — the actual video bytes live in MediaMTX, never in the database.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `channelId` | String | FK → `Channel.id`; indexed |
| `title` | String? | |
| `description` | String? | |
| `category` | String? | Indexed; free-text, independent of `Channel.category` (a stream's category can differ per-session) |
| `thumbnail` | String? | Thumbnail image URL |
| `streamKeyHash` | String? | Unique, nullable; SHA-256 digest of the raw stream key (see below). `null` once revoked |
| `status` | StreamStatus | Default `OFFLINE`; indexed |
| `startedAt` / `endedAt` | DateTime? | Session window — set by the MediaMTX publish/unpublish webhooks |
| `viewerCount` | Int | Denormalized, default `0`; real-time increments via Redis presence are a future phase |
| `createdAt` / `updatedAt` | DateTime | |

```prisma
enum StreamStatus { OFFLINE LIVE ENDED }
```

`status` is the control-plane bridge to the media plane: MediaMTX's `runOnPublish` /
`runOnUnpublish` hooks call back to the API (`POST /streams/webhooks/mediamtx/{publish,unpublish}`,
see `docs/api-contract.md`), which flips `OFFLINE → LIVE → ENDED`. There is no
transitional `STARTING`/`ENDING` state — a stream is created `OFFLINE` and moves
directly to `LIVE`/`ENDED` as those events arrive. A `Stream` row is a single session:
once `ENDED`, a channel broadcasts again by creating a new `Stream`, not by resetting
the old one.

**Stream keys:** the raw key (`sk_live_<48 hex chars>`, `crypto.randomBytes`-generated)
is never persisted — only `streamKeyHash = sha256(rawKey)` is stored, and only for as
long as the key is active (`null` after `revoke-key`). This is a deliberate departure
from `User.passwordHash` (bcrypt): stream keys are already high-entropy generated
secrets rather than user-chosen low-entropy passwords, so a fast, deterministic digest
is both sufficient against brute-force and — unlike bcrypt — is what lets the publish
webhook look a presented key up directly instead of comparing against every row. See
`apps/api/src/modules/streams/stream-key.util.ts`.

### Follow
A user's subscription to a channel (powers "Following" and the sidebar followed list).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `followerId` | String | FK → `User.id` (relation `FollowerUser`) |
| `channelId` | String | FK → `Channel.id` (relation `FollowedChannel`) |
| `createdAt` | DateTime | |
| `@@unique([followerId, channelId])` | | No duplicate follows — enforced at the schema level, not just in application code |
| `@@index([channelId])` | | *(Phase 7)* The unique index above only accelerates lookups starting with `followerId` (leftmost prefix) — "who does user X follow" (`GET /users/me/following`). This standalone index covers the other direction, "who follows channel Y" (`GET /channels/:id/followers`), which the compound index alone can't serve efficiently. |

`Channel.followersCount` is a denormalized counter kept in sync transactionally on
every follow/unfollow (`FollowsService`, Phase 7) — it's a read optimization (browse/
search sorting by popularity without a `COUNT(*)` join), not the source of truth; the
`Follow` rows themselves are.

### Category *(Phase 7)*
An admin-managed catalog of browse/stream categories (e.g. "Gaming", "Just Chatting").

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `name` | String | Unique |
| `slug` | String | Unique, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description` | String? | |
| `thumbnail` | String? | Image URL |
| `createdAt` / `updatedAt` | DateTime | |
| `@@index([name])` | | Supports both slug-style lookups and `ILIKE`-based search |

**Deliberately not a hard FK.** `Channel.category` and `Stream.category` (added in
Phases 3 and 5 respectively) both remain plain, freeform `String?` columns — `Category`
does not replace or constrain them in this phase. Reasoning:

- Converting two existing, already-populated columns to a `categoryId` FK is a real
  migration with real risk (backfilling every row to a matching `Category`, deciding
  what happens to values with no catalog match) for a benefit — referential integrity
  on a field that's really just a browse/filter tag — that doesn't clearly outweigh
  that risk in this phase.
- The catalog is still genuinely useful on its own: it's what `GET /categories` browses
  and what `POST/PATCH/DELETE /categories` lets admins curate (canonical name,
  description, thumbnail for a "browse by category" grid) — none of that requires the
  *other* tables to point at it.
- `GET /streams?category=` and `GET /channels?category=` continue to filter on the
  existing freeform string column, matched against a category's `name` by convention
  (documented, not enforced).

A future phase could tighten this into a real FK once category-name adoption stabilizes
(i.e. once it's clear streamers are actually picking from the catalog rather than typing
arbitrary strings) — noted here rather than deferred silently.

### ChatMessage
A chat message sent in a channel's stream (real-time, via WebSocket + Redis pub/sub).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `channelId` | String | FK → `Channel.id` |
| `authorId` | String | FK → `User.id` |
| `content` | String | |
| `createdAt` | DateTime | |

### Notification
A user-facing notification (follow, live-start, mention, moderation, …).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `userId` | String | FK → `User.id` |
| `type` | String | Open enum (e.g. `LIVE_START`, `NEW_FOLLOW`) |
| `payload` | Json? | Event-specific data |
| `readAt` | DateTime? | Null = unread |
| `createdAt` | DateTime | |

---

## 2. Relationship Map

```
User ──1:1── Channel ──1:N── Stream
 │                │
 │                └──1:N── Follow (channelId) ── N:1 ── User (followerId)
 │                └──1:N── ChatMessage (authorId ── User)
 │
 └──1:N── Notification

Follow: (followerId:User) ── N:N via join ── (channelId:Channel)
```

- **User ↔ Channel:** 1:1 (a user owns at most one channel).
- **Channel ↔ Stream:** 1:N (a channel has many past/current streams; one live at a
  time is enforced by business logic, not yet by schema).
- **User ↔ Channel (follow):** M:N resolved by `Follow` with a unique pair constraint.
- **Channel ↔ ChatMessage:** 1:N; **User ↔ ChatMessage:** 1:N (author).
- **User ↔ Notification:** 1:N.

---

## 3. Control-Plane vs Media-Plane

The domain model only describes the **control plane** (metadata/state). The
**media plane** is intentionally outside the database:

| Concern | Where it lives |
| --- | --- |
| Stream key issuance & validation | API (`streams` module) → `Stream.streamKey` |
| Live status | `Stream.status` (flipped by future MediaMTX callbacks) |
| Video segments (HLS) | MediaMTX (RTMP ingest, HLS output) — not in Postgres |
| Chat transport | WebSocket + Redis pub/sub (API brokers), persisted as `ChatMessage` |
| Presence / viewer counts | Redis (real-time); surfaced on `StreamCard`/watch UI |

---

## 4. Module ↔ Entity Mapping (NestJS)

| Module | Primary entity | Responsibility |
| --- | --- | --- |
| `auth` | User | Registration, login, session, stream-key custody |
| `users` | User | Profiles, display name, avatar |
| `channels` | Channel | Channel CRUD, slugs, ownership |
| `streams` | Stream | Lifecycle, status, key issuance |
| `chat` | ChatMessage | Send/list messages, WebSocket gateway |
| `follows` | Follow | Follow/unfollow, following feed |
| `notifications` | Notification | Dispatch & read state |
| `moderation` | (ChatMessage/User) | Future: bans, deletes, reports |
| `analytics` | derived | Future: viewer/engagement aggregates |

---

## 5. Notes & Open Items

- ~~`Stream` does not yet enforce "one active live stream per channel"~~ — now enforced
  in `StreamsService.create` (service-level, not a schema constraint):
  `POST /streams` returns `409` if the caller's channel already has a `LIVE` stream.
- `Notification.type` is a free `String` (typed constants live in code, not the DB).
- `passwordHash` is required (set at registration); OAuth-only accounts are not yet
  supported — would need to relax this constraint in a future migration.
- `role` (added in the auth phase) is a fixed `Role` enum (`USER`/`STREAMER`/
  `MODERATOR`/`ADMIN`) rather than a join table — sufficient for now per
  "do not overcomplicate role management yet".
- Redis is the real-time/presence store; it is **not** modeled in Prisma (no
  persistence there).
- `Category` (Phase 7) is intentionally **not** a hard FK from `Channel.category` /
  `Stream.category` — see the Category entity section above for the full reasoning.
