// The star tree beside a dimension's rank stand: a golden trunk with eight stars on its
// branches, one for every building. A star lights up with every habit built.
import * as THREE from './vendor/three.module.min.js';

const STARS = 8;
const starGeo = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.11 : 0.26; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); g.center(); return g;
})();

export function buildStarTree() {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a53a, metalness: 0.6, roughness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.48, 0.16, 20), gold); base.position.y = 0.08; root.add(base);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.9, 10), wood); trunk.position.y = 1.55; root.add(trunk);
  const stars = [];
  for (let i = 0; i < STARS; i++) {
    const side = i % 2 ? -1 : 1, y = 0.75 + i * 0.3, len = 0.42 - i * 0.025;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, len, 6), wood);
    br.rotation.z = side * -1.0; br.position.set(side * len * 0.42, y - 0.1, 0); root.add(br);
    const m = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.3 }));
    m.position.set(side * len * 0.85, y + 0.08, 0.02); root.add(m);
    const glow = new THREE.PointLight(0xffd040, 0, 2.2, 2); glow.position.copy(m.position); root.add(glow);
    stars.push({ m, glow, ph: i * 0.8 });
  }
  const top = new THREE.Mesh(starGeo, gold); top.scale.setScalar(1.3); top.position.y = 3.15; root.add(top);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let lit = 0;
  const set = (n) => {
    lit = Math.max(0, Math.min(STARS, n));
    stars.forEach((s, i) => { const on = i < lit; s.m.material.color.set(on ? 0xffd040 : 0x555a60); s.m.material.emissive.set(on ? 0xffb020 : 0x000000); s.m.material.emissiveIntensity = on ? 1.2 : 0; s.glow.intensity = on ? 1.2 : 0; });
  };
  set(0);
  return {
    root, set,
    tick(t) { stars.forEach((s, i) => { s.m.rotation.y = Math.sin(t * 1.2 + s.ph) * 0.5; if (i < lit) s.m.material.emissiveIntensity = 1 + Math.sin(t * 3 + s.ph) * 0.3; }); },
  };
}
