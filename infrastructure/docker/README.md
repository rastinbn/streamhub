# infrastructure/docker

Reserved for future Dockerfiles for the `web` and `api` applications (production builds / containerized deployment).

For local development, `web` and `api` run directly on the host via `pnpm dev` — only stateful infrastructure (PostgreSQL, Redis, MediaMTX) runs in Docker. See the root `docker-compose.yml`.
