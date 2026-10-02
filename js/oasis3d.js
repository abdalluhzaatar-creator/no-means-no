// 3D scene for the Quiet Oasis: a prayer courtyard among dunes with a
// fully animated worshipper. Upgrades appear in the scene as they are bought,
// and the sky follows the real time of day.
import * as THREE from './vendor/three.module.min.js';
import { Sky } from './vendor/Sky.js';
import { sfx } from './audio.js';
import { buildRankStand } from './rankstand3d.js';

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
export function buildWorshipper(pal) {
  const robe = std(pal.robe, { roughness: 0.75 });
  const accent = std(pal.accent, { roughness: 0.6 });
  const skin = std(pal.skin, { roughness: 0.6 });
  const hair = std(0x2a1d14, { roughness: 1 });

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
  // Young man: short neat beard along the jaw, short dark hair, no head covering.
  // Beard: lower-front shell of the head (jaw and chin only).
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.163, 24, 14, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.6, Math.PI * 0.32), hair);
  beard.position.set(0, 0.16, 0.006); beard.scale.set(0.97, 1.1, 1.04); neck.add(beard);
  const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.168, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), hair);
  hairTop.position.set(0, 0.165, -0.008); hairTop.scale.set(0.97, 1.1, 1.02); neck.add(hairTop);
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.166, 20, 12, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.35, Math.PI * 0.3), hair);
  back.position.set(0, 0.165, 0); back.scale.set(0.97, 1.1, 1.02); neck.add(back);
  const brows = std(0x2b2018);
  [-0.055, 0.055].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), brows); b.position.set(x, 0.215, 0.148); neck.add(b); });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), std(0xa4645a)); mouth.position.set(0, 0.095, 0.152); neck.add(mouth);
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
  let phase = 0;
  const update = (t, dt, walk = 0, air = false) => {
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
      // idle / walk / jump
      phase += dt * (6 + walk * 5) * (walk > 0.05 ? 1 : 0);
      const target = air ? { ...P.stand, sx: -0.6, sz: 0.7, ex: -0.6, neck: -0.1 } : P.stand;
      const k = 1 - Math.exp(-dt * 12);
      for (const key in pose) pose[key] = lerp(pose[key], target[key], k);
      neck.rotation.y = walk > 0.05 ? 0 : Math.sin(t * 0.4) * 0.12;
    }
    apply(t);
    if (!seq && !air && walk > 0.05) {
      const sw = Math.sin(phase) * 0.55 * walk;
      armL.sh.rotation.x = sw; armR.sh.rotation.x = -sw;
      armL.el.rotation.x = armR.el.rotation.x = -0.25 * walk;
      lower.rotation.x = Math.sin(phase * 2) * 0.03 * walk;
      upper.rotation.z = Math.sin(phase) * 0.04 * walk;
      const bob = Math.abs(Math.sin(phase)) * 0.05 * walk;
      lower.position.y = bob; upper.position.y += bob;
    } else { lower.rotation.x = 0; upper.rotation.z = 0; lower.position.y = 0; }
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

// ---------- palace ----------
const archShape = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.lineTo(-w / 2, 0); return sh; };

// A straight arcade: wall with a row of pointed arches, columns and a roof ledge.
function arcade(length, mats) {
  const g = new THREE.Group();
  const bays = Math.round(length / 4), bw = length / bays, H = 6.5;
  const wall = new THREE.Shape(); wall.moveTo(-length / 2, 0); wall.lineTo(length / 2, 0); wall.lineTo(length / 2, H); wall.lineTo(-length / 2, H); wall.lineTo(-length / 2, 0);
  for (let i = 0; i < bays; i++) {
    const cx = -length / 2 + bw * (i + 0.5), w = bw * 0.62, h = 4.6;
    const hole = new THREE.Path(); hole.moveTo(cx - w / 2, 0.01); hole.lineTo(cx - w / 2, h - w / 2); hole.absarc(cx, h - w / 2, w / 2, Math.PI, 0, true); hole.lineTo(cx + w / 2, 0.01); hole.lineTo(cx - w / 2, 0.01);
    wall.holes.push(hole);
  }
  const face = new THREE.Mesh(new THREE.ExtrudeGeometry(wall, { depth: 0.8, bevelEnabled: false, curveSegments: 10 }), mats.stone);
  g.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(length, H, 0.4), mats.plaster); back.position.set(0, H / 2, -3.2); g.add(back);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 0.6, 0.5, 4.6), mats.stone); roof.position.set(0, H + 0.25, -1.4); g.add(roof);
  const band = new THREE.Mesh(new THREE.BoxGeometry(length + 0.7, 0.35, 0.1), mats.tile); band.position.set(0, H - 0.6, 0.85); g.add(band);
  for (let i = 0; i <= bays; i++) {
    const x = -length / 2 + bw * i;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.2, 14), mats.marble); col.position.set(x, 2.1, 0.95); g.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), mats.gold); cap.position.set(x, 4.3, 0.95); g.add(cap);
  }
  // crenellations
  for (let x = -length / 2 + 0.5; x < length / 2; x += 1.4) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), mats.stone); m.position.set(x, H + 0.9, 0.3); m.rotation.y = Math.PI / 4; g.add(m); }
  shadowAll(g);
  return g;
}

function palaceHall(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 11, 12), mats.plaster); body.position.y = 5.5; g.add(body);
  const iwan = new THREE.Mesh(new THREE.BoxGeometry(11, 15, 2), mats.stone); iwan.position.set(0, 7.5, 6.2); g.add(iwan);
  const portal = new THREE.Mesh(new THREE.ShapeGeometry(archShape(6.5, 11.5), 16), mats.tile); portal.position.set(0, 0.01, 7.22); g.add(portal);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(3, 5.5), 16), mats.wood); door.position.set(0, 0.01, 7.25); g.add(door);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.18, 8, 40, Math.PI), mats.gold); trim.position.set(0, 8.25, 7.24); g.add(trim);
  for (const x of [-9.5, -6, 6, 9.5]) for (const y of [2.6, 7.4]) { const w = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.6, 3), 12), mats.dark); w.position.set(x, y, 6.02); g.add(w); }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2.4, 40), mats.plaster); drum.position.set(0, 12.2, -1); g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome); dome.position.set(0, 13.4, -1); dome.scale.y = 1.25; g.add(dome);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 10), mats.gold); fin.position.set(0, 21, -1); g.add(fin);
  for (const x of [-13, 13]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 20, 16), mats.stone); t.position.set(x, 10, 0); g.add(t);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.8, 0.8, 16), mats.stone); b.position.set(x, 16, 0); g.add(b);
    const d = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome); d.position.set(x, 20, 0); d.scale.y = 1.4; g.add(d);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 8), mats.gold); f.position.set(x, 22.8, 0); g.add(f);
  }
  for (const x of [-7, 7]) { const d = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome); d.position.set(x, 11, -2); g.add(d); }
  shadowAll(g);
  return g;
}

function cypress(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), std(0x5b4330)); trunk.position.y = 0.6; g.add(trunk);
  const h = 5 + rand() * 2.5;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), std(0x2f5a2e, { roughness: 0.9 })); crown.scale.set(1, h / 1.8, 1); crown.position.y = 1 + h / 2; g.add(crown);
  shadowAll(g);
  return g;
}

function orangeTree(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.8, 7), std(0x5b4330)); trunk.position.y = 0.9; g.add(trunk);
  const leaf = std(0x3e7a33, { roughness: 0.85 });
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + rand() * 0.3, 1), leaf); b.position.set((rand() - 0.5) * 1.1, 2.3 + rand() * 0.7, (rand() - 0.5) * 1.1); g.add(b); }
  const fruit = std(0xf29a2e, { roughness: 0.5 });
  for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), fruit); const a = rand() * 6.28; f.position.set(Math.cos(a) * 0.95, 2.1 + rand() * 1.1, Math.sin(a) * 0.95); g.add(f); }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 0.8, 12), std(0xb8683f)); pot.position.y = 0.4; g.add(pot);
  shadowAll(g);
  return g;
}

function flowerBed(w, d, rand) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), std(0xd9ccb0)); box.position.y = 0.25; g.add(box);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3), std(0x4b8a3a, { roughness: 1 })); soil.position.y = 0.52; g.add(soil);
  const cols = [0xe0475b, 0xf5d03b, 0xffffff, 0xb05cd6, 0xf28ab2];
  const geo = new THREE.SphereGeometry(0.1, 6, 4);
  for (let i = 0; i < w * d * 5; i++) { const f = new THREE.Mesh(geo, std(cols[i % cols.length])); f.position.set((rand() - 0.5) * (w - 0.5), 0.65 + rand() * 0.2, (rand() - 0.5) * (d - 0.5)); g.add(f); }
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

// ---------- weather ----------
// kinds: clear | cloudy | overcast | fog | rain | storm | snow
export function weatherFromCode(code) {
  if (code == null) return 'clear';
  if (code <= 1) return 'clear';
  if (code === 2) return 'cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}
const WEATHER = {
  clear:    { cloud: 0.1,  dim: 0,    fog: 0,    rain: 0, snow: 0, turb: 3 },
  cloudy:   { cloud: 0.55, dim: 0.15, fog: 0.1,  rain: 0, snow: 0, turb: 6 },
  overcast: { cloud: 1,    dim: 0.45, fog: 0.3,  rain: 0, snow: 0, turb: 14 },
  fog:      { cloud: 0.6,  dim: 0.4,  fog: 1,    rain: 0, snow: 0, turb: 18 },
  rain:     { cloud: 1,    dim: 0.55, fog: 0.4,  rain: 1, snow: 0, turb: 16 },
  storm:    { cloud: 1,    dim: 0.7,  fog: 0.5,  rain: 1.4, snow: 0, turb: 20 },
  snow:     { cloud: 1,    dim: 0.35, fog: 0.45, rain: 0, snow: 1, turb: 12 },
};

// ---------- mount ----------
// opts.sky() → { elev } sun elevation in degrees, recomputed every minute.
export function mountOasis(container, { palette, features, level, rank, onCharacter, onRanks, sky: skyInfo, weather = 'clear' }) {
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);

  const sky = new Sky(); sky.scale.setScalar(2000); scene.add(sky);
  const su = sky.material.uniforms; su.rayleigh.value = 2; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x8a7a60, 1);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);   // soft front light so the character never reads as a silhouette
  scene.add(sun, sun.target, hemi, fill, fill.target);
  scene.fog = new THREE.Fog(0xdfe6ea, 80, 320);

  const rng = rand;
  const starGeo = new THREE.BufferGeometry(); const sp = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().setFromSphericalCoords(900, Math.acos(rng() * 0.95), rng() * Math.PI * 2); sp.set([v.x, v.y, v.z], i * 3); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.TorusGeometry(18, 5, 12, 40, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false, transparent: true }));
  moon.position.set(-250, 330, 700); moon.rotation.z = 2.2; scene.add(moon);

  // ---- materials ----
  const marbleTex = canvasTex(512, 512, (g, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#e3ddd0'; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(150,140,125,.25)'; g.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(i * s + Math.random() * s, j * s); g.bezierCurveTo(i * s + Math.random() * s, j * s + s / 3, i * s + Math.random() * s, j * s + s / 1.5, i * s + Math.random() * s, j * s + s); g.stroke(); }
      g.fillStyle = '#3f7d6e'; g.save(); g.translate(i * s, j * s); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore();
    }
  });
  marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping; marbleTex.repeat.set(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.05 });
  const mats = {
    stone: std(0xeadfc8, { roughness: 0.75 }), plaster: std(0xf3ece0, { roughness: 0.85 }), marble: std(0xfbf8f2, { roughness: 0.3 }),
    gold: std(0xd4a53a, { roughness: 0.25, metalness: 0.9 }), tile: std(0x2f7a8a, { roughness: 0.35 }), dome: std(0x2f7a8a, { roughness: 0.3, metalness: 0.25 }),
    wood: std(0x5a3a22, { roughness: 0.7 }), dark: std(0x2d2a28, { roughness: 0.6 }),
  };

  // ---- ground: marble courtyard inside, gardens and hills outside ----
  const grass = new THREE.Mesh(new THREE.CircleGeometry(700, 64), std(0x6d9a4a, { roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, r = 180 + rng() * 120;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(60 + rng() * 60, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x7fa35a, { roughness: 1 }));
    hill.position.set(Math.cos(a) * r, -10, Math.sin(a) * r); hill.scale.y = 0.35 + rng() * 0.3; scene.add(hill);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(46, 0.4, 46), floorMat); floor.position.y = 0.2; floor.receiveShadow = true; scene.add(floor);
  const snowCover = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false }));
  snowCover.rotation.x = -Math.PI / 2; snowCover.position.y = 0.42; snowCover.receiveShadow = true; snowCover.renderOrder = 1; scene.add(snowCover);

  // Arcades on three sides, palace hall on the fourth (behind the player's back).
  const sides = [[0, -23, 0], [-23, 0, Math.PI / 2], [23, 0, -Math.PI / 2]];
  for (const [x, z, ry] of sides) { const a = arcade(46, mats); a.position.set(x, 0.4, z); a.rotation.y = ry; scene.add(a); }
  const hall = palaceHall(mats); hall.position.set(0, 0.4, 30); hall.rotation.y = Math.PI; scene.add(hall);
  for (const x of [-23, 23]) for (const z of [-23, 23]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, 11, 12), mats.stone); t.position.set(x, 5.9, z);
    const d = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome); d.position.set(x, 11.4, z); d.scale.y = 1.3;
    shadowAll(t); shadowAll(d); scene.add(t, d);
  }

  // Reflecting pool from the hall toward the prayer spot.
  const poolRim = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 14.4), mats.marble); poolRim.position.set(0, 0.45, 13.5); scene.add(poolRim);
  const water = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 13.6), new THREE.MeshPhysicalMaterial({ color: 0x2c8aa6, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.9 }));
  water.position.set(0, 0.68, 13.5); scene.add(water);
  // Gardens around the pool
  [[-8, 12, 6, 4], [8, 12, 6, 4], [-8, -14, 7, 3], [8, -14, 7, 3]].forEach(([x, z, w, d]) => { const f = flowerBed(w, d, rng); f.position.set(x, 0.4, z); scene.add(f); });
  [[-19, -19], [19, -19], [-19, 19], [19, 19], [-19, 0], [19, 0]].forEach(([x, z]) => { const c = cypress(rng); c.position.set(x, 0.4, z); scene.add(c); });
  // Outside the walls: tall cypress rows and trees.
  for (let i = 0; i < 60; i++) { const a = rng() * Math.PI * 2, r = 32 + rng() * 60; const c = cypress(rng); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.scale.setScalar(1.4 + rng()); scene.add(c); }

  // Prayer spot: rug + character facing the mihrab (−z).
  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 3.2), [0, 0, new THREE.MeshStandardMaterial({ map: rugTexture(palette.accent), roughness: 1 }), 0, 0, 0].map((m) => m || std(0x7a1f24)));
  rug.position.set(0, 0.42, -1); rug.rotation.y = Math.PI; rug.receiveShadow = true; scene.add(rug);
  const hero = buildWorshipper(palette);
  hero.root.position.set(0, 0.44, 0); hero.root.rotation.y = Math.PI; scene.add(hero.root);

  const aura = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.9, 64), new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  aura.rotation.x = -Math.PI / 2; aura.position.set(0, 0.46, -0.3); scene.add(aura);
  const motes = (() => {
    const n = 80, p = new Float32Array(n * 3), s = Array.from({ length: n }, () => [rng() * 6.28, 0.8 + rng() * 1.6, rng()]);
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)),
      new THREE.PointsMaterial({ color: palette.glow, size: 0.08, transparent: true, opacity: 0.9, depthWrite: false }));
    pts.userData.tick = (t, count, burst) => {
      s.forEach(([a, r, o], i) => {
        const k = (t * (burst ? 0.5 : 0.12) + o) % 1, f = burst ? 1 + k : 1;
        p.set(i < count ? [Math.cos(a + t * 0.3) * r * f, 0.5 + k * (burst ? 5 : 3), -0.3 + Math.sin(a + t * 0.3) * r * f] : [0, -99, 0], i * 3);
      });
      pts.geometry.attributes.position.needsUpdate = true;
    };
    scene.add(pts); return pts;
  })();

  // Upgrades
  const lanterns = new THREE.Group(); scene.add(lanterns);
  [[-3.5, 1.5], [3.5, 1.5], [-3.5, -4], [3.5, -4], [-10, 6], [10, 6], [-10, -8], [10, -8]].forEach(([x, z]) => { const l = lantern(); l.position.set(x, 0.4, z); lanterns.add(l); });
  const grove = new THREE.Group(); scene.add(grove);
  [[-14, 6], [14, 6], [-14, -6], [14, -6], [-6, 20], [6, 20], [-14, 18], [14, 18]].forEach(([x, z]) => { const t = orangeTree(rng); t.position.set(x, 0.4, z); grove.add(t); });
  const fnt = fountain(); fnt.position.set(0, 0.4, 5); fnt.scale.setScalar(1.2); scene.add(fnt);
  const arch = mihrabArch(); arch.position.set(0, 0.4, -4.2); scene.add(arch);

  // The rank tree, beside the prayer rug.
  const STAND = { x: -7, z: 2.5 };
  const stand = rank ? buildRankStand(rank) : null;
  if (stand) { stand.root.position.set(STAND.x, 0.4, STAND.z); stand.root.rotation.y = Math.atan2(-STAND.x, -STAND.z); stand.root.scale.setScalar(1.25); scene.add(stand.root); }

  const setFeatures = (f, lvl) => {
    lanterns.visible = f.has('lanterns');
    grove.visible = f.has('palms');
    fnt.visible = f.has('fountain');
    arch.visible = f.has('arch');
    moon.visible = f.has('stars');
    stars.userData.boost = f.has('stars') ? 1 : 0.5;
    aura.userData.level = lvl;
  };
  setFeatures(features, level);

  // ---- clouds ----
  const puffTex = canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  });
  const cloudMat = new THREE.SpriteMaterial({ map: puffTex, color: 0xffffff, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 70; i++) {
    const cx = (rng() - 0.5) * 700, cz = (rng() - 0.5) * 700, cy = 90 + rng() * 60;
    for (let j = 0; j < 6; j++) {
      const s = new THREE.Sprite(cloudMat); const r = 40 + rng() * 50;
      s.position.set(cx + (rng() - 0.5) * 80, cy + (rng() - 0.5) * 12, cz + (rng() - 0.5) * 50); s.scale.set(r * 1.8, r, 1);
      s.userData.rank = rng(); clouds.add(s);
    }
  }

  // ---- precipitation (particles follow the camera) ----
  const RAIN_N = 2500, rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const x = (rng() - 0.5) * 80, y = rng() * 40, z = (rng() - 0.5) * 80; rainPos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
  const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPos, 3)),
    new THREE.LineBasicMaterial({ color: 0xaec4d6, transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false; scene.add(rain);
  const SNOW_N = 2500, snowPos = new Float32Array(SNOW_N * 3), snowSeed = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) { snowPos.set([(rng() - 0.5) * 80, rng() * 40, (rng() - 0.5) * 80], i * 3); snowSeed[i] = rng() * 6.28; }
  const flakeTex = canvasTex(32, 32, (g) => { const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snowPos, 3)),
    new THREE.PointsMaterial({ map: flakeTex, color: 0xffffff, size: 0.38, transparent: true, depthWrite: false, opacity: 0.95 }));
  snow.frustumCulled = false; scene.add(snow);
  const flash = new THREE.AmbientLight(0xdfe8ff, 0); scene.add(flash);

  // ---- time of day + weather ----
  let W = WEATHER[weather] || WEATHER.clear, kind = weather in WEATHER ? weather : 'clear';
  let night = 0, snowAcc = 0;
  const sunDir = new THREE.Vector3();
  const skyTop = new THREE.Color(), tmp = new THREE.Color();
  const applySky = () => {
    const { elev } = skyInfo();
    const az = 110 + (elev > 0 ? 0 : 0);
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -14)), THREE.MathUtils.degToRad(az + (skyInfo().pm ? 120 : -60)));
    su.sunPosition.value.copy(sunDir);
    su.turbidity.value = W.turb;
    su.rayleigh.value = lerp(2, 0.6, W.dim);
    night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    const golden = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 12, 0, 1) * (1 - night);
    const lightDir = elev > 3 ? sunDir : new THREE.Vector3(-0.3, 0.8, 0.5).normalize();
    sun.position.copy(lightDir).multiplyScalar(90);
    sun.color.set(night > 0.5 ? 0x9fb4e6 : 0xfff0d8).lerp(tmp.set(0xff9c5a), golden * 0.8);
    sun.intensity = lerp(2.8, 0.35, night) * (1 - W.dim * 0.8);
    hemi.intensity = lerp(1.1, 0.25, night) * (1 - W.dim * 0.3);
    hemi.color.set(night > 0.5 ? 0x4a5a88 : 0xdfeaff);
    fill.intensity = lerp(0.7, 0.25, night);
    renderer.toneMappingExposure = lerp(0.55, 1, night) + W.dim * 0.15;
    // Weather greys the sky; night makes it deep blue.
    skyTop.set(0xb9c2c9).lerp(tmp.set(0x10172c), night);
    sky.visible = W.dim < 0.4 && night < 0.95;
    scene.background = sky.visible ? null : skyTop.clone();
    const fogCol = tmp.set(0xdfe6ea).lerp(new THREE.Color(0xe8b48c), golden * (1 - W.dim)).lerp(new THREE.Color(0x0e1426), night).lerp(new THREE.Color(0xaab4bc).multiplyScalar(1 - night * 0.8), W.dim);
    scene.fog.color.copy(fogCol);
    scene.fog.near = lerp(80, 4, W.fog); scene.fog.far = lerp(320, 60, W.fog);
    // clouds: amount by weather, tint by time
    const cloudTint = new THREE.Color(0xffffff).lerp(new THREE.Color(0x6f7880), W.dim).lerp(new THREE.Color(0xffb88a), golden * 0.6).lerp(new THREE.Color(0x2a3350), night);
    cloudMat.color.copy(cloudTint);
    for (const c of clouds.children) c.visible = c.userData.rank < W.cloud;
    rain.visible = W.rain > 0; snow.visible = W.snow > 0;
    rain.material.opacity = 0.35 + W.rain * 0.25;
    floorMat.roughness = W.rain ? 0.08 : 0.35;   // wet marble
    floorMat.color.set(W.rain ? 0xbfc4c6 : 0xffffff);
  };
  applySky();

  // Camera: front three-quarter view, the palace hall behind the character.
  // Third-person camera: sits behind the character's shoulders and follows him.
  // Drag to look around, wheel / pinch to zoom; while walking it swings back behind him.
  const cam = { yaw: Math.PI * 0.82, pitch: 0.3, dist: 10, tYaw: Math.PI * 0.82, tPitch: 0.3, tDist: 10, idle: 0 };
  const focus = new THREE.Vector3(0, 2.6, 0), camGoal = new THREE.Vector3();
  const el = renderer.domElement;
  const drags = new Map(); let pinch0 = 0;
  el.addEventListener('pointerdown', (e) => { drags.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    const prev = drags.get(e.pointerId); if (!prev) return;
    if (drags.size === 1) {
      cam.tYaw -= (e.clientX - prev[0]) * 0.006;
      cam.tPitch = THREE.MathUtils.clamp(cam.tPitch + (e.clientY - prev[1]) * 0.004, -0.05, 1.2);
      cam.idle = 0;
    }
    drags.set(e.pointerId, [e.clientX, e.clientY]);
    if (drags.size === 2) {
      const [p1, p2] = [...drags.values()], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      if (pinch0) cam.tDist = THREE.MathUtils.clamp(cam.tDist * (pinch0 / d), 3.5, 20);
      pinch0 = d;
    }
  });
  const dragEnd = (e) => { drags.delete(e.pointerId); if (drags.size < 2) pinch0 = 0; };
  el.addEventListener('pointerup', dragEnd); el.addEventListener('pointercancel', dragEnd);
  el.addEventListener('wheel', (e) => { e.preventDefault(); cam.tDist = THREE.MathUtils.clamp(cam.tDist * (1 + Math.sign(e.deltaY) * 0.12), 3.5, 20); }, { passive: false });
  const updateCamera = (dt, walking) => {
    // Swing gently behind the character while he walks (not while the player is dragging).
    cam.idle += dt;
    if (walking && drags.size === 0) {
      const behind = facing + Math.PI;
      let d = behind - cam.tYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.tYaw += d * Math.min(1, dt * 1.8);
    }
    const k = 1 - Math.exp(-dt * 8);
    let dy = cam.tYaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * k; cam.pitch += (cam.tPitch - cam.pitch) * k; cam.dist += (cam.tDist - cam.dist) * k;
    const p = hero.root.position;
    focus.lerp(new THREE.Vector3(p.x, p.y + 2.1, p.z), 1 - Math.exp(-dt * 10));
    // Pull the camera in so it never goes through the courtyard walls.
    let dist = cam.dist;
    for (let i = 0; i < 8; i++) {
      const x = focus.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist, z = focus.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist;
      if (Math.abs(x) < 21.5 && Math.abs(z) < 21.5) break;
      dist *= 0.85;
    }
    camGoal.set(
      focus.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dist,
      Math.max(0.9, focus.y + Math.sin(cam.pitch) * dist),
      focus.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dist,
    );
    camera.position.copy(camGoal);
    camera.lookAt(focus);
  };

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
  if (camera.aspect < 0.8) { cam.dist = cam.tDist = 15; cam.pitch = cam.tPitch = 0.34; }   // phones: pull back to fit him in the tall frame

  // ---------- player movement ----------
  // Keyboard (WASD / arrows, Space to jump) and on-screen joystick + jump button.
  const RUG = new THREE.Vector3(0, 0.44, 0);
  const keys = new Set();
  const joy = new THREE.Vector2();
  let vy = 0, grounded = true, walkAmt = 0, facing = Math.PI, stepT = 0;
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select')) return;
    const k = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: ' ' }[e.code] || e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown') { keys.add(k); if (k === ' ') jump(); } else keys.delete(k);
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  const jump = () => { if (grounded && !hero.busy()) { vy = 7.5; grounded = false; sfx.jump(); } };
  const blocked = (x, z) => {
    if (stand && Math.hypot(x - STAND.x, z - STAND.z) < 2.6) return true;               // rank tree
    if (Math.abs(x) > 20.3 || Math.abs(z) > 20.3) return true;
    if (Math.abs(x) < 2.6 && z > 6 && z < 21) return true;                           // reflecting pool
    if (fnt.visible && Math.hypot(x, z - 5) < 2.6) return true;                        // fountain
    for (const [bx, bz, w, d] of [[-8, 12, 6, 4], [8, 12, 6, 4], [-8, -14, 7, 3], [8, -14, 7, 3]])
      if (Math.abs(x - bx) < w / 2 + 0.5 && Math.abs(z - bz) < d / 2 + 0.5) return true; // flower beds
    return false;
  };
  const pad = document.createElement('div'); pad.className = 'move-pad';
  pad.innerHTML = '<div class="joy"><div class="joy-knob"></div></div><button class="jump-btn" aria-label="نط">⤒</button>';
  container.appendChild(pad);
  const joyEl = pad.querySelector('.joy'), knob = pad.querySelector('.joy-knob');
  let joyId = null;
  const joyMove = (e) => {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let x = e.clientX - (r.left + R), y = e.clientY - (r.top + R);
    const l = Math.hypot(x, y); if (l > R) { x *= R / l; y *= R / l; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    joy.set(x / R, y / R);
  };
  joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
  joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = () => { joyId = null; joy.set(0, 0); knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  pad.querySelector('.jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), prevPos = new THREE.Vector3();
  const stepPlayer = (dt) => {
    const p = hero.root.position;
    prevPos.copy(p);
    let ix = joy.x, iy = joy.y;
    if (keys.has('w') || keys.has('arrowup')) iy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iy += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    if (!hero.busy() && mag > 0.08) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      move.copy(fwd).multiplyScalar(-iy).addScaledVector(right, ix).normalize().multiplyScalar(mag * 5.5 * dt);
      if (!blocked(p.x + move.x, p.z)) p.x += move.x;
      if (!blocked(p.x, p.z + move.z)) p.z += move.z;
      const want = Math.atan2(move.x, move.z);
      let d = want - facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      facing += d * Math.min(1, dt * 12);
    }
    walkAmt = lerp(walkAmt, hero.busy() ? 0 : mag, Math.min(1, dt * 10));
    if (grounded && walkAmt > 0.3) { stepT -= dt * (1 + walkAmt); if (stepT <= 0) { sfx.step(); stepT = 0.42; } }
    if (!grounded) {
      vy -= 22 * dt; p.y += vy * dt;
      if (p.y <= 0.44) { p.y = 0.44; vy = 0; grounded = true; sfx.land(); }
    }
    hero.root.rotation.y = facing;
    aura.position.set(p.x, 0.46, p.z - 0.3 * Math.cos(facing));
  };

  const clock = new THREE.Clock();
  let raf, burstUntil = 0, lastSky = 0, nextBolt = 4;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (t - lastSky > 30) { applySky(); lastSky = t; }
    fill.position.copy(camera.position).add(new THREE.Vector3(0, 6, 0));
    stepPlayer(dt);
    updateCamera(dt, walkAmt > 0.2);
    hero.update(t, dt, walkAmt, !grounded);
    stand?.tick(t);
    fnt.userData.tick(t);
    const lvl = aura.userData.level || 0;
    aura.material.opacity = 0.12 + lvl * 0.03 + Math.sin(t * 2) * 0.05;
    aura.scale.setScalar(1 + Math.sin(t * 1.3) * 0.04);
    const burst = t < burstUntil;
    motes.userData.tick(t, burst ? 80 : 10 + lvl * 6, burst);
    stars.material.opacity = night * (stars.userData.boost ?? 0.5) * (1 - W.cloud * 0.9);
    moon.material.opacity = Math.max(0.15, night) * (1 - W.dim * 0.8);
    for (const c of clouds.children) { c.position.x += dt * 3; if (c.position.x > 380) c.position.x -= 760; }
    for (const l of lanterns.children) {
      const f = 0.85 + Math.sin(t * 9 + l.position.x) * 0.08 + Math.sin(t * 23 + l.position.z) * 0.05;
      l.userData.light.intensity = (2 + (night + W.dim * 0.5) * 10) * f;
    }
    const cx = camera.position.x, cz = camera.position.z;
    if (rain.visible) {
      const speed = 38 * dt, wind = W.rain > 1 ? 0.25 : 0.05;
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6; let y = rainPos[o + 1] - speed;
        if (y < 0) { y = 40; rainPos[o] = cx + (Math.random() - 0.5) * 80; rainPos[o + 2] = cz + (Math.random() - 0.5) * 80; }
        rainPos[o + 1] = y; rainPos[o + 3] = rainPos[o] + wind; rainPos[o + 4] = y - 0.7; rainPos[o + 5] = rainPos[o + 2];
        rainPos[o] += wind * speed * 0.05;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      for (let i = 0; i < SNOW_N; i++) {
        const o = i * 3; let y = snowPos[o + 1] - dt * 1.6;
        if (y < 0.4) { y = 40; snowPos[o] = cx + (Math.random() - 0.5) * 80; snowPos[o + 2] = cz + (Math.random() - 0.5) * 80; }
        snowPos[o + 1] = y; snowPos[o] += Math.sin(t + snowSeed[i]) * dt * 0.6;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    // Snow settles over time; melts when the weather changes.
    snowAcc = THREE.MathUtils.clamp(snowAcc + (W.snow ? dt * 0.04 : -dt * 0.05), 0, 0.85);
    snowCover.material.opacity = snowAcc;
    if (kind === 'storm' && t > nextBolt) { flash.intensity = 6; setTimeout(sfx.thunder, 600 + Math.random() * 1500); nextBolt = t + 4 + Math.random() * 8; }
    flash.intensity *= 0.86;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  if (kind === 'snow') snowAcc = 0.6;
  tick();

  return {
    pray() {
      // Step back onto the rug and face the mihrab before praying.
      hero.root.position.copy(RUG); vy = 0; grounded = true; facing = Math.PI; hero.root.rotation.y = facing;
      cam.tYaw = Math.PI * 0.75; cam.tPitch = 0.3; cam.tDist = 7;   // side-front view to watch the prayer
      hero.pray(); burstUntil = clock.elapsedTime + 9;
    },
    update({ features: f, level: l, rank: r }) { setFeatures(f, l); if (r) stand?.update(r); },
    setWeather(k) { kind = k in WEATHER ? k : 'clear'; W = WEATHER[kind]; applySky(); },
    refreshSky() { applySky(); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
      scene.traverse((o) => { o.geometry?.dispose(); });
      renderer.dispose(); renderer.forceContextLoss?.();
      container.innerHTML = '';
    },
  };
}
