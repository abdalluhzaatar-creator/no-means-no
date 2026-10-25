// The spiritual dimension as a base (Clash of Clans style): a wide sunny plaza seen from
// above at an angle, a mosque, a fountain, gardens and palms around it, and a grid on
// which buildings stand. Drag to move the view, pinch / wheel to zoom.
// It also runs the base's fights: void kings walk in from the edge, the archer shoots them.
// The tutorial (onboard.js) drives it through the API returned by mountVillage.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { palm, cypress, orangeTree, flowerBed, lantern, fountain, minaret } from './oasis3d.js';
import { buildGuide, buildVoidKing, buildArcher, makeArrow, makeSoul, hpBars } from './units3d.js';
import { glowTex } from './env3d.js';

export const GRID = 40;                  // cells per side (one cell = 1 unit)
const HALF = GRID / 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const cellCenter = (i, j, n = 3) => new THREE.Vector3(i + n / 2 - HALF, 0, j + n / 2 - HALF);

function tileTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#efe4cc'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#e6d8bb' : '#f3ead6'; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); }
  g.strokeStyle = '#c9b48a'; g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 40, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(GRID / 4, GRID / 4); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The mosque at the heart of the base.
function mosque() {
  const g = new THREE.Group();
  const stone = std(0xf4ead4, { roughness: 0.6 }), teal = std(0x2f7a8a, { roughness: 0.35, metalness: 0.2 }), gold = std(0xd4a53a, { metalness: 0.9, roughness: 0.25 });
  const add = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 8), stone), 0, 2.1, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 1, 24), stone), 0, 4.7, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(3.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), teal), 0, 5.2, 0);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), gold), 0, 8.8, 0);
  for (const x of [-2.6, 0, 2.6]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.2), std(0x3a2a1a)); add(arch, x, 1.3, 4.01);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16, 1, false, 0, Math.PI), std(0x3a2a1a)); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); add(top, x, 2.6, 4.01);
  }
  for (const [x, z] of [[-4.2, -3.6], [4.2, -3.6]]) { const m = minaret(); m.scale.setScalar(1.25); m.position.set(x, 0, z); g.add(m); }
  return g;
}

export function mountVillage(container, { buildings = [], onTapGround } = {}) {
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd3f0); scene.fog = new THREE.Fog(0xcfe6f2, 70, 160);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb59a6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.position.set(20, 34, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 }); sun.shadow.bias = -0.0005; scene.add(sun);

  // Ground: desert sand, the marble plaza (the grid), a green border.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), std(0xe3cf9e, { roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.y = -0.02; sand.receiveShadow = true; scene.add(sand);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(GRID + 12, GRID + 12), std(0x6fae4a, { roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.01; lawn.receiveShadow = true; scene.add(lawn);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.5 })); plaza.rotation.x = -Math.PI / 2; plaza.receiveShadow = true; scene.add(plaza);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(GRID + 1, 0.3, GRID + 1), std(0xd9c49a)); rim.position.y = -0.14; scene.add(rim);
  // The grid lines, shown while placing a building.
  const gridLines = new THREE.GridHelper(GRID, GRID, 0x6a8f4a, 0x6a8f4a); gridLines.position.y = 0.02; gridLines.material.transparent = true; gridLines.material.opacity = 0.35; gridLines.visible = false; scene.add(gridLines);

  // Cells taken by the landmarks (i, j, w, d in cells).
  const taken = new Set();
  const take = (i, j, w, d) => { for (let x = i; x < i + w; x++) for (let z = j; z < j + d; z++) taken.add(`${x},${z}`); };
  const ms = mosque(); ms.position.set(0, 0, -11); scene.add(ms); take(14, 3, 12, 11);
  const fo = fountain(); fo.position.set(0, 0, 1); fo.scale.setScalar(1.3); scene.add(fo); take(17, 18, 6, 6);
  const tickers = [fo];
  for (const [x, z] of [[-7, 4], [7, 4], [-12, -4], [12, -4]]) { const fb = flowerBed(4, 2, rand); fb.position.set(x, 0, z); scene.add(fb); take(x + HALF - 2, z + HALF - 1, 4, 2); }
  for (const [x, z] of [[-4, 6], [4, 6], [-10, 10], [10, 10], [-15, -12], [15, -12]]) { const l = lantern(); l.position.set(x, 0, z); l.userData.light.intensity = 0; scene.add(l); take(x + HALF, z + HALF, 1, 1); }
  // Trees all around the plaza: palms, cypresses, orange trees.
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2, r = HALF + 3 + rand() * 6;
    const t = k % 3 === 0 ? cypress(rand) : k % 3 === 1 ? palm(rand, 6 + rand() * 3) : orangeTree(rand);
    t.position.set(Math.cos(a) * r * 1.02, 0, Math.sin(a) * r); t.rotation.y = rand() * 6; scene.add(t);
  }

  // ---------- camera: Clash-style angle, drag to pan, pinch / wheel to zoom ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.screenSpacePanning = false; controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minDistance = 16; controls.maxDistance = 70;
  const VIEW = new THREE.Vector3(24, 30, 26);
  const look = (x, z, dist = 1) => { controls.target.set(x, 0, z); camera.position.set(x, 0, z).addScaledVector(VIEW, dist); controls.update(); };
  look(0, 2, 1);
  controls.addEventListener('change', () => { const t = controls.target, cx = THREE.MathUtils.clamp(t.x, -HALF, HALF) - t.x, cz = THREE.MathUtils.clamp(t.z, -HALF, HALF) - t.z; if (cx || cz) { t.x += cx; t.z += cz; camera.position.x += cx; camera.position.z += cz; } });
  // Fly the view to a point (used by the tutorial).
  let fly = null;
  const flyTo = (x, z, dist = 0.8, ms = 900) => new Promise((res) => { fly = { t0: performance.now(), ms, a: controls.target.clone(), b: new THREE.Vector3(x, 0, z), da: camera.position.distanceTo(controls.target), db: VIEW.length() * dist, res }; });

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 52 : 38; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const bars = hpBars(container);
  // People: the guide stands by the fountain.
  const guide = buildGuide(); guide.root.position.set(5, 0, 7); guide.root.rotation.y = 0.75; scene.add(guide.root);
  const units = [guide];

  // ---------- buildings ----------
  const placed = [];
  const free = (i, j, n = 3) => { if (i < 0 || j < 0 || i + n > GRID || j + n > GRID) return false; for (let x = i; x < i + n; x++) for (let z = j; z < j + n; z++) if (taken.has(`${x},${z}`)) return false; return true; };
  const platform = () => { const p = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.8), std(0xcdb88e)); base.position.y = 0.25; base.castShadow = base.receiveShadow = true; p.add(base); const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2.4), std(0x8a6a44)); top.position.y = 0.56; p.add(top); return p; };
  let archer = null, archerBar = null;
  const addArcher = (i, j, { pop = false } = {}) => {
    take(i, j, 3, 3);
    const g = new THREE.Group(); g.position.copy(cellCenter(i, j)); scene.add(g);
    g.add(platform());
    const a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.75; g.add(a.root);
    archer = { g, a, i, j }; units.push(a);
    archerBar = bars.add(g, { y: 3.3, max: 100 });
    placed.push({ type: 'archer', i, j });
    if (pop) { g.scale.setScalar(0.01); popIn.push({ g, t0: performance.now() }); burst(g.position.x, 0.6, g.position.z, 0xfff0c0, 40); }
    return archer;
  };
  const popIn = [];
  for (const b of buildings) if (b.type === 'archer') addArcher(b.i, b.j);

  // ---------- placing a building (3×3 cells under it, green when the spot is free) ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const groundAt = (e) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.ray.intersectPlane(groundPlane, hit) ? hit.clone() : null; };
  let placing = null;
  const startPlacing = (i0, j0, onMove) => {
    const g = new THREE.Group(); scene.add(g);
    const tiles = []; const tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0x3ad86a, transparent: true, opacity: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set((k % 3) - 1, 0.04, Math.floor(k / 3) - 1); g.add(m); tiles.push(m); }
    const ghost = new THREE.Group(); g.add(ghost); ghost.add(platform()); const a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.75; ghost.add(a.root); units.push(a);
    ghost.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.75; } });
    placing = { g, tiles, a, i: i0, j: j0, ok: true, onMove, drag: false };
    gridLines.visible = true;
    setPlace(i0, j0);
  };
  const setPlace = (i, j) => {
    if (!placing) return;
    i = THREE.MathUtils.clamp(i, 0, GRID - 3); j = THREE.MathUtils.clamp(j, 0, GRID - 3);
    placing.i = i; placing.j = j; placing.ok = free(i, j);
    placing.g.position.copy(cellCenter(i, j));
    placing.tiles.forEach((t) => t.material.color.set(placing.ok ? 0x3ad86a : 0xff4a3a));
    placing.onMove?.(placing.ok);
  };
  const endPlacing = () => { if (!placing) return; scene.remove(placing.g); units.splice(units.indexOf(placing.a), 1); placing = null; gridLines.visible = false; controls.enabled = true; };
  const cellOf = (p) => [Math.round(p.x + HALF - 1.5), Math.round(p.z + HALF - 1.5)];
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (!placing) return;
    const p = groundAt(e);
    if (p && Math.abs(p.x - placing.g.position.x) < 2 && Math.abs(p.z - placing.g.position.z) < 2) { placing.drag = true; controls.enabled = false; }
  });
  el.addEventListener('pointermove', (e) => { if (placing?.drag) { const p = groundAt(e); if (p) { const [i, j] = cellOf(p); if (i !== placing.i || j !== placing.j) setPlace(i, j); } } });
  const up = (e) => {
    if (!placing) { const p = onTapGround && groundAt(e); if (p) onTapGround(p); return; }
    if (placing.drag) { placing.drag = false; controls.enabled = true; return; }
  };
  el.addEventListener('pointerup', up);
  // A tap (not a drag) on the ground moves the building there too — easier on a phone.
  let downAt = null;
  el.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  el.addEventListener('click', (e) => { if (!placing || placing.drag || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; const p = groundAt(e); if (p) { const [i, j] = cellOf(p); setPlace(i, j); } });

  // ---------- construction ----------
  let site = null;
  const startSite = (i, j) => {
    const g = new THREE.Group(); g.position.copy(cellCenter(i, j)); scene.add(g);
    g.add(platform());
    const wood = std(0x9a7444);
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood); p.position.set(x, 1.2, z); g.add(p); }
    for (const y of [1.2, 2.3]) for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), wood); b.position.y = y; b.rotation.y = r; g.add(b); const b2 = b.clone(); b2.position.set(r ? 1.2 : 0, y, r ? 0 : 1.2); g.add(b2); }
    take(i, j, 3, 3);
    site = { g, i, j };
    return g;
  };
  const finishSite = () => { if (!site) return; const { i, j } = site; scene.remove(site.g); for (let x = i; x < i + 3; x++) for (let z = j; z < j + 3; z++) taken.delete(`${x},${z}`); site = null; return addArcher(i, j, { pop: true }); };

  // ---------- effects ----------
  const N = 160, pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pVel = Array.from({ length: N }, () => new THREE.Vector3());
  const pGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3)).setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  parts.frustumCulled = false; scene.add(parts); let pK = 0, pNext = 0;
  pPos.fill(-99);
  const burst = (x, y, z, color, n = 30, power = 3) => { pK = 1; const c = new THREE.Color(color); for (let k = 0; k < n; k++) { const i = pNext++ % N; pPos.set([x, y, z], i * 3); pCol.set([c.r, c.g, c.b], i * 3); pVel[i].set((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power); } pGeo.attributes.color.needsUpdate = true; };
  const flights = [], souls = [], heals = [];

  // ---------- the King of the Void and the defence ----------
  const KING_AT = new THREE.Vector3(-15, 0, 12);
  let king = null;
  const showKing = () => { if (king) return king; king = buildVoidKing({ big: true }); king.root.position.copy(KING_AT); king.root.rotation.y = 0.9; scene.add(king.root); units.push(king); burst(KING_AT.x, 1.5, KING_AT.z, 0xa060ff, 60, 4); return king; };
  const hideKing = () => { if (!king) return; const k = king; fades.push({ h: k, t0: performance.now(), ms: 900, after: () => { scene.remove(k.root); units.splice(units.indexOf(k), 1); } }); king = null; };
  const fades = [];
  let fight = null;
  const defend = () => new Promise((resolve) => {
    const foes = [];
    for (let k = 0; k < 10; k++) {
      const h = buildVoidKing(); const a = (k / 10) * 1.6 - 0.8;
      h.root.position.set(KING_AT.x + Math.cos(a) * 2 + 2, 0, KING_AT.z + Math.sin(a) * 2 - 2); h.setOpacity(0); scene.add(h.root); units.push(h);
      foes.push({ h, alive: true, born: performance.now() + k * 380, hitT: 0 });
    }
    fight = { foes, cd: 0.6, resolve, done: false };
  });
  const SPEED = 2.6, RANGE = 11, REACH = 1.7;
  const fightTick = (dt, now) => {
    const f = fight; if (!f || !archer) return;
    const ap = archer.g.position;
    let target = null, best = 1e9;
    for (const e of f.foes) {
      if (!e.alive) continue;
      if (now < e.born) continue;
      if (!e.shown) { e.shown = true; e.h.setOpacity(1); burst(e.h.root.position.x, 0.8, e.h.root.position.z, 0xa060ff, 10); }
      const p = e.h.root.position, d = Math.hypot(p.x - ap.x, p.z - ap.z);
      e.h.root.rotation.y = Math.atan2(ap.x - p.x, ap.z - p.z);
      if (d > REACH) { p.x += ((ap.x - p.x) / d) * SPEED * dt; p.z += ((ap.z - p.z) / d) * SPEED * dt; e.walk = 1; }
      else { e.walk = 0; e.hitT -= dt; if (e.hitT <= 0) { e.hitT = 0.8; archerBar.set(archerBar.hp - 4); burst(ap.x, 1.4, ap.z, 0xff5050, 6, 2); e.h.wave?.(); } }
      if (d < RANGE && d < best && !e.targeted) { best = d; target = e; }
    }
    f.cd -= dt;
    if (target && f.cd <= 0) {
      f.cd = 0.72; target.targeted = true;
      archer.a.root.rotation.y = Math.atan2(target.h.root.position.x - ap.x, target.h.root.position.z - ap.z) - archer.g.rotation.y;
      archer.aimK = 1;
      const arrow = makeArrow(); scene.add(arrow);
      flights.push({ arrow, from: new THREE.Vector3(ap.x, 2.2, ap.z), foe: target, t0: now, ms: 340 });
    }
    if (f.foes.every((e) => !e.alive) && !flights.length && !f.done) { f.done = true; setTimeout(() => { fight = null; f.resolve(); }, 600); }
  };
  const kill = (e, now) => {
    e.alive = false; burst(e.h.root.position.x, 0.8, e.h.root.position.z, 0xc9a0ff, 14, 2.5);
    const s = makeSoul(); s.position.copy(e.h.root.position).setY(0.8); scene.add(s); souls.push({ s, t0: now });
    fades.push({ h: e.h, t0: now, ms: 500, after: () => { scene.remove(e.h.root); units.splice(units.indexOf(e.h), 1); } });
  };
  // The archer heals: kneels, a bandage, green crosses rising, the bar fills.
  const heal = (ms = 3200) => new Promise((resolve) => {
    if (!archer) return resolve();
    archer.a.kneel(ms / 1000 - 1.5); archer.a.bandage.visible = true;
    heals.push({ t0: performance.now(), ms, from: archerBar.hp, resolve });
  });

  // ---------- frame loop ----------
  const clock = new THREE.Clock(); let raf;
  const tmp = new THREE.Vector3();
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
    if (fly) { const k = Math.min(1, (now - fly.t0) / fly.ms), e = k * k * (3 - 2 * k); controls.target.lerpVectors(fly.a, fly.b, e); const d = fly.da + (fly.db - fly.da) * e; camera.position.copy(controls.target).addScaledVector(VIEW.clone().normalize(), d); if (k >= 1) { const r = fly.res; fly = null; r(); } }
    controls.update();
    for (const u of units) u.update(t, dt, u === guide ? 0 : (fight?.foes.find((e) => e.h === u)?.walk || 0), false);
    if (archer?.aimK) { archer.aimK = Math.max(0, archer.aimK - dt * 2.5); archer.a.aim(Math.min(1, archer.aimK * 1.6)); }
    tickers.forEach((o) => o.userData.tick?.(t));
    for (const p of popIn.splice(0)) { const k = Math.min(1, (now - p.t0) / 500); p.g.scale.setScalar(0.01 + 0.99 * (1 - (1 - k) ** 3) * (1 + Math.sin(k * Math.PI) * 0.15)); if (k < 1) popIn.push(p); }
    fightTick(dt, now);
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], k = Math.min(1, (now - f.t0) / f.ms), to = tmp.copy(f.foe.h.root.position).setY(0.6);
      const x = f.from.x + (to.x - f.from.x) * k, z = f.from.z + (to.z - f.from.z) * k, y = f.from.y + (to.y - f.from.y) * k + Math.sin(k * Math.PI) * 1.2;
      f.arrow.lookAt(x, y, z); f.arrow.position.set(x, y, z);
      if (k >= 1) { scene.remove(f.arrow); flights.splice(i, 1); kill(f.foe, now); }
    }
    for (let i = souls.length - 1; i >= 0; i--) { const s = souls[i], k = (now - s.t0) / 1600; s.s.position.y = 0.8 + k * 3.5; s.s.material.opacity = 0.9 * (1 - k); if (k >= 1) { scene.remove(s.s); souls.splice(i, 1); } }
    for (let i = fades.length - 1; i >= 0; i--) { const f = fades[i], k = Math.min(1, (now - f.t0) / f.ms); f.h.setOpacity?.(1 - k); if (k >= 1) { fades.splice(i, 1); f.after?.(); } }
    for (let i = heals.length - 1; i >= 0; i--) {
      const h = heals[i], k = Math.min(1, (now - h.t0) / h.ms);
      archerBar.set(h.from + (100 - h.from) * k);
      if (Math.random() < 0.3) burst(archer.g.position.x + (Math.random() - 0.5), 1.2, archer.g.position.z + (Math.random() - 0.5), 0x5aff7a, 1, 1.2);
      if (k >= 1) { heals.splice(i, 1); archer.a.bandage.visible = false; h.resolve(); }
    }
    if (pK > 0) { for (let i = 0; i < N; i++) { const v = pVel[i]; v.y -= dt * 5; pPos[i * 3] += v.x * dt; pPos[i * 3 + 1] = Math.max(0.05, pPos[i * 3 + 1] + v.y * dt); pPos[i * 3 + 2] += v.z * dt; } pGeo.attributes.position.needsUpdate = true; }
    renderer.render(scene, camera);
    bars.place(camera, container.clientWidth, container.clientHeight);
    raf = requestAnimationFrame(tick);
  };
  tick();

  const v = new THREE.Vector3();
  return {
    scene, camera,
    // Where a 3D point (or object, with a height above it) shows on the screen.
    screenOf(obj, y = 0) { (obj.isVector3 ? v.copy(obj) : v.copy(obj.position)).add(new THREE.Vector3(0, y, 0)).project(camera); return { x: (v.x * 0.5 + 0.5) * container.clientWidth, y: (-v.y * 0.5 + 0.5) * container.clientHeight, front: v.z < 1 }; },
    guide, flyTo, look,
    get king() { return king; }, showKing, hideKing,
    get archer() { return archer; }, get archerHp() { return archerBar?.hp ?? 0; },
    // Placing: a ghost with 3×3 cells under it; onMove(ok) tells whether the spot is free.
    startPlacing, endPlacing, get placing() { return placing; },
    startSite, finishSite, get site() { return site; },
    defend, heal, burst,
    buildings: () => placed.slice(),
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); bars.dispose(); controls.dispose(); scene.traverse((o) => o.geometry?.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove(); },
  };
}
