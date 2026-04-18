import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, newId, tableFor, hydrate } from './db.js';

const DATA_DIR = process.env.NEXUS_DATA_DIR || '/data';

const JWT_SECRET = process.env.NEXUS_JWT_SECRET || (() => {
  const fallback = process.env.NEXUS_FALLBACK_SECRET_PATH || path.join(DATA_DIR, '.jwt-secret');
  try {
    if (fs.existsSync(fallback)) return fs.readFileSync(fallback, 'utf8').trim();
    const val = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    fs.writeFileSync(fallback, val, { mode: 0o600 });
    return val;
  } catch {
    return crypto.randomBytes(48).toString('hex');
  }
})();

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function userRow(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function userByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
}

function userCount() {
  return db.prepare('SELECT COUNT(*) as n FROM users').get().n;
}

function loadProfile(user) {
  if (!user) return null;
  const table = tableFor('UserProfile');
  let row = null;
  if (user.profile_id) {
    row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(user.profile_id);
  }
  if (!row) {
    // match by email as a fallback
    row = db.prepare(`SELECT * FROM ${table} WHERE json_extract(data, '$.email') = ?`).get(user.email);
    if (row) {
      db.prepare('UPDATE users SET profile_id = ? WHERE id = ?').run(row.id, user.id);
    }
  }
  if (!row) {
    const profileId = newId();
    const now = new Date().toISOString();
    const data = {
      email: user.email,
      display_name: user.full_name || user.email,
      role: user.role,
      auto_approve: user.role === 'admin',
      max_requests: user.role === 'admin' ? 0 : 10,
      allowed_media_types: 'both',
      request_count: 0,
      permissions: defaultPermissions(user.role),
    };
    db.prepare(
      `INSERT INTO ${table} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
    ).run(profileId, JSON.stringify(data), now, now, user.id);
    db.prepare('UPDATE users SET profile_id = ? WHERE id = ?').run(profileId, user.id);
    row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(profileId);
  }
  return hydrate(row);
}

function defaultPermissions(role) {
  const adminPerms = {
    can_request_movies: true,
    can_request_series: true,
    can_request_partial_seasons: true,
    can_auto_approve: true,
    can_manage_library: true,
    can_run_searches: true,
    can_manual_import: true,
    can_delete_files: true,
    can_edit_settings: true,
    can_manage_users: true,
  };
  if (role === 'admin') return adminPerms;
  if (role === 'manager') return { ...adminPerms, can_edit_settings: false, can_manage_users: false };
  if (role === 'readonly') return {};
  if (role === 'restricted') return { can_request_movies: true };
  return {
    can_request_movies: true,
    can_request_series: true,
    can_request_partial_seasons: true,
  };
}

function issueToken(user) {
  const jti = newId();
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, jti },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS },
  );
  db.prepare(
    'INSERT INTO sessions (jti, user_id, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, 0)',
  ).run(
    jti,
    user.id,
    new Date().toISOString(),
    new Date((now + TOKEN_TTL_SECONDS) * 1000).toISOString(),
  );
  return token;
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = db
      .prepare('SELECT * FROM sessions WHERE jti = ?')
      .get(decoded.jti);
    if (!session || session.revoked) return null;
    return decoded;
  } catch {
    return null;
  }
}

function meResponse(user) {
  const profile = loadProfile(user);
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name || profile?.display_name || user.email,
    display_name: profile?.display_name || user.full_name || user.email,
    role: user.role,
    auto_approve: profile?.auto_approve ?? (user.role === 'admin'),
    max_requests: profile?.max_requests ?? 10,
    allowed_media_types: profile?.allowed_media_types ?? 'both',
    permissions: profile?.permissions ?? defaultPermissions(user.role),
    profile_id: user.profile_id,
  };
}

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  if (req.cookies?.nexus_token) return req.cookies.nexus_token;
  return null;
}

export function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  const decoded = verifyToken(token);
  if (!decoded) return next();
  const row = userRow(decoded.sub);
  if (!row) return next();
  req.user = row;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

export const authRouter = express.Router();

authRouter.get('/setup', (req, res) => {
  res.json({ needs_setup: userCount() === 0 });
});

authRouter.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

  const isFirst = userCount() === 0;
  if (!isFirst) {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  }

  if (userByEmail(email)) return res.status(409).json({ error: 'email already registered' });

  const id = newId();
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const role = isFirst ? 'admin' : (req.body.role || 'standard');
  db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, email, hash, full_name || null, role, now, now);

  const user = userRow(id);
  loadProfile(user);
  const token = issueToken(user);
  res
    .cookie('nexus_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.protocol === 'https',
      maxAge: TOKEN_TTL_SECONDS * 1000,
    })
    .json({ token, user: meResponse(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const row = userByEmail(email);
  if (!row) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = issueToken(row);
  res
    .cookie('nexus_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.protocol === 'https',
      maxAge: TOKEN_TTL_SECONDS * 1000,
    })
    .json({ token, user: meResponse(row) });
});

authRouter.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      db.prepare('UPDATE sessions SET revoked = 1 WHERE jti = ?').run(decoded.jti);
    } catch { /* ignore */ }
  }
  res.clearCookie('nexus_token').json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(meResponse(req.user));
});

export { meResponse, userCount };
