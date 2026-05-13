# SkyBit

A self-hosted, web-based personal file explorer with a cyberpunk aesthetic. Upload, browse, organize, and share files from any browser — or install it as a PWA on your phone.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)

---

## Features

- **File browser** — navigate folders, upload, download, rename, move, copy, delete
- **Multi-select** — select any number of files, then bulk delete / move / copy in one action
- **Photo gallery** — image-heavy folders auto-switch to a grid view; click to open a full-screen lightbox with keyboard / swipe navigation
- **Background uploads** — uploads continue while you navigate to other folders; progress shown in a floating queue panel
- **Temp share links** — generate time-limited download links for individual files (no login required for recipients)
- **Admin panel** — manage users (admin / mod / user roles), view and revoke share links
- **PWA** — installable on iPhone / Android home screen, works offline for cached pages
- **Cyberpunk theme** — purple `#7c0eb3` + cyan `#22d3ee`, neon glows, animated grid mesh

---

## Quick Start (Docker)

```bash
docker run -d \
  --name skybit \
  -p 7070:7070 \
  -v /path/to/your/files:/data \
  -v skybit-config:/app/config \
  -e SECRET_KEY=change-this-to-a-long-random-string \
  rayderc/skybit:latest
```

Open `http://localhost:7070` — default login is **admin / admin**. Change the password immediately via the profile page.

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
      - skybit-config:/app/config
    environment:
      SECRET_KEY: change-this-to-a-long-random-string
      SITE_NAME: SkyBit

volumes:
  skybit-config:
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | *(insecure default)* | Session encryption key — **must be set in production** (≥32 chars) |
| `BASE_DIRECTORY` | `/data` | Root directory served by the file browser |
| `SITE_NAME` | `SkyBit` | Display name shown in the nav bar |
| `PORT` | `7070` | Port the server listens on |

---

## Running Locally (Development)

```bash
git clone https://github.com/RayderC/SkyBit.git
cd SkyBit
npm install
npm run dev
```

Open `http://localhost:7070`. Files are served from the `data/` directory in the project root by default.

---

## Tech Stack

- **Next.js 15** (App Router + Pages API routes, TypeScript)
- **iron-session** — encrypted HTTP-only cookie sessions
- **bcryptjs** — password hashing (pure JS, no native compilation)
- **busboy** — streaming multipart file uploads
- **archiver** — on-demand ZIP download of folders
- **JSON file store** — no database server required; data lives in `config/data.json`

---

## Volumes

| Path in container | Purpose |
|---|---|
| `/data` | Your files (mount your file directory here) |
| `/app/config` | App data — user accounts, share links (persist this volume) |

---

## Security Notes

- Set a strong `SECRET_KEY` before exposing to the internet
- Change the default admin password immediately after first login
- All file paths are validated server-side to prevent path traversal
- The only unauthenticated route is the temp-share download endpoint (`/api/temp-shares/access`)
