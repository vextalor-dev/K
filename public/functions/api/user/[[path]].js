// ============================================================
// K - User data sync + error reporting (Cloudflare Pages Function)
// Serves: /api/user/*
// Backed by Cloudflare D1 (SQLite) bound as "DB".
// localStorage is the client cache; D1 is the durable backup so
// cleared/corrupted client storage can be repaired remotely and
// we receive reports when something goes wrong.
// ============================================================

const WRITE_LIMIT = 60;   // PUT/POST per IP per minute
const READ_LIMIT = 300;
const WINDOW = 60 * 1000;
const MAX_BODY = 64 * 1024;
const MAX_BLOB = 96 * 1024;
const REPORT_CAP = 200;

const buckets = new Map(); // ip -> { writes: [], reads: [] }

function hit(ip, key, limit) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) { b = { writes: [], reads: [] }; buckets.set(ip, b); }
  const arr = b[key];
  while (arr.length && now - arr[0] > WINDOW) arr.shift();
  if (arr.length >= limit) return false;
  arr.push(now);
  return true;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const UID_RE = /^[a-zA-Z0-9_-]{6,64}$/;
const KEY_RE = /^nkx-[A-Za-z0-9._:-]{1,80}$/;

async function readBody(req) {
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const text = await req.text();
    if (!text || text.length > MAX_BODY) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// Schema (created lazily on first request so no migrations needed)
// ---------------------------------------------------------------
const INIT_SQL = [
  'CREATE TABLE IF NOT EXISTS user_data (uid TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT NOT NULL, name TEXT NOT NULL DEFAULT \'\', level TEXT NOT NULL DEFAULT \'info\', message TEXT NOT NULL DEFAULT \'\', detail TEXT NOT NULL DEFAULT \'\', url TEXT NOT NULL DEFAULT \'\', ts INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_reports_ts ON reports (ts DESC)',
  'CREATE INDEX IF NOT EXISTS idx_reports_uid ON reports (uid)',
];

let initialized = false;

async function ensureDb(db) {
  if (initialized) return true;
  try {
    await db.batch(INIT_SQL.map((s) => db.prepare(s)));
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

export async function onRequest(context) {
  const db = (context.env && context.env.DB) || null;
  const url = new URL(context.request.url);
  const method = context.request.method;
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const path = url.pathname.replace(/^\/api\/user\/?/, '').replace(/\/+$/, '');

  if (!db) {
    return json({ error: 'D1 DB binding is not configured.' }, 503);
  }
  if (!(await ensureDb(db))) {
    return json({ error: 'Database initialization failed.' }, 500);
  }

  // ---- GET /api/user/data?uid=... : fetch this client's blob
  if (method === 'GET' && path === 'data') {
    if (!hit(ip, 'reads', READ_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    if (!UID_RE.test(uid)) return json({ error: 'Bad uid' }, 400);
    try {
      const row = await db.prepare('SELECT data FROM user_data WHERE uid = ?').bind(uid).first();
      if (!row || !row.data) return json({});
      return json(JSON.parse(row.data));
    } catch {
      return json({});
    }
  }

  // ---- PUT /api/user/data : merge one key into the client blob
  if (method === 'PUT' && path === 'data') {
    if (!hit(ip, 'writes', WRITE_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const body = await readBody(context.request);
    if (!body || !UID_RE.test(String(body.uid || '')) || !KEY_RE.test(String(body.key || ''))) {
      return json({ error: 'Bad payload' }, 400);
    }
    let blob = {};
    try {
      const row = await db.prepare('SELECT data FROM user_data WHERE uid = ?').bind(body.uid).first();
      if (row && row.data) blob = JSON.parse(row.data);
    } catch { blob = {}; }
    blob[body.key] = body.value;
    let text = JSON.stringify(blob);
    if (text.length > MAX_BLOB) {
      // Drop oldest entries (by updatedAt) until the blob fits.
      const keys = Object.keys(blob).sort((a, b) =>
        ((blob[a] && blob[a].updatedAt) || 0) - ((blob[b] && blob[b].updatedAt) || 0),
      );
      for (const k of keys) {
        delete blob[k];
        text = JSON.stringify(blob);
        if (text.length <= MAX_BLOB) break;
      }
    }
    await db.prepare(
      'INSERT INTO user_data (uid, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(uid) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    ).bind(body.uid, text, Date.now()).run();
    return json({ ok: true });
  }

  // ---- DELETE /api/user/data?uid=... : wipe this client's blob
  if (method === 'DELETE' && path === 'data') {
    if (!hit(ip, 'writes', WRITE_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    if (!UID_RE.test(uid)) return json({ error: 'Bad uid' }, 400);
    await db.prepare('DELETE FROM user_data WHERE uid = ?').bind(uid).run();
    return json({ ok: true });
  }

  // ---- POST /api/user/report : batch of error/event reports
  if (method === 'POST' && path === 'report') {
    if (!hit(ip, 'writes', WRITE_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const body = await readBody(context.request);
    const reports = Array.isArray(body && body.reports) ? body.reports.slice(0, 20) : [];
    for (const r of reports) {
      const uid = String((r && r.uid) || '');
      if (!UID_RE.test(uid)) continue;
      await db.prepare(
        'INSERT INTO reports (uid, name, level, message, detail, url, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(
        uid,
        String(r.name || 'event').slice(0, 80),
        String(r.level || 'info').slice(0, 20),
        String(r.message || '').slice(0, 1000),
        String(r.detail || '').slice(0, 3000),
        String(r.url || '').slice(0, 300),
        Number(r.ts) || Date.now(),
      ).run();
      // keep only the newest REPORT_CAP per client
      await db.prepare(
        'DELETE FROM reports WHERE uid = ? AND id NOT IN (SELECT id FROM reports WHERE uid = ? ORDER BY ts DESC, id DESC LIMIT ?)',
      ).bind(uid, uid, REPORT_CAP).run();
    }
    return json({ ok: true });
  }

  // ---- GET /api/user/reports : admin view (latest reports, newest first)
  if (method === 'GET' && path === 'reports') {
    if (!hit(ip, 'reads', READ_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);
    try {
      const { results } = uid && UID_RE.test(uid)
        ? await db.prepare('SELECT * FROM reports WHERE uid = ? ORDER BY ts DESC, id DESC LIMIT ?').bind(uid, limit).all()
        : await db.prepare('SELECT * FROM reports ORDER BY ts DESC, id DESC LIMIT ?').bind(limit).all();
      return json(results);
    } catch {
      return json([]);
    }
  }

  return json({ error: 'Not found' }, 404);
}
