// The eight small buildings of a dimension: one for every habit. A habit built stands as a
// little house in the dimension's colours with its counter (days, hours, minutes) on a
// board over the door, its icon and its name above; a golden light burns on its roof
// while the counter runs. A place not built
// yet is a bare foundation with a lock. The spots are found once, the same every time:
// free ground near where the character arrives, clear of the scene's own things.
import * as THREE from './vendor/three.module.min.js';

export const HOUSES = 8;
const SCALE = 1.35;   // a little bigger than life, so the counters read from afar
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

// The habit's counter, on a wooden board over the door: the days big, the hours and
// minutes under them (or "paused" in amber). Redrawn in place as the time goes on.
function counterBoard() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 220;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.67), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }));
  const ar = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
  m.userData.draw = ({ days = 0, hours = 0, minutes = 0 } = {}, paused = false) => {
    const g = cv.getContext('2d');
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, 512, 220);
    g.strokeStyle = paused ? '#f4b84a' : '#e8c46a'; g.lineWidth = 12; g.strokeRect(6, 6, 500, 208);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.fillStyle = '#fff6dc'; g.font = 'bold 92px system-ui, sans-serif';
    g.fillText(days ? ar(days, 'يوم', 'يومين', 'أيام', 'يوم') : `${hours} س`, 256, 84);
    g.fillStyle = paused ? '#f4b84a' : '#9fe3b8'; g.font = 'bold 50px system-ui, sans-serif';
    g.fillText(paused ? '⏸ موقوف' : days ? `${hours} ساعة · ${minutes} دقيقة` : `${minutes} دقيقة`, 256, 170);
    t.needsUpdate = true;
  };
  return m;
}

// A little house (about 2 × 2): stone base, walls in the dimension's colour, a roof, a door,
// the counter board over the door, the habit's icon on the gable, its name above, and a
// lamp on top that burns while the counter runs.
function house(color, roof, icon, title) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 2.2), std(0xcfc6b2)); base.position.y = 0.12; g.add(base);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.6), std(color)); walls.position.y = 0.9; g.add(walls);
  const r = new THREE.Mesh(new THREE.ConeGeometry(1.42, 0.95, 4), std(roof, { roughness: 0.6 })); r.position.y = 2.02; r.rotation.y = Math.PI / 4; g.add(r);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.05), std(0x4a2f1a)); door.position.set(0, 0.56, 0.81); g.add(door);
  const board = counterBoard(); board.position.set(0, 1.2, 0.83); g.add(board);
  const sign = label(icon, { size: 0.55, emoji: true, bg: 'rgba(255,250,235,.95)', font: '64px system-ui, sans-serif' }); sign.position.set(0, 2.05, 1.0); g.add(sign);
  const name = label(title, { size: 0.42 }); name.position.set(0, 3.25, 0); g.add(name);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), std(0x666666, { emissive: 0x000000 })); lamp.position.y = 2.6; g.add(lamp);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData = { lamp, name, board };
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
    for (let a = 0; a < 8; a++) { const px = x + Math.cos(a) * 1.9, pz = z + Math.sin(a) * 1.9; if (blocked(px, pz)) return false; }
    if (blocked(x, z)) return false;
    for (const [ax, az, ar] of avoid) if (Math.hypot(x - ax, z - az) < ar + 2) return false;
    // Keep the walk from where he arrives to the middle open.
    const dx = center[0] - sx, dz = center[1] - sz, L = Math.hypot(dx, dz) || 1, t = ((x - sx) * dx + (z - sz) * dz) / (L * L);
    if (t > -0.2 && t < 1.05) { const qx = sx + dx * t, qz = sz + dz * t; if (Math.hypot(x - qx, z - qz) < 2.6) return false; }
    return Math.hypot(x - sx, z - sz) > minR;
  };
  const cands = [];
  for (let r = 4; r <= 22; r += 1.2) for (let a = 0; a < Math.PI * 2; a += 0.6 / Math.max(1, r / 6)) cands.push([sx + Math.cos(a) * r, sz + Math.sin(a) * r]);
  // Nearest first, but ahead of him (toward the middle, where the camera looks) before behind.
  const fx = center[0] - sx, fz = center[1] - sz, fl = Math.hypot(fx, fz) || 1;
  const score = ([x, z]) => Math.hypot(x - sx, z - sz) - 1.2 * (((x - sx) * fx + (z - sz) * fz) / fl);
  cands.sort((a, b) => score(a) - score(b));
  for (const [x, z] of cands) {
    if (list.length >= HOUSES) break;
    if (!ok(x, z) || list.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 4.4)) continue;
    list.push([x, z]);
  }
  return list;
}

// habits: [{ id, title, icon, time: { days, hours, minutes }, paused }] — the dimension's habits
// in order (at most 8). The lamp on the roof burns while the counter runs.
export function habitHouses(scene, { blocked, inside, groundAt = () => 0, spawn, center, avoid, minR, color = 0xe8dcc4, roof = 0xb8432e, habits = [] } = {}) {
  const at = spots({ blocked, inside, spawn, center, avoid, minR });
  const root = new THREE.Group(); scene.add(root);
  let slots = [];
  const build = (list) => {
    for (const s of slots) root.remove(s.obj);
    slots = at.map(([x, z], i) => {
      const h = list[i], obj = h ? house(color, roof, h.icon || '⭐', h.title) : plot();
      obj.scale.setScalar(SCALE);
      obj.position.set(x, groundAt(x, z), z);
      obj.rotation.y = Math.atan2(spawn[0] - x, spawn[1] - z);   // face where he arrives
      root.add(obj);
      return { obj, habit: h || null, x, z };
    });
  };
  // The counters and the lamps follow the time without rebuilding the houses.
  const show = (list) => slots.forEach((s, i) => {
    const h = list[i]; if (!h || !s.habit) return;
    s.habit = h;
    s.obj.userData.board.userData.draw(h.time, h.paused);
    const L = s.obj.userData.lamp, on = !h.paused;
    L.material.color.set(on ? 0xffd040 : 0x666666); L.material.emissive.set(on ? 0xffb020 : 0x000000); L.material.emissiveIntensity = on ? 1.4 : 0;
  });
  let key = '', shown = '';
  const update = (list) => {
    const k = JSON.stringify(list.map((h) => [h.id, h.title, h.icon]));
    if (k !== key) { key = k; build(list); shown = ''; }
    const t = JSON.stringify(list.map((h) => [h.time, h.paused]));
    if (t !== shown) { shown = t; show(list); }
  };
  update(habits);
  return {
    update,
    // Inside a house (for walking).
    blocked: (x, z) => slots.some((s) => s.habit && Math.abs(x - s.x) < 1.35 * SCALE && Math.abs(z - s.z) < 1.35 * SCALE),
    // The habit of the house hit by a ray, if any.
    pick(ray) { for (const s of slots) if (s.habit && ray.intersectObject(s.obj, true).length) return s.habit; return null; },
    tick(t) { for (const s of slots) if (s.habit && !s.habit.paused) s.obj.userData.lamp.scale.setScalar(1 + Math.sin(t * 4 + s.x) * 0.12); },
    spots: at,
  };
}
