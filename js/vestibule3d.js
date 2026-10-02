// The long gallery inside the castle that leads to the warriors. Dark stone and
// torches near the entrance; at the far end a great arch pours out blinding light
// and mist, and through the haze eight dark figures stand waiting. Walking into
// the light carries the commander through.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { arm } from './heaven3d.js';

export const VZ = 400;                         // the gallery sits far from the other rooms in the same scene
const LEN = 30, W = 4.9, H = 12;               // half length, half width, wall height

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const puffTex = () => canvasTex(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
});

export function buildVestibule(scene) {
  const g = new THREE.Group(); g.position.z = VZ; scene.add(g);
  const stone = canvasTex(512, 512, (c) => {
    c.fillStyle = '#2e2924'; c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < 512; x += 128) {
      const v = 60 + Math.random() * 22; c.fillStyle = `rgb(${v + 10},${v + 4},${v - 4})`; c.fillRect(x + 3, y + 3, 122, 58);
    }
  }, [3, 8]);
  const wallM = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.9 });
  const floorM = new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (c) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#1d1a1c' : '#3b3530'; c.fillRect(i * 128, j * 128, 128, 128); }
    c.strokeStyle = '#8a6a2c'; c.lineWidth = 4; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, 512); c.moveTo(0, i * 128); c.lineTo(512, i * 128); c.stroke(); }
  }, [2.5, 16]), roughness: 0.25, metalness: 0.2 });
  const gold = std(0xc9962c, { metalness: 0.9, roughness: 0.3 });
  const dark = std(0x231d18, { roughness: 0.9 });

  // Floor, walls, ribbed vault, carpet.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, LEN * 2 + 4), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, H, LEN * 2 + 4), wallM); w.position.set(sx * (W + 0.4), H / 2, 0); w.receiveShadow = true; g.add(w); }
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(W, W, LEN * 2 + 4, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: stone, side: THREE.BackSide, roughness: 0.95, color: 0x8a7a6a }));
  vault.rotation.x = -Math.PI / 2; vault.position.y = H; g.add(vault);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, LEN * 2 - 2), std(0x5e1016, { roughness: 1 })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, 1); carpet.receiveShadow = true; g.add(carpet);
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.14, LEN * 2 - 2), gold); b.rotation.x = -Math.PI / 2; b.position.set(sx * 1.15, 0.025, 1); g.add(b); }
  // Pilasters and arches every 8 units, torches on them.
  const flames = [];
  for (let z = LEN - 4; z > -LEN + 2; z -= 8) {
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, H, 1.3), dark); p.position.set(sx * (W - 0.2), H / 2, z); p.castShadow = true; g.add(p);
      const hold = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.9, 8), gold); hold.position.set(sx * (W - 0.75), 4.2, z); hold.rotation.z = sx * 0.4; g.add(hold);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2e, toneMapped: false })); fl.position.set(sx * (W - 0.95), 4.85, z); g.add(fl);
      flames.push({ fl, ph: Math.random() * 6 });
    }
    const rib = new THREE.Mesh(new THREE.TorusGeometry(W - 0.2, 0.35, 8, 32, Math.PI), dark); rib.position.set(0, H, z); g.add(rib);
  }

  // The great arch of light at the far end.
  const arch = new THREE.Group(); arch.position.z = -LEN; g.add(arch);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.5, 1.6), gold); p.position.set(sx * 3.6, 4.25, 0); arch.add(p); }
  const top = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.75, 12, 48, Math.PI), gold); top.position.y = 8.5; arch.add(top);
  // (a wall with the arch opening: two side pieces and a lintel)
  for (const sx of [-1, 1]) { const piece = new THREE.Mesh(new THREE.BoxGeometry(W - 2.8, H, 0.8), wallM); piece.position.set(sx * (W - (W - 2.8) / 2), H / 2, 0); arch.add(piece); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(W * 2, H - 9.2, 0.8), wallM); lintel.position.set(0, 9.2 + (H - 9.2) / 2, 0); arch.add(lintel);
  // Beyond: blinding light (colour above 1 so the bloom flares it).
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.4), toneMapped: false, fog: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), glowM); back.position.set(0, 10, -18); arch.add(back);
  const beyondFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.7), toneMapped: false, fog: false })); beyondFloor.rotation.x = -Math.PI / 2; beyondFloor.position.set(0, 0.01, -9); arch.add(beyondFloor);
  // Eight dark figures standing in the light.
  const PALS = Array.from({ length: 8 }, () => ({ robe: '#000', accent: '#000', skin: '#000', glow: '#000' }));
  const black = new THREE.MeshBasicMaterial({ color: 0x050403, fog: false });
  const figures = PALS.map((pal, i) => {
    const h = buildWorshipper(pal); arm(h, pal, false);
    h.root.traverse((m) => { if (m.isMesh) { m.material = black; m.castShadow = false; } });
    const k = i - 3.5;
    h.root.position.set(k * 1.55, 0.02, -6 - Math.abs(k) * 0.55); h.root.rotation.y = -k * 0.08; h.root.scale.multiplyScalar(1.08);
    arch.add(h.root);
    return h;
  });
  // Shafts of light falling into the gallery.
  const puff = puffTex();
  const shaftM = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const shafts = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1.2 + i * 0.4, 3.4 + i * 0.5, 26, 24, 1, true), shaftM.clone());
    s.rotation.x = Math.PI / 2 + 0.06 * (i - 2); s.position.set((i - 2) * 0.9, 4 + (i % 2), -LEN + 13); g.add(s); shafts.push(s);
  }
  // Mist rolling out of the arch.
  const mist = new THREE.Group(); g.add(mist);
  for (let i = 0; i < 70; i++) {
    const near = i < 24;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xfff4e4, transparent: true, depthWrite: false, opacity: near ? 0.1 : 0.2 }));
    const z = -LEN + 1 + Math.random() * (near ? 18 : 8), k = (near ? 3 : 4) + Math.random() * 4;
    sp.position.set((Math.random() - 0.5) * (W * 1.8), Math.random() * (near ? 2.5 : 8), z); sp.scale.set(k * 1.6, k, 1);
    sp.userData = { z0: z, v: 0.3 + Math.random() * 0.6, ph: Math.random() * 6 };
    mist.add(sp);
  }
  // Dust glittering in the light.
  const N = 500, dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) dp.set([(Math.random() - 0.5) * W * 1.8, Math.random() * 9, -LEN + Math.random() * 30], i * 3);
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dp, 3)), new THREE.PointsMaterial({ map: puff, color: 0xfff0c8, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(dust);
  // Door back to the great hall at the near end.
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.4, 0.3), std(0x3b2414, { roughness: 0.7 })); door.position.set(0, 2.7, LEN + 1.2); g.add(door);
  for (let y = 0.7; y < 5; y += 1.2) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.06), std(0x2b2b30, { metalness: 0.8 })); b.position.set(0, y, LEN + 1.02); g.add(b); }
  const nearWall = new THREE.Mesh(new THREE.BoxGeometry(W * 2, H, 0.8), wallM); nearWall.position.set(0, H / 2, LEN + 1.8); g.add(nearWall);

  // Lights: torches near the entrance, a strong light from the arch casting long shadows.
  const lights = new THREE.Group(); g.add(lights);
  lights.add(new THREE.HemisphereLight(0x6a6080, 0x1a120c, 0.25));
  const torchLights = [LEN - 4, LEN - 12].flatMap((z) => [-1, 1].map((sx) => { const l = new THREE.PointLight(0xff8a3c, 14, 14, 1.6); l.position.set(sx * (W - 1.3), 5, z); lights.add(l); return l; }));
  const beam = new THREE.SpotLight(0xfff0d8, 160, 70, 0.32, 0.8, 1.4); beam.position.set(0, 4.5, -LEN - 4); beam.target.position.set(0, 0, LEN); beam.castShadow = true; beam.shadow.mapSize.set(1024, 1024); beam.shadow.bias = -0.0005;
  lights.add(beam, beam.target);
  lights.visible = false;

  const blocked = (x, z) => { z -= VZ; return Math.abs(x) > W - 1.3 || z > LEN - 0.5 || z < -LEN - 0.5; };
  const clamp = (p) => { p.x = Math.max(-W + 0.6, Math.min(W - 0.6, p.x)); const z = p.z - VZ; p.z = VZ + Math.max(-LEN - 2, Math.min(LEN + 0.8, z)); p.y = Math.max(0.6, Math.min(H - 0.5, p.y)); };

  // Returns how far along the gallery the commander is (0 at the door … 1 at the arch).
  function tick(t, dt, pos) {
    const z = pos.z - VZ, k = THREE.MathUtils.clamp((LEN - z) / (LEN * 2), 0, 1);
    for (const f of flames) f.fl.scale.y = 0.85 + Math.sin(t * 12 + f.ph) * 0.15;
    for (const l of torchLights) l.intensity = 14 * (0.85 + Math.sin(t * 11 + l.position.z) * 0.12);
    shafts.forEach((s, i) => { s.material.opacity = (0.02 + k * 0.03) + Math.sin(t * 0.7 + i) * 0.008; });
    for (const m of mist.children) {
      const u = m.userData; m.position.z = u.z0 + Math.sin(t * 0.25 * u.v + u.ph) * 2; m.position.x += Math.sin(t * 0.3 + u.ph) * dt * 0.2;
      m.material.rotation = t * 0.05 * u.v;
    }
    for (let i = 0; i < N; i++) { dp[i * 3 + 1] += dt * 0.12; dp[i * 3] += Math.sin(t + i) * dt * 0.05; if (dp[i * 3 + 1] > 9) dp[i * 3 + 1] = 0; }
    dust.geometry.attributes.position.needsUpdate = true;
    figures.forEach((h, i) => { h.update(t, dt, 0, false); h.root.position.y = 0.02 + Math.sin(t * 0.6 + i) * 0.02; });
    beam.intensity = 140 + k * 160;
    return k;
  }

  return {
    group: g, lights, tick, blocked, clamp,
    entrance: new THREE.Vector3(0, 0, VZ + LEN - 3),
    reachedLight: (pos) => pos.z - VZ < -LEN + 2.2,
    atDoor: (pos) => pos.z - VZ > LEN - 3.6,
  };
}
