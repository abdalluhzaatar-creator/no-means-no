// Pure game logic. No DOM, no storage. Every action takes the state and
// returns { ok, events } after mutating state in place; the UI turns events
// into effects (gold burst, level-up, unlock).
import { CHARACTERS, REGIONS, RANKS } from './content.js';

export const SAVE_VERSION = 6;

// The rules of the game, in one place:
//   every dimension    8 small buildings, one for each daily habit (8 habits = 8 ranks)
//   the start          the spiritual dimension, with one habit
//   every Sunday       a clear message: build a habit · open a new dimension · not this week.
//                      Building a habit raises that dimension's rank by itself.
//   dayEnds            the game day closes at 3 at night, not at midnight
//   every day          each dimension gets stars: ⭐ ⅓ of its habits done, ⭐⭐ ⅔, ⭐⭐⭐ all
//   reward             gold for a habit fully done (spent on the dimensions' decorations)
//   the ship           grows with every habit built; all 8 dimensions × 8 habits = ready,
//                      and the Island of Leaders opens.
export const RULES = { dayEnds: 3, reward: 20, habitsPer: 8, offerDay: 0 };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Test mode can move its own calendar forward (setDayShift) to try a day's close at once.
let dayShift = 0;
export const setDayShift = (n) => { dayShift = n || 0; };
export const today = (d = new Date()) => ymd(new Date(+d - RULES.dayEnds * 3600000 + dayShift * 86400000));
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nextDay = (date) => addDays(date, 1);
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
    stats: { goldEarned: 0, goldLost: 0, tasksCompleted: 0, tasksFailed: 0, bestStreak: 0 },
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
  // The spiritual dimension no longer comes with the five prayers: the player sets its tasks.
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
    if (ch.plan) ch.plan = ch.plan.slice(0, RANK_COUNT);
  }
  s.startDay ||= today();
  if (s.story.speech && (!raw.story?.phase || raw.story.phase === 'none')) s.story.phase = 'march';
  s.version = SAVE_VERSION;
  return s;
}

function addLog(s, text, delta = 0) {
  s.log.unshift({ t: Date.now(), text, delta });
  s.log.length = Math.min(s.log.length, 60);
}

function gainGold(s, amount, reason, events) {
  s.gold += amount;
  s.stats.goldEarned += amount;
  addLog(s, reason, amount);
  events.push({ type: 'gold', amount });
}

function loseGold(s, amount, reason, events) {
  const lost = Math.min(s.gold, amount);
  s.gold -= lost;
  s.stats.goldLost += lost;
  addLog(s, reason, -lost);
  events.push({ type: 'penalty', amount: lost });
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

// Replace one rank's tasks with the player's written lines. A line matching an
// existing task keeps it (and its streak / prayer time); new lines become new tasks.
const PRAYER_WORDS = { fajr: 'فجر', dhuhr: 'ظهر', asr: 'عصر', maghrib: 'مغرب', isha: 'عشاء' };
export const prayerIn = (title) => (/صلا[ةه]|صلي|أصلي/.test(title) ? Object.keys(PRAYER_WORDS).find((k) => title.includes(PRAYER_WORDS[k])) : undefined);

// Lines like "صلاة × 5" or "مشي x2" carry a times-per-day count.
const parseLine = (l) => {
  const m = String(l).replace(/^[\s\-•*+\d.)]+(?=\D)/, '').trim().match(/^(.*?)\s*(?:[×xX*]\s*(\d{1,2}))?$/);
  return { title: (m?.[1] || '').trim(), times: +m?.[2] || 1 };
};
export const MAX_TIMES = 20;
// The five daily prayers as one habit: never less than five times a day.
export const isFivePrayers = (title) => /^(ال)?صل[اوي][ةهت]?$|^الصلوات|صلواتي|(الخمس|5|خمس)\s*صلوات|الصلاة?\s*(الخمس|5)/.test(String(title || '').trim());
const fixTimes = (title, n) => (isFivePrayers(title) ? 5 : Math.max(1, Math.min(MAX_TIMES, Math.round(+n) || 1)));   // the prayers are exactly five
const cleanIcon = (i) => (typeof i === 'string' ? [...i.trim()].slice(0, 4).join('') : '');

export function setRankPlan(s, id, rankIndex, input) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  if (rankIndex < 0 || rankIndex >= RANK_COUNT) return fail('رتبة غير موجودة');
  const items = (Array.isArray(input) ? input : String(input).split('\n').map(parseLine))
    .map((x) => { const title = String(x.title || '').trim().slice(0, 80); return { title, icon: cleanIcon(x.icon), times: fixTimes(title, x.times) }; })
    .filter((x) => x.title);
  const seen = new Set();
  const uniq = items.filter((x) => !seen.has(x.title) && seen.add(x.title)).slice(0, 12);
  const plan = planOf(def, ch).map((r) => r.map((t) => ({ ...t })));
  const known = plan.flat();
  // Prayers already tied to a task in another rank (or earlier in this list).
  const taken = new Set(plan.filter((_, i) => i !== rankIndex).flat().map((t) => t.prayer).filter(Boolean));
  plan[rankIndex] = uniq.map(({ title, times, icon }) => {
    const old = known.find((t) => t.title === title);
    if (old) {
      plan.forEach((r, i) => { if (i !== rankIndex) plan[i] = r.filter((t) => t.id !== old.id); });
      const t = { ...old, times }; if (icon) t.icon = icon;
      if (times > 1) delete t.prayer; else if (old.prayer) taken.add(old.prayer);
      return t;
    }
    // `added`: a habit added today is not held against you when this day closes.
    const t = { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, times, reward: RULES.reward, added: s.sandbox ? null : today() };   // in test mode a new habit counts at once
    if (icon) t.icon = icon;
    // A once-a-day line naming one of the five prayers is tied to that prayer's time (once per plan).
    const pr = times === 1 ? prayerIn(title) : undefined;
    if (pr && !taken.has(pr)) { t.prayer = pr; taken.add(pr); }
    return t;
  });
  ch.plan = plan;
  addLog(s, `✎ ${def.name}: ${RANKS[rankIndex].name}`);
  return done(s, []);
}

// ---------- Habits: one habit per rank ----------
// Each rank brings one new daily habit, chosen by the player when they get there
// (Bronze 1 = the first habit; every promotion with a key adds the next one).
const cleanHabit = (h) => { const title = String(h?.title || '').trim().slice(0, 80); return { title, icon: cleanIcon(h?.icon), times: fixTimes(title, h?.times) }; };

// Change (taskId given) or add a habit in one rank.
export function setHabit(s, id, rankIndex, taskId, habit) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  const h = cleanHabit(habit);
  if (!h.title) return fail('اختار مهمة أو اكتب اسمها');
  const all = activeTasks(def, ch);
  if (all.some((t) => t.title === h.title && t.id !== taskId)) return fail('هاي المهمة عندك أصلًا');
  const list = (planOf(def, ch)[rankIndex] || []).map((t) => ({ title: t.title, times: t.times, icon: t.icon, id: t.id }));
  const i = list.findIndex((t) => t.id === taskId);
  if (i >= 0) list[i] = h; else list.push(h);
  return setRankPlan(s, id, rankIndex, list);
}

// Remove a habit (never the last one left).
export function removeHabit(s, id, taskId) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  if (activeTasks(def, ch).length <= 1) return fail('لازم يضل عندك مهمة وحدة على الأقل');
  ch.plan = planOf(def, ch).map((r) => r.filter((t) => t.id !== taskId));
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

// Full days in a row (shown as a streak).
export function liveProgress(ch, date = today()) {
  const alive = ch.lastPerfectDate && dayDiff(ch.lastPerfectDate, date) <= 1;
  return { perfectStreak: alive ? ch.perfectStreak : 0 };
}

// ---------- Stars ----------
// How much of a dimension's day is done (0..1): every habit counts by its share of
// times (prayer 4/5 = 0.8). Habits added that day don't count. null = nothing to fight with.
export function dayShare(s, id, date = today(), { all = false } = {}) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return null;
  const list = activeTasks(def, ch).filter((t) => all || t.added !== date);
  if (!list.length) return null;
  return list.reduce((a, t) => a + Math.min(1, countToday(taskProgress(s, id, t.id), date) / timesOf(t)), 0) / list.length;
}
export const starsOf = (share) => (share == null ? null : share >= 0.999 ? 3 : share >= 0.666 ? 2 : share >= 0.333 ? 1 : 0);
export const starsToday = (s, id, date = today()) => starsOf(dayShare(s, id, date));

// Called after every task report: if all of today's tasks are done, count a perfect day.
function checkPerfectDay(s, def, ch, date, events) {
  if (ch.lastPerfectDate === date) return;
  const list = activeTasks(def, ch);
  if (!list.length || !list.every((t) => taskComplete(s.tasks[`${def.id}.${t.id}`], date))) return;
  if (!ch.lastPerfectDate || dayDiff(ch.lastPerfectDate, date) > 1) ch.perfectStreak = 0;
  ch.lastPerfectDate = date;
  ch.perfectStreak++;
  s.stats.bestStreak = Math.max(s.stats.bestStreak, ch.perfectStreak);
  events.push({ type: 'perfectDay', streak: ch.perfectStreak });
}

// ---------- Daily character tasks ----------
const taskKey = (charId, taskId) => `${charId}.${taskId}`;

export function taskProgress(s, charId, taskId) {
  return s.tasks[taskKey(charId, taskId)] || { streak: 0, lastDate: null, lastResult: null };
}

// A task may be needed several times a day (`times`). Today's progress lives in
// { lastDate, count, lastResult: 'partial' | 'success' | 'fail' }; `doneDate` is the
// last day it was fully completed (older saves only have lastResult 'success').
export const timesOf = (task) => Math.max(1, task?.times || 1);
export const taskComplete = (p, date) => p?.lastDate === date && p.lastResult === 'success';
// Settled for the day: completed or failed (a partial day is still open).
export const taskDoneToday = (p, date = today()) => p.lastDate === date && p.lastResult !== 'partial';
export const countToday = (p, date = today()) => (p.lastDate !== date ? 0 : p.lastResult === 'partial' ? p.count || 0 : p.lastResult === 'success' ? p.count || 1 : p.count || 0);
const lastDone = (p) => p.doneDate ?? (p.lastResult === 'success' ? p.lastDate : null);

export function currentStreak(p, date = today()) {
  const d = lastDone(p);
  if (!d || p.lastResult === 'fail') return 0;
  return dayDiff(d, date) <= 1 ? p.streak || 0 : 0;
}

// Success: the habit's gold comes once it is fully done for the day (all its times).
// Failure is only marked here; what it costs is settled when the day closes (closeDays).
export function reportTask(s, charId, taskId, success, { date = today() } = {}) {
  const ch = s.characters[charId];
  if (!ch) return fail('الشخصية غير مملوكة');
  const def = findCharacter(charId);
  const task = activeTasks(def, ch).find((t) => t.id === taskId);
  if (!task) return fail('غير موجودة');
  const p = { ...taskProgress(s, charId, taskId) };
  if (taskDoneToday(p, date)) return fail('سجّلت نتيجة اليوم بالفعل');
  const events = [];
  const times = timesOf(task);
  p.doneDate = lastDone(p);
  const count = countToday(p, date) + (success ? 1 : 0);
  if (success) {
    if (count >= times) {
      s.stats.tasksCompleted++;
      gainGold(s, task.reward ?? RULES.reward, `✔ ${task.title}`, events);
      p.streak = currentStreak(p, date) + 1; p.doneDate = date;
    } else events.push({ type: 'step', count, times });
  } else {
    p.streak = 0;
    // Honesty is its own reward: a symbolic count, never anything that can be spent.
    s.stats.honest = (s.stats.honest || 0) + 1;
    addLog(s, `✘ ${task.title} — سجّلتها بصدق`);
    events.push({ type: 'failMark' });
  }
  p.lastDate = date;
  p.count = count;
  p.lastResult = !success ? 'fail' : count >= times ? 'success' : 'partial';
  p.at = Date.now(); // when it was reported (used to reject reports made outside a prayer's time)
  s.tasks[taskKey(charId, taskId)] = p;
  if (p.lastResult === 'success') checkPerfectDay(s, def, ch, date, events);
  return done(s, events);
}

// Cancel a success that should not have counted (e.g. a prayer marked before its
// time began): remove the record and take back its gold and any perfect day.
export function revokeTask(s, charId, taskId, date) {
  const key = taskKey(charId, taskId);
  const p = s.tasks[key];
  const ch = s.characters[charId];
  if (!p || !ch || p.lastDate !== date || p.lastResult !== 'success') return false;
  const task = activeTasks(findCharacter(charId), ch).find((t) => t.id === taskId);
  delete s.tasks[key];
  const back = Math.min(s.gold, task?.reward ?? RULES.reward);
  s.gold -= back;
  s.stats.goldEarned = Math.max(0, s.stats.goldEarned - back);
  s.stats.tasksCompleted = Math.max(0, s.stats.tasksCompleted - 1);
  if (ch.lastPerfectDate === date) {
    ch.perfectStreak = Math.max(0, ch.perfectStreak - 1);
    const prev = new Date(date);
    prev.setUTCDate(prev.getUTCDate() - 1);
    ch.lastPerfectDate = ch.perfectStreak ? prev.toISOString().slice(0, 10) : null;
  }
  addLog(s, `↩ أُلغي: ${task?.title ?? taskId} (سُجّلت قبل وقتها)`, -back);
  return true;
}

// ---------- End of day ----------
// When the game day closes (3 at night) every dimension's stars for that day are counted
// (days the game was not opened count as 0) and habits left undone are marked missed.
// Returns what happened, for the morning summary.
export function closeDays(s, now = today()) {
  const last = s.lastDay;
  s.lastDay = now;
  const rep = { days: 0, missed: [], stars: [] };
  if (!last || last >= now) return rep;
  let d = last;
  for (let n = 0; d < now && n < 60; n++, d = nextDay(d)) {
    rep.days++;
    let active = false;
    for (const def of CHARACTERS) {
      const ch = s.characters[def.id];
      const share = ch && dayShare(s, def.id, d);
      if (share == null) continue;
      for (const t of activeTasks(def, ch)) {
        const k = taskKey(def.id, t.id), p = taskProgress(s, def.id, t.id);
        if (t.added === d || taskComplete(p, d) || (p.lastDate && p.lastDate > d)) continue;
        if (!(p.lastDate === d && p.lastResult === 'fail')) s.stats.tasksFailed++;
        s.tasks[k] = { ...p, lastDate: d, lastResult: 'fail', count: p.lastDate === d ? p.count || 0 : 0, streak: 0 };
        if (!rep.missed.includes(t.title)) rep.missed.push(t.title);
      }
      const st = starsOf(share);
      if (st > 0) active = true;
      rep.stars.push({ id: def.id, name: def.name, date: d, stars: st, share });
    }
    if (active) s.stats.activeDays = (s.stats.activeDays || 0) + 1;   // days with at least one star (cups open at CUP_DAYS)
  }
  return rep;
}

// Set the overall level (1 = the first rank).
function setLevel(ch, n) { ch.stage = Math.floor((n - 1) / 5); ch.level = ((n - 1) % 5) + 1; }

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
  const build = CHARACTERS.filter((c) => c.stages && s.characters[c.id] && activeTasks(c, s.characters[c.id]).length && totalLevel(s.characters[c.id]) < RANK_COUNT).map((c) => c.id);
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
    const n = totalLevel(ch);
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
export const nextRegionUpgrade = (s, id) => {
  const def = findRegion(id);
  const r = s.regions[id];
  return def && r ? def.upgrades.find((u) => u.level === r.level + 1) ?? null : null;
};

export const regionFeatures = (s, id) => {
  const def = findRegion(id);
  const lvl = s.regions[id]?.level ?? 0;
  return new Set(def.upgrades.filter((u) => u.level <= lvl).map((u) => u.adds));
};

export function upgradeRegion(s, id) {
  const up = nextRegionUpgrade(s, id);
  if (!up) return fail('لا يوجد تطوير متاح');
  if (s.gold < up.cost) return fail('ذهب غير كافٍ');
  const events = [];
  s.gold -= up.cost;
  s.regions[id].level = up.level;
  addLog(s, `🏗 ${up.label}`, -up.cost);
  events.push({ type: 'levelUp', kind: 'region', name: findRegion(id).name, level: up.level, label: up.label });
  return done(s, events);
}

// ---------- World map ----------
// Visible: owned places. Teaser: a locked place whose `revealedBy` place is owned.
// Everything else stays under fog.
export function mapVisibility(s, region) {
  if (region.kind === 'leaders') return 'teaser';   // always on the map; it opens when the ship is ready (islandOpen)
  if (s.regions[region.id]) return 'owned';
  const by = region.map?.revealedBy;
  return by && s.regions[by] ? 'teaser' : 'hidden';
}

// ---------- Starting data ----------
// Test mode: everything open, gold to spare, one habit a dimension — the player
// spends them to see how things change. The real save waits inside and comes back on exit.
export const SANDBOX = { gold: 99999 };
export function enterSandbox(real) {
  const t = newState();
  for (const c of CHARACTERS) t.characters[c.id] = newCharacter();
  for (const r of REGIONS) if (r.kind !== 'leaders') t.regions[r.id] = { level: 1 };
  t.gold = SANDBOX.gold; t.startDay = addDays(today(), -7);
  t.location = real.location;
  t.sandbox = { backup: JSON.stringify({ ...real, sandbox: undefined }) };
  addLog(t, '🧪 وضع التجربة');
  return t;
}
export function refillSandbox(s) { if (s.sandbox) s.gold = Math.max(s.gold, SANDBOX.gold); }
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
  if (phase === 'done') { s.story.jailed = false; s.story.escaped = true; addLog(s, '😈 لوسيفير هرب من القفص'); }
  return done(s, []);
}
// The island appears on the map once the commander has seen it through the spyglass.
export const islandSeen = (s) => ['back', 'done'].includes(s.story?.phase);

// A brand-new game (first visit or "start over"): it begins with the guided first steps.
export function demoState() {
  const s = newState();
  s.tour = 0;
  s.startDay = today();
  s.gold = 100;
  s.stats.goldEarned = 100;
  addLog(s, 'مرحبًا بك في No Means No', 100);
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
