// Small building kit shared by the seven dimension scenes.
import * as THREE from './vendor/three.module.min.js';
import { canvasTex, glowTex } from './env3d.js';

export { canvasTex, glowTex };
export const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
export const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
export const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
export const box = (p, w, h, d, m, x = 0, y = 0, z = 0) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z);
export const cyl = (p, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => add(p, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
export const sph = (p, r, m, x = 0, y = 0, z = 0, ws = 16, hs = 12) => add(p, new THREE.SphereGeometry(r, ws, hs), m, x, y, z);
export const shade = (o, cast = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } }); return o; };
export const ring = (n, r, fn, off = 0) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + off; fn(Math.cos(a) * r, Math.sin(a) * r, a, i); } };
// rotation.y that turns a model's +z towards (tx, tz)
export const faceTo = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);
export const group = (p, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g; };

// Flat ground disc with a canvas texture.
export function ground(scene, r, tex, { y = 0, rough = 0.95, color = 0xffffff, seg = 64 } = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), new THREE.MeshStandardMaterial({ map: tex, color, roughness: rough }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
}
// Noise-speckled texture (grass, sand, dirt …).
export function speckle(base, spots, { size = 512, repeat = 20, n = 2600, r = [1, 4] } = {}) {
  return canvasTex(size, size, (g, w) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    for (let i = 0; i < n; i++) {
      g.fillStyle = spots[i % spots.length]; g.globalAlpha = 0.25 + Math.random() * 0.5;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * w, r[0] + Math.random() * (r[1] - r[0]), 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }, repeat);
}

// Particles: init(i) → object with x,y,z; step(d, t, dt, i) moves it.
export function particles(scene, { n, color = 0xffffff, size = 0.15, additive = true, tex = glowTex, opacity = 1, init, step, sizeAttenuation = true }) {
  const pos = new Float32Array(n * 3), data = Array.from({ length: n }, (_, i) => init(i));
  const mat = new THREE.PointsMaterial({ color, size, map: tex, transparent: true, opacity, depthWrite: false, sizeAttenuation, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), mat);
  pts.frustumCulled = false; scene.add(pts);
  const write = () => { data.forEach((d, i) => { pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z; }); pts.geometry.attributes.position.needsUpdate = true; };
  write();
  return { pts, mat, data, tick(t, dt) { data.forEach((d, i) => step(d, t, dt, i)); write(); } };
}

// A living fire: two additive tongues, a glow, optional flickering light.
export function fire(p, x, y, z, s = 1, { light = 0, color = 0xff7a2a, dist = 16 } = {}) {
  const g = group(p, x, y, z);
  const outer = add(g, new THREE.ConeGeometry(0.5 * s, 1.6 * s, 10, 1, true), basic(0xff6a1a, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0.8 * s, 0);
  const inner = add(g, new THREE.ConeGeometry(0.28 * s, 1.05 * s, 10, 1, true), basic(0xffe08a, { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0.55 * s, 0);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa04a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(4 * s); glow.position.y = 0.8 * s; g.add(glow);
  const l = light ? new THREE.PointLight(color, light, dist * s, 1.6) : null;
  if (l) { l.position.y = 1.2 * s; g.add(l); }
  const ph = Math.random() * 10;
  return {
    g, light: l,
    tick(t) {
      const k = 0.85 + Math.sin(t * 11 + ph) * 0.1 + Math.sin(t * 27 + ph) * 0.06;
      outer.scale.set(1 + Math.sin(t * 7 + ph) * 0.06, k * 1.1, 1); inner.scale.set(1, k * 1.2, 1);
      outer.rotation.y = t * 2 + ph; inner.rotation.y = -t * 3;
      glow.material.opacity = 0.55 + k * 0.2;
      if (l) l.intensity = light * k;
    },
  };
}

// Glowing lamp body: an emissive mesh whose glow follows the night.
export const lampMat = (color, o = {}) => std(color, { emissive: color, emissiveIntensity: 0.2, roughness: 0.4, ...o });

// Canvas text panel.
export function textTex(lines, { w = 512, h = 256, bg = '#1b2a3a', fg = '#fff', font = 'Tajawal, system-ui, sans-serif' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    lines.forEach((t, i) => { g.font = `${i ? 600 : 800} ${i ? h * 0.16 : h * 0.26}px ${font}`; g.fillText(t, w / 2, h * (lines.length > 1 ? 0.36 + i * 0.32 : 0.5)); });
  });
}

// A waving flag/banner: plane whose vertices ripple.
export function flag(p, w, h, tex, x, y, z, ry = 0) {
  const geo = new THREE.PlaneGeometry(w, h, 12, 4); geo.translate(w / 2, 0, 0);
  const m = add(p, geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }), x, y, z); m.rotation.y = ry;
  const base = geo.attributes.position.array.slice(), ph = Math.random() * 6;
  return { m, tick(t) { const a = geo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const u = base[i] / w; a[i + 2] = Math.sin(base[i] * 2.2 - t * 5 + ph) * 0.25 * u; } geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); } };
}

// Village / bazaar figures from the shared character model.
export const PALS = [
  { robe: '#c96f3b', accent: '#5a2e14', skin: '#e9c29e', glow: '#ffd38a' }, { robe: '#3b6fc9', accent: '#f0d080', skin: '#f2d2b4', glow: '#9fc8ff' },
  { robe: '#6a9a4a', accent: '#2e4a1a', skin: '#d9ad85', glow: '#c8f08a' }, { robe: '#9a4a7a', accent: '#f0c0e0', skin: '#f0cfae', glow: '#ffb3e0' },
  { robe: '#e8e0d0', accent: '#8a6a3a', skin: '#c99a72', glow: '#fff0c0' }, { robe: '#3a3a4a', accent: '#d4a53a', skin: '#e9c29e', glow: '#ffd38a' },
];
