#!/usr/bin/env node
// Generates public/sitemap.xml from static routes + TMDB top lists (optional)
const fs = require('fs');
const path = require('path');

const BASE = process.env.SITE_URL || 'https://k-movies.jo3.org';
const routes = [
  '', 'movies', 'tv', 'anime', 'search', 'new', 'languages', 'kids', 'mylist', 'latest', 'terms', 'terms-of-use',
];

const urls = routes.map((r) => ({
  loc: r ? `${BASE}/${r}` : `${BASE}/`,
  lastmod: new Date().toISOString().slice(0, 10),
  changefreq: r === '' ? 'daily' : 'weekly',
  priority: r === '' ? '1.0' : '0.7',
}));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;

const out = path.join(__dirname, '../public/sitemap.xml');
fs.writeFileSync(out, xml);
console.log(`sitemap written to ${out} (${urls.length} urls)`);
