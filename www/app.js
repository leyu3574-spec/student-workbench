(() => {
'use strict';

const VERSION = '0.9.__BUILD__';
const TEST_ID = 2100000000; // outside the range nid() produces
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const WD = ['一', '二', '三', '四', '五', '六', '日'];
const PX_DAY = 1.1, PX_WEEK = 1; // roomier day timeline so short blocks stay readable // px per minute: today ruler / week grid
const LS_THEME = 'swb:theme', LS_STATE = 'swb:state:v1', LS_AUTOBAK = 'swb:autobak';
const cap = window.Capacitor;
const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
const plugin = name => (isNative && cap.Plugins && cap.Plugins[name]) || null;

const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const newId = () => (window.crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = v => (typeof v === 'string' ? v : '');
const arr = v => (Array.isArray(v) ? v : []);
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ---------- time ---------- */
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fmtHM = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const fmtMin = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const md = d => (d.getMonth() + 1) + '/' + d.getDate();
const isoDay = d => { const g = d.getDay(); return g === 0 ? 7 : g; };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = d => addDays(startOfDay(d), -(isoDay(d) - 1));
function parseYMD(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function parseDue(s) { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; }
function toMin(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function durText(m) { if (m < 60) return m + '分钟'; const h = Math.floor(m / 60), r = m % 60; return h + '小时' + (r ? r + '分' : ''); }
function countdown(due, now) {
  const diff = due - now, a = Math.abs(diff), H = 3600000, D = 86400000;
  const unit = a < H ? Math.max(1, Math.round(a / 60000)) + '分钟' : a < D ? Math.floor(a / H) + '小时' : Math.floor(a / D) + '天';
  return (diff < 0 ? '过期' : '剩') + unit;
}
function dueLabel(due, now) {
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86400000), hm = fmtHM(due);
  if (days === 0) return '今天 ' + hm;
  if (days === 1) return '明天 ' + hm;
  if (days === 2) return '后天 ' + hm;
  if (days === -1) return '昨天 ' + hm;
  return (due.getMonth() + 1) + '月' + due.getDate() + '日 周' + WD[isoDay(due) - 1] + ' ' + hm;
}
function urgency(due, now) {
  const diff = due - now;
  if (diff < 0) return 'over';
  if (diff < 86400000) return 'urgent';
  if (diff < 3 * 86400000) return 'soon';
  return '';
}

/* ---------- data ---------- */
const DEFAULT_PERIODS = [['08:10', '08:55'], ['09:05', '09:50'], ['10:20', '11:05'], ['11:15', '12:00'], ['13:30', '14:15'],
  ['14:25', '15:10'], ['15:40', '16:25'], ['16:35', '17:20'], ['18:30', '19:15'], ['19:25', '20:10']].map(([start, end]) => ({ start, end }));
// extra course info: hidden by default, switched on in 我的 → 课表上显示
const SHOW_FIELDS = [['teacher', '老师'], ['weeks', '上课周'], ['periods', '节次'], ['kind', '类型'], ['nature', '必修/选修'], ['credit', '学分'], ['exam', '考核方式'], ['klass', '教学班']];
const INFO_KEYS = ['kind', 'nature', 'exam', 'credit', 'klass', 'comp', 'hours', 'p'];
function defaults() {
  return {
    v: 1,
    settings: { nick: '', goal: '', path: '保研', rival: { name: '卷王', daily: true }, race: { start: '', finish: '2028-09-25' }, termStart: '', totalWeeks: 18, dayStart: 8, dayEnd: 22, periods: clone(DEFAULT_PERIODS), notifyLead: 60, show: {}, plan: { latest: 1380, maxBlock: 90, meals: [['12:00', '13:30'], ['17:30', '18:30']] }, updatedAt: 0 },
    courses: [],
    tasks: [],
    others: [],
    plans: [],
    routines: [],
    busy: [],
    memory: []
  };
}
function normSettings(v) {
  const o = Object.assign(defaults().settings, v && typeof v === 'object' ? clone(v) : {});
  delete o.name; delete o.cls;
  o.nick = str(o.nick).slice(0, 12); o.goal = str(o.goal).slice(0, 16);
  o.termStart = parseYMD(o.termStart) ? o.termStart : '';
  delete o.routeStart;
  const rv = o.rival && typeof o.rival === 'object' ? o.rival : {}, old = o.pacer && typeof o.pacer === 'object' ? o.pacer : {};
  o.rival = { name: str(rv.name).trim().slice(0, 8) || (str(old.name) && old.name !== '兔子' ? str(old.name).slice(0, 8) : '卷王'), daily: (rv.daily !== undefined ? rv.daily : old.daily) !== false };
  delete o.pacer;
  const rc = o.race && typeof o.race === 'object' ? o.race : {};
  o.race = { start: parseYMD(rc.start) ? rc.start : '', finish: parseYMD(rc.finish) ? rc.finish : '2028-09-25' };
  o.path = o.path === '考研' ? '考研' : '保研';
  const pl = o.plan && typeof o.plan === 'object' ? o.plan : {};
  const lat = Number(pl.latest), okMeal = m => Array.isArray(m) && HM.test(m[0]) && HM.test(m[1]) && toMin(m[1]) > toMin(m[0]);
  o.plan = { latest: lat > 0 && lat <= 24 ? lat * 60 : clampInt(lat, 18 * 60, 24 * 60, 23 * 60), maxBlock: clampInt(pl.maxBlock, 15, 240, 90),
    meals: Array.isArray(pl.meals) && pl.meals.length === 2 && pl.meals.every(okMeal) ? pl.meals.map(m => [m[0], m[1]]) : [['12:00', '13:30'], ['17:30', '18:30']] };
  o.totalWeeks = clampInt(o.totalWeeks, 8, 30, 18);
  const show = o.show && typeof o.show === 'object' ? o.show : {};
  o.show = {}; SHOW_FIELDS.forEach(([k]) => { o.show[k] = !!show[k]; });
  o.dayStart = clampInt(o.dayStart, 0, 12, 8);
  o.dayEnd = clampInt(o.dayEnd, 13, 24, 22);
  o.periods = Array.isArray(o.periods)
    ? o.periods.filter(p => p && HM.test(p.start) && HM.test(p.end)).map(p => ({ start: p.start, end: p.end }))
    : clone(DEFAULT_PERIODS);
  o.notifyLead = clampInt(o.notifyLead, 0, 10080, 60);
  o.updatedAt = Number(o.updatedAt) || 0;
  return o;
}
// every record carries id / updatedAt / deletedAt so later sync and merges need no schema change
function normCourse(x) {
  return {
    id: String(x.id || newId()), name: str(x.name).trim(), short: str(x.short).trim(), day: clampInt(x.day, 1, 7, 1),
    start: HM.test(x.start) ? x.start : '', end: HM.test(x.end) ? x.end : '',
    place: str(x.place), teacher: str(x.teacher), weeks: str(x.weeks),
    parity: ['odd', 'even'].includes(x.parity) ? x.parity : 'all',
    info: INFO_KEYS.reduce((o, k) => { const v = x.info && x.info[k]; if (v != null && v !== '') o[k] = String(v); return o; }, {}),
    updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0
  };
}
// planned study blocks (from the local planner or the AI), one per time slot
function normPlan(x) {
  return {
    id: String(x.id || newId()), date: parseYMD(x.date) ? x.date : '', start: HM.test(x.start) ? x.start : '', end: HM.test(x.end) ? x.end : '',
    taskId: str(x.taskId), kind: ['routine', 'free', 'event'].includes(x.kind) ? x.kind : 'task', pinned: !!x.pinned, title: str(x.title).trim(), reason: str(x.reason), source: x.source === 'ai' ? 'ai' : 'local',
    status: ['planned', 'done', 'missed'].includes(x.status) ? x.status : 'planned', updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0
  };
}
// things you do on a rhythm rather than by a deadline, e.g. 背单词 every day
const WINDOWS = { morning: [360, 720, '早上'], noon: [720, 840, '中午'], afternoon: [840, 1080, '下午'], evening: [1080, 1440, '晚上'], any: [0, 1440, '随时'] };
function normRoutine(x) {
  const days = Array.from(new Set(arr(x.days).map(Number).filter(d => d >= 1 && d <= 7))).sort();
  const done = {};
  if (x.done && typeof x.done === 'object' && !Array.isArray(x.done)) Object.keys(x.done).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && x.done[k]) done[k] = 1; });
  return {
    id: String(x.id || newId()), title: str(x.title).trim(), days: days.length ? days : [1, 2, 3, 4, 5, 6, 7], minutes: clampInt(x.minutes, 5, 180, 20),
    window: WINDOWS[x.window] ? x.window : 'any', done, createdAt: Number(x.createdAt) || 0, updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0
  };
}
// times you told the assistant you're busy
function normBusy(x) {
  return { id: String(x.id || newId()), date: parseYMD(x.date) ? x.date : '', start: HM.test(x.start) ? x.start : '', end: HM.test(x.end) ? x.end : '', note: str(x.note).slice(0, 30), updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0 };
}
// what the assistant has learned about you
function normMemory(x) {
  return { id: String(x.id || newId()), text: str(x.text).trim().slice(0, 80), source: x.source === 'user' ? 'user' : 'chat', createdAt: Number(x.createdAt) || 0, updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0 };
}
// arrangements without fixed periods: internships, online courses
function normOther(x) {
  return {
    id: String(x.id || newId()), name: str(x.name).trim(), kind: str(x.kind), who: str(x.who), weeks: str(x.weeks), note: str(x.note),
    updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0
  };
}
function normTask(x) {
  const status = ['todo', 'doing', 'done'].includes(x.status) ? x.status : (x.done ? 'done' : 'todo');
  return {
    id: String(x.id || newId()), title: str(x.title).trim(), course: str(x.course),
    type: ['作业', '考试', '其他'].includes(x.type) ? x.type : '作业',
    priority: ['high', 'mid', 'low'].includes(x.priority) ? x.priority : 'mid',
    status, due: parseDue(x.due) ? str(x.due).slice(0, 16) : '', remind: clampInt(x.remind, 0, 10080, 60), estimate: clampInt(x.estimate, 5, 600, 60),
    doneAt: Number(x.doneAt) || 0, createdAt: Number(x.createdAt) || 0,
    updatedAt: Number(x.updatedAt) || 0, deletedAt: Number(x.deletedAt) || 0
  };
}
function normalizeState(o) {
  o = o && typeof o === 'object' ? o : {};
  return {
    v: 1,
    settings: normSettings(o.settings),
    courses: arr(o.courses).filter(x => x && typeof x === 'object').map(normCourse).filter(c => c.name || c.deletedAt),
    tasks: arr(o.tasks).filter(x => x && typeof x === 'object').map(normTask).filter(t => t.title || t.deletedAt),
    others: arr(o.others).filter(x => x && typeof x === 'object').map(normOther).filter(t => t.name || t.deletedAt),
    plans: arr(o.plans).filter(x => x && typeof x === 'object').map(normPlan).filter(b => (b.date && b.start && b.end) || b.deletedAt),
    routines: arr(o.routines).filter(x => x && typeof x === 'object').map(normRoutine).filter(r => r.title || r.deletedAt),
    busy: arr(o.busy).filter(x => x && typeof x === 'object').map(normBusy).filter(b => (b.date && b.start && b.end) || b.deletedAt),
    memory: arr(o.memory).filter(x => x && typeof x === 'object').map(normMemory).filter(m => m.text || m.deletedAt)
  };
}
const alive = list => list.filter(x => !x.deletedAt);
const touch = rec => { rec.updatedAt = Date.now(); return rec; };
function purgeTombstones() {
  const cut = Date.now() - 90 * 86400000;
  S.courses = S.courses.filter(x => !x.deletedAt || x.deletedAt > cut);
  S.tasks = S.tasks.filter(x => !x.deletedAt || x.deletedAt > cut);
  S.others = S.others.filter(x => !x.deletedAt || x.deletedAt > cut);
  const old = ymd(addDays(new Date(), -60));
  S.plans = S.plans.filter(x => (!x.deletedAt || x.deletedAt > cut) && (!x.date || x.date >= old));
  const week = ymd(addDays(new Date(), -7));
  S.busy = S.busy.filter(x => (!x.deletedAt || x.deletedAt > cut) && (!x.date || x.date >= week));
  S.routines = S.routines.filter(x => !x.deletedAt || x.deletedAt > cut);
  S.memory = S.memory.filter(x => !x.deletedAt || x.deletedAt > cut);
}

const KV = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) { rej(new Error('no indexedDB')); return; }
    const r = indexedDB.open('student-workbench', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  }));
  const get = async k => {
    const db = await open();
    return new Promise((res, rej) => { const q = db.transaction('kv', 'readonly').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  };
  const set = async (k, v) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  };
  return { get, set };
})();

let S = defaults();
let saveTimer = null;
async function loadState() {
  let o = null;
  try { o = await KV.get('state'); } catch (e) { o = null; }
  if (!o) { try { o = JSON.parse(localStorage.getItem(LS_STATE) || 'null'); } catch (e) { o = null; } }
  if (!o && window.__SEED__) { o = window.__SEED__; setTimeout(flushSave, 0); } // preview build only
  S = normalizeState(o);
  purgeTombstones();
}
async function flushSave() {
  clearTimeout(saveTimer); saveTimer = null;
  const snapshot = clone(S);
  try { await KV.set('state', snapshot); }
  catch (e) { try { localStorage.setItem(LS_STATE, JSON.stringify(snapshot)); } catch (_) { toast('保存失败：这台设备的存储不可用'); } }
}
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 250); }
function commit(what) {
  if (what === 'tasks') reconcilePlans();
  lastDeduped = dedupePlans();
  resolveOverlaps();
  persist();
  renderAll();
  if (what === 'tasks' || what === 'settings') scheduleNotifSync(what === 'tasks');
}

/* ---------- teaching week ---------- */
function termMonday() { const t = parseYMD(S.settings.termStart); return t ? mondayOf(t) : null; }
function teachWeek(d) {
  const m = termMonday();
  if (!m) return null;
  const diff = Math.round((startOfDay(d) - m) / 86400000);
  return diff < 0 ? 0 : Math.floor(diff / 7) + 1;
}
const weekMonday = w => addDays(termMonday(), (w - 1) * 7);
function parseWeeks(s) {
  if (!s || !String(s).trim()) return null;
  const cleaned = String(s).replace(/[第周\s()（）]/g, '').replace(/[，、;；]/g, ',').replace(/[–—~～至]/g, '-');
  const set = new Set();
  cleaned.split(',').forEach(part => {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) return;
    let a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) [a, b] = [b, a];
    for (let i = a; i <= Math.min(b, 60); i++) set.add(i);
  });
  return set.size ? set : null;
}
function activeInWeek(c, week) {
  if (!week) return true;
  const set = parseWeeks(c.weeks);
  if (set && !set.has(week)) return false;
  if (c.parity === 'odd' && week % 2 === 0) return false;
  if (c.parity === 'even' && week % 2 === 1) return false;
  return true;
}
const validSpan = c => { const a = toMin(c.start), b = toMin(c.end); return a != null && b != null && b > a; };
function classesOn(date) {
  const d = isoDay(date), w = teachWeek(date);
  return alive(S.courses).filter(c => c.day === d && validSpan(c) && activeInWeek(c, w)).sort((a, b) => toMin(a.start) - toMin(b.start));
}
const openTasks = () => alive(S.tasks).filter(t => t.status !== 'done');
const prioRank = t => ({ high: 0, mid: 1, low: 2 }[t.priority]);
const byDue = (a, b) => (a.due || '9').localeCompare(b.due || '9') || prioRank(a) - prioRank(b);
function colorFor(name) {
  const names = [];
  alive(S.courses).forEach(c => { if (c.name && !names.includes(c.name)) names.push(c.name); });
  let i = names.indexOf(name);
  if (i < 0) { i = 0; for (const ch of String(name || '')) i = (i * 31 + ch.codePointAt(0)) >>> 0; }
  return 'var(--c' + (i % 7) + ')';
}
function weekText(c) {
  const w = c.weeks.trim().replace(/周$/, '');
  const p = c.parity === 'odd' ? '单周' : c.parity === 'even' ? '双周' : '';
  return (w ? w + '周' : '') + (p ? (w ? ' ' : '') + p : '');
}
function periodText(c) {
  if (c.info.p) return '第 ' + c.info.p.replace('-', '–') + ' 节';
  const P = S.settings.periods, i = P.findIndex(x => x.start === c.start), j = P.findIndex(x => x.end === c.end);
  return i >= 0 && j >= i ? (i === j ? `第 ${i + 1} 节` : `第 ${i + 1}–${j + 1} 节`) : '';
}
function fieldValue(c, k) {
  if (k === 'teacher') return c.teacher;
  if (k === 'weeks') return weekText(c);
  if (k === 'periods') return periodText(c);
  if (k === 'credit') return c.info.credit ? c.info.credit + ' 学分' : '';
  return c.info[k] || '';
}
// what fits in a narrow grid cell: the user's own short name, else the name without its bracketed subtitle
const gridName = c => c.short || c.name.replace(/[（(][^）)]*[）)]/g, '').trim() || c.name;
const shownFields = c => SHOW_FIELDS.filter(([k]) => S.settings.show[k]).map(([k]) => fieldValue(c, k)).filter(Boolean);
const RUNNER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="15" cy="4.5" r="2"/><path d="M11 21l2.2-5.2-3-2.8 1.8-5 3.2 3.2 3.3.6M12 8l-3.5 1.2L7 12.5M13.2 15.8L17 19"/></svg>';

/* ---------- small ui helpers ---------- */
function mk(parent, tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; parent.appendChild(el); return el; }
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
function showErr(sel, msg) { const el = $(sel); el.textContent = msg; el.hidden = false; }
function hideErr(sel) { $(sel).hidden = true; }
function setSeg(sel, v) { $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
const segVal = sel => { const b = $(sel + ' button[aria-pressed="true"]'); return b ? b.dataset.v : ''; };
function resetDel(btn, show) { btn.hidden = !show; delete btn.dataset.armed; btn.textContent = '删除'; }
function armDelete(btn, fn) {
  if (btn.dataset.armed) { fn(); return; }
  btn.dataset.armed = '1'; btn.textContent = '确认删除';
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = '删除'; } }, 3000);
}

// dialogs: the Android back button closes an open dialog instead of leaving the page
let ignorePop = false;
function openDlg(d) { const src = lastTap; d.showModal(); growFrom(d, src); try { history.pushState({ dlg: d.id }, ''); } catch (e) { /* ignore */ } }
function initDialogs() {
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
    d.addEventListener('close', () => {
      if (history.state && history.state.dlg === d.id) { ignorePop = true; history.back(); }
    });
  });
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    const open = $$('dialog').find(x => x.open);
    if (open) open.close();
  });
}

/* ---------- motion: one continuous take ----------
   Idea borrowed from onetake (github.com/feitangyuan/onetake): at every hand-off one element survives and
   visibly becomes the next thing — a dialog grows out of what you tapped, a finished task leaves a spark that
   flies to where it counts, planned blocks fly from the list onto the timeline, tabs pan like one camera.
   Written from scratch for this app; nothing from that repo is copied. */
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)', SPRING = 'cubic-bezier(.34,1.56,.64,1)';
let lastTap = null, lastTapAt = 0;
document.addEventListener('pointerdown', e => { lastTap = e.target.closest('button, a, .ev, .cb, .rchip, li'); lastTapAt = Date.now(); }, true);
function growFrom(dlg, src) {
  if (calm()) return;
  const pop = () => { dlg.animate([{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE }); };
  if (!src || !src.isConnected || Date.now() - lastTapAt > 900 || dlg.contains(src)) { pop(); return; }
  const r = src.getBoundingClientRect(), d = dlg.getBoundingClientRect();
  if (!r.width || !d.width) { pop(); return; }
  const dx = (r.left + r.width / 2) - (d.left + d.width / 2), dy = (r.top + r.height / 2) - (d.top + d.height / 2);
  dlg.animate([{ transform: `translate(${dx}px,${dy}px) scale(${Math.max(.08, r.width / d.width)},${Math.max(.05, r.height / d.height)})`, opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 400, easing: EASE });
  Array.from(dlg.children).forEach((ch, i) => ch.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 150 + i * 40, fill: 'backwards', easing: 'ease-out' }));
}
function shake(el, k) {
  if (calm() || !el) return;
  k = k || 1;
  el.animate([{ transform: 'none' }, { transform: `translate(${-3 * k}px,1px)` }, { transform: `translate(${3 * k}px,-1px)` }, { transform: `translate(${-2 * k}px,0)` }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
}
// a spark leaves one place and lands in another along an arc; the target gives a small bump when it arrives
function spark(fromEl, toEl) {
  if (calm() || !fromEl || !toEl || !fromEl.isConnected || !toEl.isConnected) return;
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  const dot = mk(document.body, 'i', 'spark');
  dot.style.left = x0 + 'px'; dot.style.top = y0 + 'px';
  dot.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 1, offset: .12 },
    { transform: `translate(calc(-50% + ${dx * .45}px),calc(-50% + ${dy * .45 - 70}px)) scale(1.1)`, offset: .55 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.5)`, opacity: .9 }
  ], { duration: 720, easing: EASE }).onfinish = () => {
    dot.remove();
    const bump = toEl.closest('.nav') ? ($('svg', toEl) || toEl) : toEl; // in the bar, only the icon bumps, so the bar never shifts
    bump.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 380, easing: SPRING });
  };
}
// tabs sit on one strip; switching pans the camera toward the new one, overshoots a hair, then holds still
function panTo(view, dir) {
  if (calm() || !dir) return;
  view.animate([{ transform: `translateX(${dir * 36}px)`, opacity: 0 }, { transform: `translateX(${-dir * 4}px)`, opacity: 1, offset: .72 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: EASE });
}
function movePill() {
  const nav = $('.nav'), links = $$('.nav a'), i = links.findIndex(a => a.getAttribute('aria-current') === 'page');
  if (!$('.nav .pill')) mk(nav, 'i', 'pill');
  nav.style.setProperty('--n', links.length);
  nav.style.setProperty('--i', Math.max(0, i));
}
// planned blocks fly from the rows you picked to their places on the timeline
function flyInto(rects, ids) {
  if (calm()) return;
  ids.forEach((id, i) => {
    const el = $(`#ruler [data-id="${id}"]`), from = rects[i];
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    el.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px) scale(${Math.max(.3, from.width / to.width)},${Math.max(.3, from.height / to.height)})`, opacity: .4 }, { transform: 'none', opacity: 1 }],
      { duration: 620, delay: 80 + i * 70, easing: SPRING, fill: 'backwards' });
  });
}
// first launch of the day: the 工 is drawn, your greeting appears, then flies to its seat while the page grows around it
function introTake() {
  const key = 'swb:intro', today = ymd(new Date());
  try { if (calm() || localStorage.getItem(key) === today || location.hash.slice(1) && location.hash !== '#today') return; localStorage.setItem(key, today); } catch (e) { return; }
  const ov = mk(document.body, 'div', 'take');
  ov.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24 28H76M50 28V72M20 72H80"/><path class="u" d="M30 84H70"/></svg><p>${esc($('#hello').textContent)}</p>`;
  const paths = $$('path', ov), p = $('p', ov);
  paths.forEach((pa, i) => { const len = pa.getTotalLength(); pa.style.strokeDasharray = len; pa.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 520, delay: i * 260, easing: EASE, fill: 'both' }); });
  p.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 700, easing: EASE, fill: 'both' });
  let done = false;
  const land = () => {
    if (done) return; done = true;
    const to = $('#hello').getBoundingClientRect(), from = p.getBoundingClientRect();
    p.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.height / Math.max(1, from.height)})`, color: getComputedStyle($('#hello')).color }], { duration: 560, easing: EASE, fill: 'forwards' });
    $('svg', ov).animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.4) translateY(-40px)' }], { duration: 360, easing: EASE, fill: 'forwards' });
    ov.animate([{ backgroundColor: 'rgba(18,10,34,1)' }, { backgroundColor: 'rgba(18,10,34,0)' }], { duration: 520, delay: 120, easing: EASE, fill: 'forwards' }).onfinish = () => ov.remove();
    $$('#view-today .hero-date, #view-today .hero-meta, #view-today .oval, #race, #view-today .today-grid > .card').forEach((el, i) =>
      el.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 260 + i * 90, easing: EASE, fill: 'backwards' }));
  };
  setTimeout(land, 1150);
  ov.addEventListener('click', land);
}

/* ---------- files ---------- */
async function saveFile(name, text, mime) {
  if (isNative) {
    const FS = plugin('Filesystem'), SH = plugin('Share');
    if (FS) {
      try {
        const r = await FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
        if (SH) { await SH.share({ title: name, text: name, files: [r.uri], dialogTitle: '保存或发送' }); }
        else toast('已保存：' + r.uri);
        return;
      } catch (e) {
        if (e && /cancel/i.test(String(e.message || e))) return;
        console.warn('saveFile', e);
      }
    }
  }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function readTextSmart(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch (e) { try { return new TextDecoder('gbk').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } }
}

/* ---------- 保研之路: a race against a rival ---------- */
// course length: straight legs 南工江浦 → 北大楼 13.3 km → 南大仙林 18.1 km
const RACE_TOTAL = 31.4;
const LS_LINE = 'swb:rival-line';
const raceOn = () => /南京大学|南大/.test(S.settings.goal);
const rival = () => S.settings.rival;
const initial = v => (Array.from(String(v || '').trim())[0] || '');
function semesterSpan() {
  const m = termMonday();
  return m ? [m.getTime(), addDays(m, S.settings.totalWeeks * 7).getTime()] : null;
}
function semesterProgress(now) {
  const w = teachWeek(now);
  // counts today as run, so the last day of term closes the lap
  return w == null || w === 0 ? 0 : Math.min(1, ((w - 1) * 7 + isoDay(now)) / (S.settings.totalWeeks * 7));
}
function raceStart() { return parseYMD(S.settings.race.start) || termMonday() || startOfDay(new Date()); }
const raceFinish = () => parseYMD(S.settings.race.finish) || new Date(2028, 8, 25);
function raceMarks() {
  const s = raceStart(), f = raceFinish(), y = s.getMonth() >= 7 ? s.getFullYear() : s.getFullYear() - 1;
  const goalWord = S.settings.path === '考研' ? '考研' : '推免';
  return [['南工', '出发', s], ['长江', '大二结束', new Date(y + 1, 6, 1)], ['北大楼', '大三上结束', new Date(y + 2, 0, 15)], ['紫金山', '夏令营', new Date(y + 2, 6, 1)], ['南大仙林', goalWord, f]]
    .filter(([, , d], i, all) => i === 0 || i === all.length - 1 || (d > s && d < f));
}
// the rival runs at the steady pace that reaches the finish on the day; your lead comes from how you keep your plans
function taskPoints(t, at, s) {
  const w = t.priority === 'high' ? 1.5 : t.priority === 'low' ? 0.7 : 1, due = parseDue(t.due);
  if (t.status === 'done' && t.doneAt && t.doneAt <= at) {
    if (t.doneAt < s) return 0;
    return !due ? 0.2 * w : t.doneAt <= due.getTime() + 60000 ? 0.3 * w : -0.1 * w;
  }
  return due && due.getTime() <= at && due.getTime() >= s ? -0.3 * w : 0;
}
function routinePoints(r, at, s) {
  const from = startOfDay(new Date(Math.max(s, r.createdAt || 0))), end = startOfDay(new Date(at));
  let p = 0;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (!r.days.includes(isoDay(d))) continue;
    if (r.done[ymd(d)]) p += 0.05; else if (d < end) p -= 0.05;
  }
  return p;
}
function leadAt(at) {
  const s = raceStart().getTime();
  let L = 0;
  alive(S.tasks).forEach(t => { L += taskPoints(t, at, s); });
  alive(S.routines).forEach(r => { L += routinePoints(r, at, s); });
  return Math.max(-3, Math.min(3, L));
}
function raceState(now) {
  const s = raceStart().getTime(), f = raceFinish().getTime(), t = now.getTime();
  const prog = Math.max(0, Math.min(1, (t - s) / Math.max(1, f - s))), R = RACE_TOTAL * prog;
  const L = leadAt(t), trend = L - leadAt(t - 7 * 86400000), finished = t >= f;
  const Y = finished ? (L >= 0 ? RACE_TOTAL : Math.max(0, R + L)) : Math.max(0, Math.min(RACE_TOTAL * 0.995, R + L));
  const mood = L < -0.05 || trend <= -0.15 ? 'mock' : (L > 0.05 && trend >= 0.15) || L >= 0.8 ? 'respect' : 'even';
  return { R, Y, L, trend, finished, mood, daysLeft: Math.max(0, Math.ceil((f - t) / 86400000)) };
}
const RIVAL_LINES = {
  respect: ['行啊{me}，这配速我服。', '你这周是真猛，我得加练了。', '再这么跑，南大的名额要被你先拿了。', '跟不上了，给你点个赞。'],
  mock: ['就这？今天的单词背了吗？', '我又追近一截了，你还躺着呢？', '推免名额可不等人，加把劲啊。', '再拖下去，南大就是我的了。'],
  even: ['咬住了，谁先松谁输。', '今天谁先 KO 完谁领先。', '不紧不慢，继续跑。', '别回头，我就在你身后。']
};
const hashStr = v => Array.from(String(v)).reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);
function dailyLine(mood) {
  try {
    const c = JSON.parse(localStorage.getItem(LS_LINE) || 'null');
    if (rival().daily && c && c.date === ymd(new Date()) && c.mood === mood && c.name === rival().name) return c.text;
  } catch (e) { /* ignore */ }
  return '';
}
function rivalLine(st) {
  const ai = dailyLine(st.mood);
  if (ai) return ai;
  const pool = RIVAL_LINES[st.mood];
  return pool[hashStr(ymd(new Date()) + st.mood) % pool.length].replace('{me}', S.settings.nick || '你');
}
function renderRace() {
  const card = $('#race'), on = raceOn();
  card.hidden = !on;
  const g = $('#heroGoal'); g.hidden = on || !S.settings.goal; g.textContent = S.settings.goal ? '目标 ' + S.settings.goal : '';
  if (!on) return;
  if (!S.settings.race.start) { S.settings.race.start = ymd(raceStart()); touch(S.settings); persist(); }
  const now = new Date(), st = raceState(now), s = raceStart().getTime(), f = raceFinish().getTime();
  const pct = km => (Math.min(1, Math.max(0, km / RACE_TOTAL)) * 100).toFixed(2) + '%';
  const kmAt = d => RACE_TOTAL * Math.max(0, Math.min(1, (d.getTime() - s) / Math.max(1, f - s)));
  card.dataset.mood = st.mood;
  $('#raceTitle').textContent = `${S.settings.path}之路`;
  $('#raceSub').textContent = st.finished ? '比赛结束' : `距${S.settings.path === '考研' ? '考研' : '推免'}还有 ${st.daysLeft} 天`;
  const chip = $('#raceChip');
  chip.textContent = Math.abs(st.L) < 0.05 ? '并肩' : st.L > 0 ? `领先 ${st.L.toFixed(1)} km` : `落后 ${(-st.L).toFixed(1)} km`;
  chip.className = 'race-chip' + (st.L >= 0.05 ? ' up' : st.L <= -0.05 ? ' down' : '');
  const gp = Math.max(3, Math.min(97, 50 + st.L / 1.5 * 47)); // close-up: ±1.5 km
  $('#gbMe').style.left = gp + '%';
  $('#gbFill').style.left = Math.min(50, gp) + '%';
  $('#gbFill').style.width = Math.abs(gp - 50) + '%';
  $('#gbFill').className = 'gb-fill' + (st.L < 0 ? ' down' : '');
  $('#gbMe').textContent = initial(S.settings.nick) || '我';
  $('#gbRv').textContent = initial(rival().name) || '对';
  $('#rvFill').style.width = pct(st.R); $('#rvAv').style.left = pct(st.R);
  $('#meFill').style.width = pct(st.Y); $('#meAv').style.left = pct(st.Y);
  $('#rvAv').textContent = initial(rival().name) || '对';
  $('#meAv').textContent = initial(S.settings.nick) || '我';
  $('#raceWho').textContent = rival().name;
  $('#raceLine').textContent = rivalLine(st);
  const marks = raceMarks();
  $('#rMarks').innerHTML = marks.slice(1, -1).map(([, , d]) => `<i style="left:${pct(kmAt(d))}"></i>`).join('');
  $('#rPts').innerHTML = marks.map(([name, sub, d], i) => `<span class="${i === 0 ? 'first' : i === marks.length - 1 ? 'last' : ''}${i % 2 ? ' low' : ''}${st.Y >= kmAt(d) ? ' passed' : ''}" style="left:${pct(kmAt(d))}"><b>${name}</b><small>${sub}</small></span>`).join('');
  $('#raceMe').textContent = st.finished
    ? (st.L >= 0 ? `你先于${rival().name}冲线！诚朴雄伟，励学敦行` : `${rival().name}先冲线了`)
    : `你已跑完 ${(st.Y / RACE_TOTAL * 100).toFixed(1)}%`;
}
let lineBusy = false;
async function refreshRivalLine() {
  if (lineBusy || !rival().daily || !aiReady() || !raceOn()) return;
  const now = new Date(), st = raceState(now);
  if (dailyLine(st.mood)) return;
  lineBusy = true;
  const tone = st.mood === 'respect' ? '真心佩服、又不服输的口吻' : st.mood === 'mock' ? '朋友之间激将式的调侃口吻，可以嘲讽，但不人身攻击' : '势均力敌、互相较劲的口吻';
  const prompt = `你扮演「${rival().name}」，是用户（${S.settings.nick || '同学'}，大二，目标是${S.settings.path}${S.settings.goal}）的竞争对手。你们在一条从南京工业大学跑到南京大学的赛道上比谁更稳定地完成学习计划。` +
    `局面：${st.L >= 0.05 ? `用户领先你 ${st.L.toFixed(1)} km` : st.L <= -0.05 ? `你领先用户 ${(-st.L).toFixed(1)} km` : '你们并肩'}，最近一周${st.trend >= 0.1 ? '用户在拉开差距' : st.trend <= -0.1 ? '你在追近' : '差距没怎么变'}。` +
    `用${tone}对用户说一句话，20 个字以内，不要引号，不要表情符号。`;
  try {
    const line = (await callAI([{ role: 'user', content: prompt }], { maxTokens: 80 })).replace(/["“”「」]/g, '').replace(/\s+/g, '').slice(0, 30);
    if (line) { localStorage.setItem(LS_LINE, JSON.stringify({ date: ymd(now), mood: st.mood, name: rival().name, text: line })); renderRace(); }
  } catch (e) { console.warn('rival line', e); }
  lineBusy = false;
}

/* ---------- planner: the local engine does the arithmetic, the AI only proposes ---------- */
const meals = () => S.settings.plan.meals; // 午饭午休, 晚饭 (editable)
const BREAK = 10, MIN_BLOCK = 25;
const ceil5 = d => Math.ceil((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
const nowMinOf = d => d.getHours() * 60 + d.getMinutes();
const plansOn = date => alive(S.plans).filter(b => b.date === date);
const busyOn = date => alive(S.busy).filter(b => b.date === date);
const blockMin = b => toMin(b.end) - toMin(b.start);
function doneMinutes(id, date) { return alive(S.plans).filter(b => b.taskId === id && b.status === 'done' && (!date || b.date === date)).reduce((m, b) => m + blockMin(b), 0); }
// learned from your finished work: how long things really take compared with your estimate
function estimateFactor() {
  const r = alive(S.tasks).filter(t => t.status === 'done').map(t => doneMinutes(t.id) / t.estimate).filter(x => x > 0.2).slice(-20).sort((x, y) => x - y);
  return r.length < 3 ? { factor: 1, n: r.length } : { factor: Math.max(0.6, Math.min(1.8, r[Math.floor(r.length / 2)])), n: r.length };
}
function remainingMin(t) { return Math.max(0, Math.round(t.estimate * estimateFactor().factor) - doneMinutes(t.id)); }
const dueToday = (r, d) => r.days.includes(isoDay(d)) && !r.done[ymd(d)] && (!r.createdAt || startOfDay(new Date(r.createdAt)) <= startOfDay(d));
const routineNeed = (r, d) => (dueToday(r, d) ? Math.max(0, r.minutes - doneMinutes(r.id, ymd(d))) : 0);
function streak(r, now) {
  let n = 0;
  for (let d = startOfDay(now), i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (!r.days.includes(isoDay(d))) continue;
    if (r.done[ymd(d)]) n++; else if (i > 0) break;
  }
  return n;
}
// hours of work left per hour until the deadline; overdue work goes first
function riskScore(t, now) {
  const d = parseDue(t.due), w = { high: 1.5, mid: 1, low: 0.7 }[t.priority];
  if (!d) return 0.02 * w;
  const hours = (d - now) / 3600000;
  if (hours <= 0) return 1000 - hours;
  return (remainingMin(t) / 60) / Math.max(1, hours) * w;
}
const byRisk = now => (a, b) => riskScore(b, now) - riskScore(a, now);
function reasonFor(t, now) {
  const d = parseDue(t.due);
  if (!d) return t.priority === 'high' ? '高优先' : '';
  if (d <= now) return '已经过期，先补上';
  return dueLabel(d, now) + ' 截止';
}
function dueCapEnd(t, date, now) {
  const d = parseDue(t.due);
  if (!d || ymd(d) !== date || d <= now) return null;
  return d.getHours() * 60 + d.getMinutes();
}
function freeSlots(date, fromMin, keepBlocks) {
  const day = startOfDay(date);
  const busy = classesOn(day).map(c => [toMin(c.start), toMin(c.end)])
    .concat(meals().map(([a, b]) => [toMin(a), toMin(b)]))
    .concat(busyOn(ymd(day)).map(b => [toMin(b.start), toMin(b.end)]))
    .concat((keepBlocks || []).map(b => [toMin(b.start), toMin(b.end)]))
    .sort((x, y) => x[0] - y[0]);
  const end = S.settings.plan.latest;
  let cur = Math.max(fromMin, S.settings.dayStart * 60);
  const out = [];
  busy.forEach(([a, b]) => { if (b <= cur) return; if (a > cur) out.push([cur, Math.min(a, end)]); cur = Math.max(cur, b); });
  if (end > cur) out.push([cur, end]);
  return out.filter(([a, b]) => b - a >= 10);
}
function keptBlocks(date, fromMin, exclude) { return plansOn(date).filter(b => b.status === 'planned' && !(exclude && exclude.has(b.id))); }
// everything that still needs time today: work with deadlines and today's routines
function planItems(now, raw, exclude) {
  const date = ymd(now), items = [], nowMin = nowMinOf(now), ahead = new Map();
  if (!raw) plansOn(date).filter(b => b.status === 'planned' && toMin(b.end) > nowMin && !(exclude && exclude.has(b.id)))
    .forEach(b => ahead.set(b.taskId, (ahead.get(b.taskId) || 0) + toMin(b.end) - Math.max(toMin(b.start), nowMin)));
  openTasks().forEach(t => { const need = remainingMin(t) - (ahead.get(t.id) || 0); if (need >= 5) items.push({ ref: t.id, kind: 'task', title: t.title, need, cap: dueCapEnd(t, date, now), risk: riskScore(t, now), reason: reasonFor(t, now) }); });
  alive(S.routines).forEach(r => { const need = routineNeed(r, now) - (ahead.get(r.id) || 0); if (need > 0) items.push({ ref: r.id, kind: 'routine', title: r.title, need, cap: null, window: r.window, reason: '每日打卡' + (r.window !== 'any' ? '，习惯' + WINDOWS[r.window][2] : '') }); });
  return items;
}
function itemScore(it, at) {
  if (it.kind === 'task') return it.risk;
  const [a, b] = WINDOWS[it.window];
  return at >= a && at < b ? 0.8 : 0.25;
}
function fillSlots(slots, items, now) {
  const need = new Map(items.map(it => [it.ref, it.need])), maxB = S.settings.plan.maxBlock, blocks = [];
  slots.forEach(([a, b]) => {
    let cur = a;
    for (;;) {
      const fit = it => Math.min(it.kind === 'routine' ? need.get(it.ref) : maxB, need.get(it.ref) || 0, b - cur, it.cap == null ? Infinity : it.cap - cur);
      const ok = it => { const f = fit(it); return it.kind === 'routine' ? f >= (need.get(it.ref) || 1) : f >= MIN_BLOCK; };
      const cand = items.filter(it => (need.get(it.ref) || 0) > 0 && ok(it)).sort((x, y) => itemScore(y, cur) - itemScore(x, cur))[0];
      if (!cand) break;
      const len = fit(cand), n = blocks.filter(x => x.taskId === cand.ref).length;
      blocks.push({ start: fmtMin(cur), end: fmtMin(cur + len), taskId: cand.ref, kind: cand.kind, title: cand.title + (n ? `（第 ${n + 1} 段）` : ''), reason: cand.reason });
      need.set(cand.ref, need.get(cand.ref) - len);
      cur += len + BREAK;
    }
  });
  return blocks;
}
function localPlan(now, exclude) {
  const fromMin = ceil5(now);
  return { blocks: fillSlots(freeSlots(now, fromMin, keptBlocks(ymd(now), fromMin, exclude)), planItems(now, false, exclude), now), dropped: [], note: '' };
}
// titles compared by meaning: "材力作业：第1–4题" and "材力作业 第3章" are the same piece of work
const normTitle = t => String(t || '').toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/[：:].*$/, '').replace(/第\s*\d+\s*[段章节题]/g, '').replace(/[\s·、，,。.!！?？\-—_~～]/g, '');
function similar(a, b) {
  const bi = t => { const x = normTitle(t), out = new Set(); for (let i = 0; i < x.length - 1; i++) out.add(x.slice(i, i + 2)); if (x.length === 1) out.add(x); return out; };
  const A = bi(a), B = bi(b);
  if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if (B.has(x)) n++; });
  return n / Math.min(A.size, B.size);
}
// every block the AI proposes is fitted here: matched to your work by id or meaning, slid into free time if it clashes
function matchItem(items, x) {
  const ref = str(x.ref || x.task_id || x.taskId || x.id), title = str(x.title).trim();
  if (items.has(ref)) return items.get(ref);
  const all = Array.from(items.values());
  const exact = all.find(it => it.title === ref || it.title === title);
  if (exact) return exact;
  let best = null, score = 0;
  all.forEach(it => { const v = Math.max(similar(it.title, title), similar(it.title, ref)); if (v > score) { score = v; best = it; } });
  return score >= 0.6 ? best : null;
}
function validateBlocks(raw, now, exclude) {
  const date = ymd(now), fromMin = ceil5(now), latest = S.settings.plan.latest;
  const fixed = freeSlots(now, 0, keptBlocks(date, fromMin, exclude));
  const items = new Map(planItems(now, true).map(it => [it.ref, it])), ok = [], dropped = [], nowMin = nowMinOf(now);
  const ahead = new Map(), planned = plansOn(date).filter(b => b.status === 'planned' && toMin(b.end) > nowMin && !(exclude && exclude.has(b.id)));
  planned.forEach(b => ahead.set(b.taskId, (ahead.get(b.taskId) || 0) + toMin(b.end) - Math.max(toMin(b.start), nowMin)));
  const free = (a, b) => fixed.some(([sa, sb]) => a >= sa && b <= sb) && !ok.some(o => a < toMin(o.end) && b > toMin(o.start));
  arr(raw).forEach(x => {
    if (!x || typeof x !== 'object') return;
    const it = matchItem(items, x), title = str(x.title).trim() || (it ? it.title : '');
    let a = toMin(str(x.start)), b = toMin(str(x.end));
    if (!title) return;
    if (it) {
      const left = it.need - (ahead.get(it.ref) || 0) - ok.filter(o => o.taskId === it.ref).reduce((m, o) => m + toMin(o.end) - toMin(o.start), 0);
      if (left < (it.kind === 'routine' ? 1 : 10)) { dropped.push({ title, start: str(x.start), end: str(x.end), why: '已经排上了，不重复安排' }); return; }
      if (a != null && b != null && b - a > left + 10) b = a + left;
    } else if (planned.concat(ok.map(o => ({ title: o.title }))).some(o => similar(o.title, title) >= 0.7)) {
      dropped.push({ title, start: str(x.start), end: str(x.end), why: '和已有安排重复' }); return;
    }
    const len = a != null && b != null && b > a ? Math.min(b - a, 180) : it ? Math.min(it.need, S.settings.plan.maxBlock) : 30;
    let s0 = Math.max(a == null ? fromMin : a, fromMin), placed = null;
    for (let t = s0; t + len <= latest; t += 5) { if (free(t, t + len)) { placed = t; break; } }
    const cap = it && it.cap;
    if (placed == null) { dropped.push({ title, start: str(x.start), end: str(x.end), why: '今天剩下的空档放不下' }); return; }
    if (cap != null && placed + len > cap) { dropped.push({ title, start: str(x.start), end: str(x.end), why: '来不及在截止前做完' }); return; }
    ok.push({ start: fmtMin(placed), end: fmtMin(placed + len), taskId: it ? it.ref : '', kind: it ? it.kind : 'free', title: title.slice(0, 40), reason: str(x.reason).slice(0, 30), moved: a != null && placed !== a });
  });
  ok.sort((x, y) => toMin(x.start) - toMin(y.start));
  return { ok, dropped };
}
function habitsSummary() {
  const f = estimateFactor(), out = [];
  if (f.n >= 3 && Math.abs(f.factor - 1) >= 0.1) out.push(`做作业实际用时通常是预估的 ${Math.round(f.factor * 100)}%`);
  const byWin = {};
  alive(S.plans).filter(b => b.status === 'done' || b.status === 'missed').forEach(b => {
    const m = toMin(b.start), w = Object.keys(WINDOWS).find(k => k !== 'any' && m >= WINDOWS[k][0] && m < WINDOWS[k][1]);
    if (!w) return;
    byWin[w] = byWin[w] || [0, 0]; byWin[w][b.status === 'done' ? 0 : 1]++;
  });
  const best = Object.keys(byWin).filter(k => byWin[k][0] + byWin[k][1] >= 4).sort((x, y) => byWin[y][0] / (byWin[y][0] + byWin[y][1]) - byWin[x][0] / (byWin[x][0] + byWin[x][1]))[0];
  if (best) out.push(`${WINDOWS[best][2]}的安排完成得最好`);
  return out;
}
function planContext(now, exclude) {
  const date = ymd(now), fromMin = ceil5(now), nowMin = nowMinOf(now);
  return {
    now: `${date} 周${WD[isoDay(now) - 1]} ${fmtMin(nowMin)}`,
    week: teachWeek(now),
    free_slots: freeSlots(now, fromMin, keptBlocks(date, fromMin, exclude)).map(([a, b]) => ({ start: fmtMin(a), end: fmtMin(b), minutes: b - a })),
    classes_left: classesOn(now).filter(c => toMin(c.end) > nowMin).map(c => ({ start: c.start, end: c.end, name: c.name })),
    busy: busyOn(date).map(b => ({ start: b.start, end: b.end, note: b.note })),
    tasks: openTasks().filter(t => remainingMin(t) > 0).sort(byRisk(now)).slice(0, 15).map(t => {
      const d = parseDue(t.due);
      return { id: t.id, title: t.title, course: t.course, type: t.type, priority: { high: '高', mid: '中', low: '低' }[t.priority],
        due: d ? dueLabel(d, now) : '无截止', minutes_needed: remainingMin(t) };
    }),
    routines: alive(S.routines).map(r => ({ id: r.id, title: r.title, minutes: r.minutes, window: WINDOWS[r.window][2], today: !r.days.includes(isoDay(now)) ? '今天不用做' : r.done[date] ? '今天已完成' : '今天还没做', streak_days: streak(r, now) })),
    plan_today: plansOn(date).filter(b => !(exclude && exclude.has(b.id))).map(b => ({ id: b.id, start: b.start, end: b.end, title: b.title, type: b.kind === 'event' ? '日程' : '学习', status: { planned: '已定，不要占用', done: '完成', missed: '没做' }[b.status] })),
    events_upcoming: alive(S.plans).filter(b => b.kind === 'event' && b.date > date).slice(0, 10).map(b => ({ date: b.date, start: b.start, end: b.end, title: b.title })),
    prefs: { max_block: S.settings.plan.maxBlock, break: BREAK, latest: fmtMin(S.settings.plan.latest), meals: meals().map(m => m.join('–')).join('、') + ' 不排学习' }
  };
}
const PLAN_PROMPT = [
  '你是大学生的学习规划助手。根据用户发来的 JSON，为今天剩下的时间排安排。',
  '规则：',
  '1. 每一块必须完整落在 free_slots 的某一个空档里，不能跨空档，也不能超出空档。',
  '2. 作业每块 25 到 max_block 分钟；每日事项（routines 里今天还没做的）按它的 minutes 排一块，尽量放在它习惯的时段。同一空档里相邻两块之间至少留 break 分钟。',
  '3. 先排已过期、截止最近、优先级高的作业；大作业拆成几块，title 写清楚这一块做哪部分。',
  '4. 同一件事今天排的总时长不超过它需要的时间；截止在今天的，要在截止前排完。',
  '5. 不用把空档排满，给休息留余地。',
  '只输出 JSON：{"blocks":[{"start":"HH:MM","end":"HH:MM","ref":"作业或每日事项的 id","title":"这一块做什么","reason":"不超过 20 字"}],"note":"一句话提醒，不超过 30 字"}'
].join('\n');

/* ---------- AI: any OpenAI-compatible service; the key never leaves this device except to that service ---------- */
const LS_AI = 'swb:ai';
const PROVIDERS = {
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-v4-flash', hint: 'deepseek-v4-flash 快，deepseek-v4-pro 更强。' },
  bailian: { name: '阿里百炼', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', hint: '模型名以百炼控制台为准（待验证）。' },
  doubao: { name: '豆包（火山方舟）', base: 'https://ark.cn-beijing.volces.com/api/v3', model: '', hint: '模型名填方舟控制台里的模型 ID（待验证）。' },
  custom: { name: '其他', base: '', model: '', hint: '填 OpenAI 兼容接口的地址和模型名。' }
};
function aiConfig() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(LS_AI) || '{}') || {}; } catch (e) { c = {}; }
  const p = PROVIDERS[c.provider] ? c.provider : 'deepseek';
  return { provider: p, key: str(c.key), base: str(c.base) || PROVIDERS[p].base, model: str(c.model) || PROVIDERS[p].model };
}
function saveAiConfig(c) { try { localStorage.setItem(LS_AI, JSON.stringify(c)); } catch (e) { /* ignore */ } }
const aiReady = () => { const c = aiConfig(); return !!(c.key && c.base && c.model); };
class AiError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
async function postJSON(url, headers, body, timeoutMs) {
  const H = plugin('CapacitorHttp'); // native request: no browser cross-origin rules inside the app
  if (H) {
    const r = await H.request({ url, method: 'POST', headers, data: body, connectTimeout: 15000, readTimeout: timeoutMs, responseType: 'json' });
    let data = r.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* keep text */ } }
    return { status: r.status, data };
  }
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    return { status: r.status, data: await r.json().catch(() => null) };
  } finally { clearTimeout(tm); }
}
async function callAIRaw(messages, opts) {
  const { json = false, maxTokens = 900, tools = null, toolChoice = 'auto', temperature = 0.5 } = opts || {};
  const c = aiConfig();
  if (!c.key) throw new AiError('nokey', '还没填 API Key');
  if (!c.model) throw new AiError('nomodel', '还没填模型名');
  const url = c.base.replace(/\/+$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key };
  const core = { model: c.model, messages, max_tokens: maxTokens, temperature };
  if (tools) { core.tools = tools; core.tool_choice = toolChoice; }
  // optional extras; whatever the service rejects gets dropped and the request retried
  const extra = Object.assign({}, json ? { response_format: { type: 'json_object' } } : {}, c.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {});
  const netErr = () => new AiError('network', isNative ? '连不上模型服务，检查一下网络' : '网页版直连模型失败，可能被浏览器的跨域限制拦了（待验证），先在手机 App 里用');
  const post = async body => { try { return await postJSON(url, headers, body, 60000); } catch (e) { throw netErr(); } };
  const bad = r => r.status === 400 || r.status === 422;
  let res = await post(Object.assign({}, core, extra));
  if (bad(res) && Object.keys(extra).length) res = await post(core);
  if (bad(res) && tools && toolChoice !== 'auto') { core.tool_choice = 'auto'; res = await post(core); }
  if (bad(res) && tools) { delete core.tools; delete core.tool_choice; res = await post(core); } // no tool support: plain chat still works
  const msg = res.data && res.data.error && (res.data.error.message || res.data.error.code);
  if (res.status === 401 || res.status === 403) throw new AiError('auth', 'API Key 不对，或者没有权限');
  if (res.status === 402) throw new AiError('balance', '账户余额不足');
  if (res.status === 429) throw new AiError('rate', '请求太频繁，过一会儿再试');
  if (res.status >= 400 || !res.data || typeof res.data !== 'object') throw new AiError('http', `模型服务报错（${res.status}）${msg ? '：' + String(msg).slice(0, 80) : ''}`);
  const m = (res.data.choices && res.data.choices[0] && res.data.choices[0].message) || {};
  const calls = arr(m.tool_calls).map(tc => ({ name: tc && tc.function && tc.function.name, args: parseJSONLoose((tc && tc.function && tc.function.arguments) || '') || {} })).filter(x => x.name);
  return { text: str(m.content).trim(), calls };
}
async function callAI(messages, opts) {
  const r = await callAIRaw(messages, opts);
  if (!r.text) throw new AiError('empty', '模型没有返回内容');
  return r.text;
}
function parseJSONLoose(text) {
  if (text && typeof text === 'object') return text;
  const t = String(text || '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch (e) {
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e2) { /* give up */ } }
  }
  return null;
}

/* ---------- 排今天: the AI proposes, you pick, then it lands on the timeline ---------- */
const PLAN_TOOL = { type: 'function', function: { name: 'propose_plan', description: '给出今天剩余时间的安排方案。用户会先勾选取舍，确认后才排进时间轴。', parameters: { type: 'object', properties: {
  blocks: { type: 'array', items: { type: 'object', properties: { start: { type: 'string', description: 'HH:MM' }, end: { type: 'string', description: 'HH:MM' }, ref: { type: 'string', description: '对应作业或每日事项的 id；自由安排留空' }, title: { type: 'string' }, reason: { type: 'string', description: '不超过 20 字' } }, required: ['start', 'end', 'title'] } },
  note: { type: 'string', description: '一句话提醒' } }, required: ['blocks'] } } };
let planDraft = null;
async function planToday(replace) {
  const btn = $('#btnPlan');
  if (btn.disabled) return;
  const now = new Date(), nowMin = nowMinOf(now);
  const exclude = replace ? new Set(plansOn(ymd(now)).filter(b => b.status === 'planned' && !b.pinned && b.kind !== 'event' && toMin(b.start) >= nowMin).map(b => b.id)) : null;
  btn.disabled = true; btn.textContent = aiReady() ? 'AI 正在排…' : '正在排…';
  let result = null, source = 'local', error = '';
  try {
    if (aiReady() && planItems(now, false, exclude).length) {
      const ctx = Object.assign(planContext(now, exclude), { memory: alive(S.memory).map(m => m.text), habits: habitsSummary() });
      const r = await callAIRaw([{ role: 'system', content: PLAN_PROMPT }, { role: 'user', content: JSON.stringify(ctx) }], { tools: [PLAN_TOOL], toolChoice: { type: 'function', function: { name: 'propose_plan' } }, maxTokens: 1400, temperature: 0.3 });
      const call = r.calls.find(c => c.name === 'propose_plan'), o = call ? call.args : parseJSONLoose(r.text);
      if (!o || !Array.isArray(o.blocks)) throw new AiError('format', 'AI 这次没给出方案');
      const v = validateBlocks(o.blocks, now, exclude);
      result = { blocks: v.ok, dropped: v.dropped, note: str(o.note).slice(0, 60) };
      source = 'ai';
    }
  } catch (e) { error = e && e.message ? e.message : String(e); }
  if (!result) result = localPlan(now, exclude);
  btn.disabled = false; btn.textContent = '排今天';
  planDraft = { date: ymd(now), fromMin: ceil5(now), source, blocks: result.blocks, replace: exclude ? Array.from(exclude) : [] };
  showPlanPreview(result, source, error);
}
function showPlanPreview(res, source, error) {
  $('#dpSrc').textContent = (source === 'ai' ? 'AI 给的方案' : '本地规则给的方案') + '，勾掉不想要的，再排进时间轴';
  $('#dpErr').hidden = !error;
  $('#dpErr').textContent = error ? `这次没用上 AI（${error}），先用本地规则排了一版。` : '';
  $('#dpList').innerHTML = res.blocks.length
    ? res.blocks.map((b, i) => `<li><label><input type="checkbox" checked data-i="${i}"><span class="num">${b.start}–${b.end}</span><span><b>${esc(b.title)}</b>${b.reason ? `<small>${esc(b.reason)}</small>` : ''}</span></label></li>`).join('')
    : '<li class="empty">要做的都已经排上了，或者剩下的空档不够一块。</li>';
  const dr = res.dropped || [];
  $('#dpDrop').hidden = !dr.length;
  $('#dpDrop').innerHTML = dr.length ? `<summary>${dr.length} 块放不下</summary>` + dr.map(d => `<p>${esc(d.title)}：${esc(d.why)}</p>`).join('') : '';
  $('#dpNote').hidden = !res.note;
  $('#dpNote').textContent = res.note || '';
  $('#dpAccept').disabled = !res.blocks.length;
  $('#dpAll').hidden = !!(planDraft && planDraft.replace.length) || !plansOn(ymd(new Date())).some(b => b.status === 'planned' && !b.pinned && b.kind !== 'event');
  openDlg($('#dlgPlan'));
}
// a new plan replaces what's still ahead, except blocks you placed yourself
function replaceFuture(date, fromMin, blocks, source) {
  const t = Date.now();
  S.plans.forEach(b => { if (!b.deletedAt && b.date === date && b.status === 'planned' && !b.pinned && toMin(b.start) >= fromMin) { b.deletedAt = t; b.updatedAt = t; } });
  blocks.forEach(b => S.plans.push(normPlan(Object.assign({ id: newId(), date, source, status: 'planned', updatedAt: t }, b))));
}
function acceptPlan() {
  if (!planDraft) return;
  const rows = $$('#dpList input[data-i]').filter(c => c.checked);
  const picked = rows.map(c => planDraft.blocks[+c.dataset.i]), rects = rows.map(c => c.closest('li').getBoundingClientRect()), ids = [];
  const t = Date.now();
  planDraft.replace.forEach(id => { const b = S.plans.find(x => x.id === id); if (b && b.status === 'planned') { b.deletedAt = t; b.updatedAt = t; } });
  picked.forEach(b => { const nb = normPlan(Object.assign({ id: newId(), date: planDraft.date, source: planDraft.source, status: 'planned', updatedAt: t }, b)); ids.push(nb.id); S.plans.push(nb); });
  planDraft = null;
  commit('plans');
  $('#dlgPlan').close();
  requestAnimationFrame(() => flyInto(rects, ids));
  toast(`已排进时间轴：${picked.length} 块，长按色块可以拖动调整`);
}
// repeats get cleaned up: more time than a to-do needs, the same free block twice, or the same appointment twice
function dedupePlans() {
  const now = new Date(), today = ymd(now), nowMin = nowMinOf(now), t = Date.now();
  let removed = 0;
  const drop = b => { b.deletedAt = t; b.updatedAt = t; removed++; };
  Array.from(new Set(alive(S.plans).filter(b => b.date >= today && b.status === 'planned').map(b => b.date))).forEach(date => {
    const day = date === today ? now : parseYMD(date), live = plansOn(date).filter(b => b.status === 'planned');
    const groups = new Map();
    live.filter(b => b.kind === 'task' || b.kind === 'routine').forEach(b => { if (!groups.has(b.taskId)) groups.set(b.taskId, []); groups.get(b.taskId).push(b); });
    groups.forEach((list, id) => {
      const task = S.tasks.find(x => x.id === id && !x.deletedAt), r = S.routines.find(x => x.id === id && !x.deletedAt);
      const need = task ? remainingMin(task) : r ? routineNeed(r, day) : 0;
      let sum = 0;
      list.sort((x, y) => toMin(x.start) - toMin(y.start)).forEach(b => {
        const len = date === today ? toMin(b.end) - Math.max(toMin(b.start), nowMin) : blockMin(b);
        if (sum + len > need + 10 && !(date === today && toMin(b.start) < nowMin)) drop(b); else sum += len;
      });
    });
    const frees = live.filter(b => b.kind === 'free').sort((x, y) => toMin(x.start) - toMin(y.start)), keep = [];
    frees.forEach(b => { if (keep.some(k => similar(k.title, b.title) >= 0.7)) drop(b); else keep.push(b); });
    const events = live.filter(b => b.kind === 'event').sort((x, y) => y.updatedAt - x.updatedAt), kept = [];
    events.forEach(b => {
      if (kept.some(k => similar(k.title, b.title) >= 0.8)) {
        drop(b);
        const tk = S.tasks.find(x => x.id === b.taskId && !x.deletedAt && x.status !== 'done');
        if (tk && !alive(S.plans).some(o => o.taskId === tk.id && !o.deletedAt)) { tk.deletedAt = t; tk.updatedAt = t; }
      } else kept.push(b);
    });
  });
  return removed;
}
let lastDeduped = 0;
// who gives way: classes and appointments never move; among blocks you placed, the most recent edit wins;
// everything else slides to the next free time. Finished blocks are history and never get in the way.
let lastMoves = [];
function resolveOverlaps() {
  const now = new Date(), today = ymd(now), nowMin = nowMinOf(now), latest = S.settings.plan.latest;
  lastMoves = [];
  Array.from(new Set(alive(S.plans).filter(b => b.date >= today && b.status === 'planned').map(b => b.date))).forEach(date => {
    const day = parseYMD(date), live = plansOn(date).filter(b => b.status === 'planned');
    const hard = classesOn(day).map(c => [toMin(c.start), toMin(c.end)]).concat(busyOn(date).map(b => [toMin(b.start), toMin(b.end)]));
    const fixed = live.filter(b => b.kind === 'event' || (date === today && toMin(b.start) < nowMin));
    fixed.forEach(b => hard.push([toMin(b.start), toMin(b.end)]));
    const placed = hard.slice(), mealSpans = meals().map(([x, y]) => [toMin(x), toMin(y)]);
    const place = (b, avoidMeals) => {
      const len = blockMin(b), a0 = toMin(b.start), clash = (s0, e0) => placed.concat(avoidMeals ? mealSpans : []).some(([x, y]) => s0 < y && e0 > x);
      if (clash(a0, a0 + len)) {
        let t = a0;
        while (t + len <= latest && clash(t, t + len)) t += 5;
        const from = b.start;
        if (t + len <= latest) { b.start = fmtMin(t); b.end = fmtMin(t + len); lastMoves.push({ title: b.title, from, to: b.start }); }
        else { b.status = 'missed'; b.reason = '今天放不下了'; lastMoves.push({ title: b.title, from, to: '' }); }
        touch(b);
      }
      if (b.status === 'planned') placed.push([toMin(b.start), toMin(b.end)]);
    };
    live.filter(b => b.pinned && !fixed.includes(b)).sort((x, y) => y.updatedAt - x.updatedAt).forEach(b => place(b, false));
    live.filter(b => !b.pinned && !fixed.includes(b)).sort((x, y) => toMin(x.start) - toMin(y.start)).forEach(b => place(b, true));
  });
  return lastMoves;
}
// finished or deleted work frees its future time
function reconcilePlans() {
  const now = new Date(), t = now.getTime(), today = ymd(now), nowMin = nowMinOf(now);
  S.plans.forEach(b => {
    if (b.deletedAt || b.status !== 'planned' || b.date < today || b.kind === 'free') return;
    const future = b.date > today || toMin(b.start) >= nowMin;
    const linked = b.kind === 'task' || b.kind === 'event';
    const task = linked ? S.tasks.find(x => x.id === b.taskId) : null, r = b.kind === 'routine' ? S.routines.find(x => x.id === b.taskId) : null;
    const gone = linked ? (!task || task.deletedAt) : (!r || r.deletedAt);
    const finished = linked ? task && task.status === 'done' : r && r.done[b.date];
    if (gone) { b.deletedAt = t; b.updatedAt = t; }
    else if (finished) { if (future && b.kind !== 'event') b.deletedAt = t; else b.status = 'done'; b.updatedAt = t; }
  });
}
// finish early and the next blocks move up into the freed time; blocks you placed yourself stay put
function compactPlan(now) {
  const date = ymd(now), fromMin = ceil5(now), latest = S.settings.plan.latest;
  const ahead = plansOn(date).filter(b => b.status === 'planned' && toMin(b.start) >= fromMin).sort((x, y) => toMin(x.start) - toMin(y.start));
  const fixed = classesOn(now).map(c => [toMin(c.start), toMin(c.end)]).concat(meals().map(([a, b]) => [toMin(a), toMin(b)]), busyOn(date).map(b => [toMin(b.start), toMin(b.end)]),
    plansOn(date).filter(b => b.status === 'planned' && (b.pinned || b.kind === 'event' || toMin(b.start) < fromMin)).map(b => [toMin(b.start), toMin(b.end)]));
  const clear = (a, b) => b <= latest && !fixed.some(([x, y]) => a < y && b > x);
  let cursor = fromMin, moved = false;
  ahead.forEach(b => {
    const len = blockMin(b);
    if (b.pinned) { cursor = Math.max(cursor, toMin(b.end) + BREAK); return; }
    for (let t = cursor; t < toMin(b.start); t += 5) {
      if (clear(t, t + len)) { b.start = fmtMin(t); b.end = fmtMin(t + len); touch(b); moved = true; break; }
    }
    fixed.push([toMin(b.start), toMin(b.end)]);
    cursor = toMin(b.end) + BREAK;
  });
  return moved;
}
function rollPlan() {
  const now = new Date(), date = ymd(now), nowMin = nowMinOf(now), t = Date.now();
  let changed = false;
  plansOn(date).forEach(b => { if (b.status === 'planned' && toMin(b.end) <= nowMin) { b.status = 'missed'; b.updatedAt = t; changed = true; } });
  return compactPlan(now) || changed;
}
function afterProgress(msg) {
  const moved = compactPlan(new Date());
  commit('plans');
  if (msg) toast(msg + (moved ? '，后面的安排往前挪了' : ''));
}
// missed blocks: offer to carry the unfinished work to later today
function carryOver() {
  const now = new Date(), date = ymd(now), fromMin = ceil5(now);
  const missed = new Set(plansOn(date).filter(b => b.status === 'missed').map(b => b.taskId));
  const items = planItems(now).filter(it => missed.has(it.ref));
  const planned = plansOn(date).filter(b => b.status === 'planned' && toMin(b.end) > fromMin);
  const add = fillSlots(freeSlots(now, fromMin, keptBlocks(date, fromMin).concat(planned)), items, now);
  const t = Date.now();
  add.forEach(b => S.plans.push(normPlan(Object.assign({ id: newId(), date, source: 'local', status: 'planned', updatedAt: t, reason: '顺延' }, b))));
  plansOn(date).forEach(b => { if (b.status === 'missed' && !/已顺延/.test(b.title)) { b.title += '（已顺延）'; touch(b); } });
  commit('plans');
  toast(add.length ? `顺延了 ${add.length} 块` : '后面没有能放下的空档了');
}
let blockId = null, suppressClick = false;
function finishBlock(b) {
  const now = new Date(), nowMin = nowMinOf(now), today = ymd(now);
  const notStarted = b.date > today || (b.date === today && toMin(b.start) > nowMin);
  b.status = 'done'; touch(b);
  const early = toMin(b.end) - nowMin;
  if (notStarted && b.kind !== 'event') b.deletedAt = Date.now(); // done before it began: nothing to show on the timeline
  else if (b.date === today && early > 0 && b.kind !== 'event') b.end = fmtMin(Math.max(toMin(b.start) + 5, nowMin)); // finished early: the rest is free again
  let msg = early >= 10 && b.kind !== 'event' ? `提前 ${early} 分钟做完` : '这一块完成了';
  if (b.kind === 'task' || b.kind === 'event') {
    const t = S.tasks.find(x => x.id === b.taskId && !x.deletedAt);
    const more = plansOn(b.date).filter(x => x.taskId === b.taskId && x.status === 'planned' && x.id !== b.id).length;
    if (t && t.status !== 'done' && !more) { t.status = 'done'; t.doneAt = Date.now(); touch(t); msg = `KO！${t.title}，待办里也勾上了`; }
    else if (more) msg += `，这项还剩 ${more} 段`;
  } else if (b.kind === 'routine') {
    const r = S.routines.find(x => x.id === b.taskId && !x.deletedAt);
    if (r && !r.done[b.date]) { r.done[b.date] = 1; touch(r); msg = `打卡！${r.title} 连续 ${streak(r, now)} 天`; }
  }
  reconcilePlans();
  afterProgress(msg);
}
function openBlock(id) {
  if (suppressClick) return;
  const b = S.plans.find(x => x.id === id && !x.deletedAt);
  if (!b) return;
  blockId = b.id;
  $('#dbH').textContent = b.title;
  $('#dbWhen').textContent = `${b.source === 'ai' ? 'AI 排的' : '本地排的'}${b.pinned ? '，你调过时间' : ''}${b.status === 'done' ? '，已完成' : b.status === 'missed' ? '，没做' : ''}`;
  $('#dbReason').textContent = b.reason || '';
  $('#dbTitle').value = b.title;
  $('#dbStart').value = b.start;
  $('#dbEnd').value = b.end;
  $('#dbTime').hidden = b.status === 'missed';
  $('#dbDone').hidden = b.status === 'done';
  resetDel($('#dbDel'), true); $('#dbDel').textContent = '删掉这块';
  openDlg($('#dlgBlock'));
}
// your own time changes: checked against classes and other plans, then pinned so nothing moves them
function setBlockTime(id, start, len, title) {
  const b = S.plans.find(x => x.id === id && !x.deletedAt);
  if (!b) return false;
  const date = b.date, s0 = Math.max(0, Math.min(1439 - len, start)), e0 = s0 + len;
  if (len < 5) { toast('时长至少 5 分钟'); return false; }
  const walls = classesOn(parseYMD(date)).map(c => [toMin(c.start), toMin(c.end), '有课']).concat(busyOn(date).map(x => [toMin(x.start), toMin(x.end), '你说过没空']),
    b.kind === 'event' ? [] : plansOn(date).filter(x => x.id !== id && x.kind === 'event' && x.status === 'planned').map(x => [toMin(x.start), toMin(x.end), '是日程「' + x.title + '」']));
  const hit = walls.find(([x, y]) => s0 < y && e0 > x);
  if (hit) { toast(`${fmtMin(hit[0])}–${fmtMin(hit[1])} ${hit[2]}，放不下`); renderToday(); return false; }
  const moved = b.start !== fmtMin(s0) || b.end !== fmtMin(e0);
  b.start = fmtMin(s0); b.end = fmtMin(e0); b.pinned = b.pinned || moved;
  if (title && title !== b.title) renameBlock(b, title);
  touch(b);
  commit('plans');
  const shifted = lastMoves.filter(m => m.title !== b.title);
  toast(`${b.title}：${b.start}–${b.end}` + (shifted.length ? `，${shifted.map(m => m.to ? `${m.title}顺延到 ${m.to}` : `${m.title}今天放不下了`).join('，')}` : ''));
  return true;
}
// short blocks get a minimum height; when that would make two blocks in the same column touch, the later one
// steps down a little, and the timeline grows to fit. Every block shows its real time, so nothing is lost.
function declutter(box) {
  const items = $$('.ev', box).filter(el => !el.classList.contains('done')).map(el => ({ el, top: parseFloat(el.style.top), h: el.offsetHeight, col: el.style.left + '|' + el.style.width }));
  const cols = new Map();
  items.forEach(it => { if (!cols.has(it.col)) cols.set(it.col, []); cols.get(it.col).push(it); });
  let bottom = 0;
  cols.forEach(list => {
    list.sort((x, y) => x.top - y.top);
    let edge = -Infinity;
    list.forEach(it => {
      if (it.top < edge + 3) { it.top = edge + 3; it.el.style.top = it.top + 'px'; it.el.classList.add('nudged'); }
      edge = it.top + it.h; bottom = Math.max(bottom, edge);
    });
  });
  if (bottom > box.offsetHeight) box.style.minHeight = (bottom + 8) + 'px';
}
// renaming a block that shows its to-do's name renames the to-do too, so both lists agree
function renameBlock(b, title) {
  title = title.trim().slice(0, 40);
  if (!title) return;
  const t = (b.kind === 'task' || b.kind === 'event') ? S.tasks.find(x => x.id === b.taskId && !x.deletedAt) : null;
  const r = b.kind === 'routine' ? S.routines.find(x => x.id === b.taskId && !x.deletedAt) : null;
  if (t && (t.title === b.title || b.kind === 'event')) { t.title = title; touch(t); }
  if (r && r.title === b.title) { r.title = title; touch(r); }
  b.title = title;
}
function enableDrag(el, b, dayStart) {
  let timer = null, dragging = false, y0 = 0, top0 = 0, ns = null;
  const begin = y => { y0 = y; top0 = parseFloat(el.style.top) || 0; ns = null; timer = setTimeout(() => { dragging = true; el.classList.add('dragging'); if (navigator.vibrate) navigator.vibrate(12); }, 350); };
  const move = (y, e) => {
    if (!dragging) { if (Math.abs(y - y0) > 8) clearTimeout(timer); return; }
    if (e.cancelable) e.preventDefault();
    ns = Math.round((toMin(b.start) + (y - y0) / PX_DAY) / 5) * 5;
    el.style.top = (top0 + (ns - toMin(b.start)) * PX_DAY) + 'px';
    $('.t', el).textContent = `${fmtMin(ns)} ${b.title}`;
  };
  const end = () => {
    clearTimeout(timer);
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging'); suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
    if (ns != null && ns !== toMin(b.start)) setBlockTime(b.id, ns, blockMin(b)); else renderToday();
  };
  el.addEventListener('touchstart', e => begin(e.touches[0].clientY), { passive: true });
  el.addEventListener('touchmove', e => move(e.touches[0].clientY, e), { passive: false });
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  el.addEventListener('mousedown', e => {
    begin(e.clientY);
    const mm = ev => move(ev.clientY, ev), mu = () => { end(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  });
}
function renderPlanHints(now) {
  const today = ymd(now), nowMin = nowMinOf(now), mine = plansOn(today);
  const covered = new Set(mine.filter(b => b.status === 'planned' && toMin(b.end) > nowMin).map(b => b.taskId));
  const limit = addDays(startOfDay(now), 2).getTime();
  const urgent = mine.length ? openTasks().filter(t => { const d = parseDue(t.due); return d && d.getTime() < limit && remainingMin(t) > 0 && !covered.has(t.id); }) : [];
  const missedNeed = mine.filter(b => b.status === 'missed' && !/已顺延/.test(b.title)).filter(b => planItems(now).some(it => it.ref === b.taskId));
  $('#replanHint').hidden = !urgent.length && !missedNeed.length;
  $('#replanText').textContent = missedNeed.length ? `${missedNeed.length} 块到点没做，要顺延到后面吗？` : urgent.length ? `${urgent.length} 项快到期的作业还没排进今天` : '';
  $('#replanBtn').textContent = missedNeed.length ? '顺延' : '重排';
  $('#replanBtn').onclick = missedNeed.length ? carryOver : planToday;
  const n = mine.filter(b => b.status === 'planned').length, d = mine.filter(b => b.status === 'done').length;
  $('#planInfo').textContent = n || d ? `今天计划 ${n + d} 块${d ? `，完成 ${d} 块` : ''}` : aiReady() ? 'AI 已连接' : '没连 AI 时用本地规则排';
}

/* ---------- 我现在有空: what to do with the time you've got ---------- */
function suggestNow(minutes, now) {
  const at = nowMinOf(now), date = ymd(now); // raw need: starting now can replace a block planned for later
  const nextClass = classesOn(now).map(c => toMin(c.start)).filter(m => m > at).sort((x, y) => x - y)[0];
  const room = Math.min(minutes, nextClass ? nextClass - at : minutes);
  return planItems(now, true).map(it => {
    const len = Math.min(room, it.need, it.kind === 'task' ? S.settings.plan.maxBlock : it.need, it.cap == null ? Infinity : it.cap - at);
    return Object.assign({}, it, { len, score: itemScore(it, at) + (len >= it.need ? 0.1 : 0) });
  }).filter(it => it.len >= (it.kind === 'routine' ? it.need : Math.min(15, it.need))).sort((x, y) => y.score - x.score).slice(0, 3)
    .map(it => Object.assign(it, { date, start: at }));
}
function startNow(it) {
  const now = new Date(), date = ymd(now), start = ceil5(now);
  const next = classesOn(now).map(c => toMin(c.start)).concat(busyOn(date).map(b => toMin(b.start)), plansOn(date).filter(b => b.status !== 'missed' && (b.pinned || b.kind === 'event')).map(b => toMin(b.start)))
    .filter(m => m > start).sort((x, y) => x - y)[0];
  const len = Math.min(it.len, next ? next - start : it.len, 1439 - start);
  if (len < 5) { toast('现在到下一个安排之间没有时间了'); return; }
  const t = Date.now();
  plansOn(date).forEach(b => { if (b.taskId === it.ref && b.status === 'planned' && !b.pinned && toMin(b.start) >= start) { b.deletedAt = t; b.updatedAt = t; } });
  S.plans.push(normPlan({ id: newId(), date, start: fmtMin(start), end: fmtMin(start + len), taskId: it.ref, kind: it.kind, title: it.title, reason: '现在有空，先做这个', source: 'local', status: 'planned', pinned: true, updatedAt: t }));
  commit('plans');
  toast(`开始吧：${it.title}，${len} 分钟，后面的安排往后顺`);
}
function showFreeTime(minutes) {
  const now = new Date(), list = suggestNow(minutes, now);
  $('#dfList').innerHTML = list.length ? list.map((it, i) => `<li><div><b>${esc(it.title)}</b><small>${it.len} 分钟　${esc(it.reason)}</small></div><button type="button" class="btn chip" data-i="${i}">就做这个</button></li>`).join('')
    : '<li class="empty">现在没有要赶的事，歇一会儿，或者去跑一圈。</li>';
  $$('#dfList [data-i]').forEach(b => b.addEventListener('click', () => { startNow(list[+b.dataset.i]); $('#dlgFree').close(); }));
  $('#dfAsk').hidden = !aiReady();
  $('#dfAsk').onclick = () => { $('#dlgFree').close(); location.hash = '#ai'; setTimeout(() => sendChat(`我现在有 ${minutes} 分钟，做什么好？`), 200); };
}

/* ---------- 小助手: free conversation; it acts through tools and asks before scheduling ---------- */
const LS_CHAT = 'swb:chat', LS_MEMCUR = 'swb:mem-cursor';
let chat = [], lastUndo = null, chatBusy = false, memBusy = false;
function loadChat() { try { chat = arr(JSON.parse(localStorage.getItem(LS_CHAT) || '[]')).slice(-40); } catch (e) { chat = []; } }
function saveChat() { try { localStorage.setItem(LS_CHAT, JSON.stringify(chat.slice(-40))); } catch (e) { /* ignore */ } }
const fnTool = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required: required || [] } } });
const CHAT_TOOLS = [
  PLAN_TOOL,
  fnTool('add_event', '用户说某天某个时间段有事（开会、社团、考试、约了人……）时调用：会同时写进首页时间轴和待办，之后排计划自动避开', { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD，不说就是今天' }, start: { type: 'string', description: 'HH:MM' }, end: { type: 'string', description: 'HH:MM' } }, ['title', 'start', 'end']),
  fnTool('move_block', '用户明确要求改某个已经排好的安排的时间时调用', { id: { type: 'string' }, title: { type: 'string' }, start: { type: 'string', description: 'HH:MM' }, end: { type: 'string', description: 'HH:MM' } }, ['start']),
  fnTool('add_task', '用户提到一项新的作业、考试或截止事项时添加', { title: { type: 'string' }, course: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD HH:MM' }, estimate: { type: 'integer', description: '预计分钟' }, priority: { type: 'string', enum: ['high', 'mid', 'low'] } }, ['title']),
  fnTool('add_routine', '用户想每天或每周固定做某件事时添加', { title: { type: 'string' }, days: { type: 'array', items: { type: 'integer' }, description: '1=周一 … 7=周日' }, minutes: { type: 'integer' }, window: { type: 'string', enum: ['morning', 'noon', 'afternoon', 'evening', 'any'] } }, ['title']),
  fnTool('mark_done', '用户说某项作业或每日事项做完了', { ref: { type: 'string', description: 'id' }, title: { type: 'string' } }),
  fnTool('remember', '只在用户明确让你记住，或者亲口说出固定的作息规律、长期偏好、长期目标时调用；一次性的安排、情绪、闲聊都不要记', { text: { type: 'string', description: '8 到 30 字的事实，能直接用来排计划' } }, ['text'])
];
const CHAT_PROMPT = () => [
  `现在是 ${(() => { const d = new Date(); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WD[isoDay(d) - 1]} ${fmtMin(nowMinOf(d))}`; })()}（用户手机上的时间，本学期第 ${teachWeek(new Date()) || '?'} 周）。用户说“今晚”“明天”“下周三”时按这个时间换算成具体日期。`,
  `你是「小助手」，住在一名大学生的学习工作台 App 里。你可以和用户自由地聊任何话题：学习、课程问题、生活、情绪都行。像一个靠谱、有点幽默的学长那样说话，自然、简短，不打官腔。`,
  `你同时是用户的规划助手，需要时调用工具：用户说某个时间段有事，一定调用 add_event，它会同时写进时间轴和待办；排安排用 propose_plan（只是方案，用户勾选确认后才排进时间轴）；提到新作业用 add_task；想固定每天做的事用 add_routine；说做完了用 mark_done；要改已排好的某项时间用 move_block；透露长期习惯或偏好时用 remember。`,
  `排安排时：plan_today 里状态为“已定”的时间和日程都不能占用，只用 free_slots；已经在 plan_today 里的事不要再排一遍；只排还没排上的事，先排过期和快截止的，每日事项尽量放在它习惯的时段，ref 填 id。回复里不要自己列时间表，方案卡片会显示最终时间。`,
  `用户：称呼 ${S.settings.nick || '同学'}，大二，目标是${S.settings.path}${S.settings.goal || ''}。系统消息里有 App 的当前情况和你记住的事，相关时再用。`
].join('\n');
function daysOf(v) { const d = arr(v).map(Number).filter(x => x >= 1 && x <= 7); return d.length ? d : [1, 2, 3, 4, 5, 6, 7]; }
// tool calls that record facts apply right away (with undo); plans wait for you to pick
function runTools(calls, now) {
  const date = ymd(now), t = Date.now(), notes = [];
  let proposal = null;
  calls.forEach(({ name, args: x }) => {
    if (name === 'add_event' || name === 'set_busy') {
      const a = toMin(str(x.start)), b = toMin(str(x.end)), day = parseYMD(str(x.date)) ? str(x.date) : date;
      if (a == null || b == null || b <= a || day < date) return;
      const title = (str(x.title) || str(x.note) || '有事').trim().slice(0, 30);
      const same = alive(S.plans).find(b => b.kind === 'event' && b.date === day && b.status === 'planned' && similar(b.title, title) >= 0.8);
      if (same) {
        if (same.start === fmtMin(a) && same.end === fmtMin(b)) { notes.push(`${title} 已经在日程里了`); return; }
        const old = `${same.start}–${same.end}`;
        same.start = fmtMin(a); same.end = fmtMin(b); touch(same);
        const tk = S.tasks.find(k => k.id === same.taskId && !k.deletedAt);
        if (tk) { tk.due = `${day}T${fmtMin(a)}`; tk.estimate = Math.max(5, b - a); touch(tk); }
        notes.push(`把日程「${same.title}」从 ${old} 改到 ${same.start}–${same.end}`);
        return;
      }
      const task = normTask({ id: newId(), title, type: '其他', due: `${day}T${fmtMin(a)}`, estimate: b - a, remind: S.settings.notifyLead, status: 'todo', createdAt: t, updatedAt: t });
      S.tasks.push(task);
      S.plans.push(normPlan({ id: newId(), date: day, start: fmtMin(a), end: fmtMin(b), taskId: task.id, kind: 'event', title, reason: '日程', source: 'ai', status: 'planned', pinned: true, updatedAt: t }));
      notes.push(`加进时间轴和待办：${day === date ? '今天' : dueLabel(parseYMD(day), now).split(' ')[0]} ${fmtMin(a)}–${fmtMin(b)} ${title}`);
    } else if (name === 'move_block') {
      const live = plansOn(date).filter(b => b.status === 'planned');
      const b0 = live.find(b => b.id === str(x.id)) || live.find(b => b.title === str(x.title)) || live.find(b => str(x.title) && (b.title.includes(str(x.title)) || str(x.title).includes(b.title)));
      const a = toMin(str(x.start)), e = toMin(str(x.end));
      if (!b0 || a == null) return;
      const len = e != null && e > a ? e - a : blockMin(b0), old = `${b0.start}–${b0.end}`;
      const clash = classesOn(now).map(c => [toMin(c.start), toMin(c.end)]).concat(plansOn(date).filter(o => o.id !== b0.id && o.status === 'planned' && o.kind === 'event').map(o => [toMin(o.start), toMin(o.end)])).some(([p, q]) => a < q && a + len > p);
      if (clash) { notes.push(`${b0.title} 挪不到 ${fmtMin(a)}，那里已经有安排`); return; }
      b0.start = fmtMin(a); b0.end = fmtMin(a + len); b0.pinned = true; touch(b0); // later: others make room in resolveOverlaps
      notes.push(`${b0.title}：${old} → ${b0.start}–${b0.end}`);
    } else if (name === 'add_task') {
      const title = str(x.title).trim(), m = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/.exec(str(x.due));
      if (!title) return;
      const due = m ? `${m[1]}T${pad(+m[2])}:${m[3]}` : '', est = +x.estimate || 60;
      S.tasks.push(normTask({ id: newId(), title, course: str(x.course), due, estimate: [30, 45, 60, 90, 120, 180, 240].reduce((p, c) => Math.abs(c - est) < Math.abs(p - est) ? c : p, 60), priority: x.priority, remind: S.settings.notifyLead, status: 'todo', createdAt: t, updatedAt: t }));
      notes.push(`加了作业：${title}${due ? '（' + dueLabel(parseDue(due), now) + ' 截止）' : ''}`);
    } else if (name === 'add_routine') {
      const title = str(x.title).trim();
      if (!title) return;
      const r = normRoutine({ id: newId(), title, days: daysOf(x.days), minutes: x.minutes, window: x.window, createdAt: t, updatedAt: t });
      S.routines.push(r);
      notes.push(`加了每日事项：${title}（${daysText(r.days)} ${r.minutes} 分钟）`);
    } else if (name === 'mark_done') {
      const items = new Map(alive(S.tasks).filter(k => k.status !== 'done').map(k => [k.id, { ref: k.id, title: k.title, kind: 'task' }]).concat(alive(S.routines).map(r => [r.id, { ref: r.id, title: r.title, kind: 'routine' }])));
      const it = matchItem(items, x);
      if (!it) return;
      if (it.kind === 'task') { const k = S.tasks.find(y => y.id === it.ref); k.status = 'done'; k.doneAt = t; touch(k); notes.push(`KO：${k.title}`); }
      else { const r = S.routines.find(y => y.id === it.ref); if (!r.done[date]) { r.done[date] = 1; touch(r); notes.push(`打卡：${r.title}`); } }
    } else if (name === 'remember') {
      addMemory(str(x.text), 'chat');
    } else if (name === 'propose_plan') {
      const v = validateBlocks(x.blocks, now);
      proposal = { blocks: v.ok, picked: v.ok.map(() => true), dropped: v.dropped.map(d => `${d.title}：${d.why}`), note: str(x.note).slice(0, 60), applied: false };
      if (!v.ok.length && v.dropped.length) notes.push(v.dropped.every(d => /已经排上|重复/.test(d.why)) ? '方案里的事都已经排上了，没有重复安排' : '方案里的时间都放不下：' + v.dropped.map(d => `${d.title}（${d.why}）`).join('；'));
    }
  });
  reconcilePlans();
  return { notes, proposal };
}
// new memory that says the same thing as an old one replaces it instead of piling up
function addMemory(text, source) {
  text = str(text).trim().replace(/^[-•\d.、\s]+/, '').slice(0, 60);
  if (text.length < 6) return false;
  const live = alive(S.memory), same = live.find(m => similar(m.text, text) >= 0.6);
  if (same) { if (same.text === text) return false; same.text = text; touch(same); return true; }
  S.memory.push(normMemory({ id: newId(), text, source, createdAt: Date.now(), updatedAt: Date.now() }));
  const after = alive(S.memory);
  if (after.length > 20) { after[0].deletedAt = Date.now(); touch(after[0]); }
  return true;
}
async function sendChat(text) {
  text = String(text || '').trim();
  if (!text || chatBusy) return;
  chat.push({ role: 'user', text, t: Date.now() });
  $('#chatInput').value = '';
  if (!aiReady()) {
    chat.push({ role: 'assistant', text: '先在“我的 → AI 模型”里连上 AI，我们就能聊了。', t: Date.now() });
    saveChat(); renderChat(); return;
  }
  chatBusy = true; renderChat(true);
  const now = new Date();
  const ctx = Object.assign(planContext(now), { memory: alive(S.memory).map(m => m.text), habits: habitsSummary() });
  const history = chat.slice(-13, -1).map(m => ({ role: m.role, content: m.text }));
  let reply = '', notes = [], proposal = null;
  try {
    const snap = clone({ tasks: S.tasks, routines: S.routines, plans: S.plans, busy: S.busy, memory: S.memory });
    const r = await callAIRaw([{ role: 'system', content: CHAT_PROMPT() }, { role: 'system', content: 'App 当前情况：' + JSON.stringify(ctx) }].concat(history, [{ role: 'user', content: text }]), { tools: CHAT_TOOLS, maxTokens: 1500, temperature: 0.7 });
    ({ notes, proposal } = runTools(r.calls, now));
    reply = r.text || (proposal ? `给你排了个方案，勾掉不想要的，再点“排进时间轴”。${proposal.note ? proposal.note : ''}` : notes.length ? '好，已经记下了。' : '嗯。');
    const changed = JSON.stringify(snap) !== JSON.stringify({ tasks: S.tasks, routines: S.routines, plans: S.plans, busy: S.busy, memory: S.memory });
    lastUndo = changed ? { snap, at: chat.length } : null;
    if (notes.length || r.calls.some(c => c.name === 'remember')) {
      commit('tasks');
      lastMoves.forEach(m => notes.push(m.to ? `为了不冲突，${m.title} 从 ${m.from} 顺延到 ${m.to}` : `${m.title} 今天放不下了，可以让我换个时间`));
      if (lastDeduped) notes.push(`清掉了 ${lastDeduped} 个重复的安排`);
    }
  } catch (e) { reply = '这次没连上：' + (e && e.message ? e.message : e); }
  chat.push({ role: 'assistant', text: reply, notes, undo: !!lastUndo && lastUndo.at === chat.length, proposal, t: Date.now() });
  chatBusy = false; saveChat(); renderChat();
  extractMemory(false);
}
function applyProposal(i) {
  const m = chat[i];
  if (!m || !m.proposal || m.proposal.applied) return;
  const now = new Date(), picked = m.proposal.blocks.filter((b, k) => m.proposal.picked[k]);
  const v = validateBlocks(picked.map(b => ({ start: b.start, end: b.end, ref: b.taskId, title: b.title, reason: b.reason })), now); // re-fit: time has passed and things may have changed
  const t = Date.now();
  v.ok.forEach(b => S.plans.push(normPlan(Object.assign({ id: newId(), date: ymd(now), source: 'ai', status: 'planned', updatedAt: t }, b))));
  m.proposal.applied = true; m.proposal.count = v.ok.length;
  commit('plans'); saveChat(); renderChat();
  toast(`已排进时间轴：${v.ok.length} 块，去今天页长按色块可以拖动`);
}
function undoLast() {
  if (!lastUndo) return;
  Object.assign(S, lastUndo.snap);
  const m = chat[lastUndo.at];
  if (m) { m.undo = false; m.notes = (m.notes || []).concat(['已撤销']); }
  lastUndo = null;
  commit('tasks'); saveChat(); renderChat(); toast('已撤销');
}
function renderChat(typing) {
  const box = $('#chatList');
  if (!box) return;
  if (!chat.length) box.innerHTML = `<div class="msg bot"><p>嗨，我是小助手。想聊什么都行；要排时间就直接说“今晚 7 点后有空”“我背完单词了”。你的习惯我会自己记下来。</p></div>`;
  else box.innerHTML = chat.map((m, i) => {
    let html = `<div class="msg ${m.role === 'user' ? 'me' : 'bot'}"><p>${esc(m.text)}</p>`;
    if (m.notes && m.notes.length) html += `<ul>${m.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    const pr = m.proposal;
    if (pr && pr.blocks.length) {
      html += `<div class="prop">${pr.blocks.map((b, k) => `<label><input type="checkbox" data-pm="${i}" data-k="${k}" ${pr.picked[k] ? 'checked' : ''} ${pr.applied ? 'disabled' : ''}><span class="num">${b.start}–${b.end}</span><span>${esc(b.title)}${b.moved ? '<em>避开了冲突</em>' : ''}</span></label>`).join('')}` +
        (pr.dropped && pr.dropped.length ? `<small>${esc(pr.dropped.join('；'))}</small>` : '') +
        (pr.applied ? `<p class="done">✓ 已排进时间轴 ${pr.count} 块</p>` : `<div class="prop-f"><button type="button" class="btn primary chip" data-apply="${i}">排进时间轴</button><button type="button" class="btn chip" data-again="1">换一个方案</button></div>`) + '</div>';
    }
    if (m.undo && lastUndo && lastUndo.at === i) html += '<button type="button" class="btn chip undo">撤销</button>';
    return html + '</div>';
  }).join('');
  if (typing) mk(box, 'div', 'msg bot typing').innerHTML = '<p>正在想…</p>';
  $$('[data-pm]', box).forEach(c => c.addEventListener('change', () => { const pr = chat[+c.dataset.pm].proposal; pr.picked[+c.dataset.k] = c.checked; saveChat(); }));
  $$('[data-apply]', box).forEach(b => b.addEventListener('click', () => { spark(b, $('.nav a[data-tab="today"]')); applyProposal(+b.dataset.apply); }));
  $$('[data-again]', box).forEach(b => b.addEventListener('click', () => sendChat('换一个方案')));
  const u = $('.undo', box); if (u) u.addEventListener('click', undoLast);
  $('#aiMemLink').textContent = `记忆 ${alive(S.memory).length} 条`;
  scrollChat();
  requestAnimationFrame(scrollChat);
}
// memory writes itself: every few messages the assistant distills what's worth keeping
async function extractMemory(force) {
  if (memBusy || !aiReady()) return;
  const since = Number(localStorage.getItem(LS_MEMCUR) || 0), fresh = chat.filter(m => m.t > since && !m.text.startsWith('这次没连上'));
  if (fresh.filter(m => m.role === 'user').length < (force ? 2 : 4)) return;
  memBusy = true;
  const live = alive(S.memory), known = live.map((m, i) => `${i + 1}. ${m.text}`).join('\n') || '（还没有）';
  const convo = fresh.map(m => (m.role === 'user' ? '用户：' : '助手：') + m.text).join('\n').slice(-6000);
  const prompt = `你在整理学习助手对用户的长期记忆，宁缺毋滥。只记三类、而且必须是用户自己在对话里说过的：\n1. 固定的作息或时间规律（例：周一晚上 7 到 9 点有社团）；\n2. 明确的学习偏好或方法（例：喜欢早上背单词，晚上九点后效率低）；\n3. 长期目标或重要背景（例：计划保研南京大学）。\n不要记：一次性的安排、某天的作业、情绪、闲聊、你的推测、已经记住的内容。\n已记住：\n${known}\n最近对话：\n${convo}\n只输出 json：{"add":["新的一条，8 到 30 字，写成能直接用来排计划的事实"],"update":[{"index":已记住里的序号,"text":"改写后的内容"}],"remove":[已记住里过时或被用户推翻的序号]}。一次最多新增 2 条，能改写已有的就用 update，没有就都给空数组。`;
  try {
    const o = parseJSONLoose(await callAI([{ role: 'user', content: prompt }], { json: true, maxTokens: 500, temperature: 0.2 }));
    if (o) {
      arr(o.remove).map(Number).forEach(n => { const m = live[n - 1]; if (m) { m.deletedAt = Date.now(); touch(m); } });
      arr(o.update).forEach(u => { const m = live[(+(u && u.index)) - 1], tx = str(u && u.text).trim().slice(0, 60); if (m && !m.deletedAt && tx.length >= 6) { m.text = tx; touch(m); } });
      arr(o.add).slice(0, 2).forEach(x => addMemory(x, 'chat'));
      commit('settings');
    }
    localStorage.setItem(LS_MEMCUR, String(fresh[fresh.length - 1].t));
  } catch (e) { console.warn('memory', e); }
  memBusy = false;
}

/* ---------- voice: a sheet with waves that follow your voice; it always ends ---------- */
let voice = null;
function setMic(on) { const b = $('#chatMic'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
function insertText(text) { const ta = $('#chatInput'); ta.value = (ta.value ? ta.value + ' ' : '') + text; }
function waveLoop() {
  if (!voice) return;
  let level = 0;
  if (voice.an) { // real microphone level
    const buf = new Uint8Array(voice.an.fftSize); voice.an.getByteTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    level = Math.min(1, Math.sqrt(sum / buf.length) * 6);
  } else { voice.pulse = Math.max(0, (voice.pulse || 0) * 0.92); level = voice.pulse; } // follows recognised speech when the mic level isn't available
  voice.level = voice.level * 0.6 + level * 0.4;
  const tt = performance.now() / 260;
  $$('#vWave i').forEach((bar, i) => {
    const shape = 0.35 + 0.65 * Math.abs(Math.sin(tt + i * 0.9));
    bar.style.transform = `scaleY(${(0.18 + voice.level * 1.6 * shape + 0.06 * Math.sin(tt * 2 + i)).toFixed(3)})`;
  });
  voice.raf = requestAnimationFrame(waveLoop);
}
function heard(text) {
  if (!voice || !text || typeof text !== 'string') return;
  voice.text = text; voice.pulse = 1;
  $('#vText').textContent = text; $('#vText').classList.remove('hint');
  clearTimeout(voice.quiet);
  voice.quiet = setTimeout(() => stopVoice(true), 2500); // a pause means you're done
}
function stopVoice(keep) {
  const v = voice;
  if (!v) return;
  voice = null;
  clearTimeout(v.quiet); clearTimeout(v.cap); cancelAnimationFrame(v.raf);
  $('#voice').hidden = true; setMic(false);
  if (keep && v.text) insertText(v.text);
  else if (keep) toast('没听到内容，可以再点一次麦克风');
  // let go of the engine without waiting: a stuck native call can no longer freeze the screen
  const quiet = p => { try { Promise.resolve(p).catch(() => {}); } catch (e) { /* ignore */ } };
  try {
    if (v.engine === 'native') { const SR = plugin('SpeechRecognition'); if (SR) { quiet(SR.stop()); if (SR.removeAllListeners) quiet(SR.removeAllListeners()); } }
    else if (v.rec) { v.rec.onend = v.rec.onerror = v.rec.onresult = null; if (v.rec.abort) v.rec.abort(); else v.rec.stop(); }
  } catch (e) { /* already stopped */ }
  try { if (v.stream) v.stream.getTracks().forEach(tr => tr.stop()); if (v.ctx) quiet(v.ctx.close()); } catch (e) { /* ignore */ }
}
async function micLevel(v) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (voice !== v) { stream.getTracks().forEach(tr => tr.stop()); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), an = ctx.createAnalyser();
    an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
    Object.assign(v, { stream, ctx, an });
  } catch (e) { /* no level: the waves follow recognised speech instead */ }
}
async function voiceInput() {
  if (voice) { stopVoice(true); return; }
  const SR = plugin('SpeechRecognition'), W = window.SpeechRecognition || window.webkitSpeechRecognition;
  let engine = null;
  if (SR) { try { const av = await SR.available(); if (av && av.available) engine = 'native'; } catch (e) { engine = null; } }
  if (!engine && W) engine = 'web';
  if (!engine) { toast('这台设备不支持应用内语音识别，可以用输入法键盘上的麦克风说话'); return; }
  voice = { engine, text: '', level: 0, pulse: 0 };
  const v = voice;
  $('#vText').textContent = '说吧，我在听'; $('#vText').classList.add('hint');
  $('#voice').hidden = false; setMic(true);
  v.raf = requestAnimationFrame(waveLoop);
  v.cap = setTimeout(() => stopVoice(true), 30000);
  if (engine === 'native') {
    try {
      try { SR.stop().catch(() => {}); if (SR.removeAllListeners) SR.removeAllListeners().catch(() => {}); } catch (e) { /* a leftover session */ }
      const perm = await SR.requestPermissions();
      if (perm && perm.speechRecognition && perm.speechRecognition !== 'granted') { stopVoice(false); toast('没有麦克风权限，到系统设置里给学生工作台打开'); return; }
      v.handle = await SR.addListener('partialResults', d => { if (voice === v) heard(arr(d && d.matches)[0]); });
      SR.start({ language: 'zh-CN', maxResults: 1, partialResults: true, popup: false })
        .then(r => { const t = r && arr(r.matches)[0]; if (t) heard(t); if (voice === v && !v.text) setTimeout(() => { if (voice === v && !v.text) stopVoice(true); }, 6000); })
        .catch(() => { if (voice === v) stopVoice(true); });
    } catch (e) { stopVoice(true); }
    return;
  }
  const rec = new W();
  rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; heard(t); };
  rec.onerror = () => { if (voice === v) stopVoice(true); };
  rec.onend = () => { if (voice === v) stopVoice(true); };
  v.rec = rec;
  try { rec.start(); } catch (e) { stopVoice(false); return; }
  micLevel(v);
}

/* ---------- pop-up reminders while the app is open ---------- */
const LS_REMINDED = 'swb:reminded';
let remindTask = null;
function checkReminders() {
  if ($('#dlgRemind').open) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(LS_REMINDED) || '{}') || {}; } catch (e) { seen = {}; }
  const now = Date.now();
  const t = openTasks().find(x => { const d = parseDue(x.due); if (!d || !x.remind) return false; const at = d.getTime() - x.remind * 60000; return now >= at && now < d.getTime() + 1800000 && !seen[`${x.id}|${x.due}|${x.remind}`]; });
  if (!t) return;
  seen[`${t.id}|${t.due}|${t.remind}`] = 1;
  try { localStorage.setItem(LS_REMINDED, JSON.stringify(seen)); } catch (e) { /* ignore */ }
  remindTask = t;
  const d = parseDue(t.due), left = Math.round((d.getTime() - now) / 60000);
  $('#drmH').textContent = left > 0 ? `还有 ${durText(left)}截止` : '已经到截止时间了';
  $('#drmBody').textContent = `${t.title}${t.course ? '（' + t.course + '）' : ''}，${dueLabel(d, new Date())} 截止`;
  openDlg($('#dlgRemind'));
}

/* ---------- 每日事项 ---------- */
function daysText(days) {
  if (days.length === 7) return '每天';
  if (days.join() === '1,2,3,4,5') return '工作日';
  if (days.join() === '6,7') return '周末';
  return '周' + days.map(d => WD[d - 1]).join('、');
}
function toggleRoutine(id) {
  const r = S.routines.find(x => x.id === id && !x.deletedAt), now = new Date(), key = ymd(now);
  if (!r) return;
  const before = raceOn() ? raceState(now).L : 0;
  if (r.done[key]) delete r.done[key]; else r.done[key] = 1;
  touch(r);
  reconcilePlans();
  const n = streak(r, now);
  afterProgress(r.done[key] ? `打卡！${r.title} 连续 ${n} 天` + (raceOn() && raceState(now).L > before ? '，又拉开一点' : '') : `取消了 ${r.title} 的打卡`);
}
let editRoutineId = null;
function openRoutine(id) {
  const r = id ? S.routines.find(x => x.id === id && !x.deletedAt) : null;
  editRoutineId = r ? r.id : null;
  $('#drH').textContent = r ? '修改每日事项' : '添加每日事项';
  $('#rTitle').value = r ? r.title : '';
  const days = r ? r.days : [1, 2, 3, 4, 5, 6, 7];
  $$('#rDays button').forEach(b => b.setAttribute('aria-pressed', String(days.includes(+b.dataset.d))));
  $('#rMin').value = String(r ? r.minutes : 20);
  setSeg('#rWin', r ? r.window : 'any');
  resetDel($('#rDel'), !!r);
  hideErr('#rErr');
  openDlg($('#dlgRoutine'));
  if (!r) setTimeout(() => $('#rTitle').focus(), 50);
}
function saveRoutine() {
  const title = $('#rTitle').value.trim(), days = $$('#rDays button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.d);
  if (!title) return showErr('#rErr', '写一下要做什么。');
  if (!days.length) return showErr('#rErr', '至少选一天。');
  const data = { title, days, minutes: clampInt($('#rMin').value, 5, 180, 20), window: segVal('#rWin') || 'any' };
  let r = editRoutineId ? S.routines.find(x => x.id === editRoutineId) : null;
  if (r) Object.assign(r, normRoutine(Object.assign({}, r, data)));
  else { r = normRoutine(Object.assign({ id: newId(), createdAt: Date.now() }, data)); S.routines.push(r); }
  touch(r);
  commit('tasks');
  $('#dlgRoutine').close();
}
function renderRoutinesToday(now) {
  const key = ymd(now), box = $('#todayRoutines');
  const list = alive(S.routines).filter(r => r.days.includes(isoDay(now)));
  box.hidden = !list.length;
  box.innerHTML = list.map(r => `<button type="button" class="rchip${r.done[key] ? ' on' : ''}" data-r="${r.id}"><i></i><span>${esc(r.title)}</span><small>${r.done[key] ? '连续 ' + streak(r, now) + ' 天' : r.minutes + ' 分钟'}</small></button>`).join('');
  $$('[data-r]', box).forEach(b => b.addEventListener('click', () => { if (!b.classList.contains('on')) spark(b, $('#race:not([hidden]) #raceChip')); toggleRoutine(b.dataset.r); }));
}

/* ---------- render: today ---------- */
function greeting(d) {
  const h = d.getHours();
  return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
}
function renderTitle() {
  const now = new Date(), s = S.settings, w = teachWeek(now);
  $('#hello').textContent = greeting(now) + (s.nick ? '，' + s.nick : '');
  $('#heroDate').textContent = `${now.getMonth() + 1}月${now.getDate()}日 周${WD[isoDay(now) - 1]}`;
  $('#heroWeek').textContent = w == null ? '设置教学周' : w === 0 ? '还没开学' : `第 ${w} 周 ${w % 2 ? '单周' : '双周'}`;
  renderRace();
  // semester lap: one full lap = the whole term
  const total = s.totalWeeks, prog = semesterProgress(now);
  const path = $('#ovalDone'), len = path.getTotalLength ? path.getTotalLength() : 0;
  if (len) {
    path.style.strokeDasharray = `${len * prog} ${len}`;
    const pt = path.getPointAtLength(len * prog);
    $('#ovalRunner').setAttribute('cx', pt.x.toFixed(1)); $('#ovalRunner').setAttribute('cy', pt.y.toFixed(1));
  }
  $('#ovalWeek').textContent = w == null ? '–' : String(Math.min(w, total));
  $('#ovalTotal').textContent = w == null ? '点我设置' : `/ ${total} 周`;
}

let rulerDrawn = false;
function renderToday() {
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const classes = classesOn(now), todayKey = ymd(now);
  const eventTasks = new Set(alive(S.plans).filter(b => b.kind === 'event').map(b => b.taskId)); // appointments already show as blocks
  const dues = openTasks().filter(t => t.due.slice(0, 10) === todayKey && !eventTasks.has(t.id))
    .map(t => ({ t, m: toMin(t.due.slice(11, 16)) })).filter(x => x.m != null).sort((a, b) => a.m - b.m);
  let start = S.settings.dayStart * 60, end = S.settings.dayEnd * 60;
  classes.forEach(c => { start = Math.min(start, Math.floor(toMin(c.start) / 60) * 60); end = Math.max(end, Math.ceil(toMin(c.end) / 60) * 60); });
  dues.forEach(x => { start = Math.min(start, Math.floor(x.m / 60) * 60); end = Math.max(end, Math.min(1440, Math.ceil((x.m + 1) / 60) * 60)); });

  const r = $('#ruler');
  r.innerHTML = '';
  const H = (end - start) * PX_DAY;
  r.style.height = H + 'px';
  r.classList.remove('has-dues');
  requestAnimationFrame(() => declutter(box));
  mk(r, 'div', 'axis');
  for (let m = start; m <= end; m += 30) {
    const y = (m - start) * PX_DAY, hour = m % 60 === 0;
    mk(r, 'div', 'tick' + (hour ? ' h' : '')).style.top = y + 'px';
    if (hour) { const lb = mk(r, 'div', 'tl num'); lb.style.top = y + 'px'; lb.textContent = pad(m / 60); }
  }
  // deadlines: a line behind the blocks plus a chip row above the timeline (no labels covering block text)
  const chips = $('#dueChips');
  chips.hidden = !dues.length;
  chips.innerHTML = dues.length ? '<span>截止</span>' + dues.slice().sort((x, y) => x.m - y.m).map(x => `<button type="button" class="dchip" data-t="${x.t.id}"><i></i><b class="num">${fmtMin(x.m)}</b>${esc(x.t.title)}</button>`).join('') : '';
  $$('[data-t]', chips).forEach(bt => bt.addEventListener('click', () => openTask(bt.dataset.t)));
  // free blocks from now on, so you can see where homework fits
  const blocksToday = plansOn(todayKey);
  let cursor = Math.max(nowMin, start);
  const gaps = [];
  classes.concat(blocksToday).slice().sort((x, y) => toMin(x.start) - toMin(y.start)).forEach(c => {
    const a = toMin(c.start), b = toMin(c.end);
    if (b <= cursor) return;
    if (a > cursor) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  });
  if (end > cursor) gaps.push([cursor, end]);
  gaps.filter(([a, b]) => b - a >= 60).forEach(([a, b]) => {
    const g = mk(r, 'div', 'gap');
    g.style.top = ((a - start) * PX_DAY) + 'px';
    g.style.height = ((b - a) * PX_DAY) + 'px';
    g.textContent = '空档 ' + durText(b - a);
  });
  const box = mk(r, 'div', 'evbox'); // overlapping classes share the lane side by side
  // finished blocks are history: drawn full width underneath, so they never squeeze what's still to do
  const doneToday = blocksToday.filter(x => x.status === 'done').map(x => ({ c: x, a: toMin(x.start), b: toMin(x.end), lane: 0, lanes: 1 }));
  doneToday.concat(layoutLanes(classes.concat(blocksToday.filter(x => x.status !== 'done')))).forEach(({ c, a, b, lane, lanes }) => {
    if (c.taskId !== undefined) { // a planned study block
      const el = mk(box, 'button', 'ev pl' + (c.kind === 'event' ? ' event' : '') + (c.status === 'done' ? ' done' : c.status === 'missed' ? ' missed' : '') + (c.pinned && c.kind !== 'event' ? ' pinned' : ''));
      el.type = 'button';
      el.style.top = ((a - start) * PX_DAY) + 'px';
      el.style.height = Math.max(30, (b - a) * PX_DAY - 2) + 'px';
      el.style.left = (lane * 100 / lanes).toFixed(3) + '%';
      el.style.width = `calc(${(100 / lanes).toFixed(3)}% - ${lanes > 1 ? 2 : 0}px)`;
      const short = (b - a) * PX_DAY < 44; // one line for short blocks so nothing gets clipped
      el.classList.toggle('short', short);
      el.innerHTML = short
        ? `<span class="t">${c.status === 'done' ? '✓ ' : ''}<span class="num">${esc(c.start)}</span> ${esc(c.title)}</span>`
        : `<span class="t">${c.status === 'done' ? '✓ ' : ''}${esc(c.title)}</span><span class="m"><span class="num">${esc(c.start)}–${esc(c.end)}</span>${c.source === 'ai' ? '　AI' : ''}</span>`;
      el.dataset.id = c.id;
      el.addEventListener('click', () => openBlock(c.id));
      if (c.status === 'planned') enableDrag(el, c, start);
      return;
    }
    const el = mk(box, 'button', 'ev');
    el.type = 'button';
    el.style.top = ((a - start) * PX_DAY) + 'px';
    el.style.height = Math.max(24, (b - a) * PX_DAY) + 'px';
    el.style.left = (lane * 100 / lanes).toFixed(3) + '%';
    el.style.width = `calc(${(100 / lanes).toFixed(3)}% - ${lanes > 1 ? 2 : 0}px)`;
    el.style.setProperty('--cc', colorFor(c.name));
    if (b <= nowMin) el.classList.add('past'); else if (a <= nowMin) el.classList.add('live');
    const extra = shownFields(c);
    el.innerHTML = `<span class="t">${esc(c.name)}</span><span class="m">${c.place ? esc(c.place) + '　' : ''}<span class="num">${esc(c.start)}–${esc(c.end)}</span></span>` +
      (extra.length ? `<span class="m">${extra.map(esc).join('　')}</span>` : '');
    el.setAttribute('aria-label', `${c.name}，${c.start} 到 ${c.end}${c.place ? '，' + c.place : ''}`);
    el.addEventListener('click', () => openCourseView(c.id));
  });
  let lastY = -100;
  dues.forEach(x => {
    let y = Math.min(Math.max((x.m - start) * PX_DAY, 11), H - 11);
    if (y < lastY + 22) y = lastY + 22;
    lastY = y;
    const d = mk(r, 'button', 'due');
    d.type = 'button';
    d.style.top = y + 'px';
    d.innerHTML = '<span><i aria-hidden="true"></i></span>';
    d.setAttribute('aria-label', `${fmtMin(x.m)} ${x.t.title} 截止`);
    d.setAttribute('aria-label', `${fmtMin(x.m)} 截止：${x.t.title}`);
    d.addEventListener('click', () => openTask(x.t.id));
  });
  if (nowMin >= start && nowMin <= end) {
    const y = (nowMin - start) * PX_DAY;
    mk(r, 'div', 'nowline' + (rulerDrawn ? '' : ' anim')).style.top = y + 'px';
    const lab = mk(r, 'div', 'nowlab'); lab.style.top = y + 'px'; lab.innerHTML = RUNNER + `<span class="num">${fmtMin(nowMin)}</span>`;
  }
  rulerDrawn = true;

  const next = classes.find(c => toMin(c.end) > nowMin);
  let sum;
  if (!alive(S.courses).length) sum = '还没有课表，先到“课表”里添加或导入';
  else if (!classes.length) sum = '今天没课';
  else if (!next) sum = `今天 ${classes.length} 节课都上完了`;
  else if (toMin(next.start) <= nowMin) sum = `正在上：${next.name}${next.place ? '，' + next.place : ''}`;
  else sum = `下一节 ${next.start} ${next.name}${next.place ? '，' + next.place : ''}`;
  if (dues.length) sum += `；今天有 ${dues.length} 项截止`;
  $('#todaySum').textContent = sum;
  renderPlanHints(now);
  renderRoutinesToday(now);

  const soon = openTasks().filter(t => t.due).sort(byDue).slice(0, 4);
  const list = $('#soonList');
  list.innerHTML = '';
  if (!soon.length) list.innerHTML = '<li class="empty">擂台上暂时没有对手。</li>';
  soon.forEach(t => list.appendChild(taskRow(t, now)));
  const within3 = openTasks().filter(t => { const d = parseDue(t.due); return d && d - now < 3 * 86400000; }).length;
  $('#soonSum').textContent = within3 ? `${within3} 项在 3 天内到期或已过期` : '';
}

/* ---------- render: week ---------- */
let viewWeek = null; // null = follow the current week
function layoutLanes(list) {
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => {
    const ends = [];
    cluster.forEach(o => { let i = ends.findIndex(e => e <= o.a); if (i < 0) { i = ends.length; ends.push(o.b); } else ends[i] = o.b; o.lane = i; });
    cluster.forEach(o => { o.lanes = ends.length; out.push(o); });
    cluster = []; clusterEnd = -1;
  };
  list.map(c => ({ c, a: toMin(c.start), b: toMin(c.end) })).sort((x, y) => x.a - y.a).forEach(o => {
    if (cluster.length && o.a >= clusterEnd) flush();
    cluster.push(o); clusterEnd = Math.max(clusterEnd, o.b);
  });
  if (cluster.length) flush();
  return out;
}
function renderWeek() {
  const now = new Date(), cw = teachWeek(now), hasTerm = cw != null;
  const curW = hasTerm ? Math.max(1, cw) : null;
  const w = hasTerm ? (viewWeek == null ? curW : viewWeek) : null;
  $('#wkNav').hidden = !hasTerm;
  $('#wkHint').hidden = hasTerm;
  let mon = null;
  if (hasTerm) {
    mon = weekMonday(w);
    $('#wkLabel').innerHTML = `第<span class="num">${w}</span>周 <span class="muted num">${md(mon)}–${md(addDays(mon, 6))}</span>`;
    $('#wkBack').hidden = w === curW;
    $('#wkPrev').disabled = w <= 1;
  }
  const items = alive(S.courses).filter(c => validSpan(c) && activeInWeek(c, w));
  let start = S.settings.dayStart * 60, end = S.settings.dayEnd * 60;
  items.forEach(c => { start = Math.min(start, Math.floor(toMin(c.start) / 60) * 60); end = Math.max(end, Math.ceil(toMin(c.end) / 60) * 60); });
  const H = (end - start) * PX_WEEK;
  const grid = $('#weekGrid');
  grid.innerHTML = '';
  grid.style.setProperty('--h', H + 'px');
  grid.style.setProperty('--hr', (60 * PX_WEEK) + 'px');
  const todayKey = ymd(now);
  const isToday = d => (mon ? ymd(addDays(mon, d - 1)) === todayKey : d === isoDay(now));
  const dueByDay = {};
  if (mon) {
    openTasks().forEach(t => {
      const d = parseDue(t.due);
      if (!d) return;
      const idx = Math.round((startOfDay(d) - mon) / 86400000);
      if (idx >= 0 && idx < 7) (dueByDay[idx + 1] = dueByDay[idx + 1] || []).push(t);
    });
  }
  // weekends only take room when something happens on them
  const days = [1, 2, 3, 4, 5].concat([6, 7].filter(d => items.some(c => c.day === d) || (dueByDay[d] || []).length || isToday(d)));
  grid.style.gridTemplateColumns = `28px repeat(${days.length}, minmax(0, 1fr))`;
  mk(grid, 'div', 'wk-corner');
  for (const d of days) {
    const h = mk(grid, 'div', 'wk-h' + (isToday(d) ? ' today' : ''));
    h.innerHTML = `<b>${WD[d - 1]}</b>` + (mon ? `<span class="num">${md(addDays(mon, d - 1))}</span>` : '');
  }
  const axis = mk(grid, 'div', 'wk-axis');
  for (let m = start; m < end; m += 60) { const s = mk(axis, 'span', 'num'); s.style.top = ((m - start) * PX_WEEK) + 'px'; s.textContent = pad(m / 60); }
  for (const d of days) {
    const col = mk(grid, 'div', 'wk-col' + (isToday(d) ? ' today' : ''));
    layoutLanes(items.filter(c => c.day === d)).forEach(({ c, a, b, lane, lanes }) => {
      const el = mk(col, 'button', 'cb');
      el.type = 'button';
      el.style.top = ((a - start) * PX_WEEK) + 'px';
      el.style.height = Math.max(22, (b - a) * PX_WEEK - 1) + 'px';
      el.style.left = `calc(${(lane * 100 / lanes).toFixed(3)}% + 1px)`;
      el.style.width = `calc(${(100 / lanes).toFixed(3)}% - 2px)`;
      el.style.setProperty('--cc', colorFor(c.name));
      el.innerHTML = `<b>${esc(gridName(c))}</b>${c.place ? `<span>${esc(c.place)}</span>` : ''}` + shownFields(c).map(v => `<span>${esc(v)}</span>`).join('');
      el.setAttribute('aria-label', `周${WD[d - 1]} ${c.start} 到 ${c.end} ${c.name}${c.place ? '，' + c.place : ''}`);
      el.addEventListener('click', () => openCourseView(c.id));
    });
    let lastY = -100;
    (dueByDay[d] || []).sort(byDue).forEach(t => {
      const m = toMin(t.due.slice(11, 16));
      let y = Math.min(Math.max((m - start) * PX_WEEK, 9), H - 9);
      if (y < lastY + 18) y = lastY + 18;
      lastY = y;
      const el = mk(col, 'button', 'wk-due');
      el.type = 'button';
      el.style.top = y + 'px';
      el.innerHTML = `<i aria-hidden="true"></i>${esc(t.title)}`;
      el.setAttribute('aria-label', `截止 ${dueLabel(parseDue(t.due), now)}：${t.title}`);
      el.addEventListener('click', () => openTask(t.id));
    });
  }
  $('#weekEmpty').hidden = alive(S.courses).length > 0;
  const others = alive(S.others), inWeek = o => { const set = parseWeeks(o.weeks); return !!(w && set && set.has(w)); };
  const now8 = others.filter(o => inWeek(o) && o.kind !== '线上');
  $('#wkBanner').hidden = !now8.length;
  $('#wkBanner').textContent = now8.length ? '这周还有：' + now8.map(o => o.name + (o.kind === '实践' || o.kind === '实验' ? `（${o.kind}）` : '')).join('、') : '';
  $('#othersCard').hidden = !others.length;
  $('#othersList').innerHTML = others.map(o => `<li class="${inWeek(o) ? 'on' : ''}"><span>${esc(o.name)}${inWeek(o) ? '<em>本周</em>' : ''}</span><small>${esc(o.weeks ? o.weeks + ' 周' : '')}</small></li>`).join('');
}

/* ---------- render: tasks ---------- */
let taskFilter = 'open', taskSort = 'due';
function taskRow(t, now) {
  const due = parseDue(t.due), done = t.status === 'done';
  const li = document.createElement('li');
  li.className = 'task' + (done ? ' done' : (due ? ' ' + urgency(due, now) : ''));
  const cdText = due && !done ? countdown(due, now) : '';
  const tags = (t.course ? `<span>${esc(t.course)}</span>` : '') + `<span class="tag">${esc(t.type)}</span>` +
    (t.priority === 'high' ? '<span class="tag hi">高优先</span>' : t.priority === 'low' ? '<span class="tag">低优先</span>' : '') +
    (t.status === 'doing' ? '<span class="tag doing">进行中</span>' : '');
  li.innerHTML =
    '<span class="bar" aria-hidden="true"></span>' +
    `<button type="button" class="check" aria-pressed="${done}" aria-label="${done ? '标为未完成' : '标为完成'}：${esc(t.title)}"></button>` +
    `<button type="button" class="tbody"><span class="tt">${esc(t.title)}</span><span class="tm">${tags}</span></button>` +
    `<span class="cd">${cdText ? `<b>${esc(cdText)}</b>` : ''}${due ? `<small>${esc(dueLabel(due, now))}</small>` : '<small>无截止</small>'}</span>`;
  li.querySelector('.check').addEventListener('click', e => {
    if (done || matchMedia('(prefers-reduced-motion: reduce)').matches) { toggleDone(t.id); return; }
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', 'true');
    mk(li, 'span', 'ko').textContent = 'KO';
    setTimeout(() => shake(li, 1.4), 330);
    setTimeout(() => spark(btn, $('#race:not([hidden]) #raceChip') || $('.nav a[data-tab="today"]')), 380);
    setTimeout(() => toggleDone(t.id), 720);
  });
  li.querySelector('.tbody').addEventListener('click', () => openTask(t.id));
  return li;
}
function renderTasks() {
  const now = new Date();
  const open = openTasks().sort(taskSort === 'risk' ? byRisk(now) : byDue);
  const done = alive(S.tasks).filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  $$('#taskFilter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === taskFilter)));
  $$('#taskSort button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === taskSort)));
  $('#taskSort').hidden = taskFilter !== 'open';
  $('#taskFilter [data-f="open"] .n').textContent = open.length || '';
  $('#taskFilter [data-f="done"] .n').textContent = done.length || '';
  const routines = alive(S.routines), key = ymd(now);
  $('#taskFilter [data-f="daily"] .n').textContent = routines.length || '';
  $('#btnAddTask').textContent = taskFilter === 'daily' ? '添加每日' : '添加';
  const list = $('#taskList');
  list.innerHTML = '';
  if (taskFilter === 'daily') {
    list.innerHTML = routines.length ? '' : '<li class="empty">背单词、跑步、读文献这类每天或每周固定做的事放这里。没有截止时间，按天打卡，会算进排计划和赛况。</li>';
    routines.forEach(r => {
      const today = r.days.includes(isoDay(now)), on = !!r.done[key], n = streak(r, now);
      const li = mk(list, 'li', 'task routine' + (on ? ' done' : ''));
      li.innerHTML = '<span class="bar" aria-hidden="true"></span>' +
        `<button type="button" class="check" aria-pressed="${on}" ${today ? '' : 'disabled'} aria-label="${on ? '取消打卡' : '打卡'}：${esc(r.title)}"></button>` +
        `<button type="button" class="tbody"><span class="tt">${esc(r.title)}</span><span class="tm"><span>${daysText(r.days)}</span><span class="tag">${r.minutes} 分钟</span>${r.window !== 'any' ? `<span class="tag">${WINDOWS[r.window][2]}</span>` : ''}</span></button>` +
        `<span class="cd">${n ? `<b>${n}</b><small>连续天数</small>` : `<small>${today ? '今天还没做' : '今天不用做'}</small>`}</span>`;
      $('.check', li).addEventListener('click', () => toggleRoutine(r.id));
      $('.tbody', li).addEventListener('click', () => openRoutine(r.id));
    });
    $('#taskSum').textContent = routines.length ? `今天要做 ${routines.filter(r => r.days.includes(isoDay(now))).length} 项，已打卡 ${routines.filter(r => r.done[key]).length} 项` : '';
    return;
  }
  const items = taskFilter === 'open' ? open : done.slice(0, 200);
  if (!items.length) {
    list.innerHTML = taskFilter === 'open'
      ? '<li class="empty">擂台上没有对手了。有新作业就点“添加”，快到期的会标橙，24 小时内的会拉警戒条。</li>'
      : '<li class="empty">还没有 KO 过任何一项。</li>';
  }
  items.forEach((t, i) => {
    const li = list.appendChild(taskRow(t, now));
    if (taskFilter === 'open' && taskSort === 'risk' && i === 0) mk($('.tm', li), 'span', 'tag hi').textContent = '先做这个';
  });
  let over = 0, soon = 0;
  open.forEach(t => { const d = parseDue(t.due); if (!d) return; if (d < now) over++; else if (d - now < 86400000) soon++; });
  let sum = '';
  if (taskFilter === 'open' && open.length) {
    sum = `${open.length} 项未完成`;
    if (soon) sum += `，${soon} 项 24 小时内到期`;
    if (over) sum += `，${over} 项已过期`;
  }
  $('#taskSum').textContent = sum;
  const badge = $('#navBadge'), hot = over + soon;
  badge.hidden = !hot; badge.textContent = hot;
}
function toggleDone(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t) return;
  const now = new Date(), before = raceOn() ? raceState(now).L : 0;
  if (t.status === 'done') { t.status = 'todo'; t.doneAt = 0; } else { t.status = 'done'; t.doneAt = Date.now(); }
  touch(t);
  reconcilePlans();
  if (t.status !== 'done') {
    const nowMin = nowMinOf(now);
    plansOn(ymd(now)).forEach(b => { if (b.taskId === t.id && b.status === 'done' && toMin(b.end) > nowMin) { b.status = 'planned'; touch(b); } });
    afterProgress(''); return;
  }
  const gain = raceOn() ? raceState(new Date()).L - before : 0, due = parseDue(t.due), late = due && t.doneAt > due.getTime();
  afterProgress(!raceOn() ? 'KO！' : late ? `补上了，从${rival().name}那追回 ${gain.toFixed(1)} km` : gain > 0.01 ? `KO！甩开${rival().name} ${gain.toFixed(1)} km` : 'KO！');
}
function renderCourseNames() {
  const dl = $('#courseNames');
  dl.innerHTML = '';
  Array.from(new Set(alive(S.courses).map(c => c.name))).forEach(n => { const o = document.createElement('option'); o.value = n; dl.appendChild(o); });
}

/* ---------- render: me ---------- */
function fillHours(sel, lo, hi, v) {
  if (sel.options.length !== hi - lo + 1) {
    sel.innerHTML = '';
    for (let h = lo; h <= hi; h++) { const o = document.createElement('option'); o.value = String(h); o.textContent = pad(h) + ':00'; sel.appendChild(o); }
  }
  sel.value = String(v);
}
function renderMe() {
  const s = S.settings, act = document.activeElement;
  if (act !== $('#mNick')) $('#mNick').value = s.nick;
  if (act !== $('#mGoal')) $('#mGoal').value = s.goal;
  if (act !== $('#mRival')) $('#mRival').value = s.rival.name;
  if (act !== $('#mFinish')) $('#mFinish').value = s.race.finish;
  $('#mPath').value = s.path;
  $('#secRival').hidden = !raceOn();
  $('#mRivalDaily').checked = s.rival.daily;
  renderMemory();
  const ai = aiConfig();
  $('#mAiProvider').value = ai.provider;
  if (act !== $('#mAiKey')) $('#mAiKey').value = ai.key;
  if (act !== $('#mAiModel')) $('#mAiModel').value = ai.model;
  if (act !== $('#mAiBase')) $('#mAiBase').value = ai.base;
  $('#mAiHint').textContent = PROVIDERS[ai.provider].hint;
  if (act !== $('#mLatest')) $('#mLatest').value = fmtMin(Math.min(s.plan.latest, 1439));
  if (act !== $('#mMaxBlock')) $('#mMaxBlock').value = String(s.plan.maxBlock);
  [['#mLunchS', 0, 0], ['#mLunchE', 0, 1], ['#mDinnerS', 1, 0], ['#mDinnerE', 1, 1]].forEach(([id, i, j]) => { if (act !== $(id)) $(id).value = s.plan.meals[i][j]; });
  if (act !== $('#mTerm')) $('#mTerm').value = s.termStart;
  const tot = $('#mTotal');
  if (!tot.options.length) for (let i = 8; i <= 30; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = i + ' 周'; tot.appendChild(o); }
  tot.value = String(s.totalWeeks);
  const box0 = $('#mShow');
  if (!box0.children.length) {
    box0.innerHTML = SHOW_FIELDS.map(([k, label]) => `<label><input type="checkbox" data-k="${k}">${label}</label>`).join('');
    $$('input', box0).forEach(cb => cb.addEventListener('change', () => { S.settings.show[cb.dataset.k] = cb.checked; touch(S.settings); commit('settings'); }));
  }
  $$('input', box0).forEach(cb => { cb.checked = !!s.show[cb.dataset.k]; });
  const w = teachWeek(new Date());
  $('#mWeekInfo').textContent = w == null ? '还没设置。填第 1 周里的任意一天，或者直接告诉它本周是第几周。'
    : w === 0 ? `按当前设置，第 1 周从 ${ymd(termMonday())} 开始，现在还没开学。`
    : `按当前设置，第 1 周从 ${ymd(termMonday())} 开始，本周是第 ${w} 周（${w % 2 ? '单周' : '双周'}）。`;
  const sel = $('#mWeekSel');
  if (!sel.options.length) for (let i = 1; i <= 30; i++) { const o = document.createElement('option'); o.value = String(i); o.textContent = String(i); sel.appendChild(o); }
  if (act !== sel) sel.value = String(w && w > 0 ? Math.min(w, 30) : 1);
  const box = $('#mPeriods');
  if (!box.contains(act)) {
    box.innerHTML = '';
    s.periods.forEach((p, i) => {
      const row = mk(box, 'div', 'prow');
      row.innerHTML = `<span class="pn">第 ${i + 1} 节</span><input type="time" value="${p.start}" aria-label="第 ${i + 1} 节开始"><span>–</span><input type="time" value="${p.end}" aria-label="第 ${i + 1} 节结束"><button type="button" class="x" aria-label="删除第 ${i + 1} 节">×</button>`;
      const [a, b] = $$('input', row);
      const upd = () => {
        const sa = a.value.slice(0, 5), sb = b.value.slice(0, 5);
        if (!HM.test(sa) || !HM.test(sb) || toMin(sb) <= toMin(sa)) { toast('结束时间要晚于开始时间'); return; }
        s.periods[i] = { start: sa, end: sb }; touch(s); commit('settings');
      };
      a.addEventListener('change', upd); b.addEventListener('change', upd);
      $('.x', row).addEventListener('click', e => { e.currentTarget.blur(); s.periods.splice(i, 1); touch(s); commit('settings'); });
    });
    if (!s.periods.length) box.innerHTML = '<p class="help">还没有节次。</p>';
  }
  fillHours($('#mDayStart'), 5, 12, s.dayStart);
  fillHours($('#mDayEnd'), 16, 24, s.dayEnd);
  $('#mTheme').value = getTheme();
  $('#secNotify').hidden = !isNative;
  if (act !== $('#mLead')) $('#mLead').value = String(s.notifyLead);
  $('#mVer').textContent = VERSION;
  $('#mEnv').textContent = isNative ? '安卓 App' : '网页版';
}

function renderMemory() {
  const n = alive(S.memory).length, auto = habitsSummary();
  if ($('#mMemCount')) $('#mMemCount').textContent = n ? `${n} 条` : '还没有';
  if ($('#mMemPeek')) $('#mMemPeek').textContent = (auto.concat(alive(S.memory).slice(-2).map(m => m.text))).slice(0, 2).join('；') || '聊得越多，记得越多';
  const box = $('#memList');
  if (!box) return;
  box.innerHTML = auto.map(t => `<li class="auto"><span>${esc(t)}</span><small>自动</small></li>`).join('') +
    (alive(S.memory).slice().reverse().map(m => `<li><span>${esc(m.text)}</span><button type="button" class="x" data-m="${m.id}" aria-label="忘掉这条">×</button></li>`).join('') ||
    '<li class="empty">还没有。和小助手多聊聊，它会自己记下你的习惯。</li>');
  $$('[data-m]', box).forEach(b => b.addEventListener('click', () => { const m = S.memory.find(x => x.id === b.dataset.m); if (m) { m.deletedAt = Date.now(); touch(m); commit('settings'); } }));
}
function renderAll() { renderTitle(); renderToday(); renderWeek(); renderTasks(); renderCourseNames(); renderMe(); }

/* ---------- task dialog ---------- */
let editTaskId = null;
function openTask(id) {
  const t = id ? S.tasks.find(x => x.id === id && !x.deletedAt) : null;
  editTaskId = t ? t.id : null;
  $('#dtH').textContent = t ? '修改截止事项' : '添加截止事项';
  $('#tTitle').value = t ? t.title : '';
  $('#tCourse').value = t ? t.course : '';
  setSeg('#tType', t ? t.type : '作业');
  setSeg('#tPrio', t ? t.priority : 'mid');
  setSeg('#tStatus', t ? t.status : 'todo');
  $('#tEst').value = String(t ? t.estimate : 60);
  $('#tRemind').value = String(t ? t.remind : S.settings.notifyLead);
  const due = t && parseDue(t.due);
  $('#tDate').value = due ? ymd(due) : ymd(addDays(new Date(), 1));
  $('#tTime').value = due ? fmtHM(due) : '23:59';
  resetDel($('#tDel'), !!t);
  $('#tIcs').hidden = isNative || !t || !due;
  hideErr('#tErr');
  openDlg($('#dlgTask'));
  if (!t) setTimeout(() => $('#tTitle').focus(), 50);
}
function saveTask() {
  const title = $('#tTitle').value.trim();
  const date = $('#tDate').value, time = ($('#tTime').value || '23:59').slice(0, 5);
  if (!title) return showErr('#tErr', '写一下是什么事。');
  if (!parseYMD(date)) return showErr('#tErr', '选一个截止日期。');
  if (!HM.test(time)) return showErr('#tErr', '时间用 24 小时制，比如 23:59。');
  const status = segVal('#tStatus') || 'todo';
  const data = { title, course: $('#tCourse').value.trim(), type: segVal('#tType') || '作业', priority: segVal('#tPrio') || 'mid', status, due: date + 'T' + time, estimate: clampInt($('#tEst').value, 5, 600, 60), remind: clampInt($('#tRemind').value, 0, 10080, 60) };
  let t = editTaskId ? S.tasks.find(x => x.id === editTaskId) : null;
  if (t) {
    if (status === 'done' && t.status !== 'done') t.doneAt = Date.now();
    if (status !== 'done') t.doneAt = 0;
    Object.assign(t, data);
  } else {
    t = Object.assign({ id: newId(), createdAt: Date.now(), doneAt: status === 'done' ? Date.now() : 0, deletedAt: 0 }, data);
    S.tasks.push(t);
  }
  touch(t);
  commit('tasks');
  $('#dlgTask').close();
}
function taskICS(t) {
  const d = parseDue(t.due), s = new Date(d.getTime() - 30 * 60000);
  const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const z = new Date(), stamp = `${z.getUTCFullYear()}${pad(z.getUTCMonth() + 1)}${pad(z.getUTCDate())}T${pad(z.getUTCHours())}${pad(z.getUTCMinutes())}00Z`;
  const e = v => String(v).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//student-workbench//CN', 'BEGIN:VEVENT',
    `UID:${t.id}@student-workbench`, `DTSTAMP:${stamp}`, `DTSTART:${f(s)}`, `DTEND:${f(d)}`, `SUMMARY:截止：${e(t.title)}`,
    t.course ? `DESCRIPTION:${e(t.course)}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:截止提醒', `TRIGGER:-PT${Math.max(0, S.settings.notifyLead - 30)}M`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}

/* ---------- course view ---------- */
let viewCourseId = null;
function openCourseView(id) {
  const c = S.courses.find(x => x.id === id && !x.deletedAt);
  if (!c) return;
  viewCourseId = c.id;
  $('#cvHead').style.setProperty('--cc', colorFor(c.name));
  $('#cvH').textContent = c.name;
  const pt = periodText(c);
  $('#cvWhen').textContent = `周${WD[c.day - 1]}${pt ? '　' + pt : ''}　${c.start}–${c.end}`;
  $('#cvPlace').textContent = c.place || '没有填地点';
  const all = [['teacher', '老师'], ['weeks', '上课周'], ['periods', '节次'], ['kind', '类型'], ['nature', '必修/选修'], ['credit', '学分'], ['exam', '考核方式'], ['klass', '教学班'], ['comp', '教学班组成'], ['hours', '学时组成']];
  const val = k => (k === 'comp' || k === 'hours' || k === 'credit') ? (c.info[k] || '') : fieldValue(c, k);
  const dl = rows => rows.map(([k, label]) => `<dt>${label}</dt><dd>${esc(val(k))}</dd>`).join('');
  const shown = all.filter(([k]) => S.settings.show[k] && val(k)), rest = all.filter(([k]) => !S.settings.show[k] && val(k));
  $('#cvShown').innerHTML = dl(shown); $('#cvShown').hidden = !shown.length;
  $('#cvMore').innerHTML = dl(rest); $('#cvMoreBox').hidden = !rest.length; $('#cvMoreBox').open = false;
  openDlg($('#dlgCourseView'));
}

/* ---------- course dialog ---------- */
let editCourseId = null;
function fillPeriodSelects() {
  const P = S.settings.periods;
  ['#cP1', '#cP2'].forEach(sel => {
    const el = $(sel);
    el.innerHTML = '<option value="">—</option>' + P.map((p, i) => `<option value="${i + 1}">第 ${i + 1} 节</option>`).join('');
  });
}
function syncPeriodsFromTimes() {
  const P = S.settings.periods, a = $('#cStart').value.slice(0, 5), b = $('#cEnd').value.slice(0, 5);
  const i = P.findIndex(p => p.start === a), j = P.findIndex(p => p.end === b);
  $('#cP1').value = i >= 0 ? String(i + 1) : '';
  $('#cP2').value = j >= 0 && j >= i ? String(j + 1) : '';
}
function applyPeriods(changed) {
  const P = S.settings.periods;
  let p1 = +$('#cP1').value, p2 = +$('#cP2').value;
  if (changed === 1 && p1 && (!p2 || p2 < p1)) { p2 = Math.min(p1 + 1, P.length); $('#cP2').value = String(p2); }
  if (changed === 2 && p2 && (!p1 || p1 > p2)) { p1 = p2; $('#cP1').value = String(p1); }
  if (p1 && P[p1 - 1]) $('#cStart').value = P[p1 - 1].start;
  if (p2 && P[p2 - 1]) $('#cEnd').value = P[p2 - 1].end;
}
function openCourse(id) {
  const c = id ? S.courses.find(x => x.id === id && !x.deletedAt) : null;
  editCourseId = c ? c.id : null;
  fillPeriodSelects();
  $('#dcH').textContent = c ? '修改课程' : '添加课程';
  $('#cName').value = c ? c.name : '';
  $('#cShort').value = c ? c.short : '';
  $('#cDay').value = String(c ? c.day : (location.hash === '#week' ? isoDay(new Date()) : 1));
  const P = S.settings.periods;
  $('#cStart').value = c ? c.start : (P[0] ? P[0].start : '08:00');
  $('#cEnd').value = c ? c.end : (P[1] ? P[1].end : (P[0] ? P[0].end : '09:40'));
  $('#cPlace').value = c ? c.place : '';
  $('#cTeacher').value = c ? c.teacher : '';
  $('#cWeeks').value = c ? c.weeks : '';
  $('#cParity').value = c ? c.parity : 'all';
  syncPeriodsFromTimes();
  resetDel($('#cDel'), !!c);
  hideErr('#cErr');
  openDlg($('#dlgCourse'));
  if (!c) setTimeout(() => $('#cName').focus(), 50);
}
function saveCourse() {
  const name = $('#cName').value.trim();
  const start = ($('#cStart').value || '').slice(0, 5), end = ($('#cEnd').value || '').slice(0, 5);
  if (!name) return showErr('#cErr', '填一下课程名。');
  if (!HM.test(start) || !HM.test(end)) return showErr('#cErr', '选节次，或者直接填开始和结束时间。');
  if (toMin(end) <= toMin(start)) return showErr('#cErr', '结束时间要晚于开始时间。');
  const weeks = $('#cWeeks').value.trim();
  if (weeks && !parseWeeks(weeks)) return showErr('#cErr', '上课周这样写：1-16，或 1-8,10-16。');
  const data = { name, short: $('#cShort').value.trim(), day: clampInt($('#cDay').value, 1, 7, 1), start, end, place: $('#cPlace').value.trim(), teacher: $('#cTeacher').value.trim(), weeks, parity: $('#cParity').value };
  let c = editCourseId ? S.courses.find(x => x.id === editCourseId) : null;
  if (c) Object.assign(c, data);
  else { c = Object.assign({ id: newId(), deletedAt: 0 }, data); S.courses.push(c); }
  touch(c);
  commit('courses');
  $('#dlgCourse').close();
}

/* ---------- CSV import (WakeUp template) ---------- */
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
function parseDay(s) {
  s = String(s || '').trim();
  if (/^[1-7]$/.test(s)) return +s;
  const m = s.match(/[一二三四五六日天]/);
  return m ? '一二三四五六日'.indexOf(m[0] === '天' ? '日' : m[0]) + 1 : 0;
}
function parseWeekSpec(s) {
  s = String(s || '').trim();
  const parity = /单/.test(s) ? 'odd' : /双/.test(s) ? 'even' : 'all';
  const w = s.replace(/[单双周第\s()（）]/g, '').replace(/[，、;；]/g, ',').replace(/[–—~～至]/g, '-').replace(/^,+|,+$/g, '');
  return { weeks: parseWeeks(w) ? w : '', parity };
}
function parseWakeupCSV(text) {
  const rows = parseCSV(text), items = [], errors = [];
  if (!rows.length) return { items, errors: ['文件里没有内容。'] };
  let idx = { name: 0, day: 1, p1: 2, p2: 3, teacher: 4, place: 5, weeks: 6 }, first = 0;
  const head = rows[0].map(x => x.trim());
  if (head.some(h => /课程/.test(h))) {
    first = 1;
    const find = re => head.findIndex(h => re.test(h));
    idx = { name: find(/课程/), day: find(/星期|周几/), p1: find(/开始/), p2: find(/结束/), teacher: find(/老师|教师/), place: find(/地点|教室/), weeks: find(/周数|周次/) };
  }
  const P = S.settings.periods;
  for (let i = first; i < rows.length; i++) {
    const r = rows[i], line = i + 1;
    const g = k => (idx[k] >= 0 && r[idx[k]] != null ? String(r[idx[k]]).trim() : '');
    const name = g('name');
    if (!name) continue;
    const day = parseDay(g('day')), p1 = parseInt(g('p1'), 10), p2 = parseInt(g('p2') || g('p1'), 10);
    if (!day) { errors.push(`第 ${line} 行「${name}」：星期没看懂`); continue; }
    if (!(p1 >= 1) || !(p2 >= p1)) { errors.push(`第 ${line} 行「${name}」：节数不对`); continue; }
    const a = P[p1 - 1], b = P[p2 - 1];
    if (!a || !b) { errors.push(`第 ${line} 行「${name}」：第 ${!a ? p1 : p2} 节还没有时间，先到“我的 → 作息表”补上`); continue; }
    const ws = parseWeekSpec(g('weeks'));
    items.push({ name, day, start: a.start, end: b.end, place: g('place'), teacher: g('teacher'), weeks: ws.weeks, parity: ws.parity });
  }
  return { items, errors };
}
const KIND = { '★': '讲课', '○': '实验', '●': '实践', '◇': '上机', '◆': '讨论' };
async function loadPdfJs() {
  const lib = await import(new URL('vendor/pdf.min.js', location.href).href);
  lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', location.href).href;
  return lib;
}
async function pdfPages(file) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), cMapUrl: new URL('vendor/cmaps/', location.href).href, cMapPacked: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
    pages.push(tc.items.filter(it => it.str && it.str.trim()).map(it => {
      const t = lib.Util.transform(vp.transform, it.transform);
      return { x: t[4], y: t[5], w: it.width, s: it.str };
    }));
  }
  return pages;
}
// Days come from the 星期 column a text run sits in; periods, weeks and room come from the text itself.
function parseTimetablePdf(pages) {
  const heads = [];
  pages.forEach((items, pi) => items.forEach(it => {
    const m = /^星期([一二三四五六日天])$/.exec(it.s.trim());
    if (m) heads.push({ day: '一二三四五六日'.indexOf(m[1] === '天' ? '日' : m[1]) + 1, cx: it.x + it.w / 2, y: it.y, pi });
  }));
  if (heads.length < 5) return { items: [], others: [], errors: ['没找到“星期一…星期日”表头，这份 PDF 可能不是教务系统导出的课表。'] };
  heads.sort((a, b) => a.cx - b.cx);
  const step = (heads[heads.length - 1].cx - heads[0].cx) / (heads.length - 1);
  const headPage = heads[0].pi, headY = Math.max(...heads.map(h => h.y));
  const cols = {}, foot = [];
  pages.forEach((items, pi) => {
    const marks = items.filter(it => /^(实践课程|其他课程|备注|★\s*[:：])/.test(it.s.trim()));
    const footTop = marks.length ? Math.min(...marks.map(it => it.y)) - 2 : Infinity;
    items.forEach(it => {
      if (pi < headPage || (pi === headPage && it.y <= headY + 4)) return;
      if (it.y >= footTop) { foot.push(Object.assign({ pi }, it)); return; }
      const cx = it.x + it.w / 2, h = heads.find(hd => Math.abs(cx - hd.cx) < step / 2);
      if (h) (cols[h.day] = cols[h.day] || []).push(Object.assign({ pi }, it));
    });
  });
  const join = list => list.sort((a, b) => a.pi - b.pi || a.y - b.y || a.x - b.x).map(it => it.s).join('').replace(/\s+/g, '');
  const RE = /(?<name>[^/]*?)(?<kind>[★○●◇◆])\((?<p1>\d+)(?:-(?<p2>\d+))?节\)(?<weeks>[^/]+)\/场地:(?<place>[^/]*)\/教师:(?<teacher>[^/]*)\/教学班:(?<klass>[^/]*)\/教学班组成:(?<comp>[^/]*)\/课程性质简称:(?<nature>[^/]*)\/课程标记:[^/]*\/考核方式:(?<exam>[^/]*)\/选课备注:[^/]*\/课程学时组成:(?<hours>[^/]*)\/周学时:[^/]*\/总学时:[^/]*\/学分:(?<credit>\d+(?:\.\d+)?)/g;
  const P = S.settings.periods, items = [], errors = [];
  let maxWeek = 0;
  Object.keys(cols).sort().forEach(d => {
    const text = join(cols[d]);
    let used = 0;
    for (const m of text.matchAll(RE)) {
      used += m[0].length;
      const g = m.groups, p1 = +g.p1, p2 = +(g.p2 || g.p1), name = g.name.trim();
      const ws = parseWeekSpec(g.weeks), set = parseWeeks(ws.weeks);
      if (set) maxWeek = Math.max(maxWeek, ...set);
      const a = P[p1 - 1], b = P[p2 - 1];
      if (!a || !b) { errors.push(`周${WD[d - 1]}「${name}」：第 ${!a ? p1 : p2} 节还没有时间，先到“我的 → 作息表”补上`); continue; }
      items.push({
        name, day: +d, start: a.start, end: b.end, place: g.place.replace(/\(多\)$/, ''), teacher: g.teacher, weeks: ws.weeks, parity: ws.parity,
        info: { kind: KIND[g.kind] || '', nature: g.nature, exam: g.exam === '未安排' ? '' : g.exam, credit: g.credit, klass: g.klass, comp: g.comp, hours: g.hours, p: p1 === p2 ? String(p1) : `${p1}-${p2}` }
      });
    }
    if (text.length - used > 12) errors.push(`周${WD[d - 1]}有一段文字没认出来，导入后请核对这一天。`);
  });
  const others = [];
  const ft = join(foot);
  for (const m of ft.matchAll(/(?:实践课程：|其他课程：)?(?<name>[^;；★○●◇◆]+?)(?<kind>[★○●◇◆])(?<who>[^;；()（）]*)\(共\d+周\)\/(?<weeks>[\d\-,，]+)周(?:\/(?<note>[^;；]*))?[;；]/g)) {
    const g = m.groups, name = g.name.replace(/^(实践课程|其他课程)[:：]/, '').trim();
    const set = parseWeeks(g.weeks);
    if (set) maxWeek = Math.max(maxWeek, ...set);
    others.push({ name, kind: name.startsWith('【') ? '线上' : (KIND[g.kind] || ''), who: g.who, weeks: g.weeks.replace(/，/g, ','), note: g.note && g.note !== '无' ? g.note : '' });
  }
  if (!items.length && !errors.length) errors.push('没有识别出课程。');
  return { items, others, errors, maxWeek };
}

let pendingImport = { items: [], others: [], maxWeek: 0 };
function showImportPreview(res) {
  pendingImport = { items: res.items, others: res.others || [], maxWeek: res.maxWeek || 0 };
  const no = res.others && res.others.length ? `，另有 ${res.others.length} 项不排课的安排` : '';
  $('#impSum').textContent = res.items.length
    ? `识别出 ${res.items.length} 个上课时段${no}${res.errors.length ? `，${res.errors.length} 处需要注意` : ''}。确认无误再导入。`
    : '没有可以导入的课程。';
  $('#impErr').innerHTML = res.errors.map(e => `<li>${esc(e)}</li>`).join('');
  let html = '', lastDay = 0;
  res.items.slice().sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start)).forEach(c => {
    if (c.day !== lastDay) { html += `<li class="grp">周${WD[c.day - 1]}</li>`; lastDay = c.day; }
    html += `<li><span class="num">${c.start}–${c.end}</span>　${esc(c.name)}${c.place ? '　' + esc(c.place) : ''}<br><small class="muted">${esc(weekText(c))}</small></li>`;
  });
  $('#impList').innerHTML = html;
  $('#impOthers').innerHTML = (res.others || []).length ? '<li class="grp">不排课的安排</li>' + res.others.map(o => `<li>${esc(o.name)}　<small class="muted">${esc(o.weeks)} 周</small></li>`).join('') : '';
  $('#impAppend').disabled = $('#impReplace').disabled = !res.items.length && !(res.others || []).length;
  openDlg($('#dlgImport'));
}
function doImport(replace) {
  const t = Date.now(), { items, others, maxWeek } = pendingImport;
  if (replace) {
    S.courses.forEach(c => { if (!c.deletedAt) { c.deletedAt = t; c.updatedAt = t; } });
    if (others.length) S.others.forEach(o => { if (!o.deletedAt) { o.deletedAt = t; o.updatedAt = t; } });
  }
  items.forEach(c => S.courses.push(normCourse(Object.assign({ id: newId(), updatedAt: t }, c))));
  others.forEach(o => S.others.push(normOther(Object.assign({ id: newId(), updatedAt: t }, o))));
  if (maxWeek >= 8 && maxWeek <= 30 && maxWeek > S.settings.totalWeeks) { S.settings.totalWeeks = maxWeek; touch(S.settings); }
  pendingImport = { items: [], others: [], maxWeek: 0 };
  viewWeek = null;
  commit('courses');
  $('#dlgImport').close();
  toast(`已导入 ${items.length} 个上课时段${others.length ? `和 ${others.length} 项安排` : ''}`);
}
const CSV_TEMPLATE = '\uFEFF课程名称,星期,开始节数,结束节数,老师,地点,周数\r\n高等数学,1,1,2,张老师,厚学楼A201,1-16\r\n大学英语,3,3,4,,综合楼205,1-15单\r\n';

/* ---------- backup ---------- */
function backupJSON() {
  return JSON.stringify({ app: 'student-workbench', format: 1, appVersion: VERSION, exportedAt: new Date().toISOString(), data: S });
}
function mergeState(incoming) {
  const inc = normalizeState(incoming), res = { add: 0, upd: 0, settings: false };
  ['courses', 'tasks', 'others', 'plans', 'routines', 'busy', 'memory'].forEach(k => {
    const map = new Map(S[k].map(x => [x.id, x]));
    inc[k].forEach(r => {
      const cur = map.get(r.id);
      if (!cur) { S[k].push(r); map.set(r.id, r); res.add++; return; }
      const both = k === 'routines' ? Object.assign({}, cur.done, r.done) : null; // check-ins from both devices count
      if (r.updatedAt > cur.updatedAt) { Object.assign(cur, r); res.upd++; }
      if (both) cur.done = both;
    });
  });
  if (inc.settings.updatedAt > S.settings.updatedAt) { S.settings = inc.settings; res.settings = true; }
  return res;
}
async function importBackupFile(file) {
  let o;
  try { o = JSON.parse(await readTextSmart(file)); } catch (e) { toast('这个文件不是有效的备份'); return; }
  if (!o || o.app !== 'student-workbench' || !o.data) { toast('这个文件不是学生工作台的备份'); return; }
  const r = mergeState(o.data);
  purgeTombstones();
  viewWeek = null;
  commit('tasks');
  toast(r.add || r.upd || r.settings ? `已合并：新增 ${r.add} 条，更新 ${r.upd} 条${r.settings ? '，设置已更新' : ''}` : '没有需要合并的新内容');
}
async function autoBackup() {
  const FS = plugin('Filesystem');
  if (!FS || (!alive(S.courses).length && !alive(S.tasks).length)) return;
  const today = ymd(new Date());
  try { if (localStorage.getItem(LS_AUTOBAK) === today) return; } catch (e) { /* ignore */ }
  const dir = '学生工作台/自动备份';
  try {
    await FS.writeFile({ path: `${dir}/${today}.json`, data: backupJSON(), directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    const ls = await FS.readdir({ path: dir, directory: 'DOCUMENTS' });
    const files = arr(ls && ls.files).map(f => (typeof f === 'string' ? f : f.name)).filter(n => /\.json$/.test(n)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 7))) await FS.deleteFile({ path: `${dir}/${f}`, directory: 'DOCUMENTS' });
    try { localStorage.setItem(LS_AUTOBAK, today); } catch (e) { /* ignore */ }
  } catch (e) { console.warn('autoBackup', e); }
}

/* ---------- native plugins: the app ships Capacitor's runtime and plugin bridges in vendor/cap ---------- */
async function loadNativePlugins() {
  if (!isNative || (cap.Plugins && cap.Plugins.LocalNotifications)) return;
  const load = src => new Promise(res => {
    const el = document.createElement('script');
    el.src = src; el.onload = () => res(true); el.onerror = () => res(false);
    document.head.appendChild(el);
  });
  if (!(await load('vendor/cap/core.js'))) return;
  for (const f of ['local-notifications', 'filesystem', 'share', 'speech']) await load(`vendor/cap/${f}.js`);
  if (cap.registerPlugin && !cap.Plugins.WorkbenchSettings) { try { cap.registerPlugin('WorkbenchSettings'); } catch (e) { /* not in this build */ } }
}

/* ---------- reminders (Android app only) ---------- */
let notifTimer = null;
function scheduleNotifSync(ask) {
  if (!plugin('LocalNotifications')) return;
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => syncNotifications(ask), 800);
}
let channelReady = false;
async function ensureChannel(LN) {
  if (channelReady || typeof LN.createChannel !== 'function') return;
  try {
    await LN.createChannel({ id: 'deadline3', name: '截止提醒（悬浮）', description: '作业截止前弹出的悬浮提醒', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#F2552C' });
    if (typeof LN.registerActionTypes === 'function') await LN.registerActionTypes({ types: [{ id: 'DEADLINE', actions: [{ id: 'start', title: '现在开始' }, { id: 'snooze', title: '10 分钟后再提醒' }] }] });
    if (typeof LN.addListener === 'function') LN.addListener('localNotificationActionPerformed', ev => onNotifAction(ev));
    channelReady = true;
  } catch (e) { console.warn('channel', e); }
}
function nid(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) | 0; return (Math.abs(h) % 2000000000) + 1; }
async function syncNotifications(ask) {
  const LN = plugin('LocalNotifications');
  if (!LN) return;
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') {
      if (!ask) { $('#mNotifyInfo').textContent = '还没有通知权限，添加一项待办时会请求。'; return; }
      p = await LN.requestPermissions();
      if (p.display !== 'granted') { $('#mNotifyInfo').textContent = '通知权限被拒绝，可以在系统设置里给“学生工作台”打开通知。'; return; }
    }
    await ensureChannel(LN);
    const pend = await LN.getPending();
    const ids = arr(pend && pend.notifications).filter(n => n.id !== TEST_ID).map(n => ({ id: n.id }));
    if (ids.length) await LN.cancel({ notifications: ids });
    const now = new Date(), list = [];
    openTasks().forEach(t => {
      const d = parseDue(t.due);
      if (!d || !t.remind) return;
      const at = d.getTime() - t.remind * 60000;
      if (at <= now.getTime()) return;
      list.push({ id: nid(t.id), channelId: 'deadline3', actionTypeId: 'DEADLINE', extra: { taskId: t.id }, title: '⏰ 截止提醒：' + t.title, body: `${dueLabel(d, now)} 截止${t.course ? '，' + t.course : ''}`, schedule: { at: new Date(at), allowWhileIdle: true } });
    });
    list.sort((a, b) => a.schedule.at - b.schedule.at);
    if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
    $('#mNotifyInfo').textContent = list.length ? `已安排 ${Math.min(list.length, 60)} 条提醒。` : '目前没有需要提醒的事项。';
  } catch (e) { console.warn('notifications', e); $('#mNotifyInfo').textContent = '安排提醒时出错：' + (e && e.message ? e.message : e); }
}
function onNotifAction(ev) {
  const id = ev && ev.notification && ev.notification.extra && ev.notification.extra.taskId, t = id && S.tasks.find(x => x.id === id && !x.deletedAt);
  if (!t) return;
  const LN = plugin('LocalNotifications');
  if (ev.actionId === 'snooze' && LN) {
    LN.schedule({ notifications: [{ id: nid(t.id + 'snooze'), channelId: 'deadline3', actionTypeId: 'DEADLINE', extra: { taskId: t.id }, title: '⏰ 再提醒一次：' + t.title, body: `${dueLabel(parseDue(t.due), new Date())} 截止`, schedule: { at: new Date(Date.now() + 600000), allowWhileIdle: true } }] }).catch(() => {});
    return;
  }
  location.hash = '#today';
  const it = suggestNow(120, new Date()).find(x => x.ref === t.id) || { ref: t.id, kind: 'task', title: t.title, len: Math.min(60, remainingMin(t) || 30), date: ymd(new Date()) };
  setTimeout(() => startNow(it), 300);
}
// reminder check-up: each thing that decides whether a reminder shows outside the app, with a button to fix it
async function renderNotifyDiag() {
  const box = $('#mDiag');
  if (!isNative) return;
  const LN = plugin('LocalNotifications'), WS = plugin('WorkbenchSettings');
  if (!LN) { box.innerHTML = '<li class="bad"><span>通知组件</span><b>没加载上，把这句发给 Claude</b></li>'; $('#mTestNotify').disabled = true; return; }
  $('#mTestNotify').disabled = false;
  let st = {}, perm = 'prompt', pending = 0;
  try { perm = (await LN.checkPermissions()).display; } catch (e) { /* ignore */ }
  try { if (WS) st = await WS.status(); } catch (e) { st = {}; }
  try { pending = arr((await LN.getPending()).notifications).filter(n => n.id !== TEST_ID).length; } catch (e) { /* ignore */ }
  const row = (label, ok, text, fix, fixText) => `<li class="${ok ? 'ok' : 'bad'}"><span>${label}</span><b>${text}</b>${fix ? `<button type="button" class="btn chip" data-fix="${fix}">${fixText || '去打开'}</button>` : ''}</li>`;
  box.innerHTML =
    row('通知权限', perm === 'granted', perm === 'granted' ? '已允许' : '未允许', perm === 'granted' ? '' : 'perm', '去允许') +
    (WS ? row('悬浮横幅', true, '在通道设置里打开“横幅/悬浮”', 'channel', '去设置') : '') +
    (WS ? row('后台运行', !!st.ignoringBattery, st.ignoringBattery ? '已允许' : '被省电限制，关掉应用后会收不到', st.ignoringBattery ? '' : 'battery', '去允许') : '') +
    (WS ? row('自启动', true, '国产系统要单独打开', 'autostart', '去设置') : '') +
    (WS && /xiaomi|redmi|poco/i.test(st.brand || '') ? row('省电策略', true, '设成“无限制”', 'saver', '去设置') + '<li class="tip">小米还要：最近任务里按住学生工作台，点小锁锁定；通知设置里打开“悬浮通知”和“锁屏通知”。</li>' : '') +
    (WS && st.exactAlarms === false ? row('准时提醒', false, '未允许，可能会晚到', 'exact', '去允许') : '') +
    row('已安排', true, `${pending} 条`);
  $$('[data-fix]', box).forEach(b => b.addEventListener('click', async () => {
    try {
      const f = b.dataset.fix;
      if (f === 'perm') { const r = await LN.requestPermissions(); if (r.display !== 'granted' && WS) await WS.openNotifications(); else scheduleNotifSync(false); }
      else if (f === 'channel' && WS) { await ensureChannel(LN); await WS.openChannel({ channel: 'deadline3' }); }
      else if (f === 'battery' && WS) await WS.requestIgnoreBattery();
      else if (f === 'autostart' && WS) await WS.openAutoStart();
      else if (f === 'saver' && WS) await WS.openBatterySaver();
      else if (f === 'exact' && WS) await WS.openExactAlarms();
    } catch (e) { console.warn('fix', e); }
    setTimeout(renderNotifyDiag, 1200);
  }));
}
async function testNotify() {
  const LN = plugin('LocalNotifications');
  if (!LN) { toast('通知组件没加载上'); return; }
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { toast('没有通知权限，先点“去允许”'); renderNotifyDiag(); return; }
    await ensureChannel(LN);
    await LN.schedule({ notifications: [{ id: TEST_ID, channelId: 'deadline3', title: '测试提醒', body: '看到这条，截止提醒就能正常弹出', schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
    toast('10 秒后看通知，可以先回到桌面');
  } catch (e) { toast('测试提醒失败：' + (e && e.message ? e.message : e)); }
}

/* ---------- theme ---------- */
function getTheme() { try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; } }
function setTheme(t) {
  try { localStorage.setItem(LS_THEME, t); } catch (e) { /* ignore */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

/* ---------- routing ---------- */
const TABS = ['today', 'week', 'ai', 'tasks', 'me'];
let lastTab = '';
function route() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  const dir = lastTab ? Math.sign(TABS.indexOf(tab) - TABS.indexOf(lastTab)) : 0;
  TABS.forEach(t => $('#view-' + t).classList.toggle('on', t === tab));
  if (lastTab !== tab) panTo($('#view-' + tab), dir);
  $$('.nav a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (tab === 'week') viewWeek = null;
  renderAll();
  if (tab === 'me') renderNotifyDiag();
  if (tab === 'ai') { sizeChat(); renderChat(); }
  requestAnimationFrame(movePill);
  if (lastTab === 'ai' && tab !== 'ai') extractMemory(true);
  lastTab = tab;
  window.scrollTo(0, 0);
  if (tab === 'ai') requestAnimationFrame(() => { sizeChat(); scrollChat(); });
}
function sizeChat() {
  const v = $('#view-ai');
  if (!v.classList.contains('on')) return;
  const nav = $('.nav').getBoundingClientRect(), top = v.getBoundingClientRect().top;
  const bottom = innerWidth >= 900 ? innerHeight - 16 : Math.min(innerHeight, nav.top) - 10;
  v.style.height = Math.max(320, bottom - top) + 'px';
}
function scrollChat() { const box = $('#chatList'); if (box) box.scrollTop = box.scrollHeight; }

/* ---------- wiring ---------- */
function wire() {
  initDialogs();
  window.addEventListener('hashchange', route);

  $('#btnQuickTask').addEventListener('click', () => openTask(null));
  $('#btnAddTask').addEventListener('click', () => (taskFilter === 'daily' ? openRoutine(null) : openTask(null)));
  $('#tSave').addEventListener('click', saveTask);
  $('#tTitle').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) saveTask(); });
  ['#tType', '#tPrio', '#tStatus'].forEach(sel => $$(sel + ' button').forEach(b => b.addEventListener('click', () => setSeg(sel, b.dataset.v))));
  $('#tDel').addEventListener('click', e => armDelete(e.currentTarget, () => {
    const t = S.tasks.find(x => x.id === editTaskId);
    if (t) { t.deletedAt = Date.now(); touch(t); }
    commit('tasks'); $('#dlgTask').close();
  }));
  $('#tIcs').addEventListener('click', () => {
    const t = S.tasks.find(x => x.id === editTaskId);
    if (t && parseDue(t.due)) saveFile(`截止-${t.title.slice(0, 20)}.ics`, taskICS(t), 'text/calendar');
  });
  $$('#taskFilter button').forEach(b => b.addEventListener('click', () => { taskFilter = b.dataset.f; renderTasks(); }));

  $('#btnAddCourse').addEventListener('click', () => openCourse(null));
  $('#cSave').addEventListener('click', saveCourse);
  $('#cP1').addEventListener('change', () => applyPeriods(1));
  $('#cP2').addEventListener('change', () => applyPeriods(2));
  $('#cStart').addEventListener('change', syncPeriodsFromTimes);
  $('#cEnd').addEventListener('change', syncPeriodsFromTimes);
  $('#cDel').addEventListener('click', e => armDelete(e.currentTarget, () => {
    const c = S.courses.find(x => x.id === editCourseId);
    if (c) { c.deletedAt = Date.now(); touch(c); }
    commit('courses'); $('#dlgCourse').close();
  }));

  const cur = () => Math.max(1, teachWeek(new Date()) || 1);
  $('#wkPrev').addEventListener('click', () => { viewWeek = Math.max(1, (viewWeek == null ? cur() : viewWeek) - 1); renderWeek(); });
  $('#wkNext').addEventListener('click', () => { viewWeek = Math.min(60, (viewWeek == null ? cur() : viewWeek) + 1); renderWeek(); });
  $('#wkBack').addEventListener('click', () => { viewWeek = null; renderWeek(); });
  let sx = 0, sy = 0, st = 0;
  const grid = $('#weekGrid');
  grid.addEventListener('touchstart', e => { const p = e.changedTouches[0]; sx = p.clientX; sy = p.clientY; st = Date.now(); }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (teachWeek(new Date()) == null) return;
    const p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45 && Date.now() - st < 600) $(dx < 0 ? '#wkNext' : '#wkPrev').click();
  }, { passive: true });

  $('#btnImport').addEventListener('click', () => openDlg($('#dlgImportMenu')));
  $('#imPdf').addEventListener('click', () => { $('#dlgImportMenu').close(); $('#filePdf').click(); });
  $('#imCsv').addEventListener('click', () => { $('#dlgImportMenu').close(); $('#fileCsv').click(); });
  $('#imTpl').addEventListener('click', () => saveFile('课表模板.csv', CSV_TEMPLATE, 'text/csv'));
  $('#filePdf').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    toast('正在读取课表…');
    try { showImportPreview(parseTimetablePdf(await pdfPages(f))); $('#toast').hidden = true; }
    catch (err) { console.warn('pdf', err); toast('这份 PDF 读不出来，换一份教务系统导出的试试'); }
  });
  $('#cvEdit').addEventListener('click', () => { const id = viewCourseId; $('#dlgCourseView').close(); setTimeout(() => openCourse(id), 120); });
  $('#fileCsv').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    showImportPreview(parseWakeupCSV(await readTextSmart(f)));
  });
  $('#impAppend').addEventListener('click', () => doImport(false));
  $('#impReplace').addEventListener('click', () => doImport(true));
  $('#fileBak').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importBackupFile(f);
  });

  const setS = (k, v) => { S.settings[k] = v; touch(S.settings); commit('settings'); };
  $('#mNick').addEventListener('change', e => setS('nick', e.target.value.trim().slice(0, 12)));
  $('#mGoal').addEventListener('change', e => setS('goal', e.target.value.trim().slice(0, 16)));
  $('#mTotal').addEventListener('change', e => setS('totalWeeks', clampInt(e.target.value, 8, 30, 18)));
  $('#mRival').addEventListener('change', e => { S.settings.rival.name = e.target.value.trim().slice(0, 8) || '卷王'; touch(S.settings); commit('settings'); });
  $('#mFinish').addEventListener('change', e => { if (parseYMD(e.target.value)) { S.settings.race.finish = e.target.value; touch(S.settings); commit('settings'); } });
  $('#mPath').addEventListener('change', e => setS('path', e.target.value === '考研' ? '考研' : '保研'));
  $('#chatMic').addEventListener('click', voiceInput);
  $('#dbSave').addEventListener('click', () => {
    const b = S.plans.find(x => x.id === blockId), a = toMin($('#dbStart').value), e = toMin($('#dbEnd').value), title = $('#dbTitle').value.trim();
    if (!b) return;
    if (!title) { toast('写个名字'); return; }
    if (a == null || e == null || e <= a) { toast('结束时间要晚于开始时间'); return; }
    if (b.status === 'done') { renameBlock(b, title); touch(b); commit('plans'); $('#dlgBlock').close(); return; }
    if (setBlockTime(blockId, a, e - a, title)) $('#dlgBlock').close();
  });
  $('#drmStart').addEventListener('click', () => {
    const t = remindTask; $('#dlgRemind').close();
    if (!t) return;
    const it = suggestNow(120, new Date()).find(x => x.ref === t.id) || { ref: t.id, kind: 'task', title: t.title, len: Math.min(60, remainingMin(t) || 30), date: ymd(new Date()) };
    startNow(it);
  });
  $('#mTerm').addEventListener('change', e => { if (parseYMD(e.target.value) || !e.target.value) { viewWeek = null; setS('termStart', e.target.value); } });
  $('#mWeekFix').addEventListener('click', () => {
    const n = clampInt($('#mWeekSel').value, 1, 30, 1);
    viewWeek = null;
    setS('termStart', ymd(addDays(mondayOf(new Date()), -(n - 1) * 7)));
    toast(`已校正：本周是第 ${n} 周`);
  });
  $('#mAddPeriod').addEventListener('click', () => {
    const P = S.settings.periods, last = P[P.length - 1];
    const a = last ? Math.min(toMin(last.end) + 10, 23 * 60) : 8 * 60;
    P.push({ start: fmtMin(a), end: fmtMin(Math.min(a + 45, 23 * 60 + 59)) });
    touch(S.settings); commit('settings');
  });
  $('#mDayStart').addEventListener('change', e => setS('dayStart', clampInt(e.target.value, 0, 12, 8)));
  $('#mDayEnd').addEventListener('change', e => setS('dayEnd', clampInt(e.target.value, 13, 24, 22)));
  $('#mTheme').addEventListener('change', e => setTheme(e.target.value));
  $('#mLead').addEventListener('change', e => setS('notifyLead', clampInt(e.target.value, 0, 10080, 60)));
  $('#mTestNotify').addEventListener('click', testNotify);
  // AI model
  const setAi = patch => { saveAiConfig(Object.assign(aiConfig(), patch)); $('#mAiStatus').textContent = ''; renderMe(); renderPlanHints(new Date()); };
  $('#mAiProvider').addEventListener('change', e => { const p = e.target.value; setAi({ provider: p, base: PROVIDERS[p].base, model: PROVIDERS[p].model }); });
  $('#mAiKey').addEventListener('change', e => setAi({ key: e.target.value.trim() }));
  $('#mAiModel').addEventListener('change', e => setAi({ model: e.target.value.trim() }));
  $('#mAiBase').addEventListener('change', e => setAi({ base: e.target.value.trim() }));
  $('#mAiTest').addEventListener('click', async () => {
    const st = $('#mAiStatus'), b = $('#mAiTest');
    b.disabled = true; st.textContent = '正在连接…';
    try { await callAI([{ role: 'user', content: '只回复两个字：连上' }], { maxTokens: 16 }); st.textContent = '连上了'; refreshRivalLine(); }
    catch (e) { st.textContent = e.message || String(e); }
    b.disabled = false;
  });
  // planner prefs
  const setPlan = (k, v) => { S.settings.plan[k] = v; touch(S.settings); commit('settings'); };
  $('#mLatest').addEventListener('change', e => { const m = toMin(e.target.value); if (m != null) setPlan('latest', Math.max(18 * 60, m === 1439 ? 1440 : m)); });
  $('#mMaxBlock').addEventListener('change', e => setPlan('maxBlock', clampInt(e.target.value, 15, 240, 90)));
  [['#mLunchS', 0, 0], ['#mLunchE', 0, 1], ['#mDinnerS', 1, 0], ['#mDinnerE', 1, 1]].forEach(([id, i, j]) => $(id).addEventListener('change', e => {
    if (!HM.test(e.target.value.slice(0, 5))) return;
    const m = S.settings.plan.meals.map(x => x.slice()); m[i][j] = e.target.value.slice(0, 5);
    if (toMin(m[i][1]) <= toMin(m[i][0])) { toast('结束要晚于开始'); renderMe(); return; }
    setPlan('meals', m);
  }));
  $('#mMemOpen').addEventListener('click', () => { renderMemory(); openDlg($('#dlgMemory')); });
  $('#memAdd').addEventListener('click', () => { if (addMemory($('#memText').value, 'user')) { $('#memText').value = ''; commit('settings'); renderMemory(); } else toast('这条已经记着了，或者太短'); });
  $$('[data-est]').forEach(b => b.addEventListener('click', () => { $('#tEst').value = b.dataset.est; }));
  $$('[data-rm]').forEach(b => b.addEventListener('click', () => { $('#tRemind').value = b.dataset.rm; }));
  $('#vDone').addEventListener('click', () => stopVoice(true));
  $('#vCancel').addEventListener('click', () => stopVoice(false));
  $('#mRivalDaily').addEventListener('change', e => { S.settings.rival.daily = e.target.checked; touch(S.settings); commit('settings'); if (e.target.checked) refreshRivalLine(); });
  // 我现在有空
  $('#btnFree').addEventListener('click', () => { $('#dfList').innerHTML = ''; $('#dfAsk').hidden = true; setSeg('#dfMin', ''); openDlg($('#dlgFree')); });
  $$('#dfMin button').forEach(b => b.addEventListener('click', () => { setSeg('#dfMin', b.dataset.v); showFreeTime(+b.dataset.v); }));
  // 每日事项
  $$('#rDays button').forEach(b => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
  $$('#rPreset button').forEach(b => b.addEventListener('click', () => { const set = b.dataset.p.split(',').map(Number); $$('#rDays button').forEach(x => x.setAttribute('aria-pressed', String(set.includes(+x.dataset.d)))); }));
  $$('#rWin button').forEach(b => b.addEventListener('click', () => setSeg('#rWin', b.dataset.v)));
  $('#rSave').addEventListener('click', saveRoutine);
  $('#rDel').addEventListener('click', e => armDelete(e.currentTarget, () => {
    const r = S.routines.find(x => x.id === editRoutineId);
    if (r) { r.deletedAt = Date.now(); touch(r); }
    commit('tasks'); $('#dlgRoutine').close();
  }));
  // 小助手
  $('#chatSend').addEventListener('click', () => sendChat($('#chatInput').value));
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat($('#chatInput').value); } });
  $$('#chatChips button').forEach(b => b.addEventListener('click', () => sendChat(b.textContent)));
  // 排今天
  $('#btnPlan').addEventListener('click', () => planToday(false));
  $('#dpAccept').addEventListener('click', acceptPlan);
  $('#dpRetry').addEventListener('click', () => { const r = !!(planDraft && planDraft.replace.length); $('#dlgPlan').close(); setTimeout(() => planToday(r), 150); });
  $('#dpAll').addEventListener('click', () => { $('#dlgPlan').close(); setTimeout(() => planToday(true), 150); });
  $('#replanBtn').addEventListener('click', planToday);
  $('#dbDone').addEventListener('click', () => {
    const b = S.plans.find(x => x.id === blockId);
    if (b) { $('#dlgBlock').close(); finishBlock(b); return; }
    $('#dlgBlock').close();
  });
  $('#dbDel').addEventListener('click', e => armDelete(e.currentTarget, () => {
    const b = S.plans.find(x => x.id === blockId);
    if (b) { b.deletedAt = Date.now(); touch(b); afterProgress('删掉了这块'); }
    $('#dlgBlock').close();
  }));
  $$('#taskSort button').forEach(b => b.addEventListener('click', () => { taskSort = b.dataset.s; renderTasks(); }));
  $('#mExport').addEventListener('click', () => saveFile(`学生工作台备份-${ymd(new Date())}.json`, backupJSON(), 'application/json'));
  $('#mImport').addEventListener('click', () => $('#fileBak').click());

  let lastDay = ymd(new Date());
  setInterval(() => {
    const today = ymd(new Date());
    if (today !== lastDay) { lastDay = today; viewWeek = null; }
    renderTitle(); renderToday(); renderTasks();
    if (location.hash === '#week') renderWeek();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (saveTimer) flushSave(); }
    else { if (rollPlan()) persist(); renderAll(); scheduleNotifSync(false); refreshRivalLine(); checkReminders(); }
  });
}

/* ---------- web version: offline cache and updates ---------- */
function initServiceWorker() {
  if (isNative || !('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!secure) return;
  let updating = false;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      if (!w) return;
      $('#updateBar').hidden = false;
      $('#btnUpdate').onclick = () => { updating = true; w.postMessage('skipWaiting'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload(); });
  }).catch(e => console.warn('sw', e));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* ---------- start ---------- */
(async () => {
  await loadNativePlugins();
  await loadState();
  loadChat();
  if (rollPlan()) persist();
  wire();
  route();
  initServiceWorker();
  scheduleNotifSync(false);
  autoBackup();
  refreshRivalLine();
  checkReminders();
  setInterval(checkReminders, 30000);
  introTake();
  window.addEventListener('resize', () => requestAnimationFrame(() => { movePill(); sizeChat(); scrollChat(); }));
})();
})();
