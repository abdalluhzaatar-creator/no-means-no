// SVG art. Characters change with level; regions draw one extra element per
// upgrade (the `adds` key in content.js). To give a new region its own look,
// add a drawer to REGION_DRAWERS keyed by region id.

const glowId = () => 'g' + Math.random().toString(36).slice(2, 7);

// ---------- Characters ----------
export function characterSVG(def, level = 1, { size = 120, locked = false } = {}) {
  const p = locked ? { robe: '#555', accent: '#444', skin: '#666', glow: '#777' } : def.palette;
  const g = glowId();
  const aura = locked ? 0 : 18 + level * 3;
  const holdsBook = def.id === 'scholar';
  return `
<svg viewBox="0 0 120 150" width="${size}" height="${size * 1.25}" class="char-svg ${locked ? 'locked' : ''}" aria-label="${def.name}">
  <defs><radialGradient id="${g}"><stop offset="0" stop-color="${p.glow}" stop-opacity=".75"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs>
  ${aura ? `<circle cx="60" cy="72" r="${aura + 22}" fill="url(#${g})" class="aura"/>` : ''}
  <ellipse cx="60" cy="138" rx="${holdsBook ? 30 : 44}" ry="7" fill="${holdsBook ? '#00000030' : p.accent}" opacity=".85"/>
  ${!holdsBook ? `<ellipse cx="60" cy="138" rx="36" ry="4" fill="none" stroke="${p.glow}" stroke-width="1" opacity=".6"/>` : ''}
  <path d="M38 136 L44 72 Q60 62 76 72 L82 136 Z" fill="${p.robe}"/>
  ${level >= 4 ? `<path d="M46 76 L74 118" stroke="${p.accent}" stroke-width="5" stroke-linecap="round"/>` : ''}
  ${holdsBook
    ? `<rect x="44" y="84" width="32" height="22" rx="2" fill="${p.accent}"/><line x1="60" y1="84" x2="60" y2="106" stroke="${p.robe}" stroke-width="1.5"/>`
    : `<path d="M47 90 Q60 98 73 90" stroke="${p.skin}" stroke-width="6" fill="none" stroke-linecap="round"/>`}
  <circle cx="60" cy="54" r="14" fill="${p.skin}"/>
  ${holdsBook ? `<path d="M46 50 Q60 34 74 50 Z" fill="${level >= 6 ? '#d9b24c' : p.robe}" stroke="${p.accent}" stroke-width="1"/>`
    : `<path d="M46 52 Q46 38 60 38 Q74 38 74 52 Q70 44 60 45 Q50 44 46 52Z" fill="${locked ? '#555' : '#2a1d14'}"/>`}
  ${level >= 3 || !holdsBook ? `<path d="M47 56 Q49 70 60 71 Q71 70 73 56 Q68 64 60 64 Q52 64 47 56Z" fill="${locked ? '#555' : '#2a1d14'}"/>` : ''}
  ${level >= 8 ? Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return `<circle cx="${60 + Math.cos(a) * 34}" cy="${60 + Math.sin(a) * 34}" r="2" fill="${p.glow}" class="orbit" style="animation-delay:${i * 0.3}s"/>`;
  }).join('') : ''}
  ${locked ? `<text x="60" y="100" text-anchor="middle" font-size="30">🔒</text>` : ''}
</svg>`;
}

// ---------- Regions ----------
function sanctuary(f) {
  const g = glowId(), fl = glowId();
  const night = f.has('stars');
  const arch = (x, w, h, y) => `<path d="M${x} ${y} V${y - h + w / 2} Q${x + w / 2} ${y - h - w * 0.35} ${x + w} ${y - h + w / 2} V${y}" fill="#2d2a28"/>`;
  return `
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#10193a' : '#7fb8e6'}"/><stop offset="1" stop-color="${night ? '#3b4a7a' : '#dff0fb'}"/></linearGradient>
    <pattern id="${fl}" width="26" height="14" patternUnits="userSpaceOnUse"><rect width="26" height="14" fill="#efe9dc"/><rect width="13" height="7" fill="#e0d8c7"/><rect x="13" y="7" width="13" height="7" fill="#e0d8c7"/></pattern>
  </defs>
  <rect width="400" height="260" fill="url(#${g})"/>
  ${night ? Array.from({ length: 28 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 90}" r="${i % 3 ? 1 : 1.6}" fill="#fff" class="twinkle" style="animation-delay:${(i % 7) * 0.4}s"/>`).join('') : ''}
  <path d="M0 150 Q80 120 160 140 T400 130 V170 H0Z" fill="#8fb36a"/>
  <!-- palace hall -->
  <rect x="120" y="95" width="160" height="90" fill="#f3ece0"/>
  <rect x="165" y="70" width="70" height="115" fill="#eadfc8"/>
  <path d="M175 185 V120 Q200 88 225 120 V185Z" fill="#2f7a8a"/>
  <path d="M188 185 V140 Q200 124 212 140 V185Z" fill="#5a3a22"/>
  <rect x="172" y="62" width="56" height="10" fill="#eadfc8"/>
  <path d="M166 62 Q200 -2 234 62Z" fill="#2f7a8a"/><rect x="198" y="18" width="4" height="12" fill="#d4a53a"/>
  ${[110, 290].map((x) => `<rect x="${x - 6}" y="40" width="12" height="145" fill="#eadfc8"/><path d="M${x - 9} 42 Q${x} 18 ${x + 9} 42Z" fill="#2f7a8a"/>`).join('')}
  ${[135, 255].map((x) => arch(x, 14, 30, 150)).join('')}
  <!-- arcades -->
  <rect x="0" y="130" width="100" height="60" fill="#eadfc8"/><rect x="300" y="130" width="100" height="60" fill="#eadfc8"/>
  ${[8, 38, 68, 308, 338, 368].map((x) => arch(x, 22, 44, 190)).join('')}
  <rect x="0" y="126" width="100" height="6" fill="#2f7a8a"/><rect x="300" y="126" width="100" height="6" fill="#2f7a8a"/>
  <!-- marble courtyard -->
  <path d="M0 185 H400 V260 H0Z" fill="url(#${fl})"/>
  <path d="M188 185 H212 L226 260 H174Z" fill="#2c8aa6" opacity=".85"/>
  ${[60, 340].map((x) => `<ellipse cx="${x}" cy="150" rx="9" ry="34" fill="#2f5a2e"/>`).join('')}
  ${f.has('palms') ? [30, 370].map((x) => `<g transform="translate(${x},215)"><rect x="-10" y="0" width="20" height="16" fill="#b8683f"/><circle cy="-10" r="16" fill="#3e7a33"/><circle cx="-6" cy="-14" r="3" fill="#f29a2e"/><circle cx="7" cy="-6" r="3" fill="#f29a2e"/></g>`).join('') : ''}
  ${f.has('arch') ? `<path d="M150 250 V175 Q200 120 250 175 V250" fill="none" stroke="#f1e6cc" stroke-width="9"/>` : ''}
  ${f.has('fountain') ? `<g transform="translate(300,238)"><ellipse rx="30" ry="7" fill="#7fb7c4"/><rect x="-4" y="-24" width="8" height="22" fill="#e9e4d8"/><path d="M0 -24 q-14 -6 -20 14 M0 -24 q14 -6 20 14" stroke="#bfe3ea" stroke-width="2" fill="none" class="water"/></g>` : ''}
  ${f.has('lanterns') ? [110, 290].map((x) => `<g transform="translate(${x},200)"><line y1="0" y2="30" stroke="#3a3128" stroke-width="2"/><rect x="-6" y="-14" width="12" height="16" rx="3" fill="#f4d58d" class="flicker"/><circle cy="-6" r="14" fill="#f4d58d" opacity=".25"/></g>`).join('') : ''}`;
}

function library(f, theme) {
  const g = glowId();
  return `
  <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.sky[0]}"/><stop offset="1" stop-color="${theme.sky[1]}"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#${g})"/>
  <!-- tall reading hall: stone walls, arched windows with moonlight, wooden floor -->
  <rect y="0" width="400" height="200" fill="#3a3040"/>
  ${[40, 120, 280, 360].map((x) => `<path d="M${x - 18} 150 V70 Q${x} 40 ${x + 18} 70 V150Z" fill="#8fb0d8" opacity=".55"/><path d="M${x} 150 V56 M${x - 18} 100 H${x + 18}" stroke="#2a2230" stroke-width="3"/>`).join('')}
  ${[0, 400].map((x) => `<rect x="${x ? 350 : 0}" y="20" width="50" height="180" fill="#4b3a2a"/>${[40, 80, 120, 160].map((y) => `<rect x="${(x ? 350 : 0) + 3}" y="${y}" width="44" height="3" fill="#2d2118"/>${Array.from({ length: 5 }, (_, i) => `<rect x="${(x ? 350 : 0) + 5 + i * 8.5}" y="${y - 22}" width="7" height="22" fill="${['#8e3b3b', '#2f4a6d', '#c9a45c', '#3f7d6e'][(i + y / 40) % 4]}"/>`).join('')}`).join('')}`).join('')}
  <rect y="200" width="400" height="60" fill="#6b4a30"/>
  ${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 40}" y="200" width="2" height="60" fill="#553a25"/>`).join('')}
  <path d="M140 200 H260 L290 260 H110Z" fill="#8e2a2c" opacity=".8"/>
  ${f.has('window') ? `<g transform="translate(200,70)"><path d="M-40 40 V-10 Q0 -60 40 -10 V40Z" fill="#0f1a2c" stroke="#c9a45c" stroke-width="4"/><circle cx="12" cy="-6" r="10" fill="#f7e7b5"/></g>` : ''}
  ${f.has('shelves') ? [20, 310].map((x) => `<g transform="translate(${x},70)"><rect width="70" height="130" fill="#5a4330"/>${[10, 50, 90].map((y) => `<rect x="4" y="${y + 30}" width="62" height="4" fill="#3d2d20"/>${Array.from({ length: 7 }, (_, i) => `<rect x="${6 + i * 8.5}" y="${y + 4}" width="7" height="26" fill="${['#8e3b3b', '#2f4a6d', '#c9a45c', '#3f7d6e'][(i + y) % 4]}"/>`).join('')}`).join('')}</g>`).join('') : ''}
  ${f.has('desk') ? `<g transform="translate(250,190)"><rect x="-50" y="-6" width="100" height="10" fill="#7a5a3c"/><rect x="-44" y="4" width="8" height="18" fill="#5a4330"/><rect x="36" y="4" width="8" height="18" fill="#5a4330"/><rect x="-20" y="-14" width="30" height="8" fill="#f1e6cc"/><circle cx="30" cy="-18" r="10" fill="#f4d58d" opacity=".4" class="flicker"/></g>` : ''}
  ${f.has('globe') ? `<g transform="translate(120,180)"><line y1="0" y2="20" stroke="#c9a45c" stroke-width="3"/><circle cy="-10" r="16" fill="#3f7d6e"/><path d="M-10 -18 q6 6 2 12 q8 2 10 10" stroke="#c9a45c" fill="none" stroke-width="2"/></g>` : ''}`;
}

const REGION_DRAWERS = { sanctuary, library };

export function regionSVG(def, features, characterMarkup = '', { locked = false } = {}) {
  const draw = REGION_DRAWERS[def.id] || sanctuary;
  return `
<svg viewBox="0 0 400 260" class="region-svg ${locked ? 'locked' : ''}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${def.name}">
  ${draw(features, def.theme)}
  ${characterMarkup ? `<g transform="translate(160,92)">${characterMarkup}</g>` : ''}
  ${locked ? `<rect width="400" height="260" fill="#000" opacity=".55"/><text x="200" y="145" text-anchor="middle" font-size="44">🔒</text>` : ''}
</svg>`;
}

// ---------- World map with fog of war ----------
// spots: [{ def, vis: 'owned'|'teaser'|'hidden', scene: regionSVG markup (owned only) }]
// The world is a large pannable land. Region coords in content.js (0..1000 × 0..700)
// sit in the middle of it; everything around is wilderness hidden under thick clouds.
export const WORLD = { w: 2800, h: 2000, ox: 900, oy: 650 };

// Deterministic pseudo-random so the world looks the same every render.
function rng(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// Irregular closed blob around (cx, cy).
function blob(rand, cx, cy, rx, ry, n = 14, jag = 0.22) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, k = 1 - jag + rand() * jag * 2;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).join(' ')}`;
  pts.forEach((p, i) => { const m = mid(p, pts[(i + 1) % n]); d += ` Q${p[0].toFixed(0)} ${p[1].toFixed(0)} ${m[0].toFixed(0)} ${m[1].toFixed(0)}`; });
  return d + 'Z';
}

export function worldMapSVG(spots) {
  const { w: W, h: H, ox, oy } = WORLD;
  const rand = rng(7);
  const shown = spots.filter((s) => s.vis !== 'hidden')
    .map((s) => ({ ...s, x: s.def.map.x + ox, y: s.def.map.y + oy }));
  const owned = shown.filter((s) => s.vis === 'owned');
  const teasers = shown.filter((s) => s.vis === 'teaser');
  const R = 72;
  const cx = W / 2, cy = H / 2;

  const mountains = Array.from({ length: 70 }, () => {
    const a = rand() * Math.PI * 2, d = 0.45 + rand() * 0.45;
    return [cx + Math.cos(a) * W * 0.42 * d, cy + Math.sin(a) * H * 0.4 * d, 30 + rand() * 40];
  }).filter(([x, y]) => !shown.some((s) => Math.hypot(s.x - x, s.y - y) < 190));
  const trees = Array.from({ length: 260 }, () => [W * 0.12 + rand() * W * 0.76, H * 0.12 + rand() * H * 0.76, 8 + rand() * 8])
    .filter(([x, y]) => !shown.some((s) => Math.hypot(s.x - x, s.y - y) < 150));

  const terrain = `
  <defs>
    <radialGradient id="sea" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#6fb0c4"/><stop offset="1" stop-color="#3f7f99"/></radialGradient>
    <pattern id="waves" width="90" height="40" patternUnits="userSpaceOnUse"><path d="M5 20 q12 -10 24 0 t24 0" fill="none" stroke="#a9d6e2" stroke-width="3" opacity=".5"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sea)"/>
  <rect width="${W}" height="${H}" fill="url(#waves)"/>
  <path d="${blob(rand, cx, cy, W * 0.46, H * 0.44, 22, 0.12)}" fill="#e9dcb4" stroke="#f6efd6" stroke-width="18"/>
  <path d="${blob(rand, cx, cy, W * 0.44, H * 0.42, 22, 0.1)}" fill="#e6d3a8"/>
  <path d="${blob(rand, cx - W * 0.2, cy + H * 0.18, 380, 240)}" fill="#d8c08e"/>
  <path d="${blob(rand, cx + W * 0.22, cy - H * 0.2, 420, 260)}" fill="#cfe0a8" opacity=".8"/>
  <path d="${blob(rand, cx - W * 0.25, cy - H * 0.22, 360, 220)}" fill="#bfd49a" opacity=".8"/>
  <path d="${blob(rand, cx + W * 0.26, cy + H * 0.22, 330, 200)}" fill="#e2c890"/>
  <path d="${blob(rand, cx + W * 0.08, cy + H * 0.33, 150, 90)}" fill="#7fb7c4" stroke="#b9dde6" stroke-width="6"/>
  <path d="${blob(rand, cx - W * 0.33, cy - H * 0.02, 120, 80)}" fill="#7fb7c4" stroke="#b9dde6" stroke-width="6"/>
  <path d="M${W * 0.1} ${cy - 80} Q${ox + 150} ${oy + 330} ${ox + 260} ${oy + 250} T${ox + 520} ${oy + 230} Q${ox + 640} ${oy + 220} ${ox + 720} ${oy + 330} T${W * 0.9} ${cy + 260}" fill="none" stroke="#7fb7c4" stroke-width="20" stroke-linecap="round" opacity=".85"/>
  ${[[W * 0.15, H * 0.12], [W * 0.82, H * 0.1], [W * 0.88, H * 0.85], [W * 0.1, H * 0.88], [W * 0.5, H * 0.05]].map(([x, y]) =>
    `<path d="${blob(rand, x, y, 90, 55, 9)}" fill="#e6d3a8" stroke="#f6efd6" stroke-width="8"/><circle cx="${x}" cy="${y - 10}" r="12" fill="#6f9a73"/>`).join('')}
  ${mountains.map(([x, y, s]) => `<path d="M${x - s} ${y + s * 0.7} L${x} ${y - s} L${x + s} ${y + s * 0.7}Z" fill="#b89c6c"/><path d="M${x} ${y - s} L${x + s} ${y + s * 0.7} L${x + s * 0.2} ${y + s * 0.7}Z" fill="#a38658"/><path d="M${x - s * 0.3} ${y - s * 0.55} L${x} ${y - s} L${x + s * 0.3} ${y - s * 0.55}Z" fill="#f4ecd9"/>`).join('')}
  ${trees.map(([x, y, r]) => `<rect x="${x - 2}" y="${y + r - 2}" width="4" height="${r}" fill="#7a5a3c"/><circle cx="${x}" cy="${y}" r="${r}" fill="${rand() > 0.5 ? '#6f9a73' : '#5d8a63'}"/>`).join('')}
  ${owned.flatMap((o) => teasers.filter((t) => t.def.map.revealedBy === o.def.id).map((t) =>
    `<path d="M${o.x} ${o.y} Q${(o.x + t.x) / 2 + 40} ${(o.y + t.y) / 2 + 40} ${t.x} ${t.y}" fill="none" stroke="#8a6b45" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`)).join('')}`;

  // Thick cloud cover everywhere except soft holes around visible places.
  const puffs = [];
  for (let y = -60; y < H + 120; y += 110) {
    for (let x = -80; x < W + 160; x += 150) {
      const px = x + (rand() - 0.5) * 90, py = y + (rand() - 0.5) * 70;
      puffs.push([px, py, 90 + rand() * 110, rand()]);
    }
  }
  const fog = `
  <defs>
    <radialGradient id="hole"><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
    <radialGradient id="half"><stop offset=".35" stop-color="#777"/><stop offset="1" stop-color="#fff"/></radialGradient>
    <radialGradient id="puff"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f1f4f6"/><stop offset="1" stop-color="#dfe5ea" stop-opacity="0"/></radialGradient>
    <mask id="fogmask">
      <rect width="${W}" height="${H}" fill="#fff"/>
      ${owned.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="230" fill="url(#hole)"/>`).join('')}
      ${teasers.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="150" fill="url(#half)"/>`).join('')}
    </mask>
    ${shown.map((s) => `<clipPath id="clip-${s.def.id}"><circle cx="${s.x}" cy="${s.y}" r="${R}"/></clipPath>`).join('')}
  </defs>
  <g mask="url(#fogmask)">
    <rect width="${W}" height="${H}" fill="#d9dfe4"/>
    <g>${puffs.map(([x, y, r, k], i) => `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.62).toFixed(0)}" fill="url(#puff)" class="cloud${k > 0.5 ? ' alt' : ''}" style="animation-delay:${(-(i % 13) * 2.3).toFixed(1)}s"/>`).join('')}</g>
    <g opacity=".45">${puffs.filter((p) => p[3] > 0.6).map(([x, y, r]) => `<ellipse cx="${(x + 40).toFixed(0)}" cy="${(y + r * 0.35).toFixed(0)}" rx="${(r * 0.9).toFixed(0)}" ry="${(r * 0.3).toFixed(0)}" fill="#c3ccd4"/>`).join('')}</g>
  </g>`;

  const spotsMarkup = shown.map(({ def, vis, scene, x, y }) => {
    if (vis === 'owned') {
      const inner = scene.replace('<svg ', `<svg x="${x - R * 1.5}" y="${y - R}" width="${R * 3}" height="${R * 2}" `);
      return `
      <g class="spot owned" data-spot="${def.id}" tabindex="0" role="button" aria-label="${def.name}">
        <circle cx="${x}" cy="${y}" r="${R + 8}" fill="#f4d58d" opacity=".35" class="spot-glow"/>
        <g clip-path="url(#clip-${def.id})">${inner}</g>
        <circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="#c9962c" stroke-width="5"/>
        <rect x="${x - 80}" y="${y + R + 10}" width="160" height="34" rx="17" fill="#fffdf8" stroke="#c9962c"/>
        <text x="${x}" y="${y + R + 33}" text-anchor="middle" class="map-label">${def.name}</text>
      </g>`;
    }
    return `
      <g class="spot teaser" data-spot="${def.id}" tabindex="0" role="button" aria-label="${def.name}">
        <circle cx="${x}" cy="${y}" r="${R - 12}" fill="#3a4048" opacity=".75" stroke="#c9962c" stroke-width="4" stroke-dasharray="10 8" class="teaser-ring"/>
        <text x="${x}" y="${y + 14}" text-anchor="middle" font-size="40">🔒</text>
        <rect x="${x - 95}" y="${y + R - 2}" width="190" height="40" rx="20" fill="#c9962c"/>
        <text x="${x}" y="${y + R + 25}" text-anchor="middle" class="map-label price">افتح بـ ${def.cost?.keys ? `🗝 ${def.cost.keys}` : `🪙 ${def.cost?.gold ?? 0}`}</text>
      </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="world-map" role="img" aria-label="خريطة العالم">${terrain}${fog}${spotsMarkup}</svg>`;
}
