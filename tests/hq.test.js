import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { commander } from '../js/hq.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

t('new player: commander level 1, rank جندي', () => {
  const c = commander(E.newState());
  assert.equal(c.level, 1); assert.equal(c.rank, 'جندي');
});
t('opening a place adds 2 levels; a character level adds 1', () => {
  const s = E.newState();
  s.regions.library = { level: 1 }; s.characters.scholar = { stage: 0, level: 1 };
  assert.equal(commander(s).level, 3);
  s.characters.worshipper.level = 3;
  assert.equal(commander(s).level, 5);
  assert.equal(commander(s).rank, 'رقيب');
});
console.log(`\n${passed} hq tests passed`);
