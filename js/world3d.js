// 3D world map: procedural island terrain, sea, sky, forests and volumetric-looking
// clouds that hide places the player has not reached yet.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';

const SIZE = 420;             // world width in units (x); depth is 0.75 of it
const DEPTH = SIZE * 0.75;
const SEA = 0;                // sea level

// Region coords (0..1000 × 0..700) → world (x, z).
const toWorld = ({ x, y }) => [(x / 1000 - 0.5) * SIZE * 0.55, (y / 700 - 0.5) * DEPTH * 0.55];

// ---------- noise ----------
function makeNoise(seed = 3) {
  const p = new Uint8Array(512);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = [...Array(256).keys()].sort(() => r() - 0.5);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const n2 = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = f(x), v = f(y), a = p[X] + Y, b = p[X + 1] + Y;
    const l = (a1, b1, t) => a1 + t * (b1 - a1);
    return l(l(g(p[a], x, y), g(p[b], x - 1, y), u), l(g(p[a + 1], x, y - 1), g(p[b + 1], x - 1, y - 1), u), v);
  };
  return (x, y, oct = 5) => { let a = 1, fr = 1, t = 0, m = 0; for (let i = 0; i < oct; i++) { t += n2(x * fr, y * fr) * a; m += a; a *= 0.5; fr *= 2.03; } return t / m; };
}

export function mountWorld(container, spots, onPick) {
  const noise = makeNoise(11);
  const shown = spots.filter((s) => s.vis !== 'hidden').map((s) => {
    const [x, z] = toWorld(s.def.map);
    return { ...s, x, z };
  });
  const owned = shown.filter((s) => s.vis === 'owned');

  // ---------- terrain height ----------
  const height = (x, z) => {
    const nx = x / SIZE, nz = z / DEPTH;
    const d = Math.hypot(nx * 1.1, nz * 1.25);            // island falloff
    let h = noise(nx * 3 + 10, nz * 3 + 10) * 0.9 + 0.35;
    const ridge = 1 - Math.abs(noise(nx * 2.2 - 4, nz * 2.2 + 7, 4));
    h += Math.pow(ridge, 4) * 1.6 * Math.max(0, d - 0.12);
    h = h * 26 - Math.pow(Math.max(0, d - 0.28), 1.6) * 260 + 3;
    // Flatten gently around every place so buildings sit on a plateau.
    for (const s of shown) {
      const k = Math.exp(-((x - s.x) ** 2 + (z - s.z) ** 2) / 260);
      h = h * (1 - k) + 6 * k;
    }
    return h;
  };

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.55;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xbfd4e2, 0.0026);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);

  const sky = new Sky();
  sky.scale.setScalar(1800);
  const su = sky.material.uniforms;
  su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(210));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene(); const skyClone = new Sky(); skyClone.scale.setScalar(1000);
  Object.assign(skyClone.material.uniforms.sunPosition.value, sunDir); skyScene.add(skyClone);
  scene.environment = pmrem.fromScene(skyScene).texture;

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 180, bottom: -180, near: 1, far: 800 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, new THREE.HemisphereLight(0xcfe6ff, 0x6b5a3a, 0.8));

  // ---------- terrain mesh ----------
  const geo = new THREE.PlaneGeometry(SIZE * 1.6, DEPTH * 1.6, 300, 225);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), sand = new THREE.Color(0xd9c28f), grass = new THREE.Color(0x6d8f45),
    dark = new THREE.Color(0x46652f), rock = new THREE.Color(0x857564), snow = new THREE.Color(0xf4f6f8), seabed = new THREE.Color(0x9c8f6a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = height(x, z);
    pos.setY(i, h);
    const v = noise(x * 0.08, z * 0.08, 2) * 0.5 + 0.5;
    if (h < SEA + 1.2) c.copy(seabed).lerp(sand, THREE.MathUtils.clamp((h + 6) / 7, 0, 1));
    else if (h < 4) c.copy(sand).lerp(grass, (h - 1.2) / 2.8);
    else if (h < 20) c.copy(grass).lerp(dark, v);
    else if (h < 32) c.copy(dark).lerp(rock, (h - 20) / 12);
    else c.copy(rock).lerp(snow, THREE.MathUtils.clamp((h - 34) / 8, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Steep slopes read as rock.
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const slope = 1 - nrm.getY(i);
    if (slope > 0.25 && pos.getY(i) > 3) {
      c.fromArray(colors, i * 3).lerp(rock, Math.min(1, (slope - 0.25) * 3)); colors.set([c.r, c.g, c.b], i * 3);
    }
  }
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
  terrain.receiveShadow = true; terrain.castShadow = true;
  scene.add(terrain);

  // ---------- sea ----------
  const waterGeo = new THREE.PlaneGeometry(3000, 3000, 1, 1); waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshPhysicalMaterial({
    color: 0x1f6f8b, roughness: 0.08, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.82, clearcoat: 1,
  }));
  water.position.y = SEA; water.receiveShadow = true;
  const waveTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const n = noise(x / 22, y / 22, 3), m = noise(x / 22 + 0.3, y / 22, 3), k = noise(x / 22, y / 22 + 0.3, 3);
      const i = (y * 256 + x) * 4; img.data[i] = 128 + (m - n) * 900; img.data[i + 1] = 128 + (k - n) * 900; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); return t;
  })();
  water.material.normalMap = waveTex; water.material.normalScale.set(0.35, 0.35);
  scene.add(water);

  // ---------- forests & rocks (instanced) ----------
  const rand = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const nearSpot = (x, z, r) => shown.some((s) => Math.hypot(s.x - x, s.z - z) < r);
  const treePts = [];
  for (let i = 0; i < 9000 && treePts.length < 1700; i++) {
    const x = (rand() - 0.5) * SIZE * 1.3, z = (rand() - 0.5) * DEPTH * 1.3, h = height(x, z);
    if (h < 3 || h > 26 || nearSpot(x, z, 16)) continue;
    if (noise(x * 0.04 + 50, z * 0.04, 3) < -0.05) continue;       // clearings
    treePts.push([x, h, z, 0.7 + rand() * 0.8]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5); trunkGeo.translate(0, 0.8, 0);
  const crownGeo = new THREE.ConeGeometry(1.3, 3.8, 7); crownGeo.translate(0, 3.2, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 1 }), treePts.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), treePts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), tc = new THREE.Color();
  treePts.forEach(([x, y, z, s], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28); sc.set(s, s * (0.8 + rand() * 0.5), s); p3.set(x, y - 0.2, z);
    m4.compose(p3, q, sc); trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, tc.setHSL(0.27 + rand() * 0.06, 0.55, 0.1 + rand() * 0.08));
  });
  for (const m of [trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // ---------- places ----------
  const pickables = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0xeee3cc, roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a53a, roughness: 0.3, metalness: 0.8 });
  const green = new THREE.MeshStandardMaterial({ color: 0x2f6f5e, roughness: 0.5 });
  const addShadow = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  function mosque() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 9), stone); base.position.y = 2;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1.2, 24), stone); drum.position.y = 4.6;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), green); dome.position.y = 5.2;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 8), gold); fin.position.y = 9;
    const mina = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 13, 12), stone); mina.position.set(4.6, 6.5, 4.6);
    const balc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.4, 12), stone); balc.position.set(4.6, 10.5, 4.6);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.4, 12), green); cap.position.set(4.6, 14.2, 4.6);
    const court = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 0.6, 40), new THREE.MeshStandardMaterial({ color: 0xd9c8a4, roughness: 1 })); court.position.y = 0.1;
    g.add(court, base, drum, dome, fin, mina, balc, cap);
    // palms
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + 0.6, r = 7.5, px = Math.cos(a) * r, pz = Math.sin(a) * r;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 5, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3c })); trunk.position.set(px, 2.5, pz);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 1.2, 7), new THREE.MeshStandardMaterial({ color: 0x4f8a3a })); leaves.position.set(px, 5.2, pz); leaves.rotation.x = Math.PI;
      g.add(trunk, leaves);
    }
    addShadow(g);
    return g;
  }

  // Miniature of the palace courtyard seen inside the place.
  function palace() {
    const g = new THREE.Group();
    const wallM = new THREE.MeshStandardMaterial({ color: 0xeadfc8, roughness: 0.75 });
    const plaster = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.85 });
    const dome = new THREE.MeshStandardMaterial({ color: 0x2f7a8a, roughness: 0.3, metalness: 0.25 });
    const marble = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.4 });
    const court = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 18), marble); court.position.y = 0.25; g.add(court);
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x5f9443 })); lawn.position.y = 0.5; g.add(lawn);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 7), new THREE.MeshStandardMaterial({ color: 0x2c8aa6, roughness: 0.1 })); pool.position.set(0, 0.55, 1.5); g.add(pool);
    for (const [x, z, ry] of [[0, -8.5, 0], [-8.5, 0, Math.PI / 2], [8.5, 0, Math.PI / 2]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 1), wallM); w.position.set(x, 1.5, z); w.rotation.y = ry; g.add(w);
    }
    const hall = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 4.5), plaster); hall.position.set(0, 2.5, 8); g.add(hall);
    const iwan = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.5, 1), wallM); iwan.position.set(0, 3.25, 5.6); g.add(iwan);
    const d = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), dome); d.position.set(0, 5, 8); d.scale.y = 1.25; g.add(d);
    for (const x of [-5.5, 5.5]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 9, 12), wallM); t.position.set(x, 4.5, 8); g.add(t);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome); c.position.set(x, 9, 8); c.scale.y = 1.4; g.add(c);
    }
    for (const [x, z] of [[-8.5, -8.5], [8.5, -8.5]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 5, 10), wallM); t.position.set(x, 2.5, z); g.add(t);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome); c.position.set(x, 5, z); g.add(c);
    }
    const cyp = new THREE.MeshStandardMaterial({ color: 0x2f5a2e, roughness: 0.9 });
    for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 3], [4.5, 3]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), cyp); c.scale.y = 3; c.position.set(x, 2.3, z); g.add(c); }
    g.rotation.y = Math.PI;
    addShadow(g);
    return g;
  }

  function ruin() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 0.9, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, h = 3 + (i % 3) * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, h, 10), mat); col.position.set(Math.cos(a) * 5, h / 2, Math.sin(a) * 5);
      g.add(col);
    }
    addShadow(g);
    return g;
  }

  const labels = [];
  const labelLayer = document.createElement('div'); labelLayer.className = 'w3-labels'; container.appendChild(labelLayer);
  let glow;
  for (const s of shown) {
    const y = height(s.x, s.z);
    const obj = s.vis === 'owned' ? palace() : ruin();
    obj.scale.setScalar(1.5);
    obj.position.set(s.x, y - 0.2, s.z);
    obj.userData.spot = s.def.id;
    obj.traverse((m) => { m.userData.spot = s.def.id; });
    scene.add(obj); pickables.push(obj);
    if (s.vis === 'owned') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(10, 11.5, 64), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, y + 0.5, s.z); scene.add(ring); glow = ring;
    }
    const el = document.createElement('button');
    el.className = `w3-label ${s.vis}`;
    el.innerHTML = s.vis === 'owned' ? s.def.name
      : `🔒 ${s.def.name} · ${s.def.cost?.keys ? `🗝 ${s.def.cost.keys}` : `🪙 ${s.def.cost?.gold ?? 0}`}`;
    el.onclick = () => onPick(s.def.id);
    labelLayer.appendChild(el);
    labels.push({ el, v: new THREE.Vector3(s.x, y + (s.vis === 'owned' ? 18 : 10), s.z) });
  }

  // ---------- clouds ----------
  // Soft billboard puffs grouped into cumulus clusters. Dense cover everywhere
  // except around places the player owns; thinner around places about to open.
  const puffTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 64, dy = (y - 64) / 64, d = Math.hypot(dx, dy);
      const n = noise(x / 14 + 3, y / 14, 4) * 0.5 + 0.5;
      const a = Math.max(0, 1 - d) ** 1.6 * (0.55 + n * 0.9);
      const i = (y * 128 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255);
    }
    g.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(cv);
  })();
  const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
  const cloudMats = [0xffffff, 0xf7f8fa, 0xe4e9ef, 0xcdd6e0].map((col) =>
    new THREE.SpriteMaterial({ map: puffTex, color: col, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0.9 }));
  const clearing = (x, z) => {
    let k = 1;
    for (const s of owned) k = Math.min(k, THREE.MathUtils.smoothstep(Math.hypot(s.x - x, s.z - z) - Math.max(0, z - s.z) * 0.8, 40, 80));
    for (const s of shown) if (s.vis === 'teaser') k = Math.min(k, 0.35 + 0.65 * THREE.MathUtils.smoothstep(Math.hypot(s.x - x, s.z - z), 14, 36));
    return k;
  };
  for (let cx = -SIZE * 0.8; cx < SIZE * 0.8; cx += 22) {
    for (let cz = -DEPTH * 0.8; cz < DEPTH * 0.8; cz += 20) {
      const x = cx + (rand() - 0.5) * 16, z = cz + (rand() - 0.5) * 16;
      const k = clearing(x, z);
      if (k < 0.05 || rand() > 0.35 + k * 0.65) continue;
      const base = 34 + rand() * 12, n = Math.round(4 + k * 7);
      for (let j = 0; j < n; j++) {
        const layer = rand();
        const sp = new THREE.Sprite(cloudMats[layer < 0.45 ? 0 : layer < 0.75 ? 1 : layer < 0.92 ? 2 : 3]);
        const r = (10 + rand() * 16) * (0.6 + k * 0.6);
        sp.position.set(x + (rand() - 0.5) * 22, base + rand() * 10 - (layer > 0.75 ? 4 : 0), z + (rand() - 0.5) * 18);
        sp.scale.set(r * 1.6, r, 1);
        sp.userData.drift = 0.6 + rand() * 0.8;
        cloudGroup.add(sp);
      }
    }
  }

  // ---------- camera & controls ----------
  const focus = owned.length
    ? new THREE.Vector3(owned.reduce((a, s) => a + s.x, 0) / owned.length, 6, owned.reduce((a, s) => a + s.z, 0) / owned.length)
    : new THREE.Vector3(0, 6, 0);
  camera.position.set(focus.x + 40, 80, focus.z + 75);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(focus);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 25; controls.maxDistance = 330;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  const bounds = { x: SIZE * 0.55, z: DEPTH * 0.55 };
  controls.addEventListener('change', () => {
    const t = controls.target, dx = THREE.MathUtils.clamp(t.x, -bounds.x, bounds.x) - t.x, dz = THREE.MathUtils.clamp(t.z, -bounds.z, bounds.z) - t.z;
    if (dx || dz) { t.x += dx; t.z += dz; camera.position.x += dx; camera.position.z += dz; }
  });

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (hit?.object.userData.spot) onPick(hit.object.userData.spot);
  });

  // ---------- loop ----------
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const clock = new THREE.Clock(); const v = new THREE.Vector3();
  let raf;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    controls.update();
    waveTex.offset.set(t * 0.004, t * 0.006);
    for (const sp of cloudGroup.children) { sp.position.x += dt * sp.userData.drift; if (sp.position.x > SIZE * 0.85) sp.position.x -= SIZE * 1.7; }
    if (glow) glow.material.opacity = 0.35 + Math.sin(t * 2) * 0.2;
    renderer.render(scene, camera);
    const w = container.clientWidth, h = container.clientHeight;
    for (const l of labels) {
      v.copy(l.v).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.display = vis ? '' : 'none';
      if (vis) l.el.style.transform = `translate(-50%, -100%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); });
    renderer.dispose(); pmrem.dispose(); renderer.forceContextLoss?.();
    container.innerHTML = '';
  };
}
