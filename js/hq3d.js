// 3D headquarters: a vast, fully enclosed throne hall. Ribbed vaults, giant columns,
// stained-glass windows with light shafts, chandeliers, braziers, guardian statues,
// a throne on a stepped dais, great doors, and the strategy table with the commander.
// The camera orbits freely (360°) inside the hall.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildWorshipper } from './oasis3d.js';
import { warMapCanvas } from './warmap.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const box3 = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); g.add(o); return o; };
const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

// Hall size
const HW = 20;          // half width  (x)
const HL = 34;          // half length (z)
const WALL_H = 18;      // wall height before the vault

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function mountHQ(container, { places, hq, rankIndex, sky: skyInfo, onCommander, onTable }) {
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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HL * 2), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
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
  // Great doors
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 12.5, 0.4), woodM); leaf.position.set(sx * 2.25, 6.25, HL + 0.4); scene.add(leaf);
    for (let y = 1.5; y < 12; y += 2.2) { const band = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.1), goldM); band.position.set(sx * 2.25, y, HL + 0.15); scene.add(band); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 24), brightGold); ring.position.set(sx * 0.7, 5.5, HL + 0.1); scene.add(ring);
  }
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
    if (z < 28) {
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
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x20140c, 0.5));
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

  // ---------- camera: free 360° orbit, kept inside the hall ----------
  camera.position.set(9, 7, 22);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4.5, -2);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 0.8;
  controls.minDistance = 4; controls.maxDistance = 28;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.2;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });
  const keepInside = () => {
    const lim = (v, a) => Math.max(-a, Math.min(a, v));
    controls.target.x = lim(controls.target.x, 8); controls.target.z = lim(controls.target.z, HL - 3); controls.target.y = lim(controls.target.y, 20) || 1;
    camera.position.x = lim(camera.position.x, HW - 1); camera.position.z = lim(camera.position.z, HL - 1);
    camera.position.y = Math.max(0.8, Math.min(WALL_H + HW * 0.6, camera.position.y));
    // Never stand inside the colonnade (columns and hanging banners at x = ±13).
    camera.position.x = lim(camera.position.x, 10.5);
  };

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

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  if (camera.aspect < 0.8) { camera.position.set(6, 6, 26); camera.fov = 62; camera.updateProjectionMatrix(); }

  const clock = new THREE.Clock(); let raf, lastSky = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    controls.update(); keepInside();
    cmd.update(t, dt);
    for (const f of flames) {
      const k = 0.82 + Math.sin(t * 11 + f.ph) * 0.1 + Math.sin(t * 27 + f.ph) * 0.08;
      if (f.light) f.light.intensity = f.base * k; else f.m.scale.set(1, k * (f.big ? 1.3 : 1.1), 1);
    }
    for (let i = 0; i < EMB; i++) { ep[i * 3 + 1] += dt * (0.2 + es[i] * 0.4); ep[i * 3] += Math.sin(t + i) * dt * 0.1; if (ep[i * 3 + 1] > WALL_H) ep[i * 3 + 1] = 0; }
    dust.geometry.attributes.position.needsUpdate = true;
    holo.material.opacity = 0.025 + Math.sin(t * 2) * 0.015;
    cf.scale.y = 0.85 + Math.sin(t * 13) * 0.15;
    markers.forEach((m, i) => { if (m.owned) m.flag.rotation.y = Math.sin(t * 3 + i) * 0.3; });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    update({ rankIndex: ri }) { setRank(ri); },
    salute() { cmd.wave(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
