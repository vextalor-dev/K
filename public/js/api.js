// ============================================================
// K - api.js
// Thin client for the server-side TMDB proxy with a small
// in-memory cache to keep calls (and rate limits) low.
// ============================================================

const cache = new Map(); // key -> { exp, data }
const TTL = 10 * 60 * 1000;

export async function fetchTMDB(path, params = {}) {
  const qs = new URLSearchParams({ language: 'en-US', ...params });
  const key = `${path}?${qs.toString()}`;

  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;

  let data;
  let res;
  try {
    res = await fetch(`/api/tmdb/${path}?${qs.toString()}`);
  } catch {
    // one client-side retry for transient network blips
    res = await fetch(`/api/tmdb/${path}?${qs.toString()}`);
  }
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  data = await res.json();

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
    genreMapPromise = Promise.all([fetchTMDB('genre/movie/list'), fetchTMDB('genre/tv/list')]).then(
      ([m, t]) => {
        const map = {};
        [...(m.genres || []), ...(t.genres || [])].forEach((g) => {
          if (g.id && g.name && !map[g.id]) map[g.id] = g.name;
        });
        return map;
      }
    );
  }
  return genreMapPromise;
};

export const genreNames = (ids = [], map = {}) =>
  ids.map((id) => map[id]).filter(Boolean);

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
