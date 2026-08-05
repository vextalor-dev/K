const { TMDB_API_KEY } = require('../config');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Edge cache directive: lets the Vercel CDN absorb identical requests
// for an hour (plus stale-while-revalidate), which is the biggest
// protection against someone draining the TMDB quota.
const CACHE_CTRL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

// In-memory cache. Note: on serverless this is per-instance and
// ephemeral, so treat it as a bonus, not a guarantee.
const cache = new Map();

// Best-effort per-IP sliding-window rate limit. Serverless instances
// are ephemeral/parallel so this is NOT a hard guarantee, but it is a
// cheap layer (on top of the CDN cache) that blunts quota drains.
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
  // keep the map bounded
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

// Extract the TMDB path from the request URL (e.g. "trending/movie/day").
// Tolerant of leading/trailing slashes and of the function being invoked
// with or without the /api/tmdb prefix, but rejects empty, oversized and
// parent-directory ("..") paths.
function apiPathOf(req) {
  const raw = String((req.url || '').split('?')[0] || '');
  const clean = raw
    .replace(/^\/api\/tmdb\/?/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!clean || clean.length > 200) return null;
  if (clean.split('/').some((seg) => seg === '..')) return null;
  return clean;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!TMDB_API_KEY) {
    return res.status(500).json({
      error: 'TMDB_API_KEY is not set. Add it to the project environment variables (Vercel -> Settings -> Environment Variables -> TMDB_API_KEY).',
    });
  }

  const apiPath = apiPathOf(req);
  if (apiPath == null) {
    return res.status(400).json({ error: 'Bad request: missing or invalid TMDB path.' });
  }

  if (isRateLimited(clientIp(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }

  const qs = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
  // api_key is always overwritten with the server-side key; the client
  // can never supply/override it.
  qs.set('api_key', TMDB_API_KEY);
  if (!qs.get('language')) qs.set('language', 'en-US');
  const url = `${TMDB_BASE}/${apiPath}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    res.setHeader('Cache-Control', CACHE_CTRL);
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
      res.setHeader('Cache-Control', CACHE_CTRL);
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
    res.setHeader('Cache-Control', CACHE_CTRL);
    return res.json(stale.body);
  }

  // Only surface a numeric upstream status code - never raw error text
  // (avoids leaking fetch internals / URLs that embed the api_key).
  const detail =
    lastError && typeof lastError === 'object' && Number.isFinite(lastError.status)
      ? lastError.status
      : undefined;
  res.status(502).json(
    detail != null
      ? { error: 'TMDB upstream request failed', detail }
      : { error: 'TMDB upstream request failed' }
  );
};
