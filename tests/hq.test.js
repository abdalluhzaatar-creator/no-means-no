import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import { commander } from '../js/hq.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

t('new player: commander level 1, rank جندي', () => {
  const c = commander(E.newState());
  assert.equal(c.level, 1); assert.equal(c.rank, 'جندي');
});
t('the commander rises by himself with every habit built', () => {
  const s = E.newState();
  E.setHabit(s, 'worshipper', 0, null, { title: 'الصلاة', times: 5 });
  assert.equal(commander(s).rank, 'جندي'); assert.equal(commander(s).toNext, 2);
  E.setRankPlan(s, 'worshipper', 1, [{ title: 'ب' }]); E.setRankPlan(s, 'worshipper', 2, [{ title: 'ج' }]); s.characters.worshipper.level = 3;
  assert.equal(commander(s).habits, 3); assert.equal(commander(s).rank, 'عريف');
});
console.log(`\n${passed} hq tests passed`);
