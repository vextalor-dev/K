// ============================================================
// NetflixX server configuration
// ------------------------------------------------------------
// The TMDB API key is read ONLY from the TMDB_API_KEY environment
// variable. It is intentionally NOT hardcoded here (never commit
// real credentials to a git repository).
//   - Vercel: Project -> Settings -> Environment Variables -> TMDB_API_KEY
//   - Local:  $env:TMDB_API_KEY="your-key-here"; npm start
// The browser never sees this key; all calls go through the proxy.
// ============================================================

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const PORT = process.env.PORT || 3000;

module.exports = { TMDB_API_KEY, PORT };
