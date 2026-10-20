// Lucifer: the tempter who haunts every dimension. He drifts in through walls,
// glides up to the character, whispers why today's task can wait, lingers, and
// fades away — then comes back. A task done drives him mad; a task failed delights him.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { sfx } from './audio.js';

// What he whispers to each character (and to the commander).
export const LUCI_LINES = {
  worshipper: ['صلّي بعدين… هلأ نام أحسنلك', 'شو رح يصير إذا فوّتها مرة وحدة؟', 'ربك غفور رحيم… ارتاح اليوم', 'إنت أصلًا أحسن من غيرك'],
  scholar: ['القراءة بتتعب… افتح جوالك شوي', 'بكرا بتقرأ ضعف', 'شو بدك بالعلم؟ الدنيا حظوظ', 'إنت بتعرف كفاية'],
  athlete: ['جسمك تعبان… ارتاح اليوم', 'قطعة حلو وحدة ما بتضر', 'التمرين بكرا أحسن', 'روح نام أحسنلك'],
  empath: ['ليش تساعد؟ ما حدا ساعدك', 'خليه هو يبلّش ويعتذر', 'نفسك أولى من الكل', 'ولا حدا رح يقدّر تضحيتك'],
  host: ['مين سأل عنك لتسأل عنه؟', 'خليك بالبيت أريحلك', 'الناس ما بتستاهل تعبك', 'بكرا بتتصل… مش هلأ'],
  builder: ['الشغل مش رح يطير… أجّله', 'شو رح يتغيّر إذا تعبت؟', 'مديرك أصلًا ما بقدّرك', 'ما بنصحك تبلّش هلأ'],
  merchant: ['اشتريها… بتستاهل', 'عيش يومك، المصاري بتيجي وبتروح', 'الادخار للبخلا', 'شو رح تفرق هالكم ليرة؟'],
  keeper: ['شو رح تفرق ورقة وحدة؟', 'العالم كله خربان… مش إنت اللي رح تصلحه', 'خليها لغيرك', 'التعب على الفاضي'],
  commander: ['قائد؟ إنت مجرد إنسان تعبان', 'محاربينك رح يتركوك واحد واحد', 'استسلم… أريحلك', 'كل هالتعب ورح ترجع زي ما كنت'],
};
const TASK_LINES = ['{t}؟ ما بنصحك… روح نام أحسنلك', 'انسَ «{t}» اليوم، ما حدا رح يعرف', '«{t}» بكرا… مش هلأ', 'ليش تتعب حالك بـ«{t}»؟'];
const DONE_LINES = ['لااااا! كيف عملتها؟!', 'مش مشكلة… بكرا بتفشل', 'آآآخ! رح أرجع أقوى!', 'هاي مش آخر مرة بشوفك'];
const FAIL_LINES = ['هههههه! هيك بحبك!', 'شفت؟ أنا دايمًا بكسب', 'ممتاز… كمّل هيك', 'خطوة خطوة… لعندي'];
const pick = (a) => a[(Math.random() * a.length) | 0];

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
let glowTex;
const glow = () => glowTex || (glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })());

// The figure: dark robes, horns, burning eyes, a torn cape, smoke and embers.
export function buildLucifer() {
  const h = buildWorshipper({ robe: '#2c0a10', accent: '#b0141c', skin: '#a8443a', glow: '#ff3a1a' });
  const root = h.root, neck = h.head.parent, upper = root.children[1];
  const hornM = std(0x4a3a30, { roughness: 0.35, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.09, 0.27, 0.02), new THREE.Vector3(sx * 0.15, 0.38, -0.02), new THREE.Vector3(sx * 0.17, 0.5, -0.1), new THREE.Vector3(sx * 0.13, 0.58, -0.2)];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.035, 8);
    neck.add(new THREE.Mesh(tube, hornM));
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a10, toneMapped: false });
  for (const sx of [-0.055, 0.055]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeM); e.position.set(sx, 0.18, 0.152); neck.add(e);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xff3a10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.16); s.position.set(sx, 0.18, 0.17); neck.add(s);
  }
  // torn cape
  const capeG = new THREE.PlaneGeometry(0.95, 1.7, 8, 10); const cp = capeG.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i), x = cp.getX(i); if (y < -0.6) cp.setY(i, y - Math.abs(Math.sin(x * 19)) * 0.25); cp.setZ(i, -Math.abs(x) * 0.15); }
  capeG.translate(0, -0.85, 0);
  const cape = new THREE.Mesh(capeG, std(0x6a0a12, { side: THREE.DoubleSide, roughness: 0.8, emissive: 0x2a0004, emissiveIntensity: 0.4 })); cape.position.set(0, 0.62, -0.24); cape.rotation.x = 0.12; upper.add(cape);
  // smoke at the feet and embers rising
  const smokeM = new THREE.SpriteMaterial({ map: glow(), color: 0x1a0606, transparent: true, opacity: 0.55, depthWrite: false });
  const smoke = Array.from({ length: 10 }, (_, i) => { const s = new THREE.Sprite(smokeM.clone()); s.scale.setScalar(0.7 + Math.random() * 0.5); root.add(s); return { s, a: Math.random() * 6.28, ph: Math.random() * 6 }; });
  const emberM = new THREE.SpriteMaterial({ map: glow(), color: 0xff5a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const embers = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(emberM.clone()); s.scale.setScalar(0.05); root.add(s); return { s, y: Math.random() * 2, a: Math.random() * 6.28, r: 0.2 + Math.random() * 0.3 }; });
  const aura = new THREE.PointLight(0xff3010, 2, 5, 1.6); aura.position.set(0, 1.2, 0.3); root.add(aura);
  root.scale.multiplyScalar(1.08);
  // Everything can fade (he comes and goes through walls).
  const mats = [];
  root.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; mats.push([m.material, m.material.opacity]); m.castShadow = false; } });
  let opacity = 1;
  const setOpacity = (o) => { opacity = o; mats.forEach(([m, b]) => (m.opacity = b * o)); aura.intensity = 2 * o; root.visible = o > 0.01; };
  return {
    root, hero: h, head: h.head, setOpacity, get opacity() { return opacity; },
    tick(t, dt, mood = 'idle', moodK = 0) {
      h.update(t, dt, 0, mood === 'angry');
      if (mood === 'angry') { root.rotation.z = Math.sin(t * 40) * 0.05 * moodK; upper.rotation.x = -0.15; aura.intensity = (4 + Math.sin(t * 30) * 2) * opacity; }
      else if (mood === 'happy') { root.rotation.z = Math.sin(t * 8) * 0.06 * moodK; upper.rotation.x = -0.35 - Math.abs(Math.sin(t * 9)) * 0.15 * moodK; neck.rotation.x = -0.4; }
      else { root.rotation.z = 0; upper.rotation.x = 0.12; neck.rotation.x = 0.1; }
      cape.rotation.x = 0.12 + Math.sin(t * 2.2) * 0.08;
      smoke.forEach((s) => { s.a += dt * 0.6; s.s.position.set(Math.cos(s.a + s.ph) * 0.45, 0.15 + Math.sin(t + s.ph) * 0.1, Math.sin(s.a + s.ph) * 0.45); });
      embers.forEach((e) => { e.y += dt * 0.6; if (e.y > 2.2) e.y = 0; e.s.position.set(Math.cos(e.a + t) * e.r, e.y, Math.sin(e.a + t) * e.r); e.s.material.opacity = (1 - e.y / 2.2) * opacity; });
    },
  };
}

// The wandering tempter. hero: the character's root; who: key in LUCI_LINES;
// tasks(): titles of today's unfinished tasks; groundAt(x, z): floor height.
export function createLucifer(scene, { camera, container, hero, who = 'worshipper', tasks = () => [], groundAt = () => 0, first = 6 }) {
  const L = buildLucifer(); scene.add(L.root); L.setOpacity(0);
  const bubble = document.createElement('div'); bubble.className = 'luci-bubble'; bubble.hidden = true; container.appendChild(bubble);
  const pos = new THREE.Vector3(), goal = new THREE.Vector3(), tmp = new THREE.Vector3(), headW = new THREE.Vector3();
  let state = 'away', timer = first, sayT = 0, mood = 'idle', moodT = 0, ang = Math.random() * 6.28, enabled = true;
  const say = (text, secs = 4.5) => { bubble.textContent = text; bubble.hidden = false; sayT = secs; };
  const line = () => { const ts = tasks(); return ts.length && Math.random() < 0.55 ? pick(TASK_LINES).replace('{t}', pick(ts)) : pick(LUCI_LINES[who] || LUCI_LINES.commander); };
  const besideHero = (r = 2.4) => {
    // to one side of the character, on the camera's side, so you can see him
    const hp = hero.position; tmp.subVectors(camera.position, hp).setY(0).normalize();
    const side = new THREE.Vector3(-tmp.z, 0, tmp.x);
    return goal.copy(hp).addScaledVector(side, r * (ang > Math.PI ? 1 : -1)).addScaledVector(tmp, 0.8);
  };
  const appear = (r) => { const hp = hero.position, a = Math.random() * 6.28; pos.set(hp.x + Math.cos(a) * r, 0, hp.z + Math.sin(a) * r); };
  const react = (kind) => {
    if (!enabled) return;
    if (state === 'away' || L.opacity < 0.3) { pos.copy(besideHero(2.8)); L.setOpacity(0.2); }
    state = 'talk'; timer = 4.5; mood = kind === 'done' ? 'angry' : 'happy'; moodT = 3.5;
    say(pick(kind === 'done' ? DONE_LINES : FAIL_LINES), 3.8);
    (kind === 'done' ? sfx.luciRoar : sfx.luciLaugh)?.();
  };
  const fast = window.__nmnDebug ? 4 : 1;   // tests run at a few frames a second
  const tick = (t, dt0) => {
    const dt = dt0 * fast;
    if (!enabled) { L.setOpacity(0); bubble.hidden = true; return; }
    timer -= dt; sayT -= dt; moodT -= dt;
    if (moodT <= 0) mood = 'idle';
    let op = L.opacity, speed = 0;
    const hp = hero.position;
    if (state === 'away') { op = Math.max(0, op - dt); if (timer < 0) { appear(15); state = 'approach'; ang = Math.random() * 6.28; } }
    else if (state === 'approach') { op = Math.min(1, op + dt * 0.6); besideHero(); speed = 3.2; if (pos.distanceTo(goal) < 0.6) { state = 'talk'; timer = 5; say(line()); sfx.luciWhisper?.(); } }
    else if (state === 'talk') { op = Math.min(1, op + dt); besideHero(); speed = 2; if (timer < 0) { state = 'linger'; timer = 5 + Math.random() * 5; } }
    else if (state === 'linger') { ang += dt * 0.4; goal.set(hp.x + Math.cos(ang) * 4, 0, hp.z + Math.sin(ang) * 4); speed = 1.6; if (timer < 0) { if (Math.random() < 0.4) { state = 'talk'; timer = 5; say(line()); sfx.luciWhisper?.(); } else { state = 'leave'; ang = Math.atan2(pos.z - hp.z, pos.x - hp.x); } } }
    else if (state === 'leave') { goal.set(pos.x + Math.cos(ang) * 10, 0, pos.z + Math.sin(ang) * 10); speed = 3; op = Math.max(0, op - dt * 0.5); if (op <= 0) { state = 'away'; timer = 25 + Math.random() * 45; } }
    if (speed) { tmp.subVectors(goal, pos).setY(0); const d = tmp.length(); if (d > 0.05) pos.addScaledVector(tmp, Math.min(1, (speed * dt) / d)); }
    L.setOpacity(op);
    L.root.position.set(pos.x, groundAt(pos.x, pos.z) + 0.35 + Math.sin(t * 1.5) * 0.12, pos.z);
    // face the character while near him, else his heading
    const fx = (state === 'leave' ? goal.x : hp.x) - pos.x, fz = (state === 'leave' ? goal.z : hp.z) - pos.z;
    L.root.rotation.y = Math.atan2(fx, fz);
    L.tick(t, dt, mood, Math.max(0, moodT) / 3.5);
    // speech bubble over his head
    if (sayT > 0 && op > 0.3) {
      L.head.getWorldPosition(headW); headW.y += 0.7; headW.project(camera);
      const r = container.getBoundingClientRect();
      if (headW.z < 1) { bubble.hidden = false; bubble.style.left = `${(headW.x * 0.5 + 0.5) * r.width}px`; bubble.style.top = `${(-headW.y * 0.5 + 0.5) * r.height}px`; } else bubble.hidden = true;
    } else bubble.hidden = true;
  };
  return {
    tick, react, figure: L,
    setEnabled(v) { enabled = v; if (!v) { L.setOpacity(0); bubble.hidden = true; state = 'away'; timer = 8; } },
    dispose() { bubble.remove(); scene.remove(L.root); },
  };
}

// Speech bubble style is in style.css (.luci-bubble).
export { DONE_LINES, FAIL_LINES };
