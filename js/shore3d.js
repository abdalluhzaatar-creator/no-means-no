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

export function buildShore(scene, { parts = 12 } = {}) {
  const g = new THREE.Group(); g.position.z = SZ; scene.add(g);
  const add = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o; };
  // Sky dome: warm evening over the sea.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { night: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform float night; void main(){ float h = max(vP.y, 0.0); vec3 day = mix(vec3(1.0,0.78,0.55), vec3(0.35,0.55,0.85), pow(h, 0.6)); vec3 nt = mix(vec3(0.12,0.12,0.22), vec3(0.02,0.03,0.08), pow(h,0.5)); gl_FragColor = vec4(mix(day, nt, night), 1.0); }' }));
  g.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false })); sunDisc.position.set(-60, 30, -280); g.add(sunDisc);
  // Sand, sea, cliff.
  const sandTex = canvasTex(512, 512, (c, w) => { c.fillStyle = '#e2cc9a'; c.fillRect(0, 0, w, w); for (let i = 0; i < 2600; i++) { c.fillStyle = ['#d4bc88', '#ecd8aa', '#c8ae7a'][i % 3]; c.globalAlpha = 0.4; c.fillRect(Math.random() * w, Math.random() * w, 3, 3); } }, 12);
  const sand = add(g, new THREE.PlaneGeometry(160, 70), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), 0, 0, -6); sand.rotation.x = -Math.PI / 2;
  const seaGeo = new THREE.PlaneGeometry(700, 400, 70, 40); seaGeo.rotateX(-Math.PI / 2);
  const seaM = new THREE.MeshPhysicalMaterial({ color: 0x2a7a9a, roughness: 0.1, clearcoat: 1 });
  const sea = add(g, seaGeo, seaM, 0, -0.35, -230); sea.castShadow = false; const seaBase = seaGeo.attributes.position.array.slice();
  const rockM = std(0x8a7a6a, { flatShading: true, roughness: 1 });
  for (let i = 0; i < 26; i++) { const r = add(g, new THREE.DodecahedronGeometry(7 + Math.random() * 6, 0), rockM, -70 + i * 5.6 + (Math.random() - 0.5) * 3, 6 + Math.random() * 10, 26 + Math.random() * 8); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); }
  add(g, new THREE.BoxGeometry(160, 26, 14), rockM, 0, 11, 33);
  // The stair down the cliff, with a landing at the top under an arch.
  const stoneM = std(0xd8cfbe, { roughness: 0.7 });
  const N = 30;
  for (let i = 0; i < N; i++) { const u = i / (N - 1), z = STAIR.z0 + u * (STAIR.z1 - STAIR.z0), y = u * STAIR.top; add(g, new THREE.BoxGeometry(STAIR.w * 2, 0.4 + y, (STAIR.z1 - STAIR.z0) / N + 0.05), stoneM, STAIR.x, (y - 0.4) / 2, z); }
  add(g, new THREE.BoxGeometry(STAIR.w * 2 + 2, STAIR.top, 6), stoneM, STAIR.x, STAIR.top / 2 - 0.2, STAIR.z1 + 3);
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.8, 7, 0.8), stoneM, STAIR.x + sx * (STAIR.w + 0.5), STAIR.top + 3.5, STAIR.z1 + 3);
  { const a = add(g, new THREE.TorusGeometry(STAIR.w + 0.5, 0.4, 10, 32, Math.PI), stoneM, STAIR.x, STAIR.top + 7, STAIR.z1 + 3); }
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
    const h = buildWorshipper(c.palette); arm(h, c.palette, false);
    const side = i % 2 ? -1 : 1, x = -7.5 + Math.floor(i / 2) * 5;
    h.root.position.set(x, 0, -6 + side * 4.6); h.root.rotation.y = side > 0 ? Math.PI : 0; g.add(h.root);
    return { h, next: 1 + Math.random() * 3 };
  });
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
    if (Math.abs(x - STAIR.x) < STAIR.w && z > STAIR.z0 - 0.5) return THREE.MathUtils.clamp((z - STAIR.z0) / (STAIR.z1 - STAIR.z0), 0, 1) * STAIR.top;
    return 0;
  };
  const blocked = (x, z) => {
    z -= SZ;
    const onStair = Math.abs(x - STAIR.x) < STAIR.w - 0.3;
    if (z > STAIR.z1 + 5) return true;
    if (z > 11 && !onStair) return true;               // the cliff
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
    beach: new THREE.Vector3(0, 0, SZ + 4),
    atTop: (p) => p.z - SZ > STAIR.z1 + 2.6,
    nearShip: (p) => Math.hypot(p.x, p.z - SZ + 6) < 13,
    fog: 0xe8c8a0,
    tick(t, dt, night = 0) {
      sky.material.uniforms.night.value = night;
      const a = seaGeo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = Math.sin(seaBase[i] * 0.06 + t * 0.8) * 0.3 + Math.cos(seaBase[i + 2] * 0.09 + t * 0.6) * 0.22;
      seaGeo.attributes.position.needsUpdate = true;
      fires.forEach((f, i) => (f.scale.y = 0.85 + Math.sin(t * 11 + i) * 0.15));
      torchL.intensity = 8 + night * 30;
      sails.forEach((s) => { const p = s.sail.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) p[i + 2] = Math.sin(s.base[i] * 0.8 + t * 2) * 0.25 * (0.5 - s.base[i + 1] / 10); s.sail.geometry.attributes.position.needsUpdate = true; });
      workers.forEach((w) => { w.next -= dt; w.h.update(t, dt, 0, false); if (w.next < 0 && stage < parts) { w.h.salute(); w.next = 1.4 + Math.random() * 2; } });
    },
    workers,
  };
}
