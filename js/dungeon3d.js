// The dungeon under the headquarters: a vast stone hall with two cells.
// Cell 1 — the future self: chained and exhausted at first, freer and brighter as
//   `future` (0..1) rises with levels and won wars.
// Cell 2 — the inner child: crying while `child` is low; calm, then happy as it rises.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';

export const DX = 400;          // the dungeon sits far from the hall in the same scene
export const D = { hw: 20, hl: 24 };

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

function stoneTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#2b2622'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? -48 : 0; x < 512; x += 96) {
    const v = 55 + Math.random() * 30; g.fillStyle = `rgb(${v + 8},${v + 2},${v - 6})`;
    g.beginPath(); g.roundRect(x + 4, y + 4, 88, 56, 10); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, y + 48, 88, 12);
    if (Math.random() < 0.3) { g.fillStyle = 'rgba(60,90,40,.35)'; g.fillRect(x + Math.random() * 60, y + 40, 30, 20); } // moss
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildDungeon(scene) {
  const g = new THREE.Group(); g.position.x = DX; scene.add(g);
  const tex = stoneTexture();
  const wallTex = tex.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(6, 3);
  const floorTex = tex.clone(); floorTex.needsUpdate = true; floorTex.repeat.set(6, 7);
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  const H = 16;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(D.hw * 2, D.hl * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  for (const [x, z, w, ry] of [[0, -D.hl, D.hw * 2, 0], [0, D.hl, D.hw * 2, Math.PI], [-D.hw, 0, D.hl * 2, Math.PI / 2], [D.hw, 0, D.hl * 2, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallM); m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m);
  }
  // Stone vault
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(D.hw, D.hw, D.hl * 2, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 1 }));
  vault.rotation.set(-Math.PI / 2, 0, 0); vault.position.y = H; vault.scale.y = 1; g.add(vault);
  for (let z = -D.hl + 4; z < D.hl; z += 8) { const rib = new THREE.Mesh(new THREE.TorusGeometry(D.hw - 0.3, 0.6, 6, 32, Math.PI), std(0x2a2420)); rib.position.set(0, H, z); g.add(rib); }
  // Heavy pillars
  for (const sx of [-1, 1]) for (const z of [-12, 0, 12]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, H, 2.2), std(0x3a332c)); p.position.set(sx * 15, H / 2, z); p.castShadow = true; g.add(p); }
  // Entrance door (back to the hall) at +z
  const door = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 0.5), std(0x3b2414, { roughness: 0.7 })); door.position.set(0, 4, D.hl - 0.3); g.add(door);
  for (let y = 1; y < 8; y += 1.8) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.25, 0.1), std(0x444444, { metalness: 0.8 })); b.position.set(0, y, D.hl - 0.6); g.add(b); }
  // Stairs, straw, bones, a table with a candle — atmosphere
  for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 1.2), std(0x3a332c)); st.position.set(0, 0.15 + i * 0.3 * 0, D.hl - 1.5 - i * 1.2); }
  for (let i = 0; i < 14; i++) { const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), std(0xb89a4a)); hay.rotation.set(Math.PI / 2, Math.random() * 3, 0); hay.position.set(-12 + Math.random() * 6, 0.05, -18 + Math.random() * 4); g.add(hay); }
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 12), std(0x5a4030)); bucket.position.set(8, 0.4, 6); g.add(bucket);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 14), std(0x5a3a22)); barrel.position.set(-16, 0.9, 16); g.add(barrel);

  // ---- two cells along the back wall ----
  const barM = std(0x3a3a3e, { metalness: 0.9, roughness: 0.4 });
  const cells = [];
  for (const [cx, label] of [[-8, 'future'], [8, 'child']]) {
    const cell = new THREE.Group(); cell.position.set(cx, 0, -D.hl + 5); g.add(cell);
    const w = 11, d = 9;
    for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.8, 10, d), wallM); side.position.set(sx * w / 2, 5, 0); cell.add(side); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 0.6), barM); top.position.set(0, 7, d / 2); cell.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.6), barM); bottom.position.set(0, 0.15, d / 2); cell.add(bottom);
    for (let x = -w / 2 + 0.7; x < w / 2; x += 0.6) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), barM); b.position.set(x, 3.5, d / 2); cell.add(b); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), std(0x6b5a2a, { metalness: 0.9 })); lock.position.set(1.5, 3.2, d / 2 + 0.2); cell.add(lock);
    const straw = new THREE.Mesh(new THREE.CircleGeometry(2.5, 16), std(0x8a7440)); straw.rotation.x = -Math.PI / 2; straw.position.set(-1.5, 0.03, -2); cell.add(straw);
    const cellLight = new THREE.PointLight(0xcfd8ff, 0, 14, 1.4); cellLight.position.set(0, 5, 2); cell.add(cellLight);
    // a small high window with a light shaft
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), new THREE.MeshBasicMaterial({ color: 0xbcd3ff })); win.position.set(0, 9, -d / 2 + 0.02); cell.add(win);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.2, 9, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    shaft.position.set(0, 4.5, -1.5); shaft.rotation.x = 0.35; cell.add(shaft);
    const plate = document.createElement('div');
    const fillL = new THREE.SpotLight(0xffe2b8, 40, 16, 0.6, 0.6, 1.2); fillL.position.set(0, 6, 7); fillL.target.position.set(0, 0.5, -2); cell.add(fillL, fillL.target);
    cells.push({ cell, label, light: cellLight, shaft, win, front: new THREE.Vector3(DX + cx, 0, -D.hl + 5 + d / 2 + 1.2) });
  }
  shadowAll(g);

  // Torches along the walls
  const torches = [];
  for (const sx of [-1, 1]) for (const z of [-16, -4, 8, 18]) {
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1, 6), std(0x222222, { metalness: 0.7 })); holder.position.set(sx * (D.hw - 0.4), 6, z); holder.rotation.z = sx * 0.4; g.add(holder);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2e, toneMapped: false })); fl.position.set(sx * (D.hw - 0.7), 6.8, z); g.add(fl);
    const l = new THREE.PointLight(0xff8a3c, 16, 18, 1.6); l.position.set(sx * (D.hw - 1.5), 7, z); g.add(l);
    torches.push({ fl, l, ph: Math.random() * 6 });
  }
  g.add(new THREE.HemisphereLight(0x6a6a88, 0x1a120c, 0.35));
  // Dust in the air
  const N = 250, dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) dp.set([(Math.random() - 0.5) * D.hw * 2, Math.random() * H, (Math.random() - 0.5) * D.hl * 2], i * 3);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dp, 3)), new THREE.PointsMaterial({ color: 0xcfc2a8, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false }));
  g.add(dust);

  // ---- the future self ----
  const fut = buildWorshipper({ robe: '#6b6258', accent: '#3a3128', skin: '#e2c3a6', glow: '#ffe7a8' });
  const futP = cells[0];
  fut.root.position.set(futP.front.x, 0, futP.front.z - 5.2); scene.add(fut.root);
  const chainM = std(0x555555, { metalness: 0.9, roughness: 0.4 });
  const chainsG = new THREE.Group(); scene.add(chainsG);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), chainM); c.position.set(futP.front.x + sx * 1.2, 2.6, futP.front.z - 6.6); c.rotation.z = sx * 0.5; c.rotation.x = 0.4; chainsG.add(c); }
  const futAura = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.8, 48), new THREE.MeshBasicMaterial({ color: 0xffe7a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  futAura.rotation.x = -Math.PI / 2; futAura.position.set(futP.front.x, 0.05, futP.front.z - 5.2); scene.add(futAura);

  // ---- the inner child ----
  const kid = buildWorshipper({ robe: '#8fb8de', accent: '#f4d58d', skin: '#f5d6bd', glow: '#ffe7a8' });
  const kidP = cells[1];
  kid.root.scale.setScalar(0.95); kid.root.position.set(kidP.front.x, 0, kidP.front.z - 5); scene.add(kid.root);
  const tearM = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9 });
  const tears = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), tearM); scene.add(m); return { m, t: Math.random() }; });
  const kidToy = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), std(0xe74c3c)); kidToy.position.set(kidP.front.x + 1.8, 0.35, kidP.front.z - 4); scene.add(kidToy);

  // Posture helpers (the figures are not animated by the hero pose system).
  const partsOf = (h) => { const upper = h.root.children[1]; return { lower: h.root.children[0], upper, neck: upper.children.find((c) => c.isGroup && c.position.y > 0.6) }; };
  const FP = partsOf(fut), KP = partsOf(kid);
  const setFuture = (v) => {
    // 0: slumped on the floor, grey rags, chained, dark cell. 1: standing tall, white robe, light, no chains.
    fut.root.position.y = THREE.MathUtils.lerp(-0.9, 0, Math.min(1, v * 2));
    FP.lower.scale.y = THREE.MathUtils.lerp(0.45, 1, Math.min(1, v * 2));
    FP.upper.position.y = THREE.MathUtils.lerp(0.45, 0.95, Math.min(1, v * 2));
    FP.upper.rotation.x = THREE.MathUtils.lerp(0.75, 0, v);
    if (FP.neck) FP.neck.rotation.x = THREE.MathUtils.lerp(0.6, -0.05, v);
    fut.root.traverse((m) => { if (m.isMesh && m.material.color && m.material.roughness > 0.7 && m.material.color.getHex() !== 0x2a1d14) m.material.color.lerpColors(new THREE.Color(0x5a534c), new THREE.Color(0xfbfaf6), v); });
    chainsG.visible = v < 0.6;
    futP.light.intensity = 8 + v * 30;
    futP.shaft.material.opacity = 0.03 + v * 0.12;
    futAura.material.opacity = Math.max(0, v - 0.3) * 0.6;
  };
  let childV = 0;
  const setChild = (v) => {
    childV = v;
    KP.upper.rotation.x = THREE.MathUtils.lerp(0.5, 0, Math.min(1, v * 1.5));
    if (KP.neck) KP.neck.rotation.x = THREE.MathUtils.lerp(0.55, -0.1, v);
    kid.root.position.y = v < 0.3 ? -0.55 : 0;   // sitting hugging knees when sad
    KP.lower.scale.y = v < 0.3 ? 0.55 : 1; KP.upper.position.y = v < 0.3 ? 0.5 : 0.95;
    kidP.light.intensity = 8 + v * 26;
    kidP.shaft.material.opacity = 0.03 + v * 0.12;
    tears.forEach((x) => (x.m.visible = v < 0.4));
  };
  const headPos = new THREE.Vector3();
  function tick(t, dt) {
    for (const tr of torches) { const k = 0.8 + Math.sin(t * 11 + tr.ph) * 0.12 + Math.sin(t * 29 + tr.ph) * 0.08; tr.l.intensity = 16 * k; tr.fl.scale.y = k * 1.2; }
    for (let i = 0; i < N; i++) { dp[i * 3 + 1] += dt * 0.15; if (dp[i * 3 + 1] > H) dp[i * 3 + 1] = 0; }
    dust.geometry.attributes.position.needsUpdate = true;
    // the child: sobbing shoulders / happy hops
    if (childV < 0.4) {
      KP.upper.rotation.z = Math.sin(t * 9) * 0.03;
      KP.neck?.getWorldPosition(headPos);
      tears.forEach((x, i) => { x.t = (x.t + dt * 0.7) % 1; x.m.position.set(headPos.x + (i % 2 ? 0.1 : -0.1) * 0.95, headPos.y + 0.12 - x.t * 0.7, headPos.z + 0.22); });
    } else if (childV > 0.7) {
      kid.root.position.y = Math.abs(Math.sin(t * 4)) * 0.4;
      kid.root.rotation.y = Math.sin(t * 1.3) * 0.6;
    }
    futAura.rotation.z = t * 0.3;
  }
  return { group: g, setFuture, setChild, tick, cells, futureAt: futP.front, childAt: kidP.front, entrance: new THREE.Vector3(DX, 0, D.hl - 4) };
}
