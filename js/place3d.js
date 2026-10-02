// 3D home for any dimension character: its landmark in the middle of a themed
// ground, sky that follows the real time of day, and the character walking with
// WASD / arrows / joystick (shared walker).
import * as THREE from './vendor/three.module.min.js';
import { Sky } from './vendor/Sky.js';
import { buildWorshipper } from './oasis3d.js';
import { createWalker } from './walker.js';
import { DIM_BUILD } from './landmarks.js';
import { buildRankStand } from './rankstand3d.js';

// Ground colour and scatter props per dimension.
const THEME = {
  body:    { ground: 0x5f9e4a, fog: 0xcfe3f0, prop: 'cone' },
  heart:   { ground: 0x8cc47a, fog: 0xf6d9e4, prop: 'blossom' },
  social:  { ground: 0xcdb98f, fog: 0xe8e0cf, prop: 'lamp' },
  library: { ground: 0x6f8a5a, fog: 0xd9dde8, prop: 'cone' },
  career:  { ground: 0x8a8f96, fog: 0xd6d9de, prop: 'crate' },
  wealth:  { ground: 0xa9c48a, fog: 0xe9f0d8, prop: 'coin' },
  nature:  { ground: 0x4f9a3f, fog: 0xd8f0d0, prop: 'tree' },
};

export function mountPlace(container, { regionId, palette, rank, sky: skyInfo, onCharacter, onRanks }) {
  const theme = THEME[regionId] || THEME.body;
  let seed = 17; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(theme.fog, 60, 220);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 3000);

  const sky = new Sky(); sky.scale.setScalar(2500); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 5; su.rayleigh.value = 1.8; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 250 }); sun.shadow.bias = -0.0005;
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x6b5a40, 1);
  scene.add(sun, sun.target, hemi);
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: 3000 }, (_, i) => {
    const v = new THREE.Vector3().setFromSphericalCoords(1200, Math.acos(0.1 + ((i * 0.618) % 1) * 0.85), i * 2.39996); return [v.x, v.y, v.z][i % 3];
  }), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  let night = 0;
  const applySky = () => {
    const { elev, pm } = skyInfo();
    const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -14)), pm ? 2.3 : -0.8);
    su.sunPosition.value.copy(dir);
    night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    const golden = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 12, 0, 1) * (1 - night);
    sun.position.copy(elev > 3 ? dir : new THREE.Vector3(-0.3, 0.8, 0.5).normalize()).multiplyScalar(100);
    sun.color.set(night > 0.5 ? 0x9fb4e6 : 0xfff0d8).lerp(new THREE.Color(0xff9c5a), golden * 0.8);
    sun.intensity = THREE.MathUtils.lerp(2.6, 0.35, night);
    hemi.intensity = THREE.MathUtils.lerp(1, 0.25, night);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.55, 0.95, night);
    sky.visible = night < 0.95; scene.background = sky.visible ? null : new THREE.Color(0x0b1026);
    scene.fog.color.set(theme.fog).lerp(new THREE.Color(0x0e1426), night);
  };
  applySky();

  // Ground, path to the landmark, scattered props, hills around.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.8 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 10); plaza.receiveShadow = true; scene.add(plaza);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 16), new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.015, -1); scene.add(path);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = 180 + rand() * 80; const h = new THREE.Mesh(new THREE.SphereGeometry(40 + rand() * 40, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.ground).multiplyScalar(0.85), roughness: 1 })); h.position.set(Math.cos(a) * r, -8, Math.sin(a) * r); h.scale.y = 0.4 + rand() * 0.3; scene.add(h); }
  const props = [];
  const propMesh = () => {
    const g = new THREE.Group();
    if (theme.prop === 'cone' || theme.prop === 'tree') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2a })); t.position.y = 0.8; g.add(t); const c = new THREE.Mesh(theme.prop === 'tree' ? new THREE.IcosahedronGeometry(1.8, 1) : new THREE.ConeGeometry(1.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3e7a3a })); c.position.y = theme.prop === 'tree' ? 3 : 3.2; g.add(c); }
    if (theme.prop === 'blossom') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a3c })); t.position.y = 1; g.add(t); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: rand() < 0.5 ? 0xffb3cc : 0xff9ebb })); c.position.y = 2.8; g.add(c); }
    if (theme.prop === 'lamp') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), new THREE.MeshStandardMaterial({ color: 0x333333 })); p.position.y = 1.5; g.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe7a8, emissive: 0xffb84d, emissiveIntensity: 1 })); l.position.y = 3.1; g.add(l); g.userData.lamp = l; }
    if (theme.prop === 'crate') { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xa0764a })); b.position.y = 0.7; g.add(b); }
    if (theme.prop === 'coin') { for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.25 })); c.position.y = 0.1 + i * 0.2; g.add(c); } }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  };
  for (let i = 0; i < 45; i++) {
    const a = rand() * Math.PI * 2, r = 16 + rand() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 4 && z > -8) continue;
    const o = propMesh(); o.position.set(x, 0, z); o.rotation.y = rand() * 6; o.scale.setScalar(0.8 + rand() * 0.6); scene.add(o); props.push({ x, z, r: 1.2 * o.scale.x });
  }
  // The landmark
  const build = DIM_BUILD[regionId];
  const landmark = build ? build() : new THREE.Group();
  landmark.scale.setScalar(1.4); landmark.position.set(0, 0, -16); scene.add(landmark);

  // The rank tree, to the side of the plaza.
  const STAND = { x: -8, z: 4 };
  const stand = rank ? buildRankStand(rank) : null;
  if (stand) { stand.root.position.set(STAND.x, 0, STAND.z); stand.root.rotation.y = Math.atan2(-STAND.x, 10 - STAND.z); stand.root.scale.setScalar(1.25); scene.add(stand.root); }

  // Character
  const hero = buildWorshipper(palette);
  scene.add(hero.root);
  const blocked = (x, z) => {
    if (Math.hypot(x, z) > 48) return true;
    if (Math.hypot(x, z + 16) < 13) return true;       // the landmark
    if (stand && Math.hypot(x - STAND.x, z - STAND.z) < 2.6) return true;
    for (const p of props) if (Math.hypot(x - p.x, z - p.z) < p.r) return true;
    return false;
  };
  const walker = createWalker({ hero, camera, dom: renderer.domElement, container, blocked, dist: 14, height: 3.2 });
  walker.teleport(0, 10, Math.PI);
  walker.setCameraClamp((p) => { p.y = Math.max(0.8, p.y); });

  // Tap the character to greet.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(hero.root, true).length) { if (!hero.busy()) hero.wave(); onCharacter?.(); return; }
    if (stand && ray.intersectObject(stand.root, true).length) onRanks?.();
  });

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const clock = new THREE.Clock(); let raf, lastSky = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    const mv = walker.update(dt);
    hero.update(t, dt, mv.walk, mv.air);
    stand?.tick(t);
    stars.material.opacity = night;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    update({ rank: r } = {}) { if (r) stand?.update(r); },
    pray() { if (!hero.busy()) hero.wave(); },
    setWeather() {},
    refreshSky() { applySky(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); walker.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
