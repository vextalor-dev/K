// ============================================================
// K - router.js
// History-API router with hash fallback for legacy bookmarks
// ============================================================

export function normalizePath() {
  // 1. Hash mode (legacy): #/title:movie:123  or #/search=foo
  const hash = location.hash || '';
  if (hash.startsWith('#/')) {
    return hash.replace(/^#\/?/, '');
  }
  // 2. History mode: /title/movie/123  /browse/28  /search?q=foo
  let p = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const search = new URLSearchParams(location.search);
  // /title/:type/:id  -> title:type:id
  if (p.startsWith('title/')) {
    const parts = p.split('/').filter(Boolean);
    // parts = ['title', 'movie', '123']
    if (parts.length >= 3) return `title:${parts[1]}:${parts[2]}`;
    if (parts.length === 2) return `title:${parts[1]}`;
  }
  // /browse/28?title=Action -> browse=28&title=Action
  if (p.startsWith('browse')) {
    const m = p.match(/^browse\/(\d+)/);
    if (m) {
      const id = m[1];
      const title = search.get('title') || '';
      return `browse=${id}&title=${encodeURIComponent(title)}`;
    }
    // legacy /browse?genre=28 fallback
    if (search.get('genre')) return `browse=${search.get('genre')}&title=${encodeURIComponent(search.get('title') || '')}`;
  }
  // /search?q=foo -> search=foo
  if (p === 'search' || p.startsWith('search')) {
    const q = search.get('q') || search.get('query') || '';
    return q ? `search=${encodeURIComponent(q)}` : 'search';
  }
  // plain routes: '', 'movies', 'tv', etc.
  if (!p) return '';
  return p;
}

export function navigate(rawPath, { replace = false } = {}) {
  // rawPath is internal format like 'title:movie:123' or 'movies' or 'search=foo'
  let url = '/';
  if (rawPath.startsWith('title:')) {
    const parts = rawPath.split(':');
    const type = parts[1] || 'movie';
    const id = parts[2] || '';
    url = `/title/${type}/${id}`;
  } else if (rawPath.startsWith('browse=')) {
    const m = rawPath.match(/^browse=(\d+)&title=(.*)$/);
    if (m) url = `/browse/${m[1]}?title=${encodeURIComponent(decodeURIComponent(m[2]))}`;
    else url = `/browse/${rawPath.slice(7)}`;
  } else if (rawPath.startsWith('search=')) {
    const q = rawPath.slice(7);
    url = q ? `/search?q=${encodeURIComponent(decodeURIComponent(q))}` : '/search';
  } else if (rawPath === 'search') {
    url = '/search';
  } else if (!rawPath || rawPath === '/') {
    url = '/';
  } else {
    url = `/${rawPath.replace(/^\/+/, '')}`;
  }

  // keep legacy hash for bookmarks? No — we move to history, but we support reading hash.
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  // dispatch routing
  window.dispatchEvent(new PopStateEvent('popstate'));
  // also update hash for very old bots that only look at hash? Not needed.
}

export function watchNavigate(fn) {
  window.addEventListener('popstate', fn);
  window.addEventListener('hashchange', fn);
}

// Update <link rel="canonical"> + <meta property="og:url"> dynamically
export function setCanonical(pathname) {
  const base = (document.querySelector('link[rel="canonical"]')?.href || location.origin + '/').replace(/\/$/, '');
  const url = `${base}${pathname.startsWith('/') ? pathname : '/' + pathname}`;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = url;
  document.querySelectorAll('meta[property="og:url"]').forEach((m) => (m.content = url));
}
