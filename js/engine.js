// Pure game logic. No DOM, no storage. Every action takes the state and
// returns { ok, events } after mutating state in place; the UI turns events
// into effects (level-up, unlock).
import { CHARACTERS, REGIONS, RANKS } from './content.js';

export const SAVE_VERSION = 7;

// The rules of the game, in one place:
//   every dimension    8 small buildings, one for each daily habit (8 habits = 8 ranks)
//   the start          the spiritual dimension, with one habit
//   every Sunday       a clear message: build a habit · open a new dimension · not this week.
//                      Building a habit raises that dimension's rank by itself.
//   every habit        a counter running in days and hours since it began; the player can
//                      reset it to zero or pause it (and run it again)
//   decorations        each dimension's place gets one more with every building
//   dayEnds            the game day closes at 3 at night, not at midnight
//   the ship           grows with every habit built; all 8 dimensions × 8 habits = ready,
//                      and the Island of Leaders opens.
export const RULES = { dayEnds: 3, habitsPer: 8, offerDay: 0 };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Test mode can move its own calendar forward (setDayShift) to try a day's close at once.
let dayShift = 0;
export const setDayShift = (n) => { dayShift = n || 0; };
export const today = (d = new Date()) => ymd(new Date(+d - RULES.dayEnds * 3600000 + dayShift * 86400000));
// The clock the habit counters run on (test mode moves it forward a week at a time).
export const nowMs = () => Date.now() + dayShift * 86400000;
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();   // 0 = Sunday

const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export const findCharacter = (id) => CHARACTERS.find((c) => c.id === id);
export const findRegion = (id) => REGIONS.find((r) => r.id === id);

// ---------- Unlock conditions (generic, reusable) ----------
// Each type: check(state, cond) -> { current, target } and label(cond).
export const CONDITIONS = {
  goldEarned: {
    check: (s, c) => ({ current: s.stats.goldEarned, target: c.min }),
    label: (c) => `اجمع ${c.min} ذهبًا إجمالًا`,
  },
  tasksCompleted: {
    check: (s, c) => ({ current: s.stats.tasksCompleted, target: c.min }),
    label: (c) => `أنجز ${c.min} مهمة`,
  },
  bestStreak: {
    check: (s, c) => ({ current: s.stats.bestStreak, target: c.min }),
    label: (c) => `حقّق ${c.min} أيام كاملة متتالية`,
  },
  characterLevel: {
    check: (s, c) => ({ current: s.characters[c.id]?.level ?? 0, target: c.min }),
    label: (c) => `ارفع ${findCharacter(c.id)?.name} إلى المستوى ${c.min}`,
  },
  regionLevel: {
    check: (s, c) => ({ current: s.regions[c.id]?.level ?? 0, target: c.min }),
    label: (c) => `طوّر ${findRegion(c.id)?.name} إلى المستوى ${c.min}`,
  },
  ownsCharacter: {
    check: (s, c) => ({ current: s.characters[c.id] ? 1 : 0, target: 1 }),
    label: (c) => `امتلك شخصية ${findCharacter(c.id)?.name}`,
  },
  ownsRegion: {
    check: (s, c) => ({ current: s.regions[c.id] ? 1 : 0, target: 1 }),
    label: (c) => `امتلك منطقة ${findRegion(c.id)?.name}`,
  },
};

export function evaluateCondition(state, cond) {
  const def = CONDITIONS[cond.type];
  if (!def) return { met: false, current: 0, target: 1, label: `شرط غير معروف: ${cond.type}` };
  const { current, target } = def.check(state, cond);
  return { met: current >= target, current: Math.min(current, target), target, label: def.label(cond) };
}

export const evaluateAll = (state, conds = []) => conds.map((c) => evaluateCondition(state, c));

// ---------- Costs ({ gold? }) ----------
export const canAfford = (s, cost = {}) => s.gold >= (cost.gold || 0);
export const costText = (cost = {}) => (cost.gold ? `🪙 ${cost.gold}` : 'مجاني');

// Shop status for any item (character or region).
export function shopStatus(state, kind, item) {
  const owned = kind === 'character' ? !!state.characters[item.id] : !!state.regions[item.id];
  const conditions = evaluateAll(state, item.requires);
  const conditionsMet = conditions.every((c) => c.met);
  const affordable = canAfford(state, item.cost);
  return { owned, conditions, conditionsMet, affordable, canBuy: !owned && conditionsMet && affordable };
}

// ---------- State ----------
const newCharacter = () => ({ stage: 0, level: 1, perfectStreak: 0, lastPerfectDate: null });

export function newState() {
  const s = {
    version: SAVE_VERSION,
    gold: 0,
    stats: {},
    startDay: null,    // the day the game began (the first Sunday message comes after it)
    offerDone: null,   // the Sunday whose message was answered
    characters: {},
    regions: {},
    tasks: {}, // progress per task: `${characterId}.${taskId}` -> { streak, lastDate, lastResult }
    log: [],
    planV: 2,
    story: { speech: false, jailed: false, ship: 0, phase: 'none' },
  };
  for (const c of CHARACTERS.filter((c) => c.starter)) s.characters[c.id] = newCharacter();
  for (const r of REGIONS.filter((r) => r.starter)) s.regions[r.id] = { level: 1 };
  return s;
}

// Fill in anything missing from older saves so content additions never break a save.
const OLD_PRAYER_IDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export function migrate(raw) {
  const base = newState();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw, stats: { ...base.stats, ...(raw.stats || {}) } };
  s.characters = { ...base.characters, ...(raw.characters || {}) };
  // v3: character levels now come from perfect days + keys, so older levels restart at 1.
  if ((raw.version || 1) < 3) for (const id in s.characters) s.characters[id] = newCharacter();
  for (const id in s.characters) {
    const { war, wars, losses, zeroRun, restore, levelDays, levelReady, ...ch } = s.characters[id];
    s.characters[id] = { ...newCharacter(), ...ch };
  }
  s.regions = { ...base.regions, ...(raw.regions || {}) };
  s.tasks = raw.tasks && typeof raw.tasks === 'object' ? raw.tasks : {};
  delete s.habits; delete s.projects; delete s.activeCharacter;
  s.log = Array.isArray(raw.log) ? raw.log : [];
  // The spiritual dimension no longer comes with the five prayers: the player sets its habits.
  const w = s.characters.worshipper;
  if (w?.plan) w.plan = w.plan.map((r) => (r || []).filter((t) => !OLD_PRAYER_IDS.includes(t.id)));
  // Habit picker (planV 2): dimensions start empty. Saves from before keep their old preset tasks.
  if ((raw.planV || 1) < 2) for (const id in s.characters) {
    const def = findCharacter(id), ch = s.characters[id];
    if (def?.legacyTasks && !ch.plan) { ch.plan = defaultPlan(def); ch.plan[0] = def.legacyTasks.map((t) => ({ ...t })); }
  }
  s.planV = 2;
  s.story = { ...base.story, ...(raw.story || {}) };
  delete s.story.ship;   // the ship now grows with the habits built
  // v6: no keys, shields, medals or wars; at most 8 habits (ranks) a dimension.
  for (const k of ['keys', 'keyHalves', 'shields', 'medals', 'season', 'lastAttack']) delete s[k];
  delete s.stats.keysEarned;
  for (const id in s.characters) {
    const ch = s.characters[id];
    if (totalLevel(ch) > RANK_COUNT) setLevel(ch, RANK_COUNT);
    const d = findCharacter(id); if (d?.stages && ch.plan) compact(d, ch);   // habits removed earlier: no empty ranks
    if (ch.plan) ch.plan = ch.plan.slice(0, RANK_COUNT);
  }
  s.startDay ||= today();
  // v7: habits are counters (no times a day, no prayers tied to a time, no gold).
  for (const id in s.characters) {
    const ch = s.characters[id];
    if (ch.plan) ch.plan = ch.plan.map((r) => (r || []).map(({ times, prayer, reward, added, ...t }) => ({ start: Date.now(), paused: null, ...t })));
  }
  if (s.story.speech && (!raw.story?.phase || raw.story.phase === 'none')) s.story.phase = 'march';
  s.version = SAVE_VERSION;
  return s;
}

function addLog(s, text, delta = 0) {
  s.log.unshift({ t: Date.now(), text, delta });
  s.log.length = Math.min(s.log.length, 60);
}

const done = (s, events) => ({ ok: true, events });
const fail = (reason) => ({ ok: false, reason, events: [] });

// ---------- Progression (stages × 5 levels) ----------
// Tasks active for this character now: base tasks + every level's additions so far.
// ---------- The player's own rank plan ----------
// Each character has one list of tasks per rank (Bronze 1 … Platinum 3), written by
// the player. Reaching a rank adds its tasks on top of every earlier rank's.
export const RANK_COUNT = RANKS.length;
export function defaultPlan(def) {
  const plan = Array.from({ length: RANK_COUNT }, () => []);
  plan[0] = def.tasks.map((t) => ({ ...t }));
  let i = 1;
  (def.stages || []).forEach((st) => (st.levels || []).forEach((lv, li) => {
    if (!(st === def.stages[0] && li === 0)) { if (i < RANK_COUNT) plan[i] = lv.adds.map((t) => ({ ...t })); i++; }
  }));
  return plan;
}
export function planOf(def, ch) { return ch?.plan || defaultPlan(def); }

// Replace one rank's habits with the player's list. A title matching an existing habit
// keeps it (and its counter); new titles become new habits, their counter starting now.
const parseLine = (l) => ({ title: String(l).replace(/^[\s\-•*+\d.)]+(?=\D)/, '').replace(/\s*[×xX*]\s*\d{1,2}$/, '').trim() });
const cleanIcon = (i) => (typeof i === 'string' ? [...i.trim()].slice(0, 4).join('') : '');

export function setRankPlan(s, id, rankIndex, input) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  if (rankIndex < 0 || rankIndex >= RANK_COUNT) return fail('رتبة غير موجودة');
  const items = (Array.isArray(input) ? input : String(input).split('\n').map(parseLine))
    .map((x) => ({ title: String(x.title || '').trim().slice(0, 80), icon: cleanIcon(x.icon) }))
    .filter((x) => x.title);
  const seen = new Set();
  const uniq = items.filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 12);
  const plan = planOf(def, ch).map((r) => r.map((t) => ({ ...t })));
  const known = plan.flat();
  plan[rankIndex] = uniq.map(({ title, icon }) => {
    const old = known.find((t) => t.title === title);
    if (old) {
      plan.forEach((r, i) => { if (i !== rankIndex) plan[i] = r.filter((t) => t.id !== old.id); });
      const t = { ...old }; if (icon) t.icon = icon;
      return t;
    }
    const t = { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, start: nowMs(), paused: null };
    if (icon) t.icon = icon;
    return t;
  });
  ch.plan = plan;
  addLog(s, `✎ ${def.name}: ${RANKS[rankIndex].name}`);
  return done(s, []);
}

// ---------- Habits: one habit per rank ----------
// Each rank brings one new habit (a new building), chosen from the Sunday message.
const cleanHabit = (h) => ({ title: String(h?.title || '').trim().slice(0, 80), icon: cleanIcon(h?.icon) });

// Change (taskId given) or add a habit in one rank.
export function setHabit(s, id, rankIndex, taskId, habit) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  const h = cleanHabit(habit);
  if (!h.title) return fail('اختار مهمة أو اكتب اسمها');
  const all = activeTasks(def, ch);
  if (all.some((t) => t.title === h.title && t.id !== taskId)) return fail('هاي المهمة عندك أصلًا');
  const list = (planOf(def, ch)[rankIndex] || []).map((t) => ({ title: t.title, icon: t.icon, id: t.id }));
  const i = list.findIndex((t) => t.id === taskId);
  if (i >= 0) list[i] = h; else list.push(h);
  return setRankPlan(s, id, rankIndex, list);
}

// Rename a habit, change its picture or its notes in place: same building, same counter.
export function editHabit(s, id, taskId, habit) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  const t = activeTasks(def, ch).find((x) => x.id === taskId);
  if (!t) return fail('غير موجودة');
  // Its notes (any length of writing) and its picture (an image from outside the game).
  if ('notes' in habit) t.notes = String(habit.notes || '').slice(0, 20000);
  if ('img' in habit) { if (typeof habit.img === 'string' && habit.img.startsWith('data:image/') && habit.img.length < 400000) t.img = habit.img; else delete t.img; }
  if (!('title' in habit)) { addLog(s, `✎ ${def.name}: ${t.title}`); return done(s, []); }
  const h = cleanHabit(habit);
  if (!h.title) return fail('اكتب اسم العادة');
  if (activeTasks(def, ch).some((x) => x.title === h.title && x.id !== taskId)) return fail('هاي العادة عندك أصلًا');
  t.title = h.title; if (h.icon) t.icon = h.icon;
  addLog(s, `✎ ${def.name}: ${h.title}`);
  return done(s, []);
}

// Remove a habit (never the last one left).
export function removeHabit(s, id, taskId) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  if (activeTasks(def, ch).length <= 1) return fail('لازم يضل عندك مهمة وحدة على الأقل');
  ch.plan = planOf(def, ch).map((r) => r.filter((t) => t.id !== taskId));
  compact(def, ch);
  addLog(s, `🗑 ${def.name}: حذف مهمة`);
  return done(s, []);
}

// Where a character stands: its rank, the next one, how many habits it has.
export function road(s, id) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def?.stages || !ch) return null;
  const n = totalLevel(ch);
  return { rank: RANKS[n - 1], next: RANKS[n] || null, habits: activeTasks(def, ch).length, max: RANK_COUNT };
}

export function activeTasks(def, ch) {
  if (!def.stages || !ch) return [...def.tasks];
  return planOf(def, ch).slice(0, totalLevel(ch)).flat();
}

// What the next rank would unlock, or why it can't happen yet.
export function nextLevel(def, ch) {
  if (!def.stages) return null;
  const n = totalLevel(ch); // index of the next rank
  if (n >= RANK_COUNT) return { max: true };
  return { stage: Math.floor(n / 5), level: (n % 5) + 1, adds: planOf(def, ch)[n] };
}

// ---------- The habit counters ----------
// Every habit counts the time since it began (days and hours). Reset: back to zero.
// Pause: the counter stops where it is; run: it goes on from there.
const findTask = (s, charId, taskId) => { const def = findCharacter(charId), ch = s.characters[charId]; return def && ch ? activeTasks(def, ch).find((t) => t.id === taskId) : null; };
export const habitElapsed = (t, now = nowMs()) => Math.max(0, (t?.paused ?? now) - (t?.start ?? now));
export const habitDays = (t, now) => { const ms = habitElapsed(t, now); return { days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000), minutes: Math.floor((ms % 3600000) / 60000) }; };
export function pauseHabit(s, charId, taskId) {
  const t = findTask(s, charId, taskId); if (!t) return fail('غير موجودة');
  if (t.paused != null) return fail('موقوف أصلًا');
  t.paused = nowMs(); addLog(s, `⏸ ${t.title}`);
  return done(s, [{ type: 'habitPause' }]);
}
export function resumeHabit(s, charId, taskId) {
  const t = findTask(s, charId, taskId); if (!t) return fail('غير موجودة');
  if (t.paused == null) return fail('شغّال أصلًا');
  t.start += nowMs() - t.paused; t.paused = null; addLog(s, `▶ ${t.title}`);
  return done(s, [{ type: 'habitResume' }]);
}
export function resetHabit(s, charId, taskId) {
  const t = findTask(s, charId, taskId); if (!t) return fail('غير موجودة');
  const now = nowMs(); t.start = now; if (t.paused != null) t.paused = now;
  addLog(s, `↺ ${t.title}`);
  return done(s, [{ type: 'habitReset' }]);
}

// ---------- The day ----------
// The game day closes at 3 at night; nothing is settled any more — the counters just run.
export function closeDays(s, now = today()) {
  const last = s.lastDay;
  s.lastDay = now;
  return { days: last && last < now ? dayDiff(last, now) : 0 };
}

// Set the overall level (1 = the first rank).
function setLevel(ch, n) { ch.stage = Math.floor((n - 1) / 5); ch.level = ((n - 1) % 5) + 1; }
// One building per rank, with no gaps: the rank follows the number of habits built.
function compact(def, ch) {
  if (!def?.stages || !ch) return;
  const list = activeTasks(def, ch).slice(0, RANK_COUNT);
  ch.plan = list.map((t) => [t]);
  setLevel(ch, Math.max(1, list.length));
}
// Test mode only: a dimension starts again from zero (no buildings); the Sunday message
// then builds its habits again as usual.
export function resetDimension(s, id) {
  if (!s.sandbox) return fail('بس بوضع التجربة');
  const def = findCharacter(id), ch = s.characters[id];
  if (!def?.stages || !ch) return fail('غير مملوكة');
  ch.plan = []; setLevel(ch, 1);
  addLog(s, `↺ ${def.name}: من الصفر`);
  return done(s, [{ type: 'dimReset' }]);
}

// ---------- The Sunday message ----------
// Every Sunday (from the first Sunday after the game began) the player chooses one:
//   build  — a new habit (a new building) in an open dimension with room left
//   open   — a new dimension, with its first habit
//   skip   — "not this week": everything stays as it is until next Sunday
// Sundays missed while away don't pile up: there is one message at a time.
export const offerSunday = (date = today()) => addDays(date, -weekday(date));
export function pendingOffer(s, date = today()) {
  if (!s.startDay) return null;
  const sunday = offerSunday(date);
  if (sunday <= s.startDay || s.offerDone === sunday) return null;
  const build = CHARACTERS.filter((c) => c.stages && s.characters[c.id] && activeTasks(c, s.characters[c.id]).length < RANK_COUNT).map((c) => c.id);
  const open = REGIONS.filter((r) => r.characterId && !r.kind && !s.regions[r.id]).map((r) => r.id);
  if (!build.length && !open.length) return null;
  return { sunday, build, open };
}
// Answer the message: build (id = the dimension), open (id = the region), or skip.
export function answerOffer(s, choice, { id, habit } = {}, date = today()) {
  const o = pendingOffer(s, date);
  if (!o) return fail('ما في رسالة هالأسبوع');
  if (choice === 'skip') { s.offerDone = o.sunday; addLog(s, '📬 لا تستحق — هالأسبوع بيضل زي ما هو'); return done(s, [{ type: 'offer', choice }]); }
  const h = cleanHabit(habit);
  if (!h.title) return fail('اختار العادة');
  if (choice === 'build') {
    if (!o.build.includes(id)) return fail('هاد البعد ما فيه مكان لعادة جديدة');
    const def = findCharacter(id), ch = s.characters[id];
    if (activeTasks(def, ch).some((t) => t.title === h.title)) return fail('هاي المهمة عندك أصلًا');
    compact(def, ch);
    const n = activeTasks(def, ch).length;
    const r = setRankPlan(s, id, n, [h]); if (!r.ok) return r;
    setLevel(ch, n + 1);
    s.offerDone = o.sunday;
    addLog(s, `🏗 ${def.name}: ${h.title} → ${rankName(ch)}`);
    return done(s, [{ type: 'rank', name: def.name, rank: rankName(ch) }, { type: 'offer', choice }]);
  }
  if (choice === 'open') {
    if (!o.open.includes(id)) return fail('هاد البعد مفتوح أو مش موجود');
    const reg = findRegion(id);
    s.regions[id] = { level: 1 };
    if (!s.characters[reg.characterId]) s.characters[reg.characterId] = newCharacter();
    const r = setRankPlan(s, reg.characterId, 0, [h]); if (!r.ok) return r;
    s.offerDone = o.sunday;
    addLog(s, `🔓 ${reg.name}: ${h.title}`);
    return done(s, [{ type: 'unlock', kind: 'region', id, name: reg.name }, { type: 'offer', choice }]);
  }
  return fail('اختيار غير معروف');
}

// ---------- Regions ----------
// A place's decorations: one more with every building (habit) of its dimension.
export const regionFeatures = (s, id) => {
  const def = findRegion(id);
  const c = def?.characterId && findCharacter(def.characterId), ch = c && s.characters[c.id];
  const n = ch ? activeTasks(c, ch).length : 0;
  return new Set((def?.upgrades || []).filter((u) => u.level <= n).map((u) => u.adds));
};

// ---------- World map ----------
// Visible: owned places. Teaser: a locked place whose `revealedBy` place is owned.
// Everything else stays under fog.
export function mapVisibility(s, region) {
  if (region.kind === 'leaders') return 'teaser';   // always on the map; it opens when the ship is ready (islandOpen)
  if (s.regions[region.id]) return 'owned';
  const by = region.map?.revealedBy;
  return by && s.regions[by] ? 'teaser' : 'hidden';
}

// ---------- Test mode ----------
// A copy of the real game; its clock moves a week at a time (a new Sunday message each
// time). The real save waits inside and comes back on exit.
export function enterSandbox(real) {
  const t = migrate(JSON.parse(JSON.stringify({ ...real, sandbox: undefined })));
  t.sandbox = { backup: JSON.stringify({ ...real, sandbox: undefined }), shift: 0 };
  addLog(t, '🧪 وضع التجربة');
  return t;
}
export function weekPasses(s) { if (s.sandbox) s.sandbox.shift = (s.sandbox.shift || 0) + 7; }
export function leaveSandbox(s) { return s.sandbox ? migrate(JSON.parse(s.sandbox.backup)) : s; }

// ---------- The story: the speech, Lucifer locked away, the ship ----------
// The ship to the Island of Leaders grows with every habit built: all 8 dimensions with
// their 8 habits each (64) = the ship is ready and the island opens.
export const SHIP = { parts: 12 };
export const habitsBuilt = (s) => CHARACTERS.reduce((a, c) => a + (c.stages && s.characters[c.id] ? activeTasks(c, s.characters[c.id]).length : 0), 0);
export const HABITS_ALL = () => CHARACTERS.filter((c) => c.stages).length * RANK_COUNT;
export const shipStage = (s) => Math.min(SHIP.parts, Math.floor((habitsBuilt(s) * SHIP.parts) / HABITS_ALL()));
export const islandOpen = (s) => habitsBuilt(s) >= HABITS_ALL();
// Story phases: none → march (walk the warriors down to the shore) → back (after the
// spyglass, walk them home) → done (the cage is found locked and empty: Lucifer escaped).
export function finishSpeech(s) {
  s.story = { ...(s.story || {}), speech: true, jailed: true, phase: 'march' };
  addLog(s, '⛓ لوسيفير محبوس في القفص');
  return done(s, []);
}
export function storyStep(s, phase) {
  s.story = { ...(s.story || {}), phase };
  if (phase === 'back') addLog(s, '🔭 القائد شاف جزيرة القادة');
  if (phase === 'done') { s.story.jailed = false; s.story.escaped = true; addLog(s, '🔥 لوسيفير هرب من القفص'); }
  return done(s, []);
}
// The island appears on the map once the commander has seen it through the spyglass.
export const islandSeen = (s) => ['back', 'done'].includes(s.story?.phase);

// A brand-new game (first visit or "start over"): it begins with the guided first steps.
export function demoState() {
  const s = newState();
  s.tour = 0;
  s.startDay = today();
  addLog(s, 'مرحبًا بك في No Means No');
  return s;
}

// ---------- Ranks ----------
// Overall level of a character: 5 levels per stage.
export const totalLevel = (ch) => (ch.stage || 0) * 5 + (ch.level || 1);
// Each level is a rank: level 1 = Bronze … level 8 = Legend (one per habit).
export const rankName = (ch) => RANKS[totalLevel(ch) - 1]?.name || `مستوى ${totalLevel(ch)}`;
export const rankColor = (ch) => RANKS[totalLevel(ch) - 1]?.color || '#3f7d6e';

// Each dimension on the map of dimensions: coming (closed) · building (habits n of 8) · full.
export function dimStatus(s, region) {
  if (!s.regions[region.id]) return { id: 'coming' };
  const c = region.characterId && findCharacter(region.characterId), ch = c && s.characters[c.id];
  const n = ch ? activeTasks(c, ch).length : 0;
  return { id: n >= RANK_COUNT ? 'full' : 'building', habits: n, max: RANK_COUNT, level: ch ? totalLevel(ch) : 0 };
}
