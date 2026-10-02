// 3D landmark for each life dimension, shared by the world map and the character places.
import * as THREE from './vendor/three.module.min.js';
const addShadow = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
// ---- one landmark per dimension ----
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const cyl = (g, rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const finish = (g) => { addShadow(g); return g; };

// Physical (الجسدي): a real stadium — tiered stands round a track and pitch, a
// columned entrance gate with the club crest, and tall floodlights.
const arena = () => {
  const g = new THREE.Group();
  // Stands: a stepped bowl (lathe of the cross-section), concrete with red seats.
  const prof = [[7.2, 0], [7.2, 0.8], [8, 0.8], [8, 1.7], [8.8, 1.7], [8.8, 2.6], [9.6, 2.6], [9.6, 3.6], [10.2, 3.6], [10.2, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  const stands = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M(0xc9c3b6, { side: THREE.DoubleSide })); g.add(stands);
  for (const [r, y] of [[7.6, 0.82], [8.4, 1.72], [9.2, 2.62]]) { const seats = new THREE.Mesh(new THREE.TorusGeometry(r, 0.22, 4, 48), M(0xc0392b)); seats.rotation.x = Math.PI / 2; seats.position.y = y + 0.1; g.add(seats); }
  // Roof canopy over the back of the stands.
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 9.4, 0.3, 48, 1, true), M(0xe8e4dc, { side: THREE.DoubleSide })); roof.position.y = 4.6; g.add(roof);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cyl(g, 0.12, 0.12, 4.6, M(0x9a948a), Math.cos(a) * 10.2, 0, Math.sin(a) * 10.2, 6); }
  // Track and pitch.
  cyl(g, 7.1, 7.1, 0.2, M(0xc0392b), 0, 0);
  cyl(g, 5.6, 5.6, 0.24, M(0x3fa34d), 0, 0);
  for (const r of [6, 6.4, 6.8]) { const lane = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 64), M(0xffffff)); lane.rotation.x = Math.PI / 2; lane.position.y = 0.22; g.add(lane); }
  box(g, 0.1, 0.02, 11, M(0xffffff), 0, 0.25); const circ = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 4, 32), M(0xffffff)); circ.rotation.x = Math.PI / 2; circ.position.y = 0.26; g.add(circ);
  // Entrance gate facing the path (+z): two pylons, a lintel with the crest.
  for (const sx of [-1, 1]) box(g, 1.4, 6.5, 1.4, M(0xb03a2e), sx * 2.6, 0, 10.6);
  box(g, 6.6, 1.3, 1.6, M(0xe8e4dc), 0, 6.5, 10.6);
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 24), M(0xffc83d, { metalness: 0.8, roughness: 0.3 })); crest.rotation.x = Math.PI / 2; crest.position.set(0, 7.15, 11.45); g.add(crest);
  // Floodlights.
  for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { cyl(g, 0.22, 0.3, 11, M(0x888888), x, 0, z, 8); box(g, 2, 1, 0.5, M(0xffffff, { emissive: 0xffffcc, emissiveIntensity: 0.8 }), x, 11, z); }
  return finish(g);
};
// Emotional (الوجداني): a domed pavilion on an island in a calm round lake, a
// wooden bridge to it and lanterns on the shore — blue, white and gold.
const heartGarden = () => {
  const g = new THREE.Group();
  const lake = new THREE.Mesh(new THREE.CircleGeometry(10, 48), M(0x5fa8b8, { roughness: 0.1, metalness: 0.2 })); lake.rotation.x = -Math.PI / 2; lake.position.y = 0.25; g.add(lake);
  const shore = new THREE.Mesh(new THREE.RingGeometry(10, 11.2, 48), M(0xd9d2bf)); shore.rotation.x = -Math.PI / 2; shore.position.y = 0.26; g.add(shore);
  cyl(g, 5.2, 5.6, 0.7, M(0xe9e4d6), 0, 0, 0, 32);          // island
  // Octagonal pavilion: eight columns, a gold ring beam, a blue dome with a finial.
  cyl(g, 3.8, 3.8, 0.4, M(0xf3efe4), 0, 0.7, 0, 8);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl(g, 0.28, 0.32, 4.6, M(0xf7f3ea), Math.cos(a) * 3.2, 1.1, Math.sin(a) * 3.2, 12); }
  cyl(g, 3.9, 3.9, 0.6, M(0xe0c36a, { metalness: 0.6, roughness: 0.3 }), 0, 5.7, 0, 8);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x3d5a80, { roughness: 0.35, metalness: 0.2 })); dome.position.y = 6.3; g.add(dome);
  cyl(g, 0.12, 0.2, 1.4, M(0xe0c36a, { metalness: 0.8 }), 0, 9.6, 0, 8);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 10), M(0xe0c36a, { metalness: 0.8, emissive: 0x5a4a10, emissiveIntensity: 0.4 })); orb.position.y = 11.1; g.add(orb);
  // A soft light in the middle, and a bench under the dome.
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10), M(0xdff6f7, { emissive: 0x9ad1d4, emissiveIntensity: 1.2 })); glow.position.y = 2.6; g.add(glow);
  box(g, 2.2, 0.35, 0.7, M(0x8b6b45), 0, 1.1, -1.5);
  // Bridge from the shore (+z, toward the path) to the island.
  box(g, 2, 0.3, 6, M(0x8b6b45), 0, 0.5, 7.8);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) cyl(g, 0.08, 0.08, 1, M(0x5a4a3a), sx * 0.95, 0.6, 5.4 + k * 1.6, 6);
  // Lanterns round the shore.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3, x = Math.cos(a) * 11.6, z = Math.sin(a) * 11.6;
    cyl(g, 0.08, 0.1, 2, M(0x2d2a26), x, 0, z, 6);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M(0xfff1c8, { emissive: 0xffd98a, emissiveIntensity: 1 })); l.position.set(x, 2.2, z); g.add(l);
  }
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
// Environmental (البيئي): a nature reserve house — a timber lodge with a green
// living roof and solar panels, a big glass greenhouse, a wind turbine, and garden beds.
const lifeTree = () => {
  const g = new THREE.Group();
  const wood = M(0x8b5a2b), dark = M(0x5a3a1e), glass = M(0xbfe9f7, { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1 }), frame = M(0xf2f2ee);
  // Lodge: stone base, timber walls, windows, a pitched roof covered in grass.
  box(g, 10, 0.6, 7, M(0x9c927f));
  box(g, 9, 4.2, 6, wood, 0, 0.6);
  for (const x of [-3, 0, 3]) box(g, 1.6, 1.6, 0.1, M(0xffe7a8, { emissive: 0xffb84d, emissiveIntensity: 0.35 }), x, 2.2, 3.02);
  box(g, 1.4, 2.6, 0.1, dark, 0, 0.6, 3.03);
  for (const sx of [-1, 1]) { const r = box(g, 10, 0.4, 4.3, M(0x4f9a3f), sx * 0, 0, 0); r.position.set(0, 6.1, sx * 1.55); r.rotation.x = sx * 0.62; }
  const ridge = box(g, 10.2, 0.4, 0.5, dark, 0, 7.15, 0);
  // Solar panels on the front slope of the roof.
  for (const x of [-3, 0, 3]) { const p = box(g, 2.4, 0.08, 1.6, M(0x1f3a5f, { metalness: 0.6, roughness: 0.25 }), x, 0, 0); p.position.set(x, 6.55, 1.6); p.rotation.x = 0.62; }
  // Greenhouse: glass hall with a white frame and plants inside.
  const gh = new THREE.Group(); gh.position.set(-9.5, 0, -1); g.add(gh);
  box(gh, 6, 3.4, 5, glass);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 6, 16, 1, false, 0, Math.PI), glass); top.rotation.z = Math.PI / 2; top.position.y = 3.4; gh.add(top);
  for (const x of [-3, -1, 1, 3]) box(gh, 0.12, 3.4, 5.1, frame, x, 0, 0);
  for (let i = 0; i < 6; i++) { const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), M(0x3e8e41)); pl.position.set(-2 + (i % 3) * 2, 0.8, i < 3 ? -1.2 : 1.2); gh.add(pl); }
  // Wind turbine.
  const tw = new THREE.Group(); tw.position.set(8.5, 0, -3); g.add(tw);
  cyl(tw, 0.25, 0.45, 14, frame, 0, 0, 0, 12);
  box(tw, 0.8, 0.8, 1.6, frame, 0, 13.6, 0);
  const rotor = new THREE.Group(); rotor.position.set(0, 14, 0.9); tw.add(rotor); g.userData.rotor = rotor;
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6, 0.1), frame); b.position.y = 3; const arm = new THREE.Group(); arm.rotation.z = (i / 3) * Math.PI * 2; arm.add(b); rotor.add(arm); }
  // Garden beds and a few young trees by the path.
  const cols = [0xe74c3c, 0xf1c40f, 0x9b59b6, 0xffffff];
  for (const sx of [-1, 1]) {
    box(g, 2.4, 0.4, 2, dark, sx * 3.5, 0, 6);
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), M(cols[i % 4])); f.position.set(sx * 3.5 - 0.8 + (i % 3) * 0.8, 0.6, 5.6 + (i < 3 ? 0 : 0.8)); g.add(f); }
    cyl(g, 0.15, 0.2, 1.6, M(0x6b4a2a), sx * 6.5, 0, 6.5, 6);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), M(0x4caf50)); c.position.set(sx * 6.5, 2.4, 6.5); g.add(c);
  }
  return finish(g);
};

export const DIM_BUILD = { body: arena, heart: heartGarden, social: village, library: knowledgeTower, career: workTower, wealth: treasury, nature: lifeTree };
