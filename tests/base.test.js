import assert from 'node:assert/strict';
import { ensureBase, occupancy, grow, collect, ready, capacity, clearGems, OBSTACLES, BUILDINGS, GRID, MAX_OBSTACLES, GROW_H, statsOf, canUpgrade, startUpgrade, finishUpgrades, rushUpgrade, gemsFor, train, untrain, advanceTraining, armySize, armyRoom } from '../js/base.js';

let n = 0; const test = (name, fn) => { fn(); n++; console.log('✓', name); };
const T0 = Date.UTC(2026, 9, 25, 8);

test('a new base gets the starting village and obstacles, nothing overlapping', () => {
  const b = ensureBase({ buildings: [{ type: 'archer', i: 6, j: 26 }] }, T0);
  for (const t of Object.keys(BUILDINGS).filter((k) => k !== 'townhall')) assert.equal(b.buildings.filter((x) => x.type === t).length, 1, t);
  assert.ok(b.obstacles.length >= 30 && b.obstacles.length <= MAX_OBSTACLES, String(b.obstacles.length));
  let cells = 16; for (const x of b.buildings) cells += BUILDINGS[x.type].n ** 2; for (const o of b.obstacles) cells += OBSTACLES[o.kind].n ** 2;
  assert.equal(occupancy(b).size, cells);
  for (const c of occupancy(b)) { const [i, j] = c.split(',').map(Number); assert.ok(i >= 0 && j >= 0 && i < GRID && j < GRID); }
  assert.deepEqual(ensureBase(structuredClone(b), T0 + 1), b);
});
test('an old building in the way of a starting one pushes it aside', () => {
  const b = ensureBase({ buildings: [{ type: 'archer', i: 15, j: 15 }] }, T0);
  const mine = b.buildings.find((x) => x.type === 'goldmine');
  assert.notDeepEqual([mine.i, mine.j], [15, 15]);
  let cells = 16; for (const x of b.buildings) cells += BUILDINGS[x.type].n ** 2; for (const o of b.obstacles) cells += OBSTACLES[o.kind].n ** 2;
  assert.equal(occupancy(b).size, cells);
});
test('trees grow back every few hours, up to the limit; rocks never', () => {
  const b = ensureBase({}, T0); const before = b.obstacles.length;
  assert.equal(grow(b, T0 + 3600e3), 0);
  assert.equal(grow(b, T0 + GROW_H * 3600e3 * 2 + 5), 2);
  assert.equal(b.obstacles.length, before + 2);
  assert.ok(b.obstacles.slice(-2).every((o) => OBSTACLES[o.kind].grows || o.kind === 'gembox'));
  for (let k = 0; k < 40; k++) grow(b, T0 + GROW_H * 3600e3 * (3 + k * 5));
  assert.equal(b.obstacles.length, MAX_OBSTACLES);
});
test('collectors fill up to their cap; collecting stops at the storage limit', () => {
  const st = { gold: 0, nour: 0, base: ensureBase({}, T0) };
  const mine = st.base.buildings.find((x) => x.type === 'goldmine');
  assert.equal(ready(mine, T0 + 3600e3), statsOf({ type: 'goldmine' }).rate);
  assert.equal(ready(mine, T0 + 100 * 3600e3), statsOf({ type: 'goldmine' }).cap);
  assert.equal(collect(st, mine, T0 + 2 * 3600e3), 2 * statsOf({ type: 'goldmine' }).rate);
  assert.equal(ready(mine, T0 + 2 * 3600e3), 0);
  st.gold = capacity(st.base, 'gold') - 5;
  assert.equal(collect(st, mine, T0 + 4 * 3600e3), 5);
  assert.equal(ready(mine, T0 + 4 * 3600e3), 2 * statsOf({ type: 'goldmine' }).rate - 5);
});
test('gems for clearing follow the fixed pattern; a gem box gives 25', () => {
  const b = { clears: 0 }; assert.equal(clearGems(b, 'tree'), 6); b.clears = 1; assert.equal(clearGems(b, 'rock'), 0);
  assert.equal(clearGems(b, 'gembox'), 25);
});
test('upgrades: cost, Town Hall level, one builder, the level goes up when the time is done', () => {
  const st = { gold: 5000, nour: 5000, gems: 100, base: ensureBase({}, T0) };
  const mine = st.base.buildings.find((x) => x.type === 'goldmine'), store = st.base.buildings.find((x) => x.type === 'goldstore');
  assert.equal(capacity(st.base, 'gold'), 1000 + 1500);
  assert.ok(canUpgrade(st, mine).ok);
  startUpgrade(st, mine, T0); assert.equal(st.nour, 4700); assert.equal(mine.up.s, 60);
  assert.equal(canUpgrade(st, store).reason, 'البنّاء مشغول');
  assert.equal(finishUpgrades(st.base, T0 + 59e3).length, 0);
  assert.equal(finishUpgrades(st.base, T0 + 60e3).length, 1); assert.equal(mine.lv, 2); assert.equal(statsOf(mine).rate, 400);
  startUpgrade(st, mine, T0 + 61e3); finishUpgrades(st.base, T0 + 1e9);
  assert.equal(canUpgrade(st, mine).reason, 'يحتاج القلعة مستوى 2');
  assert.ok(startUpgrade(st, st.base.th, T0).ok); assert.equal(st.gold, 4000);
  assert.equal(rushUpgrade(st, st.base.th, T0 + 60e3), gemsFor(240)); assert.equal(st.base.th.lv, 2);
  assert.equal(capacity(st.base, 'gold'), 2500 + 1500);
  assert.equal(gemsFor(60), 1); assert.equal(gemsFor(3600), 20); assert.equal(gemsFor(86400), 260);
});
test('training: pay light, one by one, stops when the army camp is full', () => {
  const st = { gold: 0, nour: 5000, base: ensureBase({}, T0) };
  for (let k = 0; k < 22; k++) train(st, 'archer', T0);
  assert.equal(st.base.queue.length, 20); assert.equal(st.nour, 5000 - 20 * 50);
  assert.equal(advanceTraining(st.base, T0 + 23e3), 0);
  assert.equal(advanceTraining(st.base, T0 + 48e3), 2); assert.equal(st.base.army.archer, 2);
  assert.ok(untrain(st, 'archer')); assert.equal(st.nour, 5000 - 19 * 50);
  advanceTraining(st.base, T0 + 1e7); assert.equal(armySize(st.base), Math.min(19, armyRoom(st.base)));
});
console.log(`\n${n} base tests passed`);
