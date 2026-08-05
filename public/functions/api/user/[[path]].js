// ============================================================
// K - User data sync + error reporting (Cloudflare Pages Function)
// Serves: /api/user/*
// Backed by Cloudflare KV namespace bound as USER_DATA.
// localStorage is the client cache; this is the durable backup so
// cleared/corrupted client storage can be repaired remotely and
// we receive reports when something goes wrong.
// ============================================================

const WRITE_LIMIT = 60;   // PUT/POST per IP per minute
const READ_LIMIT = 300;
const WINDOW = 60 * 1000;
const MAX_BODY = 64 * 1024;
const MAX_BLOB = 96 * 1024;
const REPORT_TTL = 7 * 24 * 60 * 60; // seconds
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

export async function onRequest(context) {
  const kv = (context.env && context.env.USER_DATA) || null;
  const url = new URL(context.request.url);
  const method = context.request.method;
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const path = url.pathname.replace(/^\/api\/user\/?/, '').replace(/\/+$/, '');

  if (!kv) {
    return json({ error: 'USER_DATA KV binding is not configured.' }, 503);
  }

  // ---- GET /api/user/data?uid=... : fetch this client's blob
  if (method === 'GET' && path === 'data') {
    if (!hit(ip, 'reads', READ_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    if (!UID_RE.test(uid)) return json({ error: 'Bad uid' }, 400);
    const raw = await kv.get(`data:${uid}`);
    if (!raw) return json({});
    try { return json(JSON.parse(raw)); } catch { return json({}); }
  }

  // ---- PUT /api/user/data : merge one key into the client blob
  if (method === 'PUT' && path === 'data') {
    if (!hit(ip, 'writes', WRITE_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const body = await readBody(context.request);
    if (!body || !UID_RE.test(String(body.uid || '')) || !KEY_RE.test(String(body.key || ''))) {
      return json({ error: 'Bad payload' }, 400);
    }
    const key = `data:${body.uid}`;
    let blob = {};
    try { blob = JSON.parse((await kv.get(key)) || '{}'); } catch { blob = {}; }
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
    await kv.put(key, text);
    return json({ ok: true });
  }

  // ---- DELETE /api/user/data?uid=... : wipe this client's blob
  if (method === 'DELETE' && path === 'data') {
    if (!hit(ip, 'writes', WRITE_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    if (!UID_RE.test(uid)) return json({ error: 'Bad uid' }, 400);
    await kv.delete(`data:${uid}`);
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
      const key = `report:${uid}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry = {
        uid,
        name: String(r.name || 'event').slice(0, 80),
        level: String(r.level || 'info').slice(0, 20),
        message: String(r.message || '').slice(0, 1000),
        detail: String(r.detail || '').slice(0, 3000),
        url: String(r.url || '').slice(0, 300),
        ts: Number(r.ts) || Date.now(),
      };
      await kv.put(key, JSON.stringify(entry), { expirationTtl: REPORT_TTL });
      const list = await kv.list({ prefix: `report:${uid}:` });
      if (list.keys.length > REPORT_CAP) {
        const extra = list.keys.slice(0, list.keys.length - REPORT_CAP);
        for (const k of extra) await kv.delete(k.name);
      }
    }
    return json({ ok: true });
  }

  // ---- GET /api/user/reports : admin view (latest reports, newest first)
  if (method === 'GET' && path === 'reports') {
    if (!hit(ip, 'reads', READ_LIMIT)) return json({ error: 'Too many requests' }, 429);
    const uid = url.searchParams.get('uid') || '';
    const prefix = uid && UID_RE.test(uid) ? `report:${uid}:` : 'report:';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);
    const list = await kv.list({ prefix, limit });
    const out = [];
    for (const k of list.keys) {
      try { out.push(JSON.parse(await kv.get(k.name))); } catch { /* skip */ }
    }
    out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return json(out.slice(0, limit));
  }

  return json({ error: 'Not found' }, 404);
}
