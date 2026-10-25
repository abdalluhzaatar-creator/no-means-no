// The base's data, in the Clash of Clans way (no 3D here, so it can be tested in node):
// the buildings and their sizes, the obstacles (trees and bushes cleared with light,
// rocks with gold, ~10 s each, a few gems as a reward in a fixed repeating pattern,
// new trees growing back while there are fewer than 45, rocks never), the starting
// village, and the collectors (a gold mine and a light well that fill up over time).
export const GRID = 44;                  // buildable cells per side, as in Clash
export const BORDER = 3;                 // the grass strip around it: no building there, attackers land there

// Each building's levels, with Clash of Clans' early numbers (light ✨ stands for elixir):
// lv[k] is level k+1 — cost (res), build time in seconds (s), the Town Hall level it needs (th),
// and what it does at that level (rate per hour / cap for collectors, holds for storages,
// room for the army camp, hp for all).
const H = 3600, M = 60;
export const BUILDINGS = {
  townhall: { n: 4, name: 'القلعة', ico: '🏛', note: 'قلب البعد الروحي — طوّرها لتفتح مستويات أعلى لباقي المباني', lv: [
    { hp: 450, holds: { gold: 1000, nour: 1000 } },
    { res: 'gold', cost: 1000, s: 5 * M, th: 1, hp: 1600, holds: { gold: 2500, nour: 2500 } },
    { res: 'gold', cost: 4000, s: H, th: 2, hp: 1850, holds: { gold: 10000, nour: 10000 } },
    { res: 'gold', cost: 25000, s: 4 * H, th: 3, hp: 2100, holds: { gold: 50000, nour: 50000 } },
  ] },
  archer: { n: 3, name: 'رامي السهام', ico: '🏹', note: 'يحمي البعد من ملوك الفراغ', lv: [
    { hp: 100, dps: 11 },
    { res: 'gold', cost: 2000, s: 15 * M, th: 2, hp: 120, dps: 15 },
    { res: 'gold', cost: 5000, s: 2 * H, th: 3, hp: 140, dps: 19 },
    { res: 'gold', cost: 20000, s: 4 * H, th: 4, hp: 160, dps: 25 },
  ] },
  builder: { n: 2, name: 'كوخ البنّاء', ico: '🔨', note: 'البنّاء يبني ويطوّر ويزيل العوائق — شغلة وحدة بكل مرة', lv: [{ hp: 250 }] },
  goldmine: { n: 3, name: 'منجم الذهب', ico: '⛏', makes: 'gold', lv: [
    { hp: 400, rate: 200, cap: 1000 },
    { res: 'nour', cost: 300, s: M, th: 1, hp: 440, rate: 400, cap: 2000 },
    { res: 'nour', cost: 700, s: 15 * M, th: 2, hp: 480, rate: 600, cap: 3000 },
    { res: 'nour', cost: 1400, s: H, th: 2, hp: 520, rate: 800, cap: 5000 },
    { res: 'nour', cost: 3000, s: 2 * H, th: 3, hp: 560, rate: 1000, cap: 10000 },
    { res: 'nour', cost: 7000, s: 6 * H, th: 3, hp: 600, rate: 1300, cap: 20000 },
  ] },
  nourwell: { n: 3, name: 'مجمّع النور', ico: '✨', makes: 'nour', lv: [
    { hp: 400, rate: 200, cap: 1000 },
    { res: 'gold', cost: 300, s: M, th: 1, hp: 440, rate: 400, cap: 2000 },
    { res: 'gold', cost: 700, s: 15 * M, th: 2, hp: 480, rate: 600, cap: 3000 },
    { res: 'gold', cost: 1400, s: H, th: 2, hp: 520, rate: 800, cap: 5000 },
    { res: 'gold', cost: 3000, s: 2 * H, th: 3, hp: 560, rate: 1000, cap: 10000 },
    { res: 'gold', cost: 7000, s: 6 * H, th: 3, hp: 600, rate: 1300, cap: 20000 },
  ] },
  goldstore: { n: 3, name: 'مخزن الذهب', ico: '🪙', lv: [
    { hp: 400, holds: { gold: 1500 } },
    { res: 'nour', cost: 750, s: 15 * M, th: 1, hp: 600, holds: { gold: 3000 } },
    { res: 'nour', cost: 1500, s: H, th: 2, hp: 800, holds: { gold: 6000 } },
    { res: 'nour', cost: 3000, s: 2 * H, th: 3, hp: 1000, holds: { gold: 12000 } },
    { res: 'nour', cost: 6000, s: 3 * H, th: 3, hp: 1200, holds: { gold: 25000 } },
  ] },
  nourstore: { n: 3, name: 'مخزن النور', ico: '🔮', lv: [
    { hp: 400, holds: { nour: 1500 } },
    { res: 'gold', cost: 750, s: 15 * M, th: 1, hp: 600, holds: { nour: 3000 } },
    { res: 'gold', cost: 1500, s: H, th: 2, hp: 800, holds: { nour: 6000 } },
    { res: 'gold', cost: 3000, s: 2 * H, th: 3, hp: 1000, holds: { nour: 12000 } },
    { res: 'gold', cost: 6000, s: 3 * H, th: 3, hp: 1200, holds: { nour: 25000 } },
  ] },
  barracks: { n: 3, name: 'الثكنة', ico: '⚔', note: 'هنا يتدرّب الجنود', trains: true, lv: [
    { hp: 250, queue: 20 },
    { res: 'nour', cost: 500, s: 5 * M, th: 1, hp: 290, queue: 25 },
    { res: 'nour', cost: 2500, s: 30 * M, th: 2, hp: 330, queue: 30 },
    { res: 'nour', cost: 10000, s: 2 * H, th: 3, hp: 370, queue: 35 },
  ] },
  armycamp: { n: 4, name: 'معسكر الجيش', ico: '⛺', note: 'هنا ينتظر جيشك قبل الهجوم', trains: true, lv: [
    { hp: 250, room: 20 },
    { res: 'nour', cost: 2500, s: 15 * M, th: 2, hp: 270, room: 30 },
    { res: 'nour', cost: 10000, s: H, th: 3, hp: 290, room: 35 },
  ] },
};
// The troops the barracks trains: cost in light, training time, room taken in the army camp.
export const TROOPS = {
  archer: { name: 'رامي سهام', ico: '🏹', cost: 50, s: 24, room: 1, note: 'يضرب من بعيد' },
};

// The village a player starts with (the Town Hall stands at 20,20, 4×4).
export const START = [
  { type: 'builder', i: 25, j: 17 },
  { type: 'goldmine', i: 15, j: 15 }, { type: 'nourwell', i: 15, j: 19 },
  { type: 'goldstore', i: 26, j: 20 }, { type: 'nourstore', i: 26, j: 24 },
  { type: 'barracks', i: 20, j: 26 }, { type: 'armycamp', i: 20, j: 14 },
];
export const TH_START = { i: 20, j: 20 };

// res: what clearing costs (nour = light, gold). grows: comes back over time. gems: fixed reward.
export const OBSTACLES = {
  bush: { n: 2, name: 'شجيرة', ico: '🌿', res: 'nour', cost: 50, s: 10, grows: true },
  tree: { n: 2, name: 'شجرة', ico: '🌳', res: 'nour', cost: 100, s: 10, grows: true },
  pine: { n: 2, name: 'صنوبرة', ico: '🌲', res: 'nour', cost: 100, s: 10, grows: true },
  trunk: { n: 2, name: 'جذع شجرة', ico: '🪵', res: 'nour', cost: 75, s: 10, grows: true },
  rock: { n: 2, name: 'صخرة', ico: '🪨', res: 'gold', cost: 250, s: 10 },
  bigrock: { n: 3, name: 'صخرة كبيرة', ico: '🪨', res: 'gold', cost: 1500, s: 20 },
  gembox: { n: 2, name: 'صندوق الجواهر', ico: '💎', res: 'nour', cost: 1000, s: 30, gems: 25 },
};
export const MAX_OBSTACLES = 45, GROW_H = 8;
// Gems for each obstacle cleared, in a fixed order that repeats (as in Clash).
export const GEM_PATTERN = [6, 0, 4, 5, 1, 3, 2, 0, 1, 5, 2, 0, 3, 1, 4, 0, 6, 2, 1, 3];

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sizeOf = (x) => (BUILDINGS[x.type] || OBSTACLES[x.kind] || { n: 2 }).n;

// Which cells are taken by the Town Hall, the buildings and the obstacles.
export function occupancy(base) {
  const taken = new Set();
  const add = (i, j, n) => { for (let x = i; x < i + n; x++) for (let z = j; z < j + n; z++) taken.add(`${x},${z}`); };
  const th = base.th || TH_START; add(th.i, th.j, 4);
  for (const b of base.buildings || []) add(b.i, b.j, sizeOf(b));
  for (const o of base.obstacles || []) add(o.i, o.j, sizeOf(o));
  return taken;
}
// n×n free with a one-cell gap around it (pad), inside the map.
export function fits(taken, i, j, n, pad = 0) {
  if (i < 0 || j < 0 || i + n > GRID || j + n > GRID) return false;
  for (let x = i - pad; x < i + n + pad; x++) for (let z = j - pad; z < j + n + pad; z++) if (taken.has(`${x},${z}`)) return false;
  return true;
}
// The nearest free spot to (i, j), spiralling out.
function nearestFree(taken, i, j, n) {
  for (let r = 0; r < GRID; r++) for (let x = i - r; x <= i + r; x++) for (let z = j - r; z <= j + r; z++) {
    if (Math.max(Math.abs(x - i), Math.abs(z - j)) !== r) continue;
    if (fits(taken, x, z, n, 1)) return [x, z];
  }
  return null;
}

// Kept clear at the start: around the Town Hall, and the corner the void kings come from (the tutorial).
const keepClear = (i, j, n) => (i < 16 && j + n > 22) || (i + n > 13 && i < 31 && j + n > 12 && j < 31);

// The obstacles a new village starts with (the same for everyone): trees, bushes, trunks, rocks.
export function makeObstacles(base, seed = 7) {
  const r = rng(seed), taken = occupancy({ ...base, obstacles: [] }), list = [];
  const mix = [['tree', 9], ['pine', 7], ['bush', 8], ['trunk', 4], ['rock', 8], ['bigrock', 4]];
  let id = 0;
  for (const [kind, count] of mix) {
    const n = OBSTACLES[kind].n;
    for (let k = 0, tries = 0; k < count && tries < 600; tries++) {
      const i = Math.floor(r() * (GRID - n + 1)), j = Math.floor(r() * (GRID - n + 1));
      if (keepClear(i, j, n) || !fits(taken, i, j, n, 1)) continue;
      for (let x = i; x < i + n; x++) for (let z = j; z < j + n; z++) taken.add(`${x},${z}`);
      list.push({ id: `o${id++}`, kind, i, j }); k++;
    }
  }
  return list;
}

// Every GROW_H hours a tree, bush or trunk grows on a free spot (only while fewer than
// MAX_OBSTACLES), and once in a while it's a gem box instead. Returns how many grew.
export function grow(base, now = Date.now()) {
  base.grownAt ??= now;
  const due = Math.min(5, Math.floor((now - base.grownAt) / (GROW_H * 3600e3)));
  if (due <= 0) return 0;
  base.grownAt += due * GROW_H * 3600e3;
  const r = rng(Math.floor(base.grownAt / 1000) % 2147483646 + 1);
  let made = 0;
  for (let k = 0; k < due; k++) {
    if (base.obstacles.length >= MAX_OBSTACLES) break;
    const kinds = ['tree', 'pine', 'bush', 'bush', 'trunk'];
    const kind = !base.obstacles.some((o) => o.kind === 'gembox') && r() < 0.1 ? 'gembox' : kinds[Math.floor(r() * kinds.length)];
    const taken = occupancy(base);
    for (let t = 0; t < 200; t++) {
      const i = Math.floor(r() * (GRID - 1)), j = Math.floor(r() * (GRID - 1));
      if (!fits(taken, i, j, 2, 1)) continue;
      base.obstacles.push({ id: `g${base.grownAt}_${k}`, kind, i, j }); made++; break;
    }
  }
  return made;
}

// A base from an old save (or none) made whole: the starting buildings, the obstacles.
export function ensureBase(base = {}, now = Date.now()) {
  base.buildings ??= []; base.th ??= { ...TH_START }; base.th.type = 'townhall';
  if (!base.layout) {
    base.layout = 2;
    delete base.cleared;
    for (const s of START) {
      if (base.buildings.some((b) => b.type === s.type)) continue;
      const taken = occupancy({ ...base, obstacles: [] });
      const at = fits(taken, s.i, s.j, BUILDINGS[s.type].n) ? [s.i, s.j] : nearestFree(taken, s.i, s.j, BUILDINGS[s.type].n);
      if (at) base.buildings.push({ ...s, i: at[0], j: at[1], ...(BUILDINGS[s.type].makes ? { t: now } : {}) });
    }
    base.obstacles = makeObstacles(base);
    base.grownAt = now; base.clears = 0;
  }
  base.obstacles ??= [];
  return base;
}

// What a collector holds right now.
// A building's numbers at its level (level 1 when it has none).
export const statsOf = (b, lv = b.lv || 1) => BUILDINGS[b.type]?.lv[lv - 1] || {};
export const maxLevel = (type) => BUILDINGS[type].lv.length;
export const ready = (b, now = Date.now()) => {
  const d = BUILDINGS[b.type]; if (!d?.makes || b.up) return 0;
  const { rate, cap } = statsOf(b);
  return Math.min(cap, Math.floor((rate * Math.max(0, now - (b.t ?? now))) / 3600e3));
};
// How much of a resource the base can hold: the Town Hall and the storages.
export const capacity = (base, res) => (statsOf({ type: 'townhall', lv: base.th?.lv }).holds?.[res] || 0) + (base.buildings || []).reduce((a, b) => a + (statsOf(b).holds?.[res] || 0), 0);
// Collect a collector into the storages: what fits goes in; the rest stays in the collector.
export function collect(st, b, now = Date.now()) {
  const d = BUILDINGS[b.type], have = ready(b, now); if (!have) return 0;
  const { rate } = statsOf(b);
  const room = Math.max(0, capacity(st.base, d.makes) - (st[d.makes] || 0)), got = Math.min(have, room);
  if (!got) return 0;
  st[d.makes] = (st[d.makes] || 0) + got;
  // Keep what didn't fit: move the clock back by that much.
  b.t = now - ((have - got) * 3600e3) / rate;
  return got;
}
// The gems the next cleared obstacle gives.
export const clearGems = (base, kind) => OBSTACLES[kind].gems ?? GEM_PATTERN[(base.clears || 0) % GEM_PATTERN.length];

// ---------- the builder, upgrades ----------
// Clash's price for finishing now with gems: 1 a minute, 20 an hour, 260 a day (in between, a straight line).
export function gemsFor(seconds) {
  if (seconds <= 0) return 0;
  const P = [[60, 1], [3600, 20], [86400, 260], [604800, 1000]];
  if (seconds <= 60) return 1;
  for (let k = 1; k < P.length; k++) if (seconds <= P[k][0]) { const [a, ga] = P[k - 1], [b, gb] = P[k]; return Math.ceil(ga + ((seconds - a) * (gb - ga)) / (b - a)); }
  return 1000;
}
const allBuildings = (base) => [base.th, ...(base.buildings || [])];
// What the one builder is doing (an upgrade or clearing an obstacle), or null.
export const builderJob = (base) => allBuildings(base).find((b) => b?.up) || (base.clearing ? { clearing: base.clearing } : null);
// Can this building go up a level now? { ok, next, reason }.
export function canUpgrade(st, b) {
  const lv = b.lv || 1, next = BUILDINGS[b.type].lv[lv];
  if (b.up) return { ok: false, reason: 'قيد التطوير' };
  if (!next) return { ok: false, reason: 'أعلى مستوى' };
  const th = st.base.th?.lv || 1;
  if (next.th > th) return { ok: false, next, reason: `يحتاج القلعة مستوى ${next.th}` };
  if ((st[next.res] || 0) < next.cost) return { ok: false, next, short: true, reason: next.res === 'gold' ? 'ذهب غير كافٍ' : 'نور غير كافٍ' };
  if (builderJob(st.base)) return { ok: false, next, busy: true, reason: 'البنّاء مشغول' };
  return { ok: true, next };
}
// Start it: pay, the builder goes to work. A collector gives what it has first and stops while it's built.
export function startUpgrade(st, b, now = Date.now()) {
  const c = canUpgrade(st, b); if (!c.ok) return c;
  if (BUILDINGS[b.type].makes) collect(st, b, now);
  st[c.next.res] -= c.next.cost;
  b.up = { end: now + c.next.s * 1000, s: c.next.s };
  return c;
}
// Upgrades that are done by now: the level goes up. Returns the buildings finished.
export function finishUpgrades(base, now = Date.now()) {
  const done = [];
  for (const b of allBuildings(base)) if (b?.up && now >= b.up.end) {
    b.lv = (b.lv || 1) + 1; delete b.up;
    if (BUILDINGS[b.type].makes) b.t = now;
    done.push(b);
  }
  return done;
}
// Finish now for gems.
export function rushUpgrade(st, b, now = Date.now()) {
  if (!b.up) return 0;
  const g = gemsFor(Math.ceil((b.up.end - now) / 1000));
  if ((st.gems || 0) < g) return -1;
  st.gems -= g; b.up.end = now; finishUpgrades(st.base, now);
  return g;
}

// ---------- training troops ----------
// The army camp's room, the troops ready, and the barracks' line (trained one by one, in order).
export const armyRoom = (base) => (base.buildings || []).filter((b) => b.type === 'armycamp').reduce((a, b) => a + (statsOf(b).room || 0), 0);
export const armySize = (base) => Object.entries(base.army || {}).reduce((a, [t, n]) => a + TROOPS[t].room * n, 0);
export const queueSize = (base) => (base.queue || []).reduce((a, t) => a + TROOPS[t].room, 0);
export const queueRoom = (base) => (base.buildings || []).filter((b) => b.type === 'barracks').reduce((a, b) => a + (statsOf(b).queue || 0), 0);
// Move the troops whose training is done into the army camp (training waits while the camp is full).
export function advanceTraining(base, now = Date.now()) {
  base.army ??= {}; base.queue ??= [];
  let moved = 0;
  while (base.queue.length) {
    const t = TROOPS[base.queue[0]];
    if (armySize(base) + t.room > armyRoom(base)) { base.qT = now; break; }
    if (now < base.qT + t.s * 1000) break;
    base.qT += t.s * 1000; const ty = base.queue.shift(); base.army[ty] = (base.army[ty] || 0) + 1; moved++;
  }
  return moved;
}
// Add a troop to the barracks' line: pay its light now (as in Clash).
export function train(st, type, now = Date.now()) {
  const t = TROOPS[type], base = st.base; base.queue ??= [];
  if (queueSize(base) + t.room > queueRoom(base)) return { ok: false, reason: 'الثكنة ممتلئة' };
  if ((st.nour || 0) < t.cost) return { ok: false, reason: 'نور غير كافٍ' };
  st.nour -= t.cost;
  if (!base.queue.length) base.qT = now;
  base.queue.push(type);
  return { ok: true };
}
// Take the last one of this type out of the line: its light back.
export function untrain(st, type) {
  const q = st.base.queue || [], k = q.lastIndexOf(type); if (k < 0) return false;
  q.splice(k, 1); st.nour = (st.nour || 0) + TROOPS[type].cost; if (k === 0) st.base.qT = Date.now();
  return true;
}
