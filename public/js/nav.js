// ============================================================
// K - nav.js
// Glass header + Browse dropdown + Search + Mobile dock
// ============================================================

import { $, $$, icon, onEnter, debounce, esc } from './utils.js';
import * as api from './api.js';
import { BROWSE_GENRES, GENRES } from './config.js';

const navRoot = () => $('#nav-root');
const NAV_LINKS = [
  { icon: 'home', label: 'Home', hash: '#/' },
  { icon: 'film', label: 'Movies', hash: '#/movies' },
  { icon: 'tv', label: 'TV Shows', hash: '#/tv' },
  { icon: 'sparkles', label: 'Anime', hash: '#/anime' },
];

const DOCK_ITEMS = [
  { icon: 'home', label: 'Home', hash: '#/' },
  { icon: 'film', label: 'Movies', hash: '#/movies' },
  { icon: 'tv', label: 'TV', hash: '#/tv' },
  { icon: 'sparkles', label: 'Anime', hash: '#/anime' },
  { icon: 'search', label: 'Search', hash: '#/search' },
];

let browseOpen = false;
let mobileOpen = false;
let searchOpen = false;
let searchInput = null;
let searchDrop = null;
let searchBox = null;

export function renderNav() {
  const root = navRoot();
  root.className = 'nav';
  root.innerHTML = `
    <div class="nav-scrim"></div>
    <div class="nav-inner">
      <a class="logo" href="#/" aria-label="K - Home">
        <img src="images/logo.svg" alt="K" width="40" height="40">
        <span class="logo-text">K</span>
      </a>
      <nav class="nav-links">
        ${NAV_LINKS.map(l => `
          <a class="nav-link" href="${l.hash}" data-hash="${l.hash}">
            ${icon(l.icon)}
            <span class="font-medium">${l.label}</span>
          </a>
        `).join('')}
        <div class="browse-wrap" style="position:relative">
          <button class="nav-browse" aria-expanded="false" aria-haspopup="true">
            ${icon('grid')}<span class="font-medium">Browse</span>
            ${icon('chevDown', 'chevron')}
          </button>
          <div class="browse-dropdown"></div>
        </div>
      </nav>
      <div class="nav-right">
        <div class="search-box">
          <button class="nav-search-btn" aria-label="Search">${icon('search')}</button>
          <input class="nav-search-input" type="text" placeholder="Titles, people, genres" aria-label="Search K">
          <button class="search-clear" aria-label="Clear">${icon('close')}</button>
          <div class="search-drop"></div>
        </div>
        <button class="hamburger-btn" aria-label="Menu">${icon('menu')}</button>
      </div>
    </div>
  `;

  searchInput = $('.nav-search-input', root);
  searchDrop = $('.search-drop', root);

  buildBrowseDropdown();
  bindScroll();
  bindSearch();
  bindBrowse();
  bindMobile();
}

function buildBrowseDropdown() {
  const dd = $('.browse-dropdown');
  if (!dd) return;
  dd.innerHTML = BROWSE_GENRES.map(g =>
    `<a class="browse-item" href="#/browse=${g.id}&title=${encodeURIComponent(g.label)}">
      <span>${g.label}</span>
    </a>`
  ).join('');
}

function bindScroll() {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      navRoot().classList.toggle('scrolled', window.scrollY > 50);
      ticking = false;
    });
  });
}

function bindSearch() {
  const input = searchInput;
  const drop = searchDrop;
  const box = searchBox = $('.search-box');
  const btn = $('.nav-search-btn');
  const clear = $('.search-clear');

  btn.addEventListener('click', () => {
    searchOpen = !searchOpen;
    box.classList.toggle('open', searchOpen);
    if (searchOpen) { input.focus(); }
    else { closeSearch(); }
  });

  clear.addEventListener('click', () => { input.value = ''; input.focus(); updateSearchClear(); drop.classList.remove('open'); });

  input.addEventListener('input', () => {
    updateSearchClear();
    doNavSearch(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearch(); }
    if (e.key === 'Enter' && input.value.trim()) {
      location.hash = `#/search=${encodeURIComponent(input.value.trim())}`;
      closeSearch();
    }
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && (searchOpen || searchDrop.classList.contains('open'))) closeSearch();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOpen) closeSearch();
  });
}

function closeSearch() {
  searchOpen = false;
  if (!searchBox) return;
  searchBox.classList.remove('open');
  searchInput.value = '';
  searchDrop.classList.remove('open');
  updateSearchClear();
}

function updateSearchClear() {
  searchBox.classList.toggle('has-text', searchInput.value.length > 0);
}

const doNavSearch = debounce(async (q) => {
  if (!q || q.length < 2) { searchDrop.classList.remove('open'); return; }
  const mine = q;
  const wasOpen = searchOpen;
  try {
    const data = await api.searchMulti(q);
    if (!searchInput || searchInput.value.trim() !== mine || !wasOpen) return;
    const results = (data.results || []).filter(r => r.media_type !== 'person' && r.poster_path).slice(0, 6);
    if (!results.length) { searchDrop.innerHTML = '<div class="drop-empty">No results found</div>'; }
    else {
      searchDrop.innerHTML = results.map(r => {
        const t = r.title || r.name || '';
        const yr = (r.release_date || r.first_air_date || '').slice(0, 4);
        const poster = `https://image.tmdb.org/t/p/w92${r.poster_path}`;
        return `<div class="drop-item" data-type="${r.media_type}" data-id="${r.id}">
          <img src="${poster}" alt="" loading="lazy">
          <div class="drop-info">
            <div class="drop-title">${esc(t)}${yr ? ' (' + yr + ')' : ''}</div>
            <div class="drop-sub">${r.media_type}</div>
          </div>
        </div>`;
      }).join('');
    }
    searchDrop.classList.add('open');
    $$('.drop-item', searchDrop).forEach(el => {
      el.addEventListener('click', () => {
        location.hash = `#/title:${el.dataset.type}:${el.dataset.id}`;
        closeSearch();
      });
    });
  } catch { if (searchInput && searchInput.value.trim() === mine && searchOpen) { searchDrop.innerHTML = '<div class="drop-empty">Something went wrong</div>'; searchDrop.classList.add('open'); } }
}, 220);

function bindBrowse() {
  const btn = $('.nav-browse');
  const dd = $('.browse-dropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    browseOpen = !browseOpen;
    dd.classList.toggle('open', browseOpen);
    btn.classList.toggle('open', browseOpen);
    btn.setAttribute('aria-expanded', browseOpen);
  });

  document.addEventListener('click', (e) => {
    if (browseOpen && !dd.contains(e.target) && !btn.contains(e.target)) {
      browseOpen = false;
      dd.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && browseOpen) {
      browseOpen = false;
      dd.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindMobile() {
  const ham = $('.hamburger-btn');
  const root = navRoot();

  // mobile menu drawer
  let menuEl = null;

  ham.addEventListener('click', () => {
    if (mobileOpen) { closeMobile(); return; }
    mobileOpen = true;
    menuEl = document.createElement('div');
    menuEl.className = 'mobile-menu open';
    menuEl.innerHTML = `
      <div class="mobile-menu-panel">
        <a class="logo" href="#/">
          <img src="images/logo.svg" alt="K" width="40" height="40">
          <span class="logo-text">K</span>
        </a>
        ${NAV_LINKS.map(l => `
          <a class="mobile-menu-link" href="${l.hash}">${icon(l.icon)} ${l.label}</a>
        `).join('')}
        <a class="mobile-menu-link" href="#/anime">${icon('sparkles')} Anime</a>
        <a class="mobile-menu-link" href="#/search">${icon('search')} Search</a>
        <a class="mobile-menu-link" href="#/mylist">${icon('heart')} My List</a>
      </div>
    `;
    document.body.appendChild(menuEl);
    menuEl.addEventListener('click', (e) => {
      if (e.target === menuEl) closeMobile();
    });
    $$('.mobile-menu-link', menuEl).forEach(link => link.addEventListener('click', closeMobile));
  });

  function closeMobile() {
    mobileOpen = false;
    if (menuEl) { menuEl.remove(); menuEl = null; }
  }
}

export function renderDock() {
  const existing = $('.dock-outer');
  if (existing) existing.remove();

  const dock = document.createElement('div');
  dock.className = 'dock-outer';
  dock.innerHTML = `
    <div class="dock-panel">
      ${DOCK_ITEMS.map(d => `
        <a class="dock-item" href="${d.hash}" data-hash="${d.hash}" aria-label="${d.label}">
          ${icon(d.icon)}
        </a>
      `).join('')}
    </div>
  `;
  document.body.appendChild(dock);
}

export function setNavActive(route) {
  const hash = route ? `#/${route}` : null;
  $$('.nav-link', navRoot()).forEach(a => {
    a.classList.toggle('active', !!hash && a.dataset.hash === hash);
  });
  $$('.dock-item').forEach(a => {
    a.classList.toggle('active', !!hash && a.dataset.hash === hash);
  });
}
