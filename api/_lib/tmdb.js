// Shared TMDB proxy logic — used by Express (server.js) and Vercel (api/tmdb.js)
// Cloudflare Pages has its own copy at functions/api/tmdb/[[path]].js (ESM)

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CACHE_CTRL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

const cache = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 150;
const MAX_RATE_ENTRIES = 5000;
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || req.ip || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > MAX_RATE_ENTRIES) {
    for (const k of hits.keys()) { hits.delete(k); if (hits.size <= MAX_RATE_ENTRIES / 2) break; }
  }
  return false;
}

function trimCache() {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldest = Array.from(cache.entries()).sort((a, b) => a[1].expires - b[1].expires);
  for (const [k] of oldest.slice(0, MAX_CACHE_ENTRIES / 2)) cache.delete(k);
}

function normalizeApiPath(raw) {
  const clean = String(raw || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean || clean.length > 200) return null;
  if (clean.split('/').some((s) => s === '..')) return null;
  if (/[^a-zA-Z0-9/_-]/.test(clean)) return null;
  return clean;
}

function apiPathFromUrl(urlStr) {
  const raw = String((urlStr || '').split('?')[0] || '');
  const clean = raw.replace(/^\/api\/tmdb\/?/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return normalizeApiPath(clean);
}

async function proxyTMDB({ apiPath, queryString, tmdbApiKey, tmdbBearer }) {
  const qs = new URLSearchParams(queryString || '');
  // Prefer v4 Bearer token if available — more secure and not logged in querystrings
  const useBearer = !!tmdbBearer;
  if (!useBearer) qs.set('api_key', tmdbApiKey);
  if (!qs.get('language')) qs.set('language', 'en-US');
  const url = `${TMDB_BASE}/${apiPath}?${qs.toString()}`;
  // cache key includes bearer mode so keys don't collide
  const cacheKey = useBearer ? `bearer:${url}` : url;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return { cached: true, body: hit.body, cacheCtrl: CACHE_CTRL };
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const headers = { accept: 'application/json' };
      if (useBearer) headers.Authorization = `Bearer ${tmdbBearer}`;
      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        lastError = { status: upstream.status };
        if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) { await sleep(600); continue; }
        break;
      }
      const body = await upstream.json();
      cache.set(cacheKey, { expires: Date.now() + CACHE_TTL, body });
      trimCache();
      return { cached: false, body, cacheCtrl: CACHE_CTRL };
    } catch (err) { lastError = err; if (attempt === 0) { await sleep(600); continue; } break; }
  }
  const stale = cache.get(cacheKey);
  if (stale) return { cached: true, body: stale.body, cacheCtrl: CACHE_CTRL, stale: true };
  return { error: true, lastError };
}

module.exports = {
  TMDB_BASE, CACHE_TTL, CACHE_CTRL, cache, hits,
  clientIp, isRateLimited, trimCache, normalizeApiPath, apiPathFromUrl, proxyTMDB, sleep,
};
