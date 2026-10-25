// The first minutes of the game, step by step (as the designer wrote them):
// the player opens the game inside the spiritual dimension; the guide greets them;
// the King of the Void threatens; the player builds an archer with the hammer
// (placing it on a 3×3 spot, 10 s to build or 💎1 to speed up); ten small void
// kings attack and the archer shoots them down; it heals; then the player attacks the
// Void Kings' camp with two archers and wins ⭐⭐⭐, 500 gold and 500 light.
// Checkpoints are saved (st.onboard): 'intro' → 'built' → 'defended' → 'done'.
import { mountVillage, GRID } from './village3d.js';
import { ensureBase, grow, capacity, builders, busyBuilders } from './base.js';
import { createBaseUI } from './baseui.js';
import { createPortraits } from './portrait3d.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMS_START = 300, SPEEDUP = 1, BUILD_S = 10, REWARD = { gold: 500, nour: 500 };
const START_CELL = [6, 26];   // where the archer appears for placing (near the king's side)

export function runOnboarding(host, { st, save, sfx = {}, onDone }) {
  st.gems ??= GEMS_START; st.nour ??= 0; st.onboard ??= 'intro';
  st.base = ensureBase(st.base || {}); grow(st.base); save();
  const root = document.createElement('div'); root.className = 'ob'; host.appendChild(root);
  root.innerHTML = `
    <div class="ob-view"></div>
    <div class="ob-builders">🔨 <b></b></div>
    <div class="ob-res">
      <div class="ob-rbar gold"><small></small><div><i></i><b data-r="gold"></b></div><span>🪙</span></div>
      <div class="ob-rbar nour"><small></small><div><i></i><b data-r="nour"></b></div><span>✨</span></div>
      <div class="ob-rbar gems"><div><i></i><b data-r="gems"></b></div><span>💎</span></div>
    </div>
    <div class="ob-talk" hidden><b class="ob-who"></b><p></p><small class="ob-tap">انقر للمتابعة ▼</small></div>
    <div class="ob-hint" hidden></div>
    <div class="ob-pop" hidden></div>
    <button class="ob-hammer" hidden>🔨</button>
    <div class="ob-shop" hidden><h3>🔨 ابنِ</h3><button class="ob-card" data-b="archer"><span class="ob-ico">🏹</span><b>رامي السهام</b><small>يحمي البعد من ملوك الفراغ</small><em>مجاني</em></button></div>
    <div class="ob-confirm" hidden><button class="ob-no">✕</button><button class="ob-yes">✓</button></div>
    <div class="ob-timer" hidden><div class="ob-time"><i></i><b></b></div><button class="ob-speed">⚡ سرّع · 💎 ${SPEEDUP}</button></div>
    <button class="ob-attack" hidden>⚔ هجوم</button>
    <div class="ob-hand" hidden>👆</div>
    <div class="ob-load" hidden><div class="ob-spin"></div><p>جاري البحث عن معسكر ملوك الفراغ…</p></div>
    <div class="ob-battle" hidden>
      <div class="ob-bstars"><i></i><i></i><i></i></div><div class="ob-pct">0%</div>
      <div class="ob-cards"></div>
    </div>
    <div class="ob-win" hidden></div>`;
  const q = (s) => root.querySelector(s);
  const view = q('.ob-view'), bubble = q('.ob-talk'), hintEl = q('.ob-hint');
  const portraits = createPortraits(root);
  const res = () => {
    for (const el of root.querySelectorAll('[data-r]')) el.textContent = (st[el.dataset.r] || 0).toLocaleString('en');
    // Clash's bars: how full the storages are, and the most they hold.
    for (const r of ['gold', 'nour']) { const cap = capacity(st.base, r), bar = root.querySelector(`.ob-rbar.${r}`); bar.querySelector('small').textContent = `الحد: ${cap.toLocaleString('en')}`; bar.querySelector('i').style.width = `${Math.min(100, ((st[r] || 0) / cap) * 100)}%`; }
    root.querySelector('.ob-rbar.gems i').style.width = '100%';
    root.querySelector('.ob-builders b').textContent = `${builders(st.base) - Math.min(builders(st.base), busyBuilders(st.base))}/${builders(st.base)}`;
    village?.setStock({ gold: Math.min(1, (st.gold || 0) / capacity(st.base, 'gold')), nour: Math.min(1, (st.nour || 0) / capacity(st.base, 'nour')) });
  };
  const checkpoint = (k) => { st.onboard = k; save(); };
  let village = null, camp = null, raf = 0, alive = true, handEl = null;
  res();

  // Things that follow the world (the ✓ ✕ buttons, the build timer) and the hand that
  // points at a button, kept in place every frame.
  const place = () => {
    if (!alive) return;
    const pl = village?.placing;
    if (pl && !q('.ob-confirm').hidden) { const p = village.screenOf(pl.g.position, 4.2); const c = q('.ob-confirm'); c.style.left = `${p.x - c.offsetWidth / 2}px`; c.style.top = `${p.y - c.offsetHeight}px`; }
    if (village?.site && !q('.ob-timer').hidden) { const p = village.screenOf(village.site.g.position, 3.4); const c = q('.ob-timer'); c.style.left = `${p.x - c.offsetWidth / 2}px`; c.style.top = `${p.y - c.offsetHeight}px`; }
    ui?.tick();
    if (handEl) { const h = q('.ob-hand'), r = handEl.getBoundingClientRect(); h.style.left = `${r.left + r.width / 2 - 18}px`; h.style.top = `${r.bottom - 6}px`; }
    raf = requestAnimationFrame(place);
  };
  raf = requestAnimationFrame(place);
  // ---------- talking: the speaker pops in big at the screen's edge, the words in a box beside ----------
  const NAMES = { guide: 'الحكيم', king: 'ملك الفراغ' };
  let leave = 0;   // the speaker leaves only if no one speaks right after
  const show = (who, text, { tap = true } = {}) => {
    clearTimeout(leave); portraits.show(who);
    bubble.className = `ob-talk ${who}`; bubble.hidden = false;
    q('.ob-who').textContent = NAMES[who]; bubble.querySelector('p').textContent = text;
    q('.ob-tap').hidden = !tap;
    sfx.open?.();
  };
  const hide = () => { bubble.hidden = true; hintEl.hidden = true; clearTimeout(leave); leave = setTimeout(() => portraits.hide(), 150); };
  // A short instruction at the top while the player works in the base (no one in the way).
  const hint = (text) => { hintEl.textContent = text; hintEl.hidden = false; };
  // say(): show, then wait for a tap anywhere.
  const say = (who, text) => new Promise((resolve) => {
    show(who, text);
    const catcher = document.createElement('div'); catcher.className = 'ob-catch'; root.appendChild(catcher);
    setTimeout(() => { catcher.onclick = () => { catcher.remove(); hide(); sfx.click?.(); resolve(); }; }, 350);
  });
  // The pointing hand: on a button (it follows it), or at a point on the screen.
  const hand = (el, on = true) => { const h = q('.ob-hand'); h.hidden = !on; handEl = on ? el : null; };
  const handAt = (x, y) => { const h = q('.ob-hand'); handEl = null; h.hidden = false; h.style.left = `${x - 18}px`; h.style.top = `${y}px`; };
  const click = (el) => new Promise((r) => { el.onclick = () => { el.onclick = null; sfx.click?.(); r(); }; });

  // A small panel where the player tapped: a tree (clear it for gold) or the Town Hall.
  const pop = q('.ob-pop');
  const closePop = () => { pop.hidden = true; };
  const openPop = (html, at) => {
    pop.innerHTML = html; pop.hidden = false;
    pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, at.x - pop.offsetWidth / 2))}px`;
    pop.style.top = `${Math.max(56, at.y - pop.offsetHeight - 16)}px`;
    sfx.open?.();
  };
  view.addEventListener('pointerdown', closePop);
  const ui = createBaseUI(root, { st, save, sfx, getVillage: () => village, res });
  const onMoved = ({ buildings }) => { closePop(); st.base.buildings = buildings; save(); };
  const openVillage = () => { village?.dispose(); view.innerHTML = ''; village = mountVillage(view, { buildings: st.base.buildings, obstacles: st.base.obstacles, th: st.base.th, onObstacle: ui.onObstacle, onSelect: ui.onSelect, onCollect: ui.onCollect, onMoved });
    if (window.__nmnDebug) window.__village = village;
    res(); if (st.base.clearing) village.shakeObstacle(st.base.clearing.id, true);
    return village;
  };

  // ---------- 1 · the base, the guide and the King of the Void ----------
  const intro = async () => {
    await wait(600);
    village.flyTo(0, 2, 0.75, 1400);
    await wait(900);
    await say('guide', 'مرحباً أيها المحارب!');
    await say('guide', 'هنا الجانب الروحي من شخصيتك… هل دخلت إليه من قبل؟');
    village.showKing(); sfx.lose?.();
    await village.flyTo(-17, 10, 0.65, 1000);
    await say('king', 'ابنِ… وأنا سأهدم أيها الضعيف!');
    await village.flyTo(0, 8, 0.75, 900);
    await say('guide', 'إنه ملك الفراغ. يجب أن تجهّز الجنود لتحمي البعد الروحي منه.');
  };
  // ---------- 2 · the hammer, the archer, placing it ----------
  const buildArcher = async () => {
    for (;;) {
      const ham = q('.ob-hammer'); ham.hidden = false; hand(ham);
      await click(ham); hand(null, false);
      const shop = q('.ob-shop'); shop.hidden = false; const card = q('.ob-card'); hand(card);
      await click(card); shop.hidden = true; ham.hidden = true; hand(null, false);
      hint('ضع رامي السهام بمكان يحمي البعد الروحي — اسحبه، ولما تصير المربعات خضرا اكبس ✓');
      const conf = q('.ob-confirm'), yes = q('.ob-yes'), no = q('.ob-no');
      // The spot, a little low on screen so ✓ ✕ show above it, clear of the instruction strip.
      village.flyTo(START_CELL[0] + 1.5 - GRID / 2, START_CELL[1] + 1.5 - GRID / 2 + 3, 0.75, 700);
      village.startPlacing(START_CELL[0], START_CELL[1], (ok) => { yes.disabled = !ok; conf.classList.toggle('bad', !ok); });
      conf.hidden = false;
      const choice = await new Promise((r) => { yes.onclick = () => { if (!yes.disabled) r(true); }; no.onclick = () => r(false); });
      conf.hidden = true; sfx.click?.();
      if (!choice) { village.endPlacing(); hide(); continue; }
      const { i, j } = village.placing; village.endPlacing(); hide();
      return [i, j];
    }
  };
  // ---------- 3 · building it: 10 seconds, or 💎1 to speed up ----------
  const construct = async ([i, j]) => {
    village.startSite(i, j); sfx.wood?.();
    const timer = q('.ob-timer'), speed = q('.ob-speed'), bar = timer.querySelector('i'), txt = timer.querySelector('b');
    timer.hidden = false; hand(speed);
    const t0 = performance.now();
    await new Promise((resolve) => {
      speed.onclick = () => { if ((st.gems || 0) < SPEEDUP) return; st.gems -= SPEEDUP; res(); sfx.coin?.(); resolve(); };
      const loop = () => { const left = Math.max(0, BUILD_S - (performance.now() - t0) / 1000); bar.style.width = `${(1 - left / BUILD_S) * 100}%`; txt.textContent = `${Math.ceil(left)} ث`; if (left <= 0) return resolve(); if (!timer.hidden) requestAnimationFrame(loop); };
      loop();
    });
    timer.hidden = true; hand(null, false);
    village.finishSite(); sfx.unlock?.();
    st.base.buildings = village.buildings(); checkpoint('built');
    await wait(900);
  };
  // ---------- 4 · the attack on the base ----------
  const defence = async () => {
    village.showKing();
    await village.flyTo(-10, 12, 0.85, 900);
    await say('king', 'هجوووم يا جيش الفراغ!');
    sfx.thunder?.();
    await village.defend();
    village.hideKing();
    checkpoint('defended');
    await village.flyTo(-3, 16, 0.7, 700);
    await say('guide', 'كانوا سيدمّرون البعد الروحي… نجونا!');
    const healing = village.heal(3500);
    await say('guide', 'انظر إلى رامي السهام… يعالج نفسه بطريقة جيدة.');
    await healing;
  };
  // ---------- 5 · to the Void Kings' camp ----------
  // ---------- the battle at the Void Kings' camp (the tutorial's, then any raid with the trained army) ----------
  const battle = async (count) => {
    const load = q('.ob-load'); load.hidden = false; sfx.whoosh?.();
    await wait(1600);
    ui.hide(); village.dispose(); village = null; view.innerHTML = '';
    const { mountCamp } = await import('./camp3d.js');
    const bt = q('.ob-battle'), stars = [...bt.querySelectorAll('.ob-bstars i')], pctEl = q('.ob-pct');
    for (const s of stars) s.className = ''; pctEl.textContent = '0%';
    const cardsEl = q('.ob-cards');
    const draw = (counts) => { cardsEl.innerHTML = Array.from({ length: 10 }, (_, k) => k === 0 ? `<button class="ob-tcard on ${counts[0] ? '' : 'empty'}"><span>🏹</span><b>×${counts[0]}</b><small>رامي السهام</small></button>` : '<div class="ob-tcard blank"></div>').join(''); };
    draw([count]);
    let deployed = 0;
    const done = new Promise((resolve) => {
      camp = mountCamp(view, {
        troops: [{ type: 'archer', count }],
        onDeploy: (counts) => { deployed++; draw(counts); sfx.jump?.(); if (deployed === 1 && count > 1) { const p = camp.hintPoint(1); handAt(p.x, p.y); } else hand(null, false); },
        onStar: (n) => { stars[n - 1].className = 'on'; sfx.key?.(); },
        onPercent: (p) => { pctEl.textContent = `${p}%`; },
        onEnd: resolve,
      });
    });
    load.hidden = true; bt.hidden = false;
    await wait(500);
    const p = camp.hintPoint(); handAt(p.x, p.y); q('.ob-hand').classList.add('tapping');
    const result = await done;
    hand(null, false); q('.ob-hand').classList.remove('tapping');
    return { ...result, used: deployed };
  };
  // The end screen: stars, %, the loot; back home.
  const victory = async (result, loot) => {
    st.gold = (st.gold || 0) + loot.gold; st.nour = (st.nour || 0) + loot.nour; res();
    const win = q('.ob-win'); win.hidden = false; sfx.fanfare?.();
    win.innerHTML = `<h2>${result.stars >= 1 ? 'انتصار!' : 'هزيمة'}</h2>
      <div class="ob-wstars">${[0, 1, 2].map((k) => `<i class="${k < result.stars ? 'on' : ''}" style="animation-delay:${k * 0.25}s"></i>`).join('')}</div>
      <p class="ob-wpct">دمّرت ${result.pct}% من المعسكر</p>
      <div class="ob-loot"><span>🪙 <b>+${loot.gold}</b> ذهب</span><span>✨ <b>+${loot.nour}</b> نور</span></div>
      <button class="ob-home">🕌 العودة إلى البعد الروحي</button>`;
    save();
    await click(q('.ob-home'));
    win.hidden = true; q('.ob-battle').hidden = true;
    camp.dispose(); camp = null; view.innerHTML = '';
    openVillage();
  };
  // ---------- 5 · to the Void Kings' camp ----------
  const attack = async () => {
    show('guide', 'هيا نهجم على معسكر ملوك الفراغ!', { tap: false });
    const btn = q('.ob-attack'); btn.hidden = false; hand(btn);
    await click(btn); btn.hidden = true; hand(null, false); hide();
    const result = await battle(2);
    // ---------- 6 · victory and the reward ----------
    checkpoint('done');
    await victory(result, REWARD);
  };
  // After the tutorial: Clash's two corner buttons — ⚔ attack (bottom left) and 🛒 shop (bottom right).
  // The attack takes the army trained in the barracks; the loot follows the % destroyed.
  const RAID_LOOT = { gold: 1000, nour: 1000 };
  const home = () => {
    const bar = document.createElement('div'); bar.className = 'ob-corner';
    bar.innerHTML = '<button class="ob-raid"><span>⚔</span><b>هجوم!</b></button><button class="ob-shopbtn"><span>🛒</span><b>المتجر</b></button>';
    root.appendChild(bar);
    bar.querySelector('.ob-shopbtn').onclick = () => { sfx.click?.(); ui.openShop(); };
    bar.querySelector('.ob-raid').onclick = async () => {
      const n = st.base.army?.archer || 0;
      if (!n) { sfx.lose?.(); floatAt('درّب جنودًا في الثكنة أولاً', bar.querySelector('.ob-raid')); return; }
      if (camp || ui.placing) return;
      bar.hidden = true;
      const result = await battle(n);
      // The troops sent are used up, as in Clash; the rest come home.
      st.base.army.archer = Math.max(0, n - result.used);
      const k = result.pct / 100;
      await victory(result, { gold: Math.round(RAID_LOOT.gold * k), nour: Math.round(RAID_LOOT.nour * k) });
      bar.hidden = false;
    };
  };
  const floatAt = (txt, el) => { const r = el.getBoundingClientRect(), f = document.createElement('div'); f.className = 'ob-float'; f.textContent = txt; f.style.left = `${r.left + r.width / 2 + 80}px`; f.style.top = `${r.top - 20}px`; root.appendChild(f); setTimeout(() => f.remove(), 1400); };

  (async () => {
    openVillage();
    await wait(0);   // let the caller hold on to this run before anything finishes
    try {
      if (st.onboard === 'intro') { await intro(); const cell = await buildArcher(); await construct(cell); }
      if (st.onboard === 'built') await defence();
      if (st.onboard === 'defended') await attack();
      home();
      onDone?.();
    } catch (err) { console.error('onboarding', err); }
  })();

  return {
    dispose() { alive = false; cancelAnimationFrame(raf); portraits.dispose(); village?.dispose(); camp?.dispose(); ui.dispose(); root.remove(); },
  };
}
