// Old pirate-style war map of the eight dimensions (SVG), plus the canvas
// texture used on the commander's table in 3D.

export const WAR = {
  coming:  { name: 'حرب قادمة', icon: '🏴', color: '#6b5a44', desc: 'لم تُفتح هذه الجبهة بعد.' },
  ongoing: { name: 'حرب مستمرة', icon: '⚔️', color: '#b8741a', desc: 'الجبهة مفتوحة والقتال مستمر دون هزيمة.' },
  fierce:  { name: 'حرب طاحنة', icon: '🔥', color: '#b3261e', desc: 'نهضت بعد هزيمة وتجاوزت مستواها — قتال شرس.' },
  crushed: { name: 'هزيمة ساحقة', icon: '💀', color: '#2b2018', desc: 'انكسر العدّاد إلى الصفر. ارفع المستوى واحدًا فوق مستوى الهزيمة لتعود.' },
};

// Landmark glyph per dimension, drawn in ink.
const GLYPH = {
  sanctuary: '<path d="M-14 8 V-4 Q0 -22 14 -4 V8Z"/><path d="M-20 8 V-14 M20 8 V-14" stroke-width="3"/><circle cy="-24" r="2"/>',
  body: '<ellipse rx="18" ry="8" fill="none"/><ellipse rx="10" ry="4" fill="none"/><path d="M-16 -2 V-14 M16 -2 V-14"/>',
  heart: '<path d="M0 10 C-18 -2 -12 -16 0 -8 C12 -16 18 -2 0 10Z"/>',
  social: '<path d="M-18 8 V-4 L-12 -10 L-6 -4 V8 M-4 8 V-8 L2 -14 L8 -8 V8 M10 8 V-2 L15 -7 L20 -2 V8"/>',
  library: '<path d="M-7 10 V-12 H7 V10Z"/><path d="M-9 -12 Q0 -24 9 -12"/><path d="M5 -18 L14 -24"/>',
  career: '<path d="M-6 10 V-18 H6 V10Z"/><path d="M8 10 V-22 M8 -22 H22 M20 -22 V-14"/><circle cx="-14" cy="4" r="5" fill="none"/>',
  wealth: '<path d="M-16 8 H16 M-14 8 V-6 M-5 8 V-6 M5 8 V-6 M14 8 V-6 M-18 -6 L0 -16 L18 -6Z"/>',
  nature: '<path d="M0 10 V-2"/><circle cy="-10" r="10" fill="none"/><circle cx="-8" cy="-4" r="6" fill="none"/><circle cx="8" cy="-4" r="6" fill="none"/>',
  hq: '<path d="M-12 8 V-8 H-8 V-4 H-4 V-8 H4 V-4 H8 V-8 H12 V8Z"/><path d="M0 -8 V-20 L8 -16 L0 -12"/>',
};

function rng(seed) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

function coast(rand, cx, cy, rx, ry, n = 40) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, k = 1 + (rand() - 0.5) * 0.22 + Math.sin(a * 5) * 0.05;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  return 'M' + pts.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join(' L') + 'Z';
}

// places: [{ id, name, map:{x,y}, status }], hq: {x,y}
export function warMapSVG(places, hq) {
  const rand = rng(42);
  const W = 1000, H = 700;
  // Places sit inside the coastline; headquarters sits off the coast on its own islet.
  const P = (m) => [500 + ((m.x - 500) / 620) * 330, 360 + ((m.y - 380) / 340) * 215];
  const hqDir = hq ? (() => { const [x, y] = P(hq), v = [(x - 500) / 390, (y - 360) / 260], l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; })() : [0, 0];
  const onRing = (k) => [500 + hqDir[0] * 390 * k, 360 + hqDir[1] * 260 * k];
  const hqP = hq ? onRing(1.24) : [500, 350];
  const burn = Array.from({ length: 70 }, (_, i) => {
    const t = i / 70, side = Math.floor(t * 4), f = (t * 4) % 1, j = 8 + rand() * 22;
    return side === 0 ? [f * W, j] : side === 1 ? [W - j, f * H] : side === 2 ? [W - f * W, H - j] : [j, H - f * H];
  });
  const edge = 'M' + burn.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join(' L') + 'Z';
  const coastD = coast(rand, 500, 360, 390, 260);
  return `
<svg viewBox="0 0 ${W} ${H}" class="war-map" role="img" aria-label="خريطة الحرب" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="wm-paper" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#f1dfb4"/><stop offset=".9" stop-color="#d6b57a"/><stop offset="1" stop-color="#a47a3e"/></radialGradient>
    <filter id="wm-rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .15  0 0 0 .18 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
    <clipPath id="wm-clip"><path d="${edge}"/></clipPath>
    <pattern id="wm-waves" width="46" height="22" patternUnits="userSpaceOnUse"><path d="M3 14 q10 -9 20 0 t20 0" fill="none" stroke="#8a6b45" stroke-width="1.4" opacity=".45"/></pattern>
  </defs>
  <path d="${edge}" fill="#2a1c10" opacity=".35" transform="translate(6 8)"/>
  <path d="${edge}" fill="url(#wm-paper)" filter="url(#wm-rough)" stroke="#6b4a24" stroke-width="3"/>
  <g clip-path="url(#wm-clip)">
    <rect width="${W}" height="${H}" fill="url(#wm-waves)"/>
  </g>
  <path d="${coastD}" fill="#ead3a0" stroke="#6b4a24" stroke-width="3"/>
  <path d="${coastD}" fill="none" stroke="#6b4a24" stroke-width="1" opacity=".5" transform="translate(500 360) scale(1.05) translate(-500 -360)"/>
  <path d="${coastD}" fill="none" stroke="#6b4a24" stroke-width="1" opacity=".3" transform="translate(500 360) scale(1.1) translate(-500 -360)"/>
  ${Array.from({ length: 14 }, () => { const x = 200 + rand() * 600, y = 150 + rand() * 400, s = 10 + rand() * 12; return `<path d="M${x - s} ${y + s * 0.5} L${x} ${y - s} L${x + s} ${y + s * 0.5}" fill="none" stroke="#6b4a24" stroke-width="2" opacity=".55"/>`; }).join('')}
  ${Array.from({ length: 30 }, () => { const x = 180 + rand() * 640, y = 130 + rand() * 440; return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="3" fill="none" stroke="#5f7a3a" stroke-width="1.6" opacity=".6"/>`; }).join('')}
  <!-- compass rose -->
  <g transform="translate(875 590)" stroke="#6b4a24" fill="#6b4a24">
    <circle r="54" fill="none" stroke-width="2"/><circle r="46" fill="none" stroke-width="1"/>
    ${[0, 90, 180, 270].map((a) => `<path d="M0 -50 L7 0 L0 8 L-7 0Z" transform="rotate(${a})" fill="${a ? '#6b4a24' : '#9b2c1f'}"/>`).join('')}
    ${[45, 135, 225, 315].map((a) => `<path d="M0 -32 L4 0 L-4 0Z" transform="rotate(${a})"/>`).join('')}
    <text y="-60" text-anchor="middle" font-size="18" font-weight="700" stroke="none">ش</text>
  </g>
  <!-- sea monster & ship -->
  <g transform="translate(330 668) scale(.8)" fill="none" stroke="#6b4a24" stroke-width="2.4" opacity=".75"><path d="M0 0 q14 -26 28 0 q14 -26 28 0 q14 -26 28 0"/><circle cx="92" cy="-8" r="2" fill="#6b4a24"/></g>
  <g transform="translate(860 110)" stroke="#6b4a24" stroke-width="2" fill="none" opacity=".8"><path d="M-30 10 Q0 24 30 10 Z" fill="#c9a36a"/><path d="M0 10 V-30"/><path d="M0 -28 Q18 -16 0 -2" fill="#f6e7c4"/><path d="M0 -28 Q-16 -16 0 -2" fill="#f6e7c4"/></g>
  <text x="500" y="52" text-anchor="middle" font-size="34" font-weight="800" fill="#4a2f14" style="letter-spacing:2px">خريطة الحرب</text>
  <!-- routes from headquarters -->
  ${places.filter((p) => p.status !== 'coming').map((p) => { const [x, y] = P(p.map); return `<path d="M${hqP[0]} ${hqP[1]} Q${(hqP[0] + x) / 2 + 40} ${(hqP[1] + y) / 2 - 40} ${x} ${y}" fill="none" stroke="#9b2c1f" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`; }).join('')}
  ${hq ? (() => { const a = onRing(1.13), b = onRing(0.97); return `
  <path d="${coast(rng(7), hqP[0], hqP[1], 46, 38, 18)}" fill="#ead3a0" stroke="#6b4a24" stroke-width="3"/>
  <path d="M${a[0].toFixed(0)} ${a[1].toFixed(0)} L${b[0].toFixed(0)} ${b[1].toFixed(0)}" stroke="#6b4a24" stroke-width="9" stroke-linecap="round"/>
  <path d="M${a[0].toFixed(0)} ${a[1].toFixed(0)} L${b[0].toFixed(0)} ${b[1].toFixed(0)}" stroke="#c9a36a" stroke-width="5" stroke-dasharray="2 3"/>`; })() : ''}
  ${hq ? `<g transform="translate(${hqP[0]} ${hqP[1]})" fill="none" stroke="#3a2412" stroke-width="2.5"><circle r="26" fill="#f6e7c4" stroke="#6b4a24"/>${GLYPH.hq}<text y="46" text-anchor="middle" font-size="17" font-weight="800" fill="#3a2412" stroke="none">مقر القيادة</text></g>` : ''}
  ${places.map((p) => {
    const [x, y] = P(p.map), w = WAR[p.status];
    const X = p.status === 'crushed';
    return `
  <g class="wm-spot ${p.status}" data-war="${p.id}" transform="translate(${x.toFixed(0)} ${y.toFixed(0)})" tabindex="0" role="button" aria-label="${p.name}: ${w.name}">
    ${p.status === 'fierce' ? `<circle r="40" fill="#b3261e" opacity=".18"><animate attributeName="r" values="34;44;34" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
    <circle r="30" fill="${p.status === 'coming' ? '#d9c291' : '#f6e7c4'}" stroke="${w.color}" stroke-width="4" ${p.status === 'coming' ? 'stroke-dasharray="6 5"' : ''}/>
    <g fill="none" stroke="${p.status === 'coming' ? '#8a7457' : '#3a2412'}" stroke-width="2.4">${GLYPH[p.id] || ''}</g>
    ${X ? '<path d="M-24 -24 L24 24 M24 -24 L-24 24" stroke="#9b2c1f" stroke-width="7" stroke-linecap="round" opacity=".85"/>' : ''}
    <g transform="translate(24 -24)"><circle r="15" fill="${w.color}" stroke="#f6e7c4" stroke-width="2"/><text y="6" text-anchor="middle" font-size="16">${w.icon}</text></g>
    <text y="52" text-anchor="middle" font-size="18" font-weight="800" fill="#3a2412">${p.name}</text>
    <text y="72" text-anchor="middle" font-size="14" font-weight="700" fill="${w.color}">${w.name}${p.level ? ` · م${p.level}` : ''}</text>
  </g>`;
  }).join('')}
</svg>`;
}

// Parchment texture for the 3D table (drawn from the same data).
export function warMapCanvas(places, hq) {
  const svg = warMapSVG(places, hq).replace(/<animate[^>]*\/>/g, '');
  const img = new Image();
  const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 980;
  const ready = new Promise((res) => {
    img.onload = () => { const g = cv.getContext('2d'); g.drawImage(img, 0, 0, cv.width, cv.height); res(cv); };
    img.onerror = () => res(cv);
  });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return { canvas: cv, ready };
}
