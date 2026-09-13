# Frontend ↔ Backend Integration Audit

> **Status: integration pass complete.** The backend API (`apps/api`, NestJS +
> Prisma + Postgres/Redis) is the source of truth; the frontend is `apps/web`
> (Next.js App Router + TS). Shared contract types live in `packages/types`.
> Every gap found was either fixed, or explicitly documented as out of MVP
> scope in §4 — nothing is faked.

---

## 1. Architecture summary

- REST base: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`), all
  responses follow `{ success, data } | { success: false, error: { code, message } }`.
- WebSocket: Socket.IO namespace `/chat` on the API origin (`docs/websocket.md`).
- HLS is served **directly by MediaMTX** (`{NEXT_PUBLIC_HLS_URL}/{playbackPath}/index.m3u8`);
  NestJS never proxies video.
- Docker (`docker-compose.yml`) runs only stateful infra (Postgres, Redis,
  MediaMTX); the apps run on the host via `pnpm dev`.

## 2. Connected features (verified working end-to-end)

| Feature | Frontend | Backend | Status |
| --- | --- | --- | --- |
| Auth register/login/refresh/logout/verify-email | `auth-context.tsx`, `lib/api/auth.ts` | `auth.controller` | ✅ |
| Session rehydration on page refresh | localStorage refresh token → `/auth/refresh` rotation | `token.service` | ✅ |
| Become-streamer upgrade (token re-issue) | `become-streamer/page.tsx` | `POST /users/me/become-streamer` | ✅ |
| Profile update | `useUpdateProfile`, settings pages | `PATCH /users/me` | ✅ |
| Channel create/edit/follow/unfollow/followers | `create/page.tsx`, `dashboard/settings`, watch + channel pages | `channels.controller` | ✅ |
| Stream create/update/rotate-key/revoke-key/status | `create/page.tsx`, `dashboard/stream` | `streams.controller` | ✅ |
| Live browse + category browse + sort/pagination | `browse`, home `HomeFeed`, `categories/[slug]` | `GET /streams(/live)` | ✅ |
| Channel page (public) | `channel/[slug]` | `GET /channels/:slug` | ✅ |
| Watch page + HLS player + status polling + live refetch | `watch/[channel]/[streamId]`, `VideoPlayer` (hls.js) | `streams.controller`, MediaMTX | ✅ |
| Realtime chat (join/leave/send/history, errors, rate-limit, moderation events, viewer/follower counts) | `useWatchChat`, `lib/chat.ts` | `chat.gateway` (JWT handshake, Redis pub/sub) | ✅ |
| Viewer heartbeat → Redis presence | `useViewerHeartbeat` | `POST /analytics/streams/:id/heartbeat` | ✅ |
| Streamer dashboard: overview, analytics, VOD manager, stream tools, channel settings | `dashboard/*` | analytics + content + streams + channels modules | ✅ |
| Admin overview/users/channels/streams/categories | `admin/*` | `admin.controller` (ADMIN-only) | ✅ |
| Categories management (admin CRUD) | `admin/categories` | `categories.controller` | ✅ |
| Content recording webhook (MediaMTX → VOD) | n/a (server-to-server) | `content.controller` | ✅ |
| Media playback (Range requests, local storage) | `dashboard/content` links | `media.controller` | ✅ |
| Followed-channels sidebar | `FollowedChannels` | `GET /users/me/following` | ✅ (a stale "no backend support yet" branch was removed) |

## 3. Gaps found → fixes implemented in this pass

| # | Gap | Fix |
| --- | --- | --- |
| 1 | **Reports had zero frontend** (backend Phase 10 fully built: submit + admin queue + triage, audit-logged). | New `lib/api/reports.ts`, "Report" action on watch page (MoreVertical menu → POST /reports), new `/admin/reports` page with status filter, pagination, REVIEWING/RESOLVED/DISMISSED triage; `AdminNav` + `AdminRequired` updated (moderators see Reports tab). |
| 2 | **Access token expiry mid-session** silently failed every authenticated call (15-min TTL; refresh only ran on page reload). | `lib/api/client.ts` now retries once through `authApi.refresh` on 401 via an injected refresher (registered by `auth-context`), with single-flight so concurrent 401s share one refresh; original request replayed with the new token. |
| 3 | **`GET /users/:username` did not expose the user's channel** (the endpoint existed but returned public fields only, so the profile page rendered a placeholder instead of linking to the real channel). | Endpoint enriched to embed the user's `channel` (public shape) — one round trip, two indexed lookups; profile page now renders the real channel card + "Visit channel" link, or an honest empty state. Covered by 2 e2e tests. |
| 4 | **Fake notifications bell** — hardcoded red dot and "1 unread" aria-label with no backend. Backend has a `notifications` table but no feature. | Bell honestly disabled in `TopNav` (title "Not available yet", no fake unread dot). Do not fabricate data; the notifications domain is explicitly out of MVP scope (see §4). |
| 5 | **Dead search box** — TopNav search had no handler, and the browse page ignored URL queries. | Desktop + mobile search submit to `/browse?q=…`; the browse page reads `q` from the URL, shows a results indicator with a clear action, seeds its own (also server-backed) search box, and passes `search` to the backend (`GET /streams?search=` — exact contract name). |
| 6 | **Profile page placeholder copy** ("will appear here once the channel profile page is built") while the endpoint already returned the fields needed. | See #3 — real channel card now rendered from the backend response; no placeholder text remains. |
| 7 | **`Vod.streamId` contradiction** — schema had `onDelete: SetNull` on a **required** column; `VodPublic` type said "null if the source stream row was hard-deleted"; an uncommitted `rastin` migration had papered over it by making the column NOT NULL (contradicting the design and breaking admin stream hard-delete → VOD survival). | Schema corrected (`streamId String?` + `onDelete: SetNull`), a proper migration replaces the `rastin` one, client regenerated, types already matched. |
| 8 | **Stale duplicate `components/layout/Navbar.tsx`** (mobile nav with dead buttons, unused by the App Router shell). | Deleted. |
| 9 | **`.env.example` missing the web-facing streaming vars** the frontend actually reads (`NEXT_PUBLIC_HLS_URL`, `NEXT_PUBLIC_RTMP_URL`). | Added with docs. |
| 10 | **Follow/subscribe UI cruft** — dead "Subscribe" button and `stream.streamer.verified` star with no backend concept; the ⋯ menu had no handler. | Removed from watch `StreamInfo` (no fabricated features); the ⋯ menu now opens a real **Report** action. |

## 4. Known non-goals / remaining work (documented, not faked)

- **AI support chat** — does not exist on either side; nothing to connect. If it
  is built, the NestJS-mediated architecture from the brief applies.
- **Stream-page layout builder** — does not exist on either side; nothing to
  connect (localStorage-only drafts were never implemented either).
- **Notifications domain** — backend has a `Notification` model + placeholder
  module but no endpoints; frontend has no page. Out of MVP scope.
- **`/profile/[username]` is server-rendered** without the viewer's auth header
  (fine for public data; the page shows only public fields).
- CORS/websocket origins default to `http://localhost:3000`; Docker-in-network
  deployment of the apps themselves is intentionally out of scope for this repo
  layout (apps run on host per `docker-compose.yml` notes).

## 5. Final verification (post-remediation)

- `tsc --noEmit`: API ✅, web ✅
- API test suite: **231/231 passing across 17 suites** (2 new profile-embed tests)
- `next build`: ✅ (28/28 pages)
- `nest build`: ✅
- Lint: web ✅ (pre-existing `<img>` advisory warnings only); API has 6
  pre-existing lint errors in the expression-style logger and the chat
  sanitize control-char regex — reviewed, intentional, untouched (RULE 1).
- Migration `20260913053946_vod_stream_nullable` deployed to the running
  database; Prisma client regenerated.
- Final mock/fake/TODO/FIXME/console.log scan: clean — remaining `mock`
  occurrences are Vitest spies in a unit test; `placeholders.ts` holds only
  neutral image/text fallbacks, not fake application data.

## 6. Contract consistency checks performed

- Every frontend call in `lib/api/*.ts` was diffed against the corresponding
  backend controller route, method, DTO and response wrapper — all match.
- WebSocket event names/payloads (`chat:join/leave/send/history/message/system/error`,
  `viewer-count`, `follower-count`) match `docs/websocket.md` and the gateway
  implementation; identity always derives from the verified JWT.
- Roles: backend enforces `USER ≠ STREAMER ≠ MODERATOR ≠ ADMIN` via
  `JwtAuthGuard` + `RolesGuard` everywhere; frontend gating (AdminRequired,
  StreamerRequired, chat mod tools) is UX-only by design.
- Pagination envelope (`items/total/page/limit`) consistent across all list
  endpoints and the web `PaginatedResult` type.
