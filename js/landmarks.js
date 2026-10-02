// 3D landmark for each life dimension, shared by the world map and the character places.
import * as THREE from './vendor/three.module.min.js';
const addShadow = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
// ---- one landmark per dimension ----
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const cyl = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const finish = (g) => { addShadow(g); return g; };

// Physical: a stadium with a red running track and floodlights.
const arena = () => {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 3.2, 40, 1, true), M(0xb8b2a6, { side: THREE.DoubleSide })); bowl.position.y = 1.6; g.add(bowl);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(8.2 + i * 0.25, 0.18, 6, 48), M(i % 2 ? 0xc0392b : 0xa93226)); r.rotation.x = Math.PI / 2; r.position.y = 0.8 + i * 0.7; g.add(r); }
  cyl(g, 7.6, 7.6, 0.3, M(0xc0392b), 0, 0.1);
  cyl(g, 5.8, 5.8, 0.34, M(0x3fa34d), 0, 0.1);
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { cyl(g, 0.2, 0.25, 8, M(0x888888), x, 0, z, 8); box(g, 1.6, 0.8, 0.4, M(0xffffff, { emissive: 0xffffcc, emissiveIntensity: 0.6 }), x, 8, z); }
  return finish(g);
};
// Emotional: a heart-shaped pond with blossom trees.
const heartGarden = () => {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(0, -3); sh.bezierCurveTo(-5, 1, -3.5, 5, 0, 2.8); sh.bezierCurveTo(3.5, 5, 5, 1, 0, -3);
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), M(0x7fc4d6, { roughness: 0.1 })); pond.rotation.x = -Math.PI / 2; pond.position.y = 0.3; pond.scale.setScalar(1.3); g.add(pond);
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), M(0xffc1d6)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.2; rim.scale.setScalar(1.55); g.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 8, z = Math.sin(a) * 7;
    cyl(g, 0.2, 0.3, 2.4, M(0x7a5a3c), x, 0, z, 6);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), M(i % 2 ? 0xffb3cc : 0xff9ebb)); c.position.set(x, 3.4, z); g.add(c);
  }
  const bench = box(g, 2.4, 0.3, 0.8, M(0x8b5a2b), 0, 0.6, 5.4);
  const pav = cyl(g, 0.1, 0.1, 3, M(0xffffff), -4, 0, -5); const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 8), M(0xe8a0b8)); roof.position.set(-4, 3.6, -5); g.add(roof);
  return finish(g);
};
// Social: a ring of colourful houses around a square with a fountain.
const village = () => {
  const g = new THREE.Group();
  cyl(g, 7.5, 7.5, 0.3, M(0xd9c7a3), 0, 0);
  const walls = [0xf1d8b0, 0xe8c79a, 0xf3e1c2, 0xe2c59a], roofs = [0xb5523b, 0x8e3b3b, 0x7a3a2a];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5, h = 2.5 + (i % 3);
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = -a + Math.PI / 2; g.add(hg);
    box(hg, 3, h, 3, M(walls[i % 4]));
    const r = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.8, 4), M(roofs[i % 3])); r.position.y = h + 0.9; r.rotation.y = Math.PI / 4; hg.add(r);
  }
  cyl(g, 1.6, 1.8, 0.8, M(0xe9e4d8), 0, 0.3); cyl(g, 1.3, 1.3, 0.1, M(0x7fb7c4), 0, 1.05); cyl(g, 0.25, 0.3, 2, M(0xe9e4d8), 0, 1);
  for (const [x, z, c] of [[-3, 3, 0xc0392b], [3, 3, 0x2f6f5e]]) { box(g, 1.8, 1.2, 1.2, M(0x7a5a3c), x, 0.3, z); box(g, 2.2, 0.15, 1.6, M(c), x, 2.2, z); }
  return finish(g);
};
// Intellectual: a tall library tower crowned with an observatory dome.
const knowledgeTower = () => {
  const g = new THREE.Group();
  cyl(g, 4, 4.6, 5, M(0x5a4a3a), 0, 0, 0, 12);
  cyl(g, 3, 3.5, 7, M(0x6b5846), 0, 5, 0, 12);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(g, 0.6, 2, 0.1, M(0x8fb0d8, { emissive: 0x3a5a8a, emissiveIntensity: 0.4 }), Math.cos(a) * 3.1, 7.5, Math.sin(a) * 3.1).rotation.y = -a + Math.PI / 2; }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x8a9aa8, { metalness: 0.7, roughness: 0.3 })); dome.position.y = 12; g.add(dome);
  const scope = cyl(g, 0.35, 0.5, 3.5, M(0xc9a45c, { metalness: 0.9 }), 1.2, 13, 0, 10); scope.rotation.z = -0.8;
  for (let i = 0; i < 3; i++) box(g, 1.4, 1.8, 0.4, M([0x8e3b3b, 0x2f4a6d, 0xc9a45c][i]), -5 + i * 0.5, 0, 4 + i * 0.3).rotation.z = (i - 1) * 0.15;
  return finish(g);
};
// Professional: a glass office tower with a construction crane and gears.
const workTower = () => {
  const g = new THREE.Group();
  box(g, 6, 16, 6, M(0x2c3e50, { metalness: 0.4, roughness: 0.3 }));
  for (let y = 1; y < 16; y += 1.6) for (const [x, z, ry] of [[0, 3.02, 0], [0, -3.02, 0], [3.02, 0, Math.PI / 2], [-3.02, 0, Math.PI / 2]]) box(g, 5, 0.9, 0.05, M(0xffd68a, { emissive: 0xffa94d, emissiveIntensity: (y * 7) % 3 > 1 ? 0.5 : 0.1 }), x, y, z).rotation.y = ry;
  box(g, 4, 9, 4, M(0x34495e), 6, 0, 2);
  cyl(g, 0.25, 0.25, 22, M(0xe67e22), -5, 0, -2, 6);
  box(g, 14, 0.4, 0.4, M(0xe67e22), 0, 21.6, -2);
  cyl(g, 0.05, 0.05, 5, M(0x333333), 5.5, 16.6, -2, 4);
  box(g, 1.2, 0.8, 1.2, M(0xe67e22), 5.5, 15.8, -2);
  for (const [x, r] of [[-3, 1.4], [-5, 0.9]]) { const gear = new THREE.Mesh(new THREE.TorusGeometry(r, 0.3, 6, 12), M(0xe67e22, { metalness: 0.8 })); gear.position.set(x, r + 0.3, 5); g.add(gear); }
  return finish(g);
};
// Financial: a treasury with columns, a golden dome and coin piles.
const treasury = () => {
  const g = new THREE.Group();
  box(g, 12, 0.8, 9, M(0xe2d6b8));
  box(g, 10, 6, 7, M(0xf1ead8), 0, 0.8);
  for (let i = 0; i < 6; i++) cyl(g, 0.4, 0.45, 5.5, M(0xfbf8f2), -4 + i * 1.6, 0.8, 4, 12);
  const ped = new THREE.Mesh(new THREE.ConeGeometry(7, 2, 4), M(0xe2d6b8)); ped.position.y = 7.8; ped.rotation.y = Math.PI / 4; ped.scale.z = 0.7; g.add(ped);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffc83d, { metalness: 1, roughness: 0.2 })); dome.position.y = 8.6; g.add(dome);
  const gold = M(0xffc83d, { metalness: 1, roughness: 0.25 });
  for (const [x, z, n] of [[-6, 6, 5], [6, 6, 4], [7, -3, 6]]) for (let i = 0; i < n; i++) cyl(g, 0.8, 0.8, 0.22, gold, x, i * 0.24, z, 16);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 24), M(0x8a8f96, { metalness: 0.9 })); vault.rotation.x = Math.PI / 2; vault.position.set(0, 3, 3.6); g.add(vault);
  return finish(g);
};
// Environmental: a giant tree of life with a greenhouse and flowers.
const lifeTree = () => {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 10, 10), M(0x6b4a2a)); trunk.position.y = 5; g.add(trunk);
  for (const [x, y, z, r, c] of [[0, 12, 0, 5, 0x3e8e41], [-3.5, 10, 1, 3.5, 0x4caf50], [3.5, 10, -1, 3.5, 0x43a047], [0, 15, 0, 3.4, 0x66bb6a], [1, 10.5, 3.5, 3, 0x388e3c]]) {
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(c)); c2.position.set(x, y, z); g.add(c2);
  }
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0xffeb3b, { emissive: 0xaa8800, emissiveIntensity: 0.4 })); const a = i * 0.9; f.position.set(Math.cos(a) * 4.5, 10 + (i % 4) * 1.4, Math.sin(a) * 4.5); g.add(f); }
  const gh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xbfe9f7, { transparent: true, opacity: 0.5, roughness: 0.05 })); gh.position.set(7, 0, 3); g.add(gh);
  for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28, r = 4 + Math.random() * 4; const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 4), M([0xe74c3c, 0xf1c40f, 0x9b59b6, 0xff7aa2][i % 4])); fl.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); g.add(fl); }
  return finish(g);
};

export const DIM_BUILD = { body: arena, heart: heartGarden, social: village, library: knowledgeTower, career: workTower, wealth: treasury, nature: lifeTree };
