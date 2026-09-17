# Viewer Points & Meme Sounds (Phase 12)

Viewers earn **points** by watching streams and chatting. Streamers upload
short **meme sounds**; a viewer plays one in chat by paying the sound's
price, and every viewer in the room hears it. Points are an engagement
currency with **no cash value** — there is no purchase path.

```
Watch stream (signed in)          Chat
   ↓ heartbeat + Bearer           ↓ chat:send (accepted)
analytics shadow presence         ↓
   ↓ flush pipeline (30s)     PointsService.awardForChat (window-capped)
PointsService.awardWatchTime       ↓
   ↓                               ↓
Postgres: points_wallets + points_ledger (append-only)
   ↑ spend
chat:play-meme → MemesService.play → debit → chat:meme broadcast → everyone plays audio
```

## Points

- **Wallet** (`points_wallets`): one per user, created lazily on first
  award. Holds `balance`, `totalEarned`, `totalSpent`.
- **Ledger** (`points_ledger`): append-only source of truth. Every change
  writes a row with the signed `delta` and `balanceAfter`; there is no
  update/delete path. A wallet balance is always reconstructible by
  summing the ledger.
- **Atomicity**: debits use a conditional `updateMany ... WHERE balance = X`
  (optimistic concurrency) instead of interactive transactions, so the
  logic is portable to the test fake and race-safe against double-spend.
  Insufficient funds raise `ForbiddenException` (HTTP 403).

### Earning rules

| Source | Rate | Cap | Where implemented |
| --- | --- | --- | --- |
| Watch time | 1 pt per full minute | — | `PointsService.awardWatchTime`, driven by the analytics flush pipeline (30s cadence); sub-minute remainders carry over in Redis (`points:watchacc:<userId>`) |
| Chat message | 1 pt per accepted message | 5 per 60s rolling window (Redis fixed-window counter) | Chat gateway after `chat:publishMessage` succeeds |
| Meme play | — (spend side) | price set by the streamer (0–10 000) | `MemesService.play` |
| Admin adjust | manual | — | future admin tooling (`ADMIN_ADJUST` reason reserved) |

Watch-time points only accrue for **signed-in** viewers: the heartbeat is
public (guests count toward viewer analytics), but when it carries a valid
`Authorization: Bearer` the controller also records a *shadow* presence key
(`points:presence:<streamId>:<userId>`, same 60s TTL). The flush pipeline
scans that namespace per live stream and awards `interval` seconds per
present viewer. Invalid tokens are silently treated as anonymous — the
heartbeat never fails on auth.

Chat awards emit a `points:awarded` socket event to the sender
(`{ amount, reason: 'CHAT_MESSAGE' }`) so the UI can show a toast.

## Meme sounds

- **Model** (`meme_sounds`): metadata only — audio lives in object storage
  under `memes/{channelId}/{uuid}.{ext}` via the same provider-agnostic
  `ObjectStorageService` as thumbnails/VODs (local disk in dev, S3-ready).
  **Audio never enters Postgres.**
- **Upload**: `POST /memes` (owner-only; channel derived from the JWT, base64
  JSON body like thumbnails). Hard cap 512 KB, formats mp3/wav/ogg/m4a.
- **Management**: `GET /memes/mine`, `PATCH /memes/:id` (title/price/active),
  `DELETE /memes/:id` (removes the stored object too). Ownership is resolved
  server-side; a non-owner gets 404 (no existence leak).
- **Board**: `GET /memes/channels/:channelId` is public and lists **active**
  sounds only, never exposing `storageKey`.

### Playing a sound

`chat:play-meme` (socket, must have joined the room, not banned):

1. Gateway validates the DTO + room membership + ban state.
2. `MemesService.play` resolves the sound server-side, checks it belongs to
   the stream's channel and is active, then **debits points first** — a
   failed payment means no play (403 `FORBIDDEN`).
3. `playCount` increments; a `chat:meme` payload (`id, streamId, soundId,
   title, soundUrl, username, playedAt`) is published through the same Redis
   pub/sub channel as chat messages, so **every** API instance delivers it.
4. Each connected client plays `soundUrl` once via `MemeAudioPlayer`
   (autoplay-blocked attempts are skipped silently — the click on the board
   is a user gesture for the initiating client; remote clients may miss
   audio until they interact with the page, which browsers require).

`soundUrl` is `/api/v1/media/<key>` in dev (range-streamed by MediaController)
or a presigned URL once an S3 provider is registered — clients treat it as
opaque.

## API summary

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/points/me` | Bearer | Wallet + paginated ledger |
| POST | `/memes` | Bearer (owner) | Upload a sound |
| GET | `/memes/mine` | Bearer (owner) | List own sounds (incl. inactive) |
| GET | `/memes/channels/:channelId` | — | Active sounds for the chat board |
| PATCH | `/memes/:id` | Bearer (owner) | Update title/price/active |
| DELETE | `/memes/:id` | Bearer (owner) | Delete sound + object |

Socket: client `chat:play-meme { streamId, soundId }` → server
`chat:meme MemePlayPayload`; server `points:awarded` to the earner.

## UI surfaces

- **TopNav**: live balance chip (→ `/points`), light/dark toggle.
- **`/points`**: balance cards + ledger history with pagination.
- **Chat panel**: 🔊 meme board popover (prices, affordability lock), and a
  "+N points" toast on chat awards.
- **`/dashboard/memes`** (streamer): upload/price/hide/delete sounds.

## Theming (shipped alongside)

All color tokens moved from hard-coded Tailwind hex values to CSS variables
(`--md-*` in `globals.css`; `:root` = dark, `.light` = light). The
`tailwind.config.js` palette maps every utility (`bg-surface-container`,
`text-on-surface`, …) to `var(--md-…)`, so the theme is one class on
`<html>`. `ThemeProvider` persists the choice (`streamhub.theme` in
localStorage) and an inline before-paint script applies it on load (also
honoring `prefers-color-scheme` on first visit) — no flash of the wrong
theme. Components need no theme branches as long as they use theme
utilities.

## Testing

- `test/points-memes.e2e.spec.ts` — wallet isolation, lazy zero wallet,
  ledger ordering, auth/ownership boundaries on all meme CRUD, 404
  (not 403) for cross-owner access, size/format validation, active-only
  public board, `storageKey` never leaked publicly.
- The fake Prisma implements `pointsWallet.updateMany` (conditional balance
  check) so the concurrency-sensitive debit path is genuinely exercised.
