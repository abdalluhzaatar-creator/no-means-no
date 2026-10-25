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

// ---------- the ground ----------
export const GRASS = { a: '#9bcf45', b: '#93c73f', edge: '#8cc23f', far: 0x86bc3c };
// The map and its strip as one texture: one pixel block per cell, soft checks inside, plain strip outside, tufts.
export function groundTexture() {
  const cells = GRID + BORDER * 2, px = 16, cv = document.createElement('canvas'); cv.width = cv.height = cells * px;
  const g = cv.getContext('2d'), r = rng(11);
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const inside = i >= BORDER && j >= BORDER && i < cells - BORDER && j < cells - BORDER;
    // Clash's grass: 2×2 patches, a shade lighter and darker.
    g.fillStyle = inside ? ((Math.floor(i / 2) + Math.floor(j / 2)) % 2 ? GRASS.a : GRASS.b) : GRASS.edge;
    g.fillRect(i * px, j * px, px, px);
  }
  for (let k = 0; k < 2600; k++) {
    const x = r() * cv.width, y = r() * cv.height;
    g.fillStyle = r() < 0.5 ? 'rgba(70,120,30,.28)' : 'rgba(200,235,120,.25)';
    g.fillRect(x, y, 2, 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.magFilter = THREE.LinearFilter; return t;
}

// The land round the village, as Clash's classic scenery (drawn from memory of it):
// open grass first with trees here and there in little groups, bushes and flowers; the
// woods getting thicker further out; on the left the sea, a sandy shore, a wooden jetty
// and a boat; behind, grey-brown cliffs. Instanced meshes keep it cheap.
export function scenery(seed = 5) {
  const r = rng(seed), g = new THREE.Group(), edge = GRID / 2 + BORDER, out = edge + 30;
  const SEA_X = -edge - 9;                                   // the shore line (x), on the left of the screen
  // Groups of trees: a few centres with trees round them, more of them further out.
  const noise = (x, z) => Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 + 0.4) + Math.sin(x * 0.07 - z * 0.11 + 2.1) * 0.8 + Math.sin((x + z) * 0.33) * 0.35;
  const trees = [], bushes = [], flowers = [];
  for (let k = 0; k < 26000 && trees.length < 1500; k++) {
    const x = (r() * 2 - 1) * out, z = (r() * 2 - 1) * out, d = Math.max(Math.abs(x), Math.abs(z)) - edge;
    if (d < 0.6 || x < SEA_X + 2.5) continue;
    const want = d < 4 ? 0.02 : d < 12 ? 0.06 + Math.max(0, noise(x, z)) * 0.35 : 0.25 + Math.max(0, noise(x, z) + 0.4) * 0.5;
    const roll = r();
    if (roll < want) trees.push([x, z, d]);
    else if (roll < want + 0.03 && d < 14) bushes.push([x, z]);
    else if (roll < want + 0.07 && d < 10) flowers.push([x, z]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const LEAF = [0x4f9e2a, 0x5aab30, 0x48962a, 0x66b836, 0x3f8a26];
  const pines = trees.filter(() => r() < 0.2), round = trees.filter((t) => !pines.includes(t));
  const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), flat(0xffffff), round.length * 3);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 1, 10), flat(0x8b5a2b), round.length);
  round.forEach(([x, z, d], k) => {
    const s = 0.8 + r() * 0.5 + Math.min(0.5, d * 0.025);
    m4.compose(p.set(x, 0.55 * s, z), q, sc.set(s, s * 1.1, s)); trunk.setMatrixAt(k, m4);
    m4.compose(p.set(x, 1.45 * s, z), q, sc.set(s * 0.8, s * 0.72, s * 0.8)); crown.setMatrixAt(k * 3, m4);
    for (const n of [1, 2]) {
      const a = r() * Math.PI * 2;
      m4.compose(p.set(x + Math.cos(a) * 0.45 * s, (1.2 + n * 0.25) * s, z + Math.sin(a) * 0.45 * s), q, sc.set(s * 0.55, s * 0.5, s * 0.55)); crown.setMatrixAt(k * 3 + n, m4);
    }
    const base = LEAF[Math.floor(r() * 5)];
    crown.setColorAt(k * 3, c.set(base)); crown.setColorAt(k * 3 + 1, c.set(base).offsetHSL(0, 0, 0.05)); crown.setColorAt(k * 3 + 2, c.set(base).offsetHSL(0, 0, -0.03));
  });
  const pine = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 2.3, 16), flat(0xffffff), pines.length * 2);
  const pineTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 0.6, 8), flat(0x7a4f28), pines.length);
  pines.forEach(([x, z, d], k) => {
    const s = 0.85 + r() * 0.4 + Math.min(0.5, d * 0.025);
    m4.compose(p.set(x, 0.3 * s, z), q, sc.set(s, s, s)); pineTrunk.setMatrixAt(k, m4);
    m4.compose(p.set(x, 1.35 * s, z), q, sc.set(s, s, s)); pine.setMatrixAt(k * 2, m4);
    m4.compose(p.set(x, 2.1 * s, z), q, sc.set(s * 0.7, s * 0.6, s * 0.7)); pine.setMatrixAt(k * 2 + 1, m4);
    const col = [0x2e8b3a, 0x36964a, 0x2a7f35][k % 3]; pine.setColorAt(k * 2, c.set(col)); pine.setColorAt(k * 2 + 1, c.set(col).offsetHSL(0, 0, 0.04));
  });
  const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 8), flat(0xffffff), bushes.length * 2);
  bushes.forEach(([x, z], k) => {
    const s = 0.7 + r() * 0.6;
    m4.compose(p.set(x, 0.25 * s, z), q, sc.set(s, s * 0.75, s)); bush.setMatrixAt(k * 2, m4);
    m4.compose(p.set(x + 0.4 * s, 0.2 * s, z + 0.2 * s), q, sc.set(s * 0.7, s * 0.55, s * 0.7)); bush.setMatrixAt(k * 2 + 1, m4);
    bush.setColorAt(k * 2, c.set(0x5aab30)); bush.setColorAt(k * 2 + 1, c.set(0x66b836));
  });
  const flower = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), std(0xffffff, { roughness: 0.6 }), flowers.length * 4);
  flowers.forEach(([x, z], k) => {
    const col = [0xffffff, 0xfff27a, 0xff8ac0, 0xffb04a][k % 4];
    for (let n = 0; n < 4; n++) { m4.compose(p.set(x + (r() - 0.5) * 0.8, 0.08, z + (r() - 0.5) * 0.8), q, sc.set(1, 1, 1)); flower.setMatrixAt(k * 4 + n, m4); flower.setColorAt(k * 4 + n, c.set(col)); }
  });
  for (const m of [crown, trunk, pine, pineTrunk, bush]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.add(flower);

  // The sea on the left, the sandy shore, a jetty and a boat.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(6, out * 2 + 40), std(0xead9a0, { roughness: 1 })); sand.rotation.x = -Math.PI / 2; sand.position.set(SEA_X + 1, 0.01, 0); sand.receiveShadow = true; g.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, out * 2 + 60), new THREE.MeshStandardMaterial({ color: 0x3aa6d8, roughness: 0.25, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.position.set(SEA_X - 100, 0.02, 0); g.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(0.6, out * 2 + 40), new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.8 })); foam.rotation.x = -Math.PI / 2; foam.position.set(SEA_X - 1.9, 0.03, 0); g.add(foam);
  const wood = flat(0xa8743e), darkWood = flat(0x7a5230);
  const jetty = new THREE.Group(); jetty.position.set(SEA_X - 2, 0, 6); g.add(jetty);
  for (let k = 0; k < 7; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 2.2), k % 2 ? wood : flat(0xb8844a)); pl.position.set(-k * 1.05 + 2, 0.35, 0); pl.castShadow = pl.receiveShadow = true; jetty.add(pl); }
  for (let k = 0; k < 4; k++) for (const z of [-1.05, 1.05]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10), darkWood); post.position.set(-k * 2 + 2, 0.15, z); jetty.add(post); }
  const boat = new THREE.Group(); boat.position.set(SEA_X - 8, 0, 8.6); g.add(boat);
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 4.2, 16, 1, false, 0, Math.PI), flat(0x8b5a2b)); hull.rotation.set(Math.PI / 2, 0, Math.PI / 2); hull.position.y = 0.55; hull.scale.set(1, 1, 0.65); hull.castShadow = true; boat.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.5), wood); deck.position.y = 0.6; boat.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), darkWood); mast.position.y = 2.2; boat.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.1, 6, 6), std(0xf6efdc, { side: THREE.DoubleSide })); sail.position.set(0.05, 2.4, 0); sail.rotation.y = Math.PI / 2; boat.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), std(0xd8341a, { side: THREE.DoubleSide })); flag.position.set(0, 4.0, 0.25); flag.rotation.y = Math.PI / 2; boat.add(flag);
  g.userData.tick = (t) => { boat.position.y = Math.sin(t * 1.3) * 0.06; boat.rotation.z = Math.sin(t * 1.1) * 0.03; foam.material.opacity = 0.6 + Math.sin(t * 2) * 0.2; };

  // Cliffs far behind (the top of the screen), grey-brown and smooth.
  const rock = flat(0xa39880), rock2 = flat(0x8c8170);
  for (let k = 0; k < 18; k++) {
    const a = -Math.PI * 0.75 + (k / 17 - 0.5) * 1.5, rr = out + 4 + r() * 8;
    const m = new THREE.Mesh(boulder(5 + r() * 4, k + 11), k % 2 ? rock : rock2);
    m.position.set(Math.cos(a) * rr * 1.3, 0, Math.sin(a) * rr * 1.3); m.scale.set(1.4, 1.2 + r() * 0.8, 1.2); m.rotation.y = r() * 6;
    m.castShadow = false; m.receiveShadow = true; g.add(m);
  }
  return g;
}

// ---------- obstacles (2×2 or 3×3 cells) ----------
const OB = {
  tree(r) {
    const g = new THREE.Group();
    mesh(g, new THREE.CylinderGeometry(0.14, 0.2, 0.9, 16), flat(0x7a5230), 0, 0.45, 0);
    const leaf = [flat(0x4f9a2c), flat(0x5fae34)];
    mesh(g, new THREE.SphereGeometry(0.66, 18, 14), leaf[0], 0, 1.35, 0);
    mesh(g, new THREE.SphereGeometry(0.5, 18, 14), leaf[1], 0.38, 1.12, 0.2);
    mesh(g, new THREE.SphereGeometry(0.48, 18, 14), leaf[1], -0.34, 1.18, -0.18);
    mesh(g, new THREE.SphereGeometry(0.42, 18, 14), leaf[0], 0.05, 1.82, 0.05);
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
