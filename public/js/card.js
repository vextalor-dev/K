// ============================================================
// K - card.js
// Cineby-style poster cards (no peek panel, poster + title below)
// ============================================================

import {
  $, $$, esc, clamp, icon, onEnter, matchPct, yearOf, titleOf, mediaTypeOf,
  posterOf, backdropOf, stillOf, hms,
} from './utils.js';
import * as api from './api.js';
import { inList, toggle as toggleList, getReaction, setReaction } from './mylist.js';

// lazy detail cache shared across cards/modal/detail pages
const detailCache = new Map();

const fallbackNode = () => {
  const div = document.createElement('div');
  div.className = 'card-fallback';
  return div;
};
export const detailFor = (type, id) => {
  const key = `${type}:${id}`;
  if (!detailCache.has(key)) {
    const p = api.details(type, id).catch((err) => { detailCache.delete(key); throw err; });
    detailCache.set(key, p);
  }
  return detailCache.get(key);
};

export const openDetail = (type, id) => {
  location.hash = `#/title:${type}:${id}`;
};

export const openWatch = (type, id, season, episode) => {
  if (type === 'tv') location.href = `/watch?type=tv&id=${id}&season=${season || 1}&episode=${episode || 1}`;
  else location.href = `/watch?type=movie&id=${id}`;
};

// ---------------------------------------------------------------
// Standard poster card (rows + grid pages)
// Cineby style: poster + title below, no peek panel
// ---------------------------------------------------------------
export function makeCard(item, opts = {}) {
  const type = opts.type || mediaTypeOf(item);
  const id = item.id;
  const title = titleOf(item);
  const poster = opts.poster || posterOf(item);
  const progress = opts.progress != null
    ? clamp(opts.progress, 0, 1)
    : (item.progress != null ? clamp(item.progress, 0, 1) : null);
  const lazy = opts.lazy !== false;
  const rank = opts.rank != null ? Number(opts.rank) : null;

  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = id;
  el.dataset.type = type;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', title);
  el.setAttribute('title', title);

  const img = poster
    ? `<img class="card-poster" src="${poster}" alt="${esc(title)}" loading="${lazy ? 'lazy' : 'eager'}" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">`
    : '<div class="card-fallback"></div>';

  const rating = item.vote_average > 0 ? matchPct(item.vote_average) : null;
  const year = yearOf(item);

  el.innerHTML = `
    <div class="card-media">
      ${img}
      <div class="card-filter"></div>
      <div class="card-play">${icon('play')}</div>
      ${progress != null ? `<div class="card-progress"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>` : ''}
      ${rank != null ? `
        <div class="card-rank-flag">
          <span class="rank-label">Top</span>
          <span class="rank-num">${String(rank).padStart(2, '0')}</span>
        </div>
      ` : ''}
    </div>
    <div class="card-meta">
      <div class="card-title">${esc(title)}</div>
      <div class="card-sub">
        ${rating != null ? `<span class="card-star">${icon('star')} ${rating}%</span>` : ''}
        ${year ? `<span>${year}</span>` : ''}
      </div>
    </div>
  `;

  const open = () => openDetail(type, id);
  el.addEventListener('click', open);
  onEnter(el, open);

  if (poster) {
    const posterEl = el.querySelector('.card-poster');
    posterEl.addEventListener('error', () => posterEl.replaceWith(fallbackNode()));
  }

  return el;
}

// ---------------------------------------------------------------
// Grid card for My List page (no peek, play overlay + remove)
// ---------------------------------------------------------------
export function makeGridCard(item, { onRemove } = {}) {
  const type = item.type;
  const id = item.id;
  const title = item.title || 'Untitled';
  const poster = item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : null;

  const el = document.createElement('div');
  el.className = 'grid-card';
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', title);
  el.setAttribute('title', title);
  el.innerHTML = `
    ${poster ? `<img src="${poster}" alt="${esc(title)}" loading="lazy" decoding="async" fetchpriority="low" referrerpolicy="no-referrer">` : '<div class="card-fallback"></div>'}
    <div class="gc-overlay">
      ${icon('play')}
      <span class="gc-title">${esc(title)}</span>
    </div>
    <button class="gc-remove" aria-label="Remove from My List">${icon('close')}</button>
  `;

  if (poster) {
    const posterEl = el.querySelector('img');
    posterEl.addEventListener('error', () => posterEl.replaceWith(fallbackNode()));
  }

  const open = () => openDetail(type, id);
  el.addEventListener('click', open);
  onEnter(el, open);

  $('.gc-remove', el).addEventListener('click', (e) => {
    e.stopPropagation();
    import('./mylist.js').then(m => m.remove(id, type));
    if (onRemove) onRemove(el);
  });

  return el;
}
