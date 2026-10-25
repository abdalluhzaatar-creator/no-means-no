// The base's 3D models, in Clash of Clans proportions and colours: bright green grass in
// soft squares, a darker grass strip around the map, a forest all round it, short round
// trees (2×2 cells, about as tall as a builder's hut) and grey rocks, and the buildings
// a village starts with. Each model stands on the ground at (0, 0, 0), centred on its cells.
import * as THREE from './vendor/three.module.min.js';
import { GRID } from './base.js';
import { makeBuilding } from './buildings3d.js';
import { foliage, leafMat, leafCards, cardMat, rockGeo, rockMat, leafyTree, pineTree, bushPlant, stones, logPile } from './nature3d.js';

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
  // Each wood tree: a big leafy crown and a smaller one beside it (three shapes, instanced).
  const KINDS = [1, 2, 3].map((k) => foliage(1, { detail: 1, seed: k * 5 }));   // the core hides under the leaves: few faces
  const byKind = KINDS.map(() => []);
  spots.forEach(([x, z]) => {
    const s = 1.0 + r() * 0.45, h = 1.7 + r() * 0.8;
    byKind[Math.floor(r() * 3)].push([x, h, z, s * 1.05, r() * 6]);
    const a = r() * 6; byKind[Math.floor(r() * 3)].push([x + Math.cos(a) * 0.7 * s, h - 0.35, z + Math.sin(a) * 0.7 * s, s * 0.68, r() * 6]);
  });
  const leaf = new THREE.Group();
  // Each kind: a dark core and its coat of leaf cards, sharing the same places.
  const CARDS = [1, 2, 3].map((k) => leafCards(1, { seed: k * 5, n: 120 }));
  const coreTint = new THREE.Color(0.72, 0.78, 0.7);
  KINDS.forEach((geo, kk) => {
    const list = byKind[kk];
    const core = new THREE.InstancedMesh(geo, leafMat(), list.length), coat = new THREE.InstancedMesh(CARDS[kk], cardMat(), list.length);
    list.forEach(([x, y, z, sc0, ry], k) => {
      m4.compose(p.set(x, y, z), q.setFromEuler(new THREE.Euler(0, ry, 0)), sc.set(sc0, sc0, sc0)); core.setMatrixAt(k, m4.clone().scale(sc.set(0.86, 0.86, 0.86))); coat.setMatrixAt(k, m4);
      const t = 1.05 + r() * 0.3; c.setRGB(t * (0.95 + r() * 0.1), t, t * (0.7 + r() * 0.1)); coat.setColorAt(k, c); core.setColorAt(k, c.clone().multiply(coreTint));
    });
    q.identity();
    for (const im of [core, coat]) { im.castShadow = true; im.receiveShadow = true; leaf.add(im); }
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
  const shoreStones = [];
  for (let k = 0; k < 170; k++) { const x = (r() * 2 - 1) * (out + 10), a = zIn(x) + 0.8, b = zOut(x) - 0.3, f = Math.sqrt(r()), z = a + (b - a) * f; if (b - a < 0.6) continue; shoreStones.push([x, z, 0.22 + r() * r() * 0.85 * f]); }
  const stone = new THREE.InstancedMesh(rockGeo(1, { seed: 9, moss: 0.3, detail: 3 }), rockMat(), shoreStones.length);
  shoreStones.forEach(([x, z, s], k) => { m4.compose(p.set(x, s * 0.12, z), q.setFromEuler(new THREE.Euler(r(), r() * 6, r())), sc.set(s, s * 0.75, s)); stone.setMatrixAt(k, m4); stone.setColorAt(k, c.setScalar(0.85 + (k % 3) * 0.08)); });
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
  tree: (r, seed) => leafyTree(r, seed),
  pine: (r, seed) => pineTree(r, seed),
  bush: (r, seed) => bushPlant(r, seed),
  trunk: (r, seed) => logPile(r, seed),
  rock: (r, seed) => stones(r, 1, seed),
  bigrock: (r, seed) => stones(r, 1.7, seed),
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
  const h = hash(id), r = rng(h), g = OB[kind](r, (h % 97) + 1); g.rotation.y = r() * Math.PI * 2; return g;
}

// ---------- buildings (buildings3d.js draws them) ----------
export const buildingModel = (type) => makeBuilding(type);

// A little bubble over a collector when it has something to collect (an emoji on a white disc).
export function bubble(emoji) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 58, 50, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(48, 100); g.lineTo(80, 100); g.lineTo(64, 124); g.fill();
  g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 62);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.3, 1.3, 1); s.renderOrder = 5; return s;
}
