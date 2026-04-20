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

> This release includes the dockerized foundation (auth, storage, CRUD),
> **TMDB-powered Discover / search / detail pages**, **Plex / Jellyfin
> library sync**, **Prowlarr / Jackett indexer integration** with
> interactive search, and a **Sonarr/Radarr-style import & rename engine**
> for Manual Import and file management. Download-client integration
> (qBittorrent/SABnzbd) and calendar sync are upcoming.

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
   - **Port**: `8080` (Container) → any free host port (e.g. `7345`)
   - **Volume**: `/data` (Container) → `/mnt/user/appdata/nexusmedia` (Host)
2. (Recommended on Unraid) leave the default env vars `PUID=99` and `PGID=100`
   so the container writes to `/mnt/user/appdata/...` as `nobody:users`.
3. Apply, then browse to `http://<tower>:<port>` and create your admin account.
4. (Optional) set `NEXUS_JWT_SECRET` to a long random string for stable token
   signing across rebuilds; if unset, a secret is generated on first boot and
   persisted inside `/data`.

## Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `PUID` | `99` | UID the server runs as (Unraid: `99` = nobody) |
| `PGID` | `100` | GID the server runs as (Unraid: `100` = users) |
| `NEXUS_DATA_DIR` | `/data` | Directory for SQLite DB + JWT secret |
| `NEXUS_DB_PATH` | `$NEXUS_DATA_DIR/nexus.db` | Override DB path |
| `NEXUS_JWT_SECRET` | _(generated)_ | Override JWT signing secret |
| `NEXUS_STATIC_DIR` | `/app/dist` | Where the built frontend lives |
| `TMDB_API_KEY` | _(unset)_ | TMDB v3 API key. If set, used instead of the one in Settings. |

## TMDB (Discover / search)

The Discover page, global search, and "Add Movie / Add Series" dialogs all
talk to The Movie Database. You'll need a **free TMDB v3 API key**:

1. Sign up at https://www.themoviedb.org and request a v3 API key
   from `Settings → API`.
2. In NexusMedia open **Settings → General → TMDB** and paste the key there,
   or export it as the `TMDB_API_KEY` env var on the container.

Responses are cached in SQLite (`tmdb_cache` table) for 1–24 hours, so you
won't blow past TMDB's rate limits under normal use.

## Plex / Jellyfin library sync

Add your existing media server under **Settings → Media Servers**:

- **Plex**: the base URL (e.g. `http://192.168.1.10:32400`) and your
  `X-Plex-Token` (grab it from [plex.tv article #204059436](https://support.plex.tv/articles/204059436/)).
- **Jellyfin**: the base URL (e.g. `http://192.168.1.10:8096`) and an API
  key created at `Dashboard → API Keys`. Optionally specify which user's
  library to scan.

Hit **Sync now** to scan everything. For each item whose metadata exposes a
TMDB ID (Plex `Guid`, Jellyfin `ProviderIds.Tmdb`):

- The matching `Movie` / `Series` is flagged `library_status = available`.
- If no local entry exists yet, one is created (just like Sonarr/Radarr's
  "import existing library" behavior).
- Any `Request` with that TMDB ID is flipped to `status = available`.

## Indexer integration (Prowlarr / Jackett)

Add a Torznab indexer under **Settings → Indexers**:

- **Prowlarr**: copy the per-indexer Torznab URL from Prowlarr's indexer list
  (e.g. `http://prowlarr:9696/1/api`) and your Prowlarr API key.
- **Jackett**: use the Torznab URL Jackett shows for an indexer or the
  aggregate endpoint (e.g. `http://jackett:9117/api/v2.0/indexers/all/results/torznab/api`)
  and your Jackett API key.

Click **Test** to verify the connection (a `t=caps` probe is sent).

Once indexers are healthy, open any Movie or Series detail page and click
**Interactive Search** to query all enabled indexers live. Results are
sorted by custom-format score, filterable, and you can grab any release
directly into the download queue.

Auto Search finds the best accepted release automatically.

### Search API endpoints (for power users / scripts)

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/search/manual` | `{ q, indexer_ids? }` |
| `POST` | `/api/search/movie` | `{ tmdb_id?, imdb_id?, title, year? }` |
| `POST` | `/api/search/series` | `{ tvdb_id?, title, season?, episode? }` |

All endpoints require authentication and return `{ results: [...] }`.

## Import & rename engine

Configure how files are organised under **Settings → Media Management**:

- **Import mode**: `hardlink` (default — zero extra disk usage when the
  source and library live on the same filesystem; falls back to copy if
  they don't), `copy`, or `move`.
- **Naming templates** — Sonarr/Radarr-style tokens:
  - Movies: `{Movie Title}`, `{Year}`, `{Quality Full}`, `{Resolution}`,
    `{MediaInfo VideoCodec}`, `{MediaInfo AudioCodec}`, `{Edition Tags}`.
  - Episodes: `{Series Title}`, `{season:00}`, `{episode:00}`,
    `{Episode Title}`, `{Quality Full}`, `{Resolution}`,
    `{MediaInfo VideoCodec}`, `{MediaInfo AudioCodec}`.
- **Season folders** — organise episode files into `Season 01/` folders.

Then on the **Files** page click **Manual Import**, point it at a folder
(e.g. `/downloads/complete`), and NexusMedia will:

1. Recursively find video files (`.mkv`, `.mp4`, `.avi`, …).
2. Parse each filename to extract title / year / S##E## / quality / codec.
3. Auto-match against existing Movies/Series where possible.
4. Let you assign unmatched files manually and click **Import** to move or
   hardlink each file into its final location, renamed to match your
   template. The `Movie` / `Episode` entity is updated with the final
   path, size, and parsed codec info; a `HistoryEvent` records the import.

The **Files → Movie Files / Episode Files** tabs expose a **Rename to
template** action per file, so you can bring previously-imported content
in line with a changed naming template without re-downloading.

### Import API endpoints

| Method | Path | Body |
| --- | --- | --- |
| `GET`  | `/api/imports/settings` | — |
| `PUT`  | `/api/imports/settings` | (settings patch) |
| `POST` | `/api/imports/scan` | `{ path }` |
| `POST` | `/api/imports/process` | `{ source_path, media_type, media_id, season_number?, episode_number?, import_mode? }` |
| `POST` | `/api/imports/rename` | `{ media_type, media_id }` |
| `POST` | `/api/imports/preview` | `{ media_type, media_id, source_path?, season_number?, episode_number? }` |

Writes require admin.

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

- ~~TMDB metadata + Discover feed~~ ✅
- ~~Library sync (Plex / Jellyfin) to flip requests to "available" automatically~~ ✅
- ~~Indexer integration (Prowlarr / Jackett)~~ ✅
- ~~Import / rename / file-management engine~~ ✅
- Download-client integration (qBittorrent / SABnzbd)
- Quality profiles + custom-format scoring
- Calendar + upcoming releases
- Notification providers

See `base44/entities/` for the full data model these features will drive.
