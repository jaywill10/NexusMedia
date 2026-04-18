import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ENTITIES } from './schemas.js';

const DATA_DIR = process.env.NEXUS_DATA_DIR || '/data';
const DB_PATH = process.env.NEXUS_DB_PATH || path.join(DATA_DIR, 'nexus.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'standard',
    profile_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    jti TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Create a table per entity. All entities share the same layout:
// id, data (JSON), created_date, updated_date, created_by.
// Actual field filtering is done with SQLite's json_extract.
for (const name of ENTITIES) {
  const table = tableFor(name);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_${table}_created ON ${table}(created_date);
    CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_date);
  `);
}

export function tableFor(entity) {
  // Entity names from Base44 are already PascalCase and safe, but we guard
  // just in case.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entity)) {
    throw new Error(`invalid entity name: ${entity}`);
  }
  return `entity_${entity}`;
}

export function newId() {
  return crypto.randomUUID();
}

export function hydrate(row) {
  if (!row) return null;
  const data = JSON.parse(row.data);
  return {
    ...data,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by || undefined,
  };
}
