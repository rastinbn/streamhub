# StreamHub Real-Time Chat — WebSocket Contract

Phase 6. Transport: Socket.IO over a NestJS `@WebSocketGateway`, namespace
`/chat`, running on the same HTTP server/port as the REST API
(`http://localhost:4000` by default — see `apps/api/src/main.ts`).

```
ws(s)://<api-host>/chat
```

Fan-out across multiple API instances is done with Redis Pub/Sub — no chat
state lives only in one process's memory. See "Scaling & multi-instance
delivery" below.

---

## Connecting & authentication

The client must supply a valid access token (the same JWT issued by
`POST /auth/login`) on the Socket.IO handshake:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000/chat', {
  auth: { token: accessToken },
});
```

If a client can't set handshake `auth`, an `Authorization: Bearer <token>`
header is also accepted.

- No token, an expired token, or an invalid signature → the server emits
  `chat:error` with `code: "UNAUTHENTICATED"` and immediately disconnects the
  socket. The connection is never accepted "logged out" — there is no
  anonymous/read-only mode.
- On success, the decoded token's `sub`/`username`/`role` are stored on the
  socket server-side (`socket.data.user`) and are the **only** source of
  truth for who is sending a message or attempting a moderation action for
  the lifetime of that connection. Every event handler re-derives identity
  from `socket.data.user`, never from the event payload — see "Never trust
  client input" below.

---

## Event contract

### Client → server

| Event | Payload | Description |
| --- | --- | --- |
| `chat:join` | `{ streamId: string }` | Join a stream's chat room. Server replies with `chat:history`. |
| `chat:leave` | `{ streamId: string }` | Leave a stream's chat room. |
| `chat:send` | `{ streamId: string, content: string }` | Send a chat message (must have joined first). |
| `chat:timeout` | `{ streamId: string, targetUserId: string, seconds: number }` | Moderator/streamer only — mutes a user in this channel's chat for N seconds (5–86400). |
| `chat:ban` | `{ streamId: string, targetUserId: string }` | Moderator/streamer only — permanently bans a user from this channel's chat. |
| `chat:unban` | `{ streamId: string, targetUserId: string }` | Moderator/streamer only — lifts a ban. |

### Server → client

| Event | Payload | Description |
| --- | --- | --- |
| `chat:message` | `ChatMessagePayload` | A new chat message. |
| `chat:error` | `{ code: ChatErrorCode, message: string }` | A rejected action (validation, auth, rate limit, ban, etc). |
| `chat:system` | `ChatSystemPayload` | Join/leave/timeout/ban/unban notices for the room. |
| `chat:history` | `{ streamId: string, messages: ChatMessagePayload[] }` | Sent once, right after a successful `chat:join`, with recent backlog. |

```ts
// packages/types/src/chat.ts (shared with the web client)
interface ChatMessagePayload {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  role: string;
  content: string;
  createdAt: string; // ISO 8601
}

type ChatErrorCode =
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'BANNED'
  | 'TIMED_OUT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

interface ChatSystemPayload {
  streamId: string;
  type: 'join' | 'leave' | 'timeout' | 'ban' | 'unban';
  message: string;
  targetUserId?: string;
  createdAt: string;
}
```

### Example flow

```
client → chat:join    { streamId: "abc123" }
server → chat:history { streamId: "abc123", messages: [...] }
server → chat:system  { streamId: "abc123", type: "join", message: "alice joined the chat", ... }

client → chat:send    { streamId: "abc123", content: "hey!" }
server → chat:message { id, streamId: "abc123", userId, username: "alice", role: "USER", content: "hey!", createdAt }
```

---

## Security

### Never trust client-supplied identity

`chat:send`, `chat:timeout`, and `chat:ban`/`chat:unban` DTOs deliberately
have **no** `userId`, `username`, or `role` field — there is nothing to
spoof because those fields don't exist on the client-facing contract at
all. Every broadcast message's `userId`/`username`/`role` is taken from
`socket.data.user`, populated once at connection time from the verified
JWT. Similarly, stream/channel ownership for moderation checks is always
looked up server-side from the database (`ChatService.getStreamContext`),
never taken from a client claim.

### Message validation

- `content`: 1–500 characters (`class-validator` `@MinLength`/`@MaxLength`
  on `SendMessageDto`), required, string.
- Unknown/extra fields on any payload are rejected outright
  (`forbidNonWhitelisted`) rather than silently dropped.
- Content is sanitized before broadcast/storage: control characters are
  stripped, interior whitespace runs are collapsed, and HTML-significant
  characters (`< > & " '`) are entity-escaped. This is defense in depth —
  the web client renders chat as plain text, never
  `dangerouslySetInnerHTML` — but messages are replayed far from where they
  were typed (Redis history, other users' browsers, potentially future
  surfaces), so escaping happens once at the point of broadcast rather than
  being re-implemented by every future consumer.

### Rate limiting & spam protection

Two independent, Redis-backed checks run on every `chat:send` (per
`userId`, not per-socket — so a user can't dodge the limit by reconnecting):

1. **Volume cap**: fixed 10-second window, max 5 messages
   (`CHAT_RATE_LIMIT_MAX_MESSAGES` / `CHAT_RATE_LIMIT_WINDOW_SECONDS` in
   `chat.constants.ts`). Implemented as `INCR` + `EXPIRE` on
   `chat:ratelimit:{userId}` — cheap, and good enough for chat (a small
   edge-case bucket-boundary burst is an acceptable trade for not needing a
   sorted-set sliding window). Exceeding it returns `chat:error` with
   `RATE_LIMITED`.
2. **Duplicate-content guard**: an identical message sent twice in a row by
   the same user within 3 seconds is rejected
   (`CHAT_DUPLICATE_WINDOW_SECONDS`), independent of the volume cap — this
   catches "spam one line repeatedly" abuse that a pure rate limit doesn't.

Both are process-independent (Redis-backed), so the limit holds even if a
user's messages land on different API instances across requests.

### Authorization

`chat:timeout`, `chat:ban`, `chat:unban` require the caller to be one of:

- a platform-wide `MODERATOR` or `ADMIN` (from the user's `role`), or
- the owning streamer of that channel (`Channel.ownerId === socket.data.user.id`).

Anyone else gets `chat:error` with `FORBIDDEN`. This check
(`ChatService.canModerate`) is server-side and re-evaluated on every
moderation event; there is no client-side "am I a mod" flag that's trusted.

---

## Moderation

Implemented now (minimum required for chat):

- **Ban** — permanent, until explicitly lifted with `chat:unban`. Checked on
  both `chat:join` and `chat:send`.
- **Timeout** — temporary (5s–24h, caller-specified), auto-expires via a
  Redis key TTL. Checked on `chat:send`.
- **Moderator role** — `Role.MODERATOR`/`Role.ADMIN` (existing platform-wide
  roles) plus per-channel "owner as implicit moderator" are both authorized
  to ban/timeout in that channel's chat.

Ban/timeout are scoped **per channel**, not per stream — a ban survives
across every stream that channel ever runs, not just the one the user was
banned during. This is deliberately different from where `ChatMessage`
lives in the Prisma schema today (keyed by `channelId`) but consistent with
it conceptually: chat is a property of the channel, streams are just when
it's "live."

Prepared but **not** implemented in this phase (flagged for a later pass,
not silently half-built):

- **Subscriber** status/badges — the `role` field is already broadcast on
  every message so the client can render a badge, and `ChatMessagePayload`
  has room to grow a `badges: string[]` field later, but there's no
  subscription/entitlement system yet to populate it from.
- Deleting/redacting an individual already-sent message.
- Per-message reporting/flagging.

### Why Redis, not Postgres, for ban/timeout state

Ban and timeout state (`ChatModerationService`) is stored only in Redis
(`chat:ban:{channelId}:{userId}`, `chat:timeout:{channelId}:{userId}`), not
as new Prisma models. Timeouts are inherently ephemeral (they're supposed
to expire — Redis `EXPIRE` gives that for free). Bans are the only
"permanent" piece here, which is a legitimate reason to reach for Postgres
instead — but moving them there is a small, isolated follow-up (one Prisma
model, one lookup swapped in `ChatModerationService`) that doesn't need to
block this phase, and keeping the enforcement path we already have to
build for timeouts uniform (both checks hit Redis) keeps `chat:join`/
`chat:send` simple. Revisit if bans need to survive a full Redis data-loss
event or need an audit trail/admin UI to browse — neither exists yet.

---

## Persistence decision

**Chat messages are not written to Postgres.** This was a deliberate choice,
not an oversight — the Prisma schema already has a `ChatMessage` model from
an earlier phase, and it is intentionally left unused by this gateway.

Reasoning:

- Chat is high-volume and low-value-per-row: a popular live stream can
  produce thousands of messages per hour, the overwhelming majority of
  which nobody will ever look up again once they've scrolled past. Writing
  every single one to Postgres is a write-amplification cost with very
  little to show for it.
- Nothing in the current product surface needs message history to outlive
  the stream by more than "a late-joining viewer can see the last few
  minutes of context." That's exactly what's implemented: a capped,
  auto-expiring buffer in Redis (`chat:history:{streamId}`, a list capped
  at 50 entries via `LPUSH`/`LTRIM`, with a 6-hour `EXPIRE` refreshed on
  every append) served back via `chat:history` on join.
- Redis is already a hard dependency for this feature (pub/sub for
  cross-instance fan-out, rate limiting, moderation state) — reusing it for
  recent history adds no new infrastructure.

What this trades away, on purpose: there is no permanent chat log, no
"scroll up to see what you missed an hour ago," and no way to run analytics
or moderation audits over historical chat content. If a future requirement
needs any of those (e.g. compliance retention, "most active chatters"
analytics, moderation appeals needing message evidence), that's a
deliberate, separate decision to make — most plausibly as an **opt-in,
sampled, or async-batched** write path (e.g. only persist messages that get
flagged/deleted, or batch-flush periodically) rather than making every
`chat:send` a synchronous Postgres write, to avoid reintroducing the
write-amplification problem this design avoided.

---

## Scaling & multi-instance delivery

Each API process holds **no chat state relevant to correctness** in memory
beyond Socket.IO's own local room bookkeeping (which sockets on *this*
process are in which room — that's unavoidable and fine, it's just local
delivery fan-out). Everything that needs to be consistent across instances
goes through Redis:

1. `chat:send` is validated, sanitized, and rate/spam-checked
   (`ChatService.publishMessage`), then:
   - `PUBLISH chat:stream:{streamId} <message json>`
   - appended to that stream's capped history list.
2. **Every** API instance — including the one that received the
   `chat:send` — runs a single dedicated Redis subscriber connection
   (`RedisService.createSubscriber()`, per the "pub/sub needs its own
   connection" note on that service) that `PSUBSCRIBE`s to `chat:stream:*`
   once at startup (`ChatGateway.afterInit`).
3. On receiving a `pmessage`, each instance emits `chat:message` (or
   `chat:system`) to its own locally-connected sockets in that stream's
   Socket.IO room (`server.to('stream:{streamId}').emit(...)`).

This means a viewer connected to instance B correctly receives a message
sent by a viewer connected to instance A — neither instance needs to know
anything about the other's connections, they only both need to reach the
same Redis. (Exercised directly in the "Redis pub/sub across multiple
server instances" test — see below.)

A single wildcard subscription (`chat:stream:*`) was chosen over dynamically
subscribing/unsubscribing to a specific stream's channel as viewers
join/leave. That avoids a class of race conditions (a message published
between "user joined the room" and "subscribe call actually completed")
and keeps the gateway simpler, at the cost of every instance receiving
pub/sub traffic for streams it may have zero local viewers for. That
trade-off is worth revisiting (per-stream dynamic subscribe) if chat volume
across many concurrent streams ever makes the wasted fan-out traffic a
measured problem — it isn't one yet.

System notices (`chat:system` for join/leave/timeout/ban/unban) go through
the exact same Redis pub/sub path (tagged `kind: "system"` on the wire) so
they're also correctly delivered to viewers on other instances, not just
the instance that triggered them.

---

## Testing

`apps/api/test/chat.e2e.spec.ts` runs the real Nest application (real
gateway, guards, DTO validation, JWT verification) over an actual
Socket.IO connection — no HTTP mocking — against in-memory stand-ins for
Postgres (`FakePrismaService`) and Redis (`FakeRedisService`), so the suite
needs no external infrastructure.

The Redis fake's pub/sub is backed by a single process-wide `EventEmitter`
shared by every fake client instance (`apps/api/test/utils/fake-redis.service.ts`),
so two independently-created `FakeRedisService`s — standing in for two
separate API processes pointed at the same real Redis — still see each
other's `PUBLISH`es, which is what makes the multi-instance test meaningful
rather than trivially passing.

Covered:

- **Connection**: accepts a valid token; the socket transitions to
  connected and stays connected.
- **Authentication**: rejects (with `chat:error UNAUTHENTICATED` +
  disconnect) both a missing token and an invalid/malformed one.
- **Joining a stream**: `chat:join` returns `chat:history`; joining a
  nonexistent stream returns `chat:error NOT_FOUND`.
- **Message delivery**: a message sent by one client is received by another
  client in the same room, with server-derived (not client-claimed)
  identity; HTML in content is escaped; over-length content is rejected;
  sending before joining is rejected (`FORBIDDEN`).
- **Redis pub/sub / multiple instances**: two full Nest applications are
  booted on separate ports in-process; a message sent by a client connected
  to instance A is received by a client connected only to instance B.
- **Rate limiting**: the 6th message inside the rate-limit window is
  rejected with `RATE_LIMITED` after 5 succeed.
- **Authorization**: an ordinary viewer attempting `chat:ban` gets
  `FORBIDDEN`; a platform `MODERATOR` and a channel owner (streamer) can
  both successfully ban/timeout.
- **Moderation enforcement**: a banned user is rejected at `chat:join`; a
  timed-out user is rejected at `chat:send` with `TIMED_OUT`.

Run with:

```
pnpm --filter @streamhub/api test:e2e
```
