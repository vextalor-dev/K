// ============================================================
// K - tv-controls.js
// Netflix-style TV remote control:
//  - spatial D-pad navigation (geometry based, any page)
//  - tv-mode focus rings + card scale (see css/tv-controls.css)
//  - hero slides via Left/Right, Down drops to first card
//  - per-route focus initializer
//  - watch page: Left/Right seek ±10s, Up/Down enter controls
// ============================================================

import { $, $$ } from './utils.js';
import { heroSlide } from './hero.js';
import { playerSeek } from './watch.js';

const CANDIDATE_SEL = 'a[href], button, select, [tabindex]:not([tabindex="-1"]), [role="button"]';
const SKIP_SEL = '.row-arrow, .hero-dot';

let controlsTimer = null;
let sawPointer = false;

// ---------------------------------------------------------------
// TV mode detection
// ---------------------------------------------------------------
export function isTvMode() {
  return document.body.classList.contains('tv-mode');
}

function enterTvMode() {
  if (!isTvMode()) {
    document.body.classList.add('tv-mode');
    // autofocus steals focus from D-pad navigation on TV
    $$('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
  }
}

function exitTvMode() {
  document.body.classList.remove('tv-mode');
}

function detectTv() {
  const ua = (navigator.userAgent || '').toLowerCase();
  return /(android tv|googletv|smart[- ]?tv|tizen|web0s|netcast|roku|apple ?tv|crkey|bravia)/.test(ua);
}

// ---------------------------------------------------------------
// Focusable candidates + geometry
// ---------------------------------------------------------------
function isVisible(el) {
  if (!(el instanceof Element) || el.disabled) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.closest(SKIP_SEL)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  let p = el.parentElement;
  while (p) {
    if (p.hidden || getComputedStyle(p).display === 'none') return false;
    p = p.parentElement;
  }
  return true;
}

function candidates() {
  return $$(CANDIDATE_SEL)
    .filter(el => el.tagName !== 'INPUT')
    .filter(isVisible)
    .filter(el => el !== document.activeElement);
}

function rectOf(el) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    cx: r.left + r.width / 2, cy: r.top + r.height / 2,
  };
}

// Pick the element closest in `dir` from `from`. Same column wins for
// up/down, same row wins for left/right (matching Netflix row behavior).
function spatialMove(dir, from) {
  const cur = rectOf(from);
  let best = null;
  let bestScore = Infinity;
  for (const el of candidates()) {
    const r = rectOf(el);
    if (r.right - r.left <= 0 || r.bottom - r.top <= 0) continue;
    let score = Infinity;
    if (dir === 'right') {
      if (r.right <= cur.right) continue;
      const overlap = Math.max(0, Math.min(r.bottom, cur.bottom) - Math.max(r.top, cur.top));
      score = (r.left - cur.right) + (overlap > 0 ? 0 : Math.min(Math.abs(r.top - cur.top), Math.abs(r.bottom - cur.bottom)) * 4);
    } else if (dir === 'left') {
      if (r.left >= cur.left) continue;
      const overlap = Math.max(0, Math.min(r.bottom, cur.bottom) - Math.max(r.top, cur.top));
      score = (cur.left - r.right) + (overlap > 0 ? 0 : Math.min(Math.abs(r.top - cur.top), Math.abs(r.bottom - cur.bottom)) * 4);
    } else if (dir === 'down') {
      if (r.bottom <= cur.bottom) continue;
      const overlap = Math.max(0, Math.min(r.right, cur.right) - Math.max(r.left, cur.left));
      score = (r.top - cur.bottom) + (overlap > 0 ? 0 : Math.min(Math.abs(r.left - cur.left), Math.abs(r.right - cur.right)) * 4);
    } else if (dir === 'up') {
      if (r.top >= cur.top) continue;
      const overlap = Math.max(0, Math.min(r.right, cur.right) - Math.max(r.left, cur.left));
      score = (cur.top - r.bottom) + (overlap > 0 ? 0 : Math.min(Math.abs(r.left - cur.left), Math.abs(r.right - cur.right)) * 4);
    }
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

function focusEl(el, dir) {
  if (!el || typeof el.focus !== 'function') return;
  el.focus({ preventScroll: true });
  scrollToFit(el, dir);
}

function scrollToFit(el, dir) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  if (getComputedStyle(el).position === 'fixed') return;
  const needV = r.top < vh * 0.2 || r.bottom > vh * 0.82;
  const needH = r.left < 8 || r.right > vw - 8;
  if (!needV && !needH) return;
  try {
    el.scrollIntoView({
      block: (dir === 'up' || dir === 'down') ? 'center' : needV ? 'center' : 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  } catch (e) {}
}

// ---------------------------------------------------------------
// Per-route focus initializer
// ---------------------------------------------------------------
function primaryEl() {
  if (document.querySelector('.hero')) {
    const play = $('.hero .hero-play');
    if (play) return play;
  }
  if ($('.detail-play')) return $('.detail-play');
  const preferred = [
    '#app-root .top-search-row',
    '#app-root .result-card',
    '#app-root .np-item',
    '#app-root .episode-row',
    '#app-root .grid-card',
    '#app-root .card',
  ];
  for (const sel of preferred) {
    const el = $(sel);
    if (el && isVisible(el)) return el;
  }
  return candidates().find(el => el.closest('#app-root')) || null;
}

export function resetFocus() {
  if (document.body.classList.contains('watch-mode')) return;
  if (!isTvMode()) return;
  const el = primaryEl();
  if (el) { focusEl(el); return; }
  // rows/pages render async — wait briefly for content
  const deadline = Date.now() + 2500;
  const tick = () => {
    if (Date.now() > deadline) return;
    const target = primaryEl();
    if (target) { focusEl(target); return; }
    setTimeout(tick, 100);
  };
  tick();
}

// ---------------------------------------------------------------
// Directional handling (non-watch pages)
// ---------------------------------------------------------------
function handleArrow(dir, ae) {
  if (document.body.classList.contains('watch-mode')) {
    handleWatchArrow(dir, ae);
    return;
  }

  // hero region: Left/Right switch slides, Down drops to first card
  if (ae && ae.closest('.hero')) {
    if (dir === 'left' || dir === 'right') {
      heroSlide(dir === 'left' ? -1 : 1);
      return;
    }
    if (dir === 'down') {
      const first = $('#home-rows .card') || $('#app-root .card');
      if (first) focusEl(first, dir);
      return;
    }
    return;
  }

  const cur = document.activeElement;
  if (!cur || cur === document.body) { resetFocus(); return; }

  const target = spatialMove(dir, cur);
  if (target) focusEl(target, dir);
}

// ---------------------------------------------------------------
// Watch page: video focus (seek) vs. controls focus (navigate)
// ---------------------------------------------------------------
function isWatchControl(el) {
  return !!el.closest('.watch-back, .watch-subs, .watch-transport');
}

function showWatchControls() {
  document.body.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => {
    document.body.classList.remove('controls-visible');
    const ae = document.activeElement;
    if (ae && isWatchControl(ae)) ae.blur();
  }, 4000);
}

function hideWatchControls() {
  document.body.classList.remove('controls-visible');
  const ae = document.activeElement;
  if (ae && isWatchControl(ae)) ae.blur();
}

function handleWatchArrow(dir, ae) {
  showWatchControls();

  if (!ae || !isWatchControl(ae)) {
    // video focus mode: Left/Right seek, Up/Down enter controls
    if (dir === 'left') { playerSeek(-10); return; }
    if (dir === 'right') { playerSeek(10); return; }
    const first = dir === 'down'
      ? ($('.watch-transport .watch-seek-back') || $('.watch-back'))
      : $('.watch-back');
    if (first) focusEl(first, dir);
    return;
  }

  const target = spatialMove(dir, ae);
  if (target) { focusEl(target, dir); return; }
  hideWatchControls();
}

// ---------------------------------------------------------------
// Back button: close overlays/menus first, then navigate back
// ---------------------------------------------------------------
function back() {
  if (document.querySelector('.mobile-menu.open')) {
    const ham = document.querySelector('.hamburger-btn');
    if (ham) { ham.click(); return; }
  }
  const open = document.querySelector(
    '.modal-overlay, .browse-dropdown.open, .search-drop.open, .search-box.open'
  );
  if (open) {
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } catch (err) {
      window.history.back();
    }
    return;
  }
  window.history.back();
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
export function initTvControls() {
  if (window.__tvControlsInit) return;
  window.__tvControlsInit = true;

  // force TV mode for testing: open the site with ?tv=1
  const forceTv = (location.search || '').includes('tv=1');
  if (detectTv() || forceTv) {
    document.body.classList.add('tv-mode');
    $$('[autofocus]').forEach(el => el.removeAttribute('autofocus'));
  }

  const markPointer = () => { sawPointer = true; };
  const exitTvOnPointer = () => { sawPointer = true; exitTvMode(); };
  document.addEventListener('mousedown', exitTvOnPointer);
  document.addEventListener('touchstart', exitTvOnPointer, { passive: true });
  document.addEventListener('mousemove', markPointer, { passive: true });

  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    const inText = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
    const inField = inText || (ae && ae.tagName === 'SELECT');

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key.slice(5).toLowerCase();
      if (inField) {
        // On TV, arrows leave text fields and take over navigation;
        // selects keep their native option-change behavior.
        if (isTvMode() && inText) {
          ae.blur();
          e.preventDefault();
          handleArrow(dir, null);
        }
        return;
      }
      // Don't hijack arrow-scroll on pointer-driven devices that never
      // asked for TV navigation.
      if (!isTvMode() && sawPointer) return;
      enterTvMode();
      e.preventDefault();
      handleArrow(dir, ae === document.body ? null : ae);
      return;
    }

    if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
      if (!ae || ae === document.body) {
        enterTvMode();
        e.preventDefault();
        resetFocus();
      }
      return;
    }

    if (isTvMode() || document.body.classList.contains('watch-mode')) {
      if (e.key === 'Back' || e.key === 'Backspace' || e.key === 'BrowserBack' || e.code === 'GoBack') {
        if (inField) return;
        e.preventDefault();
        back();
        return;
      }
    }

    if (document.body.classList.contains('watch-mode')) {
      if (e.key === 'MediaRewind' || e.code === 'MediaRewind') { e.preventDefault(); playerSeek(-10); }
      if (e.key === 'MediaFastForward' || e.code === 'MediaFastForward') { e.preventDefault(); playerSeek(10); }
    }
  });
}
