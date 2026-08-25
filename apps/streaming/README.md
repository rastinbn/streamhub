# apps/streaming

This directory represents the **streaming infrastructure layer** in the monorepo's app graph. It is intentionally not a custom server implementation.

The actual runnable configuration for the streaming server (MediaMTX) lives in [`/infrastructure/streaming`](../../infrastructure/streaming) and is started via the root `docker-compose.yml`.

This package exists so that:

- The streaming layer is represented explicitly in the monorepo (`apps/streaming`), matching the architecture diagram (OBS → RTMP → Streaming Server → HLS → Web Player).
- Future scripts or tooling specific to the streaming layer (health checks, stream-key validation helpers, load testing scripts, etc.) have an obvious home.
- The streaming layer can be swapped or scaled independently from the API and web apps without restructuring the repo.

## Why no code here yet

MediaMTX is used as-is via Docker; there is no custom server code to write for Phase 1. See [`infrastructure/streaming/mediamtx.yml`](../../infrastructure/streaming/mediamtx.yml) for the RTMP ingest / HLS output configuration.
