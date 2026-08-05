// ============================================================
// K - hero.js
// Cineby-style 85vh hero banner with auto-rotation
// ============================================================

import { $, $$, esc, icon, matchPct, yearOf, titleOf, mediaTypeOf, backdropOf } from './utils.js';
import * as api from './api.js';
import { openDetail, openWatch } from './card.js';

const ROTATION_MS = 6500;
let items = [];
let idx = 0;
let timer = null;
let root = null;
let destroyed = true;

export function renderHero(targetRoot) {
  root = targetRoot;
  destroyed = false;
  root.innerHTML = '<div class="hero-loading"></div>';
  loadHeroItems();
}

async function loadHeroItems() {
  try {
    const data = await api.trending('all', 'week');
    if (destroyed) return;
    items = (data.results || []).filter(i => i.backdrop_path && i.vote_average > 4.5).slice(0, 5);
    if (!items.length) { root.innerHTML = ''; return; }
    build();
    startRotation();
  } catch {
    if (destroyed) return;
    root.innerHTML = '';
  }
}

function build() {
  root.innerHTML = `
    <div class="hero">
      <div class="hero-layers"></div>
      <div class="hero-vignette"></div>
      <div class="hero-glow"></div>
      <div class="hero-content">
        <div class="hero-content-inner">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            <span class="hero-badge-text">#1 Trending</span>
          </div>
          <h1 class="hero-title"></h1>
          <div class="hero-meta"></div>
          <p class="hero-desc"></p>
          <div class="hero-cta">
            <button class="btn btn-play hero-play">${icon('play')} Play</button>
            <button class="btn btn-glass hero-info">${icon('info')} More Info</button>
          </div>
        </div>
      </div>
      <div class="hero-pagination"></div>
    </div>
  `;

  // backdrop layers: .hero > .hero-layer.active > .hero-backdrop > img
  const layers = $('.hero-layers', root);
  items.forEach((item, i) => {
    const layer = document.createElement('div');
    layer.className = 'hero-layer' + (i === 0 ? ' active' : '');
    layer.innerHTML = `<div class="hero-backdrop"><img src="${backdropOf(item, 'original')}" alt="" draggable="false"></div>`;
    layers.appendChild(layer);
    if (i === 1) {
      const preload = new Image();
      preload.src = backdropOf(item, 'original');
    }
  });

  // pause rotation while hovering or focusing the hero
  const pause = () => stopRotation();
  const resume = () => { if (!destroyed) startRotation(); };
  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);

  // pagination dots
  const pag = $('.hero-pagination', root);
  items.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'hero-dot';
    if (i === 0) dot.classList.add('active');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    pag.appendChild(dot);
  });

  // CTA buttons
  $('.hero-play', root).addEventListener('click', () => {
    const item = items[idx];
    if (item) openWatch(mediaTypeOf(item), item.id);
  });
  $('.hero-info', root).addEventListener('click', () => {
    const item = items[idx];
    if (item) openDetail(mediaTypeOf(item), item.id);
  });

  showContent(0);
}

function goTo(next) {
  if (next === idx || !items.length) return;
  const layers = $$('.hero-layer', root);
  const dots = $$('.hero-dot', root);

  if (layers[idx]) layers[idx].classList.remove('active');
  if (dots[idx]) dots[idx].classList.remove('active');

  idx = next;

  if (layers[idx]) layers[idx].classList.add('active');
  if (dots[idx]) dots[idx].classList.add('active');

  showContent(idx);
}

function showContent(i) {
  const item = items[i];
  if (!item) return;

  const titleEl = $('.hero-title', root);
  const metaEl = $('.hero-meta', root);
  const descEl = $('.hero-desc', root);
  const badgeText = $('.hero-badge-text', root);

  const type = mediaTypeOf(item);
  const title = titleOf(item);
  const rating = matchPct(item.vote_average);
  const year = yearOf(item);
  const typeLabel = type === 'tv' ? 'TV Show' : 'Movie';

  titleEl.textContent = title;
  metaEl.innerHTML = `
    <span class="meta-rating">${icon('star')} ${rating}% Match</span>
    <span>${year}</span>
    <span>${typeLabel}</span>
  `;
  descEl.textContent = item.overview || '';
  badgeText.textContent = i === 0 ? '#1 Trending' : `#${i + 1} Trending`;
}

function startRotation() {
  stopRotation();
  timer = setInterval(() => {
    goTo((idx + 1) % items.length);
  }, ROTATION_MS);
}

function stopRotation() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function destroy() {
  destroyed = true;
  stopRotation();
  items = [];
  idx = 0;
}

// TV remote support: slide the hero left/right (returns false when empty)
export function heroSlide(dir) {
  if (!items.length) return false;
  const next = (idx + (dir > 0 ? 1 : -1) + items.length) % items.length;
  goTo(next);
  return true;
}
