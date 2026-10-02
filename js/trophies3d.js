// 3D trophy island: a floating island above a sea of clouds, with a pedestal for
// every challenge cup. Won cups shine on their pedestals, the active cup glows as
// a hologram with a progress ring, the rest wait as faint glass silhouettes.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';

const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

// Each cup is built to show its rank: humble stone and wood at the bottom,
// polished metals in the middle, crystal, crowns, orbiting rings and wings at the top.
function cupMaterial(cup, tier, look) {
  if (look !== 'won') {
    const col = new THREE.Color(cup.color);
    return new THREE.MeshStandardMaterial({ color: look === 'active' ? col : 0xcfe6ff, transparent: true, opacity: look === 'active' ? 0.55 : 0.16, emissive: look === 'active' ? col : 0x000000, emissiveIntensity: look === 'active' ? 0.8 : 0, depthWrite: false });
  }
  if (cup.id === 'stone') return new THREE.MeshStandardMaterial({ color: cup.color, roughness: 1, flatShading: true });
  if (cup.id === 'wood') {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 128; y += 6) { g.strokeStyle = `rgba(60,35,15,${0.25 + (y % 18) / 40})`; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + 3, 44, y - 3, 64, y + 1); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  }
  if (cup.id === 'diamond') return new THREE.MeshPhysicalMaterial({ color: cup.color, roughness: 0.02, metalness: 0, transmission: 0.9, thickness: 0.6, ior: 2.4, clearcoat: 1, emissive: new THREE.Color(cup.glow), emissiveIntensity: 0.25 });
  return new THREE.MeshStandardMaterial({
    color: cup.color, metalness: cup.metal, roughness: Math.max(0.08, 0.45 - tier * 0.03),
    emissive: cup.glow ? new THREE.Color(cup.glow) : new THREE.Color(cup.color), emissiveIntensity: cup.glow ? 0.35 : tier >= 6 ? 0.12 : 0,
  });
}

function trophy(cup, tier, look) {
  const g = new THREE.Group();
  const mat = cupMaterial(cup, tier, look);
  const won = look === 'won';
  const trim = won && tier >= 5 ? new THREE.MeshStandardMaterial({ color: tier >= 6 ? 0xffd66b : 0xf2f4f7, metalness: 1, roughness: 0.15 }) : mat;
  const plinthMat = won ? new THREE.MeshStandardMaterial({ color: tier >= 9 ? 0x1b1030 : 0x2b2522, roughness: 0.4, metalness: tier >= 6 ? 0.3 : 0 }) : mat;
  const simple = tier <= 1;                    // stone / wood: chunky, no handles
  // plinth: taller and stepped for higher ranks
  const steps = 1 + Math.floor(tier / 4);
  let y = 0;
  for (let i = 0; i < steps; i++) {
    const w = 1.2 - i * 0.18, h = 0.22;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), i === steps - 1 && tier >= 5 ? trim : plinthMat); b.position.y = y + h / 2; g.add(b); y += h;
  }
  const stemH = simple ? 0.35 : 0.5 + tier * 0.04;
  const stem = new THREE.Mesh(simple ? new THREE.CylinderGeometry(0.22, 0.3, stemH, 7) : new THREE.CylinderGeometry(0.09, 0.2, stemH, 16), mat); stem.position.y = y + stemH / 2; g.add(stem); y += stemH;
  if (!simple) { const knot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), trim); knot.position.y = y - stemH * 0.45; g.add(knot); }
  const flare = simple ? 0.55 : 0.68 + Math.min(tier, 8) * 0.02;
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(simple
    ? [new THREE.Vector2(0.1, 0), new THREE.Vector2(0.45, 0.05), new THREE.Vector2(0.55, 0.6), new THREE.Vector2(0.58, 0.75), new THREE.Vector2(0.5, 0.78)]
    : [new THREE.Vector2(0.05, 0), new THREE.Vector2(0.3, 0.05), new THREE.Vector2(0.55, 0.35), new THREE.Vector2(flare, 0.8), new THREE.Vector2(flare + 0.05, 1.05 + tier * 0.02), new THREE.Vector2(flare - 0.03, 1.08 + tier * 0.02)],
    simple ? 8 : 32), mat);
  bowl.position.y = y; g.add(bowl);
  const top = y + (simple ? 0.78 : 1.08 + tier * 0.02);
  if (!simple) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(flare + 0.03, 0.035, 8, 40), trim); rim.rotation.x = Math.PI / 2; rim.position.y = top - 0.02; g.add(rim);
    const hs = 0.22 + tier * 0.015;
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(hs, 0.055, 8, 20, Math.PI * 1.2), tier >= 5 ? trim : mat); h.position.set(sx * (flare + 0.02), y + 0.6, 0); h.rotation.z = sx > 0 ? -0.6 : Math.PI + 0.6; g.add(h); }
  }
  if (cup.id === 'wood') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); band.rotation.x = Math.PI / 2; band.position.y = y + 0.4; g.add(band); }
  if (tier === 4) { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), mat); r.position.set(Math.cos(a) * 0.62, y + 0.55, Math.sin(a) * 0.62); g.add(r); } } // iron rivets
  if (tier >= 6 && tier <= 7) { // gold/platinum: star or laurel on top
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), trim); star.scale.set(1, 1.5, 0.4); star.position.y = top + 0.3; g.add(star); g.userData.spin = star;
  }
  if (tier === 7) { const laurel = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 40, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: 0x8fd6a0, metalness: 0.8, roughness: 0.2 })); laurel.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); laurel.position.y = y + 0.5; g.add(laurel); }
  if (tier >= 8) { // diamond and above: a floating gem
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: cup.glow || cup.color, emissive: cup.glow || cup.color, emissiveIntensity: won ? 1.3 : 0.3, transparent: !won, opacity: won ? 1 : 0.4, roughness: 0.05 }));
    gem.position.y = top + 0.5; g.add(gem); g.userData.gem = gem;
  }
  if (tier >= 10) { // grandmaster and above: crown of spikes
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 6), trim); sp.position.set(Math.cos(a) * (flare + 0.02), top + 0.18, Math.sin(a) * (flare + 0.02)); g.add(sp); }
  }
  if (tier >= 11) { // challenger and above: orbiting rings
    const orbit = new THREE.Group();
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * 0.2, 0.025, 6, 60), new THREE.MeshBasicMaterial({ color: i ? 0xffe07a : cup.glow || cup.color, transparent: !won, opacity: won ? 1 : 0.4 })); r.rotation.set(Math.PI / 2 + (i ? 0.5 : -0.4), 0, 0); orbit.add(r); }
    orbit.position.y = y + 0.6; g.add(orbit); g.userData.orbit = orbit;
  }
  if (tier === 12) { // legendary: golden wings and a halo
    const wingM = new THREE.MeshStandardMaterial({ color: 0xffe3a0, metalness: 1, roughness: 0.25, side: THREE.DoubleSide, emissive: 0x7a4a00, emissiveIntensity: won ? 0.5 : 0.1, transparent: !won, opacity: won ? 1 : 0.35 });
    for (const sx of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0);
      sh.bezierCurveTo(0.6 * sx, 0.3, 1.3 * sx, 0.9, 1.7 * sx, 1.8); sh.bezierCurveTo(1.2 * sx, 1.3, 0.9 * sx, 1.2, 0.7 * sx, 1.25);
      sh.bezierCurveTo(0.8 * sx, 0.9, 0.5 * sx, 0.7, 0.4 * sx, 0.75); sh.bezierCurveTo(0.35 * sx, 0.45, 0.2 * sx, 0.3, 0, 0);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(sh, 12), wingM); w.position.set(sx * (flare - 0.1), y + 0.3, -0.1); w.rotation.y = -sx * 0.35; g.add(w);
    }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: !won, opacity: won ? 1 : 0.4 })); halo.rotation.x = Math.PI / 2; halo.position.y = top + 1.05; g.add(halo);
  }
  // Sparkles around higher won cups.
  if (won && tier >= 5) {
    const n = 10 + tier * 5, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 0.8 + Math.random() * 0.8; pos.set([Math.cos(a) * r, 0.3 + Math.random() * (top + 0.8), Math.sin(a) * r], i * 3); }
    const sp = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: cup.glow || 0xfff1b8, size: 0.07 + tier * 0.005, transparent: true, opacity: 0.9, depthWrite: false }));
    g.add(sp); g.userData.sparkle = sp;
  }
  g.scale.setScalar(1.15 + tier * 0.1);
  if (won) shadowAll(g);
  return g;
}

export function mountTrophies(container, { cups, sky: skyInfo, onPick }) {
  let seed = 3; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);

  // Sky follows the real time of day, like the palace.
  const sky = new Sky(); sky.scale.setScalar(3000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 4; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); sun.shadow.bias = -0.0005;
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a7a60, 1.5);
  const front = new THREE.DirectionalLight(0xfff2dc, 1.2); front.position.set(0, 30, 60); scene.add(front);
  scene.add(sun, sun.target, hemi);
  let night = 0;
  const applySky = () => {
    const { elev, pm } = skyInfo();
    const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -14)), pm ? 2.2 : -1);
    su.sunPosition.value.copy(dir);
    night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    sun.position.copy(elev > 3 ? dir : new THREE.Vector3(-0.3, 0.8, 0.5).normalize()).multiplyScalar(90);
    sun.intensity = THREE.MathUtils.lerp(2.6, 0.4, night); sun.color.set(night > 0.5 ? 0x9fb4e6 : 0xfff0d8);
    hemi.intensity = THREE.MathUtils.lerp(1.5, 0.45, night);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.55, 1, night);
    sky.visible = night < 0.95; scene.background = sky.visible ? null : new THREE.Color(0x0e1530);
  };
  applySky();
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 4500 }, (_, i) => {
    const v = new THREE.Vector3().setFromSphericalCoords(1500, Math.acos(0.05 + ((i / 3) * 0.37 % 1) * 0.9), (i * 2.39996) % (Math.PI * 2)); return [v.x, v.y, v.z][i % 3];
  }), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);

  // ---- island ----
  const rock = new THREE.MeshStandardMaterial({ color: 0x7d6a58, roughness: 1, flatShading: true });
  const island = new THREE.Group(); scene.add(island);
  const under = new THREE.Mesh(new THREE.ConeGeometry(24, 38, 14, 4), rock); under.rotation.x = Math.PI; under.position.y = -19.5; island.add(under);
  for (let i = 0; i < 12; i++) { const a = rand() * 6.28, r = 10 + rand() * 12, h = 8 + rand() * 10; const c = new THREE.Mesh(new THREE.ConeGeometry(2 + rand() * 3, h, 6), rock); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * r, -h / 2 - 1.6, Math.sin(a) * r); island.add(c); }
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(25, 24, 2, 40), new THREE.MeshStandardMaterial({ color: 0x69a64a, roughness: 1 })); grass.position.y = -0.9; grass.receiveShadow = true; island.add(grass);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 18.5, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.35 })); plaza.position.y = 0.15; plaza.receiveShadow = true; island.add(plaza);
  const inlay = new THREE.Mesh(new THREE.RingGeometry(5, 5.6, 64), new THREE.MeshStandardMaterial({ color: 0xd4a53a, metalness: 1, roughness: 0.3 })); inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.32; island.add(inlay);
  // Waterfalls pouring off the edge
  for (const a of [0.6, 2.8, 4.6]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3, 60), new THREE.MeshBasicMaterial({ color: 0xd9f3ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    f.position.set(Math.cos(a) * 24.5, -30, Math.sin(a) * 24.5); f.lookAt(0, -30, 0); island.add(f);
  }
  // ---- Hall of Champions: a stepped marble temple, one terrace per group of ranks ----
  const stone = new THREE.MeshStandardMaterial({ color: 0xeadfc8, roughness: 0.7 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.25 });
  const marbleM = new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.25 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1d1830, roughness: 0.3, metalness: 0.4 });
  const bronzeM = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 });
  const blueM = new THREE.MeshStandardMaterial({ color: 0x2f5aa8, roughness: 0.5 });
  // terraces: [radius, top height, material]
  const TERR = [[12.8, 2.3, marbleM], [8.4, 4.4, marbleM], [4, 6.6, darkM]];
  TERR.forEach(([r, top, m], i) => {
    const prev = i ? TERR[i - 1][1] : 0.3;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.4, top - prev, 64), m); t.position.y = prev + (top - prev) / 2; t.castShadow = t.receiveShadow = true; island.add(t);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.13, 8, 96), goldM); rim.rotation.x = Math.PI / 2; rim.position.y = top; island.add(rim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.42, r + 0.42, 0.25, 64, 1, true), blueM); band.position.y = prev + 0.35; island.add(band);
  });
  // Grand stairway on the front (+z) up to the summit
  for (let i = 0; i < 28; i++) {
    const y = 0.3 + i * 0.225, z = 16.5 - i * 0.44;
    if (z < 3.2) break;
    const st = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.225, 0.46), i % 2 ? marbleM : stone); st.position.set(0, y + 0.11, z); st.receiveShadow = true; island.add(st);
  }
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2, 14.5), new THREE.MeshStandardMaterial({ color: 0x8e1b24, roughness: 1 }));
  carpet.position.set(0, 3.7, 10); carpet.rotation.x = -Math.PI / 2 + Math.atan(0.225 / 0.44); island.add(carpet);
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 14.6), goldM); rail.position.set(sx * 1.9, 4.6, 10); rail.rotation.x = Math.atan(0.225 / 0.44); island.add(rail);
    for (const z of [16.4, 4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 10), goldM); post.position.set(sx * 1.9, (z > 10 ? 0.3 : 6.1) + 1.2, z); island.add(post); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), new THREE.MeshBasicMaterial({ color: 0xffb13b, toneMapped: false })); fl.position.set(sx * 1.9, (z > 10 ? 0.3 : 6.1) + 2.7, z); island.add(fl); }
  }
  // Crown of light above the summit
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16), new THREE.MeshStandardMaterial({ color: 0xffe7a8, emissive: 0xffb84d, emissiveIntensity: 1.2 })); orb.position.y = 15.5; island.add(orb);
  const orbLight = new THREE.PointLight(0xffc56b, 40, 50, 1.6); orbLight.position.y = 15; island.add(orbLight);
  const crown = new THREE.Group(); crown.position.y = 15.5; island.add(crown);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.6, 0.07, 8, 64), goldM); r.rotation.set(Math.PI / 2 + i * 0.5, i * 0.7, 0); crown.add(r); }
  // Outer colonnade with a golden ring and banners
  const colM = marbleM;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 1.35) continue;
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 8, 14), colM); c.position.set(x, 4.3, z); c.castShadow = true; island.add(c);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), goldM); cap.position.set(x, 8.4, z); island.add(cap);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.8), new THREE.MeshStandardMaterial({ color: [0x8e1b24, 0x2f5aa8, 0x6b3fa0][i % 3], side: THREE.DoubleSide })); ban.position.set(x * 0.97, 5.6, z * 0.97); ban.lookAt(0, 5.6, 0); island.add(ban);
  }
  // Floating crystals around the temple
  const crystals = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0x9fe3ff, emissive: 0x3aa8ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 })); c.position.set(Math.cos(a) * 23, 6 + (i % 3) * 2, Math.sin(a) * 23); c.scale.y = 1.8; island.add(c); crystals.push(c); }

  // ---- pedestals: lower ranks on the ground ring, higher ranks on the terraces, legendary on the summit ----
  const labelLayer = document.createElement('div'); labelLayer.className = 'w3-labels'; container.appendChild(labelLayer);
  const slots = [], pick = [];
  const GROUPS = [[0, 5, 15.6, 0.3], [5, 9, 10.6, 2.3], [9, 12, 6.2, 4.4], [12, 13, 0, 6.6]]; // [from, to, radius, floor]
  cups.forEach((cup, i) => {
    const [from, to, R, floor] = GROUPS.find(([f, t]) => i >= f && i < t);
    const n = to - from, k = i - from;
    const a = R ? Math.PI / 2 + 0.55 + (k + 0.5) / n * (Math.PI * 2 - 1.1) : 0;
    const h = 0.7 + (R ? 0 : 0.6);
    const slot = new THREE.Group(); slot.position.set(Math.cos(a) * R, floor, Math.sin(a) * R); island.add(slot);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, h, i < 2 ? 7 : 16), i < 2 ? rock : i < 5 ? stone : i < 9 ? marbleM : darkM); ped.position.y = h / 2; slot.add(ped); shadowAll(ped);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.16, 16), i < 2 ? rock : i < 5 ? bronzeM : goldM); cap.position.y = h + 0.05; slot.add(cap);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.85, 64, 1, 0, 0.001), new THREE.MeshBasicMaterial({ color: new THREE.Color(cup.glow || cup.color), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; slot.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 10, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(cup.glow || cup.color), transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = h + 5; slot.add(beam);
    slot.userData = { cup, i, top: h + 0.13, ring, beam, trophy: null };
    ped.userData.cupId = cup.id; cap.userData.cupId = cup.id; pick.push(ped, cap);
    const el = document.createElement('button'); el.className = 'w3-label cup-label'; el.onclick = () => onPick(cup.id);
    labelLayer.appendChild(el);
    slots.push({ slot, el, v: new THREE.Vector3() });
  });

  const setCups = (list) => {
    list.forEach((c, i) => {
      const { slot, el } = slots[i];
      const u = slot.userData;
      if (u.trophy) slot.remove(u.trophy);
      u.trophy = trophy(c, i, c.state);
      u.trophy.position.y = u.top;
      u.trophy.traverse((m) => { m.userData.cupId = c.id; }); pick.push(...u.trophy.children);
      slot.add(u.trophy);
      u.state = c.state;
      u.ring.geometry.dispose();
      u.ring.geometry = new THREE.RingGeometry(1.7, 2, 64, 1, Math.PI / 2, Math.max(0.001, (c.state === 'won' ? 1 : c.progress || 0) * Math.PI * 2));
      u.ring.visible = c.state !== 'locked';
      u.beam.visible = c.state !== 'locked';
      u.beam.material.opacity = c.state === 'won' ? 0.14 : 0.22;
      el.className = `w3-label cup-label ${c.state}`;
      el.innerHTML = `${c.state === 'won' ? '🏆 ' : c.state === 'active' ? '⏳ ' : ''}${c.name} <small>${c.state === 'active' ? `${c.done}/${c.days}` : `${c.days} يوم`}</small>`;
    });
  };
  setCups(cups);

  // ---- cloud sea below + drifting clouds ----
  const puff = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  const cloudMat = new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0.95 });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 420; i++) {
    const a = rand() * 6.28, r = 20 + Math.sqrt(rand()) * 380;
    const sp = new THREE.Sprite(cloudMat); const k = 30 + rand() * 50;
    sp.position.set(Math.cos(a) * r, -60 - rand() * 20, Math.sin(a) * r); sp.scale.set(k * 1.8, k, 1); clouds.add(sp);
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * 6.28, r = 60 + rand() * 200;
    const sp = new THREE.Sprite(cloudMat); const k = 14 + rand() * 20;
    sp.position.set(Math.cos(a) * r, -10 + rand() * 50, Math.sin(a) * r); sp.scale.set(k * 1.8, k, 1); sp.userData.drift = 1 + rand() * 2; clouds.add(sp);
  }
  // small floating rocks around
  const rocks = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.28 + rand(), r = 75 + rand() * 60;
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(3 + rand() * 4, 7 + rand() * 6, 7), rock); c.rotation.x = Math.PI; c.position.y = -4; g.add(c);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x69a64a })); g.add(top);
    g.position.set(Math.cos(a) * r, -18 + rand() * 30, Math.sin(a) * r); g.userData.ph = rand() * 6; scene.add(g); rocks.push(g);
  }

  // ---- camera ----
  camera.position.set(0, 24, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
  controls.minDistance = 8; controls.maxDistance = 90; controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.25;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pick, false).find((h) => h.object.userData.cupId);
    if (hit) onPick(hit.object.userData.cupId);
  });

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  if (camera.aspect < 0.8) camera.position.set(0, 30, 70);

  const clock = new THREE.Clock(); const v = new THREE.Vector3(), tmpV = new THREE.Vector3(); let raf, lastSky = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    controls.update();
    island.position.y = Math.sin(t * 0.5) * 0.4;
    orb.material.emissiveIntensity = 1 + Math.sin(t * 2) * 0.3;
    crown.rotation.y = t * 0.4; crown.rotation.x = Math.sin(t * 0.3) * 0.2;
    crystals.forEach((c, i) => { c.rotation.y = t + i; c.position.y += Math.sin(t * 1.2 + i) * 0.004; });
    stars.material.opacity = night;
    for (const { slot } of slots) {
      const u = slot.userData;
      if (!u.trophy) continue;
      u.trophy.rotation.y = t * (u.state === 'won' ? 0.5 : 0.25) + u.i;
      if (u.state === 'active') { u.trophy.position.y = u.top + 0.2 + Math.sin(t * 2 + u.i) * 0.15; u.beam.material.opacity = 0.18 + Math.sin(t * 3) * 0.08; }
      const d = u.trophy.userData;
      if (d.gem) { d.gem.rotation.y = t * 2; d.gem.position.y += Math.sin(t * 2 + u.i) * 0.002; }
      if (d.spin) d.spin.rotation.y = t * 1.5;
      if (d.orbit) { d.orbit.children[0].rotation.z = t * 1.2; d.orbit.children[1].rotation.z = -t * 0.9; }
      if (d.sparkle) d.sparkle.rotation.y = -t * 0.6;
    }
    for (const c of clouds.children) if (c.userData.drift) { c.position.x += dt * c.userData.drift; if (c.position.x > 260) c.position.x -= 520; }
    for (const r of rocks) r.position.y += Math.sin(t * 0.6 + r.userData.ph) * dt * 0.6;
    renderer.render(scene, camera);
    const w = container.clientWidth, h = container.clientHeight;
    for (const s of slots) {
      s.slot.getWorldPosition(v); v.y += s.slot.userData.top + 3.2;
      v.project(camera);
      const far = s.slot.userData.state !== 'active' && camera.position.distanceTo(s.slot.getWorldPosition(tmpV)) > 24;
      const vis = !far && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      s.el.style.display = vis ? '' : 'none';
      if (vis) s.el.style.transform = `translate(-50%, -100%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    update(list) { setCups(list); },
    focus(cupId) {
      const s = slots.find((x) => x.slot.userData.cup.id === cupId); if (!s) return;
      s.slot.getWorldPosition(v); controls.autoRotate = false;
      const dir = v.clone().setY(0).normalize();
      camera.position.copy(v).addScaledVector(dir, 16).setY(v.y + 9); controls.target.copy(v).setY(v.y + 2);
    },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
