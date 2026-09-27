// All game content lives here. Add characters/regions by appending objects —
// the engine, shop and world screens read these lists and need no changes.
// Unlock requirements use the generic condition types in engine.js (CONDITIONS).

// Ranks reached after the starting stage: Bronze 1-3, Silver 1-3, Gold 1-3, Platinum 1-3.
export const RANKS = [
  ['bronze', 'برونز', '#b0743f'], ['silver', 'فضّي', '#9aa4ad'], ['gold', 'ذهبي', '#d4a72c'], ['platinum', 'بلاتينيوم', '#5fb7c2'],
].flatMap(([id, name, color]) => [1, 2, 3].map((n) => ({ id: `${id}${n}`, name: `${name} ${n}`, color })));

// Item costs are objects: { gold?: number, keys?: number }.

// Generic path for characters whose levels add no extra tasks yet.
const plainStages = () => [{ id: 'start', name: 'البداية', levels: Array.from({ length: 5 }, () => ({ adds: [] })) }, ...RANKS.map((r) => ({ ...r, levels: null }))];

export const CHARACTERS = [
  {
    id: 'worshipper',
    name: 'المُصلّي',
    title: 'رجل يصلّي',
    desc: 'شاب متديّن، هادئ ومنضبط. يبدأ رحلته بسجادة صلاة وقلب حاضر.',
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
    palette: { robe: '#fbfaf6', accent: '#3f7d6e', skin: '#f3d3b6', glow: '#f4d58d' },
  },
  {
    id: 'scholar',
    name: 'المفكّر',
    title: 'طالب العلم',
    desc: 'يقرأ ويتعلّم ويحوّل الأفكار إلى فهم.',
    regionId: 'library',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'library' }],
    tasks: [
      { id: 'read', title: 'قراءة 10 صفحات', reward: 25, penalty: 10 },
      { id: 'learn', title: 'تعلّم شيء جديد لمدة 20 دقيقة', reward: 25, penalty: 10 },
      { id: 'review', title: 'مراجعة ما تعلّمته اليوم', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: { robe: '#2f4a6d', accent: '#c9a45c', skin: '#f0cfae', glow: '#9cc3e8' },
  },
  {
    id: 'athlete',
    name: 'الرياضي',
    desc: 'قوي ونشيط، يبني جسده يومًا بعد يوم.',
    regionId: 'body',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'body' }],
    tasks: [
      { id: 'workout', title: 'تمرين 30 دقيقة', reward: 20, penalty: 10 },
      { id: 'water', title: 'شرب 8 أكواب ماء', reward: 20, penalty: 10 },
      { id: 'sleep', title: 'نوم 7 ساعات', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#c0392b', 'accent': '#f5f5f5', 'skin': '#f0cfae', 'glow': '#ff7a5c'},
  },
  {
    id: 'empath',
    name: 'الحكيم الهادئ',
    desc: 'يفهم مشاعره ويهدّئ قلبه.',
    regionId: 'heart',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'heart' }],
    tasks: [
      { id: 'journal', title: 'كتابة مشاعر اليوم', reward: 20, penalty: 10 },
      { id: 'calm', title: '5 دقائق تنفّس وهدوء', reward: 20, penalty: 10 },
      { id: 'gratitude', title: 'ذكر 3 نعم تشكر عليها', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#e8a0b8', 'accent': '#8e3b5e', 'skin': '#f3d3b6', 'glow': '#ffb3cc'},
  },
  {
    id: 'host',
    name: 'المضياف',
    desc: 'يصل رحمه ويجمع الناس حوله.',
    regionId: 'social',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'social' }],
    tasks: [
      { id: 'family', title: 'تواصل مع أحد من العائلة', reward: 20, penalty: 10 },
      { id: 'friend', title: 'التواصل مع صديق', reward: 20, penalty: 10 },
      { id: 'help', title: 'مساعدة شخص', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#e0a93b', 'accent': '#6b3f1d', 'skin': '#f0cfae', 'glow': '#ffd66b'},
  },
  {
    id: 'builder',
    name: 'المحترف',
    desc: 'منظّم ومنجز، يبني مستقبله المهني.',
    regionId: 'career',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'career' }],
    tasks: [
      { id: 'deepwork', title: 'ساعة عمل مركّز', reward: 20, penalty: 10 },
      { id: 'plan', title: 'تخطيط مهام الغد', reward: 20, penalty: 10 },
      { id: 'skill', title: 'تطوير مهارة مهنية', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#34495e', 'accent': '#e67e22', 'skin': '#f0cfae', 'glow': '#f5a35c'},
  },
  {
    id: 'merchant',
    name: 'التاجر الأمين',
    desc: 'يدّخر بحكمة وينفق بعقل.',
    regionId: 'wealth',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'wealth' }],
    tasks: [
      { id: 'track', title: 'تسجيل مصاريف اليوم', reward: 20, penalty: 10 },
      { id: 'save', title: 'ادخار مبلغ ولو صغير', reward: 20, penalty: 10 },
      { id: 'nowaste', title: 'يوم بلا شراء غير ضروري', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#1e6b52', 'accent': '#ffc83d', 'skin': '#f0cfae', 'glow': '#ffe07a'},
  },
  {
    id: 'keeper',
    name: 'حارس الطبيعة',
    desc: 'يحب الأرض ويعتني بما حوله.',
    regionId: 'nature',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'nature' }],
    tasks: [
      { id: 'tidy', title: 'ترتيب غرفتك أو مكانك', reward: 20, penalty: 10 },
      { id: 'outside', title: '15 دقيقة في الطبيعة', reward: 20, penalty: 10 },
      { id: 'reduce', title: 'تقليل الهدر (بلاستيك/ماء/كهرباء)', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 15,
    daysPerLevel: 15,
    stages: plainStages(),
    palette: {'robe': '#4f7a2e', 'accent': '#8b5a2b', 'skin': '#f0cfae', 'glow': '#9fe37a'},
  },

];

// Each region upgrade adds one visual element (key) to the region scene.
export const REGIONS = [
  {
    id: 'sanctuary',
    name: 'البعد الروحي',
    dimension: 'spiritual',
    desc: 'قصر السكينة: ساحة صلاة بين الحدائق، تزدهر كلما التزمت بصلاتك وذكرك.',
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
      { level: 3, cost: 120, adds: 'palms', label: 'أشجار الحديقة' },
      { level: 4, cost: 200, adds: 'fountain', label: 'نافورة الوضوء' },
      { level: 5, cost: 320, adds: 'arch', label: 'قوس المحراب' },
      { level: 6, cost: 480, adds: 'stars', label: 'سماء مرصّعة' },
    ],
  },
  {
    id: 'library',
    name: 'البعد الفكري',
    dimension: 'intellectual',
    desc: 'برج المعرفة: مكتبة ومرصد يعلوان كلما قرأت وتعلّمت.',
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
  {
    id: 'body',
    dimension: 'body',
    name: 'البعد الجسدي',
    desc: 'ساحة الأبطال: ملعب وحلبة تدريب تقوى كلما اعتنيت بجسدك.',
    characterId: 'athlete',
    cost: { keys: 1 },
    requires: [],
    map: { x: 300, y: 300, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'heart',
    dimension: 'heart',
    name: 'البعد العاطفي',
    desc: 'حديقة القلب: بحيرة هادئة وأشجار زهر، تزهر كلما اعتنيت بمشاعرك.',
    characterId: 'empath',
    cost: { keys: 1 },
    requires: [],
    map: { x: 190, y: 430, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'social',
    dimension: 'social',
    name: 'البعد الاجتماعي',
    desc: 'ساحة الحي: بيوت وسوق وساحة لقاء، تعمر كلما وصلت الناس.',
    characterId: 'host',
    cost: { keys: 1 },
    requires: [],
    map: { x: 640, y: 610, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'career',
    dimension: 'career',
    name: 'البعد المهني',
    desc: 'برج الإنجاز: ورشة ومكتب يعلوان كلما تقدّمت في عملك.',
    characterId: 'builder',
    cost: { keys: 1 },
    requires: [],
    map: { x: 820, y: 420, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'wealth',
    dimension: 'wealth',
    name: 'البعد المالي',
    desc: 'خزينة الذهب: سوق وخزنة تمتلئ كلما أحسنت إدارة مالك.',
    characterId: 'merchant',
    cost: { keys: 1 },
    requires: [],
    map: { x: 840, y: 190, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'nature',
    dimension: 'nature',
    name: 'البعد البيئي',
    desc: 'الغابة الحيّة: شجرة عملاقة وحديقة تخضرّ كلما اعتنيت بمحيطك.',
    characterId: 'keeper',
    cost: { keys: 1 },
    requires: [],
    map: { x: 560, y: 120, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    // Headquarters: the commander's level rises by itself from opened places and developed characters.
    id: 'hq',
    kind: 'hq',
    name: 'مقر القيادة',
    desc: 'قلعة القائد: من هنا تتابع تقدّمك كله.',
    cost: {},
    starter: true,
    requires: [],
    map: { x: 175, y: 640 },   // on a plateau south of the emotional dimension
    upgrades: [],
  },
  {
    // A special floating island: not a character's home but the challenge arena.
    id: 'trophies',
    kind: 'trophies',
    name: 'جزيرة الكؤوس',
    desc: 'جزيرة معلّقة في السماء، فيها كؤوس التحدي.',
    cost: {},
    starter: true,
    requires: [],
    map: { x: -330, y: -170 },   // far out over the sea, off the main island
    floating: true,
    upgrades: [],
  },
];

// Challenge cups: the challenger must stay clean for `days` days. The stake is
// `days` dinars (rule 7), held by the second party until they judge the result.
export const CUPS = [
  { id: 'stone', name: 'الكأس الحجري', days: 5, color: '#8d8a84', metal: 0 },
  { id: 'wood', name: 'الكأس الخشبي', days: 10, color: '#8b5a2b', metal: 0 },
  { id: 'copper', name: 'الكأس النحاسي', days: 15, color: '#c26a3a', metal: 0.8 },
  { id: 'bronze', name: 'الكأس البرونزي', days: 20, color: '#cd7f32', metal: 0.85 },
  { id: 'iron', name: 'الكأس الحديدي', days: 25, color: '#6e7479', metal: 0.9 },
  { id: 'silver', name: 'الكأس الفضي', days: 30, color: '#d8dde3', metal: 1 },
  { id: 'gold', name: 'الكأس الذهبي', days: 45, color: '#ffc83d', metal: 1 },
  { id: 'platinum', name: 'الكأس البلاتيني', days: 60, color: '#9fe3e8', metal: 1 },
  { id: 'diamond', name: 'الكأس الماسي', days: 75, color: '#aeeaff', metal: 0.3, glow: '#7fdcff' },
  { id: 'master', name: 'ماستر', days: 90, color: '#9b59d0', metal: 0.7, glow: '#c38bff' },
  { id: 'grandmaster', name: 'غراند ماستر', days: 120, color: '#d0364a', metal: 0.7, glow: '#ff5a6e' },
  { id: 'challenger', name: 'تشالنجر', days: 150, color: '#4fd0ff', metal: 0.8, glow: '#ffe07a' },
  { id: 'legendary', name: 'أسطوري', days: 180, color: '#ff8a00', metal: 0.8, glow: '#ffb14d' },
];
// Channel rule: opening a second channel requires owning this cup.
export const CHANNEL_UNLOCK_CUP = 'silver';
export const JOD_TO_USD = 1.41;


// Commander ranks by level (مقر القيادة).
export const COMMAND_RANKS = [
  [1, 'جندي'], [3, 'عريف'], [5, 'رقيب'], [8, 'ملازم'], [11, 'نقيب'],
  [15, 'رائد'], [20, 'عقيد'], [26, 'عميد'], [33, 'لواء'], [41, 'فريق'],
];
