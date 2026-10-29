// ============================================================
// Cloudflare Pages Advanced Mode Worker (_worker.js)
// Handles /api/tmdb/* proxying and delegates static assets to env.ASSETS
// ============================================================

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = 60 * 60 * 1000;
const RATE_WINDOW = 60 * 1000;
const RATE_LIMIT = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cache = new Map();
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  if (arr.length >= RATE_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= 2500) break;
    }
  }
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/api/health') {
      const hasKey = !!(env.TMDB_API_KEY || env.TMDB_BEARER_TOKEN || env.TMDB_API_BEARER);
      return new Response(JSON.stringify({
        ok: true,
        tmdb: hasKey,
        platform: 'cloudflare-pages-worker'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    // TMDB API Proxy
    if (url.pathname.startsWith('/api/tmdb')) {
      if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const TMDB_API_KEY = env.TMDB_API_KEY || '7f1744eb03153962f13f178d89036a40';
      const TMDB_BEARER = env.TMDB_BEARER_TOKEN || env.TMDB_API_BEARER;

      if (!TMDB_API_KEY && !TMDB_BEARER) {
        return new Response(JSON.stringify({
          error: 'TMDB_API_KEY or TMDB_BEARER_TOKEN is not set.',
          message: 'Please set TMDB_API_KEY in Cloudflare Pages -> Settings -> Environment Variables.'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        });
      }

      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
      if (isRateLimited(ip.split(',')[0].trim())) {
        return new Response(JSON.stringify({ error: 'Too many requests. Try again shortly.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
        });
      }

      let apiPath = url.pathname.replace(/^\/api\/tmdb\/?/, '').replace(/\/+$/, '');
      if (!apiPath || apiPath.length > 200 || apiPath.split('/').some((s) => s === '..')) {
        return new Response(JSON.stringify({ error: 'Bad request: missing or invalid TMDB path.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const qs = new URLSearchParams(url.search);
      const useBearer = !!TMDB_BEARER;
      if (useBearer) {
        qs.delete('api_key');
      } else {
        qs.set('api_key', TMDB_API_KEY);
      }
      if (!qs.get('language')) qs.set('language', 'en-US');
      const tmdbUrl = `${TMDB_BASE}/${apiPath}?${qs.toString()}`;
      const cacheKey = useBearer ? `bearer:${tmdbUrl}` : tmdbUrl;

      const hit = cache.get(cacheKey);
      if (hit && hit.expires > Date.now()) {
        return new Response(JSON.stringify(hit.body), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
          }
        });
      }

      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const headers = { accept: 'application/json' };
          if (useBearer) headers.Authorization = `Bearer ${TMDB_BEARER}`;
          const upstream = await fetch(tmdbUrl, { headers });
          if (!upstream.ok) {
            lastError = { status: upstream.status, text: upstream.statusText };
            if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) {
              await sleep(600);
              continue;
            }
            break;
          }
          const body = await upstream.json();
          cache.set(cacheKey, { expires: Date.now() + CACHE_TTL, body });
          return new Response(JSON.stringify(body), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
            }
          });
        } catch (err) {
          lastError = err;
          if (attempt === 0) { await sleep(600); continue; }
          break;
        }
      }

      const stale = cache.get(cacheKey);
      if (stale) {
        return new Response(JSON.stringify(stale.body), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
        });
      }

      return new Response(JSON.stringify({
        error: 'TMDB upstream request failed',
        detail: String((lastError && lastError.status) || lastError || 'network error')
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default: Serve static assets
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
