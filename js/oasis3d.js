// 3D scene for the Quiet Oasis: a prayer courtyard among dunes with a
// fully animated worshipper. Upgrades appear in the scene as they are bought,
// and the sky follows the real time of day.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Sky } from './vendor/Sky.js';

// ---------- helpers ----------
function makeNoise(seed = 5) {
  const p = new Uint8Array(512);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = [...Array(256).keys()].sort(() => r() - 0.5);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const n2 = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = f(x), v = f(y), a = p[X] + Y, b = p[X + 1] + Y;
    const l = (a1, b1, t) => a1 + t * (b1 - a1);
    return l(l(g(p[a], x, y), g(p[b], x - 1, y), u), l(g(p[a + 1], x, y - 1), g(p[b + 1], x - 1, y - 1), u), v);
  };
  return (x, y, oct = 4) => { let a = 1, fr = 1, t = 0, m = 0; for (let i = 0; i < oct; i++) { t += n2(x * fr, y * fr) * a; m += a; a *= 0.5; fr *= 2; } return t / m; };
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shadowAll = (o) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
const lerp = THREE.MathUtils.lerp;

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Prayer rug with border, field and a mihrab arch at the head.
const rugTexture = (accent) => canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#7a1f24'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d9b25a'; g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = accent; g.fillRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#8e2a2c'; g.beginPath();
  g.moveTo(40, h - 40); g.lineTo(40, 170); g.quadraticCurveTo(w / 2, 20, w - 40, 170); g.lineTo(w - 40, h - 40); g.closePath(); g.fill();
  g.strokeStyle = '#e8c872'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#e8c872';
  for (let y = 220; y < h - 70; y += 60) for (let x = 70; x < w - 50; x += 58) { g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 12, y); g.lineTo(x, y + 14); g.lineTo(x - 12, y); g.fill(); }
  g.fillStyle = '#e8c872'; for (let x = 16; x < w; x += 16) { g.fillRect(x, 2, 3, 8); g.fillRect(x, h - 10, 3, 8); }
});

const tileTexture = () => canvasTex(512, 512, (g, w) => {
  g.fillStyle = '#e8dcc2'; g.fillRect(0, 0, w, w);
  const n = 8, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? '#e2d3b4' : '#efe4cc'; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    g.fillStyle = '#3f7d6e55'; g.save(); g.translate(i * s + s / 2, j * s + s / 2); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore();
  }
});

// ---------- character ----------
function buildWorshipper(pal) {
  const robe = std(pal.robe, { roughness: 0.9 });
  const accent = std(pal.accent, { roughness: 0.6 });
  const skin = std(pal.skin, { roughness: 0.7 });
  const hair = std(0x2b2018, { roughness: 1 });

  const root = new THREE.Group();
  // Lower robe: from feet to hips (pivot at the ground so it can compress when kneeling).
  const lower = new THREE.Group(); root.add(lower);
  const skirt = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.36, 0), new THREE.Vector2(0.37, 0.05), new THREE.Vector2(0.31, 0.5), new THREE.Vector2(0.25, 0.95), new THREE.Vector2(0.001, 0.95),
  ], 28), robe);
  lower.add(skirt);
  const feet = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), skin); feet.scale.set(1, 0.6, 1.8);
  [-0.1, 0.1].forEach((x) => { const f = feet.clone(); f.position.set(x, 0.04, 0.22); lower.add(f); });

  // Upper body pivots at the hips.
  const upper = new THREE.Group(); upper.position.y = 0.95; root.add(upper);
  const torso = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.25, 0), new THREE.Vector2(0.27, 0.25), new THREE.Vector2(0.29, 0.5), new THREE.Vector2(0.24, 0.62), new THREE.Vector2(0.08, 0.7), new THREE.Vector2(0.001, 0.7),
  ], 28), robe);
  upper.add(torso);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.035, 8, 32), accent); belt.rotation.x = Math.PI / 2; belt.position.y = 0.05; upper.add(belt);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.02), accent); trim.position.set(0, 0.35, 0.27); trim.rotation.x = -0.08; upper.add(trim);

  const neck = new THREE.Group(); neck.position.y = 0.7; upper.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), skin); head.position.y = 0.16; head.scale.set(0.95, 1.08, 1); neck.add(head);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), hair); beard.position.set(0, 0.07, 0.07); beard.scale.set(1, 0.9, 0.8); neck.add(beard);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xfaf8f2)); cap.position.y = 0.2; cap.scale.y = 0.75; neck.add(cap);
  const eyeM = std(0x1a1410);
  [-0.055, 0.055].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeM); e.position.set(x, 0.18, 0.145); neck.add(e); });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.15, 0.16); neck.add(nose);

  const mkArm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 0.58, 0); upper.add(sh);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.28, 4, 10), robe); up.position.y = -0.18; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.36; sh.add(el);
    const fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 4, 10), robe); fo.position.y = -0.14; el.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), skin); hand.position.y = -0.32; hand.scale.set(0.8, 1.1, 0.6); el.add(hand);
    return { sh, el };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  shadowAll(root);
  root.scale.setScalar(1.6);

  // Poses: every value is lerped between keyframes.
  const P = {
    stand:   { drop: 0, lowerSY: 1, upperY: 0.95, bend: 0, neck: 0, sx: 0, sz: 0.08, ex: 0 },
    takbir:  { drop: 0, lowerSY: 1, upperY: 0.95, bend: 0, neck: 0, sx: -0.4, sz: 1.05, ex: -2.3 },
    qiyam:   { drop: 0, lowerSY: 1, upperY: 0.95, bend: 0, neck: 0.15, sx: -0.35, sz: -0.35, ex: -1.25 },
    ruku:    { drop: 0, lowerSY: 1, upperY: 0.95, bend: 1.45, neck: -0.2, sx: -1.25, sz: 0.05, ex: -0.05 },
    sujud:   { drop: 0, lowerSY: 0.42, upperY: 0.42, bend: 2.05, neck: -0.3, sx: -2.4, sz: 0.15, ex: 0.15 },
    jalsa:   { drop: 0, lowerSY: 0.42, upperY: 0.42, bend: 0.05, neck: 0.1, sx: -0.5, sz: 0.1, ex: -0.9 },
    dua:     { drop: 0, lowerSY: 1, upperY: 0.95, bend: 0.05, neck: 0.25, sx: -0.9, sz: 0.25, ex: -1.3 },
  };
  const pose = { ...P.stand };
  const apply = (t) => {
    lower.scale.y = pose.lowerSY;
    upper.position.y = pose.upperY;
    upper.rotation.x = pose.bend;
    neck.rotation.x = pose.neck;
    for (const [a, s] of [[armL, 1], [armR, -1]]) {
      a.sh.rotation.x = pose.sx; a.sh.rotation.z = pose.sz * s; a.el.rotation.x = pose.ex;
    }
    // breathing
    torso.scale.set(1 + Math.sin(t * 1.6) * 0.012, 1, 1 + Math.sin(t * 1.6) * 0.02);
  };

  // Sequence player.
  let seq = null;
  const play = (steps) => { seq = { steps, i: 0, t: 0, from: { ...pose } }; };
  const update = (t, dt) => {
    if (seq) {
      const st = seq.steps[seq.i];
      seq.t += dt;
      const k = Math.min(1, seq.t / st.move);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      for (const key in pose) pose[key] = lerp(seq.from[key], P[st.pose][key], e);
      if (seq.t >= st.move + (st.hold || 0)) {
        seq.i++; seq.t = 0; seq.from = { ...pose };
        if (seq.i >= seq.steps.length) seq = null;
      }
    } else {
      // idle: slight sway of the head
      neck.rotation.y = Math.sin(t * 0.4) * 0.12;
    }
    apply(t);
  };
  const busy = () => !!seq;
  const rakah = [
    { pose: 'takbir', move: 0.7, hold: 0.6 }, { pose: 'qiyam', move: 0.6, hold: 1.4 },
    { pose: 'ruku', move: 0.9, hold: 1 }, { pose: 'stand', move: 0.8, hold: 0.4 },
    { pose: 'sujud', move: 1.2, hold: 1.1 }, { pose: 'jalsa', move: 0.8, hold: 0.6 },
    { pose: 'sujud', move: 0.8, hold: 1.1 }, { pose: 'jalsa', move: 0.8, hold: 0.8 },
    { pose: 'dua', move: 0.6, hold: 1.2 }, { pose: 'stand', move: 1.2 },
  ];
  return { root, update, busy, pray: () => play(rakah), wave: () => play([{ pose: 'dua', move: 0.5, hold: 0.8 }, { pose: 'stand', move: 0.6 }]), head };
}

// ---------- scene pieces ----------
function palm(rand, h = 6) {
  const g = new THREE.Group();
  const bark = std(0x7a5a3c, { roughness: 1 });
  const curve = 0.3 + rand() * 0.5, segs = 8;
  let y = 0, x = 0;
  for (let i = 0; i < segs; i++) {
    const sh = h / segs, r = 0.22 - i * 0.012;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, sh, 8), bark);
    x += (curve * i) / segs * 0.25;
    seg.position.set(x, y + sh / 2, 0); seg.rotation.z = -curve * 0.12; g.add(seg);
    y += sh;
  }
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4d7f35, roughness: 0.8, side: THREE.DoubleSide });
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(0.5, 1.4, 0, 3); shape.quadraticCurveTo(-0.5, 1.4, 0, 0);
  const lg = new THREE.ShapeGeometry(shape, 6);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(lg, leaf);
    const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.rotation.y = (i / 9) * Math.PI * 2 + rand();
    f.rotation.x = -Math.PI / 2 + 0.55 + rand() * 0.4; piv.add(f); g.add(piv);
  }
  const dates = std(0x8a4b1c);
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), dates); d.position.set(x + Math.cos(i) * 0.25, y - 0.3, Math.sin(i) * 0.25); g.add(d); }
  shadowAll(g);
  return g;
}

function mosque() {
  const g = new THREE.Group();
  const stone = std(0xeee3cc, { roughness: 0.7 }), green = std(0x2f6f5e, { roughness: 0.4, metalness: 0.2 }), gold = std(0xd4a53a, { roughness: 0.25, metalness: 0.9 });
  const dark = std(0x3b2f25);
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 10), stone); base.position.y = 3.5; g.add(base);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 1.6, 32), stone); drum.position.y = 7.8; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), green); dome.position.y = 8.6; dome.scale.y = 1.15; g.add(dome);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.8, 10), gold); fin.position.y = 14.9; g.add(fin);
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 8, 24, Math.PI * 1.4), gold); crescent.position.y = 16.2; crescent.rotation.z = 1.2; g.add(crescent);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 18, 16), stone); m.position.set(s * 9, 9, -2); g.add(m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 0.6, 16), stone); b.position.set(s * 9, 14, -2); g.add(b);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 16), green); c.position.set(s * 9, 19.5, -2); g.add(c);
  }
  // arched door and windows
  const arch = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); return new THREE.ShapeGeometry(sh, 16); };
  const door = new THREE.Mesh(arch(3, 5), dark); door.position.set(0, 0.01, 5.01); g.add(door);
  for (const x of [-5.5, -3.2, 3.2, 5.5]) { const wdw = new THREE.Mesh(arch(1.2, 2.4), dark); wdw.position.set(x, 3, 5.01); g.add(wdw); }
  shadowAll(g);
  return g;
}

function lantern() {
  const g = new THREE.Group();
  const metal = std(0x3a3128, { metalness: 0.6, roughness: 0.4 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), metal); post.position.y = 1.2; g.add(post);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa94d, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 }));
  glass.position.y = 2.65; g.add(glass);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 6), metal); top.position.y = 3.05; g.add(top);
  const light = new THREE.PointLight(0xffb566, 6, 9, 1.6); light.position.y = 2.65; g.add(light);
  g.userData.light = light; g.userData.glass = glass;
  post.castShadow = true;
  return g;
}

function fountain() {
  const g = new THREE.Group();
  const stone = std(0xd9ccb0, { roughness: 0.6 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 8), stone); basin.position.y = 0.3; g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: 0x3aa0b8, roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1 }));
  water.position.y = 0.58; g.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 12), stone); col.position.y = 1.1; g.add(col);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stone); bowl.position.y = 1.75; bowl.rotation.x = Math.PI; g.add(bowl);
  // jet particles
  const n = 60, pos = new Float32Array(n * 3);
  const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: 0xcfefff, size: 0.09, transparent: true, opacity: 0.85 }));
  const seeds = Array.from({ length: n }, (_, i) => [i / n, Math.random() * Math.PI * 2]);
  g.userData.tick = (t) => {
    seeds.forEach(([o, a], i) => {
      const k = (t * 0.8 + o) % 1, r = k * 0.9;
      pos.set([Math.cos(a) * r, 1.8 + k * 1.2 - k * k * 2.2, Math.sin(a) * r], i * 3);
    });
    drops.geometry.attributes.position.needsUpdate = true;
  };
  g.add(drops);
  shadowAll(basin); shadowAll(col);
  return g;
}

function mihrabArch() {
  const g = new THREE.Group();
  const stone = std(0xf1e6cf, { roughness: 0.6 }), gold = std(0xd4a53a, { metalness: 0.9, roughness: 0.3 }), tile = std(0x2f6f5e, { roughness: 0.4 });
  for (const x of [-1.6, 1.6]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.6, 16), stone); c.position.set(x, 1.8, 0); g.add(c);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), gold); cap.position.set(x, 3.7, 0); g.add(cap);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 12, 40, Math.PI), stone); top.position.y = 3.8; g.add(top);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 8, 40, Math.PI), gold); inlay.position.set(0, 3.8, 0.24); g.add(inlay);
  const back = new THREE.Shape(); back.moveTo(-1.4, 0); back.lineTo(-1.4, 3.8); back.absarc(0, 3.8, 1.4, Math.PI, 0, true); back.lineTo(1.4, 0);
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(back, 20), tile); panel.position.z = -0.2; g.add(panel);
  shadowAll(g);
  return g;
}

// ---------- mount ----------
export function mountOasis(container, { palette, features, level, onCharacter }) {
  const noise = makeNoise(21);
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);

  // Sky follows the local clock: dawn, noon, sunset and night.
  const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 8; su.rayleigh.value = 2; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a6a45, 0.9);
  scene.add(sun, sun.target, hemi);
  scene.fog = new THREE.Fog(0xe8d2b0, 60, 260);

  // Stars + crescent (visible at night; brighter with the "stars" upgrade).
  const starGeo = new THREE.BufferGeometry(); const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().setFromSphericalCoords(900, Math.acos(rand() * 0.95), rand() * Math.PI * 2); sp.set([v.x, v.y, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.TorusGeometry(18, 5, 12, 40, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false, transparent: true }));
  moon.position.set(-250, 330, -700); moon.rotation.z = 2.2; scene.add(moon);

  // Ground: rolling dunes, flat courtyard in the middle.
  const gg = new THREE.PlaneGeometry(600, 600, 220, 220); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position, gc = new Float32Array(gp.count * 3);
  const sandA = new THREE.Color(0xe3c48e), sandB = new THREE.Color(0xc99a5e), col = new THREE.Color();
  const groundH = (x, z) => {
    const d = Math.hypot(x, z + 4);
    const dunes = (Math.abs(noise(x * 0.012, z * 0.02, 3)) * 18 + noise(x * 0.05, z * 0.05, 2) * 1.5);
    return dunes * THREE.MathUtils.smoothstep(d, 22, 70) - (d < 20 ? 0 : 0);
  };
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), h = groundH(x, z);
    gp.setY(i, h);
    col.copy(sandA).lerp(sandB, THREE.MathUtils.clamp(noise(x * 0.03 + 9, z * 0.03, 3) * 0.8 + 0.4 - h * 0.01, 0, 1));
    gc.set([col.r, col.g, col.b], i * 3);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(gc, 3)); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; scene.add(ground);

  // Courtyard
  const tiles = tileTexture(); tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(4, 4);
  const court = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.6, 0.3, 64), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.7 }));
  court.position.set(0, 0.15, -4); court.receiveShadow = true; scene.add(court);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15.3, 0.25, 8, 80), std(0xcdbb95)); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.3, -4); scene.add(rim);

  // Oasis pond with reeds
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshPhysicalMaterial({ color: 0x2e8aa3, roughness: 0.05, transparent: true, opacity: 0.9, clearcoat: 1 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(22, 0.12, 6); pond.scale.set(1.4, 1, 1); scene.add(pond);
  const shore = new THREE.Mesh(new THREE.RingGeometry(7, 8.5, 48), std(0x9aa66a)); shore.rotation.x = -Math.PI / 2; shore.position.set(22, 0.1, 6); shore.scale.set(1.4, 1, 1); scene.add(shore);
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, r = 7 + rand() * 1.2;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1 + rand(), 4), std(0x5e7a36)); reed.position.set(22 + Math.cos(a) * r * 1.4, 0.5, 6 + Math.sin(a) * r); scene.add(reed);
  }

  const mq = mosque(); mq.position.set(0, 0.2, -38); scene.add(mq);
  // Base palms always present; the "palms" upgrade adds a grove.
  [[16, -6], [28, 12], [-18, -16]].forEach(([x, z]) => { const p = palm(rand, 7 + rand() * 2); p.position.set(x, 0, z); p.rotation.y = rand() * 6; scene.add(p); });
  const grove = new THREE.Group(); scene.add(grove);
  [[-14, 4], [-20, -4], [12, -16], [-10, -20], [30, -2], [18, 16], [-24, 10], [26, 20]].forEach(([x, z]) => { const p = palm(rand, 6 + rand() * 3); p.position.set(x, 0, z); p.rotation.y = rand() * 6; grove.add(p); });
  // rocks
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2, r = 20 + rand() * 40;
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rand() * 1.2, 0), std(0xa38660, { flatShading: true }));
    const x = Math.cos(a) * r, z = Math.sin(a) * r; rk.position.set(x, groundH(x, z), z); rk.rotation.set(rand(), rand(), rand()); rk.castShadow = true; scene.add(rk);
  }

  // Prayer spot: rug + character facing the mosque (−z).
  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 3.2), [0, 0, new THREE.MeshStandardMaterial({ map: rugTexture(palette.accent), roughness: 1 }), 0, 0, 0].map((m) => m || std(0x7a1f24)));
  rug.position.set(0, 0.32, -1); rug.rotation.y = Math.PI; rug.receiveShadow = true; scene.add(rug);
  const hero = buildWorshipper(palette);
  hero.root.position.set(0, 0.34, 0); hero.root.rotation.y = Math.PI; scene.add(hero.root);

  // Aura grows with the character's progress.
  const aura = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.9, 64), new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  aura.rotation.x = -Math.PI / 2; aura.position.set(0, 0.36, -0.3); scene.add(aura);
  const motes = (() => {
    const n = 80, p = new Float32Array(n * 3), s = Array.from({ length: n }, () => [rand() * 6.28, 0.8 + rand() * 1.6, rand()]);
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)),
      new THREE.PointsMaterial({ color: palette.glow, size: 0.08, transparent: true, opacity: 0.9, depthWrite: false }));
    pts.userData.tick = (t, count, burst) => {
      s.forEach(([a, r, o], i) => {
        const on = i < count;
        const k = (t * (burst ? 0.5 : 0.12) + o) % 1;
        p.set(on ? [Math.cos(a + t * 0.3) * r * (burst ? 1 + k : 1), 0.4 + k * (burst ? 5 : 3), -0.3 + Math.sin(a + t * 0.3) * r * (burst ? 1 + k : 1)] : [0, -99, 0], i * 3);
      });
      pts.geometry.attributes.position.needsUpdate = true;
    };
    scene.add(pts); return pts;
  })();

  // Upgrades
  const lanterns = new THREE.Group(); scene.add(lanterns);
  [[-3.5, 1.5], [3.5, 1.5], [-3.5, -4], [3.5, -4], [-8, -10], [8, -10]].forEach(([x, z]) => { const l = lantern(); l.position.set(x, 0.3, z); lanterns.add(l); });
  const fnt = fountain(); fnt.position.set(-8, 0.3, 2); scene.add(fnt);
  const arch = mihrabArch(); arch.position.set(0, 0.3, -4.2); scene.add(arch);

  const setFeatures = (f, lvl) => {
    lanterns.visible = f.has('lanterns');
    grove.visible = f.has('palms');
    fnt.visible = f.has('fountain');
    arch.visible = f.has('arch');
    moon.visible = f.has('stars');
    stars.userData.boost = f.has('stars') ? 1 : 0.45;
    aura.userData.level = lvl;
  };
  setFeatures(features, level);

  // Time of day from the local clock.
  const sunDir = new THREE.Vector3();
  let night = 0;
  const setTime = (date = new Date()) => {
    const h = date.getHours() + date.getMinutes() / 60;
    const elev = Math.sin(((h - 6) / 12) * Math.PI) * 62;   // degrees
    const az = 90 + ((h - 6) / 12) * 180;
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -12)), THREE.MathUtils.degToRad(az + 150));
    su.sunPosition.value.copy(sunDir);
    night = THREE.MathUtils.clamp((4 - elev) / 14, 0, 1);
    const lightDir = elev > 4 ? sunDir : new THREE.Vector3(-0.3, 0.8, -0.5).normalize();   // moonlight
    sun.position.copy(lightDir).multiplyScalar(80); sun.target.position.set(0, 0, 0);
    sun.color.set(night > 0.5 ? 0x9fb4e6 : elev < 15 ? 0xffb47a : 0xfff0d8);
    sun.intensity = lerp(2.6, 0.35, night);
    hemi.intensity = lerp(0.9, 0.18, night);
    hemi.color.set(night > 0.5 ? 0x3a4a78 : 0xcfe3ff);
    renderer.toneMappingExposure = lerp(0.5, 0.9, night);
    scene.fog.color.set(night > 0.5 ? 0x141c33 : elev < 15 ? 0xe6b48a : 0xe8d2b0);
    sky.visible = night < 0.95;
    scene.background = night >= 0.95 ? new THREE.Color(0x0b1026) : null;
    return { elev, night };
  };
  setTime();

  // Camera
  camera.position.set(9, 5, 12);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.6, -1);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 4; controls.maxDistance = 45;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
  controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; }, { once: true });

  // Tap the character.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    if (ray.intersectObject(hero.root, true).length) { if (!hero.busy()) hero.wave(); onCharacter?.(); }
  });

  const resize = () => { const w = container.clientWidth, h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  const clock = new THREE.Clock();
  let raf, burstUntil = 0, lastTime = 0;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastTime > 60) { setTime(); lastTime = t; }
    controls.update();
    hero.update(t, dt);
    fnt.userData.tick(t);
    const lvl = aura.userData.level || 0;
    aura.material.opacity = 0.12 + lvl * 0.03 + Math.sin(t * 2) * 0.05;
    aura.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04);
    const burst = t < burstUntil;
    motes.userData.tick(t, burst ? 80 : 10 + lvl * 6, burst);
    stars.material.opacity = night * (stars.userData.boost ?? 0.45);
    moon.material.opacity = Math.max(0.15, night);
    for (const l of lanterns.children) {
      const f = 0.85 + Math.sin(t * 9 + l.position.x) * 0.08 + Math.sin(t * 23 + l.position.z) * 0.05;
      l.userData.light.intensity = (2 + night * 10) * f;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    pray() { hero.pray(); burstUntil = clock.elapsedTime + 9; controls.autoRotate = false; },
    update({ features: f, level: l }) { setFeatures(f, l); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
