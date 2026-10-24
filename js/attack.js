// The night attack: when a day closes, each dimension's warrior charges its dark
// king's castle. Every star is a hit; three stars bring the castle down; a zero day
// is pushed back (or saved by the shield). If the day left a front at zero, Lucifer
// raids the treasury at the end. Drawn in SVG + CSS so it plays the same on phones.
// The player can skip at any time.

const wait = (ms, ctl) => new Promise((res) => { const t = setTimeout(res, ms); ctl.wake.push(() => { clearTimeout(t); res(); }); });

const castleSVG = () => `
<svg viewBox="0 0 240 260" class="atk-castle-svg" aria-hidden="true">
  <defs><linearGradient id="atk-stone" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4b4258"/><stop offset="1" stop-color="#231d2c"/></linearGradient></defs>
  <path d="M170 34 V8 L206 18 L170 28" fill="#8e1b2a"/><path d="M170 8 V60" stroke="#1a1420" stroke-width="4"/>
  <rect x="20" y="96" width="200" height="164" fill="url(#atk-stone)"/>
  <rect x="6" y="56" width="58" height="204" fill="url(#atk-stone)"/><rect x="176" y="56" width="58" height="204" fill="url(#atk-stone)"/>
  ${[6, 24, 42].map((x) => `<rect x="${x}" y="42" width="12" height="16" fill="#3a3346"/>`).join('')}
  ${[176, 194, 212].map((x) => `<rect x="${x}" y="42" width="12" height="16" fill="#3a3346"/>`).join('')}
  ${[30, 58, 86, 114, 142, 170, 198].map((x) => `<rect x="${x}" y="84" width="14" height="14" fill="#3a3346"/>`).join('')}
  <path d="M96 260 V196 Q120 170 144 196 V260Z" fill="#120d18"/>
  <rect x="26" y="110" width="12" height="20" rx="6" fill="#ff5a3c" class="atk-win"/><rect x="202" y="110" width="12" height="20" rx="6" fill="#ff5a3c" class="atk-win"/>
  <rect x="110" y="128" width="20" height="26" rx="10" fill="#ff5a3c" class="atk-win"/>
  <g class="atk-crack c1" stroke="#0c0810" stroke-width="4" fill="none"><path d="M60 120 l14 18 -8 14 16 20"/></g>
  <g class="atk-crack c2" stroke="#0c0810" stroke-width="4" fill="none"><path d="M180 140 l-16 16 10 12 -14 22"/><path d="M120 100 l-6 22 10 10"/></g>
  <g class="atk-crack c3" stroke="#0c0810" stroke-width="5" fill="none"><path d="M30 200 l30 -10 20 16"/><path d="M210 210 l-24 -8 -14 20"/></g>
</svg>`;

let current = null;   // the scene on screen (a new one closes it first)
export function playAttack({ fights, raid, shields }, { warrior, sfx = {}, onDone }) {
  current?.skip();
  const ctl = { skip: false, wake: [] };
  const root = document.createElement('div'); root.className = 'atk';
  root.innerHTML = `
    <div class="atk-sky"><i class="atk-moon"></i></div>
    <div class="atk-ground"></div>
    <div class="atk-castle">${castleSVG()}<b class="atk-king"></b></div>
    <div class="atk-warrior"></div>
    <div class="atk-flash"></div>
    <div class="atk-luci"><svg viewBox="0 0 120 120" aria-hidden="true"><path d="M30 40 L18 6 L46 30Z M90 40 L102 6 L74 30Z" fill="#b3121f"/><circle cx="60" cy="58" r="36" fill="#7a0b14"/><path d="M38 52 l16 6 M82 52 l-16 6" stroke="#ffde59" stroke-width="7" stroke-linecap="round"/><path d="M42 78 q18 14 36 0" stroke="#ffde59" stroke-width="5" fill="none"/><path d="M24 92 Q60 130 96 92 L104 120 H16Z" fill="#3a0308"/><text x="96" y="108" font-size="26">💰</text></svg></div>
    <div class="atk-hud">
      <div class="atk-title"></div>
      <div class="atk-stars"><i></i><i></i><i></i></div>
      <div class="atk-pct"></div>
      <div class="atk-cap"></div>
    </div>
    <div class="atk-sum" hidden></div>
    <button class="atk-skip">تخطّي ⏭</button>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const castle = q('.atk-castle'), war = q('.atk-warrior'), flash = q('.atk-flash'), stars = [...root.querySelectorAll('.atk-stars i')];
  const finish = () => { if (root.isConnected) { root.remove(); if (current?.root === root) current = null; onDone?.(); } };
  q('.atk-skip').onclick = () => { ctl.skip = true; ctl.wake.splice(0).forEach((f) => f()); finish(); };
  const play = (k) => { if (!ctl.skip) sfx[k]?.(); };

  (async () => {
    await wait(50, ctl);
    for (const f of fights) {
      if (ctl.skip) return;
      root.classList.remove('won', 'held', 'pushed');
      castle.className = 'atk-castle'; stars.forEach((s) => (s.className = ''));
      q('.atk-king').textContent = f.king;
      q('.atk-title').textContent = `⚔ ${f.name} ضد ${f.king}`;
      q('.atk-pct').textContent = ''; q('.atk-cap').textContent = f.training ? '🌱 تدريب — الحرب بتبلّش السبت' : '';
      war.innerHTML = warrior(f.id); war.className = 'atk-warrior';
      await wait(350, ctl);
      war.classList.add('charge'); play('whoosh');
      await wait(750, ctl);
      const hits = f.shield ? 0 : f.stars;
      for (let i = 0; i < hits; i++) {
        flash.className = 'atk-flash on'; castle.classList.add('hit', `c${i + 1}`); play('wood');
        stars[i].className = 'on'; play('coin');
        await wait(130, ctl); flash.className = 'atk-flash'; castle.classList.remove('hit');
        await wait(300, ctl);
      }
      q('.atk-pct').textContent = `${Math.round((f.share || 0) * 100)}%`;
      if (f.shield) {
        war.classList.add('back'); q('.atk-cap').textContent = '🛡 الدرع حوّل يوم الصفر لنجمة';
        await wait(350, ctl); stars[0].className = 'on shield'; play('key');
      } else if (hits === 3) {
        castle.classList.add('down'); root.classList.add('won'); q('.atk-cap').textContent = `🏆 دمّرت قلعة ${f.king}!`; play('fanfare');
      } else if (hits) {
        root.classList.add('held'); q('.atk-cap').textContent = `القلعة صمدت — ${hits === 2 ? 'قرّبت!' : 'بدك ضربات أكثر'}`;
      } else {
        war.classList.add('back'); root.classList.add('pushed'); q('.atk-cap').textContent = `${f.king} صدّك — صفر نجوم`; play('lose');
      }
      await wait(hits === 3 ? 1300 : 1000, ctl);
      war.classList.remove('charge');
    }
    if (ctl.skip) return;
    if (raid && (raid.gold || raid.medals)) {
      root.classList.add('raid'); q('.atk-title').textContent = '😈 غارة لوسيفر';
      q('.atk-cap').textContent = `سرق −${raid.gold} 🪙 و −${raid.medals} 🎖`; stars.forEach((s) => (s.className = 'off')); q('.atk-pct').textContent = '';
      play('lose'); await wait(1900, ctl);
    }
    if (ctl.skip) return;
    const sum = q('.atk-sum');
    sum.innerHTML = `<h3>🌙 نتيجة هجوم الليلة</h3>${fights.map((f) => `<p><span>${f.name}</span><b>${'⭐'.repeat(f.stars)}${'☆'.repeat(3 - f.stars)}</b></p>`).join('')}${shields != null ? `<small>🛡 معك ${shields}</small>` : ''}<button class="atk-ok">تمام</button>`;
    sum.hidden = false; q('.atk-skip').hidden = true;
    q('.atk-ok').onclick = finish;
  })();
  current = { root, skip: () => q('.atk-skip').click() };
  return current;
}
