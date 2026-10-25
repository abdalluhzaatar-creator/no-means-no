// The village's buildings, in Clash of Clans' way: chunky shapes with rounded edges, real
// materials (wooden planks with grain and nails, stone blocks with mortar, clay roof tiles,
// metal bands, glass), bright colours, small details everywhere. Each stands at (0, 0, 0)
// on its cells. Some have userData.tick(t) (moving parts) and userData.fill(f) (storages).
import * as THREE from './vendor/three.module.min.js';
import { rockGeo, rockMat } from './nature3d.js';

// ---------- textures (drawn once on canvases) ----------
const R = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const canvases = {};
function draw(kind) {
  if (canvases[kind]) return canvases[kind];
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), r = R(kind.length * 977 + 3);
  if (kind === 'planks') {
    // Upright planks: each a little different, grain lines, dark gaps, two nails at the ends.
    const n = 5, w = S / n;
    for (let k = 0; k < n; k++) {
      const l = 205 + r() * 50; g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(k * w, 0, w, S);
      for (let j = 0; j < 9; j++) { g.strokeStyle = `rgba(80,50,20,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 1.5; const x = k * w + r() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, S / 3, x + (r() - 0.5) * 10, S * 0.66, x + (r() - 0.5) * 6, S); g.stroke(); }
      g.fillStyle = 'rgba(40,24,10,.55)'; g.fillRect(k * w, 0, 3, S);
      g.fillStyle = 'rgba(60,60,60,.7)'; for (const y of [14, S - 14]) { g.beginPath(); g.arc(k * w + w / 2, y, 3.5, 0, 7); g.fill(); }
    }
  } else if (kind === 'bricks') {
    // Stone blocks in courses, offset each row, with light mortar and worn edges.
    const rows = 6, h = S / rows;
    g.fillStyle = 'rgb(190,184,172)'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * 0.5, n = 3;
      for (let k = -1; k < n + 1; k++) {
        const x = ((k + off) / n) * S, w = S / n, l = 225 + r() * 30;
        g.fillStyle = `rgb(${l},${l - 4},${l - 12})`; g.beginPath(); g.roundRect(x + 3, j * h + 3, w - 6, h - 6, 6); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 6, j * h + 5, w - 14, 4);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 6, j * h + h - 9, w - 12, 4);
      }
    }
  } else if (kind === 'tiles') {
    // Clay roof tiles: overlapping rounded rows.
    g.fillStyle = 'rgb(170,170,170)'; g.fillRect(0, 0, S, S);
    const rows = 8, h = S / rows, n = 6, w = S / n;
    for (let j = 0; j < rows; j++) for (let k = -1; k <= n; k++) {
      const x = (k + (j % 2) * 0.5) * w, y = j * h, l = 205 + r() * 50;
      const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, `rgb(${l},${l},${l})`); grd.addColorStop(1, `rgb(${l - 70},${l - 70},${l - 70})`);
      g.fillStyle = grd; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h * 0.7); g.quadraticCurveTo(x + w / 2, y + h * 1.25, x, y + h * 0.7); g.closePath(); g.fill();
    }
  } else if (kind === 'coins') {
    // A heap of gold coins seen from above.
    g.fillStyle = 'rgb(190,140,30)'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 140; k++) {
      const x = r() * S, y = r() * S, rad = 9 + r() * 7, l = r();
      g.fillStyle = `rgb(${235 + l * 20 | 0},${185 + l * 40 | 0},${40 + l * 40 | 0})`; g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,90,10,.7)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,220,.7)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.25, 0, 7); g.fill();
    }
  } else if (kind === 'cloth') {
    // Striped tent cloth.
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? 'rgb(255,255,255)' : 'rgb(215,205,185)'; g.fillRect((k * S) / 8, 0, S / 8, S); }
  }
  canvases[kind] = cv; return cv;
}
const texCache = new Map();
function tex(kind, rx = 1, ry = 1) {
  const key = `${kind}:${rx}:${ry}`;
  if (!texCache.has(key)) { const t = new THREE.CanvasTexture(draw(kind)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); }
  return texCache.get(key);
}
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const wood = (color = 0xb57a3e, rx = 1, ry = 1) => mat(color, { map: tex('planks', rx, ry), roughness: 0.85 });
const stone = (color = 0xd8d0c0, rx = 1, ry = 1) => mat(color, { map: tex('bricks', rx, ry), roughness: 0.9 });
const tiles = (color = 0xd0482e, rx = 1, ry = 1) => mat(color, { map: tex('tiles', rx, ry), roughness: 0.7 });
const metal = (color = 0x8a8f96) => mat(color, { metalness: 0.7, roughness: 0.35 });
const gold = () => mat(0xf0c030, { metalness: 0.85, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.25 });
const dark = () => mat(0x2a1c12, { roughness: 0.9 });

// ---------- shapes ----------
// A box with rounded edges (Clash's chunky look), keeping the box's texture coordinates.
export function roundedBox(w, h, d, rad = 0.08, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = w / 2 - rad, hy = h / 2 - rad, hz = d / 2 - rad;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    const o = v.clone().sub(c); if (o.lengthSq() > 0) o.normalize().multiplyScalar(rad);
    p.setXYZ(i, c.x + o.x, c.y + o.y, c.z + o.z);
  }
  g.computeVertexNormals(); return g;
}
const put = (g, geo, m, x = 0, y = 0, z = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; g.add(o); return o; };
const box = (g, w, h, d, m, x, y, z, rad = 0.06) => put(g, roundedBox(w, h, d, Math.min(rad, w / 2, h / 2, d / 2) * 0.99), m, x, y, z);
const cyl = (g, r0, r1, h, m, x, y, z, seg = 20) => put(g, new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z);
// A flag on a pole that waves.
function flag(g, x, z, h, color, ticks) {
  cyl(g, 0.045, 0.055, h, wood(0x7a4a24), x, h / 2, z, 8);
  put(g, new THREE.SphereGeometry(0.08, 10, 8), gold(), x, h + 0.04, z);
  const geo = new THREE.PlaneGeometry(0.62, 0.38, 8, 1); geo.translate(0.31, 0, 0);
  const f = put(g, geo, mat(color, { side: THREE.DoubleSide, roughness: 0.8 }), x + 0.04, h - 0.25, z, false);
  const base = geo.attributes.position.array.slice();
  ticks.push((t) => { const a = geo.attributes.position; for (let i = 0; i < a.count; i++) { const px = base[i * 3]; a.setZ(i, Math.sin(px * 6 - t * 6) * 0.06 * px); } a.needsUpdate = true; f.rotation.y = Math.sin(t * 0.7) * 0.3; });
}
// A wooden door with an arched top, iron bands and a ring.
function door(g, w, h, x, y, z, ry = 0) {
  const d = new THREE.Group(); d.position.set(x, y, z); d.rotation.y = ry; g.add(d);
  box(d, w, h - w / 2, 0.08, wood(0x8a5428, 1.4, 1), 0, (h - w / 2) / 2, 0, 0.02);
  const arch = put(d, new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 16, 1, false, -Math.PI / 2, Math.PI), wood(0x8a5428), 0, h - w / 2, 0); arch.rotation.x = Math.PI / 2;
  for (const yy of [0.25, 0.6]) box(d, w + 0.02, 0.05, 0.1, metal(0x444444), 0, (h - w / 2) * yy, 0.01, 0.02);
  const fr = put(d, new THREE.TorusGeometry(w / 2 + 0.03, 0.05, 6, 18, Math.PI), stone(0xbfb7a6), 0, h - w / 2, 0.02); fr.rotation.z = 0;
  return d;
}
const ticker = (g, list) => { if (list.length) g.userData.tick = (t) => list.forEach((f) => f(t)); return g; };

// ---------- the buildings ----------
// The Town Hall (4×4): a stone hall with a teal tiled dome, corner towers, a big door, flags.
function townhall() {
  const g = new THREE.Group(), T = [];
  box(g, 3.95, 0.4, 3.95, stone(0xcfc6b2, 4, 1), 0, 0.2, 0, 0.1);
  box(g, 1.4, 0.18, 0.5, stone(0xcfc6b2, 1, 0.3), 0, 0.09, 2.15, 0.05);
  box(g, 3.2, 2.2, 3.2, stone(0xf2e8d2, 3, 2), 0, 1.5, 0, 0.12);
  box(g, 3.5, 0.28, 3.5, wood(0x2f7a8a, 4, 0.4), 0, 2.72, 0, 0.08);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    box(g, 0.7, 3.0, 0.7, stone(0xd9cfb9, 1, 2), x, 1.7, z, 0.1);
    box(g, 0.85, 0.22, 0.85, wood(0x2f7a8a, 1, 0.3), x, 3.28, z, 0.06);
    put(g, new THREE.ConeGeometry(0.46, 0.8, 20), tiles(0x2f8a9a, 2, 1), x, 3.8, z);
    put(g, new THREE.SphereGeometry(0.09, 10, 8), gold(), x, 4.25, z);
  }
  cyl(g, 1.25, 1.35, 0.5, stone(0xf2e8d2, 4, 0.5), 0, 3.1, 0, 28);
  const dome = put(g, new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), tiles(0x2f8a9a, 6, 3), 0, 3.35, 0); dome.scale.y = 1.05;
  put(g, new THREE.TorusGeometry(1.3, 0.06, 8, 32), gold(), 0, 3.36, 0).rotation.x = Math.PI / 2;
  put(g, new THREE.SphereGeometry(0.16, 14, 10), gold(), 0, 4.75, 0);
  put(g, new THREE.ConeGeometry(0.07, 0.55, 10), gold(), 0, 5.1, 0);
  door(g, 0.95, 1.55, 0, 0.4, 1.62);
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Group(); s.rotation.y = (k * Math.PI) / 2; g.add(s);
    for (const x of [-0.95, 0.95]) { if (k === 0 && Math.abs(x) < 0.5) continue; box(s, 0.42, 0.62, 0.06, dark(), x, 1.85, 1.61, 0.04); box(s, 0.5, 0.08, 0.1, wood(0x2f7a8a), x, 1.52, 1.63, 0.02); }
  }
  flag(g, -1.6, 1.6, 4.9, 0x2fa84a, T); flag(g, 1.6, 1.6, 4.9, 0xd8341a, T);
  return ticker(g, T);
}
// The builder's hut (2×2): a wooden cabin on stones, a red tiled roof, a chimney, a hammer sign.
function builder() {
  const g = new THREE.Group(), T = [];
  box(g, 1.85, 0.2, 1.85, stone(0xbdb4a2, 2, 0.3), 0, 0.1, 0, 0.06);
  box(g, 1.4, 1.0, 1.3, wood(0xc08848, 2, 1), 0, 0.7, 0, 0.05);
  const roof = put(g, new THREE.ConeGeometry(1.2, 0.95, 4), tiles(0xd0482e, 3, 2), 0, 1.68, 0); roof.rotation.y = Math.PI / 4;
  box(g, 0.24, 0.6, 0.24, stone(0xa89e8c, 0.5, 1), 0.4, 1.9, -0.3, 0.04);
  door(g, 0.45, 0.72, 0, 0.2, 0.66);
  box(g, 0.32, 0.3, 0.06, dark(), 0.48, 0.85, 0.66, 0.03);
  const sign = new THREE.Group(); sign.position.set(-0.85, 0, 0.75); g.add(sign);
  cyl(sign, 0.04, 0.04, 0.9, wood(0x7a4a24), 0, 0.45, 0, 8); box(sign, 0.5, 0.32, 0.06, wood(0xd0a060), 0, 0.85, 0.03, 0.03);
  const hm = new THREE.Group(); hm.position.set(0, 0.85, 0.08); hm.rotation.z = 0.6; sign.add(hm);
  box(hm, 0.06, 0.28, 0.04, wood(0x7a4a24), 0, 0, 0, 0.02); box(hm, 0.16, 0.08, 0.06, metal(), 0, 0.13, 0, 0.02);
  const smoke = []; for (let k = 0; k < 3; k++) { const s = put(g, new THREE.SphereGeometry(0.1, 10, 8), mat(0xdddddd, { transparent: true, opacity: 0.6 }), 0.4, 2.3, -0.3, false); smoke.push(s); }
  T.push((t) => smoke.forEach((s, k) => { const u = (t * 0.5 + k / 3) % 1; s.position.set(0.4 + u * 0.3, 2.25 + u * 0.9, -0.3); s.scale.setScalar(0.6 + u * 1.4); s.material.opacity = 0.6 * (1 - u); }));
  return ticker(g, T);
}
// The gold mine (3×3): a rocky hill with a timbered tunnel, rails, a cart of gold, a turning wheel.
function goldmine() {
  const g = new THREE.Group(), T = [];
  box(g, 2.8, 0.15, 2.8, stone(0xbdb4a2, 3, 0.3), 0, 0.075, 0, 0.05);
  const hill = put(g, rockGeo(1.25, { seed: 31, moss: 0.8, tall: 0.95 }), rockMat(), -0.15, 0.3, -0.45); hill.scale.set(1.15, 1, 0.95);
  // The tunnel's mouth and its timbers.
  box(g, 0.8, 0.85, 0.3, dark(), -0.1, 0.55, 0.55, 0.05);
  for (const x of [-0.55, 0.35]) box(g, 0.16, 1.1, 0.16, wood(0x8a5a2a, 0.3, 1), x, 0.65, 0.72, 0.04);
  box(g, 1.15, 0.18, 0.2, wood(0x8a5a2a, 1, 0.2), -0.1, 1.25, 0.72, 0.04);
  // Rails out of the tunnel.
  for (const x of [-0.3, 0.1]) box(g, 0.05, 0.05, 1.0, metal(0x666a70), x, 0.18, 1.05, 0.02);
  for (let k = 0; k < 4; k++) box(g, 0.6, 0.05, 0.1, wood(0x6a4420), -0.1, 0.16, 0.7 + k * 0.25, 0.02);
  const cart = new THREE.Group(); cart.position.set(-0.1, 0.2, 1.15); g.add(cart);
  box(cart, 0.55, 0.3, 0.45, wood(0x7a4a24, 1, 0.5), 0, 0.2, 0, 0.04);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const w = cyl(cart, 0.08, 0.08, 0.05, metal(0x444444), x, 0.05, z, 12); w.rotation.z = Math.PI / 2; }
  for (let k = 0; k < 7; k++) put(cart, new THREE.DodecahedronGeometry(0.1 + (k % 3) * 0.02), gold(), (k % 3 - 1) * 0.14, 0.4 + (k > 3 ? 0.08 : 0), (Math.floor(k / 3) - 1) * 0.12);
  // The winding wheel on a frame on the hill.
  const fr = new THREE.Group(); fr.position.set(0.75, 0, -0.4); g.add(fr);
  for (const z of [-0.25, 0.25]) box(fr, 0.1, 1.7, 0.1, wood(0x8a5a2a, 0.2, 1), 0, 0.95, z, 0.03);
  const wheel = new THREE.Group(); wheel.position.set(0, 1.75, 0); fr.add(wheel);
  put(wheel, new THREE.TorusGeometry(0.42, 0.05, 8, 24), wood(0x8a5a2a), 0, 0, 0).rotation.y = Math.PI / 2;
  for (let k = 0; k < 4; k++) { const s = box(wheel, 0.05, 0.8, 0.05, wood(0x8a5a2a), 0, 0, 0, 0.02); s.rotation.x = (k * Math.PI) / 4; }
  T.push((t) => { wheel.rotation.x = t * 1.5; });
  return ticker(g, T);
}
// The light well (3×3, the elixir collector): a stone basin, a wooden frame and a pump, a glass
// globe full of bright light turning slowly.
function nourwell() {
  const g = new THREE.Group(), T = [];
  cyl(g, 1.3, 1.4, 0.4, stone(0xd8d0c0, 5, 0.5), 0, 0.2, 0, 28);
  cyl(g, 1.05, 1.05, 0.08, mat(0xffe98a, { emissive: 0xffd24a, emissiveIntensity: 0.6, roughness: 0.2 }), 0, 0.41, 0, 28);
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) box(g, 0.18, 1.9, 0.18, wood(0x9a6430, 0.3, 1.5), x * 0.75, 1.15, z * 0.75, 0.04);
  for (const z of [-0.64, 0.64]) box(g, 1.5, 0.16, 0.16, wood(0x9a6430, 1.2, 0.2), 0, 2.05, z, 0.04);
  for (const x of [-0.64, 0.64]) box(g, 0.16, 0.16, 1.5, wood(0x9a6430, 0.2, 1.2), x, 2.05, 0, 0.04);
  const globe = put(g, new THREE.SphereGeometry(0.55, 28, 20), mat(0xdff4ff, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, depthWrite: false }), 0, 1.25, 0, false);
  const light = put(g, new THREE.SphereGeometry(0.42, 24, 16), mat(0xfff4b0, { emissive: 0xffd860, emissiveIntensity: 1.4 }), 0, 1.2, 0, false);
  put(g, new THREE.TorusGeometry(0.56, 0.05, 8, 30), gold(), 0, 1.25, 0).rotation.x = Math.PI / 2;
  cyl(g, 0.06, 0.06, 0.8, metal(), 0, 1.95, 0, 10);
  const handle = box(g, 0.7, 0.06, 0.06, metal(), 0.25, 2.3, 0, 0.02);
  T.push((t) => { light.scale.setScalar(1 + Math.sin(t * 3) * 0.05); globe.rotation.y = t; handle.rotation.z = Math.sin(t * 2) * 0.3; });
  return ticker(g, T);
}
// The gold storage (3×3): a big wooden bin with iron bands; the heap of coins in it rises as the player has more.
function goldstore() {
  const g = new THREE.Group();
  box(g, 2.8, 0.2, 2.8, stone(0xbdb4a2, 3, 0.3), 0, 0.1, 0, 0.06);
  for (const [x, z, sx, sz] of [[0, 1.12, 2.4, 0.18], [0, -1.12, 2.4, 0.18], [1.12, 0, 0.18, 2.4], [-1.12, 0, 0.18, 2.4]]) {
    box(g, sx, 1.0, sz, wood(0xb57a3e, Math.max(sx, sz) * 1.5, 1), x, 0.7, z, 0.05);
    for (const y of [0.4, 0.95]) box(g, sx + 0.04, 0.08, sz + 0.04, metal(0x5a5e64), x, y, z, 0.02);
  }
  for (const [x, z] of [[1.12, 1.12], [-1.12, 1.12], [1.12, -1.12], [-1.12, -1.12]]) { box(g, 0.32, 1.3, 0.32, wood(0x8a5428, 0.4, 1), x, 0.75, z, 0.06); put(g, new THREE.SphereGeometry(0.12, 12, 8), gold(), x, 1.45, z); }
  const pile = put(g, new THREE.SphereGeometry(1.02, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { map: tex('coins', 3, 2), metalness: 0.6, roughness: 0.3, emissive: 0x3a2800, emissiveIntensity: 0.3 }), 0, 0.3, 0);
  g.userData.fill = (f) => { pile.scale.set(1, 0.08 + f * 0.95, 1); pile.visible = f > 0.01; };
  g.userData.fill(0.5);
  return g;
}
// The light storage (3×3, the elixir storage): a glass vat in a frame of metal ribs, a golden lid; the light in it rises.
function nourstore() {
  const g = new THREE.Group(), T = [];
  cyl(g, 1.35, 1.45, 0.35, stone(0xd8d0c0, 5, 0.4), 0, 0.17, 0, 28);
  const liquid = put(g, new THREE.CylinderGeometry(0.92, 0.92, 1, 28), mat(0xfff0a0, { emissive: 0xffcf40, emissiveIntensity: 1.0, transparent: true, opacity: 0.92 }), 0, 0.9, 0, false);
  put(g, new THREE.CylinderGeometry(1.0, 1.0, 1.9, 28, 1, true), mat(0xd8f2ff, { transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), 0, 1.3, 0, false);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; box(g, 0.12, 2.0, 0.12, metal(0x6a6e74), Math.cos(a) * 1.02, 1.3, Math.sin(a) * 1.02, 0.04); }
  for (const y of [0.4, 2.25]) put(g, new THREE.TorusGeometry(1.03, 0.08, 8, 32), metal(0x6a6e74), 0, y, 0).rotation.x = Math.PI / 2;
  put(g, new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold(), 0, 2.25, 0);
  put(g, new THREE.SphereGeometry(0.1, 10, 8), gold(), 0, 2.95, 0);
  g.userData.fill = (f) => { const h = 0.05 + f * 1.75; liquid.scale.y = h; liquid.position.y = 0.37 + h / 2; };
  g.userData.fill(0.5);
  T.push((t) => { liquid.material.emissiveIntensity = 0.9 + Math.sin(t * 2.5) * 0.15; });
  return ticker(g, T);
}
// The barracks (3×3): stone walls, a timbered upper part, a red tiled roof, a shield with crossed swords, torches, a flag.
function barracks() {
  const g = new THREE.Group(), T = [];
  box(g, 2.8, 0.2, 2.8, stone(0xbdb4a2, 3, 0.3), 0, 0.1, 0, 0.06);
  box(g, 2.3, 1.0, 1.9, stone(0xd8cdb5, 2.5, 1), 0, 0.7, -0.15, 0.08);
  box(g, 2.25, 0.6, 1.85, wood(0xc08848, 3, 0.6), 0, 1.5, -0.15, 0.05);
  for (const x of [-1.05, 0, 1.05]) box(g, 0.12, 0.62, 0.12, wood(0x6a4420), x, 1.5, 0.79, 0.03);
  const roof = put(g, new THREE.CylinderGeometry(1.35, 1.35, 2.1, 3), tiles(0xd0482e, 3, 2), 0, 2.25, -0.15); roof.rotation.x = -Math.PI / 2; roof.scale.set(1, 1, 0.75);
  door(g, 0.62, 0.95, 0, 0.2, 0.8);
  const sh = new THREE.Group(); sh.position.set(0, 1.55, 0.86); g.add(sh);
  put(sh, new THREE.CylinderGeometry(0.26, 0.26, 0.06, 20), mat(0xc8322a), 0, 0, 0).rotation.x = Math.PI / 2;
  put(sh, new THREE.TorusGeometry(0.26, 0.035, 6, 20), gold(), 0, 0, 0.02);
  for (const s of [-1, 1]) { const sw = box(sh, 0.06, 0.7, 0.03, metal(0xd8dadc), 0, 0, 0.06, 0.01); sw.rotation.z = s * 0.7; }
  const fl = []; for (const x of [-0.6, 0.6]) { cyl(g, 0.03, 0.04, 0.5, wood(0x6a4420), x, 0.9, 0.86, 8); fl.push(put(g, new THREE.ConeGeometry(0.07, 0.2, 10), mat(0xffa030, { emissive: 0xff7010, emissiveIntensity: 1.5 }), x, 1.25, 0.86, false)); }
  T.push((t) => fl.forEach((f, k) => f.scale.set(1, 1 + Math.sin(t * 13 + k * 2) * 0.25, 1)));
  flag(g, 1.2, -1.15, 2.9, 0xd8341a, T);
  return ticker(g, T);
}
// The army camp (4×4): a ring of stones round a campfire, log benches, two striped tents, a rack of spears, flags.
function armycamp() {
  const g = new THREE.Group(), T = [];
  const dirt = put(g, new THREE.CircleGeometry(1.9, 32), mat(0xb8955e, { roughness: 1 }), 0, 0.02, 0, false); dirt.rotation.x = -Math.PI / 2;
  const rm = rockMat();
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; put(g, rockGeo(0.16, { seed: 40 + k, detail: 2 }), rm, Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55); }
  for (let k = 0; k < 4; k++) { const l = cyl(g, 0.06, 0.06, 0.65, wood(0x6a4420, 0.3, 1), 0, 0.1, 0, 10); l.rotation.z = Math.PI / 2; l.rotation.y = (k * Math.PI) / 4; }
  const flames = [0, 1, 2].map((k) => put(g, new THREE.ConeGeometry(0.2 - k * 0.04, 0.55 - k * 0.1, 12), mat([0xffa030, 0xffd040, 0xfff2a0][k], { emissive: [0xff6010, 0xffa020, 0xffe080][k], emissiveIntensity: 1.6, transparent: true, opacity: 0.92 }), 0, 0.35, 0, false));
  T.push((t) => flames.forEach((f, k) => { f.scale.set(1 + Math.sin(t * 11 + k) * 0.12, 1 + Math.sin(t * 7 + k * 2) * 0.22, 1 + Math.cos(t * 9 + k) * 0.12); f.rotation.y = t * (k + 1); }));
  for (const a of [0.6, 2.2, 3.9]) { const b = cyl(g, 0.12, 0.12, 0.8, wood(0x8a5428, 0.4, 1), Math.cos(a) * 1.05, 0.13, Math.sin(a) * 1.05, 12); b.rotation.z = Math.PI / 2; b.rotation.y = -a + Math.PI / 2; }
  for (const [x, z, c] of [[-1.2, -1.1, 0xffffff], [1.15, -1.15, 0xffe0d0]]) {
    const tent = put(g, new THREE.ConeGeometry(0.62, 1.0, 8), mat(c, { map: tex('cloth', 2, 1), roughness: 0.9 }), x, 0.5, z); tent.rotation.y = Math.PI / 8;
    put(g, new THREE.SphereGeometry(0.06, 8, 6), gold(), x, 1.02, z);
  }
  const rack = new THREE.Group(); rack.position.set(1.35, 0, 0.9); rack.rotation.y = -0.7; g.add(rack);
  box(rack, 0.9, 0.08, 0.08, wood(0x6a4420), 0, 0.55, 0, 0.02);
  for (const x of [-0.3, 0, 0.3]) { cyl(rack, 0.025, 0.025, 1.3, wood(0x8a5428), x, 0.65, 0.04, 6); put(rack, new THREE.ConeGeometry(0.05, 0.18, 8), metal(0xd8dadc), x, 1.36, 0.04); }
  flag(g, -1.6, 1.4, 1.8, 0xd8341a, T); flag(g, 1.6, 1.6, 1.8, 0x2fa84a, T);
  return ticker(g, T);
}
// The archer tower (3×3): a stone base, four timber legs with braces, a plank deck with a railing.
// The archer stands on the deck (userData.deckY).
function archer() {
  const g = new THREE.Group();
  box(g, 2.7, 0.35, 2.7, stone(0xbdb4a2, 3, 0.4), 0, 0.17, 0, 0.08);
  for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) box(g, 0.22, 1.3, 0.22, wood(0x8a5428, 0.3, 1.2), x, 1.0, z, 0.05);
  for (let k = 0; k < 4; k++) { const s = new THREE.Group(); s.rotation.y = (k * Math.PI) / 2; g.add(s); const b = box(s, 0.1, 1.7, 0.1, wood(0x7a4a24), 0, 1.0, 0.95, 0.03); b.rotation.z = 0.85; }
  box(g, 2.4, 0.16, 2.4, wood(0xc08848, 3, 3), 0, 1.68, 0, 0.05);
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Group(); s.rotation.y = (k * Math.PI) / 2; g.add(s);
    box(s, 2.4, 0.1, 0.1, wood(0x8a5428, 2, 0.2), 0, 2.1, 1.15, 0.03);
    for (const x of [-1.1, -0.55, 0, 0.55]) box(s, 0.08, 0.42, 0.08, wood(0x8a5428), x, 1.9, 1.15, 0.02);
  }
  g.userData.deckY = 1.76;
  return g;
}

const BUILD = { townhall, builder, goldmine, nourwell, goldstore, nourstore, barracks, armycamp, archer };
export const makeBuilding = (type) => BUILD[type]?.();
