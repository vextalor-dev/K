// ============================================================
// K - mylist.js
// "My List" persistence (localStorage key: nkx-mylist)
// ============================================================

import { load, save } from './utils.js';

const KEY = 'nkx-mylist';

export const getList = () => {
  const list = load(KEY, []);
  return Array.isArray(list) ? list : [];
};

export const inList = (id, type) => getList().some((x) => x.id === id && x.type === type);

export const add = (item) => {
  if (!item || item.id == null || item.type == null) return false;
  const list = getList();
  if (!inList(item.id, item.type)) {
    list.push({
      id: item.id,
      type: item.type,
      title: item.title || item.name,
      poster: item.poster_path || null,
      backdrop: item.backdrop_path || null,
      vote: item.vote_average || 0,
      year: item.release_date || item.first_air_date || null,
    });
    save(KEY, list);
    return true;
  }
  return false;
};

export const remove = (id, type) => save(KEY, getList().filter((x) => !(x.id === id && x.type === type)));

export const toggle = (item) => {
  if (inList(item.id, item.type)) {
    remove(item.id, item.type);
    return false;
  }
  add(item);
  return true;
};

// reactions (like / dislike) - key: nkx-reactions = { "movie:123": "like" }
const REACTIONS_KEY = 'nkx-reactions';

// Guard against corrupted/tampered storage (non-object JSON) so a bad
// value under one key can never crash a page render.
const safeObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const getReaction = (id, type) => {
  try {
    return safeObject(load(REACTIONS_KEY, {}))[`${type}:${id}`] || null;
  } catch {
    return null;
  }
};

export const setReaction = (id, type, value) => {
  try {
    const all = safeObject(load(REACTIONS_KEY, {}));
    const key = `${type}:${id}`;
    if (value == null) delete all[key];
    else all[key] = value;
    save(REACTIONS_KEY, all);
  } catch {}
};

export const likedItems = () => {
  try {
    return Object.entries(safeObject(load(REACTIONS_KEY, {})))
      .filter(([, v]) => v === 'like')
      .map(([k]) => {
        const [type, id] = k.split(':');
        return { type, id: Number(id) };
      })
      .filter((x) => x.type && (x.type === 'movie' || x.type === 'tv') && Number.isInteger(x.id) && x.id > 0);
  } catch {
    return [];
  }
};

// Notify Me toggles for New & Popular
const NOTIFY_KEY = 'nkx-notify';

export const isNotified = (id) => {
  try {
    const list = load(NOTIFY_KEY, []);
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
};

export const toggleNotify = (id) => {
  try {
    const list = load(NOTIFY_KEY, []);
    if (!Array.isArray(list)) return;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    save(NOTIFY_KEY, list);
  } catch {}
};

export const count = () => getList().length;
