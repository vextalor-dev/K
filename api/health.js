const { TMDB_API_KEY } = require('../config');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    uptime: process.uptime(),
    version: require('../package.json').version,
    tmdb: !!TMDB_API_KEY,
    time: new Date().toISOString(),
  });
};
