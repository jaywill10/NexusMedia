# NexusMedia

Self-hosted, all-in-one media request / library management platform — aimed at
eventually replacing Overseerr + Radarr + Sonarr in a single container.

This repo ships as one Docker image with:

- A React (Vite) frontend
- A Node.js + Express API
- Built-in **SQLite** storage (no external database needed)
- Built-in **local authentication** (email + password, JWT, bcrypt)
- CRUD for all 20 data-model entities used by the UI

The image is published to GitHub Container Registry and is designed to install
cleanly on Unraid with a single volume mount.

> ⚠️ This release is the dockerized foundation: auth, storage, and CRUD are in
> place. The *arr-style automation (TMDB metadata, Prowlarr/Jackett indexer
> integration, qBittorrent/SAB download clients, release parsing, scoring,
> import/rename engine, calendar sync) is **not yet** implemented — those are
> upcoming features that build on this base.

---

## Quick start (docker compose)

```yaml
services:
  nexusmedia:
    image: ghcr.io/jaywill10/nexusmedia:latest
    container_name: nexusmedia
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data          # SQLite DB + JWT secret live here
      # - /mnt/user/media:/media   # (future) your media library
```

```bash
docker compose up -d
```

Open `http://<host>:8080/` — the first account you create becomes the admin.

## Unraid install

1. In **Docker → Add Container**, set:
   - **Repository**: `ghcr.io/jaywill10/nexusmedia:latest`
   - **Network Type**: Bridge
   - **Port**: `8080` (Container) → `8080` (Host, or anything free)
   - **Volume**: `/data` (Container) → `/mnt/user/appdata/nexusmedia` (Host)
2. Apply, then browse to `http://<tower>:8080` and create your admin account.
3. (Optional) set `NEXUS_JWT_SECRET` to a long random string for stable token
   signing across rebuilds; if unset, a secret is generated on first boot and
   persisted inside `/data`.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `NEXUS_DATA_DIR` | `/data` | Directory for SQLite DB + JWT secret |
| `NEXUS_DB_PATH` | `$NEXUS_DATA_DIR/nexus.db` | Override DB path |
| `NEXUS_JWT_SECRET` | _(generated)_ | Override JWT signing secret |
| `NEXUS_STATIC_DIR` | `/app/dist` | Where the built frontend lives |

## Development

```bash
npm install
npm run dev:server      # API on :8080
npm run dev             # Vite dev server on :5173 with /api proxy to :8080
```

Open `http://localhost:5173`. The dev server proxies `/api/*` to the API, so
the two processes behave like the packaged container.

## Building the image locally

```bash
docker build -t nexusmedia:dev .
docker run --rm -p 8080:8080 -v "$PWD/data:/data" nexusmedia:dev
```

## Publishing

Every push to `main` (and tagged `v*.*.*` releases) triggers
`.github/workflows/docker-publish.yml`, which builds multi-arch images
(linux/amd64, linux/arm64) and pushes to `ghcr.io/<owner>/<repo>`.

To allow Unraid to pull the image, make the GHCR package **Public**:
GitHub → profile → Packages → `nexusmedia` → Package settings → Change
visibility → Public.

## Architecture

```
┌─────────────── Docker container ───────────────┐
│  Express (Node 20)   → /api/auth/*             │
│                      → /api/entities/<Name>    │
│                      → serves built SPA        │
│  SQLite (better-sqlite3) at /data/nexus.db     │
│  JWT secret at /data/.jwt-secret               │
└────────────────────────────────────────────────┘
```

All 20 entities (`Movie`, `Series`, `Season`, `Episode`, `Request`, etc.) are
stored as JSON in per-entity tables; filtering uses SQLite's `json_extract`.
The schemas live in `base44/entities/*.jsonc` — they're loaded at boot to
create the tables.

## Roadmap

Next work, on top of this base:

- TMDB metadata + Discover feed
- Indexer integration (Prowlarr / Jackett)
- Download-client integration (qBittorrent / SABnzbd)
- Release-parsing, quality profiles and custom-format scoring
- Import / rename / file-management engine
- Calendar + upcoming releases
- Notification providers

See `base44/entities/` for the full data model these features will drive.
