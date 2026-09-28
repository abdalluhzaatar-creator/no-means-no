import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { commander } from '../js/hq.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

t('new player: commander level 1, rank جندي', () => {
  const c = commander(E.newState());
  assert.equal(c.level, 1); assert.equal(c.rank, 'جندي');
});
t('every 3 keys collected promote the commander automatically', () => {
  const s = E.newState();
  s.stats.keysEarned = 2;
  assert.equal(commander(s).rank, 'جندي'); assert.equal(commander(s).toNext, 1);
  s.stats.keysEarned = 3; s.keys = 0; // spent keys still count
  assert.equal(commander(s).rank, 'عريف');
  s.stats.keysEarned = 7;
  assert.equal(commander(s).rank, 'رقيب'); assert.equal(commander(s).keysInRank, 1);
  s.stats.keysEarned = 999;
  assert.equal(commander(s).rank, 'فريق'); assert.equal(commander(s).nextRank, null);
});
console.log(`\n${passed} hq tests passed`);
