// ============================================================
// K - app.js
// SPA router + home page + all route pages
// ============================================================

import { $, debounce, esc, icon, dateBadge, titleOf, yearOf, mediaTypeOf } from './utils.js';
import * as api from './api.js';
import { ANIME_IDS, GENRES, LANGUAGES } from './config.js';
import { renderNav, renderDock, setNavActive } from './nav.js';
import { renderHero, destroy as destroyHero } from './hero.js';
import { buildRow, buildApiRow, buildGrid, buildGridSkeleton } from './rows.js';
import { makeGridCard, openDetail } from './card.js';
import { renderSearch } from './search.js';
import { renderFooter } from './footer.js';
import { renderWatch, destroyWatch } from './watch.js';
import { renderDetail } from './detail.js';
import { getList, likedItems, isNotified, toggleNotify } from './mylist.js';
import { continueWatchingItems } from './utils.js';
import { GENRE_MOODS } from './config.js';
import { maybeOfferApk } from './apk.js';

const appRoot = () => $('#app-root');
const watchRoot = () => $('#watch-root');
const footerRoot = () => $('#footer-root');
const errorRoot = () => $('#error-root');

let currentRoute = null;

// ---------------------------------------------------------------
// Storage wipe (force-clear localStorage on every device once)
// ---------------------------------------------------------------
const STORAGE_CLEAR_VERSION = 1;
async function wipeStorageIfNeeded() {
  try {
    const marker = `nkx-storage-v${STORAGE_CLEAR_VERSION}`;
    if (localStorage.getItem(marker)) return;
    localStorage.clear();
    localStorage.setItem(marker, '1');
  } catch {}
}
window.addEventListener('DOMContentLoaded', wipeStorageIfNeeded);

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
function init() {
  renderNav();
  renderDock();
  renderFooter(footerRoot());
  maybeOfferApk();
  window.addEventListener('hashchange', route);
  route();
}

// ---------------------------------------------------------------
// Router
// ---------------------------------------------------------------
async function route() {
  const hash = location.hash || '#/';
  const path = hash.replace(/^#\/?/, '');

  // Watch page (query-routed by Express)
  if (location.pathname === '/watch') {
    currentRoute = 'watch';
    appRoot().style.display = 'none';
    footerRoot().style.display = 'none';
    watchRoot().classList.remove('hidden');
    renderWatch(watchRoot());
    return;
  }

  // destroy previous
  destroyHero();
  if (currentRoute === 'watch') destroyWatch();

  // hide watch mode
  watchRoot().classList.add('hidden');
  errorRoot().classList.add('hidden');
  appRoot().style.display = '';
  footerRoot().style.display = '';
  document.body.classList.remove('kids-mode');

  // route matching
  if (path === '' || path === '/') {
    currentRoute = 'home';
    setNavActive('/');
    document.title = 'K · Watch Movies & TV Shows';
    await renderHome();
  } else if (path === 'mylist') {
    currentRoute = 'mylist';
    setNavActive('/mylist');
    document.title = 'My List · K';
    renderMyList();
  } else if (path === 'search' || path.startsWith('search=')) {
    currentRoute = 'search';
    setNavActive('/search');
    const q = path.startsWith('search=') ? decodeURIComponent(path.slice(7)) : '';
    document.title = q ? `Search: ${q} · K` : 'Search · K';
    renderSearch(appRoot(), q);
  } else if (path === 'new') {
    currentRoute = 'new';
    setNavActive('/new');
    document.title = 'New & Popular · K';
    await renderNewPopular();
  } else if (path === 'languages') {
    currentRoute = 'languages';
    setNavActive('/languages');
    document.title = 'Languages · K';
    await renderLanguages();
  } else if (path === 'kids') {
    currentRoute = 'kids';
    setNavActive('/kids');
    document.body.classList.add('kids-mode');
    document.title = 'Kids · K';
    await renderKids();
  } else if (path === 'movies') {
    currentRoute = 'movies';
    setNavActive('/movies');
    document.title = 'Movies · K';
    await renderMovies();
  } else if (path === 'tv') {
    currentRoute = 'tv';
    setNavActive('/tv');
    document.title = 'TV Shows · K';
    await renderTV();
  } else if (path === 'anime') {
    currentRoute = 'anime';
    setNavActive('/anime');
    document.title = 'Anime · K';
    await renderAnime();
  } else if (path.startsWith('title:')) {
    currentRoute = 'detail';
    setNavActive('');
    const parts = path.slice(6).split(':');
    const type = parts[0] || 'movie';
    const id = Number(parts[1]);
    if (Number.isInteger(id) && id > 0) {
      await renderDetail(appRoot(), type, id);
    } else {
      showError('Invalid Title', 'The title you are looking for does not exist.');
    }
  } else if (path.startsWith('browse=')) {
    currentRoute = 'browse';
    setNavActive('');
    const m = path.match(/^browse=(\d+)&title=(.*)$/);
    if (m) {
      document.title = `${decodeURIComponent(m[2])} · K`;
      await renderGenreBrowse(Number(m[1]), decodeURIComponent(m[2]));
    }
  } else if (path === 'latest') {
    currentRoute = 'latest';
    setNavActive('');
    document.title = 'Latest · K';
    await renderLatest();
  } else {
    currentRoute = 'error';
    setNavActive('');
    document.title = 'Page Not Found · K';
    showError('Page Not Found', 'The page you are looking for does not exist.');
  }

  // scroll to top on route change
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------
// Home page
// ---------------------------------------------------------------
async function renderHome() {
  const root = appRoot();
  root.innerHTML = '<div id="hero-root"></div><div id="home-rows" class="layout-container" style="margin-top:-60px;position:relative;z-index:2"></div>';

  renderHero($('#hero-root', root));
  const rowsContainer = $('#home-rows', root);

  // Continue Watching
  const cwItems = continueWatchingItems();
  if (cwItems.length) {
    buildRow(rowsContainer, {
      title: 'Continue Watching',
      items: cwItems.map(cw => ({
        type: cw.type,
        id: cw.id,
        title: cw.title,
        name: cw.type === 'tv' ? cw.title : undefined,
        poster_path: cw.poster,
        backdrop_path: cw.backdrop,
        vote_average: cw.vote,
        release_date: cw.type === 'movie' ? cw.year : undefined,
        first_air_date: cw.type === 'tv' ? cw.year : undefined,
        progress: cw.progress,
      })),
    });
  }

  // Because You Liked (from reactions)
  buildLikedRow(rowsContainer);

  // Trending
  buildApiRow(rowsContainer, { title: 'Trending Now', promise: api.trending('all', 'week'), opts: { rank: true } });
  // Popular Movies
  buildApiRow(rowsContainer, { title: 'Popular Movies', promise: api.movieList('popular') });
  // Top Rated
  buildApiRow(rowsContainer, { title: 'Top Rated', promise: api.movieList('top_rated'), opts: { rank: true } });
  // Now Playing
  buildApiRow(rowsContainer, { title: 'Now Playing', promise: api.movieList('now_playing') });
  // Upcoming
  buildApiRow(rowsContainer, { title: 'Upcoming', promise: api.movieList('upcoming') });
  // Popular TV
  buildApiRow(rowsContainer, { title: 'Popular TV Shows', promise: api.tvList('popular') });
  // On The Air
  buildApiRow(rowsContainer, { title: 'On The Air', promise: api.tvList('on_the_air') });
  // A few genre rows
  const genreIds = [28, 35, 27, 18, 10749, 878];
  genreIds.forEach(gid => {
    const name = GENRE_MOODS[gid] || GENRES[gid] || 'Popular';
    buildApiRow(rowsContainer, {
      title: name,
      promise: api.discover('movie', { with_genres: gid, sort_by: 'popularity.desc' }),
    });
  });
}

// ---------------------------------------------------------------
// Movies page
// ---------------------------------------------------------------
async function renderMovies() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">Movies</h1><div id="movies-content"></div></div></div>';
  const content = $('#movies-content', root);

  // rows of movies
  const rows = [
    { title: 'Popular Movies', promise: api.movieList('popular') },
    { title: 'Top Rated', promise: api.movieList('top_rated'), opts: { rank: true } },
    { title: 'Now Playing', promise: api.movieList('now_playing') },
    { title: 'Upcoming', promise: api.movieList('upcoming') },
  ];
  for (const r of rows) {
    await buildApiRow(content, r);
  }
}

// ---------------------------------------------------------------
// TV Shows page
// ---------------------------------------------------------------
async function renderTV() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">TV Shows</h1><div id="tv-content"></div></div></div>';
  const content = $('#tv-content', root);

  const rows = [
    { title: 'Popular TV Shows', promise: api.tvList('popular') },
    { title: 'Top Rated TV', promise: api.tvList('top_rated'), opts: { rank: true } },
    { title: 'On The Air', promise: api.tvList('on_the_air') },
    { title: 'Airing Today', promise: api.tvList('airing_today') },
  ];
  for (const r of rows) {
    await buildApiRow(content, r);
  }
}

// ---------------------------------------------------------------
// Anime page
// ---------------------------------------------------------------
async function renderAnime() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">Anime</h1><div id="anime-content"></div></div></div>';
  const content = $('#anime-content', root);

  // load all anime items
  const promises = ANIME_IDS.map(a => api.details('tv', a.id).catch(() => null));
  const results = await Promise.all(promises);
  const valid = results.filter(Boolean);

  if (valid.length) {
    buildRow(content, { title: 'Featured Anime', items: valid });
  }

  // also show trending anime
  buildApiRow(content, {
    title: 'Trending Anime',
    promise: api.discover('tv', { with_genres: 16, sort_by: 'popularity.desc' }),
    type: 'tv',
  });
}

// ---------------------------------------------------------------
// My List page
// ---------------------------------------------------------------
function renderMyList() {
  const root = appRoot();
  const items = getList();
  root.innerHTML = '';

  if (!items.length) {
    root.innerHTML = `
      <div class="grid-page layout-container">
        <h1 class="grid-page-title heading-trail">My List</h1>
        <div class="grid-empty">
          <p>Your list is empty.</p>
          <button class="btn btn-play" onclick="window.location.hash='#/'">Browse Titles</button>
        </div>
      </div>
    `;
    return;
  }

  const { page } = buildGrid(root, {
    title: 'My List',
    items,
    renderItem: (item) => makeGridCard(item, { onRemove: (el) => el.remove() }),
  });
}

// ---------------------------------------------------------------
// New & Popular page
// ---------------------------------------------------------------
async function renderNewPopular() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">New & Popular</h1><div id="np-content"></div></div></div>';
  const content = $('#np-content', root);

  buildApiRow(content, { title: 'Trending This Week', promise: api.trending('all', 'week'), opts: { rank: true } });
  await renderNewReleases(content);
  buildApiRow(content, { title: 'Popular TV Shows', promise: api.tvList('popular') });
}

async function renderNewReleases(content) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const data = await api.discover('movie', { 'release_date.gte': since, sort_by: 'release_date.desc', include_adult: 'false' });
    const items = (data.results || []).filter(i => i.poster_path || i.backdrop_path).slice(0, 12);
    if (!items.length) return;

    const sec = document.createElement('section');
    sec.className = 'np-section';
    sec.innerHTML = '<h2 class="row-title heading-trail">New This Week</h2><div class="np-coming-grid"></div>';
    content.appendChild(sec);
    const grid = $('.np-coming-grid', sec);

    items.forEach(item => {
      const t = titleOf(item);
      const badge = dateBadge(item.release_date);
      const on = isNotified(item.id);
      const el = document.createElement('div');
      el.className = 'np-item';
      el.tabIndex = 0;
      el.innerHTML = `
        ${badge ? `<div class="np-date-badge"><span class="np-dow">${badge.dow}</span><span class="np-day">${badge.day}</span></div>` : ''}
        <div class="np-item-body">
          <div class="np-item-title">${esc(t)}</div>
          <div class="np-item-sub">${yearOf(item) ? `${yearOf(item)} · ` : ''}Movie</div>
          <p class="np-item-desc">${esc(item.overview || '')}</p>
          <button class="np-notify ${on ? 'notified' : ''}" aria-pressed="${on}">${icon('bell')} ${on ? 'Reminder Set' : 'Notify Me'}</button>
        </div>
      `;
      const open = () => openDetail('movie', item.id);
      el.addEventListener('click', (e) => { if (e.target.closest('.np-notify')) return; open(); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      const btn = $('.np-notify', el);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotify(item.id);
        const now = isNotified(item.id);
        btn.classList.toggle('notified', now);
        btn.setAttribute('aria-pressed', now);
        btn.innerHTML = `${icon('bell')} ${now ? 'Reminder Set' : 'Notify Me'}`;
      });
      grid.appendChild(el);
    });
  } catch { /* row is optional */ }
}

async function buildLikedRow(rowsContainer) {
  const liked = likedItems().slice(0, 3);
  if (!liked.length) return;
  try {
    const lists = await Promise.all(liked.map(({ type, id }) =>
      api.similar(type, id).catch(() => ({ results: [] }))
    ));
    const seen = new Set();
    const items = [];
    for (const list of lists) {
      for (const r of (list.results || [])) {
        const key = `${mediaTypeOf(r)}:${r.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(r);
        if (items.length >= 10) break;
      }
      if (items.length >= 10) break;
    }
    if (items.length) buildRow(rowsContainer, { title: 'Because You Liked', items });
  } catch { /* row is optional */ }
}

// ---------------------------------------------------------------
// Languages page
// ---------------------------------------------------------------
async function renderLanguages() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">Languages</h1><div id="lang-content"></div></div></div>';
  const content = $('#lang-content', root);

  for (const lang of LANGUAGES) {
    buildApiRow(content, {
      title: lang.label,
      promise: api.discover(lang.media, { with_original_language: lang.code, sort_by: 'popularity.desc' }),
      type: lang.media,
    });
  }
}

// ---------------------------------------------------------------
// Kids page
// ---------------------------------------------------------------
async function renderKids() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">Kids</h1><div id="kids-content"></div></div></div>';
  const content = $('#kids-content', root);

  const kidsParams = { include_adult: 'false', certification_country: 'US', 'certification.lte': 'PG' };
  buildApiRow(content, { title: 'Popular for Kids', promise: api.discover('movie', { with_genres: 10751, sort_by: 'popularity.desc', ...kidsParams }) });
  buildApiRow(content, { title: 'Animation', promise: api.discover('movie', { with_genres: 16, sort_by: 'popularity.desc', ...kidsParams }) });
}

// ---------------------------------------------------------------
// Genre Browse page
// ---------------------------------------------------------------
async function renderGenreBrowse(genreId, genreName) {
  const root = appRoot();
  root.innerHTML = `<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">${esc(genreName)}</h1><div id="genre-content"></div></div></div>`;
  const content = $('#genre-content', root);

  try {
    const data = await api.discover('movie', { with_genres: genreId, sort_by: 'popularity.desc' });
    const items = (data.results || []).filter(i => i.poster_path);

    const { page, grid, empty } = buildGrid(content, { items, emptyMsg: `No ${genreName} titles found.` });
  } catch {
    content.innerHTML = '<div class="search-none">Failed to load titles.</div>';
  }
}

// ---------------------------------------------------------------
// Latest page
// ---------------------------------------------------------------
async function renderLatest() {
  const root = appRoot();
  root.innerHTML = '<div class="grid-page"><div class="layout-container"><h1 class="grid-page-title heading-trail">Latest</h1><div id="latest-content"></div></div></div>';
  const content = $('#latest-content', root);

  buildApiRow(content, { title: 'Latest Movies', promise: api.movieList('now_playing') });
  buildApiRow(content, { title: 'Latest TV Shows', promise: api.tvList('airing_today') });
}

// ---------------------------------------------------------------
// Error screen
// ---------------------------------------------------------------
function showError(title, msg) {
  const root = appRoot();
  root.innerHTML = `
    <div class="error-screen layout-container">
      <h2>${title}</h2>
      <p>${msg}</p>
      <button class="btn btn-play" onclick="window.location.hash='#/'">Back to Home</button>
    </div>
  `;
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);
