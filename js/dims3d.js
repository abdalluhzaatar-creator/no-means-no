// The seven dimension places, each with its own world and mood:
//   library → دار الحكمة: an open-sky octagonal library around a golden armillary sphere
//   body    → واحة العافية: a health park with a gym, a running loop, strength, food, pool, clinic
//   heart   → حديقة السكينة: a leafy garden with a pond, koi, a red bridge and lanterns
//   social  → ساحة اللمّة: a village square around a bonfire, people sitting together
//   career  → ساحة الإنجاز: a business plaza with a glass tower, a real clock and a ladder of success
//   wealth  → ميناء التاجر: a harbour with a counting house, ships, a vault and a lighthouse
//   nature  → الغابة الحيّة: a wide forest with a glowing tree, a waterfall, clean energy and animals
// Each builder returns { spawn, stand, blocked, camR, groundAt?, tick, burst }.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { std, basic, add, box, cyl, sph, shade, ring, faceTo, group, ground, speckle, particles, fire, lampMat, textTex, flag, canvasTex, glowTex, PALS } from './dimkit.js';

const TAU = Math.PI * 2;
const hyp = Math.hypot;

// ======================= دار الحكمة — library =======================
function library(scene, kit) {
  const { rand } = kit;
  const R = 24;
  // Mosaic floor: eight-point stars in lapis and gold on walnut.
  const floorTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#3a2618'; g.fillRect(0, 0, w, w);
    const s = w / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = i * s + s / 2, cy = j * s + s / 2;
      g.fillStyle = (i + j) % 2 ? '#4a3220' : '#432c1c'; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      for (const rot of [0, Math.PI / 4]) { g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = rot ? '#9a7a2a' : '#1f3a5a'; g.fillRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.56); g.restore(); }
      g.fillStyle = '#e8d6a8'; g.beginPath(); g.arc(cx, cy, s * 0.12, 0, 7); g.fill();
    }
  }, 16);
  ground(scene, 400, speckle('#6d8a54', ['#5a7a44', '#7f9a5e', '#4e6a3a'], { repeat: 60 }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 1.5, 8), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.05 }));
  floor.rotation.set(-Math.PI / 2, 0, Math.PI / 8); floor.position.y = 0.02; floor.receiveShadow = true; scene.add(floor);
  const rug = add(scene, new THREE.CircleGeometry(6.5, 48), std(0x7a1f24, { roughness: 1 }), 0, 0.04, 0); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true;
  const rugRing = add(scene, new THREE.RingGeometry(5.6, 6.1, 48), std(0xd4a53a, { roughness: 0.6 }), 0, 0.05, 0); rugRing.rotation.x = -Math.PI / 2;

  // Eight bays of tall bookshelves, columns between them, an open sky above.
  const wood = std(0x4a2c18, { roughness: 0.6 }), gold = std(0xd4a53a, { metalness: 0.85, roughness: 0.3 }), marble = std(0xf2ece0, { roughness: 0.35 });
  const BOOK_N = 2200, books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, { roughness: 0.7 }), BOOK_N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const bookCols = [0x7a1f24, 0x1f4a7a, 0x2e5a3a, 0x6a4a2a, 0x8a6a2a, 0x3a2a5a, 0x9a3a2a, 0x2a5a6a, 0xc9a13a, 0x5a1a3a];
  let bi = 0;
  const SHELF_W = 2 * (R + 0.6) * Math.tan(Math.PI / 8) - 1.4, SH = 10.5, ROWS = 7;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, cx = Math.sin(a) * (R + 0.6), cz = Math.cos(a) * (R + 0.6);
    const bay = group(scene, cx, 0, cz, a + Math.PI);
    box(bay, SHELF_W, SH, 1.6, wood, 0, 0, -0.4);
    for (let r = 0; r <= ROWS; r++) box(bay, SHELF_W, 0.14, 1.7, wood, 0, 0.5 + r * 1.4, 0.1);
    for (const sx of [-1, 1]) box(bay, 0.3, SH, 1.9, wood, sx * SHELF_W / 2, 0, 0.1);
    box(bay, SHELF_W + 0.6, 0.6, 2.1, gold, 0, SH, 0.1);
    // books on each row
    bay.updateMatrixWorld();
    for (let r = 0; r < ROWS && bi < BOOK_N; r++) {
      let x = -SHELF_W / 2 + 0.25;
      while (x < SHELF_W / 2 - 0.3 && bi < BOOK_N) {
        const bw = 0.12 + rand() * 0.14, bh = 0.8 + rand() * 0.42;
        if (rand() < 0.04) { x += 0.4; continue; }   // a gap now and then
        const lean = rand() < 0.06 ? 0.25 : 0;
        const p = new THREE.Vector3(x + bw / 2, 0.57 + r * 1.4 + bh / 2, 0.25).applyMatrix4(bay.matrixWorld);
        q.setFromEuler(new THREE.Euler(0, a + Math.PI, lean));
        mtx.compose(p, q, new THREE.Vector3(bw, bh, 0.9 + rand() * 0.25));
        books.setMatrixAt(bi, mtx); books.setColorAt(bi, col.set(bookCols[(rand() * bookCols.length) | 0]).multiplyScalar(0.75 + rand() * 0.4)); bi++;
        x += bw + 0.015;
      }
    }
    // a library ladder on some bays
    if (k % 3 === 1) {
      const lad = group(bay, SHELF_W * 0.2, 0, 1.4); lad.rotation.x = -0.18;
      for (const sx of [-0.4, 0.4]) cyl(lad, 0.05, 0.05, 9, wood, sx, 0, 0, 6);
      for (let y = 0.6; y < 9; y += 0.7) { const rung = add(lad, new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), gold, 0, y, 0); rung.rotation.z = Math.PI / 2; }
    }
  }
  books.count = bi; books.castShadow = true; books.receiveShadow = true; scene.add(books);
  // Columns between bays with gold capitals, and an arch ring over the open sky.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8, x = Math.sin(a) * (R + 1.3), z = Math.cos(a) * (R + 1.3);
    cyl(scene, 0.9, 1.1, 0.6, gold, x, 0, z, 16);
    cyl(scene, 0.75, 0.8, 13, marble, x, 0.6, z, 20);
    cyl(scene, 1.1, 0.8, 0.8, gold, x, 13.6, z, 16);
  }
  const crown = add(scene, new THREE.TorusGeometry(R + 1.3, 0.8, 10, 64), marble, 0, 14.6, 0); crown.rotation.x = Math.PI / 2;
  const crownG = add(scene, new THREE.TorusGeometry(R + 1.3, 0.25, 8, 64), gold, 0, 15.3, 0); crownG.rotation.x = Math.PI / 2;

  // The armillary sphere: golden rings turning around a glowing orb of knowledge.
  cyl(scene, 1.7, 2.1, 1.0, marble, 0, 0, 0, 32); cyl(scene, 0.35, 0.6, 2.4, gold, 0, 1, 0, 16);
  const arm = group(scene, 0, 5.2, 0);
  const rings = [2.9, 2.55, 2.2, 1.85].map((r, i) => { const m = add(arm, new THREE.TorusGeometry(r, 0.07 + (i === 0 ? 0.04 : 0), 10, 80), gold); m.rotation.x = i * 0.7; m.rotation.y = i * 1.1; return m; });
  const band = add(arm, new THREE.TorusGeometry(2.7, 0.16, 6, 80), std(0x1f4a7a, { metalness: 0.4, roughness: 0.4 })); band.rotation.x = Math.PI / 2 + 0.41;
  const orbM = basic(0x9fe3ff); const orb = sph(arm, 0.75, orbM, 0, 0, 0, 32, 20);
  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7fd0ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); orbGlow.scale.setScalar(5); arm.add(orbGlow);
  const orbLight = new THREE.PointLight(0x8fd8ff, 20, 22, 1.6); arm.add(orbLight); kit.glow(orbLight, 8, 26);
  const axis = add(arm, new THREE.CylinderGeometry(0.05, 0.05, 6.6, 6), gold); axis.rotation.z = 0.41;

  // Reading desks with open books and candles.
  const parch = std(0xf3e6c4, { roughness: 0.9, side: THREE.DoubleSide });
  const candles = [];
  const desks = [];
  ring(4, 12.5, (x, z, a) => {
    const d = group(scene, x, 0, z, faceTo(x, z));
    box(d, 3.2, 0.16, 1.6, wood, 0, 1.45, 0);
    for (const [sx, sz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) box(d, 0.14, 1.45, 0.14, wood, sx, 0, sz);
    const stand = box(d, 1.4, 0.06, 0.9, wood, 0, 1.62, -0.05); stand.rotation.x = -0.2;
    for (const sx of [-1, 1]) { const pg = add(d, new THREE.PlaneGeometry(0.62, 0.85), parch, sx * 0.33, 1.78, -0.05); pg.rotation.set(-Math.PI / 2 + 0.2, 0, -sx * 0.12); }
    cyl(d, 0.07, 0.08, 0.35, std(0xf6f0e0), 1.2, 1.53, -0.3, 8);
    const f = fire(d, 1.2, 1.88, -0.3, 0.12); candles.push(f);
    const stool = cyl(d, 0.45, 0.4, 0.8, wood, 0, 0, 1.6, 12);
    desks.push([x, z]);
  }, Math.PI / 4);
  // Four brass lamp posts with lanterns (off the line between the door and the sphere).
  const lamps = [], lampG = group(scene);
  ring(4, 18, (x, z) => {
    cyl(lampG, 0.12, 0.18, 4.2, gold, x, 0, z, 8);
    const m = lampMat(0xffd38a); const lamp = sph(lampG, 0.42, m, x, 4.6, z, 16, 12); kit.glow(m, 0.3, 2.2);
    const l = new THREE.PointLight(0xffc878, 0, 18, 1.6); l.position.set(x, 4.6, z); lampG.add(l); kit.glow(l, 0, 12);
    lamps.push([x, z]);
  }, Math.PI / 4 + 0.39);
  // A globe on its stand and scroll piles.
  const globeG = group(scene, -7, 0, 9), scrollG = group(scene);
  cyl(globeG, 0.12, 0.3, 1.6, wood, 0, 0, 0, 8);
  const globeTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2a5a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9c38a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(Math.random() * w, 20 + Math.random() * (h - 40), 10 + Math.random() * 26, 6 + Math.random() * 16, Math.random() * 3, 0, 7); g.fill(); } });
  const globe = sph(globeG, 0.75, new THREE.MeshStandardMaterial({ map: globeTex, roughness: 0.5 }), 0, 2.4, 0, 32, 20);
  const meridian = add(globeG, new THREE.TorusGeometry(0.85, 0.04, 6, 40), gold, 0, 2.4, 0);
  for (let i = 0; i < 9; i++) { const sc = add(scrollG, new THREE.CylinderGeometry(0.16, 0.16, 1.1, 12), parch, 7 + (i % 3) * 0.36, 0.18 + Math.floor(i / 3) * 0.3, 9 + (i % 2) * 0.1); sc.rotation.z = Math.PI / 2; }

  // ---- upgrades: new things added to the library ----
  const tele = group(scene, 15, 0, -9, faceTo(15, -9) + Math.PI); kit.feat('telescope', tele);
  for (let k = 0; k < 3; k++) { const leg = add(tele, new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), gold, Math.cos(k * 2.1) * 0.5, 1.1, Math.sin(k * 2.1) * 0.5); leg.rotation.set(Math.sin(k * 2.1) * 0.25, 0, -Math.cos(k * 2.1) * 0.25); }
  const tube = group(tele, 0, 2.3, 0); tube.rotation.x = -0.7; cyl(tube, 0.18, 0.28, 2.6, std(0x1f3a5a, { metalness: 0.5, roughness: 0.3 }), 0, -0.6, 0, 16); cyl(tube, 0.3, 0.3, 0.12, gold, 0, 1.95, 0, 16);
  const chand = group(scene, 0, 12.5, 0); kit.feat('chandelier', chand);
  add(chand, new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), gold, 0, 1.1, 0);
  add(chand, new THREE.TorusGeometry(2.2, 0.08, 8, 40), gold).rotation.x = Math.PI / 2;
  add(chand, new THREE.TorusGeometry(1.3, 0.06, 8, 32), gold, 0, -0.6, 0).rotation.x = Math.PI / 2;
  const chandFires = []; ring(12, 2.2, (x, z) => chandFires.push(fire(chand, x, 0.05, z, 0.16))); ring(6, 1.3, (x, z) => chandFires.push(fire(chand, x, -0.55, z, 0.14)));
  const chandLight = new THREE.PointLight(0xffc878, 0, 30, 1.4); chand.add(chandLight); kit.glow(chandLight, 4, 24);
  const calli = group(scene); kit.feat('calligraphy', calli);
  const verses = ['وَقُل رَبِّ زِدْنِي عِلْمًا', 'اقْرَأْ بِاسْمِ رَبِّكَ', 'نۤ وَالْقَلَمِ وَمَا يَسْطُرُونَ', 'هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ'];
  verses.forEach((v, i) => { const a = ((i * 2 + 1) / 8) * TAU, r = R - 0.2; const pnl = add(calli, new THREE.PlaneGeometry(9, 1.3), new THREE.MeshStandardMaterial({ map: textTex([v], { w: 1024, h: 150, bg: '#14283c', fg: '#e8c86a', font: '"Amiri", "Traditional Arabic", serif' }), roughness: 0.5 }), Math.sin(a) * r, 11.6, Math.cos(a) * r); pnl.rotation.y = a + Math.PI; });
  const fnt = group(scene, -15, 0, -9); kit.feat('fountain', fnt);
  cyl(fnt, 1.8, 1.9, 0.5, marble, 0, 0, 0, 8); add(fnt, new THREE.CylinderGeometry(1.6, 1.6, 0.05, 8), new THREE.MeshPhysicalMaterial({ color: 0x3a8aa8, roughness: 0.05, clearcoat: 1 }), 0, 0.47, 0);
  cyl(fnt, 0.2, 0.3, 1.2, gold, 0, 0.5, 0, 10); const fjet = add(fnt, new THREE.ConeGeometry(0.12, 0.7, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 }), 0, 2, 0);
  const owlG = group(scene, 9, 0, 15, faceTo(9, 15)); kit.feat('owl', owlG);
  cyl(owlG, 0.08, 0.1, 2.6, wood, 0, 0, 0, 6); const perch = add(owlG, new THREE.CylinderGeometry(0.05, 0.05, 1, 6), wood, 0, 2.6, 0); perch.rotation.z = Math.PI / 2;
  const owl = group(owlG, 0, 2.66, 0); const owlM = std(0x8a6a4a, { roughness: 1 });
  sph(owl, 0.28, owlM, 0, 0.3, 0, 12, 10).scale.set(1, 1.25, 0.9); const owlHead = group(owl, 0, 0.72, 0); sph(owlHead, 0.24, owlM, 0, 0, 0, 12, 10);
  for (const sx of [-0.1, 0.1]) { sph(owlHead, 0.08, std(0xf6e8c0), sx, 0.02, 0.18, 10, 8); sph(owlHead, 0.04, std(0x111111), sx, 0.02, 0.24, 8, 6); add(owlHead, new THREE.ConeGeometry(0.05, 0.14, 4), owlM, sx * 1.5, 0.24, 0); }
  shade(scene);

  // Pages flying in a slow spiral round the sphere, and golden dust.
  const pageM = new THREE.MeshStandardMaterial({ color: 0xf6ead0, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x6a5a30, emissiveIntensity: 0.2 });
  const pagesG = group(scene);
  const pages = Array.from({ length: 34 }, (_, i) => { const m = add(pagesG, new THREE.PlaneGeometry(0.55, 0.75), pageM); return { m, a: rand() * TAU, r: 4 + rand() * 4.5, y: 1.5 + rand() * 9, sp: 0.15 + rand() * 0.2, ph: rand() * 6 }; });
  const dust = particles(scene, { n: 260, color: 0xffd98a, size: 0.09, init: () => ({ x: (rand() - 0.5) * 44, y: rand() * 14, z: (rand() - 0.5) * 44, s: 0.1 + rand() * 0.3 }), step: (d, t, dt) => { d.y += dt * d.s; d.x += Math.sin(t * 0.3 + d.s * 9) * dt * 0.2; if (d.y > 14) d.y = 0; } });

  let spin = 0;
  return {
    spawn: [0, 16, Math.PI], stand: [-16.5, 8.5, faceTo(-16.5, 8.5, 0, 14)], camR: R - 1.5, camY: 16,
    blocked: (x, z) => {
      const r = hyp(x, z);
      if (r > R - 2.6 || r < 2.6) return true;
      for (const [dx, dz] of desks) if (hyp(x - dx, z - dz) < 2.3) return true;
      for (const [lx, lz] of lamps) if (hyp(x - lx, z - lz) < 0.6) return true;
      if (hyp(x + 7, z - 9) < 1.2 || hyp(x - 7.4, z - 9) < 1) return true;
      if (kit.has('telescope') && hyp(x - 15, z + 9) < 1.6) return true;
      if (kit.has('fountain') && hyp(x + 15, z + 9) < 2.2) return true;
      if (kit.has('owl') && hyp(x - 9, z - 15) < 0.7) return true;
      return false;
    },
    tick(t, dt, s) {
      spin += dt * (1 + kit.burstK() * 6);
      rings.forEach((m, i) => { m.rotation.y += dt * (0.12 + i * 0.07) * (i % 2 ? -1 : 1) * (1 + kit.burstK() * 4); m.rotation.x += dt * 0.05 * (i + 1); });
      band.rotation.z = spin * 0.1;
      orb.scale.setScalar(1 + Math.sin(t * 2) * 0.05); orbGlow.material.opacity = 0.6 + Math.sin(t * 2) * 0.15 + s.night * 0.2;
      globe.rotation.y = t * 0.2;
      for (const p of pages) {
        const k = kit.burstK();
        p.a += dt * p.sp * (1 + k * 6); p.y += dt * (0.15 + k * 2); if (p.y > 12) p.y = 1.5;
        const r = p.r + Math.sin(t * 0.5 + p.ph) * 0.6 + k * 2;
        p.m.position.set(Math.cos(p.a) * r, p.y + Math.sin(t + p.ph) * 0.4, Math.sin(p.a) * r);
        p.m.rotation.set(Math.sin(t * 1.3 + p.ph) * 0.8, p.a + t * 0.5, Math.cos(t + p.ph) * 0.6);
      }
      candles.forEach((c) => c.tick(t));
      if (kit.has('chandelier')) chandFires.forEach((c) => c.tick(t));
      if (kit.has('fountain')) fjet.scale.y = 1 + Math.sin(t * 6) * 0.1;
      if (kit.has('owl')) { owlHead.rotation.y = Math.sin(t * 0.4) * 1.2 * (Math.sin(t * 0.13) > 0 ? 1 : 0.2); owl.scale.y = 1 + Math.sin(t * 2) * 0.02; }
      dust.tick(t, dt);
    },
    burst: [0xffe7a8, 0xf6ead0, 0x9fe3ff],
  };
}

// ======================= واحة العافية — body =======================
// A health park: a gym building, a running loop round a green park, strength,
// healthy food, a pool and a health point.
function wellness(scene, kit) {
  const { rand } = kit;
  const R = 38, TR = { cz: 1, rx: 24, rz: 16, w: 3.2 };
  ground(scene, 400, speckle('#5f9a48', ['#4e8a3a', '#6fae58', '#3e7a2e'], { repeat: 70 }));
  const parkTex = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2, px = c / (R + 2);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#56963f' : '#5ea247'; g.fillRect(0, (i * w) / 40, w, w / 40 + 1); }
    g.lineCap = 'round';
    g.strokeStyle = '#b8483a'; g.lineWidth = TR.w * px; g.beginPath(); g.ellipse(c, c + TR.cz * px, TR.rx * px, TR.rz * px, 0, 0, 7); g.stroke();
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 2;
    for (const k of [-0.5, 0.5]) { g.beginPath(); g.ellipse(c, c + TR.cz * px, (TR.rx + k * TR.w * 0.92) * px, (TR.rz + k * TR.w * 0.92) * px, 0, 0, 7); g.stroke(); }
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 3 * px;
    g.beginPath(); g.moveTo(c, w); g.lineTo(c, c - 22 * px); g.stroke();
    g.beginPath(); g.moveTo(c - 30 * px, c); g.lineTo(c + 30 * px, c); g.stroke();
  });
  ground(scene, R + 2, parkTex, { y: 0.03, rough: 0.9 });
  // ---- the gym building ----
  const concrete = std(0xe8e6e0, { roughness: 0.8 }), darkM = std(0x2a2e34, { roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9cc8e0, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.38, clearcoat: 1 });
  const gym = group(scene, 0, 0, -29);
  box(gym, 26, 0.4, 12, concrete, 0, 0, 0);
  box(gym, 26, 9, 0.6, concrete, 0, 0.4, -5.7);
  for (const sx of [-1, 1]) box(gym, 0.6, 9, 12, concrete, sx * 12.7, 0.4, 0);
  box(gym, 27.6, 0.7, 13.4, concrete, 0, 9.4, 0.3);
  box(gym, 26, 0.3, 11.4, std(0x8a8e94), 0, 4.8, -0.3);   // first floor slab
  for (let i = -6; i <= 6; i++) box(gym, 0.14, 9, 0.2, darkM, i * 2, 0.4, 5.9);
  for (const y of [0.4, 4.8, 9.2]) box(gym, 26, 0.2, 0.2, darkM, 0, y, 5.9);
  add(gym, new THREE.PlaneGeometry(25.4, 8.8), glass, 0, 4.8, 5.95);
  const lightM = lampMat(0xf4fbff); kit.glow(lightM, 0.6, 2.2);
  for (const y of [4.5, 8.9]) for (let i = -5; i <= 5; i += 2) box(gym, 1.6, 0.08, 0.6, lightM, i * 2, y, 0);
  // treadmills on the ground floor, bikes and racks upstairs
  for (let i = -5; i <= 5; i++) { if (Math.abs(i) < 1) continue; const tm = group(gym, i * 2, 0.4, 2.5); box(tm, 0.9, 0.3, 2, darkM, 0, 0, 0); box(tm, 0.7, 0.04, 1.7, std(0x111111), 0, 0.3, 0); for (const sx of [-0.4, 0.4]) box(tm, 0.06, 1.2, 0.06, darkM, sx, 0.3, -0.8); box(tm, 0.9, 0.3, 0.2, std(0x4aa8ff, { emissive: 0x2a88ff, emissiveIntensity: 0.6 }), 0, 1.4, -0.85); }
  for (let i = -5; i <= 5; i += 2) { const bk = group(gym, i * 2, 5.1, 2); box(bk, 0.3, 0.9, 1.2, std(0xc0392b), 0, 0, 0); sph(bk, 0.35, std(0x222222), 0, 0.4, 0.5, 10, 8); }
  const doors = box(gym, 4, 3.6, 0.1, glass, 0, 0.4, 6.1);
  const sign = add(gym, new THREE.PlaneGeometry(12, 1.8), new THREE.MeshStandardMaterial({ map: textTex(['صالة العافية'], { w: 768, h: 128, bg: '#1e3a2a', fg: '#9fffb0' }), emissive: 0xffffff, emissiveIntensity: 0.1 }), 0, 10.8, 7); 
  const signM = sign.material; signM.emissiveMap = signM.map; kit.glow(signM, 0.15, 1.2);
  box(gym, 6, 0.3, 3, concrete, 0, 3.8, 7.5);   // canopy over the door
  // ---- park: trees, benches, drinking fountain, calisthenics ----
  const trunk = std(0x6a4a2a), leafM = std(0x3f8a3a, { flatShading: true });
  const trees = [];
  ring(18, R - 3, (x, z, a, i) => { if (z < -18 || (Math.abs(x) < 6 && z > 20)) return; const g = group(scene, x, 0, z); cyl(g, 0.25, 0.35, 3, trunk, 0, 0, 0, 7); const c = add(g, new THREE.IcosahedronGeometry(2 + rand(), 1), leafM, 0, 4.4, 0); trees.push([x, z]); }, 0.1);
  [[-8, 4], [8, 4], [-8, -4], [8, -4]].forEach(([x, z]) => { const t2 = group(scene, x, 0, z); cyl(t2, 0.2, 0.3, 2.6, trunk, 0, 0, 0, 7); add(t2, new THREE.IcosahedronGeometry(1.8, 1), leafM, 0, 3.6, 0); trees.push([x, z]); });
  const benchM = std(0x8a5a34);
  [[-4, 12, 0], [4, 12, 0], [-14, 18, 0.6], [14, 18, -0.6]].forEach(([x, z, r]) => { const b = group(scene, x, 0, z, r); box(b, 2.2, 0.12, 0.6, benchM, 0, 0.5, 0); box(b, 2.2, 0.5, 0.1, benchM, 0, 0.6, -0.3); for (const sx of [-0.9, 0.9]) box(b, 0.1, 0.5, 0.5, darkM, sx, 0, 0); });
  const drink = group(scene, 3, 0, 20); cyl(drink, 0.3, 0.35, 1, std(0x9aa2aa, { metalness: 0.7 }), 0, 0, 0, 12); cyl(drink, 0.35, 0.3, 0.12, std(0x9aa2aa, { metalness: 0.7 }), 0, 1, 0, 12);
  const steel = std(0x9aa2aa, { metalness: 0.9, roughness: 0.3 }), black = std(0x1e1e1e, { roughness: 0.6 }), red = std(0xc0392b, { roughness: 0.5 });
  const cali = group(scene, -3, 0, -8);
  for (const sx of [-2, 0, 2]) cyl(cali, 0.08, 0.08, 3.4, steel, sx, 0, -1, 8);
  const bar = add(cali, new THREE.CylinderGeometry(0.05, 0.05, 4.2, 8), steel, 0, 3.3, -1); bar.rotation.z = Math.PI / 2;
  for (const sz of [0.4, 1.2]) { const pb = add(cali, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), steel, 2.8, 1.2, sz); pb.rotation.x = Math.PI / 2; for (const zz of [-1.1, 1.1]) cyl(cali, 0.06, 0.06, 1.2, steel, 2.8, 0, sz + zz, 6); }
  // ---- upgrades ----
  // strength zone
  const strength = group(scene, 9, 0, -9); kit.feat('weights', strength);
  const deck = box(strength, 9, 0.12, 6, std(0x2a2a2a, { roughness: 0.9 }), 0, 0, 0);
  const bench = group(strength, -2.5, 0.12, 0); box(bench, 0.8, 0.8, 2.6, red, 0, 0, 0); for (const sx of [-0.8, 0.8]) box(bench, 0.12, 2.2, 0.12, steel, sx, 0, -1.1);
  const bb = add(bench, new THREE.CylinderGeometry(0.05, 0.05, 3, 8), steel, 0, 2.1, -1.1); bb.rotation.z = Math.PI / 2;
  for (const sx of [-1.2, 1.2]) { const pl = add(bench, new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20), black, sx, 2.1, -1.1); pl.rotation.z = Math.PI / 2; }
  const rack = group(strength, 1.5, 0.12, -2.2); box(rack, 4, 0.8, 0.9, steel, 0, 0, 0);
  for (let i = 0; i < 6; i++) { const db = group(rack, -1.6 + i * 0.64, 0.95, 0); const h = add(db, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), steel); h.rotation.x = Math.PI / 2; for (const s2 of [-0.25, 0.25]) { const w2 = add(db, new THREE.CylinderGeometry(0.1 + i * 0.015, 0.1 + i * 0.015, 0.12, 12), black, 0, 0, s2); w2.rotation.x = Math.PI / 2; } }
  for (let i = 0; i < 4; i++) { const kb = group(strength, 0.5 + i * 0.8, 0.12, 1.8); sph(kb, 0.22 + i * 0.03, black, 0, 0.25, 0, 12, 10); const hd = add(kb, new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), black, 0, 0.5, 0); }
  for (let i = 0; i < 3; i++) { const ty = add(strength, new THREE.TorusGeometry(0.6, 0.25, 10, 24), black, 3.6, 0.37 + i * 0.48, 1.4); ty.rotation.x = Math.PI / 2; }
  const bagFrame = group(strength, 3.6, 0.12, -1.2); cyl(bagFrame, 0.1, 0.12, 4.6, black, -1.2, 0, 0, 8); box(bagFrame, 1.6, 0.14, 0.14, black, -0.5, 4.5, 0);
  const bagPivot = group(bagFrame, 0, 4.5, 0); add(bagPivot, new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), steel, 0, -0.3, 0); add(bagPivot, new THREE.CapsuleGeometry(0.42, 1.4, 4, 14), red, 0, -1.7, 0);
  // joggers on the loop
  const runG = group(scene); kit.feat('runners', runG);
  const sport = [{ robe: '#2a6ad0', accent: '#ffffff', skin: '#f0cfae', glow: '#9fc8ff' }, { robe: '#e86a2a', accent: '#222222', skin: '#d9ad85', glow: '#ffc08a' }, { robe: '#2aa86a', accent: '#ffffff', skin: '#e9c29e', glow: '#9fffc0' }, { robe: '#444a55', accent: '#f0c020', skin: '#c99a72', glow: '#ffe08a' }];
  const runners = sport.map((pal, i) => { const p = buildWorshipper(pal); runG.add(p.root); return { p, a: (i / 4) * TAU, sp: 0.16 + i * 0.025, lane: (i % 2 ? 0.7 : -0.7) }; });
  // healthy food kiosk
  const food = group(scene, 27, 0, 12, faceTo(27, 12)); kit.feat('food', food);
  box(food, 6, 1.1, 1.6, std(0xf4f0e6), 0, 0, 0);
  for (const sx of [-2.8, 2.8]) cyl(food, 0.1, 0.1, 3.4, std(0xe8e8e8), sx, 0, -0.6, 8);
  const awn = add(food, new THREE.PlaneGeometry(6.6, 2.6), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g) => { for (let s2 = 0; s2 < 8; s2++) { g.fillStyle = s2 % 2 ? '#f4f0e6' : '#3a9a4a'; g.fillRect(s2 * 16, 0, 16, 64); } }), side: THREE.DoubleSide }), 0, 3.4, 0); awn.rotation.x = -Math.PI / 2 + 0.25;
  add(food, new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshStandardMaterial({ map: textTex(['🥗 غذاء صحي'], { w: 512, h: 96, bg: '#2a6a3a', fg: '#fff' }) }), 0, 3.75, 1.2);
  const fruitCols = [0xd02a1a, 0xf0a020, 0x7ac040, 0xf0e040, 0xa02a6a];
  for (let k = 0; k < 4; k++) { const cr = group(food, -2.1 + k * 1.4, 1.1, 0.2); box(cr, 1.1, 0.35, 0.8, std(0xb08a5a), 0, 0, 0); for (let f = 0; f < 8; f++) sph(cr, 0.13, std(fruitCols[k]), -0.38 + (f % 4) * 0.25, 0.42, (f < 4 ? -0.18 : 0.18), 10, 8); }
  for (let k = 0; k < 6; k++) cyl(food, 0.07, 0.07, 0.35, std([0xf08a20, 0x7ac040, 0xd02a6a][k % 3], { transparent: true, opacity: 0.85 }), -1.8 + k * 0.7, 1.1, 0.7, 8);
  const cooler = group(food, 3.8, 0, 0.5); box(cooler, 0.7, 1.4, 0.7, std(0xe8e8e8), 0, 0, 0); cyl(cooler, 0.3, 0.3, 0.9, new THREE.MeshPhysicalMaterial({ color: 0x8ac8f0, transparent: true, opacity: 0.6 }), 0, 1.4, 0, 14);
  for (const [tx, tz] of [[-2, 3.4], [2, 3.4]]) { const tb = group(food, tx, 0, tz); cyl(tb, 0.6, 0.6, 0.06, std(0xf4f0e6), 0, 1, 0, 16); cyl(tb, 0.06, 0.06, 1, darkM, 0, 0, 0, 6); for (const a2 of [0, Math.PI]) cyl(tb, 0.25, 0.25, 0.6, std(0x3a9a4a), Math.cos(a2) * 0.9, 0, Math.sin(a2) * 0.9, 12); }
  // pool
  const pool = group(scene, -30, 0, 5); kit.feat('pool', pool);
  box(pool, 7.6, 0.25, 16, std(0xf0ece4), 0, 0, 0);
  const poolW = add(pool, new THREE.BoxGeometry(6, 0.05, 14), new THREE.MeshPhysicalMaterial({ color: 0x2ab0d8, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.88 }), 0, 0.25, 0);
  for (let k = -1; k <= 1; k++) { const ln = add(pool, new THREE.CylinderGeometry(0.06, 0.06, 14, 6), std(k ? 0xf0e040 : 0xd02a2a), k * 1.5, 0.3, 0); ln.rotation.x = Math.PI / 2; }
  for (const sx of [-1, 1]) { const lad = group(pool, sx * 2, 0.25, 7.2); for (const s2 of [-0.25, 0.25]) { const h = add(lad, new THREE.TorusGeometry(0.35, 0.03, 6, 12, Math.PI), steel, s2, 0.35, 0); h.rotation.y = Math.PI / 2; } }
  // health point
  const clinic = group(scene, 24, 0, -17, faceTo(24, -17)); kit.feat('clinic', clinic);
  box(clinic, 7, 4, 5, std(0xf6f6f2), 0, 0, 0); box(clinic, 7.4, 0.4, 5.4, std(0xdadad4), 0, 4, 0);
  const crossM = lampMat(0x2ac05a); kit.glow(crossM, 0.6, 2.5);
  const cross = group(clinic, 0, 4.9, 2.4); box(cross, 1.6, 0.5, 0.2, crossM, 0, 0.55, 0); box(cross, 0.5, 1.6, 0.2, crossM, 0, 0, 0);
  const ecgTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#0a1a14'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3aff7a'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x < w; x += 2) { const k = x % 128; const y = k > 50 && k < 58 ? h / 2 - 40 : k > 58 && k < 64 ? h / 2 + 30 : h / 2 + Math.sin(x * 0.05) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  ecgTex.wrapS = THREE.RepeatWrapping;
  const ecg = add(clinic, new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: ecgTex }), 0, 2.9, 2.52);
  box(clinic, 1.6, 2.4, 0.1, std(0x6aa8c8), -2, 0, 2.52);
  const scaleG = group(clinic, 2.2, 0, 3.4); box(scaleG, 0.6, 0.1, 0.6, steel, 0, 0, 0); box(scaleG, 0.08, 1.4, 0.08, steel, 0, 0.1, -0.25); box(scaleG, 0.4, 0.3, 0.1, std(0x222222), 0, 1.5, -0.25);
  shade(scene);

  const elx = (a, k = 0) => Math.cos(a) * (TR.rx + k), elz = (a, k = 0) => TR.cz + Math.sin(a) * (TR.rz + k);
  return {
    spawn: [0, 28, Math.PI], stand: [-11, 24, faceTo(-11, 24, 0, 28)], camR: R, camY: 22,
    blocked: (x, z) => {
      if (hyp(x, z) > R - 1) return true;
      if (Math.abs(x) < 13.4 && z < -22.6) return true;                              // gym
      for (const [tx, tz] of trees) if (hyp(x - tx, z - tz) < 0.8) return true;
      if (Math.abs(x + 3) < 3 && Math.abs(z + 9) < 0.6) return true;                    // pull-up bars
      if (Math.abs(x + 0.2) < 0.5 && Math.abs(z + 8.2) < 1.8) return true;              // parallel bars
      if (kit.has('weights') && Math.abs(x - 9) < 4.6 && Math.abs(z + 9) < 3.1) return true;
      if (kit.has('food') && hyp(x - 27, z - 12) < 4.2) return true;
      if (kit.has('pool') && Math.abs(x + 30) < 3.9 && Math.abs(z - 5) < 8.1) return true;
      if (kit.has('clinic') && hyp(x - 24, z + 17) < 4.6) return true;
      return false;
    },
    tick(t, dt, s) {
      bagPivot.rotation.z = Math.sin(t * 1.6) * 0.18; bagPivot.rotation.x = Math.cos(t * 1.3) * 0.08;
      if (kit.has('runners')) runners.forEach((r) => {
        r.a += dt * r.sp * (1 + kit.burstK());
        const x = elx(r.a, r.lane), z = elz(r.a, r.lane), x2 = elx(r.a + 0.01, r.lane), z2 = elz(r.a + 0.01, r.lane);
        r.p.root.position.set(x, 0, z); r.p.root.rotation.y = Math.atan2(x2 - x, z2 - z);
        r.p.update(t, dt, 1, false);
      });
      ecgTex.offset.x = (t * 0.25) % 1;
      poolW.material.color.setHSL(0.54, 0.7, 0.5 - s.night * 0.25);
    },
    burst: [0x3aff7a, 0xffffff, 0xf0e040],
  };
}

// ======================= حديقة السكينة — heart =======================
function heartGarden(scene, kit) {
  const { rand } = kit;
  const R = 32;
  ground(scene, 400, speckle('#86c070', ['#76b060', '#96d080', '#f0e08a', '#ffffff'], { repeat: 50, n: 3200 }));
  // The pond.
  const PZ = -6, PS = 1.4;
  const sh = new THREE.Shape();
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, r = 4.2 + Math.sin(a * 3) * 0.45 + Math.cos(a * 2) * 0.35, x = Math.cos(a) * r * 1.3, y = Math.sin(a) * r * 0.95; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  const pondPts = sh.getSpacedPoints(80).map((p) => new THREE.Vector2(p.x * PS, -p.y * PS + PZ));
  const inPond = (x, z) => { let c = false; for (let i = 0, j = pondPts.length - 1; i < pondPts.length; j = i++) { const a = pondPts[i], b = pondPts[j]; if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  const bed = add(scene, new THREE.ShapeGeometry(sh, 40), std(0x2a5a5a, { roughness: 1 }), 0, 0.02, PZ); bed.rotation.x = -Math.PI / 2; bed.scale.setScalar(PS * 1.04);
  const waterM = new THREE.MeshPhysicalMaterial({ color: 0x6fc0d0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.82, clearcoat: 1 });
  const water = add(scene, new THREE.ShapeGeometry(sh, 40), waterM, 0, 0.28, PZ); water.rotation.x = -Math.PI / 2; water.scale.setScalar(PS);
  const stoneM = std(0x9a9a92, { roughness: 1, flatShading: true });
  pondPts.forEach((p, i) => { if (i % 2) return; const s = add(scene, new THREE.DodecahedronGeometry(0.45 + rand() * 0.25, 0), stoneM, p.x, 0.2, p.y); s.scale.y = 0.55; s.rotation.y = rand() * 6; });
  // lily pads + lotus
  for (let i = 0; i < 14; i++) {
    let x, z; do { x = (rand() - 0.5) * 12; z = PZ + (rand() - 0.5) * 9; } while (!inPond(x, z) || Math.abs(z - PZ) < 1.3);
    const pad = add(scene, new THREE.CircleGeometry(0.45 + rand() * 0.25, 16, 0.3, TAU - 0.4), std(0x3f8a3a, { side: THREE.DoubleSide }), x, 0.31, z); pad.rotation.x = -Math.PI / 2; pad.rotation.z = rand() * 6;
    if (i % 3 === 0) for (let k = 0; k < 6; k++) { const pe = add(scene, new THREE.SphereGeometry(0.16, 8, 6), std(0xfaf6ea, { emissive: 0xfff0c0, emissiveIntensity: 0.1 }), x + Math.cos(k) * 0.12, 0.42, z + Math.sin(k) * 0.12); pe.scale.set(0.6, 1.3, 0.6); pe.rotation.z = 0.5; }
  }
  // koi
  const koi = Array.from({ length: 8 }, (_, i) => {
    const g = group(scene, 0, 0.2, PZ);
    const body = add(g, new THREE.SphereGeometry(0.22, 12, 8), std(i % 3 ? 0xff7a2a : 0xffffff, { roughness: 0.4 })); body.scale.set(0.7, 0.5, 1.8);
    if (i % 2) { const spot = add(g, new THREE.SphereGeometry(0.12, 8, 6), std(0xd02a1a), 0, 0.06, 0.1); spot.scale.set(0.9, 0.5, 1.4); }
    const tail = add(g, new THREE.ConeGeometry(0.16, 0.36, 6), std(0xff9a5a, { transparent: true, opacity: 0.85 }), 0, 0, -0.5); tail.rotation.x = -Math.PI / 2; tail.scale.x = 0.3;
    return { g, tail, a: rand() * TAU, r: 1.4 + rand() * 3, sp: (0.25 + rand() * 0.3) * (i % 2 ? 1 : -1), cy: (rand() - 0.5) * 2 };
  });
  // Red arched bridge across the pond (walkable).
  const BR = { z: PZ + 0.4, hw: 1.15, len: 8.2, h: 1.25 };
  const bridgeY = (x) => (Math.abs(x) > BR.len ? 0 : BR.h * Math.cos((x / BR.len) * Math.PI / 2) ** 1.2);
  const redM = std(0xc8282a, { roughness: 0.55 }), deckM = std(0x8a5a34, { roughness: 0.8 });
  for (let i = -16; i <= 16; i++) { const x = (i / 16) * BR.len; const y = bridgeY(x); box(scene, BR.len / 16 + 0.04, 0.12, BR.hw * 2, deckM, x, y + 0.02, BR.z); }
  for (const sz of [-1, 1]) {
    const pts = []; for (let i = -16; i <= 16; i++) { const x = (i / 16) * BR.len; pts.push(new THREE.Vector3(x, bridgeY(x) + 1.05, BR.z + sz * BR.hw)); }
    add(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 6), redM);
    for (let i = -16; i <= 16; i += 4) { const x = (i / 16) * BR.len; cyl(scene, 0.07, 0.07, 1.05, redM, x, bridgeY(x), BR.z + sz * BR.hw, 6); sph(scene, 0.11, std(0xd4a53a, { metalness: 0.8 }), x, bridgeY(x) + 1.12, BR.z + sz * BR.hw, 10, 8); }
  }
  // A red torii gate on the path, a pavilion, stone lanterns, raked sand with rocks.
  const torii = group(scene, 0, 0, 13);
  for (const sx of [-2.4, 2.4]) cyl(torii, 0.28, 0.32, 5.6, redM, sx, 0, 0, 14);
  box(torii, 6.6, 0.4, 0.6, redM, 0, 4.6, 0); const top = box(torii, 7.8, 0.45, 0.8, std(0x1e1e1e), 0, 5.5, 0); top.scale.y = 1;
  const pav = group(scene, 14, 0, -2, -Math.PI / 2);
  cyl(pav, 3.4, 3.6, 0.4, std(0xb8a888), 0, 0, 0, 6);
  ring(6, 3, (x, z) => cyl(pav, 0.15, 0.15, 3.6, redM, x, 0.4, z, 8));
  const roof = add(pav, new THREE.ConeGeometry(4.6, 1.8, 6, 1, true), std(0x2a3a3a, { side: THREE.DoubleSide, roughness: 0.6 }), 0, 4.9, 0);
  sph(pav, 0.25, std(0xd4a53a, { metalness: 0.8 }), 0, 5.9, 0, 12, 8);
  box(pav, 2, 0.3, 1.4, std(0x6a2a2a), 0, 0.4, 0);
  const lanterns = [];
  [[-6, 8], [6, 8], [-10, -1], [9, 3], [-5, -14], [6, -14]].forEach(([x, z], i) => {
    const g = group(scene, x, 0, z);
    cyl(g, 0.45, 0.55, 0.3, stoneM); cyl(g, 0.16, 0.2, 1.2, stoneM, 0, 0.3, 0, 8); box(g, 0.9, 0.2, 0.9, stoneM, 0, 1.5, 0);
    const m = lampMat(0xffd0a0); box(g, 0.6, 0.6, 0.6, m, 0, 1.7, 0); kit.glow(m, 0.15, 2.4);
    const rf = add(g, new THREE.ConeGeometry(0.8, 0.6, 4), stoneM, 0, 2.6, 0); rf.rotation.y = Math.PI / 4;
    if (i % 2 === 0) { const l = new THREE.PointLight(0xffb890, 0, 12, 1.8); l.position.set(x, 2, z); scene.add(l); kit.glow(l, 0, 9); }
    lanterns.push([x, z]);
  });
  const sandTex = canvasTex(512, 512, (g, w) => { g.fillStyle = '#e8dcc2'; g.fillRect(0, 0, w, w); g.strokeStyle = '#c9b996'; g.lineWidth = 3; for (let r = 20; r < 360; r += 16) { g.beginPath(); g.arc(w * 0.5, w * 0.5, r, 0, 7); g.stroke(); } });
  const zen = add(scene, new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), -14, 0.04, 6); zen.rotation.x = -Math.PI / 2;
  [[-14, 6, 1.1], [-12.3, 7.6, 0.6], [-15.6, 4.6, 0.7]].forEach(([x, z, s]) => { const r = add(scene, new THREE.DodecahedronGeometry(s, 1), std(0x6a6a66, { flatShading: true }), x, s * 0.4, z); r.scale.y = 0.7; });
  // Stepping stones to the pond.
  for (let i = 0; i < 6; i++) { const s = add(scene, new THREE.CylinderGeometry(0.6, 0.65, 0.12, 10), std(0xb0aaa0), (i % 2 ? 0.5 : -0.5), 0.06, 11 - i * 1.4); }
  // Leafy garden trees all round.
  const trunkM = std(0x5a3a2a, { roughness: 1 });
  const blossom = [std(0x5f9a48, { flatShading: true, roughness: 0.9 }), std(0x4f8a3a, { flatShading: true, roughness: 0.9 }), std(0x7aaa58, { flatShading: true, roughness: 0.9 })];
  const trees = [];
  const tree = (x, z, s) => {
    const g = group(scene, x, 0, z, rand() * 6); g.scale.setScalar(s);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, 1.6, 0.2), new THREE.Vector3(-0.2, 3, 0), new THREE.Vector3(0.3, 4.2, -0.2)]);
    add(g, new THREE.TubeGeometry(curve, 12, 0.32, 8), trunkM);
    for (let k = 0; k < 7; k++) { const b = add(g, new THREE.IcosahedronGeometry(1.2 + rand() * 0.8, 1), blossom[k % 3], (rand() - 0.5) * 3.2, 4 + rand() * 1.8, (rand() - 0.5) * 3.2); b.scale.y = 0.75; }
    trees.push([x, z, 0.9 * s]);
  };
  [[-9, -12], [9, -13], [-16, -6], [17, -10], [-18, 12], [16, 14], [-7, 19], [8, 20], [0, -20], [-22, 2], [22, 4]].forEach(([x, z]) => tree(x, z, 1 + rand() * 0.4));
  // A bamboo fence at the edge.
  const bambooM = std(0x8aa04a, { roughness: 0.7 });
  for (let i = 0; i < 220; i++) { const a = (i / 220) * TAU, r = R + rand() * 0.6; cyl(scene, 0.09, 0.1, 3 + rand() * 1.4, bambooM, Math.cos(a) * r, 0, Math.sin(a) * r, 6); }
  for (const y of [1, 2.4]) { const rl = add(scene, new THREE.TorusGeometry(R + 0.3, 0.06, 4, 128), std(0x6a4a2a), 0, y, 0); rl.rotation.x = Math.PI / 2; }

  // ---- upgrades: new things added to the garden ----
  // a sabil: free water for anyone who passes
  const sabil = group(scene, -21, 0, -8, Math.PI / 2 - 0.3); kit.feat('sabil', sabil);
  box(sabil, 3.2, 3.4, 1.4, stoneM, 0, 0, -0.5);
  add(sabil, new THREE.TorusGeometry(0.8, 0.12, 8, 24, Math.PI), std(0xa8783a, { metalness: 0.8, roughness: 0.35 }), 0, 2, 0.22);
  box(sabil, 2.4, 0.5, 1, std(0x7a7468), 0, 0, 0.6);
  add(sabil, new THREE.BoxGeometry(2.2, 0.05, 0.8), new THREE.MeshPhysicalMaterial({ color: 0x5a9aa0, roughness: 0.05, clearcoat: 1 }), 0, 0.5, 0.6);
  const spout = add(sabil, new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), new THREE.MeshBasicMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.7 }), 0, 1.15, 0.45);
  // an ancient olive tree
  const olive = group(scene, 13, 0, 9); kit.feat('olive', olive);
  for (let k = 0; k < 4; k++) { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3((rand() - 0.5) * 1.6, 1.6, (rand() - 0.5) * 1.6), new THREE.Vector3((rand() - 0.5) * 2.6, 3.2, (rand() - 0.5) * 2.6), new THREE.Vector3((rand() - 0.5) * 3.4, 4.4, (rand() - 0.5) * 3.4)]); add(olive, new THREE.TubeGeometry(c, 14, 0.45 - k * 0.08, 8), std(0x5a4a3a, { roughness: 1 })); }
  for (let k = 0; k < 12; k++) { const b = add(olive, new THREE.IcosahedronGeometry(1.1 + rand() * 0.7, 1), std([0x7a8a5a, 0x8a9a6a, 0x6a7a4a][k % 3], { flatShading: true }), (rand() - 0.5) * 5, 4.2 + rand() * 1.8, (rand() - 0.5) * 5); b.scale.y = 0.6; }
  // doves and a dovecote
  const doveG = group(scene); kit.feat('doves', doveG);
  const cote = group(doveG, -15, 0, 14); cyl(cote, 0.12, 0.15, 3.6, std(0x5a3a22), 0, 0, 0, 8); box(cote, 1.4, 1, 1.4, std(0xf0ece0), 0, 3.6, 0); const cr = add(cote, new THREE.ConeGeometry(1.2, 0.8, 4), std(0x8a4a2a), 0, 5, 0); cr.rotation.y = Math.PI / 4;
  const doveM = std(0xf8f8f4, { side: THREE.DoubleSide });
  const doves = Array.from({ length: 7 }, (_, i) => { const g = group(doveG); add(g, new THREE.SphereGeometry(0.16, 8, 6), doveM).scale.set(0.8, 0.7, 1.6); const w = [-1, 1].map((sx) => add(g, new THREE.PlaneGeometry(0.5, 0.18), doveM, sx * 0.25, 0.05, 0)); return { g, w, ph: i * 0.9, r: 5 + (i % 3) * 2 }; });
  // an old stone well with a bucket
  const well = group(scene, 20, 0, -4); kit.feat('well', well);
  cyl(well, 1.3, 1.4, 1.1, stoneM, 0, 0, 0, 16); cyl(well, 1.05, 1.05, 0.05, std(0x1a3a4a), 0, 1, 0, 16);
  for (const sx of [-1.1, 1.1]) box(well, 0.16, 2.8, 0.16, std(0x5a3a22), sx, 0.6, 0);
  const wroof = add(well, new THREE.ConeGeometry(1.7, 1, 4), std(0x4a3a2a), 0, 3.9, 0); wroof.rotation.y = Math.PI / 4;
  const bucket = group(well, 0, 2.4, 0); add(bucket, new THREE.CylinderGeometry(0.01, 0.01, 0.9, 3), std(0x8a7a5a), 0, 0.45, 0); cyl(bucket, 0.22, 0.17, 0.35, std(0x7a5a3a), 0, -0.2, 0, 10);
  // a reflection bench by the water
  const bench = group(scene, -6, 0, 1.5, 0.3); kit.feat('bench', bench);
  box(bench, 3, 0.15, 0.8, std(0x6a4a30), 0, 0.55, 0); box(bench, 3, 0.7, 0.12, std(0x6a4a30), 0, 0.65, -0.35); for (const sx of [-1.3, 1.3]) box(bench, 0.2, 0.55, 0.7, stoneM, sx, 0, 0);
  shade(scene);

  // Falling leaves and, at night, fireflies.
  const petals = particles(scene, { n: 300, color: 0xa8c060, size: 0.2, additive: false, opacity: 0.95,
    init: () => ({ x: (rand() - 0.5) * 50, y: rand() * 9, z: (rand() - 0.5) * 50, s: 0.3 + rand() * 0.5, ph: rand() * 6 }),
    step: (d, t, dt) => { d.y -= dt * d.s * (1 + kit.burstK() * 3); d.x += (Math.sin(t * 0.8 + d.ph) * 0.6 + 0.4) * dt; d.z += Math.cos(t * 0.6 + d.ph) * 0.3 * dt; if (d.y < 0.05) { d.y = 7 + rand() * 3; d.x = (rand() - 0.5) * 50; d.z = (rand() - 0.5) * 50; } } });
  const flies = particles(scene, { n: 140, color: 0xd8ff8a, size: 0.25, opacity: 0,
    init: () => ({ x: (rand() - 0.5) * 50, y: 0.5 + rand() * 3, z: (rand() - 0.5) * 50, ph: rand() * 6, bx: 0, bz: 0 }),
    step: (d, t, dt) => { d.x += Math.sin(t * 0.7 + d.ph) * dt * 0.6; d.z += Math.cos(t * 0.5 + d.ph * 2) * dt * 0.6; d.y = 0.8 + Math.sin(t * 0.9 + d.ph) * 0.8 + 1; } });

  return {
    spawn: [0, 17, Math.PI], stand: [-11.5, -9, faceTo(-11.5, -9, 0, 14)], camR: R - 1, camY: 20,
    groundAt: (x, z) => (Math.abs(z - BR.z) < BR.hw && Math.abs(x) < BR.len ? bridgeY(x) + 0.08 : 0),
    blocked: (x, z) => {
      if (hyp(x, z) > R - 1.4) return true;
      const onBridge = Math.abs(z - BR.z) < BR.hw - 0.2 && Math.abs(x) < BR.len;
      if (inPond(x, z) && !onBridge) return true;
      if (Math.abs(z - BR.z) < BR.hw + 0.25 && Math.abs(z - BR.z) > BR.hw - 0.2 && Math.abs(x) < BR.len - 0.3) return true;   // bridge railings
      for (const [tx, tz, r] of trees) if (hyp(x - tx, z - tz) < r) return true;
      for (const [lx, lz] of lanterns) if (hyp(x - lx, z - lz) < 0.9) return true;
      if (hyp(x - 14, z + 2) < 3.9 && hyp(x - 14, z + 2) > 2.4) { const a = Math.atan2(z + 2, x - 14); if (Math.abs(Math.sin(a * 3)) < 0.35) return true; }   // pavilion posts
      for (const sx of [-2.4, 2.4]) if (hyp(x - sx, z - 13) < 0.6) return true;
      if (kit.has('sabil') && hyp(x + 21, z + 8) < 2) return true;
      if (kit.has('olive') && hyp(x - 13, z - 9) < 1.2) return true;
      if (kit.has('doves') && hyp(x + 15, z - 14) < 0.6) return true;
      if (kit.has('well') && hyp(x - 20, z + 4) < 1.8) return true;
      if (kit.has('bench') && hyp(x + 6, z - 1.5) < 1.6) return true;
      return false;
    },
    tick(t, dt, s) {
      koi.forEach((k) => { k.a += dt * k.sp; const x = Math.cos(k.a) * k.r, z = PZ + Math.sin(k.a) * k.r * 0.75 + k.cy; k.g.position.set(x, 0.18, z); k.g.rotation.y = Math.atan2(-Math.sin(k.a) * k.sp, Math.cos(k.a) * k.sp * 0.75); k.tail.rotation.y = Math.sin(t * 8 + k.r) * 0.5; });
      waterM.color.setHSL(0.52, 0.45, 0.6 - s.night * 0.35);
      petals.tick(t, dt); flies.tick(t, dt); flies.mat.opacity = s.night * 0.95;
      if (kit.has('sabil')) spout.scale.x = 1 + Math.sin(t * 20) * 0.15;
      if (kit.has('doves')) doves.forEach((d) => { const an = t * 0.35 + d.ph; d.g.position.set(-15 + Math.cos(an) * d.r, 6 + Math.sin(t * 0.8 + d.ph) * 1.2, 14 + Math.sin(an) * d.r * 0.8); d.g.rotation.y = -an; const f = Math.sin(t * 9 + d.ph) * 0.7; d.w[0].rotation.z = f; d.w[1].rotation.z = -f; });
      if (kit.has('well')) bucket.position.y = 2.4 + Math.sin(t * 0.5) * 0.3;
    },
    burst: [0xe8c070, 0xfff0c0, 0xb8d890],
  };
}

// ======================= ساحة اللمّة — social =======================
function village(scene, kit) {
  const { rand } = kit;
  const R = 27;
  ground(scene, 400, speckle('#b89a6a', ['#a88a5a', '#c8aa7a', '#9a7a4a'], { repeat: 60 }));
  const cobble = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#6a5a48'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32) { const v = 120 + Math.random() * 50; g.fillStyle = `rgb(${v + 30},${v + 14},${v - 10})`; g.beginPath(); g.roundRect(x + 2, y + 2, 28, 28, 9); g.fill(); }
  }, 14);
  ground(scene, R + 6, cobble, { y: 0.02, rough: 0.85 });
  // Houses round the square: plastered walls, flat roofs with parapets, domes, glowing windows.
  const plasters = [0xe8d4b0, 0xdcc49a, 0xf0e0c4, 0xd8b890, 0xe4caa4];
  const winM = lampMat(0xffc670, { roughness: 0.3 }); kit.glow(winM, 0.05, 2.2);
  const doorM = std(0x5a3a22, { roughness: 0.6 }), trimM = std(0x2f6f7a, { roughness: 0.5 });
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.15;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;   // a lane behind the player's start
    const r = R + 5 + rand() * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 6 + rand() * 3, h = 5 + rand() * 4, d = 6;
    const hs = group(scene, x, 0, z, faceTo(x, z));
    box(hs, w, h, d, std(plasters[i % plasters.length], { roughness: 0.95 }), 0, 0, 0);
    box(hs, w + 0.3, 0.6, d + 0.3, std(0xcfb48a), 0, h, 0);
    box(hs, 1.6, 2.6, 0.2, doorM, (rand() - 0.5) * (w - 3), 0, d / 2 + 0.05);
    for (let k = 0; k < 3; k++) { const wx = -w / 2 + 1.2 + k * ((w - 2.4) / 2); box(hs, 0.9, 1.1, 0.12, winM, wx, h * 0.62, d / 2 + 0.06); box(hs, 1.1, 0.12, 0.3, trimM, wx, h * 0.62 + 1.1, d / 2 + 0.1); }
    if (i % 3 === 0) { const dm = add(hs, new THREE.SphereGeometry(1.8, 20, 12, 0, TAU, 0, Math.PI / 2), std(0xf4ece0)); dm.position.set(0, h + 0.6, 0); }
    if (i % 4 === 1) { box(hs, 1, 3, 1, std(plasters[(i + 2) % 5]), w / 2 - 0.8, h, -d / 2 + 0.8); }
    // a striped awning over some doors
    if (i % 2) { const aw = add(hs, new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshStandardMaterial({ map: canvasTex(64, 32, (g) => { for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? '#f4ead2' : '#c0392b'; g.fillRect(s * 8, 0, 8, 32); } }), side: THREE.DoubleSide }), 0, 3.2, d / 2 + 0.7); aw.rotation.x = -1.0; }
  }
  // The bonfire in the middle with sparks; a ring of cushions and low tables round it.
  const stoneM = std(0x6a625a, { flatShading: true, roughness: 1 });
  ring(12, 1.6, (x, z) => { const s = add(scene, new THREE.DodecahedronGeometry(0.42, 0), stoneM, x, 0.25, z); s.scale.y = 0.6; });
  ring(5, 0.5, (x, z, a) => { const lg = add(scene, new THREE.CylinderGeometry(0.15, 0.18, 2.2, 8), std(0x4a2e18), x * 0.6, 0.35, z * 0.6); lg.rotation.set(0.9, a, 0); });
  const bonfire = fire(scene, 0, 0.2, 0, 1.7, { light: 70, dist: 16 });
  const bonfire2 = fire(scene, 0.3, 0.2, -0.2, 1.1);
  const sparks = particles(scene, { n: 160, color: 0xffa040, size: 0.12,
    init: () => ({ x: 0, y: rand() * 6, z: 0, vx: (rand() - 0.5) * 0.6, vz: (rand() - 0.5) * 0.6, s: 1 + rand() * 2 }),
    step: (d, t, dt) => { d.y += dt * d.s; d.x += d.vx * dt + Math.sin(t * 3 + d.s * 9) * dt * 0.3; d.z += d.vz * dt; if (d.y > 7 + d.s) { d.y = 0.6; d.x = (rand() - 0.5) * 0.8; d.z = (rand() - 0.5) * 0.8; } } });
  const cushions = [0xc0392b, 0x2f6f7a, 0xd4a53a, 0x6a2a6a, 0x2e7a4a];
  const majlis = group(scene);
  ring(14, 5.4, (x, z, a, i) => {
    if (i % 7 === 3) return;   // gaps to walk in
    const c = group(majlis, x, 0, z, faceTo(x, z)); box(c, 1.6, 0.45, 1.2, std(cushions[i % 5], { roughness: 1 }), 0, 0, 0); box(c, 1.6, 0.9, 0.35, std(cushions[(i + 2) % 5], { roughness: 1 }), 0, 0.3, -0.5);
  });
  ring(4, 3.4, (x, z) => {
    const tb = group(majlis, x, 0, z); cyl(tb, 0.7, 0.7, 0.12, std(0x8a5a34), 0, 0.42, 0, 20); cyl(tb, 0.12, 0.2, 0.42, std(0x6a4a2a), 0, 0, 0, 8);
    const dallah = add(tb, new THREE.LatheGeometry([[0.001, 0], [0.18, 0], [0.2, 0.08], [0.12, 0.26], [0.1, 0.36], [0.16, 0.44], [0.001, 0.5]].map(([a, b]) => new THREE.Vector2(a, b)), 16), std(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), 0.2, 0.54, 0);
    for (let k = 0; k < 3; k++) cyl(tb, 0.05, 0.04, 0.08, std(0xf6f0e0), -0.2 + k * 0.15, 0.54, 0.3, 8);
  }, Math.PI / 4);
  // People sitting round the fire and chatting.
  const people = [];
  [[0.5, 5.4], [1.4, 5.4], [2.6, 5.4], [3.7, 5.4], [5.0, 5.4]].forEach(([a, r], i) => {
    const p = buildWorshipper(PALS[i]); const x = Math.cos(a) * r, z = Math.sin(a) * r;
    p.root.position.set(x, 0.2, z); p.root.rotation.y = faceTo(x, z); majlis.add(p.root); p.kneel(1e6); people.push({ p, next: 3 + rand() * 6 });
  });
  [[-13, 9, 0], [-11.6, 10.2, 1]].forEach(([x, z, k]) => { const p = buildWorshipper(PALS[4 + k]); p.root.position.set(x, 0, z); p.root.rotation.y = faceTo(x, z, k ? -13 : -11.6, k ? 9 : 10.2); scene.add(p.root); people.push({ p, next: 2 + rand() * 4, talk: true }); });
  // String lights between poles.
  const bulbs = [0xffd070, 0xff8a70, 0x8ad0ff, 0xa0ff9a, 0xffffff];
  const poles = [], lightsG = group(scene);
  ring(8, 15, (x, z) => { cyl(lightsG, 0.1, 0.14, 6.5, std(0x5a3a22), x, 0, z, 8); poles.push(new THREE.Vector3(x, 6.4, z)); }, 0.2);
  const bulbMs = bulbs.map((c) => { const m = lampMat(c); kit.glow(m, 0.3, 3); return m; });
  poles.forEach((p, i) => {
    const q2 = poles[(i + 1) % poles.length];
    for (let k = 1; k < 14; k++) { const u = k / 14; const pt = p.clone().lerp(q2, u); pt.y -= Math.sin(u * Math.PI) * 1.6; sph(lightsG, 0.12, bulbMs[k % bulbMs.length], pt.x, pt.y, pt.z, 8, 6); }
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 11 }, (_, k) => { const u = k / 10, pt = p.clone().lerp(q2, u); pt.y -= Math.sin(u * Math.PI) * 1.6 - 0.12; return pt; }));
    add(lightsG, new THREE.TubeGeometry(curve, 20, 0.015, 4), std(0x222222));
  });
  // A long dining table, a well.
  const tbl = group(scene, -14, 0, -9, 0.6);
  box(tbl, 7, 0.18, 1.8, std(0x8a5a34), 0, 1.1, 0); for (const [sx, sz] of [[-3.2, -0.7], [3.2, -0.7], [-3.2, 0.7], [3.2, 0.7]]) box(tbl, 0.16, 1.1, 0.16, std(0x6a4a2a), sx, 0, sz);
  box(tbl, 7.2, 0.02, 0.8, std(0xc0392b), 0, 1.29, 0);
  for (let k = 0; k < 6; k++) { cyl(tbl, 0.3, 0.26, 0.05, std(0xf6f0e0), -2.8 + k * 1.1, 1.29, (k % 2 ? 0.5 : -0.5), 16); const food = add(tbl, new THREE.SphereGeometry(0.22, 12, 8, 0, TAU, 0, Math.PI / 2), std([0xd4a03a, 0xc0502a, 0x7aa03a][k % 3]), -2.8 + k * 1.1, 1.34, (k % 2 ? 0.5 : -0.5)); }
  for (const sz of [-1.6, 1.6]) box(tbl, 6.6, 0.5, 0.6, std(0x6a4a2a), 0, 0, sz);
  const well = group(scene, 14, 0, 9);
  cyl(well, 1.4, 1.5, 1.1, stoneM, 0, 0, 0, 16); cyl(well, 1.15, 1.15, 0.05, std(0x1a3a4a), 0, 1.0, 0, 16);
  for (const sx of [-1.2, 1.2]) box(well, 0.18, 3.2, 0.18, std(0x5a3a22), sx, 0.6, 0);
  const wr = add(well, new THREE.ConeGeometry(1.9, 1.1, 4), std(0x8a3a2a), 0, 4.2, 0); wr.rotation.y = Math.PI / 4;
  shade(scene);

  // ---- upgrades: new things added to the square ----
  // a guest tent
  const tent = group(scene, -19, 0, 3, Math.PI / 2 + 0.2); kit.feat('tent', tent);
  const tentM = std(0x2a2420, { roughness: 1, side: THREE.DoubleSide });
  const tg = new THREE.CylinderGeometry(0.1, 5, 3.6, 4, 1, true); const tm = add(tent, tg, tentM, 0, 1.8, 0); tm.rotation.y = Math.PI / 4; tm.scale.set(1.5, 1, 0.8);
  for (const [x, z] of [[-5, 0], [5, 0], [0, 0]]) cyl(tent, 0.08, 0.08, x ? 2.6 : 3.8, std(0x5a3a22), x, 0, z, 6);
  const rugT = add(tent, new THREE.PlaneGeometry(7, 3.4), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g) => { g.fillStyle = '#8a1a1a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#e8c070'; g.lineWidth = 4; g.strokeRect(6, 6, 116, 52); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e8c070' : '#1a3a5a'; g.fillRect(14 + i * 17, 26, 12, 12); } }) }), 0, 0.04, 0); rugT.rotation.x = -Math.PI / 2;
  for (let k = 0; k < 5; k++) box(tent, 1.2, 0.35, 0.8, std([0xc0392b, 0x2f6f7a, 0xd4a53a][k % 3]), -2.6 + k * 1.3, 0, -1.1);
  // an Arabic coffee corner: a brazier with a dallah on the coals
  const coffee = group(scene, 9, 0, -15, faceTo(9, -15)); kit.feat('coffee', coffee);
  cyl(coffee, 0.7, 0.5, 0.6, std(0x3a3a3a, { metalness: 0.6 }), 0, 0, 0, 16);
  const coals = add(coffee, new THREE.CylinderGeometry(0.62, 0.62, 0.06, 16), std(0x3a1a0a, { emissive: 0xff4a10, emissiveIntensity: 1.2 }), 0, 0.6, 0);
  add(coffee, new THREE.LatheGeometry([[0.001, 0], [0.22, 0], [0.24, 0.1], [0.15, 0.32], [0.12, 0.44], [0.2, 0.54], [0.001, 0.6]].map(([a, b2]) => new THREE.Vector2(a, b2)), 16), std(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), 0, 0.63, 0);
  const steam = particles(scene, { n: 30, color: 0xffffff, size: 0.35, additive: false, opacity: 0.25, init: () => ({ x: 9, y: 1.3, z: -15, h: rand() * 2, s: 0.3 + rand() * 0.4, ph: rand() * 6 }), step: (d, t, dt) => { d.h += dt * d.s; if (d.h > 2) d.h = 0; d.x = 9 + Math.sin(t + d.ph) * 0.15 * d.h; d.z = -15; d.y = 1.3 + d.h; } });
  const brewer = buildWorshipper(PALS[4]); brewer.root.position.set(9 + 1.4, 0.2, -15 - 0.6); brewer.root.rotation.y = faceTo(10.4, -15.6, 9, -15); coffee.parent.add(brewer.root); brewer.kneel(1e6);
  kit.feat('coffee', brewer.root);
  // a playground with swings and children
  const play = group(scene, 17, 0, -6, -0.4); kit.feat('playground', play);
  const frameM = std(0x2f6f7a, { metalness: 0.4 });
  for (const sx of [-2.2, 2.2]) { const l1 = add(play, new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), frameM, sx, 1.6, -0.6); l1.rotation.x = 0.35; const l2 = add(play, new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), frameM, sx, 1.6, 0.6); l2.rotation.x = -0.35; }
  const topBar = add(play, new THREE.CylinderGeometry(0.08, 0.08, 4.6, 6), frameM, 0, 3.2, 0); topBar.rotation.z = Math.PI / 2;
  const swings = [-1, 1].map((sx) => { const sw = group(play, sx, 3.2, 0); for (const zz of [-0.2, 0.2]) add(sw, new THREE.CylinderGeometry(0.01, 0.01, 2.4, 3), std(0x333333), 0, -1.2, zz); box(sw, 0.6, 0.06, 0.5, std(0xd4a53a), 0, -2.5, 0); return sw; });
  const kids = [{ robe: '#e8743a', accent: '#ffffff', skin: '#f0cfae', glow: '#ffd38a' }, { robe: '#3a8ad0', accent: '#ffffff', skin: '#e9c29e', glow: '#9fc8ff' }].map((pal, i) => { const k = buildWorshipper(pal); swings[i].add(k.root); k.root.position.set(0, -2.45, 0); k.root.scale.setScalar(0.95); k.kneel(1e6); return k; });
  const slide = group(play, 0, 0, 4.5); box(slide, 1, 2.2, 1, frameM, 0, 0, -1.9); const sl = add(slide, new THREE.BoxGeometry(0.9, 0.1, 3.4), std(0xd04a2a), 0, 1.15, 0); sl.rotation.x = 0.62;
  // neighbourhood stalls
  const stalls = group(scene); kit.feat('stalls', stalls);
  [[-6, -21], [3, -22]].forEach(([x, z], i) => { const st = group(stalls, x, 0, z, faceTo(x, z)); for (const [sx, sz] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) cyl(st, 0.07, 0.08, 2.8, std(0x7a4e2a), sx, 0, sz, 6); const aw = add(st, new THREE.PlaneGeometry(3.6, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g) => { for (let s2 = 0; s2 < 8; s2++) { g.fillStyle = s2 % 2 ? '#f4ead2' : (i ? '#2f6f7a' : '#c0392b'); g.fillRect(s2 * 16, 0, 16, 64); } }), side: THREE.DoubleSide }), 0, 2.9, 0); aw.rotation.x = -Math.PI / 2 + 0.25; box(st, 3, 0.9, 0.9, std(0x8a5a34), 0, 0, 0.4); for (let k = 0; k < 8; k++) sph(st, 0.14, std([0xf0a020, 0xd02a1a, 0x7ac040, 0xe8d040][k % 4]), -1.2 + (k % 4) * 0.8, 1.05, 0.2 + (k < 4 ? 0 : 0.35), 8, 6); });
  // a small fountain
  const fnt = group(scene, -9, 0, 15); kit.feat('fountain', fnt);
  cyl(fnt, 1.8, 1.9, 0.6, stoneM, 0, 0, 0, 24); add(fnt, new THREE.CylinderGeometry(1.6, 1.6, 0.05, 24), new THREE.MeshPhysicalMaterial({ color: 0x4aa8c8, roughness: 0.05, clearcoat: 1 }), 0, 0.56, 0);
  cyl(fnt, 0.25, 0.35, 1.6, stoneM, 0, 0.6, 0, 12); cyl(fnt, 0.8, 0.6, 0.2, stoneM, 0, 2.2, 0, 16);
  const jet = add(fnt, new THREE.ConeGeometry(0.15, 0.8, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 }), 0, 2.7, 0);
  return {
    spawn: [0, 19, Math.PI], stand: [17, -4, faceTo(17, -4, 0, 19)], camR: R + 2, camY: 18,
    blocked: (x, z) => {
      const r = hyp(x, z);
      if (r > R + 1.5) return true;
      if (r < 6.3) return true;   // the fire and the majlis
      for (const p of poles) if (hyp(x - p.x, z - p.z) < 0.5) return true;
      if (hyp(x - 14, z - 9) < 2) return true;
      { const dx = x + 14, dz = z + 9, c = Math.cos(0.6), s2 = Math.sin(0.6), lx = dx * c - dz * s2, lz = dx * s2 + dz * c; if (Math.abs(lx) < 3.8 && Math.abs(lz) < 2.3) return true; }
      if (hyp(x + 12.3, z - 9.6) < 1.6) return true;
      if (kit.has('tent') && hyp(x + 19, z - 3) < 4.4) return true;
      if (kit.has('coffee') && hyp(x - 9, z + 15) < 1.6) return true;
      if (kit.has('playground') && hyp(x - 17, z + 6) < 3.4) return true;
      if (kit.has('stalls') && (hyp(x + 6, z + 21) < 2.2 || hyp(x - 3, z + 22) < 2.2)) return true;
      if (kit.has('fountain') && hyp(x + 9, z - 15) < 2.1) return true;
      return false;
    },
    tick(t, dt, s) {
      bonfire.tick(t); bonfire2.tick(t); sparks.tick(t, dt);
      people.forEach((o) => { o.next -= dt; o.p.update(t, dt, 0, false); if (o.next < 0 && o.talk) { o.p.wave(); o.next = 3 + rand() * 5; } });
      if (kit.has('coffee')) { steam.tick(t, dt); brewer.update(t, dt, 0, false); }
      steam.mat.opacity = kit.has('coffee') ? 0.25 : 0;
      if (kit.has('playground')) { swings.forEach((sw, i) => (sw.rotation.x = Math.sin(t * 1.8 + i * 1.4) * 0.5)); kids.forEach((k) => k.update(t, dt, 0, false)); }
      if (kit.has('fountain')) jet.scale.y = 1 + Math.sin(t * 6) * 0.1;
    },
    burst: [0xffd070, 0xff8a70, 0x8ad0ff],
  };
}

// ======================= ساحة الإنجاز — career =======================
// A business plaza: a glass headquarters with a real clock, towers round it, a
// fountain; upgrades add team desks, a growth screen, a ladder of success, a café, colleagues.
function plaza(scene, kit) {
  const { rand } = kit;
  const R = 32;
  ground(scene, 400, speckle('#4a4e54', ['#3a3e44', '#5a5e64'], { repeat: 80 }));
  const granite = canvasTex(512, 512, (g, w) => { g.fillStyle = '#c8c8c4'; g.fillRect(0, 0, w, w); for (let y = 0; y < w; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = (x + y) % 256 ? '#d2d2ce' : '#bcbcb8'; g.fillRect(x + 2, y + 2, 124, 124); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,90,90' : '250,250,250'},.25)`; g.fillRect(x + Math.random() * 124, y + Math.random() * 124, 2, 2); } } g.strokeStyle = '#8a8a86'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, w); g.moveTo(0, k * 128); g.lineTo(w, k * 128); g.stroke(); } }, 12);
  ground(scene, R + 6, granite, { y: 0.02, rough: 0.55 });
  // ---- the headquarters tower with a real clock ----
  const glassT = canvasTex(64, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128); for (let y = 2; y < 128; y += 8) for (let x = 2; x < 64; x += 8) if (Math.random() < 0.55) { g.fillStyle = '#ffe2a8'; g.fillRect(x, y, 5, 5); } });
  glassT.wrapS = glassT.wrapT = THREE.RepeatWrapping;
  const towerM = (rx, ry) => { const t = glassT.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); const m = new THREE.MeshStandardMaterial({ color: 0x5a7a98, metalness: 0.7, roughness: 0.12, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 }); kit.glow(m, 0.02, 1.1); return m; };
  const steelM = std(0xd8dce0, { metalness: 0.8, roughness: 0.3 });
  const hq = group(scene, 0, 0, -40);
  box(hq, 26, 64, 14, towerM(5, 14), 0, 0, 0);
  for (let i = -3; i <= 3; i++) box(hq, 0.3, 64, 0.3, steelM, i * 4, 0, 7.1);
  box(hq, 20, 8, 10, towerM(4, 2), 0, 64, 0); box(hq, 10, 10, 6, towerM(2, 2), 0, 72, 0);
  cyl(hq, 0.15, 0.3, 14, steelM, 0, 82, 0, 8);
  const beaconM = lampMat(0xff3a2a); sph(hq, 0.5, beaconM, 0, 96.3, 0, 10, 8); kit.glow(beaconM, 0.3, 3);
  // lobby
  box(hq, 14, 7, 0.2, new THREE.MeshPhysicalMaterial({ color: 0xbfe0f0, roughness: 0.05, transparent: true, opacity: 0.45 }), 0, 0, 7.2);
  box(hq, 16, 0.6, 5, steelM, 0, 7, 9.4);
  const name = add(hq, new THREE.PlaneGeometry(10, 1.4), new THREE.MeshStandardMaterial({ map: textTex(['برج الإنجاز'], { w: 768, h: 128, bg: '#14202c', fg: '#ffd36b' }) }), 0, 8.4, 11.95);
  name.material.emissive = new THREE.Color(0xffffff); name.material.emissiveMap = name.material.map; kit.glow(name.material, 0.2, 1);
  // the clock: real hours and minutes
  const clockG = group(hq, 0, 40, 7.4);
  cyl(clockG, 5.2, 5.2, 0.4, std(0x14202c, { metalness: 0.5 }), 0, -0.2, 0, 48).rotation.x = Math.PI / 2;
  const faceM = new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g, w) => { g.fillStyle = '#f6f2e8'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 4, 0, 7); g.fill(); g.fillStyle = '#14202c'; for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU, r1 = w / 2 - (k % 5 ? 20 : 44); g.save(); g.translate(w / 2 + Math.sin(a) * r1, w / 2 - Math.cos(a) * r1); g.rotate(a); g.fillRect(-(k % 5 ? 2 : 6), 0, k % 5 ? 4 : 12, k % 5 ? 12 : 34); g.restore(); } }), emissive: 0xfff4d8, emissiveIntensity: 0 });
  kit.glow(faceM, 0, 0.7);
  add(clockG, new THREE.CircleGeometry(4.8, 48), faceM, 0, 0, 0.25);
  const hand = (len, w, c) => { const h = group(clockG, 0, 0, 0.35); box(h, w, len, 0.12, std(c, { metalness: 0.6 }), 0, -len * 0.12, 0); return h; };
  const hourH = hand(2.6, 0.32, 0x14202c), minH = hand(3.8, 0.2, 0x14202c), secH = hand(4, 0.06, 0xc0392b);
  // Towers round the plaza and a far skyline.
  [[-34, -18, 14, 48], [34, -16, 12, 56], [-40, 10, 12, 36], [40, 12, 14, 42], [-26, 34, 10, 30], [28, 36, 12, 34]].forEach(([x, z, w, h]) => { const b = add(scene, new THREE.BoxGeometry(w, h, w), towerM(w / 5, h / 5), x, h / 2, z); b.rotation.y = faceTo(x, z); box(scene, w * 0.6, 3, w * 0.6, steelM, x, h, z); });
  for (let i = 0; i < 40; i++) { const a = rand() * TAU, r = 110 + rand() * 90, h = 30 + rand() * 80, w = 10 + rand() * 12; add(scene, new THREE.BoxGeometry(w, h, w), towerM(2, h / 10), Math.cos(a) * r, h / 2, Math.sin(a) * r).rotation.y = rand() * 3; }
  // Central fountain, planters with trees, benches, lamp posts.
  const stoneM = std(0xe8e6e0, { roughness: 0.4 });
  cyl(scene, 4.4, 4.6, 0.7, stoneM, 0, 0, 2, 40);
  const fw = add(scene, new THREE.CylinderGeometry(4, 4, 0.1, 40), new THREE.MeshPhysicalMaterial({ color: 0x4aa8c8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), 0, 0.62, 2);
  cyl(scene, 0.6, 0.9, 2.2, stoneM, 0, 0.6, 2, 20); cyl(scene, 1.6, 1.4, 0.3, stoneM, 0, 2.8, 2, 24);
  const jets = particles(scene, { n: 220, color: 0xdff4ff, size: 0.16, additive: false, opacity: 0.8,
    init: () => ({ x: 0, y: 3, z: 2, vx: 0, vy: 0, vz: 0, life: 0 }),
    step: (d, t, dt) => { d.life -= dt; if (d.life <= 0) { const a = rand() * TAU, sp = 1.2 + rand() * 0.8; Object.assign(d, { x: 0, y: 3.1, z: 2, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 3 + rand() * 1.5, life: 1.2 }); } d.vy -= dt * 9.8; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < 0.65) d.life = 0; } });
  const leafM = std(0x3f7a3a, { flatShading: true }), planterM = std(0x5a5e64, { roughness: 0.6 });
  const planters = [[-10, 10], [10, 10], [-12, -8], [12, -8], [-20, 18], [20, 18]];
  planters.forEach(([x, z]) => { box(scene, 2.4, 0.9, 2.4, planterM, x, 0, z); cyl(scene, 0.15, 0.22, 2.4, std(0x6a4a2a), x, 0.9, z, 6); add(scene, new THREE.IcosahedronGeometry(1.5, 1), leafM, x, 4.1, z); });
  const lampG = []; ring(8, 22, (x, z) => { cyl(scene, 0.08, 0.12, 5, steelM, x, 0, z, 8); const m = lampMat(0xfff4dc); box(scene, 0.9, 0.2, 0.5, m, x, 5, z); kit.glow(m, 0.2, 2.6); lampG.push([x, z]); }, 0.2);
  // ---- upgrades ----
  const deskG = group(scene, -15, 0, -6); kit.feat('desks', deskG);
  box(deskG, 10, 0.2, 8, std(0x8a6a4a), 0, 0, 0);
  const screenM = lampMat(0x6ab8ff); kit.glow(screenM, 0.9, 1.6);
  for (let i = 0; i < 6; i++) { const x = -3 + (i % 3) * 3, z = i < 3 ? -1.6 : 1.6, d = group(deskG, x, 0.2, z, i < 3 ? 0 : Math.PI); box(d, 2.2, 0.08, 1, std(0xf4f4f0), 0, 0.85, 0); for (const sx of [-1, 1]) box(d, 0.06, 0.85, 0.9, std(0x333333), sx, 0, 0); const lp = group(d, 0, 0.93, -0.1); box(lp, 0.7, 0.03, 0.5, std(0x9aa0a8, { metalness: 0.7 }), 0, 0, 0); const sc = add(lp, new THREE.PlaneGeometry(0.68, 0.44), screenM, 0, 0.24, -0.24); sc.rotation.x = -0.2; const ch = group(d, 0, 0, 0.9); box(ch, 0.6, 0.5, 0.6, std(0x2a2e34), 0, 0, 0); box(ch, 0.6, 0.6, 0.1, std(0x2a2e34), 0, 0.5, 0.26); }
  const umb = group(deskG, 4.2, 0.2, 0); cyl(umb, 0.05, 0.05, 2.8, steelM, 0, 0, 0, 6); add(umb, new THREE.ConeGeometry(2, 0.7, 8), std(0x2a5a8a), 0, 3, 0);
  // the growth screen: bars rise over time
  const scrG = group(scene, 17, 0, -12, faceTo(17, -12)); kit.feat('screen', scrG);
  for (const sx of [-3.6, 3.6]) box(scrG, 0.5, 9, 0.5, std(0x2a2e34), sx, 0, -0.3);
  box(scrG, 8.4, 5, 0.4, std(0x111418), 0, 4.5, 0);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const chartT = new THREE.CanvasTexture(cv); chartT.colorSpace = THREE.SRGBColorSpace;
  add(scrG, new THREE.PlaneGeometry(8, 4.6), new THREE.MeshBasicMaterial({ map: chartT }), 0, 7, 0.21);
  const drawChart = (t) => { const g = cv.getContext('2d'); g.fillStyle = '#0c1824'; g.fillRect(0, 0, 512, 300); g.fillStyle = '#ffd36b'; g.font = 'bold 34px Tajawal, system-ui'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('إنجازاتك بتكبر 📈', 256, 44); for (let i = 0; i < 8; i++) { const h = (40 + i * 26) * (0.75 + 0.25 * Math.sin(t * 0.8 + i * 0.6) ** 2); g.fillStyle = i === 7 ? '#3aff7a' : '#3a8aff'; g.fillRect(40 + i * 56, 280 - h, 38, h); } g.strokeStyle = '#ffd36b'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 8; i++) { const y = 260 - i * 26; i ? g.lineTo(59 + i * 56, y) : g.moveTo(59, y); } g.stroke(); chartT.needsUpdate = true; };
  drawChart(0);
  // the ladder of success: golden steps up to a podium and a trophy (walkable)
  const ST = { x0: 9, z: 10, n: 10, w: 0.9, d: 2.6, h: 0.42 };
  const stairG = group(scene); kit.feat('stairs', stairG);
  const goldM = std(0xffc83d, { metalness: 1, roughness: 0.25 }), whiteM = std(0xf4f2ec, { roughness: 0.35 });
  for (let i = 0; i < ST.n; i++) box(stairG, ST.w, (i + 1) * ST.h, ST.d, i % 2 ? goldM : whiteM, ST.x0 + i * ST.w + ST.w / 2, 0, ST.z);
  const topX = ST.x0 + ST.n * ST.w + 1.2;
  box(stairG, 2.4, ST.n * ST.h, 3.2, whiteM, topX, 0, ST.z);
  const trophy = group(stairG, topX, ST.n * ST.h, ST.z);
  cyl(trophy, 0.4, 0.5, 0.4, goldM, 0, 0, 0, 16); cyl(trophy, 0.1, 0.12, 0.8, goldM, 0, 0.4, 0, 10);
  add(trophy, new THREE.LatheGeometry([[0.001, 0], [0.2, 0.05], [0.55, 0.5], [0.6, 0.9], [0.001, 0.9]].map(([a, b]) => new THREE.Vector2(a, b)), 20), goldM, 0, 1.2, 0);
  cyl(trophy, 0.04, 0.04, 3.4, steelM, 0.9, 0, 0, 6);
  const fl = flag(trophy, 1.4, 0.8, canvasTex(64, 32, (g) => { g.fillStyle = '#c0392b'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#ffd36b'; g.font = 'bold 22px system-ui'; g.fillText('★', 22, 24); }), 0.9, 3, 0);
  const stairsAt = (x, z) => { if (!kit.has('stairs') || Math.abs(z - ST.z) > ST.d / 2) return 0; const i = Math.floor((x - ST.x0) / ST.w); if (i >= 0 && i < ST.n) return (i + 1) * ST.h; if (x >= ST.x0 + ST.n * ST.w && x < topX + 1.2) return ST.n * ST.h; return 0; };
  // café
  const cafe = group(scene, -17, 0, 13, faceTo(-17, 13)); kit.feat('cafe', cafe);
  box(cafe, 4.4, 1.15, 1.4, std(0x3a2a20), 0, 0, 0); box(cafe, 4.6, 0.08, 1.6, std(0xd8c8a8), 0, 1.15, 0);
  const machine = group(cafe, -1.2, 1.2, -0.2); box(machine, 0.8, 0.6, 0.5, std(0xb0b4b8, { metalness: 0.8 }), 0, 0, 0);
  for (let k = 0; k < 4; k++) cyl(cafe, 0.06, 0.05, 0.12, std(0xf6f0e0), 0.4 + k * 0.3, 1.22, 0.3, 10);
  box(cafe, 4.4, 2.2, 0.2, std(0x2a1a14), 0, 1.3, -0.8);
  add(cafe, new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshStandardMaterial({ map: textTex(['☕ قهوة'], { w: 384, h: 96, bg: '#2a1a14', fg: '#ffd8a0' }) }), 0, 3, -0.68);
  [[-2, 3.4], [1.4, 3.6], [3.8, 1.4]].forEach(([tx, tz]) => { const tb = group(cafe, tx, 0, tz); cyl(tb, 0.55, 0.55, 0.05, std(0xf4f2ec), 0, 1, 0, 16); cyl(tb, 0.05, 0.05, 1, std(0x333333), 0, 0, 0, 6); cyl(tb, 0.04, 0.04, 2.6, steelM, 0, 1, 0, 6); add(tb, new THREE.ConeGeometry(1.5, 0.5, 8), std(0xc0392b), 0, 3.6, 0); for (const a2 of [0.4, 2.6]) { const c = group(tb, Math.cos(a2) * 0.95, 0, Math.sin(a2) * 0.95); cyl(c, 0.22, 0.22, 0.55, std(0x2a2e34), 0, 0, 0, 10); } });
  // colleagues meeting by the screen
  const teamG = group(scene); kit.feat('team', teamG);
  const suits = [{ robe: '#1e2a3a', accent: '#c0392b', skin: '#f0cfae', glow: '#9fc8ff' }, { robe: '#3a3e44', accent: '#2a6ad0', skin: '#d9ad85', glow: '#9fc8ff' }, { robe: '#2a3a2e', accent: '#f0c020', skin: '#e9c29e', glow: '#ffe08a' }, { robe: '#4a3a2e', accent: '#ffffff', skin: '#c99a72', glow: '#ffd38a' }];
  const team = suits.map((pal, i) => { const p = buildWorshipper(pal); const a = 0.4 + i * 0.55, x = 17 + Math.cos(a + Math.PI * 0.6) * 3.4, z = -7 + Math.sin(a + Math.PI * 0.6) * 2.4; p.root.position.set(x, 0, z); p.root.rotation.y = faceTo(x, z, 17, -9.6); teamG.add(p.root); return { p, next: 2 + i * 1.7 }; });
  shade(scene);

  return {
    spawn: [0, 25, Math.PI], stand: [-21, -1, faceTo(-21, -1, 0, 25)], camR: R + 3, camY: 26,
    groundAt: stairsAt,
    blocked: (x, z) => {
      if (hyp(x, z) > R) return true;
      if (Math.abs(x) < 13.2 && z < -32.5) return true;
      if (hyp(x, z - 2) < 4.8) return true;
      for (const [px, pz] of planters) if (Math.abs(x - px) < 1.5 && Math.abs(z - pz) < 1.5) return true;
      for (const [lx, lz] of lampG) if (hyp(x - lx, z - lz) < 0.4) return true;
      if (kit.has('desks') && Math.abs(x + 15) < 5.2 && Math.abs(z + 6) < 4.2) return true;
      if (kit.has('screen') && hyp(x - 17, z + 12) < 4.2) return true;
      if (kit.has('stairs')) { if (Math.abs(z - ST.z) < ST.d / 2 + 0.3 && Math.abs(z - ST.z) > ST.d / 2 - 0.15 && x > ST.x0 && x < topX + 1.2) return true; if (Math.abs(z - ST.z) < 1.6 && x >= topX + 1.1 && x < topX + 1.5) return true; }
      if (kit.has('cafe') && hyp(x + 17, z - 13) < 3.4) return true;
      if (kit.has('team')) for (const m of team) if (hyp(x - m.p.root.position.x, z - m.p.root.position.z) < 0.8) return true;
      return false;
    },
    tick(t, dt, s) {
      const d = new Date(), sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60;
      secH.rotation.z = -(sec / 60) * TAU; minH.rotation.z = -(min / 60) * TAU; hourH.rotation.z = -(hr / 12) * TAU;
      jets.tick(t, dt);
      if (kit.has('screen') && Math.floor(t * 4) !== drawChart.last) { drawChart.last = Math.floor(t * 4); drawChart(t); }
      if (kit.has('stairs')) { fl.tick(t); trophy.rotation.y = Math.sin(t * 0.5) * 0.2; }
      if (kit.has('team')) team.forEach((m) => { m.next -= dt; m.p.update(t, dt, 0, false); if (m.next < 0) { m.p.wave(); m.next = 4 + rand() * 5; } });
      beaconM.emissiveIntensity = (Math.sin(t * 3) > 0.6 ? 3 : 0.2);
    },
    burst: [0xffd36b, 0x3aff7a, 0x6ab8ff],
  };
}

// ======================= ميناء التاجر — wealth =======================
// A merchant harbour: a stone quay on a living sea, a grand counting house (بيت المال)
// with a golden dome, seagulls; upgrades add the harbour market, trading ships,
// a golden vault, a lighthouse and a palace garden.
function harbor(scene, kit) {
  const { rand } = kit;
  const QZ = -10, R = 32;
  // The sea, with moving swell.
  const seaGeo = new THREE.PlaneGeometry(900, 500, 90, 50); seaGeo.rotateX(-Math.PI / 2);
  const seaM = new THREE.MeshPhysicalMaterial({ color: 0x1f6f8a, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2 });
  const sea = add(scene, seaGeo, seaM, 0, -0.9, QZ - 250); const seaBase = seaGeo.attributes.position.array.slice();
  // Land behind the quay: a cobbled waterfront and a town.
  const cobble = canvasTex(512, 512, (g, w) => { g.fillStyle = '#6a5e50'; g.fillRect(0, 0, w, w); for (let y = 0; y < w; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32) { const v = 140 + Math.random() * 50; g.fillStyle = `rgb(${v + 10},${v},${v - 14})`; g.beginPath(); g.roundRect(x + 2, y + 2, 28, 28, 8); g.fill(); } }, 1);
  cobble.repeat.set(28, 22);
  const land = add(scene, new THREE.BoxGeometry(400, 3, 240), [std(0x6a6258), std(0x6a6258), new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.85 }), std(0x6a6258), std(0x8a8070), std(0x6a6258)], 0, -1.5, QZ + 120);
  land.receiveShadow = true;
  const quayStone = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#8a8070'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) { const v = 120 + Math.random() * 40; g.fillStyle = `rgb(${v + 10},${v + 4},${v - 6})`; g.fillRect(x + 2, y + 2, 60, 28); } g.fillStyle = 'rgba(40,70,50,.5)'; g.fillRect(0, h - 26, w, 26); });
  quayStone.wrapS = THREE.RepeatWrapping; quayStone.repeat.set(60, 1);
  add(scene, new THREE.PlaneGeometry(400, 3), new THREE.MeshStandardMaterial({ map: quayStone, roughness: 1 }), 0, -1.5, QZ + 0.01);
  box(scene, 400, 0.35, 0.9, std(0xa8a090), 0, 0, QZ + 0.45);
  const bollards = []; for (let x = -26; x <= 26; x += 6.5) { cyl(scene, 0.28, 0.34, 0.8, std(0x2a2a2e, { metalness: 0.6 }), x, 0.3, QZ + 0.9, 12); bollards.push(x); }
  // Town houses behind and to the west.
  const plasters = [0xe8dcc0, 0xd8c8a8, 0xf0e4cc, 0xc8b890, 0xe4d0b0];
  const winM = lampMat(0xffd08a); kit.glow(winM, 0.05, 2);
  for (let i = 0; i < 16; i++) { const x = -60 + i * 8 + rand() * 2, z = 34 + rand() * 8, h = 7 + rand() * 8; const hs = group(scene, x, 0, z); box(hs, 7, h, 7, std(plasters[i % 5], { roughness: 0.95 }), 0, 0, 0); const roof = add(hs, new THREE.ConeGeometry(5.4, 3, 4), std(0xa8503a), 0, h + 1.5, 0); roof.rotation.y = Math.PI / 4; for (let k = 0; k < 2; k++) box(hs, 1, 1.4, 0.1, winM, -1.6 + k * 3.2, h * 0.55, -3.55); }
  // ---- بيت المال: the counting house with columns and a golden dome ----
  const marble = std(0xf4efe4, { roughness: 0.35 }), goldM = std(0xffc83d, { metalness: 1, roughness: 0.22 });
  const bank = group(scene, 25, 0, 8, -Math.PI / 2);
  for (let i = 0; i < 4; i++) box(bank, 18 - i * 0.8, 0.4, 3 - i * 0.6, marble, 0, i * 0.4, 7.8 - i * 0.3);
  box(bank, 16, 9, 12, std(0xeee6d4, { roughness: 0.6 }), 0, 0, 0);
  for (let i = 0; i < 6; i++) { const x = -6.5 + i * 2.6; cyl(bank, 0.45, 0.5, 8, marble, x, 1.6, 6.8, 18); cyl(bank, 0.7, 0.5, 0.5, goldM, x, 9.4, 6.8, 14); }
  box(bank, 17, 0.9, 2.6, marble, 0, 9.6, 6.6);
  const ped = new THREE.Shape(); ped.moveTo(-8.6, 0); ped.lineTo(8.6, 0); ped.lineTo(0, 2.8); ped.closePath();
  add(bank, new THREE.ExtrudeGeometry(ped, { depth: 2.4, bevelEnabled: false }), marble, 0, 10.5, 5.4);
  add(bank, new THREE.PlaneGeometry(6, 0.9), new THREE.MeshStandardMaterial({ map: textTex(['بيت المال'], { w: 512, h: 96, bg: '#f4efe4', fg: '#7a5a1a' }) }), 0, 11.4, 7.85);
  const dome = add(bank, new THREE.SphereGeometry(4.6, 40, 20, 0, TAU, 0, Math.PI / 2), goldM, 0, 9, -1); dome.scale.y = 0.85;
  cyl(bank, 4.8, 4.8, 1.2, marble, 0, 8.4, -1, 32); cyl(bank, 0.15, 0.4, 2, goldM, 0, 12.8, -1, 10);
  box(bank, 3.2, 5, 0.3, std(0x5a3a1a), 0, 1.6, 6.05);
  for (const sx of [-0.6, 0.6]) sph(bank, 0.14, goldM, sx, 4, 6.25, 10, 8);
  // Seagulls overhead.
  const gullM = std(0xf4f4f0, { side: THREE.DoubleSide });
  const gulls = Array.from({ length: 9 }, () => { const g = group(scene); const w = [-1, 1].map((sx) => { const m = add(g, new THREE.PlaneGeometry(0.9, 0.22), gullM, sx * 0.45, 0, 0); return m; }); return { g, w, r: 10 + rand() * 18, h: 9 + rand() * 8, sp: 0.15 + rand() * 0.2, ph: rand() * 6, cx: (rand() - 0.5) * 20, cz: QZ - 6 + (rand() - 0.5) * 12 }; });
  // Lamp posts along the quay.
  const lamps = []; for (let x = -22; x <= 22; x += 11) { cyl(scene, 0.1, 0.14, 4.6, std(0x2a2a2e), x, 0, QZ + 2.4, 8); const m = lampMat(0xffd08a); sph(scene, 0.32, m, x, 4.8, QZ + 2.4, 12, 8); kit.glow(m, 0.2, 2.6); lamps.push(x); }
  // ---- upgrades ----
  // harbour market: stalls with awnings, crates, barrels and a wooden crane with a swinging net
  const market = group(scene); kit.feat('market', market);
  const woodM = std(0x7a4e2a, { roughness: 0.7 });
  const stalls = [];
  [[-24, 2], [-24, 9], [-24, 16]].forEach(([x, z], i) => {
    const st = group(market, x, 0, z, Math.PI / 2); stalls.push([x, z]);
    for (const [sx, sz] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) cyl(st, 0.1, 0.12, 3.4, woodM, sx, 0, sz, 8);
    const [c1, c2] = [['#1e6b52', '#f4ead2'], ['#2f4f8a', '#ffd36b'], ['#8a2a2a', '#f4ead2']][i];
    const aw = add(st, new THREE.PlaneGeometry(5, 3), new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g) => { for (let s2 = 0; s2 < 8; s2++) { g.fillStyle = s2 % 2 ? c2 : c1; g.fillRect(s2 * 16, 0, 16, 64); } }), side: THREE.DoubleSide }), 0, 3.5, 0); aw.rotation.x = -Math.PI / 2 + 0.25;
    box(st, 4.4, 1.1, 1, woodM, 0, 0, 0.8);
    for (let k = 0; k < 6; k++) { const it = [() => cyl(st, 0.2, 0.18, 0.5, std([0xc0502a, 0xe8a020, 0x8a3a1a][k % 3]), -1.6 + k * 0.62, 1.1, 0.8, 12), () => sph(st, 0.2, std([0xf0a020, 0xd02a1a, 0x7ac040][k % 3]), -1.6 + k * 0.62, 1.32, 0.8, 10, 8), () => box(st, 0.45, 0.3, 0.6, std([0xd4c8a8, 0x6a2a6a, 0x2a5a9a][k % 3]), -1.6 + k * 0.62, 1.1, 0.8)][i](); }
  });
  for (let k = 0; k < 10; k++) { const x = -14 + (k % 5) * 1.3, z = QZ + 3 + Math.floor(k / 5) * 1.3; k % 2 ? cyl(market, 0.5, 0.55, 1.2, std(0x6a4a2a), x, 0, z, 12) : box(market, 1.1, 1.1, 1.1, std(0xb08a5a), x, 0, z); }
  const crane = group(market, -4, 0, QZ + 1.6);
  cyl(crane, 0.35, 0.45, 8, woodM, 0, 0, 0, 10);
  const boom = group(crane, 0, 7.6, 0); box(boom, 0.3, 0.3, 8, woodM, 0, 0, -3.4); boom.rotation.x = 0.25;
  const netPivot = group(boom, 0, 0, -7.2); add(netPivot, new THREE.CylinderGeometry(0.02, 0.02, 4, 4), std(0x8a7a5a), 0, -2, 0);
  const net = sph(netPivot, 0.9, std(0x8a7a5a, { wireframe: true }), 0, -4.6, 0, 10, 8); for (let k = 0; k < 3; k++) box(netPivot, 0.6, 0.6, 0.6, std(0xb08a5a), (k - 1) * 0.4, -5.2, 0);
  // trading ships
  const shipsG = group(scene); kit.feat('ships', shipsG);
  const hullM = std(0x5a3a22, { roughness: 0.7 }), sailM = std(0xf4ead2, { side: THREE.DoubleSide, roughness: 0.9 });
  const ships = [[-18, QZ - 9, 0.2, 1], [8, QZ - 16, -0.4, 1.3], [30, QZ - 26, 0.6, 1.1]].map(([x, z, ry, s2]) => {
    const g = group(shipsG, x, -0.9, z, ry); g.scale.setScalar(s2);
    const hs = new THREE.Shape(); hs.moveTo(-7, 1.6); hs.quadraticCurveTo(-6, -0.4, -3, -0.8); hs.lineTo(4, -0.8); hs.quadraticCurveTo(7, -0.2, 8, 2); hs.lineTo(-7, 1.6);
    const hull = add(g, new THREE.ExtrudeGeometry(hs, { depth: 3.2, bevelEnabled: false }), hullM, 0, 0.6, -1.6);
    box(g, 13, 0.2, 3, std(0xa8784a), 0.5, 1.6, 0);
    cyl(g, 0.16, 0.2, 10, std(0x3a2618), 1, 1.6, 0, 8); cyl(g, 0.12, 0.16, 7, std(0x3a2618), -4, 1.6, 0, 8);
    const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0, 8); sail.lineTo(-5.5, 1); sail.closePath();
    const s1 = add(g, new THREE.ShapeGeometry(sail), sailM, 1.2, 3, 0.15); s1.rotation.y = 0.1;
    const s3 = add(g, new THREE.ShapeGeometry(sail), sailM, -3.8, 3, 0.12); s3.scale.setScalar(0.65);
    const fl = flag(g, 1.2, 0.6, canvasTex(64, 32, (c) => { c.fillStyle = '#1e6b52'; c.fillRect(0, 0, 64, 32); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(32, 16, 8, 0, 7); c.fill(); }), 1, 11.4, 0);
    for (let k = 0; k < 4; k++) box(g, 0.9, 0.9, 0.9, std(0xb08a5a), -2 + k * 1.3, 1.7, (k % 2 ? 0.6 : -0.6));
    return { g, fl, x, z, ph: rand() * 6 };
  });
  // golden vault in the square
  const vault = group(scene, 0, 0, 6); kit.feat('vault', vault);
  box(vault, 6, 0.4, 4, marble, 0, 0, 0);
  box(vault, 5, 6, 1.6, std(0x5a5e64, { metalness: 0.5, roughness: 0.4 }), 0, 0.4, -0.8);
  const door = group(vault, 0, 3.3, 0.05);
  add(door, new THREE.CylinderGeometry(2.1, 2.1, 0.4, 48), goldM).rotation.x = Math.PI / 2;
  add(door, new THREE.TorusGeometry(2.1, 0.16, 8, 48), std(0xd4a53a, { metalness: 1, roughness: 0.3 }), 0, 0, 0.2);
  const wheel = group(door, 0, 0, 0.3);
  add(wheel, new THREE.TorusGeometry(0.9, 0.08, 8, 32), std(0xd4a53a, { metalness: 1, roughness: 0.3 }));
  for (let k = 0; k < 6; k++) { const sp = add(wheel, new THREE.BoxGeometry(0.1, 1.8, 0.1), std(0xd4a53a, { metalness: 1 })); sp.rotation.z = (k / 6) * Math.PI; }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; sph(door, 0.1, std(0xb08a2a, { metalness: 1 }), Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0.22, 8, 6); }
  const COINS = 220, coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14), goldM, COINS);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < COINS; i++) { let x, z; do { x = (rand() - 0.5) * 5.6; z = 0.4 + rand() * 1.5; } while (Math.abs(x) < 0.5 && z < 0.8); const y = 0.42 + rand() * 0.35 * Math.max(0, 1 - Math.abs(x) / 3); q.setFromEuler(new THREE.Euler(rand() * 0.8, rand() * 6, rand() * 0.8)); mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); coins.setMatrixAt(i, mtx); }
  vault.add(coins);
  for (let i = 0; i < 6; i++) box(vault, 0.7, 0.24, 0.32, goldM, -2.4 + (i % 3) * 0.72, 0.4 + Math.floor(i / 3) * 0.25, 1.6);
  const vLight = new THREE.PointLight(0xffc040, 10, 10, 1.5); vLight.position.set(0, 3.5, 2.5); vault.add(vLight); kit.glow(vLight, 6, 18);
  const sparkle = particles(scene, { n: 90, color: 0xffe07a, size: 0.14, init: () => ({ x: (rand() - 0.5) * 5, y: 0.5 + rand() * 4, z: 6 + rand() * 1.5, s: 0.3 + rand() * 0.6 }), step: (d, t, dt) => { d.y += dt * d.s; if (d.y > 5) d.y = 0.5; } });
  // lighthouse on a rock out at sea
  const lh = group(scene, -34, 0, QZ - 34); kit.feat('lighthouse', lh);
  for (let k = 0; k < 7; k++) { const r = add(lh, new THREE.DodecahedronGeometry(3 + rand() * 2, 0), std(0x6a6a66, { flatShading: true }), (rand() - 0.5) * 6, -1, (rand() - 0.5) * 6); r.scale.y = 0.6; }
  for (let k = 0; k < 6; k++) cyl(lh, 2 - k * 0.18, 2.1 - k * 0.18, 3.2, std(k % 2 ? 0xc0392b : 0xf4f4f0), 0, 1 + k * 3.2, 0, 20);
  cyl(lh, 1.5, 1.5, 2, new THREE.MeshPhysicalMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.6, emissive: 0xffd060, emissiveIntensity: 0.4 }), 0, 20.2, 0, 16);
  add(lh, new THREE.ConeGeometry(1.9, 2, 16), std(0x2a2a2e), 0, 23.2, 0);
  const beamM = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = group(lh, 0, 21.2, 0); const bm = add(beam, new THREE.ConeGeometry(4, 60, 16, 1, true), beamM, 0, 0, 30); bm.rotation.x = -Math.PI / 2;
  const lhLight = new THREE.PointLight(0xffe0a0, 0, 40, 1.4); lhLight.position.y = 21; lh.add(lhLight); kit.glow(lhLight, 0, 30);
  // palace garden: hedges, cypresses, a fountain with a golden finial
  const garden = group(scene, 14, 0, 22); kit.feat('garden', garden);
  const hedgeM = std(0x3f6f32, { roughness: 1 });
  for (const [x, z, w, d] of [[-6, -4, 1, 8], [6, -4, 1, 8], [0, -8, 13, 1], [-3.5, 1.5, 6, 1], [3.5, 1.5, 6, 1]]) box(garden, w, 1.1, d, hedgeM, x, 0, z);
  for (const [x, z] of [[-5, -7], [5, -7], [-5, 0], [5, 0]]) { cyl(garden, 0.15, 0.2, 1, std(0x5a3a22), x, 0, z, 6); const c = add(garden, new THREE.ConeGeometry(0.8, 4.4, 10), std(0x2f5a2e), x, 3.2, z); }
  cyl(garden, 2.2, 2.4, 0.6, marble, 0, 0, -3.5, 32); add(garden, new THREE.CylinderGeometry(2, 2, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: 0x4aa8c8, roughness: 0.05, clearcoat: 1 }), 0, 0.58, -3.5);
  cyl(garden, 0.3, 0.45, 1.8, marble, 0, 0.6, -3.5, 14); sph(garden, 0.4, goldM, 0, 2.7, -3.5, 14, 10);
  for (let k = 0; k < 24; k++) sph(garden, 0.18, std([0xd04a2a, 0xf0c040, 0xf4f4f0][k % 3]), -5 + (k % 12) * 0.9, 0.3, (k < 12 ? -6.4 : -0.6), 8, 6);
  shade(scene);
  sea.receiveShadow = false; sea.castShadow = false;

  return {
    spawn: [0, 24, Math.PI], stand: [-12, 22, faceTo(-12, 22, 0, 24)], camR: 44, camY: 24,
    blocked: (x, z) => {
      if (z < QZ + 1.2 || z > 30 || Math.abs(x) > 30) return true;
      if (x > 15.5 && x < 34.5 && Math.abs(z - 8) < 9.6) return true;            // بيت المال
      for (const bx of bollards) if (hyp(x - bx, z - QZ - 0.9) < 0.6) return true;
      for (const lx of lamps) if (hyp(x - lx, z - QZ - 2.4) < 0.4) return true;
      if (kit.has('market')) { for (const [sx, sz] of stalls) if (Math.abs(x - sx) < 1.8 && Math.abs(z - sz) < 2.6) return true; if (x > -14.8 && x < -8 && z < QZ + 5) return true; if (hyp(x + 4, z - QZ - 1.6) < 0.8) return true; }
      if (kit.has('vault') && Math.abs(x) < 3.1 && z > 3.8 && z < 8.1) return true;
      if (kit.has('garden')) { const lx = x - 14, lz = z - 22; if (hyp(lx, lz + 3.5) < 2.6) return true; if ((Math.abs(lx + 6) < 0.8 || Math.abs(lx - 6) < 0.8) && lz > -8.2 && lz < 0.2) return true; if (Math.abs(lz + 8) < 0.8 && Math.abs(lx) < 6.6) return true; }
      return false;
    },
    tick(t, dt, s) {
      const a = seaGeo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = Math.sin(seaBase[i] * 0.08 + t * 0.9) * 0.25 + Math.cos(seaBase[i + 2] * 0.11 + t * 0.7) * 0.2;
      seaGeo.attributes.position.needsUpdate = true; seaGeo.computeVertexNormals();
      seaM.color.setHSL(0.54, 0.6, 0.32 - s.night * 0.2);
      gulls.forEach((g) => { const an = t * g.sp + g.ph; g.g.position.set(g.cx + Math.cos(an) * g.r, g.h + Math.sin(t * 0.7 + g.ph), g.cz + Math.sin(an) * g.r * 0.6); g.g.rotation.y = -an; const f = Math.sin(t * 6 + g.ph) * 0.5; g.w[0].rotation.z = f; g.w[1].rotation.z = -f; });
      if (kit.has('ships')) ships.forEach((sh) => { sh.g.position.y = -0.9 + Math.sin(t * 0.9 + sh.ph) * 0.25; sh.g.rotation.z = Math.sin(t * 0.7 + sh.ph) * 0.04; sh.g.rotation.x = Math.cos(t * 0.6 + sh.ph) * 0.03; sh.fl.tick(t); });
      if (kit.has('market')) netPivot.rotation.x = Math.sin(t * 0.8) * 0.12;
      if (kit.has('vault')) { wheel.rotation.z = Math.sin(t * 0.4) * 1.2 + kit.burstK() * t * 4; sparkle.tick(t, dt); }
      sparkle.mat.opacity = kit.has('vault') ? 1 : 0;
      if (kit.has('lighthouse')) { beam.rotation.y = t * 0.6; beamM.opacity = Math.min(0.22, (s.night + kit.env.W.dim * 0.5) * 0.22); }
    },
    burst: [0xffe07a, 0xffc83d, 0xffffff],
  };
}

// ======================= الغابة الحيّة — nature =======================
function forest(scene, kit) {
  const { rand } = kit;
  const R = 46;
  // Areas kept clear for the upgrades and the walk in.
  const ZONES = [[24, 16, 8, 6.5], [-27, 16, 7, 5], [26, -16, 5, 5]];
  const clear = (x, z) => ZONES.some(([zx, zz, hw, hd]) => Math.abs(x - zx) < hw && Math.abs(z - zz) < hd) || (Math.abs(x) < 7 && z > 6);
  ground(scene, 400, speckle('#4f8a3a', ['#3f7a2e', '#5f9a48', '#6aa850', '#2f6a22'], { repeat: 60, n: 4200 }));
  const meadow = speckle('#5a9a44', ['#4a8a36', '#6ab052', '#ffffff', '#ffd84a', '#c88aff', '#ff8aa8'], { repeat: 18, n: 3000, r: [1, 3] });
  ground(scene, R + 4, meadow, { y: 0.02 });
  // The Tree of Life: twisting trunk, roots, a huge canopy that glows at night.
  const bark = std(0x5a3e28, { roughness: 1 });
  const TZ = -6;
  const tree = group(scene, 0, 0, TZ);
  add(tree, new THREE.LatheGeometry([[3.2, 0], [2.2, 0.8], [1.7, 2.5], [1.5, 6], [1.6, 9], [2.0, 11]].map(([a, b]) => new THREE.Vector2(a, b)), 24), bark);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand() * 0.3, len = 4 + rand() * 3;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 1.5, 1.2, Math.sin(a) * 1.5), new THREE.Vector3(Math.cos(a) * (len * 0.6), 0.4, Math.sin(a) * (len * 0.6)), new THREE.Vector3(Math.cos(a) * len, -0.2, Math.sin(a) * len)]);
    add(tree, new THREE.TubeGeometry(curve, 12, 0.45, 8), bark);
  }
  const limbs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, l = 6 + rand() * 3;
    const end = new THREE.Vector3(Math.cos(a) * l, 14 + rand() * 4, Math.sin(a) * l);
    add(tree, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 10, 0), new THREE.Vector3(Math.cos(a) * l * 0.4, 12.5, Math.sin(a) * l * 0.4), end]), 14, 0.55, 8), bark);
    limbs.push(end);
  }
  const leafM = [std(0x3f8a3a, { flatShading: true, emissive: 0x3aff7a, emissiveIntensity: 0 }), std(0x4f9a3a, { flatShading: true, emissive: 0x7aff9a, emissiveIntensity: 0 }), std(0x2f7a32, { flatShading: true, emissive: 0x2aff8a, emissiveIntensity: 0 })];
  leafM.forEach((m) => kit.glow(m, 0, 0.35));
  for (let i = 0; i < 46; i++) {
    const base = limbs[i % limbs.length];
    const c = add(tree, new THREE.IcosahedronGeometry(2.2 + rand() * 1.6, 1), leafM[i % 3], base.x + (rand() - 0.5) * 5, base.y + (rand() - 0.3) * 3, base.z + (rand() - 0.5) * 5);
    c.scale.y = 0.7;
  }
  const fruitM = lampMat(0xffe07a); kit.glow(fruitM, 0.4, 3);
  const fruits = [];
  for (let i = 0; i < 26; i++) { const b = limbs[i % limbs.length]; const f = sph(tree, 0.28, fruitM, b.x + (rand() - 0.5) * 6, b.y - 2.4 - rand() * 1.5, b.z + (rand() - 0.5) * 6, 12, 8); fruits.push({ f, y: f.position.y, ph: rand() * 6 }); }
  const treeLight = new THREE.PointLight(0x9affc0, 0, 30, 1.4); treeLight.position.set(0, 9, TZ); scene.add(treeLight); kit.glow(treeLight, 0, 30);
  // God rays through the canopy (by day).
  const rayM = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rays = [[-6, 4], [5, 6], [8, -2], [-9, -8], [2, -14]].map(([x, z]) => { const m = add(scene, new THREE.CylinderGeometry(0.6, 2.4, 22, 16, 1, true), rayM, x, 11, z); m.rotation.z = 0.25; m.rotation.x = 0.1; return m; });
  // Waterfall from a mossy cliff into a pool; a stream winding away.
  const rockM = std(0x7a7a72, { flatShading: true, roughness: 1 }), mossM = std(0x4a7a32, { flatShading: true, roughness: 1 });
  const cliff = group(scene, -12, 0, -24, 0.5);
  for (let i = 0; i < 16; i++) { const r = add(cliff, new THREE.DodecahedronGeometry(3 + rand() * 3, 0), i % 4 ? rockM : mossM, (rand() - 0.5) * 18, rand() * 12, (rand() - 0.5) * 4 - 2); r.rotation.set(rand() * 3, rand() * 3, 0); }
  const fallTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0)'; g.clearRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(230,245,255,${0.3 + Math.random() * 0.6})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 20 + Math.random() * 60); } });
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  const fallM = new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, color: 0xdff4ff });
  const fall = add(cliff, new THREE.PlaneGeometry(3.4, 13), fallM, 0, 6.5, 1.6);
  const mist = particles(scene, { n: 90, color: 0xffffff, size: 1.6, additive: false, opacity: 0.25,
    init: () => ({ x: -12 + (rand() - 0.5) * 4, y: rand() * 2, z: -22 + (rand() - 0.5) * 3, s: 0.2 + rand() * 0.5 }),
    step: (d, t, dt) => { d.y += dt * d.s; d.x += Math.sin(t + d.s * 9) * dt * 0.3; if (d.y > 3) { d.y = 0; d.x = -12 + (rand() - 0.5) * 4; } } });
  const poolM = new THREE.MeshPhysicalMaterial({ color: 0x4aa8b8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
  const pool = add(scene, new THREE.CircleGeometry(5.5, 40), poolM, -11, 0.12, -18.5); pool.rotation.x = -Math.PI / 2;
  const streamPts = [[-8, -15], [-5, -10], [-7, -3], [-12, 3], [-15, 10], [-14, 18], [-12, 30], [-16, 44]].map(([x, z]) => new THREE.Vector3(x, 0.1, z));
  const sc = new THREE.CatmullRomCurve3(streamPts);
  const streamTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#4aa8b8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 3); } });
  streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping; streamTex.repeat.set(1, 8);
  const sGeo = (() => { const N = 80, pos = [], uv = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = sc.getPoint(u), tg = sc.getTangent(u), nx = -tg.z, nz = tg.x, w = 1.4; pos.push(p.x + nx * w, 0.11, p.z + nz * w, p.x - nx * w, 0.11, p.z - nz * w); uv.push(0, u, 1, u); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const stream = add(scene, sGeo, new THREE.MeshStandardMaterial({ map: streamTex, roughness: 0.1, transparent: true, opacity: 0.9 }));
  const streamAt = (x, z) => { for (let i = 0; i <= 40; i++) { const p = sc.getPoint(i / 40); if (hyp(x - p.x, z - p.z) < 1.5) return i; } return -1; };
  // A wooden footbridge over the stream.
  const fbP = sc.getPoint(0.5), fbT = sc.getTangent(0.5);
  const fb = group(scene, fbP.x, 0, fbP.z, Math.atan2(fbT.x, fbT.z) + Math.PI / 2);
  for (let i = -5; i <= 5; i++) box(fb, 0.36, 0.12, 2, std(0x8a6a4a), i * 0.38, 0.4 - Math.abs(i) * 0.05, 0);
  for (const sz of [-1, 1]) for (const sx of [-1.9, 0, 1.9]) cyl(fb, 0.06, 0.06, 1.1, std(0x6a4a2a), sx, 0.3, sz, 6);
  // The wood round the glade, ferns, mushrooms, mossy rocks, a fallen log, flowers.
  const pineM = std(0x2f5a2e, { flatShading: true }), roundM = std(0x3f7a32, { flatShading: true });
  const blockers = [];
  for (let i = 0; i < 120; i++) {
    const a = rand() * TAU, r = R + 2 + rand() * 40; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const g = group(scene, x, 0, z); const s = 1 + rand() * 1.2; g.scale.setScalar(s);
    cyl(g, 0.3, 0.45, 3, bark, 0, 0, 0, 6);
    if (i % 3) for (let k = 0; k < 4; k++) add(g, new THREE.ConeGeometry(2.6 - k * 0.5, 2.6, 8), pineM, 0, 3 + k * 1.5, 0);
    else add(g, new THREE.IcosahedronGeometry(2.8, 1), roundM, 0, 5, 0);
  }
  for (let i = 0; i < 40; i++) { const a = rand() * TAU, r = 12 + rand() * 30; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0 || hyp(x, z - TZ) < 8 || (Math.abs(x) < 11 && z > -4) || clear(x, z)) continue; const g = group(scene, x, 0, z); cyl(g, 0.35, 0.5, 4, bark, 0, 0, 0, 6); add(g, new THREE.IcosahedronGeometry(2.4, 1), roundM, 0, 5, 0); blockers.push([x, z, 0.9]); }
  const fernM = std(0x4f9a3a, { side: THREE.DoubleSide });
  for (let i = 0; i < 80; i++) { const a = rand() * TAU, r = 6 + rand() * 38; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0 || clear(x, z)) continue; const g = group(scene, x, 0, z, rand() * 6); for (let k = 0; k < 6; k++) { const f = add(g, new THREE.PlaneGeometry(0.35, 1.4), fernM, 0, 0.5, 0); f.geometry.translate(0, 0.5, 0); f.rotation.set(0.8, (k / 6) * TAU, 0, 'YXZ'); } }
  const capM = std(0xd8302a, { emissive: 0xff4a2a, emissiveIntensity: 0 }); kit.glow(capM, 0, 0.6);
  const capB = std(0x3aa8ff, { emissive: 0x3ad0ff, emissiveIntensity: 0 }); kit.glow(capB, 0, 1.4);
  for (let i = 0; i < 50; i++) { const a = rand() * TAU, r = 5 + rand() * 38; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0 || clear(x, z)) continue; const s = 0.5 + rand() * 0.8; cyl(scene, 0.07 * s, 0.1 * s, 0.5 * s, std(0xf2ead8), x, 0, z, 8); const cap = add(scene, new THREE.SphereGeometry(0.3 * s, 14, 8, 0, TAU, 0, Math.PI / 2), i % 3 ? capM : capB, x, 0.5 * s, z); }
  for (let i = 0; i < 22; i++) { const a = rand() * TAU, r = 9 + rand() * 34; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0 || clear(x, z)) continue; const s = 0.8 + rand(); const rk = add(scene, new THREE.DodecahedronGeometry(s, 0), rockM, x, s * 0.4, z); rk.scale.y = 0.6; const ms = add(scene, new THREE.DodecahedronGeometry(s * 0.9, 0), mossM, x, s * 0.62, z); ms.scale.set(1, 0.25, 1); blockers.push([x, z, s]); }
  const log = add(scene, new THREE.CylinderGeometry(0.6, 0.7, 6, 12), bark, 12, 0.6, 4); log.rotation.set(0, 0.6, Math.PI / 2); blockers.push([12, 4, 1.4], [14.5, 2.4, 1.2], [9.5, 5.6, 1.2]);

  // ---- upgrades ----
  // wind turbines on the hills
  const turbG = group(scene); kit.feat('turbines', turbG);
  const whiteM = std(0xf2f2ee, { roughness: 0.5 });
  const rotors = [[-40, -70], [-12, -82], [18, -78], [46, -64]].map(([x, z]) => {
    const hill = add(turbG, new THREE.SphereGeometry(18, 20, 10, 0, TAU, 0, Math.PI / 2), std(0x4f8a3a, { roughness: 1 }), x, -6, z); hill.scale.y = 0.5;
    cyl(turbG, 0.6, 1, 30, whiteM, x, 2, z, 12);
    const hub = group(turbG, x, 32, z + 1, 0.2); box(hub, 1.4, 1.4, 3, whiteM, 0, -0.7, -1);
    const rot = group(hub, 0, 0, 0.6); for (let k = 0; k < 3; k++) { const bl = group(rot, 0, 0, 0); bl.rotation.z = (k / 3) * TAU; box(bl, 0.8, 13, 0.25, whiteM, 0, 0, 0).position.y = 6.5; }
    const tipM = lampMat(0xff3020); sph(hub, 0.25, tipM, 0, 0.9, -1, 8, 6); kit.glow(tipM, 0.2, 2.5);
    return rot;
  });
  // solar panels
  const solarG = group(scene, 24, 0, 16); kit.feat('solar', solarG);
  const panelM = new THREE.MeshStandardMaterial({ map: canvasTex(128, 64, (g) => { g.fillStyle = '#1a2a5a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#8aa0d0'; g.lineWidth = 1; for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); } for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } }), metalness: 0.6, roughness: 0.2 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const p = group(solarG, -5.4 + i * 3.6, 0, -4 + j * 4); for (const sx of [-1.2, 1.2]) cyl(p, 0.06, 0.06, 1.4, std(0x888888, { metalness: 0.8 }), sx, 0, 0.4, 6); const pn = add(p, new THREE.BoxGeometry(3.2, 0.08, 1.9), panelM, 0, 1.3, 0); pn.rotation.x = -0.5; }
  const solarSign = add(solarG, new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshStandardMaterial({ map: textTex(['☀ طاقة نظيفة'], { w: 512, h: 96, bg: '#1e4a2a', fg: '#fff' }) }), 0, 1.2, 6.4);
  // greenhouse with vegetables
  const gh = group(scene, -27, 0, 16, Math.PI / 2); kit.feat('greenhouse', gh);
  const ghGlass = new THREE.MeshPhysicalMaterial({ color: 0xdff4ec, roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  const frameM = std(0xf4f4f0, { metalness: 0.5 });
  box(gh, 12, 3.2, 8, ghGlass, 0, 0, 0);
  const roofL = add(gh, new THREE.PlaneGeometry(12, 4.8), ghGlass, 0, 4.4, -1.95); roofL.rotation.x = -0.95;
  const roofR = add(gh, new THREE.PlaneGeometry(12, 4.8), ghGlass, 0, 4.4, 1.95); roofR.rotation.x = 0.95;
  for (let x = -6; x <= 6; x += 2) { box(gh, 0.1, 3.2, 0.1, frameM, x, 0, -4); box(gh, 0.1, 3.2, 0.1, frameM, x, 0, 4); }
  box(gh, 12.2, 0.12, 0.12, frameM, 0, 5.85, 0);
  const veg = [0x3f9a3a, 0xd02a1a, 0xf0a020, 0x7ac040];
  for (let r = -1; r <= 1; r++) { box(gh, 10, 0.5, 1.4, std(0x6a4a2a), 0, 0, r * 2.4); for (let k = 0; k < 9; k++) { sph(gh, 0.32, std(0x3f8a3a, { flatShading: true }), -4.4 + k * 1.1, 0.75, r * 2.4, 8, 6); if (k % 2) sph(gh, 0.12, std(veg[(k + r + 3) % 4]), -4.4 + k * 1.1, 0.95, r * 2.4 + 0.2, 8, 6); } }
  // animals: deer grazing, rabbits hopping, a flock of birds
  const animG = group(scene); kit.feat('animals', animG);
  const furM = std(0x8a5a32, { roughness: 1 }), lightFur = std(0xd8c0a0, { roughness: 1 });
  const deer = [[8, 18], [-14, -20], [30, -2]].map(([x, z]) => {
    const g = group(animG, x, 0, z);
    add(g, new THREE.CapsuleGeometry(0.42, 1.3, 4, 10), furM, 0, 1.45, 0).rotation.z = Math.PI / 2;
    for (const [lx, lz] of [[-0.6, -0.22], [-0.6, 0.22], [0.6, -0.22], [0.6, 0.22]]) cyl(g, 0.07, 0.06, 1.1, furM, lx, 0, lz, 6);
    const neck = group(g, 0.8, 1.6, 0); add(neck, new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), furM, 0.2, 0.35, 0).rotation.z = -0.5;
    const head = add(neck, new THREE.SphereGeometry(0.24, 10, 8), furM, 0.5, 0.8, 0); head.scale.set(1.4, 0.9, 0.9);
    for (const sz of [-0.12, 0.12]) { const an = add(neck, new THREE.CylinderGeometry(0.025, 0.035, 0.7, 5), lightFur, 0.4, 1.25, sz); an.rotation.z = 0.3; an.rotation.x = sz * 2; }
    add(g, new THREE.SphereGeometry(0.14, 8, 6), lightFur, -0.95, 1.6, 0);
    return { g, neck, x, z, a: rand() * TAU, t: rand() * 5, ph: rand() * 6 };
  });
  const rabbits = Array.from({ length: 5 }, () => { const g = group(animG, (rand() - 0.5) * 50, 0, (rand() - 0.5) * 50); sph(g, 0.25, lightFur, 0, 0.25, 0, 10, 8).scale.set(1.3, 1, 1); sph(g, 0.15, lightFur, 0.3, 0.42, 0, 8, 6); for (const sz of [-0.06, 0.06]) { const e = add(g, new THREE.CapsuleGeometry(0.04, 0.22, 3, 6), lightFur, 0.3, 0.68, sz); } return { g, a: rand() * TAU, ph: rand() * 6 }; });
  const birdM = std(0x2a2a2e, { side: THREE.DoubleSide });
  const birds = Array.from({ length: 10 }, (_, i) => { const g = group(animG); const w = [-1, 1].map((sx) => add(g, new THREE.PlaneGeometry(0.7, 0.18), birdM, sx * 0.35, 0, 0)); return { g, w, ph: i * 0.3, r: 26 + (i % 3) * 3 }; });
  // beehives with bees round the flowers
  const hives = group(scene, 26, 0, -16); kit.feat('beehives', hives);
  for (let k = 0; k < 3; k++) { const hv = group(hives, -2.4 + k * 2.4, 0, 0); box(hv, 1.2, 0.3, 1, std(0x6a4a2a), 0, 0, 0); for (let f = 0; f < 3; f++) box(hv, 1, 0.42, 0.9, std(f % 2 ? 0xf0c040 : 0xf4f0e0), 0, 0.3 + f * 0.43, 0); box(hv, 1.2, 0.1, 1.1, std(0x8a6a4a), 0, 1.6, 0); }
  for (let k = 0; k < 40; k++) { const a = rand() * TAU, r = 1.5 + rand() * 3.5; sph(hives, 0.16, std([0xf0c040, 0xc88aff, 0xf4f4f0, 0xff8a5a][k % 4]), Math.cos(a) * r, 0.3, Math.sin(a) * r + 2.2, 8, 6); }
  const bees = particles(scene, { n: 60, color: 0xffd040, size: 0.12, additive: false, init: () => ({ x: 26, y: 1, z: -14, a: rand() * TAU, r: 1 + rand() * 4, sp: 1 + rand() * 2, ph: rand() * 6 }), step: (d, t) => { d.x = 26 + Math.cos(t * d.sp + d.ph) * d.r; d.z = -14 + Math.sin(t * d.sp * 1.3 + d.ph) * d.r; d.y = 0.8 + Math.sin(t * 5 + d.ph) * 0.4; } });
  shade(scene);

  // Butterflies by day, fireflies by night.
  const wingCols = [0xffa040, 0x6ab0ff, 0xff70b0, 0xffe050];
  const flies = Array.from({ length: 22 }, (_, i) => {
    const g = group(scene, 0, 1, 0); const wm = std(wingCols[i % 4], { side: THREE.DoubleSide, emissive: wingCols[i % 4], emissiveIntensity: 0.2 });
    const wings = [-1, 1].map((s2) => { const w = add(g, new THREE.CircleGeometry(0.22, 8), wm); w.geometry.translate(s2 * 0.2, 0, 0); return w; });
    return { g, wings, cx: (rand() - 0.5) * 60, cz: (rand() - 0.5) * 60, r: 1 + rand() * 3, sp: 0.4 + rand() * 0.5, ph: rand() * 6 };
  });
  const ff = particles(scene, { n: 320, color: 0xc8ff6a, size: 0.26, opacity: 0,
    init: () => ({ x: (rand() - 0.5) * 90, y: 0.5 + rand() * 4, z: (rand() - 0.5) * 90, ph: rand() * 6 }),
    step: (d, t, dt) => { d.x += Math.sin(t * 0.6 + d.ph) * dt * 0.5; d.z += Math.cos(t * 0.5 + d.ph * 2) * dt * 0.5; d.y = 1 + Math.sin(t * 0.8 + d.ph) * 1.2 + 1.2 + kit.burstK() * 4 * Math.sin(d.ph); } });

  return {
    spawn: [0, 24, Math.PI], stand: [11, 8, faceTo(11, 8, 0, 24)], camR: R + 2, camY: 26,
    groundAt: (x, z) => { const l = new THREE.Vector3(x - fbP.x, 0, z - fbP.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -fb.rotation.y); return Math.abs(l.x) < 2.1 && Math.abs(l.z) < 1 ? 0.45 - Math.abs(l.x) * 0.05 : 0; },
    blocked: (x, z) => {
      if (hyp(x, z) > R) return true;
      if (hyp(x, z - TZ) < 3.6) return true;
      for (let i = 0; i < 9; i++) { /* roots are low: walk over them */ }
      if (hyp(x + 11, z + 18.5) < 5.8 || hyp(x + 12, z + 24) < 8) return true;
      const l = new THREE.Vector3(x - fbP.x, 0, z - fbP.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -fb.rotation.y);
      const onBridge = Math.abs(l.x) < 2.1 && Math.abs(l.z) < 0.8;
      if (!onBridge && streamAt(x, z) >= 0) return true;
      for (const [bx, bz, r] of blockers) if (hyp(x - bx, z - bz) < r) return true;
      if (kit.has('solar') && Math.abs(x - 24) < 7.4 && Math.abs(z - 16) < 6) return true;
      if (kit.has('greenhouse') && Math.abs(x + 27) < 4.2 && Math.abs(z - 16) < 6.2) return true;
      if (kit.has('beehives') && Math.abs(x - 26) < 3.2 && Math.abs(z + 16) < 0.8) return true;
      return false;
    },
    tick(t, dt, s) {
      fallTex.offset.y = -t * 1.6; streamTex.offset.y = -t * 0.35;
      mist.tick(t, dt);
      rayM.opacity = 0.07 * (1 - s.night) * (1 - kit.env.W.dim);
      fruits.forEach((f) => { f.f.position.y = f.y + Math.sin(t * 1.4 + f.ph) * 0.15; });
      const day = 1 - s.night;
      flies.forEach((b) => { b.g.visible = day > 0.3; const a = t * b.sp + b.ph; b.g.position.set(b.cx + Math.cos(a) * b.r, 1.2 + Math.sin(t * 1.3 + b.ph) * 0.6, b.cz + Math.sin(a * 1.3) * b.r); b.g.rotation.y = -a; const fl = Math.sin(t * 18 + b.ph) * 1.1; b.wings[0].rotation.y = fl; b.wings[1].rotation.y = -fl; });
      ff.tick(t, dt); ff.mat.opacity = Math.max(s.night, kit.burstK()) * 0.95;
      if (kit.has('turbines')) rotors.forEach((r, i) => (r.rotation.z -= dt * (0.8 + kit.env.W.dim + i * 0.05)));
      if (kit.has('animals')) {
        deer.forEach((d2) => { d2.t -= dt; if (d2.t < 0) { d2.a += (rand() - 0.5) * 2; d2.t = 3 + rand() * 4; } const moving = d2.t > 2; if (moving) { const nx = d2.g.position.x + Math.cos(d2.a) * dt * 0.8, nz = d2.g.position.z + Math.sin(d2.a) * dt * 0.8; if (hyp(nx, nz) < R - 4 && streamAt(nx, nz) < 0 && hyp(nx, nz - TZ) > 5) d2.g.position.set(nx, 0, nz); else d2.a += Math.PI; } d2.g.rotation.y = -d2.a; d2.neck.rotation.z = moving ? 0 : -0.9 + Math.sin(t * 2 + d2.ph) * 0.1; });
        rabbits.forEach((r) => { r.a += Math.sin(t * 0.3 + r.ph) * 0.02; const hop = Math.max(0, Math.sin(t * 6 + r.ph)); const nx = r.g.position.x + Math.cos(r.a) * hop * dt * 1.6, nz = r.g.position.z + Math.sin(r.a) * hop * dt * 1.6; if (hyp(nx, nz) < R - 4) r.g.position.set(nx, hop * 0.3, nz); else r.a += Math.PI; r.g.rotation.y = -r.a; });
        birds.forEach((b) => { const an = t * 0.18 + b.ph; b.g.position.set(Math.cos(an) * b.r, 22 + Math.sin(t + b.ph) * 1.5, -10 + Math.sin(an) * b.r * 0.7); b.g.rotation.y = -an; const f = Math.sin(t * 7 + b.ph * 5) * 0.6; b.w[0].rotation.z = f; b.w[1].rotation.z = -f; });
      }
      bees.mat.opacity = kit.has('beehives') ? 1 : 0; if (kit.has('beehives')) bees.tick(t, dt);
    },
    burst: [0x9aff7a, 0xffe07a, 0xc8ff6a],
  };
}


export const DIM_SCENES = { library, body: wellness, heart: heartGarden, social: village, career: plaza, wealth: harbor, nature: forest };

// Look and light per place.
export const DIM_ENV = {
  library: { fog: 0xd8dce8, golden: 0xe8c08c, far: 260, shadow: 30 },
  body:    { fog: 0xd2e2f0, golden: 0xf0b88a, far: 320, shadow: 46 },
  heart:   { fog: 0xe4e0d0, golden: 0xf0c08a, far: 240, shadow: 36 },
  social:  { fog: 0xf0dcc0, golden: 0xf0a868, far: 260, shadow: 36 },
  career:  { fog: 0xd6dbe2, golden: 0xe8b890, far: 340, shadow: 40 },
  wealth:  { fog: 0xd8e4ec, golden: 0xf8c070, far: 420, shadow: 40 },
  nature:  { fog: 0xd2e8cc, golden: 0xe8d098, far: 260, shadow: 52 },
};
