// Shared outdoor environment for the dimension places: a physical sky that follows
// the real time of day, sun with soft shadows, stars and moon at night, drifting
// clouds, and live weather (rain, snow that settles, storms with lightning, fog).
import * as THREE from './vendor/three.module.min.js';
import { Sky } from './vendor/Sky.js';
import { sfx } from './audio.js';

const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

export const WEATHER = {
  clear:    { cloud: 0.12, dim: 0,    fog: 0,    rain: 0,   snow: 0, turb: 3 },
  cloudy:   { cloud: 0.55, dim: 0.15, fog: 0.1,  rain: 0,   snow: 0, turb: 6 },
  overcast: { cloud: 1,    dim: 0.45, fog: 0.3,  rain: 0,   snow: 0, turb: 14 },
  fog:      { cloud: 0.6,  dim: 0.4,  fog: 1,    rain: 0,   snow: 0, turb: 18 },
  rain:     { cloud: 1,    dim: 0.55, fog: 0.4,  rain: 1,   snow: 0, turb: 16 },
  storm:    { cloud: 1,    dim: 0.7,  fog: 0.5,  rain: 1.4, snow: 0, turb: 20 },
  snow:     { cloud: 1,    dim: 0.35, fog: 0.45, rain: 0,   snow: 1, turb: 12 },
};

export function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
export const glowTex = canvasTex(64, 64, (g) => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
});

// opts: { fog: day fog colour, golden: sunset fog tint, dayExposure, nightTint, shadow: half-size of the shadow box, far: fog far distance }
export function createEnv(scene, renderer, camera, { skyInfo, weather = 'clear', fog = 0xdfe6ea, golden = 0xe8b48c, night: nightFog = 0x0e1426, shadow = 40, far = 300, rand = Math.random, sunAz = 0 } = {}) {
  const sky = new Sky(); sky.scale.setScalar(2200); scene.add(sky);
  const su = sky.material.uniforms; su.rayleigh.value = 2; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.85;
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -shadow, right: shadow, top: shadow, bottom: -shadow, near: 1, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x7a6a50, 1);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  scene.add(sun, sun.target, hemi, fill, fill.target);
  scene.fog = new THREE.Fog(fog, 80, far);

  const sp = new Float32Array(1600 * 3);
  for (let i = 0; i < 1600; i++) { const v = new THREE.Vector3().setFromSphericalCoords(1000, Math.acos(rand() * 0.95), rand() * Math.PI * 2); sp.set([v.x, v.y, v.z], i * 3); }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d8, fog: false, transparent: true }));
  moon.position.set(-300, 380, -760); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xbfd0ff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  moonGlow.scale.setScalar(200); moonGlow.position.copy(moon.position); scene.add(moonGlow);

  // Clouds
  const puff = canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  });
  const cloudMat = new THREE.SpriteMaterial({ map: puff, color: 0xffffff, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 60; i++) {
    const cx = (rand() - 0.5) * 800, cz = (rand() - 0.5) * 800, cy = 100 + rand() * 60;
    for (let j = 0; j < 6; j++) {
      const s = new THREE.Sprite(cloudMat), r = 40 + rand() * 50;
      s.position.set(cx + (rand() - 0.5) * 80, cy + (rand() - 0.5) * 12, cz + (rand() - 0.5) * 50); s.scale.set(r * 1.8, r, 1);
      s.userData.rank = rand(); clouds.add(s);
    }
  }

  // Rain and snow follow the camera.
  const RAIN_N = 2200, rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) { const x = (rand() - 0.5) * 80, y = rand() * 40, z = (rand() - 0.5) * 80; rainPos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
  const rain = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPos, 3)), new THREE.LineBasicMaterial({ color: 0xaec4d6, transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false; scene.add(rain);
  const SNOW_N = 2200, snowPos = new Float32Array(SNOW_N * 3), snowSeed = new Float32Array(SNOW_N);
  for (let i = 0; i < SNOW_N; i++) { snowPos.set([(rand() - 0.5) * 80, rand() * 40, (rand() - 0.5) * 80], i * 3); snowSeed[i] = rand() * 6.28; }
  const snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snowPos, 3)),
    new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: 0.38, transparent: true, depthWrite: false, opacity: 0.95 }));
  snow.frustumCulled = false; scene.add(snow);
  const snowCover = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false }));
  snowCover.rotation.x = -Math.PI / 2; snowCover.position.y = 0.05; snowCover.renderOrder = 1; snowCover.receiveShadow = true; scene.add(snowCover);
  const flash = new THREE.AmbientLight(0xdfe8ff, 0); scene.add(flash);

  let W = WEATHER[weather] || WEATHER.clear, kind = weather in WEATHER ? weather : 'clear';
  const state = { night: 0, golden: 0, wet: 0 };
  const sunDir = new THREE.Vector3(), tmp = new THREE.Color(), bg = new THREE.Color();
  const listeners = [];
  const applySky = () => {
    const { elev, pm } = skyInfo();
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(elev, -14)), THREE.MathUtils.degToRad(110 + sunAz + (pm ? 120 : -60)));
    su.sunPosition.value.copy(sunDir);
    su.turbidity.value = W.turb; su.rayleigh.value = lerp(2, 0.6, W.dim);
    const night = clamp((3 - elev) / 13, 0, 1), gold = clamp(1 - Math.abs(elev - 4) / 12, 0, 1) * (1 - night);
    state.night = night; state.golden = gold; state.wet = W.rain ? 1 : 0;
    sun.position.copy(elev > 3 ? sunDir : new THREE.Vector3(-0.3, 0.8, 0.5).normalize()).multiplyScalar(110);
    sun.color.set(night > 0.5 ? 0x9fb4e6 : 0xfff0d8).lerp(tmp.set(0xff9c5a), gold * 0.8);
    sun.intensity = lerp(2.8, 0.35, night) * (1 - W.dim * 0.8);
    hemi.intensity = lerp(1.1, 0.3, night) * (1 - W.dim * 0.3);
    hemi.color.set(night > 0.5 ? 0x4a5a88 : 0xdfeaff);
    fill.intensity = lerp(0.7, 0.28, night);
    renderer.toneMappingExposure = lerp(0.6, 1, night) + W.dim * 0.15;
    bg.set(0xb9c2c9).lerp(tmp.set(0x10172c), night);
    sky.visible = W.dim < 0.4 && night < 0.95;
    scene.background = sky.visible ? null : bg.clone();
    scene.fog.color.set(fog).lerp(tmp.set(golden), gold * (1 - W.dim)).lerp(new THREE.Color(nightFog), night).lerp(new THREE.Color(0xaab4bc).multiplyScalar(1 - night * 0.8), W.dim);
    scene.fog.near = lerp(80, 4, W.fog); scene.fog.far = lerp(far, 60, W.fog);
    cloudMat.color.set(0xffffff).lerp(tmp.set(0x6f7880), W.dim).lerp(new THREE.Color(0xffb88a), gold * 0.6).lerp(new THREE.Color(0x2a3350), night);
    for (const c of clouds.children) c.visible = c.userData.rank < W.cloud;
    rain.visible = W.rain > 0; snow.visible = W.snow > 0; rain.material.opacity = 0.35 + W.rain * 0.25;
    listeners.forEach((f) => f(state, W));
  };
  applySky();

  let snowAcc = 0, nextBolt = 4;
  const tick = (t, dt) => {
    fill.position.copy(camera.position).add(new THREE.Vector3(0, 6, 0));
    stars.material.opacity = state.night * (1 - W.cloud * 0.9);
    moon.material.opacity = Math.max(0.15, state.night) * (1 - W.dim * 0.8);
    moonGlow.material.opacity = state.night * 0.5 * (1 - W.dim);
    for (const c of clouds.children) { c.position.x += dt * 3; if (c.position.x > 420) c.position.x -= 840; }
    const cx = camera.position.x, cz = camera.position.z;
    if (rain.visible) {
      const speed = 38 * dt, wind = W.rain > 1 ? 0.25 : 0.05;
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6; let y = rainPos[o + 1] - speed;
        if (y < 0) { y = 40; rainPos[o] = cx + (Math.random() - 0.5) * 80; rainPos[o + 2] = cz + (Math.random() - 0.5) * 80; }
        rainPos[o + 1] = y; rainPos[o] += wind * speed * 0.05; rainPos[o + 3] = rainPos[o] + wind; rainPos[o + 4] = y - 0.7; rainPos[o + 5] = rainPos[o + 2];
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      for (let i = 0; i < SNOW_N; i++) {
        const o = i * 3; let y = snowPos[o + 1] - dt * 1.6;
        if (y < 0.1) { y = 40; snowPos[o] = cx + (Math.random() - 0.5) * 80; snowPos[o + 2] = cz + (Math.random() - 0.5) * 80; }
        snowPos[o + 1] = y; snowPos[o] += Math.sin(t + snowSeed[i]) * dt * 0.6;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    snowAcc = clamp(snowAcc + (W.snow ? dt * 0.04 : -dt * 0.05), 0, 0.8);
    snowCover.material.opacity = snowAcc;
    if (kind === 'storm' && t > nextBolt) { flash.intensity = 6; setTimeout(sfx.thunder, 600 + Math.random() * 1500); nextBolt = t + 4 + Math.random() * 8; }
    flash.intensity *= 0.86;
  };

  return {
    sun, hemi, fill, state, applySky, tick,
    get W() { return W; },
    setWeather(k) { kind = k in WEATHER ? k : 'clear'; W = WEATHER[kind]; applySky(); },
    onSky(f) { listeners.push(f); f(state, W); },
  };
}
