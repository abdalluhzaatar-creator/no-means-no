// The seven dimension places, each with its own world and mood:
//   library → دار الحكمة: an open-sky octagonal library around a golden armillary sphere
//   body    → ساحة الأبطال: a stadium with a track, crowds, training gear and an Olympic flame
//   heart   → حديقة السكينة: a blossom garden with a heart pond, koi, a red bridge and lanterns
//   social  → ساحة اللمّة: a village square around a bonfire, people sitting together
//   career  → ورشة الإنجاز: a construction site with a rising tower, a crane, gears and sparks
//   wealth  → سوق الذهب: a bazaar of striped stalls around a golden treasury
//   nature  → الغابة الحيّة: a forest glade with a giant glowing tree and a waterfall
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
  const lamps = [];
  ring(4, 18, (x, z) => {
    cyl(scene, 0.12, 0.18, 4.2, gold, x, 0, z, 8);
    const m = lampMat(0xffd38a); const lamp = sph(scene, 0.42, m, x, 4.6, z, 16, 12); kit.glow(m, 0.3, 2.2);
    const l = new THREE.PointLight(0xffc878, 0, 18, 1.6); l.position.set(x, 4.6, z); scene.add(l); kit.glow(l, 0, 12);
    lamps.push([x, z]);
  }, Math.PI / 4 + 0.39);
  // A globe on its stand and scroll piles.
  const globeG = group(scene, -7, 0, 9);
  cyl(globeG, 0.12, 0.3, 1.6, wood, 0, 0, 0, 8);
  const globeTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2a5a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9c38a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(Math.random() * w, 20 + Math.random() * (h - 40), 10 + Math.random() * 26, 6 + Math.random() * 16, Math.random() * 3, 0, 7); g.fill(); } });
  const globe = sph(globeG, 0.75, new THREE.MeshStandardMaterial({ map: globeTex, roughness: 0.5 }), 0, 2.4, 0, 32, 20);
  const meridian = add(globeG, new THREE.TorusGeometry(0.85, 0.04, 6, 40), gold, 0, 2.4, 0);
  for (let i = 0; i < 9; i++) { const sc = add(scene, new THREE.CylinderGeometry(0.16, 0.16, 1.1, 12), parch, 7 + (i % 3) * 0.36, 0.18 + Math.floor(i / 3) * 0.3, 9 + (i % 2) * 0.1); sc.rotation.z = Math.PI / 2; }
  shade(scene);

  // Pages flying in a slow spiral round the sphere, and golden dust.
  const pageM = new THREE.MeshStandardMaterial({ color: 0xf6ead0, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x6a5a30, emissiveIntensity: 0.2 });
  const pages = Array.from({ length: 34 }, (_, i) => { const m = add(scene, new THREE.PlaneGeometry(0.55, 0.75), pageM); return { m, a: rand() * TAU, r: 4 + rand() * 4.5, y: 1.5 + rand() * 9, sp: 0.15 + rand() * 0.2, ph: rand() * 6 }; });
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
      dust.tick(t, dt);
    },
    burst: [0xffe7a8, 0xf6ead0, 0x9fe3ff],
  };
}

// ======================= ساحة الأبطال — body =======================
function arena(scene, kit) {
  const { rand } = kit;
  const R = 30;
  ground(scene, 400, speckle('#5f9a48', ['#4e8a3a', '#6fae58', '#3e7a2e'], { repeat: 70 }));
  // Field + running track + sand, painted on one disc.
  const fieldTex = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2, px = c / R;
    g.fillStyle = '#d8c39a'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#b8402e'; g.beginPath(); g.arc(c, c, 27.5 * px, 0, 7); g.fill();
    g.fillStyle = '#3f9a48'; g.beginPath(); g.arc(c, c, 21.5 * px, 0, 7); g.fill();
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#3a9044' : '#45a04e'; g.beginPath(); g.arc(c, c, (21.5 - i * 1.5) * px, 0, 7); g.fill(); }
    g.strokeStyle = '#ffffffdd'; g.lineWidth = 3;
    for (let i = 0; i <= 5; i++) { g.beginPath(); g.arc(c, c, (21.6 + i * 1.18) * px, 0, 7); g.stroke(); }
    g.lineWidth = 4; g.beginPath(); g.arc(c, c, 5 * px, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(c - 21.5 * px, c); g.lineTo(c + 21.5 * px, c); g.stroke();
    g.fillStyle = '#fff'; g.font = `bold ${px * 1.1}px system-ui`; g.textAlign = 'center';
    for (let i = 0; i < 5; i++) g.fillText(String(i + 1), c + (22.2 + i * 1.18) * px, c + 2.2 * px);
  });
  const field = ground(scene, R, fieldTex, { y: 0.03, rough: 0.9 });
  // Stepped stands all round with a crowd.
  const conc = std(0xb8b2a6, { roughness: 0.95 }), seat = std(0xc0392b, { roughness: 0.7 }), seat2 = std(0xf2f2f2, { roughness: 0.7 });
  const TIERS = 8;
  for (let i = 0; i < TIERS; i++) {
    const r0 = R + 0.5 + i * 1.5, h = 0.9 + i * 0.9;
    const step = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 1.5, 96), i % 2 ? seat : seat2); step.rotation.x = -Math.PI / 2; step.position.y = h; step.receiveShadow = true; scene.add(step);
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, 0.9, 96, 1, true), conc); riser.position.y = h - 0.45; riser.receiveShadow = true; scene.add(riser);
  }
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5 + TIERS * 1.5, R + 0.5 + TIERS * 1.5, TIERS * 0.9 + 2.6, 96, 1, true), std(0x9a948a, { side: THREE.DoubleSide })); outer.position.y = (TIERS * 0.9 + 2.6) / 2; scene.add(outer);
  const rimM = std(0xc0392b); const rim = add(scene, new THREE.TorusGeometry(R + 0.5 + TIERS * 1.5, 0.4, 8, 96), rimM, 0, TIERS * 0.9 + 2.6, 0); rim.rotation.x = Math.PI / 2;
  const CROWD = 900, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 6), std(0xffffff, { roughness: 0.8 }), CROWD);
  const crowdBase = [];
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  const shirt = [0xc0392b, 0xf2f2f2, 0x2a5a9a, 0xf0c040, 0x2e8a4a, 0x222222, 0xe67e22];
  for (let i = 0; i < CROWD; i++) {
    const tier = (rand() * TIERS) | 0, a = rand() * TAU, r = R + 1.1 + tier * 1.5 + rand() * 0.6;
    const y = 0.9 + tier * 0.9 + 0.48;
    crowdBase.push([Math.cos(a) * r, y, Math.sin(a) * r, rand() * 6]);
    mtx.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); crowd.setMatrixAt(i, mtx);
    crowd.setColorAt(i, col.set(shirt[(rand() * shirt.length) | 0]));
  }
  scene.add(crowd);
  // Floodlight towers.
  ring(4, R + 16, (x, z, a) => {
    cyl(scene, 0.4, 0.6, 26, std(0x8a8a8a, { metalness: 0.6, roughness: 0.4 }), x, 0, z, 10);
    const head = group(scene, x, 26, z, faceTo(x, z));
    const pm = lampMat(0xfffbe6); box(head, 5, 2.4, 0.5, pm, 0, 0, 0); kit.glow(pm, 0.2, 3);
    const spot = new THREE.SpotLight(0xfff6e0, 0, 90, 0.5, 0.6, 1.2); spot.position.set(x, 26, z); spot.target.position.set(0, 0, 0); scene.add(spot, spot.target); kit.glow(spot, 0, 420);
  }, Math.PI / 4);
  // Olympic flame on a column at the far end.
  cyl(scene, 1.4, 1.8, 7, std(0xe8e0d0), 0, 0, -R + 1.5, 20);
  const bowl = add(scene, new THREE.CylinderGeometry(2.2, 1.2, 1.2, 24, 1, true), std(0xd4a53a, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }), 0, 7.6, -R + 1.5);
  const flame = fire(scene, 0, 7.6, -R + 1.5, 2.6, { light: 60, dist: 14 });
  // Scoreboard over the stands.
  const board = group(scene, 0, 12, R + 13, Math.PI);
  box(board, 14, 7, 0.6, std(0x1a1a1a), 0, 0, 0);
  const screenM = new THREE.MeshBasicMaterial({ map: textTex(['ساحة الأبطال', 'كل يوم أقوى من اللي قبله 💪'], { bg: '#0c1a2a', fg: '#ffd84a' }) });
  add(board, new THREE.PlaneGeometry(13, 6.2), screenM, 0, 3.5, 0.32);
  for (const sx of [-5, 5]) cyl(scene, 0.3, 0.3, 12, std(0x555555), sx, 0, R + 13.4, 8);

  // Training gear on the infield.
  const steel = std(0x9aa2aa, { metalness: 0.9, roughness: 0.3 }), black = std(0x1e1e1e, { roughness: 0.6 }), red = std(0xc0392b, { roughness: 0.5 });
  const props = [];
  // bench press
  const bench = group(scene, -9, 0, -6, 0.4); props.push([-9, -6, 2.2]);
  box(bench, 0.8, 0.9, 3, red, 0, 0, 0); for (const sx of [-0.8, 0.8]) box(bench, 0.12, 2.4, 0.12, steel, sx, 0, -1.2);
  const bar = add(bench, new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), steel, 0, 2.3, -1.2); bar.rotation.z = Math.PI / 2;
  for (const sx of [-1.3, 1.3]) { const pl = add(bench, new THREE.CylinderGeometry(0.55, 0.55, 0.16, 20), black, sx, 2.3, -1.2); pl.rotation.z = Math.PI / 2; }
  // dumbbell rack
  const rack = group(scene, 9, 0, -7, -0.5); props.push([9, -7, 2.4]);
  box(rack, 4, 0.9, 1, steel, 0, 0, 0);
  for (let i = 0; i < 6; i++) { const db = group(rack, -1.6 + i * 0.64, 1.1, 0); const h = add(db, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), steel); h.rotation.x = Math.PI / 2; for (const s2 of [-0.25, 0.25]) { const w = add(db, new THREE.CylinderGeometry(0.1 + i * 0.015, 0.1 + i * 0.015, 0.12, 12), black, 0, 0, s2); w.rotation.x = Math.PI / 2; } }
  // pull-up bar
  const pull = group(scene, 0, 0, -13); props.push([0, -13, 2.6]);
  for (const sx of [-1.6, 1.6]) cyl(pull, 0.1, 0.1, 4.6, steel, sx, 0, 0, 8);
  const pb = add(pull, new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), steel, 0, 4.4, 0); pb.rotation.z = Math.PI / 2;
  // punching bag that swings
  const bagFrame = group(scene, 10, 0, 6); props.push([10, 6, 1.8]);
  cyl(bagFrame, 0.1, 0.12, 5.2, black, -1.4, 0, 0, 8); const arm = add(bagFrame, new THREE.BoxGeometry(1.8, 0.14, 0.14), black, -0.6, 5.2, 0);
  const bagPivot = group(bagFrame, 0, 5.1, 0);
  add(bagPivot, new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4), steel, 0, -0.4, 0);
  const bag = add(bagPivot, new THREE.CapsuleGeometry(0.45, 1.5, 4, 14), red, 0, -1.9, 0);
  // tyres and cones
  for (let i = 0; i < 3; i++) { const ty = add(scene, new THREE.TorusGeometry(0.6, 0.25, 10, 24), black, -10, 0.25 + i * 0.48, 6); ty.rotation.x = Math.PI / 2; } props.push([-10, 6, 1.2]);
  ring(10, 7, (x, z) => { cyl(scene, 0.03, 0.28, 0.6, std(0xff7a1a), x + 1, 0, z + 10, 10); }, 0.2);
  // hurdles along the track
  ring(8, 24.5, (x, z, a) => { const h = group(scene, x, 0, z, -a); for (const s2 of [-0.7, 0.7]) box(h, 0.08, 1, 0.08, std(0xffffff), s2, 0, 0); box(h, 1.6, 0.18, 0.06, std(0x222222), 0, 1, 0); }, 0.3);
  // podium
  const pod = group(scene, -14, 0, -14, faceTo(-14, -14)); props.push([-14, -14, 3]);
  [[0, 1.6, 0xd4a53a, '1'], [-1.9, 1.1, 0xc0c6cc, '2'], [1.9, 0.7, 0xb0743f, '3']].forEach(([x, h, c, n]) => { box(pod, 1.8, h, 1.8, std(c, { metalness: 0.6, roughness: 0.35 }), x, 0, 0); const tag = add(pod, new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: textTex([n], { w: 128, h: 128, bg: '#00000000', fg: '#fff' }), transparent: true }), x, h / 2, 0.92); });
  // flags on the rim
  const flags = [];
  const flagCols = ['#c0392b', '#f2f2f2', '#2a5a9a', '#f0c040'];
  ring(16, R + 0.5 + TIERS * 1.5, (x, z, a, i) => {
    const top = TIERS * 0.9 + 2.6;
    cyl(scene, 0.06, 0.06, 5, steel, x, top, z, 6);
    const ft = canvasTex(64, 32, (g) => { g.fillStyle = flagCols[i % 4]; g.fillRect(0, 0, 64, 32); g.fillStyle = '#ffffff55'; g.fillRect(0, 12, 64, 8); });
    flags.push(flag(scene, 2.2, 1.3, ft, x, top + 4.3, z, -a));
  });
  shade(scene);
  crowd.castShadow = false;

  const confettiCols = [0xff4a4a, 0xffd84a, 0x4aa8ff, 0x5ae07a, 0xffffff];
  let cheer = 0;
  return {
    spawn: [0, 14, Math.PI], stand: [-15, 3, faceTo(-15, 3, 0, 14)], camR: R - 1, camY: 22,
    blocked: (x, z) => {
      if (hyp(x, z) > R - 1.2) return true;
      if (hyp(x, z + R - 1.5) < 2.4) return true;
      for (const [px, pz, r] of props) if (hyp(x - px, z - pz) < r) return true;
      return false;
    },
    tick(t, dt, s, hero) {
      flame.tick(t);
      flags.forEach((f) => f.tick(t));
      bagPivot.rotation.z = Math.sin(t * 1.6) * 0.18 + Math.sin(t * 0.7) * 0.06;
      bagPivot.rotation.x = Math.cos(t * 1.3) * 0.08;
      // The crowd bounces when you do well; a soft wave runs round the stands otherwise.
      cheer = Math.max(cheer - dt * 0.35, kit.burstK());
      for (let i = 0; i < CROWD; i += 1) {
        const [x, y, z, ph] = crowdBase[i];
        const wave = Math.max(0, Math.sin(Math.atan2(z, x) * 1 - t * 1.4)) ** 8 * 0.5;
        const jump = cheer > 0 ? Math.abs(Math.sin(t * 9 + ph)) * 0.6 * cheer : 0;
        mtx.makeTranslation(x, y + wave + jump, z); crowd.setMatrixAt(i, mtx);
      }
      crowd.instanceMatrix.needsUpdate = true;
    },
    burst: confettiCols,
  };
}

// ======================= حديقة السكينة — heart =======================
function heartGarden(scene, kit) {
  const { rand } = kit;
  const R = 32;
  ground(scene, 400, speckle('#86c070', ['#76b060', '#96d080', '#ffb3cc', '#ffffff'], { repeat: 50, n: 3200 }));
  // Heart pond.
  const PZ = -6, PS = 1.55;
  const sh = new THREE.Shape(); sh.moveTo(0, -3.4); sh.bezierCurveTo(-5.4, 0.6, -3.8, 5.2, 0, 2.8); sh.bezierCurveTo(3.8, 5.2, 5.4, 0.6, 0, -3.4);
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
    if (i % 3 === 0) for (let k = 0; k < 6; k++) { const pe = add(scene, new THREE.SphereGeometry(0.16, 8, 6), std(0xffb3d0, { emissive: 0xff7aa8, emissiveIntensity: 0.15 }), x + Math.cos(k) * 0.12, 0.42, z + Math.sin(k) * 0.12); pe.scale.set(0.6, 1.3, 0.6); pe.rotation.z = 0.5; }
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
  box(pav, 2, 0.3, 1.4, std(0xe8a0b8), 0, 0.4, 0);
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
  // Cherry blossom trees all round.
  const trunkM = std(0x5a3a2a, { roughness: 1 });
  const blossom = [std(0xffb7cf, { flatShading: true, roughness: 0.9 }), std(0xff9ec0, { flatShading: true, roughness: 0.9 }), std(0xffd0e0, { flatShading: true, roughness: 0.9 })];
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
  shade(scene);

  // Falling petals and, at night, fireflies.
  const petals = particles(scene, { n: 420, color: 0xffb3cf, size: 0.22, additive: false, opacity: 0.95,
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
      return false;
    },
    tick(t, dt, s) {
      koi.forEach((k) => { k.a += dt * k.sp; const x = Math.cos(k.a) * k.r, z = PZ + Math.sin(k.a) * k.r * 0.75 + k.cy; k.g.position.set(x, 0.18, z); k.g.rotation.y = Math.atan2(-Math.sin(k.a) * k.sp, Math.cos(k.a) * k.sp * 0.75); k.tail.rotation.y = Math.sin(t * 8 + k.r) * 0.5; });
      waterM.color.setHSL(0.52, 0.45, 0.6 - s.night * 0.35);
      petals.tick(t, dt); flies.tick(t, dt); flies.mat.opacity = s.night * 0.95;
    },
    burst: [0xff7aa8, 0xffb3cf, 0xffffff],
    burstTex: 'heart',
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
  ring(14, 5.4, (x, z, a, i) => {
    if (i % 7 === 3) return;   // gaps to walk in
    const c = group(scene, x, 0, z, faceTo(x, z)); box(c, 1.6, 0.45, 1.2, std(cushions[i % 5], { roughness: 1 }), 0, 0, 0); box(c, 1.6, 0.9, 0.35, std(cushions[(i + 2) % 5], { roughness: 1 }), 0, 0.3, -0.5);
  });
  ring(4, 3.4, (x, z) => {
    const tb = group(scene, x, 0, z); cyl(tb, 0.7, 0.7, 0.12, std(0x8a5a34), 0, 0.42, 0, 20); cyl(tb, 0.12, 0.2, 0.42, std(0x6a4a2a), 0, 0, 0, 8);
    const dallah = add(tb, new THREE.LatheGeometry([[0.001, 0], [0.18, 0], [0.2, 0.08], [0.12, 0.26], [0.1, 0.36], [0.16, 0.44], [0.001, 0.5]].map(([a, b]) => new THREE.Vector2(a, b)), 16), std(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), 0.2, 0.54, 0);
    for (let k = 0; k < 3; k++) cyl(tb, 0.05, 0.04, 0.08, std(0xf6f0e0), -0.2 + k * 0.15, 0.54, 0.3, 8);
  }, Math.PI / 4);
  // People sitting round the fire and chatting.
  const people = [];
  [[0.5, 5.4], [1.4, 5.4], [2.6, 5.4], [3.7, 5.4], [5.0, 5.4]].forEach(([a, r], i) => {
    const p = buildWorshipper(PALS[i]); const x = Math.cos(a) * r, z = Math.sin(a) * r;
    p.root.position.set(x, 0.2, z); p.root.rotation.y = faceTo(x, z); scene.add(p.root); p.kneel(1e6); people.push({ p, next: 3 + rand() * 6 });
  });
  [[-13, 9, 0], [-11.6, 10.2, 1]].forEach(([x, z, k]) => { const p = buildWorshipper(PALS[4 + k]); p.root.position.set(x, 0, z); p.root.rotation.y = faceTo(x, z, k ? -13 : -11.6, k ? 9 : 10.2); scene.add(p.root); people.push({ p, next: 2 + rand() * 4, talk: true }); });
  // String lights between poles.
  const bulbs = [0xffd070, 0xff8a70, 0x8ad0ff, 0xa0ff9a, 0xffffff];
  const poles = [];
  ring(8, 15, (x, z) => { cyl(scene, 0.1, 0.14, 6.5, std(0x5a3a22), x, 0, z, 8); poles.push(new THREE.Vector3(x, 6.4, z)); }, 0.2);
  const bulbMs = bulbs.map((c) => { const m = lampMat(c); kit.glow(m, 0.3, 3); return m; });
  poles.forEach((p, i) => {
    const q2 = poles[(i + 1) % poles.length];
    for (let k = 1; k < 14; k++) { const u = k / 14; const pt = p.clone().lerp(q2, u); pt.y -= Math.sin(u * Math.PI) * 1.6; sph(scene, 0.12, bulbMs[k % bulbMs.length], pt.x, pt.y, pt.z, 8, 6); }
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 11 }, (_, k) => { const u = k / 10, pt = p.clone().lerp(q2, u); pt.y -= Math.sin(u * Math.PI) * 1.6 - 0.12; return pt; }));
    add(scene, new THREE.TubeGeometry(curve, 20, 0.015, 4), std(0x222222));
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

  // Fireworks for good days.
  const fw = particles(scene, { n: 300, color: 0xffffff, size: 0.5, opacity: 0,
    init: () => ({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }),
    step: (d, t, dt) => { if (d.life <= 0) { d.y = -50; return; } d.life -= dt; d.vy -= dt * 4; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; } });
  let fwT = 0;
  const shoot = () => { const cx = (rand() - 0.5) * 30, cy = 22 + rand() * 10, cz = (rand() - 0.5) * 30; fw.mat.color.setHSL(rand(), 1, 0.65); fw.data.forEach((d, i) => { if (i % 3 !== fwT % 3) return; const v = new THREE.Vector3().randomDirection().multiplyScalar(5 + rand() * 4); Object.assign(d, { x: cx, y: cy, z: cz, vx: v.x, vy: v.y, vz: v.z, life: 1.6 + rand() * 0.6 }); }); fwT++; };

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
      return false;
    },
    tick(t, dt, s) {
      bonfire.tick(t); bonfire2.tick(t); sparks.tick(t, dt);
      people.forEach((o) => { o.next -= dt; o.p.update(t, dt, 0, false); if (o.next < 0 && o.talk) { o.p.wave(); o.next = 3 + rand() * 5; } });
      const k = kit.burstK();
      if (k > 0.2 && Math.floor(t * 2.2) !== fw.lastShot) { fw.lastShot = Math.floor(t * 2.2); shoot(); }
      fw.mat.opacity = fw.data.some((d) => d.life > 0) ? 1 : 0;
      fw.tick(t, dt);
    },
    burst: [0xffd070, 0xff8a70, 0x8ad0ff],
  };
}

// ======================= ورشة الإنجاز — career =======================
function workshop(scene, kit) {
  const { rand } = kit;
  const R = 30;
  ground(scene, 400, speckle('#8a8478', ['#7a7468', '#9a9488', '#6a6458'], { repeat: 60 }));
  const concTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#a8a8a2'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,60,60' : '230,230,225'},${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * w, 2 + Math.random() * 6, 2 + Math.random() * 6); }
    g.strokeStyle = '#88887f'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, w); g.moveTo(0, k * w / 4); g.lineTo(w, k * w / 4); g.stroke(); }
    g.fillStyle = 'rgba(60,40,20,.15)'; g.beginPath(); g.ellipse(w * 0.3, w * 0.6, 60, 30, 0.4, 0, 7); g.fill();
  }, 10);
  ground(scene, R + 2, concTex, { y: 0.02, rough: 0.9 });
  const hazard = canvasTex(256, 32, (g) => { for (let i = -2; i < 20; i++) { g.fillStyle = i % 2 ? '#1a1a1a' : '#f0c020'; g.beginPath(); g.moveTo(i * 16, 32); g.lineTo(i * 16 + 16, 0); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, 32); g.fill(); } });
  hazard.wrapS = THREE.RepeatWrapping; hazard.repeat.set(30, 1);
  const edge = new THREE.Mesh(new THREE.RingGeometry(R + 1.4, R + 2.2, 96, 1), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.8 })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.03; scene.add(edge);
  // The rising tower: a steel frame, concrete floors and glass on the lower storeys.
  const steelR = std(0xc0442a, { metalness: 0.5, roughness: 0.45 }), slab = std(0xb8b8b0, { roughness: 0.95 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8ac0e0, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 });
  const T = group(scene, 0, 0, -17);
  const FL = 6, BAY = 4.2, FH = 4.4;
  for (let f = 0; f <= FL; f++) {
    for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) if (f < FL || (i + j) % 2 === 0) box(T, 0.36, FH, 0.36, steelR, -6.3 + i * BAY, f * FH, -4.2 + j * BAY);
    if (f > 0) {
      for (let j = 0; j <= 2; j++) box(T, BAY * 3 + 0.4, 0.34, 0.3, steelR, 0, f * FH - 0.34, -4.2 + j * BAY);
      for (let i = 0; i <= 3; i++) box(T, 0.3, 0.34, BAY * 2 + 0.4, steelR, -6.3 + i * BAY, f * FH - 0.34, 0);
      if (f <= 4) box(T, BAY * 3 + 0.4, 0.25, BAY * 2 + 0.4, slab, 0, f * FH - 0.6, 0);
    }
    if (f < 2) for (let i = 0; i < 3; i++) { add(T, new THREE.PlaneGeometry(BAY - 0.3, FH - 0.6), glass, -4.2 + i * BAY, f * FH + FH / 2, 4.25); }
  }
  // X bracing on the open storeys
  for (let f = 2; f < FL; f++) { const br = add(T, new THREE.BoxGeometry(0.16, Math.hypot(BAY, FH), 0.16), steelR, -6.3 + BAY / 2, f * FH + FH / 2, 4.2); br.rotation.z = Math.atan2(BAY, FH); const br2 = br.clone(); br2.rotation.z = -br.rotation.z; T.add(br2); }
  // scaffolding on one side
  const pipe = std(0x9aa2aa, { metalness: 0.8, roughness: 0.35 }), plank = std(0xb08a5a, { roughness: 0.9 });
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < 4; i++) for (const dz of [0, 1.4]) cyl(T, 0.05, 0.05, FH, pipe, 7.4 + dz, f * FH, -4.2 + i * 2.8, 6);
    box(T, 1.6, 0.1, 8.8, plank, 8.1, (f + 1) * FH - 0.2, 0);
  }
  // Welding sparks on the third floor.
  const weldAt = new THREE.Vector3(3, 2 * FH + 0.4, -17 + 4.2);
  const weldLight = new THREE.PointLight(0x9fd0ff, 0, 10, 1.6); weldLight.position.copy(weldAt); scene.add(weldLight);
  const welder = buildWorshipper(PALS[5]); welder.root.position.set(weldAt.x - 0.6, 2 * FH - 0.6 + 0.25, weldAt.z - 1); welder.root.rotation.y = 0.5; scene.add(welder.root);
  const hatM = std(0xf0c020, { roughness: 0.4 }); { const neck = welder.head.parent; const hat = add(neck, new THREE.SphereGeometry(0.19, 16, 10, 0, TAU, 0, Math.PI / 2), hatM, 0, 0.24, 0); }
  const sparks = particles(scene, { n: 140, color: 0xffb040, size: 0.1,
    init: () => ({ x: weldAt.x, y: weldAt.y, z: weldAt.z, vx: 0, vy: 0, vz: 0, life: 0 }),
    step: (d, t, dt) => { d.life -= dt; if (d.life <= 0) { const k = 1 + kit.burstK() * 3; Object.assign(d, { x: weldAt.x, y: weldAt.y, z: weldAt.z, vx: (rand() - 0.5) * 3 * k, vy: rand() * 2 * k, vz: rand() * 2.5 * k, life: 0.4 + rand() * 0.9 }); } d.vy -= dt * 9.8; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < 0.1) { d.y = 0.1; d.vy *= -0.3; } } });
  // The tower crane, slowly swinging a steel beam.
  const crane = group(scene, 15, 0, -22);
  const yellow = std(0xf0b020, { metalness: 0.4, roughness: 0.45 });
  const H = 34;
  for (const [sx, sz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) cyl(crane, 0.12, 0.12, H, yellow, sx, 0, sz, 6);
  for (let y = 0; y < H; y += 2) for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const d = add(crane, new THREE.BoxGeometry(0.08, 2.3, 0.08), yellow); d.position.set(Math.sin(ry) * 0.8, y + 1, Math.cos(ry) * 0.8); d.rotation.set(0, ry, 0.7); }
  cyl(crane, 2.2, 2.6, 1, std(0x777777), 0, 0, 0, 12);
  const top = group(crane, 0, H, 0);
  box(top, 2, 2, 2, std(0xe8e8e8), 1.2, 0, 1.2);
  const jib = group(top, 0, 2.2, 0);
  for (const dz of [-0.5, 0.5]) box(jib, 30, 0.2, 0.2, yellow, 9, 0, dz);
  box(jib, 30, 0.2, 0.2, yellow, 9, 1.4, 0);
  for (let x = -6; x < 24; x += 1.5) { const d = add(jib, new THREE.BoxGeometry(0.08, 1.6, 0.08), yellow); d.position.set(x, 0.7, 0); d.rotation.z = 0.8; }
  box(jib, 4, 2, 2.2, std(0x666666), -5, -1, 0);
  cyl(jib, 0.1, 0.4, 5, yellow, 0, 1.5, 0, 6);
  const tipM = lampMat(0xff3020); const tip = sph(jib, 0.25, tipM, 0, 6.6, 0, 10, 8); kit.glow(tipM, 0.4, 3);
  const trolley = group(jib, 14, -0.3, 0);
  const cable = add(trolley, new THREE.CylinderGeometry(0.03, 0.03, 1, 4), std(0x222222));
  const load = group(trolley, 0, -14, 0);
  box(load, 0.4, 0.3, 6, steelR, 0, -0.6, 0);
  cyl(load, 0.12, 0.12, 0.5, std(0x333333), 0, 0, 0, 8);
  // Workbench, gear wall, blueprint table, cement mixer, cones, pallets, site office.
  const bench = group(scene, -13, 0, 2, Math.PI / 2);
  box(bench, 4, 0.2, 1.6, std(0x8a6a4a), 0, 1.2, 0); for (const [sx, sz] of [[-1.8, -0.6], [1.8, -0.6], [-1.8, 0.6], [1.8, 0.6]]) box(bench, 0.15, 1.2, 0.15, std(0x444444), sx, 0, sz);
  box(bench, 1.2, 0.5, 0.6, std(0xc0392b, { metalness: 0.4 }), -1, 1.4, 0);
  const ham = group(bench, 0.6, 1.45, 0.2, 0.4); box(ham, 0.08, 0.08, 0.8, std(0x8a5a34), 0, 0, 0); box(ham, 0.32, 0.14, 0.14, std(0x555555, { metalness: 0.8 }), 0, 0, 0.4);
  const wrench = add(bench, new THREE.TorusGeometry(0.12, 0.04, 6, 12, 5), std(0xaaaaaa, { metalness: 0.9 }), 1.3, 1.42, -0.2); wrench.rotation.x = Math.PI / 2;
  const gearWall = group(scene, -16, 0, -6, faceTo(-16, -6));
  box(gearWall, 6, 5, 0.4, std(0x4a5560, { metalness: 0.4 }), 0, 0, 0);
  const gearShape = (r, teeth) => { const s = new THREE.Shape(); for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, rr = i % 2 ? r : r * 1.18; const a2 = ((i + 1) / (teeth * 2)) * TAU; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); s.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); } const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.3, 0, TAU, true); s.holes.push(hole); return s; };
  const gears = [[-1.4, 3.2, 1.1, 12, 1], [0.6, 2.3, 0.75, 8, -1], [1.9, 3.4, 0.6, 7, 1], [-0.2, 0.9, 0.55, 7, 1]].map(([x, y, r, n, d]) => { const m = add(gearWall, new THREE.ExtrudeGeometry(gearShape(r, n), { depth: 0.2, bevelEnabled: false }), std(d > 0 ? 0xd4a53a : 0xb0b8c0, { metalness: 0.85, roughness: 0.3 }), x, y, 0.22); return { m, sp: d / r }; });
  const bp = group(scene, 10, 0, 5, -0.5);
  box(bp, 3, 0.15, 2, std(0x6a4a2a), 0, 1.2, 0); for (const [sx, sz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) box(bp, 0.12, 1.2, 0.12, std(0x444444), sx, 0, sz);
  const bpTex = canvasTex(512, 340, (g, w, h) => { g.fillStyle = '#1d4f8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff33'; g.lineWidth = 1; for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(80, 60, 200, 230); for (let f = 1; f < 6; f++) { g.beginPath(); g.moveTo(80, 60 + f * 38); g.lineTo(280, 60 + f * 38); g.stroke(); } g.strokeRect(320, 120, 120, 170); g.font = 'bold 28px system-ui'; g.fillStyle = '#fff'; g.fillText('PLAN A', 320, 90); });
  const sheet = add(bp, new THREE.PlaneGeometry(2.8, 1.85), new THREE.MeshStandardMaterial({ map: bpTex, roughness: 0.9 }), 0, 1.29, 0); sheet.rotation.x = -Math.PI / 2;
  const mixer = group(scene, 12, 0, -6, 0.8);
  box(mixer, 1.4, 0.8, 2.6, std(0x3a6aa0), 0, 0, 0);
  const drum = add(mixer, new THREE.CylinderGeometry(0.5, 1, 2, 16), std(0xf08a20, { roughness: 0.5 }), 0, 1.9, 0); drum.rotation.x = 1.1;
  ring(9, 20, (x, z) => { cyl(scene, 0.03, 0.32, 0.8, std(0xff6a1a), x, 0, z, 10); const st = add(scene, new THREE.CylinderGeometry(0.2, 0.25, 0.1, 10), std(0xffffff), x, 0.45, z); }, 0.6);
  for (let i = 0; i < 4; i++) box(scene, 1.6, 0.18, 1.6, std(0xb08a5a), -10, i * 0.2, -14);
  for (let i = 0; i < 5; i++) box(scene, 6, 0.35, 0.3, steelR, -6 + (i % 2) * 0.1, 0.2 + Math.floor(i / 2) * 0.36, 13 + (i % 2) * 0.4);
  const office = group(scene, -16, 0, 12, Math.PI / 2 + 0.3);
  box(office, 7, 3, 3, std(0x2e7a5a, { metalness: 0.4, roughness: 0.6 }), 0, 0, 0);
  const winM = lampMat(0xfff0c0); box(office, 2, 1, 0.1, winM, 1.5, 1.4, 1.55); kit.glow(winM, 0.1, 2.5);
  const sign = add(office, new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({ map: textTex(['مكتب الموقع'], { w: 384, h: 96, bg: '#f0c020', fg: '#1a1a1a' }) }), -1.6, 2.4, 1.56);
  // City skyline far away, windows lit at night.
  const winTex = canvasTex(64, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128); for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) if (Math.random() < 0.45) { g.fillStyle = '#ffd890'; g.fillRect(x, y, 6, 6); } });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const cityM = new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0 }); kit.glow(cityM, 0, 1.2);
  for (let i = 0; i < 46; i++) { const a = rand() * TAU, r = 110 + rand() * 90, h = 20 + rand() * 70, w = 8 + rand() * 10; const b = add(scene, new THREE.BoxGeometry(w, h, w), cityM, Math.cos(a) * r, h / 2, Math.sin(a) * r); b.rotation.y = rand() * 3; }
  // Floodlights for night work.
  ring(2, 24, (x, z) => { cyl(scene, 0.18, 0.25, 12, std(0x777777), x, 0, z, 8); const m = lampMat(0xffffff); box(scene, 2, 1, 0.4, m, x, 12, z); kit.glow(m, 0.1, 3); const sp = new THREE.SpotLight(0xfff4e0, 0, 60, 0.6, 0.6, 1.2); sp.position.set(x, 12, z); sp.target.position.set(0, 0, -10); scene.add(sp, sp.target); kit.glow(sp, 0, 300); }, Math.PI * 0.75);
  shade(scene);

  let craneA = 0;
  return {
    spawn: [0, 18, Math.PI], stand: [-17, -0.5, faceTo(-17, -0.5, 0, 18)], camR: R, camY: 30,
    blocked: (x, z) => {
      if (hyp(x, z) > R) return true;
      if (Math.abs(x) < 7.2 && Math.abs(z + 17) < 5) return true;          // tower
      if (x > 6.8 && x < 9.6 && Math.abs(z + 17) < 5) return true;          // scaffolding
      if (hyp(x - 15, z + 22) < 3) return true;
      if (Math.abs(x + 13) < 1.2 && Math.abs(z - 2) < 2.4) return true;
      if (hyp(x + 16, z + 6) < 1.4 || hyp(x - 10, z - 5) < 2.1 || hyp(x - 12, z + 6) < 2) return true;
      if (Math.abs(x + 10) < 1 && Math.abs(z + 14) < 1) return true;
      if (Math.abs(x + 6) < 3.4 && Math.abs(z - 13.2) < 0.8) return true;
      { const dx = x + 16, dz = z - 12, a = Math.PI / 2 + 0.3, c = Math.cos(a), s2 = Math.sin(a), lx = dx * c - dz * s2, lz = dx * s2 + dz * c; if (Math.abs(lx) < 3.8 && Math.abs(lz) < 1.8) return true; }
      return false;
    },
    tick(t, dt, s) {
      const k = kit.burstK();
      craneA = Math.sin(t * 0.08) * 0.9 + 0.4;
      jib.rotation.y = craneA;
      trolley.position.x = 12 + Math.sin(t * 0.15) * 6;
      const drop = 13 - (Math.sin(t * 0.2) * 0.5 + 0.5) * 8 - k * 5;
      load.position.y = -drop - 0.5; cable.scale.y = drop; cable.position.y = -drop / 2;
      load.rotation.y = Math.sin(t * 0.3) * 0.4;
      tipM.emissiveIntensity = (Math.sin(t * 4) > 0 ? 1 : 0.1) * (0.4 + s.night * 3);
      gears.forEach((g) => (g.m.rotation.z += dt * g.sp * (1 + k * 4)));
      drum.rotation.y += dt * 1.5;
      sparks.tick(t, dt);
      weldLight.intensity = (Math.random() < 0.7 ? 6 + Math.random() * 10 : 0) * (1 + k);
      welder.update(t, dt, 0, false);
    },
    burst: [0xffb040, 0xfff0a0, 0x9fd0ff],
  };
}

// ======================= سوق الذهب — wealth =======================
function bazaar(scene, kit) {
  const { rand } = kit;
  const R = 26;
  ground(scene, 400, speckle('#d8c090', ['#c8b080', '#e8d0a0', '#b89a6a'], { repeat: 60 }));
  const tiles = canvasTex(512, 512, (g, w) => { g.fillStyle = '#c8a878'; g.fillRect(0, 0, w, w); for (let y = 0; y < w; y += 64) for (let x = (y / 64) % 2 ? -32 : 0; x < w; x += 64) { const v = 190 + Math.random() * 30; g.fillStyle = `rgb(${v + 20},${v},${v - 40})`; g.fillRect(x + 3, y + 3, 58, 58); } g.fillStyle = '#2f7a6a66'; for (let y = 32; y < w; y += 128) for (let x = 32; x < w; x += 128) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-10, -10, 20, 20); g.restore(); } }, 12);
  ground(scene, R + 5, tiles, { y: 0.02, rough: 0.8 });
  // Stalls in a ring with striped awnings and goods.
  const woodM = std(0x7a4e2a, { roughness: 0.7 });
  const stripes = [['#c0392b', '#f4ead2'], ['#1e6b52', '#f4ead2'], ['#2f4f8a', '#ffd36b'], ['#8a2a6a', '#f4ead2'], ['#d4a53a', '#5a2e14']];
  const spiceCols = [0xc0502a, 0xe8a020, 0x8a3a1a, 0x5a8a2a, 0xd8c050, 0xa02a2a];
  const lampMs = [0xff8a3a, 0x3ad0ff, 0xff3a8a, 0x7aff5a].map((c) => { const m = lampMat(c, { transparent: true, opacity: 0.9 }); kit.glow(m, 0.3, 2.6); return m; });
  const stalls = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + 0.31;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.32) continue;
    const r = R - 2.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const st = group(scene, x, 0, z, faceTo(x, z)); stalls.push([x, z]);
    for (const [sx, sz] of [[-2.4, -1.4], [2.4, -1.4], [-2.4, 1.4], [2.4, 1.4]]) cyl(st, 0.1, 0.12, 3.6, woodM, sx, 0, sz, 8);
    const [c1, c2] = stripes[i % stripes.length];
    const awT = canvasTex(128, 64, (g) => { for (let s2 = 0; s2 < 8; s2++) { g.fillStyle = s2 % 2 ? c2 : c1; g.fillRect(s2 * 16, 0, 16, 64); } g.fillStyle = c1; for (let s2 = 0; s2 < 8; s2++) { g.beginPath(); g.arc(s2 * 16 + 8, 60, 8, 0, Math.PI); g.fill(); } });
    const aw = add(st, new THREE.PlaneGeometry(5.4, 3.4), new THREE.MeshStandardMaterial({ map: awT, side: THREE.DoubleSide, roughness: 0.9 }), 0, 3.7, 0.2); aw.rotation.x = -Math.PI / 2 + 0.25;
    box(st, 4.6, 1.1, 1.1, woodM, 0, 0, 0.9);
    const kind = i % 4;
    if (kind === 0) for (let k = 0; k < 5; k++) { const bw = add(st, new THREE.CylinderGeometry(0.34, 0.28, 0.2, 14), std(0x9a6a3a), -1.8 + k * 0.9, 1.2, 0.9); add(st, new THREE.ConeGeometry(0.32, 0.45, 14), std(spiceCols[(k + i) % 6], { roughness: 1 }), -1.8 + k * 0.9, 1.53, 0.9); }
    if (kind === 1) for (let k = 0; k < 4; k++) add(st, new THREE.LatheGeometry([[0.001, 0], [0.25, 0.02], [0.36, 0.3], [0.2, 0.62], [0.16, 0.78], [0.22, 0.86], [0.001, 0.86]].map(([u, v]) => new THREE.Vector2(u, v)), 16), std([0xb0603a, 0x2f6f8a, 0xd8c8a8, 0x8a3a2a][k], { roughness: 0.5 }), -1.5 + k, 1.1, 0.9);
    if (kind === 2) for (let k = 0; k < 6; k++) { const roll = add(st, new THREE.CylinderGeometry(0.17, 0.17, 1.6, 12), std([0xc0392b, 0x2a5a9a, 0xd4a53a, 0x6a2a6a, 0x2e7a4a, 0xf0e0c0][k]), -1.6 + k * 0.62, 1.3, 0.9); roll.rotation.x = Math.PI / 2; }
    if (kind === 3) for (let k = 0; k < 14; k++) sph(st, 0.15, std([0xff8a2a, 0xe8d040, 0x9a2a2a, 0x7ac040][k % 4]), -1.8 + (k % 7) * 0.6, 1.25 + Math.floor(k / 7) * 0.22, 0.75 + (k % 2) * 0.25, 10, 8);
    // hanging carpet at the back and a lantern
    const cT = canvasTex(64, 96, (g) => { g.fillStyle = c1; g.fillRect(0, 0, 64, 96); g.fillStyle = c2; g.fillRect(6, 6, 52, 84); g.fillStyle = c1; g.beginPath(); g.moveTo(32, 14); g.lineTo(52, 48); g.lineTo(32, 82); g.lineTo(12, 48); g.fill(); });
    add(st, new THREE.PlaneGeometry(2, 2.8), new THREE.MeshStandardMaterial({ map: cT, side: THREE.DoubleSide }), -1, 2, -1.38);
    const lp = group(st, 1.4, 3.1, 1.2); add(lp, new THREE.CylinderGeometry(0.005, 0.005, 0.5, 3), std(0x222222), 0, 0.25, 0);
    const lb = add(lp, new THREE.OctahedronGeometry(0.28, 0), lampMs[i % 4]); lb.scale.y = 1.4;
  }
  // The golden treasury: a raised round pavilion with a dome over an open chest of coins.
  const goldM = std(0xffc83d, { metalness: 1, roughness: 0.22 }), marble = std(0xf4efe4, { roughness: 0.35 });
  cyl(scene, 6.4, 6.8, 0.5, marble, 0, 0, 0, 40);
  cyl(scene, 6.0, 6.0, 0.06, std(0x1e6b52), 0, 0.5, 0, 40);
  const cols = [];
  ring(8, 5.2, (x, z) => { cyl(scene, 0.32, 0.36, 6, marble, x, 0.5, z, 14); cyl(scene, 0.55, 0.36, 0.5, goldM, x, 6.5, z, 14); cols.push([x, z]); });
  const roofR = add(scene, new THREE.TorusGeometry(5.3, 0.4, 8, 48), goldM, 0, 7.1, 0); roofR.rotation.x = Math.PI / 2;
  const dome = add(scene, new THREE.SphereGeometry(5.4, 40, 20, 0, TAU, 0, Math.PI / 2), std(0x1e6b52, { metalness: 0.4, roughness: 0.35 }), 0, 7.1, 0); dome.scale.y = 0.75;
  const finial = cyl(scene, 0.1, 0.35, 1.6, goldM, 0, 11, 0, 10); sph(scene, 0.4, goldM, 0, 12.8, 0);
  const chest = group(scene, 0, 0.56, -0.4);
  box(chest, 2.2, 1.1, 1.4, std(0x6a3a1a, { roughness: 0.6 }), 0, 0, 0);
  for (const sx of [-0.9, 0.9]) box(chest, 0.14, 1.14, 1.44, goldM, sx, 0, 0);
  const lid = group(chest, 0, 1.1, -0.7); const lidM = add(lid, new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16, 1, false, 0, Math.PI), std(0x6a3a1a, { roughness: 0.6 }), 0, 0, 0.7); lidM.rotation.z = Math.PI / 2; lid.rotation.x = -1.9;
  const COINS = 360, coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14), goldM, COINS);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < COINS; i++) {
    const inChest = i < 150;
    const x = inChest ? (rand() - 0.5) * 1.9 : (rand() - 0.5) * 6, z = inChest ? -0.4 + (rand() - 0.5) * 1.1 : (rand() - 0.5) * 5;
    const y = inChest ? 1.62 + rand() * 0.35 : 0.56 + rand() * 0.25 * Math.max(0, 1 - hyp(x, z) / 3);
    if (!inChest && hyp(x, z + 0.4) < 1.4) { i--; continue; }
    q.setFromEuler(new THREE.Euler(rand() * 0.8, rand() * 6, rand() * 0.8)); mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); coins.setMatrixAt(i, mtx);
  }
  coins.castShadow = true; scene.add(coins);
  for (let i = 0; i < 9; i++) { const b = add(scene, new THREE.BoxGeometry(0.7, 0.24, 0.32), goldM, 2.2 + (i % 3) * 0.72, 0.68 + Math.floor(i / 3) * 0.25, 1.4 + (Math.floor(i / 3) % 2) * 0.1); }
  const chestLight = new THREE.PointLight(0xffc040, 14, 12, 1.5); chestLight.position.set(0, 2.6, -0.4); scene.add(chestLight); kit.glow(chestLight, 10, 26);
  const chestGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc040, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); chestGlow.scale.setScalar(4); chestGlow.position.set(0, 2.1, -0.4); scene.add(chestGlow);
  // A golden balance, gently tipping.
  const scale = group(scene, -2.6, 0.56, 1.6);
  cyl(scale, 0.3, 0.4, 0.2, goldM); cyl(scale, 0.06, 0.06, 2.2, goldM, 0, 0.2, 0, 8);
  const beam = group(scale, 0, 2.4, 0); const bm = add(beam, new THREE.BoxGeometry(2, 0.06, 0.06), goldM);
  const pans = [-1, 1].map((sx) => { const pg = group(beam, sx * 0.95, 0, 0); add(pg, new THREE.CylinderGeometry(0.008, 0.008, 0.8, 3), goldM, 0, -0.4, 0); add(pg, new THREE.CylinderGeometry(0.3, 0.2, 0.06, 16), goldM, 0, -0.82, 0); return pg; });
  // Palms round the edge.
  const palm = (x, z) => {
    const g = group(scene, x, 0, z, rand() * 6); let y = 0, px = 0;
    for (let i = 0; i < 9; i++) { const s2 = add(g, new THREE.CylinderGeometry(0.26 - i * 0.012, 0.3 - i * 0.012, 0.9, 8), std(0x7a5a3c, { roughness: 1 }), px, y + 0.45, 0); s2.rotation.z = -0.05; px += 0.06; y += 0.88; }
    for (let k = 0; k < 9; k++) { const lf = add(g, new THREE.PlaneGeometry(0.9, 4, 1, 4), std(0x3f7a2e, { side: THREE.DoubleSide }), px, y, 0); const pa = lf.geometry.attributes.position; for (let v = 0; v < pa.count; v++) pa.setZ(v, -((pa.getY(v) + 2) ** 2) * 0.09); lf.geometry.translate(0, 2, 0); lf.rotation.set(-1.1, (k / 9) * TAU, 0, 'YXZ'); }
  };
  [[-15, -16], [16, -15], [-20, 6], [20, 8], [-9, 21], [10, 22]].forEach(([x, z]) => palm(x, z));
  // Strings of lanterns across the market.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5, b = a + Math.PI * 0.55;
    const p1 = new THREE.Vector3(Math.cos(a) * (R - 1), 9, Math.sin(a) * (R - 1)), p2 = new THREE.Vector3(Math.cos(b) * (R - 1), 9, Math.sin(b) * (R - 1));
    for (let k = 1; k < 18; k++) { const u = k / 18, pt = p1.clone().lerp(p2, u); pt.y -= Math.sin(u * Math.PI) * 1; const lb = add(scene, new THREE.OctahedronGeometry(0.13, 0), lampMs[k % 4], pt.x, pt.y, pt.z); lb.scale.y = 1.4; }
    add(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 11 }, (_, k) => { const u = k / 10, pt = p1.clone().lerp(p2, u); pt.y -= Math.sin(u * Math.PI) - 0.1; return pt; })), 20, 0.015, 4), std(0x3a2a1a));
  }
  shade(scene);

  const sparkle = particles(scene, { n: 120, color: 0xffe07a, size: 0.14,
    init: () => ({ x: (rand() - 0.5) * 3, y: 1.6 + rand() * 2, z: -0.4 + (rand() - 0.5) * 2, ph: rand() * 6, s: 0.3 + rand() * 0.6 }),
    step: (d, t, dt) => { d.y += dt * d.s; if (d.y > 5) { d.y = 1.6; d.x = (rand() - 0.5) * 2.2; d.z = -0.4 + (rand() - 0.5) * 1.3; } } });
  // Coin shower for good days.
  const rainC = Array.from({ length: 60 }, () => { const m = add(scene, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), goldM); m.visible = false; return { m, v: 0, w: 0 }; });

  return {
    spawn: [0, 17, Math.PI], stand: [-13, -12.5, faceTo(-13, -12.5, 0, 17)], camR: R + 1, camY: 18,
    groundAt: (x, z) => (hyp(x, z) < 6.5 ? 0.56 : 0),
    blocked: (x, z) => {
      const r = hyp(x, z);
      if (r > R - 4.6) { for (const [sx, sz] of stalls) if (hyp(x - sx, z - sz) < 3.4) return true; if (r > R + 2) return true; }
      for (const [cx, cz] of cols) if (hyp(x - cx, z - cz) < 0.75) return true;
      if (Math.abs(x) < 1.4 && Math.abs(z + 0.4) < 1) return true;
      if (hyp(x + 2.6, z - 1.6) < 0.6 || (Math.abs(x - 2.9) < 1.3 && Math.abs(z - 1.5) < 0.5)) return true;
      for (const [px, pz] of [[-15, -16], [16, -15], [-20, 6], [20, 8], [-9, 21], [10, 22]]) if (hyp(x - px, z - pz) < 0.8) return true;
      return false;
    },
    tick(t, dt, s) {
      const tip = Math.sin(t * 0.7) * 0.12; beam.rotation.z = tip; pans.forEach((p) => (p.rotation.z = -tip));
      chestGlow.material.opacity = 0.45 + Math.sin(t * 2) * 0.15 + s.night * 0.3;
      sparkle.tick(t, dt);
      const k = kit.burstK();
      rainC.forEach((c, i) => {
        if (k > 0.3 && !c.m.visible && Math.random() < dt * 3) { c.m.visible = true; c.m.position.set((Math.random() - 0.5) * 16, 14 + Math.random() * 6, (Math.random() - 0.5) * 16); c.v = 0; c.w = (Math.random() - 0.5) * 12; }
        if (!c.m.visible) return;
        c.v -= dt * 14; c.m.position.y += c.v * dt; c.m.rotation.x += dt * c.w; c.m.rotation.z += dt * c.w * 0.7;
        if (c.m.position.y < 0.1) c.m.visible = false;
      });
    },
    burst: [0xffe07a, 0xffc83d, 0xffffff],
  };
}

// ======================= الغابة الحيّة — nature =======================
function forest(scene, kit) {
  const { rand } = kit;
  const R = 30;
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
  const streamPts = [[-8, -15], [-5, -10], [-7, -3], [-12, 3], [-15, 10], [-14, 18], [-10, 26]].map(([x, z]) => new THREE.Vector3(x, 0.1, z));
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
  for (let i = 0; i < 16; i++) { const a = rand() * TAU, r = 12 + rand() * 15; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0 || hyp(x, z - TZ) < 8 || (Math.abs(x) < 11 && z > -4)) continue; const g = group(scene, x, 0, z); cyl(g, 0.35, 0.5, 4, bark, 0, 0, 0, 6); add(g, new THREE.IcosahedronGeometry(2.4, 1), roundM, 0, 5, 0); blockers.push([x, z, 0.9]); }
  const fernM = std(0x4f9a3a, { side: THREE.DoubleSide });
  for (let i = 0; i < 40; i++) { const a = rand() * TAU, r = 6 + rand() * 22; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0) continue; const g = group(scene, x, 0, z, rand() * 6); for (let k = 0; k < 6; k++) { const f = add(g, new THREE.PlaneGeometry(0.35, 1.4), fernM, 0, 0.5, 0); f.geometry.translate(0, 0.5, 0); f.rotation.set(0.8, (k / 6) * TAU, 0, 'YXZ'); } }
  const capM = std(0xd8302a, { emissive: 0xff4a2a, emissiveIntensity: 0 }); kit.glow(capM, 0, 0.6);
  const capB = std(0x3aa8ff, { emissive: 0x3ad0ff, emissiveIntensity: 0 }); kit.glow(capB, 0, 1.4);
  for (let i = 0; i < 26; i++) { const a = rand() * TAU, r = 5 + rand() * 22; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0) continue; const s = 0.5 + rand() * 0.8; cyl(scene, 0.07 * s, 0.1 * s, 0.5 * s, std(0xf2ead8), x, 0, z, 8); const cap = add(scene, new THREE.SphereGeometry(0.3 * s, 14, 8, 0, TAU, 0, Math.PI / 2), i % 3 ? capM : capB, x, 0.5 * s, z); }
  for (let i = 0; i < 10; i++) { const a = rand() * TAU, r = 9 + rand() * 18; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (streamAt(x, z) >= 0) continue; const s = 0.8 + rand(); const rk = add(scene, new THREE.DodecahedronGeometry(s, 0), rockM, x, s * 0.4, z); rk.scale.y = 0.6; const ms = add(scene, new THREE.DodecahedronGeometry(s * 0.9, 0), mossM, x, s * 0.62, z); ms.scale.set(1, 0.25, 1); blockers.push([x, z, s]); }
  const log = add(scene, new THREE.CylinderGeometry(0.6, 0.7, 6, 12), bark, 12, 0.6, 8); log.rotation.set(0, 0.6, Math.PI / 2); blockers.push([12, 8, 1.4], [14.5, 6.4, 1.2], [9.5, 9.6, 1.2]);
  shade(scene);

  // Butterflies by day, fireflies by night.
  const wingCols = [0xffa040, 0x6ab0ff, 0xff70b0, 0xffe050];
  const flies = Array.from({ length: 14 }, (_, i) => {
    const g = group(scene, 0, 1, 0); const wm = std(wingCols[i % 4], { side: THREE.DoubleSide, emissive: wingCols[i % 4], emissiveIntensity: 0.2 });
    const wings = [-1, 1].map((s2) => { const w = add(g, new THREE.CircleGeometry(0.22, 8), wm); w.geometry.translate(s2 * 0.2, 0, 0); return w; });
    return { g, wings, cx: (rand() - 0.5) * 30, cz: (rand() - 0.5) * 30, r: 1 + rand() * 3, sp: 0.4 + rand() * 0.5, ph: rand() * 6 };
  });
  const ff = particles(scene, { n: 220, color: 0xc8ff6a, size: 0.26, opacity: 0,
    init: () => ({ x: (rand() - 0.5) * 56, y: 0.5 + rand() * 4, z: (rand() - 0.5) * 56, ph: rand() * 6 }),
    step: (d, t, dt) => { d.x += Math.sin(t * 0.6 + d.ph) * dt * 0.5; d.z += Math.cos(t * 0.5 + d.ph * 2) * dt * 0.5; d.y = 1 + Math.sin(t * 0.8 + d.ph) * 1.2 + 1.2 + kit.burstK() * 4 * Math.sin(d.ph); } });

  return {
    spawn: [0, 16, Math.PI], stand: [11, -2, faceTo(11, -2, 0, 16)], camR: R + 2, camY: 24,
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
    },
    burst: [0x9aff7a, 0xffe07a, 0xc8ff6a],
  };
}

export const DIM_SCENES = { library, body: arena, heart: heartGarden, social: village, career: workshop, wealth: bazaar, nature: forest };

// Look and light per place.
export const DIM_ENV = {
  library: { fog: 0xd8dce8, golden: 0xe8c08c, far: 260, shadow: 30 },
  body:    { fog: 0xd2e2f0, golden: 0xf0b88a, far: 320, shadow: 42 },
  heart:   { fog: 0xf6dde6, golden: 0xf8b8a8, far: 240, shadow: 36 },
  social:  { fog: 0xf0dcc0, golden: 0xf0a868, far: 260, shadow: 36 },
  career:  { fog: 0xd6dbe2, golden: 0xe8b890, far: 340, shadow: 40 },
  wealth:  { fog: 0xf2e2c4, golden: 0xf8c070, far: 260, shadow: 32 },
  nature:  { fog: 0xd2e8cc, golden: 0xe8d098, far: 200, shadow: 38 },
};
