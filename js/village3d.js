// The spiritual dimension as a base, in the Clash of Clans way: a 44×44 map with the
// marble floor of the spiritual dimension (light and dark squares with teal inlays),
// grass around it and green hills far off, seen from above at an angle. The Town Hall
// (a square hall with a dome) stands in the middle; trees are scattered over the map as
// obstacles the player clears with gold. Drag to move the view, pinch / wheel to zoom.
// It also runs the base's fights: void kings come out of a portal, the archer shoots them.
// The tutorial (onboard.js) drives it through the API returned by mountVillage.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { palm, cypress, orangeTree } from './oasis3d.js';
import { buildVoidKing, buildArcher, makeArrow, makeSoul, hpBars } from './units3d.js';
import { glowTex } from './env3d.js';

export const GRID = 44;                  // cells per side, as in Clash (one cell = 1 unit)
const HALF = GRID / 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const cellCenter = (i, j, n = 3) => new THREE.Vector3(i + n / 2 - HALF, 0, j + n / 2 - HALF);

// The spiritual dimension's marble: light and dark squares, veins, a teal diamond at each corner.
function marbleTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  const n = 4, s = 512 / n;
  let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#e3ddd0'; g.fillRect(i * s, j * s, s, s);
    g.strokeStyle = 'rgba(150,140,125,.25)'; g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(i * s + r() * s, j * s); g.bezierCurveTo(i * s + r() * s, j * s + s / 3, i * s + r() * s, j * s + s / 1.5, i * s + r() * s, j * s + s); g.stroke(); }
    g.fillStyle = '#3f7d6e'; g.save(); g.translate(i * s, j * s); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(GRID / 4, GRID / 4); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// The Town Hall: a square hall with a dome, in the spiritual dimension's colours (4×4 cells).
function townHall() {
  const g = new THREE.Group();
  const plaster = std(0xf3ece0, { roughness: 0.75 }), stone = std(0xeadfc8), teal = std(0x2f7a8a, { roughness: 0.3, metalness: 0.25 }), gold = std(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), dark = std(0x2d2a28);
  const add = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.35, 3.9), stone), 0, 0.17, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3.4), plaster), 0, 1.55, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 3.6), teal), 0, 2.85, 0);
  for (const [x, z] of [[-1.62, -1.62], [1.62, -1.62], [-1.62, 1.62], [1.62, 1.62]]) { add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), stone), x, 3.15, z); add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), gold), x, 3.6, z); }
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.45, 24), plaster), 0, 3.18, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), teal), 0, 3.4, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), gold), 0, 4.7, 0);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8), gold), 0, 5, 0);
  // A door and windows on every side.
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group(); side.rotation.y = (k * Math.PI) / 2; g.add(side);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), dark); door.position.set(0, 0.95, 1.72); side.add(door);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16, 1, false, -Math.PI / 2, Math.PI), dark); arch.rotation.x = Math.PI / 2; arch.position.set(0, 1.6, 1.72); side.add(arch);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16, Math.PI), gold); frame.position.set(0, 1.6, 1.74); side.add(frame);
    for (const x of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.05), teal); w.position.set(x, 1.9, 1.72); side.add(w); }
  }
  return g;
}

// Trees that stand on the map (cleared with gold): kind → model, name, price.
const OBSTACLES = {
  palm: { make: (r) => palm(r, 5.5 + r() * 2.5), name: 'نخلة', cost: 150 },
  cypress: { make: (r) => cypress(r), name: 'سروة', cost: 100 },
  orange: { make: (r) => orangeTree(r), name: 'شجرة برتقال', cost: 200 },
};

export function mountVillage(container, { buildings = [], cleared = [], th: thAt = null, onTapGround, onObstacle, onTownHall, onArcher, onMoved } = {}) {
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9d6ee); scene.fog = new THREE.Fog(0xd8e8ee, 110, 260);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6); sun.position.set(22, 40, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 }); sun.shadow.bias = -0.0005; scene.add(sun);

  // Ground: grass all around, green hills far off, the marble map (the grid) raised a little.
  const grass = new THREE.Mesh(new THREE.CircleGeometry(420, 64), std(0x6d9a4a, { roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; grass.receiveShadow = true; scene.add(grass);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 150 + rand() * 90;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(50 + rand() * 50, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7fa35a, { roughness: 1 }));
    hill.position.set(Math.cos(a) * r, -8, Math.sin(a) * r); hill.scale.y = 0.35 + rand() * 0.3; scene.add(hill);
  }
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(GRID, 0.3, GRID), [std(0xeadfc8), std(0xeadfc8), new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.35, metalness: 0.05 }), std(0xeadfc8), std(0xeadfc8), std(0xeadfc8)]);
  plaza.position.y = -0.15; plaza.receiveShadow = true; scene.add(plaza);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(GRID + 0.6, 0.18, GRID + 0.6), std(0x2f7a8a, { roughness: 0.4 })); trim.position.y = -0.2; scene.add(trim);
  // The grid lines, shown while placing a building.
  const gridLines = new THREE.GridHelper(GRID, GRID, 0x2f7a8a, 0x2f7a8a); gridLines.position.y = 0.02; gridLines.material.transparent = true; gridLines.material.opacity = 0.3; gridLines.visible = false; scene.add(gridLines);
  const tickers = [];

  // Cells taken (i, j, w, d in cells).
  const taken = new Set();
  const take = (i, j, w, d) => { for (let x = i; x < i + w; x++) for (let z = j; z < j + d; z++) taken.add(`${x},${z}`); };
  const untake = (i, j, w, d) => { for (let x = i; x < i + w; x++) for (let z = j; z < j + d; z++) taken.delete(`${x},${z}`); };
  const pickables = [];
  // Trees on the map (2×2 cells each), the same every time; the ones cleared stay gone.
  // Kept clear: the middle, and the corner the void kings come from and the archer goes.
  const obstacles = [];
  const keepClear = (i, j) => (Math.abs(i - HALF) < 6 && Math.abs(j - HALF) < 6) || (i < 16 && j > 22);
  const kinds = Object.keys(OBSTACLES);
  for (let k = 0, tries = 0; k < 26 && tries < 400; tries++) {
    const i = 1 + Math.floor(rand() * (GRID - 3)), j = 1 + Math.floor(rand() * (GRID - 3));
    let ok = !keepClear(i, j); for (let x = i - 1; ok && x < i + 3; x++) for (let z = j - 1; z < j + 3; z++) if (taken.has(`${x},${z}`)) ok = false;
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const model = OBSTACLES[kind].make(rand); model.rotation.y = rand() * 6;   // same random draws whether kept or cleared
    if (!ok) continue;
    const id = `t${k++}`;
    if (cleared.includes(id)) continue;
    model.position.copy(cellCenter(i, j, 2)); scene.add(model); take(i, j, 2, 2);
    const o = { id, kind, i, j, obj: model, ...OBSTACLES[kind] }; obstacles.push(o); pickables.push({ obj: model, kind: 'obstacle', o });
  }
  // The Town Hall: in the middle at first, then wherever the player moved it.
  // (After the trees, so moving it never changes which trees grow where.)
  const th = townHall(); scene.add(th);
  const thEnt = { kind: 'townhall', g: th, n: 4, i: thAt?.i ?? HALF - 2, j: thAt?.j ?? HALF - 2 };
  th.position.copy(cellCenter(thEnt.i, thEnt.j, 4)); take(thEnt.i, thEnt.j, 4, 4);
  pickables.push({ obj: th, kind: 'townhall', ent: thEnt });

  // ---------- camera: Clash-style angle, drag to pan, pinch / wheel to zoom ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.screenSpacePanning = false; controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minDistance = 16; controls.maxDistance = 95;
  const VIEW = new THREE.Vector3(24, 30, 26);
  const look = (x, z, dist = 1) => { controls.target.set(x, 0, z); camera.position.set(x, 0, z).addScaledVector(VIEW, dist); controls.update(); };
  controls.addEventListener('change', () => { const t = controls.target, cx = THREE.MathUtils.clamp(t.x, -HALF, HALF) - t.x, cz = THREE.MathUtils.clamp(t.z, -HALF, HALF) - t.z; if (cx || cz) { t.x += cx; t.z += cz; camera.position.x += cx; camera.position.z += cz; } });
  // Fly the view to a point (used by the tutorial).
  let fly = null;
  const flyTo = (x, z, dist = 0.8, ms = 900) => new Promise((res) => { fly = { t0: performance.now(), ms, a: controls.target.clone(), b: new THREE.Vector3(x, 0, z), da: camera.position.distanceTo(controls.target), db: VIEW.length() * dist, res }; });

  // The whole map in view at the start, as Clash opens (on a tall phone, most of it).
  let framed = false;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 52 : 38; camera.updateProjectionMatrix();
    if (!framed) { framed = true; const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect); const d = (GRID * 1.3) / (2 * Math.tan(hfov / 2)); look(0, 0, Math.min(1.9, Math.max(1, d / VIEW.length()))); }
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const bars = hpBars(container);
  // Everyone moving in the base (the guide and the King of the Void speak from the screen's edge, not from here).
  const units = [];

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
    const rec = { type: 'archer', i, j }; placed.push(rec);
    archer = { g, a, i, j, rec, kind: 'archer', n: 3 }; units.push(a);
    archerBar = bars.add(g, { y: 3.3, max: 100 });
    pickables.push({ obj: g, kind: 'archer', ent: archer });
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
    deselect();
    const g = new THREE.Group(); scene.add(g);
    const tiles = []; const tileGeo = new THREE.PlaneGeometry(0.92, 0.92);
    for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0x3ad86a, transparent: true, opacity: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set((k % 3) - 1, 0.04, Math.floor(k / 3) - 1); g.add(m); tiles.push(m); }
    // No platform while placing, so the 9 cells show under the archer.
    const ghost = new THREE.Group(); g.add(ghost); const a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.75; ghost.add(a.root); units.push(a);
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
  const cellOf = (p, n = 3) => [Math.round(p.x + HALF - n / 2), Math.round(p.z + HALF - n / 2)];
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (sel && !placing) {
      const p = groundAt(e), c = sel.ent.g.position;
      if (p && Math.abs(p.x - c.x) < sel.ent.n / 2 + 0.6 && Math.abs(p.z - c.z) < sel.ent.n / 2 + 0.6) { sel.drag = true; sel.off = [c.x - p.x, c.z - p.z]; controls.enabled = false; }
      return;
    }
    if (!placing) return;
    const p = groundAt(e);
    if (p && Math.abs(p.x - placing.g.position.x) < 2 && Math.abs(p.z - placing.g.position.z) < 2) { placing.drag = true; controls.enabled = false; }
  });
  el.addEventListener('pointermove', (e) => {
    if (sel?.drag) { const p = groundAt(e); if (p) { p.x += sel.off[0]; p.z += sel.off[1]; const [i, j] = cellOf(p, sel.ent.n); if (i !== sel.i || j !== sel.j) setSel(i, j); } }
  });
  el.addEventListener('pointermove', (e) => { if (placing?.drag) { const p = groundAt(e); if (p) { const [i, j] = cellOf(p); if (i !== placing.i || j !== placing.j) setPlace(i, j); } } });
  const up = (e) => {
    if (sel?.drag) { sel.drag = false; controls.enabled = true; return; }
    if (!placing) { const p = onTapGround && groundAt(e); if (p) onTapGround(p); return; }
    if (placing.drag) { placing.drag = false; controls.enabled = true; return; }
  };
  el.addEventListener('pointerup', up);
  // A tap (not a drag) on the ground moves the building there too — easier on a phone.
  let downAt = null;
  el.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  el.addEventListener('click', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    if (placing) { if (placing.drag) return; const p = groundAt(e); if (p) { const [i, j] = cellOf(p); setPlace(i, j); } return; }
    // A tap on a tree or on the Town Hall.
    const r = el.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(pickables.map((x) => x.obj), true);
    let o = hits[0]?.object; const owner = () => pickables.find((x) => x.obj === o);
    while (o && !owner()) o = o.parent;
    const pk = o && owner();
    if (!pk || pk.kind === 'obstacle' || pk.ent !== sel?.ent) deselect();
    if (!pk) return;
    const at = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (pk.kind === 'obstacle') return onObstacle?.(pk.o, at);
    if (canMove() && !sel) select(pk.ent);
    if (pk.kind === 'townhall') onTownHall?.(at); else onArcher?.(at);
  });

  // ---------- moving a building (Clash-style: tap it, then drag it; red cells = can't go there) ----------
  let sel = null;
  const canMove = () => !placing && !site && !fight && !fly;
  const LIFT = 0.35;
  const select = (ent) => {
    untake(ent.i, ent.j, ent.n, ent.n);
    const tiles = new THREE.Group(), geo = new THREE.PlaneGeometry(0.92, 0.92), mat = new THREE.MeshBasicMaterial({ color: 0x3ad86a, transparent: true, opacity: 0.6, depthWrite: false });
    for (let x = 0; x < ent.n; x++) for (let z = 0; z < ent.n; z++) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x - (ent.n - 1) / 2, 0.04, z - (ent.n - 1) / 2); tiles.add(m); }
    scene.add(tiles);
    sel = { ent, tiles, mat, i: ent.i, j: ent.j, i0: ent.i, j0: ent.j, ok: true, drag: false };
    gridLines.visible = true;
    setSel(ent.i, ent.j);
  };
  const setSel = (i, j) => {
    const n = sel.ent.n;
    i = THREE.MathUtils.clamp(i, 0, GRID - n); j = THREE.MathUtils.clamp(j, 0, GRID - n);
    sel.i = i; sel.j = j; sel.ok = free(i, j, n);
    const c = cellCenter(i, j, n); sel.tiles.position.copy(c); sel.ent.g.position.set(c.x, LIFT, c.z);
    sel.mat.color.set(sel.ok ? 0x3ad86a : 0xff4a3a);
  };
  // Let go: where it stands if the cells are free, else back where it was.
  const deselect = () => {
    if (!sel) return;
    const { ent } = sel, moved = sel.ok && (sel.i !== sel.i0 || sel.j !== sel.j0);
    if (sel.ok) { ent.i = sel.i; ent.j = sel.j; }
    ent.g.position.copy(cellCenter(ent.i, ent.j, ent.n)); take(ent.i, ent.j, ent.n, ent.n);
    if (ent.rec) { ent.rec.i = ent.i; ent.rec.j = ent.j; }
    if (moved) burst(ent.g.position.x, 0.4, ent.g.position.z, 0xeadfc8, 18, 2);
    scene.remove(sel.tiles); sel.tiles.children[0]?.geometry.dispose(); sel.mat.dispose();
    sel = null; gridLines.visible = false; controls.enabled = true;
    if (moved) onMoved?.({ th: { i: thEnt.i, j: thEnt.j }, buildings: placed.map((b) => ({ ...b })) });
  };

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
  // The void portal at the base's edge: the King of the Void's army comes out of it.
  const showKing = () => {
    if (king) return king;
    const g = new THREE.Group(); g.position.copy(KING_AT); scene.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 12, 40), new THREE.MeshBasicMaterial({ color: 0xb06aff, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ color: 0x0a0414 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06; g.add(hole);
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8a3aff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); haze.scale.set(5, 4, 1); haze.position.y = 1.4; g.add(haze);
    g.scale.setScalar(0.01); popIn.push({ g, t0: performance.now() });
    burst(KING_AT.x, 1.5, KING_AT.z, 0xa060ff, 60, 4);
    king = { root: g, ring };
    return king;
  };
  const hideKing = () => { if (!king) return; const k = king; const t0 = performance.now(); const shrink = () => { const e = Math.min(1, (performance.now() - t0) / 700); k.root.scale.setScalar(Math.max(0.01, 1 - e)); if (e < 1) requestAnimationFrame(shrink); else scene.remove(k.root); }; shrink(); king = null; };
  const fades = [];
  let fight = null;
  const defend = () => new Promise((resolve) => {
    deselect();
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
    for (const u of units) u.update(t, dt, fight?.foes.find((e) => e.h === u)?.walk || 0, false);
    if (king) king.ring.rotation.z = t * 1.5;
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
    flyTo, look,
    get king() { return king; }, showKing, hideKing,
    get archer() { return archer; }, get archerHp() { return archerBar?.hp ?? 0; },
    // Placing: a ghost with 3×3 cells under it; onMove(ok) tells whether the spot is free.
    startPlacing, endPlacing, get placing() { return placing; },
    startSite, finishSite, get site() { return site; },
    obstacleList: () => obstacles.map((o) => ({ id: o.id, kind: o.kind, cost: o.cost, pos: o.obj.position.clone() })),
    // Clear a tree: it shrinks away in a burst of leaves, and its cells are free again.
    removeObstacle(id) {
      const k = obstacles.findIndex((o) => o.id === id); if (k < 0) return false;
      const o = obstacles[k]; obstacles.splice(k, 1); pickables.splice(pickables.findIndex((x) => x.o === o), 1);
      const p = o.obj.position; burst(p.x, 1.5, p.z, 0x5aa83a, 40, 3); burst(p.x, 0.3, p.z, 0xc9a26a, 20, 2);
      const t0 = performance.now(); const shrink = () => { const e = Math.min(1, (performance.now() - t0) / 700); o.obj.scale.setScalar(Math.max(0.01, 1 - e)); o.obj.rotation.y += 0.2; if (e < 1) requestAnimationFrame(shrink); else { scene.remove(o.obj); untake(o.i, o.j, 2, 2); } }; shrink();
      return true;
    },
    defend, heal, burst,
    buildings: () => placed.map((b) => ({ ...b })),
    townHallAt: () => ({ i: thEnt.i, j: thEnt.j }),
    // Moving buildings (also used by the tests).
    select: (kind) => { deselect(); const ent = kind === 'townhall' ? thEnt : archer; if (ent && canMove()) select(ent); return !!sel; },
    moveSelected: (i, j) => { if (sel) setSel(i, j); return sel?.ok; },
    deselect, get selected() { return sel && { kind: sel.ent.kind, i: sel.i, j: sel.j, ok: sel.ok }; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); bars.dispose(); controls.dispose(); scene.traverse((o) => o.geometry?.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove(); },
  };
}
