// 3D headquarters: a torch-lit war hall with a strategy table showing every place,
// and the commander standing behind it. His insignia grows with his rank.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildWorshipper } from './oasis3d.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

export function mountHQ(container, { places, rankIndex, sky: skyInfo, onCommander }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f0c0a);
  scene.fog = new THREE.Fog(0x0f0c0a, 30, 70);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

  // ---- hall ----
  const stoneTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#5a4f45'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < 256; x += 64) {
      const v = 70 + Math.random() * 30; g.fillStyle = `rgb(${v + 12},${v + 4},${v - 6})`; g.fillRect(x + 2, y + 2, 60, 28);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const floorTex = stoneTex.clone(); floorTex.needsUpdate = true; floorTex.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, 22), std(0x7a1f24, { roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, 4); rug.receiveShadow = true; scene.add(rug);
  const rugEdge = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 22.4), std(0xd4a53a, { metalness: 0.6 })); rugEdge.rotation.x = -Math.PI / 2; rugEdge.position.set(0, 0.005, 4); scene.add(rugEdge);
  const wallTex = stoneTex.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(5, 2);
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  const sky = new THREE.MeshBasicMaterial({ color: 0x7fb8e6 });
  // back wall with three tall arched windows showing the sky
  const back = new THREE.Shape(); back.moveTo(-20, 0); back.lineTo(20, 0); back.lineTo(20, 16); back.lineTo(-20, 16); back.lineTo(-20, 0);
  for (const x of [-9, 0, 9]) { const h = new THREE.Path(); h.moveTo(x - 2.2, 3); h.lineTo(x - 2.2, 10); h.absarc(x, 10, 2.2, Math.PI, 0, true); h.lineTo(x + 2.2, 3); h.lineTo(x - 2.2, 3); back.holes.push(h); }
  const backWall = new THREE.Mesh(new THREE.ExtrudeGeometry(back, { depth: 1, bevelEnabled: false }), wallM); backWall.position.z = -12; scene.add(backWall);
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), sky); skyPlane.position.set(0, 8, -12.6); scene.add(skyPlane);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 40), wallM); w.position.set(sx * 20, 8, 4); w.receiveShadow = true; scene.add(w); }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), std(0x2a211b)); ceil.position.set(0, 16.5, 4); scene.add(ceil);
  // columns & banners
  const colM = std(0x8a7a6a, { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const z of [-8, -1, 6, 13]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 16, 14), colM); c.position.set(sx * 12, 8, z); c.castShadow = true; scene.add(c);
  }
  const bannerCols = [0x2f6f5e, 0x7a1f24, 0x2f4a6d, 0x7a5a1f];
  [-14, -5, 5, 14].forEach((x, i) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), std(bannerCols[i], { side: THREE.DoubleSide, roughness: 1 })); b.position.set(x, 11, -11.3); scene.add(b);
    const emb = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), std(0xd4a53a, { metalness: 0.8, roughness: 0.3 })); emb.position.set(x, 11.5, -11.25); scene.add(emb);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), std(0xd4a53a, { metalness: 1 })); rod.rotation.z = Math.PI / 2; rod.position.set(x, 14.6, -11.2); scene.add(rod);
  });

  // ---- light ----
  scene.add(new THREE.HemisphereLight(0xffe9c8, 0x2a1c12, 0.7));
  const fill = new THREE.DirectionalLight(0xfff2dc, 1.1); fill.position.set(4, 8, 16); fill.target.position.set(0, 2, 3); scene.add(fill, fill.target);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6); sun.position.set(-6, 14, -18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 }); scene.add(sun);
  const torches = [];
  for (const sx of [-1, 1]) for (const z of [-5, 3, 10]) {
    const g = new THREE.Group(); g.position.set(sx * 19.2, 7, z);
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 8), std(0x2a2522, { metalness: 0.6 })); g.add(holder);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 10), new THREE.MeshBasicMaterial({ color: 0xffb13b })); flame.position.y = 0.9; g.add(flame);
    const light = new THREE.PointLight(0xff9a3c, 14, 16, 1.6); light.position.set(-sx * 0.6, 1, 0); g.add(light);
    scene.add(g); torches.push({ flame, light, ph: Math.random() * 6 });
  }

  // ---- war table with every place marked ----
  const table = new THREE.Group(); table.position.set(0, 0, -2); scene.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.35, 48), std(0x4a3222, { roughness: 0.5 })); top.position.y = 2.2; table.add(top);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 2.1, 16), std(0x3a2618)); legs.position.y = 1.05; table.add(legs);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 8, 64), std(0xd4a53a, { metalness: 1, roughness: 0.3 })); trim.rotation.x = Math.PI / 2; trim.position.y = 2.38; table.add(trim);
  const mapTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
    g.fillStyle = '#2e6f86'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#d9c99a'; g.beginPath(); g.ellipse(256, 256, 210, 180, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7fa35a'; g.beginPath(); g.ellipse(230, 240, 160, 130, 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3d2d20'; g.globalAlpha = 0.25; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(256, 256, 20 + i * 8, 0, Math.PI * 2); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const mapDisc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.8 })); mapDisc.rotation.x = -Math.PI / 2; mapDisc.position.y = 2.39; table.add(mapDisc);
  const markers = [];
  places.forEach((p) => {
    const x = (p.map.x / 1000 - 0.5) * 6.4, z = (p.map.y / 700 - 0.5) * 5.2;
    const pin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 10), std(p.owned ? 0xffc83d : 0x555555, { metalness: p.owned ? 1 : 0, emissive: p.owned ? 0x7a5000 : 0, emissiveIntensity: 0.6 }));
    pin.rotation.x = Math.PI; pin.position.set(x, 2.7, z); table.add(pin);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), std(p.owned ? 0x2f6f5e : 0x333333, { side: THREE.DoubleSide })); flag.position.set(x + 0.25, 3.05, z); table.add(flag);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), std(0xeeeeee)); pole.position.set(x, 2.95, z); table.add(pole);
    markers.push({ pin, flag, owned: p.owned });
  });
  shadowAll(table);
  const holo = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 3, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  holo.position.set(0, 3.9, -2); scene.add(holo);

  // ---- commander ----
  const cmd = buildWorshipper({ robe: '#3a4f7a', accent: '#d4a53a', skin: '#f3d3b6', glow: '#ffc83d' });
  cmd.root.position.set(0, 0, 3.2); cmd.root.rotation.y = 0; scene.add(cmd.root);
  // rank insignia: stars on the chest grow with the rank, epaulettes from rank 3 up
  const insignia = new THREE.Group(); scene.add(insignia);
  const goldM = std(0xffc83d, { metalness: 1, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
  const setRank = (ri) => {
    insignia.clear();
    const n = Math.min(5, 1 + Math.floor(ri / 2));
    for (let i = 0; i < n; i++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), goldM); st.scale.set(1, 1, 0.4);
      st.position.set((i - (n - 1) / 2) * 0.16, 2.25, 3.66); insignia.add(st);
    }
    if (ri >= 3) for (const sx of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.3), goldM); ep.position.set(sx * 0.48, 2.5, 3.2); insignia.add(ep); }
    if (ri >= 7) { const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), std(0x7a1f24, { side: THREE.DoubleSide })); cape.position.set(0, 1.7, 2.74); cape.rotation.x = 0.08; insignia.add(cape); }
  };
  setRank(rankIndex);

  // ---- camera ----
  camera.position.set(3.5, 4.2, 12);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.4, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
  controls.minDistance = 5; controls.maxDistance = 20; controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
  controls.minAzimuthAngle = -1.1; controls.maxAzimuthAngle = 1.1;

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(cmd.root, true).length) { if (!cmd.busy()) cmd.wave(); onCommander?.(); }
  });

  const applySky = () => {
    const { elev } = skyInfo();
    const night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    sky.color.set(0x7fb8e6).lerp(new THREE.Color(0xff9c5a), THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 12, 0, 1) * (1 - night) * 0.7).lerp(new THREE.Color(0x0e1530), night);
    sun.intensity = THREE.MathUtils.lerp(1.6, 0.2, night);
  };
  applySky();

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  if (camera.aspect < 0.8) camera.position.set(3, 5.5, 17);

  const clock = new THREE.Clock(); let raf, lastSky = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    controls.update();
    cmd.update(t, dt);
    for (const tr of torches) { const f = 0.8 + Math.sin(t * 11 + tr.ph) * 0.12 + Math.sin(t * 27 + tr.ph) * 0.08; tr.light.intensity = 14 * f; tr.flame.scale.set(1, f * 1.1, 1); }
    holo.material.opacity = 0.05 + Math.sin(t * 2) * 0.02;
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
