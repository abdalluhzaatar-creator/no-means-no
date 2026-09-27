// UI layer: renders screens from state, calls engine actions, saves, plays effects.
import { CHARACTERS, REGIONS } from './content.js';
import * as E from './engine.js';
import { createStorage } from './storage.js';
import { characterSVG, regionSVG, worldMapSVG } from './scenes.js';
import * as FX from './effects.js';
import { CITIES, METHODS, prayerDay, windowState, fmtTime } from './prayer.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const goldTxt = (n) => `<span class="gold-inline">🪙 ${n}</span>`;

let storage, state, screen = 'world';

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
  if (!result.ok) { FX.toast(result.reason, 'err'); return result; }
  FX.playEvents(result.events, originEl);
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
  if (!raw) scheduleSave();
  $('#account').textContent = storage.accountName ? `👤 ${storage.accountName}` : '👤 حسابك';
  $('#app').hidden = false;
  autoMissPrayers();
  render();
  if (!state.location) setTimeout(pickLocation, 300);
  // Keep following the clock: record missed prayers and refresh the windows.
  setInterval(() => { autoMissPrayers(); if ($('#modal').hidden) render(); }, 30000);
  if (!raw) setTimeout(() => FX.banner('أهلًا بك', 'ادخل إلى المُصلّي من العالم وسجّل صلواتك اليوم.'), 400);
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
function modal(html, { closable = true } = {}) {
  const m = $('#modal');
  $('#modal-body').innerHTML = html;
  m.hidden = false;
  m.dataset.closable = closable;
  $('#modal-close').hidden = !closable;
}
let modalRefresh = null;
function closeModal() { $('#modal').hidden = true; modalRefresh = null; }
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

function render() {
  $('#gold').textContent = state.gold;
  $('#keys').textContent = state.keys;
  const navScreen = screen === 'character' ? 'world' : screen;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.screen === navScreen));
  document.body.classList.toggle('in-scene', screen === 'character' && sceneFor(currentChar));
  document.body.classList.toggle('in-world', screen === 'world');
  // A live 3D place only refreshes its overlay, so animations and camera survive.
  if (screen === 'character' && oasis && oasis.char === currentChar && $('#place-view')) {
    $('#hud').innerHTML = placeHUD();
    oasis.scene.update(placeState());
    bind(); refreshModal();
    return;
  }
  if (screen === 'world' && disposeWorld && worldKey === worldSignature() && $('#world-view')) { bind(); return; }
  oasis?.scene.dispose(); oasis = null;
  const view = { world: renderWorld, character: renderCharacter, shop: renderShop }[screen];
  $('#screen').innerHTML = view();
  bind();
  bindWorld();
  bindPlace();
  refreshModal();
}

// ---------- Prayer times ----------
// Worshipper tasks follow the "prayer day" (Fajr to next Fajr) when a location is set.
const prayerNow = () => (state.location ? prayerDay(new Date(), state.location) : null);
const dayFor = (charId) => (charId === 'worshipper' && state.location ? prayerNow().day : E.today());

// A prayer whose time ended without being reported is recorded as missed (no gold
// penalty) — which resets the key and level counters.
function autoMissPrayers() {
  const ch = state.characters.worshipper;
  if (!ch || !state.location) return;
  const pd = prayerNow();
  const now = new Date();
  const missed = [];
  // First, cancel prayers recorded before their time began (e.g. from older versions).
  const revoked = [];
  for (const t of E.activeTasks(E.findCharacter('worshipper'), ch)) {
    if (!t.prayer) continue;
    const w = pd.windows[t.prayer];
    const p = E.taskProgress(state, 'worshipper', t.id);
    if (p.lastDate !== pd.day || p.lastResult !== 'success') continue;
    const ws = windowState(w, now);
    // Old records have no timestamp: trust them only once the prayer's time is over.
    const early = ws === 'upcoming' || (p.at ? p.at < +w.start : ws !== 'over');
    if (early && E.revokeTask(state, 'worshipper', t.id, pd.day)) revoked.push(t.title);
  }
  if (revoked.length) {
    scheduleSave();
    FX.banner('أُلغيت صلوات سُجّلت قبل وقتها', revoked.join('، '), '↩');
  }
  for (const t of E.activeTasks(E.findCharacter('worshipper'), ch)) {
    if (!t.prayer || windowState(pd.windows[t.prayer], now) !== 'over') continue;
    if (+pd.windows[t.prayer].end < (state.location.since || 0)) continue;
    if (E.taskDoneToday(E.taskProgress(state, 'worshipper', t.id), pd.day)) continue;
    E.reportTask(state, 'worshipper', t.id, false, { applyPenalty: false, date: pd.day });
    missed.push(t.title);
  }
  if (missed.length) {
    scheduleSave();
    FX.banner('فات وقت الصلاة', `${missed.join('، ')} — بدأ العدّ من جديد`, '⏳');
  }
}

function pickLocation() {
  const cur = state.location;
  modal(`
    <h2>أوقات الصلاة</h2>
    <p class="muted">اختر مدينتك لتعرف اللعبة أوقات الصلاة. كل صلاة تُسجَّل فقط في وقتها، وإذا انتهى وقتها قبل أن تسجّلها تُحسب فائتة.</p>
    <div class="chips">${CITIES.map((c, i) => `<button class="chip ${cur?.name === c.name ? 'on' : ''}" data-city="${i}">${c.name}</button>`).join('')}</div>
    <p><button class="btn ghost small" id="geo">📍 استخدم موقعي الحالي</button></p>
    <label class="form">طريقة الحساب
      <select id="method">${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${cur?.method === k ? 'selected' : ''}>${m.name}</option>`).join('')}</select>
    </label>`);
  // `since`: prayers that ended before the player set up times are not counted as missed.
  const save = (loc) => { state.location = { since: state.location?.since ?? Date.now(), ...loc }; scheduleSave(); closeModal(); autoMissPrayers(); oasis?.scene.refreshSky(); loadWeather(true); render(); FX.toast(`📍 ${loc.name}`); };
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

function taskRow(charId, t) {
  const date = dayFor(charId);
  const p = E.taskProgress(state, charId, t.id);
  const doneToday = E.taskDoneToday(p, date);
  const pd = t.prayer && charId === 'worshipper' ? prayerNow() : null;
  const w = pd?.windows[t.prayer];
  const ws = w ? windowState(w, new Date()) : null;
  const timeInfo = w ? `<small class="ptime ${ws}">🕰 ${fmtTime(w.start)} – ${fmtTime(w.end)}</small>` : '';
  let actions;
  if (doneToday) actions = `<span class="result">${p.lastResult === 'success' ? '✔ صلّيتها' : '✘ فاتت'}</span>`;
  else if (t.prayer && !state.location) actions = '<button class="btn small" data-pick-location>اختر مدينتك</button>';
  else if (ws === 'upcoming') actions = `<span class="result">لم يدخل وقتها بعد</span>`;
  else if (ws === 'over') actions = '<span class="result">انتهى وقتها</span>';
  else actions = `<button class="btn ok" data-task-ok="${charId}:${t.id}">أنجزت</button>
           <button class="btn bad" data-task-fail="${charId}:${t.id}">لم أنجز</button>`;
  return `
  <li class="task ${doneToday ? 'is-' + p.lastResult : ''} ${ws === 'open' && !doneToday ? 'is-open' : ''}">
    <div class="task-main">
      <strong>${esc(t.title)}</strong>
      ${timeInfo}
      <small class="muted"><bdi>+${t.reward}</bdi> / <bdi>−${t.penalty}</bdi> · 🔥 ${E.currentStreak(p, date)}</small>
    </div>
    <div class="task-actions">${actions}</div>
  </li>`;
}

// World: a big fogged map. Owned places are clear; the next place shows its price.
function renderWorld() {
  const spots = REGIONS.filter((r) => r.map).map((def) => {
    const vis = E.mapVisibility(state, def);
    let scene = '';
    if (vis === 'owned') {
      const c = E.findCharacter(def.characterId);
      const ch = state.characters[c.id];
      scene = regionSVG(def, E.regionFeatures(state, def.id), ch ? characterSVG(c, artLevel(ch), { size: 80 }) : '');
    }
    return { def, vis, scene };
  });
  worldSpots = spots;
  return `
  <div class="world-view" id="world-view"><div class="w3-loading">جارٍ تحميل العالم…</div></div>
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
    disposeWorld = mountWorld(v, worldSpots, openSpot);
  } catch (err) {
    console.warn('3D world unavailable', err);
    v.classList.add('flat');
    v.innerHTML = worldMapSVG(worldSpots);
    v.querySelectorAll('[data-spot]').forEach((el) => (el.onclick = () => openSpot(el.dataset.spot)));
  }
}

function openSpot(id) {
  const def = E.findRegion(id);
  if (state.regions[id]) return enter(def.characterId);
  const st = E.shopStatus(state, 'region', def);
  const c = E.findCharacter(def.characterId);
  modal(`
    <div class="region-full">${regionSVG(def, new Set(), '', { locked: true })}</div>
    <h2>${def.name}</h2>
    <p class="muted">${def.desc}</p>
    <p>لفتح هذا المكان تحتاج <b>${E.costText(def.cost)}</b>${c ? ` — وستنضم إليك شخصية <b>${c.name}</b>.` : '.'}</p>
    ${st.conditions.length ? `<ul class="conds">${st.conditions.map((x) => `<li class="${x.met ? 'met' : ''}">${x.met ? '✔' : '○'} ${esc(x.label)} <small>(${x.current}/${x.target})</small></li>`).join('')}</ul>` : ''}
    <button class="btn primary" id="open-place" ${st.canBuy ? '' : 'disabled'}>
      ${st.canBuy ? `افتح المكان — ${E.costText(def.cost)}` : !st.conditionsMet ? 'الشروط غير مكتملة' : def.cost?.keys ? 'تحتاج مفتاحًا — صلِّ 15 يومًا متتاليًا دون أن يفوتك فرض' : 'ذهب غير كافٍ'}</button>`);
  $('#open-place').onclick = (e) => { const r = act(E.buy(state, 'region', id), e.currentTarget); if (r.ok) closeModal(); };
}

// Visual growth of the character art follows overall progress (stage × 5 + level).
const artLevel = (ch) => Math.min(10, ch.stage * 5 + ch.level);
const bar = (cur, max, label) => `
  <div class="prog"><div class="row between"><small>${label}</small><small><bdi>${cur} / ${max}</bdi></small></div>
  <div class="bar"><span style="width:${Math.round((cur / max) * 100)}%"></span></div></div>`;

// Level path of the current stage + progress toward the next key and level.
function progressionPanel(c, ch) {
  if (!c.stages) return '';
  const stage = c.stages[ch.stage];
  const live = E.liveProgress(ch, dayFor(c.id));
  const next = E.nextLevel(c, ch);
  const levels = stage.levels;
  let action;
  if (next.max) action = '<span class="muted">أعلى رتبة ✨</span>';
  else if (next.undesigned) action = `<p class="muted">مستويات ${esc(stage.name)} ستُضاف قريبًا.</p>`;
  else {
    const ready = ch.levelReady && state.keys >= 1;
    const why = !ch.levelReady ? `أكمل ${c.daysPerLevel} يومًا كاملًا متتاليًا` : state.keys < 1 ? 'تحتاج مفتاحًا 🗝' : '';
    action = `<button class="btn primary" data-level="${c.id}" ${ready ? '' : 'disabled'}>
      ${next.promotion ? `ارتقِ إلى ${esc(next.promotion)}` : `ارفع إلى المستوى ${next.level}`} — 🗝 1</button>
      ${why ? `<small class="muted why">${why}</small>` : ''}`;
  }
  return `
  <section class="card">
    <div class="row between"><h3>طريق ${c.name}</h3><button class="rank" data-ranks="${c.id}" title="اعرض ترتيب الرتب" style="--rank:${stage.color || 'var(--primary)'}">${esc(stage.name)} · مستوى ${ch.level} ▾</button></div>
    ${levels ? `<ol class="path">${levels.map((lv, i) => {
      const n = i + 1;
      const cls = n < ch.level ? 'done' : n === ch.level ? 'current' : '';
      const what = n === 1 && ch.stage === 0 ? 'الصلوات الخمس في وقتها' : lv.adds.map((a) => a.title).join(' + ') || '—';
      return `<li class="${cls}"><b>${n}</b><span>${esc(what)}</span></li>`;
    }).join('')}</ol>` : ''}
    ${ch.stage === 0 ? '<p class="muted small-text">بعد المستوى 5 ترتقي إلى <b>برونز 1</b>، ثم فضّي ← ذهبي ← بلاتينيوم (كل رتبة من 1 إلى 3).</p>' : ''}
    ${bar(ch.levelReady ? c.daysPerLevel : live.levelDays, c.daysPerLevel, ch.levelReady ? 'المستوى جاهز للرفع ✔' : 'أيام كاملة متتالية لهذا المستوى')}
    ${c.keyEveryDays ? bar(live.keyDays, c.keyEveryDays, 'أيام كاملة متتالية نحو المفتاح التالي 🗝') : ''}
    <p class="muted small-text">اليوم الكامل = إنجاز كل مهام اليوم. أي فرض فائت يُصفّر العدّاد.</p>
    <div class="row wrap">${action}</div>
  </section>`;
}

// The full rank ladder, with the character's current place highlighted.
function showRanks(id) {
  const c = E.findCharacter(id);
  const ch = state.characters[id];
  modal(`
    <h2>ترتيب الرتب</h2>
    <p class="muted">كل رتبة فيها 5 مستويات. تكمل المستوى 5 فترتقي للرتبة التالية.</p>
    <ol class="ladder">${c.stages.map((st, i) => {
      const cls = i < ch.stage ? 'done' : i === ch.stage ? 'current' : '';
      return `<li class="${cls}" style="--rank:${st.color || 'var(--primary)'}">
        <b>${i + 1}</b><span>${esc(st.name)}</span>
        <small>${i < ch.stage ? '✔ تجاوزتها' : i === ch.stage ? `أنت هنا · مستوى ${ch.level}` : st.levels ? '' : 'قريبًا'}</small></li>`;
    }).join('')}</ol>`);
}

// Inside a character: a 3D place with the character, and a game HUD over it.
// Places without a 3D scene yet use the classic layout.
const sceneFor = (charId) => charId === 'worshipper';
let oasis = null;
let questsCollapsed = matchMedia('(max-width: 720px)').matches;
const placeState = () => {
  const c = E.findCharacter(currentChar), ch = state.characters[c.id];
  return { features: E.regionFeatures(state, c.regionId), level: artLevel(ch) };
};

async function bindPlace() {
  const v = $('#place-view');
  if (!v) return;
  const c = E.findCharacter(currentChar);
  try {
    const { mountOasis } = await import('./oasis3d.js');
    if (!v.isConnected) return;
    v.querySelector('.w3-loading')?.remove();
    const scene = mountOasis(v, { palette: c.palette, ...placeState(), sky: skyInfo, weather: currentWeather(),
      onCharacter: () => FX.toast(`${c.name}: ${randomLine()}`) });
    oasis = { char: c.id, scene };
    loadWeather();
  } catch (err) {
    console.warn('3D place unavailable', err);
    v.innerHTML = `<div class="hero-scene">${regionSVG(E.findRegion(c.regionId), E.regionFeatures(state, c.regionId), characterSVG(c, artLevel(state.characters[c.id]), { size: 80 }))}</div>`;
  }
}
const LINES = ['الحمد لله', 'حيّ على الصلاة', 'اللهم أعنّي على ذكرك وشكرك', 'سبحان الله وبحمده', 'الصلاة نور'];
const randomLine = () => LINES[Math.floor(Math.random() * LINES.length)];

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
  const period = h < fajr ? 'night' : h < sunrise ? 'fajr' : h < dhuhr ? 'morning' : h < asr ? 'dhuhr' : h < maghrib ? 'asr' : h < isha ? 'maghrib' : 'night';
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

const PRAYER_NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
function prayerNowLine() {
  const pd = prayerNow();
  if (!pd) return '';
  const now = new Date();
  const open = Object.entries(pd.windows).find(([, w]) => windowState(w, now) === 'open');
  if (open) return `<div class="hud-chip now">🕌 وقت ${PRAYER_NAMES[open[0]]} الآن · حتى ${fmtTime(open[1].end)}</div>`;
  const next = Object.entries(pd.windows).find(([, w]) => windowState(w, now) === 'upcoming');
  return next ? `<div class="hud-chip">⏳ ${PRAYER_NAMES[next[0]]} ${fmtTime(next[1].start)}</div>` : '';
}

function placeHUD() {
  const c = E.findCharacter(currentChar);
  const ch = state.characters[c.id];
  const r = E.findRegion(c.regionId);
  const stage = c.stages?.[ch.stage];
  const tasks = E.activeTasks(c, ch);
  const date = dayFor(c.id);
  const done = tasks.filter((t) => E.taskDoneToday(E.taskProgress(state, c.id, t.id), date)).length;
  const live = c.stages ? E.liveProgress(ch, date) : null;
  const best = Math.max(0, ...tasks.map((t) => E.currentStreak(E.taskProgress(state, c.id, t.id), date)));
  const next = E.nextRegionUpgrade(state, r.id);
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:${c.palette.glow}">☪</div>
      <div class="plate-body">
        <div class="plate-name">${c.name} <span class="plate-place">· ${r.name}</span></div>
        <div class="plate-row">
          ${stage ? `<button class="rank" data-ranks="${c.id}" style="--rank:${stage.color || 'var(--primary)'}">${esc(stage.name)} · ${ch.level}</button>` : ''}
          <span class="plate-streak" title="أطول سلسلة">🔥 ${best}</span>
        </div>
        ${live ? `<div class="xp" title="أيام كاملة متتالية للمستوى"><span style="width:${Math.round(((ch.levelReady ? c.daysPerLevel : live.levelDays) / c.daysPerLevel) * 100)}%"></span></div>` : ''}
      </div>
    </div>
    ${prayerNowLine()}
    <button class="hud-chip atmo" data-open-atmo>${WEATHER_NAMES[currentWeather()].split(' ')[0]} ${PERIODS[skyInfo().period]}${liveWeather?.temp != null && weatherOverride === 'auto' ? ` · ${liveWeather.temp}°` : ''}</button>
  </div>

  <aside class="quests ${questsCollapsed ? 'collapsed' : ''}" id="quests">
    <button class="quests-head" data-toggle-quests>
      <span>📜 مهام اليوم</span><b>${done} / ${tasks.length}</b>
    </button>
    <ul class="tasks">${tasks.map((t) => taskRow(c.id, t)).join('')}</ul>
  </aside>

  <div class="dock">
    <button class="dock-btn" data-open-upgrades>🛠<span>طوّر ${r.name}</span>${next && state.gold >= next.cost ? '<i class="dot"></i>' : ''}</button>
    ${c.stages ? `<button class="dock-btn" data-open-path>🧭<span>طريق ${c.name}</span>${ch.levelReady && state.keys >= 1 ? '<i class="dot"></i>' : ''}</button>` : ''}
    ${c.id === 'worshipper' ? `<button class="dock-btn" data-pick-location>📍<span>${state.location ? esc(state.location.name) : 'مدينتك'}</span></button>` : ''}
  </div>`;
}

function showUpgrades() {
  const c = E.findCharacter(currentChar);
  const r = E.findRegion(c.regionId);
  const region = state.regions[r.id];
  const next = E.nextRegionUpgrade(state, r.id);
  modal(`
    <h2>🛠 طوّر ${r.name} <span class="lvl">مستوى ${region.level}</span></h2>
    <p class="muted">كل تطوير يظهر في المكان نفسه.</p>
    <div class="upgrade-list">
      ${r.upgrades.map((u) => `<div class="upg ${u.level <= region.level ? 'have' : ''}">${u.level <= region.level ? '✔' : '○'} ${u.label} <small>${goldTxt(u.cost)}</small></div>`).join('')}
    </div>
    ${next ? `<button class="btn primary" data-upgrade="${r.id}" ${state.gold < next.cost ? 'disabled' : ''}>طوّر: ${next.label} — ${goldTxt(next.cost)}</button>` : '<span class="muted">المكان مكتمل ✨</span>'}`);
  modalRefresh = showUpgrades;
  bind();
}

function showPath() {
  const c = E.findCharacter(currentChar);
  modal(progressionPanel(c, state.characters[c.id]).replace('<section class="card">', '<section>'));
  modalRefresh = showPath;
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
  const region = state.regions[r.id];
  const next = region ? E.nextRegionUpgrade(state, r.id) : null;
  const stage = c.stages?.[ch.stage];
  return `
  <button class="btn ghost small back" data-go="world">→ العودة للعالم</button>
  <section class="hero card">
    <div class="hero-scene">${regionSVG(r, region ? E.regionFeatures(state, r.id) : new Set(), characterSVG(c, artLevel(ch), { size: 80 }))}</div>
    <div class="hero-info">
      <h2>${c.name} ${stage ? `<button class="lvl lvl-btn" data-ranks="${c.id}" title="اعرض ترتيب الرتب">${esc(stage.name)} · ${ch.level} ▾</button>` : ''}</h2>
      <p class="muted">${c.desc}</p>
      <h3 class="sub">${r.name} ${region ? `<span class="lvl">مستوى ${region.level}</span>` : ''}</h3>
      ${region ? `
        <div class="upgrade-list">
          ${r.upgrades.map((u) => `<div class="upg ${u.level <= region.level ? 'have' : ''}">${u.level <= region.level ? '✔' : '○'} ${u.label} <small>${goldTxt(u.cost)}</small></div>`).join('')}
        </div>
        ${next ? `<button class="btn" data-upgrade="${r.id}" ${state.gold < next.cost ? 'disabled' : ''}>طوّر: ${next.label} — ${goldTxt(next.cost)}</button>` : '<span class="muted">المنطقة مكتملة ✨</span>'}`
        : ''}
    </div>
  </section>
  <section class="card">
    <div class="row between"><h3>مهام اليوم</h3>${c.id === 'worshipper' ? `<button class="chip" data-pick-location>📍 ${state.location ? esc(state.location.name) + ' · تغيير' : 'اختر مدينتك'}</button>` : ''}</div>
    <ul class="tasks">${E.activeTasks(c, ch).map((t) => taskRow(c.id, t)).join('')}</ul>
  </section>
  ${progressionPanel(c, ch)}`;
}

function shopCard(kind, item) {
  const st = E.shopStatus(state, kind, item);
  const art = kind === 'character'
    ? characterSVG(item, state.characters[item.id] ? artLevel(state.characters[item.id]) : 1, { size: 90, locked: !st.owned && !st.conditionsMet })
    : regionSVG(item, new Set(), '', { locked: !st.owned && !st.conditionsMet });
  return `
  <div class="card shop-item ${st.owned ? 'owned' : ''}">
    <div class="shop-art ${kind}">${art}</div>
    <div class="shop-info">
      <h3>${item.name} <small class="muted">${kind === 'character' ? 'شخصية' : 'منطقة'}</small></h3>
      <p class="muted">${item.desc}</p>
      ${st.conditions.length ? `<ul class="conds">${st.conditions.map((c) => `
        <li class="${c.met ? 'met' : ''}">${c.met ? '✔' : '○'} ${esc(c.label)} <small>(${c.current}/${c.target})</small></li>`).join('')}</ul>` : ''}
      ${st.owned ? '<span class="badge">✔ مملوك</span>'
        : `<button class="btn primary" data-buy="${kind}:${item.id}" ${st.canBuy ? '' : 'disabled'}>
             ${st.conditionsMet ? (st.affordable ? 'شراء' : 'غير كافٍ') : 'مقفل'} — ${E.costText(item.cost)}</button>`}
    </div>
  </div>`;
}

function renderShop() {
  return `
  <h2 class="screen-title">المتجر</h2>
  <p class="muted">الأماكن تُفتح بالمفاتيح 🗝، وتطوير المناطق بالذهب 🪙.</p>
  <h3>الشخصيات</h3>
  <div class="grid">${CHARACTERS.map((c) => shopCard('character', c)).join('')}</div>
  <h3>المناطق</h3>
  <div class="grid">${REGIONS.map((r) => shopCard('region', r)).join('')}</div>`;
}

// Failure: the player chooses whether to apply the penalty on themselves.
function failDialog(title, penalty, onChoose) {
  modal(`
    <h2>لا بأس، البداية من جديد</h2>
    <p><b>${esc(title)}</b></p>
    <p class="muted">الصدق مع نفسك هو أول خطوة. هل تطبّق العقوبة على نفسك؟</p>
    <div class="row wrap">
      <button class="btn bad" id="pen-yes">طبّق العقوبة (−${penalty} 🪙)</button>
      <button class="btn ghost" id="pen-no">سجّل الفشل بدون عقوبة</button>
    </div>`);
  $('#pen-yes').onclick = () => { closeModal(); onChoose(true); };
  $('#pen-no').onclick = () => { closeModal(); onChoose(false); };
}

// ---------- Events ----------
function enter(id) {
  if (id === 'shop') return go('shop');
  currentChar = id;
  go('character');
}

function bind() {
  const on = (attr, fn) => document.querySelectorAll(`[${attr}]`).forEach((el) => (el.onclick = () => fn(el.getAttribute(attr), el)));
  const inWindow = (c, t) => {
    const def = E.findCharacter(c).tasks.find((x) => x.id === t);
    if (!def?.prayer || c !== 'worshipper') return true;
    const ok = windowState(prayerNow().windows[def.prayer], new Date()) === 'open';
    if (!ok) { FX.toast('ليس وقت هذه الصلاة', 'err'); render(); }
    return ok;
  };
  on('data-task-ok', (v, el) => {
    const [c, t] = v.split(':');
    if (!inWindow(c, t)) return;
    const r = act(E.reportTask(state, c, t, true, { date: dayFor(c) }), el);
    if (r.ok && oasis?.char === c) oasis.scene.pray();
  });
  on('data-open-upgrades', showUpgrades);
  on('data-open-path', showPath);
  on('data-open-atmo', showAtmosphere);
  on('data-set-weather', (k) => { weatherOverride = k; oasis?.scene.setWeather(currentWeather()); render(); });
  on('data-set-time', (k) => { timeOverride = k; oasis?.scene.refreshSky(); render(); });
  on('data-toggle-quests', () => { questsCollapsed = !questsCollapsed; $('#quests')?.classList.toggle('collapsed', questsCollapsed); });
  on('data-pick-location', pickLocation);
  on('data-task-fail', (v) => {
    const [c, t] = v.split(':');
    const def = E.activeTasks(E.findCharacter(c), state.characters[c]).find((x) => x.id === t);
    failDialog(def.title, def.penalty, (pen) => act(E.reportTask(state, c, t, false, { applyPenalty: pen, date: dayFor(c) })));
  });
  on('data-level', (id, el) => act(E.levelUpCharacter(state, id), el));
  on('data-upgrade', (id, el) => act(E.upgradeRegion(state, id), el));
  on('data-buy', (v, el) => { const [k, id] = v.split(':'); act(E.buy(state, k, id), el); });
  on('data-go', go);
  on('data-spot', openSpot);
  on('data-ranks', showRanks);
}

function go(s) { screen = s; closeModal(); render(); window.scrollTo(0, 0); }

document.querySelectorAll('.nav-btn').forEach((b) => (b.onclick = () => go(b.dataset.screen)));
$('#modal-close').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target.id === 'modal' && e.currentTarget.dataset.closable === 'true') closeModal(); };
$('#account').onclick = () => {
  modal(`
    <h2>الحساب</h2>
    <p>${storage.mode === 'cloud' ? 'تقدّمك محفوظ في السحابة ومرتبط بحسابك في Claude.' : `الحساب المحلي: <b>${esc(storage.accountName)}</b>`}</p>
    <div class="row wrap">
      <button class="btn" data-pick-location>📍 أوقات الصلاة: ${state.location ? esc(state.location.name) : 'غير محددة'}</button>
      ${storage.mode === 'local' ? '<button class="btn" id="logout">تبديل الحساب</button>' : ''}
      <button class="btn bad" id="reset">إعادة اللعبة من البداية</button>
    </div>`);
  $('#modal-body [data-pick-location]').onclick = pickLocation;
  const lo = $('#logout');
  if (lo) lo.onclick = () => { storage.logout(); location.reload(); };
  $('#reset').onclick = () => ask('سيُحذف كل التقدّم. متأكد؟', async () => {
    state = E.demoState(); await storage.save(state); go('world'); FX.toast('بدأت من جديد');
  });
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').dataset.closable === 'true') closeModal(); });

boot();
