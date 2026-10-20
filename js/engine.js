// Pure game logic. No DOM, no storage. Every action takes the state and
// returns { ok, events } after mutating state in place; the UI turns events
// into effects (gold burst, level-up, unlock).
import { CHARACTERS, REGIONS, RANKS } from './content.js';

export const SAVE_VERSION = 4;

// The rules of the game, in one place.
//   keyDays    full days in a row (every habit of a dimension done) → one key
//   dayEnds    the game day closes at 3 at night, not at midnight
//   shield     🛡 bought with gold; a day you miss uses one and nothing is lost
//   dropAfter  failed days in a row (no shield) → the dimension drops one rank
//   reward / penalty: gold for a habit fully done / taken for each habit left undone
export const RULES = { keyDays: 7, dayEnds: 3, shieldCost: 150, maxShields: 3, dropAfter: 3, reward: 20, penalty: 10 };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = (d = new Date()) => ymd(new Date(+d - RULES.dayEnds * 3600000));
const nextDay = (date) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

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

// ---------- Costs ({ gold?, keys? }) ----------
export const canAfford = (s, cost = {}) => s.gold >= (cost.gold || 0) && s.keys >= (cost.keys || 0);
function pay(s, cost = {}) { s.gold -= cost.gold || 0; s.keys -= cost.keys || 0; }
export const costText = (cost = {}) =>
  [cost.keys ? `🗝 ${cost.keys}` : '', cost.gold ? `🪙 ${cost.gold}` : ''].filter(Boolean).join(' + ') || 'مجاني';

// Shop status for any item (character or region).
export function shopStatus(state, kind, item) {
  const owned = kind === 'character' ? !!state.characters[item.id] : !!state.regions[item.id];
  const conditions = evaluateAll(state, item.requires);
  const conditionsMet = conditions.every((c) => c.met);
  const affordable = canAfford(state, item.cost);
  return { owned, conditions, conditionsMet, affordable, canBuy: !owned && conditionsMet && affordable };
}

// ---------- State ----------
const newCharacter = () => ({ stage: 0, level: 1, perfectStreak: 0, lastPerfectDate: null, keyDays: 0, levelDays: 0, levelReady: false, strikes: 0 });

export function newState() {
  const s = {
    version: SAVE_VERSION,
    gold: 0,
    keys: 0,
    shields: 1,
    stats: { goldEarned: 0, goldLost: 0, tasksCompleted: 0, tasksFailed: 0, bestStreak: 0, keysEarned: 0 },
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
  for (const id in s.characters) s.characters[id] = { ...newCharacter(), ...s.characters[id] };
  s.regions = { ...base.regions, ...(raw.regions || {}) };
  s.tasks = raw.tasks && typeof raw.tasks === 'object' ? raw.tasks : {};
  s.keys = +raw.keys || 0;
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
  // v4: the ship grows from full days (8 a part), not from single tasks (6 a part).
  if ((raw.version || 1) < 4) s.story.ship = Math.floor((s.story.ship || 0) / 6) * SHIP.per;
  s.shields = Math.max(0, Math.min(RULES.maxShields, raw.shields ?? 1));
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

// After any change, report newly-available shop items once.
function checkUnlocks(s, events) {
  s.seenUnlocks ||= {};
  for (const [kind, list] of [['character', CHARACTERS], ['region', REGIONS]]) {
    for (const item of list) {
      const key = `${kind}:${item.id}`;
      if (item.starter || item.kind === 'leaders' || s.seenUnlocks[key]) continue;
      const st = shopStatus(s, kind, item);
      if (!st.owned && st.canBuy) {
        s.seenUnlocks[key] = true;
        events.push({ type: 'available', kind, id: item.id, name: item.name });
      }
    }
  }
}

const done = (s, events) => { checkUnlocks(s, events); return { ok: true, events }; };
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
    const t = { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, times, reward: RULES.reward, penalty: RULES.penalty, added: today() };
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

// Promotion: one key → next rank, and the habit chosen for it joins the daily tasks.
export function promoteWith(s, id, habit) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  const next = nextLevel(def, ch);
  if (!next || next.max) return fail('وصلت أعلى رتبة 🏆');
  if ((s.keys || 0) < 1) return fail('بدك مفتاح 🗝 عشان تترقّى');
  const h = cleanHabit(habit);
  if (!h.title) return fail('اختار العادة الجديدة');
  if (activeTasks(def, ch).some((t) => t.title === h.title)) return fail('هاي المهمة عندك أصلًا');
  const n = totalLevel(ch);
  const r = setRankPlan(s, id, n, [h]);
  if (!r.ok) return r;
  return levelUpCharacter(s, id);
}

// Where a character stands on the key → rank road, in one object for the UI.
export function road(s, id, date = today()) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def?.stages || !ch) return null;
  const n = totalLevel(ch), next = RANKS[n];
  return {
    rank: RANKS[n - 1], next, keyDays: liveProgress(ch, date).keyDays, every: RULES.keyDays, strikes: ch.strikes || 0,
    keys: s.keys || 0, canPromote: !!next && (s.keys || 0) > 0 && activeTasks(def, ch).length > 0, habits: activeTasks(def, ch).length,
  };
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

// Streak values shown to the player: they reset silently after a skipped day.
export function liveProgress(ch, date = today()) {
  const alive = ch.lastPerfectDate && dayDiff(ch.lastPerfectDate, date) <= 1;
  return alive
    ? { perfectStreak: ch.perfectStreak, keyDays: ch.keyDays, levelDays: ch.levelDays }
    : { perfectStreak: 0, keyDays: 0, levelDays: 0 };
}

function breakChain(ch) {
  ch.perfectStreak = 0;
  ch.keyDays = 0;
  ch.levelDays = 0;
}

// Called after every task report: if all of today's tasks are done, count a perfect day.
function checkPerfectDay(s, def, ch, date, events) {
  if (ch.lastPerfectDate === date) return;
  const list = activeTasks(def, ch);
  if (!list.length || !list.every((t) => taskComplete(s.tasks[`${def.id}.${t.id}`], date))) return;
  if (!ch.lastPerfectDate || dayDiff(ch.lastPerfectDate, date) > 1) breakChain(ch);
  ch.lastPerfectDate = date;
  ch.perfectStreak++;
  ch.strikes = 0;
  if (s.story?.speech) s.story.ship = (s.story.ship || 0) + 1;   // every full day adds to the warriors' ship
  s.stats.bestStreak = Math.max(s.stats.bestStreak, ch.perfectStreak);
  events.push({ type: 'perfectDay', streak: ch.perfectStreak });
  {
    ch.keyDays++;
    if (ch.keyDays >= RULES.keyDays) {
      ch.keyDays = 0;
      s.keys++;
      s.stats.keysEarned++;
      addLog(s, `🗝 مفتاح جديد من ${def.name}`);
      events.push({ type: 'key', from: def.name });
    }
  }
}

// Raise to the next rank: costs one key.
export function levelUpCharacter(s, id) {
  const def = findCharacter(id);
  const ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  const next = nextLevel(def, ch);
  if (!next) return fail('لا مستويات لهذه الشخصية');
  if (next.max) return fail('أعلى مستوى');
  if (!next.adds.length) return fail('اكتب مهام هذه الرتبة أولًا ✎');
  if ((s.keys || 0) < 1) return fail('تحتاج مفتاحًا 🗝 لرفع الرتبة');
  s.keys--;
  ch.stage = next.stage;
  ch.level = next.level;
  ch.levelReady = false;
  ch.levelDays = 0;
  const stageName = rankName(ch);
  addLog(s, `⬆ ${def.name} → ${stageName}`);
  const events = [{ type: 'rank', name: def.name, rank: stageName }];
  return done(s, events);
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
    addLog(s, `✘ ${task.title} — بتنحسب عليك لما يخلص اليوم`);
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
    ch.keyDays = Math.max(0, ch.keyDays - 1);
    if (!ch.levelReady) ch.levelDays = Math.max(0, ch.levelDays - 1);
    const prev = new Date(date);
    prev.setUTCDate(prev.getUTCDate() - 1);
    ch.lastPerfectDate = ch.perfectStreak ? prev.toISOString().slice(0, 10) : null;
  }
  addLog(s, `↩ أُلغي: ${task?.title ?? taskId} (سُجّلت قبل وقتها)`, -back);
  return true;
}

// ---------- End of day ----------
// When the game day closes (3 at night), every dimension whose habits were not all
// done that day has lost the day — including days the game was not opened:
//   • with a shield 🛡: the shield is used and nothing is lost (one shield covers the whole day);
//   • without: −penalty gold for each undone habit, the key counter restarts, and after
//     RULES.dropAfter lost days in a row the dimension drops one rank.
// Returns what happened, for the morning report.
export function closeDays(s, now = today()) {
  const last = s.lastDay;
  s.lastDay = now;
  const rep = { days: 0, missed: [], shielded: 0, gold: 0, dropped: [], strikes: [] };
  if (!last || last >= now) return rep;
  let d = last;
  for (let n = 0; d < now && n < 60; n++, d = nextDay(d)) {
    rep.days++;
    const lost = [];
    for (const def of CHARACTERS) {
      const ch = s.characters[def.id];
      if (!ch) continue;
      const undone = activeTasks(def, ch).filter((t) => {
        const p = taskProgress(s, def.id, t.id);
        return t.added !== d && !taskComplete(p, d) && !(p.lastDate && p.lastDate > d);
      });
      if (undone.length) lost.push({ def, ch, undone });
    }
    if (!lost.length) continue;
    for (const { def, undone } of lost) for (const t of undone) {
      const k = taskKey(def.id, t.id), p = { ...taskProgress(s, def.id, t.id) };
      if (!(p.lastDate === d && p.lastResult === 'fail')) s.stats.tasksFailed++;
      s.tasks[k] = { ...p, lastDate: d, lastResult: 'fail', count: p.lastDate === d ? p.count || 0 : 0, streak: 0 };
      if (!rep.missed.includes(t.title)) rep.missed.push(t.title);
    }
    if ((s.shields || 0) > 0) {
      s.shields--;
      rep.shielded++;
      // The chain carries on over a shielded day (it counts as neither won nor lost).
      for (const { ch } of lost) if (ch.lastPerfectDate && dayDiff(ch.lastPerfectDate, d) <= 1) ch.lastPerfectDate = d;
      addLog(s, `🛡 الدرع حماك يوم ${d}`);
      continue;
    }
    for (const { def, ch, undone } of lost) {
      const fine = Math.min(s.gold, undone.reduce((a, t) => a + (t.penalty ?? RULES.penalty), 0));
      s.gold -= fine; s.stats.goldLost += fine; rep.gold += fine;
      addLog(s, `✘ ${def.name}: ${undone.length} مهام ما خلصت`, -fine);
      breakChain(ch);
      ch.defeat = { level: totalLevel(ch), date: d };   // a crushing defeat at this level (see warStatus)
      ch.strikes = (ch.strikes || 0) + 1;
      rep.strikes = rep.strikes.filter((x) => x.name !== def.name);   // the latest count per dimension
      if (ch.strikes >= RULES.dropAfter) {
        ch.strikes = 0;
        if (demote(ch)) { rep.dropped.push(`${def.name} ← ${rankName(ch)}`); addLog(s, `⬇ ${def.name} نزل لـ ${rankName(ch)}`); }
      } else rep.strikes.push({ name: def.name, strikes: ch.strikes });
    }
  }
  return rep;
}

// One rank down (never below Bronze 1). Its habit stays written, and comes back with the next key.
function demote(ch) {
  const n = totalLevel(ch) - 1;
  if (n < 1) return false;
  ch.stage = Math.floor((n - 1) / 5); ch.level = ((n - 1) % 5) + 1;
  ch.defeat = null;
  return true;
}

// ---------- Shields ----------
export function buyShield(s) {
  if ((s.shields || 0) >= RULES.maxShields) return fail(`معك ${RULES.maxShields} دروع، هاد الحد الأقصى`);
  if (s.gold < RULES.shieldCost) return fail('ذهب غير كافٍ');
  s.gold -= RULES.shieldCost;
  s.shields = (s.shields || 0) + 1;
  addLog(s, '🛡 درع جديد', -RULES.shieldCost);
  return done(s, [{ type: 'shield' }]);
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

export function buy(s, kind, id) {
  const item = kind === 'character' ? findCharacter(id) : findRegion(id);
  if (!item) return fail('غير موجود');
  if (item.kind === 'leaders') return fail('بتوصلها بالسفينة بس 🚢');
  const st = shopStatus(s, kind, item);
  if (st.owned) return fail('مملوك بالفعل');
  if (!st.conditionsMet) return fail('الشروط غير مكتملة');
  if (!st.affordable) return fail(item.cost?.keys ? 'تحتاج مفتاحًا' : 'ذهب غير كافٍ');
  const events = [];
  pay(s, item.cost);
  if (kind === 'character') s.characters[id] = newCharacter();
  else {
    s.regions[id] = { level: 1 };
    // Opening a place also brings its character.
    if (item.characterId && !s.characters[item.characterId]) s.characters[item.characterId] = newCharacter();
  }
  addLog(s, `🔓 ${item.name}`, -(item.cost?.gold || 0));
  events.push({ type: 'unlock', kind, id, name: item.name });
  return done(s, events);
}

// ---------- World map ----------
// Visible: owned places. Teaser: a locked place whose `revealedBy` place is owned.
// Everything else stays under fog.
export function mapVisibility(s, region) {
  if (region.kind === 'leaders') return islandSeen(s) ? 'teaser' : 'hidden';   // appears after the commander's speech, closed
  if (s.regions[region.id]) return 'owned';
  const by = region.map?.revealedBy;
  return by && s.regions[by] ? 'teaser' : 'hidden';
}

// ---------- Starting data ----------
// Test mode: everything open, keys and gold to spare, nothing upgraded — the player
// spends them to see how things change. The real save waits inside and comes back on exit.
export const SANDBOX = { keys: 99, gold: 99999 };
export function enterSandbox(real) {
  const t = newState();
  for (const c of CHARACTERS) t.characters[c.id] = newCharacter();
  for (const r of REGIONS) if (r.kind !== 'leaders') t.regions[r.id] = { level: 1 };
  t.keys = SANDBOX.keys; t.gold = SANDBOX.gold;
  t.location = real.location;
  t.sandbox = { backup: JSON.stringify({ ...real, sandbox: undefined }) };
  addLog(t, '🧪 وضع التجربة');
  return t;
}
export function refillSandbox(s) { if (s.sandbox) { s.keys = Math.max(s.keys, SANDBOX.keys); s.gold = Math.max(s.gold, SANDBOX.gold); } }
export function leaveSandbox(s) { return s.sandbox ? migrate(JSON.parse(s.sandbox.backup)) : s; }

// ---------- The story: the speech, Lucifer locked away, the ship ----------
// The ship to the Island of Leaders grows one part every SHIP.per full days (any dimension) after the speech.
export const SHIP = { parts: 12, per: 8 };
export const shipStage = (s) => Math.min(SHIP.parts, Math.floor((s.story?.ship || 0) / SHIP.per));
// Story phases: none → march (walk the warriors down to the shore) → back (after the
// spyglass, walk them home) → done (the cage is found locked and empty: Lucifer escaped).
export function finishSpeech(s) {
  s.story = { ...(s.story || {}), speech: true, jailed: true, ship: s.story?.ship || 0, phase: 'march' };
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

export function demoState() {
  const s = newState();
  s.gold = 100;
  s.stats.goldEarned = 100;
  addLog(s, 'مرحبًا بك في No Means No', 100);
  return s;
}

// ---------- War map (خريطة الحرب) ----------
// Overall level of a character: 5 levels per stage.
export const totalLevel = (ch) => (ch.stage || 0) * 5 + (ch.level || 1);
// Each level is a rank: level 1 = Bronze 1, level 2 = Bronze 2 … level 12 = Platinum 3.
export const rankName = (ch) => RANKS[totalLevel(ch) - 1]?.name || `مستوى ${totalLevel(ch)}`;
export const rankColor = (ch) => RANKS[totalLevel(ch) - 1]?.color || '#3f7d6e';

// coming  — the place is not opened yet (حرب قادمة)
// ongoing — opened, no defeat recorded (حرب مستمرة)
// crushed — a missed task zeroed the counter at level L, and the character is still at ≤ L (هزيمة ساحقة)
// fierce  — recovered from a defeat by reaching level L + 1 (حرب طاحنة)
export function warStatus(s, region) {
  if (!s.regions[region.id]) return { id: 'coming' };
  const ch = region.characterId && s.characters[region.characterId];
  if (!ch) return { id: 'coming' };
  const lvl = totalLevel(ch);
  if (!ch.defeat) return { id: 'ongoing', level: lvl };
  if (lvl <= ch.defeat.level) return { id: 'crushed', level: lvl, defeatLevel: ch.defeat.level, need: ch.defeat.level + 1 };
  return { id: 'fierce', level: lvl, defeatLevel: ch.defeat.level };
}
