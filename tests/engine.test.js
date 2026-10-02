import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as P from '../js/prayer.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const W = 'worshipper';
const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
const def = () => E.findCharacter(W);
const ids = (s) => E.activeTasks(def(), s.characters[W]).map((x) => x.id);

// A player whose spiritual dimension has: prayer ×5 and one Quran page a day.
function setup() {
  const s = E.newState();
  assert.ok(E.setRankPlan(s, W, 0, [{ title: 'الصلاة', times: 5 }, { title: 'صفحة قرآن', times: 1 }]).ok);
  return s;
}
const task = (s, title) => E.activeTasks(def(), s.characters[W]).find((x) => x.title === title);

// Complete every active task (as many times as it needs) on day n; returns events.
function perfectDay(s, n) {
  const ev = [];
  for (const x of E.activeTasks(def(), s.characters[W])) for (let k = 0; k < E.timesOf(x); k++) ev.push(...E.reportTask(s, W, x.id, true, { date: day(n) }).events);
  return ev;
}

t('the spiritual dimension starts with no preset tasks (no prayers)', () => {
  const s = E.newState();
  assert.deepEqual(ids(s), []);
  assert.equal(def().title, undefined);
  assert.ok(!JSON.stringify(def()).includes('المصل'));
});

t('a task needed 5 times a day is complete only after the 5th time', () => {
  const s = setup();
  const pr = task(s, 'الصلاة');
  assert.equal(pr.times, 5);
  for (let k = 1; k <= 4; k++) {
    assert.ok(E.reportTask(s, W, pr.id, true, { date: day(1) }).ok);
    const p = E.taskProgress(s, W, pr.id);
    assert.equal(E.countToday(p, day(1)), k);
    assert.equal(E.taskComplete(p, day(1)), false);
    assert.equal(E.taskDoneToday(p, day(1)), false, 'still open');
  }
  E.reportTask(s, W, task(s, 'صفحة قرآن').id, true, { date: day(1) });
  assert.equal(s.characters[W].perfectStreak, 0, 'prayer is at 4/5');
  const ev = E.reportTask(s, W, pr.id, true, { date: day(1) }).events;
  assert.ok(ev.some((e) => e.type === 'perfectDay'));
  assert.equal(E.reportTask(s, W, pr.id, true, { date: day(1) }).ok, false, 'no 6th time');
  assert.equal(E.currentStreak(E.taskProgress(s, W, pr.id), day(1)), 1);
});

t('a partial day keeps yesterday\'s streak going', () => {
  const s = setup();
  perfectDay(s, 1);
  const pr = task(s, 'الصلاة');
  E.reportTask(s, W, pr.id, true, { date: day(2) });
  assert.equal(E.currentStreak(E.taskProgress(s, W, pr.id), day(2)), 1);
});

t('unfinished tasks count as missed when the next day starts', () => {
  const s = setup();
  for (let d = 1; d <= 5; d++) perfectDay(s, d);
  E.closeDays(s, day(6));
  const pr = task(s, 'الصلاة');
  E.reportTask(s, W, pr.id, true, { date: day(6) });
  E.reportTask(s, W, pr.id, true, { date: day(6) });
  assert.deepEqual(E.closeDays(s, day(7)).sort(), ['الصلاة', 'صفحة قرآن'].sort());
  assert.equal(E.taskProgress(s, W, pr.id).lastResult, 'fail');
  assert.deepEqual(E.liveProgress(s.characters[W], day(7)), { perfectStreak: 0, keyDays: 0, levelDays: 0 });
  assert.deepEqual(E.closeDays(s, day(7)), [], 'runs once per day');
});

t('the end-of-day sweep never overwrites progress already logged today', () => {
  const s = setup();
  E.closeDays(s, day(1));
  const q = task(s, 'صفحة قرآن');
  E.reportTask(s, W, q.id, true, { date: day(2) });
  E.closeDays(s, day(2));
  assert.equal(E.taskComplete(E.taskProgress(s, W, q.id), day(2)), true);
});

t('times per day can be written as "× 5" and edited later keeping the task', () => {
  const s = E.newState();
  assert.ok(E.setRankPlan(s, W, 0, 'الصلاة × 5\nمشي x2\nذكر').ok);
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => [x.title, x.times]), [['الصلاة', 5], ['مشي', 2], ['ذكر', 1]]);
  const id = task(s, 'مشي').id;
  assert.ok(E.setRankPlan(s, W, 0, [{ title: 'مشي', times: 3 }]).ok);
  assert.equal(task(s, 'مشي').id, id);
  assert.equal(task(s, 'مشي').times, 3);
});

t('an empty task list never counts as a perfect day', () => {
  const s = E.newState();
  E.closeDays(s, day(1));
  assert.deepEqual(E.closeDays(s, day(2)), []);
  assert.equal(s.characters[W].perfectStreak, 0);
});

t('15 consecutive perfect days give exactly one key', () => {
  const s = setup();
  for (let d = 1; d <= 14; d++) perfectDay(s, d);
  assert.equal(s.keys, 0);
  assert.ok(perfectDay(s, 15).some((e) => e.type === 'key'));
  assert.equal(s.keys, 1);
  for (let d = 16; d <= 29; d++) perfectDay(s, d);
  assert.equal(s.keys, 1, 'no second key before another 15 days');
  perfectDay(s, 30);
  assert.equal(s.keys, 2);
});

t('a missed task resets the key counter', () => {
  const s = setup();
  for (let d = 1; d <= 10; d++) perfectDay(s, d);
  E.reportTask(s, W, task(s, 'الصلاة').id, false, { date: day(11), applyPenalty: false });
  assert.deepEqual(E.liveProgress(s.characters[W], day(11)), { perfectStreak: 0, keyDays: 0, levelDays: 0 });
  for (let d = 12; d <= 25; d++) perfectDay(s, d);
  assert.equal(s.keys, 0, 'only 14 days since the miss');
});

t('a skipped day also resets the chain', () => {
  const s = setup();
  for (let d = 1; d <= 10; d++) perfectDay(s, d);
  perfectDay(s, 12);
  assert.equal(s.characters[W].perfectStreak, 1);
});

t('you start at Bronze 1; a key raises you to the next rank and adds its tasks', () => {
  const s = setup();
  assert.equal(E.rankName(s.characters[W]), 'برونز 1');
  assert.ok(E.setRankPlan(s, W, 1, 'أذكار الصباح').ok);
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'no key yet');
  for (let d = 1; d <= 15; d++) perfectDay(s, d);
  assert.equal(E.rankName(s.characters[W]), 'برونز 1', 'no automatic promotion');
  const up = E.levelUpCharacter(s, W);
  assert.ok(up.events.some((e) => e.type === 'rank' && e.rank === 'برونز 2'));
  assert.equal(s.keys, 0, 'the key is spent');
  assert.equal(E.activeTasks(def(), s.characters[W]).at(-1).title, 'أذكار الصباح');
  s.keys = 1;
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'Bronze 3 has no tasks written yet');
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

t('headquarters and the trophy island are visible from the start', () => {
  const s = E.newState();
  assert.equal(E.mapVisibility(s, E.findRegion('hq')), 'owned');
  assert.equal(E.mapVisibility(s, E.findRegion('trophies')), 'owned');
});

t('failure penalty is optional and never below zero', () => {
  const s = setup();
  s.gold = 5;
  E.reportTask(s, W, task(s, 'الصلاة').id, false, { date: day(1) });
  assert.equal(s.gold, 0);
  s.gold = 30;
  E.reportTask(s, W, task(s, 'صفحة قرآن').id, false, { applyPenalty: false, date: day(1) });
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

t('migrate removes the old five prayers from a saved spiritual plan', () => {
  const old = [['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((id) => ({ id, title: id, reward: 20, penalty: 10 })), [{ id: 'quran', title: 'قرآن', reward: 20, penalty: 10 }]];
  const s = E.migrate({ version: 3, characters: { worshipper: { stage: 0, level: 2, plan: old } } });
  assert.deepEqual(ids(s), ['quran']);
});

t('revokeTask cancels an early prayer and takes back its gold and perfect day', () => {
  const s = E.newState();
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة العشاء').ok);
  const isha = E.activeTasks(def(), s.characters[W])[0];
  assert.equal(isha.prayer, 'isha');
  perfectDay(s, 1);
  const gold = s.gold;
  assert.equal(s.characters[W].perfectStreak, 1);
  assert.ok(E.revokeTask(s, W, isha.id, day(1)));
  assert.equal(s.gold, gold - 20);
  assert.equal(s.characters[W].perfectStreak, 0);
  assert.equal(E.taskDoneToday(E.taskProgress(s, W, isha.id), day(1)), false);
  assert.ok(E.reportTask(s, W, isha.id, true, { date: day(1) }).ok, 'can be reported again in its time');
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
  const s = setup();
  const lib = E.findRegion('library'), san = E.findRegion('sanctuary');
  assert.equal(E.warStatus(s, lib).id, 'coming');
  assert.equal(E.warStatus(s, san).id, 'ongoing');
  E.reportTask(s, W, task(s, 'الصلاة').id, false, { date: day(1) });
  const st = E.warStatus(s, san);
  assert.equal(st.id, 'crushed'); assert.equal(st.need, 2);
  s.keys = 1;
  E.setRankPlan(s, W, 1, 'ذكر');
  assert.ok(E.levelUpCharacter(s, W).ok);
  assert.equal(E.warStatus(s, san).id, 'fierce');
});

t('a written line naming a prayer is tied to that prayer time', () => {
  const s = E.newState();
  assert.equal(E.prayerIn('صلاة الضحى'), undefined);
  assert.equal(E.prayerIn('قراءة سورة العصر'), undefined, 'needs the word صلاة');
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة المغرب بالمسجد\nصلاة الفجر جماعة').ok);
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.prayer), ['maghrib', 'fajr']);
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة الفجر × 2').ok);
  assert.equal(E.activeTasks(def(), s.characters[W])[0].prayer, undefined, 'a task done several times a day is not tied to one prayer time');
});

console.log(`\n${passed} tests passed`);
