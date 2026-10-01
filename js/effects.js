// Lightweight visual feedback: floating gold, coin burst, banners, toasts.

const layer = () => document.getElementById('fx');

export function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  layer().appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function center(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function floatText(text, origin, cls) {
  const { x, y } = center(origin);
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function coinBurst(origin, n = 10) {
  const { x, y } = center(origin);
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin';
    c.textContent = '🪙';
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
    c.style.left = x + 'px';
    c.style.top = y + 'px';
    c.style.setProperty('--dx', Math.cos(a) * d + 'px');
    c.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px');
    layer().appendChild(c);
    setTimeout(() => c.remove(), 900);
  }
  const g = document.getElementById('gold-box');
  g.classList.remove('pulse'); void g.offsetWidth; g.classList.add('pulse');
}

export function confetti() {
  const colors = ['#f4d58d', '#3f7d6e', '#e9e4d8', '#c9a45c', '#9cc3e8'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.4 + 's';
    layer().appendChild(c);
    setTimeout(() => c.remove(), 2400);
  }
}

export function banner(title, text, icon = '✨') {
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = `<div class="banner-icon">${icon}</div><div><b></b><p></p></div>`;
  el.querySelector('b').textContent = title;
  el.querySelector('p').textContent = text;
  el.onclick = () => el.remove();
  layer().appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function playEvents(events, origin) {
  let delay = 0;
  for (const ev of events) {
    setTimeout(() => {
      if (ev.type === 'gold') { floatText(`+${ev.amount} 🪙`, origin, 'plus'); coinBurst(origin); }
      if (ev.type === 'penalty') floatText(`−${ev.amount} 🪙`, origin, 'minus');
      if (ev.type === 'levelUp') { banner(ev.kind === 'region' ? 'تطوّرت المنطقة!' : 'ارتفع المستوى!', `${ev.name} — مستوى ${ev.level}${ev.label ? ' · ' + ev.label : ''}`, '⬆'); confetti(); }
      if (ev.type === 'perfectDay') toast(`يوم كامل ✔ — ${ev.streak} متتالية`);
      if (ev.type === 'key') { banner('حصلت على مفتاح!', `${ev.from}: 15 يومًا كاملًا متتاليًا`, '🗝'); confetti(); }
      if (ev.type === 'levelReady') banner('المستوى جاهز!', `${ev.name}: أكملت أيام المستوى — استخدم مفتاحًا لرفع المستوى`, '⭐');
      if (ev.type === 'rank') { banner('رتبة جديدة!', `${ev.name} أصبح ${ev.rank}`, '🏅'); confetti(); }
      if (ev.type === 'available') banner('محتوى جديد متاح!', `حققت شروط ${ev.name} — تجده في المتجر`, '🔓');
      if (ev.type === 'unlock') { banner('تم الفتح!', `أصبح ${ev.name} ملكك`, '🎉'); confetti(); }
    }, delay);
    delay += ev.type === 'gold' || ev.type === 'penalty' ? 250 : 900;
  }
}
