// A small rank stand inside a dimension: a marble pedestal with a gold post, and
// two medallions floating above it — the current rank (glowing) and the next one
// (glass). An arrow labelled "15 يوم" with the key counter points from the current
// rank to the next. View only: tapping it opens the rank ladder.
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
    ls.forEach((t, i) => { g.font = `${i ? 600 : 800} ${i ? h * 0.24 : h * (n > 1 ? 0.34 : 0.46)}px Tajawal, system-ui, sans-serif`; g.fillText(t, w / 2, n > 1 ? h * (i ? 0.74 : 0.37) : h / 2); });
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

  // Pedestal + post.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 24), marble); base.position.y = 0.09;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 16), marble); col.position.y = 0.63;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.1, 24), gold); cap.position.y = 1.12;
  root.add(base, col, cap);

  // Medallion: disc + gold ring + gem + name tag. Current at the viewer's right, next higher at the left.
  const medal = (pos, size, labelY) => {
    const g = new THREE.Group(); g.position.copy(pos); g.scale.setScalar(size);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 36), std(0xffffff, { metalness: 0.5, roughness: 0.3 })); disc.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 40), gold);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), std(0xffffff, { metalness: 0.4, roughness: 0.1 })); gem.position.z = 0.05; gem.scale.z = 0.4;
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.52, 48), new THREE.MeshBasicMaterial({ color: 0xffe7a8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const tag = label([''], { w: 320, h: 96, scale: 0.24 }); tag.sprite.position.y = labelY;
    g.add(disc, ring, gem, halo, tag.sprite); root.add(g);
    return { g, disc, ring, gem, halo, tag, base: pos.y };
  };
  const now = medal(new THREE.Vector3(0.4, 1.95, 0.05), 1.1, -0.47);
  const next = medal(new THREE.Vector3(-0.45, 2.65, 0.05), 0.85, 0.5);
  next.disc.material.transparent = true; next.disc.material.opacity = 0.35;
  next.ring.material = std(0xcfe6ff, { transparent: true, opacity: 0.4 });
  next.gem.visible = false;
  now.disc.material.emissiveIntensity = 0.6;

  const arrow = new THREE.Group(); root.add(arrow);
  const arrowTag = label(['15 يوم', '0/15'], { w: 380, h: 160, scale: 0.36, bg: 'rgba(42,30,10,.85)', fg: '#ffe7a8' });
  arrowTag.sprite.position.set(0.46, 2.58, 0.3); root.add(arrowTag.sprite);

  const setRank = (c, days, every) => {
    const i = Math.max(0, Math.min(ranks.length - 1, c)), r = ranks[i], nr = ranks[i + 1];
    now.disc.material.color.set(r.color); now.disc.material.emissive.set(r.color);
    now.tag.draw([r.name], '#ffe7a8');
    next.g.visible = arrow.visible = arrowTag.sprite.visible = !!nr;
    arrow.clear();
    if (!nr) { now.tag.draw([r.name + ' 🏆'], '#ffe7a8'); return; }
    next.disc.material.color.set(nr.color);
    next.tag.draw([nr.name], 'rgba(255,255,255,.7)');
    // Curved arrow in front, from the current medallion up to the next.
    const a = now.g.position.clone().add(new THREE.Vector3(-0.2, 0.25, 0.1)), b = next.g.position.clone().add(new THREE.Vector3(0.28, -0.05, 0.1));
    const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(-0.05, 2.5, 0.35), b);
    arrow.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.018, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })));
    const k = Math.max(0, Math.min(1, days / every));
    if (k > 0.02) {
      const part = new THREE.CatmullRomCurve3(curve.getPoints(20).slice(0, Math.max(2, Math.round(20 * k) + 1)));
      arrow.add(new THREE.Mesh(new THREE.TubeGeometry(part, 20, 0.032, 6), new THREE.MeshBasicMaterial({ color: 0xffc83d, toneMapped: false })));
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 10), new THREE.MeshBasicMaterial({ color: 0xffe7a8, toneMapped: false }));
    head.position.copy(curve.getPoint(1)); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1).normalize());
    arrow.add(head);
    arrowTag.draw([`${every} يوم`, `${days}/${every}`]);
  };
  setRank(current, keyDays, keyEvery);
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });

  return {
    root,
    update({ current: c, keyDays: d, keyEvery: e = 15 }) { setRank(c, d, e); },
    tick(t) {
      for (const [m, ph] of [[now, 0], [next, 1.7]]) { m.g.position.y = m.base + Math.sin(t * 1.5 + ph) * 0.05; m.disc.rotation.z = Math.sin(t * 0.8 + ph) * 0.2; }
      now.halo.material.opacity = 0.25 + Math.sin(t * 3) * 0.1;
    },
  };
}
