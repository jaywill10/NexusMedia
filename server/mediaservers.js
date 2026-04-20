import express from 'express';
import { db, newId, tableFor, hydrate } from './db.js';
import { requireAuth, requireRole } from './auth.js';

const SERVER_TABLE = tableFor('MediaServer');
const MOVIE_TABLE = tableFor('Movie');
const SERIES_TABLE = tableFor('Series');
const REQUEST_TABLE = tableFor('Request');

// ---------- helpers ----------

function getServer(id) {
  const row = db.prepare(`SELECT * FROM ${SERVER_TABLE} WHERE id = ?`).get(id);
  return row ? hydrate(row) : null;
}

function saveServerHealth(id, fields) {
  const row = db.prepare(`SELECT * FROM ${SERVER_TABLE} WHERE id = ?`).get(id);
  if (!row) return;
  const prev = JSON.parse(row.data);
  const next = { ...prev, ...fields };
  db.prepare(`UPDATE ${SERVER_TABLE} SET data = ?, updated_date = ? WHERE id = ?`).run(
    JSON.stringify(next),
    new Date().toISOString(),
    id,
  );
}

function trimSlashes(u) {
  return (u || '').trim().replace(/\/+$/, '');
}

// ---------- Plex ----------

async function plexFetch(baseUrl, token, path, params = {}) {
  const u = new URL(trimSlashes(baseUrl) + path);
  u.searchParams.set('X-Plex-Token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`Plex ${res.status}`);
    err.status = res.status === 401 ? 400 : 502;
    err.code = res.status === 401 ? 'unauthorized' : 'upstream_error';
    throw err;
  }
  return res.json();
}

async function plexPing(baseUrl, token) {
  const data = await plexFetch(baseUrl, token, '/identity');
  const mc = data?.MediaContainer || {};
  return {
    name: mc.friendlyName || 'Plex',
    version: mc.version,
    machine_identifier: mc.machineIdentifier,
  };
}

function extractPlexTmdbId(guids) {
  if (!Array.isArray(guids)) return null;
  for (const g of guids) {
    const id = g?.id || '';
    if (id.startsWith('tmdb://')) return id.slice('tmdb://'.length);
  }
  return null;
}

async function plexListLibrary(baseUrl, token) {
  const out = { movies: [], series: [], errors: [] };
  const sections = await plexFetch(baseUrl, token, '/library/sections');
  const dirs = sections?.MediaContainer?.Directory || [];
  for (const section of dirs) {
    if (section.type !== 'movie' && section.type !== 'show') continue;
    try {
      const data = await plexFetch(
        baseUrl,
        token,
        `/library/sections/${encodeURIComponent(section.key)}/all`,
        { includeGuids: 1 },
      );
      const items = data?.MediaContainer?.Metadata || [];
      for (const it of items) {
        const tmdbId = extractPlexTmdbId(it.Guid);
        if (!tmdbId) continue;
        const base = {
          tmdb_id: tmdbId,
          title: it.title || it.originalTitle || '',
          year: it.year || null,
          overview: it.summary || '',
        };
        if (section.type === 'movie') out.movies.push(base);
        else out.series.push(base);
      }
    } catch (err) {
      out.errors.push(`plex section "${section.title}": ${err.message}`);
    }
  }
  return out;
}

// ---------- Jellyfin ----------

async function jellyfinFetch(baseUrl, token, path, params = {}) {
  const u = new URL(trimSlashes(baseUrl) + path);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    headers: {
      accept: 'application/json',
      'X-Emby-Token': token,
    },
  });
  if (!res.ok) {
    const err = new Error(`Jellyfin ${res.status}`);
    err.status = res.status === 401 ? 400 : 502;
    err.code = res.status === 401 ? 'unauthorized' : 'upstream_error';
    throw err;
  }
  return res.json();
}

async function jellyfinPing(baseUrl, token) {
  const info = await jellyfinFetch(baseUrl, token, '/System/Info');
  return {
    name: info?.ServerName || 'Jellyfin',
    version: info?.Version,
    id: info?.Id,
  };
}

async function jellyfinResolveUserId(baseUrl, token, username) {
  const users = await jellyfinFetch(baseUrl, token, '/Users');
  if (!Array.isArray(users) || users.length === 0) {
    const err = new Error('Jellyfin has no users');
    err.status = 400;
    err.code = 'no_users';
    throw err;
  }
  if (username) {
    const match = users.find((u) => u.Name?.toLowerCase() === username.toLowerCase());
    if (match) return match.Id;
    const err = new Error(`Jellyfin user "${username}" not found`);
    err.status = 400;
    err.code = 'user_not_found';
    throw err;
  }
  const admin = users.find((u) => u.Policy?.IsAdministrator);
  return (admin || users[0]).Id;
}

async function jellyfinListLibrary(baseUrl, token, username) {
  const out = { movies: [], series: [], errors: [] };
  const userId = await jellyfinResolveUserId(baseUrl, token, username);
  for (const [itemType, bucket] of [['Movie', 'movies'], ['Series', 'series']]) {
    try {
      const data = await jellyfinFetch(baseUrl, token, `/Users/${encodeURIComponent(userId)}/Items`, {
        Recursive: true,
        IncludeItemTypes: itemType,
        Fields: 'ProviderIds,Overview,ProductionYear',
        EnableImages: false,
      });
      for (const it of data?.Items || []) {
        const tmdbId = it.ProviderIds?.Tmdb || it.ProviderIds?.TmdbCollection;
        if (!tmdbId) continue;
        out[bucket].push({
          tmdb_id: String(tmdbId),
          title: it.Name || '',
          year: it.ProductionYear || null,
          overview: it.Overview || '',
        });
      }
    } catch (err) {
      out.errors.push(`jellyfin ${itemType}: ${err.message}`);
    }
  }
  return out;
}

// ---------- Sync core ----------

function findByTmdbId(table, tmdbId) {
  const row = db.prepare(
    `SELECT * FROM ${table} WHERE json_extract(data, '$.tmdb_id') = ? LIMIT 1`,
  ).get(String(tmdbId));
  return row ? { row, data: JSON.parse(row.data) } : null;
}

function upsertMediaItem(table, item, userId) {
  const existing = findByTmdbId(table, item.tmdb_id);
  const now = new Date().toISOString();
  if (existing) {
    if (existing.data.library_status === 'available') return { changed: false, created: false };
    const next = { ...existing.data, library_status: 'available' };
    db.prepare(`UPDATE ${table} SET data = ?, updated_date = ? WHERE id = ?`).run(
      JSON.stringify(next),
      now,
      existing.row.id,
    );
    return { changed: true, created: false };
  }
  const id = newId();
  const data = {
    title: item.title,
    tmdb_id: String(item.tmdb_id),
    year: item.year || undefined,
    overview: item.overview || undefined,
    library_status: 'available',
    monitored: true,
    added_date: now,
  };
  db.prepare(
    `INSERT INTO ${table} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, JSON.stringify(data), now, now, userId || null);
  return { changed: true, created: true };
}

function flipRequestsAvailable(tmdbId, mediaType) {
  const rows = db.prepare(
    `SELECT * FROM ${REQUEST_TABLE}
     WHERE json_extract(data, '$.tmdb_id') = ? AND json_extract(data, '$.media_type') = ?`,
  ).all(String(tmdbId), mediaType);
  let count = 0;
  for (const row of rows) {
    const data = JSON.parse(row.data);
    if (data.status === 'available' || data.status === 'declined' || data.status === 'canceled') continue;
    data.status = 'available';
    data.available_date = new Date().toISOString();
    db.prepare(`UPDATE ${REQUEST_TABLE} SET data = ?, updated_date = ? WHERE id = ?`).run(
      JSON.stringify(data),
      new Date().toISOString(),
      row.id,
    );
    count += 1;
  }
  return count;
}

async function fetchServerLibrary(server) {
  if (server.type === 'plex') return plexListLibrary(server.url, server.token);
  if (server.type === 'jellyfin') return jellyfinListLibrary(server.url, server.token, server.username);
  const err = new Error(`unsupported server type: ${server.type}`);
  err.status = 400;
  throw err;
}

async function pingServer(server) {
  if (server.type === 'plex') return plexPing(server.url, server.token);
  if (server.type === 'jellyfin') return jellyfinPing(server.url, server.token);
  const err = new Error(`unsupported server type: ${server.type}`);
  err.status = 400;
  throw err;
}

async function syncServer(server, userId) {
  const result = {
    movies_matched: 0,
    series_matched: 0,
    created_movies: 0,
    created_series: 0,
    requests_updated: 0,
    errors: [],
  };
  const library = await fetchServerLibrary(server);
  result.errors.push(...(library.errors || []));

  for (const m of library.movies) {
    const r = upsertMediaItem(MOVIE_TABLE, m, userId);
    if (r.changed) result.movies_matched += 1;
    if (r.created) result.created_movies += 1;
    result.requests_updated += flipRequestsAvailable(m.tmdb_id, 'movie');
  }
  for (const s of library.series) {
    const r = upsertMediaItem(SERIES_TABLE, s, userId);
    if (r.changed) result.series_matched += 1;
    if (r.created) result.created_series += 1;
    result.requests_updated += flipRequestsAvailable(s.tmdb_id, 'series');
  }
  return result;
}

// ---------- Router ----------

export const mediaServersRouter = express.Router();
mediaServersRouter.use(requireAuth);

mediaServersRouter.get('/status', (req, res) => {
  const rows = db.prepare(`SELECT * FROM ${SERVER_TABLE}`).all().map(hydrate);
  res.json({
    servers: rows.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      enabled: s.enabled !== false,
      health_status: s.health_status || 'unknown',
      health_message: s.health_message || null,
      last_checked: s.last_checked || null,
      last_sync_date: s.last_sync_date || null,
      last_sync_result: s.last_sync_result || null,
    })),
  });
});

mediaServersRouter.post('/:id/test', requireRole('admin'), async (req, res, next) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'not_found' });
    const info = await pingServer(server);
    saveServerHealth(server.id, {
      health_status: 'healthy',
      health_message: info.name ? `Connected to ${info.name}` : 'Connected',
      last_checked: new Date().toISOString(),
    });
    res.json({ ok: true, info });
  } catch (err) {
    if (req.params.id) {
      saveServerHealth(req.params.id, {
        health_status: 'error',
        health_message: err.message || 'Connection failed',
        last_checked: new Date().toISOString(),
      });
    }
    next(err);
  }
});

mediaServersRouter.post('/test', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.type || !body.url || !body.token) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const info = await pingServer(body);
    res.json({ ok: true, info });
  } catch (err) {
    next(err);
  }
});

mediaServersRouter.post('/:id/sync', requireRole('admin'), async (req, res, next) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return res.status(404).json({ error: 'not_found' });
    if (server.enabled === false) return res.status(400).json({ error: 'server_disabled' });
    const result = await syncServer(server, req.user?.id);
    saveServerHealth(server.id, {
      health_status: result.errors.length ? 'error' : 'healthy',
      health_message: result.errors.length
        ? `Sync completed with ${result.errors.length} error(s)`
        : 'Sync OK',
      last_checked: new Date().toISOString(),
      last_sync_date: new Date().toISOString(),
      last_sync_result: result,
    });
    res.json({ ok: true, result });
  } catch (err) {
    if (req.params.id) {
      saveServerHealth(req.params.id, {
        health_status: 'error',
        health_message: err.message || 'Sync failed',
        last_checked: new Date().toISOString(),
      });
    }
    next(err);
  }
});

mediaServersRouter.post('/sync-all', requireRole('admin'), async (req, res, next) => {
  try {
    const rows = db.prepare(`SELECT * FROM ${SERVER_TABLE}`).all().map(hydrate);
    const active = rows.filter((s) => s.enabled !== false);
    const results = [];
    for (const server of active) {
      try {
        const result = await syncServer(server, req.user?.id);
        saveServerHealth(server.id, {
          health_status: result.errors.length ? 'error' : 'healthy',
          health_message: result.errors.length
            ? `Sync completed with ${result.errors.length} error(s)`
            : 'Sync OK',
          last_checked: new Date().toISOString(),
          last_sync_date: new Date().toISOString(),
          last_sync_result: result,
        });
        results.push({ id: server.id, name: server.name, ok: true, result });
      } catch (err) {
        saveServerHealth(server.id, {
          health_status: 'error',
          health_message: err.message || 'Sync failed',
          last_checked: new Date().toISOString(),
        });
        results.push({ id: server.id, name: server.name, ok: false, error: err.message });
      }
    }
    res.json({ ok: true, servers: results });
  } catch (err) {
    next(err);
  }
});

mediaServersRouter.use((err, req, res, next) => {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || err.message });
  }
  console.error('[mediaservers]', err);
  res.status(500).json({ error: 'internal_error' });
});
