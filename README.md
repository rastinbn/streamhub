# StreamHub

A live streaming platform (independent branding, Twitch/Kick-style architecture) built as a pnpm/Turborepo monorepo.

> **Status:** Phase 1 — foundational scaffold only. No business features (auth, chat, follows, etc.) are implemented yet. See [Development Roadmap](#development-roadmap).

## Overview

StreamHub separates **application logic** (users, channels, chat, metadata) from **video delivery** (RTMP ingest, HLS playback). The backend never proxies video streams — it only manages the data and metadata around a stream.

## Architecture

```
Streaming flow (video):
  OBS --RTMP--> MediaMTX --HLS--> Browser (web player)

Application flow (data):
  Browser --> Next.js --> NestJS API --> PostgreSQL
                                     \--> Redis
```

The two flows are independent. The API is never in the video path. See [`docs/architecture.md`](./docs/architecture.md) for full detail.

## Tech Stack

| Layer            | Technology                          |
| ----------------- | ------------------------------------ |
| Monorepo          | pnpm workspaces + Turborepo          |
| Web               | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui |
| API               | NestJS, TypeScript                   |
| Database          | PostgreSQL + Prisma ORM              |
| Cache / real-time | Redis                                |
| Real-time         | WebSocket (planned, not yet wired)   |
| Streaming server  | MediaMTX (RTMP ingest, HLS output)   |
| Infrastructure    | Docker, Docker Compose, Nginx        |

## Repository Structure

```
streamhub/
├── apps/
│   ├── web/          # Next.js app (App Router placeholder routes)
│   ├── api/           # NestJS API (module placeholders)
│   └── streaming/      # Streaming layer representation (config lives in infrastructure/streaming)
├── packages/
│   ├── database/      # Prisma schema + client, shared with the API
│   ├── config/         # Shared, validated env schema (Zod)
│   ├── types/           # Shared TypeScript types (web/api/streaming)
│   ├── ui/               # Shared UI primitives (Button, Card, Modal, ...)
│   └── eslint-config/     # Shared ESLint configs
├── infrastructure/
│   ├── docker/        # Reserved for future app Dockerfiles
│   ├── nginx/           # Reverse proxy config (production reference)
│   └── streaming/        # MediaMTX configuration (RTMP/HLS)
├── docs/
│   └── architecture.md
├── scripts/
├── docker-compose.yml   # postgres, redis, mediamtx
└── .env.example
```

## Local Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`corepack enable` recommended)
- Docker + Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in real values as needed — defaults are fine for local development.

### 3. Start infrastructure (Postgres, Redis, MediaMTX)

```bash
docker compose up -d
```

### 4. Generate the Prisma client and run initial migration

```bash
pnpm db:generate
pnpm db:migrate
```

### 4.5. (Optional) Load fake data

```bash
pnpm db:seed
```

Populates categories, users, channels, live/finished streams, analytics, follows, and chat with deterministic fake data. Every seeded account uses password `password123` and is email-verified, so you can log in immediately (e.g. `luna@example.com`). Safe to re-run — it upserts by stable IDs and never duplicates or deletes existing rows.

### 5. Start the apps

```bash
pnpm dev
```

This runs `web` (http://localhost:3000) and `api` (http://localhost:4000/api/v1) in parallel via Turborepo.

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Key variables:

| Variable                | Purpose                                          |
| ------------------------ | ------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string                      |
| `REDIS_URL`                | Redis connection string                           |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Reserved for Phase 2 (auth)          |
| `RTMP_URL`                  | Public RTMP ingest URL (OBS target)             |
| `HLS_URL`                     | Public HLS playback URL (web player source)   |
| `STREAMING_SERVER_URL`          | Internal MediaMTX API address (health/metadata only) |
| `NEXT_PUBLIC_API_URL`             | API base URL consumed by the web app        |

## Docker Setup

`docker-compose.yml` starts only stateful infrastructure:

- `postgres` — port 5432
- `redis` — port 6379
- `mediamtx` — ports 1935 (RTMP), 8888 (HLS), 9997 (API)

The `web` and `api` apps run on the host via `pnpm dev` for fast local iteration. Containerizing them is left for a later deployment phase (see `infrastructure/docker`).

## How the Streaming Architecture Works

1. A streamer points OBS at the RTMP URL (`rtmp://localhost:1935/<stream-key>`).
2. MediaMTX accepts the RTMP publish and transcodes/repackages it into HLS (and eventually Low-Latency HLS).
3. The web player reads the HLS URL directly from MediaMTX — **not** through the NestJS API.
4. The API's role is limited to stream *metadata*: issuing stream keys, tracking live status, exposing channel/stream info to the web app. It never touches the media bytes.

This separation means the streaming layer can be scaled, replaced, or moved to a dedicated media infrastructure provider independently of the application backend.

## Development Roadmap

- **Phase 1 (this scaffold):** Monorepo structure, placeholder routes/modules, infrastructure wiring.
- **Phase 2:** Authentication (registration, login, sessions/JWT).
- **Phase 3:** Channels & stream metadata (stream keys, live status).
- **Phase 4:** Chat (WebSocket-based, Redis pub/sub for scaling).
- **Phase 5:** Following, notifications.
- **Phase 6:** Moderation tooling.
- **Phase 7:** Analytics.
- **Later:** VOD, recommendations, payments — out of scope for now.
