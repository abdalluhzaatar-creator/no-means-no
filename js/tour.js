// The guided first steps: a spotlight on one thing at a time, a pointing hand and one
// line of text. A step moves on by itself when the player does what it asks (enters a
// place, picks a habit…) or with "التالي". After the tour, one-time tips point at a
// system the first time it shows up (the league, the first key).
// The overlay never blocks the game: clicks pass through everything but the bubble.

const $ = (s) => document.querySelector(s);
const label = (txt) => [...document.querySelectorAll('.w3-label')].find((e) => e.textContent.includes(txt));

// ctx: { screen, state, modal (open?), hasHabit, fly(placeId) — brings a place into view }
const STEPS = [
  { when: (c) => c.screen === 'world', target: () => label('الروحي'), fly: 'sanctuary',
    text: 'هاد عالمك 🗺 — اكبس على <b>البعد الروحي</b> وفوت عليه.', done: (c) => c.screen === 'character' },
  { when: (c) => c.screen === 'character' && c.modal, modal: true, target: () => $('#modal .modal-box'), place: 'top',
    text: 'اختار <b>أول عادة</b> إلك (أو اكتب عادتك)، وبعدين اكبس <b>ثبّت المهمة ✔</b>.', done: (c) => c.hasHabit },
  { when: (c) => c.screen === 'character', target: () => null,
    text: 'شوف <b>المبنى</b> اللي انبنى: عليه <b>عدّاد العادة ⏱</b> بيعد الأيام والساعات. اكبس عالمبنى عشان <b>⏸ توقفه</b> أو <b>↺ تصفّره</b> إذا كسرتها.', next: true },
  { target: () => $('#habits-box'),
    text: 'هاد <b>عدّاد المباني 🏗</b>: كل بُعد فيه 8 مباني، وكل مبنى = عادة. لما تبنيهم كلهم بتجهز السفينة 🚢.', next: true },
  { target: () => $('#habits-box'),
    text: '<b>كل أحد</b> بتجيك <b>رسالة 📬</b>: ابني عادة جديدة، أو افتح بُعد جديد، أو "لا تستحق" وبيضل كل إشي زي ما هو.', next: true },
  { when: (c) => c.screen !== 'world', target: () => $('.nav-btn[data-screen="world"]'),
    text: 'هلأ ارجع <b>عالعالم</b>…', done: (c) => c.screen === 'world' || c.screen === 'hq' },
  { when: (c) => c.screen === 'world', target: () => label('القيادة'), fly: 'hq',
    text: '…وفوت على <b>مقر القيادة</b>: هناك القائد، ورتب الأبعاد، وخريطة الأبعاد.', done: (c) => c.screen === 'hq' },
  { when: (c) => c.screen === 'hq', target: () => $('[data-war-map]'),
    text: 'هاي <b>خريطة الأبعاد</b>: بتشوف فيها كل بُعد وكم مبنى فيه. بالتوفيق يا قائد 🎖', next: true, last: true },
];

// One-time tips after the tour.
const TIPS = [];

export function createTour({ ctx, save, onFinish }) {
  const root = document.createElement('div'); root.className = 'coach'; root.hidden = true;
  root.innerHTML = '<div class="coach-spot"></div><div class="coach-hand">👆</div><div class="coach-bubble"><p></p><div class="coach-row"><button class="coach-next">التالي ←</button><button class="coach-skip">تخطّي الدليل</button></div></div>';
  document.body.appendChild(root);
  const spot = root.querySelector('.coach-spot'), hand = root.querySelector('.coach-hand'), bubble = root.querySelector('.coach-bubble');
  const text = bubble.querySelector('p'), next = bubble.querySelector('.coach-next'), skip = bubble.querySelector('.coach-skip');
  let cur = null, raf = 0, scrolled = null;

  const st = () => ctx().state;
  const step = () => { const t = st().tour; return typeof t === 'number' ? STEPS[t] : null; };
  const advance = () => {
    const s = st();
    if (typeof s.tour !== 'number') return;
    if (STEPS[s.tour]?.last || s.tour + 1 >= STEPS.length) { s.tour = 'done'; onFinish?.(); } else s.tour++;
    save();
  };
  next.onclick = () => { if (cur?.tip) { st().tips = { ...(st().tips || {}), [cur.tip]: true }; save(); } else advance(); cur = null; };
  skip.onclick = () => { st().tour = 'done'; save(); cur = null; };

  // What to show now: a tour step, or a tip once the tour is over.
  const pick = (c) => {
    const s = step();
    if (s) {
      if (s.done?.(c)) { advance(); return pick(c); }
      if ((s.when && !s.when(c)) || (c.modal && !s.modal)) return null;
      return { ...s };
    }
    if (st().tour !== 'done' || c.modal) return null;
    const tip = TIPS.find((t) => !st().tips?.[t.id] && t.when(c));
    return tip ? { ...tip, tip: tip.id, next: true } : null;
  };

  const place = () => {
    const c = ctx();
    cur = pick(c);
    const el = cur?.target();
    root.hidden = !cur;
    if (cur) {
      text.innerHTML = cur.text;
      next.hidden = !cur.next; next.textContent = cur.last || cur.tip ? 'تمام ✔' : 'التالي ←';
      skip.hidden = !!cur.tip;
      const r = el?.getBoundingClientRect();
      const ok = r && r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0;
      // A place on the world map out of view: fly the camera to it (the world ignores repeats).
      if (!ok && cur.fly) c.fly?.(cur.fly);
      else if (el && !ok && scrolled !== cur.text) { scrolled = cur.text; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }   // inside a scrolled panel
      spot.hidden = hand.hidden = !ok;
      const W = Math.min(340, innerWidth - 24), bh = bubble.offsetHeight || 90;
      let bx = (innerWidth - W) / 2, by = innerHeight / 2 - bh / 2;
      if (ok) {
        const pad = 6;
        Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        const below = cur.place !== 'top' && r.bottom + 70 + bh < innerHeight;
        hand.textContent = below ? '👆' : '👇';
        hand.style.left = `${r.left + r.width / 2 - 18}px`;
        hand.style.top = below ? `${r.bottom + 4}px` : `${r.top - 44}px`;
        bx = Math.max(12, Math.min(innerWidth - W - 12, r.left + r.width / 2 - W / 2));
        by = cur.place === 'top' ? Math.max(8, r.top - bh - 12) : below ? r.bottom + 48 : Math.max(8, r.top - bh - 52);
        if (cur.place === 'top' && r.top - bh - 12 < 8) by = 8;   // a tall modal: the bubble sits on its top edge
      }
      Object.assign(bubble.style, { left: `${bx}px`, top: `${by}px`, width: `${W}px` });
    }
    raf = requestAnimationFrame(place);
  };
  raf = requestAnimationFrame(place);

  return {
    restart() { st().tour = 0; st().tips = {}; save(); },
    dispose() { cancelAnimationFrame(raf); root.remove(); },
  };
}
