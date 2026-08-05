// ============================================================
// K - search.js
// Search page with input, Top Searches, live results
// ============================================================

import { $, $$, esc, icon, debounce, titleOf, mediaTypeOf, yearOf } from './utils.js';
import * as api from './api.js';
import { openDetail } from './card.js';

let reqSeq = 0;

function getSearchResults(content) {
  return Array.from(content.querySelectorAll('.top-search-row, .result-card'));
}

function highlight(text, q) {
  const s = String(text);
  const t = q ? q.trim() : '';
  if (!t) return esc(s);
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return esc(s);
  const re = new RegExp(`(${escaped})`, 'ig');
  return s.split(re).map(part => {
    if (part && part.toLowerCase() === t.toLowerCase()) return `<mark class="hl">${esc(part)}</mark>`;
    return esc(part);
  }).join('');
}

export function renderSearch(root, query = '') {
  root.innerHTML = `
    <div class="search-page layout-container">
      <div class="search-input-wrap">
        <input class="search-page-input" type="text" placeholder="Search titles, people, genres..." value="${esc(query)}" autofocus>
        <button class="search-page-clear" aria-label="Clear">${icon('close')}</button>
      </div>
      <h1 class="search-section-title heading-trail" id="search-section-title"></h1>
      <div id="search-content"></div>
    </div>
  `;

  const input = $('.search-page-input', root);
  const clearBtn = $('.search-page-clear', root);
  const content = $('#search-content', root);
  const sectionTitle = $('#search-section-title', root);

  clearBtn.style.display = (input.value || query) ? '' : 'none';

  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.style.display = 'none'; input.focus(); handleSearch(''); });

  input.addEventListener('input', () => {
    clearBtn.style.display = input.value ? '' : 'none';
    handleSearch(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      location.hash = `#/search=${encodeURIComponent(input.value.trim())}`;
      return;
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && input.value.trim()) {
      const results = getSearchResults(content);
      if (!results.length) return;
      e.preventDefault();
      const target = e.key === 'ArrowDown' ? results[0] : results[results.length - 1];
      target.focus();
    }
  });

  content.addEventListener('keydown', (e) => {
    const results = getSearchResults(content);
    if (!results.length) return;
    const idx = results.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      if (idx !== -1) {
        e.preventDefault();
        input.focus();
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = e.key === 'ArrowDown'
      ? (idx + 1) % results.length
      : (idx - 1 + results.length) % results.length;
    results[next].focus();
  });

  if (query) {
    handleSearch(query);
  } else {
    loadTopSearches(content, sectionTitle);
  }
}

async function loadTopSearches(content, sectionTitle) {
  const seq = ++reqSeq;
  sectionTitle.textContent = 'Top Searches';
  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const data = await api.trending('all', 'week');
    if (seq !== reqSeq) return;
    const items = (data.results || []).filter(i => i.poster_path || i.backdrop_path).slice(0, 12);

    content.innerHTML = '<div class="top-searches"></div>';
    const container = $('.top-searches', content);

    items.forEach((item, i) => {
      const type = mediaTypeOf(item);
      const title = titleOf(item);
      const thumb = item.backdrop_path
        ? `https://image.tmdb.org/t/p/w300${item.backdrop_path}`
        : item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null;

      const row = document.createElement('div');
      row.className = 'top-search-row';
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.innerHTML = `
        <div class="top-search-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="top-search-thumb">
          ${thumb ? `<img src="${thumb}" alt="${esc(title)}" loading="lazy">` : '<div class="card-fallback"></div>'}
          <div class="ts-play">${icon('play')}</div>
        </div>
        <div class="top-search-info">
          <div class="top-search-title">${esc(title)}</div>
          <div class="top-search-sub">${type === 'tv' ? 'TV Show' : 'Movie'}${yearOf(item) ? ' \u00B7 ' + yearOf(item) : ''}</div>
        </div>
      `;

      const open = () => openDetail(type, item.id);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      container.appendChild(row);
    });
  } catch {
    if (seq !== reqSeq) return;
    content.innerHTML = '<div class="search-none">Failed to load trending titles.</div>';
  }
}

const doSearch = debounce(async (root, content, sectionTitle, q) => {
  const seq = ++reqSeq;
  if (!q || q.length < 2) {
    sectionTitle.textContent = '';
    loadTopSearches(content, sectionTitle);
    return;
  }

  sectionTitle.textContent = 'Search Results';
  content.innerHTML = '<div class="grid grid-skeleton">' +
    Array.from({ length: 12 }, () => '<div class="card-skeleton" aria-hidden="true" tabindex="-1"></div>').join('') +
    '</div>';

  try {
    const data = await api.searchMulti(q);
    if (seq !== reqSeq) return;
    const results = (data.results || []).filter(r => r.media_type !== 'person' && (r.poster_path || r.backdrop_path));

    if (!results.length) {
      if (seq !== reqSeq) return;
      content.innerHTML = `<div class="search-none">No results found for "${esc(q)}"</div>`;
      return;
    }

    content.innerHTML = '<div class="search-results"></div>';
    const grid = $('.search-results', content);

    results.forEach(item => {
      const type = mediaTypeOf(item);
      const title = titleOf(item);
      const img = item.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
        : `https://image.tmdb.org/t/p/w500${item.poster_path}`;
      const yr = yearOf(item);

      const card = document.createElement('div');
      card.className = 'result-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', title);
      card.innerHTML = `
        <img src="${img}" alt="${esc(title)}" loading="lazy" referrerpolicy="no-referrer">
        <div class="rc-body">
          <div class="rc-title">${highlight(title, q)}</div>
          <div class="rc-type">${type === 'tv' ? 'TV' : 'Movie'}${yr ? ' \u00B7 ' + yr : ''}</div>
        </div>
        <div class="rc-play">${icon('play')}</div>
      `;

      const open = () => openDetail(type, item.id);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      grid.appendChild(card);
    });
  } catch {
    if (seq !== reqSeq) return;
    content.innerHTML = '<div class="search-none">Something went wrong. Try again.</div>';
  }
}, 300);

function handleSearch(q) {
  const root = $('#search-page') || document.querySelector('#app-root');
  const content = $('#search-content', root);
  const sectionTitle = $('#search-section-title', root);
  if (!content || !sectionTitle) return;
  doSearch(root, content, sectionTitle, q);
}
