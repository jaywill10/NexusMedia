import express from 'express';
import { db, newId, tableFor, hydrate } from './db.js';
import { requireAuth, requireRole } from './auth.js';

// ---------------------------------------------------------------------------
// Torznab / Newznab XML client
// ---------------------------------------------------------------------------

function parseTorznabXml(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const item = {};

    const titleM = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block);
    item.title = (titleM?.[1] || '').trim();

    // prefer <enclosure url="..."> for the download link
    const encM = /<enclosure\s[^>]*url="([^"]+)"[^>]*(?:length="(\d+)")?/.exec(block);
    item.link = encM?.[1] || '';
    if (encM?.[2]) item.size = Number(encM[2]);

    if (!item.size) {
      const sizeM = /<size>(\d+)<\/size>/.exec(block);
      if (sizeM) item.size = Number(sizeM[1]);
    }

    if (!item.link) {
      const linkM = /<link>(.*?)<\/link>/.exec(block);
      item.link = (linkM?.[1] || '').trim();
    }

    const pubM = /<pubDate>(.*?)<\/pubDate>/.exec(block);
    item.pubDate = pubM?.[1] || '';

    // torznab:attr / newznab:attr
    const attrRe = /<(?:torznab|newznab):attr\s+name="([^"]+)"\s+value="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(block)) !== null) {
      item[am[1]] = am[2];
    }

    if (item.title) items.push(item);
  }
  return items;
}

function parseCapsXml(xml) {
  const cats = [];
  const catRe = /<category\s+id="(\d+)"\s+name="([^"]+)"/g;
  let m;
  while ((m = catRe.exec(xml)) !== null) {
    cats.push({ id: m[1], name: m[2] });
  }
  return cats;
}

function parseQuality(title) {
  let quality = 'Unknown';
  let source = 'Unknown';
  if (/\b2160p\b/i.test(title)) quality = '2160p';
  else if (/\b1080p\b/i.test(title)) quality = '1080p';
  else if (/\b720p\b/i.test(title)) quality = '720p';
  else if (/\b576p\b/i.test(title)) quality = '576p';
  else if (/\b480p\b/i.test(title)) quality = '480p';

  if (/\bREMUX\b/i.test(title)) source = 'REMUX';
  else if (/BluRay|Blu-Ray|BDRip|BRRip/i.test(title)) source = 'BluRay';
  else if (/WEB-DL|WEBDL/i.test(title)) source = 'WEB-DL';
  else if (/WEBRip|WEB-Rip/i.test(title)) source = 'WEBRip';
  else if (/HDTV/i.test(title)) source = 'HDTV';
  else if (/DVDRip/i.test(title)) source = 'DVDRip';
  return { quality, source };
}

function pubDateToAgeHours(pubDate) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 3_600_000);
}

export async function torznabFetch(indexer, params) {
  // Strip any existing query string from the stored URL
  const base = indexer.url.split('?')[0].replace(/\/+$/, '');
  const qs = new URLSearchParams({ apikey: indexer.api_key || '', ...params });
  const res = await fetch(`${base}?${qs}`, {
    headers: { 'User-Agent': 'NexusMedia/1.0', Accept: 'application/rss+xml, text/xml, */*' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${indexer.name}`);
  return res.text();
}

export function normalizeRelease(item, indexerName, protocol) {
  const { quality, source } = parseQuality(item.title);
  const seeders = item.seeders != null ? parseInt(item.seeders, 10) : null;
  const peers = item.peers != null ? parseInt(item.peers, 10) : null;
  const leechers = peers != null && seeders != null ? Math.max(0, peers - seeders) : null;

  const rejections = [];
  if (protocol === 'torrent' && seeders !== null && seeders < 1) {
    rejections.push('No active seeders');
  }

  // Stable-ish ID derived from title+link so the UI can key on it
  const raw = `${indexerName}:${item.title}:${item.link || ''}`;
  const id = Buffer.from(raw).toString('base64url').slice(0, 20);

  return {
    id,
    release_name: item.title,
    indexer: indexerName,
    protocol,
    size: item.size || 0,
    age_hours: pubDateToAgeHours(item.pubDate),
    quality,
    source,
    seeders: seeders ?? undefined,
    leechers: leechers ?? undefined,
    custom_format_score: 0,
    accepted: rejections.length === 0,
    rejection_reasons: rejections,
    grabbed: false,
    download_url: item.link || null,
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function allIndexers() {
  const tbl = tableFor('Indexer');
  const rows = db.prepare(`SELECT * FROM "${tbl}" ORDER BY json_extract(data, '$.priority') ASC`).all();
  return rows.map(hydrate);
}

function getIndexer(id) {
  const tbl = tableFor('Indexer');
  const row = db.prepare(`SELECT * FROM "${tbl}" WHERE id = ?`).get(id);
  return row ? hydrate(row) : null;
}

function saveHealth(id, health_status, health_message) {
  const tbl = tableFor('Indexer');
  const now = new Date().toISOString();
  const row = db.prepare(`SELECT data FROM "${tbl}" WHERE id = ?`).get(id);
  if (!row) return;
  const data = { ...JSON.parse(row.data), health_status, health_message, last_sync: now };
  db.prepare(`UPDATE "${tbl}" SET data = ?, updated_date = ? WHERE id = ?`).run(JSON.stringify(data), now, id);
}

// ---------------------------------------------------------------------------
// Test a Torznab endpoint (draft or saved)
// ---------------------------------------------------------------------------

async function testIndexer(indexer) {
  const xml = await torznabFetch(indexer, { t: 'caps' });
  const cats = parseCapsXml(xml);
  if (!xml.includes('<caps>') && !xml.includes('<channel>')) {
    throw new Error('Response does not look like a Torznab caps reply');
  }
  return { ok: true, categories: cats };
}

// ---------------------------------------------------------------------------
// Fan-out search
// ---------------------------------------------------------------------------

export async function fanOutSearch(params, { onlyIds } = {}) {
  const indexers = allIndexers().filter(idx => {
    if (!idx.enabled) return false;
    if (onlyIds && !onlyIds.includes(idx.id)) return false;
    return true;
  });

  if (indexers.length === 0) return [];

  const results = await Promise.allSettled(
    indexers.map(async (idx) => {
      const xml = await torznabFetch(idx, params);
      const items = parseTorznabXml(xml);
      const protocol = idx.type === 'usenet' ? 'usenet' : 'torrent';
      return items.map(item => normalizeRelease(item, idx.name, protocol));
    })
  );

  const out = [];
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(...r.value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Express routers
// ---------------------------------------------------------------------------

export const indexersRouter = express.Router();
export const searchRouter = express.Router();

// All routes require auth; write routes require admin
indexersRouter.use(requireAuth);
searchRouter.use(requireAuth);

// GET /api/indexers/status — lightweight health list
indexersRouter.get('/status', (req, res) => {
  const indexers = allIndexers();
  res.json({
    indexers: indexers.map(({ id, name, type, url, enabled, health_status, health_message, last_sync, priority }) => ({
      id, name, type, url, enabled, health_status, health_message, last_sync, priority,
    })),
  });
});

// POST /api/indexers/test — test a draft (not yet saved)
indexersRouter.post('/test', requireRole('admin'), async (req, res) => {
  const { name = 'Draft', url, api_key, type = 'torrent' } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const result = await testIndexer({ name, url, api_key, type });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/indexers/:id/test — test a saved indexer
indexersRouter.post('/:id/test', requireRole('admin'), async (req, res) => {
  const idx = getIndexer(req.params.id);
  if (!idx) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await testIndexer(idx);
    saveHealth(idx.id, 'healthy', 'Caps check passed');
    res.json(result);
  } catch (err) {
    saveHealth(idx.id, 'error', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Search endpoints
// ---------------------------------------------------------------------------

// POST /api/search/manual — free-text query across all enabled indexers
searchRouter.post('/manual', async (req, res) => {
  const { q, indexer_ids, limit = 100 } = req.body;
  if (!q) return res.status(400).json({ error: 'q required' });
  try {
    const results = await fanOutSearch({ t: 'search', q }, { onlyIds: indexer_ids });
    res.json({ results: results.slice(0, limit) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/search/movie — search by TMDB ID (falls back to title search)
searchRouter.post('/movie', async (req, res) => {
  const { tmdb_id, imdb_id, title, year, indexer_ids, limit = 100 } = req.body;
  if (!tmdb_id && !imdb_id && !title) return res.status(400).json({ error: 'tmdb_id, imdb_id, or title required' });

  try {
    let results;
    if (imdb_id) {
      // Torznab movie search by IMDb ID
      results = await fanOutSearch({ t: 'movie', imdbid: imdb_id }, { onlyIds: indexer_ids });
    } else {
      // Fall back to free-text search with title + year
      const q = year ? `${title} ${year}` : title;
      results = await fanOutSearch({ t: 'search', q }, { onlyIds: indexer_ids });
    }
    res.json({ results: results.slice(0, limit) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/search/series — search TV by TVDB ID / season / episode
searchRouter.post('/series', async (req, res) => {
  const { tvdb_id, title, season, episode, indexer_ids, limit = 100 } = req.body;
  if (!tvdb_id && !title) return res.status(400).json({ error: 'tvdb_id or title required' });

  try {
    let results;
    if (tvdb_id) {
      const params = { t: 'tvsearch', tvdbid: tvdb_id };
      if (season != null) params.season = season;
      if (episode != null) params.ep = episode;
      results = await fanOutSearch(params, { onlyIds: indexer_ids });
    } else {
      const q = [title, season != null ? `S${String(season).padStart(2, '0')}` : ''].filter(Boolean).join(' ');
      results = await fanOutSearch({ t: 'search', q }, { onlyIds: indexer_ids });
    }
    res.json({ results: results.slice(0, limit) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
