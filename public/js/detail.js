// ============================================================
// K - detail.js
// Title detail page (full-page, not modal)
// ============================================================

import { $, esc, icon, matchPct, yearOf, titleOf, mediaTypeOf, hms, formatDate } from './utils.js';
import * as api from './api.js';
import { detailFor, openWatch } from './card.js';
import { inList, toggle as toggleList, getReaction, setReaction } from './mylist.js';
import { buildRow } from './rows.js';

export async function renderDetail(root, type, id) {
  root.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  try {
    const [det, cred, simData] = await Promise.all([
      detailFor(type, id),
      api.credits(type, id).catch(() => ({ cast: [] })),
      api.similar(type, id).catch(() => ({ results: [] })),
    ]);

    const genres = await api.loadGenres();
    const genreNames = api.genreNames(det.genres || [], genres);
    const title = titleOf(det);
    const year = yearOf(det);
    const rating = matchPct(det.vote_average);
    const runtime = hms(det.runtime * 60);
    const typeLabel = type === 'tv' ? 'TV Show' : 'Movie';

    root.innerHTML = `
      <div class="page-hero" style="background-image:url(https://image.tmdb.org/t/p/original${det.backdrop_path || ''})">
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
              <button class="btn btn-icon detail-list" aria-label="My List"></button>
              <button class="btn btn-icon detail-like" aria-label="Like">${icon('like')}</button>
              <button class="btn btn-icon detail-dislike" aria-label="Dislike">${icon('dislike')}</button>
            </div>
            <p class="detail-desc">${esc(det.overview || '')}</p>
          </div>
        </div>
      </div>
      <div class="layout-container">
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

    const playFn = () => {
      if (type === 'tv') {
        openWatch(type, id, det.last_episode_to_air?.season_number || 1, det.last_episode_to_air?.episode_number || 1);
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

  } catch {
    root.innerHTML = `
      <div class="error-screen">
        <h2>Something went wrong</h2>
        <p>Could not load details for this title.</p>
        <button class="btn btn-play" onclick="window.location.hash='#/'">Back to Home</button>
      </div>
    `;
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
