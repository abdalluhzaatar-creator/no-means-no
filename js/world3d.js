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
      if (s.def.floating) continue;   // the trophy island floats over open sea
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

  // Headquarters: a stone keep with corner towers and a banner.
  function fortress() {
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a7e70, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x5a4f45, roughness: 1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 14), dark); base.position.y = 0.3; g.add(base);
    for (const [x, z, ry] of [[0, -6, 0], [0, 6, 0], [-6, 0, Math.PI / 2], [6, 0, Math.PI / 2]]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(12, 3.5, 1), stone); w.position.set(x, 2, z); w.rotation.y = ry; g.add(w);
      for (let i = -5; i <= 5; i += 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.1), stone); m.position.set(x + (ry ? 0 : i), 4.1, z + (ry ? i : 0)); g.add(m); }
    }
    for (const x of [-6, 6]) for (const z of [-6, 6]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 6.5, 12), stone); t.position.set(x, 3.3, z); g.add(t);
      const r = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0x7a1f24 })); r.position.set(x, 7.6, z); g.add(r);
    }
    const keep = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 6), stone); keep.position.y = 4.3; g.add(keep);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 3, 4), new THREE.MeshStandardMaterial({ color: 0x7a1f24 })); roof.position.y = 9.8; roof.rotation.y = Math.PI / 4; g.add(roof);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 13; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshStandardMaterial({ color: 0xffc83d, side: THREE.DoubleSide, emissive: 0x6a4a00, emissiveIntensity: 0.4 })); flag.position.set(1.1, 14.2, 0); g.add(flag);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a2618 })); door.position.set(0, 1.6, 6.55); g.add(door);
    addShadow(g);
    return g;
  }

  // Floating island that holds the challenge cups.
  function skyIsland() {
    const g = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: 0x7d6a58, roughness: 1, flatShading: true });
    const under = new THREE.Mesh(new THREE.ConeGeometry(9, 16, 9, 3), rock); under.rotation.x = Math.PI; under.position.y = -8; g.add(under);
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.ConeGeometry(2.4, 6, 6), rock); const a = i * 1.26; r.rotation.x = Math.PI; r.position.set(Math.cos(a) * 6, -4, Math.sin(a) * 6); g.add(r); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9, 1.6, 24), new THREE.MeshStandardMaterial({ color: 0x69a64a, roughness: 1 })); top.position.y = 0.2; g.add(top);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.4 })); plaza.position.y = 1.1; g.add(plaza);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.2, metalness: 1, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 2, 12), new THREE.MeshStandardMaterial({ color: 0xeadfc8 })); ped.position.y = 2.3; g.add(ped);
    const cup = new THREE.Mesh(new THREE.LatheGeometry([0, 1.6, 1.9, 2.1, 2.2].map((r, i) => new THREE.Vector2([0.9, 0.35, 1.1, 1.5, 1.6][i], [0, 0.6, 1.4, 2.2, 2.6][i])), 24), gold);
    cup.position.y = 3.3; g.add(cup);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 16, Math.PI), gold); h.position.set(sx * 1.6, 5, 0); h.rotation.z = sx * Math.PI / 2; g.add(h); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0xfbf8f2 })); c.position.set(Math.cos(a) * 4.6, 2.9, Math.sin(a) * 4.6); g.add(c); }
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 26), new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    fall.position.set(8.6, -12, 2); fall.rotation.y = 0.4; g.add(fall);
    addShadow(g);
    return g;
  }

  // ---- one landmark per dimension ----
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
  const cyl = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
  const finish = (g) => { addShadow(g); return g; };

  // Physical: a stadium with a red running track and floodlights.
  const arena = () => {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 3.2, 40, 1, true), M(0xb8b2a6, { side: THREE.DoubleSide })); bowl.position.y = 1.6; g.add(bowl);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(8.2 + i * 0.25, 0.18, 6, 48), M(i % 2 ? 0xc0392b : 0xa93226)); r.rotation.x = Math.PI / 2; r.position.y = 0.8 + i * 0.7; g.add(r); }
    cyl(g, 7.6, 7.6, 0.3, M(0xc0392b), 0, 0.1);
    cyl(g, 5.8, 5.8, 0.34, M(0x3fa34d), 0, 0.1);
    for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { cyl(g, 0.2, 0.25, 8, M(0x888888), x, 0, z, 8); box(g, 1.6, 0.8, 0.4, M(0xffffff, { emissive: 0xffffcc, emissiveIntensity: 0.6 }), x, 8, z); }
    return finish(g);
  };
  // Emotional: a heart-shaped pond with blossom trees.
  const heartGarden = () => {
    const g = new THREE.Group();
    const sh = new THREE.Shape(); sh.moveTo(0, -3); sh.bezierCurveTo(-5, 1, -3.5, 5, 0, 2.8); sh.bezierCurveTo(3.5, 5, 5, 1, 0, -3);
    const pond = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), M(0x7fc4d6, { roughness: 0.1 })); pond.rotation.x = -Math.PI / 2; pond.position.y = 0.3; pond.scale.setScalar(1.3); g.add(pond);
    const rim = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), M(0xffc1d6)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.2; rim.scale.setScalar(1.55); g.add(rim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 8, z = Math.sin(a) * 7;
      cyl(g, 0.2, 0.3, 2.4, M(0x7a5a3c), x, 0, z, 6);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), M(i % 2 ? 0xffb3cc : 0xff9ebb)); c.position.set(x, 3.4, z); g.add(c);
    }
    const bench = box(g, 2.4, 0.3, 0.8, M(0x8b5a2b), 0, 0.6, 5.4);
    const pav = cyl(g, 0.1, 0.1, 3, M(0xffffff), -4, 0, -5); const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 8), M(0xe8a0b8)); roof.position.set(-4, 3.6, -5); g.add(roof);
    return finish(g);
  };
  // Social: a ring of colourful houses around a square with a fountain.
  const village = () => {
    const g = new THREE.Group();
    cyl(g, 7.5, 7.5, 0.3, M(0xd9c7a3), 0, 0);
    const walls = [0xf1d8b0, 0xe8c79a, 0xf3e1c2, 0xe2c59a], roofs = [0xb5523b, 0x8e3b3b, 0x7a3a2a];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5, h = 2.5 + (i % 3);
      const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = -a + Math.PI / 2; g.add(hg);
      box(hg, 3, h, 3, M(walls[i % 4]));
      const r = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.8, 4), M(roofs[i % 3])); r.position.y = h + 0.9; r.rotation.y = Math.PI / 4; hg.add(r);
    }
    cyl(g, 1.6, 1.8, 0.8, M(0xe9e4d8), 0, 0.3); cyl(g, 1.3, 1.3, 0.1, M(0x7fb7c4), 0, 1.05); cyl(g, 0.25, 0.3, 2, M(0xe9e4d8), 0, 1);
    for (const [x, z, c] of [[-3, 3, 0xc0392b], [3, 3, 0x2f6f5e]]) { box(g, 1.8, 1.2, 1.2, M(0x7a5a3c), x, 0.3, z); box(g, 2.2, 0.15, 1.6, M(c), x, 2.2, z); }
    return finish(g);
  };
  // Intellectual: a tall library tower crowned with an observatory dome.
  const knowledgeTower = () => {
    const g = new THREE.Group();
    cyl(g, 4, 4.6, 5, M(0x5a4a3a), 0, 0, 0, 12);
    cyl(g, 3, 3.5, 7, M(0x6b5846), 0, 5, 0, 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(g, 0.6, 2, 0.1, M(0x8fb0d8, { emissive: 0x3a5a8a, emissiveIntensity: 0.4 }), Math.cos(a) * 3.1, 7.5, Math.sin(a) * 3.1).rotation.y = -a + Math.PI / 2; }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x8a9aa8, { metalness: 0.7, roughness: 0.3 })); dome.position.y = 12; g.add(dome);
    const scope = cyl(g, 0.35, 0.5, 3.5, M(0xc9a45c, { metalness: 0.9 }), 1.2, 13, 0, 10); scope.rotation.z = -0.8;
    for (let i = 0; i < 3; i++) box(g, 1.4, 1.8, 0.4, M([0x8e3b3b, 0x2f4a6d, 0xc9a45c][i]), -5 + i * 0.5, 0, 4 + i * 0.3).rotation.z = (i - 1) * 0.15;
    return finish(g);
  };
  // Professional: a glass office tower with a construction crane and gears.
  const workTower = () => {
    const g = new THREE.Group();
    box(g, 6, 16, 6, M(0x2c3e50, { metalness: 0.4, roughness: 0.3 }));
    for (let y = 1; y < 16; y += 1.6) for (const [x, z, ry] of [[0, 3.02, 0], [0, -3.02, 0], [3.02, 0, Math.PI / 2], [-3.02, 0, Math.PI / 2]]) box(g, 5, 0.9, 0.05, M(0xffd68a, { emissive: 0xffa94d, emissiveIntensity: (y * 7) % 3 > 1 ? 0.5 : 0.1 }), x, y, z).rotation.y = ry;
    box(g, 4, 9, 4, M(0x34495e), 6, 0, 2);
    cyl(g, 0.25, 0.25, 22, M(0xe67e22), -5, 0, -2, 6);
    box(g, 14, 0.4, 0.4, M(0xe67e22), 0, 21.6, -2);
    cyl(g, 0.05, 0.05, 5, M(0x333333), 5.5, 16.6, -2, 4);
    box(g, 1.2, 0.8, 1.2, M(0xe67e22), 5.5, 15.8, -2);
    for (const [x, r] of [[-3, 1.4], [-5, 0.9]]) { const gear = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 6, 12), M(0xe67e22, { metalness: 0.8 })); gear.position.set(x, r + 0.3, 5); g.add(gear); }
    return finish(g);
  };
  // Financial: a treasury with columns, a golden dome and coin piles.
  const treasury = () => {
    const g = new THREE.Group();
    box(g, 12, 0.8, 9, M(0xe2d6b8));
    box(g, 10, 6, 7, M(0xf1ead8), 0, 0.8);
    for (let i = 0; i < 6; i++) cyl(g, 0.4, 0.45, 5.5, M(0xfbf8f2), -4 + i * 1.6, 0.8, 4, 12);
    const ped = new THREE.Mesh(new THREE.ConeGeometry(7, 2, 4), M(0xe2d6b8)); ped.position.y = 7.8; ped.rotation.y = Math.PI / 4; ped.scale.z = 0.7; g.add(ped);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffc83d, { metalness: 1, roughness: 0.2 })); dome.position.y = 8.6; g.add(dome);
    const gold = M(0xffc83d, { metalness: 1, roughness: 0.25 });
    for (const [x, z, n] of [[-6, 6, 5], [6, 6, 4], [7, -3, 6]]) for (let i = 0; i < n; i++) cyl(g, 0.8, 0.8, 0.22, gold, x, i * 0.24, z, 16);
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 24), M(0x8a8f96, { metalness: 0.9 })); vault.rotation.x = Math.PI / 2; vault.position.set(0, 3, 3.6); g.add(vault);
    return finish(g);
  };
  // Environmental: a giant tree of life with a greenhouse and flowers.
  const lifeTree = () => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 10, 10), M(0x6b4a2a)); trunk.position.y = 5; g.add(trunk);
    for (const [x, y, z, r, c] of [[0, 12, 0, 5, 0x3e8e41], [-3.5, 10, 1, 3.5, 0x4caf50], [3.5, 10, -1, 3.5, 0x43a047], [0, 15, 0, 3.4, 0x66bb6a], [1, 10.5, 3.5, 3, 0x388e3c]]) {
      const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(c)); c2.position.set(x, y, z); g.add(c2);
    }
    for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0xffeb3b, { emissive: 0xaa8800, emissiveIntensity: 0.4 })); const a = i * 0.9; f.position.set(Math.cos(a) * 4.5, 10 + (i % 4) * 1.4, Math.sin(a) * 4.5); g.add(f); }
    const gh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xbfe9f7, { transparent: true, opacity: 0.5, roughness: 0.05 })); gh.position.set(7, 0, 3); g.add(gh);
    for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28, r = 4 + Math.random() * 4; const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 4), M([0xe74c3c, 0xf1c40f, 0x9b59b6, 0xff7aa2][i % 4])); fl.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); g.add(fl); }
    return finish(g);
  };
  const DIM_BUILD = { body: arena, heart: heartGarden, social: village, library: knowledgeTower, career: workTower, wealth: treasury, nature: lifeTree };

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
    const floating = !!s.def.floating;
    const y = floating ? 26 : height(s.x, s.z);
    const obj = floating ? skyIsland() : s.def.kind === 'hq' ? fortress() : s.def.id === 'sanctuary' ? palace() : (DIM_BUILD[s.def.id] || ruin)();
    obj.scale.setScalar(floating ? 1.1 : 1.5);
    obj.position.set(s.x, y - 0.2, s.z);
    if (floating) obj.userData.float = y;
    obj.userData.spot = s.def.id;
    obj.traverse((m) => { m.userData.spot = s.def.id; });
    scene.add(obj); pickables.push(obj);
    if (s.vis === 'owned' && !floating) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(10, 11.5, 64), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, y + 0.5, s.z); scene.add(ring); glow = ring;
    }
    const el = document.createElement('button');
    el.className = `w3-label ${s.vis}`;
    el.innerHTML = s.vis === 'owned' ? s.def.name
      : `🔒 ${s.def.name} · ${s.def.cost?.keys ? `🗝 ${s.def.cost.keys}` : `🪙 ${s.def.cost?.gold ?? 0}`}`;
    el.onclick = () => onPick(s.def.id);
    labelLayer.appendChild(el);
    labels.push({ el, v: new THREE.Vector3(s.x, y + (floating ? 26 : 22), s.z) });
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
  const bounds = { x: SIZE * 0.62, z: DEPTH * 0.62 };
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
    for (const o of pickables) if (o.userData.float != null) { o.position.y = o.userData.float + Math.sin(t * 0.8) * 0.9; o.rotation.y = t * 0.05; }
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
