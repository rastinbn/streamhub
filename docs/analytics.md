# Analytics (Phase 8)

Streamer analytics for stream sessions: viewers, peak viewers, average
viewers, views, followers gained, stream duration and watch time. Backend
only; the web dashboard is a separate phase.

## Architecture in one paragraph

Viewer heartbeats are **never** written to Postgres. They touch Redis only
(presence keys + a few counters). A background pipeline samples each live
stream's Redis presence set every ~30 seconds and folds the samples into
Postgres as `viewer_metrics` rows plus one pre-aggregated
`stream_analytics` row per stream. All analytics reads (`/analytics/*`)
sum those pre-aggregated rows — nothing expensive is recomputed per
request, there are no N+1 queries, and every list/timeline response is
bounded.

```
player ──heartbeat every ~20-30s──▶ Redis presence (TTL 60s)
                                        │ (no Postgres!)
                flush timer (~30s) / unpublish
                                        ▼
            ViewerMetric rows + pre-aggregated StreamAnalytics row
                                        ▼
              GET /analytics/{overview,streams,streams/:id,viewers}
```

## Postgres model

- **`stream_analytics`** — one row per stream (`streamId` unique), created
  when a broadcast goes LIVE, updated every flush and finalized on
  unpublish. Carries `durationSeconds`, `watchTimeSeconds`, `totalViews`,
  `peakViewers`, `averageViewers`, `followersGained`. `channelId` /
  `startedAt` / `endedAt` are denormalized copies of `Stream` fields so
  channel-scoped overview/list queries hit this single small table
  (`@@index([channelId, startedAt])`) instead of joining through `streams`.
- **`viewer_metrics`** — one row per stream per flush (a 24h broadcast at a
  30s flush rate ≈ 2.9k rows), powering the per-stream "viewers over time"
  timeline and watch-time accumulation. Indexed
  `@@index([streamId, sampledAt])`.

No new "StreamSession" table was added: `Stream` rows *are* sessions
(created per broadcast, `LIVE` → `ENDED`), so analytics hang off the
existing lifecycle.

## Redis key layout (all ephemeral, all TTL'd or cleaned up on unpublish)

| Key | Type | Purpose |
| --- | --- | --- |
| `analytics:live` | hash `streamId → channelId` | every currently-LIVE stream; heartbeat fast-path + flush enumeration |
| `analytics:presence:<streamId>:<viewerId>` | string, TTL 60s | presence key per viewer; `SET NX EX` returns OK only on a **fresh** join |
| `analytics:views:<streamId>` | counter | total join sessions |
| `analytics:current:<streamId>` | counter | drift-tolerant live count (see below) |
| `analytics:peak:<streamId>` | counter | peak concurrent viewers |
| `analytics:watch:<streamId>` | counter | accumulated watch-seconds |
| `analytics:lastflush:<streamId>` | ms timestamp | baseline for watch-time accrual |

### Heartbeat (what a player does)

`POST /analytics/streams/:id/heartbeat { viewerId }` — public (guests
count), pure Redis:

1. `SISMEMBER`-equivalent check of `analytics:live`; if the stream isn't
   registered there, fall back to a Postgres status read and self-heal the
   hash if the stream is genuinely LIVE.
2. `SET analytics:presence:<id>:<viewerId> 1 EX 60 NX` — if the key was
   fresh (OK), the viewer just (re)joined: `INCR views`, `INCR current`
   and opportunistically raise `peak`.

A heartbeat for an existing but non-LIVE stream returns
`{ accepted: false }` (still a 201, not an error — a player whose
broadcast ended shouldn't spam 4xx traffic). An unknown stream id is a
404.

`current` is only ever incremented (expired presence keys don't decrement
it), so it *drifts high* between flushes; the flush overwrites it with the
true scanned presence count each tick, bounding the drift to one flush
window. This is what makes per-join peak updates cheap while keeping
counts honest.

## Flush pipeline

- Timer (interval `ANALYTICS_FLUSH_INTERVAL_MS` = 30s) enumerates
  `analytics:live`, and for each stream:
  1. SCANs the stream's presence keys → current viewer count.
  2. Inserts one `viewer_metrics` row (sampledAt = now).
  3. Accrues watch-seconds: `viewers × seconds-since-last-flush`.
  4. Upserts `stream_analytics` (partial duration / watch / views / peak /
     average for live dashboards) and refreshes `stream.viewerCount`.
- Unpublish / revoke-while-live triggers `registerStreamEnd`, which takes
  one final sample, counts followers gained during the broadcast
  (`follows` created between `startedAt` and `endedAt`), persists the final
  numbers, zeroes `stream.viewerCount` and tears down the stream's Redis
  keys.
- The timer is disabled under `NODE_ENV=test`; tests drive `flushNow()`
  explicitly.

### Metric definitions

| Metric | Definition |
| --- | --- |
| viewers | current concurrent presence (Redis) |
| views | join sessions (first heartbeat after presence expired) |
| peak viewers | max concurrent presence; tracked in Redis per join and re-derived from each flush sample |
| watch time | Σ over flush intervals of `viewers × interval` (viewer-seconds) |
| stream duration | `endedAt − startedAt` |
| average viewers | watch time ÷ duration (duration-weighted across streams in overviews) |
| followers gained | new `follows` rows created while the stream was live |

Failures in the analytics hooks never break the streaming control plane:
`StreamsService` wraps the lifecycle calls and logs-and-continues (a missed
flush self-corrects on the next tick; finalization retries on the next
unpublish path).

## API (streamer-only reads)

All four reads require a Bearer token and resolve the caller's own channel
(`Channel.ownerId`) first — a streamer can only ever see their own
analytics (403 for someone else's stream, 404 for a nonexistent one).

| Method | Path | Description |
| --- | --- | --- |
| POST | `/analytics/streams/:id/heartbeat` | public viewer presence ping |
| GET | `/analytics/overview?days=30` | channel totals/averages/peaks over the trailing window (1–90 days) |
| GET | `/analytics/streams?page=&limit=` | paginated per-stream analytics |
| GET | `/analytics/streams/:id` | one stream's analytics (+ live current viewers) |
| GET | `/analytics/viewers?streamId=` | per-stream viewer timeline, minute-bucketed (hour buckets for >48h streams), hard-capped at 480 points |

Performance notes:

- Overview = one `aggregate` over `stream_analytics` (indexed range) +
  presence scans only for the channel's currently-live streams.
- List = one indexed `findMany` + `count`, newest first; `currentViewers`
  is merged per live row via one presence scan.
- Detail = two point lookups (+ one presence scan when live).
- Timeline = the single stream's own samples (bounded by flush rate ×
  duration), folded in O(n), capped to ≤480 points.

## Scaling / operational notes

- Multi-instance deployments: every heartbeat/counter is Redis-side, so
  ingestion scales horizontally. The flush timer should run on **one**
  instance (or use a leader lock); running it on several only doubles
  sample density, never corrupts totals, because every write is an
  idempotent upsert/append.
- `viewer_metrics` grows with streaming minutes. Retention (e.g. dropping
  samples older than 90 days after `stream_analytics` is finalized) is a
  deliberate future policy, not implemented yet.
- If Redis restarts mid-broadcast, presence is lost until viewers
  heartbeat again and `analytics:live` self-heals from the DB on the next
  heartbeat; watch-time accrual restarts from `startedAt`, so only one
  flush window is under-counted.
