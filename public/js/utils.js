// ============================================================
// K - utils.js
// DOM helpers, formatting, lucide-style icons, localStorage
// ============================================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const matchPct = (vote) => clamp(Math.round((vote || 0) * 10), 0, 99);

export const yearOf = (item) =>
  String((item.release_date || item.first_air_date || '').slice(0, 4) || '');

export const titleOf = (item) => item.title || item.name || 'Untitled';

export const mediaTypeOf = (item) =>
  item.media_type === 'tv' || item.media_type === 'movie'
    ? item.media_type
    : item.name || item.first_air_date ? 'tv' : 'movie';

export const posterOf = (item, size = 'w342') =>
  item.poster_path ? `https://image.tmdb.org/t/p/${size}${item.poster_path}` : null;

export const backdropOf = (item, size = 'w780') =>
  item.backdrop_path ? `https://image.tmdb.org/t/p/${size}${item.backdrop_path}` : null;

export const stillOf = (item) =>
  item.still_path ? `https://image.tmdb.org/t/p/w300${item.still_path}` : null;

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const dateBadge = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return null;
  return { dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), day: String(d.getDate()).padStart(2, '0') };
};

export const runtimeText = (item) => {
  const m = item.runtime;
  if (!m || m <= 0) return null;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export const hms = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export const save = (key, val) => {
  saveLocal(key, val);
  queueSync(key);
};
export const load = (key, fallback = null) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

// ============================================================
// Server-backed sync + error reporting
// localStorage stays the local cache; every save() is mirrored to
// /api/user/* (Cloudflare KV) so cleared/corrupted storage can be
// repaired remotely, and failures get reported back to us.
// ============================================================

const UID_KEY = 'nkx-uid';

const saveLocal = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

export const clientId = () => {
  let id = load(UID_KEY, null);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{6,64}$/.test(id)) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    saveLocal(UID_KEY, id);
  }
  return id;
};

// Debounced mirror of nkx-* keys to the server.
const pendingSync = new Map();
let syncTimer = null;

function queueSync(key) {
  if (!/^nkx-/.test(key)) return;
  try { pendingSync.set(key, load(key)); } catch { pendingSync.delete(key); }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSync, 400);
}

async function flushSync() {
  const uid = clientId();
  const entries = Array.from(pendingSync.entries());
  pendingSync.clear();
  for (const [key, value] of entries) {
    if (!/^nkx-/.test(key) || key === UID_KEY) continue;
    try {
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, key, value }),
      });
    } catch { /* offline / server down - local copy survives */ }
  }
}

// Pull the server blob and fill in any keys missing locally
// (localStorage wins when both exist - it is the active cache).
export async function pullData() {
  try {
    const uid = clientId();
    const res = await fetch(`/api/user/data?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== 'object') return;
    for (const key of Object.keys(data)) {
      if (!/^nkx-/.test(key) || key === UID_KEY) continue;
      let has = false;
      try { has = localStorage.getItem(key) != null; } catch {}
      if (!has) saveLocal(key, data[key]);
    }
  } catch {}
}

// Batched, throttled error/event reports -> POST /api/user/report
let reportQueue = [];
let reportTimer = null;
let lastReportAt = 0;

export const reportEvent = (name, detail = {}, opts = {}) => {
  try {
    const now = Date.now();
    if (now - lastReportAt < (opts.minInterval || 5000)) return;
    reportQueue.push({
      uid: clientId(),
      name: String(name || 'event').slice(0, 80),
      level: opts.level || 'info',
      message: String((detail && detail.message) || '').slice(0, 1000),
      detail: JSON.stringify(detail).slice(0, 2000),
      url: (typeof location !== 'undefined' ? location.href : '').slice(0, 300),
      ts: now,
    });
    lastReportAt = now;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      const batch = reportQueue.splice(0, 20);
      if (!batch.length) return;
      fetch('/api/user/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports: batch }),
      }).catch(() => {});
    }, 800);
  } catch {}
};

export const reportError = (err, opts = {}) =>
  reportEvent('error', { message: String((err && (err.message || err)) || 'unknown error') }, { level: 'error', ...opts });

export const qs = () => Object.fromEntries(new URLSearchParams(location.search));

export const onEnter = (el, fn) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
  });
};

export const withRetry = async (fn, n = 2) => {
  let lastErr;
  for (let i = 0; i < n; i++) { try { return await fn(); } catch (e) { lastErr = e; if (i < n - 1) await new Promise(r => setTimeout(r, 600)); } }
  throw lastErr;
};

// ============================================================
// Lucide-style SVG icon set (stroke, rounded caps)
// ============================================================

const ICONS = {
  play:        '<polygon fill="currentColor" points="6,3 20,12 6,21"/>',
  info:        '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  plus:        '<path d="M12 5v14m-7-7h14"/>',
  check:       '<path d="M20 6 9 17l-5-5"/>',
  like:        '<path d="M7 10v12m0 0h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14m0 13H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>',
  dislike:     '<path d="M17 14V2m0 12h-3.72a2 2 0 00-1.92 1.3L9.1 22.7a2 2 0 01-1.92 1.3H2m0-13a2 2 0 012-2h3.76a2 2 0 011.92 1.1l1.38 3.1A2 2 0 0012 13z"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevRight:   '<path d="m9 18 6-6-6-6"/>',
  chevDown:    '<path d="m6 9 6 6 6-6"/>',
  search:      '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell:        '<path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 003.4 0"/>',
  back:        '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  close:       '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  menu:        '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
  grid:        '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/>',
  home:        '<path d="m3 9 9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/>',
  film:        '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 7h5"/><path d="M17 17h5"/>',
  tv:          '<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>',
  star:        '<polygon fill="currentColor" points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>',
  globe:       '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/>',
  heart:       '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3.33.81-4.5 2.09C10.83 3.81 9.26 3 7.5 3A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
  sparkles:    '<path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.581a.5.5 0 010 .964L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
  volume:      '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>',
  subtitles:   '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M6 11h4"/><path d="M14 11h4"/><path d="M6 15h8"/><path d="M16 15h2"/>',
  subLater:    '<path d="M12 6v12"/><path d="m8 10 4-4 4 4"/>',
  subEarlier:  '<path d="M12 6v12"/><path d="m8 14 4 4 4-4"/>',
  skipBack:    '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
  skipFwd:     '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const avatarSvg = (bg) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" fill="${bg}"/><circle cx="16" cy="12" r="5.5" fill="#fff"/><path d="M16 20c-6.2 0-9.5 3-9.5 7.5V29h19v-1.5C25.5 23 22.2 20 16 20z" fill="#fff"/></svg>`;

// ============================================================
// Watch-progress store (localStorage)
// ============================================================

const PROGRESS_PREFIX = 'nkx-progress-';
export const progressKey = (type, id) => `${PROGRESS_PREFIX}${type}-${id}`;
export const readProgress = (type, id) => load(progressKey(type, id), null);
export const writeProgress = (rec) => save(progressKey(rec.type, rec.id), { ...rec, updatedAt: Date.now() });
export const clearProgress = (type, id) => { try { localStorage.removeItem(progressKey(type, id)); } catch {} };

export const continueWatchingItems = () => {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PROGRESS_PREFIX)) {
        const rec = load(key, null);
        if (rec && rec.progress > 0.005 && rec.progress < 0.92 && rec.title) out.push(rec);
      }
    }
  } catch {}
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};
