// ============================================================
// K - rows.js
// Heading-trail section titles + native scroll track + arrows
// ============================================================

import { $, $$, esc, icon } from './utils.js';
import { makeCard } from './card.js';

// ---------------------------------------------------------------
// Build a single horizontal row with title + scroll track + arrows
// ---------------------------------------------------------------
export function buildRow(container, { title, items, opts = {}, type } = {}) {
  const row = document.createElement('section');
  row.className = 'row';

  row.innerHTML = `
    <h2 class="row-title heading-trail">${esc(title)}</h2>
    <div class="row-track"></div>
    <button class="row-arrow left" aria-label="Scroll left">${icon('chevronLeft')}</button>
    <button class="row-arrow right" aria-label="Scroll right">${icon('chevRight')}</button>
  `;

  const track = $('.row-track', row);
  const arrowL = $('.row-arrow.left', row);
  const arrowR = $('.row-arrow.right', row);

  // add cards
  (items || []).forEach((item, i) => {
    const card = makeCard(item, { ...opts, type: type || undefined, rank: opts.rank ? i + 1 : undefined });
    track.appendChild(card);
  });

  // arrow scroll
  const scrollAmt = () => track.clientWidth * 0.75;
  const updateArrowState = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    arrowL.classList.toggle('disabled', track.scrollLeft <= 2);
    arrowR.classList.toggle('disabled', track.scrollLeft >= max - 2);
  };
  arrowL.addEventListener('click', () => { track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }); updateArrowState(); });
  arrowR.addEventListener('click', () => { track.scrollBy({ left: scrollAmt(), behavior: 'smooth' }); updateArrowState(); });
  track.addEventListener('scroll', updateArrowState);
  updateArrowState();

  // show arrows on hover
  row.addEventListener('mouseenter', () => row.classList.add('hover'));
  row.addEventListener('mouseleave', () => row.classList.remove('hover'));

  container.appendChild(row);
  return row;
}

// ---------------------------------------------------------------
// Build a horizontal row from API data.
// Accepts either a pre-built `promise` (existing call sites) or a
// `load` function returning a fresh promise, so the Retry button can
// re-run the fetch.
// ---------------------------------------------------------------
export async function buildApiRow(container, { title, promise, load, type, opts = {} } = {}) {
  const row = document.createElement('section');
  row.className = 'row';
  row.innerHTML = `
    <h2 class="row-title heading-trail">${esc(title)}</h2>
    <div class="row-track"></div>
    <button class="row-arrow left" aria-label="Scroll left">${icon('chevronLeft')}</button>
    <button class="row-arrow right" aria-label="Scroll right">${icon('chevRight')}</button>
  `;
  container.appendChild(row);

  const track = $('.row-track', row);
  const arrowL = $('.row-arrow.left', row);
  const arrowR = $('.row-arrow.right', row);

  const loader = typeof load === 'function' ? load : () => promise;

  const showSkeleton = () => {
    track.innerHTML = Array.from({ length: 7 }, () =>
      '<div class="card-skeleton" aria-hidden="true" tabindex="-1"></div>'
    ).join('');
  };

  const showError = () => {
    track.innerHTML = `
      <div class="row-error" role="alert">
        <p>Failed to load. Try again later.</p>
        <button type="button" class="btn-retry">Retry</button>
      </div>
    `;
    $('.btn-retry', track).addEventListener('click', () => {
      showSkeleton();
      loadRow();
    });
  };

  const showEmpty = () => {
    track.innerHTML = '<div class="row-empty">Nothing here yet.</div>';
  };

  const loadRow = async () => {
    try {
      const data = await loader();
      const list = (data.results || []).filter(i => i.poster_path || i.backdrop_path);
      track.innerHTML = '';
      if (!list.length) {
        showEmpty();
      } else {
        list.forEach((item, i) => {
          const realRank = opts.rank ? data.results.indexOf(item) + 1 : undefined;
          track.appendChild(makeCard(item, { ...opts, type: type || undefined, rank: realRank }));
        });
      }
    } catch {
      showError();
    }
    updateArrowState();
  };

  // arrow scroll + disabled state
  const scrollAmt = () => track.clientWidth * 0.75;
  const updateArrowState = () => {
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    arrowL.classList.toggle('disabled', track.scrollLeft <= 2);
    arrowR.classList.toggle('disabled', track.scrollLeft >= max - 2);
  };
  arrowL.addEventListener('click', () => { track.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }); updateArrowState(); });
  arrowR.addEventListener('click', () => { track.scrollBy({ left: scrollAmt(), behavior: 'smooth' }); updateArrowState(); });
  track.addEventListener('scroll', updateArrowState);
  row.addEventListener('mouseenter', () => row.classList.add('hover'));
  row.addEventListener('mouseleave', () => row.classList.remove('hover'));

  showSkeleton();
  await loadRow();

  return row;
}

// ---------------------------------------------------------------
// Build a responsive grid page (My List, Search, Genre, etc.)
// ---------------------------------------------------------------
export function buildGrid(container, { title, items, renderItem, emptyMsg = 'No items found.' } = {}) {
  const page = document.createElement('div');
  page.className = 'grid-page';
  page.innerHTML = `
    <div class="layout-container">
      ${title ? `<h1 class="grid-page-title heading-trail">${esc(title)}</h1>` : ''}
      <div class="grid"></div>
      <div class="grid-empty" style="display:none">${esc(emptyMsg)}</div>
    </div>
  `;

  const grid = $('.grid', page);
  const empty = $('.grid-empty', page);

  if (!items || !items.length) {
    empty.style.display = '';
  } else {
    items.forEach((item, i) => {
      grid.appendChild(renderItem ? renderItem(item, i) : makeCard(item));
    });
  }

  container.appendChild(page);
  return { page, grid, empty };
}

// ---------------------------------------------------------------
// Build skeleton grid for loading states
// ---------------------------------------------------------------
export function buildGridSkeleton(container, count = 12) {
  const page = document.createElement('div');
  page.className = 'grid-page';
  page.innerHTML = `
    <div class="layout-container">
      <div class="grid grid-skeleton">
        ${Array.from({ length: count }, () => '<div class="card-skeleton" aria-hidden="true" tabindex="-1"></div>').join('')}
      </div>
    </div>
  `;
  container.appendChild(page);
  return page;
}
