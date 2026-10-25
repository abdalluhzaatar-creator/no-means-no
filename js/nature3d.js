// Trees, bushes and rocks drawn properly (not toy balls): every crown is a puffy,
// lumpy mass of leaves — dark in the hollows and underneath, bright lime where the sun
// hits the top — on a tapering, bent trunk with bark; rocks are heavy, cracked stones,
// grey with lighter edges and moss on top. All made from noise, so each one differs.
import * as THREE from './vendor/three.module.min.js';

// ---------- noise ----------
const fract = (x) => x - Math.floor(x);
const hash3 = (i, j, k) => fract(Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453);
const fade = (t) => t * t * (3 - 2 * t);
export function noise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = fade(x - i), v = fade(y - j), w = fade(z - k);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(i, j, k), hash3(i + 1, j, k), u), l(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), u), v),
    l(l(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), u), l(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), u), v), w) * 2 - 1;
}
export const fbm = (x, y, z, oct = 4) => { let a = 0, f = 1, s = 0.5; for (let o = 0; o < oct; o++) { a += noise3(x * f, y * f, z * f) * s; f *= 2.03; s *= 0.5; } return a; };

// Join the corners that sit at the same place, so the surface shades smoothly.
function merge(geo) {
  const p = geo.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    let k = map.get(key); if (k == null) { k = pos.length / 3; map.set(key, k); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    idx.push(k);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const C = (h) => new THREE.Color(h);
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

// ---------- leaves ----------
// A crown of leaves: a ball pushed out into puffs, coloured by height and by how deep each spot sits.
const LEAVES = { dark: C(0x2f5e12), mid: C(0x5f9e22), top: C(0xb3db45), tip: C(0xd2ec74) };
export function foliage(r = 1, { detail = 4, seed = 1, squash = 0.88, puff = 1, tint = null } = {}) {
  const g = merge(new THREE.IcosahedronGeometry(1, detail)), p = g.attributes.position, v = new THREE.Vector3();
  const o = seed * 13.7, disp = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Big lumps (the clumps of leaves) and small ones (the leaves).
    const big = fbm(v.x * 1.7 + o, v.y * 1.7, v.z * 1.7 - o, 3), small = noise3(v.x * 6 + o, v.y * 6, v.z * 6);
    const d = 1 + (0.2 * big + 0.05 * small) * puff; disp[i] = big;
    v.multiplyScalar(r * d); v.y *= squash; if (v.y < -r * 0.45) v.y = -r * 0.45 + (v.y + r * 0.45) * 0.4;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const h = (p.getY(i) / (r * squash) + 1) / 2, up = n.getY(i), deep = disp[i];
    tmp.copy(mix(LEAVES.dark, LEAVES.mid, h * 1.6));
    tmp.lerp(LEAVES.top, Math.max(0, (h - 0.45) * 1.5 + up * 0.35 + deep * 0.6));
    if (deep > 0.25 && up > 0.3) tmp.lerp(LEAVES.tip, (deep - 0.25) * 1.5);
    // Hollows and the underside in shade.
    tmp.multiplyScalar(0.62 + 0.38 * Math.min(1, Math.max(0, 0.5 + deep * 1.6)) * (0.7 + 0.3 * Math.max(0, up)));
    if (tint) tmp.multiply(tint);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const leafMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });

// ---------- leaf cards ----------
// A picture of a bunch of leaves (pointed leaves with a light middle vein, on a clear
// background), laid many times over each crown so its edge is ragged with leaves, not smooth.
let leafTex = null;
export function leafTexture() {
  if (leafTex) return leafTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = r() * S * 0.3, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, len = S * (0.17 + r() * 0.09), w = len * 0.42, rot = a + (r() - 0.5) * 1.2;
    g.save(); g.translate(x, y); g.rotate(rot);
    const l = 0.55 + r() * 0.45;
    const grd = g.createLinearGradient(0, -w, 0, w); grd.addColorStop(0, `rgb(${170 * l | 0},${220 * l | 0},${120 * l | 0})`); grd.addColorStop(1, `rgb(${110 * l | 0},${165 * l | 0},${70 * l | 0})`);
    g.fillStyle = grd; g.beginPath(); g.moveTo(-len / 2, 0); g.quadraticCurveTo(0, -w, len / 2, 0); g.quadraticCurveTo(0, w, -len / 2, 0); g.fill();
    g.strokeStyle = `rgba(230,255,200,${0.35 * l})`; g.lineWidth = 2; g.beginPath(); g.moveTo(-len / 2 + 4, 0); g.lineTo(len / 2 - 4, 0); g.stroke();
    g.restore();
  }
  leafTex = new THREE.CanvasTexture(cv); leafTex.colorSpace = THREE.SRGBColorSpace; leafTex.anisotropy = 4; return leafTex;
}
export const cardMat = () => new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
// Leaf cards scattered over an ellipsoid crown (radius r), each facing outwards; lit as if the
// whole crown were a ball, coloured dark underneath and inside, lime on top.
export function leafCards(r = 1, { n = 110, seed = 1, squash = 0.88, size = 0.5 } = {}) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const rr = () => hash3(seed, pos.length, 7.7 + idx.length * 0.013), v = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < n; k++) {
    // Spread over the ball (golden angle), pushed in and out a little.
    const y = 1 - (2 * (k + 0.5)) / n, rad = Math.sqrt(1 - y * y), th = k * 2.39996 + seed;
    v.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
    const out = 0.82 + rr() * 0.28, nrm = v.clone();
    const ctr = v.clone().multiplyScalar(r * out); ctr.y *= squash;
    if (ctr.y < -r * 0.5) continue;
    t1.crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize(); t2.crossVectors(nrm, t1).normalize();
    const roll = rr() * 6.28, cs = Math.cos(roll), sn = Math.sin(roll), s = r * size * (0.75 + rr() * 0.5);
    const a = t1.clone().multiplyScalar(cs).addScaledVector(t2, sn), b = t1.clone().multiplyScalar(-sn).addScaledVector(t2, cs);
    const h = (ctr.y / (r * squash) + 1) / 2, light = Math.max(0, nrm.y) * 0.5 + h * 0.6;
    c.copy(LEAVES.dark).lerp(LEAVES.mid, Math.min(1, h * 1.8)).lerp(LEAVES.top, Math.min(1, Math.max(0, light * 0.95 - 0.1))).multiplyScalar(1.0 + rr() * 0.4);
    const base = pos.length / 3;
    for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(ctr.x + (a.x * du + b.x * dv) * s, ctr.y + (a.y * du + b.y * dv) * s, ctr.z + (a.z * du + b.z * dv) * s);
      nor.push(nrm.x, nrm.y, nrm.z); uv.push((du + 1) / 2, (dv + 1) / 2); col.push(c.r, c.g, c.b);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
// A crown: a dark leafy core (so no holes show through) under a coat of leaf cards.
export function crown(r = 1, { seed = 1, n, squash = 0.88, detail = 3 } = {}) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(foliage(r * 0.86, { seed, detail, squash, tint: new THREE.Color(0.72, 0.78, 0.7) }), leafMat()); core.castShadow = core.receiveShadow = true; g.add(core);
  const cards = new THREE.Mesh(leafCards(r, { seed, squash, n: n ?? Math.round(120 * r * r + 40) }), cardMat()); cards.castShadow = cards.receiveShadow = true; g.add(cards);
  return g;
}

// ---------- trunks ----------
// A trunk that tapers and leans a little, with bark (darker grooves running up it).
export function trunkGeo(h = 1, r0 = 0.2, r1 = 0.12, { seed = 1, lean = 0.1 } = {}) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 12, 6, true), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const A = C(0x5a3618), B = C(0x8e5a2e), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + 0.5, z = p.getZ(i), a = Math.atan2(z, x);
    const rr = (r0 + (r1 - r0) * y) * (1 + 0.08 * Math.sin(a * 7 + seed) + (y < 0.15 ? (0.15 - y) * 2.2 : 0));
    p.setXYZ(i, x * rr + Math.sin(y * 2 + seed) * lean * y, y * h, z * rr);
    const groove = 0.5 + 0.5 * Math.sin(a * 9 + noise3(x * 3, y * 6, seed) * 3);
    t.copy(A).lerp(B, groove * 0.8 + y * 0.2); col.set([t.r, t.g, t.b], i * 3);
  }
  g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const barkMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

// ---------- rocks ----------
// A heavy stone: chunky, flat underneath, cracks and lighter worn edges, a little moss on top.
export function rockGeo(r = 1, { seed = 1, moss = 0.6, tall = 0.7 } = {}) {
  const g = merge(new THREE.IcosahedronGeometry(1, 3)), p = g.attributes.position, v = new THREE.Vector3(), o = seed * 7.31;
  const disp = new Float32Array(p.count);
  // A few big flat faces (as if split off), cut into the round shape.
  const planes = Array.from({ length: 7 }, (_, k) => { const a = hash3(seed, k, 1) * 6.28, b = Math.acos(hash3(seed, k, 2) * 1.6 - 0.6); return [new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), 0.78 + hash3(seed, k, 3) * 0.14]; });
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 1 + 0.22 * fbm(v.x * 1.2 + o, v.y * 1.2, v.z * 1.2 + o, 3) + 0.03 * noise3(v.x * 9 + o, v.y * 9, v.z * 9);
    for (const [nrm, cut] of planes) { const along = v.dot(nrm) * d; if (along > cut) d *= 1 - (along - cut) / along * 0.9; }
    disp[i] = d;
    v.multiplyScalar(r * d); v.y *= tall; if (v.y < -r * 0.2) v.y = -r * 0.2 + (v.y + r * 0.2) * 0.25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3), t = new THREE.Color();
  const dark = C(0x4a4d53), mid = C(0x868a90), light = C(0xd0d3d6), green = C(0x6f9a32);
  for (let i = 0; i < p.count; i++) {
    const up = n.getY(i), h = p.getY(i) / (r * tall) + 0.3, x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    t.copy(mix(dark, mid, 0.3 + h * 0.9)).lerp(light, Math.max(0, up) * 0.6 * Math.min(1, h + 0.2));
    // Hollows darker, worn edges lighter; thin dark cracks.
    t.multiplyScalar(0.75 + Math.min(0.35, (disp[i] - 0.85) * 1.2));
    if (Math.abs(noise3(x * 2.6 / r + o, y * 2.6 / r, z * 2.6 / r)) < 0.045) t.multiplyScalar(0.55);
    if (up > 0.55 && noise3(x * 1.8 / r + o, 0, z * 1.8 / r) > 0.05) t.lerp(green, moss * (up - 0.55) * 1.8);
    col.set([t.r, t.g, t.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const rockMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

// ---------- whole plants ----------
const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
// A round leafy tree (fits 2×2 cells): a bent trunk, a big crown and two smaller ones.
export function leafyTree(r, seed = 1) {
  const g = new THREE.Group(), lm = leafMat();
  add(g, trunkGeo(1.15, 0.2, 0.11, { seed }), barkMat(), 0, 0, 0);
  void lm;
  const put = (c, x, y, z) => { c.position.set(x, y, z); g.add(c); };
  put(crown(0.8, { seed }), 0.05, 1.5, 0);
  const a = r() * 6;
  put(crown(0.52, { seed: seed + 1 }), Math.cos(a) * 0.55, 1.15, Math.sin(a) * 0.55);
  put(crown(0.45, { seed: seed + 2 }), Math.cos(a + 2.3) * 0.5, 1.3, Math.sin(a + 2.3) * 0.5);
  return g;
}
// A pine: three layers of needles, each a drooping puffy cone.
export function pineTree(r, seed = 1) {
  const g = new THREE.Group();
  add(g, trunkGeo(0.9, 0.15, 0.08, { seed, lean: 0.03 }), barkMat(), 0, 0, 0);
  const mat = leafMat(), tint = C(0x9ad0a0);
  for (const [y, rad, hgt] of [[0.85, 0.82, 0.8], [1.4, 0.64, 0.72], [1.9, 0.44, 0.62]]) {
    const geo = foliage(1, { seed: seed + y, detail: 3, squash: 1, puff: 0.5, tint }), p = geo.attributes.position;
    // Shape the ball into a cone: wide at the bottom, a point at the top.
    const cone = (geo, keepNormals) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i), k = Math.max(0.05, (1 - yy) / 2); p.setXYZ(i, p.getX(i) * rad * k * 1.6, yy * hgt * 0.6, p.getZ(i) * rad * k * 1.6); } if (!keepNormals) geo.computeVertexNormals(); return geo; };
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.85, p.getY(i), p.getZ(i) * 0.85);
    add(g, cone(geo), mat, 0, y, 0);
    // Needles: leaf cards over the cone, a bluer green.
    const cards = cone(leafCards(1, { seed: seed + y * 3, squash: 1, n: 90, size: 0.32 }), true), col = cards.attributes.color;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * 0.6, col.getY(i) * 0.85, col.getZ(i) * 0.75);
    add(g, cards, cardMat(), 0, y, 0);
  }
  return g;
}
// A bush: a few low puffs of leaves, with flowers.
export function bushPlant(r, seed = 1) {
  const g = new THREE.Group(), lm = leafMat();
  void lm;
  for (const [x, z, s] of [[0, 0, 0.5], [0.42, 0.2, 0.38], [-0.4, 0.22, 0.4], [0.08, -0.4, 0.36]]) { const c = crown(s, { seed: seed + x * 10 + z, squash: 0.75 }); c.position.set(x, s * 0.45, z); g.add(c); }
  const fl = new THREE.MeshStandardMaterial({ color: r() < 0.5 ? 0xff7ab8 : 0xfff2a0, roughness: 0.6 });
  for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fl); m.position.set((r() - 0.5) * 0.9, 0.5 + r() * 0.15, (r() - 0.5) * 0.8); g.add(m); }
  return g;
}
// A stone (or a few, for a big one).
export function stones(r, size = 1, seed = 1) {
  const g = new THREE.Group(), m = rockMat();
  add(g, rockGeo(0.72 * size, { seed }), m, 0, 0.12 * size, 0).rotation.y = r() * 6;
  add(g, rockGeo(0.36 * size, { seed: seed + 1 }), m, 0.62 * size, 0.04, 0.42 * size).rotation.y = r() * 6;
  if (size > 1.2) add(g, rockGeo(0.42 * size, { seed: seed + 2 }), m, -0.7 * size, 0.05, 0.45 * size).rotation.y = r() * 6;
  return g;
}
// A fallen log with cut ends and a stump.
export function logPile(r, seed = 1) {
  const g = new THREE.Group(), bark = barkMat(), ring = new THREE.MeshStandardMaterial({ color: 0xd8b47a, roughness: 0.9 });
  const log = add(g, trunkGeo(1.5, 0.3, 0.27, { seed, lean: 0 }), bark, -0.75, 0.3, 0); log.rotation.z = -Math.PI / 2;
  for (const x of [-0.75, 0.75]) { const e = add(g, new THREE.CircleGeometry(x < 0 ? 0.3 : 0.27, 16), ring, x, 0.3, 0); e.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; }
  add(g, trunkGeo(0.35, 0.27, 0.22, { seed: seed + 3, lean: 0 }), bark, 0.3, 0, 0.6);
  add(g, new THREE.CircleGeometry(0.22, 16), ring, 0.3, 0.351, 0.6).rotation.x = -Math.PI / 2;
  return g;
}
