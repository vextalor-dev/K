// ============================================================
// K - watch.js
// Fullscreen player page with VidKing embed
// ============================================================

import { $, qs, icon, load, save, readProgress, writeProgress, titleOf, yearOf, matchPct } from './utils.js';
import { SUBTITLES, VIDKING } from './config.js';
import { details } from './api.js';

let messageHandler = null;
let mouseMoveHandler = null;
let touchStartHandler = null;
let controlsTimer = null;
let escHandler = null;

const SUB_KEYS = { on: 'nkx-sub-on', off: 'nkx-sub-offset' };

let subCues = [];      // parsed [{ start, end, text }]
let subOn = false;
let subOffset = 0;     // seconds to nudge sync (+/-)
let subEl = null;
let ccBtn = null;
let offsetLabel = null;

export function renderWatch(root) {
  const params = qs();
  const type = params.type || 'movie';
  const id = Number(params.id);

  if (!id) { showError(root, 'Invalid media ID.'); return; }

  document.body.classList.add('watch-mode');

  // resume the saved episode when the URL doesn't specify one
  const progress = readProgress(type, id);
  const season = params.season != null ? Number(params.season) || 1 : (progress?.season || 1);
  const episode = params.episode != null ? Number(params.episode) || 1 : (progress?.episode || 1);
  const resumeSec = progress && Number.isFinite(progress.seconds) ? Math.floor(progress.seconds) : 0;

  const embedUrl = type === 'tv'
    ? VIDKING.tv(id, season, episode, { progress: resumeSec })
    : VIDKING.movie(id, { progress: resumeSec });

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
      <div class="watch-subs" style="display:none">
        <div class="watch-subs-inner">
          <button class="btn btn-glass watch-cc" aria-label="Toggle subtitles" title="Toggle subtitles (S)">${icon('subtitles')} <span>Subtitles</span></button>
          <div class="watch-sub-offset">
            <button class="btn btn-glass watch-sub-minus" aria-label="Subtitles later" title="Subtitles +0.25s">${icon('subLater')}</button>
            <span class="watch-sub-offset-val">Synced</span>
            <button class="btn btn-glass watch-sub-plus" aria-label="Subtitles earlier" title="Subtitles -0.25s">${icon('subEarlier')}</button>
          </div>
        </div>
      </div>
      <div class="watch-caption" aria-live="polite"></div>
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
  subEl = $('.watch-caption', root);
  ccBtn = $('.watch-cc', root);
  offsetLabel = $('.watch-sub-offset-val', root);
  const subPanel = $('.watch-subs', root);
  const subMinus = $('.watch-sub-minus', root);
  const subPlus = $('.watch-sub-plus', root);

  // subtitles: only tv shows currently have local SRT files
  const subKey = `tv:${id}:${season}:${episode}`;
  const subFile = type === 'tv' && SUBTITLES[id] && SUBTITLES[id].season === season
    ? SUBTITLES[id].episodes[episode]
    : null;
  const subOffKey = `${SUB_KEYS.off}:${subKey}`;
  if (subFile) {
    subOffset = load(subOffKey, 0) || 0;
    subOn = load(`${SUB_KEYS.on}:${subKey}`, true) !== false;
    subPanel.style.display = '';
    updateOffsetUI();
    loadSubtitles(subFile).then(() => { if (subOn) ccBtn?.classList.add('on'); });
  }

  ccBtn?.addEventListener('click', () => {
    subOn = !subOn;
    save(`${SUB_KEYS.on}:${subKey}`, subOn);
    ccBtn.classList.toggle('on', subOn);
    if (!subOn) clearCaption();
  });

  subMinus?.addEventListener('click', () => { subOffset += 0.25; save(subOffKey, subOffset); updateOffsetUI(); });
  subPlus?.addEventListener('click', () => { subOffset -= 0.25; save(subOffKey, subOffset); updateOffsetUI(); });

  // back button
  backBtn.addEventListener('click', () => {
    window.history.back();
  });

  // show back button on mouse move
  let detInfo = null;
  const showControls = () => {
    backBtn.classList.add('show');
    const inner = $('.watch-subs-inner', root);
    if (inner) inner.classList.add('show');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      backBtn.classList.remove('show');
      if (inner) inner.classList.remove('show');
    }, 3000);
  };
  mouseMoveHandler = showControls;
  touchStartHandler = showControls;
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('touchstart', touchStartHandler);

  // retry
  retryBtn.addEventListener('click', () => {
    unavailable.style.display = 'none';
    iframe.src = iframe.src; // reload
  });

  // listen for VidKing player progress messages (only from trusted origins)
  let lastSaveAt = 0;
  let lastSavedProg = 0;
  messageHandler = (e) => {
    if (!/^https:\/\/([a-z0-9-]+\.)?vidking\.net$/.test(e.origin)) return;
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const evt = data && data.type === 'PLAYER_EVENT' ? (data.data || {}) : data;
      if (!evt || evt.currentTime == null || evt.duration == null) return;
      if (subOn && subEl && subCues.length) renderCaption(evt.currentTime + subOffset);
      const prog = evt.currentTime / evt.duration;
      const now = Date.now();
      if (prog > 0.01 && prog < 0.98 && now - lastSaveAt > 5000 && Math.abs(prog - lastSavedProg) > 0.01) {
        lastSaveAt = now;
        lastSavedProg = prog;
        writeProgress({
          type, id,
          title: (detInfo && titleOf(detInfo)) || titleEl.textContent,
          poster: detInfo?.poster_path || null,
          backdrop: detInfo?.backdrop_path || null,
          vote: detInfo?.vote_average || 0,
          year: detInfo?.release_date || detInfo?.first_air_date || '',
          seconds: Math.floor(evt.currentTime),
          progress: prog, season, episode,
        });
      }
    } catch {}
  };
  window.addEventListener('message', messageHandler);

  // escape to leave the player
  escHandler = (e) => { if (e.key === 'Escape') window.history.back(); };
  document.addEventListener('keydown', escHandler);

  // load details for info section
  loadDetails(type, id, season, episode, titleEl, metaEl, descEl, (det) => { detInfo = det; });

  // handle iframe load error
  iframe.addEventListener('load', () => {
    // try to detect error (VidKing may show error in iframe)
  });
}

async function loadDetails(type, id, season, episode, titleEl, metaEl, descEl, onLoaded) {
  try {
    const det = await details(type, id);
    if (onLoaded) onLoaded(det);
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

async function loadSubtitles(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return;
    const text = await res.text();
    subCues = parseSrt(text);
  } catch { subCues = []; }
}

function parseSrt(text) {
  const cues = [];
  const blocks = String(text).replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const m = timeLine.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!m) continue;
    const toSec = (h, mi, s, ms) => Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end = toSec(m[5], m[6], m[7], m[8]);
    const idx = lines.indexOf(timeLine);
    const textLines = lines.slice(idx + 1).filter(l => !/^\d+$/.test(l));
    if (!textLines.length) continue;
    cues.push({ start, end, text: textLines.join('\n') });
  }
  return cues;
}

let activeCueIdx = -1;

function renderCaption(t) {
  let i = activeCueIdx;
  if (i >= 0 && t >= subCues[i].start && t < subCues[i].end) {
    // still active
  } else {
    i = -1;
    // linear scan from the previous position is fine (cues are chronological)
    for (let k = 0; k < subCues.length; k++) {
      if (t < subCues[k].start) break;
      if (t >= subCues[k].start && t < subCues[k].end) { i = k; break; }
    }
    activeCueIdx = i;
  }
  if (i >= 0) {
    if (subEl.textContent !== subCues[i].text) subEl.textContent = subCues[i].text;
    subEl.classList.add('show');
  } else {
    clearCaption();
  }
}

function clearCaption() {
  if (!subEl) return;
  subEl.textContent = '';
  subEl.classList.remove('show');
  activeCueIdx = -1;
}

function updateOffsetUI() {
  if (!offsetLabel) return;
  if (Math.abs(subOffset) < 0.005) {
    offsetLabel.textContent = 'Synced';
    offsetLabel.classList.remove('shifted');
  } else {
    offsetLabel.textContent = `${subOffset > 0 ? '+' : ''}${subOffset.toFixed(2)}s`;
    offsetLabel.classList.add('shifted');
  }
}

export function destroyWatch() {
  document.body.classList.remove('watch-mode');
  subCues = [];
  activeCueIdx = -1;
  subEl = null;
  ccBtn = null;
  offsetLabel = null;
  subOn = false;
  subOffset = 0;
  if (messageHandler) {
    window.removeEventListener('message', messageHandler);
    messageHandler = null;
  }
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }
  if (touchStartHandler) {
    document.removeEventListener('touchstart', touchStartHandler);
    touchStartHandler = null;
  }
  clearTimeout(controlsTimer);
  controlsTimer = null;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
}
