// ============================================================
// NetflixX server configuration
// ------------------------------------------------------------
// 1. Get a free TMDB API key:  https://www.themoviedb.org/settings/api
// 2. Paste it below inside the quotes (server-side only - the
//    browser never sees this key; all calls go through the proxy)
// 3. Run `npm install` then `npm start` and open http://localhost:3000
// ============================================================

const TMDB_API_KEY = process.env.TMDB_API_KEY || '7f1744eb03153962f13f178d89036a40';

const PORT = process.env.PORT || 3000;

module.exports = { TMDB_API_KEY, PORT };
