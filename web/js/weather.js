// Wetterwechsel auf allen Karten: feste Abfolge nach Spielzeit (für alle Mitspieler gleich), weiche Übergänge.
// Zustände: klar, Dunst/Frühnebel, Schauer, Gewitter (Blitze, Donner, Böen), Schneeschauer, tiefe Wolken.
import * as THREE from './lib/three.module.min.js';
import { T } from './theme.js';
import { clamp, rand } from './util.js';

// fog: Faktor Nebeldichte, light: Helligkeit, grey: Grauschleier für Himmel/Nebel/Wolken,
// rain/snow: Niederschlag 0..1, gust: zusätzliche Böen, thunder: Blitze und Donner
const STATES = {
  clear: { name: 'klar', fog: 1, light: 1, grey: 0, rain: 0, snow: 0, gust: 0 },
  haze: { name: 'Dunst', fog: 2.6, light: 0.93, grey: 0.25, rain: 0, snow: 0, gust: 0 },
  mist: { name: 'Frühnebel', fog: 5.5, light: 0.88, grey: 0.45, rain: 0, snow: 0, gust: 0 },
  overcast: { name: 'tiefe Wolken', fog: 2.2, light: 0.8, grey: 0.5, rain: 0, snow: 0, gust: 0.3 },
  shower: { name: 'Regenschauer', fog: 3, light: 0.74, grey: 0.6, rain: 0.75, snow: 0, gust: 0.5 },
  storm: { name: 'Gewitter', fog: 3.6, light: 0.58, grey: 0.75, rain: 1, snow: 0, gust: 1.3, thunder: true },
  dryStorm: { name: 'Gewitter in den Bergen', fog: 1.8, light: 0.72, grey: 0.55, rain: 0.3, snow: 0, gust: 1.1, thunder: true },
  wind: { name: 'Starkwind', fog: 1.5, light: 0.95, grey: 0.15, rain: 0, snow: 0, gust: 1.4 },
  snow: { name: 'Schneeschauer', fog: 5, light: 0.78, grey: 0.6, rain: 0, snow: 1, gust: 0.6 },
};

// Abfolgen je Karte [Zustand, Dauer in s] – beginnen immer klar
const CYCLES = {
  vietnam: [['clear', 300], ['mist', 170], ['clear', 220], ['shower', 160], ['overcast', 120], ['storm', 150], ['clear', 240], ['shower', 120]],
  afghanistan: [['clear', 320], ['wind', 180], ['haze', 200], ['clear', 260], ['dryStorm', 150], ['overcast', 140]],
  mali: [['clear', 900], ['haze', 300], ['clear', 600], ['dryStorm', 160], ['haze', 240]],
  norway: [['clear', 280], ['overcast', 160], ['snow', 170], ['clear', 220], ['mist', 160], ['snow', 140]],
  flood: [['clear', 320], ['mist', 200], ['clear', 260], ['overcast', 220]],
};

const REPORT = {
  mist: 'Frühnebel im Tal – Sicht teils unter 1 km. Tief und langsam fliegen.',
  haze: 'Dunst zieht auf, die Fernsicht nimmt ab.',
  overcast: 'Tiefe Wolken, Untergrenze sinkt – auf Sicht bleiben.',
  shower: 'Regenschauer im Einsatzgebiet, Sicht eingeschränkt, leichte Böen.',
  storm: 'Wetterwarnung! Gewitterfront mit Starkregen und Sturmböen – Blitzschlag möglich.',
  dryStorm: 'Gewitter in der Nähe – kräftige Böen, Blitze. Abstand zu den Zellen halten.',
  wind: 'Starkwind mit Böen aus West – bei Landungen mit Abdrift rechnen.',
  snow: 'Schneeschauer! Sicht stark eingeschränkt, Whiteout-Gefahr bei Landungen.',
  clear: 'Das Wetter klart auf, Sicht wieder gut.',
};

const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class WeatherSys {
  constructor(game) {
    this.g = game;
    this.cycle = CYCLES[T.id] || CYCLES.vietnam;
    this.period = this.cycle.reduce((a, c) => a + c[1], 0);
    this.cur = { ...STATES.clear };
    this.name = 'clear';
    this.flash = 0;
    this.nextBolt = 8;
    this.build();
  }

  get enabled() { return this.g.settings.weather !== false; }

  build() {
    const scene = this.g.scene;
    // Regen: Striche um die Kamera
    const N = 2600;
    this.rainN = N;
    this.rainPos = new Float32Array(N * 6);
    this.rainDrop = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.rainDrop[i * 3] = (Math.random() - 0.5) * 90; this.rainDrop[i * 3 + 1] = (Math.random() - 0.5) * 60; this.rainDrop[i * 3 + 2] = (Math.random() - 0.5) * 90; }
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    // Schnee: Flocken um die Kamera
    const S = 2400;
    this.snowN = S;
    this.snowPos = new Float32Array(S * 3);
    for (let i = 0; i < S * 3; i++) this.snowPos[i] = (Math.random() - 0.5) * (i % 3 === 1 ? 50 : 70);
    this.snowOff = this.snowPos.slice();
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    // runde, weiche Flocken
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.9, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);
    // Blitz: gezackter Strahl in der Ferne
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
    this.bolt = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf4f6ff, transparent: true, opacity: 1, depthWrite: false, fog: false }));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    scene.add(this.bolt);
  }

  // Wetterzustand zur Spielzeit t (mit 40 s Übergang zum nächsten)
  stateAt(t) {
    if (!this.enabled) return { key: 'clear', s: STATES.clear };
    let ph = ((t % this.period) + this.period) % this.period;
    for (let i = 0; i < this.cycle.length; i++) {
      const [k, d] = this.cycle[i];
      if (ph < d) {
        const nk = this.cycle[(i + 1) % this.cycle.length][0];
        const f = sm(d - 40, d, ph);
        const a = STATES[k], b = STATES[nk], s = {};
        for (const key of ['fog', 'light', 'grey', 'rain', 'snow', 'gust']) s[key] = a[key] + (b[key] - a[key]) * f;
        s.thunder = (a.thunder && f < 0.7) || (b.thunder && f > 0.3);
        return { key: f < 0.5 ? k : nk, s };
      }
      ph -= d;
    }
    return { key: 'clear', s: STATES.clear };
  }

  update(dt, time) {
    const g = this.g, { key, s } = this.stateAt(time);
    this.cur = s;
    if (key !== this.name) {
      const was = this.name;
      this.name = key;
      if (g.state === 'playing' && REPORT[key] && !(key === 'clear' && was === 'clear')) g.radio(REPORT[key], 'TOC', key === 'storm' || key === 'snow');
    }
    const cam = g.camera.position;
    // Niederschlag
    this.rain.visible = s.rain > 0.02;
    if (this.rain.visible) this.updateRain(Math.min(dt, 0.05), cam, s.rain);
    this.snow.visible = s.snow > 0.02;
    if (this.snow.visible) this.updateSnow(Math.min(dt, 0.05), cam, s.snow, time);
    // Blitze
    this.flash = Math.max(0, this.flash - dt * 6);
    this.bolt.visible = this.flash > 0.25;
    if (s.thunder && g.state === 'playing') {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.strike(cam); this.nextBolt = 6 + rand() * 14; }
    }
    return s;
  }

  updateRain(dt, cam, k) {
    const d = this.rainDrop, p = this.rainPos, n = Math.floor(this.rainN * k);
    const vy = 28 * dt, wx = (3 + this.cur.gust * 4) * dt;
    for (let i = 0; i < n; i++) {
      let y = d[i * 3 + 1] - vy, x = d[i * 3] + wx;
      if (y < -30) { y += 60; x = (Math.random() - 0.5) * 90; d[i * 3 + 2] = (Math.random() - 0.5) * 90; }
      if (x > 45) x -= 90;
      d[i * 3] = x; d[i * 3 + 1] = y;
      const X = cam.x + x, Y = cam.y + y, Z = cam.z + d[i * 3 + 2];
      p[i * 6] = X; p[i * 6 + 1] = Y; p[i * 6 + 2] = Z; p[i * 6 + 3] = X - 0.15; p[i * 6 + 4] = Y + 1.2; p[i * 6 + 5] = Z;
    }
    this.rain.geometry.setDrawRange(0, n * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  updateSnow(dt, cam, k, t) {
    const o = this.snowOff, p = this.snowPos, n = Math.floor(this.snowN * k);
    const vy = 2.2 * dt, wx = (1.5 + this.cur.gust * 3) * dt;
    for (let i = 0; i < n; i++) {
      let x = o[i * 3] + wx + Math.sin(t * 1.3 + i) * 0.02, y = o[i * 3 + 1] - vy;
      if (y < -25) y += 50;
      if (x > 35) x -= 70;
      o[i * 3] = x; o[i * 3 + 1] = y;
      p[i * 3] = cam.x + x; p[i * 3 + 1] = cam.y + y; p[i * 3 + 2] = cam.z + o[i * 3 + 2];
    }
    this.snow.geometry.setDrawRange(0, n);
    this.snow.geometry.attributes.position.needsUpdate = true;
  }

  // Blitzeinschlag 1,5–4 km entfernt, Donner mit Schallverzögerung
  strike(cam) {
    const g = this.g, a = rand() * Math.PI * 2, d = 1500 + rand() * 2500;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    const gy = Math.max(0, g.world.height(x, z));
    const p = this.bolt.geometry.attributes.position;
    let px = x, pz = z;
    for (let i = 0; i < 28; i++) {
      const y = 950 - (i / 27) * (950 - gy);
      p.setXYZ(i, px, y, pz);
      px += (rand() - 0.5) * 70; pz += (rand() - 0.5) * 70;
    }
    p.needsUpdate = true;
    this.flash = 1;
    const delay = d / 343;
    setTimeout(() => { if (g.audio && g.state === 'playing') g.audio.boom(Math.min(1800, d * 0.5)); }, delay * 1000);
  }
}
