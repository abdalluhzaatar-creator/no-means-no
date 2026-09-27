// Challenge cups ("نظام الكؤوس"): pure state logic, no DOM.
// Money here is real money the player tracks by hand in dollars (state.cups.wallet).
import { CUPS, CHANNEL_UNLOCK_CUP, JOD_TO_USD } from './content.js';

export const findCup = (id) => CUPS.find((c) => c.id === id);
export const stakeJod = (cup) => cup.days;                       // rule 7: dinars = days
export const stakeUsd = (cup) => Math.round(cup.days * JOD_TO_USD * 100) / 100;
const round2 = (n) => Math.round(n * 100) / 100;

export function ensure(s) {
  if (!s.cups || typeof s.cups !== 'object') s.cups = {};
  s.cups.wallet = +s.cups.wallet || 0;
  s.cups.walletLog = Array.isArray(s.cups.walletLog) ? s.cups.walletLog : [];
  s.cups.challenges = Array.isArray(s.cups.challenges) ? s.cups.challenges : [];
  return s.cups;
}

const ok = (extra = {}) => ({ ok: true, events: [], ...extra });
const fail = (reason) => ({ ok: false, reason, events: [] });
const DAY = 86400000;

// Whole days passed since the challenge started (day 1 = the start day finished).
export const daysDone = (ch, now = Date.now()) => Math.max(0, Math.floor((now - ch.start) / DAY));
export const isComplete = (ch, now) => daysDone(ch, now) >= findCup(ch.cupId).days;

export const channels = (s) => [...new Set(ensure(s).challenges.map((c) => c.channel))];
export const active = (s) => ensure(s).challenges.filter((c) => c.status === 'active');
export const wonCups = (s) => ensure(s).challenges.filter((c) => c.status === 'won');
export const ownsCup = (s, cupId) => wonCups(s).some((c) => c.cupId === cupId);

// Rule 6: a new channel needs the silver cup (the first channel is free).
export function canOpenChannel(s, name) {
  const list = channels(s);
  if (list.includes(name)) return { ok: true };
  if (list.length === 0) return { ok: true };
  if (ownsCup(s, CHANNEL_UNLOCK_CUP)) return { ok: true };
  return { ok: false, reason: `فتح قناة جديدة يحتاج ${findCup(CHANNEL_UNLOCK_CUP).name}` };
}

export function adjustWallet(s, delta, note = '') {
  const c = ensure(s);
  delta = round2(+delta);
  if (!delta) return fail('أدخل مبلغًا');
  if (c.wallet + delta < 0) return fail('الرصيد لا يكفي');
  c.wallet = round2(c.wallet + delta);
  c.walletLog.unshift({ at: Date.now(), delta, note });
  c.walletLog = c.walletLog.slice(0, 100);
  return ok();
}

// Rules 1-3, 5, 7: one-sided start, the stake leaves the wallet and is held by the partner.
export function startChallenge(s, { channel, cupId, partner, pin, now = Date.now() }) {
  const c = ensure(s);
  const cup = findCup(cupId);
  channel = (channel || '').trim(); partner = (partner || '').trim(); pin = String(pin || '').trim();
  if (!cup) return fail('اختر كأسًا');
  if (!channel) return fail('اكتب اسم القناة');
  if (!partner) return fail('اكتب اسم الطرف الثاني');
  if (!/^\d{4}$/.test(pin)) return fail('رمز الطرف الثاني 4 أرقام');
  const ch = canOpenChannel(s, channel);
  if (!ch.ok) return fail(ch.reason);
  if (active(s).some((x) => x.channel === channel)) return fail('في تحدٍّ شغّال بهاي القناة');
  const usd = stakeUsd(cup);
  if (c.wallet < usd) return fail(`الرصيد لا يكفي — تحتاج $${usd}`);
  c.wallet = round2(c.wallet - usd);
  c.walletLog.unshift({ at: now, delta: -usd, note: `تأمين ${cup.name} عند ${partner}` });
  const challenge = { id: `c${now.toString(36)}`, channel, cupId, partner, pin, start: now, stakeJod: stakeJod(cup), stakeUsd: usd, status: 'active' };
  c.challenges.push(challenge);
  return ok({ challenge, events: [{ type: 'challenge', cup: cup.name }] });
}

// Rule 4: only the second party (who knows the PIN) decides. Win → stake returns; loss → it's theirs.
export function judge(s, id, pin, won, now = Date.now()) {
  const c = ensure(s);
  const ch = c.challenges.find((x) => x.id === id);
  if (!ch || ch.status !== 'active') return fail('التحدي غير موجود');
  if (String(pin).trim() !== ch.pin) return fail('رمز الطرف الثاني غير صحيح');
  if (won && !isComplete(ch, now)) return fail('المدة لم تكتمل بعد');
  ch.status = won ? 'won' : 'lost';
  ch.endedAt = now;
  if (won) {
    c.wallet = round2(c.wallet + ch.stakeUsd);
    c.walletLog.unshift({ at: now, delta: ch.stakeUsd, note: `استرجاع مبلغ ${findCup(ch.cupId).name}` });
  } else {
    c.walletLog.unshift({ at: now, delta: 0, note: `خسارة ${findCup(ch.cupId).name} — المبلغ صار لـ ${ch.partner}` });
  }
  return ok({ events: [{ type: won ? 'cupWon' : 'cupLost', cup: findCup(ch.cupId).name }] });
}
