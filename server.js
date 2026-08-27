const express = require('express');
const path = require('path');
let compression;
try { compression = require('compression'); } catch { compression = () => (req, res, next) => next(); }
const { TMDB_API_KEY, TMDB_BEARER } = require('./config');
const { clientIp, isRateLimited, normalizeApiPath, proxyTMDB } = require('./api/_lib/tmdb');

const app = express();

const publicDir = path.join(__dirname, 'public');

// Security + parsing middleware
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  // CSP is set via vercel.json/_headers for static, but also set here for dynamic
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

app.use(express.static(publicDir, {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Health check (no auth, no rate limit)
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, uptime: process.uptime(), version: require('./package.json').version, tmdb: !!(TMDB_API_KEY || TMDB_BEARER) });
});

// TMDB proxy — delegates to shared logic in api/_lib/tmdb.js
app.get(['/api/tmdb', '/api/tmdb/*'], async (req, res) => {
  if (!TMDB_API_KEY && !TMDB_BEARER) {
    return res.status(500).json({
      error: 'TMDB_API_KEY or TMDB_BEARER is not set. Add it to the project environment variables (Vercel -> Settings -> Environment Variables -> TMDB_API_KEY).',
    });
  }
  const apiPath = normalizeApiPath(req.params[0]);
  if (apiPath == null) return res.status(400).json({ error: 'Bad request: missing TMDB path.' });
  if (isRateLimited(clientIp(req))) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }
  const queryString = new URLSearchParams(req.query).toString();
  const result = await proxyTMDB({ apiPath, queryString, tmdbApiKey: TMDB_API_KEY, tmdbBearer: TMDB_BEARER });
  if (result.error) {
    const detail = result.lastError && typeof result.lastError === 'object' && Number.isFinite(result.lastError.status) ? result.lastError.status : undefined;
    return res.status(502).json(detail != null ? { error: 'TMDB upstream request failed', detail } : { error: 'TMDB upstream request failed' });
  }
  res.set('Cache-Control', result.cacheCtrl);
  return res.json(result.body);
});

// App shell — serve index.html for all known SPA routes (History API)
const SPA_ROUTES = ['/', '/watch', '/movies', '/tv', '/anime', '/search', '/new', '/languages', '/kids', '/mylist', '/latest', '/terms', '/terms-of-use', '/reports'];
app.get([...SPA_ROUTES, '/title/:type/:id', '/browse/:id'], (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// SPA fallback — any other non-API path
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  // allow static files to 404 naturally
  if (req.path.includes('.') && !req.path.endsWith('.html')) return res.status(404).send('Not found');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

// Start server when run directly (not imported by Vercel)
if (require.main === module) {
  const { PORT } = require('./config');
  app.listen(PORT, () => {
    console.log(`K running at http://localhost:${PORT}`);
  });
}
