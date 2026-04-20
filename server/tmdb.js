import express from 'express';
import { db, newId, tableFor } from './db.js';
import { requireAuth, requireRole } from './auth.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';

db.exec(`
  CREATE TABLE IF NOT EXISTS tmdb_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tmdb_cache_exp ON tmdb_cache(expires_at);
`);

function cacheGet(key) {
  const row = db.prepare('SELECT value, expires_at FROM tmdb_cache WHERE key = ?').get(key);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM tmdb_cache WHERE key = ?').run(key);
    return null;
  }
  return JSON.parse(row.value);
}
function cacheSet(key, value, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO tmdb_cache (key, value, expires_at) VALUES (?, ?, ?)').run(
    key, JSON.stringify(value), Date.now() + ttlMs,
  );
}

function readSettingsKey() {
  const table = tableFor('AppSettings');
  const row = db.prepare(`SELECT * FROM ${table} WHERE json_extract(data, '$.key') = ?`).get('tmdb');
  if (!row) return null;
  const data = JSON.parse(row.data);
  try {
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return parsed?.api_key || null;
  } catch {
    return null;
  }
}
function writeSettingsKey(apiKey, userId) {
  const table = tableFor('AppSettings');
  const existing = db.prepare(`SELECT * FROM ${table} WHERE json_extract(data, '$.key') = ?`).get('tmdb');
  const now = new Date().toISOString();
  const payload = { key: 'tmdb', value: JSON.stringify({ api_key: apiKey }) };
  if (existing) {
    db.prepare(`UPDATE ${table} SET data = ?, updated_date = ? WHERE id = ?`).run(JSON.stringify(payload), now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO ${table} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
    ).run(newId(), JSON.stringify(payload), now, now, userId || null);
  }
}
function getApiKey() {
  return process.env.TMDB_API_KEY || readSettingsKey();
}

async function tmdbFetch(path, params = {}, { ttlMs = 60 * 60_000 } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('TMDB API key not configured');
    err.status = 400;
    err.code = 'no_api_key';
    throw err;
  }
  const u = new URL(TMDB_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  const cacheKey = `${u.pathname}?${u.searchParams.toString()}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;
  u.searchParams.set('api_key', apiKey);
  const res = await fetch(u.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const err = new Error(`TMDB error ${res.status}`);
    err.status = res.status === 401 ? 400 : 502;
    err.code = res.status === 401 ? 'invalid_api_key' : 'upstream_error';
    throw err;
  }
  const json = await res.json();
  cacheSet(cacheKey, json, ttlMs);
  return json;
}

let movieGenresCache = null;
let tvGenresCache = null;
async function getMovieGenres() {
  if (movieGenresCache) return movieGenresCache;
  const d = await tmdbFetch('/genre/movie/list', {}, { ttlMs: 24 * 60 * 60_000 });
  movieGenresCache = { byId: {}, byName: {} };
  for (const g of d.genres || []) {
    movieGenresCache.byId[g.id] = g.name;
    movieGenresCache.byName[g.name.toLowerCase()] = g.id;
  }
  return movieGenresCache;
}
async function getTvGenres() {
  if (tvGenresCache) return tvGenresCache;
  const d = await tmdbFetch('/genre/tv/list', {}, { ttlMs: 24 * 60 * 60_000 });
  tvGenresCache = { byId: {}, byName: {} };
  for (const g of d.genres || []) {
    tvGenresCache.byId[g.id] = g.name;
    tvGenresCache.byName[g.name.toLowerCase()] = g.id;
  }
  return tvGenresCache;
}
function clearGenreCache() { movieGenresCache = null; tvGenresCache = null; }

function poster(p, size = 'w500') { return p ? `${TMDB_IMAGE}/${size}${p}` : null; }
function backdrop(p, size = 'w1280') { return p ? `${TMDB_IMAGE}/${size}${p}` : null; }

function normalizeMovie(m, genres = null) {
  const names = (m.genre_ids || [])
    .map((id) => genres?.byId[id])
    .filter(Boolean);
  return {
    media_type: 'movie',
    tmdb_id: String(m.id),
    title: m.title || m.original_title,
    original_title: m.original_title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    overview: m.overview || '',
    rating: m.vote_average || 0,
    vote_count: m.vote_count || 0,
    poster_url: poster(m.poster_path),
    backdrop_url: backdrop(m.backdrop_path),
    original_language: m.original_language,
    genres: names,
    release_date: m.release_date || null,
  };
}
function normalizeSeries(s, genres = null) {
  const names = (s.genre_ids || [])
    .map((id) => genres?.byId[id])
    .filter(Boolean);
  return {
    media_type: 'series',
    tmdb_id: String(s.id),
    title: s.name || s.original_name,
    original_title: s.original_name,
    year: s.first_air_date ? Number(s.first_air_date.slice(0, 4)) : null,
    overview: s.overview || '',
    rating: s.vote_average || 0,
    vote_count: s.vote_count || 0,
    poster_url: poster(s.poster_path),
    backdrop_url: backdrop(s.backdrop_path),
    original_language: s.original_language,
    genres: names,
    first_air_date: s.first_air_date || null,
  };
}

// Hand-picked popular companies / networks that match the UI's filter lists.
const NETWORKS = {
  'Netflix': 213, 'HBO': 49, 'Disney+': 2739, 'Amazon': 1024, 'Apple TV+': 2552,
  'Hulu': 453, 'Peacock': 3353, 'AMC': 174, 'FX': 88, 'Showtime': 67,
  'BBC': 4, 'ABC': 2, 'NBC': 6, 'CBS': 16, 'FOX': 19,
};
const STUDIOS = {
  'Marvel Studios': 420, 'Warner Bros.': 174, 'Universal': 33, 'Disney': 2,
  'Paramount': 4, 'Sony Pictures': 5, 'A24': 41077, '20th Century Studios': 127928,
  'Lionsgate': 1632, 'DreamWorks': 521,
};

export const tmdbRouter = express.Router();
tmdbRouter.use(requireAuth);

tmdbRouter.get('/status', async (req, res) => {
  const key = getApiKey();
  if (!key) return res.json({ configured: false });
  try {
    await tmdbFetch('/configuration', {}, { ttlMs: 5 * 60_000 });
    res.json({ configured: true, source: process.env.TMDB_API_KEY ? 'env' : 'settings' });
  } catch (err) {
    res.json({ configured: false, error: err.code || err.message });
  }
});

tmdbRouter.post('/api-key', requireRole('admin'), async (req, res, next) => {
  try {
    const { api_key } = req.body || {};
    if (!api_key || typeof api_key !== 'string') {
      return res.status(400).json({ error: 'api_key_required' });
    }
    const trimmed = api_key.trim();
    const testRes = await fetch(`${TMDB_BASE}/configuration?api_key=${encodeURIComponent(trimmed)}`);
    if (!testRes.ok) {
      return res.status(400).json({ error: 'invalid_api_key', status: testRes.status });
    }
    writeSettingsKey(trimmed, req.user.id);
    db.prepare('DELETE FROM tmdb_cache').run();
    clearGenreCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

tmdbRouter.delete('/api-key', requireRole('admin'), (req, res) => {
  if (process.env.TMDB_API_KEY) {
    return res.status(400).json({ error: 'api_key_from_env', message: 'Unset the TMDB_API_KEY env var to clear.' });
  }
  const table = tableFor('AppSettings');
  db.prepare(`DELETE FROM ${table} WHERE json_extract(data, '$.key') = ?`).run('tmdb');
  db.prepare('DELETE FROM tmdb_cache').run();
  clearGenreCache();
  res.json({ ok: true });
});

tmdbRouter.get('/genres', async (req, res, next) => {
  try {
    const movie = await getMovieGenres();
    const tv = await getTvGenres();
    res.json({
      movie: Object.values(movie.byId),
      series: Object.values(tv.byId),
    });
  } catch (err) { next(err); }
});

async function movieList(category, { genre, studio, page }) {
  const genres = await getMovieGenres();
  const needDiscover = !!studio;
  if (needDiscover || !['trending', 'popular', 'top_rated', 'upcoming', 'now_playing'].includes(category)) {
    const params = { page, sort_by: 'popularity.desc' };
    const gid = genre && genres.byName[genre.toLowerCase()];
    if (gid) params.with_genres = gid;
    const sid = studio && STUDIOS[studio];
    if (sid) params.with_companies = sid;
    const d = await tmdbFetch('/discover/movie', params);
    return (d.results || []).map((m) => normalizeMovie(m, genres));
  }
  const path = category === 'trending' ? '/trending/movie/week' : `/movie/${category}`;
  const d = await tmdbFetch(path, { page });
  let items = (d.results || []).map((m) => normalizeMovie(m, genres));
  if (genre) {
    const gid = genres.byName[genre.toLowerCase()];
    if (gid) items = items.filter((m) => (d.results.find((r) => String(r.id) === m.tmdb_id)?.genre_ids || []).includes(gid));
  }
  return items;
}

async function seriesList(category, { genre, network, page }) {
  const genres = await getTvGenres();
  const needDiscover = !!network;
  if (needDiscover || !['trending', 'popular', 'top_rated', 'upcoming', 'on_the_air'].includes(category)) {
    const params = { page, sort_by: 'popularity.desc' };
    const gid = genre && genres.byName[genre.toLowerCase()];
    if (gid) params.with_genres = gid;
    const nid = network && NETWORKS[network];
    if (nid) params.with_networks = nid;
    const d = await tmdbFetch('/discover/tv', params);
    return (d.results || []).map((s) => normalizeSeries(s, genres));
  }
  const pathMap = {
    trending: '/trending/tv/week',
    popular: '/tv/popular',
    top_rated: '/tv/top_rated',
    upcoming: '/tv/on_the_air', // TMDB has no "upcoming" for TV
    on_the_air: '/tv/on_the_air',
  };
  const d = await tmdbFetch(pathMap[category] || '/tv/popular', { page });
  let items = (d.results || []).map((s) => normalizeSeries(s, genres));
  if (genre) {
    const gid = genres.byName[genre.toLowerCase()];
    if (gid) items = items.filter((s) => (d.results.find((r) => String(r.id) === s.tmdb_id)?.genre_ids || []).includes(gid));
  }
  return items;
}

tmdbRouter.get('/discover', async (req, res, next) => {
  try {
    const { category = 'trending', media_type = 'all', genre, network, studio } = req.query;
    const page = Math.max(1, Math.min(500, Number(req.query.page) || 1));
    const wantMovies = media_type === 'all' || media_type === 'movie';
    const wantSeries = media_type === 'all' || media_type === 'series';
    const [movies, series] = await Promise.all([
      wantMovies ? movieList(category, { genre, studio, page }) : Promise.resolve([]),
      wantSeries ? seriesList(category, { genre, network, page }) : Promise.resolve([]),
    ]);
    res.json({ movies, series, page });
  } catch (err) { next(err); }
});

tmdbRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ movies: [], series: [] });
    const page = Math.max(1, Math.min(500, Number(req.query.page) || 1));
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
    const d = await tmdbFetch('/search/multi', { query: q, page, include_adult: false }, { ttlMs: 5 * 60_000 });
    const movies = [];
    const series = [];
    for (const r of d?.results || []) {
      if (r.media_type === 'movie') movies.push(normalizeMovie(r, movieGenres));
      else if (r.media_type === 'tv') series.push(normalizeSeries(r, tvGenres));
    }
    res.json({ movies, series, page });
  } catch (err) { next(err); }
});

function findUsCertification(releaseDates) {
  const us = releaseDates?.results?.find((r) => r.iso_3166_1 === 'US');
  const rd = us?.release_dates?.find((r) => r.certification);
  return rd?.certification || null;
}
function findUsContentRating(cr) {
  const us = cr?.results?.find((r) => r.iso_3166_1 === 'US');
  return us?.rating || null;
}
function findTrailer(videos) {
  const list = videos?.results || [];
  const official = list.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official);
  const any = list.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const v = official || any;
  return v ? `https://www.youtube.com/watch?v=${v.key}` : null;
}

tmdbRouter.get('/movie/:tmdbId', async (req, res, next) => {
  try {
    const data = await tmdbFetch(`/movie/${req.params.tmdbId}`, {
      append_to_response: 'credits,videos,release_dates,external_ids',
    }, { ttlMs: 6 * 60 * 60_000 });
    res.json({
      media_type: 'movie',
      tmdb_id: String(data.id),
      imdb_id: data.imdb_id || data.external_ids?.imdb_id || null,
      title: data.title,
      original_title: data.original_title,
      year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
      overview: data.overview || '',
      rating: data.vote_average || 0,
      vote_count: data.vote_count || 0,
      runtime: data.runtime || null,
      genres: (data.genres || []).map((g) => g.name),
      poster_url: poster(data.poster_path),
      backdrop_url: backdrop(data.backdrop_path, 'original'),
      original_language: data.original_language,
      certification: findUsCertification(data.release_dates),
      studio: data.production_companies?.[0]?.name || null,
      collection_tmdb_id: data.belongs_to_collection?.id ? String(data.belongs_to_collection.id) : null,
      collection_name: data.belongs_to_collection?.name || null,
      release_date: data.release_date,
      status: data.status,
      trailer_url: findTrailer(data.videos),
      total_seasons: 0,
    });
  } catch (err) { next(err); }
});

tmdbRouter.get('/series/:tmdbId', async (req, res, next) => {
  try {
    const data = await tmdbFetch(`/tv/${req.params.tmdbId}`, {
      append_to_response: 'credits,videos,content_ratings,external_ids',
    }, { ttlMs: 6 * 60 * 60_000 });
    res.json({
      media_type: 'series',
      tmdb_id: String(data.id),
      imdb_id: data.external_ids?.imdb_id || null,
      tvdb_id: data.external_ids?.tvdb_id ? String(data.external_ids.tvdb_id) : null,
      title: data.name,
      original_title: data.original_name,
      year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) : null,
      overview: data.overview || '',
      rating: data.vote_average || 0,
      vote_count: data.vote_count || 0,
      runtime: data.episode_run_time?.[0] || null,
      genres: (data.genres || []).map((g) => g.name),
      poster_url: poster(data.poster_path),
      backdrop_url: backdrop(data.backdrop_path, 'original'),
      original_language: data.original_language,
      certification: findUsContentRating(data.content_ratings),
      network: data.networks?.[0]?.name || null,
      total_seasons: data.number_of_seasons || 0,
      total_episodes: data.number_of_episodes || 0,
      seasons: (data.seasons || [])
        .filter((s) => typeof s.season_number === 'number' && s.season_number > 0)
        .map((s) => ({
          season_number: s.season_number,
          episode_count: s.episode_count,
          air_date: s.air_date,
          name: s.name,
          overview: s.overview,
          poster_url: poster(s.poster_path, 'w342'),
        })),
      first_air_date: data.first_air_date,
      last_air_date: data.last_air_date,
      status: data.status,
      trailer_url: findTrailer(data.videos),
    });
  } catch (err) { next(err); }
});

tmdbRouter.use((err, req, res, next) => {
  if (err && err.status) {
    return res.status(err.status).json({ error: err.code || err.message });
  }
  console.error('[tmdb]', err);
  res.status(500).json({ error: 'internal_error' });
});
