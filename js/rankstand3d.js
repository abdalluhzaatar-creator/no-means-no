// The rank tree: a golden tree on a marble stand inside a dimension. Every rank
// (Bronze 1 … Platinum 3) floats beside it as a medallion, left and right, upwards.
// Earned ranks shine, the current one glows, the rest wait as glass. An arrow
// labelled "15 يوم" points from the current rank to the next one and fills up
// with the 15-day key counter. View only: tapping it opens the rank ladder.
import * as THREE from './vendor/three.module.min.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });

// Text sprite (Arabic, right to left).
function label(lines, { w = 512, h = 160, bg = 'rgba(18,24,30,.78)', fg = '#fff', scale = 1.6 } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(scale * (w / h), scale, 1);
  const draw = (ls, color = fg) => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, h / 2.6); g.fill();
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    const n = ls.length;
    ls.forEach((t, i) => { g.font = `${i ? 600 : 800} ${i ? h * 0.24 : h * (n > 1 ? 0.34 : 0.46)}px Tajawal, system-ui, sans-serif`; g.fillText(t, w / 2, h * ((i + 1) / (n + 1)) + (n > 1 ? (i ? -h * 0.04 : h * 0.04) : 0)); });
    tex.needsUpdate = true;
  };
  draw(lines);
  return { sprite, draw };
}

// ranks: [{ name, color }], current: 0-based index, keyDays / keyEvery: the 15-day counter.
export function buildRankStand({ ranks, current = 0, keyDays = 0, keyEvery = 15 }) {
  const root = new THREE.Group();
  const gold = std(0xd4a53a, { metalness: 0.55, roughness: 0.3, emissive: 0x5a3c08, emissiveIntensity: 0.35 });
  const marble = std(0xf4f0e6, { roughness: 0.3 });
  const glassRing = std(0xcfe6ff, { transparent: true, opacity: 0.3 });

  // Stand: stepped marble pedestal with a gold rim.
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.35, 32), marble); base1.position.y = 0.175;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.35, 32), marble); base2.position.y = 0.52;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.05, 8, 48), gold); rim.rotation.x = Math.PI / 2; rim.position.y = 0.7;
  root.add(base1, base2, rim);

  // Medallion positions: alternating left / right up the tree, all facing the front (+z).
  const N = ranks.length, R = 1.45, Y0 = 1.6, DY = 0.62;
  const at = (i) => new THREE.Vector3((i % 2 ? -1 : 1) * R, Y0 + i * DY, 0.25);

  // Trunk: a gently twisting golden tube up the middle, with a branch reaching toward each rank.
  const trunkPts = Array.from({ length: 9 }, (_, k) => new THREE.Vector3(Math.sin(k * 0.9) * 0.12, 0.7 + k * ((Y0 + (N - 1) * DY + 0.3 - 0.7) / 8), Math.cos(k * 1.1) * 0.12));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 48, 0.16, 10), gold); root.add(trunk);
  for (let i = 0; i < N; i++) {
    const p = at(i), start = new THREE.Vector3(0, p.y - 0.35, 0), end = p.clone().multiplyScalar(0.62).setY(p.y - 0.05);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.15, 0));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 12, 0.045, 6), gold));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold); leaf.position.copy(end); root.add(leaf);
  }
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), std(0xffe7a8, { emissive: 0xffc56b, emissiveIntensity: 0.8, metalness: 0.6 }));
  crown.position.y = Y0 + (N - 1) * DY + 0.75; root.add(crown);

  // Medallions (they float: no physical link to the branches).
  const meds = ranks.map((r, i) => {
    const g = new THREE.Group(); g.position.copy(at(i));
    const color = new THREE.Color(r.color);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 36), std(color, { metalness: 0.5, roughness: 0.3 }));
    disc.rotation.x = Math.PI / 2; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 8, 40), gold); g.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), std(0xffffff, { metalness: 0.4, roughness: 0.1 })); gem.position.z = 0.06; gem.scale.z = 0.4; g.add(gem);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 48), new THREE.MeshBasicMaterial({ color: 0xffe7a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(halo);
    const tag = label([r.name], { w: 320, h: 96, scale: 0.3 }); tag.sprite.position.y = 0.5; g.add(tag.sprite);
    root.add(g);
    return { g, disc, ring, gem, halo, tag, base: g.position.y, ph: i * 0.7, name: r.name, color };
  });

  // Arrow from the current rank to the next: faded track, bright part = progress, head at the next rank.
  const arrow = new THREE.Group(); root.add(arrow);
  const arrowTag = label(['15 يوم', '0/15'], { w: 420, h: 170, scale: 0.62, bg: 'rgba(42,30,10,.85)', fg: '#ffe7a8' });
  root.add(arrowTag.sprite);

  let cur = current;
  const setRank = (c, days, every) => {
    cur = Math.max(0, Math.min(N - 1, c));
    meds.forEach((m, i) => {
      const earned = i < cur, now = i === cur, ahead = i > cur;
      m.disc.material.transparent = ahead; m.disc.material.opacity = ahead ? 0.28 : 1;
      m.disc.material.emissive.copy(now ? m.color : new THREE.Color(0));
      m.disc.material.emissiveIntensity = now ? 0.6 : 0.12; if (!now) m.disc.material.emissive.copy(ahead ? new THREE.Color(0) : m.color);
      m.ring.material = ahead ? glassRing : gold;
      m.gem.visible = !ahead;
      m.halo.material.opacity = now ? 0.55 : 0;
      m.g.scale.setScalar(now ? 1.45 : earned ? 1 : 0.85);
      m.tag.draw([(earned ? '✔ ' : '') + m.name], now ? '#ffe7a8' : ahead ? 'rgba(255,255,255,.55)' : '#fff');
    });
    arrow.clear();
    const next = cur + 1;
    arrow.visible = arrowTag.sprite.visible = next < N;
    if (next >= N) return;
    const a = meds[cur].g.position.clone(), b = meds[next].g.position.clone();
    const bulge = a.clone().add(b).multiplyScalar(0.5).setZ(1.1);
    const curve = new THREE.QuadraticBezierCurve3(a.clone().lerp(bulge, 0.25), bulge, b.clone().lerp(bulge, 0.3));
    arrow.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })));
    const k = Math.max(0, Math.min(1, days / every));
    if (k > 0.01) {
      const part = new THREE.CatmullRomCurve3(curve.getPoints(24).slice(0, Math.max(2, Math.round(24 * k) + 1)));
      arrow.add(new THREE.Mesh(new THREE.TubeGeometry(part, 24, 0.06, 8), new THREE.MeshBasicMaterial({ color: 0xffc83d, toneMapped: false })));
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 12), new THREE.MeshBasicMaterial({ color: k >= 1 ? 0xffc83d : 0xffe7a8, toneMapped: false }));
    head.position.copy(curve.getPoint(1));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1).normalize());
    arrow.add(head);
    arrowTag.sprite.position.copy(bulge).setZ(1.5).setY(bulge.y - 0.05);
    arrowTag.draw([`${every} يوم`, `${days}/${every}`]);
  };
  setRank(current, keyDays, keyEvery);

  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  return {
    root,
    update({ current: c, keyDays: d, keyEvery: e = 15 }) { setRank(c, d, e); },
    tick(t) {
      meds.forEach((m, i) => {
        m.g.position.y = m.base + Math.sin(t * 1.4 + m.ph) * 0.07;
        m.disc.rotation.z = Math.sin(t * 0.8 + m.ph) * 0.25;
        if (i === cur) m.halo.material.opacity = 0.4 + Math.sin(t * 3) * 0.2;
      });
      crown.rotation.y = t * 0.8;
      arrowTag.sprite.position.y += Math.sin(t * 2) * 0.0015;
    },
  };
}
