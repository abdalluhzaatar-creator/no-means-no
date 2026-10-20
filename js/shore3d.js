// The shore below the Hall of Warriors: a long stair cut into the cliff leads down
// to a beach where the warriors build the ship to the Island of Leaders. The ship
// grows one part for every few tasks done (engine.SHIP).
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { arm } from './heaven3d.js';
import { CHARACTERS, REGIONS } from './content.js';

export const SZ = -400;                         // the shore sits far from the other rooms in the same scene
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const STAIR = { x: 16, w: 2.4, z0: 12, z1: 36, top: 22 };

function canvasTex(w, h, draw, rep) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; }

export function buildShore(scene, { parts = 12, tiers = {} } = {}) {
  const g = new THREE.Group(); g.position.z = SZ; scene.add(g);
  const add = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  // Sky dome: warm evening over the sea.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { night: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform float night; void main(){ float h = max(vP.y, 0.0); vec3 day = mix(vec3(1.0,0.78,0.55), vec3(0.35,0.55,0.85), pow(h, 0.6)); vec3 nt = mix(vec3(0.12,0.12,0.22), vec3(0.02,0.03,0.08), pow(h,0.5)); gl_FragColor = vec4(mix(day, nt, night), 1.0); }' }));
  sky.renderOrder = -1; g.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false })); sunDisc.position.set(-60, 30, -280); g.add(sunDisc);
  // Sand, sea, cliff.
  const sandTex = canvasTex(512, 512, (c, w) => { c.fillStyle = '#e2cc9a'; c.fillRect(0, 0, w, w); for (let i = 0; i < 2600; i++) { c.fillStyle = ['#d4bc88', '#ecd8aa', '#c8ae7a'][i % 3]; c.globalAlpha = 0.4; c.fillRect(Math.random() * w, Math.random() * w, 3, 3); } }, 12);
  const sand = add(g, new THREE.PlaneGeometry(160, 70), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), 0, 0, -6); sand.rotation.x = -Math.PI / 2;
  const seaGeo = new THREE.PlaneGeometry(700, 400, 70, 40); seaGeo.rotateX(-Math.PI / 2);
  const seaM = new THREE.MeshPhysicalMaterial({ color: 0x2a7a9a, roughness: 0.1, clearcoat: 1 });
  const sea = add(g, seaGeo, seaM, 0, -0.35, -230); sea.castShadow = false; const seaBase = seaGeo.attributes.position.array.slice();
  const rockM = std(0x8a7a6a, { flatShading: true, roughness: 1 });
  const stoneM = std(0xd8cfbe, { roughness: 0.7 });
  // The cliff, split by a ravine where the stair climbs (so nothing ever passes through rock).
  const CL = { z0: 24, z1: 48, top: STAIR.top + 2, gap: STAIR.w + 2.2 };
  const leftW = (STAIR.x - CL.gap) + 90, rightW = 90 - (STAIR.x + CL.gap);
  add(g, new THREE.BoxGeometry(leftW, CL.top + 2, CL.z1 - CL.z0), rockM, -90 + leftW / 2, CL.top / 2 - 1, (CL.z0 + CL.z1) / 2);
  add(g, new THREE.BoxGeometry(rightW, CL.top + 2, CL.z1 - CL.z0), rockM, STAIR.x + CL.gap + rightW / 2, CL.top / 2 - 1, (CL.z0 + CL.z1) / 2);
  for (let i = 0; i < 30; i++) { const x = -86 + i * 6 + (Math.random() - 0.5) * 3; if (Math.abs(x - STAIR.x) < CL.gap + 3) continue; const r = add(g, new THREE.DodecahedronGeometry(5 + Math.random() * 5, 0), rockM, x, 3 + Math.random() * 14, CL.z0 + 1 + Math.random() * 2); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { const r = add(g, new THREE.DodecahedronGeometry(2.2 + Math.random() * 1.2, 0), rockM, STAIR.x + sx * (CL.gap + 2.2), 4 + k * 3.4, CL.z0 + 1.5 + Math.random() * 3); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  // The stair down the ravine.
  const N = 30;
  for (let i = 0; i < N; i++) { const u = i / (N - 1), z = STAIR.z0 + u * (STAIR.z1 - STAIR.z0), y = u * STAIR.top; add(g, new THREE.BoxGeometry(STAIR.w * 2, 0.4 + y, (STAIR.z1 - STAIR.z0) / N + 0.05), stoneM, STAIR.x, (y - 0.4) / 2, z); }
  for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector3(STAIR.x + sx * (STAIR.w - 0.1), u * STAIR.top + 1, STAIR.z0 + u * (STAIR.z1 - STAIR.z0))); } add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.08, 6), std(0x5a4a3a)); for (let i = 0; i <= 12; i += 2) { const u = i / 12; add(g, new THREE.CylinderGeometry(0.07, 0.07, 1, 6), std(0x5a4a3a), STAIR.x + sx * (STAIR.w - 0.1), u * STAIR.top + 0.5, STAIR.z0 + u * (STAIR.z1 - STAIR.z0)); } }
  // The top landing and the castle's sea gate: a great gate between two towers.
  add(g, new THREE.BoxGeometry(CL.gap * 2, STAIR.top, 12), stoneM, STAIR.x, STAIR.top / 2 - 0.2, STAIR.z1 + 6);
  const wallM = std(0xcfc4b0, { roughness: 0.85 }), roofM = std(0x8a2a22, { roughness: 0.6 });
  const GZ = STAIR.z1 + 8, GW = 3.4, GH = 10;
  const T = STAIR.top;
  add(g, new THREE.BoxGeometry(40, 16, 3), wallM, STAIR.x - 20 - GW, T + 8, GZ + 1.5).scale.x = 1;
  add(g, new THREE.BoxGeometry(40, 16, 3), wallM, STAIR.x + 20 + GW, T + 8, GZ + 1.5);
  add(g, new THREE.BoxGeometry(GW * 2, 16 - GH, 3), wallM, STAIR.x, T + GH + (16 - GH) / 2, GZ + 1.5);
  for (let k = -22; k <= 22; k++) if (k % 2 === 0) add(g, new THREE.BoxGeometry(1.2, 1.4, 3.2), wallM, STAIR.x + k * 1.2, T + 16.7, GZ + 1.5);
  { const archT = add(g, new THREE.TorusGeometry(GW, 0.55, 10, 32, Math.PI), stoneM, STAIR.x, T + GH - GW * 0.15, GZ - 0.1); archT.scale.y = 0.6; }
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, GH), new THREE.MeshBasicMaterial({ color: 0x120c08 })); dark.position.set(STAIR.x, T + GH / 2, GZ + 2.6); dark.rotation.y = Math.PI; g.add(dark);
  for (const sx of [-1, 1]) {
    const tx = STAIR.x + sx * (GW + 2.6);
    add(g, new THREE.CylinderGeometry(2.6, 2.9, 20, 20), wallM, tx, T + 10, GZ);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; add(g, new THREE.BoxGeometry(0.9, 1.3, 0.9), wallM, tx + Math.cos(a) * 2.6, T + 20.6, GZ + Math.sin(a) * 2.6); }
    add(g, new THREE.ConeGeometry(3.2, 5, 20), roofM, tx, T + 23.6, GZ);
    const ban = add(g, new THREE.PlaneGeometry(1.6, 6), std(0x8e1b24, { side: THREE.DoubleSide, emissive: 0x2a0606, emissiveIntensity: 0.3 }), tx, T + 12, GZ - 2.95); ban.castShadow = false;
    const tf = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); tf.position.set(STAIR.x + sx * (GW + 0.6), T + 6.2, GZ - 0.9); g.add(tf);
  }
  // Great timber doors that swing open outwards.
  const doorM = std(0x5a3a1a, { roughness: 0.6 }), ironM = std(0x2a2a2e, { metalness: 0.7, roughness: 0.4 });
  const doors = [-1, 1].map((sx) => { const h = new THREE.Group(); h.position.set(STAIR.x + sx * GW, T, GZ - 0.2); g.add(h); add(h, new THREE.BoxGeometry(GW, GH - 0.4, 0.4), doorM, -sx * GW / 2, (GH - 0.4) / 2, 0); for (let y = 1.2; y < GH - 0.6; y += 2) add(h, new THREE.BoxGeometry(GW, 0.22, 0.46), ironM, -sx * GW / 2, y, 0); add(h, new THREE.TorusGeometry(0.3, 0.06, 6, 16), ironM, -sx * (GW - 0.6), GH * 0.45, -0.3); return { h, sx }; });
  let doorOpen = 0, doorWant = 0;
  // Two guards at the sea gate too.
  const GUARD_PAL = { robe: '#7a1a1e', accent: '#d4a53a', skin: '#e9c29e', glow: '#ffc84a' };
  const gateGuards = [-1, 1].map((sx) => { const h = buildWorshipper(GUARD_PAL); arm(h, GUARD_PAL, false, 7); h.root.position.set(STAIR.x + sx * (GW - 0.6), T, GZ - 2.2); h.root.rotation.y = Math.PI; g.add(h.root); return h; });

  // At the bottom: a stone arch (مقوّس), then a passage through the rocks onto the beach.
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(1, 6.2, 1.2), stoneM, STAIR.x + sx * (STAIR.w + 0.3), 3.1, 10.6);
  add(g, new THREE.TorusGeometry(STAIR.w + 0.3, 0.5, 10, 32, Math.PI), stoneM, STAIR.x, 6.2, 10.6);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const r = add(g, new THREE.DodecahedronGeometry(2.2 + Math.random() * 0.6, 0), rockM, STAIR.x + sx * (STAIR.w + 3.4), 1.6 + Math.random(), 3 + k * 1.9); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  { const rockArch = add(g, new THREE.TorusGeometry(STAIR.w + 2, 1.2, 7, 14, Math.PI), rockM, STAIR.x, 4.4, 5); rockArch.scale.set(1, 1.15, 1.4); }
  // Slipway and the ship (built part by part).
  const woodM = std(0x7a5232, { roughness: 0.75 }), darkW = std(0x4a3020, { roughness: 0.7 }), sailM = std(0xf4ead2, { side: THREE.DoubleSide, roughness: 0.9 }), goldM = std(0xe1b44c, { metalness: 1, roughness: 0.25 });
  const SHIP = new THREE.Group(); SHIP.position.set(0, 1.2, -6); g.add(SHIP);
  for (let i = -3; i <= 3; i++) add(g, new THREE.BoxGeometry(1, 1.2, 3), darkW, i * 2.6, 0.6, -6);
  const L = 18, Wd = 5, H = 3.2;
  const stagesG = Array.from({ length: parts }, () => { const s = new THREE.Group(); SHIP.add(s); return s; });
  const hullCurve = (u) => Math.sin(Math.PI * u) ** 0.6;   // width along the length
  // 1 keel
  add(stagesG[0], new THREE.BoxGeometry(L, 0.4, 0.5), darkW, 0, 0, 0);
  // 2 stem and stern posts
  { const st = add(stagesG[1], new THREE.BoxGeometry(0.4, H + 1.6, 0.4), darkW, L / 2 + 0.6, (H + 1.6) / 2, 0); st.rotation.z = -0.35; const sp = add(stagesG[1], new THREE.BoxGeometry(0.4, H + 1.2, 0.4), darkW, -L / 2 - 0.3, (H + 1.2) / 2, 0); sp.rotation.z = 0.15; }
  // 3 ribs
  for (let i = 1; i < 12; i++) { const u = i / 12, x = -L / 2 + u * L, w = (Wd / 2) * hullCurve(u); const rib = add(stagesG[2], new THREE.TorusGeometry(w, 0.12, 6, 16, Math.PI), woodM, x, H * 0.9, 0); rib.rotation.set(Math.PI, Math.PI / 2, 0); rib.scale.y = (H * 0.9) / Math.max(w, 0.3); }
  // 4 / 5 hull planks: lower and upper strakes
  const strake = (grp, y0, y1) => { for (const sz of [-1, 1]) { const pts = [], pos = [], idx = []; const n = 24; for (let i = 0; i <= n; i++) { const u = i / n, x = -L / 2 + u * L, k0 = hullCurve(u) * (Wd / 2) * Math.sin(Math.acos(1 - y0 / (H * 0.9))) , k1 = hullCurve(u) * (Wd / 2) * Math.sin(Math.acos(Math.max(-1, 1 - y1 / (H * 0.9)))); pos.push(x, y0 + 0.3, sz * k0, x, y1 + 0.3, sz * k1); if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.75, side: THREE.DoubleSide })); m.castShadow = true; grp.add(m); } };
  strake(stagesG[3], 0, H * 0.5); strake(stagesG[4], H * 0.5, H * 0.95);
  // 6 deck
  add(stagesG[5], new THREE.BoxGeometry(L * 0.92, 0.15, Wd * 0.9), woodM, 0, H + 0.2, 0);
  // 7 stern castle
  add(stagesG[6], new THREE.BoxGeometry(4, 2, Wd * 0.8), darkW, -L / 2 + 2.4, H + 1.2, 0); add(stagesG[6], new THREE.BoxGeometry(4.4, 0.2, Wd * 0.9), woodM, -L / 2 + 2.4, H + 2.3, 0);
  // 8 main mast, 9 fore mast + bowsprit
  add(stagesG[7], new THREE.CylinderGeometry(0.2, 0.28, 14, 10), darkW, 0.5, H + 7, 0);
  add(stagesG[8], new THREE.CylinderGeometry(0.16, 0.22, 10, 10), darkW, 5.5, H + 5, 0); { const bs = add(stagesG[8], new THREE.CylinderGeometry(0.12, 0.16, 6, 8), darkW, L / 2 + 2.2, H + 1.6, 0); bs.rotation.z = Math.PI / 2 - 0.35; }
  // 10 rigging
  { const ropes = []; for (const [mx, top] of [[0.5, H + 14], [5.5, H + 10]]) for (const sz of [-1, 1]) for (const dx of [-3, 0, 3]) ropes.push(mx, top, 0, mx + dx, H + 0.4, sz * Wd * 0.45); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ropes, 3)); stagesG[9].add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x3a2a1a }))); }
  // 11 sails
  const sails = [];
  for (const [mx, w, h, y] of [[0.5, 7, 6, H + 6.5], [0.5, 5.5, 4, H + 11.5], [5.5, 5, 5, H + 5.5]]) { const geo = new THREE.PlaneGeometry(w, h, 8, 6); const sail = add(stagesG[10], geo, sailM, mx, y, 0.3); sail.rotation.y = Math.PI / 2; sails.push({ sail, base: geo.attributes.position.array.slice() }); }
  // 12 flags, lanterns and a gilded figurehead
  { const fl = add(stagesG[11], new THREE.PlaneGeometry(1.8, 1, 6, 3), std(0x8a1a1a, { side: THREE.DoubleSide }), 0.5 + 0.9, H + 14.6, 0); fl.rotation.y = Math.PI / 2; const head = add(stagesG[11], new THREE.SphereGeometry(0.5, 14, 10), goldM, L / 2 + 1.2, H + 1.6, 0); const lantM = std(0xffd890, { emissive: 0xffb84a, emissiveIntensity: 1.4 }); for (const lx of [-L / 2 + 0.6, L / 2 - 1]) add(stagesG[11], new THREE.SphereGeometry(0.25, 10, 8), lantM, lx, H + 2.8, 0); }
  // Scaffolding and lumber while it is being built.
  const scaffold = new THREE.Group(); g.add(scaffold);
  const pipeM = std(0x9a8a6a);
  for (let i = -4; i <= 4; i++) for (const sz of [-1, 1]) add(scaffold, new THREE.CylinderGeometry(0.07, 0.07, 6, 6), pipeM, i * 2.2, 3, -6 + sz * 3.6);
  for (const sz of [-1, 1]) for (const y of [2, 4.4]) add(scaffold, new THREE.BoxGeometry(18, 0.12, 0.8), woodM, 0, y, -6 + sz * 3.6);
  for (let k = 0; k < 8; k++) add(g, new THREE.BoxGeometry(6, 0.3, 0.4), woodM, 13, 0.15 + Math.floor(k / 2) * 0.32, -14 + (k % 2) * 0.5);
  // Torches.
  const fires = [];
  for (const [x, z] of [[-11, 0], [11, 0], [-11, -12], [11, -12], [STAIR.x - 3.4, STAIR.z0]]) {
    add(g, new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), darkW, x, 1.3, z);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); f.position.set(x, 2.95, z); g.add(f);
    fires.push(f);
  }
  // The warriors at work round the ship.
  const chars = CHARACTERS.filter((c) => REGIONS.some((r) => r.characterId === c.id));
  const workers = chars.map((c, i) => {
    const h = buildWorshipper(c.palette); arm(h, c.palette, false, tiers[c.id] || 0);
    const side = i % 2 ? -1 : 1, x = -7.5 + Math.floor(i / 2) * 5;
    h.root.position.set(x, 0, -6 + side * 4.6); h.root.rotation.y = side > 0 ? Math.PI : 0; g.add(h.root);
    return { h, next: 1 + Math.random() * 3, home: h.root.position.clone(), homeFace: h.root.rotation.y };
  });
  // The Island of Leaders on the horizon (seen through the spyglass).
  const ISLE = new THREE.Vector3(-60, 0, -270);
  const isle = new THREE.Group(); isle.position.copy(ISLE); g.add(isle);
  const isleRock = std(0x5a6a48, { flatShading: true, roughness: 1 });
  for (let k = 0; k < 9; k++) { const m = add(isle, new THREE.ConeGeometry(30 + Math.random() * 30, 30 + Math.random() * 50, 7), k % 3 ? isleRock : std(0x3a5a2a, { flatShading: true }), (k - 4) * 26 + (Math.random() - 0.5) * 10, 10, (Math.random() - 0.5) * 30); m.castShadow = false; }
  { const tower = add(isle, new THREE.CylinderGeometry(4, 5, 50, 12), std(0xe8e0d0), 0, 45, 10); tower.castShadow = false; const crown = add(isle, new THREE.CylinderGeometry(7, 5, 4, 12), goldM, 0, 72, 10); crown.castShadow = false; const shine = new THREE.PointLight(0xffd27a, 0, 300, 1.2); shine.position.set(0, 80, 20); isle.add(shine); }
  // The spyglass and the map handed to the commander.
  const spyglass = new THREE.Group(); g.add(spyglass); spyglass.visible = false;
  { // the eyepiece (narrow) at z = 0, widening out to the objective lens in front (+z)
    const brass = std(0xc8a050, { metalness: 0.9, roughness: 0.3 }), leather = std(0x4a2e18, { roughness: 0.8 });
    for (const [r0, r1, l, z, m] of [[0.022, 0.026, 0.08, 0.04, brass], [0.03, 0.03, 0.2, 0.18, brass], [0.038, 0.038, 0.22, 0.38, leather], [0.046, 0.046, 0.2, 0.58, brass], [0.054, 0.05, 0.06, 0.71, brass]]) { const c = add(spyglass, new THREE.CylinderGeometry(r1, r0, l, 14), m, 0, 0, z); c.rotation.x = Math.PI / 2; }
    const lens = add(spyglass, new THREE.CircleGeometry(0.047, 16), std(0x8ac8ff, { metalness: 0.6, roughness: 0.05, emissive: 0x2a4a6a, emissiveIntensity: 0.4 }), 0, 0, 0.745); lens.castShadow = false; }
  // The map: an old parchment chart on two wooden rollers, faces the one it is shown to.
  const mapTex = canvasTex(1024, 720, (c, w, h) => {
    c.fillStyle = '#e9d6a6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(120,80,30,${Math.random() * 0.07})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 2 + Math.random() * 10); }
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,50,10,.45)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#6a4a20'; c.lineWidth = 6; c.strokeRect(28, 28, w - 56, h - 56); c.lineWidth = 2; c.strokeRect(40, 40, w - 80, h - 80);
    // sea hatching
    c.strokeStyle = 'rgba(60,90,110,.28)'; c.lineWidth = 2; for (let y = 70; y < h - 60; y += 22) { c.beginPath(); for (let x = 60; x < w - 60; x += 8) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); c.stroke(); }
    const island = (cx, cy, r, seed) => { c.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, rr = r * (1 + Math.sin(a * 3 + seed) * 0.18 + Math.sin(a * 7 + seed * 2) * 0.08); c.lineTo(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#d8c08a'; c.fill(); c.strokeStyle = '#5a3a18'; c.lineWidth = 4; c.stroke(); };
    island(250, 470, 120, 1); island(760, 230, 150, 4);
    c.fillStyle = '#6a5a3a'; for (const [x, y] of [[700, 200], [760, 170], [820, 220], [740, 260]]) { c.beginPath(); c.moveTo(x, y - 26); c.lineTo(x + 20, y + 8); c.lineTo(x - 20, y + 8); c.fill(); }
    c.fillStyle = '#8a1a1a'; c.beginPath(); c.arc(250, 470, 10, 0, 7); c.fill();
    // the route and the X
    c.strokeStyle = '#8a1a1a'; c.setLineDash([16, 12]); c.lineWidth = 6; c.beginPath(); c.moveTo(300, 420); c.bezierCurveTo(420, 300, 560, 380, 690, 260); c.stroke(); c.setLineDash([]);
    c.lineWidth = 9; c.beginPath(); c.moveTo(740, 205); c.lineTo(790, 255); c.moveTo(790, 205); c.lineTo(740, 255); c.stroke();
    // a little ship on the route
    c.fillStyle = '#5a3a18'; c.beginPath(); c.moveTo(470, 350); c.lineTo(530, 350); c.lineTo(515, 368); c.lineTo(485, 368); c.fill(); c.fillRect(498, 310, 4, 40); c.fillStyle = '#f4ead2'; c.beginPath(); c.moveTo(502, 312); c.lineTo(526, 340); c.lineTo(502, 340); c.fill();
    // compass rose
    c.save(); c.translate(150, 150); c.fillStyle = '#6a4a20'; for (let k = 0; k < 8; k++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, k % 2 ? -40 : -70); c.lineTo(10, 0); c.lineTo(-10, 0); c.fill(); } c.fillStyle = '#8a1a1a'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText('N', 0, -78); c.restore();
    c.direction = 'rtl'; c.textAlign = 'center'; c.fillStyle = '#4a2a10'; c.font = 'bold 40px "Amiri", Tajawal, serif';
    c.fillText('جزيرة القادة', 770, 430); c.fillText('جزيرتنا', 250, 640);
  });
  const mapProp = new THREE.Group(); g.add(mapProp); mapProp.visible = false;
  { const sheet = new THREE.PlaneGeometry(1.24, 0.88, 12, 4); const sp2 = sheet.attributes.position; for (let i = 0; i < sp2.count; i++) sp2.setZ(i, Math.sin((sp2.getX(i) / 1.24 + 0.5) * Math.PI) * 0.03); sheet.computeVertexNormals();
    const m = new THREE.Mesh(sheet, new THREE.MeshStandardMaterial({ map: mapTex, side: THREE.DoubleSide, roughness: 0.9 })); mapProp.add(m);
    const wood = std(0x5a3a1a, { roughness: 0.6 });
    for (const y of [0.45, -0.45]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.36, 10), wood); r.rotation.z = Math.PI / 2; r.position.y = y; mapProp.add(r); for (const sx of [-0.7, 0.7]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(0xc8a050, { metalness: 0.8 })); k.position.set(sx, y, 0); mapProp.add(k); } } }

  // Lights for this room.
  const lights = new THREE.Group(); g.add(lights);
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x8a7050, 0.9); lights.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd8a8, 2.2); sun.position.set(-40, 50, -60); sun.target.position.set(0, 0, -6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); lights.add(sun, sun.target);
  const torchL = new THREE.PointLight(0xff9a4a, 0, 30, 1.5); torchL.position.set(0, 4, -6); lights.add(torchL);
  lights.visible = false;

  let stage = 0;
  const setStage = (n) => { stage = Math.max(0, Math.min(parts, n)); stagesG.forEach((s, i) => (s.visible = i < Math.max(1, stage))); scaffold.visible = stage < parts; };
  setStage(0);
  const groundAt = (x, z) => {
    z -= SZ;
    if (Math.abs(x - STAIR.x) < STAIR.w + 2 && z > STAIR.z0 - 0.5) return THREE.MathUtils.clamp((z - STAIR.z0) / (STAIR.z1 - STAIR.z0), 0, 1) * STAIR.top;
    return 0;
  };
  const blocked = (x, z) => {
    z -= SZ;
    // The stair itself is walked in a short scene (hq3d), never freely.
    if (z > 9.6) return true;
    if (z > 1.5 && z <= 11 && Math.abs(x - STAIR.x) > STAIR.w - 0.2 && Math.abs(x - STAIR.x) < STAIR.w + 4.5) return true;   // the rock passage
    if (z < -24 || Math.abs(x) > 40) return true;      // the water's edge
    if (Math.abs(x) < 10.5 && Math.abs(z + 6) < 3.4) return true;   // the ship
    for (const w of workers) if (Math.hypot(x - w.h.root.position.x, z - w.h.root.position.z) < 0.7) return true;
    return false;
  };
  const clamp = (p) => { p.y = Math.max(0.8, Math.min(60, p.y)); };
  return {
    group: g, lights, setStage, groundAt, blocked, clamp,
    get stage() { return stage; },
    top: new THREE.Vector3(STAIR.x, STAIR.top, SZ + STAIR.z1 + 1.5),
    // the walk between the sea gate and the beach (shore-local x, z)
    pathDown: [[STAIR.x, STAIR.z1 + 9.5], [STAIR.x, STAIR.z1 + 0.5], [STAIR.x, STAIR.z0 - 0.5], [STAIR.x, 6], [STAIR.x - 1, 1.5], [STAIR.x - 4, -1.5]],
    gate: new THREE.Vector3(STAIR.x, STAIR.top + 5, SZ + STAIR.z1 + 8),
    stairFoot: (p) => p.z - SZ > 8.6 && Math.abs(p.x - STAIR.x) < STAIR.w + 2,
    openDoors(v = 1) { doorWant = v; },
    beach: new THREE.Vector3(0, 0, SZ + 4),
    atTop: (p) => p.z - SZ > STAIR.z1 + 4.8,
    nearShip: (p) => Math.hypot(p.x, p.z - SZ + 6) < 13,
    fog: 0xe8c8a0,
    tick(t, dt, night = 0) {
      sky.material.uniforms.night.value = night;
      const a = seaGeo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = Math.sin(seaBase[i] * 0.06 + t * 0.8) * 0.3 + Math.cos(seaBase[i + 2] * 0.09 + t * 0.6) * 0.22;
      seaGeo.attributes.position.needsUpdate = true;
      fires.forEach((f, i) => (f.scale.y = 0.85 + Math.sin(t * 11 + i) * 0.15));
      gateGuards.forEach((h) => h.update(t, dt, 0, false));
      doorOpen += (doorWant - doorOpen) * Math.min(1, dt * 1.5); doors.forEach((d) => (d.h.rotation.y = d.sx * doorOpen * 1.7));
      torchL.intensity = 8 + night * 30;
      sails.forEach((s) => { const p = s.sail.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) p[i + 2] = Math.sin(s.base[i] * 0.8 + t * 2) * 0.25 * (0.5 - s.base[i + 1] / 10); s.sail.geometry.attributes.position.needsUpdate = true; });
      if (!this.following) workers.forEach((w) => { w.next -= dt; w.h.update(t, dt, 0, false); if (w.next < 0 && stage < parts) { w.h.salute(); w.next = 1.4 + Math.random() * 2; } });
    },
    workers, spyglass, mapProp,
    isle: ISLE.clone().add(new THREE.Vector3(0, 40, SZ)),
    view: new THREE.Vector3(-12, 0, SZ - 17),
    following: false,
    placeBehind(p, face) { workers.forEach((w, i) => { const row = Math.floor(i / 2) + 1, side = i % 2 ? -1 : 1; w.h.root.position.set(p.x - Math.sin(face) * 1.8 * row + Math.cos(face) * side * 1.3, 0, p.z - Math.cos(face) * 1.8 * row - Math.sin(face) * side * 1.3); w.h.root.rotation.y = face; }); },
    followTick(t, dt, p, face) {
      workers.forEach((w, i) => {
        if (w.scripted) { w.h.update(t, dt, w.walk || 0, false); return; }
        const row = Math.floor(i / 2) + 1, side = i % 2 ? -1 : 1;
        const tx = p.x - Math.sin(face) * 1.8 * row + Math.cos(face) * side * 1.3, tz = p.z - Math.cos(face) * 1.8 * row - Math.sin(face) * side * 1.3;
        const r = w.h.root, dx = tx - r.position.x, dz = tz - r.position.z, d = Math.hypot(dx, dz);
        const sp = Math.min(d, dt * Math.min(7, 1.5 + d * 1.5));
        if (d > 0.3) { r.position.x += (dx / d) * sp; r.position.z += (dz / d) * sp; r.rotation.y = Math.atan2(dx, dz); }
        r.position.y = groundAt(r.position.x, r.position.z + SZ);
        w.h.update(t, dt, d > 0.3 ? Math.min(1, d) : 0, false);
      });
    },
    sendToWork() { workers.forEach((w) => { w.h.root.position.copy(w.home); w.h.root.rotation.y = w.homeFace; }); },
  };
}
