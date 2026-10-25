// The night attack, in 3D: when a day closes, each dimension's warrior (the same model
// as in the Hall of Warriors, in the armour of their rank) charges the dark king's
// castle. Every star is a spear strike; three stars bring the castle down; a zero day
// throws the warrior back (or the shield saves it). If a front was left at zero,
// Lucifer flies in at the end and raids the treasury. Timing runs by the clock, so a
// slow phone shows fewer frames, never a longer scene. The player can skip any time.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { arm } from './heaven3d.js';
import { buildLucifer } from './lucifer3d.js';
import { glowTex } from './env3d.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const ease = (k) => k * k * (3 - 2 * k);

// The dark king's castle: a keep between two towers, red-lit windows, a black and red flag.
function buildCastle() {
  const g = new THREE.Group();
  const stone = std(0x3d3548), dark = std(0x231d2c), roof = std(0x5a1420, { roughness: 0.6 });
  const win = new THREE.MeshBasicMaterial({ color: 0xff5a2c, toneMapped: false });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  box(5.2, 3.6, 3.4, stone, 0, 1.8, 0);
  for (let i = 0; i < 6; i++) box(0.55, 0.6, 3.4, dark, -2.3 + i * 0.92, 3.9, 0);
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 5.6, 12), stone); t.position.set(sx * 3, 2.8, 0); t.castShadow = true; g.add(t);
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.9, 12), roof); r.position.set(sx * 3, 6.55, 0); g.add(r);
    box(0.28, 0.6, 0.1, win, sx * 3, 3.8, 1.18);
  }
  box(1.3, 1.9, 0.15, std(0x0d0910), 0, 0.95, 1.72);   // the gate
  for (const x of [-1.6, 1.6]) box(0.36, 0.7, 0.1, win, x, 2.5, 1.72);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), dark); pole.position.set(3, 8.6, 0); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 8, 2), std(0x1a0a0e, { side: THREE.DoubleSide, emissive: 0x5a0a12, emissiveIntensity: 0.5 })); flag.position.set(3.72, 9.3, 0); g.add(flag);
  const fire = new THREE.PointLight(0xff4a20, 6, 14, 1.6); fire.position.set(0, 3, 3); g.add(fire);
  // Cracks that appear with each hit.
  const crackM = new THREE.MeshBasicMaterial({ color: 0x07050a });
  const cracks = [[-1.4, 2.2, 0.6], [1.2, 1.4, -0.5], [0.1, 2.9, 0.2]].map(([x, y, r]) => {
    const c = new THREE.Group(); c.position.set(x, y, 1.71); c.rotation.z = r; c.visible = false; g.add(c);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.6), crackM); s.position.set(i * 0.12, -i * 0.42, 0.01); s.rotation.z = (i % 2 ? 0.6 : -0.5); c.add(s); }
    return c;
  });
  return { g, flag, fire, cracks };
}

export function playAttack({ fights, raid, shields }, { warrior, sfx = {}, onDone }) {
  current?.skip();
  const root = document.createElement('div'); root.className = 'atk atk3d';
  root.innerHTML = `
    <div class="atk-flash"></div>
    <div class="atk-hud">
      <div class="atk-title"></div>
      <div class="atk-stars"><i></i><i></i><i></i></div>
      <div class="atk-pct"></div>
      <div class="atk-cap"></div>
    </div>
    <div class="atk-sum" hidden></div>
    <button class="atk-skip">تخطّي ⏭</button>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const starEls = [...root.querySelectorAll('.atk-stars i')], flashEl = q('.atk-flash');

  // ---------- the 3D stage ----------
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { root.remove(); onDone?.(); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  root.prepend(renderer.domElement); renderer.domElement.className = 'atk-canvas';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0b22); scene.fog = new THREE.FogExp2(0x15122e, 0.022);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 62 : 42; camera.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  // Night sky: stars and a big moon.
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.2, r = 150; starPos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 20], i * 3); }
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)), new THREE.PointsMaterial({ color: 0xfff8e0, size: 0.7, fog: false })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshBasicMaterial({ color: 0xfff3cc, fog: false })); moon.position.set(-38, 34, -90); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); moonGlow.scale.setScalar(40); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  scene.add(new THREE.HemisphereLight(0x8a94d8, 0x1a1408, 0.9));
  const moonL = new THREE.DirectionalLight(0xcfd8ff, 1.6); moonL.position.set(-12, 20, 10); moonL.castShadow = true; moonL.shadow.mapSize.set(1024, 1024);
  Object.assign(moonL.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 }); scene.add(moonL);
  // Ground: a dark field with rocks, and torches along the way.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std(0x22281a)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.2), std(0x3a3020)); path.rotation.x = -Math.PI / 2; path.position.set(-1, 0.01, 0); path.receiveShadow = true; scene.add(path);
  for (let i = 0; i < 26; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.6), std(0x3b3a40)); r.position.set(-18 + Math.random() * 34, 0.1, (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 9)); r.castShadow = true; scene.add(r); }
  const torches = [-8, -2, 3].map((x) => { const t = new THREE.Group(); t.position.set(x, 0, -2.2); scene.add(t);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), std(0x3a2414)); s.position.y = 0.8; t.add(s);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.scale.setScalar(0.9); f.position.y = 1.75; t.add(f);
    const l = new THREE.PointLight(0xff7a2a, 3, 7, 1.8); l.position.y = 1.8; t.add(l); return { f, l }; });
  const castle = buildCastle(); castle.g.position.set(7, 0, 0); castle.g.rotation.y = -0.9; scene.add(castle.g);   // half toward the warrior, half toward the camera
  // Dust and sparks for the hits.
  const N = 120, dPos = new Float32Array(N * 3), dVel = Array.from({ length: N }, () => new THREE.Vector3());
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dPos, 3)), new THREE.PointsMaterial({ map: glowTex, color: 0xffb060, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; scene.add(dust); let dustK = 0;
  const burst = (x, y, z, n = 60, power = 4) => { dustK = 1; for (let i = 0; i < N; i++) { dPos.set(i < n ? [x, y, z] : [0, -50, 0], i * 3); dVel[i].set(-Math.random() * power, Math.random() * power, (Math.random() - 0.5) * power); } };
  // The warrior and Lucifer.
  let hero = null, spear = null;
  const luci = buildLucifer(); luci.root.visible = false; scene.add(luci.root);
  if (window.__nmnDebug) window.__atk = { luci, camera, hero: () => hero };
  const setWarrior = (id) => {
    if (hero) scene.remove(hero.root);
    const w = warrior(id); hero = buildWorshipper(w.palette); arm(hero, w.palette, false, w.tier);
    spear = hero.armour?.[0] || null;
    if (spear) { spear.position.y = 1.05; spear.children.forEach((c) => (c.position.y -= 1.05)); }   // turn the spear at the hand, not at its foot
    hero.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    hero.root.rotation.y = Math.PI / 2; hero.root.position.set(-10, 0, 0); scene.add(hero.root);
  };

  // ---------- clock, tweens and the camera ----------
  const ctl = { skip: false, wake: [] };
  const tweens = new Set();
  const animate = (ms, fn) => new Promise((res) => { if (ctl.skip) return res(); const tw = { t0: performance.now(), ms, fn, res }; tweens.add(tw); ctl.wake.push(() => { tweens.delete(tw); res(); }); });
  const wait = (ms) => animate(ms, () => {});
  const cam = { pos: new THREE.Vector3(-4, 3.2, 13), look: new THREE.Vector3(0, 1.6, 0), shake: 0 };
  const camTo = (pos, look, ms = 900) => { const p0 = cam.pos.clone(), l0 = cam.look.clone(); return animate(ms, (k) => { const e = ease(k); cam.pos.lerpVectors(p0, pos, e); cam.look.lerpVectors(l0, look, e); }); };
  let walk = 0, luciMood = 'idle', raf = 0, last = performance.now(), lift = 0;   // lift: the spear arm raised (0..1)
  const clock0 = performance.now();
  const tick = () => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = (now - clock0) / 1000; last = now;
    for (const tw of [...tweens]) { const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(k); if (k >= 1) { tweens.delete(tw); tw.res(); } }
    hero?.update(t, dt, walk, false);
    if (hero && lift) { const a = hero.arms[1]; a.sh.rotation.x = -1.5 * lift; a.el.rotation.x = -0.4 * lift; }
    if (luci.root.visible) luci.tick(t, dt, luciMood, 1);
    const fp = castle.flag.geometry.attributes.position; for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(t * 5 + fp.getX(i) * 4) * 0.12 * (fp.getX(i) + 0.7)); fp.needsUpdate = true;
    castle.fire.intensity = 5 + Math.sin(t * 13) * 1.2;
    torches.forEach((x, i) => { x.l.intensity = 2.6 + Math.sin(t * 11 + i * 2) * 0.6; x.f.scale.setScalar(0.85 + Math.sin(t * 15 + i) * 0.08); });
    if (dustK > 0) { dustK = Math.max(0, dustK - dt * 0.8); for (let i = 0; i < N; i++) { const v = dVel[i]; v.y -= dt * 7; dPos[i * 3] += v.x * dt; dPos[i * 3 + 1] = Math.max(0.05, dPos[i * 3 + 1] + v.y * dt); dPos[i * 3 + 2] += v.z * dt; } dust.geometry.attributes.position.needsUpdate = true; dust.material.opacity = dustK; }
    cam.shake *= 0.86;
    // On a tall phone screen the camera stands further back so the warrior and the castle both fit.
    const back = camera.aspect < 1 ? 1 / Math.sqrt(Math.max(0.45, camera.aspect)) : 1;
    camera.position.copy(cam.look).addScaledVector(cam.pos.clone().sub(cam.look), back).add(new THREE.Vector3((Math.random() - 0.5) * cam.shake, (Math.random() - 0.5) * cam.shake, 0));
    camera.lookAt(cam.look);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const finish = () => {
    if (!root.isConnected) return;
    cancelAnimationFrame(raf); removeEventListener('resize', resize);
    scene.traverse((o) => { o.geometry?.dispose?.(); });
    renderer.dispose(); renderer.forceContextLoss?.(); root.remove();
    if (current?.root === root) current = null;
    onDone?.();
  };
  q('.atk-skip').onclick = () => { ctl.skip = true; ctl.wake.splice(0).forEach((f) => f()); finish(); };
  const play = (k) => { if (!ctl.skip) sfx[k]?.(); };
  const flash = () => { flashEl.className = 'atk-flash on'; setTimeout(() => (flashEl.className = 'atk-flash'), 120); };

  // One spear strike: draw back, lunge, the castle shakes.
  const strike = async (i) => {
    const x0 = hero.root.position.x;
    await animate(180, (k) => { const e = ease(k); lift = e; if (spear) spear.rotation.x = -0.35 * e; hero.root.position.x = x0 - 0.3 * e; });
    await animate(120, (k) => { const e = ease(k); if (spear) spear.rotation.x = -0.35 + 1.75 * e; hero.root.position.x = x0 - 0.3 + 1.1 * e; });
    flash(); cam.shake = 0.35; play('wood'); burst(5.6, 1.2 + i * 0.7, 1.1, 50, 5);
    castle.cracks[i].visible = true; castle.g.position.x = 7.12;
    starEls[i].className = 'on'; play('coin');
    await animate(280, (k) => { const e = ease(k); lift = 1 - e; if (spear) spear.rotation.x = 1.4 * (1 - e); hero.root.position.x = x0 + 0.8 * (1 - e); castle.g.position.x = 7 + 0.12 * (1 - k); });
    lift = 0;
  };

  (async () => {
    for (const f of fights) {
      if (ctl.skip) return;
      setWarrior(f.id);
      castle.g.scale.set(1, 1, 1); castle.g.rotation.z = 0; castle.g.position.set(7, 0, 0); castle.cracks.forEach((c) => (c.visible = false));
      starEls.forEach((s) => (s.className = '')); root.classList.remove('won', 'pushed', 'raid');
      q('.atk-title').textContent = `⚔ ${f.name} ضد ${f.king}`;
      q('.atk-pct').textContent = ''; q('.atk-cap').textContent = f.training ? '🌱 تدريب — الحرب بتبلّش السبت' : '';
      cam.pos.set(-13, 2.8, 10); cam.look.set(-7, 1.6, 0);
      // The charge, the camera alongside.
      walk = 1; play('whoosh');
      const x0 = -10;
      await Promise.all([
        animate(1900, (k) => { hero.root.position.x = x0 + 13 * ease(k); }),   // right up to the gate
        camTo(new THREE.Vector3(1.5, 3.6, 13), new THREE.Vector3(5, 2.8, 0), 1900),
      ]);
      walk = 0;
      const hits = f.shield ? 0 : f.stars;
      for (let i = 0; i < hits; i++) await strike(i);
      q('.atk-pct').textContent = `${Math.round((f.share || 0) * 100)}%`;
      if (f.shield) {
        q('.atk-cap').textContent = '🛡 الدرع حوّل يوم الصفر لنجمة';
        await wait(300); starEls[0].className = 'on shield'; play('key'); await wait(1200);
      } else if (hits === 3) {
        root.classList.add('won'); q('.atk-cap').textContent = `🏆 دمّرت قلعة ${f.king}!`; play('fanfare');
        burst(6.4, 1.5, 0.6, 120, 7); cam.shake = 0.6;
        await Promise.all([
          animate(1300, (k) => { const e = ease(k); castle.g.scale.y = 1 - 0.72 * e; castle.g.rotation.z = -0.12 * e; }),
          camTo(new THREE.Vector3(0, 6, 15), new THREE.Vector3(5, 2, 0), 1300),
        ]);
        await animate(700, (k) => { hero.root.position.y = Math.sin(k * Math.PI) * 0.5; });   // a jump of joy
        await wait(500);
      } else if (hits) {
        q('.atk-cap').textContent = `القلعة صمدت — ${hits === 2 ? 'قرّبت!' : 'بدك ضربات أكثر'}`;
        await wait(1300);
      } else {
        // Thrown back by the castle's fire.
        root.classList.add('pushed'); q('.atk-cap').textContent = `${f.king} صدّك — صفر نجوم`; play('lose');
        flash(); burst(4.5, 1, 0, 40, 3); cam.shake = 0.3;
        const xs = hero.root.position.x;
        await animate(600, (k) => { const e = ease(k); hero.root.position.x = xs - 3 * e; hero.root.position.y = Math.sin(k * Math.PI) * 0.6; hero.root.rotation.z = 0.5 * e; });
        await wait(900);
        hero.root.rotation.z = 0;
      }
    }
    if (ctl.skip) return;
    if (raid && (raid.gold || raid.medals)) {
      root.classList.add('raid'); q('.atk-title').textContent = '😈 غارة لوسيفر';
      q('.atk-cap').textContent = `سرق −${raid.gold} 🪙 و −${raid.medals} 🎖`; starEls.forEach((s) => (s.className = 'off')); q('.atk-pct').textContent = '';
      luci.root.visible = true; luci.setOpacity(1); luciMood = 'happy'; play('lose');
      camTo(new THREE.Vector3(1, 3.8, 14), new THREE.Vector3(1, 3, 0), 900);
      await animate(2200, (k) => { const e = ease(k); luci.root.position.set(11 - 22 * e, 4.4 - Math.sin(k * Math.PI) * 2.2, 1.5); luci.root.rotation.y = -Math.PI / 2; if (Math.abs(k - 0.5) < 0.02) burst(0, 2.4, 1.5, 70, 4); });
      luci.root.visible = false;
    }
    if (ctl.skip) return;
    const sum = q('.atk-sum');
    sum.innerHTML = `<h3>🌙 نتيجة هجوم الليلة</h3>${fights.map((f) => `<p><span>${f.name}</span><b>${'⭐'.repeat(f.stars)}${'☆'.repeat(3 - f.stars)}</b></p>`).join('')}${shields != null ? `<small>🛡 معك ${shields}</small>` : ''}<button class="atk-ok">تمام</button>`;
    sum.hidden = false; q('.atk-skip').hidden = true;
    q('.atk-ok').onclick = finish;
  })();
  current = { root, skip: () => q('.atk-skip').click() };
  return current;
}
let current = null;   // the scene on screen (a new one closes it first)
