// The base's 3D models, in Clash of Clans proportions and colours: bright green grass in
// soft squares, a darker grass strip around the map, a forest all round it, short round
// trees (2×2 cells, about as tall as a builder's hut) and grey rocks, and the buildings
// a village starts with. Each model stands on the ground at (0, 0, 0), centred on its cells.
import * as THREE from './vendor/three.module.min.js';
import { GRID, BORDER } from './base.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
// Smooth, painted-looking shading (no facets), as Clash looks.
const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
// A rounded boulder: a sphere pushed in and out a little, smooth.
const boulder = (r, seed = 3) => {
  const g = new THREE.SphereGeometry(r, 20, 14), p = g.attributes.position, v = new THREE.Vector3(), rr = rng(seed);
  const k = [rr() * 6, rr() * 6, rr() * 6];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.12 * Math.sin(v.x * 2.1 / r + k[0]) * Math.cos(v.z * 1.7 / r + k[1]) + 0.08 * Math.sin(v.y * 2.6 / r + k[2]); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
};
const mesh = (g, geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483646; return h + 1; };

// ---------- the ground (as in Clash's empty village: see the designer's reference) ----------
// Inside: light yellow-green with faint diamonds (squares, seen corner-on). Round it, a strip of
// darker, streaky grass (STRIP cells wide) ending in a thin dirt line, then the woods.
export const STRIP = 5;
export const GRASS = { a: '#a7d042', b: '#a0ca3d', strip: '#79b134', far: 0x2f5c1c };
export function groundTexture() {
  const cells = GRID + STRIP * 2, px = 16, W = cells * px, cv = document.createElement('canvas'); cv.width = cv.height = W;
  const g = cv.getContext('2d'), r = rng(11);
  g.fillStyle = GRASS.strip; g.fillRect(0, 0, W, W);
  // The strip's streaks.
  for (let k = 0; k < 9000; k++) { const x = r() * W, y = r() * W; g.fillStyle = r() < 0.5 ? 'rgba(40,90,20,.22)' : 'rgba(170,215,90,.22)'; g.fillRect(x, y, 1.5, 4 + r() * 4); }
  // The dirt line at the strip's outer edge.
  const e = STRIP * px - 6; g.strokeStyle = '#a5823f'; g.lineWidth = 3; g.globalAlpha = 0.8; g.strokeRect(6, 6, W - 12, W - 12); g.globalAlpha = 1;
  // The map: soft checks, one per cell.
  const o = STRIP * px;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) { g.fillStyle = (i + j) % 2 ? GRASS.a : GRASS.b; g.fillRect(o + i * px, o + j * px, px, px); }
  // A soft edge between the map and the strip, and grass speckles on the map.
  const grad = (x0, y0, x1, y1) => { const l = g.createLinearGradient(x0, y0, x1, y1); l.addColorStop(0, 'rgba(90,150,40,.45)'); l.addColorStop(1, 'rgba(90,150,40,0)'); return l; };
  g.fillStyle = grad(o, 0, o + 10, 0); g.fillRect(o, o, 10, GRID * px); g.fillStyle = grad(o + GRID * px, 0, o + GRID * px - 10, 0); g.fillRect(o + GRID * px - 10, o, 10, GRID * px);
  g.fillStyle = grad(0, o, 0, o + 10); g.fillRect(o, o, GRID * px, 10); g.fillStyle = grad(0, o + GRID * px, 0, o + GRID * px - 10); g.fillRect(o, o + GRID * px - 10, GRID * px, 10);
  for (let k = 0; k < 4000; k++) { const x = o + r() * GRID * px, y = o + r() * GRID * px; g.fillStyle = r() < 0.5 ? 'rgba(80,140,30,.18)' : 'rgba(220,240,140,.2)'; g.fillRect(x, y, 2, 2); }
  void e;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// The land round the village, as in the designer's Clash reference: woods right up to the
// strip on three sides — thick, bushy, lime on top and dark below, like heads of broccoli —
// and on the lower left (the +z side) an orange sandy shore with grey rocks, then the deep sea.
// Far at the top right, a cliff with a waterfall. Instanced meshes keep it cheap.
export function scenery(seed = 5) {
  const r = rng(seed), g = new THREE.Group(), edge = GRID / 2 + STRIP, out = edge + 22;
  const SHORE = edge + 4.5;                                   // where the sand meets the sea (z), on average
  // The shore's two edges wander a little (no straight lines). Past the map's corners the woods
  // come down to the sand; along the map the sand starts right at the grass strip.
  const wob = (x, k) => Math.sin(x * 0.37 + k) * 0.5 + Math.sin(x * 0.91 + 2 * k) * 0.25 + Math.sin(x * 0.13 + 3 * k) * 0.6;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const zIn = (x) => { const t = smooth(edge - 1, edge + 7, Math.abs(x)); return (edge - 0.6) * (1 - t) + (SHORE - 3.2 + wob(x, 1) * 0.8) * t; };
  const zOut = (x) => SHORE + wob(x, 2) * 0.9;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  // Woods: a tree every ~1.7 units, each a bunch of leafy balls.
  const spots = [];
  for (let x = -out; x <= out; x += 1.7) for (let z = -out; z <= out; z += 1.7) {
    const px = x + (r() - 0.5) * 1.4, pz = z + (r() - 0.5) * 1.4;
    if (Math.max(Math.abs(px), Math.abs(pz)) < edge + 0.4) continue;
    if (pz > zIn(px) - 0.7) continue;      // no trees on the sand or in the sea
    spots.push([px, pz]);
  }
  const BALLS = 4, LIME = [0x9ccf34, 0x8cc42a, 0xa8d83c, 0x82bc26], DARK = [0x467e18, 0x528c1e, 0x3c7214];
  const leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), flat(0xffffff, { roughness: 0.95 }), spots.length * BALLS);
  spots.forEach(([x, z], k) => {
    const s = 0.95 + r() * 0.45, h = 1.6 + r() * 0.9;
    for (let n = 0; n < BALLS; n++) {
      const top = n === BALLS - 1, a = r() * Math.PI * 2, d = top ? 0.1 : 0.55 * s;
      const rad = (top ? 0.75 : 0.62 + r() * 0.2) * s;
      m4.compose(p.set(x + Math.cos(a) * d, h + (top ? 0.55 * s : r() * 0.3), z + Math.sin(a) * d), q, sc.set(rad, rad * 0.9, rad)); leaf.setMatrixAt(k * BALLS + n, m4);
      leaf.setColorAt(k * BALLS + n, c.set(top ? LIME[Math.floor(r() * 4)] : DARK[Math.floor(r() * 3)]));
    }
  });
  leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
  // The wood's floor: dark, so gaps between the trees read as shade.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(out * 2 + 60, out * 2 + 60), std(0x2f5c1c, { roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; g.add(floor);

  // The shore: orange sand with grey rocks, then the sea, deep and teal.
  // A strip along the shore from xs: rows at z0(x) and z1(x), coloured c0 → c1.
  const strip = (z0, z1, c0, c1, mat) => {
    const pos = [], col = [], idx = [], A = new THREE.Color(c0), B = new THREE.Color(c1); let n = 0;
    for (let x = -out - 30; x <= out + 30; x += 0.8, n++) { pos.push(x, 0, z0(x), x, 0, z1(x)); col.push(A.r, A.g, A.b, B.r, B.g, B.b); if (n) { const k = n * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  // Sand: light orange inland, darker where the waves wet it. Just under the grass, so the strip's edge stays clean.
  const sand = strip(zIn, zOut, 0xd99a52, 0xa9662f, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })); sand.position.y = -0.012; sand.receiveShadow = true; g.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(out * 2 + 200, 140), new THREE.MeshStandardMaterial({ color: 0x1c8bb0, roughness: 0.3, metalness: 0.05 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, SHORE + 66); g.add(sea);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(out * 2 + 200, 120), new THREE.MeshStandardMaterial({ color: 0x125f86, roughness: 0.3 })); deep.rotation.x = -Math.PI / 2; deep.position.set(0, -0.018, SHORE + 72); g.add(deep);
  const foam = strip((x) => zOut(x) - 0.1, (x) => zOut(x) + 0.45, 0xffffff, 0xbfe8f8, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); foam.position.y = -0.008; g.add(foam);
  const stones = [];
  for (let k = 0; k < 170; k++) { const x = (r() * 2 - 1) * (out + 10), a = zIn(x) + 0.8, b = zOut(x) - 0.3, f = Math.sqrt(r()), z = a + (b - a) * f; if (b - a < 0.6) continue; stones.push([x, z, 0.22 + r() * r() * 0.85 * f]); }
  const stone = new THREE.InstancedMesh(boulder(1, 9), flat(0xffffff, { roughness: 0.8 }), stones.length);
  stones.forEach(([x, z, s], k) => { m4.compose(p.set(x, s * 0.35, z), q.setFromEuler(new THREE.Euler(r(), r() * 6, r())), sc.set(s, s * 0.75, s)); stone.setMatrixAt(k, m4); stone.setColorAt(k, c.set([0x8f9399, 0x9da1a6, 0x7d8187][k % 3])); });
  q.identity(); stone.castShadow = true; g.add(stone);
  // The builder's boat at the shore.
  const wood = flat(0xa8743e), darkWood = flat(0x7a5230);
  const boat = new THREE.Group(); boat.position.set(-12, 0, zOut(-12) + 2.4); boat.rotation.y = 0.3; g.add(boat);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 4.2, 16, 1, false, 0, Math.PI), flat(0x8b5a2b)); hull.rotation.set(Math.PI / 2, 0, Math.PI / 2); hull.position.y = 0.55; hull.scale.set(1, 1, 0.65); hull.castShadow = true; boat.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.5), wood); deck.position.y = 0.6; boat.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), darkWood); mast.position.y = 2.2; boat.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.1), std(0xf6efdc, { side: THREE.DoubleSide })); sail.position.set(0.05, 2.4, 0); sail.rotation.y = Math.PI / 2; boat.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), std(0xd8341a, { side: THREE.DoubleSide })); flag.position.set(0, 4.0, 0.25); flag.rotation.y = Math.PI / 2; boat.add(flag);
  // The cliff and the waterfall, far at the top right (the -z side, toward +x).
  const cliff = new THREE.Group(); cliff.position.set(edge + 12, 0, -edge - 14); cliff.scale.setScalar(0.6); g.add(cliff);
  const rockM = flat(0x55594f, { roughness: 0.9 });
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(boulder(3 + r() * 2, k + 21), rockM); m.position.set(-k * 3.2 + 4, 1.5, (k % 2) * 2); m.scale.set(1, 1.6, 1); cliff.add(m); }
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 7), new THREE.MeshStandardMaterial({ color: 0x9fd8f0, emissive: 0x3a7a9a, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 })); fall.position.set(-1, 3.5, 3.6); cliff.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), std(0x5ab8e0)); pool.rotation.x = -Math.PI / 2; pool.position.set(-1, 0.05, 5); cliff.add(pool);
  g.userData.tick = (t) => { boat.position.y = Math.sin(t * 1.3) * 0.06; boat.rotation.z = Math.sin(t * 1.1) * 0.03; foam.material.opacity = 0.45 + Math.sin(t * 2) * 0.2; fall.material.emissiveIntensity = 0.3 + Math.sin(t * 6) * 0.08; };
  return g;
}

// ---------- obstacles (2×2 or 3×3 cells) ----------
const OB = {
  // Clash's little tree: one round lime crown on a short brown trunk.
  tree(r) {
    const g = new THREE.Group();
    mesh(g, new THREE.CylinderGeometry(0.13, 0.18, 0.8, 10), flat(0x7a4a24), 0, 0.4, 0);
    const lime = flat(0x8fcc2c), dark = flat(0x6fae22);
    mesh(g, new THREE.SphereGeometry(0.72, 18, 14), lime, 0, 1.3, 0);
    mesh(g, new THREE.SphereGeometry(0.45, 14, 10), dark, 0.3, 1.05, 0.3);
    g.scale.setScalar(0.95 + r() * 0.15); return g;
  },
  pine(r) {
    const g = new THREE.Group(), m = flat(0x2f7d3a);
    mesh(g, new THREE.CylinderGeometry(0.12, 0.16, 0.5, 16), flat(0x6b4a2a), 0, 0.25, 0);
    mesh(g, new THREE.ConeGeometry(0.85, 1.05, 20), m, 0, 0.95, 0);
    mesh(g, new THREE.ConeGeometry(0.66, 0.9, 20), m, 0, 1.5, 0);
    mesh(g, new THREE.ConeGeometry(0.44, 0.75, 20), m, 0, 2.0, 0);
    g.scale.setScalar(0.95 + r() * 0.15); return g;
  },
  bush(r) {
    const g = new THREE.Group(), m = [flat(0x58a632), flat(0x4c9a2c)];
    for (const [x, z, s] of [[0, 0, 0.5], [0.42, 0.18, 0.4], [-0.38, 0.22, 0.42], [0.1, -0.4, 0.38], [-0.2, -0.25, 0.34]]) mesh(g, new THREE.SphereGeometry(s, 16, 12), m[(x > 0) | 0], x, s * 0.75, z);
    const fl = std(r() < 0.5 ? 0xff7ab8 : 0xfff2a0);
    for (let k = 0; k < 5; k++) mesh(g, new THREE.SphereGeometry(0.07, 6, 4), fl, (r() - 0.5) * 0.9, 0.55 + r() * 0.25, (r() - 0.5) * 0.8, false);
    return g;
  },
  trunk() {
    const g = new THREE.Group(), bark = flat(0x6b4a2a), ring = flat(0xd2ad72);
    const log = mesh(g, new THREE.CylinderGeometry(0.3, 0.32, 1.5, 16), bark, 0, 0.3, 0); log.rotation.z = Math.PI / 2;
    for (const x of [-0.76, 0.76]) { const e = mesh(g, new THREE.CircleGeometry(0.29, 9), ring, x, 0.3, 0); e.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; }
    mesh(g, new THREE.CylinderGeometry(0.22, 0.27, 0.35, 16), bark, 0.3, 0.17, 0.55);
    mesh(g, new THREE.CylinderGeometry(0.21, 0.21, 0.02, 16), ring, 0.3, 0.355, 0.55);
    return g;
  },
  rock(r) {
    const g = new THREE.Group(), m = flat(0x9e9e96);
    const a = mesh(g, boulder(0.72, Math.floor(r() * 1e6) + 1), m, 0, 0.36, 0); a.scale.set(1, 0.68, 0.9); a.rotation.set(r(), r(), r());
    const b = mesh(g, boulder(0.38, Math.floor(r() * 1e6) + 1), flat(0x8a8a83), 0.55, 0.2, 0.4); b.rotation.set(r(), r(), r());
    return g;
  },
  bigrock(r) {
    const g = new THREE.Group(), m = flat(0x96968e);
    const a = mesh(g, boulder(1.2, Math.floor(r() * 1e6) + 1), m, 0, 0.6, 0); a.scale.set(1, 0.72, 0.88); a.rotation.set(r(), r(), r());
    const b = mesh(g, boulder(0.65, Math.floor(r() * 1e6) + 1), flat(0x85857e), 0.9, 0.35, 0.6); b.rotation.set(r(), r(), r());
    const c = mesh(g, boulder(0.45, Math.floor(r() * 1e6) + 1), m, -0.95, 0.25, 0.55); c.rotation.set(r(), r(), r());
    return g;
  },
  gembox() {
    const g = new THREE.Group(), wood = flat(0x8a5a2a), band = std(0xd4a53a, { metalness: 0.7, roughness: 0.3 });
    mesh(g, new THREE.BoxGeometry(1.1, 0.6, 0.75), wood, 0, 0.3, 0);
    for (const x of [-0.4, 0.4]) mesh(g, new THREE.BoxGeometry(0.08, 0.62, 0.77), band, x, 0.3, 0);
    const gem = std(0xff4fb8, { emissive: 0xa0206a, emissiveIntensity: 0.6, roughness: 0.2, flatShading: true });
    for (const [x, z, s] of [[0, 0, 0.26], [-0.28, 0.1, 0.18], [0.3, -0.08, 0.2]]) mesh(g, new THREE.OctahedronGeometry(s, 0), gem, x, 0.65 + s * 0.6, z);
    return g;
  },
};
export function obstacleModel(kind, id) {
  const r = rng(hash(id)), g = OB[kind](r); g.rotation.y = r() * Math.PI * 2; return g;
}

// ---------- buildings ----------
const wood = () => flat(0xa8743e), dark = () => std(0x3a2a1e), stone = () => flat(0xc9c2b2), roof = () => flat(0xc84a32);
const gold = () => std(0xe0b030, { metalness: 0.75, roughness: 0.3 });
// The Town Hall: a square hall with a dome (4×4 cells).
function townhall() {
  const g = new THREE.Group();
  const plaster = std(0xf3ece0, { roughness: 0.75 }), st = std(0xeadfc8), teal = std(0x2f7a8a, { roughness: 0.3, metalness: 0.25 }), gd = std(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), dk = std(0x2d2a28);
  mesh(g, new THREE.BoxGeometry(3.9, 0.35, 3.9), st, 0, 0.17, 0);
  mesh(g, new THREE.BoxGeometry(3.4, 2.4, 3.4), plaster, 0, 1.55, 0);
  mesh(g, new THREE.BoxGeometry(3.6, 0.22, 3.6), teal, 0, 2.85, 0);
  for (const [x, z] of [[-1.62, -1.62], [1.62, -1.62], [-1.62, 1.62], [1.62, 1.62]]) { mesh(g, new THREE.BoxGeometry(0.42, 0.5, 0.42), st, x, 3.15, z); mesh(g, new THREE.ConeGeometry(0.2, 0.4, 4), gd, x, 3.6, z); }
  mesh(g, new THREE.CylinderGeometry(1.25, 1.35, 0.45, 24), plaster, 0, 3.18, 0);
  mesh(g, new THREE.SphereGeometry(1.25, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), teal, 0, 3.4, 0);
  mesh(g, new THREE.SphereGeometry(0.12, 12, 8), gd, 0, 4.7, 0);
  mesh(g, new THREE.ConeGeometry(0.07, 0.5, 20), gd, 0, 5, 0);
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group(); side.rotation.y = (k * Math.PI) / 2; g.add(side);
    mesh(side, new THREE.BoxGeometry(0.9, 1.3, 0.06), dk, 0, 0.95, 1.72, false);
    const arch = mesh(side, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16, 1, false, -Math.PI / 2, Math.PI), dk, 0, 1.6, 1.72, false); arch.rotation.x = Math.PI / 2;
    mesh(side, new THREE.TorusGeometry(0.5, 0.05, 6, 16, Math.PI), gd, 0, 1.6, 1.74, false);
    for (const x of [-1.1, 1.1]) mesh(side, new THREE.BoxGeometry(0.4, 0.6, 0.05), teal, x, 1.9, 1.72, false);
  }
  return g;
}
// The builder's hut (2×2): a little wooden hut with a red roof and a hammer by the door.
function builder() {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(1.8, 0.16, 1.8), stone(), 0, 0.08, 0);
  mesh(g, new THREE.BoxGeometry(1.3, 1.0, 1.3), wood(), 0, 0.66, 0);
  const r = mesh(g, new THREE.ConeGeometry(1.15, 0.85, 4), roof(), 0, 1.58, 0); r.rotation.y = Math.PI / 4;
  mesh(g, new THREE.BoxGeometry(0.45, 0.65, 0.04), dark(), 0, 0.5, 0.67, false);
  mesh(g, new THREE.BoxGeometry(0.08, 0.6, 0.08), flat(0x7a5230), 0.55, 0.45, 0.8);
  mesh(g, new THREE.BoxGeometry(0.32, 0.16, 0.16), flat(0x707070), 0.55, 0.78, 0.8);
  return g;
}
// The gold mine (3×3): a tunnel in a stone mound, a turning wheel, a cart full of gold.
function goldmine() {
  const g = new THREE.Group();
  const mound = mesh(g, new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), flat(0xa89a80), 0, 0.15, -0.3); mound.scale.y = 0.9;
  mesh(g, new THREE.BoxGeometry(2.7, 0.15, 2.7), stone(), 0, 0.075, 0);
  mesh(g, new THREE.BoxGeometry(0.8, 0.9, 0.3), dark(), 0, 0.55, 0.85, false);
  for (const x of [-0.5, 0.5]) mesh(g, new THREE.BoxGeometry(0.14, 1.2, 0.14), wood(), x, 0.6, 1.0);
  mesh(g, new THREE.BoxGeometry(1.2, 0.14, 0.18), wood(), 0, 1.25, 1.0);
  const wheel = mesh(g, new THREE.TorusGeometry(0.45, 0.07, 6, 14), wood(), 0, 1.75, 0.3);
  for (let k = 0; k < 3; k++) { const s = mesh(wheel, new THREE.BoxGeometry(0.9, 0.06, 0.06), wood()); s.rotation.z = (k * Math.PI) / 3; s.position.set(0, 0, 0); }
  mesh(g, new THREE.BoxGeometry(0.1, 1.0, 0.1), wood(), 0, 1.25, 0.3);
  mesh(g, new THREE.BoxGeometry(0.7, 0.4, 0.5), flat(0x6b4a2a), 0.8, 0.35, 0.95);
  for (const [x, z] of [[0.7, 0.9], [0.9, 1.0], [0.8, 0.85]]) mesh(g, new THREE.SphereGeometry(0.18, 12, 8), gold(), x, 0.62, z);
  g.userData.tick = (t) => { wheel.rotation.z = t * 1.5; };
  return g;
}
// The light well (3×3): a marble basin with a bright orb of light turning over it.
function nourwell() {
  const g = new THREE.Group(), marble = std(0xf3efe6, { roughness: 0.4 }), gd = gold();
  mesh(g, new THREE.CylinderGeometry(1.25, 1.35, 0.45, 20), marble, 0, 0.22, 0);
  mesh(g, new THREE.CylinderGeometry(1.0, 1.0, 0.1, 20), std(0x2f7a8a, { roughness: 0.25 }), 0, 0.46, 0);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; mesh(g, new THREE.CylinderGeometry(0.1, 0.12, 1.3, 16), marble, Math.cos(a) * 1.05, 1.05, Math.sin(a) * 1.05); mesh(g, new THREE.SphereGeometry(0.13, 8, 6), gd, Math.cos(a) * 1.05, 1.75, Math.sin(a) * 1.05); }
  const orb = mesh(g, new THREE.SphereGeometry(0.42, 18, 12), new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe58a, emissiveIntensity: 1.6 }), 0, 1.5, 0, false);
  const ring = mesh(g, new THREE.TorusGeometry(0.65, 0.04, 6, 30), gd, 0, 1.5, 0, false);
  g.userData.tick = (t) => { orb.position.y = 1.5 + Math.sin(t * 2) * 0.12; ring.rotation.x = t; ring.rotation.y = t * 0.7; };
  return g;
}
// The gold storage (3×3): an open wooden bin; the gold in it rises as the player has more.
function goldstore() {
  const g = new THREE.Group(), w = wood(), band = std(0x707070, { metalness: 0.6 });
  mesh(g, new THREE.BoxGeometry(2.6, 0.2, 2.6), stone(), 0, 0.1, 0);
  for (const [x, z, sx, sz] of [[0, 1.1, 2.3, 0.14], [0, -1.1, 2.3, 0.14], [1.1, 0, 0.14, 2.3], [-1.1, 0, 0.14, 2.3]]) { mesh(g, new THREE.BoxGeometry(sx, 1.0, sz), w, x, 0.7, z); mesh(g, new THREE.BoxGeometry(sx + 0.02, 0.1, sz + 0.02), band, x, 0.95, z); }
  for (const [x, z] of [[1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]]) mesh(g, new THREE.BoxGeometry(0.24, 1.25, 0.24), flat(0x7a5230), x, 0.72, z);
  const pile = mesh(g, new THREE.SphereGeometry(1.0, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold(), 0, 0.3, 0); pile.scale.set(1.05, 0.5, 1.05);
  g.userData.fill = (f) => { pile.scale.y = 0.08 + f * 0.95; pile.visible = f > 0.01; };
  return g;
}
// The light storage (3×3): a glass tank on a marble stand, filled with light as the player has more.
function nourstore() {
  const g = new THREE.Group(), marble = std(0xf3efe6, { roughness: 0.4 }), gd = gold();
  mesh(g, new THREE.CylinderGeometry(1.3, 1.4, 0.35, 20), marble, 0, 0.17, 0);
  const light = mesh(g, new THREE.CylinderGeometry(0.9, 0.9, 1, 20), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd960, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), 0, 0.85, 0, false);
  mesh(g, new THREE.CylinderGeometry(1.0, 1.0, 1.9, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), 0, 1.3, 0, false);
  for (const y of [0.4, 2.25]) mesh(g, new THREE.TorusGeometry(1.0, 0.07, 6, 28), gd, 0, y, 0).rotation.x = Math.PI / 2;
  mesh(g, new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), gd, 0, 2.25, 0);
  g.userData.fill = (f) => { const h = 0.05 + f * 1.75; light.scale.y = h; light.position.y = 0.37 + h / 2; };
  return g;
}
// The barracks (3×3): a stone house with a wooden roof, a red banner, two crossed swords.
function barracks() {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(2.7, 0.2, 2.7), stone(), 0, 0.1, 0);
  mesh(g, new THREE.BoxGeometry(2.2, 1.3, 1.9), flat(0xb8ad98), 0, 0.85, -0.1);
  // A triangular prism lying front to back, its ridge on top.
  const r = mesh(g, new THREE.CylinderGeometry(1.3, 1.3, 2.1, 3), roof(), 0, 2.13, -0.1); r.rotation.x = -Math.PI / 2;
  mesh(g, new THREE.BoxGeometry(0.6, 0.85, 0.05), dark(), 0, 0.62, 0.86, false);
  for (const s of [-1, 1]) { const sw = mesh(g, new THREE.BoxGeometry(0.07, 0.9, 0.04), std(0xd8d8d8, { metalness: 0.8, roughness: 0.3 }), 0, 1.35, 0.9, false); sw.rotation.z = s * 0.6; }
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 1.6, 16), flat(0x7a5230), 1.0, 1.0, 1.0);
  const flag = mesh(g, new THREE.BoxGeometry(0.5, 0.35, 0.02), std(0xc8322a), 1.26, 1.6, 1.0, false);
  g.userData.tick = (t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; };
  return g;
}
// The army camp (4×4): a ring of logs round a campfire, little tents, a weapons rack.
function armycamp() {
  const g = new THREE.Group();
  const dirt = mesh(g, new THREE.CircleGeometry(1.85, 24), flat(0xb89a6a), 0, 0.03, 0, false); dirt.rotation.x = -Math.PI / 2;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const l = mesh(g, new THREE.CylinderGeometry(0.13, 0.13, 0.9, 16), flat(0x7a5230), Math.cos(a) * 1.8, 0.13, Math.sin(a) * 1.8); l.rotation.z = Math.PI / 2; l.rotation.y = -a + Math.PI / 2; }
  for (let k = 0; k < 4; k++) { const l = mesh(g, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 16), flat(0x5a3a1a), 0, 0.08, 0); l.rotation.z = Math.PI / 2; l.rotation.y = (k * Math.PI) / 4; }
  const fire = mesh(g, new THREE.ConeGeometry(0.22, 0.55, 20), new THREE.MeshBasicMaterial({ color: 0xffa030 }), 0, 0.35, 0, false);
  for (const [x, z, c] of [[-0.95, -0.9, 0xd8c8a0], [0.95, -0.9, 0xc8322a], [0, 1.05, 0xd8c8a0]]) { const t = mesh(g, new THREE.ConeGeometry(0.45, 0.75, 4), flat(c), x, 0.38, z); t.rotation.y = Math.PI / 4; }
  g.userData.tick = (t) => { fire.scale.set(1 + Math.sin(t * 11) * 0.12, 1 + Math.sin(t * 7) * 0.2, 1 + Math.cos(t * 9) * 0.12); };
  return g;
}
const BUILD = { townhall, builder, goldmine, nourwell, goldstore, nourstore, barracks, armycamp };
export const buildingModel = (type) => BUILD[type]?.();

// A little bubble over a collector when it has something to collect (an emoji on a white disc).
export function bubble(emoji) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 58, 50, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(48, 100); g.lineTo(80, 100); g.lineTo(64, 124); g.fill();
  g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 62);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.3, 1.3, 1); s.renderOrder = 5; return s;
}
