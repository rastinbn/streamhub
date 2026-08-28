# StreamHub — Development Rules

Engineering conventions for the StreamHub monorepo. These rules keep the codebase
consistent, the architecture boundaries intact, and the UI faithful to its design
system. Read `docs/architecture.md` and `docs/ui-contract.md` alongside this file.

---

## 1. Monorepo & Tooling

- **Package manager:** `pnpm`. Use `pnpm` workspaces; never `npm install` at the root
  for workspace packages.
- **Build orchestration:** `turbo`. Run cross-package tasks via `turbo` (e.g.
  `pnpm turbo build`, `pnpm turbo lint`, `pnpm turbo typecheck`).
- **Workspace packages:**
  - `apps/web` — Next.js 14 (App Router) frontend.
  - `apps/api` — NestJS API.
  - `packages/database` — shared Prisma client (imported by the API only).
  - `packages/ui` — shared `@streamhub/ui` React primitives.
  - `packages/types`, `packages/config`, `packages/eslint-config` — shared types/config.
- **Node/TS:** TypeScript everywhere. No `any` in committed code without a reason.

## 2. Architecture Boundaries (hard rules)

1. **Web never touches the database or Redis directly.** `apps/web` calls only the
   NestJS API over HTTP (`/api/v1`). It MUST NOT import `packages/database`.
2. **API owns all data access.** The API imports `packages/database` (Prisma) and
   Redis. Web receives DTOs/JSON, never Prisma models.
3. **The API never proxies or transcodes video.** Media flows
   OBS → MediaMTX (RTMP) → HLS → browser, entirely outside the API. The API only
   manages stream *metadata* (keys, status, "is live").
4. **Streaming server reachability** is via the `STREAMING_SERVER_URL` env var
   (MediaMTX introspection), not hardcoded hosts.

## 3. Frontend Rules

- **Framework:** Next.js App Router (`src/app`). Server Components by default; mark
  interactive components `'use client'`.
- **Styling:** Tailwind CSS. **Only use tokens defined in `tailwind.config.js`**
  (sourced from `UI/streamhub/DESIGN.md`). No ad-hoc hex/rgba in JSX.
- **UI library:** shadcn/ui, configured via `apps/web/components.json`. Add new
  primitives through the shadcn workflow into `apps/web/src/components` or
  `packages/ui`; keep the `@streamhub/ui` primitive surface stable.
- **Components:**
  - App/feature components → `apps/web/src/components` (alias `@/components`).
  - Cross-app primitives → `packages/ui` (alias `@streamhub/ui`).
  - Reuse `StreamCard`, `NavItem`, `MainNav`, `FollowedChannel` before duplicating.
- **Class composition:** use `cn(...)` (`apps/web/src/lib/utils.ts`).
- **Icons:** `lucide-react`. **Mono metadata:** `label-*` Tailwind tokens.
- **Fonts:** `Inter` + `JetBrains Mono` via `next/font` (already in `layout.tsx`).
- **Do not redesign.** Implement pages to match `UI/streamhub_<route>/screen.png`
  (see `docs/ui-contract.md`). No generic templates; no invented sections.
- **Route placeholders:** pages that are not yet built should render the
  `RoutePlaceholder` pattern (route + description). Keep them until the real page is
  implemented from its reference image.

## 4. Naming & Structure Conventions

- **Routes:** kebab-case folders; dynamic segments as `[param]` (e.g.
  `channel/[slug]`, `watch/[streamId]`).
- **Components:** PascalCase files, default-exported React components; co-locate
  `Props` interfaces (`export interface XProps`).
- **API modules:** one NestJS module per domain under `apps/api/src/modules`
  (`auth`, `users`, `channels`, `streams`, `chat`, `follows`, `notifications`,
  `moderation`, `analytics`). Each module is self-contained (controller/service/module).
- **Database:** one Prisma `model` per aggregate root in `packages/database/prisma/
  schema.prisma`. Use `@@map` for table names; enums for fixed sets (e.g.
  `StreamStatus`).

## 5. State, Data & Real-time

- **Client auth/session state:** managed in `apps/web`; never persisted secrets to
  the client.
- **Real-time (chat, presence, live status):** WebSocket + Redis pub/sub, brokered
  by the API. The browser connects to the API's WebSocket, **not** to MediaMTX, for
  chat/presence.
- **Caching:** Redis for cache/sessions/pub-sub/presence; PostgreSQL is the durable
  source of truth.

## 6. Quality Gates (run before committing)

- `pnpm turbo lint` — ESLint via `@streamhub/eslint-config`.
- `pnpm turbo typecheck` — `tsc --noEmit` in each package/app.
- `pnpm turbo build` — Next.js build + NestJS build must pass.
- Prettier is configured (`.prettierrc.json`); format before commit.

## 7. Environment & Config

- Copy `.env.example` → `.env` per package. Never commit real secrets.
- Database URL lives in `packages/database/.env` (Prisma).
- Local infra (Postgres, Redis, MediaMTX, Nginx) is provided via
  `docker-compose.yml` and `infrastructure/`.

## 8. Phase Discipline

- This is a **structure-first** build. Domains are placeholder modules; relationships
  and business rules are refined per-phase, not all at once.
- When implementing a domain, do it end-to-end within its module boundary and update
  `docs/domain-model.md` if the model changes.
- If a UI reference is missing for a route (e.g. dashboard surfaces), do not finalize
  its visuals — keep a placeholder and flag the gap.
