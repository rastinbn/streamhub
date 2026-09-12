# Storage & VOD Architecture (Phase 9)

## Overview

```
LIVE broadcast (MediaMTX)
        │  runOnRecordComplete webhook
        ▼
Recording (finished file on the MediaMTX host)
        │  POST /api/v1/content/recordings/completed   (shared-secret guard)
        ▼
Object Storage abstraction  ──►  local disk (dev/self-hosted)
        │                        └─► S3-compatible (prod, drop-in later)
        ▼
VOD metadata row (Postgres, `vods` table) + REST API (/api/v1/content)
```

## Layer responsibilities

| Layer | Holds | Never holds |
| --- | --- | --- |
| MediaMTX | live ingest + recording files pre-ingest | metadata |
| Object storage | video binaries, thumbnails (`storageKey` → object) | metadata |
| Postgres `vods` | metadata only: id, streamId, channelId, title, description, thumbnail, storageKey, durationSeconds, views, visibility, timestamps | **video binary data** |

The `storageKey` (e.g. `vods/{channelId}/{streamId}/recording.mp4`) is
provider-opaque. URLs are resolved at read time by the active provider, so
migrating local-disk → S3 never rewrites database rows.

## Object storage abstraction

One interface — `ObjectStorageService` (apps/api/src/storage/) — with six
operations: `put`, `get`, `stream`, `resolveUrl`, `delete`, `exists`, `stat`.

- **Contract** lives in `object-storage.service.ts`. Business logic
  (`ContentService`) depends on the interface only, injected via the
  `OBJECT_STORAGE` DI token (explicit `@Inject`, since interfaces emit no
  runtime metadata).
- **Default provider**: `LocalObjectStorageProvider` — files under
  `.data/object-storage/` (gitignored, `STORAGE_LOCAL_ROOT` configurable),
  traversal-safe key resolution, served over HTTP by `MediaController`
  (`GET /api/v1/media/<key>`) with HTTP Range support for video seeking.
- **Adding S3 later**: implement the interface in
  `s3-object-storage.provider.ts` (upload via SDK, `resolveUrl` returns
  presigned URLs, `delete` idempotent) and register it under the same
  `OBJECT_STORAGE` token in `object-storage.providers.ts`, selected by
  `STORAGE_DRIVER` (already in the env schema). No business-logic or module
  changes anywhere else.

## Ingestion flow (recording → VOD)

1. OBS publishes to MediaMTX under the raw stream key (Phase 5 flow; the
   publish webhook flips the Stream row to LIVE).
2. MediaMTX finishes recording and fires `runOnRecordComplete` →
   `POST /api/v1/content/recordings/completed` (guarded by
   `MEDIAMTX_WEBHOOK_SECRET`, same as publish/unpublish).
3. `ContentService.ingestRecording`:
   - resolves the stream by the same SHA-256 key digest used at publish;
   - copies the file into object storage at
     `vods/{channelId}/{streamId}/{basename}`;
   - creates the `vod` row, **PRIVATE by default** — the owner reviews and
     publishes via `PATCH /api/v1/content/:id`.
   - Failure semantics: an unknown path or a storage error is logged and
     acknowledged 2xx — MediaMTX hooks must never be pushed into retry
     loops; the recording file remains on the MediaMTX host for re-ingest.

## Visibility model

| Visibility | In `GET /content` list | `GET /content/:id` by id |
| --- | --- | --- |
| `PUBLIC` | everyone | everyone |
| `UNLISTED` | only the owner (authenticated list) | anyone with the id |
| `PRIVATE` | only the owner | owner (and admins) only; others get **404**, not 403, so existence is not revealed |

View counting: non-owner reads increment `views`; owner reads never do.

## Ownership & access control

- The owner of a VOD is the owner of its channel (`channel.ownerId`),
  resolved server-side — never trusted from the request.
- `PATCH` / `DELETE /api/v1/content/:id` are owner-only (403 otherwise,
  401 unauthenticated, 404 unknown id). `storageKey`, `streamId`, and
  `views` are never client-editable.
- `DELETE` removes the metadata row first (DB is the source of truth), then
  deletes the stored object best-effort; an object-delete failure is logged
  for garbage collection rather than failing the request.

## Performance notes

- List endpoints are paginated and bounded (`limit ≤ 50`); queries hit
  indexes `vods(channelId, createdAt)` and `vods(visibility, createdAt)`.
- No per-request aggregation or N+1 joins: visibility filtering is a single
  indexed `WHERE`/`OR` clause; the count runs in the same `Promise.all` as
  the page query.
- With S3, media delivery is presigned URLs direct from the provider —
  the API node never proxies video bytes.

## Test mapping

`apps/api/test/content.e2e.spec.ts` (23 tests, in-memory
Prisma/Redis/storage doubles): listing visibility (anon/auth/other-user),
id-based access incl. UNLISTED semantics, PRIVATE hidden as 404, view
counting (non-owner counts, owner doesn't), metadata updates, immutability
of `storageKey`, ownership 403/401, deletion of row + stored object, and
webhook ingestion (storage write, PRIVATE default, secret guard, unknown
path no-op).
