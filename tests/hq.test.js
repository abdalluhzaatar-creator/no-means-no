import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { commander, TOTAL_STEPS } from '../js/hq.js';
import { REGIONS } from '../js/content.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const openAll = (s) => { for (const r of REGIONS) { s.regions[r.id] = { level: 1 }; if (r.characterId) s.characters[r.characterId] ||= { stage: 0, level: 1 }; } };
const setRank = (s, n) => { for (const id in s.characters) Object.assign(s.characters[id], { stage: Math.floor((n - 1) / 5), level: ((n - 1) % 5) + 1 }); };

t('new player: commander level 1, rank جندي', () => {
  const c = commander(E.newState());
  assert.equal(c.level, 1); assert.equal(c.rank, 'جندي'); assert.equal(c.steps, 0);
});
t('the whole journey is 95 steps: 7 dimensions + 8 × 11 ranks', () => assert.equal(TOTAL_STEPS, 95));
t('keys alone never promote the commander', () => {
  const s = E.newState(); s.stats.keysEarned = 500; s.keys = 99;
  assert.equal(commander(s).rank, 'جندي');
});
t('the top rank comes only when everything is at its maximum', () => {
  const s = E.newState(); openAll(s); setRank(s, 12);
  assert.equal(commander(s).rank, 'فريق');
  s.characters.keeper.level = 1;   // one character one rank short (Platinum 2)
  assert.notEqual(commander(s).rank, 'فريق');
  setRank(s, 12); delete s.regions.nature;
  assert.notEqual(commander(s).rank, 'فريق');
});
t('ranks rise steadily along the way', () => {
  const s = E.newState(); openAll(s);
  const seen = [1, 4, 8, 12].map((n) => { setRank(s, n); return commander(s).rankIndex; });
  assert.ok(seen.every((v, i) => !i || v > seen[i - 1]), String(seen));
});
console.log(`\n${passed} hq tests passed`);
