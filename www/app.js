(() => {
'use strict';

const VERSION = '0.3.__BUILD__';
const TEST_ID = 2100000000; // outside the range nid() produces
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const WD = ['一', '二', '三', '四', '五', '六', '日'];
const PX_DAY = 0.5, PX_WEEK = 1; // px per minute: today ruler / week grid
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
    settings: { nick: '', goal: '', pacer: { name: '兔子', role: 'company', msg: '' }, termStart: '', totalWeeks: 18, dayStart: 8, dayEnd: 22, periods: clone(DEFAULT_PERIODS), notifyLead: 60, show: {}, updatedAt: 0 },
    courses: [],
    tasks: [],
    others: []
  };
}
function normSettings(v) {
  const o = Object.assign(defaults().settings, v && typeof v === 'object' ? clone(v) : {});
  delete o.name; delete o.cls;
  o.nick = str(o.nick).slice(0, 12); o.goal = str(o.goal).slice(0, 16);
  o.termStart = parseYMD(o.termStart) ? o.termStart : '';
  delete o.routeStart;
  const pc = o.pacer && typeof o.pacer === 'object' ? o.pacer : {};
  o.pacer = { name: str(pc.name).trim().slice(0, 8) || '兔子', role: ['goal', 'model', 'company'].includes(pc.role) ? pc.role : 'company', msg: str(pc.msg).trim().slice(0, 30) };
  o.totalWeeks = clampInt(o.totalWeeks, 8, 30, 18);
  const show = o.show && typeof o.show === 'object' ? o.show : {};
  o.show = {}; SHOW_FIELDS.forEach(([k]) => { o.show[k] = !!show[k]; });
  o.dayStart = clampInt(o.dayStart, 0, 12, 8);
  o.dayEnd = clampInt(o.dayEnd, 13, 24, 22);
  o.periods = Array.isArray(o.periods)
    ? o.periods.filter(p => p && HM.test(p.start) && HM.test(p.end)).map(p => ({ start: p.start, end: p.end }))
    : clone(DEFAULT_PERIODS);
  o.notifyLead = [30, 60, 180, 1440].includes(+o.notifyLead) ? +o.notifyLead : 60;
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
    status, due: parseDue(x.due) ? str(x.due).slice(0, 16) : '',
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
    others: arr(o.others).filter(x => x && typeof x === 'object').map(normOther).filter(t => t.name || t.deletedAt)
  };
}
const alive = list => list.filter(x => !x.deletedAt);
const touch = rec => { rec.updatedAt = Date.now(); return rec; };
function purgeTombstones() {
  const cut = Date.now() - 90 * 86400000;
  S.courses = S.courses.filter(x => !x.deletedAt || x.deletedAt > cut);
  S.tasks = S.tasks.filter(x => !x.deletedAt || x.deletedAt > cut);
  S.others = S.others.filter(x => !x.deletedAt || x.deletedAt > cut);
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
function openDlg(d) { d.showModal(); try { history.pushState({ dlg: d.id }, ''); } catch (e) { /* ignore */ } }
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

/* ---------- run to 南大: keep up with the pacer ---------- */
// straight-line legs between the two campuses (江浦 → 北大楼 13.3 km → 仙林 18.1 km); 长江 and 紫金山 are where that line passes
const ROUTE = { total: 31.4, points: [['南工', 0], ['长江', 8], ['北大楼', 13.3], ['紫金山', 20.4], ['南大仙林', 31.4]] };
const LS_CP = 'swb:route-cp';
const routeOn = () => /南京大学|南大/.test(S.settings.goal);
function semesterSpan() {
  const m = termMonday();
  return m ? [m.getTime(), addDays(m, S.settings.totalWeeks * 7).getTime()] : null;
}
function semesterProgress(now) {
  const w = teachWeek(now);
  // counts today as run, so the last day of term closes the lap
  return w == null || w === 0 ? 0 : Math.min(1, ((w - 1) * 7 + isoDay(now)) / (S.settings.totalWeeks * 7));
}
// The pacer (兔子) runs with the calendar and reaches 仙林 on the last day of term.
// You run at the pacer's distance times the share of due work you've finished, so the
// number of assignments never matters: finish everything and you arrive with it, never early.
function routeState(now) {
  const span = semesterSpan(), t = now.getTime(), total = ROUTE.total;
  const due = alive(S.tasks).filter(x => { const d = parseDue(x.due); return d && d.getTime() <= t && (!span || d.getTime() >= span[0]); });
  const done = due.filter(x => x.status === 'done').length;
  const ratio = (done + 1) / (due.length + 1); // +1 keeps one early miss from wiping out the week
  const rabbit = total * semesterProgress(now), me = rabbit * ratio;
  return { total, rabbit, me, gap: rabbit - me, overdue: due.length - done, arrived: me >= total - 0.05 };
}
const passedIndex = km => ROUTE.points.reduce((n, [, at], i) => (km >= at ? i : n), 0);
const PACER_ROLES = { goal: ['目标', '我在南大等你'], model: ['榜样', '跟上我的节奏'], company: ['陪伴', '一起跑，别掉队'] };
const pacer = () => S.settings.pacer;
const pacerMsg = () => pacer().msg || PACER_ROLES[pacer().role][1];
const initial = v => (Array.from(String(v || '').trim())[0] || '');
function raceTalk(r) {
  const ta = pacer().name, say = `${ta}：“${pacerMsg()}”`, left = r.total - r.me;
  const span = semesterSpan();
  if (span && Date.now() < span[0]) return `还没鸣枪，${ta}在起跑线等你。`;
  if (r.arrived) return `你和${ta}一起撞线！`;
  if (r.gap >= 0.15) return `${ta}领先你 ${r.gap.toFixed(1)} km。交掉 ${r.overdue} 项过期作业就能追上。${say}`;
  if (left <= 5) return `最后 ${left.toFixed(1)} km，和${ta}一起冲刺！`;
  return `你和${ta}并肩跑着。${say}`;
}
function renderRoute() {
  const card = $('#route'), on = routeOn();
  card.hidden = !on;
  const g = $('#heroGoal'); g.hidden = on || !S.settings.goal; g.textContent = S.settings.goal ? '目标 ' + S.settings.goal : '';
  if (!on) return;
  const r = routeState(new Date()), pct = km => (Math.min(1, km / r.total) * 100).toFixed(2) + '%', behind = r.gap >= 0.15;
  card.classList.toggle('arrived', r.arrived);
  $('#taDone').style.width = pct(r.rabbit);
  $('#meDone').style.width = pct(r.me);
  $('#taAv').style.left = pct(r.rabbit);
  $('#meAv').style.left = pct(r.me);
  $('#taAv').textContent = initial(pacer().name) || '兔';
  $('#meAv').textContent = initial(S.settings.nick) || '我';
  $('#taAv').title = pacer().name; $('#meAv').title = S.settings.nick || '我';
  $('#rtMarks').innerHTML = ROUTE.points.slice(1, -1).map(([, at]) => `<i style="left:${pct(at)}"></i>`).join('');
  $('#rtPts').innerHTML = ROUTE.points.map(([name, at], i) => {
    const cls = (i === 0 ? 'first ' : i === ROUTE.points.length - 1 ? 'last ' : '') + (r.me >= at ? 'passed' : '');
    return `<span class="${cls}" style="left:${pct(at)}">${name}</span>`;
  }).join('');
  $('#rtLeft').innerHTML = r.arrived
    ? '到南大了！<span class="motto">诚朴雄伟，励学敦行</span>'
    : `离南大还有 <span class="num">${(r.total - r.me).toFixed(1)}</span> km`;
  const pace = $('#rtPace');
  pace.className = 'rt-pace ' + (r.arrived ? 'ahead' : behind ? 'behind' : 'ahead');
  pace.textContent = r.arrived ? '撞线' : behind ? `落后 ${r.gap.toFixed(1)} km` : '并肩';
  $('#rtTalk').textContent = raceTalk(r);
  // a checkpoint passed since the last visit gets one cheer
  const idx = passedIndex(r.me), key = S.settings.termStart + '|' + idx;
  let last = null; try { last = localStorage.getItem(LS_CP); } catch (e) { /* ignore */ }
  if (last && last.split('|')[0] === S.settings.termStart && +last.split('|')[1] < idx) cheer(idx);
  try { localStorage.setItem(LS_CP, key); } catch (e) { /* ignore */ }
}
function cheer(idx) {
  const name = ROUTE.points[idx][0];
  if (idx === ROUTE.points.length - 1) toast(`和${pacer().name}一起撞线！诚朴雄伟，励学敦行`);
  else toast(`过${name}了！${pacer().name}：“${pacerMsg()}”`);
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
  renderRoute();
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
  const dues = openTasks().filter(t => t.due.slice(0, 10) === todayKey)
    .map(t => ({ t, m: toMin(t.due.slice(11, 16)) })).filter(x => x.m != null).sort((a, b) => a.m - b.m);
  let start = S.settings.dayStart * 60, end = S.settings.dayEnd * 60;
  classes.forEach(c => { start = Math.min(start, Math.floor(toMin(c.start) / 60) * 60); end = Math.max(end, Math.ceil(toMin(c.end) / 60) * 60); });
  dues.forEach(x => { start = Math.min(start, Math.floor(x.m / 60) * 60); end = Math.max(end, Math.min(1440, Math.ceil((x.m + 1) / 60) * 60)); });

  const r = $('#ruler');
  r.innerHTML = '';
  const H = (end - start) * PX_DAY;
  r.style.height = H + 'px';
  r.classList.toggle('has-dues', dues.length > 0);
  mk(r, 'div', 'axis');
  for (let m = start; m <= end; m += 30) {
    const y = (m - start) * PX_DAY, hour = m % 60 === 0;
    mk(r, 'div', 'tick' + (hour ? ' h' : '')).style.top = y + 'px';
    if (hour) { const lb = mk(r, 'div', 'tl num'); lb.style.top = y + 'px'; lb.textContent = pad(m / 60); }
  }
  // free blocks from now on, so you can see where homework fits
  let cursor = Math.max(nowMin, start);
  const gaps = [];
  classes.forEach(c => {
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
  layoutLanes(classes).forEach(({ c, a, b, lane, lanes }) => {
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
    d.innerHTML = `<i aria-hidden="true"></i><span><span class="num">${fmtMin(x.m)}</span> ${esc(x.t.title)}</span>`;
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
let taskFilter = 'open';
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
    e.currentTarget.setAttribute('aria-pressed', 'true');
    mk(li, 'span', 'ko').textContent = 'KO';
    setTimeout(() => toggleDone(t.id), 650);
  });
  li.querySelector('.tbody').addEventListener('click', () => openTask(t.id));
  return li;
}
function renderTasks() {
  const now = new Date();
  const open = openTasks().sort(byDue);
  const done = alive(S.tasks).filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  $$('#taskFilter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === taskFilter)));
  $('#taskFilter [data-f="open"] .n').textContent = open.length || '';
  $('#taskFilter [data-f="done"] .n').textContent = done.length || '';
  const list = $('#taskList');
  list.innerHTML = '';
  const items = taskFilter === 'open' ? open : done.slice(0, 200);
  if (!items.length) {
    list.innerHTML = taskFilter === 'open'
      ? '<li class="empty">擂台上没有对手了。有新作业就点“添加”，快到期的会标橙，24 小时内的会拉警戒条。</li>'
      : '<li class="empty">还没有 KO 过任何一项。</li>';
  }
  items.forEach(t => list.appendChild(taskRow(t, now)));
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
  const before = routeOn() ? routeState(new Date()) : null;
  if (t.status === 'done') { t.status = 'todo'; t.doneAt = 0; } else { t.status = 'done'; t.doneAt = Date.now(); }
  touch(t);
  commit('tasks');
  if (t.status === 'done' && before) {
    const after = routeState(new Date()), due = parseDue(t.due);
    if (after.me - before.me > 0.05) {
      if (passedIndex(after.me) > passedIndex(before.me)) return; // the checkpoint cheer already fired
      toast(after.gap < 0.15 ? `KO！追上${pacer().name}了` : `KO！追回 ${(after.me - before.me).toFixed(1)} km`);
      return;
    }
    if (due && due.getTime() > Date.now()) { toast('KO！提前做完，到期那天算你按时'); return; }
  }
  if (t.status === 'done') {
    const today = ymd(new Date()), n = alive(S.tasks).filter(x => x.status === 'done' && x.doneAt && ymd(new Date(x.doneAt)) === today).length;
    toast(`KO！今天已经拿下 ${n} 项`);
  }
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
  if (act !== $('#mPacer')) $('#mPacer').value = s.pacer.name;
  if (act !== $('#mPacerMsg')) $('#mPacerMsg').value = s.pacer.msg;
  $('#mPacerMsg').placeholder = PACER_ROLES[s.pacer.role][1];
  setSeg('#mPacerRole', s.pacer.role);
  $('#secPacer').hidden = !routeOn();
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
  $('#mLead').value = String(s.notifyLead);
  $('#mVer').textContent = VERSION;
  $('#mEnv').textContent = isNative ? '安卓 App' : '网页版';
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
  const data = { title, course: $('#tCourse').value.trim(), type: segVal('#tType') || '作业', priority: segVal('#tPrio') || 'mid', status, due: date + 'T' + time };
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
  ['courses', 'tasks', 'others'].forEach(k => {
    const map = new Map(S[k].map(x => [x.id, x]));
    inc[k].forEach(r => {
      const cur = map.get(r.id);
      if (!cur) { S[k].push(r); map.set(r.id, r); res.add++; }
      else if (r.updatedAt > cur.updatedAt) { Object.assign(cur, r); res.upd++; }
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
  for (const f of ['local-notifications', 'filesystem', 'share']) await load(`vendor/cap/${f}.js`);
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
    await LN.createChannel({ id: 'deadline', name: '截止提醒', description: '作业截止前的提醒', importance: 4, visibility: 1, vibration: true });
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
    const lead = S.settings.notifyLead * 60000, now = new Date(), list = [];
    openTasks().forEach(t => {
      const d = parseDue(t.due);
      if (!d) return;
      const at = d.getTime() - lead;
      if (at <= now.getTime()) return;
      list.push({ id: nid(t.id), channelId: 'deadline', title: '截止提醒：' + t.title, body: `${dueLabel(d, now)} 截止${t.course ? '，' + t.course : ''}`, schedule: { at: new Date(at), allowWhileIdle: true } });
    });
    list.sort((a, b) => a.schedule.at - b.schedule.at);
    if (list.length) await LN.schedule({ notifications: list.slice(0, 60) });
    $('#mNotifyInfo').textContent = list.length ? `已安排 ${Math.min(list.length, 60)} 条提醒。` : '目前没有需要提醒的事项。';
  } catch (e) { console.warn('notifications', e); $('#mNotifyInfo').textContent = '安排提醒时出错：' + (e && e.message ? e.message : e); }
}
// status the user can read and fix without guessing
async function renderNotifyDiag() {
  const box = $('#mDiag');
  if (!isNative) return;
  const LN = plugin('LocalNotifications');
  if (!LN) { box.innerHTML = '<li class="bad">通知组件没加载上。把这一句发给 Claude。</li>'; $('#mTestNotify').disabled = true; return; }
  $('#mTestNotify').disabled = false;
  let perm = 'prompt', exact = 'na', pending = 0;
  try { perm = (await LN.checkPermissions()).display; } catch (e) { /* ignore */ }
  try { if (typeof LN.checkExactNotificationSetting === 'function') exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { exact = 'na'; }
  try { pending = arr((await LN.getPending()).notifications).filter(n => n.id !== TEST_ID).length; } catch (e) { /* ignore */ }
  const row = (label, ok, text, btn) => `<li class="${ok ? 'ok' : 'bad'}"><span>${label}</span><b>${text}</b>${btn || ''}</li>`;
  box.innerHTML =
    row('通知权限', perm === 'granted', perm === 'granted' ? '已允许' : '未允许', perm === 'granted' ? '' : '<button type="button" class="btn chip" data-fix="perm">去允许</button>') +
    (exact === 'na' ? '' : row('准时提醒', exact === 'granted', exact === 'granted' ? '已允许' : '未允许，可能会晚到', exact === 'granted' ? '' : '<button type="button" class="btn chip" data-fix="exact">去开启</button>')) +
    row('已安排', true, `${pending} 条`);
  $$('[data-fix]', box).forEach(b => b.addEventListener('click', async () => {
    try {
      if (b.dataset.fix === 'perm') {
        const r = await LN.requestPermissions();
        if (r.display !== 'granted') toast('系统没弹窗的话，到 设置 → 应用 → 学生工作台 → 通知 里打开');
        else scheduleNotifSync(false);
      } else await LN.changeExactNotificationSetting();
    } catch (e) { console.warn('fix', e); }
    setTimeout(renderNotifyDiag, 800);
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
    await LN.schedule({ notifications: [{ id: TEST_ID, channelId: 'deadline', title: '测试提醒', body: '看到这条，截止提醒就能正常弹出', schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
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
const TABS = ['today', 'week', 'tasks', 'me'];
function route() {
  const tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
  TABS.forEach(t => $('#view-' + t).classList.toggle('on', t === tab));
  $$('.nav a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (tab === 'week') viewWeek = null;
  renderAll();
  if (tab === 'me') renderNotifyDiag();
  window.scrollTo(0, 0);
}

/* ---------- wiring ---------- */
function wire() {
  initDialogs();
  window.addEventListener('hashchange', route);

  $('#btnQuickTask').addEventListener('click', () => openTask(null));
  $('#btnAddTask').addEventListener('click', () => openTask(null));
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
  const setP = (k, v) => { S.settings.pacer[k] = v; touch(S.settings); commit('settings'); };
  $('#mPacer').addEventListener('change', e => setP('name', e.target.value.trim().slice(0, 8) || '兔子'));
  $('#mPacerMsg').addEventListener('change', e => setP('msg', e.target.value.trim().slice(0, 30)));
  $$('#mPacerRole button').forEach(b => b.addEventListener('click', () => setP('role', b.dataset.v)));
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
  $('#mLead').addEventListener('change', e => setS('notifyLead', clampInt(e.target.value, 30, 1440, 60)));
  $('#mTestNotify').addEventListener('click', testNotify);
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
    else { renderAll(); scheduleNotifSync(false); }
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
  wire();
  route();
  initServiceWorker();
  scheduleNotifSync(false);
  autoBackup();
})();
})();
