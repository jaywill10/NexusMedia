import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authRouter, authMiddleware, userCount } from './auth.js';
import { entitiesRouter } from './entities.js';
import { tmdbRouter } from './tmdb.js';
import { mediaServersRouter } from './mediaservers.js';
import { indexersRouter, searchRouter } from './indexers.js';
import { importsRouter } from './imports.js';
import { ENTITIES } from './schemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || process.env.NEXUS_PORT || 8080);
const STATIC_DIR = process.env.NEXUS_STATIC_DIR || path.resolve(__dirname, '..', 'dist');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: process.env.NEXUS_VERSION || 'dev',
    users: userCount(),
    entities: ENTITIES,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/mediaservers', mediaServersRouter);
app.use('/api/indexers', indexersRouter);
app.use('/api/search', searchRouter);
app.use('/api/imports', importsRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexHtml = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
    next();
  });
} else {
  console.warn(`[nexus] static dir not found at ${STATIC_DIR} — API-only mode`);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[nexus] listening on :${PORT}`);
  if (userCount() === 0) {
    console.log('[nexus] first-run: open the UI to create the admin account');
  }
});
