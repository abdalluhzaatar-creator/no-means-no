// The eight small buildings of a dimension: one for every daily habit. A habit built
// stands as a little house in the dimension's colours with its icon on a sign and its
// name above; when it's done today a golden light burns on its roof. A place not built
// yet is a bare foundation with a lock. The spots are found once, the same every time:
// free ground near where the character arrives, clear of the scene's own things.
import * as THREE from './vendor/three.module.min.js';

export const HOUSES = 8;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

// A sprite with text or an emoji on it (sharp, sized in world units).
function label(text, { size = 0.5, bg = 'rgba(20,24,30,.78)', color = '#fff', font = 'bold 44px system-ui, sans-serif', emoji = false } = {}) {
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = font; const w = Math.ceil(Math.min(900, g.measureText(text).width + 40)), h = emoji ? 96 : 64;
  cv.width = emoji ? 96 : w; cv.height = h;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, cv.width - 4, h - 4, emoji ? 48 : 20); g.fill(); }
  g.fillStyle = color; g.direction = 'rtl'; g.fillText(text, cv.width / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set((cv.width / h) * size, size, 1); s.renderOrder = 3; return s;
}

// A little house (about 2 × 2): stone base, walls in the dimension's colour, a roof, a door,
// a sign with the habit's icon, and a lamp on top that lights up when it's done today.
function house(color, roof, icon, title) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 2.2), std(0xcfc6b2)); base.position.y = 0.12; g.add(base);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.6), std(color)); walls.position.y = 0.9; g.add(walls);
  const r = new THREE.Mesh(new THREE.ConeGeometry(1.42, 0.95, 4), std(roof, { roughness: 0.6 })); r.position.y = 2.02; r.rotation.y = Math.PI / 4; g.add(r);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.75, 0.05), std(0x4a2f1a)); door.position.set(0, 0.62, 0.81); g.add(door);
  for (const x of [-0.55, 0.55]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), std(0xfff2c0, { emissive: 0xffd27a, emissiveIntensity: 0.25 })); w.position.set(x, 1.05, 0.81); g.add(w); }
  const sign = label(icon, { size: 0.62, emoji: true, bg: 'rgba(255,250,235,.95)', font: '64px system-ui, sans-serif' }); sign.position.set(0, 1.55, 0.95); g.add(sign);
  const name = label(title, { size: 0.42 }); name.position.set(0, 3.05, 0); g.add(name);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std(0x666666, { emissive: 0x000000 })); lamp.position.y = 2.6; g.add(lamp);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData = { lamp, name };
  return g;
}
// A foundation not built yet: a stone outline, a few stones, a lock.
function plot() {
  const g = new THREE.Group();
  const edge = std(0xb8ad98);
  for (const [x, z, w, d] of [[0, -1, 2.2, 0.2], [0, 1, 2.2, 0.2], [-1, 0, 0.2, 2.2], [1, 0, 0.2, 2.2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), edge); b.position.set(x, 0.09, z); b.receiveShadow = true; g.add(b); }
  const lock = label('🔒', { size: 0.55, emoji: true, bg: 'rgba(20,24,30,.6)', font: '58px system-ui, sans-serif' }); lock.position.y = 0.7; g.add(lock);
  return g;
}

// Find HOUSES free spots near (sx, sz): clear of `blocked`, of the `avoid` circles, of the
// path from the arrival point to the middle, and not too close to each other.
function spots({ blocked, inside, spawn: [sx, sz], center = [0, 0], avoid = [], minR = 3 }) {
  const list = [], ok = (x, z) => {
    if (inside && !inside(x, z)) return false;
    for (let a = 0; a < 8; a++) { const px = x + Math.cos(a) * 1.5, pz = z + Math.sin(a) * 1.5; if (blocked(px, pz)) return false; }
    if (blocked(x, z)) return false;
    for (const [ax, az, ar] of avoid) if (Math.hypot(x - ax, z - az) < ar + 1.6) return false;
    // Keep the walk from where he arrives to the middle open.
    const dx = center[0] - sx, dz = center[1] - sz, L = Math.hypot(dx, dz) || 1, t = ((x - sx) * dx + (z - sz) * dz) / (L * L);
    if (t > -0.2 && t < 1.05) { const qx = sx + dx * t, qz = sz + dz * t; if (Math.hypot(x - qx, z - qz) < 2.6) return false; }
    return Math.hypot(x - sx, z - sz) > minR;
  };
  const cands = [];
  for (let r = 4; r <= 22; r += 1.2) for (let a = 0; a < Math.PI * 2; a += 0.6 / Math.max(1, r / 6)) cands.push([sx + Math.cos(a) * r, sz + Math.sin(a) * r]);
  cands.sort((a, b) => Math.hypot(a[0] - sx, a[1] - sz) - Math.hypot(b[0] - sx, b[1] - sz));
  for (const [x, z] of cands) {
    if (list.length >= HOUSES) break;
    if (!ok(x, z) || list.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 3.6)) continue;
    list.push([x, z]);
  }
  return list;
}

// habits: [{ id, title, icon, done }] — the dimension's habits in order (at most 8).
export function habitHouses(scene, { blocked, inside, groundAt = () => 0, spawn, center, avoid, minR, color = 0xe8dcc4, roof = 0xb8432e, habits = [] } = {}) {
  const at = spots({ blocked, inside, spawn, center, avoid, minR });
  const root = new THREE.Group(); scene.add(root);
  let slots = [];
  const build = (list) => {
    for (const s of slots) root.remove(s.obj);
    slots = at.map(([x, z], i) => {
      const h = list[i], obj = h ? house(color, roof, h.icon || '⭐', h.title) : plot();
      obj.position.set(x, groundAt(x, z), z);
      obj.rotation.y = Math.atan2(spawn[0] - x, spawn[1] - z);   // face where he arrives
      if (h) { const L = obj.userData.lamp; L.material.color.set(h.done ? 0xffd040 : 0x666666); L.material.emissive.set(h.done ? 0xffb020 : 0x000000); L.material.emissiveIntensity = h.done ? 1.4 : 0; }
      root.add(obj);
      return { obj, habit: h || null, x, z };
    });
  };
  let key = '';
  const update = (list) => { const k = JSON.stringify(list); if (k === key) return; key = k; build(list); };
  update(habits);
  return {
    update,
    // Inside a house (for walking).
    blocked: (x, z) => slots.some((s) => s.habit && Math.abs(x - s.x) < 1.35 && Math.abs(z - s.z) < 1.35),
    // The habit of the house hit by a ray, if any.
    pick(ray) { for (const s of slots) if (s.habit && ray.intersectObject(s.obj, true).length) return s.habit; return null; },
    tick(t) { for (const s of slots) if (s.habit?.done) s.obj.userData.lamp.scale.setScalar(1 + Math.sin(t * 4 + s.x) * 0.12); },
    spots: at,
  };
}
