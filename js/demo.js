// Trial mode: fills a save with made-up progress so every part of the game can be
// seen (all dimensions open and upgraded, ranks, keys, streaks, cups, a defeat on
// the war map). It is fake on purpose — "إعادة اللعبة من البداية" in Settings wipes it.
import { CHARACTERS, REGIONS, CUPS } from './content.js';
import * as E from './engine.js';
import * as C from './cups.js';

const DAY = 86400000;
// Rank reached per character (1 = Bronze 1 … 12 = Platinum 3) and days into the key chain.
const PLAN = {
  worshipper: { rank: 6, keyDays: 11 },
  scholar: { rank: 4, keyDays: 7 },
  athlete: { rank: 3, keyDays: 13 },
  empath: { rank: 2, keyDays: 4, defeat: true },
  host: { rank: 5, keyDays: 9 },
  builder: { rank: 3, keyDays: 2, defeat: true, recovered: true },
  merchant: { rank: 2, keyDays: 14 },
  keeper: { rank: 1, keyDays: 5 },
};
// The spiritual dimension starts empty, so trial mode writes it a ladder too.
const SPIRITUAL = [
  [{ title: 'الصلاة', times: 5 }], [{ title: 'قراءة صفحة من القرآن' }], [{ title: 'أذكار الصباح' }, { title: 'أذكار المساء' }],
  [{ title: 'السنن الرواتب' }], [{ title: 'قيام الليل' }], [{ title: 'صلاة الضحى' }], [{ title: 'صيام الاثنين والخميس' }],
];

export function fillDemo(s, now = Date.now()) {
  const today = E.today(new Date(now)), yesterday = E.today(new Date(now - DAY));
  // Every place open at its highest upgrade, with its character.
  for (const r of REGIONS) {
    s.regions[r.id] = { level: Math.max(1, ...r.upgrades.map((u) => u.level)) };
    if (r.characterId && !s.characters[r.characterId]) s.characters[r.characterId] = { stage: 0, level: 1 };
  }
  SPIRITUAL.forEach((tasks, i) => E.setRankPlan(s, 'worshipper', i, tasks));
  for (const def of CHARACTERS) {
    const ch = s.characters[def.id], p = PLAN[def.id];
    if (!ch || !p) continue;
    const n = p.rank - 1;
    Object.assign(ch, {
      stage: Math.floor(n / 5), level: (n % 5) + 1,
      perfectStreak: p.keyDays + 15 * (p.rank - 1), keyDays: p.keyDays, lastPerfectDate: yesterday, levelDays: 0, levelReady: false,
    });
    if (p.defeat) ch.defeat = { level: p.recovered ? p.rank - 1 : p.rank, date: yesterday };
    else delete ch.defeat;
    // Some of today's tasks already logged, the rest still to do.
    E.activeTasks(def, ch).forEach((t, i) => {
      const times = E.timesOf(t), half = i % 2 === 0;
      s.tasks[`${def.id}.${t.id}`] = half
        ? { streak: p.keyDays + 1, lastDate: today, doneDate: today, count: times, lastResult: 'success', at: now }
        : { streak: p.keyDays, lastDate: yesterday, doneDate: yesterday, count: times, lastResult: 'success', at: now - DAY };
    });
  }
  s.lastDay = today;
  // Keys: 4 in hand, 19 collected over time (commander at عقيد, 2 keys from عميد).
  s.keys = 4;
  s.gold = 2450;
  Object.assign(s.stats, { keysEarned: 19, goldEarned: 6200, goldLost: 310, tasksCompleted: 640, tasksFailed: 23, bestStreak: 64 });
  // Cups: four won, one lost, one under way.
  const c = C.ensure(s);
  c.wallet = 75;
  const won = ['stone', 'wood', 'copper', 'silver'], start = (days) => now - days * DAY;
  c.challenges = [
    ...won.map((id, i) => ({ id: `demo${i}`, channel: i === 3 ? 'body' : 'sanctuary', cupId: id, partner: 'صديق', pin: '0000', start: start(200 - i * 40), status: 'won', endedAt: start(150 - i * 40), keys: C.keyReward(CUPS.find((x) => x.id === id)) })),
    { id: 'demo4', channel: 'library', cupId: 'iron', partner: 'أخي', pin: '0000', start: start(60), status: 'lost', endedAt: start(45) },
    { id: 'demo5', channel: 'sanctuary', cupId: 'gold', partner: 'صديق', pin: '0000', start: start(20), stakeUsd: 63.45, stakeJod: 45, status: 'active' },
  ];
  s.demo = true;
  s.log.unshift({ t: now, text: '🧪 وضع التجربة: تقدّم وهمي لعرض اللعبة', delta: 0 });
  return s;
}
