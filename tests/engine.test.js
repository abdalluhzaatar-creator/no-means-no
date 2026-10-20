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

t('you start at Bronze 1; a key raises you to the next rank and adds its tasks', () => {
  const s = setup();
  assert.equal(E.rankName(s.characters[W]), 'برونز 1');
  assert.ok(E.setRankPlan(s, W, 1, 'أذكار الصباح').ok);
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'no key yet');
  s.keys = 1;
  assert.equal(E.rankName(s.characters[W]), 'برونز 1', 'no automatic promotion');
  const up = E.levelUpCharacter(s, W);
  assert.ok(up.events.some((e) => e.type === 'rank' && e.rank === 'برونز 2'));
  assert.equal(s.keys, 0, 'the key is spent');
  assert.equal(E.activeTasks(def(), s.characters[W]).at(-1).title, 'أذكار الصباح');
  s.keys = 1;
  assert.equal(E.levelUpCharacter(s, W).ok, false, 'Bronze 3 has no tasks written yet');
});

// Play days a..b (January 2026; Jan 3 is a Saturday): fn(n) logs the day, then the day closes.
function play(s, a, b, fn) { const reps = []; for (let n = a; n <= b; n++) { fn(n); reps.push(E.closeDays(s, day(n + 1))); } return reps; }
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

t('wars run Saturday to Friday; the first needs 9 of 21 stars and pays a key and loot', () => {
  const s = setup(); s.lastDay = day(3);
  assert.equal(E.warStart(day(9)), day(3));
  const reps = play(s, 3, 9, (n) => stars(s, n, 2));
  const war = reps.at(-1).wars[0];
  assert.ok(war.won); assert.equal(war.total, 14); assert.equal(war.need, 9);
  assert.equal(s.keys, 1);
  assert.ok(war.loot >= E.RULES.warLoot);
  assert.equal(s.characters[W].war, null, 'Friday closes the war');
});

t('before its first Saturday a dimension trains: stars only, no war and no raids', () => {
  const s = setup(); s.lastDay = day(6); s.shields = 0; s.gold = 1000;   // Tuesday
  const reps = play(s, 6, 9, () => {});
  assert.ok(reps.every((r) => !r.raids.length && r.stars.every((x) => x.training)));
  assert.equal(s.gold, 1000); assert.equal(s.characters[W].war, null);
  play(s, 10, 10, () => {});
  assert.ok(s.characters[W].war, 'the war began on Saturday');
});

t('later wars need 12; a strong loss (¾ of it) gives half a key, two halves make a key', () => {
  const s = setup(); s.lastDay = day(3);
  play(s, 3, 9, (n) => stars(s, n, 3));
  assert.equal(s.keys, 1);
  let rep = play(s, 10, 16, (n) => stars(s, n, n <= 14 ? 1 : 2)).at(-1).wars[0];
  assert.equal(rep.need, 12); assert.equal(rep.total, 9); assert.equal(rep.won, false); assert.equal(rep.key, 0.5);
  assert.equal(s.keys, 1); assert.equal(s.keyHalves, 1);
  play(s, 17, 23, (n) => stars(s, n, n <= 21 ? 1 : 2));
  assert.equal(s.keys, 2, 'the second half completes a key');
  rep = play(s, 24, 30, (n) => stars(s, n, 1)).at(-1).wars[0];
  assert.equal(rep.key, 0, '7 stars is below ¾');
});

t('a shield turns a 0-star day into ⭐, once a week per dimension', () => {
  const s = setup(); s.lastDay = day(3); s.shields = 2; s.gold = 1000;
  const reps = play(s, 3, 4, () => {});
  assert.equal(reps[0].shielded, 1); assert.equal(reps[0].raids.length, 0);
  assert.equal(s.characters[W].war.stars[0], 1); assert.equal(s.characters[W].zeroRun, 1, 'the shielded day did not count as zero');
  assert.equal(reps[1].shielded, 0, 'only once this week'); assert.equal(reps[1].raids.length, 1);
  assert.equal(s.shields, 1);
  play(s, 5, 10, () => {});
  assert.equal(s.shields, 0, 'a new week, the shield works again');
});

t('a 0-star day with no shield brings one raid: 5% of the gold (at most 300) and 30 medals', () => {
  const s = setup(); s.lastDay = day(3); s.shields = 0; s.gold = 1000; s.medals = 100;
  const rep = E.closeDays(s, day(4));
  assert.deepEqual(rep.raids, [{ date: day(3), gold: 50, medals: 30 }]);
  assert.equal(s.gold, 950); assert.equal(s.medals, 70);
  s.gold = 100000; E.closeDays(s, day(5));
  assert.equal(s.gold, 100000 - 300, 'never more than 300');
  s.gold = 0; E.closeDays(s, day(6)); assert.equal(s.gold, 0, 'never below zero');
  s.keys = 1; assert.ok(E.buy(s, 'region', 'library').ok);
  E.setHabit(s, 'scholar', 0, null, { title: 'قراءة', times: 1 });
  E.activeTasks(E.findCharacter('scholar'), s.characters.scholar)[0].added = null;
  s.gold = 1000; s.characters.scholar.war = { start: day(3), stars: [], first: true, fallen: false, shield: false };
  assert.equal(E.closeDays(s, day(7)).raids.length, 1, 'one raid a day, however many fronts are at zero');
});

t('three 0-star days in a row in one dimension make its front fall: its week is lost', () => {
  const s = setup(); s.lastDay = day(3); s.shields = 0;
  const reps = play(s, 3, 9, (n) => (n >= 6 ? stars(s, n, 3) : null));
  assert.deepEqual(reps[2].fallen, ['البعد الروحي']);
  const war = reps.at(-1).wars[0];
  assert.equal(war.total, 12); assert.equal(war.fallen, true); assert.equal(war.won, false); assert.equal(war.key, 0);
});

t('three lost wars in a row drop that dimension a rank (never below Bronze 1); its next win brings it back', () => {
  const s = setup(); s.lastDay = day(3); s.shields = 0; s.keys = 1;
  assert.ok(E.promoteWith(s, W, { title: 'ورد', times: 1 }).ok);
  task(s, 'ورد').added = null;
  const cmd = s.stats.keysEarned;
  let reps = play(s, 3, 23, () => {});
  assert.equal(reps.at(-1).dropped.length, 1);
  assert.equal(E.rankName(s.characters[W]), 'برونز 1');
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.title), ['الصلاة', 'صفحة قرآن']);
  assert.equal(s.stats.keysEarned, cmd, 'the commander keeps every key he ever earned');
  play(s, 24, 44, () => {});
  assert.equal(E.rankName(s.characters[W]), 'برونز 1', 'never below Bronze 1');
  reps = play(s, 45, 51, (n) => stars(s, n, 2));
  assert.equal(reps.at(-1).restored.length, 1);
  assert.equal(E.rankName(s.characters[W]), 'برونز 2', 'the rank and its habit are back');
});

t('medals climb the leagues; a new month pays the season prize', () => {
  assert.equal(E.leagueOf(0).name, 'برونز'); assert.equal(E.leagueOf(1700).name, 'ذهب'); assert.equal(E.leagueOf(1e6).name, 'أسطورة');
  const s = setup(); s.lastDay = day(24);
  play(s, 24, 25, (n) => stars(s, n, 3));
  assert.equal(s.medals, 60, '3 stars = 30 medals a day');
  s.lastDay = day(31); stars(s, 31, 3);
  const g = s.gold;
  const rep = E.closeDays(s, '2026-02-01');
  assert.deepEqual(rep.season, null, 'Jan 31 still belongs to January');
  assert.deepEqual(E.closeDays(s, '2026-02-02').season, { league: 'برونز', gold: 100 });
  assert.ok(s.gold >= g + 100 - E.RULES.raidMax);
});

t('an honest failure is counted, but only as a symbol', () => {
  const s = setup(); const g = s.gold, sh = s.shields;
  E.reportTask(s, W, task(s, 'صفحة قرآن').id, false, { date: day(1) });
  assert.equal(s.stats.honest, 1); assert.equal(s.gold, g); assert.equal(s.shields, sh);
});

t('shields are bought with gold, three at most', () => {
  const s = E.newState(); s.gold = 1000;
  assert.ok(E.buyShield(s).ok); assert.ok(E.buyShield(s).ok);
  assert.equal(s.shields, 3); assert.equal(s.gold, 1000 - 2 * E.RULES.shieldCost);
  assert.equal(E.buyShield(s).ok, false);
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

t('war map: coming → training → ahead / behind → fallen', () => {
  const s = setup(); s.lastDay = day(1);
  const lib = E.findRegion('library'), san = E.findRegion('sanctuary');
  assert.equal(E.warStatus(s, lib).id, 'coming');
  assert.equal(E.warStatus(s, san, day(1)).id, 'training', 'Thursday: the first war starts on Saturday');
  assert.equal(E.warView(s, W, day(1)).inDays, 2);
  E.closeDays(s, day(3));
  assert.equal(E.road(s, W, day(3)).war.king, 'ملك الفراغ');
  perfectDay(s, 3);
  assert.equal(E.warStatus(s, san, day(3)).id, 'ahead');
  s.shields = 0;
  E.closeDays(s, day(4));
  assert.equal(E.warStatus(s, san, day(4)).id, 'ahead', '3 stars by day 2 is on pace for 9');
  E.closeDays(s, day(5));
  assert.equal(E.warStatus(s, san, day(5)).id, 'behind');
  E.closeDays(s, day(6));
  assert.equal(E.warView(s, W, day(6)).zeroRun, 2);
  E.closeDays(s, day(7));
  assert.equal(E.warStatus(s, san, day(7)).id, 'fallen');
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

t('habit picker: first habit, edit it, promotion adds the next habit for a key', () => {
  const s = E.newState();
  assert.ok(E.setHabit(s, W, 0, null, { title: 'الصلاة', times: 5 }).ok);
  assert.equal(E.activeTasks(def(), s.characters[W]).length, 1);
  const id = task(s, 'الصلاة').id;
  assert.ok(E.setHabit(s, W, 0, id, { title: 'الصلاة', times: 1, icon: '🕯' }).ok);
  assert.equal(task(s, 'الصلاة').id, id, 'same name keeps the task');
  assert.equal(E.timesOf(task(s, 'الصلاة')), 5, 'the prayer is never less than five a day');
  assert.ok(E.setHabit(s, W, 0, id, { title: 'الصلاة', times: 9 }).ok);
  assert.equal(E.timesOf(task(s, 'الصلاة')), 5, 'and never more than five');
  assert.equal(task(s, 'الصلاة').icon, '🕯', 'the player picks the icon');
  assert.equal(E.road(s, W).canPromote, false, 'no key yet');
  assert.equal(E.promoteWith(s, W, { title: 'ورد', times: 1 }).ok, false);
  s.keys = 1;
  assert.equal(E.promoteWith(s, W, { title: 'الصلاة', times: 1 }).ok, false, 'no duplicate habit');
  assert.ok(E.promoteWith(s, W, { title: 'صفحة قرآن', times: 1 }).ok);
  assert.equal(s.keys, 0);
  assert.equal(E.rankName(s.characters[W]), 'برونز 2');
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((x) => x.title), ['الصلاة', 'صفحة قرآن']);
  assert.ok(E.removeHabit(s, W, id).ok);
  assert.equal(E.removeHabit(s, W, task(s, 'صفحة قرآن').id).ok, false, 'the last habit stays');
});

t('new dimensions start empty; old saves keep their preset tasks', () => {
  const s = E.newState(); s.characters.scholar = { stage: 0, level: 1 };
  assert.equal(E.activeTasks(E.findCharacter('scholar'), E.migrate(s).characters.scholar).length, 0);
  const old = E.migrate({ version: 3, characters: { scholar: { stage: 0, level: 1 } } });
  assert.equal(E.activeTasks(E.findCharacter('scholar'), old.characters.scholar).length, 3);
});

t('test mode opens everything with keys and gold, upgrades nothing, and gives the real save back', () => {
  const real = E.newState(); real.gold = 7; real.keys = 1;
  assert.ok(E.setHabit(real, W, 0, null, { title: 'الصلاة', times: 5 }).ok);
  const t2 = E.enterSandbox(real);
  assert.equal(t2.keys, E.SANDBOX.keys); assert.equal(t2.gold, E.SANDBOX.gold);
  assert.ok(Object.keys(t2.characters).length >= 8 && t2.regions.nature && t2.regions.hq);
  assert.ok(Object.values(t2.characters).every((c) => E.totalLevel(c) === 1), 'every rank starts at Bronze 1');
  t2.keys = 0; E.refillSandbox(t2); assert.equal(t2.keys, E.SANDBOX.keys);
  const back = E.leaveSandbox(JSON.parse(JSON.stringify(t2)));
  assert.equal(back.gold, 7); assert.equal(back.keys, 1); assert.equal(back.sandbox, undefined);
  assert.equal(E.activeTasks(def(), back.characters[W])[0].title, 'الصلاة');
});

t('the story: after the speech Lucifer is jailed, the island shows (closed) and wars won build the ship', () => {
  const s = setup();
  const isle = E.findRegion('leaders');
  assert.equal(E.mapVisibility(s, isle), 'hidden');
  assert.ok(E.finishSpeech(s).ok);
  assert.equal(s.story.jailed, true);
  assert.equal(E.mapVisibility(s, isle), 'hidden', 'seen only through the spyglass');
  E.storyStep(s, 'back');
  assert.equal(E.mapVisibility(s, isle), 'teaser');
  E.storyStep(s, 'done');
  assert.equal(s.story.jailed, false, 'he escaped');
  assert.equal(E.buy(s, 'region', 'leaders').ok, false, 'the island is reached by ship only');
  s.lastDay = day(3);
  play(s, 3, 9, (d) => perfectDay(s, d));
  assert.equal(E.shipStage(s), 1, 'a war won = one part');
  assert.equal(E.migrate({ version: 4, story: { speech: true, ship: 17 } }).story.ship, 2, 'old saves keep their parts');
  assert.equal(E.enterSandbox(s).regions.leaders, undefined);
});
console.log(`\n${passed} tests passed`);
