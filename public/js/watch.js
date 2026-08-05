// ============================================================
// K - watch.js
// Fullscreen player page with VidKing embed
// ============================================================

import { $, qs, icon, load, save, readProgress, writeProgress, clearProgress, titleOf, yearOf, matchPct } from './utils.js';
import { reportEvent, reportError } from './utils.js';
import { SUBTITLES, VIDKING } from './config.js';
import { details } from './api.js';
import { openWatch } from './card.js';

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

// player state (mirrored from VidKing PLAYER_EVENT messages)
let iframeEl = null;
let playerTime = 0;
let playerDuration = Infinity;
let lastSeekReload = 0;
let toastTimer = null;

// playback loop detection (e.g. player stuck bouncing between two times)
let lastEventTime = -1;
let loopDrops = 0;
let lastLoopReport = 0;
let lastSeekTs = 0;

// seek state (command-first, reload fallback, verified via PLAYER_EVENT)
let pendingSeek = null;        // { target, at }
let seekReloadPending = false;

const VIDKING_ORIGIN = 'https://www.vidking.net';

export function renderWatch(root) {
  // Self-heal: if renderWatch is ever called twice without an intervening
  // destroy (e.g. bfcache/back-forward restores), drop the previous
  // instance's listeners, timers and iframe first.
  destroyWatch();

  const params = qs();
  const type = params.type === 'tv' ? 'tv' : 'movie';
  const id = Number(params.id);

  if (!Number.isInteger(id) || id <= 0) { showError(root, 'Invalid media ID.'); return; }

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
      <div class="watch-transport">
        <button class="btn btn-glass watch-seek-back" aria-label="Rewind 10 seconds">${icon('skipBack')} 10</button>
        <button class="btn btn-glass watch-seek-fwd" aria-label="Forward 10 seconds">10 ${icon('skipFwd')}</button>
      </div>
      <div class="watch-caption"></div>
      <div class="watch-toast"></div>
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
      <div class="watch-actions"></div>
      <p class="watch-desc"></p>
    </div>
  `;

  const backBtn = $('.watch-back', root);
  const unavailable = $('.watch-unavailable', root);
  const retryBtn = $('.watch-retry', root);
  const titleEl = $('.watch-title', root);
  const metaEl = $('.watch-meta', root);
  const descEl = $('.watch-desc', root);
  const actionsEl = $('.watch-actions', root);
  const iframe = $('.watch-iframe', root);
  iframeEl = iframe;
  playerTime = resumeSec;
  playerDuration = Infinity;
  lastSeekReload = 0;
  lastSeekTs = Date.now();
  lastEventTime = -1;
  loopDrops = 0;
  pendingSeek = null;
  seekReloadPending = false;
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

  // transport (rewind / forward 10s) — TV remote support
  $('.watch-seek-back', root)?.addEventListener('click', () => playerSeek(-10));
  $('.watch-seek-fwd', root)?.addEventListener('click', () => playerSeek(10));

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
    const transport = $('.watch-transport', root);
    if (transport) transport.classList.add('show');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      backBtn.classList.remove('show');
      if (inner) inner.classList.remove('show');
      if (transport) transport.classList.remove('show');
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
      if (!data || typeof data !== 'object') return;
      const evt = data.type === 'PLAYER_EVENT' && data.data && typeof data.data === 'object'
        ? data.data
        : data;
      // The embed is a third party we don't control - validate every field
      // type before trusting it.
      if (typeof evt.currentTime !== 'number' || !Number.isFinite(evt.currentTime) || evt.currentTime < 0) return;
      if (typeof evt.duration !== 'number' || !Number.isFinite(evt.duration) || evt.duration <= 0) return;
      playerTime = evt.currentTime;
      playerDuration = evt.duration;

      // seek verification: did we land at the target?
      if (pendingSeek) {
        const dt = Date.now() - pendingSeek.at;
        const seekedEvent = evt.event === 'seeked';
        if (seekedEvent || Math.abs(evt.currentTime - pendingSeek.target) < 5) {
          // command worked (seeked event) or reload landed - seek is done
          pendingSeek = null;
          seekReloadPending = false;
        } else if (dt > 3000 && !seekReloadPending) {
          // events keep streaming but never near the target, and no
          // reload is in flight - the command was ignored
          reportEvent('seek-failed', {
            message: 'Seek command ignored, reload did not run.',
            target: pendingSeek.target, time: evt.currentTime, duration: evt.duration,
            url: iframeEl && iframeEl.src,
          });
          pendingSeek = null;
        }
      }

      // loop detection: the player keeps jumping backward without a seek
      // (matches the "stuck bouncing between 11 and 12 seconds" bug).
      const evtNow = Date.now();
      if (evtNow - lastSeekTs > 1500 && lastEventTime >= 0 && evt.currentTime < lastEventTime - 0.5) {
        loopDrops++;
        if (loopDrops >= 3 && evtNow - lastLoopReport > 60000) {
          lastLoopReport = evtNow;
          reportEvent('player-loop', {
            message: 'Player repeatedly jumped backward (possible stuck loop).',
            type, id, season, episode,
            time: evt.currentTime, last: lastEventTime, duration: evt.duration,
            url: iframeEl && iframeEl.src,
          });
        }
      } else if (lastEventTime >= 0) {
        loopDrops = 0;
      }
      lastEventTime = evt.currentTime;

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
    } catch (err) {
      reportError(err);
    }
  };
  window.addEventListener('message', messageHandler);

  // escape to leave the player
  escHandler = (e) => { if (e.key === 'Escape') window.history.back(); };
  document.addEventListener('keydown', escHandler);

  // Next Episode / Play Again + Restart-from-beginning actions (watch info area)
  const renderWatchActions = (det) => {
    if (!actionsEl) return;
    actionsEl.innerHTML = '';

    if (type === 'tv') {
      const next = nextEpisodeTarget(det, season, episode);
      if (next) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-glass watch-next';
        btn.innerHTML = `${icon('play')} <span>${next.label}</span>`;
        btn.addEventListener('click', () => openWatch('tv', id, next.season, next.episode));
        actionsEl.appendChild(btn);
      }
    }

    if (progress && Number.isFinite(progress.seconds) && progress.seconds > 20) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-glass watch-restart';
      btn.innerHTML = `${icon('skipBack')} <span>Watch from beginning</span>`;
      btn.addEventListener('click', () => {
        clearProgress(type, id);
        playerTime = 0;
        lastSaveAt = 0;
        lastSavedProg = 0;
        lastSeekTs = Date.now();
        btn.remove();
        try {
          const url = new URL(iframeEl.src);
          url.searchParams.set('progress', '0');
          iframeEl.src = url.toString();
        } catch {}
      });
      actionsEl.appendChild(btn);
    }
  };

  // load details for info section
  loadDetails(type, id, season, episode, titleEl, metaEl, descEl, (det) => {
    detInfo = det;
    renderWatchActions(det);
  });

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

// Work out where a "Next Episode" button should take the user.
// Uses the TMDB details payload (details.seasons[] with per-season
// episode_count, details.number_of_seasons). Returns null when the
// data needed for a safe decision is missing (button stays hidden).
function nextEpisodeTarget(det, curSeason, curEpisode) {
  const seasons = Array.isArray(det && det.seasons) ? det.seasons : [];
  const numSeasons = Number(det && det.number_of_seasons);
  const cur = seasons.find((s) => Number(s.season_number) === curSeason);
  const epsInCur = cur && Number.isFinite(cur.episode_count) ? Number(cur.episode_count) : null;
  if (epsInCur == null) return null;
  if (curEpisode < epsInCur) return { season: curSeason, episode: curEpisode + 1, label: 'Next Episode' };
  if (Number.isFinite(numSeasons) && curSeason < numSeasons) return { season: curSeason + 1, episode: 1, label: 'Next Episode' };
  if (!Number.isFinite(numSeasons)) return null;
  return { season: 1, episode: 1, label: 'Play Again' };
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
    cues.push({ start, end, text: textLines.join('\n').replace(/<[^>]+>/g, '') });
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
  if (subEl.textContent || subEl.classList.contains('show')) {
    subEl.textContent = '';
    subEl.classList.remove('show');
  }
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

// ---------------------------------------------------------------
// TV remote transport: ±10s seek
// VidKing's embed sends PLAYER_EVENT postMessages; it *may* also
// accept PLAYER_COMMAND seeks. Strategy: send the lightweight command
// first and verify via PLAYER_EVENT. Only if that is ignored do we
// fall back to reloading the embed with an updated `progress` param
// (which can interrupt playback, so it is a last resort).
// ---------------------------------------------------------------
export function playerSeek(delta) {
  if (!iframeEl) return;
  const base = Number.isFinite(playerTime) ? playerTime : 0;
  const cap = Number.isFinite(playerDuration) ? playerDuration : base + 600;
  const target = Math.max(0, Math.min(base + delta, cap));

  showToast(`${delta > 0 ? '+' : '-'}10s`);
  lastSeekTs = Date.now();

  pendingSeek = { target, at: Date.now() };
  seekReloadPending = false;

  // best-effort command (harmless if the embed ignores it)
  try {
    iframeEl.contentWindow.postMessage(
      { type: 'PLAYER_COMMAND', data: { action: 'seek', to: Math.floor(target) } },
      VIDKING_ORIGIN,
    );
  } catch {}

  // if no verification arrives in time, fall back to the reload mechanism
  clearTimeout(playerSeek._t);
  playerSeek._t = setTimeout(() => {
    if (pendingSeek) seekViaReload(pendingSeek.target);
  }, 1200);
}

function seekViaReload(target) {
  const now = Date.now();
  if (now - lastSeekReload < 1200) return;
  lastSeekReload = now;
  lastSeekTs = now;
  seekReloadPending = true;
  try {
    const url = new URL(iframeEl.src);
    url.searchParams.set('progress', String(target));
    iframeEl.src = url.toString();
  } catch {}

  // if the reload produces no player events, the embed is stuck
  // (e.g. autoplay blocked after a programmatic reload)
  clearTimeout(seekViaReload._t);
  seekViaReload._t = setTimeout(() => {
    if (seekReloadPending && pendingSeek) {
      reportEvent('seek-stalled', {
        message: 'No player events after seek reload (autoplay blocked or embed failed).',
        target, url: iframeEl && iframeEl.src,
      });
      pendingSeek = null;
      seekReloadPending = false;
    }
  }, 8000);
}

function showToast(msg) {
  const t = $('.watch-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1100);
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
  if (iframeEl) {
    iframeEl.remove();
    iframeEl = null;
  }
  playerTime = 0;
  playerDuration = Infinity;
  lastSeekReload = 0;
  lastEventTime = -1;
  loopDrops = 0;
  lastLoopReport = 0;
  lastSeekTs = 0;
  pendingSeek = null;
  seekReloadPending = false;
  clearTimeout(playerSeek._t);
  clearTimeout(seekViaReload._t);
  clearTimeout(toastTimer);
  toastTimer = null;
}
