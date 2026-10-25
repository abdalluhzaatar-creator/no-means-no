// The spiritual dimension as a base, in the Clash of Clans way: a 44×44 map of bright
// green grass in soft squares, a darker grass strip round it (nothing is built there; the
// void kings' portal opens on it), a forest all round, seen from above at an angle.
// The Town Hall (a square hall with a dome) and the starting buildings stand on it;
// trees, bushes and rocks are obstacles the player clears (base.js has the rules).
// Tap a building to pick it up, drag it, the cells under it go green or red (Clash's way).
// Drag the ground to move the view, pinch / wheel to zoom.
// It also runs the base's fights: void kings come out of a portal, the archer shoots them.
// The tutorial (onboard.js) drives it through the API returned by mountVillage.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildVoidKing, buildArcher, makeArrow, makeSoul, hpBars } from './units3d.js';
import { glowTex } from './env3d.js';
import { GRID, BORDER, BUILDINGS, OBSTACLES, ready } from './base.js';
import { groundTexture, scenery, obstacleModel, buildingModel, bubble, GRASS } from './basemodels3d.js';

export { GRID };
const HALF = GRID / 2;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const cellCenter = (i, j, n = 3) => new THREE.Vector3(i + n / 2 - HALF, 0, j + n / 2 - HALF);

// buildings: [{ type, i, j, lv?, up?, t? }] (the Town Hall apart, at th); obstacles: [{ id, kind, i, j }].
// The records are used as they are (not copied): moving a building changes its i, j there.
// onSelect(rec | null, at) a building picked up / let go · onCollect(rec, at) → amount, a collector with something in it
// onObstacle(o, at) an obstacle tapped · onMoved({ th, buildings }) a building moved.
export function mountVillage(container, { buildings = [], obstacles: obList = [], th: thAt = null, onTapGround, onObstacle, onSelect, onCollect, onMoved } = {}) {
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // No filmic curve: Clash's colours are bright and full.
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8dcf2); scene.fog = new THREE.Fog(0xb8e2f2, 90, 170);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8a3a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff4dc, 1.9); sun.position.set(22, 40, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -0.0005; scene.add(sun);

  // Ground: the map and its grass strip (one texture), plain grass beyond, the forest round it, hills far off.
  const far = new THREE.Mesh(new THREE.CircleGeometry(420, 64), std(GRASS.far, { roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -0.02; far.receiveShadow = true; scene.add(far);
  const SIDE = GRID + BORDER * 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIDE, SIDE), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const tickers = [];
  const land = scenery(); scene.add(land); tickers.push(land);
  // The grid lines, shown while a building is moved or placed (only over the map, not the strip).
  const gridLines = new THREE.GridHelper(GRID, GRID, 0xffffff, 0xffffff); gridLines.position.y = 0.02; gridLines.material.transparent = true; gridLines.material.opacity = 0.35; gridLines.visible = false; scene.add(gridLines);

  // Cells taken.
  const taken = new Set();
  const take = (i, j, w, d = w) => { for (let x = i; x < i + w; x++) for (let z = j; z < j + d; z++) taken.add(`${x},${z}`); };
  const untake = (i, j, w, d = w) => { for (let x = i; x < i + w; x++) for (let z = j; z < j + d; z++) taken.delete(`${x},${z}`); };
  const free = (i, j, n = 3) => { if (i < 0 || j < 0 || i + n > GRID || j + n > GRID) return false; for (let x = i; x < i + n; x++) for (let z = j; z < j + n; z++) if (taken.has(`${x},${z}`)) return false; return true; };
  const pickables = [];

  // ---------- obstacles ----------
  const obstacles = [];
  const addObstacle = (d) => {
    const def = OBSTACLES[d.kind]; if (!def) return;
    const model = obstacleModel(d.kind, d.id); model.position.copy(cellCenter(d.i, d.j, def.n)); scene.add(model); take(d.i, d.j, def.n);
    const o = { ...d, n: def.n, obj: model, ...def }; obstacles.push(o); pickables.push({ obj: model, kind: 'obstacle', o });
    return o;
  };
  for (const d of obList) addObstacle(d);

  // ---------- camera: Clash-style angle, drag to pan, pinch / wheel to zoom ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.screenSpacePanning = false; controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minDistance = 14; controls.maxDistance = 95;
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
    if (!framed) { framed = true; const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect); const d = (SIDE * 1.3) / (2 * Math.tan(hfov / 2)); look(0, 0, Math.min(2, Math.max(1, d / VIEW.length()))); }
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const bars = hpBars(container);
  // Everyone moving in the base (the guide and the King of the Void speak from the screen's edge, not from here).
  const units = [];

  // ---------- buildings ----------
  // Each building on the map: { kind, g, n, i, j, rec } (rec: its entry in the save; none for the Town Hall).
  const placed = [], ents = [];
  const platform = () => { const p = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.8), std(0xcdb88e)); base.position.y = 0.25; base.castShadow = base.receiveShadow = true; p.add(base); const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2.4), std(0x8a6a44)); top.position.y = 0.56; p.add(top); return p; };
  const thRec = thAt || { type: 'townhall', i: HALF - 2, j: HALF - 2 };
  const th = new THREE.Group(); scene.add(th);
  const thEnt = { kind: 'townhall', g: th, n: 4, i: thRec.i, j: thRec.j, rec: thRec };
  th.position.copy(cellCenter(thEnt.i, thEnt.j, 4)); take(thEnt.i, thEnt.j, 4);
  pickables.push({ obj: th, kind: 'building', ent: thEnt }); ents.push(thEnt);
  let archer = null, archerBar = null;
  const popIn = [];
  const addBuilding = (rec, { pop = false } = {}) => {
    const def = BUILDINGS[rec.type]; if (!def) return null;
    const { i, j } = rec, n = def.n;
    take(i, j, n);
    const g = new THREE.Group(); g.position.copy(cellCenter(i, j, n)); scene.add(g);
    placed.push(rec);
    const ent = { kind: rec.type, g, n, i, j, rec };
    if (rec.type === 'archer') {
      g.add(platform());
      const a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.75; g.add(a.root);
      Object.assign(ent, { a }); archer = ent; units.push(a);
      archerBar = bars.add(g, { y: 3.3, max: 100 });
    } else if (def.makes) { ent.bub = bubble(def.makes === 'gold' ? '🪙' : '✨'); ent.bub.position.y = 3.2; ent.bub.visible = false; g.add(ent.bub); }
    pickables.push({ obj: g, kind: 'building', ent }); ents.push(ent);
    look3d(ent);
    if (pop) { g.scale.setScalar(0.01); popIn.push({ g, t0: performance.now() }); burst(g.position.x, 0.6, g.position.z, 0xfff0c0, 40); }
    return ent;
  };
  // How a building looks at its level (a little bigger, gold trim from level 3), and the builder's fence while it's upgraded.
  function look3d(ent) {
    const lv = ent.rec.lv ?? 1;
    if (ent.kind !== 'archer') {
      if (ent.model) { ent.g.remove(ent.model); const k = tickers.indexOf(ent.model); if (k >= 0) tickers.splice(k, 1); }
      const m = buildingModel(ent.kind); m.scale.setScalar(lv === 0 ? 0.6 : 1 + Math.min(0.15, (lv - 1) * 0.04)); ent.g.add(m); if (m.userData.tick) tickers.push(m); ent.model = m;
      if (lv >= 3) { const trim = new THREE.Mesh(new THREE.BoxGeometry(ent.n - 0.2, 0.08, ent.n - 0.2), std(0xe0b030, { metalness: 0.7, roughness: 0.3 })); trim.position.y = 0.04; m.add(trim); }
    }
    if (ent.rec.up && !ent.fence) {
      const f = new THREE.Group(), wood = std(0xb07a46), h = ent.n / 2 + 0.15;
      for (let k = 0; k < 4; k++) {
        const side = new THREE.Group(); side.rotation.y = (k * Math.PI) / 2; f.add(side);
        for (let x = -h; x < h; x += 0.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), wood); p.position.set(x, 0.27, h); p.castShadow = true; side.add(p); }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(h * 2, 0.08, 0.06), wood); rail.position.set(0, 0.4, h); side.add(rail);
      }
      const hammer = new THREE.Group(); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.18), std(0x8a8a8a, { metalness: 0.6 })); hd.position.y = 0.35; hammer.add(hd);
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), std(0x7a5230)); hammer.add(hl); hammer.position.set(h - 0.2, 0.9, h - 0.2); f.add(hammer);
      f.userData.tick = (t) => { hammer.rotation.z = -0.6 + Math.abs(Math.sin(t * 5)) * 1.2; };
      ent.g.add(f); tickers.push(f); ent.fence = f;
    } else if (!ent.rec.up && ent.fence) { ent.g.remove(ent.fence); tickers.splice(tickers.indexOf(ent.fence), 1); ent.fence = null; }
  }
  look3d(thEnt);
  for (const b of buildings) addBuilding(b);
  // The collectors' bubbles: shown when there is something to collect.
  const checkBubbles = (now = Date.now()) => { for (const e of ents) if (e.bub) e.bub.visible = ready(e.rec, now) >= 1; };
  checkBubbles(); const bubT = setInterval(checkBubbles, 1000);

  // ---------- placing a new building (3×3 cells under it, green when the spot is free) ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const groundAt = (e) => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); return ray.ray.intersectPlane(groundPlane, hit) ? hit.clone() : null; };
  const tileSet = (n) => {
    const g = new THREE.Group(), geo = new THREE.PlaneGeometry(0.92, 0.92), mat = new THREE.MeshBasicMaterial({ color: 0x3ad86a, transparent: true, opacity: 0.6, depthWrite: false });
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x - (n - 1) / 2, 0.04, z - (n - 1) / 2); g.add(m); }
    g.userData.mat = mat; return g;
  };
  let placing = null;
  // A new building to place (the archer in the tutorial, anything from the shop after).
  const startPlacing = (i0, j0, onMove, type = 'archer') => {
    deselect();
    const n = BUILDINGS[type].n, g = new THREE.Group(); scene.add(g);
    const tiles = tileSet(n); g.add(tiles);
    // No platform while placing, so the cells show under it.
    const ghost = new THREE.Group(); g.add(ghost); let a = null;
    if (type === 'archer') { a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.75; ghost.add(a.root); units.push(a); }
    else ghost.add(buildingModel(type));
    ghost.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.75; } });
    placing = { g, tiles, a, n, type, i: i0, j: j0, ok: true, onMove, drag: false };
    gridLines.visible = true;
    setPlace(i0, j0);
  };
  const setPlace = (i, j) => {
    if (!placing) return;
    const n = placing.n;
    i = THREE.MathUtils.clamp(i, 0, GRID - n); j = THREE.MathUtils.clamp(j, 0, GRID - n);
    placing.i = i; placing.j = j; placing.ok = free(i, j, n);
    placing.g.position.copy(cellCenter(i, j, n));
    placing.tiles.userData.mat.color.set(placing.ok ? 0x3ad86a : 0xff4a3a);
    placing.onMove?.(placing.ok);
  };
  const endPlacing = () => { if (!placing) return; scene.remove(placing.g); if (placing.a) units.splice(units.indexOf(placing.a), 1); placing = null; gridLines.visible = false; controls.enabled = true; };
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
    if (p && Math.abs(p.x - placing.g.position.x) < placing.n / 2 + 0.5 && Math.abs(p.z - placing.g.position.z) < placing.n / 2 + 0.5) { placing.drag = true; controls.enabled = false; }
  });
  el.addEventListener('pointermove', (e) => {
    if (sel?.drag) { const p = groundAt(e); if (p) { p.x += sel.off[0]; p.z += sel.off[1]; const [i, j] = cellOf(p, sel.ent.n); if (i !== sel.i || j !== sel.j) setSel(i, j); } }
  });
  el.addEventListener('pointermove', (e) => { if (placing?.drag) { const p = groundAt(e); if (p) { const [i, j] = cellOf(p, placing.n); if (i !== placing.i || j !== placing.j) setPlace(i, j); } } });
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
    if (placing) { if (placing.drag) return; const p = groundAt(e); if (p) { const [i, j] = cellOf(p, placing.n); setPlace(i, j); } return; }
    // A tap on an obstacle or a building.
    const r = el.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(pickables.map((x) => x.obj), true);
    let o = hits[0]?.object; const owner = () => pickables.find((x) => x.obj === o);
    while (o && !owner()) o = o.parent;
    const pk = o && owner();
    if (!pk || pk.ent !== sel?.ent) deselect();
    if (!pk) return onSelect?.(null);
    const at = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (pk.kind === 'obstacle') return onObstacle?.(pk.o, at);
    const ent = pk.ent;
    // A collector with something in it: collect, as in Clash.
    if (ent.bub?.visible && onCollect) {
      const got = onCollect(ent.rec, at);
      if (got) { checkBubbles(); burst(ent.g.position.x, 2.4, ent.g.position.z, BUILDINGS[ent.kind].makes === 'gold' ? 0xffd040 : 0xfff2b0, 24, 2.5); }
      return;
    }
    if (canMove() && !sel) select(ent);
  });

  // ---------- moving a building (Clash-style: tap it, then drag it; red cells = can't go there) ----------
  let sel = null;
  const canMove = () => !placing && !site && !fight && !fly;
  const LIFT = 0.35;
  const select = (ent) => {
    untake(ent.i, ent.j, ent.n);
    const tiles = tileSet(ent.n); scene.add(tiles);
    tiles.add(arrows(ent.n));
    sel = { ent, tiles, mat: tiles.userData.mat, i: ent.i, j: ent.j, i0: ent.i, j0: ent.j, ok: true, drag: false };
    gridLines.visible = true;
    setSel(ent.i, ent.j);
    onSelect?.(ent.rec);
  };
  // Clash's four arrows round a picked-up building: it can be dragged.
  const arrows = (n) => {
    const g = new THREE.Group(), shape = new THREE.Shape();
    shape.moveTo(0, 0.45); shape.lineTo(0.42, 0); shape.lineTo(0.16, 0); shape.lineTo(0.16, -0.35); shape.lineTo(-0.16, -0.35); shape.lineTo(-0.16, 0); shape.lineTo(-0.42, 0); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape), mat = new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.95, depthWrite: false });
    for (let k = 0; k < 4; k++) { const a = new THREE.Mesh(geo, mat), r = n / 2 + 0.75, ang = (k * Math.PI) / 2; a.rotation.x = -Math.PI / 2; a.rotation.z = ang; a.position.set(-Math.sin(ang) * r, 0.06, -Math.cos(ang) * r); g.add(a); }
    g.userData.tick = (t) => g.scale.setScalar(1 + Math.sin(t * 5) * 0.05);
    tickers.push(g); return g;
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
    ent.g.position.copy(cellCenter(ent.i, ent.j, ent.n)); take(ent.i, ent.j, ent.n);
    if (ent.rec) { ent.rec.i = ent.i; ent.rec.j = ent.j; }
    if (moved) burst(ent.g.position.x, 0.4, ent.g.position.z, 0xd8e8a0, 18, 2);
    scene.remove(sel.tiles); sel.tiles.children[0]?.geometry.dispose(); sel.mat.dispose();
    const ar = sel.tiles.children.find((c) => c.userData.tick); if (ar) tickers.splice(tickers.indexOf(ar), 1);
    sel = null; gridLines.visible = false; controls.enabled = true;
    onSelect?.(null);
    if (moved) onMoved?.({ th: thRec, buildings: placed.slice() });
  };

  // ---------- construction ----------
  let site = null;
  const startSite = (i, j) => {
    const g = new THREE.Group(); g.position.copy(cellCenter(i, j)); scene.add(g);
    g.add(platform());
    const wood = std(0x9a7444);
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood); p.position.set(x, 1.2, z); g.add(p); }
    for (const y of [1.2, 2.3]) for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.1), wood); b.position.y = y; b.rotation.y = r; g.add(b); const b2 = b.clone(); b2.position.set(r ? 1.2 : 0, y, r ? 0 : 1.2); g.add(b2); }
    take(i, j, 3);
    site = { g, i, j };
    return g;
  };
  const finishSite = () => { if (!site) return; const { i, j } = site; scene.remove(site.g); untake(i, j, 3); site = null; return addBuilding({ type: 'archer', i, j }, { pop: true }); };

  // ---------- effects ----------
  const N = 160, pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pVel = Array.from({ length: N }, () => new THREE.Vector3());
  const pGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3)).setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  parts.frustumCulled = false; scene.add(parts); let pK = 0, pNext = 0;
  pPos.fill(-99);
  const burst = (x, y, z, color, n = 30, power = 3) => { pK = 1; const c = new THREE.Color(color); for (let k = 0; k < n; k++) { const i = pNext++ % N; pPos.set([x, y, z], i * 3); pCol.set([c.r, c.g, c.b], i * 3); pVel[i].set((Math.random() - 0.5) * power, Math.random() * power, (Math.random() - 0.5) * power); } pGeo.attributes.color.needsUpdate = true; };
  const flights = [], souls = [], heals = [];

  // ---------- the King of the Void and the defence ----------
  // On the grass strip at the map's left edge, where attackers land in Clash.
  const KING_AT = new THREE.Vector3(-HALF - BORDER / 2, 0, 12);
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
    for (const e of ents) if (e.bub?.visible) e.bub.position.y = 3.2 + Math.sin(t * 3 + e.i) * 0.15;
    for (const p of popIn.splice(0)) { const k = Math.min(1, (now - p.t0) / 500); p.g.scale.setScalar(0.01 + 0.99 * (1 - (1 - k) ** 3) * (1 + Math.sin(k * Math.PI) * 0.15)); if (k < 1) popIn.push(p); }
    for (const o of obstacles) if (o.shaking) { o.obj.rotation.z = Math.sin(t * 30) * 0.04; if (Math.random() < 0.15) burst(o.obj.position.x + (Math.random() - 0.5) * o.n, 0.3, o.obj.position.z + (Math.random() - 0.5) * o.n, 0xc9a26a, 1, 1.5); } else if (o.obj.rotation.z) o.obj.rotation.z = 0;
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
    obstacleList: () => obstacles.map((o) => ({ id: o.id, kind: o.kind, cost: o.cost, res: o.res, pos: o.obj.position.clone() })),
    obstacleAt: (id) => obstacles.find((o) => o.id === id)?.obj.position.clone(),
    addObstacle: (d) => !!addObstacle(d),
    // Clear an obstacle: it shrinks away in a burst (leaves or stone dust), and its cells are free again.
    removeObstacle(id) {
      const k = obstacles.findIndex((o) => o.id === id); if (k < 0) return false;
      const o = obstacles[k]; obstacles.splice(k, 1); pickables.splice(pickables.findIndex((x) => x.o === o), 1);
      const p = o.obj.position, rocky = o.res === 'gold';
      burst(p.x, 1.2, p.z, rocky ? 0x9e9e96 : 0x5aa83a, 40, 3); burst(p.x, 0.3, p.z, 0xc9a26a, 20, 2);
      const t0 = performance.now(); const shrink = () => { const e = Math.min(1, (performance.now() - t0) / 700); o.obj.scale.setScalar(Math.max(0.01, 1 - e)); o.obj.rotation.y += 0.2; if (e < 1) requestAnimationFrame(shrink); else { scene.remove(o.obj); untake(o.i, o.j, o.n); } }; shrink();
      return true;
    },
    // While an obstacle is being cleared: it shakes a little and dust rises.
    shakeObstacle(id, on) { const o = obstacles.find((x) => x.id === id); if (o) o.shaking = on; },
    // How full the storages look (0–1 for gold and light).
    setStock({ gold = 0, nour = 0 }) { for (const e of ents) { const h = BUILDINGS[e.kind]?.holds; if (h && e.model?.userData.fill) e.model.userData.fill(h.gold ? gold : nour); } },
    checkBubbles,
    defend, heal, burst,
    buildings: () => placed.slice(),
    add: (rec, pop = true) => !!addBuilding(rec, { pop }),
    // A free spot for an n×n building near (i, j) (where the shop puts a new one first).
    freeNear(i, j, n) { for (let r = 0; r < GRID; r++) for (let x = i - r; x <= i + r; x++) for (let z = j - r; z <= j + r; z++) if (Math.max(Math.abs(x - i), Math.abs(z - j)) === r && free(x, z, n)) return [x, z]; return null; },
    get center() { const t = controls.target; return [Math.round(t.x + HALF), Math.round(t.z + HALF)]; },
    // A building's record changed (a level, an upgrade started or done): how it looks.
    refresh(rec) { const e = ents.find((x) => x.rec === rec); if (e) look3d(e); checkBubbles(); },
    // Where a building is (for labels and timers over it).
    posOf(rec) { return ents.find((x) => x.rec === rec)?.g.position.clone(); },
    townHallAt: () => ({ i: thEnt.i, j: thEnt.j }),
    // Moving buildings (also used by the tests).
    select: (kind) => { deselect(); const ent = ents.find((e) => e.kind === kind); if (ent && canMove()) select(ent); return !!sel; },
    moveSelected: (i, j) => { if (sel) setSel(i, j); return sel?.ok; },
    deselect, get selected() { return sel && { kind: sel.ent.kind, i: sel.i, j: sel.j, ok: sel.ok }; },
    dispose() { cancelAnimationFrame(raf); clearInterval(bubT); ro.disconnect(); bars.dispose(); controls.dispose(); scene.traverse((o) => o.geometry?.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove(); },
  };
}
