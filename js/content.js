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

// Ready-made habits the player can pick for each dimension (or write their own).
export const SUGGEST = {
  worshipper: [['🕌', 'الصلاة', 5], ['📖', 'قراءة صفحة قرآن', 1], ['📿', 'أذكار الصباح والمساء', 2], ['🤲', 'الاستغفار 100 مرة', 1], ['💝', 'صدقة ولو بسيطة', 1], ['🌙', 'ركعتين قيام ليل', 1], ['🎧', 'سماع درس ديني', 1]],
  scholar: [['📚', 'قراءة 10 صفحات', 1], ['🧠', 'تعلّم شي جديد 20 دقيقة', 1], ['🔁', 'مراجعة اللي تعلّمته', 1], ['🗣', 'تعلّم 5 كلمات بلغة جديدة', 1], ['✍', 'لخّص فكرة بدفترك', 1], ['🎧', 'بودكاست مفيد', 1]],
  athlete: [['🏋', 'تمرين 30 دقيقة', 1], ['💧', 'كاسة مي', 8], ['😴', 'نوم 7 ساعات', 1], ['🚶', 'مشي 6000 خطوة', 1], ['🥗', 'أكل صحي بدون سكر', 1], ['🤸', 'تمارين تمدّد 10 دقايق', 1]],
  empath: [['🤝', 'ساعد حدا بدون ما يطلب', 1], ['🕊', 'سامح شخص زعّلك', 1], ['🎁', 'آثِر غيرك بإشي بتحبه', 1], ['👂', 'اسمع لحدا للآخر بدون مقاطعة', 1], ['🏥', 'زور مريض أو اتصل فيه', 1], ['🤲', 'ادعِ لغيرك بظهر الغيب', 1], ['🧓', 'اخدم أبوك أو أمك', 1], ['🫡', 'وفّي بوعد وعدته', 1], ['🙊', 'امسك لسانك عن الغيبة', 1], ['🍞', 'أطعم محتاج', 1]],
  host: [['👪', 'تواصل مع حدا من العيلة', 1], ['📞', 'كلّم صديق', 1], ['🤝', 'ساعد شخص', 1], ['🏠', 'زور قريب', 1], ['💬', 'كلمة شكر لحدا', 1], ['🍽', 'أكلة مع العيلة', 1]],
  builder: [['🎯', 'ساعة شغل مركّز', 1], ['🗓', 'خطّط مهام بكرا', 1], ['🛠', 'طوّر مهارة بشغلك', 1], ['⏰', 'اصحى بكّير', 1], ['📈', 'اشتغل على مشروعك 30 دقيقة', 1], ['📧', 'صفّر الإيميلات', 1]],
  merchant: [['🧾', 'سجّل مصاريف اليوم', 1], ['🐖', 'ادّخر ولو مبلغ صغير', 1], ['🚫', 'يوم بلا شراء مش ضروري', 1], ['📊', 'راجع ميزانيتك', 1], ['💡', 'فكّر بدخل إضافي 10 دقايق', 1], ['📚', 'تعلّم عن المال 10 دقايق', 1]],
  keeper: [['🧹', 'رتّب غرفتك', 1], ['🌳', '15 دقيقة بالطبيعة', 1], ['♻', 'قلّل الهدر', 1], ['🌱', 'اسقِ نبتة', 1], ['🚯', 'يوم بدون بلاستيك', 1], ['🚶', 'امشِ بدل السيارة', 1]],
};

export const CHARACTERS = [
  {
    id: 'worshipper',
    name: 'البعد الروحي',
    desc: 'هادئ ومنضبط. أنت بتحدد مهامه اليومية وكم مرة باليوم.',
    regionId: 'sanctuary',
    cost: {},
    starter: true,
    requires: [],
    // A "perfect day" = every task done as many times as it needs that day.
    keyEveryDays: 7, // consecutive perfect days → 1 key (RULES.keyDays)
    daysPerLevel: 7,
    // No preset tasks: the player writes each rank's tasks (and times per day).
    tasks: [],
    stages: plainStages(),
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
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'read', title: 'قراءة 10 صفحات', reward: 25, penalty: 10 },
      { id: 'learn', title: 'تعلّم شيء جديد لمدة 20 دقيقة', reward: 25, penalty: 10 },
      { id: 'review', title: 'مراجعة ما تعلّمته اليوم', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
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
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'workout', title: 'تمرين 30 دقيقة', reward: 20, penalty: 10 },
      { id: 'water', title: 'شرب 8 أكواب ماء', reward: 20, penalty: 10 },
      { id: 'sleep', title: 'نوم 7 ساعات', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
    stages: plainStages(),
    palette: {'robe': '#c0392b', 'accent': '#f5f5f5', 'skin': '#f0cfae', 'glow': '#ff7a5c'},
  },
  {
    id: 'empath',
    name: 'الحكيم الهادئ',
    desc: 'صاحب ضمير حي: يحسّ بغيره ويقدّمه على نفسه.',
    regionId: 'heart',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'heart' }],
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'journal', title: 'كتابة مشاعر اليوم', reward: 20, penalty: 10 },
      { id: 'calm', title: '5 دقائق تنفّس وهدوء', reward: 20, penalty: 10 },
      { id: 'gratitude', title: 'ذكر 3 نعم تشكر عليها', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
    stages: plainStages(),
    palette: {'robe': '#34505e', 'accent': '#b08a4a', 'skin': '#f0cfae', 'glow': '#e8c070'},
  },
  {
    id: 'host',
    name: 'المضياف',
    desc: 'يصل رحمه ويجمع الناس حوله.',
    regionId: 'social',
    cost: {},
    requires: [{ type: 'ownsRegion', id: 'social' }],
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'family', title: 'تواصل مع أحد من العائلة', reward: 20, penalty: 10 },
      { id: 'friend', title: 'التواصل مع صديق', reward: 20, penalty: 10 },
      { id: 'help', title: 'مساعدة شخص', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
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
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'deepwork', title: 'ساعة عمل مركّز', reward: 20, penalty: 10 },
      { id: 'plan', title: 'تخطيط مهام الغد', reward: 20, penalty: 10 },
      { id: 'skill', title: 'تطوير مهارة مهنية', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
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
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'track', title: 'تسجيل مصاريف اليوم', reward: 20, penalty: 10 },
      { id: 'save', title: 'ادخار مبلغ ولو صغير', reward: 20, penalty: 10 },
      { id: 'nowaste', title: 'يوم بلا شراء غير ضروري', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
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
    tasks: [],
    // Old preset tasks: kept only so saves from before the habit picker keep them.
    legacyTasks: [
      { id: 'tidy', title: 'ترتيب غرفتك أو مكانك', reward: 20, penalty: 10 },
      { id: 'outside', title: '15 دقيقة في الطبيعة', reward: 20, penalty: 10 },
      { id: 'reduce', title: 'تقليل الهدر (بلاستيك/ماء/كهرباء)', reward: 20, penalty: 10 },
    ],
    keyEveryDays: 7,
    daysPerLevel: 7,
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
    desc: 'قصر السكينة: ساحة هادئة بين الحدائق، تزدهر كلما التزمت بمهامك اليومية.',
    characterId: 'worshipper',
    cost: {},
    starter: true,
    requires: [],
    // Position on the world map (1000×700). Places are hidden in fog until
    // the place named in `revealedBy` is owned.
    map: { x: 500, y: 380 },
    theme: { sky: ['#1d3b4f', '#e8c89a'], ground: '#d9c7a3' },
    upgrades: [
      { level: 2, cost: 60, adds: 'lanterns', label: 'فوانيس مضيئة' },
      { level: 3, cost: 120, adds: 'palms', label: 'أشجار الحديقة' },
      { level: 4, cost: 200, adds: 'fountain', label: 'نافورة الوضوء' },
      { level: 5, cost: 320, adds: 'arch', label: 'المحراب' },
      { level: 6, cost: 480, adds: 'minaret', label: 'المئذنة' },
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
    map: { x: 168, y: 246, revealedBy: 'sanctuary' },
    theme: { sky: ['#243048', '#8fa7c4'], ground: '#6b5540' },
    upgrades: [
      { level: 2, cost: 80, adds: 'telescope', label: 'تلسكوب المرصد' },
      { level: 3, cost: 160, adds: 'chandelier', label: 'ثريّا ذهبية' },
      { level: 4, cost: 260, adds: 'calligraphy', label: 'لوحات الخط العربي' },
      { level: 5, cost: 400, adds: 'fountain', label: 'نافورة الحكمة' },
      { level: 6, cost: 560, adds: 'owl', label: 'بومة الحكمة' },
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
    map: { x: 114, y: 442, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'weights', label: 'منطقة القوة' },
      { level: 3, cost: 160, adds: 'runners', label: 'عدّاؤون على المضمار' },
      { level: 4, cost: 260, adds: 'food', label: 'ركن الغذاء الصحي' },
      { level: 5, cost: 400, adds: 'pool', label: 'المسبح' },
      { level: 6, cost: 560, adds: 'clinic', label: 'عيادة الصحة' },
    ],
  },
  {
    id: 'heart',
    dimension: 'heart',
    name: 'البعد الوجداني',
    desc: 'حديقة السكينة: بركة هادئة وأشجار وارفة، تعمر كلما قدّمت غيرك على نفسك.',
    characterId: 'empath',
    cost: { keys: 1 },
    requires: [],
    map: { x: 437, y: 617, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'sabil', label: 'سبيل الماء' },
      { level: 3, cost: 160, adds: 'olive', label: 'زيتونة معمّرة' },
      { level: 4, cost: 260, adds: 'doves', label: 'برج الحمام' },
      { level: 5, cost: 400, adds: 'well', label: 'البئر القديمة' },
      { level: 6, cost: 560, adds: 'bench', label: 'مقعد التأمل' },
    ],
  },
  {
    id: 'social',
    dimension: 'social',
    name: 'البعد الاجتماعي',
    desc: 'ساحة الحي: بيوت وسوق وساحة لقاء، تعمر كلما وصلت الناس.',
    characterId: 'host',
    cost: { keys: 1 },
    requires: [],
    map: { x: 757, y: 564, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'tent', label: 'خيمة الضيافة' },
      { level: 3, cost: 160, adds: 'coffee', label: 'ركن القهوة العربية' },
      { level: 4, cost: 260, adds: 'playground', label: 'ملعب الأطفال' },
      { level: 5, cost: 400, adds: 'stalls', label: 'بسطات الحي' },
      { level: 6, cost: 560, adds: 'fountain', label: 'نافورة الساحة' },
    ],
  },
  {
    id: 'career',
    dimension: 'career',
    name: 'البعد المهني',
    desc: 'ساحة الإنجاز: أبراج ومكاتب تعلو كلما تقدّمت في عملك.',
    characterId: 'builder',
    cost: { keys: 1 },
    requires: [],
    map: { x: 900, y: 384, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'desks', label: 'مكاتب الفريق' },
      { level: 3, cost: 160, adds: 'screen', label: 'شاشة الإنجاز' },
      { level: 4, cost: 260, adds: 'stairs', label: 'سلّم النجاح' },
      { level: 5, cost: 400, adds: 'cafe', label: 'ركن القهوة' },
      { level: 6, cost: 560, adds: 'team', label: 'فريق العمل' },
    ],
  },
  {
    id: 'wealth',
    dimension: 'wealth',
    name: 'البعد المالي',
    desc: 'ميناء التاجر: سفن وسوق وبيت مال يعمر كلما أحسنت إدارة مالك.',
    characterId: 'merchant',
    cost: { keys: 1 },
    requires: [],
    map: { x: 768, y: 202, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'market', label: 'سوق الميناء' },
      { level: 3, cost: 160, adds: 'ships', label: 'السفن التجارية' },
      { level: 4, cost: 260, adds: 'vault', label: 'خزنة الذهب' },
      { level: 5, cost: 400, adds: 'lighthouse', label: 'المنارة' },
      { level: 6, cost: 560, adds: 'garden', label: 'حديقة القصر' },
    ],
  },
  {
    id: 'nature',
    dimension: 'nature',
    name: 'البعد البيئي',
    desc: 'الغابة الحيّة: شجرة عملاقة وحديقة تخضرّ كلما اعتنيت بمحيطك.',
    characterId: 'keeper',
    cost: { keys: 1 },
    requires: [],
    map: { x: 451, y: 142, revealedBy: 'sanctuary' },
    upgrades: [
      { level: 2, cost: 80, adds: 'turbines', label: 'طواحين الرياح' },
      { level: 3, cost: 160, adds: 'solar', label: 'ألواح شمسية' },
      { level: 4, cost: 260, adds: 'greenhouse', label: 'الدفيئة الزراعية' },
      { level: 5, cost: 400, adds: 'animals', label: 'حيوانات الغابة' },
      { level: 6, cost: 560, adds: 'beehives', label: 'خلايا النحل' },
    ],
  },
  {
    // The Island of Leaders: shown on the map after the commander's speech, closed until the ship is built.
    id: 'leaders',
    kind: 'leaders',
    name: 'جزيرة القادة',
    desc: 'جزيرة بعيدة، فيها مكان بين القادة العظماء. ما بتوصلها إلا بالسفينة اللي بيبنيها محاربينك.',
    cost: {},
    requires: [],
    map: { x: 960, y: 90 },
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
    map: { x: 175, y: 640 },   // direction only: the world and war map set it off the coast on its own islet
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

// The dark king each dimension fights every week (Lucifer leads them all).
export const KINGS = {
  sanctuary: 'ملك الفراغ', library: 'ملك الضباب', body: 'ملك التسويف', heart: 'ملك الجرح',
  social: 'ملك العزلة', career: 'ملك الكسل', wealth: 'ملك الهدر', nature: 'ملك الفوضى',
};
