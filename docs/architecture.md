# StreamHub Architecture

## 1. Application Architecture

```
Browser
  │
  ▼
Next.js (apps/web)
  │  HTTP (REST, /api/v1)
  ▼
NestJS API (apps/api)
  │
  ├── PostgreSQL (via Prisma, packages/database)  — source of truth
  └── Redis                                          — cache, sessions,
                                                          pub/sub, presence
```

- **Web (`apps/web`)** never talks to PostgreSQL or Redis directly. It only calls the API over HTTP.
- **API (`apps/api`)** is a modular NestJS application. Each domain (auth, users, channels, streams, chat, follows, notifications, moderation, analytics) is its own module, currently empty placeholders, to be implemented phase by phase.
- **Database (`packages/database`)** is a shared Prisma package. The API imports it; the web app does not (and should not) import it directly, keeping DB access confined to the API layer.

## 2. Streaming Architecture

```
OBS
  │
 RTMP (push)
  │
  ▼
MediaMTX (infrastructure/streaming, run via Docker)
  │
 HLS / Low-Latency HLS (pull)
  │
  ▼
Browser (web player)
```

- OBS connects **directly** to MediaMTX over RTMP (port 1935). This connection does not go through Next.js or NestJS.
- MediaMTX repackages the incoming RTMP stream into HLS segments, served on port 8888.
- The web player fetches HLS directly from MediaMTX (or through Nginx in a production deployment) — again, never through the API.
- Low-Latency HLS is configured (`hlsVariant: lowLatency` in `mediamtx.yml`) so the platform is ready to tune segment/part durations for latency as the product matures.

## 3. Data Flow

Two flows exist side by side and only interact at the metadata boundary:

1. **Control-plane flow (data):** Streamer/viewer actions (start stream, view channel, chat) flow through the web app to the API to Postgres/Redis. This is where stream keys are issued, stream status is recorded, and channel data lives.
2. **Media-plane flow (video):** The actual video bytes flow from OBS to MediaMTX to the browser, entirely outside of the API/Postgres/Redis path.

In later phases, the two flows will connect at specific integration points — for example, MediaMTX calling back to the API to validate a stream key before allowing a publish, or to notify the API when a stream starts/stops so `Stream.status` can be updated. These integration points are deliberately not implemented yet (Phase 1 is structure-only), but the architecture (isolated `mediamtx.yml`, a `streams` module placeholder, a `STREAMING_SERVER_URL` env var for the API to reach MediaMTX's introspection API) is already in place to support them.

## 4. Responsibilities of Each Service

| Service      | Responsibility                                                                 | Does NOT do                                  |
| ------------ | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Next.js (web)**  | Rendering UI, calling the API, client-side auth state                     | Direct DB access, video transcoding/proxying    |
| **NestJS (api)**    | Auth, users, channels, stream metadata, chat, follows, notifications, moderation, analytics | Proxying or transcoding video               |
| **PostgreSQL**       | Durable, relational source of truth for all application data          | Caching, real-time pub/sub                       |
| **Redis**              | Caching, session storage where appropriate, pub/sub, presence, real-time infra | Long-term persistence                        |
| **MediaMTX (streaming)** | RTMP ingest, HLS/LL-HLS output                                     | Authentication, business logic, chat            |

## 5. Why the API Does Not Proxy Video

Several architectural reasons drive keeping video traffic out of the NestJS API:

1. **Scalability.** Video bandwidth and application request load scale very differently. Coupling them would force scaling the API for reasons unrelated to business logic (e.g., a spike in concurrent viewers).
2. **Latency.** Adding an extra hop through a general-purpose application server for every video segment increases latency, which is directly at odds with the goal of eventually supporting Low-Latency HLS.
3. **Resource isolation.** Media processing (transcoding, packaging) is CPU/bandwidth-intensive in ways that differ sharply from typical API workloads (DB queries, JSON responses). Isolating them prevents one from starving the other.
4. **Independent scaling & replacement.** Because MediaMTX is fully decoupled, it can be replaced with a different streaming server, moved to a managed media service, or horizontally scaled independently — without touching the API's codebase or deployment.
5. **Simplicity of the API's contract.** The API's job stays clean: manage metadata and state. It issues stream keys and exposes "is this channel live," but never becomes responsible for the mechanics of moving video bytes.
