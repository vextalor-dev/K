const { TMDB_API_KEY } = require('../config');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const CACHE_TTL = 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cache = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDB_API_KEY is not set.' });
  }

  const apiPath = String(req.url.split('?')[0].replace(/^\/api\/tmdb\/?/, '')).replace(/\/+$/, '');
  if (!apiPath) return res.status(400).json({ error: 'Bad request: missing TMDB path.' });

  const qs = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
  qs.set('api_key', TMDB_API_KEY);
  if (!qs.get('language')) qs.set('language', 'en-US');
  const url = `${TMDB_BASE}/${apiPath}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(hit.body);
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const upstream = await fetch(url, { headers: { accept: 'application/json' } });
      if (!upstream.ok) {
        lastError = { status: upstream.status, text: upstream.statusText };
        if ((upstream.status === 429 || upstream.status >= 500) && attempt === 0) {
          await sleep(600);
          continue;
        }
        break;
      }
      const body = await upstream.json();
      cache.set(url, { expires: Date.now() + CACHE_TTL, body });
      res.setHeader('Cache-Control', 'public, max-age=3600');
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
  if (stale) return res.json(stale.body);

  res.status(502).json({
    error: 'TMDB upstream request failed',
    detail: String((lastError && lastError.status) || lastError || 'network error')
  });
};
