const express = require('express');
const path = require('path');
const { TMDB_API_KEY } = require('./config');

const app = express();
const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_CTRL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

const cache = new Map();

// Best-effort per-IP sliding-window rate limit (mirrors api/tmdb.js).
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 150;
const MAX_RATE_ENTRIES = 5000;
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > MAX_RATE_ENTRIES) {
    for (const key of hits.keys()) {
      hits.delete(key);
      if (hits.size <= MAX_RATE_ENTRIES / 2) break;
    }
  }
  return false;
}

function trimCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = Array.from(cache.entries()).sort((a, b) => a[1].expires - b[1].expires);
  for (const [k] of oldest.slice(0, MAX_CACHE_ENTRIES / 2)) cache.delete(k);
}

function normalizeApiPath(p) {
  const clean = String(p || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean || clean.length > 200) return null;
  if (clean.split('/').some((seg) => seg === '..')) return null;
  return clean;
}

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// TMDB proxy
app.get(['/api/tmdb', '/api/tmdb/*'], async (req, res) => {
  if (!TMDB_API_KEY) {
    return res.status(500).json({
      error: 'TMDB_API_KEY is not set. Add it to the project environment variables (Vercel -> Settings -> Environment Variables -> TMDB_API_KEY).',
    });
  }

  const apiPath = normalizeApiPath(req.params[0]);
  if (apiPath == null) return res.status(400).json({ error: 'Bad request: missing TMDB path.' });

  if (isRateLimited(clientIp(req))) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }

  const qs = new URLSearchParams(req.query);
  qs.set('api_key', TMDB_API_KEY);
  if (!qs.get('language')) qs.set('language', 'en-US');
  const url = `${TMDB_BASE}/${apiPath}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    res.set('Cache-Control', CACHE_CTRL);
    return res.json(hit.body);
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(url, { headers: { accept: 'application/json' } });
      if (!upstream.ok) {
        lastError = { status: upstream.status };
        if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) {
          await sleep(600);
          continue;
        }
        break;
      }
      const body = await upstream.json();
      cache.set(url, { expires: Date.now() + CACHE_TTL, body });
      trimCache();
      res.set('Cache-Control', CACHE_CTRL);
      return res.json(body);
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await sleep(600);
        continue;
      }
      break;
    }
  }

  const stale = cache.get(url);
  if (stale) {
    res.set('Cache-Control', CACHE_CTRL);
    return res.json(stale.body);
  }

  const detail =
    lastError && typeof lastError === 'object' && Number.isFinite(lastError.status)
      ? lastError.status
      : undefined;
  res.status(502).json(
    detail != null
      ? { error: 'TMDB upstream request failed', detail }
      : { error: 'TMDB upstream request failed' }
  );
});

// App shell
app.get(['/', '/watch'], (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// SPA fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
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
