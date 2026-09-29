import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as P from '../js/prayer.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const W = 'worshipper';
const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
const def = () => E.findCharacter(W);

// Complete every active task of the worshipper on day n; returns events.
function perfectDay(s, n) {
  const ev = [];
  for (const task of E.activeTasks(def(), s.characters[W])) ev.push(...E.reportTask(s, W, task.id, true, { date: day(n) }).events);
  return ev;
}

t('level 1 worshipper has exactly the 5 prayers', () => {
  const s = E.newState();
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.id), PRAYERS);
});

t('a perfect day needs all 5 prayers', () => {
  const s = E.newState();
  for (const p of PRAYERS.slice(0, 4)) E.reportTask(s, W, p, true, { date: day(1) });
  assert.equal(s.characters[W].perfectStreak, 0);
  const ev = E.reportTask(s, W, 'isha', true, { date: day(1) }).events;
  assert.ok(ev.some((e) => e.type === 'perfectDay'));
  assert.equal(s.characters[W].perfectStreak, 1);
});

t('15 consecutive perfect days give exactly one key', () => {
  const s = E.newState();
  for (let d = 1; d <= 14; d++) perfectDay(s, d);
  assert.equal(s.keys, 0);
  assert.ok(perfectDay(s, 15).some((e) => e.type === 'key'));
  assert.equal(s.keys, 1);
  for (let d = 16; d <= 29; d++) perfectDay(s, d);
  assert.equal(s.keys, 1, 'no second key before another 15 days');
  perfectDay(s, 30);
  assert.equal(s.keys, 2);
});

t('a missed prayer resets the key and level counters', () => {
  const s = E.newState();
  for (let d = 1; d <= 10; d++) perfectDay(s, d);
  E.reportTask(s, W, 'asr', false, { date: day(11), applyPenalty: false });
  assert.deepEqual(E.liveProgress(s.characters[W], day(11)), { perfectStreak: 0, keyDays: 0, levelDays: 0 });
  for (let d = 12; d <= 25; d++) perfectDay(s, d);
  assert.equal(s.keys, 0, 'only 14 days since the miss');
});

t('a skipped day also resets the chain', () => {
  const s = E.newState();
  for (let d = 1; d <= 10; d++) perfectDay(s, d);
  perfectDay(s, 12);
  assert.equal(s.characters[W].perfectStreak, 1);
});

t('you start at Bronze 1; a key (not days) raises you to Bronze 2 and adds Quran', () => {
  const s = E.newState();
  assert.equal(E.rankName(s.characters[W]), 'برونز 1');
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'no key yet');
  for (let d = 1; d <= 15; d++) perfectDay(s, d);
  assert.equal(E.rankName(s.characters[W]), 'برونز 1', 'no automatic promotion');
  assert.equal(s.keys, 1);
  const up = E.levelUpCharacter(s, W);
  assert.ok(up.events.some((e) => e.type === 'rank' && e.rank === 'برونز 2'));
  assert.equal(s.keys, 0, 'the key is spent');
  assert.ok(E.activeTasks(def(), s.characters[W]).some((x) => x.id === 'quran'));
});

t('each rank adds its task: Bronze 3 adhkar, Silver 1 sunnah, Silver 2 qiyam', () => {
  const s = E.newState();
  s.keys = 5;
  for (let k = 0; k < 4; k++) assert.ok(E.levelUpCharacter(s, W).ok);
  const ch = s.characters[W];
  assert.equal(E.rankName(ch), 'فضّي 2');
  assert.deepEqual(E.activeTasks(def(), ch).map((x) => x.id), [...PRAYERS, 'quran', 'adhkar_am', 'adhkar_pm', 'sunnah', 'qiyam']);
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'Silver 3 has no tasks written yet');
  assert.ok(E.setRankPlan(s, W, 5, 'صيام الاثنين').ok);
  assert.ok(E.levelUpCharacter(s, W).ok);
  assert.equal(E.rankName(s.characters[W]), 'فضّي 3');
  assert.equal(E.activeTasks(def(), ch).at(-1).title, 'صيام الاثنين');
});

t('the player writes each rank: lines become tasks, known lines keep their task', () => {
  const s = E.newState();
  const ch = s.characters[W];
  assert.ok(E.setRankPlan(s, W, 1, '- قراءة صفحة من القرآن\n\nالمشي نصف ساعة\nالمشي نصف ساعة').ok);
  const r2 = E.planOf(def(), ch)[1];
  assert.equal(r2.length, 2, 'blank and repeated lines are dropped');
  assert.equal(r2[0].id, 'quran', 'an existing task keeps its id and streak');
  assert.equal(r2[1].title, 'المشي نصف ساعة');
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة الفجر في وقتها').ok);
  assert.deepEqual(E.activeTasks(def(), ch).map((x) => x.id), ['fajr'], 'rank 1 is editable too');
  assert.equal(E.activeTasks(def(), ch)[0].prayer, 'fajr', 'prayer timing is kept');
});

t('ranks go Bronze 1-3, Silver, Gold, Platinum', () => {
  assert.deepEqual(def().stages.slice(1).map((x) => x.name), [
    'برونز 1', 'برونز 2', 'برونز 3', 'فضّي 1', 'فضّي 2', 'فضّي 3',
    'ذهبي 1', 'ذهبي 2', 'ذهبي 3', 'بلاتينيوم 1', 'بلاتينيوم 2', 'بلاتينيوم 3']);
});

t('the second place opens with a key (not gold) and brings its character', () => {
  const s = E.newState();
  s.gold = 10000;
  assert.equal(E.mapVisibility(s, E.findRegion('library')), 'teaser');
  assert.equal(E.buy(s, 'region', 'library').ok, false);
  s.keys = 1;
  assert.ok(E.buy(s, 'region', 'library').ok);
  assert.equal(s.keys, 0);
  assert.equal(s.gold, 10000);
  assert.ok(s.characters.scholar);
});

t('failure penalty is optional and never below zero', () => {
  const s = E.newState();
  s.gold = 5;
  E.reportTask(s, W, 'fajr', false, { date: day(1) });
  assert.equal(s.gold, 0);
  s.gold = 30;
  E.reportTask(s, W, 'isha', false, { applyPenalty: false, date: day(1) });
  assert.equal(s.gold, 30);
});

t('cannot report a task that is not unlocked yet', () => {
  assert.equal(E.reportTask(E.newState(), W, 'quran', true).ok, false);
});

t('migrate v2 save: keeps gold/regions, restarts character levels', () => {
  const s = E.migrate({ version: 2, gold: 42, characters: { worshipper: { level: 4 } }, regions: { sanctuary: { level: 3 } } });
  assert.equal(s.gold, 42);
  assert.equal(s.keys, 0);
  assert.equal(s.regions.sanctuary.level, 3);
  assert.equal(s.characters[W].level, 1);
  assert.equal(s.characters[W].stage, 0);
});

t('revokeTask cancels an early prayer and takes back its gold and perfect day', () => {
  const s = E.newState();
  perfectDay(s, 1);
  const gold = s.gold;
  assert.equal(s.characters[W].perfectStreak, 1);
  assert.ok(E.revokeTask(s, W, 'isha', day(1)));
  assert.equal(s.gold, gold - 20);
  assert.equal(s.characters[W].perfectStreak, 0);
  assert.equal(s.characters[W].keyDays, 0);
  assert.equal(E.taskDoneToday(E.taskProgress(s, W, 'isha'), day(1)), false);
  assert.ok(E.reportTask(s, W, 'isha', true, { date: day(1) }).ok, 'can be reported again in its time');
});

const MAKKAH = { lat: 21.3891, lng: 39.8579, method: 'makkah' };
const hm = (h) => Math.round(h * 60);

t('Makkah prayer times match the Umm al-Qura timetable (±2 min)', () => {
  const x = P.prayerTimes(new Date(2026, 8, 27), MAKKAH, 3);
  const expect = { fajr: 4 * 60 + 55, dhuhr: 12 * 60 + 12, asr: 15 * 60 + 36, maghrib: 18 * 60 + 12, isha: 19 * 60 + 42 };
  for (const k in expect) assert.ok(Math.abs(hm(x[k]) - expect[k]) <= 2, `${k}: ${hm(x[k])} vs ${expect[k]}`);
});

t('prayer windows: each prayer opens at its time and closes at the next', () => {
  const now = new Date(2026, 8, 27, 13, 0);
  const pd = P.prayerDay(now, MAKKAH);
  assert.equal(P.windowState(pd.windows.dhuhr, now), 'open');
  assert.equal(P.windowState(pd.windows.isha, now), 'upcoming');
  assert.equal(P.windowState(pd.windows.fajr, now), 'over');
  assert.equal(+pd.windows.dhuhr.end, +pd.windows.asr.start);
});

t('after midnight, Isha still belongs to the previous prayer day', () => {
  const now = new Date(2026, 8, 28, 1, 30);
  const pd = P.prayerDay(now, MAKKAH);
  assert.equal(pd.day, '2026-09-27');
  assert.equal(P.windowState(pd.windows.isha, now), 'open');
});

t('war status: coming → ongoing → crushed on a miss → fierce after one more level', () => {
  const s = E.newState();
  const lib = E.findRegion('library'), san = E.findRegion('sanctuary');
  assert.equal(E.warStatus(s, lib).id, 'coming');
  assert.equal(E.warStatus(s, san).id, 'ongoing');
  E.reportTask(s, W, 'fajr', false, { date: day(1) });
  const st = E.warStatus(s, san);
  assert.equal(st.id, 'crushed'); assert.equal(st.need, 2);
  s.keys = 1;
  assert.ok(E.levelUpCharacter(s, W).ok);
  assert.equal(E.warStatus(s, san).id, 'fierce');
});

console.log(`\n${passed} tests passed`);
