// ============================================================
// K - detail.js
// Title detail page (full-page, not modal)
// ============================================================

import { $, $$, esc, icon, matchPct, yearOf, titleOf, runtimeText, readProgress } from './utils.js';
import { trailerUrl } from './config.js';
import * as api from './api.js';
import { detailFor, openWatch } from './card.js';
import { inList, toggle as toggleList, getReaction, setReaction } from './mylist.js';
import { buildRow } from './rows.js';

export async function renderDetail(root, type, id) {
  root.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const expectedPath = `/title/${type}/${id}`;
  const stale = () => !location.pathname.startsWith(expectedPath) && location.hash !== `#/title:${type}:${id}` || !document.body.contains(root);

  try {
    const [det, cred, simData, tKey] = await Promise.all([
      detailFor(type, id),
      api.credits(type, id).catch(() => ({ cast: [] })),
      api.similar(type, id).catch(() => ({ results: [] })),
      api.trailerKey(type, id).catch(() => null),
    ]);

    if (stale()) return;

    const genres = await api.loadGenres().catch(() => ({}));
    if (stale()) return;

    const genreNames = api.genreNames((det.genres || []).map((g) => g.id), genres);
    const title = titleOf(det);
    const year = yearOf(det);
    const rating = matchPct(det.vote_average);
    const runtime = type === 'tv'
      ? (det.episode_run_time?.[0] ? runtimeText({ runtime: det.episode_run_time[0] }) : null)
      : runtimeText(det);
    const typeLabel = type === 'tv' ? 'TV Show' : 'Movie';

    document.title = `${title}${year ? ` (${year})` : ''} · K`;

    root.innerHTML = `
      <div class="page-hero" style="${det.backdrop_path ? `background-image:url(https://image.tmdb.org/t/p/w1280${det.backdrop_path})` : ''}">
        <div class="page-hero-inner layout-container">
          <button class="detail-back btn btn-glass">${icon('back')} Back</button>
          <div class="detail-poster-area">
            ${det.poster_path ? `<img class="detail-poster" src="https://image.tmdb.org/t/p/w500${det.poster_path}" alt="${esc(title)}">` : ''}
          </div>
          <div class="detail-body">
            <h1 class="detail-title">${esc(title)}</h1>
            <div class="detail-facts">
              <span>${typeLabel}</span>
              ${year ? `<span>${year}</span>` : ''}
              ${runtime ? `<span>${runtime}</span>` : ''}
              <span>${rating}% Match</span>
            </div>
            ${genreNames.length ? `<div class="detail-genres">${genreNames.map(g => `<span class="detail-genre">${esc(g)}</span>`).join('')}</div>` : ''}
            <div class="detail-buttons">
              <button class="btn btn-play detail-play">${icon('play')} Play</button>
              ${tKey ? `<button class="btn btn-glass detail-trailer">${icon('play')} Trailer</button>` : ''}
              <button class="btn btn-icon detail-list" aria-label="My List"></button>
              <button class="btn btn-icon detail-like" aria-label="Like">${icon('like')}</button>
              <button class="btn btn-icon detail-dislike" aria-label="Dislike">${icon('dislike')}</button>
            </div>
            <p class="detail-desc">${esc(det.overview || '')}</p>
          </div>
        </div>
      </div>
      <div class="layout-container">
        ${type === 'tv' && det.number_of_seasons ? '<div class="detail-seasons"></div>' : ''}
        ${(cred.cast || []).length ? `
          <div class="detail-section">
            <h2 class="detail-section-title heading-trail">Cast</h2>
            <div class="modal-cast">
              ${cred.cast.slice(0, 10).map(c => `
                <div class="cast-member">
                  <div class="cast-avatar">${c.profile_path ? `<img src="https://image.tmdb.org/t/p/w185${c.profile_path}" alt="${esc(c.name)}" loading="lazy">` : `<div class="cast-avatar-placeholder">${icon('film')}</div>`}</div>
                  <div class="cast-name">${esc(c.name)}</div>
                  <div class="cast-role">${esc(c.character || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="detail-similar-section"></div>
      </div>
    `;

    // bind actions
    $('.detail-back', root).addEventListener('click', () => window.history.back());

    const trailerBtn = $('.detail-trailer', root);
    if (trailerBtn) trailerBtn.addEventListener('click', () => openTrailer(tKey));

    const playFn = () => {
      if (type === 'tv') {
        const rec = readProgress(type, id);
        openWatch('tv', id, rec?.season || 1, rec?.episode || 1);
      } else {
        openWatch(type, id);
      }
    };
    $('.detail-play', root).addEventListener('click', playFn);

    const btnList = $('.detail-list', root);
    refreshListBtn(btnList, id, type);
    btnList.addEventListener('click', () => { toggleList({ id, type, ...det }); refreshListBtn(btnList, id, type); });

    const btnLike = $('.detail-like', root);
    const btnDislike = $('.detail-dislike', root);
    refreshReactionBtns(btnLike, btnDislike, id, type);
    btnLike.addEventListener('click', () => { setReaction(id, type, getReaction(id, type) === 'like' ? null : 'like'); refreshReactionBtns(btnLike, btnDislike, id, type); });
    btnDislike.addEventListener('click', () => { setReaction(id, type, getReaction(id, type) === 'dislike' ? null : 'dislike'); refreshReactionBtns(btnLike, btnDislike, id, type); });

    // similar titles row
    const sims = (simData.results || []).filter(s => s.poster_path);
    if (sims.length) {
      const simSection = $('.detail-similar-section', root);
      buildRow(simSection, { title: 'More Like This', items: sims });
    }

    // TV episode picker
    if (type === 'tv' && det.number_of_seasons) {
      const seasonsEl = $('.detail-seasons', root);
      if (seasonsEl) loadSeasons(seasonsEl, det);
    }

  } catch {
    if (stale()) return;
    root.innerHTML = `
      <div class="error-screen">
        <h2>Something went wrong</h2>
        <p>Could not load details for this title.</p>
        <button class="btn btn-play" onclick="window.location.hash='#/'">Back to Home</button>
      </div>
    `;
  }
}

async function loadSeasons(container, det) {
  const numSeasons = det.number_of_seasons || 0;
  if (numSeasons <= 0) return;

  const rec = readProgress('tv', det.id);
  const startSeason = rec?.season || 1;

  container.innerHTML = `
    <div class="detail-section">
      <h2 class="detail-section-title heading-trail">Episodes</h2>
      <div class="season-select-wrap">
        <select class="season-select" aria-label="Season">
          ${Array.from({ length: numSeasons }, (_, i) => `<option value="${i + 1}" ${i + 1 === startSeason ? 'selected' : ''}>Season ${i + 1}</option>`).join('')}
        </select>
      </div>
      <div class="episode-list"></div>
    </div>
  `;

  const sel = $('.season-select', container);
  const list = $('.episode-list', container);
  let pending = 0;

  sel.addEventListener('change', () => {
    const seq = ++pending;
    loadEpisodes(list, det.id, Number(sel.value), () => seq === pending);
  });
  // initial load is only current while no season change has happened
  loadEpisodes(list, det.id, startSeason, () => pending === 0);
}

async function loadEpisodes(listEl, tvId, seasonNum, isCurrent) {
  listEl.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const data = await api.seasonInfo(tvId, seasonNum);
    if (!isCurrent()) return;
    const eps = data.episodes || [];
    const rec = readProgress('tv', tvId);
    const active = (s, e) => !!(rec && Number(rec.season) === s && Number(rec.episode) === e);
    listEl.innerHTML = eps.map(ep => {
      const nowPlaying = active(seasonNum, ep.episode_number);
      return `
      <div class="episode-row${nowPlaying ? ' playing' : ''}" data-season="${seasonNum}" data-ep="${ep.episode_number}" tabindex="0"${nowPlaying ? ' aria-current="true"' : ''}>
        <div class="ep-thumb">
          ${ep.still_path ? `<img src="https://image.tmdb.org/t/p/w300${ep.still_path}" alt="" loading="lazy">` : '<div class="card-fallback"></div>'}
          <div class="ep-play">${icon('play')}</div>
        </div>
        <div class="ep-info">
          <div class="ep-head">
            <span class="ep-num">${ep.episode_number}</span>
            <span class="ep-name">${esc(ep.name || '')}</span>
            ${nowPlaying ? `<span class="ep-playing">${icon('play')} Playing</span>` : ''}
            ${ep.runtime ? `<span class="ep-runtime">${ep.runtime}m</span>` : ''}
          </div>
          <p class="ep-overview">${esc(ep.overview || '')}</p>
        </div>
      </div>
    `;
    }).join('') || '<div class="episode-empty">No episodes available.</div>';

    $$('.episode-row', listEl).forEach(row => {
      const play = () => {
        const s = Number(row.dataset.season);
        const ep = Number(row.dataset.ep);
        openWatch('tv', tvId, s, ep);
      };
      row.addEventListener('click', play);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
    });
  } catch {
    if (isCurrent()) listEl.innerHTML = '<div class="episode-empty">Failed to load episodes.</div>';
  }
}

function openTrailer(key) {
  const trigger = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-panel" style="width:min(880px, 94vw)" role="dialog" aria-modal="true" aria-label="Trailer">
      <button class="modal-close" aria-label="Close">${icon('close')}</button>
      <div class="modal-media" style="aspect-ratio:16/9">
        <iframe src="${trailerUrl(key)}" title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
      </div>
    </div>
  `;

  const panel = $('.modal-panel', ov);
  const prevOverflow = document.body.style.overflow;
  const cleanup = () => {
    ov.remove();
    document.body.style.overflow = prevOverflow;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', cleanup);
    if (trigger && typeof trigger.focus === 'function' && trigger.isConnected) trigger.focus();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { cleanup(); return; }
    if (e.key === 'Tab') {
      const focusables = $$('button, a[href], iframe, [tabindex]:not([tabindex="-1"])', panel)
        .filter(el => !el.disabled);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  ov.addEventListener('click', (e) => { if (e.target === ov) cleanup(); });
  ov.querySelector('.modal-close').addEventListener('click', cleanup);
  window.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', cleanup);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(ov);
  ov.querySelector('.modal-close').focus();
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
