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
| `channelId` | String | FK → `Channel.id` |
| `title` | String? | |
| `status` | StreamStatus | Default `OFFLINE` |
| `streamKey` | String | Unique; issued by API for OBS/RTMP publish |
| `startedAt` / `endedAt` | DateTime? | Session window |
| `createdAt` / `updatedAt` | DateTime | |

```prisma
enum StreamStatus { OFFLINE LIVE STARTING ENDING }
```

`status` is the control-plane bridge to the media plane: MediaMTX callbacks (future)
flip it between `STARTING` → `LIVE` → `ENDING` → `OFFLINE`.

### Follow
A user's subscription to a channel (powers "Following" and the sidebar followed list).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `followerId` | String | FK → `User.id` (relation `FollowerUser`) |
| `channelId` | String | FK → `Channel.id` (relation `FollowedChannel`) |
| `createdAt` | DateTime | |
| `@@unique([followerId, channelId])` | | No duplicate follows |

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

- `Stream` does not yet enforce "one active live stream per channel" at the schema
  level — handle in service logic when `streams` is implemented.
- `Notification.type` is a free `String` (typed constants live in code, not the DB).
- `passwordHash` is required (set at registration); OAuth-only accounts are not yet
  supported — would need to relax this constraint in a future migration.
- `role` (added in the auth phase) is a fixed `Role` enum (`USER`/`STREAMER`/
  `MODERATOR`/`ADMIN`) rather than a join table — sufficient for now per
  "do not overcomplicate role management yet".
- Redis is the real-time/presence store; it is **not** modeled in Prisma (no
  persistence there).
