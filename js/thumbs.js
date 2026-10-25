// Pictures of the buildings and troops for the cards (the shop, the windows, the troop cards),
// drawn once from the same 3D models the village uses, from Clash's angle, on a clear background.
import * as THREE from './vendor/three.module.min.js';
import { buildingModel } from './basemodels3d.js';
import { buildArcher } from './units3d.js';

const cache = new Map();
let renderer = null, scene = null, camera = null;
const setup = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false); renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8a3a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff4dc, 2); sun.position.set(4, 8, 5); scene.add(sun);
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
};
const make = (key) => {
  if (key === 'troop:archer') { const a = buildArcher(); a.update?.(0, 0, 0, false); return a.root; }
  if (key === 'archer') {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 2.8), new THREE.MeshStandardMaterial({ color: 0xcdb88e })); base.position.y = 0.25; g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a6a44 })); top.position.y = 0.56; g.add(top);
    const a = buildArcher(); a.root.position.y = 0.62; a.root.rotation.y = Math.PI * 0.25; g.add(a.root); return g;
  }
  return buildingModel(key);
};
// A data: URL picture of a building type ('goldmine', 'archer' …) or a troop ('troop:archer').
export function thumb(key) {
  if (cache.has(key)) return cache.get(key);
  try {
    if (!renderer) setup();
    const obj = make(key); if (!obj) return '';
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const troop = key.startsWith('troop:'), r = Math.max(size.x, size.y, size.z) * (troop ? 0.62 : 0.78);
    const dir = troop ? new THREE.Vector3(0.35, 0.25, 1) : new THREE.Vector3(1, 1.05, 1);
    camera.position.copy(mid).addScaledVector(dir.normalize(), r / Math.tan(THREE.MathUtils.degToRad(15)));
    camera.lookAt(mid);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(obj); obj.traverse((o) => o.geometry?.dispose?.());
    cache.set(key, url); return url;
  } catch { return ''; }
}
export const img = (key, cls = '') => { const u = thumb(key); return u ? `<img class="th-img ${cls}" src="${u}" alt="">` : ''; };
