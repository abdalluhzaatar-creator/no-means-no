// 3D world map: procedural island terrain, sea, sky, forests and volumetric-looking
// clouds that hide places the player has not reached yet.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';
import { sfx } from './audio.js';
import { DIM_BUILD } from './landmarks.js';

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

export function mountWorld(container, spots, onPick, { sky: skyInfo = () => ({ elev: 45, pm: false }), weather = 'clear' } = {}) {
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
      if (s.def.kind === 'hq') {
        // The fortress sits on top of a high plateau (hill with a flat crown).
        const d2 = Math.hypot(x - s.x, z - s.z);
        const hill = 22 * (1 - THREE.MathUtils.smoothstep(d2, 14, 46));
        h = Math.max(h, hill);
        continue;
      }
      const k = Math.exp(-((x - s.x) ** 2 + (z - s.z) ** 2) / 260);
      h = h * (1 - k) + 6 * k;
    }
    // Below the waterline, drop the seabed steeply so it never sits at the same depth
    // as the water surface (that z-fighting made the sea blink).
    if (h < 1.5) h = h - (1.5 - h) * 2 - 1.5;
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
  const camera = new THREE.PerspectiveCamera(45, 1, 2, 5000);

  const sky = new Sky();
  sky.scale.setScalar(4000);
  const su = sky.material.uniforms;
  su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.8;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(210));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene(); const skyClone = new Sky(); skyClone.scale.setScalar(1000);
  Object.assign(skyClone.material.uniforms.sunPosition.value, sunDir); skyScene.add(skyClone);
  const envTex = pmrem.fromScene(skyScene).texture;
  scene.environment = envTex;

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 180, bottom: -180, near: 1, far: 800 });
  sun.shadow.bias = -0.0005;
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6b5a3a, 0.8);
  scene.add(sun, hemi);

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
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x1f6f8b, roughness: 0.32, metalness: 0.05,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
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
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.anisotropy = 8; return t;
  })();
  water.material.normalMap = waveTex; water.material.normalScale.set(0.12, 0.12);
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
    // Prison wing behind the keep: a squat dark tower joined by a wall, barred windows.
    const dark2 = new THREE.MeshStandardMaterial({ color: 0x5f564c, roughness: 1 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), dark2); wing.position.set(0, 2.8, -10.5); g.add(wing);
    const link = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 5), stone); link.position.set(0, 2.2, -7); g.add(link);
    for (const x of [-3, 0, 3]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 })); w.position.set(x, 3.4, -14.05); g.add(w); for (const bx of [-0.25, 0, 0.25]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 })); b.position.set(x + bx, 3.4, -14.1); g.add(b); } }
    for (let i = -4; i <= 4; i += 1.6) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1), dark2); m.position.set(i, 5.7, -14); g.add(m); }
    const dt = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 10, 12), dark2); dt.position.set(4.5, 5, -12); g.add(dt);
    const dr = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 12), new THREE.MeshStandardMaterial({ color: 0x3a2a2a })); dr.position.set(4.5, 11.5, -12); g.add(dr);
    const glowW = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff7a1c, emissiveIntensity: 1 })); glowW.position.set(4.5, 7, -9.8); g.add(glowW);
    addShadow(g);
    return g;
  }

  // Floating island that holds the challenge cups.
  function skyIsland() {
    const g = new THREE.Group();
    let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const rockA = new THREE.MeshStandardMaterial({ color: 0x6f5e4e, roughness: 1, flatShading: true });
    const rockB = new THREE.MeshStandardMaterial({ color: 0x8a7663, roughness: 1, flatShading: true });
    const dirt = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1, flatShading: true });
    const grassM = new THREE.MeshStandardMaterial({ color: 0x5f9e3f, roughness: 1, flatShading: true });

    // Irregular grassy top: a jagged disc, slightly domed.
    const top = new THREE.CylinderGeometry(10, 9.2, 1.6, 22, 2);
    const tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i), d = Math.hypot(x, z);
      if (d > 1) { const a = Math.atan2(z, x), k = 1 + Math.sin(a * 3) * 0.08 + Math.sin(a * 7 + 1) * 0.05; tp.setX(i, x * k); tp.setZ(i, z * k); }
      if (tp.getY(i) > 0) tp.setY(i, tp.getY(i) + Math.max(0, 1 - d / 10) * 0.8);
    }
    top.computeVertexNormals();
    const grass = new THREE.Mesh(top, grassM); grass.position.y = 0.2; g.add(grass);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 8.4, 2.4, 22), dirt); soil.position.y = -1.6; g.add(soil);

    // Rocky underside: one big inverted crag plus many hanging stalactites and boulders.
    const core = new THREE.Mesh(new THREE.ConeGeometry(8.6, 16, 11, 5), rockA);
    const cp = core.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) { const k = 0.8 + r() * 0.4; cp.setX(i, cp.getX(i) * k); cp.setZ(i, cp.getZ(i) * k); }
    core.geometry.computeVertexNormals(); core.rotation.x = Math.PI; core.position.y = -10.5; g.add(core);
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 2 + r() * 6.5, h = 4 + r() * 9;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.8 + r() * 1.8, h, 6), i % 2 ? rockA : rockB);
      c.rotation.x = Math.PI; c.rotation.z = (r() - 0.5) * 0.3; c.position.set(Math.cos(a) * d, -2.6 - h / 2 - r() * 3, Math.sin(a) * d); g.add(c);
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = 7.5 + r() * 2.2;
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + r() * 1.3, 0), rockB); b.position.set(Math.cos(a) * d, -1.8 - r() * 2, Math.sin(a) * d); b.rotation.set(r(), r(), r()); g.add(b);
    }
    // Hanging roots
    for (let i = 0; i < 10; i++) {
      const a = r() * Math.PI * 2, d = 7 + r() * 2;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 2 + r() * 3, 5), new THREE.MeshStandardMaterial({ color: 0x3e2f22 }));
      root.position.set(Math.cos(a) * d, -3.8 - r(), Math.sin(a) * d); root.rotation.z = (r() - 0.5) * 0.5; g.add(root);
    }

    // Small temple on top
    const marble = new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.35 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, roughness: 0.2, metalness: 1, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 32), marble); base.position.set(-1.5, 1.4, -1); g.add(base);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.4, 10), marble); c.position.set(-1.5 + Math.cos(a) * 3.3, 3.5, -1 + Math.sin(a) * 3.3); g.add(c); }
    const roof = new THREE.Mesh(new THREE.SphereGeometry(3.7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold); roof.position.set(-1.5, 5.2, -1); roof.scale.y = 0.6; g.add(roof);
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.5, 0], [0.2, 0.4], [0.7, 1.1], [0.95, 1.8], [1, 2.1]].map(([x, y]) => new THREE.Vector2(x, y)), 24), gold);
    cup.position.set(-1.5, 1.8, -1); g.add(cup);
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 5 + r() * 3.5; const t = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2f5a2e })); t.scale.y = 2.2; t.position.set(Math.cos(a) * d, 2.2, Math.sin(a) * d); if (Math.hypot(t.position.x - 5.5, t.position.z - 3) > 3) g.add(t); }

    // Waterfall: pond on the top edge → stream over the lip → long curtain of falling water → mist.
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2, 24), new THREE.MeshStandardMaterial({ color: 0x3aa0c8, roughness: 0.05, metalness: 0.2 })); pond.rotation.x = -Math.PI / 2; pond.position.set(5.5, 1.75, 3); g.add(pond);
    const waterTex = (() => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d');
      const grd = c.createLinearGradient(0, 0, 64, 0); grd.addColorStop(0, 'rgba(180,225,245,.0)'); grd.addColorStop(.2, 'rgba(200,235,250,.9)'); grd.addColorStop(.8, 'rgba(200,235,250,.9)'); grd.addColorStop(1, 'rgba(180,225,245,0)');
      c.fillStyle = grd; c.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`; c.fillRect(6 + Math.random() * 52, Math.random() * 256, 1 + Math.random() * 2, 8 + Math.random() * 30); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
    })();
    const waterM = new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    // Lip + curtain as one bent strip following the cliff.
    const pts = [new THREE.Vector3(5.5, 1.8, 3), new THREE.Vector3(7.8, 1.4, 4.4), new THREE.Vector3(9.3, 0.2, 5.3), new THREE.Vector3(9.9, -3, 5.7), new THREE.Vector3(10.3, -14, 6), new THREE.Vector3(10.5, -30, 6.2)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const N = 60, W = 1.4, verts = [], uvs = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPoint(t), w = W * (1 + t * 0.9);
      const side = new THREE.Vector3(-0.53, 0, 0.85).multiplyScalar(w / 2);
      verts.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
      uvs.push(0, t * 4, 1, t * 4);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.setIndex(idx);
    const fall = new THREE.Mesh(fg, waterM); g.add(fall);
    // Spray particles falling and mist cloud at the bottom
    const SP = 160, sp = new Float32Array(SP * 3), sv = Array.from({ length: SP }, () => r());
    const spray = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false }));
    g.add(spray);
    const mist = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); mist.position.set(10.5, -30, 6.2); mist.scale.y = 0.6; g.add(mist);

    g.userData.tick = (t) => {
      waterTex.offset.y = -t * 1.6;
      for (let i = 0; i < SP; i++) {
        const k = (sv[i] + t * 0.35) % 1, p = curve.getPoint(0.3 + k * 0.7);
        sp.set([p.x + Math.sin(i * 7.3) * (0.4 + k * 1.4), p.y, p.z + Math.cos(i * 3.1) * (0.4 + k * 1.4)], i * 3);
      }
      spray.geometry.attributes.position.needsUpdate = true;
      mist.scale.set(1 + Math.sin(t * 1.5) * 0.08, 0.6, 1 + Math.cos(t * 1.3) * 0.08);
    };
    addShadow(g);
    fall.castShadow = false; spray.castShadow = false; mist.castShadow = false;
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
    const floating = !!s.def.floating;
    const y = floating ? 26 : height(s.x, s.z);
    const obj = floating ? skyIsland() : s.def.kind === 'hq' ? fortress() : s.def.id === 'sanctuary' ? palace() : (DIM_BUILD[s.def.id] || ruin)();
    obj.scale.setScalar(floating ? 1.1 : s.def.kind === 'hq' ? 1.9 : 1.5);
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

  // ---------- time of day, weather, night sky ----------
  const W_TAB = {
    clear: { cloud: 0, dim: 0, fog: 0, rain: 0, snow: 0 }, cloudy: { cloud: 0.3, dim: 0.15, fog: 0.1, rain: 0, snow: 0 },
    overcast: { cloud: 0.6, dim: 0.45, fog: 0.3, rain: 0, snow: 0 }, fog: { cloud: 0.4, dim: 0.4, fog: 1, rain: 0, snow: 0 },
    rain: { cloud: 0.7, dim: 0.55, fog: 0.4, rain: 1, snow: 0 }, storm: { cloud: 0.9, dim: 0.7, fog: 0.5, rain: 1.4, snow: 0 },
    snow: { cloud: 0.6, dim: 0.35, fog: 0.45, rain: 0, snow: 1 },
  };
  let WX = W_TAB[weather] || W_TAB.clear, wxKind = weather, night = 0, golden = 0;
  // Stars: a dome of points with twinkle, plus a band of the milky way.
  const STAR_N = 3500, starPos = new Float32Array(STAR_N * 3), starCol = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    const band = i < 1200;
    const th = band ? Math.PI / 2 + (rand() - 0.5) * 0.35 : Math.acos(1 - rand() * 0.98);
    const v3 = new THREE.Vector3().setFromSphericalCoords(1500, th, rand() * Math.PI * 2);
    if (band) v3.applyAxisAngle(new THREE.Vector3(1, 0, 0.4).normalize(), 1.1);
    if (v3.y < 60) v3.y = 60 + Math.abs(v3.y) * 0.6;
    starPos.set([v3.x, v3.y, v3.z], i * 3);
    const c = new THREE.Color().setHSL(0.58 + (rand() - 0.5) * 0.15, 0.5, 0.75 + rand() * 0.25); starCol.set([c.r, c.g, c.b], i * 3);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 4.5, sizeAttenuation: false, map: starTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  const bigStars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos.slice(1200 * 3, 1500 * 3), 3)), new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, map: starTex, color: 0xfff6e0, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(stars, bigStars);
  // Moon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false, transparent: true }));
  moon.position.set(-600, 700, -900); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xcfdcff, transparent: true, opacity: 0, depthWrite: false, fog: false })); moonGlow.scale.setScalar(420); moonGlow.position.copy(moon.position); scene.add(moonGlow);
  const moonLight = new THREE.DirectionalLight(0x9fb4e6, 0); moonLight.position.copy(moon.position).normalize().multiplyScalar(300); scene.add(moonLight);
  // Shooting stars: streaks that cross the sky every few seconds at night.
  const meteors = Array.from({ length: 4 }, () => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0.1, 0.15, 0.3]), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2 }));
    const headS = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); headS.scale.setScalar(26); scene.add(headS);
    scene.add(line);
    return { line, headS, life: 0, dur: 1, from: new THREE.Vector3(), dir: new THREE.Vector3(), next: 0.5 + Math.random() * 3 };
  });
  const launch = (m) => {
    // Start somewhere in the sky in front of the camera so the player sees it.
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    const side = new THREE.Vector3(-f.z, 0, f.x);
    m.from.copy(camera.position).addScaledVector(f, 700).addScaledVector(side, (Math.random() - 0.5) * 900); m.from.y = camera.position.y + 120 + Math.random() * 220;
    m.dir.copy(side).multiplyScalar(Math.random() < 0.5 ? -1 : 1).add(new THREE.Vector3(0, -0.45 - Math.random() * 0.3, 0)).normalize().multiplyScalar(500 + Math.random() * 400);
    m.life = 0; m.dur = 0.7 + Math.random() * 0.8;
  };
  // Night lights at every place (windows / lanterns) + fireflies over the forest.
  const nightLights = [];
  for (const s of shown) {
    const l = new THREE.PointLight(s.def.floating ? 0xffd27a : 0xffb866, 0, 40, 1.6);
    l.position.set(s.x, (s.def.floating ? 26 : height(s.x, s.z)) + 10, s.z); scene.add(l); nightLights.push(l);
  }
  const FF = 300, ffPos = new Float32Array(FF * 3), ffSeed = new Float32Array(FF);
  for (let i = 0; i < FF; i++) { const x = (rand() - 0.5) * SIZE * 1.1, z = (rand() - 0.5) * DEPTH * 1.1; ffPos.set([x, Math.max(2, height(x, z)) + 2 + rand() * 4, z], i * 3); ffSeed[i] = rand() * 6.28; }
  const fireflies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ffPos, 3)), new THREE.PointsMaterial({ color: 0xfff08a, size: 1.4, map: starTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(fireflies);
  // Rain / snow around the camera target
  const PR = 2500, prPos = new Float32Array(PR * 6);
  for (let i = 0; i < PR; i++) { const x = (rand() - 0.5) * 260, y = rand() * 140, z = (rand() - 0.5) * 260; prPos.set([x, y, z, x, y - 3, z], i * 6); }
  const rainL = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(prPos, 3)), new THREE.LineBasicMaterial({ color: 0xb4c8d8, transparent: true, opacity: 0.5 }));
  rainL.frustumCulled = false; scene.add(rainL);
  const SN = 2500, snPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) snPos.set([(rand() - 0.5) * 260, rand() * 140, (rand() - 0.5) * 260], i * 3);
  const snowP = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snPos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, map: starTex, transparent: true, depthWrite: false }));
  snowP.frustumCulled = false; scene.add(snowP);
  const flash = new THREE.AmbientLight(0xdfe8ff, 0); scene.add(flash);
  const baseCloud = cloudMats.map((m) => m.color.clone());
  const tmpC = new THREE.Color();

  const applySky = () => {
    const { elev, pm } = skyInfo();
    const e = Math.max(elev, -14);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - e), pm ? 3.9 : 0.9);
    su.sunPosition.value.copy(dir);
    su.turbidity.value = 6 + WX.dim * 12; su.rayleigh.value = THREE.MathUtils.lerp(1.6, 0.6, WX.dim);
    night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    golden = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 12, 0, 1) * (1 - night);
    sun.position.copy(dir).multiplyScalar(300);
    sun.color.set(0xfff1d6).lerp(tmpC.set(0xff9a5a), golden * 0.85);
    sun.intensity = 2.6 * (1 - night) * (1 - WX.dim * 0.75);
    moonLight.intensity = 0.9 * night * (1 - WX.dim * 0.7);
    hemi.intensity = THREE.MathUtils.lerp(0.8, 0.22, night) * (1 - WX.dim * 0.2);
    hemi.color.set(night > 0.5 ? 0x3a4a80 : 0xcfe6ff);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.55, 0.85, night) + WX.dim * 0.1;
    sky.visible = night < 0.97 && WX.dim < 0.6;
    const bg = tmpC.set(0xaab6c0).lerp(new THREE.Color(0x070b1c), night);
    scene.background = sky.visible ? null : bg.clone();
    const fogC = new THREE.Color(0xbfd4e2).lerp(new THREE.Color(0xe8b48c), golden * 0.7).lerp(new THREE.Color(0x0b1024), night).lerp(new THREE.Color(0x9aa6b0).multiplyScalar(1 - night * 0.8), WX.dim);
    scene.fog.color.copy(fogC); scene.fog.density = 0.0026 + WX.fog * 0.006;
    cloudMats.forEach((m, i) => m.color.copy(baseCloud[i]).lerp(tmpC.set(0x6f7880), WX.dim).lerp(tmpC.set(0xffb48a), golden * 0.5).lerp(tmpC.set(0x121828), night));
    moon.visible = moonGlow.visible = night > 0.05;
    // Dim the sky reflection at night without swapping it (swapping recompiles every material).
    const envK = (1 - night * 0.9) * (1 - WX.dim * 0.4);
    scene.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = envK; });
    hemi.intensity *= 1 - night * 0.3;
    rainL.visible = WX.rain > 0; snowP.visible = WX.snow > 0;
    water.material.color.set(night > 0.5 ? 0x0e2a3a : 0x1f6f8b);
  };
  applySky();

  const clock = new THREE.Clock(); const v = new THREE.Vector3();
  let raf, lastSky = 0, nextBolt = 3;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    controls.update();
    waveTex.offset.set(t * 0.004, t * 0.006);
    for (const sp of cloudGroup.children) { sp.position.x += dt * sp.userData.drift; if (sp.position.x > SIZE * 0.85) sp.position.x -= SIZE * 1.7; }
    if (glow) glow.material.opacity = 0.35 + Math.sin(t * 2) * 0.2;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    // night sky
    const clearSky = Math.min(1, night * 1.2) * (1 - WX.cloud * 0.95);
    stars.material.opacity = clearSky * (0.85 + Math.sin(t * 3) * 0.1);
    bigStars.material.opacity = clearSky * (0.6 + Math.sin(t * 5.3) * 0.4);
    moon.material.opacity = night * (1 - WX.dim * 0.7); moonGlow.material.opacity = 0.35 * night * (1 - WX.dim);
    for (const m of meteors) {
      if (clearSky < 0.3) { m.line.material.opacity = 0; m.headS.material.opacity = 0; continue; }
      if (m.life <= 0) { m.next -= dt; if (m.next <= 0) { launch(m); sfx.meteor(); m.life = 0.0001; m.next = 1.5 + Math.random() * 4; } continue; }
      m.life += dt; const k = m.life / m.dur;
      if (k >= 1) { m.life = 0; m.line.material.opacity = 0; m.headS.material.opacity = 0; continue; }
      const head = m.from.clone().addScaledVector(m.dir, k), tail = m.from.clone().addScaledVector(m.dir, Math.max(0, k - 0.25));
      const a = m.line.geometry.attributes.position; a.setXYZ(0, head.x, head.y, head.z); a.setXYZ(1, tail.x, tail.y, tail.z); a.needsUpdate = true;
      m.line.material.opacity = Math.sin(k * Math.PI) * clearSky; m.headS.position.copy(head); m.headS.material.opacity = m.line.material.opacity;
    }
    for (const l of nightLights) l.intensity = (night * 1 + WX.dim * 0.3) * 60 * (0.9 + Math.sin(t * 7 + l.position.x) * 0.06);
    fireflies.material.opacity = night * (1 - WX.rain) * (1 - WX.snow) * (0.6 + Math.sin(t * 2) * 0.3);
    for (let i = 0; i < FF; i++) { ffPos[i * 3 + 1] += Math.sin(t * 1.5 + ffSeed[i]) * dt * 0.8; ffPos[i * 3] += Math.cos(t + ffSeed[i]) * dt * 0.6; }
    fireflies.geometry.attributes.position.needsUpdate = true;
    // precipitation follows the camera target
    const cx = controls.target.x, cz = controls.target.z;
    if (rainL.visible) {
      const sp = 90 * dt;
      for (let i = 0; i < PR; i++) { const o = i * 6; let y = prPos[o + 1] - sp; if (y < -5) { y = 140; prPos[o] = cx + (Math.random() - 0.5) * 260; prPos[o + 2] = cz + (Math.random() - 0.5) * 260; } prPos[o + 1] = y; prPos[o + 3] = prPos[o] + 0.3; prPos[o + 4] = y - 3; prPos[o + 5] = prPos[o + 2]; }
      rainL.geometry.attributes.position.needsUpdate = true;
    }
    if (snowP.visible) {
      for (let i = 0; i < SN; i++) { const o = i * 3; let y = snPos[o + 1] - dt * 6; if (y < -5) { y = 140; snPos[o] = cx + (Math.random() - 0.5) * 260; snPos[o + 2] = cz + (Math.random() - 0.5) * 260; } snPos[o + 1] = y; snPos[o] += Math.sin(t + i) * dt; }
      snowP.geometry.attributes.position.needsUpdate = true;
    }
    if (wxKind === 'storm' && t > nextBolt) { flash.intensity = 5; setTimeout(sfx.thunder, 600 + Math.random() * 1500); nextBolt = t + 4 + Math.random() * 8; }
    flash.intensity *= 0.85;
    for (const o of pickables) if (o.userData.float != null) { o.position.y = o.userData.float + Math.sin(t * 0.8) * 0.9; o.rotation.y = t * 0.05; o.userData.tick?.(t); }
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

  const dispose = () => {
    cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); });
    renderer.dispose(); pmrem.dispose(); renderer.forceContextLoss?.();
    container.innerHTML = '';
  };
  dispose.setWeather = (k) => { wxKind = k; WX = W_TAB[k] || W_TAB.clear; applySky(); };
  dispose.refreshSky = applySky;
  return dispose;
}
