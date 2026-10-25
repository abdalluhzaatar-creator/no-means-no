// Talking characters in the Clash of Clans way: not standing in the world, but popping
// in big at the edge of the screen (the guide on one side, the King of the Void on the
// other), drawn live in 3D on their own small transparent canvas, breathing and nodding
// while they speak.
import * as THREE from './vendor/three.module.min.js';
import { buildGuide, buildVoidKing } from './units3d.js';

// side: which way the camera stands off (the guide looks a little to the right, the king to the left).
const FRAMES = { guide: { build: () => buildGuide(), side: 0.18 }, king: { build: () => buildVoidKing({ big: true }), side: -0.18 } };

export function createPortraits(host) {
  const made = {};
  const make = (who) => {
    const f = FRAMES[who];
    const el = document.createElement('div'); el.className = `ob-portrait ${who}`; host.appendChild(el);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a4a, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.4); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(who === 'king' ? 0xb06aff : 0x9fe3b8, 2); rim.position.set(-3, 2, -2); scene.add(rim);
    const h = f.build(); scene.add(h.root);
    // Frame the head and upper body from the model's real size.
    const box = new THREE.Box3().setFromObject(h.root), top = box.max.y, tall = top - box.min.y;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const viewH = tall * 0.6, dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(15)), lookY = top - viewH * 0.46;
    camera.position.set(f.side * dist, lookY + 0.08 * tall, dist); camera.lookAt(0, lookY, 0);
    const size = () => { const w = el.clientWidth || 1, hh = el.clientHeight || 1; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    const clock = new THREE.Clock(); let raf = 0, talking = false;
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      h.update(t, dt, 0, false);
      const neck = h.head.parent;
      if (talking) { neck.rotation.x = Math.sin(t * 9) * 0.06; h.root.rotation.y = Math.sin(t * 1.3) * 0.12; }
      if (who === 'king') { h.arms[0].sh.rotation.x = -0.6 + Math.sin(t * 2) * 0.1; }
      else { h.arms[1].sh.rotation.x = talking ? -0.7 + Math.sin(t * 3) * 0.25 : 0; }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    const p = {
      el, show() { el.classList.add('on'); if (!raf) { clock.getDelta(); tick(); } talking = true; },
      hide() { el.classList.remove('on'); talking = false; setTimeout(() => { if (!el.classList.contains('on')) { cancelAnimationFrame(raf); raf = 0; } }, 450); },
      dispose() { cancelAnimationFrame(raf); ro.disconnect(); scene.traverse((o) => o.geometry?.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); el.remove(); },
    };
    return p;
  };
  return {
    show(who) { for (const k in made) if (k !== who) made[k].hide(); (made[who] ||= make(who)).show(); },
    hide() { for (const k in made) made[k].hide(); },
    dispose() { for (const k in made) made[k].dispose(); },
  };
}
