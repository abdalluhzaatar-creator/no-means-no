// UI layer: renders screens from state, calls engine actions, saves, plays effects.
import { CHARACTERS, REGIONS, CUPS, JOD_TO_USD, RANKS, COMMAND_RANKS, SUGGEST, KINGS } from './content.js';
import * as C from './cups.js';
import { commander } from './hq.js';
import { warMapSVG, WAR } from './warmap.js';
import * as E from './engine.js';
import { createStorage } from './storage.js';
import { characterSVG, regionSVG, worldMapSVG } from './scenes.js';
import * as FX from './effects.js';
import * as SND from './audio.js';
import { CITIES, METHODS, prayerDay, fmtTime } from './prayer.js';
import { createTour } from './tour.js';
import { watchNoEmoji } from './noemoji.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let storage, state, screen = 'world', tour = null;

// ---------- Save ----------
let saveTimer;
const setSync = (txt, cls = '') => { const el = $('#sync'); el.textContent = txt; el.className = 'sync ' + cls; };
function scheduleSave() {
  clearTimeout(saveTimer);
  setSync('…جارٍ الحفظ');
  saveTimer = setTimeout(async () => {
    try { await storage.save(state); setSync(storage.mode === 'cloud' ? '☁ محفوظ' : '💾 محفوظ محليًا', 'ok'); }
    catch (e) { console.error(e); setSync('⚠ تعذّر الحفظ', 'err'); }
  }, 500);
}

// Run an engine action, show effects, save, re-render.
function act(result, originEl) {
  if (typeof result === 'function') { closeDays(); result = result(); }
  if (!result.ok) { FX.toast(result.reason, 'err'); return result; }
  FX.playEvents(result.events, originEl);
  SND.playEvents(result.events);
  scheduleSave();
  render();
  return result;
}

// ---------- Boot ----------
async function boot() {
  storage = await createStorage();
  $('#mode').textContent = storage.mode === 'cloud' ? '☁ سحابي' : '💾 محلي';
  if (storage.needsLogin) return showLogin();
  await loadGame();
}

async function loadGame() {
  $('#loading').hidden = true;
  let raw = null;
  try { raw = await storage.load(); } catch (e) { console.error(e); FX.toast('تعذّر تحميل الحفظ', 'err'); }
  state = raw ? E.migrate(raw) : E.demoState();
  syncClock();
  C.ensure(state);
  if (!raw) scheduleSave();
  $('#account').textContent = storage.accountName ? `👤 ${storage.accountName}` : '👤 حسابك';
  $('#app').hidden = false;
  closeDays();
  render();
  // Keep following the clock: close finished days and refresh the prayer windows.
  setInterval(() => { closeDays(); if ($('#modal').hidden) render(); }, 30000);
  // The guided first steps: new players get them; players who already set habits don't.
  if (state.tour == null) { state.tour = raw && CHARACTERS.some((c) => state.characters[c.id] && E.activeTasks(c, state.characters[c.id]).length) ? 'done' : 0; scheduleSave(); }
  tour?.dispose();
  tour = createTour({
    ctx: () => ({ screen, state, modal: !$('#modal').hidden, fly: (id) => disposeWorld?.flyTo?.(id),
      hasHabit: !!currentChar && !!state.characters[currentChar] && E.activeTasks(E.findCharacter(currentChar), state.characters[currentChar]).length > 0 }),
    save: scheduleSave,
    onFinish: () => FX.banner('🎖 جاهز يا قائد', 'خلّص عاداتك كل يوم — والأحد بتجيك أول رسالة 📬.', '🎖'),
  });
  // The rules changed (v4): show them once.
  // The rules changed (v5: stars and weekly wars): show them once to players who knew the old ones.
  setTimeout(maybeOffer, 1200);
}

function showLogin() {
  $('#loading').hidden = true;
  const profiles = storage.profiles();
  modal(`
    <h2>No Means No</h2>
    <p class="muted">أدخل اسمًا لحسابك. يُحفظ تقدّمك على هذا الجهاز.</p>
    <form id="login-form" class="form">
      <input name="name" required maxlength="24" placeholder="اسم اللاعب" autocomplete="off">
      <button class="btn primary">ابدأ</button>
    </form>
    ${profiles.length ? `<p class="muted">حسابات سابقة:</p><div class="chips">${profiles.map((p) => `<button class="chip" data-profile="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
  `, { closable: false });
  const go = async (name) => { storage.login(name); closeModal(); await loadGame(); };
  $('#login-form').onsubmit = (e) => { e.preventDefault(); go(new FormData(e.target).get('name')); };
  document.querySelectorAll('[data-profile]').forEach((b) => (b.onclick = () => go(b.dataset.profile)));
}

// ---------- Modal ----------
function modal(html, { closable = true, theme = '' } = {}) {
  const m = $('#modal');
  m.classList.remove('wide', 'game');
  if (theme) m.classList.add(theme);
  if (m.hidden) SND.sfx.open();
  $('#modal-body').innerHTML = html;
  m.hidden = false;
  m.dataset.closable = closable;
  $('#modal-close').hidden = !closable;
}
let modalRefresh = null;
function closeModal() { if (!$('#modal').hidden) SND.sfx.close(); $('#modal').hidden = true; $('#modal').classList.remove('wide', 'game'); modalRefresh = null; }
// Re-draws an open panel (upgrades / path) after the state it shows changed.
function refreshModal() { if (modalRefresh && !$('#modal').hidden) { const f = modalRefresh; f(); } }

// In-page confirm (native confirm() can be blocked inside embedded frames).
function ask(text, onYes) {
  modal(`<p>${esc(text)}</p><div class="row wrap"><button class="btn bad" id="ask-yes">نعم</button><button class="btn ghost" id="ask-no">إلغاء</button></div>`);
  $('#ask-yes').onclick = () => { closeModal(); onYes(); };
  $('#ask-no').onclick = closeModal;
}

// ---------- Render ----------
// Screens: 'world' (default), 'character' (inside one character's place), 'shop'.
let currentChar = null;

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
// Test mode's own calendar (days moved forward with ⏭); the real game always runs on the real date.
const syncClock = () => E.setDayShift(state?.sandbox?.shift || 0);
// Test mode: as if a week went by — the clock moves 7 days and the Sunday message comes.
function weekPass() {
  if (!state?.sandbox) return;
  E.weekPasses(state); syncClock(); closeModal(); scheduleSave(); render();
  FX.toast(`📬 مرّ أسبوع (${state.sandbox.shift / 7})`);
  setTimeout(showOffer, 200);
}
function sandboxBadge() {
  document.body.classList.toggle('sandbox', !!state?.sandbox);
  let b = document.getElementById('sandbox-badge');
  if (state?.sandbox && !b) { b = document.createElement('button'); b.id = 'sandbox-badge'; b.className = 'sandbox-badge'; b.onclick = showSettings; document.body.appendChild(b); }
  if (b && state?.sandbox) b.textContent = state.sandbox.shift ? `🧪 وضع التجربة · مرّ ${state.sandbox.shift / 7} ${state.sandbox.shift === 7 ? 'أسبوع' : 'أسابيع'}` : '🧪 وضع التجربة';
  if (!state?.sandbox && b) b.remove();
  const w = document.getElementById('nav-week'); if (w) w.hidden = !state?.sandbox;
}
function render() {
  sandboxBadge();
  checkCommander();
  syncSound();
  $('#habits').innerHTML = `<bdi>${E.habitsBuilt(state)}/${E.HABITS_ALL()}</bdi>`;
  $('#offer-box').hidden = !E.pendingOffer(state, dayFor());
  const navScreen = screen === 'character' ? 'world' : screen;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.screen === navScreen));
  document.body.classList.toggle('in-scene', (screen === 'character' && sceneFor(currentChar)) || screen === 'trophies' || screen === 'hq');
  document.body.classList.toggle('in-world', screen === 'world');
  document.body.classList.toggle('in-store', screen === 'shop');
  if (screen !== 'hq') document.body.classList.remove('view-mode');
  // A live 3D place only refreshes its overlay, so animations and camera survive.
  if (screen === 'character' && oasis && oasis.char === currentChar && $('#place-view')) {
    $('#hud').innerHTML = placeHUD();
    oasis.scene.update(placeState());
    bind(); refreshModal();
    return;
  }
  if (screen === 'hq' && hqScene && $('#hq-view')) {
    $('#hud').innerHTML = hqHUD();
    hqScene.update({ ...commander(state), ...innerState() });
    bind(); refreshModal();
    return;
  }
  if (hqScene) { hqScene.dispose(); hqScene = null; document.body.classList.remove('in-dungeon', 'in-heaven', 'in-gallery'); }
  if (screen === 'trophies' && isle && $('#trophy-view')) {
    $('#hud').innerHTML = trophyHUD();
    isle.update(cupList());
    bind(); refreshModal();
    return;
  }
  isle?.dispose(); isle = null;
  if (screen === 'world' && disposeWorld && worldKey === worldSignature() && $('#world-view')) { const a = $('.world-atmo'); if (a) a.textContent = `${WEATHER_NAMES[currentWeather()].split(' ')[0]} ${PERIODS[skyInfo().period]}${timeOverride === "auto" ? ` · ${fmtTime(new Date())}` : ""}`; bind(); return; }
  oasis?.scene.dispose(); oasis = null;
  const view = { world: renderWorld, character: renderCharacter, shop: renderShop, trophies: renderTrophies, hq: renderHQ }[screen];
  $('#screen').innerHTML = view();
  bind();
  bindWorld();
  bindPlace();
  bindTrophies();
  bindHQ();
  refreshModal();
}

// ---------- Prayer times ----------
// Prayers belong to the calendar day: they can be logged any time until midnight.
const noonOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
// The game day closes at 3 at night, so the prayers shown are the game day's.
const prayerNow = () => (state.location ? prayerDay(noonOf(new Date(Date.now() - E.RULES.dayEnds * 3600000)), state.location) : null);
const dayFor = () => E.today();

// The game day closes at 3 at night; then the Sunday message, if one is waiting.
function closeDays() {
  const before = state.lastDay;
  const rep = E.closeDays(state);
  if (state.lastDay !== before) scheduleSave();
  if (rep.days) setTimeout(maybeOffer, 1500);
}

// ---------- The Sunday message ----------
// Every Sunday: build a habit (a new building) · open a new dimension · not this week.
function maybeOffer() {
  if (!state || !$('#modal').hidden) return;
  if (maybeTelegram()) return;
  if (E.pendingOffer(state, dayFor())) showOffer();
}
// All eight dimensions open: a telegram from the commander calls the player to the palace hall.
const allOpen = () => REGIONS.filter((r) => r.characterId).every((r) => state.regions[r.id]);
function maybeTelegram() {
  if (!state || !allOpen() || state.story?.speech || state.story?.summoned) return false;
  state.story = { ...(state.story || {}), summoned: true }; scheduleSave();
  setTimeout(() => {
    SND.sfx.whoosh?.();
    modal(`<div class="telegram"><div class="tg-stamp">📨</div><small>برقية من القائد</small><h2>الحضور إلى قاعة القصر حالاً</h2>
      <p class="muted">الأبعاد الثمانية فتحت. القائد بستناك.</p>
      <div class="pk-actions"><button class="pk-ok" id="tg-go">🏰 روح للقصر</button></div></div>`, { theme: 'game' });
    $('#tg-go').onclick = () => go('hq');
  }, 900);
  return true;
}
function showOffer() {
  const o = E.pendingOffer(state, dayFor());
  if (!o) return FX.toast('ما في رسالة هالأسبوع');
  modal(`<div class="offer">
    <div class="keyuse-icon">📬</div>
    <h2>رسالة الأحد</h2>
    <p class="muted">أسبوع جديد. شو بدك تعمل هالأسبوع؟</p>
    <div class="offer-choices">
      <button class="offer-btn build" data-offer="build" ${o.build.length ? '' : 'disabled'}><span>🏗</span><b>ابني عادة</b><small>${o.build.length ? 'مبنى جديد = عادة جديدة، وبتترقّى رتبة البعد' : 'كل الأبعاد المفتوحة مليانة (8 عادات)'}</small></button>
      <button class="offer-btn open" data-offer="open" ${o.open.length ? '' : 'disabled'}><span>🔓</span><b>افتح بعد جديد</b><small>${o.open.length ? `باقي ${o.open.length} أبعاد مسكّرة` : 'كل الأبعاد مفتوحة'}</small></button>
      <button class="offer-btn skip" data-offer="skip"><span>🙅</span><b>لا تستحق</b><small>كل إشي بيضل زي ما هو لحد الأحد الجاي</small></button>
    </div>
  </div>`, { theme: 'game' });
  document.querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.offer;
    if (k === 'skip') return ask('متأكد؟ هالأسبوع ما رح تبني ولا تفتح إشي.', () => { const r = act(E.answerOffer(state, 'skip', {}, dayFor())); if (r.ok) FX.toast('تمام — بنشوفك الأحد الجاي 📬'); });
    if (k === 'build') return o.build.length === 1 ? pickHabit(o.build[0], { mode: 'build' }) : chooseDim('build', o.build);
    chooseDim('open', o.open);
  }));
}
// Which dimension: to build in (open ones with room) or to open (closed ones).
function chooseDim(kind, ids) {
  const regs = kind === 'build' ? ids.map((id) => E.findRegion(E.findCharacter(id).regionId)) : ids.map((id) => E.findRegion(id));
  modal(`<div class="offer">
    <h2>${kind === 'build' ? '🏗 وين بدك تبني؟' : '🔓 أي بعد بدك تفتح؟'}</h2>
    <div class="dims pick">${regs.map((r) => {
      const c = E.findCharacter(r.characterId), ch = state.characters[c.id], n = ch ? E.activeTasks(c, ch).length : 0;
      return `<button class="dim pickable" data-pick-dim="${kind === 'build' ? c.id : r.id}">${regionSVG(r, kind === 'build' ? E.regionFeatures(state, r.id) : new Set(), '')}<b>${esc(r.name)}</b><small>${kind === 'build' ? `🏗 ${n}/8 · ${esc(E.rankName(ch))}` : esc(c.name)}</small></button>`;
    }).join('')}</div>
    <button class="btn ghost" id="offer-back">← رجوع</button>
  </div>`, { theme: 'game' });
  $('#offer-back').onclick = showOffer;
  document.querySelectorAll('[data-pick-dim]').forEach((b) => (b.onclick = () => (kind === 'build' ? pickHabit(b.dataset.pickDim, { mode: 'build' }) : pickHabit(E.findRegion(b.dataset.pickDim).characterId, { mode: 'open', regionId: b.dataset.pickDim }))));
}

function pickLocation() {
  const cur = state.location;
  modal(`
    <h2>📍 مدينتك</h2>
    <p class="muted">اختر مدينتك: السما بالأماكن بتمشي على وقتك الحقيقي (الفجر، الظهر، المغرب…) وعلى طقس مدينتك.</p>
    <div class="chips">${CITIES.map((c, i) => `<button class="chip ${cur?.name === c.name ? 'on' : ''}" data-city="${i}">${c.name}</button>`).join('')}</div>
    <p><button class="btn ghost small" id="geo">📍 استخدم موقعي الحالي</button></p>
    <label class="form">طريقة الحساب
      <select id="method">${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${cur?.method === k ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
    </label>`);
  const save = (loc) => { state.location = { ...loc }; scheduleSave(); closeModal(); oasis?.scene.refreshSky(); loadWeather(true); render(); FX.toast(`📍 ${loc.name}`); };
  document.querySelectorAll('[data-city]').forEach((b) => (b.onclick = () => save({ ...CITIES[+b.dataset.city] })));
  $('#method').onchange = (e) => { if (state.location) { state.location.method = e.target.value; scheduleSave(); render(); } };
  $('#geo').onclick = () => {
    if (!navigator.geolocation) return FX.toast('تحديد الموقع غير متاح', 'err');
    navigator.geolocation.getCurrentPosition(
      (p) => save({ name: 'موقعي', lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4), method: $('#method').value }),
      () => FX.toast('تعذّر تحديد الموقع — اختر مدينة', 'err'),
      { timeout: 10000 });
  };
}

// A habit's counter: "3 أيام · 5 ساعات" (and whether it is paused).
const ar = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const counterTxt = (t) => {
  const { days, hours, minutes } = E.habitDays(t);
  const d = ar(days, 'يوم', 'يومين', 'أيام', 'يوم'), h = ar(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  return days ? `${d}${hours ? ` و${h}` : ''}` : hours ? `${h}${minutes ? ` و${minutes} د` : ''}` : `${minutes} دقيقة`;
};
// One habit in a list: its counter, pause / run, reset.
// When a habit began (its counter's start), as day/month/year.
const startDate = (t) => { const d = new Date(t.start); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
// A building's number (1–8): the order it was built in.
const habitNo = (charId, t) => E.activeTasks(E.findCharacter(charId), state.characters[charId]).findIndex((x) => x.id === t.id) + 1;
function taskRow(charId, t) {
  const paused = t.paused != null;
  return `
  <li class="task habit-row ${paused ? 'is-paused' : 'is-running'}">
    <div class="task-main">
      <strong><span class="t-no">${habitNo(charId, t)}</span> <span class="t-ic">${taskIcon(charId, t)}</span> ${esc(t.title)}${E.findCharacter(charId)?.stages ? ` <button class="edit-task" data-edit-task="${charId}:${t.id}" title="عدّل الاسم والصورة">✎ تعديل</button>` : ''}</strong>
      <span class="counter">⏱ <b>${counterTxt(t)}</b>${paused ? ' <small>⏸ موقوف</small>' : ''}</span>
      <small class="muted">📅 بدأت: ${startDate(t)}</small>
    </div>
    <div class="task-actions">
      ${paused ? `<button class="btn ok" data-habit-run="${charId}:${t.id}">▶ شغّل</button>` : `<button class="btn" data-habit-pause="${charId}:${t.id}">⏸ وقّف</button>`}
      <button class="btn bad" data-habit-reset="${charId}:${t.id}">↺ صفّر</button>
    </div>
  </li>`;
}

// World: a big fogged map. Owned places are clear; the next place shows its price.
function renderWorld() {
  const spots = REGIONS.filter((r) => r.map).map((def) => {
    const vis = E.mapVisibility(state, def);
    let scene = '';
    if (vis === 'owned' && def.characterId) {
      const c = E.findCharacter(def.characterId);
      const ch = state.characters[c.id];
      scene = regionSVG(def, E.regionFeatures(state, def.id), ch ? characterSVG(c, artLevel(ch), { size: 80 }) : '');
    }
    return { def, vis, scene };
  });
  worldSpots = spots;
  return `
  <div class="world-view" id="world-view"><div class="w3-loading">جارٍ تحميل العالم…</div></div>
  <button class="hud-chip atmo world-atmo" data-open-atmo>${WEATHER_NAMES[currentWeather()].split(' ')[0]} ${PERIODS[skyInfo().period]}${timeOverride === "auto" ? ` · ${fmtTime(new Date())}` : ""}</button>
  <p class="map-help">اسحب لتتنقّل · كبّر وصغّر بعجلة الماوس أو بإصبعين · زر الماوس الأيمن للدوران · اضغط على مكان لتدخله</p>`;
}

// The 3D world is mounted after the screen HTML is in place; falls back to the flat map.
let worldSpots = [], disposeWorld = null;
let worldKey = '';
const worldSignature = () => REGIONS.map((r) => E.mapVisibility(state, r)).join();
async function bindWorld() {
  disposeWorld?.(); disposeWorld = null;
  const v = $('#world-view');
  if (!v) return;
  worldKey = worldSignature();
  try {
    const { mountWorld } = await import('./world3d.js');
    if (!v.isConnected) return;
    v.innerHTML = '';
    disposeWorld = mountWorld(v, worldSpots, openSpot, { sky: skyInfo, weather: currentWeather() });
    loadWeather();
  } catch (err) {
    console.warn('3D world unavailable', err);
    v.classList.add('flat');
    v.innerHTML = worldMapSVG(worldSpots);
    v.querySelectorAll('[data-spot]').forEach((el) => (el.onclick = () => openSpot(el.dataset.spot)));
  }
}

function openSpot(id) {
  const def = E.findRegion(id);
  if (def.kind === 'trophies') return go('trophies');
  if (def.kind === 'hq') return go('hq');
  if (def.kind === 'leaders') return showIsland();
  if (state.regions[id]) return enter(def.characterId);
  const c = E.findCharacter(def.characterId), o = E.pendingOffer(state, dayFor());
  modal(`
    <div class="region-full">${regionSVG(def, new Set(), '', { locked: true })}</div>
    <h2>${def.name}</h2>
    <p class="muted">${def.desc}</p>
    <p>🔒 مسكّر. بتفتحه من <b>رسالة الأحد 📬</b>${c ? `، ومعه بتنضم إليك شخصية <b>${c.name}</b> وأول عادة إلها` : ''}.</p>
    ${o?.open.includes(id) ? `<button class="btn primary" id="open-place">📬 افتحه هالأسبوع</button>` : ''}`);
  if ($('#open-place')) $('#open-place').onclick = () => pickHabit(def.characterId, { mode: 'open', regionId: id });
}
// The Island of Leaders: on the map from the start; the ship takes you there once ready.
function showIsland() {
  const def = E.findRegion('leaders'), n = E.habitsBuilt(state), all = E.HABITS_ALL(), st = E.shipStage(state), open = E.islandOpen(state);
  modal(`<div class="keyuse"><div class="keyuse-icon">🏝</div><h2>${def.name}</h2><p class="muted">${def.desc}</p>
    <h3 class="keyuse-title">🚢 السفينة: ${st} من ${E.SHIP.parts}</h3>${bar(n, all, 'كل عادة بتبنيها = خطوة بالسفينة')}
    <p class="muted">${open ? '🎉 السفينة جاهزة والجزيرة فتحت!' : `السفينة بتجهز لما تفتح الأبعاد الـ8 وتبني بكل واحد 8 عادات. باقي ${all - n} عادة.`}</p></div>`);
}

// Visual growth of the character art follows overall progress (stage × 5 + level).
const artLevel = (ch) => Math.min(10, ch.stage * 5 + ch.level);
const bar = (cur, max, label) => `
  <div class="prog"><div class="row between"><small>${label}</small><small><bdi>${cur} / ${max}</bdi></small></div>
  <div class="bar"><span style="width:${Math.round((cur / max) * 100)}%"></span></div></div>`;

// The rank ladder (Bronze 1 → Platinum 3). The player writes each rank's tasks;
// reaching a rank adds them on top of the earlier ones. Raising a rank costs one key.
function rankLadder(c) {
  const plan = E.planOf(c, state.characters[c.id]);
  return RANKS.map((r, i) => ({ ...r, adds: plan[i] || [] }));
}
function progressionPanel(c, ch) {
  if (!c.stages) return '';
  const cur = E.totalLevel(ch);
  const ladder = rankLadder(c);
  return `
  <section class="card">
    <div class="row between"><h3>🎖 الرتب</h3><button class="rank" data-ranks="${c.id}" title="اعرض كل الرتب" style="--rank:${E.rankColor(ch)}">${esc(E.rankName(ch))} ▾</button></div>
    <p class="muted small-text">كل عادة جديدة بتبنيها (من رسالة الأحد) بتطلّعك رتبة لحالها.</p>
    <ol class="path">${ladder.map((r, i) => {
      const n = i + 1, cls = n < cur ? 'done' : n === cur ? 'current' : '';
      const what = r.adds.length ? r.adds.map((a) => (n === 1 ? '' : '+ ') + a.title).join('، ') : n > cur ? 'عادة جديدة بتختارها' : '—';
      const unlock = n === cur + 1
        ? '<small class="muted">📬 من رسالة الأحد</small>' : '';
      return `<li class="${cls}" style="--rank:${r.color}"><b class="rk">${esc(r.name)}</b><span>${esc(what)}</span>${unlock}</li>`;
    }).join('')}</ol>
    ${dimLine(c.id)}
  </section>`;
}

// The habit picker — one clear screen: pick a ready habit (or write your own),
// rename it and give it an icon, choose how many times a day, see what it leads to.
//   mode 'first'   : the spiritual dimension's first habit (at the start)
//   mode 'build'   : the Sunday message — a new habit (a new building) in this dimension
//   mode 'open'    : the Sunday message — open this dimension (regionId) with its first habit
//   mode 'edit'    : change one of today's habits (taskId)
// Icons: the dimension's own first, then general ones for any habit.
const DIM_ICONS = {
  worshipper: ['🕌', '📖', '📿', '🤲', '🕋', '🌙', '⭐', '🕯', '💝', '🎧', '🧎', '☪', '📜', '🌅', '🌃', '💧', '🫶', '🍽'],
  scholar: ['📚', '📖', '🧠', '✍', '📝', '🔬', '🧪', '🧮', '🗣', '🌍', '🎓', '💻', '🔭', '📐', '🗂', '🧩', '🎧', '📰'],
  athlete: ['🏃', '🏋', '💪', '🚴', '🏊', '🤸', '🧘', '⚽', '🥊', '🥗', '🍎', '🥦', '💧', '🛌', '🚶', '❤️‍🩹', '⚖', '🩺'],
  empath: ['🤝', '🕊', '🎁', '👂', '🏥', '🤲', '🧓', '🎖', '🍞', '🫶', '💌', '☎', '🧸', '🌱', '🏠', '🪔', '🙏'],
  host: ['👪', '📞', '🤝', '🏠', '💬', '🍽', '☕', '🎉', '🫂', '✉', '🎁', '🧆', '🕌', '👋', '🪑', '🔥', '📸', '🎂'],
  builder: ['🎯', '🗓', '💼', '📈', '⏰', '📧', '💻', '🧑‍💼', '📊', '🗂', '🖊', '📞', '🏆', '🚀', '📌', '🧭', '☕', '📝'],
  merchant: ['🧾', '🐖', '💰', '🪙', '💳', '📊', '🏦', '💡', '🚫', '📉', '📈', '🧮', '🛒', '🏷', '💵', '🔐', '⚖', '📒'],
  keeper: ['🌳', '🌱', '♻', '🚯', '💧', '☀', '🌬', '🐝', '🐦', '🌻', '🚶', '🚲', '🌍', '🧹', '🪴', '🍃', '🔋', '🌊'],
};
const ICONS = ['⭐', '🔥', '✅', '🎯', '⏰', '📵', '🚭', '☕', '🍎', '💧', '🛌', '🧹', '🎨', '🎸', '🧩', '📖', '✍', '💪', '🙏', '❤', '🌙', '☀', '🕯', '🎵', '🏠', '🚗', '📞', '💬', '🛑', '🧠', '👀', '🗝', '🏅', '🌟', '🍀', '🕐'];
const DIM_ICON = { worshipper: '☪', scholar: '📚', athlete: '🏋', empath: '🕊', host: '🤝', builder: '🛠', merchant: '🪙', keeper: '🌳' };
const taskIcon = (charId, t) => t.icon || (SUGGEST[charId] || []).find(([, x]) => x === t.title)?.[0] || DIM_ICON[charId] || '⭐';
function pickHabit(id, { mode = 'first', taskId = null, regionId = null } = {}) {
  const c = E.findCharacter(id), ch = state.characters[id];
  const rd = E.road(state, id);
  const plan = E.planOf(c, ch);
  const editing = mode === 'edit' ? E.activeTasks(c, ch).find((t) => t.id === taskId) : null;
  const rankIndex = mode === 'edit' ? plan.findIndex((r) => r.some((t) => t.id === taskId)) : ch ? E.totalLevel(ch) - 1 : 0;
  const have = new Set(E.activeTasks(c, ch).map((t) => t.title).filter((t) => t !== editing?.title));
  const ideas = (SUGGEST[id] || []).filter(([, t]) => !have.has(t));
  // What is being built: { from: suggestion title | 'own', title, icon, times }
  const cur = editing
    ? { from: ideas.some(([, t]) => t === editing.title) ? editing.title : 'own', title: editing.title, icon: taskIcon(id, editing) }
    : { from: null, title: '', icon: '' };
  const head = mode === 'build' ? { k: `🏗 ${esc(c.name)} · مبنى ${(rd?.habits || 0) + 1} من 8`, t: 'العادة الجديدة' }
    : mode === 'open' ? { k: `🔓 ${esc(E.findRegion(regionId).name)}`, t: 'أول عادة لهاد البعد' }
    : mode === 'edit' ? { k: 'تعديل العادة', t: 'غيّر اسمها أو صورتها' } : { k: esc(c.name), t: 'اختار أول عادة إلك' };
  const lead = mode === 'build' ? `بتنبني بمبنى جديد، وبتطلع رتبة ${esc(c.name)} لـ <b>${esc(rd?.next?.name || '')}</b>.`
    : mode === 'open' ? 'البعد بيفتح بمبنى واحد: هاي العادة.'
    : mode === 'edit' ? 'العدّاد بيضل زي ما هو. الصورة والملاحظات من شباك المبنى.' : 'عادة وحدة بتعملها كل يوم. ابدأ بإشي صغير بتقدر تلتزم فيه 💪';
  modal(`
    <div class="picker" style="--glow:${c.palette.glow}">
      <header class="pk-head"><div class="pk-medal">${DIM_ICON[id] || '⭐'}</div><div><small>${head.k}</small><h2>${head.t}</h2></div></header>
      <p class="pk-lead">${lead}</p>
      <div class="pk-step"><b>1</b> اختار عادة</div>
      <div class="habit-grid">
        ${ideas.map(([ic, t], i) => `<button class="habit" type="button" data-h="${esc(t)}" data-ic="${ic}" style="--i:${i}"><span class="hb-ic">${ic}</span><b>${esc(t)}</b><i class="hb-check">✔</i></button>`).join('')}
        <button class="habit own" type="button" data-own style="--i:${ideas.length}"><span class="hb-ic">✍</span><b>مهمة من عندي</b><i class="hb-check">✔</i></button>
      </div>
      <div class="pk-custom" id="pk-custom" hidden>
        <div class="pk-step"><b>2</b> خصّصها على كيفك</div>
        <div class="pk-name">
          <button type="button" class="pk-icon" id="pk-icon" title="غيّر الصورة">⭐</button>
          <input id="pk-title" maxlength="80" placeholder="اسم المهمة">
        </div>
        <div class="pk-icons-wrap" id="pk-icons" hidden>
          <small>صور ${esc(c.name)}</small>
          <div class="pk-icons">${(DIM_ICONS[id] || []).map((x) => `<button type="button" data-icon="${x}">${x}</button>`).join('')}</div>
          <small>صور عامة</small>
          <div class="pk-icons">${ICONS.filter((x) => !(DIM_ICONS[id] || []).includes(x)).map((x) => `<button type="button" data-icon="${x}">${x}</button>`).join('')}</div>
        </div>
        <div class="hp-sum" id="hp-sum"></div>
      </div>
      <div class="pk-actions">
        <button class="pk-ok" id="hp-ok" disabled>${mode === 'build' ? '🏗 ابنيها' : mode === 'open' ? '🔓 افتح البعد' : editing ? 'احفظ ✔' : 'ثبّت المهمة ✔'}</button>
        <button class="pk-ghost" id="hp-cancel">${mode === 'first' ? 'لاحقًا' : 'رجوع'}</button>
      </div>
    </div>`, { theme: 'game' });
  modalRefresh = null;
  const ok = $('#hp-ok'), sum = $('#hp-sum'), title = $('#pk-title'), iconBtn = $('#pk-icon'), icons = $('#pk-icons');
  const draw = () => {
    document.querySelectorAll('.habit').forEach((b) => b.classList.toggle('on', cur.from === 'own' ? b.hasAttribute('data-own') : b.dataset.h === cur.from));
    $('#pk-custom').hidden = !cur.from;
    const t = cur.title.trim();
    iconBtn.textContent = cur.icon || '⭐';
    ok.disabled = !t;
    sum.innerHTML = t
      ? editing ? `<p><span>✎</span>المبنى بيصير اسمه <b>${esc(cur.icon || '⭐')} ${esc(t)}</b>.</p><p><span>⏱</span>العدّاد بيضل زي ما هو.</p>`
      : `<p><span>🏗</span>مبنى جديد اسمه <b>${esc(cur.icon || '⭐')} ${esc(t)}</b>.</p>
         <p><span>⏱</span>إله عدّاد بيبلّش من هلأ، بيعد الأيام والساعات. بتقدر توقفه أو تصفّره.</p>`
      : '<p class="muted">اكتب اسم العادة 👆</p>';
  };
  document.querySelectorAll('.habit').forEach((b) => (b.onclick = () => {
    if (b.hasAttribute('data-own')) Object.assign(cur, { from: 'own', title: cur.from === 'own' ? cur.title : '', icon: cur.from === 'own' ? cur.icon : '✍' });
    else Object.assign(cur, { from: b.dataset.h, title: b.dataset.h, icon: b.dataset.ic });
    title.value = cur.title; SND.sfx.click(); draw();
    if (cur.from === 'own') setTimeout(() => title.focus(), 0);
    $('#pk-custom').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  title.value = cur.title;
  title.oninput = () => { cur.title = title.value; draw(); };
  iconBtn.onclick = () => { icons.hidden = !icons.hidden; };
  icons.querySelectorAll('[data-icon]').forEach((b) => (b.onclick = () => { cur.icon = b.dataset.icon; icons.hidden = true; SND.sfx.click(); draw(); }));
  $('#hp-cancel').onclick = () => (mode === 'build' || mode === 'open' ? showOffer() : closeModal());
  ok.onclick = () => {
    const habit = { title: cur.title.trim(), icon: cur.icon };
    if (mode === 'build' || mode === 'open') {
      const r = act(E.answerOffer(state, mode, { id: mode === 'open' ? regionId : id, habit }, dayFor()), ok);
      if (r.ok) { closeModal(); enter(id); maybeTelegram(); }
      return;
    }
    const r = editing ? E.editHabit(state, id, editing.id, habit) : E.setHabit(state, id, rankIndex, null, habit);
    if (!r.ok) return FX.toast(r.reason, 'err');
    scheduleSave(); questsCollapsed = false; render();
    if (mode === 'first') showStartInfo(); else { FX.toast('تم ✔'); closeModal(); }
  };
  draw();
}

// Shown after the first habit is set: what comes every day and every Sunday.
function showStartInfo() {
  const dims = REGIONS.filter((r) => r.characterId);
  modal(`
    <div class="keyuse">
      <div class="keyuse-icon">🏗</div>
      <h2>أول مبنى بالبعد الروحي جاهز</h2>
      <p class="muted">كل بُعد فيه 8 مباني صغيرة، وكل مبنى = عادة إلها عدّاد ⏱ بيعد الأيام والساعات. إذا كسرتها صفّرها ↺، وإذا بدك توقفها ⏸.</p>
      <h3 class="keyuse-title">📬 كل أحد بتجيك رسالة</h3>
      <ul class="keyuse-list">
        <li><span>🏗</span><div><b>ابني عادة</b><small>مبنى جديد بأي بُعد مفتوح، والرتبة بتطلع لحالها.</small></div></li>
        <li><span>🔓</span><div><b>افتح بعد جديد</b><small>من الأبعاد الثمانية، مع أول عادة إلو.</small></div></li>
        <li><span>🙅</span><div><b>لا تستحق</b><small>كل إشي بيضل زي ما هو لحد الأحد الجاي.</small></div></li>
      </ul>
      <div class="dims">${dims.map((r) => `
        <figure class="dim ${state.regions[r.id] ? 'owned' : ''}">
          ${regionSVG(r, new Set(), '')}
          <figcaption>${state.regions[r.id] ? '✔ ' : ''}${esc(r.name)}</figcaption>
        </figure>`).join('')}</div>
      <button class="btn primary big" id="keyuse-ok">يلا نبلّش</button>
    </div>`);
  $('#keyuse-ok').onclick = closeModal;
}

function showRanks(id) {
  const c = E.findCharacter(id);
  const cur = E.totalLevel(state.characters[id]);
  modal(`
    <h2>الرتب</h2>
    <p class="muted">للنظر فقط. كل عادة جديدة بتبنيها (من رسالة الأحد) = رتبة جديدة، لحالها.</p>
    <ol class="ladder">${rankLadder(c).map((r, i) => `
      <li class="${i + 1 < cur ? 'done' : i + 1 === cur ? 'current' : ''}" style="--rank:${r.color}">
        <b>${i + 1}</b><span>${esc(r.name)}</span>
        <small>${i + 1 < cur ? '✔' : i + 1 === cur ? 'أنت هنا' : r.adds.length ? `${r.adds.length} مهام` : 'فاضية'}</small></li>`).join('')}</ol>`);
}

// Inside a character: a 3D place with the character, and a game HUD over it.
// Places without a 3D scene yet use the classic layout.
const sceneFor = (charId) => !!E.findCharacter(charId);
let oasis = null;
let questsCollapsed = true;
const placeState = () => {
  const c = E.findCharacter(currentChar), ch = state.characters[c.id];
  return { features: E.regionFeatures(state, c.regionId), level: artLevel(ch), rank: rankState(c, ch), habits: habitsFor(c) };
};
// The dimension's habits for its eight small buildings (done today = the lamp on the roof lit).
const habitsFor = (c) => { const ch = state.characters[c.id]; return ch ? E.activeTasks(c, ch).slice(0, E.RANK_COUNT).map((t, i) => ({ id: t.id, n: i + 1, title: t.title, icon: taskIcon(c.id, t), img: t.img || null, start: t.start, time: E.habitDays(t), paused: t.paused != null })) : []; };
// A picture from the device, made small (at most 360 px) to keep in the save.
function shrinkImage(file, max = 360) {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.82)); };
    im.onerror = () => { URL.revokeObjectURL(url); bad(new Error('image')); };
    im.src = url;
  });
}
if (typeof window !== "undefined") window.__nmnHabit = (c, t) => window.__nmnDebug && showHabit(c, t);
// Tapping a building: its habit, its counter (pause / run, reset), its picture and its notes.
function showHabit(charId, taskId) {
  const c = E.findCharacter(charId), t = E.activeTasks(c, state.characters[charId]).find((x) => x.id === taskId);
  if (!t) return;
  modal(`<h2>مبنى ${habitNo(charId, t)} · ${esc(t.title)}</h2><p class="muted">من مباني ${esc(c.name)}.</p>
    <ul class="tasks">${taskRow(charId, t)}</ul>
    <div class="pk-actions"><button class="pk-ok" data-edit-task="${charId}:${taskId}">✎ عدّل الاسم والصورة</button></div>
    <div class="habit-pic">
      ${t.img ? `<img src="${t.img}" alt="">` : '<div class="no-pic">ما في صورة</div>'}
      <div class="row wrap"><label class="btn">${t.img ? 'غيّر الصورة' : 'أضف صورة'}<input type="file" accept="image/*" id="hb-img" hidden></label>${t.img ? '<button class="btn" id="hb-noimg">شيل الصورة</button>' : ''}</div>
    </div>
    <div class="habit-notes"><b>ورقة الملاحظات</b>
      <textarea id="hb-notes" rows="8" placeholder="اكتب هون كل اللي بدك إياه: عادات صغيرة جوا هالعادة، شرح، أهداف…">${esc(t.notes || '')}</textarea>
      <div class="row"><button class="btn primary" id="hb-save">احفظ الملاحظات</button><small class="muted" id="hb-saved"></small></div>
    </div>`);
  // Kept fresh as the counter runs, without losing what is being written.
  modalRefresh = () => { const ta = $('#hb-notes'), v = ta?.value, f = document.activeElement === ta, a = ta?.selectionStart, b = ta?.selectionEnd; showHabit(charId, taskId); const n = $('#hb-notes'); if (n && v != null) { n.value = v; if (f) { n.focus(); n.setSelectionRange(a, b); } } };
  const saveHabit = (patch, msg) => { const r = act(E.editHabit(state, charId, taskId, patch)); if (r.ok && msg) FX.toast(msg); return r; };
  $('#hb-save').onclick = () => { if (saveHabit({ notes: $('#hb-notes').value }).ok) $('#hb-saved').textContent = 'انحفظت'; };
  $('#hb-img').onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const img = await shrinkImage(f); if (saveHabit({ img }, 'تمّت إضافة الصورة').ok) showHabit(charId, taskId); } catch { FX.toast('ما قدرت أفتح الصورة', 'err'); } };
  if ($('#hb-noimg')) $('#hb-noimg').onclick = () => { if (saveHabit({ img: null }).ok) showHabit(charId, taskId); };
  bind();
}
// What the rank stand shows: every rank, the current one, and the buildings (habits) so far.
const rankState = (c, ch) => {
  if (!c.stages) return null;
  return { ranks: RANKS, current: E.totalLevel(ch) - 1, keyDays: E.activeTasks(c, ch).length, keyEvery: E.RANK_COUNT };
};

async function bindPlace() {
  const v = $('#place-view');
  if (!v) return;
  const c = E.findCharacter(currentChar);
  try {
    if (c.id !== 'worshipper') {
      const { mountPlace } = await import('./place3d.js');
      if (!v.isConnected) return;
      v.querySelector('.w3-loading')?.remove();
      const scene = mountPlace(v, { regionId: c.regionId, palette: c.palette, rank: placeState().rank, features: placeState().features, habits: placeState().habits, onHabit: (id) => showHabit(c.id, id), lucifer: luciFor(c.id), onRanks: () => showRanks(c.id), sky: skyInfo, weather: currentWeather(), onCharacter: () => { SND.sfx.wave(); FX.toast(`${c.name}: ${['يلا نكمل!', 'خطوة كل يوم', 'أنا جاهز', 'الاستمرار سر النجاح'][Math.random() * 4 | 0]}`); } });
      oasis = { char: c.id, scene };
      loadWeather();
      return;
    }
    const { mountOasis } = await import('./oasis3d.js');
    if (!v.isConnected) return;
    v.querySelector('.w3-loading')?.remove();
    const scene = mountOasis(v, { palette: c.palette, ...placeState(), onHabit: (id) => showHabit(c.id, id), lucifer: luciFor(c.id), onRanks: () => showRanks(c.id), sky: skyInfo, weather: currentWeather(),
      onCharacter: () => { SND.sfx.wave(); FX.toast(`${c.name}: ${randomLine()}`); } });
    oasis = { char: c.id, scene };
    loadWeather();
  } catch (err) {
    console.warn('3D place unavailable', err);
    v.innerHTML = `<div class="hero-scene">${regionSVG(E.findRegion(c.regionId), E.regionFeatures(state, c.regionId), characterSVG(c, artLevel(state.characters[c.id]), { size: 80 }))}</div>`;
  }
}
const LINES = ['الحمد لله', 'يلا نكمل!', 'خطوة كل يوم', 'سبحان الله وبحمده', 'الاستمرار سر النجاح'];
const randomLine = () => LINES[Math.floor(Math.random() * LINES.length)];
// Lucifer roams the places until the commander's warriors lock him in the vault.
const luciFor = (id) => (state.story?.jailed ? null : { who: id, tasks: () => { const c = E.findCharacter(id), ch = state.characters[id]; return ch ? E.activeTasks(c, ch).filter((t) => t.paused != null).map((t) => t.title) : []; } });

// ---------- Sound ----------
const WX_SOUND = { clear: [0, 0, 0.3], cloudy: [0, 0, 0.5], overcast: [0, 0, 0.6], fog: [0, 0, 0.2], rain: [1, 0, 0.6], storm: [1.4, 0, 1], snow: [0, 1, 0.4] };
function syncSound() {
  const { elev } = skyInfo();
  const [rain, snow, wind] = WX_SOUND[currentWeather()] || WX_SOUND.clear;
  SND.setScene({ screen, night: Math.max(0, Math.min(1, (3 - elev) / 13)), rain, snow, wind, storm: currentWeather() === 'storm' });
}

function showSettings() {
  const st = SND.settings();
  const slider = (k, label) => `<label class="snd-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${st[k]}" data-snd="${k}"><b>${Math.round(st[k] * 100)}</b></label>`;
  modal(`
    <h2>⚙️ الإعدادات</h2>
    <section class="set-block">
      <div class="row between"><h3>🔊 الصوت</h3><label class="switch"><input type="checkbox" id="snd-on" ${st.enabled ? 'checked' : ''}><span></span></label></div>
      ${slider('master', '🎚 الصوت العام')}
      ${SND.MAIN.map((k) => slider(k, SND.SOUND_LABELS[k])).join('')}
      <details class="snd-more"><summary>تفاصيل كل صوت</summary>${SND.DETAIL.map((k) => slider(k, SND.SOUND_LABELS[k])).join('')}</details>
      <div class="row wrap"><button class="btn ghost" data-snd-test="coin">🪙 جرّب</button><button class="btn ghost" data-snd-test="prayer">🕌 جرّب</button><button class="btn ghost" data-snd-test="levelUp">⬆ جرّب</button><button class="btn ghost" data-snd-test="thunder">⛈ جرّب</button><button class="btn ghost" data-snd-test="wolf">🐺 جرّب</button></div>
    </section>
    <section class="set-block">
      <h3>🎙 أصوات حقيقية</h3>
      <p class="muted small-text">اختر تسجيلات من جهازك (mp3 / wav / ogg) — مثلًا من مواقع الأصوات المجانية. تُحفظ في متصفحك.</p>
      ${Object.entries(SND.RECORDINGS).map(([k, label]) => `
        <div class="rec-row"><span>${label}</span><small class="muted" data-rec-name="${k}">…</small>
          <label class="btn ghost small">اختيار ملف<input type="file" accept="audio/*" data-rec-file="${k}" hidden></label>
          <button class="btn ghost small" data-rec-play="${k}">▶</button><button class="btn ghost small" data-rec-del="${k}">✕</button></div>`).join('')}
    </section>
    <section class="set-block">
      <h3>🌤 الوقت والجو</h3>
      <button class="btn" data-open-atmo>تغيير الوقت والطقس</button>
    </section>
    <section class="set-block">
      <h3>🎓 الدليل</h3>
      <button class="btn" id="tour-again">اعرض الدليل من جديد</button>
    </section>
    <section class="set-block sandbox-block">
      <h3>🧪 وضع التجربة</h3>
      ${state.sandbox
        ? `<p class="muted small-text">إنت هلأ بوضع التجربة. تقدّمك الحقيقي محفوظ وبيرجع لما تطلع.</p>
           <p class="muted small-text">كل كبسة = مرّ أسبوع: بتجيك رسالة الأحد، والعدّادات بتمشي أسبوع.</p>
           <div class="row wrap"><button class="btn primary" id="sb-week">📬 مرّ أسبوع</button><button class="btn" id="sb-leave">↩ ارجع لتقدّمي الحقيقي</button></div>`
        : `<p class="muted small-text">نسخة من لعبتك، وفيها زر واحد: <b>📬 مرّ أسبوع</b> — كل ما تكبسه بتجيك رسالة الأحد كأنه مرّ أسبوع، عشان تشوف اللعبة كيف بتمشي معك. تقدّمك الحقيقي بينحفظ وبيرجع لما تطلع.</p>
           <button class="btn primary" id="sb-enter">🧪 ادخل وضع التجربة</button>`}
    </section>`);
  if ($('#tour-again')) $('#tour-again').onclick = () => { tour?.restart(); closeModal(); go('world'); };
  const swap = (next, msg) => { state = next; C.ensure(state); syncClock(); closeDays(); scheduleSave(); closeModal(); go('world'); render(); FX.toast(msg); };
  if ($('#sb-enter')) $('#sb-enter').onclick = () => swap(E.enterSandbox(state), '🧪 وضع التجربة: كبسة 📬 = مرّ أسبوع');
  if ($('#sb-leave')) $('#sb-leave').onclick = () => ask('ترجع لتقدّمك الحقيقي؟ كل إشي عملته بالتجربة بيروح.', () => swap(E.leaveSandbox(state), '↩ رجعت لتقدّمك الحقيقي'));
  // Test mode: a week passes — the counters run on a week and the Sunday message comes.
  if ($('#sb-week')) $('#sb-week').onclick = weekPass;
  $('#snd-on').onchange = (e) => { SND.set('enabled', e.target.checked); };
  document.querySelectorAll('[data-snd]').forEach((el) => (el.oninput = () => { SND.set(el.dataset.snd, +el.value); el.nextElementSibling.textContent = Math.round(el.value * 100); }));
  document.querySelectorAll('[data-snd-test]').forEach((el) => (el.onclick = () => SND.sfx[el.dataset.sndTest]()));
  let recSeq = 0;
  const recNames = () => { const my = ++recSeq; document.querySelectorAll('[data-rec-name]').forEach(async (el) => { const n = await SND.recordingName(el.dataset.recName); if (my === recSeq) el.textContent = n || 'لا يوجد (صامت)'; }); };
  recNames();
  document.querySelectorAll('[data-rec-file]').forEach((el) => (el.onchange = async () => { const f = el.files[0]; if (!f) return; try { await SND.setRecording(el.dataset.recFile, f); FX.toast('✔ تم حفظ الصوت'); } catch { FX.toast('تعذّر قراءة الملف', 'err'); } recNames(); }));
  document.querySelectorAll('[data-rec-del]').forEach((el) => (el.onclick = async () => { await SND.setRecording(el.dataset.recDel, null); recNames(); }));
  document.querySelectorAll('[data-rec-play]').forEach((el) => (el.onclick = async () => { if (el.dataset.recPlay === 'door') SND.creak(); else { await SND.setCry(1); setTimeout(() => SND.setCry(0), 3000); } }));
  bind();
}

// ---------- Sky & weather ----------
// Sun elevation follows the real prayer times of the chosen city: dawn at Fajr,
// sunrise, noon at Dhuhr, sunset at Maghrib, full night after Isha.
const PERIODS = { auto: 'تلقائي', fajr: 'الفجر', morning: 'الصباح', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', night: 'الليل' };
const PREVIEW_ELEV = { fajr: [-8, false], morning: [18, false], dhuhr: [62, true], asr: [30, true], maghrib: [1, true], night: [-25, true] };
let timeOverride = 'auto';
function skyInfo(now = new Date()) {
  if (timeOverride !== 'auto') { const [elev, pm] = PREVIEW_ELEV[timeOverride]; return { elev, pm, period: timeOverride }; }
  const pd = prayerNow();
  const hr = (d) => d.getHours() + d.getMinutes() / 60;
  let fajr, sunrise, dhuhr, asr, maghrib, isha;
  if (pd) { ({ fajr: { start: fajr, end: sunrise }, dhuhr: { start: dhuhr }, asr: { start: asr }, maghrib: { start: maghrib }, isha: { start: isha } } = pd.windows); [fajr, sunrise, dhuhr, asr, maghrib, isha] = [fajr, sunrise, dhuhr, asr, maghrib, isha].map(hr); }
  else [fajr, sunrise, dhuhr, asr, maghrib, isha] = [4.5, 6, 12, 15.3, 18, 19.5];
  let h = hr(now); if (h < fajr - 3) h += 24;
  const k = (a, b) => THREE_clamp((h - a) / (b - a));
  let elev;
  if (h < fajr) elev = -25;
  else if (h < sunrise) elev = -18 + 18 * k(fajr, sunrise);
  else if (h < dhuhr) elev = 62 * Math.sin((k(sunrise, dhuhr) * Math.PI) / 2);
  else if (h < maghrib) elev = 62 * Math.cos((k(dhuhr, maghrib) * Math.PI) / 2);
  else if (h < isha) elev = -18 * k(maghrib, isha);
  else elev = -25;
  // Label by what the sky looks like: after dusk (sun well below the horizon) it is night
  // even though the Maghrib prayer time lasts until Isha; likewise before first light.
  const period = h < fajr ? 'night' : h < sunrise ? 'fajr' : h < dhuhr ? 'morning' : h < asr ? 'dhuhr' : h < maghrib ? 'asr' : h < isha ? (elev < -6 ? 'night' : 'maghrib') : 'night';
  return { elev, pm: h >= dhuhr, period };
}
const THREE_clamp = (x) => Math.max(0, Math.min(1, x));

const WEATHER_NAMES = { auto: 'تلقائي', clear: '☀️ صافٍ', cloudy: '⛅ غائم جزئيًا', overcast: '☁️ غائم', fog: '🌫 ضباب', rain: '🌧 مطر', storm: '⛈ عاصفة', snow: '❄️ ثلج' };
let weatherOverride = 'auto', liveWeather = null, weatherFetchedAt = 0;
const currentWeather = () => (weatherOverride !== 'auto' ? weatherOverride : liveWeather?.kind || 'clear');
// Live weather for the chosen city (Open-Meteo, no key). Silently stays "clear" if unreachable.
async function loadWeather(force = false) {
  const loc = state.location;
  if (!loc || (!force && Date.now() - weatherFetchedAt < 10 * 60e3)) return;
  weatherFetchedAt = Date.now();
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=weather_code,temperature_2m`);
    const j = await r.json();
    const { weatherFromCode } = await import('./oasis3d.js');
    liveWeather = { kind: weatherFromCode(j.current.weather_code), temp: Math.round(j.current.temperature_2m) };
  } catch (e) { console.warn('weather unavailable', e); liveWeather = liveWeather || { kind: 'clear', offline: true }; }
  oasis?.scene.setWeather(currentWeather());
  disposeWorld?.setWeather?.(currentWeather());
  hqScene?.setWeather?.(currentWeather());
  if ($('#hud')) $('#hud').innerHTML = placeHUD(), bind();
}

function showAtmosphere() {
  const chips = (names, cur, attr) => Object.entries(names).map(([k, v]) => `<button class="chip ${k === cur ? 'on' : ''}" ${attr}="${k}">${v}</button>`).join('');
  const live = liveWeather && !liveWeather.offline ? `الطقس الحقيقي في ${esc(state.location?.name || '')}: <b>${WEATHER_NAMES[liveWeather.kind]}</b>${liveWeather.temp != null ? ` · ${liveWeather.temp}°` : ''}` : 'تعذّر جلب الطقس الحقيقي — اختره يدويًا.';
  modal(`
    <h2>🌤 الجو والوقت</h2>
    <p class="muted">المكان يتبع وقتك الحقيقي (حسب أوقات الصلاة في مدينتك) وطقس مدينتك تلقائيًا. تقدر تجرّب غيره هنا.</p>
    <p>${live}</p>
    <h3>الطقس</h3><div class="row wrap">${chips(WEATHER_NAMES, weatherOverride, 'data-set-weather')}</div>
    <h3>الوقت</h3><div class="row wrap">${chips(PERIODS, timeOverride, 'data-set-time')}</div>`);
  modalRefresh = showAtmosphere;
  bind();
}


// One dimension in a line: its buildings (habits) of 8, its rank, today's stars.
function dimLine(id) {
  const rd = E.road(state, id);
  if (!rd || !rd.habits) return '';
  return `<div class="road">
    <div class="road-bar"><i style="width:${Math.round((rd.habits / rd.max) * 100)}%"></i></div>
    <p>🏗 <b><bdi>${rd.habits}/${rd.max}</bdi></b> عادات · ${esc(rd.rank.name)}</p>
    ${E.pendingOffer(state, dayFor()) ? '<button class="btn small primary" data-show-offer>📬 رسالة الأحد</button>' : ''}
  </div>`;
}
const roadLine = dimLine;

function placeHUD() {
  const c = E.findCharacter(currentChar);
  const ch = state.characters[c.id];
  const r = E.findRegion(c.regionId);
  const stage = c.stages?.[ch.stage];
  const tasks = E.activeTasks(c, ch);
  const best = Math.max(0, ...tasks.map((t) => E.habitDays(t).days));
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:${c.palette.glow}">${DIM_ICON[c.id] || '☪'}</div>
      <div class="plate-body">
        <div class="plate-name">${c.name === r.name ? r.name : `${c.name} <span class="plate-place">· ${r.name}</span>`}</div>
        <div class="plate-row"><span class="plate-streak" title="أطول عدّاد (أيام)">⏱ أطول عدّاد: ${best} يوم</span></div>

      </div>
    </div>
    ${state.sandbox && c.stages ? `<button class="hud-chip dim-reset" data-dim-reset="${c.id}" title="وضع التجربة بس">↺ البعد من الصفر</button>` : ''}
    <button class="hud-chip atmo" data-open-atmo>${WEATHER_NAMES[currentWeather()].split(' ')[0]} ${PERIODS[skyInfo().period]}${timeOverride === "auto" ? ` · ${fmtTime(new Date())}` : ""}${liveWeather?.temp != null && weatherOverride === 'auto' ? ` · ${liveWeather.temp}°` : ''}</button>
  </div>`;
}

// The place's decorations: one more with every building.
function showUpgrades() {
  const c = E.findCharacter(currentChar), r = E.findRegion(c.regionId), have = E.regionFeatures(state, r.id);
  modal(`
    <h2>✨ زينة ${r.name}</h2>
    <p class="muted">كل مبنى جديد (عادة) بيزيد زينة على المكان.</p>
    <div class="upgrade-list">
      ${r.upgrades.map((u) => `<div class="upg ${have.has(u.adds) ? 'have' : ''}">${have.has(u.adds) ? '✔' : '○'} ${u.label} <small>🏗 ${u.level}</small></div>`).join('')}
    </div>`);
  modalRefresh = showUpgrades;
  bind();
}

// Commander's desk (HQ): every opened dimension, its rank and its habits (buildings).
function showDimRanks() {
  const list = CHARACTERS.filter((c) => c.stages && state.characters[c.id]);
  modal(`
    <h2>🎖 رتب الأبعاد</h2>
    <p class="muted">كل عادة بتبنيها = رتبة. بنيت <b>${E.habitsBuilt(state)}</b> من ${E.HABITS_ALL()}.</p>
    <ul class="dim-ranks">${list.map((c) => {
      const ch = state.characters[c.id], rd = E.road(state, c.id), tasks = E.activeTasks(c, ch);
      return `<li>
        <div class="dr-head"><b>${esc(c.name)}</b><span class="rank" style="--rank:${rd.rank.color}">${esc(rd.rank.name)}</span></div>
        <div class="dr-habits">${tasks.length ? tasks.map((t) => `<span>${taskIcon(c.id, t)} ${esc(t.title)} · ⏱ ${E.habitDays(t).days} ي</span>`).join('') : '<span class="muted">ما في مهام لسا</span>'}</div>
        ${dimLine(c.id)}
        ${!tasks.length ? `<div class="row wrap"><button class="btn small" data-set-tasks="${c.id}">🎯 اختار أول مهمة</button></div>` : ''}
      </li>`;
    }).join('')}</ul>`);
  modalRefresh = showDimRanks;
  bind();
}

function renderCharacter() {
  const c = E.findCharacter(currentChar);
  if (sceneFor(c.id)) {
    return `
    <div class="place-view" id="place-view"><div class="w3-loading">جارٍ تحميل ${E.findRegion(c.regionId).name}…</div></div>
    <div class="hud" id="hud">${placeHUD()}</div>`;
  }
  const ch = state.characters[c.id];
  const r = E.findRegion(c.regionId);
  const stage = c.stages?.[ch.stage];
  return `
  <button class="btn ghost small back" data-go="world">→ العودة للعالم</button>
  <section class="hero card">
    <div class="hero-scene">${regionSVG(r, region ? E.regionFeatures(state, r.id) : new Set(), characterSVG(c, artLevel(ch), { size: 80 }))}</div>
    <div class="hero-info">
      <h2>${c.name} ${stage ? `<button class="lvl lvl-btn" data-ranks="${c.id}" title="اعرض الرتب">${esc(E.rankName(ch))} ▾</button>` : ''}</h2>
      <p class="muted">${c.desc}</p>
      <h3 class="sub">${r.name}</h3>
    </div>
  </section>
  <section class="card">
    <div class="row between"><h3>⏱ عاداتي</h3></div>
    <ul class="tasks">${E.activeTasks(c, ch).map((t) => taskRow(c.id, t)).join('')}</ul>
  </section>
  ${progressionPanel(c, ch)}`;
}

// Shop: every offer is a whole realm — a place together with the character who lives there.
function realmCard(r) {
  const st = E.shopStatus(state, 'region', r);
  const c = E.findCharacter(r.characterId);
  const ch = c && state.characters[c.id];
  const locked = !st.owned && !st.conditionsMet;
  const art = regionSVG(r, st.owned ? E.regionFeatures(state, r.id) : new Set(), c ? characterSVG(c, ch ? artLevel(ch) : 1, { size: 90, locked }) : '', { locked });
  const rarity = 'common';
  const n = ch ? E.activeTasks(c, ch).length : 0;
  const action = st.owned ? `<button class="store-btn owned" data-enter-realm="${r.id}">▶ ادخل · 🏗 ${n}/8</button>` : '<button class="store-btn" data-show-offer>📬 بتفتحه برسالة الأحد</button>';
  return `
  <article class="realm ${rarity} ${st.owned ? 'is-owned' : ''} ${locked ? 'is-locked' : ''}">
    <div class="realm-art">${art}${st.owned ? '<span class="realm-tag">✔ مفتوح</span>' : ''}</div>
    <div class="realm-body">
      <h3>${r.name}</h3>
      ${c ? `<div class="realm-with">+ ${c.name}</div>` : ''}
    </div>
    ${action}
  </article>`;
}

function renderShop() {
  const realms = REGIONS.filter((r) => r.characterId);
  return `
  <div class="store">
    <header class="store-head">
      <h2>🧭 الأبعاد</h2>
      <div class="store-sub">كل بعد = مكان + شخصيته + 8 مباني (عادات). بتفتحها برسالة الأحد 📬</div>
    </header>
    <div class="store-grid">${realms.map(realmCard).join('')}</div>
  </div>`;
}

// ---------- Headquarters ----------
let hqScene = null, lastCmdLevel = null;
function renderHQ() {
  return `
  <div class="place-view" id="hq-view"><div class="w3-loading">جارٍ الدخول إلى مقر القيادة…</div></div>
  <div class="hud" id="hud">${hqHUD()}</div>`;
}
async function bindHQ() {
  const v = $('#hq-view');
  if (!v) return;
  const cm = commander(state);
  try {
    const { mountHQ } = await import('./hq3d.js');
    if (!v.isConnected) return;
    v.querySelector('.w3-loading')?.remove();
    hqScene = mountHQ(v, { weather: currentWeather(), places: dimPlaces(), owned: CHARACTERS.filter((c) => state.characters[c.id] && (!c.stages || E.activeTasks(c, state.characters[c.id]).length)).map((c) => c.id), hq: E.findRegion('hq').map, rankIndex: cm.rankIndex, ...innerState(), story: { ...state.story, ship: E.shipStage(state) }, ranks: Object.fromEntries(CHARACTERS.filter((c) => state.characters[c.id] && c.stages).map((c) => [c.id, E.rankName(state.characters[c.id])])), tiers: Object.fromEntries(CHARACTERS.filter((c) => state.characters[c.id] && c.stages).map((c) => [c.id, E.totalLevel(state.characters[c.id]) - 1])),
      onStory: (phase) => { if (phase === 'march') act(E.finishSpeech(state)); else { act(E.storyStep(state, phase)); if (phase === 'back') FX.toast('🏝 شفت جزيرة القادة… السفينة بتوصلك لما تكمل'); } }, onRoom: (r) => { document.body.classList.toggle('in-dungeon', r === 'dungeon'); document.body.classList.toggle('in-heaven', r === 'heaven' || r === 'shore'); document.body.classList.toggle('in-gallery', r === 'gallery'); }, sky: skyInfo, onTable: showDimMap, onCommander: showCommandRanks });
    loadWeather();
  } catch (err) { console.warn('3D HQ unavailable', err); v.innerHTML = ''; }
}
// All commander ranks: each one comes with the habits built (across all dimensions).
function showCommandRanks() {
  const cm = commander(state);
  modal(`
    <h2>🎖 رتب القائد</h2>
    <p class="muted">القائد بيترقّى لحاله مع العادات اللي بتبنيها بكل الأبعاد. بنيت ${cm.habits} 🏗.</p>
    <ol class="path">${COMMAND_RANKS.map(([need, name], i) => {
      const cls = i < cm.rankIndex ? 'done' : i === cm.rankIndex ? 'current' : '';
      return `<li class="${cls}" style="--rank:#7a5a1f"><b class="rk">${name}</b><span>${need ? `🏗 ${need} عادة` : 'البداية'}</span></li>`;
    }).join('')}</ol>`);
}

// Celebrate when the commander's level went up since the last look.
function checkCommander() {
  const cm = commander(state);
  if (lastCmdLevel != null && cm.level > lastCmdLevel) FX.banner(`ترقية القائد — ${cm.rank}`, `بنيت ${cm.habits} عادة فترقّى القائد لحاله`, '🎖');
  lastCmdLevel = cm.level;
}
// The eight dimensions: closed, being built (habits of 8), or full.
const dimPlaces = () => REGIONS.filter((r) => r.characterId).map((r) => {
  const d = E.dimStatus(state, r);
  return { id: r.id, name: r.name, map: r.map, status: d.id, level: d.level, habits: d.habits, info: d };
});

// The map of dimensions (the table in headquarters).
function showDimMap() {
  if ($('#modal').hidden) SND.sfx.paper();
  const places = dimPlaces();
  const count = (id) => places.filter((p) => p.status === id).length;
  modal(`
    <div class="war-wrap">${warMapSVG(places, E.findRegion('hq').map)}</div>
    <div class="war-legend">${Object.entries(WAR).map(([id, w]) => `<span style="--c:${w.color}">${w.icon} ${w.name} <b>${count(id)}</b></span>`).join('')}</div>
    <p class="muted small-text">🏗 ${E.habitsBuilt(state)} من ${E.HABITS_ALL()} عادة · اضغط على أي بعد · <kbd>E</kbd> للخروج</p>`);
  $('#modal').classList.add('wide');
  modalRefresh = showDimMap;
  document.querySelectorAll('.war-map [data-war]').forEach((el) => (el.onclick = () => showFront(el.dataset.war)));
}

function showFront(id) {
  const r = E.findRegion(id), p = dimPlaces().find((x) => x.id === id), w = WAR[p.status];
  const c = E.findCharacter(r.characterId), ch = state.characters[c.id];
  const why = { coming: 'مسكّر — بتفتحه برسالة الأحد 📬.', building: `🏗 ${p.habits} من 8 عادات.`, full: '🏆 كل المباني الثمانية انبنت.' }[p.status];
  modal(`
    <div class="front" style="--c:${w.color}">
      <div class="front-badge">${w.icon}</div>
      <h2>${r.name}</h2>
      <div class="front-status">${w.name}</div>
      <p>${why}</p>
      ${ch ? dimLine(c.id) : ''}
      <div class="row wrap">
        <button class="btn ghost" id="back-map">← الخريطة</button>
        ${ch ? '<button class="btn primary" id="go-front">ادخل البعد</button>' : ''}
      </div>
    </div>`);
  $('#modal').classList.add('wide');
  $('#back-map').onclick = showDimMap;
  if ($('#go-front')) $('#go-front').onclick = () => enter(c.id);
}

let reportOpen = false;

// The two prisoners of the dungeon (0..1).
// Future self: grows with every habit built and every opened dimension.
// Inner child: grows with self-respect in action — won challenge cups (keeping your
// word to yourself) and the commander's rank.
function innerState() {
  const opened = dimPlaces().filter((p) => state.regions[p.id]).length;
  const cups = C.wonCups(state).length;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  return {
    future: clamp((E.habitsBuilt(state) - 1 + (opened - 1) * 2) / 60),
    child: clamp((cups * 8 + commander(state).rankIndex * 5) / 60),
  };
}
function hqHUD() {
  const cm = commander(state);
  const won = C.wonCups(state).length;
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:#ffc83d">🎖</div>
      <div class="plate-body">
        <div class="plate-name">القائد <span class="plate-place">· مقر القيادة</span></div>
        <div class="plate-row"><button class="rank" data-cmd-ranks style="--rank:#7a5a1f" title="اعرض كل الرتب">${cm.rank} ▾</button></div>
        <div class="meter" data-cmd-ranks><span class="meter-label">${cm.nextRank ? `🏗 نحو ${cm.nextRank}` : '🎖 أعلى رتبة'}</span><b><bdi>${cm.nextRank ? `${cm.habits}/${cm.nextAt}` : '✔'}</bdi></b><div class="xp"><span style="width:${Math.round(cm.rankProgress * 100)}%"></span></div></div>
      </div>
    </div>
  </div>
  <button class="hud-chip view-toggle" data-view-mode title="إخفاء اللوحات لمشاهدة القاعة">👁 مشاهدة</button>
  <aside class="cup-side">
    <button class="hud-chip warmap-btn" data-war-map>🗺 خريطة الأبعاد</button>
    <div class="challenge-card report ${reportOpen ? 'open' : ''}">
      <button class="report-title" data-toggle-report>📋 تقرير القائد <span>${reportOpen ? '▴' : '▾'}</span></button>
      <small class="muted-w">يترقّى لحاله مع كل العادات اللي بتبنيها.</small>
      <div class="report-row"><span>🗺 الأماكن المفتوحة</span><b>${cm.opened.length} / ${cm.places.length}</b></div>
      <ul class="report-list">${cm.places.map((r) => `<li class="${state.regions[r.id] ? 'on' : ''}">${state.regions[r.id] ? '✔' : '🔒'} ${r.name}</li>`).join('')}</ul>
      <div class="report-row"><span>🏗 العادات</span><b><bdi>${cm.habits}/${E.HABITS_ALL()}</bdi></b></div>
      <div class="report-row"><span>⬆ الشخصيات</span></div>
      <ul class="report-list">${cm.chars.map((c) => `<li class="on">${c.def.name} — ${E.rankName(c.ch)}</li>`).join('')}</ul>
      <div class="report-row"><span>🏆 كؤوس</span><b>${won}</b></div>
      <div class="report-row"><span>🚢 السفينة</span><b><bdi>${E.shipStage(state)}/${E.SHIP.parts}</bdi></b></div>
    </div>
  </aside>
  <div class="dock">
    <button class="dock-btn promote-btn" data-dim-ranks>🎖<span>رتب الأبعاد</span></button>
    <button class="dock-btn" data-war-map>🗺<span>خريطة الأبعاد</span></button>
    ${E.pendingOffer(state, dayFor()) ? '<button class="dock-btn" data-show-offer>📬<span>رسالة الأحد</span><i class="dot"></i></button>' : ''}
    <button class="dock-btn" data-go="trophies">🏆<span>الكؤوس</span></button>
    <button class="dock-btn" data-go="world">🗺<span>العالم</span></button>
  </div>`;
}

// ---------- Trophy island (challenge cups) ----------
let isle = null, cupChannel = null;
const usd = (n) => `$${(+n).toFixed(2).replace(/\.00$/, '')}`;
// Trophy icon whose shape grows with the cup's rank.
function cupIcon(cup, size = 44, dim = false) {
  const t = CUPS.findIndex((c) => c.id === cup.id), c = cup.color, g = cup.glow || '#ffe07a';
  const simple = t <= 1;
  return `
  <svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="${dim ? 'opacity:.35;filter:grayscale(1)' : `filter:drop-shadow(0 0 ${3 + t}px ${g}${t >= 5 ? 'cc' : '55'})`}">
    ${t === 12 ? `<path d="M22 24 C10 20 4 10 2 4 C10 10 14 12 20 14 M42 24 C54 20 60 10 62 4 C54 10 50 12 44 14" fill="none" stroke="#ffe3a0" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="4" r="3" fill="none" stroke="#ffe9a8" stroke-width="1.5"/>` : ''}
    ${t >= 11 ? `<ellipse cx="32" cy="24" rx="27" ry="7" fill="none" stroke="${g}" stroke-width="1.6" transform="rotate(-12 32 24)"/>` : ''}
    ${t === 7 ? `<path d="M14 38 Q6 24 14 12 M50 38 Q58 24 50 12" fill="none" stroke="#8fd6a0" stroke-width="3" stroke-dasharray="4 2"/>` : ''}
    ${simple
      ? `<path d="M19 12h26v12c0 9-5 14-13 14s-13-5-13-14z" fill="${c}" ${t === 0 ? 'stroke="#5d5a55" stroke-width="1.5"' : ''}/>${t === 1 ? `<path d="M19 18h26M20 25h24" stroke="#3a2a1a" stroke-width="1.5"/>` : ''}<rect x="27" y="38" width="10" height="8" fill="${c}"/>`
      : `<path d="M${20 - t * 0.4} 10h${24 + t * 0.8}v10c0 ${9 + t * 0.3}-6 ${15 + t * 0.2}-${12 + t * 0.4} ${15 + t * 0.2}S${20 - t * 0.4} ${29 + t * 0.3} ${20 - t * 0.4} 20z" fill="${c}"/>
         <path d="M${20 - t * 0.4} 13H11c0 8 4 12 10 12M${44 + t * 0.4} 13H53c0 8-4 12-10 12" fill="none" stroke="${t >= 5 ? '#ffd66b' : c}" stroke-width="3"/>
         <rect x="29" y="${35 + t * 0.2}" width="6" height="${8 - t * 0.2}" fill="${c}"/><circle cx="32" cy="${37 + t * 0.2}" r="3" fill="${t >= 5 ? '#ffd66b' : c}"/>`}
    <rect x="${simple ? 18 : 20 - Math.floor(t / 4) * 2}" y="46" width="${simple ? 28 : 24 + Math.floor(t / 4) * 4}" height="${6 + Math.floor(t / 4) * 2}" rx="2" fill="${t >= 9 ? '#1b1030' : '#3a2f28'}"/>
    ${t >= 5 ? `<rect x="22" y="48" width="20" height="2" fill="#ffd66b"/>` : ''}
    ${!simple ? `<path d="M${24 - t * 0.3} 13h3v10h-3z" fill="#fff" opacity=".4"/>` : ''}
    ${t >= 6 && t <= 7 ? `<path d="M32 1l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z" fill="#ffd66b"/>` : ''}
    ${t >= 8 ? `<path d="M32 0l5 5-5 5-5-5z" fill="${g}" stroke="#fff" stroke-width=".8"/>` : ''}
    ${t >= 10 ? `<path d="M20 10l3-6 3 6 3-7 3 7 3-7 3 7 3-6 3 6z" fill="#ffd66b"/>` : ''}
  </svg>`;
}

function cupList() {
  const ch = currentCupChannel();
  const now = Date.now();
  return CUPS.map((cup) => {
    const act = C.active(state).find((x) => x.cupId === cup.id && (!ch || x.channel === ch));
    const won = C.ownsCup(state, cup.id);
    const done = act ? Math.min(cup.days, C.daysDone(act, now)) : 0;
    return { ...cup, state: act ? 'active' : won ? 'won' : 'locked', progress: act ? done / cup.days : 0, done };
  });
}
function currentCupChannel() {
  const list = C.channels(state);
  if (!list.includes(cupChannel)) cupChannel = C.active(state)[0]?.channel || list[0] || null;
  return cupChannel;
}

function renderTrophies() {
  return `
  <div class="place-view" id="trophy-view"><div class="w3-loading">جارٍ الصعود إلى جزيرة الكؤوس…</div></div>
  <div class="hud" id="hud">${trophyHUD()}</div>`;
}

async function bindTrophies() {
  const v = $('#trophy-view');
  if (!v) return;
  try {
    const { mountTrophies } = await import('./trophies3d.js');
    if (!v.isConnected) return;
    v.querySelector('.w3-loading')?.remove();
    isle = mountTrophies(v, { cups: cupList(), sky: skyInfo, onPick: showCup });
  } catch (err) {
    console.warn('3D trophies unavailable', err);
    v.innerHTML = `<div class="cup-fallback">${CUPS.map((c) => `<button data-cup="${c.id}">${cupIcon(c, 56, !C.ownsCup(state, c.id))}<small>${c.name}</small></button>`).join('')}</div>`;
    bind();
  }
}

function trophyHUD() {
  const cups = C.ensure(state);
  const ch = currentCupChannel();
  const chans = C.channels(state);
  const act = C.active(state).find((x) => x.channel === ch);
  const won = C.wonCups(state).length;
  let card;
  if (act) {
    const cup = C.findCup(act.cupId), done = Math.min(cup.days, C.daysDone(act)), complete = C.isComplete(act);
    card = `
    <div class="challenge-card ${complete ? 'complete' : ''}">
      <div class="cc-top">${cupIcon(cup, 52)}<div><b>${cup.name}</b><small>📍 ${esc(C.regionName(act.channel))}</small></div></div>
      <div class="cc-days"><span>اليوم</span><b><bdi>${done}</bdi></b><span>من <bdi>${cup.days}</bdi></span></div>
      <div class="xp big"><span style="width:${Math.round((done / cup.days) * 100)}%"></span></div>
      <div class="cc-meta">💰 ${act.stakeJod} دينار (${usd(act.stakeUsd)}) · مؤمَّن عند <b>${esc(act.partner)}</b></div>
      ${complete ? '<div class="cc-note">✨ اكتملت المدة — بانتظار حكم الطرف الثاني</div>' : ''}
      <button class="store-btn buy" data-judge="${act.id}">⚖️ حكم الطرف الثاني</button>
    </div>`;
  } else if (!C.cupsOpen(state)) {
    const n = state.stats?.activeDays || 0;
    card = `
    <div class="challenge-card empty">
      <b>🔒 الكؤوس بتنفتح بعد ${C.CUP_DAYS} يوم</b>
      <small>تحدّي المصاري الحقيقية بس للي أثبت التزامه: ${C.CUP_DAYS} يوم فيهم نجمة على الأقل.</small>
      <div class="xp big"><span style="width:${Math.round((n / C.CUP_DAYS) * 100)}%"></span></div>
      <small><bdi>${n} / ${C.CUP_DAYS}</bdi></small>
    </div>`;
  } else {
    card = `
    <div class="challenge-card empty">
      <b>${ch ? `لا يوجد تحدٍّ في «${esc(C.regionName(ch))}»` : 'ابدأ أول تحدٍّ لك'}</b>
      <small>اختر كأسًا، أمّن مبلغه عند الطرف الثاني، والتزم بالمدة.</small>
      <button class="store-btn owned" data-cup-picker>🏆 ابدأ تحدّي</button>
    </div>`;
  }
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:#ffc83d">🏆</div>
      <div class="plate-body">
        <div class="plate-name">جزيرة الكؤوس</div>
        <div class="plate-row"><span class="plate-streak">🏆 ${won} / ${CUPS.length}</span></div>
      </div>
    </div>
    <button class="hud-chip wallet" data-wallet>💵 ${usd(cups.wallet)}</button>
  </div>
  <aside class="cup-side">
    ${chans.length ? `<div class="chan-tabs">${chans.map((c) => `<button class="chan ${c === ch ? 'on' : ''}" data-channel="${esc(c)}">${esc(C.regionName(c))}</button>`).join('')}</div>` : ''}
    ${card}
  </aside>
  <div class="dock">
    <button class="dock-btn" data-cup-picker>🏆<span>ابدأ تحدّي</span></button>
    <button class="dock-btn" data-cup-rules>📜<span>القوانين</span></button>
    <button class="dock-btn" data-cup-history>🗂<span>السجل</span></button>
  </div>`;
}

function showCup(cupId) {
  const cup = C.findCup(cupId);
  const act = C.active(state).find((x) => x.cupId === cupId);
  const wins = C.wonCups(state).filter((x) => x.cupId === cupId);
  isle?.focus(cupId);
  modal(`
    <div class="cup-hero">${cupIcon(cup, 96)}<h2>${cup.name}</h2><p class="muted">${cup.days} يوم · تأمين ${cup.days} دينار (${usd(C.stakeUsd(cup))})</p></div>
    ${wins.length ? `<p class="ok-text">🏆 فزت فيه ${wins.length} مرة (${wins.map((w) => esc(C.regionName(w.channel))).join('، ')})</p>` : ''}
    ${act ? `<p>⏳ شغّال في «${esc(C.regionName(act.channel))}» — اليوم ${Math.min(cup.days, C.daysDone(act))} من ${cup.days}</p><button class="store-btn buy" data-judge="${act.id}">⚖️ حكم الطرف الثاني</button>`
      : `<button class="store-btn owned" data-start-cup="${cup.id}">ابدأ تحدّي ${cup.name}</button>`}`);
  bind();
}

function showCupPicker() {
  const has = (id) => C.ownsCup(state, id);
  modal(`
    <h2>🏆 اختر الكأس</h2>
    <p class="muted">المبلغ بالدينار = عدد أيام الكأس، ويُخصم من رصيدك الحقيقي (💵 ${usd(state.cups.wallet)}).</p>
    <div class="cup-grid">${CUPS.map((c) => `
      <button class="cup-tile ${has(c.id) ? 'won' : ''}" data-start-cup="${c.id}" style="--c:${c.glow || c.color}">
        ${cupIcon(c, 54)}<b>${c.name}</b><span>${c.days} يوم</span><small>${c.days} دينار · ${usd(C.stakeUsd(c))}</small>${has(c.id) ? '<i>✔</i>' : ''}
      </button>`).join('')}</div>`);
  bind();
}

function startCupFlow(cupId) {
  const cup = C.findCup(cupId);
  const chans = C.channels(state);
  const canNew = C.canOpenChannel(state, '__new__').ok;
  const busy = new Set(C.active(state).map((x) => x.channel));
  const cost = C.stakeUsd(cup);
  let picked = 0;
  modal(`
    <div class="cup-hero">${cupIcon(cup, 72)}<h2>تحدّي ${cup.name}</h2><p class="muted">${cup.days} يوم · تأمين <b>${cup.days} دينار</b> (${usd(cost)})</p></div>
    <form id="cup-form" class="cup-form">
      <label>المكان (القناة)
        <div class="chips place-pick">${C.channelRegions().map((r) => {
          const owned = !!state.regions[r.id], ok = owned && C.canOpenChannel(state, r.id).ok && !busy.has(r.id);
          return `<label class="chip ${ok ? '' : 'off'}"><input type="radio" name="channel" value="${r.id}" ${ok ? '' : 'disabled'} ${ok && !picked++ ? 'checked' : ''}> ${esc(r.name)} ${!owned ? '🔒' : busy.has(r.id) ? '⏳' : !C.canOpenChannel(state, r.id).ok ? '🥈' : ''}</label>`;
        }).join('')}</div>
        ${!canNew && chans.length ? `<small class="muted">🥈 التحدي بمكان ثاني يحتاج ${C.findCup('silver').name}</small>` : ''}
      </label>
      <label>اسم الطرف الثاني (اللي بيأمّن المبلغ عنده)<input name="partner" required placeholder="مثال: أحمد"></label>
      <label>رمز الطرف الثاني — 4 أرقام يدخلها هو بنفسه<input name="pin" required inputmode="numeric" pattern="\\d{4}" maxlength="4" type="password" placeholder="••••"></label>
      <label class="check"><input type="checkbox" name="agree" required> أوافق: إذا خسرت يصير المبلغ للطرف الثاني، ولا يحق لي المطالبة بالمال بعد بدء التحدي تحت أي ظرف.</label>
      <button class="store-btn buy" type="submit" ${state.cups.wallet < cost ? 'disabled' : ''}>${state.cups.wallet < cost ? `الرصيد لا يكفي — أضف ${usd(cost - state.cups.wallet)}` : `ابدأ — أمّن ${usd(cost)}`}</button>
      ${state.cups.wallet < cost ? '<button type="button" class="btn ghost" data-wallet>💵 أضف رصيد</button>' : ''}
    </form>`);
  $('#cup-form').onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const r = C.startChallenge(state, { channel: f.channel.value, cupId, partner: f.partner.value, pin: f.pin.value });
    if (!r.ok) return FX.toast(r.reason, 'err');
    cupChannel = r.challenge.channel;
    scheduleSave(); closeModal(); render();
    SND.sfx.unlock(); FX.banner(`بدأ تحدّي ${cup.name}`, `${cup.days} يوم — المبلغ مؤمَّن عند ${r.challenge.partner}. بالتوفيق!`, '🏆');
  };
  bind();
}

function judgeFlow(id) {
  const ch = state.cups.challenges.find((x) => x.id === id);
  const cup = C.findCup(ch.cupId);
  const complete = C.isComplete(ch);
  modal(`
    <div class="cup-hero">${cupIcon(cup, 72)}<h2>⚖️ حكم الطرف الثاني</h2>
    <p class="muted">${esc(ch.partner)} فقط يقرّر الفوز أو الخسارة، برمزه السري.</p></div>
    <p>اليوم ${Math.min(cup.days, C.daysDone(ch))} من ${cup.days} · المبلغ ${ch.stakeJod} دينار (${usd(ch.stakeUsd)})</p>
    <form id="judge-form" class="cup-form">
      <label>رمز ${esc(ch.partner)}<input name="pin" required inputmode="numeric" maxlength="4" type="password" placeholder="••••"></label>
      <div class="row wrap">
        <button class="store-btn buy" name="win" value="1" ${complete ? '' : 'disabled'}>🏆 فاز${complete ? ' — يرجع المبلغ' : ` (بعد ${cup.days - C.daysDone(ch)} يوم)`}</button>
        <button class="store-btn lose" name="win" value="0">✘ خسر — المبلغ لـ ${esc(ch.partner)}</button>
      </div>
    </form>`);
  $('#judge-form').onsubmit = (e) => {
    e.preventDefault();
    const won = e.submitter?.value === '1';
    const r = C.judge(state, id, e.currentTarget.pin.value, won);
    if (!r.ok) return FX.toast(r.reason, 'err');
    scheduleSave(); closeModal(); render();
    if (won) { SND.sfx.fanfare(); FX.banner(`🏆 ${cup.name}`, `مبروك! رجع المبلغ لرصيدك.`, '🏆'); FX.confetti(); }
    else { SND.sfx.lose(); } if (!won) FX.toast(`خسارة ${cup.name} — المبلغ صار لـ ${ch.partner}`, 'err');
  };
}

function showWallet() {
  const w = C.ensure(state);
  modal(`
    <h2>💵 الرصيد الحقيقي</h2>
    <p class="muted">هذا يمثّل مصاريك الحقيقية بالدولار. تضيف وتنقص يدويًا، وتأمين الكؤوس يُخصم منه.</p>
    <div class="wallet-big">${usd(w.wallet)}</div>
    <form id="wallet-form" class="cup-form">
      <label>المبلغ بالدولار<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></label>
      <label>ملاحظة (اختياري)<input name="note" placeholder="مثال: مصروف الأسبوع"></label>
      <div class="row wrap"><button class="store-btn buy" name="dir" value="1">＋ إضافة</button><button class="store-btn lose" name="dir" value="-1">－ خصم</button></div>
    </form>
    ${w.walletLog.length ? `<h3>آخر الحركات</h3><ul class="wallet-log">${w.walletLog.slice(0, 12).map((l) => `<li><span>${esc(l.note || (l.delta > 0 ? 'إضافة' : 'خصم'))}</span><b class="${l.delta >= 0 ? 'plus' : 'minus'}">${l.delta ? (l.delta > 0 ? '+' : '−') + usd(Math.abs(l.delta)) : '—'}</b></li>`).join('')}</ul>` : ''}`);
  modalRefresh = showWallet;
  $('#wallet-form').onsubmit = (e) => {
    e.preventDefault();
    const f = e.currentTarget, dir = +e.submitter.value;
    const r = C.adjustWallet(state, dir * +f.amount.value, f.note.value.trim());
    if (!r.ok) return FX.toast(r.reason, 'err');
    scheduleSave(); render(); FX.toast(`${dir > 0 ? '+' : '−'}${usd(f.amount.value)}`);
  };
}

function showCupRules() {
  modal(`
    <h2>📜 قوانين التحدي</h2>
    <p class="muted">تحدٍّ بروح تنافسية عالية نحو حياة خالية من الإدمان والحفاظ على طاقة الشباب.</p>
    <ol class="rules">
      <li>يمكن بدء التحدي من طرف واحد.</li>
      <li>من يبدأ التحدي يؤمّن مبلغًا ماليًا عند الطرف الثاني.</li>
      <li>يختار المتحدي أحد الكؤوس، ويجب أن يجتاز مدته كاملة ليسترجع المبلغ المؤتمن.</li>
      <li>إذا خسر المتحدي يصبح المبلغ كاملًا ملكًا للطرف الثاني، ولا يحق له المطالبة به.</li>
      <li>الطرف الثاني هو من يحدد الفوز أو الخسارة (برمزه السري).</li>
      <li>يُمنع منعًا باتًا بعد بدء التحدي المطالبة بالأموال تحت أي ظرف.</li>
      <li>القنوات هي الأماكن. للتحدي في مكان ثانٍ يجب امتلاك ${C.findCup('silver').name}؛ بناء العادات بالتدريج. ويمكن اختيار المكان الذي تبدأ منه.</li>
      <li>الفوز بكأس يعطي مفاتيح 🗝 (مفتاح لكل 15 يومًا) — نفس المفاتيح التي تفتح الأماكن وترفع مستوى الشخصيات.</li>
      <li>مبلغ التأمين بالدينار = عدد أيام الكأس (الحجري 5 أيام = 5 دنانير).</li>
    </ol>
    <div class="cup-grid small">${CUPS.map((c) => `<div class="cup-tile" style="--c:${c.glow || c.color}">${cupIcon(c, 36)}<b>${c.name}</b><span>${c.days} يوم</span></div>`).join('')}</div>`);
}

function showCupHistory() {
  const list = [...C.ensure(state).challenges].reverse();
  const label = { active: '⏳ شغّال', won: '🏆 فاز', lost: '✘ خسر' };
  modal(`
    <h2>🗂 سجل التحديات</h2>
    ${list.length ? `<ul class="wallet-log">${list.map((x) => `<li><span>${cupIcon(C.findCup(x.cupId), 26)} ${C.findCup(x.cupId).name} · ${esc(C.regionName(x.channel))} · ${esc(x.partner)}</span><b class="${x.status === 'won' ? 'plus' : x.status === 'lost' ? 'minus' : ''}">${label[x.status]}</b></li>`).join('')}</ul>` : '<p class="muted">لا يوجد تحديات بعد.</p>'}`);
}

// ---------- Events ----------
function enter(id) {
  if (id === 'shop') return go('shop');
  currentChar = id;
  go('character');
  const c = E.findCharacter(id), ch = state.characters[id];
  if (c?.stages && ch && !E.activeTasks(c, ch).length) setTimeout(() => pickHabit(id, { mode: 'first' }), 400);
}

document.addEventListener('click', (e) => { if (e.target.closest('button, [data-spot], [data-war]')) SND.sfx.click(); }, true);

function bind() {
  const on = (attr, fn) => document.querySelectorAll(`[${attr}]`).forEach((el) => (el.onclick = () => fn(el.getAttribute(attr), el)));
  const habit = (attr, fn) => on(attr, (v, el) => { const [c, t] = v.split(':'); fn(c, t, el); });
  habit('data-habit-pause', (c, t, el) => act(E.pauseHabit(state, c, t), el));
  habit('data-habit-run', (c, t, el) => { const r = act(E.resumeHabit(state, c, t), el); if (r.ok && oasis?.char === c) oasis.scene.pray(); });
  habit('data-habit-reset', (c, t) => { const d = E.activeTasks(E.findCharacter(c), state.characters[c]).find((x) => x.id === t); ask(`تصفّر عدّاد "${d.title}"؟ بيرجع لصفر.`, () => { act(E.resetHabit(state, c, t)); oasis?.scene.react?.('fail'); }); });
  on('data-open-upgrades', showUpgrades);
  on('data-dim-ranks', showDimRanks);
  on('data-open-atmo', showAtmosphere);
  on('data-cup-picker', showCupPicker);
  on('data-war-map', showDimMap);
  on('data-show-offer', showOffer);
  on('data-toggle-report', () => { reportOpen = !reportOpen; render(); });
  on('data-view-mode', () => document.body.classList.toggle('view-mode'));
  on('data-cup-rules', showCupRules);
  on('data-cup-history', showCupHistory);
  on('data-cup', showCup);
  on('data-start-cup', startCupFlow);
  on('data-judge', judgeFlow);
  on('data-wallet', showWallet);
  on('data-channel', (c) => { cupChannel = c; render(); });
  on('data-set-weather', (k) => { weatherOverride = k; oasis?.scene.setWeather(currentWeather()); disposeWorld?.setWeather?.(currentWeather()); hqScene?.setWeather?.(currentWeather()); render(); });
  on('data-set-time', (k) => { timeOverride = k; oasis?.scene.refreshSky(); disposeWorld?.refreshSky?.(); hqScene?.refreshSky?.(); render(); });
  on('data-dim-reset', (id) => ask(`ترجّع ${E.findCharacter(id).name} من الصفر؟ كل مبانيه بتنشال (بوضع التجربة بس). بعدها "مرّ أسبوع" وابنِ من جديد.`, () => { const r = act(E.resetDimension(state, id)); if (r.ok) FX.toast('البعد رجع من الصفر'); }));
  on('data-toggle-quests', () => { questsCollapsed = !questsCollapsed; $('#quests')?.classList.toggle('collapsed', questsCollapsed); });
  on('data-pick-location', pickLocation);
  on('data-cmd-ranks', showCommandRanks);
  on('data-enter-realm', (id) => enter(E.findRegion(id).characterId));
  on('data-go', go);
  on('data-spot', openSpot);
  on('data-ranks', showRanks);
  on('data-edit-task', (v) => { const [c, t] = v.split(':'); pickHabit(c, { mode: 'edit', taskId: t }); });
  on('data-set-tasks', (v) => pickHabit(v.split(':')[0], { mode: 'first' }));
}

function go(s) { if (s !== screen) SND.sfx.whoosh(); screen = s; closeModal(); render(); window.scrollTo(0, 0); }

document.querySelectorAll('.nav-btn[data-screen]').forEach((b) => (b.onclick = () => go(b.dataset.screen)));
$('#nav-week').onclick = weekPass;
$('#modal-close').onclick = closeModal;
$('#settings').onclick = showSettings;
// E closes the war map (the same key that opened it at the table).
window.addEventListener('keydown', (e) => {
  if ((e.key.toLowerCase() === 'e' || e.key === 'ث') && !$('#modal').hidden && $('.war-wrap, .front')) { e.preventDefault(); e.stopImmediatePropagation(); closeModal(); }
}, true);
$('#modal').onclick = (e) => { if (e.target.id === 'modal' && e.currentTarget.dataset.closable === 'true') closeModal(); };
$('#account').onclick = () => {
  modal(`
    <h2>الحساب</h2>
    <p>${storage.mode === 'cloud' ? 'تقدّمك محفوظ في السحابة ومرتبط بحسابك في Claude.' : `الحساب المحلي: <b>${esc(storage.accountName)}</b>`}</p>
    <div class="row wrap">
      <button class="btn" data-pick-location>📍 مدينتك: ${state.location ? esc(state.location.name) : 'غير محددة'}</button>
      ${storage.mode === 'local' ? '<button class="btn" id="logout">تبديل الحساب</button>' : ''}
      <button class="btn bad" id="reset">🔄 إعادة اللعبة من البداية</button>
    </div>`);
  $('#modal-body [data-pick-location]').onclick = pickLocation;
  const lo = $('#logout');
  if (lo) lo.onclick = () => { storage.logout(); location.reload(); };
  $('#reset').onclick = () => ask('سيُحذف كل التقدّم. متأكد؟', async () => {
    state = E.demoState(); C.ensure(state); syncClock(); await storage.save(state); currentChar = null; go('world'); FX.toast('بدأت من جديد');
  });
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').dataset.closable === 'true') closeModal(); });

watchNoEmoji();
boot();

// The top bar: the habits built (the dimensions' ranks) and the Sunday message.
document.getElementById('habits-box')?.addEventListener('click', () => { if (state) showDimRanks(); });
document.getElementById('offer-box')?.addEventListener('click', () => { if (state) showOffer(); });
