import express from 'express';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { db, newId, tableFor, hydrate } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { parseRelease, isVideoFile } from './parser.js';
import {
  renderMovieFilename,
  renderMovieFolder,
  renderEpisodeFilename,
  renderSeriesFolder,
  renderSeasonFolder,
} from './naming.js';

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'media-management';

const DEFAULT_SETTINGS = {
  import_mode: 'hardlink',
  rename_movies: true,
  movie_naming: '{Movie Title} ({Year}) {Quality Full}',
  rename_series: true,
  series_naming: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
  season_folder: true,
  empty_folder_cleanup: false,
  recycle_bin_path: '',
};

function readSettings() {
  const table = tableFor('AppSettings');
  const row = db.prepare(`SELECT * FROM "${table}" WHERE json_extract(data, '$.key') = ?`).get(SETTINGS_KEY);
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(row.data);
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings, userId) {
  const table = tableFor('AppSettings');
  const merged = { ...readSettings(), ...settings };
  const existing = db.prepare(`SELECT * FROM "${table}" WHERE json_extract(data, '$.key') = ?`).get(SETTINGS_KEY);
  const now = new Date().toISOString();
  const payload = { key: SETTINGS_KEY, value: JSON.stringify(merged) };
  if (existing) {
    db.prepare(`UPDATE "${table}" SET data = ?, updated_date = ? WHERE id = ?`).run(JSON.stringify(payload), now, existing.id);
  } else {
    db.prepare(`INSERT INTO "${table}" (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`).run(
      newId(), JSON.stringify(payload), now, now, userId || null,
    );
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Entity lookups
// ---------------------------------------------------------------------------

function getMovie(id) {
  const table = tableFor('Movie');
  const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
  return row ? hydrate(row) : null;
}

function getSeries(id) {
  const table = tableFor('Series');
  const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
  return row ? hydrate(row) : null;
}

function getEpisode({ id, series_id, season_number, episode_number }) {
  const table = tableFor('Episode');
  if (id) {
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    return row ? hydrate(row) : null;
  }
  if (series_id != null && season_number != null && episode_number != null) {
    const row = db.prepare(
      `SELECT * FROM "${table}" WHERE json_extract(data, '$.series_id') = ? AND json_extract(data, '$.season_number') = ? AND json_extract(data, '$.episode_number') = ?`,
    ).get(series_id, Number(season_number), Number(episode_number));
    return row ? hydrate(row) : null;
  }
  return null;
}

function listRootFolders(mediaType) {
  const table = tableFor('RootFolder');
  const rows = db.prepare(`SELECT * FROM "${table}"`).all();
  return rows
    .map(hydrate)
    .filter(rf => {
      if (!rf.path) return false;
      if (!mediaType) return true;
      return rf.media_type === mediaType || rf.media_type === 'both' || !rf.media_type;
    });
}

function updateEntity(entityName, id, patch) {
  const table = tableFor(entityName);
  const row = db.prepare(`SELECT data FROM "${table}" WHERE id = ?`).get(id);
  if (!row) return null;
  const data = { ...JSON.parse(row.data), ...patch };
  const now = new Date().toISOString();
  db.prepare(`UPDATE "${table}" SET data = ?, updated_date = ? WHERE id = ?`).run(JSON.stringify(data), now, id);
  return data;
}

function createHistoryEvent(payload, userId) {
  const table = tableFor('HistoryEvent');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO "${table}" (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`).run(
    newId(), JSON.stringify({ ...payload, timestamp: now }), now, now, userId || null,
  );
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function safeResolve(p) {
  if (!p) throw new Error('Path required');
  const abs = path.resolve(p);
  return abs;
}

async function pathExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// Transfer file with mode: hardlink | copy | move. Falls back from hardlink
// to copy if source and dest live on different filesystems (EXDEV).
async function transferFile(src, dst, mode) {
  await ensureDir(path.dirname(dst));
  if (await pathExists(dst)) {
    const s1 = await fs.stat(src);
    const s2 = await fs.stat(dst);
    // If target already points at the same inode, we're done
    if (s1.ino === s2.ino && s1.dev === s2.dev) return { reused: true };
    throw Object.assign(new Error(`Destination already exists: ${dst}`), { code: 'EEXIST' });
  }

  if (mode === 'hardlink') {
    try {
      await fs.link(src, dst);
      return { mode: 'hardlink' };
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      // cross-device → fall back to copy
    }
    await fs.copyFile(src, dst);
    return { mode: 'copy', fallback: 'EXDEV' };
  }

  if (mode === 'copy') {
    await fs.copyFile(src, dst);
    return { mode: 'copy' };
  }

  if (mode === 'move') {
    try {
      await fs.rename(src, dst);
      return { mode: 'move' };
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      await fs.copyFile(src, dst);
      await fs.unlink(src);
      return { mode: 'move', fallback: 'copy+unlink' };
    }
  }

  throw new Error(`Unknown import mode: ${mode}`);
}

// ---------------------------------------------------------------------------
// Destination path computation
// ---------------------------------------------------------------------------

function pickRootFolder(mediaType, preferredPath) {
  const folders = listRootFolders(mediaType);
  if (preferredPath) {
    const m = folders.find(f => preferredPath.startsWith(f.path));
    if (m) return m.path;
  }
  if (folders.length) return folders[0].path;
  return null;
}

function computeMovieDest(movie, sourcePath, settings) {
  const ext = path.extname(sourcePath);
  const root = pickRootFolder('movie', movie.path);
  if (!root) throw new Error('No root folder configured for movies');
  const folder = renderMovieFolder(movie);
  const baseName = settings.rename_movies
    ? renderMovieFilename(settings.movie_naming, movie)
    : path.basename(sourcePath, ext);
  const fileName = `${baseName}${ext}`;
  const dest = path.join(root, folder, fileName);
  const libraryPath = path.join(root, folder);
  return { dest, libraryPath };
}

function computeEpisodeDest({ series, episode, season_number, episode_number }, sourcePath, settings) {
  const ext = path.extname(sourcePath);
  const root = pickRootFolder('series', series.path);
  if (!root) throw new Error('No root folder configured for series');
  const seriesFolder = renderSeriesFolder(series);
  const seasonFolder = settings.season_folder
    ? renderSeasonFolder(season_number ?? episode?.season_number)
    : '';
  const baseName = settings.rename_series
    ? renderEpisodeFilename(settings.series_naming, { series, episode, season_number, episode_number })
    : path.basename(sourcePath, ext);
  const fileName = `${baseName}${ext}`;
  const dest = path.join(root, seriesFolder, seasonFolder, fileName);
  const libraryPath = path.join(root, seriesFolder);
  return { dest, libraryPath };
}

// ---------------------------------------------------------------------------
// Auto-match helpers for scan results
// ---------------------------------------------------------------------------

function normaliseForMatch(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findMovieMatch(parsed, allMovies) {
  const title = normaliseForMatch(parsed.title);
  if (!title) return null;
  const withYear = parsed.year
    ? allMovies.find(m => normaliseForMatch(m.title) === title && Number(m.year) === Number(parsed.year))
    : null;
  if (withYear) return withYear;
  return allMovies.find(m => normaliseForMatch(m.title) === title) || null;
}

function findSeriesMatch(parsed, allSeries) {
  const title = normaliseForMatch(parsed.title);
  if (!title) return null;
  return allSeries.find(s => normaliseForMatch(s.title) === title) || null;
}

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

async function walkDirectory(root, { maxDepth = 6, maxFiles = 2000 } = {}) {
  const out = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    if (out.length >= maxFiles) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= maxFiles) return;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(p, depth + 1);
      } else if (ent.isFile() && isVideoFile(ent.name)) {
        try {
          const st = await fs.stat(p);
          out.push({ path: p, size: st.size });
        } catch { /* unreadable — skip */ }
      }
    }
  }
  await walk(root, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const importsRouter = express.Router();
importsRouter.use(requireAuth);

// GET /api/imports/settings
importsRouter.get('/settings', (req, res) => {
  res.json(readSettings());
});

// PUT /api/imports/settings (admin)
importsRouter.put('/settings', requireRole('admin'), (req, res) => {
  const allowed = [
    'import_mode', 'rename_movies', 'movie_naming', 'rename_series',
    'series_naming', 'season_folder', 'empty_folder_cleanup', 'recycle_bin_path',
  ];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json(writeSettings(patch, req.user?.id));
});

// POST /api/imports/scan — recursively list video files in a directory,
// attempt to auto-match each one to an existing Movie/Series.
importsRouter.post('/scan', requireRole('admin'), async (req, res) => {
  const { path: scanPath } = req.body;
  if (!scanPath) return res.status(400).json({ error: 'path required' });
  const abs = safeResolve(scanPath);
  if (!(await pathExists(abs))) return res.status(404).json({ error: 'path does not exist' });

  const files = await walkDirectory(abs);

  const movieTable = tableFor('Movie');
  const seriesTable = tableFor('Series');
  const allMovies = db.prepare(`SELECT * FROM "${movieTable}"`).all().map(hydrate);
  const allSeries = db.prepare(`SELECT * FROM "${seriesTable}"`).all().map(hydrate);

  const results = files.map(f => {
    const parsed = parseRelease(path.basename(f.path));
    // Heuristic: has SxxExx → series; otherwise movie
    const looksLikeEpisode = parsed.season_number != null && parsed.episode_number != null;
    let match = null;
    let media_type = null;
    if (looksLikeEpisode) {
      match = findSeriesMatch(parsed, allSeries);
      media_type = 'series';
    } else {
      match = findMovieMatch(parsed, allMovies);
      media_type = 'movie';
    }
    return {
      id: Buffer.from(f.path).toString('base64url').slice(0, 24),
      file_path: f.path,
      file_size: f.size,
      parsed_title: parsed.title,
      parsed_year: parsed.year,
      parsed_quality: parsed.quality,
      parsed_resolution: parsed.resolution,
      parsed_source: parsed.source,
      parsed_video_codec: parsed.video_codec,
      parsed_audio_codec: parsed.audio_codec,
      parsed_season: parsed.season_number,
      parsed_episode: parsed.episode_number,
      media_type,
      match_id: match?.id || null,
      match_title: match?.title || null,
      match_year: match?.year || null,
    };
  });

  res.json({ path: abs, count: results.length, files: results });
});

// POST /api/imports/process — perform one import operation.
importsRouter.post('/process', requireRole('admin'), async (req, res) => {
  const {
    source_path,
    media_type,
    media_id,
    season_number,
    episode_number,
    import_mode,
  } = req.body;

  if (!source_path) return res.status(400).json({ error: 'source_path required' });
  if (!media_type || !media_id) return res.status(400).json({ error: 'media_type and media_id required' });

  const src = safeResolve(source_path);
  if (!(await pathExists(src))) return res.status(404).json({ error: 'source file not found' });

  const settings = readSettings();
  const mode = import_mode || settings.import_mode;

  let parsed;
  try { parsed = parseRelease(path.basename(src)); } catch { parsed = {}; }

  try {
    if (media_type === 'movie') {
      const movie = getMovie(media_id);
      if (!movie) return res.status(404).json({ error: 'movie not found' });
      const { dest, libraryPath } = computeMovieDest(movie, src, settings);
      const result = await transferFile(src, dest, mode);
      const stat = await fs.stat(dest);
      updateEntity('Movie', movie.id, {
        file_path: dest,
        file_size: stat.size,
        path: libraryPath,
        library_status: 'available',
        quality: parsed.quality || movie.quality,
        resolution: parsed.resolution || movie.resolution,
        source: parsed.source || movie.source,
        video_codec: parsed.video_codec || movie.video_codec,
        audio_codec: parsed.audio_codec || movie.audio_codec,
        edition: parsed.edition || movie.edition,
      });
      createHistoryEvent({
        event_type: 'imported',
        media_type: 'movie',
        media_id: movie.id,
        media_title: movie.title,
        quality: parsed.quality || movie.quality,
        source_info: src,
        details: `Imported to ${dest} (${result.mode || mode})`,
        success: true,
      }, req.user?.id);
      return res.json({ ok: true, dest, mode: result.mode || mode, fallback: result.fallback || null });
    }

    if (media_type === 'series' || media_type === 'episode') {
      const series = getSeries(media_id);
      if (!series) return res.status(404).json({ error: 'series not found' });
      const s = season_number ?? parsed.season_number;
      const e = episode_number ?? parsed.episode_number;
      if (s == null || e == null) return res.status(400).json({ error: 'season_number and episode_number required for series import' });

      const episode = getEpisode({ series_id: series.id, season_number: s, episode_number: e });
      const { dest, libraryPath } = computeEpisodeDest({ series, episode, season_number: s, episode_number: e }, src, settings);
      const result = await transferFile(src, dest, mode);
      const stat = await fs.stat(dest);

      if (episode) {
        updateEntity('Episode', episode.id, {
          file_path: dest,
          file_size: stat.size,
          has_file: true,
          status: 'downloaded',
          quality: parsed.quality || episode.quality,
          resolution: parsed.resolution || episode.resolution,
          source: parsed.source || episode.source,
          video_codec: parsed.video_codec || episode.video_codec,
          audio_codec: parsed.audio_codec || episode.audio_codec,
        });
      }
      updateEntity('Series', series.id, { path: libraryPath });

      createHistoryEvent({
        event_type: 'imported',
        media_type: 'episode',
        media_id: episode?.id || series.id,
        media_title: `${series.title} S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`,
        quality: parsed.quality || episode?.quality,
        source_info: src,
        details: `Imported to ${dest} (${result.mode || mode})`,
        success: true,
      }, req.user?.id);
      return res.json({ ok: true, dest, mode: result.mode || mode, fallback: result.fallback || null });
    }

    return res.status(400).json({ error: 'media_type must be movie, series, or episode' });
  } catch (err) {
    createHistoryEvent({
      event_type: 'import_failed',
      media_type,
      media_id,
      source_info: src,
      details: err.message,
      success: false,
    }, req.user?.id);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/imports/rename — rename an already-imported file in place,
// using the current naming template.
importsRouter.post('/rename', requireRole('admin'), async (req, res) => {
  const { media_type, media_id } = req.body;
  if (!media_type || !media_id) return res.status(400).json({ error: 'media_type and media_id required' });

  const settings = readSettings();
  try {
    if (media_type === 'movie') {
      const movie = getMovie(media_id);
      if (!movie) return res.status(404).json({ error: 'movie not found' });
      if (!movie.file_path) return res.status(400).json({ error: 'movie has no file to rename' });
      if (!settings.rename_movies) return res.status(400).json({ error: 'movie rename is disabled in settings' });

      const src = safeResolve(movie.file_path);
      const { dest, libraryPath } = computeMovieDest(movie, src, settings);
      if (src === dest) return res.json({ ok: true, unchanged: true, dest });

      await ensureDir(path.dirname(dest));
      await fs.rename(src, dest);
      updateEntity('Movie', movie.id, { file_path: dest, path: libraryPath });
      createHistoryEvent({
        event_type: 'renamed',
        media_type: 'movie',
        media_id: movie.id,
        media_title: movie.title,
        source_info: src,
        details: `Renamed to ${dest}`,
        success: true,
      }, req.user?.id);
      return res.json({ ok: true, dest });
    }

    if (media_type === 'episode') {
      const table = tableFor('Episode');
      const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(media_id);
      if (!row) return res.status(404).json({ error: 'episode not found' });
      const episode = hydrate(row);
      if (!episode.file_path) return res.status(400).json({ error: 'episode has no file to rename' });
      if (!settings.rename_series) return res.status(400).json({ error: 'series rename is disabled in settings' });

      const series = getSeries(episode.series_id);
      if (!series) return res.status(404).json({ error: 'series not found' });

      const src = safeResolve(episode.file_path);
      const { dest, libraryPath } = computeEpisodeDest(
        { series, episode, season_number: episode.season_number, episode_number: episode.episode_number },
        src,
        settings,
      );
      if (src === dest) return res.json({ ok: true, unchanged: true, dest });

      await ensureDir(path.dirname(dest));
      await fs.rename(src, dest);
      updateEntity('Episode', episode.id, { file_path: dest });
      updateEntity('Series', series.id, { path: libraryPath });
      createHistoryEvent({
        event_type: 'renamed',
        media_type: 'episode',
        media_id: episode.id,
        media_title: `${series.title} S${String(episode.season_number).padStart(2, '0')}E${String(episode.episode_number).padStart(2, '0')}`,
        source_info: src,
        details: `Renamed to ${dest}`,
        success: true,
      }, req.user?.id);
      return res.json({ ok: true, dest });
    }

    return res.status(400).json({ error: 'media_type must be movie or episode' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Preview renders — handy for the UI
importsRouter.post('/preview', (req, res) => {
  const { media_type, media_id, source_path, season_number, episode_number } = req.body;
  const settings = readSettings();
  try {
    if (media_type === 'movie') {
      const movie = getMovie(media_id);
      if (!movie) return res.status(404).json({ error: 'movie not found' });
      const src = source_path || movie.file_path || 'input.mkv';
      const { dest } = computeMovieDest(movie, src, settings);
      return res.json({ dest });
    }
    if (media_type === 'series' || media_type === 'episode') {
      const series = getSeries(media_id);
      if (!series) return res.status(404).json({ error: 'series not found' });
      const s = season_number;
      const e = episode_number;
      const episode = getEpisode({ series_id: series.id, season_number: s, episode_number: e });
      const src = source_path || episode?.file_path || 'input.mkv';
      const { dest } = computeEpisodeDest({ series, episode, season_number: s, episode_number: e }, src, settings);
      return res.json({ dest });
    }
    return res.status(400).json({ error: 'unsupported media_type' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
