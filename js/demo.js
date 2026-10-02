// Trial mode: fills a save with made-up progress so every part of the game can be
// seen at its maximum (all dimensions open and fully upgraded, every rank, the top
// commander rank, every cup). It is fake on purpose — "إعادة اللعبة من البداية" in Settings wipes it.
import { CHARACTERS, REGIONS, CUPS } from './content.js';
import * as E from './engine.js';
import * as C from './cups.js';

const DAY = 86400000;
// Everything at its maximum: every character at Platinum 3 with no defeat.
const TOP = 12;
const PLAN = Object.fromEntries(CHARACTERS.map((c) => [c.id, { rank: TOP, keyDays: 14 }]));
// The spiritual dimension starts empty, so trial mode writes all twelve of its ranks.
const SPIRITUAL = [
  [{ title: 'الصلاة', times: 5 }], [{ title: 'قراءة صفحة من القرآن' }], [{ title: 'أذكار الصباح' }, { title: 'أذكار المساء' }],
  [{ title: 'السنن الرواتب' }], [{ title: 'قيام الليل' }], [{ title: 'صلاة الضحى' }], [{ title: 'صيام الاثنين والخميس' }],
  [{ title: 'حفظ آية' }], [{ title: 'صدقة يومية' }], [{ title: 'الاستغفار', times: 3 }], [{ title: 'صلة رحم' }], [{ title: 'ختمة شهرية — جزء يومي' }],
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
    delete ch.defeat;
    // Every task of today already done (a full day in every dimension).
    E.activeTasks(def, ch).forEach((t) => {
      s.tasks[`${def.id}.${t.id}`] = { streak: ch.perfectStreak + 1, lastDate: today, doneDate: today, count: E.timesOf(t), lastResult: 'success', at: now };
    });
    ch.perfectStreak++; ch.lastPerfectDate = today;
  }
  s.lastDay = today;
  // Keys and gold to spare (the commander is at فريق because everything above is at its maximum).
  s.keys = 99;
  s.gold = 99999;
  Object.assign(s.stats, { keysEarned: 120, goldEarned: 150000, goldLost: 0, tasksCompleted: 9000, tasksFailed: 0, bestStreak: 365 });
  // Cups: every cup won, spread over the dimensions.
  const c = C.ensure(s);
  c.wallet = 500;
  const dims = REGIONS.filter((r) => r.characterId).map((r) => r.id);
  let back = 0;
  c.challenges = CUPS.map((cup, i) => {
    const end = now - back * DAY; back += cup.days + 2;
    return { id: `demo${i}`, channel: dims[i % dims.length], cupId: cup.id, partner: 'صديق', pin: '0000', start: end - cup.days * DAY, status: 'won', endedAt: end, keys: C.keyReward(cup) };
  });
  // The ship after the journey: two thirds built, so its building can be seen.
  s.ship = { days: 20, lastDate: yesterday };
  s.demo = true;
  s.log.unshift({ t: now, text: '🧪 وضع التجربة: تقدّم وهمي لعرض اللعبة', delta: 0 });
  return s;
}
