import express from 'express';
import { db, newId, tableFor, hydrate } from './db.js';
import { ENTITIES } from './schemas.js';
import { requireAuth } from './auth.js';

export const entitiesRouter = express.Router();

entitiesRouter.use(requireAuth);

function assertKnownEntity(entity) {
  if (!ENTITIES.includes(entity)) {
    const err = new Error(`unknown entity: ${entity}`);
    err.status = 404;
    throw err;
  }
}

function buildFilterClause(filter) {
  if (!filter || typeof filter !== 'object') return { where: '', params: [] };
  const keys = Object.keys(filter);
  if (keys.length === 0) return { where: '', params: [] };
  const clauses = [];
  const params = [];
  for (const key of keys) {
    const val = filter[key];
    if (key === 'id') {
      clauses.push('id = ?');
      params.push(val);
      continue;
    }
    if (val === null) {
      clauses.push(`json_extract(data, '$.${key}') IS NULL`);
      continue;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        clauses.push('1 = 0');
        continue;
      }
      const placeholders = val.map(() => '?').join(', ');
      clauses.push(`json_extract(data, '$.${key}') IN (${placeholders})`);
      params.push(...val);
      continue;
    }
    if (typeof val === 'boolean') {
      clauses.push(`(json_extract(data, '$.${key}') = ? OR json_extract(data, '$.${key}') = ?)`);
      params.push(val ? 1 : 0, val ? 'true' : 'false');
      continue;
    }
    clauses.push(`json_extract(data, '$.${key}') = ?`);
    params.push(val);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function buildOrderClause(sort) {
  if (!sort) return 'ORDER BY created_date DESC';
  let desc = false;
  let field = String(sort);
  if (field.startsWith('-')) {
    desc = true;
    field = field.slice(1);
  }
  if (field === 'created_date' || field === 'updated_date') {
    return `ORDER BY ${field} ${desc ? 'DESC' : 'ASC'}`;
  }
  return `ORDER BY json_extract(data, '$.${field}') ${desc ? 'DESC' : 'ASC'}`;
}

function runList(entity, { filter, sort, limit } = {}) {
  const table = tableFor(entity);
  const { where, params } = buildFilterClause(filter);
  const order = buildOrderClause(sort);
  const lim = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? `LIMIT ${Math.min(Math.floor(Number(limit)), 5000)}`
    : 'LIMIT 1000';
  const stmt = db.prepare(`SELECT * FROM ${table} ${where} ${order} ${lim}`);
  return stmt.all(...params).map(hydrate);
}

entitiesRouter.get('/:entity', (req, res) => {
  const { entity } = req.params;
  assertKnownEntity(entity);
  const filter = req.query.filter ? safeJson(req.query.filter) : undefined;
  res.json(runList(entity, { filter, sort: req.query.sort, limit: req.query.limit }));
});

entitiesRouter.post('/:entity/query', (req, res) => {
  const { entity } = req.params;
  assertKnownEntity(entity);
  const { filter, sort, limit } = req.body || {};
  res.json(runList(entity, { filter, sort, limit }));
});

entitiesRouter.get('/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  assertKnownEntity(entity);
  const row = db.prepare(`SELECT * FROM ${tableFor(entity)} WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(hydrate(row));
});

entitiesRouter.post('/:entity', (req, res) => {
  const { entity } = req.params;
  assertKnownEntity(entity);
  const body = req.body || {};
  const id = body.id || newId();
  const now = new Date().toISOString();
  const data = { ...body };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;
  delete data.created_by;
  db.prepare(
    `INSERT INTO ${tableFor(entity)} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, JSON.stringify(data), now, now, req.user.id);
  res.status(201).json(hydrate(db.prepare(`SELECT * FROM ${tableFor(entity)} WHERE id = ?`).get(id)));
});

entitiesRouter.patch('/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  assertKnownEntity(entity);
  const table = tableFor(entity);
  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const prev = JSON.parse(existing.data);
  const patch = { ...(req.body || {}) };
  delete patch.id;
  delete patch.created_date;
  delete patch.updated_date;
  delete patch.created_by;
  const next = { ...prev, ...patch };
  const now = new Date().toISOString();
  db.prepare(`UPDATE ${table} SET data = ?, updated_date = ? WHERE id = ?`).run(
    JSON.stringify(next),
    now,
    id,
  );
  res.json(hydrate(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)));
});

entitiesRouter.delete('/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  assertKnownEntity(entity);
  db.prepare(`DELETE FROM ${tableFor(entity)} WHERE id = ?`).run(id);
  res.json({ ok: true });
});

entitiesRouter.use((err, req, res, next) => {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  next(err);
});

function safeJson(s) {
  try { return JSON.parse(s); } catch { return undefined; }
}
