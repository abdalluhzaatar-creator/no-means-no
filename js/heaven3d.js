// The Hall of Warriors: a celestial chamber of the headquarters castle. A white
// and gold citadel floor floats above a sea of clouds under a twilight sky; a
// colonnade with gold capitals rings it, a great halo turns overhead and light
// falls from it. The eight dimension characters stand in two ranks along the
// aisle as the commander's warriors, armed and caped in their colours. Those whose
// dimension is not opened yet stand as translucent spirits. When the commander
// passes they salute; when he stands on the seal before the arch they kneel.
import * as THREE from './vendor/three.module.min.js';
import { buildWorshipper } from './oasis3d.js';
import { CHARACTERS, REGIONS } from './content.js';

export const HX = -400;                     // the hall sits far from the others in the same scene
export const HEAVEN = { r: 23.2, seal: new THREE.Vector3(HX, 0, -14), door: new THREE.Vector3(HX, 0, 22.5) };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...o });

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function label(text, color) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, 'rgba(10,12,30,0)'); grd.addColorStop(0.15, 'rgba(10,12,30,.72)'); grd.addColorStop(0.85, 'rgba(10,12,30,.72)'); grd.addColorStop(1, 'rgba(10,12,30,0)');
    g.fillStyle = grd; g.fillRect(0, 22, w, 84);
    g.fillStyle = color; g.fillRect(70, 22, w - 140, 3); g.fillRect(70, 103, w - 140, 3);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 50px Tajawal, system-ui, sans-serif';
    g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = '#fff8e6'; g.fillText(text, w / 2, h / 2 + 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.2, 0.8, 1);
  return sp;
}

// Marble floor with gold inlay: rings, rays and an eight-pointed star.
const floorTexture = () => canvasTex(2048, 2048, (g, w) => {
  const c = w / 2;
  const grd = g.createRadialGradient(c, c, 0, c, c, c); grd.addColorStop(0, '#2a3a7a'); grd.addColorStop(0.6, '#1c2858'); grd.addColorStop(1, '#141c42');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
  g.strokeStyle = 'rgba(170,190,255,.10)'; g.lineWidth = 3;
  for (let i = 0; i < 160; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); g.bezierCurveTo(x + 80, y + 40, x + 120, y - 60, x + 260, y + 20); g.stroke(); }
  g.strokeStyle = '#d9a83a'; g.lineWidth = 10;
  for (const r of [0.97, 0.9, 0.55, 0.3, 0.12]) { g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 5;
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3); g.lineTo(c + Math.cos(a) * c * 0.9, c + Math.sin(a) * c * 0.9); g.stroke(); }
  g.fillStyle = 'rgba(201,150,44,.9)';
  g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = c * (i % 2 ? 0.12 : 0.27); g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,215,120,.35)';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.72, c + Math.sin(a) * c * 0.72, c * 0.05, 0, Math.PI * 2); g.fill(); }
});

// Glowing seal on the floor before the arch.
const sealTexture = () => canvasTex(512, 512, (g, w) => {
  const c = w / 2;
  const grd = g.createRadialGradient(c, c, 0, c, c, c); grd.addColorStop(0, 'rgba(255,240,190,1)'); grd.addColorStop(0.5, 'rgba(255,200,90,.55)'); grd.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#fff6d8'; g.lineWidth = 6;
  for (const r of [0.92, 0.7]) { g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.stroke(); }
  // sun rays and small diamonds between the rings
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r0 = c * (i % 3 ? 0.36 : 0.22); g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66); g.stroke(); }
  g.fillStyle = '#fff6d8';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, x = c + Math.cos(a) * c * 0.81, y = c + Math.sin(a) * c * 0.81; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 9, y); g.lineTo(x, y + 14); g.lineTo(x - 9, y); g.fill(); }
  g.beginPath(); g.arc(c, c, c * 0.16, 0, Math.PI * 2); g.fill();
});

const puffTexture = () => canvasTex(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
});

// Twilight sky dome with stars and a soft nebula band.
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 }, night: { value: 0 }, gold: { value: 0.5 }, dim: { value: 0 }, sun: { value: new THREE.Vector3(0, 0.3, -1) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vP; uniform float t, night, gold, dim; uniform vec3 sun;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      vec3 grad(vec3 hz, vec3 md, vec3 tp, float h){ vec3 c = mix(hz, md, smoothstep(-0.05,0.25,h)); return mix(c, tp, smoothstep(0.25,0.85,h)); }
      void main(){
        float h = vP.y;
        vec3 day = grad(vec3(0.86,0.92,1.0), vec3(0.5,0.7,0.98), vec3(0.2,0.45,0.9), h);
        vec3 dusk = grad(vec3(1.0,0.72,0.45), vec3(0.62,0.4,0.66), vec3(0.16,0.14,0.38), h);
        vec3 nite = grad(vec3(0.16,0.13,0.3), vec3(0.07,0.07,0.2), vec3(0.01,0.02,0.08), h);
        vec3 col = mix(mix(day, dusk, gold), nite, night);
        // the sea of clouds below glows with the light of the hour
        col = mix(col, mix(mix(vec3(1.0,0.97,0.92), vec3(1.0,0.86,0.7), gold), vec3(0.2,0.2,0.32), night), smoothstep(0.05,-0.25,h));
        // sun (or moon) glow
        float sd = max(dot(vP, normalize(sun)), 0.0);
        col += mix(vec3(1.0,0.85,0.6), vec3(0.6,0.7,1.0), night) * (pow(sd, 400.0) * 2.5 + pow(sd, 12.0) * 0.25) * (1.0 - dim * 0.8);
        // weather: overcast grey
        col = mix(col, vec3(0.6,0.62,0.66) * (1.0 - night * 0.8), dim);
        // nebula band and stars at night
        float band = exp(-pow((vP.y - 0.45 + 0.25*vP.x)*5.0, 2.0));
        col += vec3(0.55,0.35,0.85) * band * 0.25 * night * (1.0 - dim) * (0.6 + 0.4*sin(vP.x*9.0 + vP.z*7.0));
        vec3 q = floor(vP*420.0);
        float s = step(0.9965, hash(q)) * smoothstep(0.1,0.5,h) * night * (1.0 - dim);
        col += vec3(1.0,0.95,0.85) * s * (0.6 + 0.4*sin(t*2.0 + hash(q+3.0)*30.0));
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(300, 64, 32), mat);
}

// Weather the hall follows (same kinds as the spiritual dimension).
const WEATHER = {
  clear: { dim: 0, rain: 0, snow: 0, fog: 0 }, cloudy: { dim: 0.2, rain: 0, snow: 0, fog: 0.1 }, overcast: { dim: 0.5, rain: 0, snow: 0, fog: 0.25 },
  fog: { dim: 0.45, rain: 0, snow: 0, fog: 1 }, rain: { dim: 0.6, rain: 1, snow: 0, fog: 0.35 }, storm: { dim: 0.75, rain: 1.4, snow: 0, fog: 0.45 }, snow: { dim: 0.4, rain: 0, snow: 1, fog: 0.4 },
};

// Armour, weapon and cape for a warrior (in the model's local units).
export function arm(hero, pal, ghost) {
  const metal = std(ghost ? 0xcfe6ff : 0xd8c27a, { metalness: 0.9, roughness: 0.25 });
  const accent = std(pal.accent, { metalness: 0.4, roughness: 0.4 });
  const glow = new THREE.Color(pal.glow);
  // Helmet with a crest in the dimension colour.
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.178, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), metal);
  helm.position.y = 0.17; hero.head.parent.add(helm);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.3), std(pal.robe, { emissive: glow, emissiveIntensity: 0.4 }));
  crest.position.set(0, 0.36, -0.02); hero.head.parent.add(crest);
  // Spear on the right, shield on the left.
  const spear = new THREE.Group(); spear.position.set(-0.46, 0, 0.12); hero.root.add(spear);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 2.5, 8), std(0x4a3420, { roughness: 0.7 })); shaft.position.y = 1.25; spear.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 8), std(0xffffff, { metalness: 1, roughness: 0.15, emissive: glow, emissiveIntensity: 0.6 })); tip.position.y = 2.66; spear.add(tip);
  const shield = new THREE.Group(); shield.position.set(0.42, 0.95, 0.12); shield.rotation.y = -0.25; hero.root.add(shield);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32), accent); face.rotation.x = Math.PI / 2; shield.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 32), metal); shield.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), std(0xffffff, { metalness: 0.8, emissive: glow, emissiveIntensity: 0.8 })); boss.position.z = 0.04; shield.add(boss);
  // Shoulder plates and a cape.
  for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal); pl.position.set(sx * 0.3, 1.55, 0); hero.root.add(pl); }
  const capeGeo = new THREE.PlaneGeometry(0.62, 1.35, 6, 8);
  const cp = capeGeo.attributes.position; for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); cp.setZ(i, -Math.pow(Math.max(0, (0.675 - y) / 1.35), 1.6) * 0.18 + Math.abs(cp.getX(i)) * -0.12); }
  capeGeo.computeVertexNormals();
  const cape = new THREE.Mesh(capeGeo, std(pal.robe, { side: THREE.DoubleSide, roughness: 0.7 })); cape.position.set(0, 0.95, -0.28); hero.root.add(cape);
  return cape;
}

export function buildHeaven(scene, { owned = new Set(), story = {}, ranks = {} } = {}) {
  const g = new THREE.Group(); g.position.x = HX; scene.add(g);
  const puff = puffTexture();
  const gold = std(0xe1b44c, { metalness: 1, roughness: 0.22, emissive: 0x4a3000, emissiveIntensity: 0.25 });
  const marble = std(0xf7f3ea, { roughness: 0.28 });
  const lightStone = std(0xebe4d4, { roughness: 0.55 });

  // Sky, sea of clouds below, distant cloud banks.
  const sky = skyDome(); g.add(sky);
  const clouds = new THREE.Group(); g.add(clouds);
  const cloudMats = [0xffffff, 0xffe9f2, 0xfff1d6, 0xe6e2ff].map((c) => new THREE.SpriteMaterial({ map: puff, color: c, transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
  let sd = 21; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 360; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + Math.sqrt(rnd()) * 190, k = 18 + rnd() * 30;
    const s = new THREE.Sprite(cloudMats[i % 4]); s.position.set(Math.cos(a) * r, -9 - rnd() * 10, Math.sin(a) * r); s.scale.set(k * 1.8, k, 1); s.userData.v = 0.4 + rnd(); clouds.add(s);
  }
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, r = 150 + rnd() * 90, k = 30 + rnd() * 40;
    const s = new THREE.Sprite(cloudMats[(i + 1) % 4]); s.position.set(Math.cos(a) * r, 10 + rnd() * 50, Math.sin(a) * r); s.scale.set(k * 2.2, k, 1); s.userData.v = 0.2; clouds.add(s);
  }

  // The floating citadel floor.
  const floorTex = floorTexture();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 1.2, 128), [lightStone, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.22, metalness: 0.15 }), lightStone]);
  floor.position.y = -0.6; floor.receiveShadow = true; g.add(floor);
  const under = new THREE.Mesh(new THREE.ConeGeometry(25, 30, 64, 6, true), std(0xd9d0bf, { roughness: 0.9, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI; under.position.y = -16.2; g.add(under);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(25, 0.35, 12, 160), gold); trim.rotation.x = Math.PI / 2; trim.position.y = -0.05; g.add(trim);
  // Castle parapet around the edge: a low wall with merlons (open toward the door).
  const merlonGeo = new THREE.BoxGeometry(1.1, 1.2, 0.9);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.16 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.14) continue;
    const m = new THREE.Mesh(merlonGeo, i % 2 ? lightStone : marble); m.position.set(Math.cos(a) * 24.4, i % 2 ? 0.6 : 1.0, Math.sin(a) * 24.4); m.rotation.y = -a; m.scale.y = i % 2 ? 1 : 1.6; m.castShadow = true; g.add(m);
  }

  // Colonnade: tall marble columns with gold bases and capitals, joined by arches.
  const COLS = 16, CR = 21;
  const colGeo = new THREE.CylinderGeometry(0.75, 0.9, 15, 24);
  const cols = [], colFires = [];
  for (let i = 0; i < COLS; i++) {
    const a = (i / COLS) * Math.PI * 2 + Math.PI / COLS;
    if (Math.cos(a - Math.PI / 2) > 0.97) continue;                                  // leave the door bay open
    const x = Math.cos(a) * CR, z = Math.sin(a) * CR; cols.push([x, z]);
    const c = new THREE.Mesh(colGeo, marble); c.position.set(x, 7.5, z); c.castShadow = true; g.add(c);
    for (const [y, s] of [[0.35, 1.4], [15.2, 1.6]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.9, s, 0.7, 24), gold); b.position.set(x, y, z); g.add(b); }
    const fire = new THREE.Group(); fire.position.set(x, 15.9, z); g.add(fire); colFires.push(fire);
    for (const [r, h, c] of [[0.5, 1.5, 0xff7a1f], [0.34, 1.15, 0xffb347], [0.18, 0.8, 0xffe6a0]]) { const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.5), toneMapped: false, transparent: true, opacity: 0.92 })); f.position.y = h / 2; fire.add(f); }
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CR, 0.55, 12, 160), gold); ring.rotation.x = Math.PI / 2; ring.position.y = 15.6; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(CR, 0.25, 8, 160), marble); ring2.rotation.x = Math.PI / 2; ring2.position.y = 16.5; g.add(ring2);

  // Overhead: a turning halo and light falling from it.
  const halo = new THREE.Group(); halo.position.set(0, 27, -4); g.add(halo);
  const haloM = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffc24d, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 });
  for (const [r, w] of [[11, 0.35], [8.5, 0.18], [13.5, 0.12]]) { const h = new THREE.Mesh(new THREE.TorusGeometry(r, w, 12, 160), haloM); h.rotation.x = Math.PI / 2; halo.add(h); }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 2.2 })); crystal.scale.y = 1.8; halo.add(crystal);
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.02, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rays = [];
  for (let i = 0; i < 7; i++) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(i ? 1.2 : 2.5, i ? 4.5 : 9, 27, 32, 1, true), rayMat.clone());
    const a = (i / 6) * Math.PI * 2; cone.position.set(i ? Math.cos(a) * 9 : 0, 13.5, (i ? Math.sin(a) * 9 : 0) - 4); cone.rotation.z = i ? Math.cos(a) * 0.18 : 0; cone.rotation.x = i ? -Math.sin(a) * 0.18 : 0;
    g.add(cone); rays.push(cone);
  }

  // The arch at the far end, with the seal on the floor before it.
  const arch = new THREE.Group(); arch.position.set(0, 0, -20); g.add(arch);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 11, 1.8), marble); p.position.set(sx * 4.6, 5.5, 0); arch.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), gold); cap.position.set(sx * 4.6, 11.2, 0); arch.add(cap);
  }
  const top = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.85, 16, 64, Math.PI), marble); top.position.y = 11.2; arch.add(top);
  const topG = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.3, 12, 64, Math.PI), gold); topG.position.set(0, 11.2, 0.75); arch.add(topG);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 15.6), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vU; uniform float t; void main(){ float edge = smoothstep(0.0,0.25,vU.x)*smoothstep(1.0,0.75,vU.x)*smoothstep(0.0,0.1,vU.y); float w = 0.5+0.5*sin(vU.y*14.0 - t*1.6 + sin(vU.x*8.0+t)*1.5); gl_FragColor = vec4(vec3(1.0,0.82,0.5)*(0.25+0.35*w), edge*0.35); }',
  }));
  veil.position.set(0, 7.8, 0); arch.add(veil);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  seal.rotation.x = -Math.PI / 2; seal.position.set(0, 0.02, HEAVEN.seal.z); seal.visible = false; g.add(seal);

  // Door back to the great hall: a gold-framed arch with a shimmering veil.
  const door = new THREE.Group(); door.position.set(0, 0, 24.3); door.rotation.y = Math.PI; g.add(door);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1, 6.5, 1), gold); p.position.set(sx * 2.4, 3.25, 0); door.add(p); }
  const dTop = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.5, 12, 48, Math.PI), gold); dTop.position.y = 6.5; door.add(dTop);
  const dVeil = veil.clone(); dVeil.material = veil.material; dVeil.scale.set(0.58, 0.55, 1); dVeil.position.set(0, 4.3, 0); door.add(dVeil);

  // Four great fire bowls round the seal.
  const braziers = [];
  for (const [x, z] of [[-4.2, -17.5], [4.2, -17.5], [-4.2, -10.5], [4.2, -10.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 2.4, 10), std(0x3a2a1c, { metalness: 0.7 })); leg.position.set(x, 1.2, z); g.add(leg);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold); bowl.position.set(x, 3, z); g.add(bowl);
    const fire = new THREE.Group(); fire.position.set(x, 3, z); g.add(fire);
    for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.4 - k * 0.05, 1.6 - k * 0.2, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? 0xff7a1f : 0xffc34d).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.9 })); f.position.set((rnd() - 0.5) * 0.5, 0.7, (rnd() - 0.5) * 0.5); fire.add(f); }
    braziers.push({ fire, ph: rnd() * 6, light: null, x, z });
  }
  // Banners behind each warrior hang from the columns' ring.
  // ---- the eight warriors ----
  const chars = CHARACTERS.filter((c) => REGIONS.some((r) => r.characterId === c.id));
  const slots = [];
  chars.forEach((c, i) => {
    const side = i % 2 ? -1 : 1, rank = Math.floor(i / 2);
    slots.push({ c, x: side * 5.8, z: 9 - rank * 5.6, face: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
  });
  const warriors = slots.map(({ c, x, z, face }) => {
    const ghost = !owned.has(c.id);
    const hero = buildWorshipper(c.palette);
    const cape = arm(hero, c.palette, ghost);
    hero.root.position.set(x, 0, z); hero.root.rotation.y = face; g.add(hero.root);
    if (ghost) hero.root.traverse((m) => {
      if (!m.isMesh) return;
      m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.28; m.material.depthWrite = false;
      if (m.material.emissive) { m.material.emissive.set(0x9fc8ff); m.material.emissiveIntensity = 0.5; }
      m.castShadow = false;
    });
    // Pedestal and a column of light in the warrior's colour.
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.18, 40), ghost ? lightStone : gold); ped.position.set(x, 0.09, z); g.add(ped);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: ghost ? 0x9fc8ff : c.palette.glow, transparent: true, opacity: ghost ? 0.05 : 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(x, 4.5, z); g.add(beam);
    const region = REGIONS.find((r) => r.characterId === c.id);
    const tag = label((ghost ? '🔒 ' : '') + (region?.name || c.name) + (!ghost && ranks[c.id] ? ` · ${ranks[c.id]}` : ''), ghost ? '#9fc8ff' : c.palette.glow); tag.position.set(x, 4.4, z); g.add(tag);
    // A banner in the warrior's colour on the nearest column line.
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 6), std(c.palette.robe, { side: THREE.DoubleSide, roughness: 0.8, emissive: new THREE.Color(c.palette.glow), emissiveIntensity: ghost ? 0.05 : 0.15, transparent: ghost, opacity: ghost ? 0.4 : 1 }));
    ban.position.set(x + Math.sign(x) * 4.5, 9.5, z); ban.rotation.y = Math.PI / 2; g.add(ban);
    return { hero, ghost, cape, x, z, face, yaw: face, base: face, last: -99, beam, home: new THREE.Vector3(x, 0, z) };
  });

  // ---- the commander's platform: built a little more with every warrior who joins ----
  const stage = warriors.filter((w) => !w.ghost).length;
  const P = new THREE.Group(); P.position.set(0, 0, HEAVEN.seal.z); g.add(P);
  const ghostM = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false });
  const part = (n, mesh) => { if (stage >= n) P.add(mesh); else { const gm = new THREE.Mesh(mesh.geometry, ghostM); gm.position.copy(mesh.position); gm.rotation.copy(mesh.rotation); gm.scale.copy(mesh.scale); P.add(gm); } return mesh; };
  const mk = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
  part(1, mk(new THREE.CylinderGeometry(3.0, 3.1, 0.3, 48), lightStone, 0, 0.15, 0));
  part(2, mk(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 48), marble, 0, 0.45, 0));
  part(3, mk(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 48), marble, 0, 0.75, 0));
  for (const [r, y] of [[3.02, 0.3], [2.42, 0.6], [1.82, 0.9]]) { const t2 = mk(new THREE.TorusGeometry(r, 0.06, 8, 64), gold, 0, y, 0); t2.rotation.x = Math.PI / 2; part(4, t2); }
  const PCOLS = [[-2.2, -1.5], [2.2, -1.5], [-1.1, -2.4], [1.1, -2.4]];
  for (const [x, z] of PCOLS) { part(5, mk(new THREE.CylinderGeometry(0.22, 0.26, 2.2, 16), marble, x, 1.4, z)); part(6, mk(new THREE.CylinderGeometry(0.2, 0.22, 2.4, 16), marble, x, 3.7, z)); part(6, mk(new THREE.CylinderGeometry(0.34, 0.22, 0.3, 16), gold, x, 5, z)); }
  for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; part(6, mk(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), gold, Math.cos(a) * 1.7, 1.25, Math.sin(a) * 1.7)); }
  { const rail = mk(new THREE.TorusGeometry(1.7, 0.05, 6, 40, Math.PI), gold, 0, 1.6, 0); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI; part(6, rail); }
  { const dome = mk(new THREE.SphereGeometry(2.7, 32, 16, 0, Math.PI, 0, Math.PI / 2), marble, 0, 5.15, -1.2); dome.rotation.y = Math.PI; dome.scale.set(1, 0.7, 0.8); part(7, dome); const rim = mk(new THREE.TorusGeometry(2.7, 0.12, 8, 40, Math.PI), gold, 0, 5.15, -1.2); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI; part(7, rim); }
  const crest = new THREE.Group(); crest.position.set(0, 3.4, -2.75); P.add(crest); crest.visible = stage >= 8;
  { const disc = mk(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 40), gold, 0, 0, 0); disc.rotation.x = Math.PI / 2; crest.add(disc); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const ray = mk(new THREE.ConeGeometry(0.12, 0.6, 6), gold, Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0); ray.rotation.z = a - Math.PI / 2; crest.add(ray); } }
  const crownM = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc24d, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.3 });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 24), crownM); crown.rotation.x = Math.PI / 2; crown.position.set(0, 6.6, -1.2); crown.visible = stage >= 8; P.add(crown);
  const platBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2, 14, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); platBeam.position.y = 7.9; platBeam.visible = stage >= 8; P.add(platBeam);
  for (const sx of [-1, 1]) { const b = mk(new THREE.PlaneGeometry(1.1, 3.6), std(0x8a1a1a, { side: THREE.DoubleSide, emissive: 0x3a0606, emissiveIntensity: 0.3 }), sx * 2.2, 3.2, -1.2); b.visible = stage >= 8; P.add(b); }
  const platTop = (x, z) => { const r = Math.hypot(x, z - HEAVEN.seal.z); return stage >= 3 && r < 1.8 ? 0.9 : stage >= 2 && r < 2.4 ? 0.6 : stage >= 1 && r < 3.0 ? 0.3 : 0; };

  // ---- the new gate on the east side: closed until the speech, then the way down to the shore ----
  const gate = new THREE.Group(); gate.position.set(23.6, 0, 0); gate.rotation.y = -Math.PI / 2; g.add(gate);
  for (const sx of [-1, 1]) { const p2 = mk(new THREE.BoxGeometry(1.2, 9, 1.2), marble, sx * 2.7, 4.5, 0); gate.add(p2); const c2 = mk(new THREE.BoxGeometry(1.5, 0.5, 1.5), gold, sx * 2.7, 9.2, 0); gate.add(c2); }
  { const t3 = mk(new THREE.TorusGeometry(2.7, 0.55, 12, 48, Math.PI), marble, 0, 9, 0); gate.add(t3); }
  const leaves = [-1, 1].map((sx) => { const hinge = new THREE.Group(); hinge.position.set(sx * 2.1, 0, 0); gate.add(hinge); const leaf = mk(new THREE.BoxGeometry(2.1, 8, 0.25), std(0x5a3a1a, { roughness: 0.6 }), -sx * 1.05, 4, 0); hinge.add(leaf); for (let y = 1; y < 8; y += 1.6) { const band = mk(new THREE.BoxGeometry(2.1, 0.14, 0.3), gold, -sx * 1.05, y, 0); hinge.add(band); } return hinge; });
  // steps leading out and down through the clouds
  for (let k = 0; k < 14; k++) { const st = mk(new THREE.BoxGeometry(3.6, 0.4, 1.2), lightStone, 25.2 + k * 1.1, -0.2 - k * 0.7, 0); g.add(st); }
  // ---- the golden cage where Lucifer is locked after the speech ----
  const CAGE = new THREE.Vector3(-11.5, 0, 2.5);
  const cageG = new THREE.Group(); cageG.position.copy(CAGE); g.add(cageG);
  { const base = mk(new THREE.CylinderGeometry(1.8, 1.9, 0.3, 32), gold, 0, 0.15, 0); cageG.add(base); const lid = mk(new THREE.SphereGeometry(1.75, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 3.8, 0); lid.scale.y = 0.5; cageG.add(lid); const ring = mk(new THREE.TorusGeometry(1.75, 0.07, 6, 40), gold, 0, 3.8, 0); ring.rotation.x = Math.PI / 2; cageG.add(ring); const knob = mk(new THREE.SphereGeometry(0.22, 12, 8), gold, 0, 4.85, 0); cageG.add(knob); }
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; if (a > 0.1 && a < 0.95) continue; cageG.add(mk(new THREE.CylinderGeometry(0.045, 0.045, 3.5, 6), gold, Math.cos(a) * 1.7, 2.05, Math.sin(a) * 1.7)); }
  const cageDoor = new THREE.Group(); cageDoor.position.set(Math.cos(0.1) * 1.7, 0, Math.sin(0.1) * 1.7); cageG.add(cageDoor);
  for (let k = 0; k < 4; k++) { const a = 0.1 + (k + 0.5) * 0.21; cageDoor.add(mk(new THREE.CylinderGeometry(0.045, 0.045, 3.5, 6), gold, Math.cos(a) * 1.7 - cageDoor.position.x, 2.05, Math.sin(a) * 1.7 - cageDoor.position.z)); }
  const lock = mk(new THREE.BoxGeometry(0.3, 0.38, 0.14), std(0x8a6a1a, { metalness: 1, roughness: 0.3 }), Math.cos(0.55) * 1.78, 2, Math.sin(0.55) * 1.78); lock.rotation.y = -0.55; cageG.add(lock);
  const cageRune = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); cageRune.rotation.x = -Math.PI / 2; cageRune.position.y = 0.32; cageG.add(cageRune);
  let cageOpen = 0;
  // Warriors follow the commander (walking him down to the shore and back).
  let following = false;
  let gateOpen = !!story.speech, gateK = gateOpen ? 1 : 0;
  const scripted = new Set();
  let focus = null;
  // Motes of light rising through the hall.
  const N = 380, mp = new Float32Array(N * 3), ms = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 23; mp.set([Math.cos(a) * r, rnd() * 22, Math.sin(a) * r], i * 3); ms[i] = 0.3 + rnd(); }
  const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mp, 3)), new THREE.PointsMaterial({ map: puff, color: 0xffe8b0, size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(motes);

  // Lights: only switched on while the commander is in this hall.
  const lights = new THREE.Group(); g.add(lights);
  const hemi = new THREE.HemisphereLight(0xc9d2ff, 0x8a6a3a, 0.6); lights.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.7); key.position.set(-18, 40, 22); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 }); key.shadow.bias = -0.0004;
  lights.add(key, key.target);
  const sealLight = new THREE.PointLight(0xffd27a, 22, 16, 1.6); sealLight.position.set(0, 4, HEAVEN.seal.z); lights.add(sealLight);
  const haloLight = new THREE.PointLight(0xfff0d0, 28, 40, 1.6); haloLight.position.set(0, 20, -4); lights.add(haloLight);
  for (const b of braziers) { b.light = new THREE.PointLight(0xff8a3c, 30, 16, 1.5); b.light.position.set(b.x, 4.2, b.z); lights.add(b.light); }
  lights.visible = false;

  g.traverse((m) => { if (m.isMesh && m.castShadow === false && m.material?.blending !== THREE.AdditiveBlending && !m.material?.transparent) m.receiveShadow = true; });
  for (const w of warriors) if (!w.ghost) w.hero.root.traverse((m) => { if (m.isMesh) m.castShadow = true; });

  const blocked = (x, z) => {
    x -= HX;
    if (gateOpen && x > 18 && Math.abs(z) < 1.9) return x > 27;                       // out through the open gate
    if (Math.hypot(x, z) > HEAVEN.r) return true;
    if (z < -18.6) return true;                                                     // the arch
    if (!following) for (const w of warriors) if (Math.hypot(x - w.x, z - w.z) < 1.3) return true;
    for (const [cx, cz] of cols) if (Math.hypot(x - cx, z - cz) < 1.4) return true;
    for (const b of braziers) if (Math.hypot(x - b.x, z - b.z) < 1.1) return true;
    if (Math.hypot(x - CAGE.x, z - CAGE.z) < 2.1) return true;
    if (stage >= 5) for (const [px, pz] of PCOLS) if (Math.hypot(x - px, z - HEAVEN.seal.z - pz) < 0.45) return true;
    return false;
  };
  const clamp = (p) => {
    const dx = p.x - HX, d = Math.hypot(dx, p.z);
    if (d > 24) { p.x = HX + (dx / d) * 24; p.z = (p.z / d) * 24; }
    p.y = Math.max(0.8, Math.min(22, p.y));
  };

  let kneeling = false;
  const tmp = new THREE.Vector3();
  function tick(t, dt, cmdPos, cmdFace = 0) {
    sky.material.uniforms.t.value = t; veil.material.uniforms.t.value = t;
    halo.rotation.y = t * 0.12; halo.children[1].rotation.z = t * 0.4; crystal.rotation.y = t * 0.6; crystal.position.y = Math.sin(t * 1.2) * 0.4;
    rays.forEach((r, i) => { r.material.opacity = 0.014 + Math.sin(t * 0.8 + i) * 0.007; });
    colFires.forEach((f, i) => { f.scale.y = 0.85 + Math.sin(t * 10 + i) * 0.12 + Math.sin(t * 23 + i * 2) * 0.05; f.rotation.y = t + i; });
    for (const b of braziers) { b.fire.scale.y = 0.85 + Math.sin(t * 9 + b.ph) * 0.15; b.fire.rotation.y = t * 0.9 + b.ph; b.light.intensity = 30 * (0.85 + Math.sin(t * 12 + b.ph) * 0.12); }
    seal.material.opacity = 0.55 + Math.sin(t * 2) * 0.15; seal.rotation.z = t * 0.15;
    for (const s of clouds.children) { s.position.x += dt * s.userData.v; if (s.position.x > 230) s.position.x -= 460; }
    for (let i = 0; i < N; i++) { let y = mp[i * 3 + 1] + dt * ms[i] * 0.8; if (y > 22) y = 0; mp[i * 3 + 1] = y; mp[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.08; }
    motes.geometry.attributes.position.needsUpdate = true;
    gateK += ((gateOpen ? 1 : 0) - gateK) * Math.min(1, dt * 1.2);
    leaves.forEach((h, i) => (h.rotation.y = (i ? -1 : 1) * gateK * 1.6));
    if (stage >= 8) { crown.rotation.z = t * 0.6; crown.position.y = 6.6 + Math.sin(t * 1.5) * 0.12; platBeam.material.opacity = 0.06 + Math.sin(t * 2) * 0.02; crest.rotation.z = Math.sin(t * 0.5) * 0.05; }
    const local = tmp.copy(cmdPos); local.x -= HX;
    const onSeal = false;
    if (onSeal && !kneeling) { kneeling = true; warriors.forEach((w, i) => { if (!w.ghost) setTimeout(() => w.hero.kneel(3), i * 120); }); }
    if (!onSeal && Math.hypot(local.x, local.z - HEAVEN.seal.z) > 4) kneeling = false;
    cageDoor.rotation.y = -cageOpen * 1.6; cageRune.material.opacity = 0.3 + Math.sin(t * 2) * 0.1;
    if (following) {
      const cx = cmdPos.x - HX, cz = cmdPos.z, fx = Math.sin(cmdFace), fz = Math.cos(cmdFace);
      warriors.forEach((w, i) => {
        if (w.ghost || scripted.has(w)) return;
        const row = Math.floor(i / 2) + 1, side = i % 2 ? -1 : 1;
        const tx = cx - fx * (1.8 * row) + fz * side * 1.3, tz = cz - fz * (1.8 * row) - fx * side * 1.3;
        const p = w.hero.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        const sp = Math.min(d, dt * Math.min(7, 1.5 + d * 1.5));
        if (d > 0.3) { p.x += (dx / d) * sp; p.z += (dz / d) * sp; w.yaw = Math.atan2(dx, dz); }
        else w.yaw += Math.atan2(Math.sin(cmdFace - w.yaw), Math.cos(cmdFace - w.yaw)) * Math.min(1, dt * 3);
        w.hero.root.rotation.y = w.yaw; w.hero.root.position.y = platTop(p.x, p.z);
        w.hero.update(t, dt, d > 0.3 ? Math.min(1, d) : 0, false);
        w.cape.rotation.x = 0.1 + Math.min(0.4, d * 0.1);
      });
    }
    for (const w of warriors) {
      if (following && !w.ghost && !scripted.has(w)) continue;
      if (scripted.has(w)) { w.hero.update(t, dt, w.walk || 0, false); continue; }
      if (focus) { const want = Math.atan2(focus.x - w.x, focus.z - w.z); let d = want - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 3); w.hero.root.rotation.y = w.yaw; w.hero.update(t, dt, 0, false); continue; }
      // Face the commander when he is close (or on the seal), else face the aisle.
      const dx = local.x - w.x, dz = local.z - w.z, near = Math.hypot(dx, dz) < 7 || onSeal;
      const want = near && !w.ghost ? Math.atan2(dx, dz) : w.base;
      let d = want - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 4); w.hero.root.rotation.y = w.yaw;
      if (!w.ghost && !onSeal && Math.hypot(dx, dz) < 3.6 && t - w.last > 6 && !w.hero.busy()) { w.last = t; w.hero.salute(); }
      w.hero.update(t, dt, 0, false);
      w.hero.root.position.y = w.ghost ? 0.15 + Math.sin(t * 1.3 + w.x) * 0.12 : 0;
      w.cape.rotation.x = Math.sin(t * 1.4 + w.z) * 0.05;
      w.beam.material.opacity = (w.ghost ? 0.04 : 0.1) + Math.sin(t * 1.5 + w.z) * 0.03;
    }
  }

  const ownedCount = warriors.filter((w) => !w.ghost).length;
  // Rain and snow falling across the hall.
  const PR = 1800, pr = new Float32Array(PR * 6);
  for (let i = 0; i < PR; i++) { const x = (rnd() - 0.5) * 56, y = rnd() * 30, z = (rnd() - 0.5) * 56; pr.set([x, y, z, x, y - 0.8, z], i * 6); }
  const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pr, 3)), new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.45 }));
  rain.frustumCulled = false; rain.visible = false; g.add(rain);
  const SN = 1500, sn = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) sn.set([(rnd() - 0.5) * 56, rnd() * 30, (rnd() - 0.5) * 56], i * 3);
  const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sn, 3)), new THREE.PointsMaterial({ map: puff, color: 0xffffff, size: 0.3, transparent: true, depthWrite: false }));
  snow.frustumCulled = false; snow.visible = false; g.add(snow);
  const flash = new THREE.AmbientLight(0xdfe8ff, 0); lights.add(flash);

  // Time of day (sun elevation from the city's prayer times) and weather.
  let W = WEATHER.clear, kind = 'clear', night = 0, nextBolt = 5;
  const tint = new THREE.Color();
  const applySky = ({ elev = 30, pm = false } = {}) => {
    night = THREE.MathUtils.clamp((3 - elev) / 13, 0, 1);
    const goldK = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 14, 0, 1) * (1 - night);
    const u = sky.material.uniforms; u.night.value = night; u.gold.value = goldK; u.dim.value = W.dim;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -10)), pm ? -2.4 : 0.8);
    u.sun.value.copy(night > 0.5 ? new THREE.Vector3(-0.4, 0.55, -0.7) : sunDir);
    key.position.copy(night > 0.5 ? new THREE.Vector3(-0.4, 0.55, -0.7) : sunDir).setLength(50).add(new THREE.Vector3(0, 10, 0));
    key.color.set(night > 0.5 ? 0x9fb4e6 : 0xfff0d8).lerp(tint.set(0xffa860), goldK * 0.7);
    key.intensity = THREE.MathUtils.lerp(1.8, 0.45, night) * (1 - W.dim * 0.6);
    hemi.intensity = THREE.MathUtils.lerp(0.75, 0.3, night) * (1 - W.dim * 0.25);
    hemi.color.set(night > 0.5 ? 0x5a68b0 : 0xc9d2ff);
    for (const m of cloudMats) m.color.set(0xffffff).lerp(tint.set(0xffc49a), goldK * 0.6).lerp(tint.set(0x8a90a0), W.dim * 0.7).lerp(tint.set(0x2a3150), night * 0.85);
    rain.visible = W.rain > 0; snow.visible = W.snow > 0;
    return 0.85 + night * 0.15;   // exposure for this hour
  };
  const setWeather = (k, info) => { kind = k in WEATHER ? k : 'clear'; W = WEATHER[kind]; return applySky(info); };
  const fogFor = () => ({ color: tint.set(0x8f86c8).lerp(new THREE.Color(0xb8bcc4), W.dim).lerp(new THREE.Color(0x141830), night * 0.8).getHex(), density: 0.0035 + W.fog * 0.02 });
  const weatherTick = (t, dt) => {
    if (rain.visible) { const sp = 40 * dt; for (let i = 0; i < PR; i++) { const o = i * 6; let y = pr[o + 1] - sp; if (y < 0) y = 30; pr[o + 1] = y; pr[o + 4] = y - 0.8; } rain.geometry.attributes.position.needsUpdate = true; }
    if (snow.visible) { for (let i = 0; i < SN; i++) { const o = i * 3; let y = sn[o + 1] - dt * 1.6; if (y < 0) y = 30; sn[o + 1] = y; sn[o] += Math.sin(t + i) * dt * 0.4; } snow.geometry.attributes.position.needsUpdate = true; }
    if (kind === 'storm' && t > nextBolt) { flash.intensity = 4; nextBolt = t + 4 + Math.random() * 8; return true; }
    flash.intensity *= 0.86;
    return false;
  };

  return {
    group: g, lights, tick, blocked, clamp, applySky, setWeather, fogFor, weatherTick, entrance: new THREE.Vector3(HX, 0, 19.5), door: HEAVEN.door, seal: HEAVEN.seal, ownedCount, total: warriors.length,
    // the platform and the story
    stage, complete: stage >= warriors.length, warriors,
    groundAt: (x, z) => platTop(x - HX, z),
    platform: new THREE.Vector3(HX, 0.9, HEAVEN.seal.z),
    gateOut: new THREE.Vector3(HX + 22, 0, 0),
    atGate: (p) => gateOpen && p.x - HX > 24.5 && Math.abs(p.z) < 2,
    openGate() { gateOpen = true; },
    setFocus(v) { focus = v ? new THREE.Vector3(v.x - HX, 0, v.z) : null; },
    script(w, on) { if (on) scripted.add(w); else { scripted.delete(w); w.walk = 0; } },
    cage: CAGE.clone().add(new THREE.Vector3(HX, 0, 0)), cageLocal: CAGE.clone(),
    setCageOpen(v) { cageOpen = v; },
    follow(on) { following = on; },
    arrange(at, skip) { let i = 0; warriors.forEach((w) => { if (w.ghost || w === skip) return; const v = at(i++); w.hero.root.position.copy(v); w.yaw = Math.atan2(-6.5 - v.x, 4.5 - v.z); w.hero.root.rotation.y = w.yaw; }); },
    sendHome() { warriors.forEach((w) => { w.hero.root.position.copy(w.home); w.yaw = w.base; w.hero.root.rotation.y = w.base; }); },
    local: (v) => new THREE.Vector3(v.x - HX, v.y, v.z),
  };
}
