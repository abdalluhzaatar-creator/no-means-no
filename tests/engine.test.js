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
  s.shields = 0;
  assert.deepEqual(E.closeDays(s, day(7)).missed.sort(), ['الصلاة', 'صفحة قرآن'].sort());
  assert.equal(E.taskProgress(s, W, pr.id).lastResult, 'fail');
  assert.deepEqual(E.liveProgress(s.characters[W], day(7)), { perfectStreak: 0 });
  assert.deepEqual(E.closeDays(s, day(7)).missed, [], 'runs once per day');
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
  assert.deepEqual(E.closeDays(s, day(2)).missed, []);
  assert.equal(s.characters[W].perfectStreak, 0);
});

t('gold comes once per habit, however many times a day it is needed', () => {
  const s = setup();
  for (let k = 0; k < 4; k++) E.reportTask(s, W, task(s, 'الصلاة').id, true, { date: day(1) });
  assert.equal(s.gold, 0);
  E.reportTask(s, W, task(s, 'الصلاة').id, true, { date: day(1) });
  assert.equal(s.gold, 20);
});

t('the game day closes at 3 at night, not at midnight', () => {
  assert.equal(E.today(new Date(2026, 9, 21, 1, 30)), '2026-10-20');
  assert.equal(E.today(new Date(2026, 9, 21, 3, 5)), '2026-10-21');
});

t('a habit added today is not held against you when the day closes', () => {
  const s = E.newState();
  assert.ok(E.setHabit(s, W, 0, null, { title: 'ورد', times: 1 }).ok);
  s.lastDay = E.today();
  const d = new Date(); d.setDate(d.getDate() + 2);
  const rep = E.closeDays(s, E.today(d));
  assert.equal(rep.days, 2); assert.equal(rep.stars.length, 1, 'only the day after counts');
});
t('a skipped day also resets the chain', () => {
  const s = setup();
  for (let d = 1; d <= 10; d++) perfectDay(s, d);
  perfectDay(s, 12);
  assert.equal(s.characters[W].perfectStreak, 1);
});

const stars = (s, n, k) => {   // reach k stars on day n (prayer ×5 + Quran)
  const pr = task(s, 'الصلاة').id, q = task(s, 'صفحة قرآن').id;
  const plan = [[], [[pr, 4]], [[pr, 4], [q, 1]], [[pr, 5], [q, 1]]][k];
  for (const [id, c] of plan) for (let i = 0; i < c; i++) E.reportTask(s, W, id, true, { date: day(n) });
};

t('stars: ⭐ a third of the day, ⭐⭐ two thirds, ⭐⭐⭐ everything (a habit counts by its share)', () => {
  const s = setup();
  for (const k of [0, 1, 2, 3]) { stars(s, k + 1, k); assert.equal(E.starsToday(s, W, day(k + 1)), k, `${k} stars`); }
  assert.equal(E.starsOf(1 / 3), 1, 'exactly a third is a star'); assert.equal(E.starsOf(2 / 3), 2);
  assert.equal(E.starsOf(0.32), 0); assert.equal(E.starsOf(0.99), 2);
  const one = E.newState(); E.setHabit(one, W, 0, null, { title: 'ورد', times: 1 });
  E.activeTasks(def(), one.characters[W])[0].added = null;
  assert.equal(E.starsToday(one, W, day(1)), 0);
  E.reportTask(one, W, E.activeTasks(def(), one.characters[W])[0].id, true, { date: day(1) });
  assert.equal(E.starsToday(one, W, day(1)), 3, 'one habit done = 3 stars');
});

t('an honest failure is counted, but only as a symbol', () => {
  const s = setup(); const g = s.gold;
  E.reportTask(s, W, task(s, 'صفحة قرآن').id, false, { date: day(1) });
  assert.equal(s.stats.honest, 1); assert.equal(s.gold, g);
});

t('headquarters and the trophy island are visible from the start', () => {
  const s = E.newState();
  assert.equal(E.mapVisibility(s, E.findRegion('hq')), 'owned');
  assert.equal(E.mapVisibility(s, E.findRegion('trophies')), 'owned');
});

t('cannot report a task that is not unlocked yet', () => {
  assert.equal(E.reportTask(E.newState(), W, 'quran', true).ok, false);
});

t('migrate v2 save: keeps gold/regions, restarts character levels', () => {
  const s = E.migrate({ version: 2, gold: 42, characters: { worshipper: { level: 4 } }, regions: { sanctuary: { level: 3 } } });
  assert.equal(s.gold, 42);
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

t('a written line naming a prayer is tied to that prayer time', () => {
  const s = E.newState();
  assert.equal(E.prayerIn('صلاة الضحى'), undefined);
  assert.equal(E.prayerIn('قراءة سورة العصر'), undefined, 'needs the word صلاة');
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة المغرب بالمسجد\nصلاة الفجر جماعة').ok);
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.prayer), ['maghrib', 'fajr']);
  assert.ok(E.setRankPlan(s, W, 0, 'صلاة الفجر × 2').ok);
  assert.equal(E.activeTasks(def(), s.characters[W])[0].prayer, undefined, 'a task done several times a day is not tied to one prayer time');
});

t('new dimensions start empty; old saves keep their preset tasks', () => {
  const s = E.newState(); s.characters.scholar = { stage: 0, level: 1 };
  assert.equal(E.activeTasks(E.findCharacter('scholar'), E.migrate(s).characters.scholar).length, 0);
  const old = E.migrate({ version: 3, characters: { scholar: { stage: 0, level: 1 } } });
  assert.equal(E.activeTasks(E.findCharacter('scholar'), old.characters.scholar).length, 3);
});


t('eight ranks, one for every habit built: Bronze … Legend', () => {
  assert.deepEqual(E.findCharacter('scholar').stages.slice(1).map((x) => x.name), ['برونز', 'فضّي', 'ذهبي', 'بلاتينيوم', 'كريستال', 'ماستر', 'بطل', 'أسطورة']);
  assert.equal(E.RANK_COUNT, 8);
});

// January 2026: the 4th, 11th and 18th are Sundays.
const startOn = (n) => { const s = E.newState(); s.startDay = day(n); assert.ok(E.setHabit(s, W, 0, null, { title: 'الصلاة', times: 5 }).ok); return s; };

t('the Sunday message comes on the first Sunday after the start, once', () => {
  const s = startOn(7);
  assert.equal(E.pendingOffer(s, day(10)), null, 'Saturday: nothing yet');
  const o = E.pendingOffer(s, day(11));
  assert.equal(o.sunday, day(11));
  assert.deepEqual(o.build, [W]);
  assert.equal(o.open.length, 7, 'the seven other dimensions can be opened');
  assert.equal(E.pendingOffer(s, day(14))?.sunday, day(11), 'still waiting on Wednesday if not answered');
  assert.ok(E.answerOffer(s, 'skip', {}, day(12)).ok);
  assert.equal(E.pendingOffer(s, day(14)), null, '"not this week": nothing until next Sunday');
  assert.equal(E.pendingOffer(s, day(18)).sunday, day(18));
  assert.equal(E.pendingOffer(s, day(31)).sunday, day(25), 'Sundays missed do not pile up');
  assert.equal(E.pendingOffer(startOn(4), day(4)), null, 'the starting Sunday itself does not count');
});

t('build a habit: a new building in that dimension and its rank rises by itself', () => {
  const s = startOn(7);
  assert.equal(E.answerOffer(s, 'build', { id: W, habit: { title: 'الصلاة' } }, day(11)).ok, false, 'no duplicate habit');
  const r = E.answerOffer(s, 'build', { id: W, habit: { title: 'صفحة قرآن' } }, day(11));
  assert.ok(r.events.some((e) => e.type === 'rank' && e.rank === 'فضّي'));
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.title), ['الصلاة', 'صفحة قرآن']);
  assert.equal(E.rankName(s.characters[W]), 'فضّي');
  assert.equal(E.answerOffer(s, 'build', { id: W, habit: { title: 'ورد' } }, day(12)).ok, false, 'one choice a week');
  for (let k = 3; k <= 8; k++) assert.ok(E.answerOffer(s, 'build', { id: W, habit: { title: `عادة ${k}` } }, day(11 + (k - 2) * 7)).ok);
  assert.equal(E.rankName(s.characters[W]), 'أسطورة');
  assert.deepEqual(E.pendingOffer(s, day(60)).build, [], 'eight buildings: full');
});

t('open a dimension: it opens with the habit the player picks', () => {
  const s = startOn(7);
  assert.equal(E.answerOffer(s, 'open', { id: 'library', habit: {} }, day(11)).ok, false, 'needs a habit');
  assert.ok(E.answerOffer(s, 'open', { id: 'library', habit: { title: 'قراءة 10 صفحات' } }, day(11)).ok);
  assert.ok(s.regions.library && s.characters.scholar);
  assert.deepEqual(E.activeTasks(E.findCharacter('scholar'), s.characters.scholar).map((x) => x.title), ['قراءة 10 صفحات']);
  assert.equal(E.dimStatus(s, E.findRegion('library')).habits, 1);
  assert.equal(E.dimStatus(s, E.findRegion('body')).id, 'coming');
  assert.equal(E.pendingOffer(s, day(18)).open.includes('library'), false);
  assert.ok(E.pendingOffer(s, day(18)).build.includes('scholar'));
});

const DIMS = ['worshipper', 'scholar', 'athlete', 'empath', 'host', 'builder', 'merchant', 'keeper'];
t('the ship grows with every habit built; all 64 = the island opens', () => {
  const s = startOn(7);
  assert.equal(E.mapVisibility(s, E.findRegion('leaders')), 'teaser', 'the island is on the map from the start');
  assert.equal(E.habitsBuilt(s), 1); assert.equal(E.shipStage(s), 0); assert.equal(E.islandOpen(s), false);
  for (const c of DIMS) {
    s.characters[c] ||= { stage: 0, level: 1 };
    for (let k = 0; k < 8; k++) if (E.activeTasks(E.findCharacter(c), s.characters[c]).length <= k) E.setRankPlan(s, c, k, [{ title: `${c} ${k}` }]);
    s.characters[c].stage = 1; s.characters[c].level = 3;   // rank 8
    s.regions[E.findCharacter(c).regionId] = { level: 1 };
  }
  assert.equal(E.habitsBuilt(s), 64); assert.equal(E.shipStage(s), E.SHIP.parts); assert.equal(E.islandOpen(s), true);
  assert.equal(E.pendingOffer(s, day(60)), null, 'nothing left to build or open: no more messages');
});

t('the story: after the speech Lucifer is jailed; the cage is found empty at the end', () => {
  const s = setup();
  assert.ok(E.finishSpeech(s).ok);
  assert.equal(s.story.jailed, true);
  E.storyStep(s, 'back'); E.storyStep(s, 'done');
  assert.equal(s.story.jailed, false, 'he escaped');
});

t('old saves: keys, shields, medals and wars are gone; at most eight ranks', () => {
  const m = E.migrate({ version: 5, planV: 2, keys: 3, shields: 2, medals: 400, characters: { worshipper: { stage: 2, level: 2, war: { start: day(3) }, wars: 4, plan: Array.from({ length: 12 }, (_, i) => [{ id: `t${i}`, title: `h${i}` }]) } } });
  assert.equal(m.keys, undefined); assert.equal(m.shields, undefined); assert.equal(m.medals, undefined);
  assert.equal(E.totalLevel(m.characters.worshipper), 8);
  assert.equal(m.characters.worshipper.war, undefined);
  assert.equal(E.activeTasks(def(), m.characters.worshipper).length, 8);
  assert.ok(m.startDay);
});

t('test mode opens everything with gold and gives the real save back', () => {
  const real = E.newState(); real.gold = 7;
  assert.ok(E.setHabit(real, W, 0, null, { title: 'الصلاة', times: 5 }).ok);
  const t2 = E.enterSandbox(real);
  assert.equal(t2.gold, E.SANDBOX.gold);
  assert.ok(Object.keys(t2.characters).length >= 8 && t2.regions.nature && t2.regions.hq);
  assert.equal(t2.regions.leaders, undefined);
  const back = E.leaveSandbox(JSON.parse(JSON.stringify(t2)));
  assert.equal(back.gold, 7); assert.equal(back.sandbox, undefined);
  assert.equal(E.activeTasks(def(), back.characters[W])[0].title, 'الصلاة');
});
console.log(`\n${passed} tests passed`);
