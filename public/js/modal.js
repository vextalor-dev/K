// ============================================================
// K - modal.js
// Glass modal overlay with trailer, cast, episodes
// ============================================================

import { $, $$, esc, icon, matchPct, yearOf, titleOf, mediaTypeOf, hms, formatDate } from './utils.js';
import * as api from './api.js';
import { detailFor, openWatch, openDetail } from './card.js';
import { inList, toggle as toggleList, getReaction, setReaction } from './mylist.js';
import { trailerUrl } from './config.js';

let overlay = null;
let onCloseCb = null;

export function openModal({ type, id, onClose } = {}) {
  close();
  onCloseCb = onClose;

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal-panel"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
  document.getElementById('modal-root').appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', escHandler);
  document.body.style.overflow = 'hidden';

  loadContent(type, id);
}

function escHandler(e) { if (e.key === 'Escape') close(); }

export function close() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', escHandler);
  if (onCloseCb) onCloseCb();
}

async function loadContent(type, id) {
  try {
    const [det, cred, vidData, simData] = await Promise.all([
      detailFor(type, id),
      api.credits(type, id).catch(() => ({ cast: [] })),
      api.videos(type, id).catch(() => ({ results: [] })),
      api.similar(type, id).catch(() => ({ results: [] })),
    ]);

    const genres = await api.loadGenres();
    const genreNames = api.genreNames(det.genres || [], genres).slice(0, 3);
    const year = yearOf(det);
    const rating = matchPct(det.vote_average);
    const title = titleOf(det);
    const trailerKey = await api.trailerKey(type, id).catch(() => null);
    const runtime = hms(det.runtime * 60);

    const panel = $('.modal-panel', overlay);
    panel.innerHTML = `
      <button class="modal-close" aria-label="Close">${icon('close')}</button>
      <div class="modal-media">
        <div class="modal-media-inner"></div>
      </div>
      <div class="modal-body">
        <div class="modal-title">${esc(title)}</div>
        <div class="modal-meta">
          <span class="meta-rating">${rating}% Match</span>
          <span>${year}</span>
          ${runtime ? `<span>${runtime}</span>` : ''}
          ${genreNames.map(g => `<span>${esc(g)}</span>`).join('')}
        </div>
        <div class="modal-buttons">
          <button class="btn btn-play modal-play">${icon('play')} Play</button>
          <button class="btn btn-icon modal-list" aria-label="My List"></button>
          <button class="btn btn-icon modal-like" aria-label="Like">${icon('like')}</button>
          <button class="btn btn-icon modal-dislike" aria-label="Dislike">${icon('dislike')}</button>
        </div>
        <p class="modal-desc">${esc(det.overview || '')}</p>
        ${(cred.cast || []).length ? `
          <div class="modal-cast">
            ${cred.cast.slice(0, 8).map(c => `
              <div class="cast-member">
                <div class="cast-avatar">${c.profile_path ? `<img src="https://image.tmdb.org/t/p/w185${c.profile_path}" alt="${esc(c.name)}" loading="lazy">` : `<div class="cast-avatar-placeholder">${icon('film')}</div>`}</div>
                <div class="cast-name">${esc(c.name)}</div>
                <div class="cast-role">${esc(c.character || '')}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${type === 'tv' ? `<div class="modal-seasons"></div>` : ''}
      </div>
    `;

    // trailer or backdrop in media
    const mediaInner = $('.modal-media-inner', panel);
    if (trailerKey) {
      mediaInner.innerHTML = `<iframe src="${trailerUrl(trailerKey)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else if (det.backdrop_path) {
      mediaInner.innerHTML = `<img src="https://image.tmdb.org/t/p/w1280${det.backdrop_path}" alt="">`;
    } else {
      mediaInner.innerHTML = '';
    }

    // bind actions
    $('.modal-close', panel).addEventListener('click', close);
    $('.modal-play', panel).addEventListener('click', () => {
      close();
      openWatch(type, id);
    });

    const btnList = $('.modal-list', panel);
    refreshListBtn(btnList, id, type);
    btnList.addEventListener('click', () => { toggleList({ id, type, ...det }); refreshListBtn(btnList, id, type); });

    const btnLike = $('.modal-like', panel);
    const btnDislike = $('.modal-dislike', panel);
    refreshReactionBtns(btnLike, btnDislike, id, type);
    btnLike.addEventListener('click', () => { setReaction(id, type, getReaction(id, type) === 'like' ? null : 'like'); refreshReactionBtns(btnLike, btnDislike, id, type); });
    btnDislike.addEventListener('click', () => { setReaction(id, type, getReaction(id, type) === 'dislike' ? null : 'dislike'); refreshReactionBtns(btnLike, btnDislike, id, type); });

    // load episodes for TV
    if (type === 'tv') loadSeasons(panel, det);

  } catch {
    close();
  }
}

function refreshListBtn(btn, id, type) {
  const on = inList(id, type);
  btn.innerHTML = on ? icon('check') : icon('plus');
  btn.classList.toggle('on', on);
}

function refreshReactionBtns(likeBtn, dislikeBtn, id, type) {
  const r = getReaction(id, type);
  likeBtn.classList.toggle('on', r === 'like');
  dislikeBtn.classList.toggle('on', r === 'dislike');
}

async function loadSeasons(panel, det) {
  const container = $('.modal-seasons', panel);
  if (!container) return;
  const numSeasons = det.number_of_seasons || 0;
  if (numSeasons <= 0) return;

  container.innerHTML = `
    <div class="modal-section-title heading-trail">Episodes</div>
    <div class="season-select-wrap">
      <select class="season-select">
        ${Array.from({ length: numSeasons }, (_, i) => `<option value="${i + 1}">Season ${i + 1}</option>`).join('')}
      </select>
    </div>
    <div class="episode-list"></div>
  `;

  const sel = $('.season-select', container);
  const list = $('.episode-list', container);

  sel.addEventListener('change', () => loadEpisodes(list, det.id, Number(sel.value)));
  loadEpisodes(list, det.id, 1);
}

async function loadEpisodes(listEl, tvId, seasonNum) {
  listEl.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data = await api.seasonInfo(tvId, seasonNum);
    const eps = data.episodes || [];
    listEl.innerHTML = eps.map(ep => `
      <div class="episode-row" data-ep="${ep.episode_number}" tabindex="0">
        <div class="ep-thumb">
          ${ep.still_path ? `<img src="https://image.tmdb.org/t/p/w300${ep.still_path}" alt="" loading="lazy">` : '<div class="card-fallback"></div>'}
          <div class="ep-play">${icon('play')}</div>
        </div>
        <div class="ep-info">
          <div class="ep-head">
            <span class="ep-num">${ep.episode_number}</span>
            <span class="ep-name">${esc(ep.name || '')}</span>
            ${ep.runtime ? `<span class="ep-runtime">${ep.runtime}m</span>` : ''}
          </div>
          <p class="ep-overview">${esc(ep.overview || '')}</p>
        </div>
      </div>
    `).join('') || '<div class="episode-empty">No episodes available.</div>';

    $$('.episode-row', listEl).forEach(row => {
      const play = () => {
        const ep = Number(row.dataset.ep);
        close();
        openWatch('tv', tvId, seasonNum, ep);
      };
      row.addEventListener('click', play);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
    });
  } catch {
    listEl.innerHTML = '<div class="episode-empty">Failed to load episodes.</div>';
  }
}
