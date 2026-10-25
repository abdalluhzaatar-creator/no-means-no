// The people and creatures of the base and the battles: the guide (an old sage),
// the King of the Void and his small void kings, the archer, arrows, souls rising
// from the fallen, and a health bar for anyone who can be hurt.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { arm } from './heaven3d.js';
import { glowTex } from './env3d.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

// The guide: an old sage in green and white, a white turban and beard, a staff.
export function buildGuide() {
  const pal = { robe: '#f4f1e8', accent: '#2f7a5a', skin: '#e9c7a6', glow: '#9fe3b8' };
  const h = buildWorshipper(pal);
  const neck = h.head.parent;
  const turban = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.07, 10, 20), std(0xffffff)); turban.rotation.x = Math.PI / 2; turban.position.y = 0.27; neck.add(turban);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x2f7a5a)); top.position.y = 0.28; neck.add(top);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 12), std(0xf2f2f2)); beard.rotation.x = Math.PI; beard.position.set(0, 0.02, 0.1); neck.add(beard);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.1, 8), std(0x7a5532)); staff.position.set(-0.45, 1.05, 0.1); h.root.add(staff);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x9fffd0, toneMapped: false })); gem.position.set(-0.45, 2.18, 0.1); h.root.add(gem);
  h.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return h;
}

// A void king: deep purple robes, a dark crown, hollow glowing eyes and a void haze.
// The great King of the Void is the same, bigger (scale 1.6) with a taller crown.
export function buildVoidKing({ big = false } = {}) {
  const pal = { robe: '#2a1640', accent: '#6a2fa0', skin: '#5a4a6a', glow: '#b06aff' };
  const h = buildWorshipper(pal);
  const neck = h.head.parent;
  const gold = std(0x3a2a14, { metalness: 0.8, roughness: 0.3, emissive: 0x6a2fa0, emissiveIntensity: 0.4 });
  const crown = new THREE.Group(); crown.position.y = 0.3; neck.add(crown);
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.07, 14, 1, true), gold));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, s = new THREE.Mesh(new THREE.ConeGeometry(0.035, big ? 0.2 : 0.12, 6), gold); s.position.set(Math.cos(a) * 0.14, big ? 0.13 : 0.09, Math.sin(a) * 0.14); crown.add(s); }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xd9a8ff, toneMapped: false });
  for (const sx of [-0.055, 0.055]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeM); e.position.set(sx, 0.18, 0.152); neck.add(e); }
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8a3aff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.scale.setScalar(2.4); haze.position.y = 1; h.root.add(haze);
  if (big) {
    h.root.scale.setScalar(1.6);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.4, 8), std(0x140a1e)); staff.position.set(-0.45, 1.2, 0.1); h.root.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), new THREE.MeshBasicMaterial({ color: 0xb06aff, toneMapped: false })); orb.position.set(-0.45, 2.45, 0.1); h.root.add(orb);
  } else h.root.scale.setScalar(0.55);
  // Fade (they vanish when they fall).
  const mats = [];
  h.root.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; mats.push([m.material, m.material.opacity]); } if (m.isMesh) m.castShadow = true; });
  h.setOpacity = (o) => { mats.forEach(([m, b]) => (m.opacity = b * o)); h.root.visible = o > 0.01; };
  return h;
}

// The archer: a warrior in green with a bow (and a quiver), light leather armour.
export function buildArcher() {
  const pal = { robe: '#3f6a3a', accent: '#c9962c', skin: '#e8c4a0', glow: '#ffe28a' };
  const h = buildWorshipper(pal);
  arm(h, pal, false, 3);
  // Swap the spear for a bow: hide the spear group, add a bow in the left hand.
  if (h.armour?.[0]) h.armour[0].visible = false;
  const bow = new THREE.Group(); h.arms[0].el.add(bow); bow.position.set(0, -0.34, 0.08);
  const curve = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 20, Math.PI * 1.1), std(0x6a4422)); curve.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.55 * 1.0); bow.add(curve);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 4), std(0xf4f0e0)); string.position.z = -0.12; bow.add(string);
  const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 10), std(0x6a4422)); quiver.position.set(0.12, 1.45, -0.28); quiver.rotation.z = 0.3; h.root.add(quiver);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), std(0xd04030)); f.position.set(0.04 + i * 0.03, 1.75, -0.28 + (i % 2) * 0.03); quiver.parent.add(f); }
  // A bandage that shows while healing.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 12), std(0xffffff)); band.position.y = -0.1; band.visible = false; h.arms[1].el.add(band);
  h.bandage = band;
  h.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  // Aim: raise the bow arm toward the target.
  h.aim = (k) => { h.arms[0].sh.rotation.x = -1.5 * k; h.arms[1].sh.rotation.x = -1.3 * k; h.arms[1].el.rotation.x = -1.2 * k; };
  return h;
}

// An arrow that flies from a to b in an arc.
export function makeArrow() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), std(0x8a6a3a)); shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), std(0xdddddd, { metalness: 0.8 })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.4; g.add(tip);
  const trail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0a0, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); trail.scale.setScalar(0.4); g.add(trail);
  return g;
}

// A soul rising from a fallen void king.
export function makeSoul() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xe0c8ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(0.8);
  return s;
}

// Health bars above units (HTML, placed on screen every frame).
export function hpBars(container) {
  const layer = document.createElement('div'); layer.className = 'hp-layer'; container.appendChild(layer);
  const bars = new Set(), v = new THREE.Vector3();
  return {
    add(obj, { y = 2.4, max = 100, color = '#4cd964' } = {}) {
      const el = document.createElement('div'); el.className = 'hp-bar'; el.innerHTML = `<i style="background:${color}"></i>`; layer.appendChild(el);
      const b = { obj, y, max, hp: max, el, i: el.firstChild, set(hp) { b.hp = Math.max(0, Math.min(b.max, hp)); b.i.style.width = `${(b.hp / b.max) * 100}%`; b.i.style.background = b.hp / b.max < 0.35 ? '#ff5a4a' : color; }, remove() { el.remove(); bars.delete(b); } };
      bars.add(b); return b;
    },
    place(camera, w, h) {
      for (const b of bars) {
        v.copy(b.obj.position); v.y += b.y * (b.obj.scale?.y || 1); v.project(camera);
        const vis = v.z < 1 && b.obj.visible !== false && b.hp < b.max;   // as in Clash: a bar only once hurt
        b.el.style.display = vis ? '' : 'none';
        if (vis) b.el.style.transform = `translate(-50%, -50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
      }
    },
    dispose() { layer.remove(); bars.clear(); },
  };
}
