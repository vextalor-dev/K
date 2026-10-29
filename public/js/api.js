// ============================================================
// K - api.js
// Thin client for TMDB proxy with fallback to direct TMDB API
// and in-memory cache to keep requests low.
// ============================================================

const cache = new Map(); // key -> { exp, data }
const TTL = 10 * 60 * 1000;
const TMDB_DIRECT_BASE = 'https://api.themoviedb.org/3';
const DEFAULT_TMDB_KEY = '7f1744eb03153962f13f178d89036a40';

export function getLocalApiKey() {
  try {
    return (
      (typeof localStorage !== 'undefined' && localStorage.getItem('tmdb_api_key')) ||
      (typeof window !== 'undefined' && window.TMDB_API_KEY) ||
      DEFAULT_TMDB_KEY
    );
  } catch {
    return DEFAULT_TMDB_KEY;
  }
}

export function setLocalApiKey(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (key && key.trim()) {
        localStorage.setItem('tmdb_api_key', key.trim());
      } else {
        localStorage.removeItem('tmdb_api_key');
      }
    }
  } catch {}
}

export async function fetchTMDB(path, params = {}) {
  const qs = new URLSearchParams({ language: 'en-US', ...params });
  const key = `${path}?${qs.toString()}`;

  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;

  const localKey = getLocalApiKey();
  let data;
  let useDirect = false;
  let errorReason = '';

  // 1. Try server-side proxy
  try {
    const res = await fetch(`/api/tmdb/${path}?${qs.toString()}`);
    const ctype = res.headers.get('content-type') || '';

    // If server returned HTML (e.g. SPA fallback index.html), proxy is not responding
    if (ctype.includes('text/html')) {
      useDirect = true;
      errorReason = 'Proxy returned HTML instead of JSON';
    } else if (res.ok) {
      data = await res.json();
    } else {
      let errBody;
      try {
        errBody = await res.json();
      } catch {}
      if (
        res.status === 500 &&
        (errBody?.error?.includes('TMDB_API_KEY') || errBody?.message?.includes('TMDB_API_KEY'))
      ) {
        errorReason = 'TMDB_API_KEY is not configured on server';
      } else {
        errorReason = `Proxy returned ${res.status}`;
      }
      useDirect = true;
    }
  } catch (err) {
    useDirect = true;
    errorReason = err.message || 'Network error';
  }

  // 2. Fall back to direct TMDB API if proxy failed and local key is available
  if (useDirect) {
    if (localKey) {
      const directQs = new URLSearchParams({ language: 'en-US', ...params });
      const headers = { accept: 'application/json' };
      let directUrl;
      if (localKey.startsWith('eyJ')) {
        // v4 Bearer token
        headers.Authorization = `Bearer ${localKey}`;
        directUrl = `${TMDB_DIRECT_BASE}/${path}?${directQs.toString()}`;
      } else {
        directQs.set('api_key', localKey);
        directUrl = `${TMDB_DIRECT_BASE}/${path}?${directQs.toString()}`;
      }

      const directRes = await fetch(directUrl, { headers });
      if (!directRes.ok) {
        throw new Error(`TMDB direct request failed (${directRes.status})`);
      }
      data = await directRes.json();
    } else {
      const err = new Error(
        errorReason.includes('TMDB_API_KEY')
          ? 'TMDB_API_KEY_REQUIRED'
          : `TMDB request failed (${errorReason})`
      );
      err.code = errorReason.includes('TMDB_API_KEY') ? 'TMDB_API_KEY_REQUIRED' : 'TMDB_ERROR';
      throw err;
    }
  }

  cache.set(key, { exp: Date.now() + TTL, data });
  return data;
}

export const trending = (media, window = 'day') => fetchTMDB(`trending/${media}/${window}`);
export const movieList = (kind) => fetchTMDB(`movie/${kind}`);
export const tvList = (kind) => fetchTMDB(`tv/${kind}`);
export const details = (type, id) => fetchTMDB(`${type}/${id}`);
export const videos = (type, id) => fetchTMDB(`${type}/${id}/videos`);
export const credits = (type, id) => fetchTMDB(`${type}/${id}/credits`);
export const similar = (type, id) => fetchTMDB(`${type}/${id}/similar`);
export const seasonInfo = (tvId, num) => fetchTMDB(`tv/${tvId}/season/${num}`);
export const searchMulti = (query) => fetchTMDB('search/multi', { query });
export const discover = (media, params = {}) => fetchTMDB(`discover/${media}`, params);

// Merge movie + tv genre lists into one id -> name map
let genreMapPromise = null;
export const loadGenres = () => {
  if (!genreMapPromise) {
    genreMapPromise = Promise.all([fetchTMDB('genre/movie/list'), fetchTMDB('genre/tv/list')])
      .then(([m, t]) => {
        const map = {};
        [...(m.genres || []), ...(t.genres || [])].forEach((g) => {
          if (g.id && g.name && !map[g.id]) map[g.id] = g.name;
        });
        return map;
      })
      .catch((err) => {
        // don't cache a permanent failure — let the next caller retry
        genreMapPromise = null;
        throw err;
      });
  }
  return genreMapPromise;
};

export const genreNames = (ids = [], map = {}) => ids.map((id) => map[id]).filter(Boolean);

// Find the YouTube trailer key for a title (cache-friendly)
export const trailerKey = async (type, id) => {
  const data = await videos(type, id);
  const list = data.results || [];
  const pick =
    list.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    list.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
    list.find((v) => v.site === 'YouTube');
  return pick ? pick.key : null;
};
