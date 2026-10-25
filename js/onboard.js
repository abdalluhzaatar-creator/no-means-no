// The first minutes of the game, step by step (as the designer wrote them):
// the player opens the game inside the spiritual dimension; the guide greets them;
// the King of the Void threatens; the player builds an archer with the hammer
// (placing it on a 3×3 spot, 10 s to build or 💎1 to speed up); ten small void
// kings attack and the archer shoots them down; it heals; then the player attacks the
// Void Kings' camp with two archers and wins ⭐⭐⭐, 500 gold and 500 light.
// Checkpoints are saved (st.onboard): 'intro' → 'built' → 'defended' → 'done'.
import { mountVillage } from './village3d.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GEMS_START = 300, SPEEDUP = 1, BUILD_S = 10, REWARD = { gold: 500, nour: 500 };
const START_CELL = [6, 26];   // where the archer appears for placing (near the king's side)

export function runOnboarding(host, { st, save, sfx = {}, onDone }) {
  st.gems ??= GEMS_START; st.nour ??= 0; st.base ??= { buildings: [] }; st.onboard ??= 'intro';
  const root = document.createElement('div'); root.className = 'ob'; host.appendChild(root);
  root.innerHTML = `
    <div class="ob-view"></div>
    <div class="ob-res"><span>🪙 <b data-r="gold"></b></span><span>✨ <b data-r="nour"></b></span><span class="gem">💎 <b data-r="gems"></b></span></div>
    <div class="ob-bubble" hidden><b class="ob-who"></b><p></p><small class="ob-tap">انقر للمتابعة ▼</small></div>
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
  const view = q('.ob-view'), bubble = q('.ob-bubble');
  const res = () => { for (const el of root.querySelectorAll('[data-r]')) el.textContent = (st[el.dataset.r] || 0).toLocaleString('en'); };
  res();
  const checkpoint = (k) => { st.onboard = k; save(); };
  let village = null, camp = null, raf = 0, anchor = null, alive = true;

  // ---------- speech bubbles: anchored above whoever speaks; a tap moves on ----------
  const place = () => {
    if (!alive) return;
    if (anchor && village && !bubble.hidden) {
      const p = village.screenOf(anchor.obj, anchor.y);
      const W = bubble.offsetWidth, H = bubble.offsetHeight;
      bubble.style.left = `${Math.max(8, Math.min(innerWidth - W - 8, p.x - W / 2))}px`;
      bubble.style.top = `${Math.max(56, Math.min(innerHeight - H - 8, p.y - H - 14))}px`;
    }
    const pl = village?.placing;
    if (pl && !q('.ob-confirm').hidden) { const p = village.screenOf(pl.g.position, 4.2); const c = q('.ob-confirm'); c.style.left = `${p.x - c.offsetWidth / 2}px`; c.style.top = `${p.y - c.offsetHeight}px`; }
    if (village?.site && !q('.ob-timer').hidden) { const p = village.screenOf(village.site.g.position, 3.4); const c = q('.ob-timer'); c.style.left = `${p.x - c.offsetWidth / 2}px`; c.style.top = `${p.y - c.offsetHeight}px`; }
    raf = requestAnimationFrame(place);
  };
  raf = requestAnimationFrame(place);
  const speakers = () => ({ guide: { obj: village.guide.root, y: 2.6, name: 'الحكيم' }, king: { obj: village.king?.root, y: 4.6, name: 'ملك الفراغ' } });
  const show = (who, text, { tap = true } = {}) => {
    const s = speakers()[who]; anchor = s;
    bubble.className = `ob-bubble ${who}`; bubble.hidden = false;
    q('.ob-who').textContent = s.name; bubble.querySelector('p').textContent = text;
    q('.ob-tap').hidden = !tap;
    sfx.open?.();
  };
  const hide = () => { bubble.hidden = true; anchor = null; };
  // say(): show, then wait for a tap anywhere.
  const say = (who, text) => new Promise((resolve) => {
    show(who, text);
    const catcher = document.createElement('div'); catcher.className = 'ob-catch'; root.appendChild(catcher);
    setTimeout(() => { catcher.onclick = () => { catcher.remove(); hide(); sfx.click?.(); resolve(); }; }, 350);
  });
  const hand = (el, on = true) => { const h = q('.ob-hand'); h.hidden = !on; if (!on) return; const r = el.getBoundingClientRect(); h.style.left = `${r.left + r.width / 2 - 18}px`; h.style.top = `${r.bottom - 6}px`; };
  const handAt = (x, y) => { const h = q('.ob-hand'); h.hidden = false; h.style.left = `${x - 18}px`; h.style.top = `${y}px`; };
  const click = (el) => new Promise((r) => { el.onclick = () => { el.onclick = null; sfx.click?.(); r(); }; });

  const openVillage = () => { village?.dispose(); view.innerHTML = ''; village = mountVillage(view, { buildings: st.base.buildings }); return village; };

  // ---------- 1 · the base, the guide and the King of the Void ----------
  const intro = async () => {
    await wait(600);
    village.flyTo(4, 6, 0.6, 1200);
    await wait(900);
    await say('guide', 'مرحباً أيها المحارب!');
    await say('guide', 'هنا الجانب الروحي من شخصيتك… هل دخلت إليه من قبل؟');
    village.showKing(); sfx.lose?.();
    await village.flyTo(-10, 8, 0.65, 1000);
    await say('king', 'ابنِ… وأنا سأهدم أيها الضعيف!');
    await village.flyTo(0, 8, 0.75, 900);
    await say('guide', 'إنه ملك الفراغ. يجب أن تجهّز الجنود لتحمي البعد الروحي منه.');
  };
  // ---------- 2 · the hammer, the archer, placing it ----------
  const buildArcher = async () => {
    for (;;) {
      const ham = q('.ob-hammer'); ham.hidden = false; hand(ham);
      await click(ham); q('.ob-hand').hidden = true;
      const shop = q('.ob-shop'); shop.hidden = false; const card = q('.ob-card'); hand(card);
      await click(card); shop.hidden = true; ham.hidden = true; q('.ob-hand').hidden = true;
      show('guide', 'ضع رامي السهام بمكان يحمي البعد الروحي. اسحبه بإصبعك، ولما تكون المربعات خضرا اكبس ✓', { tap: false });
      const conf = q('.ob-confirm'), yes = q('.ob-yes'), no = q('.ob-no');
      village.flyTo(START_CELL[0] - 18.5, START_CELL[1] - 18.5, 0.7, 700);
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
    timer.hidden = true; q('.ob-hand').hidden = true;
    village.finishSite(); sfx.unlock?.();
    st.base.buildings = village.buildings(); checkpoint('built');
    await wait(900);
  };
  // ---------- 4 · the attack on the base ----------
  const defence = async () => {
    village.showKing();
    await village.flyTo(-4, 14, 0.85, 900);
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
  const attack = async () => {
    show('guide', 'هيا نهجم على معسكر ملوك الفراغ!', { tap: false });
    const btn = q('.ob-attack'); btn.hidden = false; hand(btn);
    await click(btn); btn.hidden = true; q('.ob-hand').hidden = true; hide();
    const load = q('.ob-load'); load.hidden = false; sfx.whoosh?.();
    await wait(1600);
    village.dispose(); village = null; view.innerHTML = '';
    const { mountCamp } = await import('./camp3d.js');
    const battle = q('.ob-battle'), stars = [...battle.querySelectorAll('.ob-bstars i')], pctEl = q('.ob-pct');
    const cardsEl = q('.ob-cards');
    const draw = (counts) => { cardsEl.innerHTML = Array.from({ length: 10 }, (_, k) => k === 0 ? `<button class="ob-tcard on ${counts[0] ? '' : 'empty'}"><span>🏹</span><b>×${counts[0]}</b><small>رامي السهام</small></button>` : '<div class="ob-tcard blank"></div>').join(''); };
    draw([2]);
    let deployed = 0;
    const done = new Promise((resolve) => {
      camp = mountCamp(view, {
        troops: [{ type: 'archer', count: 2 }],
        onDeploy: (counts) => { deployed++; draw(counts); sfx.jump?.(); if (deployed === 1) { const p = camp.hintPoint(1); handAt(p.x, p.y); tip.textContent = 'كمان مرة: نزّل رامي السهام الثاني'; } else { q('.ob-hand').hidden = true; tip.hidden = true; } },
        onStar: (n) => { stars[n - 1].className = 'on'; sfx.key?.(); },
        onPercent: (p) => { pctEl.textContent = `${p}%`; },
        onEnd: resolve,
      });
    });
    load.hidden = true; battle.hidden = false;
    const tip = document.createElement('div'); tip.className = 'ob-tip'; tip.textContent = 'انقر هنا عشان تنزّل رامي السهام'; root.appendChild(tip);
    await wait(500);
    const p = camp.hintPoint(); handAt(p.x, p.y); q('.ob-hand').classList.add('tapping');
    const result = await done;
    q('.ob-hand').hidden = true; tip.remove();
    // ---------- 6 · victory and the reward ----------
    st.gold = (st.gold || 0) + REWARD.gold; st.nour = (st.nour || 0) + REWARD.nour; res();
    checkpoint('done');
    const win = q('.ob-win'); win.hidden = false; sfx.fanfare?.();
    win.innerHTML = `<h2>${result.stars >= 3 ? 'انتصار!' : 'انتهت المعركة'}</h2>
      <div class="ob-wstars">${[0, 1, 2].map((k) => `<i class="${k < result.stars ? 'on' : ''}" style="animation-delay:${k * 0.25}s"></i>`).join('')}</div>
      <p class="ob-wpct">دمّرت ${result.pct}% من المعسكر</p>
      <div class="ob-loot"><span>🪙 <b>+${REWARD.gold}</b> ذهب</span><span>✨ <b>+${REWARD.nour}</b> نور</span></div>
      <button class="ob-home">🕌 العودة إلى البعد الروحي</button>`;
    await click(q('.ob-home'));
    win.hidden = true; battle.hidden = true;
    camp.dispose(); camp = null; view.innerHTML = '';
    openVillage();
  };

  (async () => {
    openVillage();
    try {
      if (st.onboard === 'intro') { await intro(); const cell = await buildArcher(); await construct(cell); }
      if (st.onboard === 'built') await defence();
      if (st.onboard === 'defended') await attack();
      onDone?.();
    } catch (err) { console.error('onboarding', err); }
  })();

  return {
    dispose() { alive = false; cancelAnimationFrame(raf); village?.dispose(); camp?.dispose(); root.remove(); },
  };
}
