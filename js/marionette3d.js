// The marionette in the vault: a wooden controller of four crossed sticks (eight
// ends), a string from every end, and on every string a puppet of one of the eight
// dimension leaders. It hangs on a stand; the commander can take it and play them —
// the eight inner struggles are puppets in his hand.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { arm } from './heaven3d.js';
import { CHARACTERS, REGIONS } from './content.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const S = 0.42;                 // puppet scale (the commander is ×1)
const HEAD = 1.98 * 1.6 * S;    // feet → top of the head
const R = 0.95;                 // half length of a stick
const L = 2.25;                 // string length
const G = 16;                   // gravity
const HOOK = 3.75;                // hub height on the stand
const POSTS = 1.75;             // stand posts at ±POSTS
// Where the controller sits in the commander's hands (his local space, facing +z).
const HOLD = new THREE.Vector3(0, 3.55, 1.95);

export function buildMarionette(scene, { at, face = 0 }) {
  const wood = std(0x7a4e2a, { roughness: 0.55 });
  const dark = std(0x4a2e18, { roughness: 0.6 });
  const brass = std(0xd4a53a, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2604, emissiveIntensity: 0.3 });

  // ---- the stand: a round wooden dais, two posts and a crossbar with a hook ----
  const stand = new THREE.Group(); stand.position.copy(at); stand.rotation.y = face; scene.add(stand);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.14, 40), dark); dais.position.y = 0.07; stand.add(dais);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.95, 40), std(0x6a1418, { roughness: 0.9 })); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.145; stand.add(rug);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.7, 10), wood); post.position.set(sx * POSTS, 2.35, -0.6); stand.add(post);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), dark); foot.position.set(sx * POSTS, 0.23, -0.6); stand.add(foot);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), brass); knob.position.set(sx * POSTS, 4.78, -0.6); stand.add(knob);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, POSTS * 2 + 0.3, 10), wood); bar.rotation.z = Math.PI / 2; bar.position.set(0, 4.62, -0.6); stand.add(bar);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.75), wood); arm2.position.set(0, 4.62, -0.25); stand.add(arm2);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), std(0x777777, { metalness: 0.9, roughness: 0.3 })); chain.position.set(0, 4.3, 0); stand.add(chain);
  const hookAt = new THREE.Vector3(0, HOOK, 0); stand.localToWorld(hookAt);
  // A warm light on the little stage.
  const spot = new THREE.SpotLight(0xffd29a, 70, 16, 0.42, 0.7, 1.3); spot.position.set(at.x, 11, at.z + 3); spot.target.position.set(at.x, 1, at.z); scene.add(spot, spot.target);

  // ---- the controller: four sticks crossed every 45° ----
  const ctrl = new THREE.Group(); scene.add(ctrl);
  const ends = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4, y = k * 0.06;
    const s = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.055, 0.07), wood); s.position.y = y; s.rotation.y = -a; ctrl.add(s);
    for (const sgn of [1, -1]) {
      const p = new THREE.Vector3(Math.cos(a) * R * sgn, y - 0.05, Math.sin(a) * R * sgn);
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), brass); eye.position.copy(p); ctrl.add(eye);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brass); cap.position.set(p.x, y, p.z); ctrl.add(cap);
      ends.push(p);
    }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16), dark); hub.position.y = 0.1; ctrl.add(hub);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), brass); crown.position.y = 0.3; ctrl.add(crown);
  // A handle down to the commander's hands, with a grip bar.
  const hv = new THREE.Vector3(0, -1.0, -0.8);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, hv.length(), 8), wood);
  handle.position.copy(hv).multiplyScalar(0.5); handle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hv.clone().normalize()); ctrl.add(handle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), dark); grip.rotation.z = Math.PI / 2; grip.position.copy(hv); ctrl.add(grip);
  ctrl.traverse((m) => { if (m.isMesh) m.castShadow = true; });

  // ---- the eight leaders ----
  const chars = CHARACTERS.filter((c) => REGIONS.some((r) => r.characterId === c.id)).slice(0, 8);
  const puppets = chars.map((c, i) => {
    const hero = buildWorshipper(c.palette); arm(hero, c.palette, false);
    hero.root.scale.multiplyScalar(S); scene.add(hero.root);
    const pos = new THREE.Vector3(), prev = new THREE.Vector3();
    return { c, hero, pos, prev, end: ends[i], A: new THREE.Vector3(), yaw: face, taut: true, ph: i * 0.7, speed: 0 };
  });

  // Strings: one line per puppet, from a stick end to the top of the head.
  const sp = new Float32Array(puppets.length * 6);
  const strings = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.LineBasicMaterial({ color: 0xf3ead8, transparent: true, opacity: 0.85 }));
  strings.frustumCulled = false; scene.add(strings);

  // ---- state ----
  let holding = false, act = null;
  const base = new THREE.Vector3(), tgt = new THREE.Vector3(), q = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), tilt = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), headW = new THREE.Vector3();
  let settle = 1, spin = 0, lift = 0, tx = 0, tz = 0, cy = face;
  const floorAt = (p) => at.y + (Math.hypot(p.x - at.x, p.z - at.z) < 2.2 ? 0.14 : 0);

  // Place the controller on its hook and let the puppets hang still.
  const placeRest = () => {
    ctrl.position.copy(hookAt); cy = face; ctrl.rotation.set(0, face, 0); ctrl.updateMatrixWorld();
    for (const p of puppets) { p.A.copy(p.end); ctrl.localToWorld(p.A); p.pos.copy(p.A).y -= L; p.prev.copy(p.pos); }
  };
  placeRest();

  const play = (kind) => { if (holding && !act) { act = { kind, t: 0, dur: { dance: 4.2, spin: 2.4, lift: 2.6, bow: 3.4 }[kind] }; if (kind === 'bow') puppets.forEach((p, i) => setTimeout(() => p.hero.kneel(1.4), i * 60)); } };

  const tick = (t, dt, holder) => {
    // Where the controller wants to be: on the hook, or in the commander's hands.
    let wantYaw = face;
    if (holding && holder) {
      wantYaw = holder.rotation.y;
      tgt.copy(HOLD).applyAxisAngle(UP, wantYaw).add(holder.position);
    } else tgt.copy(hookAt);
    // Play actions.
    let bob = 0, dance = 0;
    tx *= 0.9; tz *= 0.9;
    if (act) {
      act.t += dt; const k = act.t / act.dur, env = Math.sin(Math.min(1, k) * Math.PI);
      if (act.kind === 'dance') { dance = env; bob = Math.abs(Math.sin(t * 7)) * 0.28 * env; tx = Math.sin(t * 4.2) * 0.32 * env; tz = Math.cos(t * 4.2) * 0.32 * env; }
      if (act.kind === 'spin') spin = (k < 1 ? (1 - Math.cos(Math.min(1, k) * Math.PI)) / 2 : 1) * Math.PI * 2;
      if (act.kind === 'lift') lift = env * 1.35;
      if (act.kind === 'bow') lift = -env * 0.8;
      if (k >= 1) { act = null; spin = 0; lift = 0; }
    }
    tgt.y += lift + bob;
    // Taking it from the hook (or hanging it back) glides; in his hands it follows him closely.
    settle = Math.min(1, settle + dt * 1.4);
    const kk = 1 - Math.exp(-dt * (holding ? 3 + settle * 13 : 4));
    ctrl.position.lerp(tgt, kk);
    cy += Math.atan2(Math.sin(wantYaw - cy), Math.cos(wantYaw - cy)) * kk;
    ctrl.rotation.set(tx, cy + spin, tz, 'YXZ');
    ctrl.updateMatrixWorld();

    // Puppets: each a pendulum on its string (Verlet), standing on the floor when slack.
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
    for (const p of puppets) p.A.copy(p.end).applyMatrix4(ctrl.matrixWorld);
    for (let s = 0; s < n; s++) {
      for (const p of puppets) {
        tmp.subVectors(p.pos, p.prev).multiplyScalar(1 - 2.6 * h);
        const vmax = 12 * h; if (tmp.lengthSq() > vmax * vmax) tmp.setLength(vmax);   // no wild swings
        p.prev.copy(p.pos); p.pos.add(tmp); p.pos.y -= G * h * h;
        tmp.subVectors(p.pos, p.A); const len = tmp.length();
        p.taut = len >= L - 0.03;
        if (len > L) p.pos.copy(p.A).addScaledVector(tmp, L / len);
        const fy = floorAt(p.pos) + HEAD;
        if (p.pos.y < fy) { p.pos.y = fy; p.prev.y = p.pos.y; p.prev.x += (p.pos.x - p.prev.x) * 0.3; p.prev.z += (p.pos.z - p.prev.z) * 0.3; }
      }
      // Keep them from passing through each other.
      for (let i = 0; i < puppets.length; i++) for (let j = i + 1; j < puppets.length; j++) {
        const a = puppets[i].pos, b = puppets[j].pos, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < 0.4 && d > 1e-4) { const push = (0.4 - d) / 2 / d; a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push; }
      }
    }
    puppets.forEach((p, i) => {
      p.speed = THREE.MathUtils.lerp(p.speed, p.pos.distanceTo(p.prev) / h, 0.2);
      // Face the commander while he plays them, the doorway while they hang on the stand.
      let want = face;
      if (holding && holder) want = Math.atan2(holder.position.x - p.pos.x, holder.position.z - p.pos.z);
      want += dance * Math.sin(t * 6 + p.ph) * 0.6;
      p.yaw += Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) * Math.min(1, dt * 5);
      yawQ.setFromAxisAngle(UP, p.yaw);
      tmp.subVectors(p.A, p.pos).normalize();
      tilt.setFromUnitVectors(UP, tmp); q.identity().slerp(tilt, p.taut ? 0.85 : 0);
      const root = p.hero.root;
      root.quaternion.multiplyQuaternions(q, yawQ);
      root.position.copy(p.pos).sub(tmp.set(0, HEAD, 0).applyQuaternion(q));
      const fl = floorAt(root.position); if (root.position.y < fl) root.position.y = fl;
      // Dangling limbs: they "walk" in the air as they swing; dancing flaps their arms.
      const air = dance > 0.2 ? (Math.floor(t * 4) + i) % 2 === 0 : p.taut && p.pos.y > at.y + HEAD + 0.6;
      p.hero.update(t, dt, Math.min(1, p.speed * 0.35 + dance * 0.8), air);
      p.hero.head.getWorldPosition(headW); headW.y += 0.12;
      sp.set([p.A.x, p.A.y, p.A.z, headW.x, headW.y, headW.z], i * 6);
    });
    strings.geometry.attributes.position.needsUpdate = true;
  };

  // Blocking in world coordinates: the posts always, the hanging puppets while on the stand.
  const local = new THREE.Vector3();
  const blocked = (x, z) => {
    local.set(x, 0, z); stand.worldToLocal(local);
    if (Math.abs(Math.abs(local.x) - POSTS) < 0.5 && Math.abs(local.z + 0.6) < 0.6) return true;
    return !holding && Math.hypot(local.x, local.z) < 1.6;
  };

  return {
    tick, blocked, play,
    get holding() { return holding; },
    get busy() { return !!act; },
    near: (p) => Math.hypot(p.x - at.x, p.z - at.z) < 3.6,
    grab() { holding = true; settle = 0; },
    drop() { holding = false; act = null; spin = lift = 0; settle = 0; },
    reset() { holding = false; act = null; spin = lift = 0; placeRest(); },
    count: puppets.length,
  };
}
