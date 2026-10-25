// The base's buttons and windows, the Clash of Clans way. Tap a building: its name and level
// show at the bottom with round buttons — ℹ info, ⬆ upgrade (with its price), ⚔ train troops
// at the barracks and the army camp, ⚡ finish now while it's being built — and the building
// is picked up (drag it to move it). Tap a tree or a rock: its name and 🪓 remove.
// While the builder works, a timer shows over the building or the obstacle.
import {
  BUILDINGS, TROOPS, statsOf, maxLevel, ready, capacity, collect, canUpgrade, startUpgrade, finishUpgrades, rushUpgrade,
  gemsFor, builderJob, clearGems, train, untrain, advanceTraining, armySize, armyRoom, queueSize, queueRoom,
  SHOP, canBuy, buy, countOf, maxOf,
} from './base.js';
import { img } from './thumbs.js';

const RES = { gold: '🪙', nour: '✨', gems: '💎' };
const num = (n) => Math.round(n).toLocaleString('en');
// 1س 20د · 4د 30ث · 45ث
export const timeText = (s) => {
  s = Math.max(0, Math.ceil(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  if (d) return `${d}ي ${h}س`; if (h) return `${h}س ${m}د`; if (m) return `${m}د${x ? ` ${x}ث` : ''}`; return `${x}ث`;
};

export function createBaseUI(root, { st, save, sfx = {}, getVillage, res }) {
  const el = document.createElement('div'); el.className = 'bu'; root.appendChild(el);
  el.innerHTML = `<div class="bu-bar" hidden><div class="bu-title"></div><div class="bu-btns"></div></div>
    <div class="bu-timers"></div>
    <div class="bu-place" hidden><button class="bu-pno">✕</button><button class="bu-pyes">✓</button></div><div class="bu-win" hidden><div class="bu-card"><button class="bu-x">✕</button><div class="bu-body"></div></div></div>`;
  const q = (s) => el.querySelector(s);
  const bar = q('.bu-bar'), win = q('.bu-win'), body = q('.bu-body'), timers = q('.bu-timers');
  q('.bu-x').onclick = () => closeWin();
  win.addEventListener('click', (e) => { if (e.target === win) closeWin(); });
  let selected = null, selObstacle = null, winKind = null;
  const name = (b) => BUILDINGS[b.type].name;
  const floatText = (txt, p) => { const f = document.createElement('div'); f.className = 'ob-float'; f.textContent = txt; f.style.left = `${p.x}px`; f.style.top = `${p.y}px`; root.appendChild(f); setTimeout(() => f.remove(), 1400); };
  const changed = () => { res(); save(); };
  const screenOfRec = (b, y = 3) => { const v = getVillage(), p = v?.posOf(b); return p && v.screenOf(p, y); };

  // ---------- the bar at the bottom ----------
  const btn = (ico, label, sub = '', cls = '') => `<button class="bu-b ${cls}" data-a="${label}"><span class="bu-i">${ico}</span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  const drawBar = () => {
    if (selObstacle) {
      const o = selObstacle, busy = builderJob(st.base), mine = st.base.clearing?.id === o.id, can = (st[o.res] || 0) >= o.cost;
      q('.bu-title').textContent = o.name;
      q('.bu-btns').innerHTML = mine ? btn('⏳', 'يُزال الآن', timeText((st.base.clearing.end - Date.now()) / 1000), 'off')
        : btn('🪓', 'إزالة', `${RES[o.res]} ${num(o.cost)}`, can && !busy ? '' : 'off' + (can ? '' : ' short'));
      bar.hidden = false; return;
    }
    const b = selected; if (!b) { bar.hidden = true; return; }
    const lv = b.lv ?? 1, d = BUILDINGS[b.type];
    q('.bu-title').textContent = lv ? `${name(b)} (المستوى ${lv})` : `${name(b)} (قيد البناء)`;
    let h = btn('ℹ', 'معلومات');
    if (b.up) h += btn('⚡', 'إنهاء الآن', `💎 ${gemsFor((b.up.end - Date.now()) / 1000)}`, 'gem');
    else if (lv < maxLevel(b.type)) { const c = canUpgrade(st, b), n = d.lv[lv]; h += btn('⬆', 'تطوير', `${RES[n.res]} ${num(n.cost)}`, c.ok ? '' : c.short ? 'short' : ''); }
    if (d.trains && lv) h += btn('⚔', 'تدريب الجنود');
    if (d.makes && ready(b) >= 1) h += btn(RES[d.makes], 'جمع', `${num(ready(b))}`);
    q('.bu-btns').innerHTML = h; bar.hidden = false;
  };
  bar.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    sfx.click?.();
    if (selObstacle) return a === 'إزالة' && removeObstacle(selObstacle);
    const b = selected; if (!b) return;
    if (a === 'معلومات') openWin('info');
    else if (a === 'تطوير') openWin('upgrade');
    else if (a === 'تدريب الجنود') openWin('train');
    else if (a === 'إنهاء الآن') { const g = rushUpgrade(st, b); if (g < 0) return toast('جواهر غير كافية'); afterFinish([b]); }
    else if (a === 'جمع') { doCollect(b, screenOfRec(b)); }
  });
  const toast = (t) => { const p = bar.getBoundingClientRect(); floatText(t, { x: p.left + p.width / 2, y: p.top - 10 }); };

  // ---------- windows ----------
  const row = (k, a, b) => `<div class="bu-row"><span>${k}</span><b>${a}</b>${b != null ? `<i>← ${b}</i>` : ''}</div>`;
  const statRows = (b, lv, next) => {
    const s = statsOf(b, lv), n = next ? statsOf(b, lv + 1) : null, out = [];
    const add = (k, f) => { if (s[f] != null || n?.[f] != null) out.push(row(k, num(s[f] ?? 0), n ? num(n[f] ?? 0) : null)); };
    add('❤ الصحة', 'hp');
    if (s.rate != null) { add(`${RES[BUILDINGS[b.type].makes]} الإنتاج بالساعة`, 'rate'); add('📦 السعة', 'cap'); }
    for (const r of Object.keys(s.holds || {})) out.push(row(`${RES[r]} يتّسع`, num(s.holds[r]), n ? num(n.holds[r]) : null));
    add('🏹 الضرر بالثانية', 'dps'); add('⛺ يتّسع لجنود', 'room'); add('⚔ طابور التدريب', 'queue');
    return out.join('');
  };
  const openWin = (kind) => { winKind = kind; drawWin(); win.hidden = false; sfx.open?.(); };
  const closeWin = () => { win.hidden = true; winKind = null; };
  const drawWin = () => {
    if (winKind === 'shop') return drawShop();
    const b = selected; if (!b || !winKind) return closeWin();
    const lv = b.lv ?? 1, d = BUILDINGS[b.type];
    if (winKind === 'info') {
      let extra = '';
      if (d.makes) extra = row('فيه الآن', `${RES[d.makes]} ${num(ready(b))}`);
      if (b.up) extra += row('⏳ يتطوّر', timeText((b.up.end - Date.now()) / 1000));
      body.innerHTML = `<h3>${d.name}</h3><p class="bu-lv">المستوى ${lv}</p><div class="bu-pic">${img(b.type)}</div>${statRows(b, lv)}${extra}<p class="bu-note">${d.note || ''}</p>`;
    } else if (winKind === 'upgrade') {
      const c = canUpgrade(st, b), n = d.lv[lv];
      if (!n) { body.innerHTML = `<h3>${d.ico} ${d.name}</h3><p class="bu-note">وصل لأعلى مستوى</p>`; return; }
      body.innerHTML = `<h3>تطوير ${d.name} إلى المستوى ${lv + 1}؟</h3><div class="bu-pic">${img(b.type)}</div>${statRows(b, lv, true)}
        ${row('⏱ وقت التطوير', timeText(n.s))}
        ${c.ok ? '' : `<p class="bu-why">${c.reason}</p>`}
        <button class="bu-go ${c.ok ? '' : 'off'}">${RES[n.res]} ${num(n.cost)}</button>`;
      body.querySelector('.bu-go').onclick = () => {
        const r = startUpgrade(st, b); if (!r.ok) { sfx.lose?.(); return drawWin(); }
        getVillage()?.refresh(b); changed(); sfx.wood?.(); closeWin(); drawBar();
      };
    } else if (winKind === 'train') {
      advanceTraining(st.base);
      const qd = st.base.queue || [], army = st.base.army || {};
      const first = qd[0] && TROOPS[qd[0]], left = first ? (st.base.qT + first.s * 1000 - Date.now()) / 1000 : 0;
      const full = qd.length && armySize(st.base) + (first?.room || 0) > armyRoom(st.base);
      body.innerHTML = `<h3>⚔ تدريب الجنود</h3>
        <div class="bu-army">${row('⛺ الجيش', `${armySize(st.base)} / ${armyRoom(st.base)}`)}${row('⚔ قيد التدريب', `${queueSize(st.base)} / ${queueRoom(st.base)}`)}
        ${qd.length ? row('⏳ الجندي التالي', full ? 'المعسكر ممتلئ' : timeText(left)) : ''}</div>
        <div class="bu-troops">${Object.entries(TROOPS).map(([k, t]) => `<div class="bu-troop"><button class="bu-tadd" data-t="${k}">${img(`troop:${k}`, 'troop') || `<span>${t.ico}</span>`}<b>${t.name}</b><small>⏱ ${timeText(t.s)}</small><small class="bu-tc">${t.cost} ✨</small>${army[k] ? `<em>${army[k]}</em>` : ''}</button>${qd.includes(k) ? `<button class="bu-tdel" data-t="${k}">− ${qd.filter((x) => x === k).length}</button>` : ''}</div>`).join('')}</div>
        <p class="bu-note">اكبس على الجندي لتدرّبه — يُدفع النور الآن</p>`;
      for (const x of body.querySelectorAll('.bu-tadd')) x.onclick = () => { const r = train(st, x.dataset.t); if (!r.ok) toastWin(r.reason); else { sfx.coin?.(); changed(); } drawWin(); };
      for (const x of body.querySelectorAll('.bu-tdel')) x.onclick = () => { untrain(st, x.dataset.t); changed(); drawWin(); };
    }
  };
  // ---------- the shop: pick a building, place it, the builder builds it ----------
  let shopTab = 'res';
  const TABS = { res: '💰 الموارد', army: '⚔ الجيش', def: '🛡 الدفاع' };
  const drawShop = () => {
    body.innerHTML = `<h3>🛒 المتجر</h3><div class="bu-tabs">${Object.entries(TABS).map(([k, t]) => `<button data-tab="${k}" class="${k === shopTab ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="bu-shop">${Object.entries(SHOP).filter(([, d]) => d.tab === shopTab).map(([k, d]) => {
        const c = canBuy(st, k), B = BUILDINGS[k];
        // Clash's shop card: the name on top, the time in the corner, the picture, how many, the price at the bottom.
        return `<button class="bu-item ${c.ok ? '' : 'off'}" data-b="${k}"><b>${B.name}</b><small class="bu-it">⏱ ${d.s ? timeText(d.s) : 'فوري'}</small>
          ${img(k) || `<span>${B.ico}</span>`}<small class="bu-ic">مبني ${countOf(st.base, k)}/${maxOf(st.base, k)}</small>
          ${c.ok || c.short ? '' : `<i>${c.reason}</i>`}<em class="${c.short ? 'short' : ''}">${num(d.cost)} ${RES[d.res]}</em></button>`;
      }).join('')}</div>`;
    for (const x of body.querySelectorAll('[data-tab]')) x.onclick = () => { shopTab = x.dataset.tab; drawShop(); };
    for (const x of body.querySelectorAll('.bu-item')) x.onclick = () => { const c = canBuy(st, x.dataset.b); if (!c.ok) return toastWin(c.reason); closeWin(); place(x.dataset.b); };
  };
  const placeEl = q('.bu-place');
  let placingType = null;
  const place = (type) => {
    const v = getVillage(); if (!v) return;
    const n = BUILDINGS[type].n, [ci, cj] = v.center, at = v.freeNear(ci - Math.floor(n / 2), cj - Math.floor(n / 2), n) || [ci, cj];
    placingType = type; selected = null; selObstacle = null; drawBar();
    v.startPlacing(at[0], at[1], (ok) => { q('.bu-pyes').disabled = !ok; placeEl.classList.toggle('bad', !ok); }, type);
    placeEl.hidden = false;
  };
  const endPlace = () => { placingType = null; placeEl.hidden = true; getVillage()?.endPlacing(); };
  q('.bu-pno').onclick = () => { sfx.click?.(); endPlace(); };
  q('.bu-pyes').onclick = () => {
    const v = getVillage(), pl = v?.placing; if (!pl || !pl.ok) return;
    const r = buy(st, placingType, pl.i, pl.j);
    if (!r.ok) { toast(r.reason); return endPlace(); }
    endPlace(); v.add(r.b); changed(); sfx.wood?.();
  };
  const toastWin = (t) => { const c = q('.bu-card').getBoundingClientRect(); floatText(t, { x: c.left + c.width / 2, y: c.top + 30 }); };

  // ---------- collecting, clearing, finishing ----------
  const doCollect = (b, at) => {
    const d = BUILDINGS[b.type], got = collect(st, b);
    if (!got) { if (at) floatText('المخازن ممتلئة', at); return 0; }
    changed(); sfx.coin?.(); getVillage()?.checkBubbles();
    if (at) floatText(`+${RES[d.makes]} ${num(got)}`, at);
    drawBar();
    return got;
  };
  const removeObstacle = (o) => {
    if (builderJob(st.base) || getVillage()?.site) return toast('البنّاء مشغول');
    if ((st[o.res] || 0) < o.cost) return toast(o.res === 'gold' ? 'ذهب غير كافٍ' : 'نور غير كافٍ');
    st[o.res] -= o.cost; st.base.clearing = { id: o.id, end: Date.now() + o.s * 1000, s: o.s };
    getVillage()?.shakeObstacle(o.id, true); changed(); sfx.wood?.(); drawBar();
  };
  const finishClear = () => {
    const cl = st.base.clearing; if (!cl) return;
    st.base.clearing = null;
    const k = st.base.obstacles.findIndex((o) => o.id === cl.id); if (k < 0) return save();
    const o = st.base.obstacles[k], gems = clearGems(st.base, o.kind), v = getVillage(), at = v?.obstacleAt(o.id), p = at && v.screenOf(at, 2);
    st.base.obstacles.splice(k, 1); st.base.clears = (st.base.clears || 0) + 1; st.gems = (st.gems || 0) + gems;
    v?.removeObstacle(o.id); changed(); sfx.coin?.();
    if (selObstacle?.id === o.id) { selObstacle = null; drawBar(); }
    if (gems && p) floatText(`+💎 ${gems}`, p);
  };
  const afterFinish = (list) => {
    for (const b of list) { getVillage()?.refresh(b); const p = screenOfRec(b, 3.5); if (p) floatText(`⬆ المستوى ${b.lv}`, p); }
    if (list.length) { changed(); sfx.unlock?.(); drawBar(); if (winKind) drawWin(); }
  };

  // ---------- every frame: timers over the builder's work; once a second, the clocks ----------
  let last = 0;
  const tick = () => {
    const v = getVillage(); if (!v) { timers.innerHTML = ''; return; }
    const now = Date.now();
    if (now - last > 500) {
      last = now;
      afterFinish(finishUpgrades(st.base, now));
      if (advanceTraining(st.base, now)) save();
      if (st.base.clearing && now >= st.base.clearing.end) finishClear();
      if (!bar.hidden) drawBar();
      if (winKind === 'train' || winKind === 'info') drawWin();
    }
    const pl = v.placing;
    if (pl && placingType) { const p = v.screenOf(pl.g.position, BUILDINGS[placingType].n + 1.5); placeEl.style.left = `${p.x - placeEl.offsetWidth / 2}px`; placeEl.style.top = `${p.y - placeEl.offsetHeight}px`; }
    const jobs = [st.base.th, ...st.base.buildings].filter((b) => b?.up).map((b) => [b.up, v.posOf(b), 3.4]);
    const cl = st.base.clearing; if (cl) jobs.push([cl, v.obstacleAt(cl.id), 2.6]);
    while (timers.children.length < jobs.length) timers.insertAdjacentHTML('beforeend', '<div class="ob-time"><i></i><b></b></div>');
    while (timers.children.length > jobs.length) timers.lastChild.remove();
    jobs.forEach(([j, pos, y], k) => {
      const t = timers.children[k]; if (!pos) { t.hidden = true; return; }
      const p = v.screenOf(pos, y), left = (j.end - now) / 1000; t.hidden = !p.front;
      t.style.left = `${p.x - 70}px`; t.style.top = `${p.y - 22}px`;
      t.querySelector('i').style.width = `${Math.min(100, (1 - left / j.s) * 100)}%`; t.querySelector('b').textContent = timeText(left);
    });
  };
  // Old work that finished while the player was away.
  finishUpgrades(st.base); advanceTraining(st.base);

  return {
    tick,
    onSelect(b) { selObstacle = null; selected = b; if (!b) closeWin(); drawBar(); },
    onObstacle(o) { selected = null; selObstacle = o; closeWin(); drawBar(); },
    onCollect: (b, at) => doCollect(b, at),
    openShop() { if (placingType) return; selected = null; selObstacle = null; drawBar(); openWin('shop'); },
    get placing() { return !!placingType; },
    hide() { selected = null; selObstacle = null; closeWin(); drawBar(); },
    dispose() { el.remove(); },
  };
}
