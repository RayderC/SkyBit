# SkyBit

A self-hosted, web-based personal file explorer with a cyberpunk aesthetic. Upload, browse, organize, and share your files from any browser — or install it as a PWA directly on your phone's home screen.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

### File Management
- **Full file browser** — navigate folders, view file sizes and modified dates
- **Upload** — drag-and-drop onto any folder, or use the upload button; large files stream directly to disk
- **Background uploads** — uploads keep running while you navigate; a floating queue panel shows live progress
- **Download** — individual files or entire folders as a ZIP archive
- **Rename, move, copy** — inline rename and a folder-tree picker modal for move/copy
- **Create** — new folders and new empty files (any extension) from the toolbar
- **Delete** — with a confirmation modal so nothing disappears by accident

### Multi-Select & Bulk Actions
- Toggle selection mode to check multiple files/folders
- Bulk delete, move, or copy in a single action via the floating selection bar

### Photo Gallery & Lightbox
- Image-heavy folders automatically switch to a grid gallery view
- Click any photo to open a full-screen lightbox with:
  - Left/right arrow navigation (keyboard ← → supported)
  - Touch swipe on mobile
  - Download and delete from within the viewer

### Sharing
- **Temp share links** — generate time-limited, token-based download links
- Recipients need no account; links expire automatically
- Admins can view, extend, or revoke all active share links

### User Management
- Three roles: **admin**, **mod**, **user**
  - **admin** — full access: user management, share link management, all file operations
  - **mod** — all file operations (upload, rename, delete, move, copy, share)
  - **user** — read-only: browse, download, view
- Admin panel at `/admin` for adding, editing, and deleting accounts

### Mobile & PWA
- Responsive layout — works on phones and tablets
- Hamburger menu on small screens
- Installable as a PWA: Add to Home Screen on iOS/Android for a native app feel
- Offline shell caching via service worker

### Design
- Cyberpunk purple (`#7c0eb3`) + cyan (`#22d3ee`) color palette
- Neon glow effects, animated grid mesh background
- Animated circuit-board traces on the login page
- JetBrains Mono for monospace elements

---

## Quick Start (Docker)

```bash
docker run -d \
  --name skybit \
  -p 7070:7070 \
  -v /path/to/your/files:/data \
  -v /path/to/config:/app/config \
  -e SECRET_KEY=change-this-to-a-long-random-string \
  rayderc/skybit:latest
```

Open `http://localhost:7070` — default login is **admin / admin**.  
**Change the password immediately** via the Profile page.

### docker-compose

```yaml
services:
  skybit:
    image: rayderc/skybit:latest
    container_name: skybit
    restart: unless-stopped
    ports:
      - "7070:7070"
    volumes:
      - /path/to/your/files:/data
      - /path/to/config:/app/config
```

Set `SECRET_KEY` in a `.env` file next to your compose file and reference it with `env_file: [.env]`, or pass it directly via the `environment:` key.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(insecure built-in)* | Session encryption key — **must be set in production** (≥ 32 characters) |
| `BASE_DIRECTORY` | `/data` | Root directory served by the file browser |
| `SITE_NAME` | `SkyBit` | Display name shown in the navigation bar |
| `PORT` | `7070` | Port the HTTP server listens on |

---

## Volumes

| Container path | Purpose |
|---|---|
| `/data` | Your files — mount your file storage directory here |
| `/app/config` | App data — user accounts and share links are stored in `config/data.json`. **Persist this** or you will lose accounts on container restart. |

The container starts as root, `chown`s both volumes to the `nextjs` user, then drops privileges before starting the server.

---

## Updating

```bash
docker pull rayderc/skybit:latest
docker stop skybit && docker rm skybit
# re-run the docker run command above
```

With docker-compose:
```bash
docker compose pull
docker compose up -d
```

---

## Running Locally (Development)

**Requirements:** Node.js 20+

```bash
git clone https://github.com/RayderC/SkyBit.git
cd SkyBit
npm install
npm run dev
```

Open `http://localhost:7070`. Files are served from the `data/` folder in the project root by default (created automatically on first run).

### Environment (local)

Create a `.env.local` file:

```
SECRET_KEY=any-long-string-for-local-dev
BASE_DIRECTORY=./data
SITE_NAME=SkyBit
PORT=7070
```

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router for pages, Pages Router for API routes) |
| Language | TypeScript (strict) |
| Auth | iron-session — encrypted HTTP-only cookies, 30-day sessions |
| Passwords | bcryptjs — pure JS, no native compilation required |
| File uploads | busboy — streams directly to disk, handles large files |
| ZIP downloads | archiver |
| Data store | JSON file (`config/data.json`) — no database server needed |
| Styling | Custom CSS with design tokens, no UI framework |

---

## Security Notes

- **Set `SECRET_KEY`** before exposing to the internet. The built-in default is not secret.
- **Change the default admin password** (`admin / admin`) immediately after first login.
- All file path inputs are validated server-side against `BASE_DIRECTORY` to prevent path traversal.
- The only unauthenticated endpoint is the temp-share access route (`/api/temp-shares/access?token=...`).
- Session cookies are `httpOnly`, `secure` (in production), and `sameSite: lax`.

---

## License

MIT
