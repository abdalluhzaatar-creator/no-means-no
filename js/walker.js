// Third-person walking for any 3D room: keyboard (WASD/arrows, Space), on-screen
// joystick + jump button, follow camera (drag to look, wheel/pinch to zoom),
// and simple collisions via a `blocked(x, z)` callback.
import * as THREE from './vendor/three.module.min.js';
import { sfx } from './audio.js';

export function createWalker({ hero, camera, dom, container, ground = 0, blocked = () => false, dist = 9, height = 2.4 }) {
  const keys = new Set(), joy = new THREE.Vector2();
  let vy = 0, grounded = true, walkAmt = 0, facing = hero.root.rotation.y, stepT = 0, enabled = true;
  let floor = ground;
  const cam = { yaw: facing + Math.PI, pitch: 0.3, dist, tYaw: facing + Math.PI, tPitch: 0.3, tDist: dist };
  const focus = new THREE.Vector3().copy(hero.root.position).setY(hero.root.position.y + height);

  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select') || !enabled) return;
    // Physical key position, so WASD works on any keyboard layout (e.g. Arabic).
    const k = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', Space: ' ' }[e.code] || e.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown') { keys.add(k); if (k === ' ') jump(); } else keys.delete(k);
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  const jump = () => { if (grounded && enabled && !hero.busy?.()) { vy = 7.5; grounded = false; sfx.jump(); } };

  const pad = document.createElement('div'); pad.className = 'move-pad';
  pad.innerHTML = '<div class="joy"><div class="joy-knob"></div></div><button class="jump-btn" aria-label="نط">⤒</button>';
  container.appendChild(pad);
  const joyEl = pad.querySelector('.joy'), knob = pad.querySelector('.joy-knob');
  let joyId = null;
  const joyMove = (e) => {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let x = e.clientX - (r.left + R), y = e.clientY - (r.top + R);
    const l = Math.hypot(x, y); if (l > R) { x *= R / l; y *= R / l; }
    knob.style.transform = `translate(${x}px, ${y}px)`; joy.set(x / R, y / R);
  };
  joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
  joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = () => { joyId = null; joy.set(0, 0); knob.style.transform = ''; };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  pad.querySelector('.jump-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  // camera drag / zoom
  const drags = new Map(); let pinch0 = 0;
  dom.addEventListener('pointerdown', (e) => { drags.set(e.pointerId, [e.clientX, e.clientY]); dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', (e) => {
    const prev = drags.get(e.pointerId); if (!prev) return;
    if (drags.size === 1) { cam.tYaw -= (e.clientX - prev[0]) * 0.006; cam.tPitch = THREE.MathUtils.clamp(cam.tPitch + (e.clientY - prev[1]) * 0.004, -0.05, 1.2); }
    drags.set(e.pointerId, [e.clientX, e.clientY]);
    if (drags.size === 2) { const [a, b] = [...drags.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) cam.tDist = THREE.MathUtils.clamp(cam.tDist * (pinch0 / d), 3.5, 20); pinch0 = d; }
  });
  const dragEnd = (e) => { drags.delete(e.pointerId); if (drags.size < 2) pinch0 = 0; };
  dom.addEventListener('pointerup', dragEnd); dom.addEventListener('pointercancel', dragEnd);
  const onWheel = (e) => { e.preventDefault(); cam.tDist = THREE.MathUtils.clamp(cam.tDist * (1 + Math.sign(e.deltaY) * 0.12), 3.5, 20); };
  dom.addEventListener('wheel', onWheel, { passive: false });

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
  let clampCam = null;
  function update(dt) {
    const p = hero.root.position;
    let ix = joy.x, iy = joy.y;
    if (keys.has('w') || keys.has('arrowup')) iy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iy += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    const mag = enabled ? Math.min(1, Math.hypot(ix, iy)) : 0;
    if (mag > 0.08 && !hero.busy?.()) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      move.copy(fwd).multiplyScalar(-iy).addScaledVector(right, ix).normalize().multiplyScalar(mag * 6 * dt);
      if (!blocked(p.x + move.x, p.z)) p.x += move.x;
      if (!blocked(p.x, p.z + move.z)) p.z += move.z;
      let d = Math.atan2(move.x, move.z) - facing; d = Math.atan2(Math.sin(d), Math.cos(d));
      facing += d * Math.min(1, dt * 12);
    }
    walkAmt = THREE.MathUtils.lerp(walkAmt, mag, Math.min(1, dt * 10));
    if (grounded && walkAmt > 0.3) { stepT -= dt * (1 + walkAmt); if (stepT <= 0) { sfx.step(); stepT = 0.42; } }
    if (!grounded) { vy -= 22 * dt; p.y += vy * dt; if (p.y <= floor) { p.y = floor; vy = 0; grounded = true; sfx.land(); } }
    hero.root.rotation.y = facing;
    // camera swings behind while walking
    if (walkAmt > 0.2 && drags.size === 0) { let d = facing + Math.PI - cam.tYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.tYaw += d * Math.min(1, dt * 1.8); }
    const k = 1 - Math.exp(-dt * 8);
    let dy = cam.tYaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * k; cam.pitch += (cam.tPitch - cam.pitch) * k; cam.dist += (cam.tDist - cam.dist) * k;
    focus.lerp(new THREE.Vector3(p.x, p.y + height, p.z), 1 - Math.exp(-dt * 10));
    camera.position.set(focus.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, focus.y + Math.sin(cam.pitch) * cam.dist, focus.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    clampCam?.(camera.position);
    camera.lookAt(focus);
    return { walk: walkAmt, air: !grounded };
  }
  return {
    update,
    teleport(x, z, face, y = floor) { floor = y; hero.root.position.set(x, y, z); facing = face; cam.yaw = cam.tYaw = face + Math.PI; focus.set(x, y + height, z); },
    setBlocked(fn) { blocked = fn; },
    setCameraClamp(fn) { clampCam = fn; },
    setEnabled(v) { enabled = v; pad.style.display = v ? '' : 'none'; },
    dispose() { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); dom.removeEventListener('wheel', onWheel); pad.remove(); },
  };
}
