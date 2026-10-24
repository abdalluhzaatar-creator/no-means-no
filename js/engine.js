// Pure game logic. No DOM, no storage. Every action takes the state and
// returns { ok, events } after mutating state in place; the UI turns events
// into effects (gold burst, level-up, unlock).
import { CHARACTERS, REGIONS, RANKS, KINGS } from './content.js';

export const SAVE_VERSION = 5;

// The rules of the game, in one place (a Clash of Clans–style loop):
//   every day      each dimension attacks its dark king: ⭐ ⅓ of its habits done, ⭐⭐ ⅔, ⭐⭐⭐ all
//   dayEnds        the game day closes at 3 at night, not at midnight
//   every week     Saturday → Friday, each dimension fights its own war: warWin of 21 stars wins a key
//                  (its first war needs firstWarWin). Until its first Saturday a dimension trains: stars only.
//   a strong loss  ¾ of the stars needed = half a key
//   0 stars a day  a shield 🛡 (if one is left) turns it into ⭐ — once a week per dimension;
//                  otherwise Lucifer raids: one raid a day, raidPct of the gold (at most raidMax) and raidMedals 🎖
//   fallAfter      zero days in a row in one dimension → its front falls: its war this week is lost
//   dropAfter      lost wars in a row → that dimension drops one rank (never below Bronze 1);
//                  its next war won brings the rank back. The commander's rank never drops.
//   reward         gold for a habit fully done; medalsPerStar 🎖 for every star in a war (they climb the leagues)
export const RULES = {
  dayEnds: 3, reward: 20, warWin: 12, firstWarWin: 9, raidPct: 0.05, raidMax: 300, raidMedals: 30, medalsPerStar: 10,
  fallAfter: 3, dropAfter: 3, shieldCost: 150, maxShields: 3, warLoot: 100, lootPerStar: 10,
};
// Leagues by medals 🎖: a higher league adds to every war's loot and to the month's season prize.
export const LEAGUES = [
  { name: 'برونز', min: 0, color: '#b0743f' }, { name: 'فضة', min: 600, color: '#9aa4ad' }, { name: 'ذهب', min: 1600, color: '#d4a72c' },
  { name: 'كريستال', min: 3200, color: '#b77be0' }, { name: 'ماستر', min: 5600, color: '#4c5d6b' }, { name: 'بطل', min: 9000, color: '#c0392b' },
  { name: 'تيتان', min: 14000, color: '#3a7bd5' }, { name: 'أسطورة', min: 20000, color: '#9b59d0' },
];
export const leagueOf = (medals = 0) => { let i = 0; LEAGUES.forEach((l, k) => { if (medals >= l.min) i = k; }); return { ...LEAGUES[i], index: i, next: LEAGUES[i + 1] || null, season: 100 * (i + 1) }; };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Test mode can move its own calendar forward (setDayShift) to try a day's close at once.
let dayShift = 0;
export const setDayShift = (n) => { dayShift = n || 0; };
export const today = (d = new Date()) => ymd(new Date(+d - RULES.dayEnds * 3600000 + dayShift * 86400000));
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nextDay = (date) => addDays(date, 1);
const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();   // 5 = Friday, 6 = Saturday
export const warStart = (date) => addDays(date, -((weekday(date) + 1) % 7));   // the Saturday a war began

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
const newCharacter = () => ({ stage: 0, level: 1, perfectStreak: 0, lastPerfectDate: null, levelDays: 0, levelReady: false, war: null, wars: 0, losses: 0, zeroRun: 0, restore: null });

export function newState() {
  const s = {
    version: SAVE_VERSION,
    gold: 0,
    keys: 0,
    shields: 1,
    medals: 0,
    keyHalves: 0,
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
  // The ship's parts carry over: v3 counted 6 tasks a part, v4 8 full days a part, v5 one war won a part.
  if ((raw.version || 1) < 4) s.story.ship = Math.floor((s.story.ship || 0) / 6) * SHIP.per;
  else if (raw.version < 5) s.story.ship = Math.floor((s.story.ship || 0) / 8) * SHIP.per;
  s.medals = Math.max(0, +raw.medals || 0); s.keyHalves = +raw.keyHalves || 0;
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

// Where a character stands: rank, keys, and this week's war, in one object for the UI.
export function road(s, id, date = today()) {
  const def = findCharacter(id), ch = s.characters[id];
  if (!def?.stages || !ch) return null;
  const n = totalLevel(ch), next = RANKS[n];
  return {
    rank: RANKS[n - 1], next, war: warView(s, id, date),
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

// Full days in a row (shown as a streak; it no longer gives keys — wars do).
export function liveProgress(ch, date = today()) {
  const alive = ch.lastPerfectDate && dayDiff(ch.lastPerfectDate, date) <= 1;
  return { perfectStreak: alive ? ch.perfectStreak : 0 };
}

// ---------- Stars and the weekly war ----------
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

// A war always runs Saturday → Friday.
const newWar = (ch, date) => ({ start: warStart(date), stars: [], first: !(ch.wars > 0), fallen: false, shield: false });
export const warNeed = (w) => (w.first ? RULES.firstWarWin : RULES.warWin);

// This week's war for the UI: stars banked, today's live stars, what is needed, days left.
// training: the dimension's first war starts on the coming Saturday (inDays away).
export function warView(s, id, date = today()) {
  const ch = s.characters[id];
  const share = dayShare(s, id, date, { all: true });   // today's stars as the player sees them (a habit added today included)
  if (!ch || share == null) return null;
  const king = KINGS[findCharacter(id).regionId], now = starsOf(share);
  // On Saturday the new war is already on (it is stored when Saturday closes).
  const w = ch.war && ch.war.start === warStart(date) ? ch.war : weekday(date) === 6 ? newWar(ch, date) : null;
  if (!w) return { training: true, today: now, inDays: 7 - dayDiff(warStart(date), date), king, losses: ch.losses || 0, restore: ch.restore };
  const banked = w.stars.reduce((a, x) => a + (x || 0), 0), need = warNeed(w);
  const day = dayDiff(w.start, date), left = 6 - day;   // days after today
  const pace = Math.ceil((need * (day + 1)) / 7);
  return { stars: banked, today: now, total: banked + now, need, left, day, days: w.stars, max: banked + now + left * 3, fallen: w.fallen, zeroRun: ch.zeroRun || 0,
    shieldUsed: w.shield, losses: ch.losses || 0, restore: ch.restore, ahead: !w.fallen && banked + now >= pace, won: banked + now >= need && !w.fallen, lost: w.fallen || banked + now + left * 3 < need, king };
}

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
// When the game day closes (3 at night) every dimension banks its stars into this
// week's war — days the game was not opened count as 0 stars. A 0-star day uses a
// shield or brings Lucifer's raid (one a day). Friday's close ends the war.
// Returns what happened, for the morning report.
export function closeDays(s, now = today()) {
  const last = s.lastDay;
  s.lastDay = now;
  const rep = { days: 0, missed: [], stars: [], raids: [], shielded: 0, wars: [], started: [], dropped: [], restored: [], fallen: [], season: null };
  if (!last || last >= now) return rep;
  let d = last;
  for (let n = 0; d < now && n < 60; n++, d = nextDay(d)) {
    rep.days++;
    const month = d.slice(0, 7);
    if (!s.season) s.season = month;
    else if (s.season !== month) {   // a new month: the season prize for the league reached
      const lg = leagueOf(s.medals);
      s.gold += lg.season; s.stats.goldEarned += lg.season; s.season = month;
      addLog(s, `🏆 جائزة الموسم — دوري ${lg.name}`, lg.season);
      rep.season = { league: lg.name, gold: lg.season };
    }
    let raid = false, active = false;
    for (const def of CHARACTERS) {
      const ch = s.characters[def.id];
      const share = ch && dayShare(s, def.id, d);
      if (share == null) continue;
      // Habits left undone that day are marked missed (for the task list).
      for (const t of activeTasks(def, ch)) {
        const k = taskKey(def.id, t.id), p = taskProgress(s, def.id, t.id);
        if (t.added === d || taskComplete(p, d) || (p.lastDate && p.lastDate > d)) continue;
        if (!(p.lastDate === d && p.lastResult === 'fail')) s.stats.tasksFailed++;
        s.tasks[k] = { ...p, lastDate: d, lastResult: 'fail', count: p.lastDate === d ? p.count || 0 : 0, streak: 0 };
        if (!rep.missed.includes(t.title)) rep.missed.push(t.title);
      }
      let st = starsOf(share);
      if (st > 0) active = true;
      if (ch.war && ch.war.start !== warStart(d)) { settleWar(s, def, ch, rep); ch.war = null; }   // a war left open by an absence
      if (!ch.war && weekday(d) === 6) { ch.war = newWar(ch, d); if (ch.war.first) rep.started.push({ name: def.name, king: KINGS[def.regionId] }); }   // wars begin on Saturday
      if (!ch.war) { rep.stars.push({ name: def.name, date: d, stars: st, training: true }); continue; }
      if (st === 0 && !ch.war.shield && (s.shields || 0) > 0) {   // the shield: a zero day becomes ⭐ (once a week per dimension)
        s.shields--; ch.war.shield = true; st = 1; rep.shielded++;
        addLog(s, `🛡 الدرع حمى ${def.name} (${d})`);
      }
      ch.war.stars[dayDiff(ch.war.start, d)] = st;
      s.medals = (s.medals || 0) + st * RULES.medalsPerStar;
      rep.stars.push({ name: def.name, date: d, stars: st });
      if (st === 0) {
        raid = true;
        ch.zeroRun = (ch.zeroRun || 0) + 1;
        if (ch.zeroRun >= RULES.fallAfter && !ch.war.fallen) { ch.war.fallen = true; rep.fallen.push(def.name); addLog(s, `⚫ سقطت جبهة ${def.name}`); }
      } else ch.zeroRun = 0;
      if (weekday(d) === 5) { settleWar(s, def, ch, rep); ch.war = null; }   // Friday: the war ends
    }
    if (active) s.stats.activeDays = (s.stats.activeDays || 0) + 1;   // days with at least one star (cups open at CUP_DAYS)
    if (raid) {   // one raid a day, however many fronts had nothing
      const gold = Math.min(RULES.raidMax, Math.floor(s.gold * RULES.raidPct)), medals = Math.min(s.medals, RULES.raidMedals);
      s.gold -= gold; s.stats.goldLost += gold; s.medals -= medals;
      rep.raids.push({ date: d, gold, medals });
      addLog(s, `😈 غارة لوسيفر`, -gold);
    }
  }
  return rep;
}

// The end of a dimension's war: win → a key, loot and a ship part; lose → maybe half a key,
// and after RULES.dropAfter lost wars in a row the dimension drops a rank (the next win brings it back).
function settleWar(s, def, ch, rep) {
  const w = ch.war, total = w.stars.reduce((a, x) => a + (x || 0), 0), need = warNeed(w);
  const won = !w.fallen && total >= need;
  ch.wars = (ch.wars || 0) + 1;
  const res = { name: def.name, king: KINGS[def.regionId], won, total, need, key: 0, loot: 0, fallen: w.fallen };
  if (won) {
    giveKeys(s, 2);
    res.key = 1;
    res.loot = Math.round((RULES.warLoot + RULES.lootPerStar * total) * (1 + leagueOf(s.medals).index * 0.1));
    s.gold += res.loot; s.stats.goldEarned += res.loot;
    if (s.story?.speech) s.story.ship = (s.story.ship || 0) + 1;   // every war won adds a part to the warriors' ship
    ch.losses = 0;
    if (ch.restore && totalLevel(ch) < ch.restore) { setLevel(ch, ch.restore); rep.restored.push(`${def.name} ← ${rankName(ch)}`); }
    ch.restore = null;
    addLog(s, `⚔ فوز على ${res.king}: ${total}/${need} ⭐`, res.loot);
  } else {
    if (!w.fallen && total >= Math.ceil(need * 0.75)) { giveKeys(s, 1); res.key = 0.5; }
    ch.losses = (ch.losses || 0) + 1;
    addLog(s, `⚔ خسارة أمام ${res.king}: ${total}/${need} ⭐`);
    if (ch.losses >= RULES.dropAfter) {
      ch.losses = 0;
      const was = totalLevel(ch);
      if (was > 1) { setLevel(ch, was - 1); ch.restore = Math.max(ch.restore || 0, was); rep.dropped.push(`${def.name} ← ${rankName(ch)}`); addLog(s, `⬇ ${def.name} نزل لـ ${rankName(ch)}`); }
    }
  }
  rep.wars.push(res);
}

// Keys come in halves: two halves make a key.
function giveKeys(s, halves) {
  s.keyHalves = (s.keyHalves || 0) + halves;
  while (s.keyHalves >= 2) { s.keyHalves -= 2; s.keys++; s.stats.keysEarned++; }
}

// Set the overall level (1 = Bronze 1). A rank lost keeps its habit written, and it comes back with it.
function setLevel(ch, n) { ch.stage = Math.floor((n - 1) / 5); ch.level = ((n - 1) % 5) + 1; }

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
// The ship to the Island of Leaders grows one part for every war won after the speech.
export const SHIP = { parts: 12, per: 1 };
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

// A brand-new game (first visit or "start over"): it begins with the guided first steps.
export function demoState() {
  const s = newState();
  s.tour = 0;
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

// The front of each dimension on the war map:
//   coming — not opened yet / no habits · training — its first war starts on Saturday
//   ahead — on pace to win this week's war · behind — behind the pace
//   fallen — 3 zero days in a row, this week's war is lost
export function warStatus(s, region, date = today()) {
  if (!s.regions[region.id]) return { id: 'coming' };
  const ch = region.characterId && s.characters[region.characterId];
  const v = ch && warView(s, region.characterId, date);
  if (!v) return { id: 'coming' };
  return { id: v.training ? 'training' : v.fallen ? 'fallen' : v.ahead ? 'ahead' : 'behind', level: totalLevel(ch), war: v };
}
