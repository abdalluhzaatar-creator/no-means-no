import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as P from '../js/prayer.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const W = 'worshipper';
const day = (n) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
const def = () => E.findCharacter(W);
const ids = (s) => E.activeTasks(def(), s.characters[W]).map((x) => x.id);

const MAKKAH = { lat: 21.3891, lng: 39.8579, method: 'makkah' };
const hm = (h) => Math.round(h * 60);

t('headquarters and the trophy island are visible from the start', () => {
  const s = E.newState();
  assert.equal(E.mapVisibility(s, E.findRegion('hq')), 'owned');
  assert.equal(E.mapVisibility(s, E.findRegion('trophies')), 'owned');
});

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
  const s = E.newState();
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


t('the spiritual dimension starts with no preset habits (no prayers)', () => {
  const s = E.newState();
  assert.deepEqual(ids(s), []);
});

t('every habit is a counter: days and hours since it began', () => {
  const s = E.newState();
  assert.ok(E.setHabit(s, W, 0, null, { title: 'الصلاة', icon: '🕌' }).ok);
  const h = E.activeTasks(def(), s.characters[W])[0];
  assert.equal(h.times, undefined, 'no times a day any more'); assert.equal(h.prayer, undefined);
  const t0 = h.start;
  assert.deepEqual(E.habitDays(h, t0 + 3 * 86400000 + 5 * 3600000 + 60000), { days: 3, hours: 5, minutes: 1 });
});

t('a counter can be paused, run again (going on from where it stopped), and reset to zero', () => {
  const s = E.newState(); E.setHabit(s, W, 0, null, { title: 'ورد' });
  const h = () => E.activeTasks(def(), s.characters[W])[0];
  h().start = E.nowMs() - 2 * 86400000;   // two days in
  assert.ok(E.pauseHabit(s, W, h().id).ok);
  assert.equal(E.pauseHabit(s, W, h().id).ok, false, 'already paused');
  const frozen = E.habitElapsed(h());
  assert.equal(E.habitElapsed(h(), E.nowMs() + 86400000), frozen, 'a paused counter does not move');
  h().paused -= 3600000;   // paused an hour ago
  const at = E.habitElapsed(h());
  assert.ok(E.resumeHabit(s, W, h().id).ok);
  assert.ok(Math.abs(E.habitElapsed(h()) - at) < 1000, 'runs on from where it stopped');
  assert.ok(E.resetHabit(s, W, h().id).ok);
  assert.ok(E.habitElapsed(h()) < 1000, 'reset: back to zero');
});

t('a habit name written with "× 5" keeps only the name', () => {
  const s = E.newState();
  assert.ok(E.setRankPlan(s, W, 0, 'الصلاة × 5').ok);
  assert.equal(E.activeTasks(def(), s.characters[W])[0].title, 'الصلاة');
});

t('a renamed habit keeps its counter only if the name stays', () => {
  const s = E.newState(); E.setHabit(s, W, 0, null, { title: 'ورد' });
  const h = E.activeTasks(def(), s.characters[W])[0]; h.start -= 86400000;
  assert.ok(E.setHabit(s, W, 0, h.id, { title: 'ورد', icon: '📿' }).ok);
  assert.equal(E.activeTasks(def(), s.characters[W])[0].start, h.start);
  assert.equal(E.activeTasks(def(), s.characters[W])[0].icon, '📿');
});

t('editing a habit (name and picture) keeps its building and its counter', () => {
  const s = E.newState(); E.setHabit(s, W, 0, null, { title: 'ورد' });
  const h = E.activeTasks(def(), s.characters[W])[0]; h.start -= 3 * 86400000; const { id, start } = h;
  assert.ok(E.editHabit(s, W, id, { title: 'قراءة', icon: '📖' }).ok);
  const n = E.activeTasks(def(), s.characters[W])[0];
  assert.deepEqual([n.id, n.start, n.title, n.icon], [id, start, 'قراءة', '📖']);
  assert.equal(E.editHabit(s, W, id, { title: '' }).ok, false);
  assert.ok(E.editHabit(s, W, id, { notes: 'سطر 1\nسطر 2', img: 'data:image/jpeg;base64,AAAA' }).ok);
  const m = E.activeTasks(def(), s.characters[W])[0];
  assert.deepEqual([m.notes, m.img, m.title, m.start], ['سطر 1\nسطر 2', 'data:image/jpeg;base64,AAAA', 'قراءة', start]);
  assert.ok(E.editHabit(s, W, id, { img: null }).ok); assert.equal(E.activeTasks(def(), s.characters[W])[0].img, undefined);
});

t('test mode: a dimension starts again from zero and the Sunday message builds it again', () => {
  const real = E.newState(); E.setHabit(real, W, 0, null, { title: 'ورد' }); real.startDay = '2026-01-01';
  assert.equal(E.resetDimension(real, W).ok, false);              // never in the real game
  const s = E.enterSandbox(real);
  assert.ok(E.resetDimension(s, W).ok);
  assert.equal(E.activeTasks(def(), s.characters[W]).length, 0);
  const o = E.pendingOffer(s, '2026-11-02');
  assert.ok(o.build.includes(W));
  assert.ok(E.answerOffer(s, 'build', { id: W, habit: { title: 'قراءة' } }, '2026-11-02').ok);
  assert.deepEqual(E.activeTasks(def(), s.characters[W]).map((t) => t.title), ['قراءة']);
  assert.equal(E.totalLevel(s.characters[W]), 1);
});

t('an old save with habits removed has no empty ranks left', () => {
  const s = E.newState(); s.characters[W].stage = 0; s.characters[W].level = 4;
  s.characters[W].plan = [[{ id: 'a', title: 'أ', start: 1, paused: null }], [], [{ id: 'c', title: 'ج', start: 1, paused: null }], []];
  const m = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(E.totalLevel(m.characters[W]), 2);
  assert.deepEqual(E.activeTasks(def(), m.characters[W]).map((t) => t.id), ['a', 'c']);
});

t('the decorations of a place come one by one with its buildings', () => {
  const s = E.newState(); E.setHabit(s, W, 0, null, { title: 'ورد' });
  assert.equal(E.regionFeatures(s, 'sanctuary').size, 0);
  E.setRankPlan(s, W, 1, [{ title: 'ب' }]); E.setRankPlan(s, W, 2, [{ title: 'ج' }]); s.characters[W].level = 3;
  assert.deepEqual([...E.regionFeatures(s, 'sanctuary')], ['lanterns', 'palms']);
});

t('test mode: a copy of the game whose clock moves a week each time, and the real save comes back', () => {
  const real = E.newState(); real.startDay = E.today();
  assert.ok(E.setHabit(real, W, 0, null, { title: 'الصلاة' }).ok);
  const t2 = E.enterSandbox(real);
  assert.equal(E.activeTasks(def(), t2.characters[W])[0].title, 'الصلاة');
  E.weekPasses(t2); E.setDayShift(t2.sandbox.shift);
  assert.ok(E.pendingOffer(t2), 'a week later: the Sunday message');
  assert.ok(E.habitElapsed(E.activeTasks(def(), t2.characters[W])[0]) >= 6 * 86400000, 'the counters ran a week too');
  E.setDayShift(0);
  const back = E.leaveSandbox(JSON.parse(JSON.stringify(t2)));
  assert.equal(back.sandbox, undefined);
  assert.equal(E.activeTasks(def(), back.characters[W])[0].title, 'الصلاة');
});
console.log(`\n${passed} tests passed`);
