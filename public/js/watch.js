// ============================================================
// K - watch.js
// Fullscreen player page with VidKing embed
// ============================================================

import { $, qs, icon } from './utils.js';
import { VIDKING } from './config.js';
import { details } from './api.js';
import { readProgress, writeProgress } from './utils.js';
import { titleOf, mediaTypeOf, yearOf, matchPct } from './utils.js';

let messageHandler = null;

export function renderWatch(root) {
  const params = qs();
  const type = params.type || 'movie';
  const id = Number(params.id);
  const season = Number(params.season) || 1;
  const episode = Number(params.episode) || 1;

  if (!id) { showError(root, 'Invalid media ID.'); return; }

  document.body.classList.add('watch-mode');

  const progress = readProgress(type, id);
  const embedUrl = type === 'tv'
    ? VIDKING.tv(id, season, episode, { progress: progress ? Math.floor(progress.progress * 100) : 0 })
    : VIDKING.movie(id, { progress: progress ? Math.floor(progress.progress * 100) : 0 });

  root.innerHTML = `
    <div class="watch-player">
      <div class="watch-controls">
        <button class="btn btn-glass watch-back" aria-label="Go back">${icon('back')} Back</button>
      </div>
      <iframe
        class="watch-iframe"
        src="${embedUrl}"
        allow="autoplay; encrypted-media; fullscreen"
        allowfullscreen
      ></iframe>
      <div class="watch-unavailable" style="display:none">
        <div class="watch-unavailable-inner">
          <h2>Source Unavailable</h2>
          <p>This title is currently unavailable for streaming.</p>
          <button class="btn btn-play watch-retry">${icon('back')} Try Again</button>
        </div>
      </div>
    </div>
    <div class="watch-info layout-container">
      <div class="watch-title"></div>
      <div class="watch-meta"></div>
      <p class="watch-desc"></p>
    </div>
  `;

  const backBtn = $('.watch-back', root);
  const unavailable = $('.watch-unavailable', root);
  const retryBtn = $('.watch-retry', root);
  const titleEl = $('.watch-title', root);
  const metaEl = $('.watch-meta', root);
  const descEl = $('.watch-desc', root);
  const iframe = $('.watch-iframe', root);

  // back button
  backBtn.addEventListener('click', () => {
    window.history.back();
  });

  // show back button on mouse move
  let controlsTimer = null;
  const showControls = () => {
    backBtn.classList.add('show');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => backBtn.classList.remove('show'), 3000);
  };
  document.addEventListener('mousemove', showControls);
  document.addEventListener('touchstart', showControls);

  // retry
  retryBtn.addEventListener('click', () => {
    unavailable.style.display = 'none';
    iframe.src = iframe.src; // reload
  });

  // listen for VidKing player progress messages
  messageHandler = (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.event === 'PLAYER_EVENT' && data.currentTime != null && data.duration != null) {
        const prog = data.currentTime / data.duration;
        if (prog > 0.01 && prog < 0.98) {
          writeProgress({ type, id, title: titleEl.textContent, progress: prog, season, episode });
        }
      }
    } catch {}
  };
  window.addEventListener('message', messageHandler);

  // load details for info section
  loadDetails(type, id, season, episode, titleEl, metaEl, descEl);

  // handle iframe load error
  iframe.addEventListener('load', () => {
    // try to detect error (VidKing may show error in iframe)
  });
}

async function loadDetails(type, id, season, episode, titleEl, metaEl, descEl) {
  try {
    const det = await details(type, id);
    const title = titleOf(det);
    const typeLabel = type === 'tv' ? 'TV Show' : 'Movie';
    const year = yearOf(det);
    const rating = matchPct(det.vote_average);

    titleEl.textContent = type === 'tv'
      ? `${title} - S${String(season).padStart(2, '0')} E${String(episode).padStart(2, '0')}`
      : title;

    metaEl.innerHTML = `
      <span>${typeLabel}</span>
      <span>${year}</span>
      <span class="meta-rating">${rating}% Match</span>
    `;
    descEl.textContent = det.overview || '';
  } catch {
    // silently fail - info is optional
  }
}

function showError(root, msg) {
  root.innerHTML = `
    <div class="watch-unavailable" style="display:flex">
      <div class="watch-unavailable-inner">
        <h3>Error</h3>
        <p>${msg}</p>
        <button class="btn btn-play" onclick="window.history.back()">Go Back</button>
      </div>
    </div>
  `;
}

export function destroyWatch() {
  document.body.classList.remove('watch-mode');
  if (messageHandler) {
    window.removeEventListener('message', messageHandler);
    messageHandler = null;
  }
}
