# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # http://localhost:7070
npm run build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
docker build -t rayderc/skybit:latest .
docker rm -f skybit; docker run -d --name skybit -p 7070:7070 \
  -v ./data:/data -v ./config:/app/config \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  rayderc/skybit:latest
```

`skybit-deploy.ps1` is a manual PowerShell script for pushing to Docker Hub — not part of CI.

## Architecture

Hybrid Next.js router: `app/` (App Router, all UI pages) + `pages/api/` (Pages Router, ~34 API endpoints). All `app/` pages are `"use client"` components. Auth is enforced client-side — pages fetch `/api/auth/user` in `useEffect` and redirect to `/login` on 401.

### Data Store

SkyBit uses a **JSON file** store at `config/data.json` — **not SQLite**. This is a key distinction from sibling apps. `lib/db.ts` reads/writes a single JSON file with three top-level keys:

- `users` — array of `{ id, username, password (bcrypt), role, created_at }`
- `tempShares` — array of `{ token, filepath, expires_at, created_at }`
- `config` — key/value map (e.g. `site_name`)
- `nextUserId` — auto-increment counter

On startup `lib/db.ts` seeds `site_name` from `SITE_NAME` env var and migrates legacy `users.json` if present (renames to `.migrated`). Corrupt `data.json` is backed up as `data.json.bak.<timestamp>` and a fresh store is started. Backups are never deleted automatically.

### File Storage

Files live under `BASE_DIRECTORY` (env var, Docker default `/data`). `lib/fs.ts` exposes:

- `resolveSafePath(userPath)` — resolves and validates that the result stays within `BASE_DIR` (throws on path-traversal attempts)
- `toRelative(absolutePath)` — strips `BASE_DIR` prefix
- File-type detection via extension sets (`IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `TEXT_EXTS`)
- `detectImageFolder()` — returns true if >50% of non-directory entries are images (triggers gallery view)

### Auth & Session

`iron-session` (`lib/session.ts`), cookie name `skybit-session` (note the hyphen — kept exactly as-is). Session data: `{ userId, username, role }`.

Secret priority: `SESSION_SECRET` env var → `SECRET_KEY` env var (legacy) → build-time placeholder. Production requires ≥32 chars or the server throws at startup.

Roles: `admin` / `mod` / `user`. Admins manage users and temp shares. Mods can upload, rename, delete, and edit text files. Users browse and download only.

### CSRF

`lib/csrf.ts` checks `Origin` vs `Host` on mutating API routes. Requests without `Origin` (direct API clients) pass unconditionally. Applied manually per-handler in `pages/api/`.

### API Endpoints (~34 total)

**Auth** — `/api/auth/login`, `/api/auth/logout`, `/api/auth/setup`, `/api/auth/user`

**Files** — `/api/files/list`, `/api/files/download`, `/api/files/upload` (streaming via busboy), `/api/files/preview`, `/api/files/thumb` (sharp thumbnails + EXIF rotation), `/api/files/delete`, `/api/files/rename`, `/api/files/move`, `/api/files/copy`, `/api/files/new-file`, `/api/files/new-folder`, `/api/files/save` (text edit), `/api/files/folder-tree`, `/api/files/bulk-delete`, `/api/files/bulk-move`, `/api/files/bulk-copy`, `/api/files/move-job`, `/api/files/copy-job`, `/api/files/job-status`

**Temp Shares** — `/api/temp-shares/create`, `/api/temp-shares/list`, `/api/temp-shares/delete`, `/api/temp-shares/edit`, `/api/temp-shares/info`, `/api/temp-shares/access` (unauthenticated — serves file to anyone with the token)

**Users** — `/api/users/list`, `/api/users/add`, `/api/users/delete`, `/api/users/edit`, `/api/users/profile`

### Background Jobs

`lib/jobs.ts` implements an in-memory job store for long-running bulk copy/move operations. Jobs are polled via `/api/files/job-status`.

### Key Features

- **Gallery view** with `@tanstack/react-virtual` virtualised row rendering (`components/GalleryView.tsx`, `components/Lightbox.tsx`)
- **ZIP downloads** via `archiver`
- **Image processing** via `sharp` (thumbnails, EXIF-aware rotation)
- **Streaming uploads** via `busboy` (no body-parser size limit)
- **Temp share links** — time-limited unauthenticated access via token; accessible at `/share?token=...` (UI) or `/api/temp-shares/access?token=...` (direct download)
- **Path-traversal protection** on all file ops via `resolveSafePath()`

## Components

Flat `components/` directory (no sub-folders):

- `FileBrowser.tsx` — main list/gallery toggle, drag-drop upload, selection, modals
- `GalleryView.tsx` — virtualised image grid using `useWindowVirtualizer`
- `Lightbox.tsx` — full-screen image preview with keyboard navigation and preloading
- `FileItem.tsx` — single row in list view
- `Navigation.tsx` — top nav bar with hamburger for mobile
- `UploadManager.tsx` — upload queue context, XHR-based parallel uploads with progress
- `SelectionBar.tsx` — bulk action toolbar (delete, move, copy, zip)
- `FolderTreePicker.tsx` — folder picker modal for move/copy targets
- `DeleteModal.tsx` — confirmation modal
- `CircuitBackground.tsx` — animated SVG cyberpunk background (used on auth pages)

## Design System

Cyberpunk dark theme (`app/globals.css`). Key CSS variables:

```
--bg: #0a0a12          (page background)
--primary: #7c0eb3     (purple accent)
--accent-cyan: #22d3ee
--accent-magenta: #f472b6
--font-mono: 'JetBrains Mono', monospace
```

JetBrains Mono applies **only** to: nav labels, badges, stat values, form labels, code/monospace contexts — never body text. Body uses system fonts.

Auth/modal cards use `overflow: hidden` with bracket pseudo-elements (cyan top-left, magenta bottom-right). No logo image — text-only `SkyBit` branding.

Mobile breakpoints: 900px (nav collapses to hamburger), 640px (modals become bottom sheets, `font-size: 16px` on inputs to prevent iOS zoom).

## Docker

Base image: `node:20-alpine`. Two-stage build (builder + runner). Production user: `nextjs` (uid 1001, non-root).

Volumes:
- `/data` — user file storage (`BASE_DIRECTORY`)
- `/app/config` — `data.json` + `.session_secret` file

Entrypoint (`docker-entrypoint.sh`) auto-generates a random session secret on first run and writes it to `/app/config/.session_secret`. If `SESSION_SECRET` is already set in the environment, the file is not used. Port 7070.

Security headers set in `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a strict `Content-Security-Policy`.
