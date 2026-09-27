// All game content lives here. Add characters/regions by appending objects —
// the engine, shop and world screens read these lists and need no changes.
// Unlock requirements use the generic condition types in engine.js (CONDITIONS).

// Ranks reached after the starting stage: Bronze 1-3, Silver 1-3, Gold 1-3, Platinum 1-3.
export const RANKS = [
  ['bronze', 'برونز', '#b0743f'], ['silver', 'فضّي', '#9aa4ad'], ['gold', 'ذهبي', '#d4a72c'], ['platinum', 'بلاتينيوم', '#5fb7c2'],
].flatMap(([id, name, color]) => [1, 2, 3].map((n) => ({ id: `${id}${n}`, name: `${name} ${n}`, color })));

// Item costs are objects: { gold?: number, keys?: number }.

export const CHARACTERS = [
  {
    id: 'worshipper',
    name: 'المُصلّي',
    title: 'رجل يصلّي',
    desc: 'هادئ ومنضبط. يبدأ رحلته بسجادة صلاة وقلب حاضر.',
    regionId: 'sanctuary',
    cost: {},
    starter: true,
    requires: [],
    // A "perfect day" = every task of the current level reported as done.
    keyEveryDays: 15, // consecutive perfect days → 1 key (max one key per 15 days)
    daysPerLevel: 15, // consecutive perfect days needed before a level can be raised (costs 1 key)
    // Base daily tasks, always active.
    tasks: [
      { id: 'fajr', prayer: 'fajr', title: 'صلاة الفجر في وقتها', reward: 30, penalty: 15 },
      { id: 'dhuhr', prayer: 'dhuhr', title: 'صلاة الظهر في وقتها', reward: 20, penalty: 10 },
      { id: 'asr', prayer: 'asr', title: 'صلاة العصر في وقتها', reward: 20, penalty: 10 },
      { id: 'maghrib', prayer: 'maghrib', title: 'صلاة المغرب في وقتها', reward: 20, penalty: 10 },
      { id: 'isha', prayer: 'isha', title: 'صلاة العشاء في وقتها', reward: 20, penalty: 10 },
    ],
    // Progression: stages of 5 levels. Each level may add daily tasks on top of
    // everything before it. Finishing level 5 of a stage moves to the next stage.
    // A stage with `levels: null` is announced but not designed yet.
    stages: [
      { id: 'start', name: 'البداية', levels: [
        { adds: [] },
        { adds: [{ id: 'quran', title: 'قراءة صفحة من القرآن', reward: 20, penalty: 10 }] },
        { adds: [
          { id: 'adhkar_am', title: 'أذكار الصباح', reward: 15, penalty: 5 },
          { id: 'adhkar_pm', title: 'أذكار المساء', reward: 15, penalty: 5 },
        ] },
        { adds: [{ id: 'sunnah', title: 'صلاة السنن الرواتب', reward: 25, penalty: 10 }] },
        { adds: [{ id: 'qiyam', title: 'قيام الليل', reward: 30, penalty: 10 }] },
      ] },
      ...RANKS.map((r) => ({ ...r, levels: null })),
    ],
    palette: { robe: '#e9e4d8', accent: '#3f7d6e', skin: '#c89a74', glow: '#f4d58d' },
  },
  {
    id: 'scholar',
    name: 'القارئ',
    title: 'طالب العلم',
    desc: 'يحوّل الخطط إلى خطوات، والخطوات إلى إنجاز.',
    regionId: 'library',
    // Comes free with its place on the world map.
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'library' }],
    tasks: [
      { id: 'read', title: 'قراءة 10 صفحات', reward: 25, penalty: 10 },
      { id: 'learn', title: 'تعلّم شيء جديد لمدة 20 دقيقة', reward: 25, penalty: 10 },
      { id: 'review', title: 'مراجعة ما تعلّمته اليوم', reward: 20, penalty: 10 },
    ],
    palette: { robe: '#2f4a6d', accent: '#c9a45c', skin: '#b98a66', glow: '#9cc3e8' },
  },
];

// Each region upgrade adds one visual element (key) to the region scene.
export const REGIONS = [
  {
    id: 'sanctuary',
    name: 'الواحة الهادئة',
    desc: 'ساحة صلاة في واحة ساكنة، تنمو كلما التزمت.',
    characterId: 'worshipper',
    cost: {},
    starter: true,
    requires: [],
    // Position on the world map (1000×700). Places are hidden in fog until
    // the place named in `revealedBy` is owned.
    map: { x: 470, y: 400 },
    theme: { sky: ['#1d3b4f', '#e8c89a'], ground: '#d9c7a3' },
    upgrades: [
      { level: 2, cost: 60, adds: 'lanterns', label: 'فوانيس مضيئة' },
      { level: 3, cost: 120, adds: 'palms', label: 'نخيل الواحة' },
      { level: 4, cost: 200, adds: 'fountain', label: 'نافورة الوضوء' },
      { level: 5, cost: 320, adds: 'arch', label: 'قوس المحراب' },
      { level: 6, cost: 480, adds: 'stars', label: 'سماء مرصّعة' },
    ],
  },
  {
    id: 'library',
    name: 'المكتبة العالية',
    desc: 'مكان للتخطيط والتعلّم ورؤية مشاريعك تكبر.',
    characterId: 'scholar',
    cost: { keys: 1 },
    requires: [],
    map: { x: 680, y: 250, revealedBy: 'sanctuary' },
    theme: { sky: ['#243048', '#8fa7c4'], ground: '#6b5540' },
    upgrades: [
      { level: 2, cost: 80, adds: 'shelves', label: 'رفوف الكتب' },
      { level: 3, cost: 160, adds: 'desk', label: 'مكتب الكتابة' },
      { level: 4, cost: 260, adds: 'globe', label: 'كرة أرضية' },
      { level: 5, cost: 400, adds: 'window', label: 'نافذة القمر' },
    ],
  },
];


