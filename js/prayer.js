// Prayer times calculated on-device from latitude/longitude (standard
// astronomical method, same math as PrayTimes.org). No network needed.

export const METHODS = {
  jordan: { name: 'وزارة الأوقاف الأردنية', fajr: 18, isha: 18 },
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  makkah: { name: 'أم القرى (مكة)', fajr: 18.5, ishaMinutes: 90 },
  egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
};

export const CITIES = [
  { name: 'عمّان', lat: 31.9539, lng: 35.9106, method: 'jordan' },
  { name: 'إربد', lat: 32.5556, lng: 35.85, method: 'jordan' },
  { name: 'الزرقاء', lat: 32.0728, lng: 36.088, method: 'jordan' },
  { name: 'القدس', lat: 31.7683, lng: 35.2137, method: 'jordan' },
  { name: 'غزة', lat: 31.5017, lng: 34.4668, method: 'jordan' },
  { name: 'نابلس', lat: 32.2211, lng: 35.2544, method: 'jordan' },
  { name: 'دمشق', lat: 33.5138, lng: 36.2765, method: 'mwl' },
  { name: 'بيروت', lat: 33.8938, lng: 35.5018, method: 'mwl' },
  { name: 'مكة', lat: 21.3891, lng: 39.8579, method: 'makkah' },
  { name: 'المدينة', lat: 24.5247, lng: 39.5692, method: 'makkah' },
  { name: 'الرياض', lat: 24.7136, lng: 46.6753, method: 'makkah' },
  { name: 'دبي', lat: 25.2048, lng: 55.2708, method: 'makkah' },
  { name: 'القاهرة', lat: 30.0444, lng: 31.2357, method: 'egypt' },
  { name: 'إسطنبول', lat: 41.0082, lng: 28.9784, method: 'mwl' },
];

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const arcsin = (x) => deg(Math.asin(x));
const arccos = (x) => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const arctan2 = (y, x) => deg(Math.atan2(y, x));
const arccot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(arctan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - RA };
}

// Hours (local clock, as a decimal) for each time on the given calendar date.
export function prayerTimes(date, { lat, lng, method = 'mwl' }, tz = -date.getTimezoneOffset() / 60) {
  const m = METHODS[method] || METHODS.mwl;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const midDay = (t) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle, t, ccw) => {
    const { decl } = sunPosition(jd + t);
    const T = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (ccw ? -T : T);
  };
  const asrTime = (t) => {
    const { decl } = sunPosition(jd + t);
    return angleTime(-arccot(1 + tan(Math.abs(lat - decl))), t);
  };
  const compute = (h) => ({
    fajr: angleTime(m.fajr, h.fajr / 24, true),
    sunrise: angleTime(0.833, h.sunrise / 24, true),
    dhuhr: midDay(h.dhuhr / 24),
    asr: asrTime(h.asr / 24),
    maghrib: angleTime(0.833, h.maghrib / 24),
    isha: m.isha ? angleTime(m.isha, h.isha / 24) : 0,
  });
  // Two passes: the second refines using the first estimate.
  let h = compute({ fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 });
  h = compute(h);
  const shift = tz - lng / 15;
  for (const k in h) h[k] += shift;
  if (!m.isha) h.isha = h.maghrib + m.ishaMinutes / 60;
  return h;
}

const atHour = (date, hours) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(d.getTime() + hours * 3600e3);
};
const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The "prayer day" runs from Fajr to the next Fajr, so Isha after midnight
// still belongs to the previous day. Returns that day's key and each prayer's
// window { start, end } as Date objects.
export function prayerDay(now, loc) {
  let base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let t = prayerTimes(base, loc);
  if (now < atHour(base, t.fajr)) {
    base = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
    t = prayerTimes(base, loc);
  }
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  const nextFajr = atHour(next, prayerTimes(next, loc).fajr);
  const at = (h) => atHour(base, h);
  return {
    day: dateKey(base),
    windows: {
      fajr: { start: at(t.fajr), end: at(t.sunrise) },
      dhuhr: { start: at(t.dhuhr), end: at(t.asr) },
      asr: { start: at(t.asr), end: at(t.maghrib) },
      maghrib: { start: at(t.maghrib), end: at(t.isha) },
      isha: { start: at(t.isha), end: nextFajr },
    },
  };
}

// 'upcoming' | 'open' | 'over'
export const windowState = (w, now) => (now < w.start ? 'upcoming' : now < w.end ? 'open' : 'over');

export const fmtTime = (d) => d.toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
