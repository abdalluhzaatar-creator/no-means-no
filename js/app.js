// UI layer: renders screens from state, calls engine actions, saves, plays effects.
import { CHARACTERS, REGIONS, CUPS, JOD_TO_USD, RANKS, COMMAND_RANKS, SUGGEST, KINGS } from './content.js';
import * as C from './cups.js';
import { commander, KEYS_PER_RANK } from './hq.js';
import { warMapSVG, WAR } from './warmap.js';
import * as E from './engine.js';
import { createStorage } from './storage.js';
import { characterSVG, regionSVG, worldMapSVG } from './scenes.js';
import * as FX from './effects.js';
import * as SND from './audio.js';
import { CITIES, METHODS, prayerDay, windowState, fmtTime } from './prayer.js';
import { createTour } from './tour.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const goldTxt = (n) => `<span class="gold-inline">🪙 ${n}</span>`;

let storage, state, screen = 'world', tour = null;
// The spiritual base and its tutorial (onboard.js). obPreview: the opening replayed from
// settings on a throwaway copy, so the real save is never touched.
let obRun = null, obPreview = null;

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
  if (state.base) screen = 'base';   // the game opens on the base (the spiritual dimension), as Clash opens on your village
  C.ensure(state);
  if (!raw) scheduleSave();
  $('#account').textContent = storage.accountName ? `👤 ${storage.accountName}` : '👤 حسابك';
  $('#app').hidden = false;
  closeDays();
  autoMissPrayers();
  render();
  // Keep following the clock: close finished days and refresh the prayer windows.
  setInterval(() => { closeDays(); autoMissPrayers(); if ($('#modal').hidden) render(); }, 30000);
  // The guided first steps: new players get them; players who already set habits don't.
  if (state.tour == null) { state.tour = raw && CHARACTERS.some((c) => state.characters[c.id] && E.activeTasks(c, state.characters[c.id]).length) ? 'done' : 0; scheduleSave(); }
  tour?.dispose();
  tour = createTour({
    ctx: () => ({ screen, state, modal: !$('#modal').hidden, warsBegun: warsBegun(), fly: (id) => disposeWorld?.flyTo?.(id),
      hasHabit: !!currentChar && !!state.characters[currentChar] && E.activeTasks(E.findCharacter(currentChar), state.characters[currentChar]).length > 0 }),
    save: scheduleSave,
    onFinish: () => FX.banner('🫡 جاهز يا قائد', 'خلّص عاداتك كل يوم — والسبت بتبلّش أول حرب.', '🫡'),
  });
  // The rules changed (v4): show them once.
  // The rules changed (v5: stars and weekly wars): show them once to players who knew the old ones.
  if (raw && (state.seenRules || 0) < 5) { state.seenRules = 5; scheduleSave(); rulesPending = true; setTimeout(() => { if ($('#modal').hidden && rulesPending) { rulesPending = false; showRules(); } }, 900); }
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
function sandboxBadge() {
  document.body.classList.toggle('sandbox', !!state?.sandbox);
  let b = document.getElementById('sandbox-badge');
  if (state?.sandbox && !b) { b = document.createElement('button'); b.id = 'sandbox-badge'; b.className = 'sandbox-badge'; b.onclick = showSettings; document.body.appendChild(b); }
  if (b && state?.sandbox) b.textContent = state.sandbox.shift ? `🧪 وضع التجربة · ${DAY_NAMES[new Date(dayFor() + 'T00:00:00Z').getUTCDay()]} (+${state.sandbox.shift} يوم)` : '🧪 وضع التجربة';
  if (!state?.sandbox && b) b.remove();
}
function render() {
  sandboxBadge();
  checkCommander();
  syncSound();
  $('#gold').textContent = state.gold;
  $('#keys').textContent = state.keys + (state.keyHalves ? '½' : '');
  $('#shields').textContent = state.shields || 0;
  const lg = E.leagueOf(state.medals), mb = $('#medals-box');
  mb.hidden = !warsBegun();   // the league shows once the first war has begun
  $('#medals').innerHTML = `${state.medals || 0}<span class="lg-name"> · ${esc(lg.name)}</span>`;
  mb.style.setProperty('--lg', lg.color);
  const navScreen = screen === 'character' ? 'world' : screen;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.screen === navScreen));
  document.body.classList.toggle('in-scene', (screen === 'character' && sceneFor(currentChar)) || screen === 'trophies' || screen === 'hq');
  document.body.classList.toggle('in-world', screen === 'world');
  document.body.classList.toggle('in-store', screen === 'shop');
  document.body.classList.toggle('in-base', screen === 'base');
  if (screen === 'base' && obRun && $('#base-view')) return;   // the base runs on its own
  if (obRun) { obRun.dispose(); obRun = null; obPreview = null; }
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
  const view = { world: renderWorld, character: renderCharacter, shop: renderShop, trophies: renderTrophies, hq: renderHQ, base: renderBase }[screen];
  $('#screen').innerHTML = view();
  bind();
  bindWorld();
  bindPlace();
  bindTrophies();
  bindHQ();
  bindBase();
  refreshModal();
}

// ---------- The spiritual base (Clash-style) and its tutorial ----------
function renderBase() { return '<div class="base-host" id="base-view"></div>'; }
async function bindBase() {
  const host = $('#base-view');
  if (!host || obRun) return;
  const st = obPreview || state;
  const { runOnboarding } = await import('./onboard.js');
  if (!host.isConnected || obRun) return;
  obRun = runOnboarding(host, {
    st, save: obPreview ? () => {} : scheduleSave, sfx: SND.sfx,
    onDone: () => {
      // After the tutorial: the way back to the rest of the game.
      const bar = document.createElement('div'); bar.className = 'ob-done-bar';
      bar.innerHTML = `<button data-ob-world>🗺 العالم</button>${obPreview ? '' : '<button data-ob-habits>📜 مهام البعد الروحي</button>'}`;
      host.querySelector('.ob')?.appendChild(bar);
      bar.querySelector('[data-ob-world]').onclick = () => { if (obPreview) FX.toast('خلصت التجربة — رجعت لتقدّمك الحقيقي'); go('world'); };
      bar.querySelector('[data-ob-habits]')?.addEventListener('click', () => { currentChar = 'worshipper'; go('character'); });   // the old habits screen, until it moves into the base
      if (!obPreview) render();
    },
  });
}

// ---------- Prayer times ----------
// Prayers belong to the calendar day: they can be logged any time until midnight.
const noonOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
// The game day closes at 3 at night, so the prayers shown are the game day's.
const prayerNow = () => (state.location ? prayerDay(noonOf(new Date(Date.now() - E.RULES.dayEnds * 3600000)), state.location) : null);
const dayFor = () => E.today();

// Any war fought or under way (the league and the war map show from then on).
const warsBegun = () => Object.values(state.characters || {}).some((ch) => ch.war || ch.wars > 0);
const starTxt = (n) => (n ? '⭐'.repeat(n) : '✖');

// When the game day closes (3 at night) every dimension banks its stars into its
// war; a zero day uses a shield or brings Lucifer's raid; Friday ends the wars.
function closeDays() {
  const before = state.lastDay;
  const rep = E.closeDays(state);
  if (state.lastDay !== before) scheduleSave();
  if (!rep.days) return;
  const big = rep.wars.length || rep.raids.length || rep.fallen.length || rep.dropped.length || rep.restored.length || rep.season || rep.started.length;
  const after = () => { if (big) showNightReport(rep); };
  // The night attack of the last day closed (its result is kept so it can be watched again).
  const lastDate = rep.stars.at(-1)?.date, fights = rep.stars.filter((x) => x.date === lastDate);
  if (!fights.length) { if (big) setTimeout(after, 600); return; }
  state.lastAttack = { date: lastDate, fights, raid: rep.raids.find((r) => r.date === lastDate) || null };
  scheduleSave();
  setTimeout(() => showAttack(state.lastAttack, after), 400);
}
// The 3D night attack (loaded the first time it plays). Each warrior wears the armour of their rank.
async function showAttack(data, then) {
  if (!data) return then?.();
  try {
    const { playAttack } = await import('./attack.js');
    const shown = playAttack({ ...data, shields: state.shields }, {
      warrior: (id) => { const c = E.findCharacter(id), ch = state.characters[id]; return { palette: c.palette, tier: ch ? E.totalLevel(ch) - 1 : 0 }; },
      sfx: SND.sfx, onDone: then,
    });
    if (!shown) then?.();
  } catch (err) { console.warn('attack scene unavailable', err); then?.(); }
}
function showNightReport(rep) {
  const lastDate = rep.stars.at(-1)?.date;
  const last = rep.stars.filter((x) => x.date === lastDate);
  const raid = rep.raids.reduce((a, x) => ({ gold: a.gold + x.gold, medals: a.medals + x.medals }), { gold: 0, medals: 0 });
  const li = (ic, b, sm = '') => `<li><span>${ic}</span><div><b>${b}</b>${sm ? `<small>${sm}</small>` : ''}</div></li>`;
  modal(`<div class="keyuse">
    <div class="keyuse-icon">🌙</div>
    <h2>تقرير الليلة</h2>
    ${last.length ? `<p class="night-stars">${last.map((x) => `<span>${esc(x.name)} <b>${starTxt(x.stars)}</b></span>`).join('')}</p>` : ''}
    <ul class="keyuse-list">
      ${rep.started.map((x) => li('⚔', `${esc(x.name)}: بلّشت أول حرب ضد ${esc(x.king)}`, `من السبت للجمعة. ${E.RULES.firstWarWin} نجوم وبتربح مفتاح 🗝.`)).join('')}
      ${rep.wars.map((w) => w.won
        ? li('🏆', `${esc(w.name)}: انتصرت على ${esc(w.king)} — ${w.total}/${w.need} ⭐`, `🗝 مفتاح + ${w.loot} 🪙${state.story?.speech ? ' + قطعة بالسفينة 🚢' : ''}`)
        : li(w.fallen ? '⚫' : '🏳', `${esc(w.name)}: خسرت أمام ${esc(w.king)} — ${w.total}/${w.need} ⭐`, w.key ? 'قرّبت كثير: أخذت نص مفتاح 🗝½.' : w.fallen ? 'الجبهة سقطت بعد 3 أيام صفر.' : 'الأسبوع الجاي حرب جديدة.')).join('')}
      ${rep.restored.map((x) => li('⬆', `رجعت الرتبة: ${esc(x)}`, 'الفوز رجّعلك رتبتك وعادتها.')).join('')}
      ${rep.dropped.map((x) => li('⬇', `نزلت رتبة: ${esc(x)}`, `${E.RULES.dropAfter} حروب خسارة ورا بعض. أول حرب بتربحها بترجّعها.`)).join('')}
      ${rep.fallen.map((x) => li('⚫', `سقطت جبهة ${esc(x)}`, '3 أيام صفر ورا بعض — حرب هالأسبوع خسرانة.')).join('')}
      ${rep.shielded ? li('🛡', `الدرع حوّل ${rep.shielded > 1 ? rep.shielded + ' أيام صفر' : 'يوم صفر'} لنجمة`, `ضايل معك ${state.shields || 0} 🛡`) : ''}
      ${raid.gold || raid.medals ? li('😈', `غارة لوسيفر: −${raid.gold} 🪙 و −${raid.medals} 🎖`, 'يوم بصفر نجوم بيفتحله الباب.') : ''}
      ${rep.season ? li('🏆', `جائزة الموسم — دوري ${esc(rep.season.league)}`, `+${rep.season.gold} 🪙`) : ''}
    </ul>
    ${rep.wars.length ? '<p class="luci-quote">😈 «أنا ما بخاف إنك تخسر حرب… بخاف إنك تكذب على حالك وتسمّيها انتصار.»</p>' : ''}
    <div class="row wrap"><button class="btn primary" id="nr-ok">ماشي</button><button class="btn ghost" id="nr-attack">⚔ الهجوم مرة ثانية</button><button class="btn ghost" id="nr-rules">📜 القوانين</button></div>
  </div>`);
  $('#nr-attack').hidden = !state.lastAttack;
  $('#nr-attack').onclick = () => { closeModal(); showAttack(state.lastAttack, () => showNightReport(rep)); };
  $('#nr-ok').onclick = () => { closeModal(); if (rulesPending) { rulesPending = false; showRules(); } };
  $('#nr-rules').onclick = () => { rulesPending = false; showRules(); };
}
let rulesPending = false;   // the new rules wait for the night report to close

// The rules of the game, short and plain. Shields are bought here.
function showRules() {
  const R = E.RULES, full = (state.shields || 0) >= R.maxShields;
  const li = (ic, b, sm = '') => `<li><span>${ic}</span><div><b>${b}</b>${sm ? `<small>${sm}</small>` : ''}</div></li>`;
  modal(`<div class="keyuse">
    <div class="keyuse-icon">📜</div>
    <h2>قوانين اللعبة</h2>
    <p class="muted">كل يوم هجوم، كل أسبوع حرب، كل شهر دوري.</p>
    <ul class="keyuse-list rules">
      ${li('⭐', 'كل يوم كل بُعد بيهاجم ملكه', 'ثلث عاداتك = ⭐ · ثلثينها = ⭐⭐ · كلها = ⭐⭐⭐. العادة اللي بتتكرر بتنحسب بقديش خلصت منها (الصلاة 4 من 5 = 80%).')}
      ${li('✔', `خلّصت عادة = +${R.reward} 🪙`)}
      ${li('🌙', `اليوم بيخلص الساعة ${R.dayEnds} بالليل`, 'مش الساعة 12.')}
      ${li('⚔', 'كل أسبوع حرب: من السبت للجمعة', `كل بُعد ضد ملكه لحاله. ${R.warWin} من 21 نجمة = فوز (أول حرب ${R.firstWarWin}): 🗝 مفتاح + غنيمة ذهب.`)}
      ${li('½', 'قرّبت؟ نص مفتاح 🗝', 'إذا جبت ثلاث أرباع النجوم المطلوبة. نصّين = مفتاح.')}
      ${li('😈', 'يوم بصفر نجوم = غارة لوسيفر', `${Math.round(R.raidPct * 100)}% من ذهبك (${R.raidMax} بالأكثر) و${R.raidMedals} 🎖. غارة وحدة باليوم.`)}
      ${li('🛡', 'الدرع بيحوّل يوم الصفر لنجمة', `مرة بالأسبوع لكل بُعد، وبينصرف لحاله. سعره ${R.shieldCost} 🪙، ومعك ${R.maxShields} بالأكثر.`)}
      ${li('⚫', `${R.fallAfter} أيام صفر ورا بعض = الجبهة بتسقط`, 'حرب هاد البُعد هالأسبوع بتنحسب خسارة.')}
      ${li('⬇', `${R.dropAfter} حروب خسارة ورا بعض = البُعد بينزل رتبة`, 'وأول حرب بتربحها بترجّعلك الرتبة وعادتها. ما في نزول تحت برونز 1.')}
      ${li('🫡', `كل ${KEYS_PER_RANK} مفاتيح = القائد بيترقّى`, 'ورتبة القائد ما بتنزل أبدًا.')}
      ${li('🎖', 'الأوسمة والدوري', `كل نجمة بالحرب = ${R.medalsPerStar} 🎖. الدوري الأعلى بيزيد غنيمة الحروب، وكل شهر في جائزة موسم.`)}
      ${li('🌱', 'بُعد جديد بيتدرّب لأول سبت', 'نجوم بس — بلا حرب ولا غارات. والعادة الجديدة بتنحسب من بكرا.')}
      ${li('🚢', 'بعد الخطاب: كل حرب بتربحها = قطعة بالسفينة')}
      ${li('🤍', 'الصدق', 'سجّل فشلك بصدق. النجوم ما إلها قيمة إذا ما كانت حقيقية.')}
    </ul>
    <p>معك <b>🛡 ${state.shields || 0}</b> من ${R.maxShields}.</p>
    <button class="btn primary big" id="buy-shield" ${full || state.gold < R.shieldCost ? 'disabled' : ''}>${full ? '🛡 الدروع مليانة' : `🛡 اشتري درع — ${R.shieldCost} 🪙`}</button>
  </div>`);
  $('#buy-shield').onclick = (e) => { const r = act(E.buyShield(state), e.currentTarget); if (r.ok) { FX.toast('🛡 صار معك درع جديد'); showRules(); } };
}

// The league: medals, the ladder and the season prize.
function showLeague() {
  const lg = E.leagueOf(state.medals);
  modal(`<div class="keyuse">
    <div class="keyuse-icon">🎖</div>
    <h2>دوري ${esc(lg.name)}</h2>
    <p>معك <b>${state.medals || 0} 🎖</b>${lg.next ? ` — باقي <b>${lg.next.min - (state.medals || 0)}</b> لدوري ${esc(lg.next.name)}` : ' — أعلى دوري 🏆'}.</p>
    <ol class="path">${E.LEAGUES.map((l, i) => `<li class="${i < lg.index ? 'done' : i === lg.index ? 'current' : ''}" style="--rank:${l.color}"><b class="rk">${esc(l.name)}</b><span>${l.min} 🎖 · غنيمة +${i * 10}% · موسم ${100 * (i + 1)} 🪙</span></li>`).join('')}</ol>
    <p class="muted">كل نجمة بالحرب = ${E.RULES.medalsPerStar} 🎖، وغارة لوسيفر بتاخذ ${E.RULES.raidMedals}. جائزة الموسم بتنزل أول كل شهر.</p>
  </div>`);
}

// A task tied to a prayer time can't count before that prayer's time begins.
const hasPrayers = (c) => !!state.characters[c.id] && E.activeTasks(c, state.characters[c.id]).some((t) => t.prayer);
function autoMissPrayers() {
  if (!state.location) return;
  const pd = prayerNow();
  const now = new Date();
  const revoked = [];
  for (const c of CHARACTERS) {
    const ch = state.characters[c.id];
    if (!ch) continue;
    for (const t of E.activeTasks(c, ch)) {
      if (!t.prayer) continue;
      const w = pd.windows[t.prayer];
      const p = E.taskProgress(state, c.id, t.id);
      if (p.lastDate !== pd.day || p.lastResult !== 'success') continue;
      const early = windowState(w, now) === 'upcoming' || (p.at && p.at < +w.start);
      if (early && E.revokeTask(state, c.id, t.id, pd.day)) revoked.push(t.title);
    }
  }
  if (revoked.length) {
    scheduleSave();
    FX.banner('أُلغيت مهام سُجّلت قبل وقتها', revoked.join('، '), '↩');
  }
}

function pickLocation() {
  const cur = state.location;
  modal(`
    <h2>أوقات الصلاة</h2>
    <p class="muted">اختر مدينتك لتعرف اللعبة أوقات الصلاة. تُسجَّل الصلاة بعد دخول وقتها، ولك حتى الساعة ${E.RULES.dayEnds} بالليل لتسجيلها؛ بعدها تُحسب فائتة.</p>
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
  const times = E.timesOf(t), count = E.countToday(p, date);
  const pd = t.prayer ? prayerNow() : null;
  const w = pd?.windows[t.prayer];
  const ws = w ? windowState(w, new Date()) : null;
  const timeInfo = w ? `<small class="ptime ${ws}">🕰 ${fmtTime(w.start)} – ${fmtTime(w.end)}</small>` : '';
  const five = E.isFivePrayers(t.title) && times === 5;
  const dots = five ? `<span class="times prayers">${PRAYER_LABELS.map((x, i) => `<i class="${i < count ? 'on' : ''}">${x}</i>`).join('')}<b><bdi>${count}/5</bdi></b></span>`
    : times > 1 ? `<span class="times">${Array.from({ length: times }, (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`).join('')}<b><bdi>${count}/${times}</bdi></b></span>` : '';
  let actions;
  if (doneToday) actions = `<span class="result">${p.lastResult === 'success' ? '✔ أنجزتها' : '✘ فاتت'}</span>`;
  else if (t.prayer && !state.location) actions = '<button class="btn small" data-pick-location>اختر مدينتك</button>';
  else if (ws === 'upcoming') actions = `<span class="result">لم يدخل وقتها بعد</span>`;
  else actions = `<button class="btn ok" data-task-ok="${charId}:${t.id}">${five ? `صلّيت ${PRAYER_LABELS[Math.min(4, count)]}` : times > 1 ? `أنجزت مرة (+1)` : 'أنجزت'}</button>
           <button class="btn bad" data-task-fail="${charId}:${t.id}">لم أنجز</button>`;
  return `
  <li class="task ${doneToday ? 'is-' + p.lastResult : ''} ${ws === 'open' && !doneToday ? 'is-open' : ''}">
    <div class="task-main">
      <strong><span class="t-ic">${taskIcon(charId, t)}</span> ${esc(t.title)}${times > 1 ? ` <small class="muted">× ${times} باليوم</small>` : ''}${E.findCharacter(charId)?.stages ? ` <button class="edit-task" data-edit-task="${charId}:${t.id}" title="عدّل" aria-label="عدّل">✎</button>` : ''}</strong>
      ${dots}
      ${timeInfo}
      <small class="muted"><bdi>+${t.reward ?? E.RULES.reward}</bdi> 🪙 · 🔥 ${E.currentStreak(p, date)}</small>
    </div>
    <div class="task-actions">${actions}</div>
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
  if (id === 'sanctuary' && state.base) return go('base');   // the spiritual dimension is the base now
  if (def.kind === 'leaders') {
    const st = E.shipStage(state);
    modal(`<div class="keyuse"><div class="keyuse-icon">🏝</div><h2>${def.name}</h2><p class="muted">${def.desc}</p>
      <h3 class="keyuse-title">🚢 السفينة: ${st} من ${E.SHIP.parts}</h3>${bar(st, E.SHIP.parts, 'كل ' + E.SHIP.per + ' أيام كاملة = قطعة جديدة')}
      <p class="muted">السفينة على الشط تحت قاعة المحاربين. ${st >= E.SHIP.parts ? 'السفينة جاهزة… الإبحار قريبًا.' : 'أكملوا بناءها.'}</p></div>`);
    return;
  }
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
      ${st.canBuy ? `افتح المكان — ${E.costText(def.cost)}` : !st.conditionsMet ? 'الشروط غير مكتملة' : def.cost?.keys ? 'تحتاج مفتاحًا — اربح حرب أسبوعية ⚔' : 'ذهب غير كافٍ'}</button>`);
  $('#open-place').onclick = (e) => { const r = act(E.buy(state, 'region', id), e.currentTarget); if (r.ok) closeModal(); };
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
    <p class="muted small-text">كل رتبة بتجيب عادة جديدة بتختارها لما تترقّى.</p>
    <ol class="path">${ladder.map((r, i) => {
      const n = i + 1, cls = n < cur ? 'done' : n === cur ? 'current' : '';
      const what = r.adds.length ? r.adds.map((a) => (n === 1 ? '' : '+ ') + a.title + (E.timesOf(a) > 1 ? ` ×${E.timesOf(a)}` : '')).join('، ') : n > cur ? 'عادة جديدة بتختارها' : '—';
      const unlock = n === cur + 1
        ? `<button class="btn small ${state.keys ? 'primary' : ''}" data-promote="${c.id}" ${state.keys ? '' : 'disabled'} title="يحتاج مفتاحًا">🗝 1 افتح</button>` : '';
      return `<li class="${cls}" style="--rank:${r.color}"><b class="rk">${esc(r.name)}</b><span>${esc(what)}</span>${unlock}</li>`;
    }).join('')}</ol>
    ${warLine(c.id)}
    <p class="muted small-text">كل أسبوع حرب: ${E.RULES.warWin} نجمة من 21 = مفتاح 🗝، وبالمفتاح ترفع رتبتك أو تفتح بُعد.</p>
  </section>`;
}

// The habit picker — one clear screen: pick a ready habit (or write your own),
// rename it and give it an icon, choose how many times a day, see what it leads to.
//   mode 'first'   : the dimension's first habit (Bronze 1)
//   mode 'promote' : spend a key → next rank + the new habit it brings
//   mode 'edit'    : change one of today's habits (taskId)
// Icons: the dimension's own first, then general ones for any habit.
const DIM_ICONS = {
  worshipper: ['🕌', '📖', '📿', '🤲', '🕋', '🌙', '⭐', '🕯', '💝', '🎧', '🧎', '☪', '📜', '🌅', '🌃', '💧', '🫶', '🍽'],
  scholar: ['📚', '📖', '🧠', '✍', '📝', '🔬', '🧪', '🧮', '🗣', '🌍', '🎓', '💻', '🔭', '📐', '🗂', '🧩', '🎧', '📰'],
  athlete: ['🏃', '🏋', '💪', '🚴', '🏊', '🤸', '🧘', '⚽', '🥊', '🥗', '🍎', '🥦', '💧', '😴', '🚶', '❤️‍🩹', '⚖', '🩺'],
  empath: ['🤝', '🕊', '🎁', '👂', '🏥', '🤲', '🧓', '🫡', '🙊', '🍞', '🫶', '💌', '☎', '🧸', '🌱', '🏠', '🪔', '🙏'],
  host: ['👪', '📞', '🤝', '🏠', '💬', '🍽', '☕', '🎉', '🫂', '✉', '🎁', '🧆', '🕌', '👋', '🪑', '🔥', '📸', '🎂'],
  builder: ['🎯', '🗓', '💼', '📈', '⏰', '📧', '💻', '🧑‍💼', '📊', '🗂', '🖊', '📞', '🏆', '🚀', '📌', '🧭', '☕', '📝'],
  merchant: ['🧾', '🐖', '💰', '🪙', '💳', '📊', '🏦', '💡', '🚫', '📉', '📈', '🧮', '🛒', '🏷', '💵', '🔐', '⚖', '📒'],
  keeper: ['🌳', '🌱', '♻', '🚯', '💧', '☀', '🌬', '🐝', '🐦', '🌻', '🚶', '🚲', '🌍', '🧹', '🪴', '🍃', '🔋', '🌊'],
};
const ICONS = ['⭐', '🔥', '✅', '🎯', '⏰', '📵', '🚭', '☕', '🍎', '💧', '😴', '🧹', '🎨', '🎸', '🧩', '📖', '✍', '💪', '🙏', '❤', '🌙', '☀', '🕯', '🎵', '🏠', '🚗', '📞', '💬', '🛑', '🧠', '👀', '🗝', '🏅', '🌟', '🍀', '🕐'];
const PRAYER_LABELS = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'];
const DIM_ICON = { worshipper: '☪', scholar: '📚', athlete: '🏋', empath: '🕊', host: '🤝', builder: '🛠', merchant: '🪙', keeper: '🌳' };
const taskIcon = (charId, t) => t.icon || (SUGGEST[charId] || []).find(([, x]) => x === t.title)?.[0] || DIM_ICON[charId] || '⭐';
function pickHabit(id, { mode = 'first', taskId = null } = {}) {
  const c = E.findCharacter(id), ch = state.characters[id];
  const rd = E.road(state, id);
  const plan = E.planOf(c, ch);
  const editing = mode === 'edit' ? E.activeTasks(c, ch).find((t) => t.id === taskId) : null;
  const rankIndex = mode === 'promote' ? E.totalLevel(ch) : mode === 'edit' ? plan.findIndex((r) => r.some((t) => t.id === taskId)) : E.totalLevel(ch) - 1;
  const have = new Set(E.activeTasks(c, ch).map((t) => t.title).filter((t) => t !== editing?.title));
  const ideas = (SUGGEST[id] || []).filter(([, t]) => !have.has(t));
  // What is being built: { from: suggestion title | 'own', title, icon, times }
  const cur = editing
    ? { from: ideas.some(([, t]) => t === editing.title) ? editing.title : 'own', title: editing.title, icon: taskIcon(id, editing), times: E.timesOf(editing) }
    : { from: null, title: '', icon: '', times: 1 };
  const head = mode === 'promote' ? { k: `ترقية لـ ${esc(rd.next.name)}`, t: 'عادة جديدة لرتبتك الجديدة' }
    : mode === 'edit' ? { k: 'تعديل المهمة', t: 'غيّر اسمها أو صورتها أو عدد مراتها' } : { k: esc(c.name), t: 'اختار أول عادة إلك' };
  const lead = mode === 'promote' ? 'بمفتاح 🗝 واحد بتترقّى، و<b>بتنضاف عادة جديدة</b> لمهامك اليومية.'
    : mode === 'edit' ? 'إذا غيّرت الاسم، سلسلة الأيام تبعتها بتبلّش من جديد.' : 'عادة وحدة بتعملها كل يوم. ابدأ بإشي صغير بتقدر تلتزم فيه 💪';
  modal(`
    <div class="picker" style="--glow:${c.palette.glow}">
      <header class="pk-head"><div class="pk-medal">${DIM_ICON[id] || '⭐'}</div><div><small>${head.k}</small><h2>${head.t}</h2></div></header>
      <p class="pk-lead">${lead}</p>
      <div class="pk-step"><b>1</b> اختار عادة</div>
      <div class="habit-grid">
        ${ideas.map(([ic, t, n], i) => `<button class="habit" type="button" data-h="${esc(t)}" data-n="${n}" data-ic="${ic}" style="--i:${i}"><span class="hb-ic">${ic}</span><b>${esc(t)}</b>${n > 1 ? `<small>× ${n} باليوم</small>` : ''}<i class="hb-check">✔</i></button>`).join('')}
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
        <div class="pk-step"><b>3</b> كم مرة باليوم؟</div>
        <div class="hp-times"><button type="button" class="step" data-step="-1" aria-label="أقل">−</button><b id="hp-n">1</b><button type="button" class="step" data-step="1" aria-label="أكثر">+</button></div>
        <div class="pk-prayers" id="pk-prayers" hidden>${PRAYER_LABELS.map((x) => `<span>${x}</span>`).join('')}</div>
        <div class="hp-sum" id="hp-sum"></div>
      </div>
      <div class="pk-actions">
        <button class="pk-ok" id="hp-ok" disabled>${mode === 'promote' ? `⬆ ترقّى <small>🗝 1 · معك ${state.keys}</small>` : 'ثبّت المهمة ✔'}</button>
        ${mode === 'edit' && E.activeTasks(c, ch).length > 1 ? '<button class="pk-ghost" id="hp-del">🗑 احذفها</button>' : ''}
        <button class="pk-ghost" id="hp-cancel">${mode === 'first' ? 'لاحقًا' : 'رجوع'}</button>
      </div>
    </div>`, { theme: 'game' });
  modalRefresh = null;
  const nEl = $('#hp-n'), ok = $('#hp-ok'), sum = $('#hp-sum'), title = $('#pk-title'), iconBtn = $('#pk-icon'), icons = $('#pk-icons');
  const draw = () => {
    document.querySelectorAll('.habit').forEach((b) => b.classList.toggle('on', cur.from === 'own' ? b.hasAttribute('data-own') : b.dataset.h === cur.from));
    $('#pk-custom').hidden = !cur.from;
    const t = cur.title.trim(), five = E.isFivePrayers(t);
    if (five) cur.times = 5;
    $('.hp-times').hidden = five;
    nEl.textContent = cur.times;
    iconBtn.textContent = cur.icon || '⭐';
    $('#pk-prayers').hidden = !five;
    document.querySelector('[data-step="-1"]').disabled = cur.times <= (five ? 5 : 1);
    ok.disabled = !t || (mode === 'promote' && !state.keys);
    sum.innerHTML = t
      ? `<p><span>📅</span>كل يوم: <b>${esc(cur.icon || '⭐')} ${esc(t)}${cur.times > 1 ? ` × ${cur.times}` : ''}</b> — تسجّلها قبل الساعة ${E.RULES.dayEnds} بالليل.</p>
         ${five ? '<p><span>🕌</span>الصلاة خمس صلوات باليوم — لا أقل ولا أكثر.</p>' : ''}
         <p><span>⭐</span>كل يوم بتاخذ نجوم حسب قديش خلّصت، وكل أسبوع حرب: ${E.RULES.warWin} نجمة = <b>مفتاح</b>${rd?.next && mode !== 'promote' ? ` ← بتترقّى لـ <b>${esc(rd.next.name)}</b> وبتختار عادة جديدة.` : '.'}</p>
         ${cur.times > 10 && !five ? '<p class="warn"><span>⚠</span>رقم كبير. ابدأ أقل وزيد مع الوقت.</p>' : ''}`
      : '<p class="muted">اكتب اسم المهمة 👆</p>';
  };
  document.querySelectorAll('.habit').forEach((b) => (b.onclick = () => {
    if (b.hasAttribute('data-own')) Object.assign(cur, { from: 'own', title: cur.from === 'own' ? cur.title : '', icon: cur.from === 'own' ? cur.icon : '✍', times: cur.from === 'own' ? cur.times : 1 });
    else Object.assign(cur, { from: b.dataset.h, title: b.dataset.h, icon: b.dataset.ic, times: +b.dataset.n || 1 });
    title.value = cur.title; SND.sfx.click(); draw();
    if (cur.from === 'own') setTimeout(() => title.focus(), 0);
    $('#pk-custom').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  title.value = cur.title;
  title.oninput = () => { cur.title = title.value; draw(); };
  iconBtn.onclick = () => { icons.hidden = !icons.hidden; };
  icons.querySelectorAll('[data-icon]').forEach((b) => (b.onclick = () => { cur.icon = b.dataset.icon; icons.hidden = true; SND.sfx.click(); draw(); }));
  document.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => { cur.times = Math.max(1, Math.min(E.MAX_TIMES, cur.times + +b.dataset.step)); SND.sfx.click(); draw(); }));
  $('#hp-cancel').onclick = () => (mode === 'promote' ? showDimRanks() : closeModal());
  if ($('#hp-del')) $('#hp-del').onclick = () => ask(`تحذف "${editing.title}"؟`, () => { const r = act(E.removeHabit(state, id, taskId)); if (r.ok) closeModal(); });
  ok.onclick = () => {
    const habit = { title: cur.title.trim(), icon: cur.icon, times: cur.times };
    if (mode === 'promote') { const r = act(E.promoteWith(state, id, habit), ok); if (r.ok) { FX.toast(`🎖 صرت ${E.rankName(ch)} — وانضافت "${habit.title}"`); showDimRanks(); } return; }
    const r = E.setHabit(state, id, rankIndex, editing?.id || null, habit);
    if (!r.ok) return FX.toast(r.reason, 'err');
    scheduleSave(); questsCollapsed = false; render();
    if (mode === 'first') showKeyUses(id); else { FX.toast('تم ✔'); closeModal(); }
  };
  draw();
}

// Shown after the first task is set: stars every day, a war every week, and what a key does.
function showKeyUses(id) {
  const c = E.findCharacter(id), ch = state.characters[id];
  const nextRank = RANKS[E.totalLevel(ch)]?.name || 'الرتبة الجاية';
  const dims = REGIONS.filter((r) => r.characterId);
  modal(`
    <div class="keyuse">
      <div class="keyuse-icon">🗝</div>
      <h2>كل يوم نجوم ⭐ — وكل أسبوع حرب ⚔</h2>
      <p class="muted">خلّص عادتك = ⭐⭐⭐. أول سبت بتبلّش حربك ضد ${esc(E.road(state, id)?.war?.king || 'الملك')}: اجمع ${E.RULES.firstWarWin} نجوم لحد الجمعة وبتربح مفتاح.</p>
      <h3 class="keyuse-title">استخدامات المفتاح</h3>
      <ul class="keyuse-list">
        <li><span>⬆</span><div><b>ترقية الشخصية لـ${esc(nextRank)}</b><small>عشان تقدر تربّي عادة جديدة فوق عادتك — من عند القائد بمقر القيادة.</small></div></li>
        <li><span>🗺</span><div><b>فتح بُعد جديد من الأبعاد الثمانية</b></div></li>
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
    <p class="muted">للنظر فقط. تبدأ من برونز 1، وكل رتبة جديدة بتاخدها بمفتاح 🗝 من عند <b>القائد</b> بمقر القيادة.</p>
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
  return { features: E.regionFeatures(state, c.regionId), level: artLevel(ch), rank: rankState(c, ch) };
};
// What the rank stand shows: every rank, the current one, and this week's war stars.
const rankState = (c, ch) => {
  if (!c.stages) return null;
  const w = E.warView(state, c.id);
  return { ranks: RANKS, current: E.totalLevel(ch) - 1, keyDays: w && !w.training ? Math.min(w.total, w.need) : 0, keyEvery: w && !w.training ? w.need : E.RULES.firstWarWin };
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
      const scene = mountPlace(v, { regionId: c.regionId, palette: c.palette, rank: placeState().rank, features: placeState().features, lucifer: luciFor(c.id), onRanks: () => showRanks(c.id), sky: skyInfo, weather: currentWeather(), onCharacter: () => { SND.sfx.wave(); FX.toast(`${c.name}: ${['يلا نكمل!', 'خطوة كل يوم', 'أنا جاهز', 'الاستمرار سر النجاح'][Math.random() * 4 | 0]}`); } });
      oasis = { char: c.id, scene };
      loadWeather();
      return;
    }
    const { mountOasis } = await import('./oasis3d.js');
    if (!v.isConnected) return;
    v.querySelector('.w3-loading')?.remove();
    const scene = mountOasis(v, { palette: c.palette, ...placeState(), lucifer: luciFor(c.id), onRanks: () => showRanks(c.id), sky: skyInfo, weather: currentWeather(),
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
const luciFor = (id) => (state.story?.jailed ? null : { who: id, tasks: () => { const c = E.findCharacter(id), ch = state.characters[id], d = dayFor(id); return ch ? E.activeTasks(c, ch).filter((t) => !E.taskDoneToday(E.taskProgress(state, id, t.id), d)).map((t) => t.title) : []; } });

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
      <button class="btn primary" id="ob-preview">🎬 جرّب بداية اللعبة الجديدة</button>
      <p class="muted small-text">بتلعب البداية من أولها (البعد الروحي، رامي السهام، الهجوم) بدون ما يتأثر تقدّمك.</p>
    </section>
    <section class="set-block sandbox-block">
      <h3>🧪 وضع التجربة</h3>
      ${state.sandbox
        ? `<p class="muted small-text">إنت هلأ بوضع التجربة. تقدّمك الحقيقي محفوظ وبيرجع لما تطلع.</p>
           <div class="row wrap"><button class="btn primary" id="sb-refill">🔄 عبّي المفاتيح والمصاري</button><button class="btn" id="sb-leave">↩ ارجع لتقدّمي الحقيقي</button></div>
           <p class="muted small-text">جرّب كيف كل إشي مربوط ببعض:</p>
           <p class="muted small-text">⏭ جرّب الحرب: سجّل عاداتك، وبعدين خلّص اليوم وشوف النجوم والغارة وتقرير الليلة. ٧ مرات = أسبوع حرب كامل.</p>
           <div class="row wrap"><button class="btn primary" id="sb-day">⏭ خلّص اليوم</button><button class="btn" id="sb-week">⏭⏭ خلّص لآخر الأسبوع</button></div>
           <div class="row wrap"><button class="btn" id="sb-cmd">🫡 رقّي القائد</button><button class="btn" id="sb-dims">🎖 رقّي المحاربين</button><button class="btn" id="sb-ship">🚢 كمّل السفينة</button><button class="btn" id="sb-story">📜 القصة من الأول</button></div>`
        : `<p class="muted small-text">بيفتحلك كل الأبعاد والأماكن، وبيعطيك <b>🗝 ${E.SANDBOX.keys}</b> مفتاح و<b>🪙 ${E.SANDBOX.gold.toLocaleString('en')}</b>. ما في إشي مترقّي — إنت بترقّي وبتشوف. تقدّمك الحقيقي بينحفظ وبيرجع لما تطلع.</p>
           <button class="btn primary" id="sb-enter">🧪 افتح كل إشي</button>`}
    </section>`);
  if ($('#tour-again')) $('#tour-again').onclick = () => { tour?.restart(); closeModal(); go('world'); };
  if ($('#ob-preview')) $('#ob-preview').onclick = () => { closeModal(); obRun?.dispose(); obRun = null; obPreview = { gold: 0, gems: 300, nour: 0, base: { buildings: [] }, onboard: 'intro' }; screen = 'base'; render(); };
  const swap = (next, msg) => { state = next; C.ensure(state); syncClock(); closeDays(); scheduleSave(); closeModal(); go('world'); render(); FX.toast(msg); };
  if ($('#sb-enter')) $('#sb-enter').onclick = () => swap(E.enterSandbox(state), '🧪 وضع التجربة: كل إشي مفتوح');
  if ($('#sb-leave')) $('#sb-leave').onclick = () => ask('ترجع لتقدّمك الحقيقي؟ كل إشي عملته بالتجربة بيروح.', () => swap(E.leaveSandbox(state), '↩ رجعت لتقدّمك الحقيقي'));
  // Move test mode's calendar: the day (or the week, up to Friday) closes as it would at 3 at night.
  const skip = (n) => { closeModal(); state.sandbox.shift = (state.sandbox.shift || 0) + n; syncClock(); closeDays(); scheduleSave(); render(); oasis?.scene.update(placeState()); };
  if ($('#sb-day')) $('#sb-day').onclick = () => skip(1);
  if ($('#sb-week')) $('#sb-week').onclick = () => { const d = new Date(dayFor() + 'T00:00:00Z').getUTCDay(); skip(((5 - d + 7) % 7) + 1); };
  if ($('#sb-refill')) $('#sb-refill').onclick = () => { E.refillSandbox(state); scheduleSave(); render(); FX.toast('🔄 تعبّوا'); };
  if ($('#sb-cmd')) $('#sb-cmd').onclick = () => { state.stats.keysEarned = (state.stats.keysEarned || 0) + KEYS_PER_RANK; scheduleSave(); closeModal(); checkCommander(); render(); hqScene?.update({ rankIndex: commander(state).rankIndex }); FX.toast(`🫡 القائد صار ${commander(state).rank}`); };
  if ($('#sb-dims')) $('#sb-dims').onclick = () => showDimRanks();
  if ($('#sb-ship')) $('#sb-ship').onclick = () => { state.story = { ...state.story, ship: E.SHIP.parts * E.SHIP.per }; scheduleSave(); hqScene?.setShip(E.SHIP.parts); closeModal(); render(); FX.toast('🚢 السفينة اكتملت — شوفها عالشط تحت قاعة المحاربين'); };
  if ($('#sb-story')) $('#sb-story').onclick = () => { state.story = { speech: false, jailed: false, ship: 0, phase: 'none' }; scheduleSave(); closeModal(); go('world'); FX.toast('📜 القصة رجعت من الأول'); };
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

// This week's war of one dimension, in a few lines (under today's tasks and in the panels).
function warLine(id) {
  const rd = E.road(state, id), w = rd?.war;
  if (!w) return '';
  if (w.training) return `<div class="road">
    <p>🌱 <b>تدريب</b> — اليوم ${starTxt(w.today)}. أول حرب ضد <b>${esc(w.king)}</b> بتبلّش ${w.inDays === 1 ? 'بكرا السبت' : w.inDays === 2 ? 'بعد يومين (السبت)' : `بعد ${w.inDays} أيام (السبت)`}.</p></div>`;
  const pct = Math.min(100, Math.round((w.total / w.need) * 100));
  const state_ = w.fallen ? '<p class="road-warn">⚫ الجبهة سقطت — حرب هالأسبوع خسرانة. الأسبوع الجاي حرب جديدة.</p>'
    : w.won ? '<p class="road-ready">🏆 جمعت النجوم! الفوز بيتسجّل يوم الجمعة.</p>'
    : w.lost ? '<p class="road-warn">🏳 ما بتلحق هالأسبوع — جمّع نجوم لنص المفتاح.</p>'
    : w.zeroRun === E.RULES.fallAfter - 1 && !w.today ? '<p class="road-warn">⚠ يومين صفر ورا بعض — صفر كمان والجبهة بتسقط!</p>' : '';
  return `<div class="road">
    <div class="road-bar"><i style="width:${pct}%"></i></div>
    <p>⚔ ضد <b>${esc(w.king)}</b>: <b><bdi>${w.total}/${w.need}</bdi></b> ⭐ · اليوم ${starTxt(w.today)} · ${w.left ? `باقي ${w.left} ${w.left > 2 ? 'أيام' : 'يوم'}` : 'آخر يوم!'}</p>
    ${state_}
    ${w.losses ? `<p class="road-warn">🏳 ${w.losses} من ${E.RULES.dropAfter} حروب خسارة ورا بعض${w.losses === E.RULES.dropAfter - 1 ? ' — خسارة كمان وبتنزل رتبة!' : ''}</p>` : ''}
    ${w.restore ? '<p class="road-ready">⬆ اربح هالحرب وبترجعلك رتبتك.</p>' : ''}
    ${rd.canPromote ? '<p class="road-ready">🗝 معك مفتاح! روح للقائد بمقر القيادة ← 🎖 رتب الأبعاد وترقّى.</p>' : ''}
    ${state.lastAttack ? '<button class="btn ghost small road-replay" data-replay-attack>▶ شوف هجوم مبارح</button>' : ''}
  </div>`;
}
const roadLine = warLine;

function placeHUD() {
  const c = E.findCharacter(currentChar);
  const ch = state.characters[c.id];
  const r = E.findRegion(c.regionId);
  const stage = c.stages?.[ch.stage];
  const tasks = E.activeTasks(c, ch);
  const date = dayFor(c.id);
  const done = tasks.filter((t) => E.taskComplete(E.taskProgress(state, c.id, t.id), date)).length;
  const best = Math.max(0, ...tasks.map((t) => E.currentStreak(E.taskProgress(state, c.id, t.id), date)));
  const next = E.nextRegionUpgrade(state, r.id);
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:${c.palette.glow}">☪</div>
      <div class="plate-body">
        <div class="plate-name">${c.name === r.name ? r.name : `${c.name} <span class="plate-place">· ${r.name}</span>`}</div>
        <div class="plate-row"><span class="plate-streak" title="أطول سلسلة">🔥 ${best}</span></div>

      </div>
    </div>
    ${hasPrayers(c) ? prayerNowLine() : ''}
    <button class="hud-chip atmo" data-open-atmo>${WEATHER_NAMES[currentWeather()].split(' ')[0]} ${PERIODS[skyInfo().period]}${timeOverride === "auto" ? ` · ${fmtTime(new Date())}` : ""}${liveWeather?.temp != null && weatherOverride === 'auto' ? ` · ${liveWeather.temp}°` : ''}</button>
  </div>

  <aside class="quests ${questsCollapsed ? 'collapsed' : ''}" id="quests">
    <button class="quests-head" data-toggle-quests>
      <span>📜 مهام اليوم</span><b>${done} / ${tasks.length}</b>
    </button>
    <ul class="tasks">${tasks.length ? tasks.map((t) => taskRow(c.id, t)).join('') : `<li class="task"><div class="task-main"><strong>ما حدّدت مهامك لسا</strong><small class="muted">اختار عادة وحدة بتعملها كل يوم.</small></div><div class="task-actions"><button class="btn ok" data-set-tasks="${c.id}">🎯 اختار مهمتك</button></div></li>`}</ul>
    ${tasks.length ? roadLine(c.id) : ''}
  </aside>

  <div class="dock">
    <button class="dock-btn" data-open-upgrades>🛠<span>طوّر ${r.name}</span>${next && state.gold >= next.cost ? '<i class="dot"></i>' : ''}</button>
    ${hasPrayers(c) ? `<button class="dock-btn" data-pick-location>📍<span>${state.location ? esc(state.location.name) : 'مدينتك'}</span></button>` : ''}
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


// Commander's ranks desk (HQ): every opened dimension, its rank, its habits and its
// war this week. Ranks are granted here: one key = next rank + a new habit.
function showDimRanks() {
  const list = CHARACTERS.filter((c) => c.stages && state.characters[c.id]);
  modal(`
    <h2>🎖 رتب الأبعاد</h2>
    <p class="muted">معك <b>🗝 ${state.keys}</b>. كل مفتاح = رتبة جديدة لبُعد + عادة جديدة بتختارها.</p>
    <ul class="dim-ranks">${list.map((c) => {
      const ch = state.characters[c.id], rd = E.road(state, c.id), tasks = E.activeTasks(c, ch);
      const btn = !rd.next ? '<span class="muted">🏆 أعلى رتبة</span>'
        : !tasks.length ? `<button class="btn small" data-set-tasks="${c.id}">🎯 اختار أول مهمة</button>`
          : `<button class="btn small ${rd.canPromote ? 'primary' : ''}" data-promote="${c.id}" ${rd.canPromote ? '' : 'disabled'}>⬆ ${esc(rd.next.name)} — 🗝 1</button>`;
      return `<li>
        <div class="dr-head"><b>${esc(c.name)}</b><span class="rank" style="--rank:${rd.rank.color}">${esc(rd.rank.name)}</span></div>
        <div class="dr-habits">${tasks.length ? tasks.map((t) => `<span>${taskIcon(c.id, t)} ${esc(t.title)}${E.timesOf(t) > 1 ? ` ×${E.timesOf(t)}` : ''}</span>`).join('') : '<span class="muted">ما في مهام لسا</span>'}</div>
        ${warLine(c.id)}
        <div class="row wrap">${btn}</div>
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
  const region = state.regions[r.id];
  const next = region ? E.nextRegionUpgrade(state, r.id) : null;
  const stage = c.stages?.[ch.stage];
  return `
  <button class="btn ghost small back" data-go="world">→ العودة للعالم</button>
  <section class="hero card">
    <div class="hero-scene">${regionSVG(r, region ? E.regionFeatures(state, r.id) : new Set(), characterSVG(c, artLevel(ch), { size: 80 }))}</div>
    <div class="hero-info">
      <h2>${c.name} ${stage ? `<button class="lvl lvl-btn" data-ranks="${c.id}" title="اعرض الرتب">${esc(E.rankName(ch))} ▾</button>` : ''}</h2>
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
    <div class="row between"><h3>مهام اليوم</h3>${hasPrayers(c) ? `<button class="chip" data-pick-location>📍 ${state.location ? esc(state.location.name) + ' · تغيير' : 'اختر مدينتك'}</button>` : ''}</div>
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
  const rarity = r.cost?.keys ? 'epic' : 'common';
  let action;
  if (st.owned) action = `<button class="store-btn owned" data-enter-realm="${r.id}">▶ ادخل</button>`;
  else if (locked) action = `<button class="store-btn" disabled>🔒 ${esc(st.conditions.find((x) => !x.met)?.label || 'مقفل')}</button>`;
  else action = `<button class="store-btn buy" data-buy="region:${r.id}" ${st.affordable ? '' : 'disabled'}>${E.costText(r.cost)}</button>`;
  return `
  <article class="realm ${rarity} ${st.owned ? 'is-owned' : ''} ${locked ? 'is-locked' : ''}">
    <div class="realm-art">${art}${st.owned ? '<span class="realm-tag">✔ مملوك</span>' : rarity === 'epic' ? '<span class="realm-tag epic">نادر</span>' : ''}</div>
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
      <h2>🛒 المتجر</h2>
      <div class="store-sub">كل عالم = مكان + شخصيته</div>
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
    hqScene = mountHQ(v, { weather: currentWeather(), places: warPlaces(), owned: CHARACTERS.filter((c) => state.characters[c.id]).map((c) => c.id), hq: E.findRegion('hq').map, rankIndex: cm.rankIndex, ...innerState(), story: { ...state.story, ship: E.shipStage(state) }, ranks: Object.fromEntries(CHARACTERS.filter((c) => state.characters[c.id] && c.stages).map((c) => [c.id, E.rankName(state.characters[c.id])])), tiers: Object.fromEntries(CHARACTERS.filter((c) => state.characters[c.id] && c.stages).map((c) => [c.id, E.totalLevel(state.characters[c.id]) - 1])),
      onStory: (phase) => { if (phase === 'march') act(E.finishSpeech(state)); else { act(E.storyStep(state, phase)); if (phase === 'back') FX.toast('🏝 جزيرة القادة صارت ظاهرة عالخريطة… مسكّرة لحد ما تكمل السفينة'); } }, onRoom: (r) => { document.body.classList.toggle('in-dungeon', r === 'dungeon'); document.body.classList.toggle('in-heaven', r === 'heaven' || r === 'shore'); document.body.classList.toggle('in-gallery', r === 'gallery'); }, sky: skyInfo, onTable: showWarMap, onCommander: showCommandRanks });
    loadWeather();
  } catch (err) { console.warn('3D HQ unavailable', err); v.innerHTML = ''; }
}
// All commander ranks: each one takes KEYS_PER_RANK keys.
function showCommandRanks() {
  const cm = commander(state);
  modal(`
    <h2>🫡 رتب القائد</h2>
    <p class="muted">كل ${KEYS_PER_RANK} مفاتيح تجمعها يترقّى القائد تلقائيًا. جمعت ${cm.keysEarned} 🗝.</p>
    <ol class="path">${COMMAND_RANKS.map(([, name], i) => {
      const cls = i < cm.rankIndex ? 'done' : i === cm.rankIndex ? 'current' : '';
      const need = i === 0 ? 'البداية' : `🗝 ${i * KEYS_PER_RANK} مفاتيح`;
      return `<li class="${cls}" style="--rank:#7a5a1f"><b class="rk">${name}</b><span>${need}</span></li>`;
    }).join('')}</ol>`);
}

// Celebrate when the commander's level went up since the last look.
function checkCommander() {
  const cm = commander(state);
  if (lastCmdLevel != null && cm.level > lastCmdLevel) FX.banner(`ترقية القائد — ${cm.rank}`, `جمعت ${KEYS_PER_RANK} مفاتيح فترقّى القائد تلقائيًا`, '🫡');
  lastCmdLevel = cm.level;
}
// The eight dimensions with their war status.
const warPlaces = () => REGIONS.filter((r) => r.characterId).map((r) => {
  const w = E.warStatus(state, r);
  return { id: r.id, name: r.name, map: r.map, status: w.id, level: w.level, war: w.war, info: w };
});

function showWarMap() {
  if ($('#modal').hidden) SND.sfx.paper();
  const places = warPlaces();
  const count = (id) => places.filter((p) => p.status === id).length;
  const W0 = E.warStart(dayFor()), left = 6 - Math.round((new Date(dayFor()) - new Date(W0)) / 86400000);
  modal(`
    <div class="war-wrap">${warMapSVG(places, E.findRegion('hq').map)}</div>
    <div class="war-legend">${Object.entries(WAR).map(([id, w]) => `<span style="--c:${w.color}">${w.icon} ${w.name} <b>${count(id)}</b></span>`).join('')}</div>
    <p class="muted small-text">⚔ حرب الأسبوع بتخلص ${left ? `بعد ${left} ${left > 2 ? 'أيام' : 'يوم'} (الجمعة)` : 'الليلة'} · اضغط على أي جبهة لترى حالتها · <kbd>E</kbd> للخروج</p>`);
  $('#modal').classList.add('wide');
  modalRefresh = showWarMap;
  document.querySelectorAll('.war-map [data-war]').forEach((el) => (el.onclick = () => showFront(el.dataset.war)));
}

function showFront(id) {
  const r = E.findRegion(id), p = warPlaces().find((x) => x.id === id), w = WAR[p.status];
  const c = E.findCharacter(r.characterId), ch = state.characters[c.id];
  const why = {
    coming: ch ? `اختار أول عادة لـ${c.name} عشان يبلّش يتدرّب.` : `افتح ${r.name} (🗝 ${r.cost?.keys || 0}) لتبدأ هذه الحرب ضد ${KINGS[r.id]}.`,
    training: `بيتدرّب لحد السبت — بعدها أول حرب ضد ${KINGS[r.id]}.`,
    ahead: `متقدّم على ${KINGS[r.id]} — كمّل هيك وبتربح.`,
    behind: `${KINGS[r.id]} متقدّم عليك — بدك نجوم أكثر بالأيام الجاية.`,
    fallen: `الجبهة سقطت بعد ${E.RULES.fallAfter} أيام صفر — حرب هالأسبوع خسرانة.`,
  }[p.status];
  modal(`
    <div class="front" style="--c:${w.color}">
      <div class="front-badge">${w.icon}</div>
      <h2>${r.name}</h2>
      <div class="front-status">${w.name}</div>
      <p>${why}</p>
      ${ch ? warLine(c.id) : ''}
      <div class="row wrap">
        <button class="btn ghost" id="back-map">← الخريطة</button>
        ${ch ? `<button class="btn primary" id="go-front">اذهب إلى الجبهة</button>` : `<button class="btn primary" id="go-front">المتجر</button>`}
      </div>
    </div>`);
  $('#modal').classList.add('wide');
  $('#back-map').onclick = showWarMap;
  $('#go-front').onclick = () => (ch ? enter(c.id) : go('shop'));
}

let reportOpen = false;

// The two prisoners of the dungeon (0..1).
// Future self: grows with every character level and every opened place, rewarded
// for fronts ahead in this week's war, held back by fallen ones.
// Inner child: grows with self-respect in action — won challenge cups (keeping your
// word to yourself), fronts held, and the commander's rank.
function innerState() {
  const places = warPlaces();
  const fallen = places.filter((p) => p.status === 'fallen').length;
  const ahead = places.filter((p) => p.status === 'ahead').length;
  const levels = CHARACTERS.reduce((a, c) => { const ch = state.characters[c.id]; return a + (ch ? E.totalLevel(ch) - 1 : 0); }, 0);
  const opened = places.filter((p) => state.regions[p.id]).length;
  const cups = C.wonCups(state).length;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  return {
    future: clamp((levels * 2 + (opened - 1) * 3 + ahead * 3 - fallen * 4) / 60),
    child: clamp((cups * 8 + ahead * 3 + commander(state).rankIndex * 3 - fallen * 5) / 60),
  };
}
function hqHUD() {
  const cm = commander(state);
  const won = C.wonCups(state).length;
  return `
  <div class="hud-top">
    <div class="plate">
      <div class="plate-avatar" style="--glow:#ffc83d">🫡</div>
      <div class="plate-body">
        <div class="plate-name">القائد <span class="plate-place">· مقر القيادة</span></div>
        <div class="plate-row"><button class="rank" data-cmd-ranks style="--rank:#7a5a1f" title="اعرض كل الرتب">${cm.rank} ▾</button></div>
        <div class="meter" data-cmd-ranks><span class="meter-label">${cm.nextRank ? `🗝 نحو ${cm.nextRank}` : '🎖 أعلى رتبة'}</span><b><bdi>${cm.nextRank ? `${cm.keysInRank}/${KEYS_PER_RANK}` : '✔'}</bdi></b><div class="xp"><span style="width:${Math.round(cm.rankProgress * 100)}%"></span></div></div>
      </div>
    </div>
  </div>
  <button class="hud-chip view-toggle" data-view-mode title="إخفاء اللوحات لمشاهدة القاعة">👁 مشاهدة</button>
  <aside class="cup-side">
    <button class="hud-chip warmap-btn" data-war-map>🗺 خريطة الحرب</button>
    <div class="challenge-card report ${reportOpen ? 'open' : ''}">
      <button class="report-title" data-toggle-report>📋 تقرير القائد <span>${reportOpen ? '▴' : '▾'}</span></button>
      <small class="muted-w">يترقّى لحاله: كل ${KEYS_PER_RANK} مفاتيح تجمعها = رتبة جديدة.</small>
      <div class="report-row"><span>🗺 الأماكن المفتوحة</span><b>${cm.opened.length} / ${cm.places.length}</b></div>
      <ul class="report-list">${cm.places.map((r) => `<li class="${state.regions[r.id] ? 'on' : ''}">${state.regions[r.id] ? '✔' : '🔒'} ${r.name}</li>`).join('')}</ul>
      <div class="report-row"><span>🗝 مفاتيح جمعتها</span><b>${cm.keysEarned}</b></div>
      <div class="report-row"><span>⬆ الشخصيات</span></div>
      <ul class="report-list">${cm.chars.map((c) => `<li class="on">${c.def.name} — ${E.rankName(c.ch)}</li>`).join('')}</ul>
      <div class="report-row"><span>🏆 كؤوس</span><b>${won}</b></div>
      <div class="report-row"><span>🗝 مفاتيح جاهزة</span><b>${state.keys}</b></div>
    </div>
  </aside>
  <div class="dock">
    <button class="dock-btn promote-btn" data-dim-ranks>🎖<span>رتب الأبعاد</span>${CHARACTERS.some((c) => E.road(state, c.id)?.canPromote) ? '<i class="dot"></i>' : ''}</button>
    <button class="dock-btn" data-war-map>🗺<span>خريطة الحرب</span></button>
    <button class="dock-btn" data-go="shop">🛒<span>افتح مكانًا</span></button>
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
    <div class="cup-hero">${cupIcon(cup, 96)}<h2>${cup.name}</h2><p class="muted">${cup.days} يوم · تأمين ${cup.days} دينار (${usd(C.stakeUsd(cup))})${C.keyReward(cup) ? ` · الجائزة 🗝 ${C.keyReward(cup)}` : ''}</p></div>
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
        ${cupIcon(c, 54)}<b>${c.name}</b><span>${c.days} يوم</span><small>${c.days} دينار · ${usd(C.stakeUsd(c))}</small>${C.keyReward(c) ? `<em>🗝 ${C.keyReward(c)}</em>` : ''}${has(c.id) ? '<i>✔</i>' : ''}
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
    if (won) { SND.sfx.fanfare(); FX.banner(`🏆 ${cup.name}`, `مبروك! رجع المبلغ لرصيدك${C.keyReward(cup) ? ` وربحت 🗝 ${C.keyReward(cup)}` : ''}.`, '🏆'); FX.confetti(); }
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

// Failure: no choosing the punishment — say plainly what it will cost when the day closes.
function failDialog(title, penalty, onYes) {
  const sh = state.shields || 0;
  modal(`
    <h2>ما عملتها؟</h2>
    <p><b>${esc(title)}</b></p>
    <p class="muted">الصدق مع نفسك أول خطوة — والنجوم ما إلها قيمة إذا ما كانت حقيقية. هالعادة ما رح تنحسب بنجوم اليوم.
      ${sh ? `إذا البُعد خلص اليوم بصفر نجوم، الدرع 🛡 بيحوّله لنجمة.` : `إذا البُعد خلص اليوم بصفر نجوم، لوسيفر بيغير عليك.`}</p>
    <div class="row wrap">
      <button class="btn bad" id="pen-yes">ما عملتها</button>
      <button class="btn ghost" id="pen-no">رجوع</button>
    </div>`);
  $('#pen-yes').onclick = () => { closeModal(); onYes(); };
  $('#pen-no').onclick = closeModal;
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
  const inWindow = (c, t) => {
    const def = E.activeTasks(E.findCharacter(c), state.characters[c]).find((x) => x.id === t);
    if (!def?.prayer || !state.location) return true;
    const ok = windowState(prayerNow().windows[def.prayer], new Date()) !== 'upcoming';
    if (!ok) { FX.toast('لم يدخل وقت هذه الصلاة بعد', 'err'); render(); }
    return ok;
  };
  on('data-task-ok', (v, el) => {
    const [c, t] = v.split(':');
    if (!inWindow(c, t)) return;
    const r = act(() => E.reportTask(state, c, t, true, { date: dayFor(c) }), el);
    if (r.ok && oasis?.char === c) { oasis.scene.pray(); oasis.scene.react?.('done'); if (c === 'worshipper') SND.sfx.prayer(); }
  });
  on('data-open-upgrades', showUpgrades);
  on('data-dim-ranks', showDimRanks);
  on('data-open-atmo', showAtmosphere);
  on('data-cup-picker', showCupPicker);
  on('data-war-map', showWarMap);
  on('data-replay-attack', () => showAttack(state.lastAttack));
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
  on('data-toggle-quests', () => { questsCollapsed = !questsCollapsed; $('#quests')?.classList.toggle('collapsed', questsCollapsed); });
  on('data-pick-location', pickLocation);
  on('data-task-fail', (v) => {
    const [c, t] = v.split(':');
    const def = E.activeTasks(E.findCharacter(c), state.characters[c]).find((x) => x.id === t);
    failDialog(def.title, 0, () => { const r = act(() => E.reportTask(state, c, t, false, { date: dayFor(c) })); if (r.ok && oasis?.char === c) oasis.scene.react?.('fail'); });
  });
  on('data-cmd-ranks', showCommandRanks);
  on('data-level', (id, el) => act(E.levelUpCharacter(state, id), el));
  on('data-upgrade', (id, el) => act(E.upgradeRegion(state, id), el));
  on('data-buy', (v, el) => { const [k, id] = v.split(':'); act(E.buy(state, k, id), el); });
  on('data-enter-realm', (id) => enter(E.findRegion(id).characterId));
  on('data-go', go);
  on('data-spot', openSpot);
  on('data-ranks', showRanks);
  on('data-edit-task', (v) => { const [c, t] = v.split(':'); pickHabit(c, { mode: 'edit', taskId: t }); });
  on('data-set-tasks', (v) => pickHabit(v.split(':')[0], { mode: 'first' }));
  on('data-promote', (id) => pickHabit(id, { mode: 'promote' }));
}

function go(s) { if (s !== screen) SND.sfx.whoosh(); screen = s; closeModal(); render(); window.scrollTo(0, 0); }

document.querySelectorAll('.nav-btn').forEach((b) => (b.onclick = () => go(b.dataset.screen)));
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
      <button class="btn" data-pick-location>📍 أوقات الصلاة: ${state.location ? esc(state.location.name) : 'غير محددة'}</button>
      ${storage.mode === 'local' ? '<button class="btn" id="logout">تبديل الحساب</button>' : ''}
      <button class="btn bad" id="reset">إعادة اللعبة من البداية</button>
    </div>`);
  $('#modal-body [data-pick-location]').onclick = pickLocation;
  const lo = $('#logout');
  if (lo) lo.onclick = () => { storage.logout(); location.reload(); };
  $('#reset').onclick = () => ask('سيُحذف كل التقدّم. متأكد؟', async () => {
    state = E.demoState(); C.ensure(state); syncClock(); await storage.save(state); currentChar = null; go('world'); FX.toast('بدأت من جديد');
  });
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modal').dataset.closable === 'true') closeModal(); });

boot();

// The key box at the top explains what keys are for.
document.getElementById('keys-box')?.addEventListener('click', () => {
  if (!state) return;
  modal(`
    <h2>🗝 المفاتيح</h2>
    <p>معك <b>${state.keys}${state.keyHalves ? ' ونص' : ''}</b> ${state.keys === 1 ? 'مفتاح' : 'مفاتيح'}.</p>
    <p>بالمفتاح <b>تفتح منطقة جديدة</b> على الخريطة، أو <b>ترفع رتبة</b> شخصية (مثل برونز 1 → برونز 2 فتنضاف مهام الرتبة اللي كتبتها).</p>
    <p>وكل ${KEYS_PER_RANK} مفاتيح تجمعها يترقّى القائد تلقائيًا 🫡.</p>
    <p class="muted">بتكسب مفتاح لما تربح حرب الأسبوع (${E.RULES.warWin} نجمة من 21)، ونص مفتاح إذا قرّبت.</p>
    <button class="btn ghost" id="keys-rules">📜 كل القوانين</button>`);
  $('#keys-rules').onclick = showRules;
});
document.getElementById('shield-box')?.addEventListener('click', () => { if (state) showRules(); });
document.getElementById('medals-box')?.addEventListener('click', () => { if (state) showLeague(); });
