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
    name: 'البعد الروحي',
    desc: 'هادئ ومنضبط. أنت بتحدد مهامه اليومية وكم مرة باليوم.',
    regionId: 'sanctuary',
    cost: {},
    starter: true,
    requires: [],
    // A "perfect day" = every task done as many times as it needs that day.
    keyEveryDays: 15, // consecutive perfect days → 1 key
    daysPerLevel: 15,
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
    palette: {'robe': '#3d5a80', 'accent': '#e0c36a', 'skin': '#f3d3b6', 'glow': '#9ad1d4'},
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
    map: { x: 168, y: 246, revealedBy: 'sanctuary' },
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
    map: { x: 114, y: 442, revealedBy: 'sanctuary' },
    upgrades: [],
  },
  {
    id: 'heart',
    dimension: 'heart',
    name: 'البعد الوجداني',
    desc: 'بيت الوجدان: جناح هادئ على جزيرة وسط بحيرة، يصفى كلما اعتنيت بمشاعرك.',
    characterId: 'empath',
    cost: { keys: 1 },
    requires: [],
    map: { x: 437, y: 617, revealedBy: 'sanctuary' },
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
    map: { x: 757, y: 564, revealedBy: 'sanctuary' },
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
    map: { x: 900, y: 384, revealedBy: 'sanctuary' },
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
    map: { x: 768, y: 202, revealedBy: 'sanctuary' },
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
    map: { x: 451, y: 142, revealedBy: 'sanctuary' },
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

// ---------- Suggested rank ladders for the seven dimensions ----------
// One extra daily task per rank (Bronze 2 → Platinum 3). These are only the starting
// suggestion: the player rewrites any rank from "رتب الأبعاد" in headquarters.
const LADDERS = {
  scholar: ['كتابة ملخص لما قرأت', 'حفظ معلومة جديدة', 'ساعة بدون هاتف للتركيز', 'قراءة مقال باللغة الإنجليزية', 'كتابة فكرة جديدة بدفتر الأفكار', 'مشاهدة محاضرة تعليمية', 'شرح شيء تعلّمته لشخص', 'حل مسألة أو لغز', 'قراءة كتاب في مجال جديد', 'كتابة صفحة يوميات فكرية', 'تعليم غيرك مهارة'],
  athlete: ['10 دقائق إطالة', 'مشي 6000 خطوة', 'بدون سكر مضاف', 'تمرين قوة 20 دقيقة', 'نوم قبل 12 بالليل', 'مشي 10000 خطوة', 'وجبة صحية مطبوخة بالبيت', 'بدون مشروبات غازية', 'جري 20 دقيقة', 'تمرين صباحي قبل الفطور', 'تحدّي رياضي أسبوعي'],
  empath: ['تسمية شعورك بصوت عالي', 'استماع بدون مقاطعة', 'مسامحة موقف صغير', '10 دقائق تأمل', 'رسالة امتنان لشخص', 'التعامل مع الغضب بهدوء', 'قول "لا" بلطف عند الحاجة', 'ساعة بدون شكوى', 'كتابة 3 أشياء فخور فيها', 'مساعدة شخص يمر بوقت صعب', 'يوم كامل بدون انفعال'],
  host: ['تحية جار أو زميل', 'اتصال بأحد الوالدين', 'دعوة شخص لقهوة', 'زيارة قريب', 'مدح صادق لشخص', 'المشاركة بعمل تطوعي', 'تعرّف على شخص جديد', 'جمعة عائلية', 'إصلاح علاقة مقطوعة', 'تنظيم لقاء أصدقاء', 'خدمة للحي أو المجتمع'],
  builder: ['ترتيب مكتبك قبل العمل', 'إنجاز أصعب مهمة أولًا', 'ساعتين عمل مركّز', 'قراءة 10 صفحات بمجالك', 'تواصل مع شخص بمجالك', 'تعلّم أداة جديدة', 'مراجعة أهداف الأسبوع', 'إنهاء مهمة معلّقة', 'مشروع جانبي 30 دقيقة', 'مشاركة شيء تعلمته بالعمل', 'تقييم شهري للإنجاز'],
  merchant: ['مراجعة الرصيد', 'إعداد ميزانية الأسبوع', 'طبخ بدل الأكل برا', 'ادخار 5% من الدخل', 'قراءة عن الاستثمار', 'إلغاء اشتراك غير مستخدم', 'صدقة ولو قليلة', 'تسجيل كل مصروف', 'ادخار 10% من الدخل', 'خطة لسداد دين', 'استثمار مبلغ صغير'],
  keeper: ['سقاية نبتة', 'إطفاء الأضواء غير المستعملة', 'إعادة تدوير', 'مشي بالطبيعة 30 دقيقة', 'زراعة بذرة', 'بدون كيس بلاستيك', 'تنظيف مكان عام', 'تقليل استهلاك الماء', 'استخدام مواصلات عامة أو مشي', 'العناية بحيوان', 'زراعة شجرة'],
};
for (const c of CHARACTERS) {
  if (LADDERS[c.id]) c.ladder = LADDERS[c.id].map((title, i) => ({ id: `${c.id}_r${i + 2}`, title, reward: 20, penalty: 10 }));
}

// Gold upgrades for the dimensions that had none: each shows up inside the place
// (generic decorations drawn by place3d.js: lanterns, garden, fountain, banners).
const UPGRADES = {
  body: ['مشاعل الملعب', 'حديقة الأبطال', 'نافورة الماء', 'رايات النصر'],
  heart: ['فوانيس هادئة', 'حديقة التأمل', 'نافورة السكون', 'رايات الوجدان'],
  social: ['فوانيس الساحة', 'حديقة الحي', 'نافورة اللقاء', 'رايات الحي'],
  career: ['أضواء الورشة', 'حديقة المكتب', 'نافورة الإنجاز', 'رايات المشاريع'],
  wealth: ['مصابيح السوق', 'بستان الخير', 'نافورة البركة', 'رايات التجارة'],
  nature: ['فوانيس الغابة', 'حديقة الأزهار', 'جدول الماء', 'أعلام الأرض'],
};
const KINDS = ['lanterns', 'garden', 'fountain', 'banners'];
for (const r of REGIONS) {
  if (UPGRADES[r.id] && !r.upgrades.length) r.upgrades = UPGRADES[r.id].map((label, i) => ({ level: i + 2, cost: [80, 160, 260, 400][i], adds: KINDS[i], label }));
}
