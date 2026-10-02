import assert from 'node:assert/strict';
import * as C from '../js/cups.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✓', name); };
const DAY = 86400000;
const fresh = () => { const s = { keys: 0, regions: { sanctuary: { level: 1 }, library: { level: 1 } } }; C.ensure(s); return s; };

t('stake is days in dinars, deducted from the wallet in dollars', () => {
  const s = fresh();
  C.adjustWallet(s, 20);
  const r = C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'أحمد', pin: '1234', now: 0 });
  assert.ok(r.ok);
  assert.equal(r.challenge.stakeJod, 5);
  assert.equal(s.cups.wallet, 20 - C.stakeUsd(C.findCup('stone')));
});

t('cannot start without enough money or with a bad PIN', () => {
  const s = fresh();
  assert.equal(C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'a', pin: '1234' }).ok, false);
  C.adjustWallet(s, 100);
  assert.equal(C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'a', pin: '12' }).ok, false);
});

t('only one active challenge per channel', () => {
  const s = fresh(); C.adjustWallet(s, 100);
  assert.ok(C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'a', pin: '1111', now: 0 }).ok);
  assert.equal(C.startChallenge(s, { channel: 'sanctuary', cupId: 'wood', partner: 'a', pin: '1111', now: 1 }).ok, false);
});

t('second channel needs the silver cup', () => {
  const s = fresh(); C.adjustWallet(s, 500);
  const a = C.startChallenge(s, { channel: 'sanctuary', cupId: 'silver', partner: 'a', pin: '1111', now: 0 }).challenge;
  assert.equal(C.startChallenge(s, { channel: 'library', cupId: 'stone', partner: 'a', pin: '1111', now: 1 }).ok, false);
  assert.ok(C.judge(s, a.id, '1111', true, 30 * DAY).ok);
  assert.ok(C.startChallenge(s, { channel: 'library', cupId: 'stone', partner: 'a', pin: '1111', now: 31 * DAY }).ok);
});

t('only the partner PIN judges; win returns the stake, loss keeps it with the partner', () => {
  const s = fresh(); C.adjustWallet(s, 50);
  const a = C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'a', pin: '4321', now: 0 }).challenge;
  const after = s.cups.wallet;
  assert.equal(C.judge(s, a.id, '0000', true, 10 * DAY).ok, false);
  assert.equal(C.judge(s, a.id, '4321', true, 2 * DAY).ok, false, 'cannot win before the days are done');
  assert.ok(C.judge(s, a.id, '4321', true, 5 * DAY).ok);
  assert.equal(s.cups.wallet, after + a.stakeUsd);
  assert.ok(C.ownsCup(s, 'stone'));
  const b = C.startChallenge(s, { channel: 'sanctuary', cupId: 'stone', partner: 'a', pin: '4321', now: 6 * DAY }).challenge;
  const w = s.cups.wallet;
  assert.ok(C.judge(s, b.id, '4321', false, 7 * DAY).ok);
  assert.equal(s.cups.wallet, w);
});

t('channels are owned places; a won cup pays one key per 15 days', () => {
  const s = fresh(); C.adjustWallet(s, 500);
  assert.equal(C.startChallenge(s, { channel: 'trophies-nope', cupId: 'stone', partner: 'a', pin: '1111' }).ok, false);
  delete s.regions.library;
  assert.equal(C.canOpenChannel(s, 'library').ok, false);
  const g = C.startChallenge(s, { channel: 'sanctuary', cupId: 'gold', partner: 'a', pin: '1111', now: 0 }).challenge;
  assert.ok(C.judge(s, g.id, '1111', true, 45 * DAY).ok);
  assert.equal(s.keys, 3);
});

console.log(`\n${passed} cup tests passed`);
