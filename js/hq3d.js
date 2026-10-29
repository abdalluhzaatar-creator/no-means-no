// 3D headquarters: a vast, fully enclosed throne hall. Ribbed vaults, giant columns,
// stained-glass windows with light shafts, chandeliers, braziers, guardian statues,
// a throne on a stepped dais, great doors, and the strategy table with the commander.
// The camera orbits freely (360°) inside the hall.
import * as THREE from './vendor/three.module.min.js';
import { createWalker } from './walker.js';
import { buildDungeon, DX, D } from './dungeon3d.js';
import { setCry, creak, chains } from './audio.js';
import { buildWorshipper } from './oasis3d.js';
import { warMapCanvas } from './warmap.js';
import { buildHeaven, HX } from './heaven3d.js';
import { buildVestibule, VZ } from './vestibule3d.js';
import { buildMarionette } from './marionette3d.js';
import { buildShore, SZ } from './shore3d.js';
import { createLucifer, buildLucifer } from './lucifer3d.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';
import { sfx } from './audio.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const box3 = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

// Hall size
const HW = 20;          // half width  (x)
const HL = 34;          // half length (z)
const WALL_H = 18;      // wall height before the vault
// A stairwell in the floor (front left) goes down to the vault door; an arch in the
// right wall opens onto the long gallery that leads to the warriors.
// Round stairwell: a spiral of steps around a central column, 1.5 turns down to the vault.
const WELL = { cx: -7.2, cz: 19, r: 3.6, ring: [1.15, 3.05], depth: 9, turns: 1.5, a0: 0, gap: 0.65 };
WELL.total = WELL.turns * Math.PI * 2;
WELL.doorA = WELL.a0 + WELL.total + 0.7;          // the vault door, just past the last step
const SIDE = { z: 15.5, w: 3.2, h: 6.5 };

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function mountHQ(container, { places, owned = [], weather = 'clear', hq, rankIndex, future = 0, child = 0, story = {}, ranks = {}, tiers = {}, sky: skyInfo, onCommander, onTable, onRoom, onStory }) {
  let seed = 9; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0907);
  scene.fog = new THREE.FogExp2(0x1a120c, 0.012);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

  // ---------- materials ----------
  const stoneTex = canvasTex(512, 512, (g) => {
    g.fillStyle = '#4a4037'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 48) for (let x = (y / 48) % 2 ? -64 : 0; x < 512; x += 128) {
      const v = 78 + Math.random() * 26; g.fillStyle = `rgb(${v + 14},${v + 6},${v - 6})`; g.fillRect(x + 3, y + 3, 122, 42);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + 3, y + 36, 122, 9);
    }
  }, [4, 2]);
  const wallM = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 });
  const floorTex = canvasTex(1024, 1024, (g, w) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? '#1c1a1e' : '#e9e1d2'; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = (i + j) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(120,100,80,.18)'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(i * s + Math.random() * s, j * s); g.bezierCurveTo(i * s + Math.random() * s, j * s + s / 2, i * s + Math.random() * s, j * s + s / 2, i * s + Math.random() * s, j * s + s); g.stroke(); }
    }
    g.strokeStyle = '#c9962c'; g.lineWidth = 5; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }, [5, 8]);
  const floorM = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.15 });
  const goldM = std(0xd4a53a, { metalness: 1, roughness: 0.22 });
  const brightGold = std(0xffc83d, { metalness: 1, roughness: 0.2, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
  const marbleM = std(0xe6ddd0, { roughness: 0.35 });
  const darkStone = std(0x3a322c, { roughness: 0.85 });
  const redM = std(0x7a1a20, { roughness: 1, side: THREE.DoubleSide });
  const woodM = std(0x3b2414, { roughness: 0.7 });

  // ---------- shell: floor, walls, vaulted ceiling ----------
  const floorShape = new THREE.Shape(); floorShape.moveTo(-HW, -HL); floorShape.lineTo(HW, -HL); floorShape.lineTo(HW, HL); floorShape.lineTo(-HW, HL); floorShape.lineTo(-HW, -HL);
  const wellHole = new THREE.Path(); wellHole.absarc(WELL.cx, -WELL.cz, WELL.r, 0, Math.PI * 2, true);
  floorShape.holes.push(wellHole);
  const floorGeo = new THREE.ShapeGeometry(floorShape);
  { const pos = floorGeo.attributes.position, uv = floorGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HW) / (HW * 2), (pos.getY(i) + HL) / (HL * 2)); }
  const floor = new THREE.Mesh(floorGeo, floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // Long carpet from the doors to the throne
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6, HL * 2 - 8), std(0x6e141a, { roughness: 1 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, 2); carpet.receiveShadow = true; scene.add(carpet);
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.35, HL * 2 - 8), goldM); b.rotation.x = -Math.PI / 2; b.position.set(sx * 3.1, 0.03, 2); scene.add(b); }

  // Side walls with tall arched stained-glass windows
  const windowGlass = [];
  const glassTex = canvasTex(128, 320, (g, w, h) => {
    const cols = ['#b3202c', '#1f4fa8', '#e0a93b', '#2f8a5e', '#7a3aa8'];
    for (let y = 0; y < h; y += 20) for (let x = 0; x < w; x += 20) { g.fillStyle = cols[(x / 20 + y / 20 * 3) % cols.length]; g.fillRect(x, y, 20, 20); }
    g.strokeStyle = '#111'; g.lineWidth = 3; for (let y = 0; y <= h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 0; x <= w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#ffe7a8'; g.beginPath(); g.arc(w / 2, 80, 26, 0, Math.PI * 2); g.fill();
  });
  const winZs = [-24, -12, 0, 12, 24];
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(-HL, 0); shape.lineTo(HL, 0); shape.lineTo(HL, WALL_H); shape.lineTo(-HL, WALL_H); shape.lineTo(-HL, 0);
    for (const z of winZs) { const h = new THREE.Path(); h.moveTo(z - 2, 5); h.lineTo(z - 2, 12.5); h.absarc(z, 12.5, 2, Math.PI, 0, true); h.lineTo(z + 2, 5); h.lineTo(z - 2, 5); shape.holes.push(h); }
    if (sx > 0) { const a = new THREE.Path(), w = SIDE.w / 2; a.moveTo(SIDE.z - w, 0); a.lineTo(SIDE.z - w, SIDE.h - w); a.absarc(SIDE.z, SIDE.h - w, w, Math.PI, 0, true); a.lineTo(SIDE.z + w, 0); a.lineTo(SIDE.z - w, 0); shape.holes.push(a); }
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false, curveSegments: 16 }), wallM);
    wall.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; wall.position.set(sx * (HW + (sx > 0 ? 0 : 0)), 0, 0);
    if (sx < 0) wall.position.x = -HW - 1.5; else wall.position.x = HW + 1.5;
    wall.receiveShadow = true; scene.add(wall);
    for (const z of winZs) {
      const arch = new THREE.Shape(); arch.moveTo(-2, 0); arch.lineTo(-2, 7.5); arch.absarc(0, 7.5, 2, Math.PI, 0, true); arch.lineTo(2, 0); arch.lineTo(-2, 0);
      const glass = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), new THREE.MeshBasicMaterial({ map: glassTex, side: THREE.DoubleSide, toneMapped: false }));
      glass.position.set(sx * (HW + 0.8), 5, z); glass.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(glass); windowGlass.push(glass);
      // light shaft falling into the hall
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.4, 20, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      shaft.position.set(sx * (HW - 5), 7, z + 2); shaft.rotation.z = sx * 0.9; scene.add(shaft); windowGlass.push(shaft);
      // pilasters between windows
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, WALL_H, 2), darkStone); pil.position.set(sx * (HW - 0.2), WALL_H / 2, z + 6); pil.castShadow = true; scene.add(pil);
    }
  }
  // End walls: great doors at the front, throne wall with a rose window at the back
  const endWall = (z, face) => {
    const shape = new THREE.Shape(); shape.moveTo(-HW - 1.5, 0); shape.lineTo(HW + 1.5, 0); shape.lineTo(HW + 1.5, WALL_H + HW); shape.lineTo(-HW - 1.5, WALL_H + HW); shape.lineTo(-HW - 1.5, 0);
    const rose = new THREE.Path(); rose.absarc(0, WALL_H + 5, 4.5, 0, Math.PI * 2, true); shape.holes.push(rose);
    if (face > 0) { const d = new THREE.Path(); d.moveTo(-4.5, 0); d.lineTo(-4.5, 9); d.absarc(0, 9, 4.5, Math.PI, 0, true); d.lineTo(4.5, 0); d.lineTo(-4.5, 0); shape.holes.push(d); }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false, curveSegments: 24 }), wallM); m.position.z = z - (face > 0 ? 0 : 1.5); m.receiveShadow = true; scene.add(m);
    const roseGlass = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = ['#b3202c', '#1f4fa8', '#e0a93b', '#2f8a5e'][i % 4]; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 128, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2); g.fill(); }
      g.strokeStyle = '#111'; g.lineWidth = 6; for (let r = 30; r < 130; r += 32) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#ffe7a8'; g.beginPath(); g.arc(128, 128, 28, 0, Math.PI * 2); g.fill();
    }), side: THREE.DoubleSide, toneMapped: false }));
    roseGlass.position.set(0, WALL_H + 5, z - face * 0.6); scene.add(roseGlass); windowGlass.push(roseGlass);
    const roseRim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.35, 10, 64), goldM); roseRim.position.copy(roseGlass.position); scene.add(roseRim);
  };
  endWall(HL, 1); endWall(-HL, -1);
  // Great doors (the castle's main gate)
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 12.5, 0.4), woodM); leaf.position.set(sx * 2.25, 6.25, HL + 0.4); scene.add(leaf);
    for (let y = 1.5; y < 12; y += 2.2) { const band = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.1), goldM); band.position.set(sx * 2.25, y, HL + 0.15); scene.add(band); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 24), brightGold); ring.position.set(sx * 0.7, 5.5, HL + 0.1); scene.add(ring);
  }

  // ---------- spiral stairwell down to the vault ----------
  const ironM = std(0x2b2b30, { metalness: 0.85, roughness: 0.45 });
  const wellPos = (a, r, y = 0) => new THREE.Vector3(WELL.cx + Math.cos(a) * r, y, WELL.cz + Math.sin(a) * r);
  const STEPS = 40, stepA = WELL.total / STEPS;
  // Floating stone slabs (sectors) winding down around the column, gold on their edge.
  for (let i = 0; i < STEPS; i++) {
    const top = -WELL.depth * (i + 1) / STEPS, a = WELL.a0 + i * stepA;
    // CylinderGeometry measures theta from +z toward +x; convert from our angle (atan2(z, x)).
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(WELL.r - 0.05, WELL.r - 0.05, 0.32, 10, 1, false, Math.PI / 2 - a - stepA, stepA), i % 2 ? marbleM : darkStone);
    slab.position.set(WELL.cx, top - 0.16, WELL.cz); slab.receiveShadow = true; slab.castShadow = true; scene.add(slab);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(WELL.r - 1, 0.05, 0.06), goldM);
    const mid = wellPos(a, (WELL.r + 1) / 2, top + 0.01); edge.position.copy(mid); edge.rotation.y = -a; scene.add(edge);
  }
  // Top landing (the entry, level with the hall) and the bottom landing.
  const topLand = new THREE.Mesh(new THREE.CylinderGeometry(WELL.r - 0.05, WELL.r - 0.05, 0.3, 12, 1, false, Math.PI / 2 - WELL.a0, WELL.gap + 0.05), marbleM);
  topLand.position.set(WELL.cx, -0.15, WELL.cz); scene.add(topLand);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(WELL.r, WELL.r, 0.4, 48), darkStone); bottom.position.set(WELL.cx, -WELL.depth - 0.2, WELL.cz); bottom.receiveShadow = true; scene.add(bottom);
  // Central column with a gold cap, and the round stone shaft.
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, WELL.depth + 1.4, 24), marbleM); col.position.set(WELL.cx, (1.4 - WELL.depth) / 2, WELL.cz); col.castShadow = true; scene.add(col);
  const colCap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), brightGold); colCap.position.set(WELL.cx, 1.55, WELL.cz); scene.add(colCap);
  const shaftTex = stoneTex.clone(); shaftTex.needsUpdate = true; shaftTex.repeat.set(5, 3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(WELL.r + 0.05, WELL.r + 0.05, WELL.depth + 0.6, 48, 1, true), new THREE.MeshStandardMaterial({ map: shaftTex, roughness: 0.95, side: THREE.BackSide }));
  shaft.position.set(WELL.cx, -WELL.depth / 2 - 0.3, WELL.cz); shaft.receiveShadow = true; scene.add(shaft);
  // Balustrade round the opening, open where the stairs begin.
  const railPost = new THREE.CylinderGeometry(0.11, 0.14, 1.1, 8);
  for (let k = 0; k < 28; k++) {
    const a = WELL.a0 + (k / 28) * Math.PI * 2; const d = Math.atan2(Math.sin(a - WELL.a0 + WELL.gap / 2), Math.cos(a - WELL.a0 + WELL.gap / 2));
    if (Math.abs(d) < WELL.gap / 2 + 0.12) continue;
    const p = new THREE.Mesh(railPost, darkStone); p.position.copy(wellPos(a, WELL.r + 0.12, 0.55)); scene.add(p);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(WELL.r + 0.12, 0.08, 6, 64, Math.PI * 2 - WELL.gap - 0.25), goldM);
  rail.rotation.x = Math.PI / 2; rail.rotation.z = WELL.a0 + 0.12; rail.position.set(WELL.cx, 1.12, WELL.cz); scene.add(rail);
  // Torches down the shaft.
  const wellFlames = [];
  for (const [a, y] of [[WELL.a0 + 1.6, -1.6], [WELL.a0 + 3.4, -3.4], [WELL.a0 + 5.2, -5.2], [WELL.a0 + 7, -7], [WELL.a0 + 8.8, -8.6]]) {
    const pos = wellPos(a, WELL.r - 0.2, y);
    const hold = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 8), ironM); hold.position.copy(pos); scene.add(hold);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2e, toneMapped: false })); fl.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0)); scene.add(fl);
    const l = new THREE.PointLight(0xff8a3c, 14, 11, 1.5); l.position.copy(wellPos(a, WELL.r - 1, y + 0.6)); scene.add(l);
    wellFlames.push({ fl, l });
  }
  // The vault door on the shaft wall at the bottom.
  const vArch = new THREE.Shape(); vArch.moveTo(-1.1, 0); vArch.lineTo(-1.1, 2.9); vArch.absarc(0, 2.9, 1.1, Math.PI, 0, true); vArch.lineTo(1.1, 0); vArch.lineTo(-1.1, 0);
  const door = new THREE.Group(); door.position.copy(wellPos(WELL.doorA, WELL.r - 0.02, -WELL.depth)); door.lookAt(WELL.cx, -WELL.depth, WELL.cz); scene.add(door);
  const vDoor = new THREE.Mesh(new THREE.ExtrudeGeometry(vArch, { depth: 0.12, bevelEnabled: false, curveSegments: 20 }), ironM); door.add(vDoor);
  for (let y = 0.6; y < 3.4; y += 0.7) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.05), std(0x5a4a3a, { metalness: 0.6 })); b.position.set(0, y, 0.15); door.add(b); }
  const vRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 20), std(0x8a7a5a, { metalness: 0.8 })); vRing.position.set(0.55, 1.8, 0.2); door.add(vRing);
  const plaqueTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#1e140c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9a7a4a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 64px Tajawal, system-ui, sans-serif'; g.fillStyle = '#c9a36a'; g.fillText('القبو', w / 2, h / 2 + 4);
  });
  const vSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: plaqueTex })); vSign.position.set(0, 4.35, 0.12); door.add(vSign);

  // ---------- arch in the right wall onto the gallery ----------
  // No door and no name: only a warm light deep inside.
  const sideGlow = new THREE.Mesh(new THREE.PlaneGeometry(SIDE.w, SIDE.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.95, 0.6), toneMapped: false }));
  sideGlow.position.set(HW + 1.45, SIDE.h / 2, SIDE.z); sideGlow.rotation.y = -Math.PI / 2; scene.add(sideGlow);
  const sideFrame = new THREE.Mesh(new THREE.TorusGeometry(SIDE.w / 2 + 0.2, 0.25, 10, 32, Math.PI), darkStone); sideFrame.position.set(HW - 0.05, SIDE.h - SIDE.w / 2, SIDE.z); sideFrame.rotation.y = Math.PI / 2; scene.add(sideFrame);
  for (const sz of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.5, SIDE.h - SIDE.w / 2, 0.5), darkStone); j.position.set(HW - 0.05, (SIDE.h - SIDE.w / 2) / 2, SIDE.z + sz * (SIDE.w / 2 + 0.2)); scene.add(j); }
  const sideLight = new THREE.PointLight(0xffe2b0, 14, 12, 1.5); sideLight.position.set(HW - 1, 3, SIDE.z); scene.add(sideLight);

  // Ribbed barrel vault
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(HW + 1.5, HW + 1.5, HL * 2 + 3, 48, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: stoneTex, side: THREE.BackSide, roughness: 0.95, color: 0x9a8a7a }));
  vault.rotation.x = Math.PI / 2; vault.rotation.y = Math.PI; vault.position.y = WALL_H; vault.rotation.z = 0; scene.add(vault);
  vault.rotation.set(-Math.PI / 2, 0, 0);
  for (let z = -HL; z <= HL; z += 8.5) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(HW + 0.8, 0.5, 8, 48, Math.PI), darkStone); rib.position.set(0, WALL_H, z); scene.add(rib);
    const ribGold = new THREE.Mesh(new THREE.TorusGeometry(HW + 0.3, 0.12, 6, 48, Math.PI), goldM); ribGold.position.set(0, WALL_H, z); scene.add(ribGold);
  }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2, 0.8, HL * 2), goldM); cornice.position.y = WALL_H - 0.4;
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, HL * 2), darkStone); c.position.set(sx * (HW - 0.3), WALL_H - 0.45, 0); scene.add(c); const g = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, HL * 2), goldM); g.position.set(sx * (HW - 1.05), WALL_H - 0.9, 0); scene.add(g); }

  // ---------- giant columns ----------
  const colGeo = new THREE.CylinderGeometry(1.1, 1.3, WALL_H - 2, 20);
  for (const sx of [-1, 1]) for (let z = -28; z <= 28; z += 8) {
    const c = new THREE.Mesh(colGeo, marbleM); c.position.set(sx * 13, WALL_H / 2 - 0.5, z); c.castShadow = true; c.receiveShadow = true; scene.add(c);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.2), darkStone); base.position.set(sx * 13, 0.6, z); scene.add(base);
    const baseG = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 8, 24), goldM); baseG.rotation.x = Math.PI / 2; baseG.position.set(sx * 13, 1.3, z); scene.add(baseG);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.2, 1.4, 20), goldM); cap.position.set(sx * 13, WALL_H - 1.5, z); scene.add(cap);
    // arches linking the columns along the nave
    if (z < 28) { const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.45, 8, 32, Math.PI), darkStone); arch.rotation.y = Math.PI / 2; arch.position.set(sx * 13, WALL_H - 5.2, z + 4); scene.add(arch); }
    // long hanging banners between columns
    if (z < 28 && !(sx > 0 && Math.abs(z + 4 - SIDE.z) < 3)) {   // no banner in front of the gallery arch
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 9), std([0x6e141a, 0x1d3a6b, 0x2a5a3a][Math.abs(z / 8) % 3 | 0], { side: THREE.DoubleSide, roughness: 1 }));
      banner.position.set(sx * 13, WALL_H - 9, z + 4); banner.rotation.y = Math.PI / 2; scene.add(banner);
      const emb = new THREE.Mesh(new THREE.CircleGeometry(0.8, 6), brightGold); emb.position.set(sx * 13 + sx * 0.02, WALL_H - 7.5, z + 4); emb.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(emb);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.2, 3), std([0x6e141a, 0x1d3a6b, 0x2a5a3a][Math.abs(z / 8) % 3 | 0], { side: THREE.DoubleSide })); tip.rotation.z = Math.PI; tip.rotation.y = Math.PI / 2; tip.position.set(sx * 13, WALL_H - 14.1, z + 4); scene.add(tip);
    }
  }

  // ---------- throne dais at the back ----------
  const dais = new THREE.Group(); dais.position.z = -HL + 7; scene.add(dais);
  for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(18 - i * 2.4, 0.5, 9 - i * 1.2), i % 2 ? marbleM : darkStone); st.position.set(0, 0.25 + i * 0.5, -i * 0.4); st.receiveShadow = true; st.castShadow = true; dais.add(st); }
  const throne = new THREE.Group(); throne.position.set(0, 2.5, -1.8); dais.add(throne);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 2.4), goldM); seat.position.y = 1; throne.add(seat);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 2), std(0x7a1a20)); cushion.position.y = 1.55; throne.add(cushion);
  const backR = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.5), goldM); backR.position.set(0, 4, -1); throne.add(backR);
  const backC = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5, 0.2), std(0x7a1a20)); backC.position.set(0, 3.8, -0.72); throne.add(backC);
  const crest = new THREE.Mesh(new THREE.CircleGeometry(1.4, 6), brightGold); crest.position.set(0, 7.6, -0.9); throne.add(crest);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 2.4), goldM); arm.position.set(sx * 1.6, 1.8, 0); throne.add(arm);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7.5, 12), goldM); post.position.set(sx * 1.55, 3.7, -1); throne.add(post);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), brightGold); orb.position.set(sx * 1.55, 7.6, -1); throne.add(orb);
  }
  shadowAll(throne);
  // Giant banner behind the throne
  const bigBanner = new THREE.Mesh(new THREE.PlaneGeometry(9, 15), redM); bigBanner.position.set(0, 11, -HL + 0.3); scene.add(bigBanner);
  const bigEmblem = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.6, 6), brightGold); bigEmblem.position.set(0, 13, -HL + 0.35); scene.add(bigEmblem);
  const bigStar = new THREE.Mesh(new THREE.CircleGeometry(1.2, 8), brightGold); bigStar.position.set(0, 13, -HL + 0.36); scene.add(bigStar);

  // Guardian statues flanking the dais and the doors
  const statue = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2, 2.4), darkStone); ped.position.y = 1; g.add(ped);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 4.6, 12), marbleM); body.position.y = 4.3; g.add(body);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 1.1), marbleM); chest.position.y = 5.8; g.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), marbleM); head.position.y = 7.1; g.add(head);
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1, 12), goldM); helm.position.y = 7.7; g.add(helm);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 6), goldM); shield.rotation.x = Math.PI / 2; shield.position.set(-0.9, 4.8, 0.6); g.add(shield);
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 8, 8), goldM); spear.position.set(0.95, 5.5, 0.3); g.add(spear);
    const tipS = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 8), brightGold); tipS.position.set(0.95, 9.9, 0.3); g.add(tipS);
    shadowAll(g); scene.add(g);
  };
  statue(-8, -HL + 8, 0.3); statue(8, -HL + 8, -0.3); statue(-7.5, HL - 3, Math.PI - 0.2); statue(7.5, HL - 3, Math.PI + 0.2);

  // Armour stands and weapon racks along the walls
  for (const sx of [-1, 1]) for (const z of [-18, -6, 6, 18]) {
    const g = new THREE.Group(); g.position.set(sx * 17.5, 0, z); g.rotation.y = -sx * Math.PI / 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8), woodM); pole.position.y = 1.8; g.add(pole);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.3, 12), std(0x8a8f96, { metalness: 0.9, roughness: 0.3 })); torso.position.y = 2.9; g.add(torso);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), std(0x8a8f96, { metalness: 0.9, roughness: 0.3 })); helm.position.y = 3.8; g.add(helm);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), redM); plume.position.y = 4.3; g.add(plume);
    shadowAll(g); scene.add(g);
  }

  // ---------- war table: a long oak table with an unrolled pirate war map ----------
  const table = new THREE.Group(); table.position.set(0, 0, -4); scene.add(table);
  box3(table, 10, 0.35, 7, woodM, 0, 2.05, 0);
  const trimG = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.12, 7.2), goldM); trimG.position.y = 2.02; table.add(trimG);
  for (const [x, z] of [[-4.4, -3], [4.4, -3], [-4.4, 3], [4.4, 3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.05, 10), woodM); l.position.set(x, 1.02, z); table.add(l); const k = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), goldM); k.position.set(x, 0.3, z); table.add(k); }
  const wm = warMapCanvas(places, hq);
  const mapTex = new THREE.CanvasTexture(wm.canvas); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 8;
  wm.ready.then(() => { mapTex.needsUpdate = true; });
  const parchment = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 6), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9, transparent: true }));
  parchment.rotation.x = -Math.PI / 2; parchment.position.y = 2.42; table.add(parchment);
  const paperM = std(0xd8bd86, { roughness: 1 });
  for (const sx of [-1, 1]) { const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6.2, 16), paperM); roll.rotation.x = Math.PI / 2; roll.position.set(sx * 4.4, 2.6, 0); table.add(roll); }
  // props: candle, dagger pinning the map, compass, ink pot
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 10), std(0xf5ecd8)); candle.position.set(3.6, 2.75, -2.3); table.add(candle);
  const cf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xffb13b, toneMapped: false })); cf.position.set(3.6, 3.22, -2.3); table.add(cf);
  const dagger = new THREE.Group(); dagger.position.set(-3.4, 2.5, 2.2); dagger.rotation.set(0.3, 0.6, 0.2); table.add(dagger);
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.4, 4), std(0xcfd4da, { metalness: 1, roughness: 0.2 })); blade.rotation.x = Math.PI; blade.position.y = 0.2; dagger.add(blade);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), goldM); hilt.position.y = 1.1; dagger.add(hilt);
  const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 24), goldM); comp.position.set(2.8, 2.47, 2.1); table.add(comp);
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 12), std(0x1a1a2a, { roughness: 0.2 })); ink.position.set(-3.6, 2.57, -2.2); table.add(ink);
  const quill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.1, 6), std(0xf5f5f5)); quill.position.set(-3.5, 2.9, -2.1); quill.rotation.z = 0.5; table.add(quill);
  shadowAll(table);
  parchment.receiveShadow = true;
  const markers = [];
  const holo = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.5, 6), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending }));
  holo.position.set(0, 3.5, -4); scene.add(holo);

  // ---------- light: chandeliers, braziers, window light ----------
  const hallHemi = new THREE.HemisphereLight(0xffe2b8, 0x20140c, 0.5); scene.add(hallHemi);
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.2); sun.position.set(-30, 30, 8); sun.target.position.set(0, 0, 0); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xfff2dc, 0.7); fill.position.set(5, 12, 30); scene.add(fill);
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb13b, toneMapped: false });
  // chandeliers
  for (const z of [-18, 0, 18]) {
    const g = new THREE.Group(); g.position.set(0, WALL_H - 1, z); scene.add(g);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, HW - 3, 6), goldM); chain.position.y = (HW - 3) / 2; g.add(chain);
    for (const [r, y] of [[3.2, 0], [2, 1.4]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 48), goldM); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
      const n = Math.round(r * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), std(0xf5ecd8)); candle.position.set(Math.cos(a) * r, y + 0.3, Math.sin(a) * r); g.add(candle);
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), flameMat); f.position.set(Math.cos(a) * r, y + 0.7, Math.sin(a) * r); g.add(f); flames.push({ m: f, ph: rand() * 6 });
      }
    }
    const light = new THREE.PointLight(0xffb866, 60, 34, 1.5); light.position.y = -0.5; g.add(light); flames.push({ light, base: 60, ph: rand() * 6 });
  }
  // braziers around the table
  for (const [x, z] of [[-7, -9], [7, -9], [-7, 1], [7, 1]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 2.4, 8), std(0x3a2a1c, { metalness: 0.7 })); leg.position.y = 1.2; g.add(leg);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), goldM); bowl.position.y = 3; g.add(bowl);
    const coals = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false })); coals.rotation.x = -Math.PI / 2; coals.position.y = 2.95; g.add(coals);
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35 - i * 0.04, 1.2 - i * 0.1, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7a1f : 0xffc34d, toneMapped: false, transparent: true, opacity: 0.9 })); f.position.set((rand() - 0.5) * 0.5, 3.2, (rand() - 0.5) * 0.5); g.add(f); flames.push({ m: f, ph: rand() * 6, big: true }); }
    const light = new THREE.PointLight(0xff8a3c, 22, 16, 1.6); light.position.y = 3.6; g.add(light); flames.push({ light, base: 22, ph: rand() * 6 });
    shadowAll(leg);
  }
  // embers / dust in the light
  const EMB = 400, ep = new Float32Array(EMB * 3), es = new Float32Array(EMB);
  for (let i = 0; i < EMB; i++) { ep.set([(rand() - 0.5) * HW * 1.8, rand() * WALL_H, (rand() - 0.5) * HL * 1.8], i * 3); es[i] = rand(); }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // ---------- commander ----------
  const cmd = buildWorshipper({ robe: '#3a4f7a', accent: '#d4a53a', skin: '#f3d3b6', glow: '#ffc83d' });
  cmd.root.position.set(0, 0, 1.4); cmd.root.rotation.y = 0; scene.add(cmd.root);
  const spot = new THREE.SpotLight(0xfff0d0, 90, 30, 0.35, 0.6, 1.4); spot.position.set(0, WALL_H - 2, 6); spot.target = cmd.root; spot.castShadow = true; scene.add(spot);
  const insignia = new THREE.Group(); cmd.root.add(insignia);
  // insignia in the character's local space (the model is scaled ×1.6 inside root)
  const setRank = (ri) => {
    insignia.clear();
    const n = Math.min(5, 1 + Math.floor(ri / 2));
    for (let i = 0; i < n; i++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), brightGold); st.scale.set(1, 1, 0.4); st.position.set((i - (n - 1) / 2) * 0.1, 1.4, 0.29); insignia.add(st); }
    if (ri >= 3) for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.19), brightGold); e.position.set(sx * 0.3, 1.56, 0); insignia.add(e); }
    if (ri >= 7) { const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), redM); cape.position.set(0, 1.06, -0.29); cape.rotation.x = 0.08; insignia.add(cape); }
  };
  setRank(rankIndex);

  // ---------- walking: the commander moves around the hall ----------
  const dungeon = buildDungeon(scene);
  const heaven = buildHeaven(scene, { owned: new Set(owned), story, ranks, tiers });
  const shore = buildShore(scene, { tiers }); shore.setStage(story.ship || 0);
  const gallery = buildVestibule(scene);
  dungeon.setFuture(future); dungeon.setChild(child);
  // The marionette of the eight leaders, on its stand by the left wall of the vault, facing the aisle.
  const mario = buildMarionette(scene, { at: new THREE.Vector3(DX - 10, 0, 4), face: Math.PI / 2, owned });
  let holdK = 0, heldAt = 0;
  const inSide = (x, z) => x > 10 && x < HW + 0.8 && Math.abs(z - SIDE.z) < SIDE.w / 2 - 0.45;
  // Spiral stairs: follow how far round the commander has walked (angle unwrapped),
  // so each point of the ring knows which turn of the spiral it is on.
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const wellR = (x, z) => Math.hypot(x - WELL.cx, z - WELL.cz), wellA = (x, z) => Math.atan2(z - WELL.cz, x - WELL.cx);
  const inGap = (x, z) => { const d = wrap(wellA(x, z) - WELL.a0); return d < 0.05 && d > -WELL.gap; };
  const spiral = { on: false, acc: 0, last: 0 };
  const trackSpiral = (x, z) => {
    if (wellR(x, z) > WELL.ring[1] + 0.1) { spiral.on = false; return; }
    const a = wellA(x, z);
    if (!spiral.on) { spiral.on = true; spiral.acc = wrap(a - WELL.a0); } else spiral.acc += wrap(a - spiral.last);
    spiral.last = a;
  };
  const spiralY = (acc) => (acc <= 0 ? 0 : -WELL.depth * Math.min(1, acc / WELL.total));
  const hallGround = (x, z) => { trackSpiral(x, z); return spiral.on ? spiralY(spiral.acc) : 0; };
  const inHall = (x, z) => {
    if (inSide(x, z)) return false;                                                    // passage to the gallery
    // Stairwell: you get on and off only at the top landing; inside, stay on the ring.
    const c = cmd.root.position, rc = wellR(c.x, c.z), r = wellR(x, z);
    if (rc < WELL.ring[1] + 0.05) {
      if (r < WELL.ring[0]) return true;
      if (r <= WELL.ring[1]) return false;
      return !(spiral.acc <= 0.05 && inGap(x, z));
    }
    if (r < WELL.r + 0.2) return !(r > WELL.ring[0] && inGap(x, z));               // only through the opening in the balustrade
    if (Math.abs(x) > 10.5 || z > HL - 1.2 || z < -HL + 12) return true;          // nave walls, doors, dais
    if (Math.abs(x) < 5.6 && z > -8 && z < 0) return true;                          // war table
    for (const [bx, bz] of [[-7, -9], [7, -9], [-7, 1], [7, 1]]) if (Math.hypot(x - bx, z - bz) < 1.2) return true; // braziers
    return false;
  };
  const inDungeon = (x, z) => {
    if (mario.blocked(x, z)) return true;
    x -= DX;
    if (Math.abs(x) > D.hw - 1.2 || z > D.hl - 1.5 || z < -D.hl + 10.8) return true;   // walls and cell bars
    for (const sx of [-1, 1]) for (const pz of [-12, 0, 12]) if (Math.abs(x - sx * 15) < 1.6 && Math.abs(z - pz) < 1.6) return true;
    return false;
  };
  const walker = createWalker({ hero: cmd, camera, dom: renderer.domElement, container, blocked: inHall, dist: 9, height: 2.6 });
  walker.setGround(hallGround);
  walker.teleport(0, 6, 0);   // facing the great doors
  if (window.__nmnDebug) window.__hqTeleport = (x, z, f = Math.PI) => walker.teleport(x, z, f);
  if (window.__nmnDebug) window.__hqStairs = (acc) => { const ang = WELL.a0 + acc, x = WELL.cx + Math.cos(ang) * 2.1, z = WELL.cz + Math.sin(ang) * 2.1; spiral.on = true; spiral.acc = acc; spiral.last = Math.atan2(z - WELL.cz, x - WELL.cx); walker.teleport(x, z, -ang); };
  let room = 'hall';
  const stairCam = new THREE.Vector3(), stairTarget = new THREE.Vector3();
  let stairBlend = 0, stairDir = 1;
  const clampHall = (p) => {
    p.x = Math.max(-10.5, Math.min(10.5, p.x)); p.z = Math.max(-HL + 2, Math.min(HL - 1, p.z)); p.y = Math.max(0.8, Math.min(WALL_H + 6, p.y));
    // On the stairs the camera follows along the spiral behind and above him, inside the shaft.
    const want = spiral.on && spiral.acc > 0.25 ? 1 : 0;
    stairBlend += (want - stairBlend) * 0.08;
    if (stairBlend < 0.01) return;
    // Behind him along the way he faces: up the stairs while he goes down, down the stairs while he climbs,
    // so "forward" always walks the way he is looking.
    const f = cmd.root.rotation.y, ang = WELL.a0 + spiral.acc;
    const down = Math.sin(f) * -Math.sin(ang) + Math.cos(f) * Math.cos(ang);
    if (Math.abs(down) > 0.3) stairDir = down > 0 ? 1 : -1;
    const back = Math.max(-0.4, Math.min(WELL.total + 0.6, spiral.acc - stairDir)), a = WELL.a0 + back;
    stairTarget.set(WELL.cx + Math.cos(a) * 2.9, Math.max(spiralY(back), spiralY(spiral.acc)) + 3.8, WELL.cz + Math.sin(a) * 2.9);
    if (stairCam.lengthSq() === 0) stairCam.copy(p);
    stairCam.lerp(stairTarget, 0.12);
    p.lerp(stairCam, stairBlend);
  };
  const clampDungeon = (p) => { p.x = Math.max(DX - D.hw + 1, Math.min(DX + D.hw - 1, p.x)); p.z = Math.max(-D.hl + 10, Math.min(D.hl - 1, p.z)); p.y = Math.max(mario.holding ? 7.5 : 0.8, Math.min(14, p.y)); };
  walker.setCameraClamp(clampHall);

  // ---------- the story: Lucifer, the speech, the march to the shore, the empty cage ----------
  const storyState = { phase: 'none', ...story };
  // After the commander's telegram: golden arrows on the floor from the palace hall, through
  // the gallery, to the light that opens on the Hall of Warriors (until the speech is given).
  const summonArrows = (() => {
    const g = new THREE.Group(); scene.add(g);
    const shape = new THREE.Shape(); shape.moveTo(0, 0.9); shape.lineTo(0.9, 0); shape.lineTo(0.35, 0); shape.lineTo(0.35, -0.9); shape.lineTo(-0.35, -0.9); shape.lineTo(-0.35, 0); shape.lineTo(-0.9, 0); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape), list = [];
    const along = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.4));
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n, holder = new THREE.Group(); holder.position.set(ax + (bx - ax) * f, 0.07, az + (bz - az) * f); holder.rotation.y = Math.atan2(-(bx - ax), -(bz - az));
          const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.9);
          holder.add(m); g.add(holder); list.push(m);
        }
      }
    };
    along([[0, 8], [7, 15.5], [HW - 0.5, 15.5]]);              // the hall: to the side door
    along([[0, VZ + 23], [0, VZ - 27]]);                        // the gallery: to the light
    return { g, tick(t) { g.visible = !!storyState.summoned && !storyState.speech; if (g.visible) list.forEach((m, i) => (m.material.opacity = 0.35 + 0.6 * Math.max(0, Math.sin(t * 4 - i * 0.6)))); } };
  })();
  let hallLuci = storyState.jailed ? null : createLucifer(scene, { camera, container, hero: cmd.root, who: 'commander', groundAt: () => 0, first: 12 });
  // Lucifer locked in the golden cage in the warriors' hall (until he escapes).
  let caged = null;
  const cageLucifer = () => { if (caged) return; const L = buildLucifer(); L.root.position.copy(heaven.cageLocal).setY(0.35); L.root.rotation.y = Math.PI / 2; heaven.group.add(L.root); L.hero.kneel(1e6); caged = L; };
  if (storyState.jailed && storyState.phase !== 'back') cageLucifer();   // on the way back he has already slipped out
  const following = () => storyState.phase === 'march' || storyState.phase === 'back';
  heaven.follow(following()); heaven.setGuide(storyState.phase === 'march');

  // Cinematic tools: letterbox, subtitles, a scripted camera that can track a figure, simple timed animations.
  const bars = document.createElement('div'); bars.className = 'cine-bars'; bars.hidden = true; container.appendChild(bars);
  const sub = document.createElement('div'); sub.className = 'cine-sub'; sub.hidden = true; container.appendChild(sub);
  const flashEl = document.createElement('div'); flashEl.className = 'cine-flash'; container.appendChild(flashEl);
  const spyEl = document.createElement('div'); spyEl.className = 'spy-view'; spyEl.hidden = true; container.appendChild(spyEl);
  const cine = { on: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), cur: new THREE.Vector3(), curLook: new THREE.Vector3(), speed: 1.5, follow: null, off: new THREE.Vector3(), chase: null, chaseOff: new THREE.Vector3() };
  const shot = (pos, look, speed = 1.2, snap = false) => { cine.follow = null; cine.chase = null; cine.pos.copy(pos); cine.look.copy(look); cine.speed = speed; if (snap) { cine.cur.copy(pos); cine.curLook.copy(look); } };
  const track = (obj, off = new THREE.Vector3(0, 2, 0)) => { cine.follow = obj; cine.off.copy(off); };
  // The camera rides along with a figure at a fixed offset (in world axes).
  const chase = (obj, off, look = new THREE.Vector3(0, 1.8, 0), speed = 2) => { cine.chase = obj; cine.chaseOff.copy(off); track(obj, look); cine.speed = speed; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (who, text, ms) => { sub.innerHTML = `${who ? `<b>${who}</b>` : ''}<span>${text}</span>`; sub.hidden = false; return wait(ms); };
  const anims = [];
  const animate = (dur, fn) => new Promise((res) => anims.push({ t: 0, dur, fn, res }));
  const flash = (color = '#fff') => { flashEl.style.background = color; flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); };
  const ease = (k) => k * k * (3 - 2 * k);
  let luciCtx = null;
  let pointing = false, cheering = false, cmdWalk = null, spyState = null, mapState = null, offerArm = null, cmdReach = 0;
  const HV = (x, y, z) => new THREE.Vector3(HX + x, y, z);   // a point in the warriors' hall
  const SV = (x, y, z) => new THREE.Vector3(x, y, SZ + z);    // a point on the shore
  const beginCine = () => { sub.hidden = true; cine.on = true; prompt.hidden = true; action = null; caption.hidden = true; walker.setEnabled(false); bars.hidden = false; document.body.classList.add('cine'); hallLuci?.setEnabled(false); };
  const endCine = () => { sub.hidden = true; bars.hidden = true; document.body.classList.remove('cine'); cine.on = false; cine.follow = null; cine.chase = null; walker.setEnabled(true); };
  // Walk the commander to a point (with his walking animation).
  const walkCmd = async (to, secs) => { const from = cmd.root.position.clone(), face = Math.atan2(to.x - from.x, to.z - from.z); cmdWalk = 1; await animate(secs, (k) => { const e = ease(k); walker.teleport(from.x + (to.x - from.x) * e, from.z + (to.z - from.z) * e, face); }); cmdWalk = null; };

  // 1. The speech in the Hall of Warriors.
  async function runSpeech() {
    if (cine.on || storyState.speech) return;
    beginCine();
    const P = heaven.platform;
    walker.teleport(P.x, P.z, 0);
    heaven.setFocus(P);
    shot(HV(0, 11, 21), HV(0, 3, -10), 0.5, true);
    await wait(600);
    shot(HV(0, 5.5, 8), HV(0, 3, -13), 0.35);                        // slow push down the aisle
    await wait(3400);
    shot(HV(2.4, 1.7, -9.2), HV(0, 3.5, -14), 0.6);                  // low, heroic, on the commander
    say('القائد', 'أيها المحاربون… أنا ممتنٌّ لكم على انتصاراتكم…', 0);
    await wait(2600);
    // As he speaks the camera rises high over the hall…
    shot(HV(0, 27, -4), HV(0, 0, -3), 0.42);
    await wait(3200);
    // …and the floor of the aisle splits with red light.
    sfx.thunder(); flash('#ff3a1a');
    const exp0 = renderer.toneMappingExposure;
    const rift = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff2a0a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    rift.rotation.x = -Math.PI / 2; rift.position.set(0, 0.06, 1); heaven.group.add(rift);
    const L = buildLucifer(); heaven.group.add(L.root); L.root.position.set(0, -3.4, 1); L.root.rotation.y = Math.PI; L.setOpacity(1);
    const redL = new THREE.PointLight(0xff2a10, 0, 22, 1.5); redL.position.set(0, 3, 1); heaven.group.add(redL);
    let mood = 'happy'; const luciOn = { on: true };
    anims.push({ t: 0, dur: 1e9, fn: (k, t, dt) => { if (luciOn.on) { L.tick(t, dt, mood, 1); redL.intensity = 26 + Math.sin(t * 9) * 8; rift.material.opacity = 0.55 + Math.sin(t * 7) * 0.15; } }, res: () => {} });
    await animate(1.2, (k) => { rift.scale.setScalar(0.2 + k * 2.6); renderer.toneMappingExposure = exp0 * (1 - k * 0.3); });
    sub.hidden = true;
    // He rises out of the ground; the camera comes down to meet him.
    sfx.luciLaugh();
    shot(HV(4.5, 6, 9), HV(0, 1.8, 1), 0.55);
    await animate(3, (k) => { L.root.position.y = -3.4 + ease(k) * 3.75; });
    luciCtx = { L, rift, redL, exp0, luciOn, setMood: (m) => (mood = m) };
    shot(HV(2.6, 2.2, -3.4), HV(0, 2.7, 1), 0.8);
    await say('لوسيفير', 'فرحةٌ مؤقتة! وسأُفسد محاربيك، من أوّلهم إلى آخرهم، أيها القائد…', 5200);
    mood = 'angry'; shot(HV(-2.6, 2.2, -3.4), HV(0, 2.7, 1), 0.35);    // slow orbit round him
    await say('لوسيفير', 'إلى أن أراك وحيدًا ضعيفًا… ثم أبيعك الآمالَ والأحلامَ الكاذبة إلى أن تموت…', 5600);
    mood = 'happy'; sfx.luciLaugh(); shot(HV(0.4, 2.9, -1.4), HV(0, 2.95, 1), 0.7);  // close on his face
    await say('لوسيفير', 'وبعدها سأضمن أنك ستكون رفيقي الأبديّ في جهنّم!', 4600);
    shot(HV(2.2, 3.3, -8.4), HV(0, 3.6, -14), 1.2);                  // close on the commander
    await say('القائد', 'هذه أكبرُ أمانيك.', 3200);
    // He points to the spiritual warrior.
    const w = heaven.warriors[0];
    sub.hidden = true;
    const wx = w.hero.root.position.x, wz = w.hero.root.position.z, pd = new THREE.Vector3(wx, 0, wz - (P.z)).normalize(), pl = new THREE.Vector3(pd.z, 0, -pd.x);
    walker.teleport(P.x, P.z, Math.atan2(pd.x, pd.z)); pointing = true;
    say('القائد', 'احبسلي لوسيفير!', 0);
    shot(HV(pl.x * 4.6 + pd.x * 1.6, 3.3, P.z + pl.z * 4.6 + pd.z * 1.6), HV(pd.x * 3, 2.6, P.z + pd.z * 3), 1.6);   // side on: his arm out towards the warrior
    await wait(2600); sub.hidden = true;
    heaven.script(w, true); w.walk = 1;
    const from = w.hero.root.position.clone(), to = new THREE.Vector3(1.6, 0, -0.2);
    shot(HV(-3.5, 5, -11), HV(2, 2, -3), 0.8); track(w.hero.root, new THREE.Vector3(0, 2, 0));
    await animate(3, (k) => { w.hero.root.position.lerpVectors(from, to, ease(k)); w.hero.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z); });
    w.walk = 0; w.hero.root.rotation.y = Math.atan2(0 - to.x, 1 - to.z); pointing = false;
    shot(HV(-3.4, 1.6, -3.4), HV(0.8, 2.2, 0.6), 2.5);              // low angle on the strike
    w.hero.salute(); await wait(500);
    flash('#fff'); sfx.impact(); sfx.luciRoar(); mood = 'angry';
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 48), new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); wave.rotation.x = -Math.PI / 2; wave.position.set(0, 0.2, 1); heaven.group.add(wave);
    const chainsG = new THREE.Group(); chainsG.position.set(0, 1.2, 1); heaven.group.add(chainsG);
    const chainM = new THREE.MeshStandardMaterial({ color: 0xffd06a, metalness: 1, roughness: 0.25, emissive: 0x6a4400, emissiveIntensity: 0.8 });
    for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 6, 32), chainM); c.rotation.set(Math.PI / 2 + (k - 2.5) * 0.25, k, 0); c.position.y = (k - 2.5) * 0.35; chainsG.add(c); }
    await animate(1, (k) => { wave.scale.setScalar(1 + k * 9); wave.material.opacity = 1 - k; L.root.position.x = -k * 1.4; L.root.rotation.z = k * 0.5; chainsG.position.x = -k * 1.4; chainsG.scale.setScalar(1.6 - k * 1); });
    heaven.group.remove(wave);
    sub.hidden = true; await wait(1600);
    // He drags him to the golden cage.
    shot(HV(-1, 9, 13), HV(-6, 1, 2), 0.7);
    const cage = heaven.cageLocal, lf = L.root.position.clone(), lt = cage.clone().setY(0.35);
    heaven.setCageOpen(1); w.walk = 1;
    await animate(3, (k) => { const e = ease(k); L.root.position.lerpVectors(lf, lt, e); L.root.position.y = 0.35 + Math.sin(k * Math.PI) * 0.6; chainsG.position.set(L.root.position.x, 1.2, L.root.position.z); w.hero.root.position.lerpVectors(to, new THREE.Vector3(cage.x + 2.6, 0, cage.z + 1), e); w.hero.root.rotation.y = Math.atan2(cage.x - to.x, cage.z - to.z); });
    w.walk = 0; heaven.setCageOpen(0); sfx.impact(); creak();
    luciOn.on = false; heaven.group.remove(L.root, chainsG, redL, rift); cageLucifer();
    animate(1.5, (k) => { renderer.toneMappingExposure = luciCtx.exp0 * (0.7 + k * 0.3); });
    shot(HV(-7.5, 2.6, 7.5), HV(cage.x, 1.6, cage.z), 1);
    await wait(2800);
    storyState.jailed = true; hallLuci?.dispose(); hallLuci = null;
    w.walk = 1;
    const wb = w.hero.root.position.clone();
    shot(HV(0, 3.4, -8.6), HV(0, 3.3, -14), 0.8);
    await animate(2.4, (k) => { w.hero.root.position.lerpVectors(wb, from, k); w.hero.root.rotation.y = Math.atan2(from.x - wb.x, from.z - wb.z); });
    w.walk = 0; heaven.script(w, false);
    walker.teleport(P.x, P.z, 0);
    shot(HV(1.4, 2.5, -8.6), HV(0, 3.6, -14), 0.35);                 // slow push-in during the vow
    await say('القائد', 'أنظاري تتّجه إلى جزيرة القادة… حتى يكون لي فيها مكانٌ بين القادة العظماء.', 6000);
    // The warriors roar: the camera cranes up over the hall.
    cheering = true; sfx.cheer();
    heaven.warriors.forEach((x, i) => setTimeout(() => x.hero.salute(), i * 90));
    shot(HV(0, 2.5, 4), HV(0, 2, -6), 3, true); shot(HV(0, 15, 10), HV(0, 1, -6), 0.5);
    await say('المحاربون', 'هووووووه! هووووه!', 4000);
    cheering = false;
    shot(HV(0.5, 3.45, -11.4), HV(0, 3.45, -14), 0.6);
    sub.hidden = true; await wait(3000);
    cmd.wave(); sfx.cheer(); shot(HV(1.6, 2.2, -9.4), HV(0, 3.7, -14), 1);
    await say('القائد', 'هيّااااااا!', 2400);
    heaven.openGate(); creak();
    shot(HV(11, 5, 6), HV(23, 4, 0), 0.7);
    await wait(3000);
    heaven.setFocus(null);
    storyState.speech = true; storyState.phase = 'march'; heaven.follow(true); heaven.setGuide(true);
    onStory?.('march');
    endCine();
    walker.teleport(P.x, P.z + 3.2, Math.PI / 2);
    say('', 'خذ المحاربين عالشط: من الباب الشرقي ⬅', 5000).then(() => { if (!cine.on) sub.hidden = true; });
  }

  // Walk the commander along shore-local waypoints (the stair is always walked in a scene).
  const walkPath = async (pts, speed = 4.2) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], d = Math.hypot(x1 - x0, z1 - z0), face = Math.atan2(x1 - x0, z1 - z0);
      cmdWalk = 1;
      await animate(d / speed, (k) => walker.teleport(x0 + (x1 - x0) * k, SZ + z0 + (z1 - z0) * k, face));
    }
    cmdWalk = null;
  };
  // Down from the sea gate to the beach.
  async function runDescend() {
    beginCine();
    const P = shore.pathDown, G = shore.gate;
    walker.teleport(P[0][0], SZ + P[0][1], Math.PI);
    if (shore.following) shore.placeBehind(new THREE.Vector3(P[0][0], 0, P[0][1] + 2), Math.PI);
    shore.openDoors(1); creak();
    shot(SV(G.x - 2.5, 31, 31), G.clone().add(new THREE.Vector3(0, -1, 0)), 1, true);      // above the ravine, on the great gate
    await walkPath(P.slice(0, 2), 3.2);
    chase(cmd.root, new THREE.Vector3(-3.2, 1.6, -8.5), new THREE.Vector3(0, 1.6, 0), 2.5);   // ahead of them, looking up the stair
    await walkPath(P.slice(1, 3), 4.6);
    shot(SV(P[3][0], 2.8, -7), SV(P[3][0], 2.4, 8), 1.2);                                   // the stone arch and the rock passage, head on
    track(cmd.root, new THREE.Vector3(0, 1.8, 0));
    await walkPath(P.slice(2), 3.6);
    shore.openDoors(0);
    endCine();
    if (storyState.phase === 'march') say('', 'امشِ مع المحاربين لعند البحر 🌊', 3500).then(() => { if (!cine.on) sub.hidden = true; });
  }
  // Up from the beach, through the sea gate, back into the castle.
  async function runAscend() {
    if (cine.on) return;
    beginCine();
    const P = shore.pathDown.slice().reverse(), G = shore.gate;
    const here = [cmd.root.position.x, cmd.root.position.z - SZ];
    shore.openDoors(1); creak();
    shot(SV(P[2][0], 3, -9), SV(P[2][0], 2.4, 6), 1.2); track(cmd.root, new THREE.Vector3(0, 1.8, 0));   // from the beach, towards the arch
    await walkPath([here, P[2], P[3]], 4.2);
    chase(cmd.root, new THREE.Vector3(0, 5, -9), new THREE.Vector3(0, 2, 4), 2.4);          // behind and above them, up the stair
    await walkPath(P.slice(3, 5), 4.6);
    shot(SV(G.x - 2.5, 31, 31), G.clone().add(new THREE.Vector3(0, -1, 0)), 1.2);         // into the great gate
    await walkPath(P.slice(4), 3);
    endCine();
    going = true; go('heaven');
  }

  // 2. On the shore: the spyglass, the map, the island.
  async function runSpyglass() {
    if (cine.on || storyState.phase !== 'march') return;
    beginCine();
    shore.following = true;
    const V = shore.view, I = shore.isle;
    const face = Math.atan2(I.x - V.x, I.z - V.z);
    const FW = new THREE.Vector3(Math.sin(face), 0, Math.cos(face)), LT = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
    const p0 = cmd.root.position, wp = p0.x >= 0 ? new THREE.Vector3(13.5, 0, SZ - 13) : new THREE.Vector3(-13.5, 0, SZ - 3);
    shot(SV(2, 15, 8), SV(0, 1, -12), 1, true); track(cmd.root, new THREE.Vector3(0, 1.5, 0));
    await walkCmd(wp, 2.4);
    await walkCmd(V, 3.2);
    walker.teleport(V.x, V.z, face);
    const ws = shore.workers, A = ws[1], B = ws[6];
    A.scripted = B.scripted = true;
    const side = (k) => V.clone().addScaledVector(LT, k);
    const loc = (v) => new THREE.Vector3(v.x, 0, v.z - SZ);   // shore workers live in the shore's own coordinates
    const wpos = (h) => new THREE.Vector3(h.root.position.x, 0, h.root.position.z + SZ);
    // A warrior brings the spyglass in his hand.
    spyState = 'A'; shore.spyglass.visible = true;
    const aTo = side(1.3).addScaledVector(FW, 0.6), aFrom = wpos(A.h); A.walk = 1;
    shot(V.clone().addScaledVector(FW, 7).addScaledVector(LT, 4).setY(2.6), V.clone().setY(1.8), 1.2); track(A.h.root, new THREE.Vector3(0, 1.8, 0));
    await animate(2.4, (k) => { A.h.root.position.copy(loc(aFrom.clone().lerp(aTo, ease(k)))); A.h.root.rotation.y = Math.atan2(aTo.x - aFrom.x, aTo.z - aFrom.z); });
    A.walk = 0;
    // They face each other; he holds it out, the commander takes it.
    A.h.root.rotation.y = Math.atan2(V.x - aTo.x, V.z - aTo.z);
    walker.teleport(V.x, V.z, Math.atan2(aTo.x - V.x, aTo.z - V.z));
    const mid = V.clone().lerp(aTo, 0.5);
    shot(mid.clone().addScaledVector(FW, 2.6).setY(2.7), mid.clone().setY(2.3), 1.6);
    offerArm = A; await wait(1100);
    cmdReach = 1; await wait(700);
    spyState = 'pass'; await animate(0.7, () => {});
    spyState = 'cmd'; offerArm = null; cmdReach = 0;
    await wait(700);
    // Another brings the map and shows it to him.
    mapState = 'carry'; shore.mapProp.visible = true;
    const bTo = side(-1.3).addScaledVector(FW, 0.6), bFrom = wpos(B.h); B.walk = 1;
    shot(V.clone().addScaledVector(FW, 6).addScaledVector(LT, -4).setY(2.6), V.clone().setY(1.8), 1.2); track(B.h.root, new THREE.Vector3(0, 1.6, 0));
    await animate(2.4, (k) => { B.h.root.position.copy(loc(bFrom.clone().lerp(bTo, ease(k)))); B.h.root.rotation.y = Math.atan2(bTo.x - bFrom.x, bTo.z - bFrom.z); });
    B.walk = 0; B.h.root.rotation.y = Math.atan2(V.x - bTo.x, V.z - bTo.z);
    walker.teleport(V.x, V.z, Math.atan2(bTo.x - V.x, bTo.z - V.z));
    mapState = 'show';
    // over the commander's shoulder, onto the map
    shot(V.clone().addScaledVector(LT, 2.4).addScaledVector(FW, 0.9).setY(3.6), bTo.clone().lerp(V, 0.3).setY(2.4), 1.4);
    await wait(3400);
    mapState = 'point'; await wait(1600);
    mapState = 'carry';
    // He turns to the sea and puts the glass to his eye.
    walker.teleport(V.x, V.z, face); spyState = 'eye';
    shot(V.clone().addScaledVector(LT, -2.4).addScaledVector(FW, 1.2).setY(3.4), V.clone().addScaledVector(FW, 0.5).setY(3.2), 1.4);   // his profile
    await wait(2400);
    spyEl.hidden = false; const fov0 = camera.fov; camera.fov = 42; camera.updateProjectionMatrix();
    const fog0 = scene.fog.density; scene.fog.density = 0.0009;
    const eye = V.clone().addScaledVector(FW, 1.5).setY(3.4);
    shot(eye, I.clone().add(new THREE.Vector3(-70, -14, 0)), 4, true); shot(eye, I.clone().add(new THREE.Vector3(0, -6, 0)), 0.45);   // pans onto the island and its whole tower
    await wait(4600);
    spyEl.hidden = true; camera.fov = fov0; camera.updateProjectionMatrix(); scene.fog.density = fog0;
    spyState = 'cmd'; shore.mapProp.visible = false; mapState = null;
    shot(V.clone().addScaledVector(FW, 2.8).addScaledVector(LT, 0.6).setY(3.1), V.clone().setY(3.2), 2, true);   // his face, eyes on the island
    await say('القائد', 'قريبًا… رح يكون إلي مكان بهاي الجزيرة.', 3600);
    sub.hidden = true;
    // Excitement: hands up, and the camera rises above them.
    cheering = true; sfx.cheer(); cmd.salute?.(); ws.forEach((x, i) => setTimeout(() => x.h.salute(), i * 80));
    shot(V.clone().addScaledVector(FW, 3).setY(2.4), V.clone().setY(2.5), 3, true);
    shot(V.clone().addScaledVector(FW, 6).setY(17), V.clone().setY(1), 0.45);
    await wait(2600);
    await say('القائد', 'كمّلوا مهامكم… عشان نخلّص السفينة!', 4200);
    cheering = false; shore.spyglass.visible = false; spyState = null; A.scripted = B.scripted = false;
    // He sets off for the castle and waves them after him.
    const toward = SV(13, 0, -5);
    shot(SV(0, 15, -27), SV(6, 1, -10), 0.8); track(cmd.root, new THREE.Vector3(0, 2, 0));
    await walkCmd(SV(13.5, 0, -13), 3);
    await walkCmd(toward, 1.6);
    walker.teleport(toward.x, toward.z, Math.atan2(V.x - toward.x, V.z - toward.z)); cmd.wave();
    shot(toward.clone().add(new THREE.Vector3(3, 3.2, -4)), toward.clone().setY(2.8), 1.4);
    await say('القائد', 'يلّا… وَرايْ!', 2400);
    storyState.phase = 'back'; onStory?.('back'); heaven.setGuide(false);
    sub.hidden = true; cine.on = false;   // straight into the climb
    await runAscend();
  }

  // 3. Back in the hall: the cage is locked… and empty.
  async function runCage() {
    if (cine.on || storyState.phase !== 'back') return;
    beginCine();
    const C = heaven.cage, w = heaven.warriors[0];
    if (caged) { heaven.group.remove(caged.root); caged = null; }
    // They come in through the sea gate and cross the hall to the cage, the warriors behind him.
    heaven.follow(true);
    shot(HV(8, 6, 15), HV(16, 2, 0), 1, true); track(cmd.root, new THREE.Vector3(0, 1.8, 0));
    await walkCmd(HV(9, 0, 0.8), 3.2);
    shot(HV(-2, 7, 13), HV(-4, 2, 3), 0.8); track(cmd.root, new THREE.Vector3(0, 1.8, 0));
    await walkCmd(HV(-6.5, 0, 4.2), 4.2);
    await wait(900);
    heaven.follow(false); heaven.script(w, true);
    walker.teleport(HX - 6.5, 4.2, 0);
    const wt = new THREE.Vector3(-6.6, 0, 6.2);
    w.hero.root.position.copy(wt); w.hero.root.rotation.y = Math.PI;
    heaven.arrange((i) => new THREE.Vector3(-4.6 - (i % 3) * 1.7, 0, 8.6 + Math.floor(i / 3) * 1.6), w);
    heaven.setFocus(new THREE.Vector3(HX - 6.5, 0, 5));
    shot(HV(1, 6, 9), HV(-7, 2, 4), 1, true); shot(HV(-1.5, 4.5, 8.5), HV(-6.6, 2.4, 4.8), 0.5);
    await wait(2600);
    shot(HV(-2.4, 3.1, 5.6), HV(-6.6, 2.9, 5.2), 1.4);
    await say('القائد', 'هل حبستَ لوسيفير؟', 3000);
    shot(HV(-2.9, 3.0, 4.4), HV(-6.6, 3.0, 5.8), 0.6);
    await say('المحارب الروحي', 'نعم يا قائدي… بيديّ هاتين.', 3200);
    sub.hidden = true;
    walker.teleport(HX - 6.5, 4.2, Math.atan2(C.x - (HX - 6.5), C.z - 4.2)); w.hero.root.rotation.y = Math.atan2(heaven.cageLocal.x - wt.x, heaven.cageLocal.z - wt.z);
    heaven.setFocus(C);
    shot(HV(-3.6, 3.6, 6.4), HV(-10, 1.8, 3.2), 0.9);
    await wait(2000);
    shot(HV(-8.4, 2.4, -0.6), HV(-11.5, 1.6, 2.5), 0.5);   // the empty, locked cage
    await wait(3400);
    sfx.luciLaugh(); await wait(2600);
    shot(HV(-4.2, 3.3, 2.2), HV(-6.5, 3.2, 4.2), 1);
    await say('القائد', 'هرب…', 2600);
    shot(HV(-2, 5, 8), HV(-6.5, 2.6, 5), 0.8);
    await say('القائد', 'ارجعوا على أماكنكم.', 2600);
    heaven.script(w, false); heaven.setFocus(null); heaven.walkHome();
    shot(HV(0, 12, 16), HV(0, 1, -2), 0.6);
    await wait(3400);
    storyState.phase = 'done'; storyState.jailed = false;
    hallLuci = createLucifer(scene, { camera, container, hero: cmd.root, who: 'commander', groundAt: () => 0, first: 20 });
    onStory?.('done');
    walker.teleport(HX, 6, Math.PI);   // in the aisle, free to walk
    endCine();
  }
  if (window.__nmnDebug) { window.__hqSpeech = runSpeech; window.__hqSpy = runSpyglass; window.__hqCage = runCage; window.__hqDown = runDescend; window.__hqUp = runAscend; window.__hqStory = storyState; }


  // Door prompt: near the great doors (hall) or the iron door (dungeon).
  const prompt = document.createElement('button'); prompt.className = 'door-btn'; prompt.hidden = true; container.appendChild(prompt);
  const fade = document.createElement('div'); fade.className = 'room-fade'; container.appendChild(fade);
  const caption = document.createElement('div'); caption.className = 'cell-caption'; caption.hidden = true; container.appendChild(caption);
  // Playing the marionette: four moves (buttons, or keys 1–4).
  const bar = document.createElement('div'); bar.className = 'puppet-bar'; bar.hidden = true; container.appendChild(bar);
  const MOVES = [['dance', '💃', 'رقّصهم'], ['spin', '🔄', 'لفّهم'], ['lift', '⬆️', 'ارفعهم'], ['bow', '🙇', 'ينحنوا لك']];
  MOVES.forEach(([k, ic, txt], i) => { const b = document.createElement('button'); b.innerHTML = `<kbd>${i + 1}</kbd>${ic} ${txt}`; b.onclick = (e) => { e.stopPropagation(); playMove(k); }; bar.appendChild(b); });
  const playMove = (k) => { if (room === 'dungeon' && mario.holding && !mario.busy) { mario.play(k); sfx.pluck(); if (k === 'spin') sfx.whoosh(); } };
  const setRoomLights = (r) => { heaven.lights.visible = r === 'heaven'; gallery.lights.visible = r === 'gallery'; shore.lights.visible = r === 'shore'; hallHemi.visible = sun.visible = fill.visible = r === 'hall' || r === 'dungeon'; };
  let weatherKind = weather;
  const heavenSky = () => { const e = heaven.setWeather(weatherKind, skyInfo()); const f = heaven.fogFor(); scene.fog.color.set(f.color); scene.fog.density = f.density; renderer.toneMappingExposure = e; };
  const go = (to, { white = false } = {}) => {
    fade.classList.toggle('white', white); fade.classList.add('on');
    if (white) sfx.prayer(); else creak();
    setTimeout(() => {
      const from = room;
      if (from === 'dungeon') { mario.reset(); bar.hidden = true; }
      room = to;
      setRoomLights(to);
      if (to === 'dungeon') { walker.setGround(null); walker.teleport(DX, D.hl - 4, Math.PI, 0); walker.setBlocked(inDungeon); walker.setCameraClamp(clampDungeon); scene.fog.color.set(0x0a0806); scene.fog.density = 0.03; chains(); }
      else if (to === 'gallery') { walker.setGround(null); if (from === 'heaven') walker.teleport(gallery.fromLight.x, gallery.fromLight.z, 0, 0); else walker.teleport(gallery.entrance.x, gallery.entrance.z, Math.PI, 0); walker.setBlocked(gallery.blocked); walker.setCameraClamp(gallery.clamp); scene.fog.color.set(0xb8a888); scene.fog.density = 0.016; renderer.toneMappingExposure = 0.66; }
      else if (to === 'heaven') { walker.setGround(heaven.groundAt); if (from === 'shore') walker.teleport(heaven.gateOut.x - 3, 0, -Math.PI / 2); else walker.teleport(heaven.entrance.x, heaven.entrance.z, Math.PI, 0); walker.setBlocked(heaven.blocked); walker.setCameraClamp(heaven.clamp); heavenSky(); }
      else if (to === 'shore') { walker.setGround(shore.groundAt); const P0 = shore.pathDown[0]; walker.teleport(P0[0], SZ + P0[1], Math.PI); shore.following = following(); if (!shore.following) shore.sendToWork(); setTimeout(runDescend, 0); walker.setBlocked(shore.blocked); walker.setCameraClamp(shore.clamp); scene.fog.color.set(shore.fog); scene.fog.density = 0.004; renderer.toneMappingExposure = 0.9; }
      else {
        walker.setGround(hallGround); walker.setBlocked(inHall); walker.setCameraClamp(clampHall); scene.fog.color.set(0x1a120c); scene.fog.density = 0.012; setCry(0); applySky();
        if (from === 'dungeon') {
          const a = WELL.doorA - 0.55, x = WELL.cx + Math.cos(a) * 2.1, z = WELL.cz + Math.sin(a) * 2.1;
          spiral.on = true; spiral.acc = WELL.total + 0.15; spiral.last = Math.atan2(z - WELL.cz, x - WELL.cx); stairBlend = 1; stairDir = -1; stairCam.set(0, 0, 0);
          walker.teleport(x, z, Math.PI - a);   // facing back up the stairs
        } else walker.teleport(7, SIDE.z, -Math.PI / 2);   // inside the hall, so the camera is behind him
      }
      onRoom?.(to);
      if (to === 'heaven' && storyState.phase === 'back' && caged) { heaven.group.remove(caged.root); caged = null; }
      if (to === 'heaven') { heaven.follow(following()); if (following() && from === 'shore') { const c0 = cmd.root.position; heaven.warriors.forEach((w, i) => w.hero.root.position.set(c0.x - HX + 1.8 * (Math.floor(i / 2) + 1), 0, c0.z + (i % 2 ? -1.3 : 1.3))); } if (storyState.phase === 'back' && from === 'shore') setTimeout(runCage, 900); }
      setTimeout(() => { fade.classList.remove('on'); going = false; }, white ? 500 : 150);
    }, white ? 1400 : 700);
  };  if (window.__nmnDebug) window.__hqGo = (to) => go(to);

  // One interaction prompt: press E (or tap it on touch screens).
  let action = null;
  prompt.onclick = () => action?.();
  const onDigit = (e) => { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0 && document.getElementById('modal')?.hidden !== false) playMove(MOVES[i][0]); };
  window.addEventListener('keydown', onDigit);
  const onE = (e) => { if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') { if (action && !prompt.hidden && document.getElementById('modal')?.hidden === true) { e.preventDefault(); action(); } } };
  window.addEventListener('keydown', onE);
  const showPrompt = (text, fn) => { action = fn; prompt.hidden = false; prompt.innerHTML = `<kbd>E</kbd> ${text}`; };
  let childLevel = child, futureLevel = future, going = false;
  const updatePrompts = () => {
    const p = cmd.root.position; if (window.__nmnDebug) window.__hqPos = [p.x, p.z, room, camera.position.x, camera.position.z, cmd.root.rotation.y];
    if (room === 'hall') {
      const atVault = spiral.on && spiral.acc > WELL.total - 0.2 && Math.hypot(p.x - (WELL.cx + Math.cos(WELL.doorA) * 2.4), p.z - (WELL.cz + Math.sin(WELL.doorA) * 2.4)) < 1.8;
      const nearMap = Math.abs(p.x) < 7.5 && p.z > -10 && p.z < 2.2;
      if (p.x > HW - 1.4 && inSide(p.x, p.z) && !going) { going = true; go('gallery'); }
      if (atVault) showPrompt('🚪 ادخل القبو', () => go('dungeon'));
      else if (nearMap) showPrompt('🗺 افتح الخريطة', () => onTable?.());
      else { prompt.hidden = true; action = null; }
      caption.hidden = true;
    } else if (room === 'gallery') {
      prompt.hidden = true; action = null;
      if (gallery.atDoor(p) && !going) { going = true; go('hall'); }
      if (gallery.reachedLight(p) && !going) { going = true; go('heaven', { white: true }); }
      caption.hidden = true;
    } else if (room === 'heaven') {
      const nearDoor = p.distanceTo(heaven.door) < 2.6;
      const onSeal = Math.hypot(p.x - heaven.seal.x, p.z - heaven.seal.z) < 2.8;
      prompt.hidden = true; action = null;
      if (nearDoor && !going) { going = true; go('gallery', { white: true }); }   // back the way he came, through the light
      if (heaven.atGate(p) && !going) { going = true; go('shore'); }
      if (cine.on) { caption.hidden = true; return; }
      if (Math.hypot(p.x - heaven.platform.x, p.z - heaven.platform.z) < 4.2) {
        caption.hidden = false;
        const k = `<i style="--v:${Math.round((heaven.stage / heaven.total) * 100)}%"></i>`;
        if (!heaven.complete) caption.innerHTML = `<b>🏛 منبر القائد</b><span>بيتبنى شوي شوي مع كل محارب بينضم لجيشك: ${heaven.stage} من ${heaven.total}.</span>${k}`;
        else if (!storyState.speech) { caption.innerHTML = '<b>🏛 منبر القائد</b><span>اكتمل المنبر… والمحاربون بانتظار كلمتك.</span>'; showPrompt('🎙 اخطب في المحاربين', runSpeech); }
        else caption.innerHTML = `<b>🏛 منبر القائد</b><span>${storyState.phase === 'done' ? 'لوسيفير هرب من القفص… والسفينة لسا بتتبنى عالشط.' : 'الباب الشرقي بيوديك عالشط، لعند السفينة.'}</span>`;
      } else if (Math.hypot(p.x - heaven.cage.x, p.z - heaven.cage.z) < 4.5) { caption.hidden = false; caption.innerHTML = caged ? '<b>⛓ لوسيفير</b><span>«اضحك هلأ… القفص ما رح يحبسني للأبد.»</span>' : '<b>⛓ القفص الذهبي</b><span>مقفول… وفاضي. لوسيفير هرب.</span>'; }
      else caption.hidden = true;
    } else if (room === 'shore') {
      prompt.hidden = true; action = null;
      if (cine.on) { caption.hidden = true; return; }
      if (shore.stairFoot(p) && !going && storyState.phase !== 'march') { runAscend(); return; }
      if (storyState.phase === 'march' && p.z - SZ < -11) { runSpyglass(); return; }
      if (shore.nearShip(p)) { caption.hidden = false; caption.innerHTML = `<b>🚢 السفينة: ${shore.stage} من 12</b><span>${shore.stage >= 12 ? 'السفينة جاهزة… وجزيرة القادة فتحت.' : 'بتتبنى لحالها مع كل عادة بتبنيها. الأبعاد الـ8 × 8 عادات = السفينة جاهزة.'}</span><i style="--v:${Math.round((shore.stage / 12) * 100)}%"></i>`; }
      else caption.hidden = true;
    } else {
      const near = p.z > D.hl - 6 && Math.abs(p.x - DX) < 4;
      if (near) showPrompt('🚪 ارجع إلى القاعة', () => go('hall'));
      else if (mario.holding) showPrompt('✋ رجّع الدمى', () => { mario.drop(); sfx.wood(); });
      else if (mario.near(p)) showPrompt('🎎 أمسك الدمى', () => { mario.grab(); heldAt = performance.now() / 1000; sfx.wood(); sfx.pluck(); });
      else { prompt.hidden = true; action = null; }
      bar.hidden = !mario.holding;
      const t0 = performance.now() / 1000;
      const dF = p.distanceTo(dungeon.futureAt), dC = p.distanceTo(dungeon.childAt);
      // Crying grows louder as you approach the child (only while it is sad).
      setCry(childLevel < 0.4 ? Math.max(0, 1 - dC / 22) * (1 - childLevel * 2) : 0);
      if ((mario.holding && t0 - heldAt < 6) || (!mario.holding && mario.near(p))) { caption.hidden = false; caption.innerHTML = mario.holding ? '<b>🎎 القادة الثمانية بين إيديك</b><span>هم صراعاتك الداخلية… وإنت اللي ماسك الخيوط. حرّكهم زي ما بدك.</span>' : '<b>🎎 خيوط القائد</b>'; }
      else if (dF < 8 && dF <= dC) { caption.hidden = false; caption.innerHTML = futureText(futureLevel); }
      else if (dC < 8) { caption.hidden = false; caption.innerHTML = childText(childLevel); }
      else caption.hidden = true;
    }
  };
  const futureText = (v) => `<b>🔮 أنت في المستقبل</b><span>${v < 0.15 ? 'مكبّل ومنهك في الظلام… ما تفعله اليوم هو ما سيعيشه.' : v < 0.4 ? 'بدأ يرفع رأسه. القيود ما زالت ثقيلة.' : v < 0.7 ? 'تحرّر من السلاسل ويقف من جديد.' : v < 0.95 ? 'قوي ومضيء. نتائج أيامك تظهر عليه.' : 'حرّ تمامًا — هذا أنت الذي بنيته.'}</span><i style="--v:${Math.round(v * 100)}%"></i>`;
  const childText = (v) => `<b>🧒 ${v < 0.4 ? 'طفلك الداخلي يبكي' : 'طفلك الداخلي'}</b><span>${v < 0.15 ? '' : v < 0.4 ? '' : v < 0.7 ? 'هدأ. بدأ يشعر بالأمان.' : 'سعيد ويلعب — لأنك صرت الرجل الذي يحميه.'}</span><i style="--v:${Math.round(v * 100)}%"></i>`;

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(cmd.root, true).length) { if (!cmd.busy()) cmd.wave(); onCommander?.(); return; }
    if (ray.intersectObject(table, true).length) onTable?.();
  });

  // Window light follows the real time of day.
  const applySky = () => {
    const { elev } = skyInfo();
    const night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    sun.intensity = THREE.MathUtils.lerp(2.2, 0.15, night);
    sun.color.set(night > 0.5 ? 0x8fa4d8 : 0xffe6c0);
    for (const g of windowGlass) if (g.material.color) g.material.color.setScalar(THREE.MathUtils.lerp(1, 0.35, night));
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 1.25, night);
  };
  applySky();

  // Bloom for the Hall of Warriors.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.95);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  if (camera.aspect < 0.8) { camera.fov = 58; camera.updateProjectionMatrix(); }

  const tmpV = new THREE.Vector3();
  // Reach: bend an arm (shoulder pitch/roll, elbow) so the hand lands on a world point.
  const ikTmp = new THREE.Vector3();
  const reach = (hero, i, target, st) => {
    const a = hero.arms[i];
    const err = () => { a.sh.rotation.x = st.x; a.sh.rotation.z = st.z; a.el.rotation.x = st.e; a.sh.updateMatrixWorld(true); return a.el.localToWorld(ikTmp.set(0, -0.32, 0)).distanceTo(target); };
    let best = err(), step = 0.25;
    for (let it = 0; it < 24; it++) { for (const k of ['x', 'z', 'e']) for (const d of [step, -step]) { st[k] += d; const e = err(); if (e < best) best = e; else st[k] -= d; } step *= 0.82; }
    err();
  };
  const ikR = { x: -1.6, z: -0.3, e: -1.2 }, ikL = { x: -1.6, z: 0.3, e: -1.2 }, ikB0 = { x: -1.3, z: 0.2, e: -0.5 }, ikB1 = { x: -1.3, z: -0.2, e: -0.5 };
  const clock = new THREE.Clock(); let raf, lastSky = 0;
  const tick = () => {
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05), rdt = Math.min(raw, 0.3), t = clock.elapsedTime;   // rdt: real time, for cinematics
    if (t - lastSky > 30) { if (room === 'heaven') heavenSky(); else if (room !== 'gallery') applySky(); lastSky = t; }
    const mv = walker.update(dt);
    cmd.update(t, dt, cmdWalk ?? mv.walk, mv.air);
    if (pointing) { const ar = cmd.arms[1]; ar.sh.rotation.x = -1.55; ar.sh.rotation.z = 0; ar.el.rotation.x = 0; }
    for (let i = anims.length - 1; i >= 0; i--) { const an = anims[i]; an.t += rdt; const k = Math.min(1, an.t / an.dur); an.fn(k, t, rdt); if (k >= 1) { anims.splice(i, 1); an.res(); } }
    if (cine.on && cine.chase) { cine.chase.getWorldPosition(cine.pos); cine.pos.add(cine.chaseOff); }
    if (cine.on && cine.follow) { cine.follow.getWorldPosition(cine.look); cine.look.add(cine.off); }
    if (cine.on) { const k = 1 - Math.exp(-rdt * cine.speed); cine.cur.lerp(cine.pos, k); cine.curLook.lerp(cine.look, k); camera.position.copy(cine.cur); camera.lookAt(cine.curLook); }
    if (hallLuci) { hallLuci.setEnabled(room === 'hall' && !cine.on); if (room === 'hall') hallLuci.tick(t, dt); }
    if (room === 'dungeon') {
      mario.tick(t, dt, cmd.root);
      // His arms reach forward to hold the controller (higher when he lifts them).
      holdK += ((mario.holding ? 1 : 0) - holdK) * Math.min(1, dt * 8);
      if (holdK > 0.01) cmd.arms.forEach((a) => {
        a.sh.rotation.x = THREE.MathUtils.lerp(a.sh.rotation.x, -1.45 + Math.sin(t * 2) * 0.03, holdK);
        a.sh.rotation.z = THREE.MathUtils.lerp(a.sh.rotation.z, 0, holdK);
        a.el.rotation.x = THREE.MathUtils.lerp(a.el.rotation.x, -0.25, holdK);
      });
    }
    dungeon.tick(t, dt);
    summonArrows.tick(t);
    for (const w of wellFlames) { const k = 0.85 + Math.sin(t * 11 + w.l.position.y) * 0.12; w.fl.scale.y = k; w.l.intensity = 14 * k; }
    if (room === 'heaven') { heaven.tick(t, rdt, cmd.root.position, cmd.root.rotation.y); heaven.weatherTick(t, dt); }
    if (cheering) heaven.warriors.forEach((w, i) => { w.hero.root.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.5; });
    if (room === 'shore') {
      shore.tick(t, dt, 0);
      if (shore.following) shore.followTick(t, rdt, new THREE.Vector3(cmd.root.position.x, 0, cmd.root.position.z - SZ), cmd.root.rotation.y);
      if (cheering) shore.workers.forEach((w, i) => { w.h.root.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.4; });
      // The spyglass: in a warrior's hand, passing over, in the commander's hand, at his eye.
      const hand = (h, i) => h.arms[i].el.localToWorld(tmpV.set(0, -0.32, 0));
      const sp = shore.spyglass;
      if (offerArm) { const a2 = offerArm.h.arms[1]; a2.sh.rotation.x = -1.35; a2.sh.rotation.z = 0.15; a2.el.rotation.x = -0.15; }
      if (cmdReach) { const a2 = cmd.arms[1]; a2.sh.rotation.x = -1.25; a2.sh.rotation.z = -0.1; a2.el.rotation.x = -0.2; }
      if (spyState === 'A' || spyState === 'pass' || spyState === 'cmd') {
        const from = hand(shore.workers[1].h, 1).clone(), to2 = hand(cmd, 1).clone();
        const k = spyState === 'A' ? 0 : spyState === 'cmd' ? 1 : Math.min(1, (anims[anims.length - 1]?.t || 0) / 0.7);
        const at = from.lerp(to2, k);
        sp.position.set(at.x, at.y - 0.02, at.z - SZ); sp.rotation.set(Math.PI / 2 - 0.3, cmd.root.rotation.y, 0, 'YXZ');
        if (spyState === 'cmd' && !cmdReach) { const a2 = cmd.arms[1]; a2.sh.rotation.x = -0.5; a2.el.rotation.x = -1.1; }
      } else if (spyState === 'eye') {
        const f = cmd.root.rotation.y, fw = new THREE.Vector3(Math.sin(f), 0, Math.cos(f)), lt = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
        cmd.head.getWorldPosition(tmpV);
        // on the right eye, pointing out to sea, held in both hands
        sp.position.set(tmpV.x + fw.x * 0.27 - lt.x * 0.09, tmpV.y + 0.05, tmpV.z + fw.z * 0.27 - lt.z * 0.09 - SZ);
        sp.rotation.set(-0.06, f, 0, 'YXZ');
        sp.updateMatrixWorld(true); cmd.root.updateMatrixWorld(true);
        reach(cmd, 1, sp.localToWorld(new THREE.Vector3(0, -0.03, 0.16)), ikR);
        reach(cmd, 0, sp.localToWorld(new THREE.Vector3(0, -0.04, 0.52)), ikL);
        cmd.head.parent.rotation.x = 0;
      }
      // The map: held up by its lower corners, in front of the hands; then a finger on the island.
      const B = shore.workers[6], mp = shore.mapProp;
      if (mapState) {
        const f = B.h.root.rotation.y, fw = new THREE.Vector3(Math.sin(f), 0, Math.cos(f)), lt = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f)), bp = B.h.root.position;
        const show = mapState !== 'carry';
        const W2 = 0.62, H2 = 0.44;   // half size of the map
        const centre = new THREE.Vector3(bp.x + fw.x * (show ? 0.62 : 0.45), show ? 2.72 : 2.2, bp.z + fw.z * (show ? 0.62 : 0.45));
        mp.position.copy(centre); mp.rotation.set(show ? -0.25 : -1.15, f + Math.PI, 0, 'YXZ'); mp.updateMatrixWorld(true);
        B.h.root.updateMatrixWorld(true);
        // hands just behind the map's bottom corners (the map faces away from him, towards the commander)
        const cornerL = mp.localToWorld(new THREE.Vector3(-W2 * 0.85, -H2 * 0.9, -0.05));   // his left hand
        const cornerR = mp.localToWorld(new THREE.Vector3(W2 * 0.85, -H2 * 0.9, -0.05));    // his right hand
        reach(B.h, 0, cornerL, ikB0);
        if (mapState === 'point') reach(B.h, 1, mp.localToWorld(new THREE.Vector3(-0.22, 0.1, 0.05)), ikB1);
        else reach(B.h, 1, cornerR, ikB1);
        if (show) cmd.head.parent.rotation.x = 0.3;   // he looks down at it
      } else if (spyState !== 'eye') cmd.head.parent.rotation.x = 0;
    }
    if (room === 'gallery') { const k = gallery.tick(t, dt, cmd.root.position); bloom.strength = 0.25 + k * 0.35; scene.fog.density = 0.012 + k * 0.012; renderer.toneMappingExposure = 0.66 - k * 0.12; }
    else bloom.strength = 0.3;
    updatePrompts();
    for (const f of flames) {
      const k = 0.82 + Math.sin(t * 11 + f.ph) * 0.1 + Math.sin(t * 27 + f.ph) * 0.08;
      if (f.light) f.light.intensity = f.base * k; else f.m.scale.set(1, k * (f.big ? 1.3 : 1.1), 1);
    }
    for (let i = 0; i < EMB; i++) { ep[i * 3 + 1] += dt * (0.2 + es[i] * 0.4); ep[i * 3] += Math.sin(t + i) * dt * 0.1; if (ep[i * 3 + 1] > WALL_H) ep[i * 3 + 1] = 0; }
    dust.geometry.attributes.position.needsUpdate = true;
    holo.material.opacity = 0.025 + Math.sin(t * 2) * 0.015;
    cf.scale.y = 0.85 + Math.sin(t * 13) * 0.15;
    markers.forEach((m, i) => { if (m.owned) m.flag.rotation.y = Math.sin(t * 3 + i) * 0.3; });
    if (room === 'heaven' || room === 'gallery') composer.render(); else renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    setShip(n) { shore.setStage(n); },
    update({ rankIndex: ri, future: f, child: c }) { setRank(ri); if (f != null) { futureLevel = f; dungeon.setFuture(f); } if (c != null) { childLevel = c; dungeon.setChild(c); } },
    salute() { cmd.wave(); },
    setWeather(k) { weatherKind = k; if (room === 'heaven') heavenSky(); },
    refreshSky() { if (room === 'heaven') heavenSky(); else if (room !== 'gallery') applySky(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); walker.dispose(); setCry(0); hallLuci?.dispose(); document.body.classList.remove('cine'); window.removeEventListener('keydown', onE); window.removeEventListener('keydown', onDigit);
      scene.traverse((o) => { o.geometry?.dispose(); });
      composer.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
