// ============================================================
// K - TMDB proxy (Cloudflare Pages Function)
// Serves: /api/tmdb/* — supports both v3 api_key and v4 Bearer
// ============================================================

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
  if (hits.size > 5000) { for (const k of hits.keys()) { hits.delete(k); if (hits.size <= 2500) break; } }
  return false;
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const TMDB_API_KEY = context.env.TMDB_API_KEY;
  const TMDB_BEARER = context.env.TMDB_BEARER_TOKEN || context.env.TMDB_API_BEARER;
  if (!TMDB_API_KEY && !TMDB_BEARER) {
    return new Response(JSON.stringify({ error: 'TMDB_API_KEY or TMDB_BEARER_TOKEN is not set.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = context.request.headers.get('CF-Connecting-IP') || context.request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip.split(',')[0].trim())) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again shortly.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  const url = new URL(context.request.url);
  let apiPath = url.pathname.replace(/^\/api\/tmdb\/?/, '').replace(/\/+$/, '');
  if (!apiPath || apiPath.length > 200 || apiPath.split('/').some((s) => s === '..')) {
    return new Response(JSON.stringify({ error: 'Bad request: missing or invalid TMDB path.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const qs = new URLSearchParams(url.search);
  const useBearer = !!TMDB_BEARER;
  if (useBearer) {
    // do not leak api_key if bearer present — strip any client-supplied one
    qs.delete('api_key');
  } else {
    qs.set('api_key', TMDB_API_KEY);
  }
  if (!qs.get('language')) qs.set('language', 'en-US');
  const tmdbUrl = `https://api.themoviedb.org/3/${apiPath}?${qs.toString()}`;
  const cacheKey = useBearer ? `bearer:${tmdbUrl}` : tmdbUrl;

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return new Response(JSON.stringify(hit.body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } });
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const headers = { accept: 'application/json' };
      if (useBearer) headers.Authorization = `Bearer ${TMDB_BEARER}`;
      const upstream = await fetch(tmdbUrl, { headers });
      if (!upstream.ok) {
        lastError = { status: upstream.status, text: upstream.statusText };
        if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) { await sleep(600); continue; }
        break;
      }
      const body = await upstream.json();
      cache.set(cacheKey, { expires: Date.now() + CACHE_TTL, body });
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } });
    } catch (err) {
      lastError = err;
      if (attempt === 0) { await sleep(600); continue; }
      break;
    }
  }

  const stale = cache.get(cacheKey);
  if (stale) {
    return new Response(JSON.stringify(stale.body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
  }

  return new Response(JSON.stringify({ error: 'TMDB upstream request failed', detail: String((lastError && lastError.status) || lastError || 'network error') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
}
