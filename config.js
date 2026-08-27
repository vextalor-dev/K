// ============================================================
// K server configuration
// ------------------------------------------------------------
// The TMDB API key is read ONLY from the TMDB_API_KEY environment
// variable. It is intentionally NOT hardcoded here (never commit
// real credentials to a git repository).
//   - Vercel: Project -> Settings -> Environment Variables -> TMDB_API_KEY
//   - Cloudflare: wrangler.toml / Dashboard -> TMDB_API_KEY
//   - Local:  $env:TMDB_API_KEY="your-key-here"; npm start
// The browser never sees this key; all calls go through the proxy.
// ============================================================

function requireEnv(name, { optional = false } = {}) {
  const v = process.env[name];
  if (!v && !optional) {
    // Don't crash on import (so `vercel build` still works), but surface loudly.
    console.warn(`[config] Warning: ${name} is not set. TMDB proxy will return 500.`);
    return undefined;
  }
  return v;
}

const TMDB_API_KEY = requireEnv('TMDB_API_KEY', { optional: true });
const TMDB_BEARER = process.env.TMDB_BEARER_TOKEN || null; // optional v4 token — prefer over api_key if present
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid PORT');

const NODE_ENV = process.env.NODE_ENV || 'development';
const CF_PAGES = !!process.env.CF_PAGES;

module.exports = { TMDB_API_KEY, TMDB_BEARER, PORT, NODE_ENV, CF_PAGES };
