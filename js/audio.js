// Procedural sound: every sound is synthesised with Web Audio (no files).
// Channels: master, music, ambience, effects, ui, voice-like chimes — each with its own volume.
// Ambience follows the scene: crickets and owls at night, birds by day, wind, sea,
// rain, thunder, fire in the headquarters, water in the palace fountain.

const KEY = 'nmn-sound';
const DEFAULTS = {
  enabled: true, master: 0.8,
  music: 0.35, ambience: 0.7, effects: 0.8, ui: 0.6,
  crickets: 1, birds: 1, wind: 1, sea: 1, rain: 1, thunder: 1, fire: 1, water: 1,
  steps: 1, prayer: 1, rewards: 1,
};
export const SOUND_LABELS = {
  music: '🎵 الموسيقى', ambience: '🌿 أصوات الطبيعة', effects: '✨ المؤثرات', ui: '🖱 أزرار الواجهة',
  crickets: '🦗 الصراصير (الليل)', birds: '🐦 العصافير (النهار)', wind: '💨 الريح', sea: '🌊 البحر',
  rain: '🌧 المطر', thunder: '⛈ الرعد', fire: '🔥 النار والمشاعل', water: '⛲ النافورة والشلال',
  steps: '👣 خطوات ونط', prayer: '🕌 الصلاة', rewards: '🪙 الذهب والمكافآت',
};
export const MAIN = ['music', 'ambience', 'effects', 'ui'];
export const DETAIL = ['crickets', 'birds', 'wind', 'sea', 'rain', 'thunder', 'fire', 'water', 'steps', 'prayer', 'rewards'];

let S = { ...DEFAULTS };
try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
export const settings = () => ({ ...S });
export function set(k, v) {
  S[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
  applyVolumes();
}

let ctx = null, out, bus = {}, noiseBuf;
let scene = { screen: 'world', night: 0, rain: 0, snow: 0, storm: false, wind: 0.3 };
const amb = {};   // running ambience layers

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  out = ctx.createGain(); out.connect(ctx.destination);
  for (const b of ['music', 'ambience', 'effects', 'ui']) { bus[b] = ctx.createGain(); bus[b].connect(out); }
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  startAmbience();
  return ctx;
}
// Browsers only allow audio after a user gesture.
export function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { passive: true }));

function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  out.gain.setTargetAtTime(S.enabled ? S.master : 0, t, 0.05);
  for (const b in bus) bus[b].gain.setTargetAtTime(S[b], t, 0.05);
  updateAmbience();
}

// ---------- building blocks ----------
const now = () => ctx.currentTime;
function tone({ f = 440, f2, type = 'sine', dur = 0.2, vol = 0.3, at = 0, b = 'effects', attack = 0.005, cat }) {
  if (!ensure() || (cat && !S[cat])) return;
  const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * (cat ? S[cat] : 1), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus[b]); o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.3, at = 0, b = 'effects', filter = 'bandpass', freq = 1000, q = 1, attack = 0.005, cat }) {
  if (!ensure() || (cat && !S[cat])) return;
  const t = now() + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; f.type = filter; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * (cat ? S[cat] : 1), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus[b]); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

// ---------- one-shot sounds ----------
export const sfx = {
  click: () => tone({ f: 900, f2: 700, dur: 0.06, vol: 0.15, b: 'ui', type: 'triangle' }),
  open: () => { tone({ f: 500, f2: 800, dur: 0.12, vol: 0.12, b: 'ui', type: 'triangle' }); },
  close: () => tone({ f: 700, f2: 450, dur: 0.1, vol: 0.1, b: 'ui', type: 'triangle' }),
  coin: () => { [1320, 1760].forEach((f, i) => tone({ f, dur: 0.18, vol: 0.18, at: i * 0.07, type: 'square', cat: 'rewards' })); },
  lose: () => { tone({ f: 300, f2: 140, dur: 0.4, vol: 0.2, type: 'sawtooth', cat: 'rewards' }); },
  key: () => { [880, 1175, 1568, 2093].forEach((f, i) => tone({ f, dur: 0.35, vol: 0.14, at: i * 0.09, type: 'triangle', cat: 'rewards' })); },
  levelUp: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, dur: 0.5, vol: 0.16, at: i * 0.1, type: 'triangle', cat: 'rewards' })); noise({ dur: 1.2, vol: 0.06, freq: 6000, q: 0.5, at: 0.3, cat: 'rewards' }); },
  fanfare: () => { [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [659, 0.6], [784, 0.75]].forEach(([f, a]) => { tone({ f, dur: 0.35, vol: 0.13, at: a, type: 'sawtooth', cat: 'rewards' }); tone({ f: f / 2, dur: 0.35, vol: 0.1, at: a, type: 'triangle', cat: 'rewards' }); }); },
  unlock: () => { noise({ dur: 0.12, vol: 0.2, freq: 2500, q: 4 }); [659, 988, 1319].forEach((f, i) => tone({ f, dur: 0.6, vol: 0.13, at: 0.12 + i * 0.12, type: 'sine', cat: 'rewards' })); },
  // A soft bell-like chord for prayer.
  prayer: () => { [[392, 0], [494, 0.02], [587, 0.04], [784, 0.9]].forEach(([f, a]) => { tone({ f, dur: 3, vol: 0.12, at: a, type: 'sine', attack: 0.3, cat: 'prayer' }); tone({ f: f * 2.01, dur: 2, vol: 0.03, at: a, attack: 0.3, cat: 'prayer' }); }); },
  jump: () => { tone({ f: 220, f2: 520, dur: 0.18, vol: 0.12, type: 'triangle', cat: 'steps' }); noise({ dur: 0.1, vol: 0.08, freq: 800, cat: 'steps' }); },
  land: () => noise({ dur: 0.12, vol: 0.18, freq: 300, q: 1, filter: 'lowpass', cat: 'steps' }),
  step: () => noise({ dur: 0.07, vol: 0.09, freq: 500 + Math.random() * 300, q: 2, cat: 'steps' }),
  wave: () => { tone({ f: 660, f2: 880, dur: 0.25, vol: 0.1, type: 'sine' }); },
  paper: () => { noise({ dur: 0.35, vol: 0.15, freq: 3500, q: 0.8 }); noise({ dur: 0.2, vol: 0.1, freq: 2000, q: 1, at: 0.15 }); },
  thunder: () => { if (!S.thunder) return; noise({ dur: 3.5, vol: 0.55, freq: 120, q: 0.7, filter: 'lowpass', attack: 0.05, b: 'ambience', cat: 'thunder' }); noise({ dur: 0.4, vol: 0.3, freq: 900, q: 0.5, b: 'ambience', cat: 'thunder' }); },
  meteor: () => tone({ f: 2400, f2: 600, dur: 0.9, vol: 0.03, type: 'sine', b: 'ambience' }),
  whoosh: () => noise({ dur: 0.6, vol: 0.14, freq: 700, q: 0.8, attack: 0.2, b: 'ui' }),
};

// Map game events to sounds.
export function playEvents(events) {
  for (const ev of events) {
    if (ev.type === 'gold') sfx.coin();
    if (ev.type === 'penalty') sfx.lose();
    if (ev.type === 'key') sfx.key();
    if (ev.type === 'levelUp' || ev.type === 'rank') sfx.levelUp();
    if (ev.type === 'perfectDay') sfx.fanfare();
    if (ev.type === 'unlock') sfx.unlock();
    if (ev.type === 'cupWon') sfx.fanfare();
  }
}

// ---------- ambience ----------
function loopNoise(freq, q, filter = 'bandpass') {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = filter; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(bus.ambience); src.start();
  return { g, f };
}
function startAmbience() {
  amb.wind = loopNoise(400, 0.4, 'lowpass');
  amb.sea = loopNoise(600, 0.3, 'lowpass');
  amb.rain = loopNoise(3000, 0.4, 'highpass');
  amb.fire = loopNoise(1200, 0.8);
  amb.water = loopNoise(2500, 0.6);
  // Soft drone pad for music: two detuned sines + fifth, slowly breathing.
  amb.pad = ctx.createGain(); amb.pad.gain.value = 0; amb.pad.connect(bus.music);
  amb.padOsc = [];
  for (const f of [110, 110.6, 164.8, 220.4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(amb.pad); o.start(); amb.padOsc.push(o); }
  // Animated ambience: wind gusts, sea swell, fire crackles, crickets, birds, owls, melody notes.
  let tick = 0;
  setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !S.enabled) return;
    tick++;
    const t = now(), sc = scene;
    const gust = 0.6 + Math.sin(t * 0.3) * 0.3 + Math.sin(t * 0.77) * 0.2;
    amb.wind.f.frequency.setTargetAtTime(250 + gust * 300, t, 0.5);
    amb.sea.g.gain.setTargetAtTime(seaVol() * (0.6 + Math.sin(t * 0.5) * 0.4), t, 0.6);
    // crickets: fast chirp trains at night outdoors
    if (sc.night > 0.5 && !sc.rain && !sc.snow && sc.outdoor && S.crickets) {
      if (Math.random() < 0.55) { const base = 4200 + Math.random() * 600, n = 3 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) tone({ f: base, dur: 0.035, vol: 0.05 * sc.night, at: i * 0.055 + Math.random() * 0.2, type: 'sine', b: 'ambience', cat: 'crickets' }); }
      if (Math.random() < 0.012) { tone({ f: 420, f2: 380, dur: 0.5, vol: 0.06, type: 'sine', b: 'ambience', attack: 0.1 }); tone({ f: 400, f2: 360, dur: 0.7, vol: 0.06, at: 0.6, type: 'sine', b: 'ambience', attack: 0.1 }); } // owl
    }
    // birds by day
    if (sc.night < 0.3 && !sc.rain && sc.outdoor && S.birds && Math.random() < 0.08) {
      const f0 = 2200 + Math.random() * 1800, n = 2 + (Math.random() * 4 | 0);
      for (let i = 0; i < n; i++) tone({ f: f0 * (1 + Math.random() * 0.3), f2: f0 * (0.7 + Math.random() * 0.6), dur: 0.08 + Math.random() * 0.08, vol: 0.05, at: i * 0.12, type: 'sine', b: 'ambience', cat: 'birds' });
    }
    // fire crackles in the headquarters
    if (sc.screen === 'hq' && S.fire && Math.random() < 0.5) noise({ dur: 0.03, vol: 0.2 + Math.random() * 0.2, freq: 1500 + Math.random() * 3000, q: 3, b: 'ambience', cat: 'fire' });
    // thunder in storms
    if (sc.storm && Math.random() < 0.012) sfx.thunder();
    // gentle melody notes over the pad (pentatonic, sparse)
    if (S.music && tick % 7 === 0 && Math.random() < 0.6) { const scale = sc.night > 0.5 ? [220, 247, 294, 330, 392] : [262, 294, 330, 392, 440]; const f = scale[(Math.random() * 5) | 0] * (Math.random() < 0.3 ? 2 : 1); tone({ f, dur: 2.5, vol: 0.05, type: 'sine', b: 'music', attack: 0.4 }); }
  }, 200);
  updateAmbience();
}
const seaVol = () => (scene.screen === 'world' || scene.screen === 'trophies' ? 0.25 : 0) * S.sea;
function updateAmbience() {
  if (!ctx || !amb.wind) return;
  const t = now(), sc = scene;
  const set = (a, v) => a.g.gain.setTargetAtTime(v, t, 0.8);
  set(amb.wind, (sc.outdoor ? 0.08 + sc.wind * 0.18 + (sc.screen === 'trophies' ? 0.12 : 0) : 0.02) * S.wind);
  set(amb.rain, (sc.rain ? 0.12 + sc.rain * 0.1 : 0) * (sc.outdoor ? 1 : 0.3) * S.rain);
  set(amb.fire, (sc.screen === 'hq' ? 0.05 : 0) * S.fire);
  set(amb.water, ((sc.screen === 'character' ? 0.035 : 0) + (sc.screen === 'trophies' ? 0.03 : 0)) * S.water);
  amb.pad.gain.setTargetAtTime(sc.screen === 'hq' ? 0.9 : 0.7, t, 1.5);
  amb.padOsc.forEach((o, i) => o.frequency.setTargetAtTime([110, 110.6, 164.8, 220.4][i] * (sc.night > 0.5 ? 0.89 : 1), t, 2));
}
// Called by the game whenever the screen, time or weather changes.
export function setScene(patch) {
  scene = { ...scene, ...patch };
  scene.outdoor = scene.screen !== 'hq' && scene.screen !== 'shop';
  updateAmbience();
}

// ---------- inner child crying (volume follows distance) ----------
// Each sob is a short voiced "waa" (sawtooth through two vocal formants with a
// trembling pitch), followed by a breathy gasp. A scheduler keeps them coming
// while the level is above zero; the level sets the bus volume.
let cryBus = null, cryLevel = 0, cryTimer = null;
function sobOnce() {
  const t = now(), len = 0.8 + Math.random() * 0.7, base = 430 + Math.random() * 90;
  const o = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain();
  const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), env = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base * 0.9, t); o.frequency.linearRampToValueAtTime(base * 1.3, t + 0.2); o.frequency.exponentialRampToValueAtTime(base * 0.75, t + len);
  vib.frequency.value = 7; vg.gain.value = 22; vib.connect(vg); vg.connect(o.frequency);
  f1.type = 'peaking'; f1.frequency.value = 1000; f1.Q.value = 3; f1.gain.value = 14;
  f2.type = 'peaking'; f2.frequency.value = 2700; f2.Q.value = 4; f2.gain.value = 10;
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.35, t + 0.08); env.gain.setValueAtTime(0.35, t + len * 0.55); env.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(f1); f1.connect(f2); f2.connect(env); env.connect(cryBus);
  o.start(t); vib.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05);
  // gasp
  const src = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  src.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = 1600; nf.Q.value = 1.2;
  const g0 = t + len + 0.12; ng.gain.setValueAtTime(0, g0); ng.gain.linearRampToValueAtTime(0.25, g0 + 0.06); ng.gain.exponentialRampToValueAtTime(0.001, g0 + 0.3);
  src.connect(nf); nf.connect(ng); ng.connect(cryBus); src.start(g0, Math.random()); src.stop(g0 + 0.35);
  return len + 0.45 + Math.random() * 0.5;
}
export function setCry(level) {
  if (!ensure()) return;
  if (!cryBus) { cryBus = ctx.createGain(); cryBus.gain.value = 0; cryBus.connect(out); }
  cryLevel = S.enabled ? Math.max(0, Math.min(1, level)) : 0;
  cryBus.gain.setTargetAtTime(cryLevel * S.ambience * 1.2, now(), 0.15);
  if (cryLevel > 0.01 && !cryTimer) {
    const loop = () => { if (cryLevel <= 0.01) { cryTimer = null; return; } cryTimer = setTimeout(loop, sobOnce() * 1000); };
    loop();
  }
}
// Old wooden door: stick-slip creaks of an iron hinge, a groan, then the heavy thud.
export const creak = () => {
  if (!ensure()) return;
  const t0 = now();
  const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; bp.type = 'bandpass'; bp.Q.value = 9; g.gain.value = 0;
  o.connect(bp); bp.connect(g); g.connect(bus.effects);
  // stick-slip: rapid little bursts with wandering pitch
  let t = t0;
  for (let i = 0; i < 38; i++) {
    const f = 55 + Math.sin(i * 0.35) * 25 + Math.random() * 20;
    o.frequency.setValueAtTime(f, t); bp.frequency.setValueAtTime(700 + Math.sin(i * 0.2) * 300 + Math.random() * 200, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35 + Math.random() * 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.02, t + 0.035 + Math.random() * 0.02);
    t += 0.035 + Math.random() * 0.03 + (i > 25 ? 0.02 : 0);
  }
  o.start(t0); o.stop(t + 0.2);
  noise({ dur: 1.4, vol: 0.08, freq: 350, q: 2, attack: 0.3 });                                  // wood groan
  noise({ dur: 0.7, vol: 0.5, freq: 110, q: 0.7, filter: 'lowpass', at: t - t0 + 0.05 });        // thud
  tone({ f: 70, f2: 40, dur: 0.5, vol: 0.3, at: t - t0 + 0.05, type: 'sine' });
  tone({ f: 1900, dur: 0.25, vol: 0.04, at: t - t0 + 0.08, type: 'triangle' });                  // latch clink
};
export const chains = () => { if (!ensure()) return; for (let i = 0; i < 5; i++) tone({ f: 2000 + Math.random() * 1500, dur: 0.12, vol: 0.05, at: i * 0.07, type: 'square', b: 'ambience' }); };
