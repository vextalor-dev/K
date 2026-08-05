// ============================================================
// K - TMDB proxy (Cloudflare Pages Function)
// Serves: /api/tmdb/*
// ============================================================

const CACHE_TTL = 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cloudflare Pages Functions share memory within a single Worker instance.
const cache = new Map();

export async function onRequest(context) {
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const TMDB_API_KEY = context.env.TMDB_API_KEY;
  if (!TMDB_API_KEY) {
    return new Response(JSON.stringify({ error: 'TMDB_API_KEY is not set.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const apiPath = url.pathname
    .replace(/^\/api\/tmdb\/?/, '')
    .replace(/\/+$/, '');
  if (!apiPath) {
    return new Response(
      JSON.stringify({ error: 'Bad request: missing TMDB path.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const qs = new URLSearchParams(url.search);
  qs.set('api_key', TMDB_API_KEY);
  if (!qs.get('language')) qs.set('language', 'en-US');
  const tmdbUrl = `https://api.themoviedb.org/3/${apiPath}?${qs.toString()}`;

  const hit = cache.get(tmdbUrl);
  if (hit && hit.expires > Date.now()) {
    return new Response(JSON.stringify(hit.body), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(tmdbUrl, {
        headers: { accept: 'application/json' },
      });
      if (!upstream.ok) {
        lastError = { status: upstream.status, text: upstream.statusText };
        if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) {
          await sleep(600);
          continue;
        }
        break;
      }
      const body = await upstream.json();
      cache.set(tmdbUrl, { expires: Date.now() + CACHE_TTL, body });
      return new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await sleep(600);
        continue;
      }
      break;
    }
  }

  const stale = cache.get(tmdbUrl);
  if (stale) {
    return new Response(JSON.stringify(stale.body), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      error: 'TMDB upstream request failed',
      detail: String((lastError && lastError.status) || lastError || 'network error'),
    }),
    { status: 502, headers: { 'Content-Type': 'application/json' } },
  );
}
