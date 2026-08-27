const { TMDB_API_KEY, TMDB_BEARER } = require('../config');
const { clientIp, isRateLimited, apiPathFromUrl, proxyTMDB } = require('./_lib/tmdb');

function apiPathOf(req) {
  return apiPathFromUrl(req.url);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });



  const apiPath = apiPathOf(req);
  if (apiPath == null) {
    return res.status(400).json({ error: 'Bad request: missing or invalid TMDB path.' });
  }

  if (isRateLimited(clientIp(req))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }

  if (!TMDB_API_KEY && !TMDB_BEARER) {
    return res.status(500).json({ error: 'TMDB_API_KEY or TMDB_BEARER is not set.' });
  }
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const result = await proxyTMDB({ apiPath, queryString, tmdbApiKey: TMDB_API_KEY, tmdbBearer: TMDB_BEARER });
  if (result.error) {
    const detail = result.lastError && typeof result.lastError === 'object' && Number.isFinite(result.lastError.status) ? result.lastError.status : undefined;
    return res.status(502).json(detail != null ? { error: 'TMDB upstream request failed', detail } : { error: 'TMDB upstream request failed' });
  }
  res.setHeader('Cache-Control', result.cacheCtrl);
  return res.json(result.body);
};
