// The base's data, in the Clash of Clans way (no 3D here, so it can be tested in node):
// the buildings and their sizes, the obstacles (trees and bushes cleared with light,
// rocks with gold, ~10 s each, a few gems as a reward in a fixed repeating pattern,
// new trees growing back while there are fewer than 45, rocks never), the starting
// village, and the collectors (a gold mine and a light well that fill up over time).
export const GRID = 44;                  // buildable cells per side, as in Clash
export const BORDER = 3;                 // the grass strip around it: no building there, attackers land there

// n: cells per side. makes/rate/cap: what a collector produces (per hour) and holds.
// stores/cap: what a storage holds (the Town Hall holds some of both too).
export const BUILDINGS = {
  townhall: { n: 4, name: 'القلعة', ico: '🏛', note: 'قلب البعد الروحي', holds: { gold: 1000, nour: 1000 } },
  archer: { n: 3, name: 'رامي السهام', ico: '🏹', note: 'يحمي البعد من ملوك الفراغ' },
  builder: { n: 2, name: 'كوخ البنّاء', ico: '🔨', note: 'البنّاء يبني ويزيل العوائق — واحد في كل مرة' },
  goldmine: { n: 3, name: 'منجم الذهب', ico: '⛏', makes: 'gold', rate: 20, cap: 200 },
  nourwell: { n: 3, name: 'مجمّع النور', ico: '✨', makes: 'nour', rate: 20, cap: 200 },
  goldstore: { n: 3, name: 'مخزن الذهب', ico: '🪙', holds: { gold: 1500 } },
  nourstore: { n: 3, name: 'مخزن النور', ico: '🔮', holds: { nour: 1500 } },
  barracks: { n: 3, name: 'الثكنة', ico: '⚔', note: 'هنا يتدرّب الجنود' },
  armycamp: { n: 4, name: 'معسكر الجيش', ico: '⛺', note: 'هنا ينتظر جيشك قبل الهجوم' },
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
  base.buildings ??= []; base.th ??= { ...TH_START };
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
export const ready = (b, now = Date.now()) => {
  const d = BUILDINGS[b.type]; if (!d?.makes) return 0;
  return Math.min(d.cap, Math.floor((d.rate * Math.max(0, now - (b.t ?? now))) / 3600e3));
};
// How much of a resource the base can hold: the Town Hall and the storages.
export const capacity = (base, res) => (BUILDINGS.townhall.holds[res] || 0) + (base.buildings || []).reduce((a, b) => a + (BUILDINGS[b.type]?.holds?.[res] || 0), 0);
// Collect a collector into the storages: what fits goes in; the rest stays in the collector.
export function collect(st, b, now = Date.now()) {
  const d = BUILDINGS[b.type], have = ready(b, now); if (!have) return 0;
  const room = Math.max(0, capacity(st.base, d.makes) - (st[d.makes] || 0)), got = Math.min(have, room);
  if (!got) return 0;
  st[d.makes] = (st[d.makes] || 0) + got;
  // Keep what didn't fit: move the clock back by that much.
  b.t = now - ((have - got) * 3600e3) / d.rate;
  return got;
}
// The gems the next cleared obstacle gives.
export const clearGems = (base, kind) => OBSTACLES[kind].gems ?? GEM_PATTERN[(base.clears || 0) % GEM_PATTERN.length];
