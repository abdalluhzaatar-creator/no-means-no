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
  <path d="M46 50 Q60 34 74 50 Z" fill="${level >= 6 ? '#d9b24c' : p.robe}" stroke="${p.accent}" stroke-width="1"/>
  ${level >= 3 ? `<path d="M50 62 Q60 72 70 62" fill="${locked ? '#555' : '#3b2e25'}" opacity=".85"/>` : ''}
  ${level >= 8 ? Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return `<circle cx="${60 + Math.cos(a) * 34}" cy="${60 + Math.sin(a) * 34}" r="2" fill="${p.glow}" class="orbit" style="animation-delay:${i * 0.3}s"/>`;
  }).join('') : ''}
  ${locked ? `<text x="60" y="100" text-anchor="middle" font-size="30">🔒</text>` : ''}
</svg>`;
}

// ---------- Regions ----------
function sanctuary(f, theme) {
  const g = glowId();
  return `
  <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.sky[0]}"/><stop offset="1" stop-color="${theme.sky[1]}"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#${g})"/>
  ${f.has('stars') ? Array.from({ length: 28 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 110}" r="${i % 3 ? 1 : 1.6}" fill="#fff" class="twinkle" style="animation-delay:${(i % 7) * 0.4}s"/>`).join('') : ''}
  <circle cx="320" cy="60" r="18" fill="#f7e7b5" opacity=".9"/><circle cx="328" cy="54" r="16" fill="${theme.sky[0]}" opacity=".95"/>
  <path d="M0 200 Q100 170 200 190 T400 185 V260 H0Z" fill="${theme.ground}"/>
  <path d="M0 215 Q120 200 240 212 T400 208 V260 H0Z" fill="#cbb58c"/>
  ${f.has('arch') ? `<path d="M150 205 V130 Q200 70 250 130 V205" fill="none" stroke="#f1e6cc" stroke-width="10"/><path d="M165 205 V135 Q200 92 235 135 V205" fill="#1d3b4f22"/>` : ''}
  ${f.has('palms') ? [40, 355].map((x) => `<g transform="translate(${x},200)"><path d="M0 0 Q-4 -40 4 -80" stroke="#6b4f33" stroke-width="7" fill="none"/>${[-60, -20, 20, 60, 100].map((a) => `<path d="M4 -80 q${Math.cos(a * Math.PI / 180) * 30} ${Math.sin(a * Math.PI / 180) * 10 - 10} ${Math.cos(a * Math.PI / 180) * 45} ${Math.sin(a * Math.PI / 180) * 25 + 5}" stroke="#3f7d6e" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}</g>`).join('') : ''}
  ${f.has('fountain') ? `<g transform="translate(300,205)"><ellipse rx="34" ry="8" fill="#7fb7c4"/><rect x="-4" y="-26" width="8" height="24" fill="#e9e4d8"/><path d="M0 -26 q-14 -6 -20 14 M0 -26 q14 -6 20 14" stroke="#bfe3ea" stroke-width="2" fill="none" class="water"/></g>` : ''}
  ${f.has('lanterns') ? [110, 290].map((x, i) => `<g transform="translate(${x},${i ? 120 : 110})"><line y1="-40" y2="0" stroke="#8a6b45"/><rect x="-7" y="0" width="14" height="20" rx="3" fill="#f4d58d" class="flicker"/><circle cx="0" cy="10" r="16" fill="#f4d58d" opacity=".25"/></g>`).join('') : ''}`;
}

function library(f, theme) {
  const g = glowId();
  return `
  <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.sky[0]}"/><stop offset="1" stop-color="${theme.sky[1]}"/></linearGradient></defs>
  <rect width="400" height="260" fill="url(#${g})"/>
  <rect y="200" width="400" height="60" fill="${theme.ground}"/>
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
export function worldMapSVG(spots) {
  const shown = spots.filter((s) => s.vis !== 'hidden');
  const owned = shown.filter((s) => s.vis === 'owned');
  const teasers = shown.filter((s) => s.vis === 'teaser');
  const R = 72;

  const terrain = `
  <rect width="1000" height="700" fill="#e6d3a8"/>
  <path d="M0 520 Q180 470 360 540 T760 520 T1000 560 V700 H0Z" fill="#d8c08e"/>
  <path d="M0 150 Q200 110 380 170 T800 120 T1000 150 V0 H0Z" fill="#d2ba88"/>
  <path d="M-20 300 Q150 330 260 250 T520 230 Q640 220 720 330 T1020 420" fill="none" stroke="#7fb7c4" stroke-width="16" stroke-linecap="round" opacity=".8"/>
  ${[[120, 120], [180, 90], [860, 90], [910, 130], [820, 600], [150, 610]].map(([x, y]) => `<path d="M${x - 45} ${y + 30} L${x} ${y - 40} L${x + 45} ${y + 30}Z" fill="#b89c6c"/><path d="M${x - 14} ${y - 18} L${x} ${y - 40} L${x + 14} ${y - 18}Z" fill="#f4ecd9"/>`).join('')}
  ${[[300, 420], [330, 450], [620, 470], [650, 440], [560, 130], [240, 200], [820, 300], [400, 600]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#6f9a73"/><rect x="${x - 2}" y="${y + 8}" width="4" height="10" fill="#7a5a3c"/>`).join('')}
  ${owned.flatMap((o) => teasers.filter((t) => t.def.map.revealedBy === o.def.id).map((t) =>
    `<path d="M${o.def.map.x} ${o.def.map.y} Q${(o.def.map.x + t.def.map.x) / 2 + 40} ${(o.def.map.y + t.def.map.y) / 2 + 40} ${t.def.map.x} ${t.def.map.y}" fill="none" stroke="#8a6b45" stroke-width="5" stroke-dasharray="4 12" stroke-linecap="round"/>`)).join('')}`;

  // Fog: opaque everywhere except soft holes around visible places.
  const fog = `
  <defs>
    <radialGradient id="hole"><stop offset=".55" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>
    <radialGradient id="half"><stop offset=".4" stop-color="#666"/><stop offset="1" stop-color="#fff"/></radialGradient>
    <mask id="fogmask">
      <rect width="1000" height="700" fill="#fff"/>
      ${owned.map((s) => `<circle cx="${s.def.map.x}" cy="${s.def.map.y}" r="210" fill="url(#hole)"/>`).join('')}
      ${teasers.map((s) => `<circle cx="${s.def.map.x}" cy="${s.def.map.y}" r="140" fill="url(#half)"/>`).join('')}
    </mask>
    <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    ${shown.map((s) => `<clipPath id="clip-${s.def.id}"><circle cx="${s.def.map.x}" cy="${s.def.map.y}" r="${R}"/></clipPath>`).join('')}
  </defs>
  <g mask="url(#fogmask)">
    <rect width="1000" height="700" fill="#cfd6db" opacity=".97"/>
    <g filter="url(#blur)" fill="#f2f4f5" opacity=".8">
      ${[[150, 200, 180], [520, 120, 220], [850, 380, 200], [300, 600, 240], [700, 620, 200], [80, 420, 150]].map(([x, y, r], i) =>
        `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" class="cloud" style="animation-delay:${i * -3}s"/>`).join('')}
    </g>
  </g>`;

  const spotsMarkup = shown.map(({ def, vis, scene }) => {
    const { x, y } = def.map;
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

  return `<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" class="world-map" role="img" aria-label="خريطة العالم">${terrain}${fog}${spotsMarkup}</svg>`;
}
