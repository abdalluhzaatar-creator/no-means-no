// 3D home for each dimension character: its own world (dims3d.js) under a sky that
// follows the real time of day and the live weather (env3d.js), the character
// walking with WASD / arrows / joystick, a small rank stand, and a celebration
// burst in the place's colours whenever a task is done.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { createWalker } from './walker.js';
import { buildRankStand } from './rankstand3d.js';
import { createEnv, canvasTex, glowTex } from './env3d.js';
import { DIM_SCENES, DIM_ENV } from './dims3d.js';
import { placeAmbience } from './audio.js';
import { createLucifer } from './lucifer3d.js';
import { arm, unarm } from './heaven3d.js';
import { habitHouses } from './habits3d.js';
import { buildStarTree } from './startree3d.js';

const heartTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(-8, 30, 12, 0, 32, 18); g.bezierCurveTo(52, 0, 72, 30, 32, 56); g.fill(); });

// A small mark of who each character is.
function accessory(regionId, hero) {
  const neck = hero.head.parent, hand = hero.arms[1].el;
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const add = (p, geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  if (regionId === 'library') { const b = add(hand, new THREE.BoxGeometry(0.2, 0.26, 0.07), m(0x7a1f24), 0, -0.36, 0.06); add(b, new THREE.BoxGeometry(0.18, 0.24, 0.075), m(0xf3e6c4), 0.012, 0, 0); }
  if (regionId === 'body') { const hb = add(neck, new THREE.TorusGeometry(0.165, 0.025, 6, 24), m(0xc0392b), 0, 0.22, 0); hb.rotation.x = Math.PI / 2 - 0.15; }
  if (regionId === 'social') { const sc = add(neck, new THREE.TorusGeometry(0.15, 0.045, 8, 20), m(0xd4a53a), 0, 0.0, 0); sc.rotation.x = Math.PI / 2; }
  if (regionId === 'career') { const torso = hero.root.children[1]; const tie = add(torso, new THREE.BoxGeometry(0.07, 0.34, 0.02), m(0x9a1a1a), 0, 0.42, 0.285); tie.rotation.x = -0.08; add(torso, new THREE.BoxGeometry(0.1, 0.06, 0.03), m(0x9a1a1a), 0, 0.6, 0.27); add(hand, new THREE.BoxGeometry(0.34, 0.24, 0.08), m(0x3a2618, { roughness: 0.4 }), 0, -0.48, 0.02); }
  if (regionId === 'wealth') { add(hero.root.children[1], new THREE.SphereGeometry(0.09, 10, 8), m(0xd4a53a, { metalness: 0.9, roughness: 0.25 }), 0.2, 0.0, 0.2); }
}

export function mountPlace(container, { regionId, palette, rank, features = new Set(), habits = [], sky: skyInfo, weather = 'clear', lucifer = null, onCharacter, onRanks, onHabit }) {
  let seed = 17; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 3000);
  const env = createEnv(scene, renderer, camera, { skyInfo, weather, rand, ...(DIM_ENV[regionId] || {}) });

  // Lights and glowing materials that wake up at night; the celebration level.
  const glows = [];
  let burst = 0;
  // Upgrades bought in this place: each scene registers what every upgrade shows.
  let feats = features;
  const featured = [];
  const showFeats = () => featured.forEach(([k, objs]) => objs.forEach((o) => (o.visible = feats.has(k))));
  const kit = { rand, env, glow: (o, day, night) => glows.push({ o, day, night }), burstK: () => burst, has: (k) => feats.has(k), feat: (k, ...objs) => { featured.push([k, objs]); objs.forEach((o) => (o.visible = feats.has(k))); } };
  const place = (DIM_SCENES[regionId] || DIM_SCENES.library)(scene, kit);
  showFeats();
  const sound = placeAmbience(regionId, env);

  // Rank stand.
  const stand = rank ? buildRankStand(rank) : null;
  const [SX, SZ, SR] = place.stand;
  if (stand) { stand.root.position.set(SX, place.groundAt?.(SX, SZ) || 0, SZ); stand.root.rotation.y = SR; scene.add(stand.root); }
  // Beside it, the star tree: a star lit for every building.
  const TX = SX + Math.cos(SR) * 1.6, TZ = SZ - Math.sin(SR) * 1.6;
  const starTree = buildStarTree(); starTree.root.position.set(TX, place.groundAt?.(TX, TZ) || 0, TZ); starTree.root.rotation.y = SR; scene.add(starTree.root); starTree.set(habits.length);

  // The eight small buildings: one for every habit.
  const houses = habitHouses(scene, {
    blocked: place.blocked, groundAt: place.groundAt, spawn: [place.spawn[0], place.spawn[1]], center: [0, 0],
    inside: (x, z) => Math.hypot(x, z) < (place.camR || 20) - 3, avoid: [[TX, TZ, 0.8], ...(stand ? [[SX, SZ, 1.2]] : [])],
    color: '#f2ead8', roof: palette.accent, habits,
  });

  // The character.
  const hero = buildWorshipper(palette);
  accessory(regionId, hero);
  // His armour grows with his rank, the same as in the Hall of Warriors.
  let tier = rank?.current ?? 0;
  let cape = arm(hero, palette, false, tier);
  scene.add(hero.root);
  const blocked = (x, z) => place.blocked(x, z) || (stand && Math.hypot(x - SX, z - SZ) < 1) || houses.blocked(x, z);
  const walker = createWalker({ hero, camera, dom: renderer.domElement, container, blocked, dist: 12, height: 3 });
  if (place.groundAt) walker.setGround(place.groundAt);
  walker.teleport(...place.spawn);
  const luci = lucifer ? createLucifer(scene, { camera, container, hero: hero.root, who: lucifer.who, tasks: lucifer.tasks, groundAt: place.groundAt || (() => 0) }) : null;
  walker.setCameraClamp((p) => {
    const r = Math.hypot(p.x, p.z);
    if (r > place.camR) { p.x *= place.camR / r; p.z *= place.camR / r; }
    p.y = Math.max(0.9, Math.min(place.camY || 20, p.y));
  });

  // Celebration: a burst of sparks / petals / confetti in the place's colours.
  const BN = 160, bpos = new Float32Array(BN * 3), bcol = new Float32Array(BN * 3), bvel = Array.from({ length: BN }, () => new THREE.Vector3());
  const bGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(bpos, 3)).setAttribute('color', new THREE.BufferAttribute(bcol, 3));
  const bMat = new THREE.PointsMaterial({ size: place.burstTex === 'heart' ? 0.5 : 0.28, map: place.burstTex === 'heart' ? heartTex : glowTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bPts = new THREE.Points(bGeo, bMat); bPts.frustumCulled = false; scene.add(bPts);
  const celebrate = () => {
    burst = 1;
    const p = hero.root.position, c = new THREE.Color();
    for (let i = 0; i < BN; i++) {
      bpos.set([p.x, p.y + 2.2, p.z], i * 3);
      bvel[i].set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(1.5 + Math.random() * 3.5).setY(4 + Math.random() * 6);
      c.set(place.burst[i % place.burst.length]); bcol.set([c.r, c.g, c.b], i * 3);
    }
    bGeo.attributes.color.needsUpdate = true;
  };

  // Tap the character to greet, the stand to see the ranks.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(hero.root, true).length) { if (!hero.busy()) hero.wave(); onCharacter?.(); return; }
    if (stand && ray.intersectObject(stand.root, true).length) { onRanks?.(); return; }
    const h = houses.pick(ray); if (h) onHabit?.(h.id);
  });

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  if (camera.aspect < 0.8) { camera.fov = 55; camera.updateProjectionMatrix(); }

  const clock = new THREE.Clock(); let raf, lastSky = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { env.applySky(); lastSky = t; }
    const n = env.state.night, dim = env.W.dim;
    for (const g of glows) { const v = THREE.MathUtils.lerp(g.day, g.night, Math.min(1, n + dim * 0.5)); if (g.o.isLight) g.o.intensity = v; else g.o.emissiveIntensity = v; }
    const mv = walker.update(dt);
    hero.update(t, dt, mv.walk, mv.air);
    stand?.tick(t);
    houses.tick(t);
    starTree.tick(t);
    place.tick(t, dt, env.state, hero);
    luci?.tick(t, dt);
    env.tick(t, dt);
    if (burst > 0) {
      burst = Math.max(0, burst - dt * 0.45);
      for (let i = 0; i < BN; i++) { const v = bvel[i]; v.y -= dt * 7; bpos[i * 3] += v.x * dt; bpos[i * 3 + 1] = Math.max(0.05, bpos[i * 3 + 1] + v.y * dt); bpos[i * 3 + 2] += v.z * dt; }
      bGeo.attributes.position.needsUpdate = true;
    }
    bMat.opacity = Math.min(1, burst * 2);
    if (window.__nmnTop) { const [y, z] = window.__nmnTop; camera.position.set(0, y, z); camera.lookAt(0, 0, 0); }   // tests: a view from above
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    update({ rank: r, features: f, habits: hs } = {}) { if (hs) { houses.update(hs); starTree.set(hs.length); } if (r) { stand?.update(r); if (r.current !== tier) { unarm(hero); tier = r.current; cape = arm(hero, palette, false, tier); } } if (f) { feats = f; showFeats(); } },
    pray() { if (!hero.busy()) hero.wave(); celebrate(); },
    react(kind) { luci?.react(kind); },
    setWeather(k) { env.setWeather(k); },
    refreshSky() { env.applySky(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); walker.dispose(); sound.stop(); luci?.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
