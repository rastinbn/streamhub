# StreamHub — UI Contract

This document is the **visual source of truth contract** for the StreamHub frontend.
It defines how the provided UI reference images map to application routes, which
reusable components to build from, which design tokens to use, and the rules every
future page must obey.

> **Golden rule:** The PNG reference images and `UI/streamhub/DESIGN.md` are the
> visual source of truth. The running UI must visually match the references as
> closely as practical. Do **not** replace the provided design with a generic
> template or your own design.

---

## 1. UI Reference Directory

All references live under the `UI/` directory at the repository root.

```
UI/
├── streamhub/                    ← Design system specification (DESIGN.md)
│   └── DESIGN.md                 ← Canonical tokens, typography, layout rules
├── streamhub_home/               ← Home                → screen.png
├── streamhub_browse/             ← Browse              → screen.png
├── streamhub_categories/         ← Categories          → screen.png
├── streamhub_codeninja_s_channel/← Channel ([slug])    → screen.png
├── streamhub_following/           ← Following           → screen.png
├── streamhub_login/              ← Login               → screen.png
├── streamhub_pixelmaster_s_profile/ → Profile          → screen.png
├── streamhub_sign_up/            ← Sign up / Register  → screen.png
└── streamhub_watch_live/         ← Watch (live)        → screen.png
```

Each page reference is a single `screen.png` inside a folder named `streamhub_<route>`.
There is **no** image for the creator dashboard surfaces (`/dashboard`,
`/dashboard/analytics`, `/dashboard/content`, `/dashboard/settings`,
`/dashboard/stream`); those routes exist as code placeholders but have **no**
reference image yet and must not be visually finalized until references are added.

---

## 2. Page-to-Image Mapping

| Reference folder | Route | Implemented? | Notes |
| --- | --- | --- | --- |
| `streamhub_home/screen.png` | `/` | Partial (nav only) | Landing / live discovery grid |
| `streamhub_browse/screen.png` | `/browse` | Partial | Filter bar + responsive stream grid (see `browse/page.tsx`) |
| `streamhub_categories/screen.png` | `/categories` | Placeholder | Category grid |
| `streamhub_codeninja_s_channel/screen.png` | `/channel/[slug]` | Placeholder | Public channel page; example slug `codeninja` |
| `streamhub_following/screen.png` | `/following` | **Not built** | Route referenced by `MainNav` but page file absent — future page |
| `streamhub_login/screen.png` | `/login` | Placeholder | Auth screen |
| `streamhub_pixelmaster_s_profile/screen.png` | `/profile` (or `/users/[username]`) | **Not built** | Route absent — future page; example user `pixelmaster` |
| `streamhub_sign_up/screen.png` | `/register` | Placeholder | Auth screen |
| `streamhub_watch_live/screen.png` | `/watch/[streamId]` | Placeholder | Player + chat + metadata; example id `live` |

`MainNav` also links to `/settings` and `/help`, which have references
neither in `UI/` nor as page files — treat as future pages.

---

## 3. Reusable Components

Build every page from these primitives. Do not duplicate markup inline when a
component exists.

### 3.1 Shared UI primitives — `packages/ui` (`@streamhub/ui`)

These are the cross-app design-system primitives (shadcn/ui-style import path).
Currently they are **structural placeholders** that emit `streamhub-*` class hooks
and have no styles attached yet. They are the intended home for the finalized
shadcn/ui components.

| Component | File | Status | Expected style (from DESIGN.md) |
| --- | --- | --- | --- |
| `Button` | `button.tsx` | Placeholder (`primary`/`secondary`/`ghost` variants) | Primary = purple bg + white text 600; Secondary = 1px purple border, transparent, 10% purple hover; Ghost = transparent, gray-400 text, surface hover |
| `Input` | `input.tsx` | Placeholder | Surface bg, 1px `#2B2E30` border; focus = 1px primary border + subtle 2px purple glow |
| `Card` | `card.tsx` | Placeholder | Surface tier + 1px `outline-variant` border |
| `Avatar` | `avatar.tsx` | Placeholder | Circular; status ring 2px (green online / red live / gray offline) |
| `Badge` | `badge.tsx` | Placeholder | Compact `4px` radius "tab-like" pill (LIVE / category tags) |
| `Modal` | `modal.tsx` | Placeholder | Floating; 24px blur, 10% black, no offset |
| `Tabs` | `tabs.tsx` | Placeholder | Section switcher (channel/dashboard) |
| `Dropdown` | `dropdown.tsx` | Placeholder | Menu / sort control |
| `Toast` | `toast.tsx` | Placeholder | default / success / error variants |

> These primitives must be fleshed out (real Tailwind/shadcn styles bound to the
> tokens in §5) before product features are built. Until then, page-level
> components apply token utilities directly (see §3.2).

### 3.2 App-level components — `apps/web/src/components` (`@/components`)

These are fully styled against the token system and are the patterns to copy:

| Component | File | Role |
| --- | --- | --- |
| `StreamCard` | `StreamCard.tsx` | 16:9 thumbnail, `rounded-lg`, hover lift + primary border; LIVE badge (top-left) + viewer-count pill (bottom-left); avatar + title + streamer + category row. **Reference for all stream grids.** |
| `NavItem` | `NavItem.tsx` | Sidebar link; active = `primary-container`/`on-primary-container`, inactive = `on-surface-variant`; hidden label below `xl`. |
| `MainNav` | `MainNav.tsx` | Discovery + footer nav groups driving routes in §2. |
| `FollowedChannel` | `FollowedChannel.tsx` | Compact followed-channel row with status dot (live → `error`, online → `#4ade80`). |
| `layout` (`app/layout.tsx`) | `layout.tsx` | App shell: fixed left sidebar (w-16 → `xl` w-60), mobile top bar (`md:hidden`), main content offset `md:ml-16 xl:ml-60`. |

### 3.3 Utilities

- `cn(...)` in `apps/web/src/lib/utils.ts` — className combiner (`clsx`). Use for
  all conditional classes. (A `tailwind-merge` pass can be added later.)
- `lucide-react` — the icon library for all UI icons (nav, controls, status).
- Fonts: `Inter` (UI/body) and `JetBrains Mono` (metadata/labels) via `next/font`.

---

## 4. Design Tokens (discovered from the references)

The canonical token set is defined in `UI/streamhub/DESIGN.md` and realized in
`apps/web/tailwind.config.js` + `apps/web/src/app/globals.css`. Use **only** these
tokens — never hard-code hex/rgba in components.

### 4.1 Color

Surface / background tiers (dark-first):

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#111417` | Base page background |
| `surface-container-lowest` | `#0b0e11` | Deepest base (body bg in layout) |
| `surface-container-low` | `#191c1f` | Sidebar / nav |
| `surface-container` | `#1d2023` | Cards / containers |
| `surface-container-high` | `#272a2e` | Hover / overlay |
| `surface-container-highest` | `#323538` | Surface-variant / scrollbar |
| `surface-variant` | `#323538` | Inputs, hover states |

Text / border:

| Token | Value | Use |
| --- | --- | --- |
| `on-surface` | `#e1e2e7` | Primary text |
| `on-surface-variant` | `#cdc2d8` | Secondary / muted text |
| `outline-variant` | `#4b4455` | 1px borders / dividers (used at `/30` opacity) |

Brand / accent:

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#d5baff` | Brand accent / active text |
| `primary-container` | `#9147ff` | Primary action bg (nav active, filter active) |
| `on-primary-container` | `#fffcff` | Text on primary-container |
| `secondary` | `#d3fbff` / `secondary-container` `#00eefc` | Neon cyan highlights, verification |
| `error` | `#ffb4ab` (token) | LIVE badge bg in code; see note below |
| `on-error` | `#690005` | Text on error |

> **Live-signal discrepancy to reconcile.** `DESIGN.md` prose reserves a
> dedicated high-visibility red **`#FF4B4B`** for LIVE status, but the implemented
> `error` token is `#ffb4ab` (a soft pink) and `StreamCard` currently renders the
> LIVE badge with `bg-error text-on-error`. Decide on a single token (recommend
> adding an explicit `live`/`signal` red `#FF4B4B`) and apply it consistently to
> LIVE badges, viewer pills, and avatar live-rings before feature work.

### 4.2 Typography (`fontSize` tokens in `tailwind.config.js`)

Fonts: **Inter** (UI) + **JetBrains Mono** (metadata/labels).

| Token | Size / line / weight | Use |
| --- | --- | --- |
| `display-lg` | 48/56, 700, -0.02em | Hero |
| `headline-lg` | 32/40, 700, -0.01em | Page titles (desktop) |
| `headline-lg-mobile` | 24/32, 700 | Page titles (mobile) |
| `headline-md` | 24/32, 600 | Section headings, brand wordmark |
| `body-lg` | 18/28, 400 | Lead text |
| `body-md` | 16/24, 400 | Default body |
| `body-sm` | 14/20, 400 | Secondary text |
| `label-md` | 14/16, 500 (Mono) | Nav labels, filter chips |
| `label-sm` | 12/14, 500 (Mono) | Metadata, viewer counts, LIVE/uppercase tags |

### 4.3 Spacing (4px baseline)

| Token | Value | Use |
| --- | --- | --- |
| `xs` | 4px | Chat density, tight gaps |
| `sm` | 8px | Icon gaps, small padding |
| `md` | 16px | Default internal padding |
| `lg` | 24px | Section padding |
| `xl` | 48px | Page gutters / large spacing |
| `layout-margin` | 24px | Page outer margin |
| `layout-gutter` | 16px | Grid gap (browse uses `gap-layout-gutter`) |

### 4.4 Radius

| Token | Value (DESIGN spec) | Tailwind impl | Use |
| --- | --- | --- | --- |
| `sm` | 0.25rem | — | — |
| `DEFAULT` (`rounded`) | 0.5rem | 0.25rem | Standard buttons/inputs |
| `md` (`rounded-md`) | 0.75rem | — | — |
| `lg` (`rounded-lg`) | 1rem | 0.5rem | Thumbnails, nav items, large cards |
| `xl` (`rounded-xl`) | 1.5rem | 0.75rem | — |
| `full` | 9999px | 9999px | Avatars, pills, icon buttons |

> **Radius discrepancy to reconcile.** The Tailwind scale in `tailwind.config.js`
> is compressed (`DEFAULT=0.25rem`, `lg=0.5rem`, `xl=0.75rem`) relative to the
> DESIGN.md spec (`DEFAULT=0.5rem`, `lg=1rem`, `xl=1.5rem`). Standardize on the
> DESIGN.md values so `rounded-lg` thumbnails actually render at 16px. Until
> reconciled, `StreamCard` intentionally uses `rounded-lg` for thumbnails.

### 4.5 Elevation & Depth

- Prefer **tonal layering + 1px `outline-variant` borders** over heavy shadows.
- Hover surfaces: `surface-container-high` / `surface-variant`.
- Glassmorphism: headers use `bg-background/80 backdrop-blur-md` (see mobile header
  in `layout.tsx`).
- Shadows: only on floating modals (24px blur, 10% black, no offset).

### 4.6 Scrollbars

`globals.css` styles a dark 8px scrollbar (`#323538` thumb, `#111417` track) for
dense areas (chat, sidebars).

---

## 5. Responsive Strategy

Breakpoints follow the DESIGN.md grid (Tailwind defaults align: `sm` 640 / `md` 768
/ `lg` 1024 / `xl` 1280 / `2xl` 1536).

| Range | Behaviour |
| --- | --- |
| **Mobile (<768px)** | Sidebars hidden; bottom/compact top navigation (`md:hidden` header in layout); single-column content. |
| **Tablet (768–1280px)** | Collapsed left nav (`w-16`, labels hidden); fluid content grid; chat optional. |
| **Desktop (>1280px)** | Expanded left nav (`w-60`, labels shown via `xl:`); fluid content; fixed chat sidebar (340px) on watch/channel. |

Implemented examples to copy:
- App shell: `hidden md:flex` sidebar `w-16 xl:w-60`; main `md:ml-16 xl:ml-60`;
  mobile header `md:hidden`.
- Browse grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`.
- Page padding scales `p-md md:p-lg lg:p-xl`; max width `max-w-[1920px] mx-auto`.

---

## 6. Rules for Implementing Future Pages

1. **Start from the PNG.** Locate the reference in `UI/streamhub_<route>/screen.png`,
   inspect layout/spacing/typography, then reproduce it. The image wins over taste.
2. **Use only tokens.** Every color/spacing/radius/typography value comes from §4 or
   `tailwind.config.js`. No arbitrary hex values in JSX.
3. **Compose, don't duplicate.** Reuse `StreamCard`, `NavItem`, `FollowedChannel`,
   and `@streamhub/ui` primitives. Extract new shared components into
   `apps/web/src/components` (or `@streamhub/ui` if cross-app).
4. **Match the shell.** Public pages render inside `app/layout.tsx` (sidebar + mobile
   header). Do not rebuild navigation per page.
5. **No invented sections.** If a section is not in the reference, do not add it. If
   unsure, make the smallest reasonable assumption and record it.
6. **Preserve the dark-first, glass, high-chroma aesthetic.** LIVE = red signal;
   primary = electric purple; secondary = neon cyan; deep neutral surfaces.
7. **Responsive by default.** Implement mobile → tablet → desktop per §5; never ship
   a desktop-only page.
8. **Icons via `lucide-react`;** metadata/labels in `JetBrains Mono` (`label-*`);
   conditional classes via `cn()`.
9. **Reconcile token drift** before calling a page done (see §4 live-red and §4.4
   radius notes).
10. **Dashboard/creator surfaces** currently have **no** reference image — do not
    visually finalize them until references are added; keep placeholders until then.

---

## 7. Source of Truth Summary

- **Visual layout & hierarchy:** `UI/streamhub_<route>/screen.png`
- **Tokens, type, spacing, elevation, components:** `UI/streamhub/DESIGN.md`
- **Implemented tokens:** `apps/web/tailwind.config.js`, `apps/web/src/app/globals.css`
- **Component patterns:** `apps/web/src/components/*`, `packages/ui/src/*`

If the image and `DESIGN.md` disagree, the image is the layout truth and `DESIGN.md`
is the token truth; flag the mismatch in the PR.
