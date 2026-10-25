// The Void Kings' camp: a battle in the Clash of Clans way. A small camp at dusk —
// a tent, a fire with ten small void kings sitting around it, two banners and a pile
// of crates. The player taps the ground (outside the camp's edge) to drop the troops
// from the selected card. Archers shoot the nearest enemy, then the camp's buildings;
// the void kings jump up and rush the archers.
// Stars: ⭐ every void king down · ⭐⭐ the tent destroyed · ⭐⭐⭐ the whole camp (100%).
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildVoidKing, buildArcher, makeArrow, makeSoul, hpBars } from './units3d.js';
import { glowTex } from './env3d.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const EDGE = 7.5;   // troops land outside this radius

function tent() {
  const g = new THREE.Group();
  const cloth = std(0x5a2e6a, { side: THREE.DoubleSide }), stripe = std(0x2a1238, { side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 8, 1, true), cloth); body.position.y = 1.7; body.castShadow = true; g.add(body);
  for (let i = 0; i < 8; i += 2) { const s = new THREE.Mesh(new THREE.ConeGeometry(2.62, 3.42, 8, 1, true, (i / 8) * Math.PI * 2, Math.PI / 8), stripe); s.position.y = 1.7; g.add(s); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), std(0x0c0610)); door.position.set(0, 0.65, 2.05); door.rotation.x = -0.32; g.add(door);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), std(0x2a1a10)); pole.position.y = 3.8; g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), std(0x1a0a20, { emissive: 0x6a2fa0, emissiveIntensity: 0.6, side: THREE.DoubleSide })); flag.position.set(0.37, 4.1, 0); g.add(flag);
  return g;
}
function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.1, 6), std(0x4a2e18)); l.rotation.set(Math.PI / 2 - 0.5, (i / 5) * Math.PI * 2, 0); l.position.y = 0.2; g.add(l); }
  for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), std(0x55505a)); const a = (i / 8) * Math.PI * 2; st.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); g.add(st); }
  const flames = [0xffc040, 0xff7a20, 0xff4a10].map((c, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(1.4 - i * 0.3); s.position.y = 0.6 + i * 0.25; g.add(s); return s; });
  const light = new THREE.PointLight(0xff8a3a, 10, 16, 1.6); light.position.y = 1; g.add(light);
  g.userData.tick = (t, on) => { flames.forEach((f, i) => { f.visible = on; f.scale.setScalar((1.4 - i * 0.3) * (0.85 + Math.sin(t * 13 + i) * 0.12)); }); light.intensity = on ? 9 + Math.sin(t * 17) * 2 : 0; };
  return g;
}
function banner() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3, 6), std(0x2a1a10)); p.position.y = 1.5; p.castShadow = true; g.add(p);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), std(0x2a1238, { emissive: 0x5a1a8a, emissiveIntensity: 0.5, side: THREE.DoubleSide })); f.position.set(0.47, 2.3, 0); g.add(f);
  return g;
}
function crates() {
  const g = new THREE.Group();
  for (const [x, y, z, s] of [[0, 0.35, 0, 0.7], [0.75, 0.3, 0.2, 0.6], [0.35, 0.95, 0.1, 0.55]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), std(0x8a6236)); c.position.set(x, y, z); c.rotation.y = x; c.castShadow = true; g.add(c); }
  return g;
}

export function mountCamp(container, { troops = [{ type: 'archer', count: 2 }], onStar, onPercent, onDeploy, onEnd } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2a4a); scene.fog = new THREE.Fog(0x3a2a4a, 30, 80);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
  scene.add(new THREE.HemisphereLight(0xb8a0d8, 0x3a2a1a, 1.1));
  const sun = new THREE.DirectionalLight(0xffb27a, 1.6); sun.position.set(-14, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 }); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), std(0x7a6a52)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(EDGE - 0.4, 48), std(0x5a4a3a)); dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.01; dirt.receiveShadow = true; scene.add(dirt);
  // The camp's edge: a faint red ring (no troops inside).
  const ring = new THREE.Mesh(new THREE.RingGeometry(EDGE - 0.08, EDGE + 0.08, 64), new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.45 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
  for (let i = 0; i < 40; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.8), std(0x5a5560)); const a = Math.random() * Math.PI * 2, d = 13 + Math.random() * 20; r.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d); r.castShadow = true; scene.add(r); }
  for (let i = 0; i < 30; i++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.8 + Math.random() * 0.5, 3 + Math.random() * 2, 7), std(0x2e3a2a)); const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 16; tr.position.set(Math.cos(a) * d, 1.6, Math.sin(a) * d); scene.add(tr); }

  // Close on the camp (it fills the screen); drag to move, pinch / wheel to zoom, like Clash.
  const LOOK = new THREE.Vector3(0, 0, 4.5), camera0 = new THREE.Vector3(0, 13.5, 12.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.screenSpacePanning = false; controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minDistance = 9; controls.maxDistance = 34;
  let framed = false;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 60 : 40; camera.updateProjectionMatrix();
    if (!framed) { framed = true; controls.target.copy(LOOK); camera.position.copy(LOOK).add(camera0.clone().multiplyScalar(w / h < 0.8 ? 1.12 : 1)); controls.update(); }
  };
  controls.addEventListener('change', () => { const t = controls.target; const d = Math.hypot(t.x, t.z - 4.5); if (d > 12) { const k = 12 / d, nx = t.x * k, nz = 4.5 + (t.z - 4.5) * k; camera.position.x += nx - t.x; camera.position.z += nz - t.z; t.x = nx; t.z = nz; } });
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  const bars = hpBars(container);

  // ---------- the camp ----------
  const build = (obj, x, z, hp, name, r) => { obj.position.set(x, 0, z); scene.add(obj); const b = { obj, hp, max: hp, name, r, alive: true }; b.bar = bars.add(obj, { y: name === 'tent' ? 4.3 : 3, max: hp, color: '#ffb02e' }); b.bar.el.classList.add('hp-building'); return b; };
  const fire = campfire();
  const blds = [
    build(tent(), 0, -2.4, 30, 'tent', 2.4),
    build(fire, 0, 1.4, 12, 'fire', 0.9),
    build(banner(), -4, 2.6, 8, 'banner', 0.5),
    build(banner(), 4.2, 2.2, 8, 'banner', 0.5),
    build(crates(), 3.4, -1.2, 10, 'crates', 0.8),
  ];
  const totalHp = blds.reduce((a, b) => a + b.max, 0);
  // Ten small void kings sitting around the fire.
  const foes = Array.from({ length: 10 }, (_, k) => {
    const h = buildVoidKing(); const a = (k / 10) * Math.PI * 2;
    h.root.position.set(Math.cos(a) * 2.1, 0, 1.4 + Math.sin(a) * 2.1); h.root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    h.kneel(999); scene.add(h.root);
    return { h, alive: true, awake: false, hitT: Math.random() * 0.5 };
  });

  // ---------- troops ----------
  const cards = troops.map((t) => ({ ...t }));
  let sel = 0;
  const army = [];
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const N = 160, pPos = new Float32Array(N * 3).fill(-99), pCol = new Float32Array(N * 3), pVel = Array.from({ length: N }, () => new THREE.Vector3());
  const pGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3)).setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); parts.frustumCulled = false; scene.add(parts);
  let pNext = 0;
  const burst = (x, y, z, color, n = 20, power = 3) => { const c = new THREE.Color(color); for (let k = 0; k < n; k++) { const i = pNext++ % N; pPos.set([x, y, z], i * 3); pCol.set([c.r, c.g, c.b], i * 3); pVel[i].set((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power); } pGeo.attributes.color.needsUpdate = true; };
  const deploy = (p) => {
    const c = cards[sel];
    if (!c || c.count <= 0) return false;
    // Inside the red ring? Push the drop point out to the edge.
    const d = Math.hypot(p.x, p.z - 0);
    if (d < EDGE + 0.4) { const k = (EDGE + 0.6) / (d || 1); p.x *= k; p.z *= k; }
    c.count--;
    const a = buildArcher(); a.root.position.set(p.x, 3, p.z); scene.add(a.root);
    const u = { a, pos: a.root.position, hp: 60, cd: 0.4, drop: 1, target: null };
    u.bar = bars.add(a.root, { y: 2.3, max: 60 });
    army.push(u);
    burst(p.x, 0.3, p.z, 0xfff0c0, 24, 2.5);
    onDeploy?.(cards.map((x) => x.count), army.length);
    return true;
  };
  const el = renderer.domElement;
  let downAt = null;
  el.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8 || ended) return;
    const r = el.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera); if (ray.ray.intersectPlane(plane, hit)) deploy(hit.clone());
  });

  // ---------- the fight ----------
  const flights = [], souls = [], fades = [];
  let stars = 0, ended = false, pct = 0;
  const giveStar = (n) => { while (stars < n) { stars++; onStar?.(stars); } };
  const damageBuilding = (b, d) => {
    if (!b.alive) return;
    b.hp -= d; b.bar.set(b.hp); burst(b.obj.position.x, 1.2, b.obj.position.z, 0xffc060, 8, 2.5);
    if (b.hp <= 0) {
      b.alive = false; b.bar.remove(); burst(b.obj.position.x, 1, b.obj.position.z, 0x9a8a70, 50, 4);
      fades.push({ obj: b.obj, t0: performance.now(), ms: 700, sink: true });
      if (b.name === 'tent' && stars >= 1) giveStar(2);
    }
    const left = blds.reduce((a, x) => a + Math.max(0, x.alive ? x.hp : 0), 0);
    pct = Math.round((1 - left / totalHp) * 100); onPercent?.(pct);
    if (pct >= 100) { if (foes.every((f) => !f.alive)) giveStar(3); }
  };
  const killFoe = (f, now) => {
    f.alive = false; f.bar?.remove();
    burst(f.h.root.position.x, 0.8, f.h.root.position.z, 0xc9a0ff, 14, 2.5);
    const s = makeSoul(); s.position.copy(f.h.root.position).setY(0.8); scene.add(s); souls.push({ s, t0: now });
    fades.push({ h: f.h, t0: now, ms: 500 });
    if (foes.every((x) => !x.alive)) { giveStar(1); if (!blds.find((b) => b.name === 'tent').alive) giveStar(2); if (pct >= 100) giveStar(3); }
  };
  const nearest = (from, list) => { let best = null, bd = 1e9; for (const x of list) { const p = x.h ? x.h.root.position : x.obj.position; const d = Math.hypot(p.x - from.x, p.z - from.z) - (x.r || 0); if (d < bd) { bd = d; best = x; } } return [best, bd]; };
  const RANGE = 6.5, SPEED = 2.4, FOE_SPEED = 2.8;
  const clock = new THREE.Clock(); let raf;
  const tmp = new THREE.Vector3();
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
    fire.userData.tick(t, blds[1].alive);
    // Archers: land, then shoot the nearest void king (or building), walking closer if needed.
    for (const u of army) {
      if (u.hp <= 0) continue;
      if (u.drop > 0) { u.drop = Math.max(0, u.drop - dt * 3); u.pos.y = u.drop * 3; u.a.update(t, dt, 0, u.drop > 0); continue; }
      const liveFoes = foes.filter((f) => f.alive), liveB = blds.filter((b) => b.alive);
      const [tg, d] = liveFoes.length ? nearest(u.pos, liveFoes) : nearest(u.pos, liveB);
      if (!tg) { u.a.update(t, dt, 0, false); continue; }
      const tp = tg.h ? tg.h.root.position : tg.obj.position;
      u.a.root.rotation.y = Math.atan2(tp.x - u.pos.x, tp.z - u.pos.z);
      let walk = 0;
      if (d > RANGE) { const dd = Math.hypot(tp.x - u.pos.x, tp.z - u.pos.z); u.pos.x += ((tp.x - u.pos.x) / dd) * SPEED * dt; u.pos.z += ((tp.z - u.pos.z) / dd) * SPEED * dt; walk = 1; }
      u.a.update(t, dt, walk, false);
      u.cd -= dt;
      if (d <= RANGE && u.cd <= 0) { u.cd = 0.62; u.aimK = 1; const arrow = makeArrow(); scene.add(arrow); flights.push({ arrow, from: new THREE.Vector3(u.pos.x, 1.6, u.pos.z), tg, t0: now, ms: 330 }); }
      if (u.aimK) { u.aimK = Math.max(0, u.aimK - dt * 2.5); u.a.aim(Math.min(1, u.aimK * 1.6)); }
    }
    // Void kings: wake when the first troop lands, rush the nearest archer, hit it.
    const alive = army.filter((u) => u.hp > 0 && u.drop <= 0);
    for (const f of foes) {
      if (!f.alive) continue;
      if (!f.awake && alive.length) { f.awake = true; f.h.stop(); f.bar = bars.add(f.h.root, { y: 2.6, max: 1, color: '#c070ff' }); f.bar.el.classList.add('hp-small'); }
      if (!f.awake || !alive.length) { f.h.update(t, dt, 0, false); continue; }
      let tu = null, bd = 1e9; for (const u of alive) { const d = Math.hypot(u.pos.x - f.h.root.position.x, u.pos.z - f.h.root.position.z); if (d < bd) { bd = d; tu = u; } }
      const p = f.h.root.position; p.y = 0;
      f.h.root.rotation.y = Math.atan2(tu.pos.x - p.x, tu.pos.z - p.z);
      if (bd > 1.3) { p.x += ((tu.pos.x - p.x) / bd) * FOE_SPEED * dt; p.z += ((tu.pos.z - p.z) / bd) * FOE_SPEED * dt; f.h.update(t, dt, 1, false); }
      else { f.h.update(t, dt, 0, false); f.hitT -= dt; if (f.hitT <= 0) { f.hitT = 0.9; tu.hp -= 3; tu.bar.set(tu.hp); burst(tu.pos.x, 1.2, tu.pos.z, 0xff5050, 5, 2); if (tu.hp <= 0) { tu.bar.remove(); fades.push({ h: { root: tu.a.root }, t0: now, ms: 600, sink: true }); } } }
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], k = Math.min(1, (now - f.t0) / f.ms);
      const to = f.tg.h ? tmp.copy(f.tg.h.root.position).setY(0.6) : tmp.copy(f.tg.obj.position).setY(1.2);
      const x = f.from.x + (to.x - f.from.x) * k, z = f.from.z + (to.z - f.from.z) * k, y = f.from.y + (to.y - f.from.y) * k + Math.sin(k * Math.PI) * 1;
      f.arrow.lookAt(x, y, z); f.arrow.position.set(x, y, z);
      if (k >= 1) { scene.remove(f.arrow); flights.splice(i, 1); if (f.tg.h) { if (f.tg.alive) killFoe(f.tg, now); } else damageBuilding(f.tg, 1); }
    }
    for (let i = souls.length - 1; i >= 0; i--) { const s = souls[i], k = (now - s.t0) / 1600; s.s.position.y = 0.8 + k * 3.5; s.s.material.opacity = 0.9 * (1 - k); if (k >= 1) { scene.remove(s.s); souls.splice(i, 1); } }
    for (let i = fades.length - 1; i >= 0; i--) { const f = fades[i], k = Math.min(1, (now - f.t0) / f.ms); if (f.h?.setOpacity) f.h.setOpacity(1 - k); if (f.sink) { const o = f.obj || f.h.root; o.position.y = -k * 1.5; o.scale.y = Math.max(0.05, 1 - k * 0.8); } if (k >= 1) { fades.splice(i, 1); scene.remove(f.obj || f.h.root); } }
    for (let i = 0; i < N; i++) { const v = pVel[i]; v.y -= dt * 5; pPos[i * 3] += v.x * dt; pPos[i * 3 + 1] = Math.max(0.05, pPos[i * 3 + 1] + v.y * dt); pPos[i * 3 + 2] += v.z * dt; }
    pGeo.attributes.position.needsUpdate = true;
    // The end: everything down (or every troop lost with none left to send).
    if (!ended) {
      const allDown = stars >= 3;
      const lost = army.length && army.every((u) => u.hp <= 0) && cards.every((c) => c.count <= 0);
      if (allDown || lost) { ended = true; setTimeout(() => onEnd?.({ stars, pct }), allDown ? 1400 : 900); }
    }
    controls.update();
    renderer.render(scene, camera);
    bars.place(camera, container.clientWidth, container.clientHeight);
    raf = requestAnimationFrame(tick);
  };
  tick();
  const v = new THREE.Vector3();
  return {
    cards,
    select(i) { sel = i; },
    // A good spot to tap first (shown by the tutorial hand): outside the ring, in front.
    // Beside the camp (left for the first tap, right for the second), clear of the card bar.
    // On a tall phone screen there is room in front of the camp instead.
    hintPoint(n = 0) { if (camera.aspect < 0.8) v.set(n ? 2.2 : -2.2, 0, EDGE + 2.5); else v.set(n ? 3.4 : -3.4, 0, EDGE + 1.1); v.project(camera); return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight }; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); bars.dispose(); scene.traverse((o) => o.geometry?.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); el.remove(); },
  };
}
