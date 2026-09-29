// Pure game logic. No DOM, no storage. Every action takes the state and
// returns { ok, events } after mutating state in place; the UI turns events
// into effects (gold burst, level-up, unlock).
import { CHARACTERS, REGIONS, RANKS } from './content.js';

export const SAVE_VERSION = 3;

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
const newCharacter = () => ({ stage: 0, level: 1 });
const newDay = () => ({ goal: null, streak: 0, keyDays: 0, lastFullDate: null });

export function newState() {
  const s = {
    version: SAVE_VERSION,
    gold: 0,
    keys: 0,
    stats: { goldEarned: 0, goldLost: 0, tasksCompleted: 0, tasksFailed: 0, bestStreak: 0, keysEarned: 0 },
    characters: {},
    regions: {},
    day: newDay(),
    intro: 0, // onboarding step reached (see app.js)
    tasks: {}, // progress per task: `${characterId}.${taskId}` -> { streak, lastDate, lastResult }
    log: [],
  };
  for (const c of CHARACTERS.filter((c) => c.starter)) s.characters[c.id] = newCharacter();
  for (const r of REGIONS.filter((r) => r.starter)) s.regions[r.id] = { level: 1 };
  return s;
}

// Fill in anything missing from older saves so content additions never break a save.
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
  s.day = { ...newDay(), ...(raw.day || {}) };
  delete s.habits; delete s.projects; delete s.activeCharacter;
  s.log = Array.isArray(raw.log) ? raw.log : [];
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
      if (item.starter || s.seenUnlocks[key]) continue;
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

export function setRankPlan(s, id, rankIndex, text) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def || !ch) return fail('غير مملوكة');
  if (rankIndex < 0 || rankIndex >= RANK_COUNT) return fail('رتبة غير موجودة');
  const lines = String(text).split('\n').map((l) => l.replace(/^[\s\-•*+\d.)]+/, '').trim().slice(0, 80)).filter(Boolean);
  const uniq = [...new Set(lines)].slice(0, 12);
  const plan = planOf(def, ch).map((r) => r.map((t) => ({ ...t })));
  const known = plan.flat();
  // Prayers already tied to a task in another rank (or earlier in this list).
  const taken = new Set(plan.filter((_, i) => i !== rankIndex).flat().map((t) => t.prayer).filter(Boolean));
  plan[rankIndex] = uniq.map((title) => {
    const old = known.find((t) => t.title === title);
    if (old) { if (old.prayer) taken.add(old.prayer); plan.forEach((r, i) => { if (i !== rankIndex) plan[i] = r.filter((t) => t.id !== old.id); }); return old; }
    const t = { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, reward: 20, penalty: 10 };
    // A line naming one of the five prayers is tied to that prayer's time (once per plan).
    const pr = prayerIn(title);
    if (pr && !taken.has(pr)) { t.prayer = pr; taken.add(pr); }
    return t;
  });
  ch.plan = plan;
  addLog(s, `✎ ${def.name}: ${RANKS[rankIndex].name}`);
  return done(s, []);
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

// ---------- The day (shared by every dimension) ----------
// A "full day" = the player finished at least `goal` of today's tasks (the player
// picks the number). Every KEY_EVERY full days in a row earn one key.
export const KEY_EVERY = 15;
export const allTodayTasks = (s) => CHARACTERS.filter((c) => s.characters[c.id])
  .flatMap((c) => activeTasks(c, s.characters[c.id]).map((t) => ({ ...t, charId: c.id, charName: c.name, regionId: c.regionId })));
export const dayGoal = (s) => {
  const total = allTodayTasks(s).length;
  return Math.max(1, Math.min(total || 1, s.day?.goal || total || 1));
};
export function doneToday(s, date = today()) {
  return allTodayTasks(s).filter((t) => {
    const p = s.tasks[`${t.charId}.${t.id}`];
    return p?.lastDate === date && p.lastResult === 'success';
  }).length;
}
export function setDayGoal(s, n) {
  const total = allTodayTasks(s).length;
  s.day.goal = Math.max(1, Math.min(total, Math.round(+n) || 1));
  return done(s, []);
}
// Chain values shown to the player: they reset silently after a day without a full day.
export function dayProgress(s, date = today()) {
  const d = s.day;
  const alive = d.lastFullDate && dayDiff(d.lastFullDate, date) <= 1;
  return { streak: alive ? d.streak : 0, keyDays: alive ? d.keyDays : 0, fullToday: d.lastFullDate === date, done: doneToday(s, date), goal: dayGoal(s) };
}

function checkFullDay(s, date, events) {
  const d = s.day;
  if (d.lastFullDate === date || doneToday(s, date) < dayGoal(s)) return;
  if (!d.lastFullDate || dayDiff(d.lastFullDate, date) > 1) { d.streak = 0; d.keyDays = 0; }
  d.lastFullDate = date;
  d.streak++;
  s.stats.bestStreak = Math.max(s.stats.bestStreak, d.streak);
  events.push({ type: 'perfectDay', streak: d.streak });
  d.keyDays++;
  if (d.keyDays >= KEY_EVERY) {
    d.keyDays = 0;
    s.keys++;
    s.stats.keysEarned++;
    addLog(s, '🗝 مفتاح جديد');
    events.push({ type: 'key' });
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

export const taskDoneToday = (p, date = today()) => p.lastDate === date;

export function currentStreak(p, date = today()) {
  if (!p.lastDate || p.lastResult !== 'success') return 0;
  return dayDiff(p.lastDate, date) <= 1 ? p.streak : 0;
}

export function reportTask(s, charId, taskId, success, { applyPenalty = true, date = today() } = {}) {
  const ch = s.characters[charId];
  if (!ch) return fail('الشخصية غير مملوكة');
  const def = findCharacter(charId);
  const task = activeTasks(def, ch).find((t) => t.id === taskId);
  if (!task) return fail('غير موجودة');
  const p = { ...taskProgress(s, charId, taskId) };
  if (taskDoneToday(p, date)) return fail('سجّلت نتيجة اليوم بالفعل');
  const events = [];
  if (success) {
    p.streak = currentStreak(p, date) + 1;
    s.stats.tasksCompleted++;
    gainGold(s, task.reward, `✔ ${task.title}`, events);
  } else {
    p.streak = 0;
    s.stats.tasksFailed++;
    ch.defeat = { level: totalLevel(ch), date }; // a crushing defeat at this level (see warStatus)
    if (applyPenalty && task.penalty > 0) loseGold(s, task.penalty, `✘ ${task.title}`, events);
    else addLog(s, `✘ ${task.title} (بدون عقوبة)`);
  }
  p.lastDate = date;
  p.lastResult = success ? 'success' : 'fail';
  p.at = Date.now(); // when it was reported (used to reject reports made outside a prayer's time)
  s.tasks[taskKey(charId, taskId)] = p;
  if (success) checkFullDay(s, date, events);
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
  const back = Math.min(s.gold, task?.reward || 0);
  s.gold -= back;
  s.stats.goldEarned = Math.max(0, s.stats.goldEarned - back);
  s.stats.tasksCompleted = Math.max(0, s.stats.tasksCompleted - 1);
  const d = s.day;
  if (d.lastFullDate === date && doneToday(s, date) < dayGoal(s)) {
    d.streak = Math.max(0, d.streak - 1);
    d.keyDays = Math.max(0, d.keyDays - 1);
    const prev = new Date(date);
    prev.setUTCDate(prev.getUTCDate() - 1);
    d.lastFullDate = d.streak ? prev.toISOString().slice(0, 10) : null;
  }
  addLog(s, `↩ أُلغي: ${task?.title ?? taskId} (سُجّلت قبل وقتها)`, -back);
  return true;
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
// Systems that appear step by step, so a new player starts with just the day's tasks.
export const FEATURES = {
  hq: { when: (s) => (s.stats.keysEarned || 0) >= 1, title: 'انفتح مقر القيادة 🏰', text: 'أخذت أول مفتاح! من المقر بتشوف رتبتك العامة وخريطة الحرب لكل الأبعاد.' },
  trophies: { when: (s) => REGIONS.filter((r) => r.characterId && s.regions[r.id]).length >= 2, title: 'انفتحت جزيرة الكؤوس 🏆', text: 'فتحت بعد ثاني! بالجزيرة بتتحدى حالك مع شخص تثق فيه وبتربح كؤوس ومفاتيح.' },
};
export const featureOpen = (s, id) => !FEATURES[id] || FEATURES[id].when(s);

export function mapVisibility(s, region) {
  if (!featureOpen(s, region.id)) return 'hidden';
  if (s.regions[region.id]) return 'owned';
  const by = region.map?.revealedBy;
  return by && s.regions[by] ? 'teaser' : 'hidden';
}

// ---------- Starting data ----------
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
