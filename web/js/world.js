// Spielwelt: Terrain, Fluss, Reisfelder, Dschungel, Dörfer, FOB, Landezonen, Himmel
import * as THREE from './lib/three.module.min.js';
import { HALF, GRID, CELL, WORLD_SIZE, FOB_POS, FOB_NAME } from './config.js';
import { makeNoise } from './noise.js';
import { makeRng, smoothstep, clamp, lerp, dist2 } from './util.js';
import * as M from './models.js';

const SITE_NAMES = [
  'LZ X-Ray', 'LZ Albany', 'LZ Bravo', 'LZ Dog', 'LZ Tango', 'LZ Sierra', 'LZ Hotel', 'LZ Juliet',
  'LZ Mike', 'LZ Oscar', 'LZ Rocket', 'LZ Snake', 'LZ Uplift', 'LZ English', 'LZ Baldy', 'LZ Ross',
  'LZ Hawk', 'LZ Falcon', 'LZ Cobra', 'LZ Viper', 'LZ Python', 'LZ Raven', 'LZ Delta', 'LZ Echo',
];
const VILLAGE_NAMES = ['An Khe', 'Bong Son', 'Phu Cat', 'Duc Pho', 'Tam Ky', 'Song Be', 'Lai Khe'];

const s2l = (c) => Math.pow(c, 2.2);

export class World {
  constructor(scene, quality = 'medium', seed = 1968) {
    this.scene = scene;
    this.quality = quality;
    this.n = makeNoise(seed);
    this.rng = makeRng(seed * 7 + 3);
    this.N = GRID + 1;
    this.h = new Float32Array(this.N * this.N);
    this.paddy = new Float32Array(this.N * this.N);
    this.forest = new Float32Array(this.N * this.N);
    this.flats = [];
    this.sites = [];
    this.villages = [];

    this.generateHeights();
    this.buildTerrain();
    this.buildWater();
    this.buildSky();
    this.buildFOB();
    this.buildVillages();
    this.buildTrees();
    this.mapCanvas = this.renderMap(512);
  }

  // ------------------------------------------------------------ Höhen
  riverX(z) { return -1100 + 520 * Math.sin(z * 0.0011 + 1.3) + 260 * this.n.noise(3.1, z * 0.0006); }
  tribZ(x) { return -650 + 320 * Math.sin(x * 0.0016 + 0.4) + 150 * this.n.noise(x * 0.0008, 7.7); }

  riverDist(x, z) {
    const rx = this.riverX(z);
    const sl = (this.riverX(z + 5) - this.riverX(z - 5)) / 10;
    let d = Math.abs(x - rx) / Math.sqrt(1 + sl * sl);
    let w = 34 + 12 * this.n.noise(z * 0.002, 1.7);
    if (x > rx && x < HALF - 200) {
      const tz = this.tribZ(x);
      const ts = (this.tribZ(x + 5) - this.tribZ(x - 5)) / 10;
      const td = Math.abs(z - tz) / Math.sqrt(1 + ts * ts);
      const tw = 13 + 4 * this.n.noise(x * 0.003, 4.4);
      if (td - tw < d - w) { d = td; w = tw; }
    }
    return { d, w };
  }

  mountainMask(x, z) {
    return smoothstep(0.05, 0.75, this.n.fbm(x * 0.00022 + 5, z * 0.00022 - 3, 3) * 0.6 + (-z / HALF) * 0.38 + (-x / HALF) * 0.22 + 0.12);
  }

  rawHeight(x, z, out) {
    const n = this.n;
    const mountain = this.mountainMask(x, z);
    const hills = n.fbm(x * 0.0011, z * 0.0011, 4);
    let ridge = 1 - Math.abs(n.fbm(x * 0.0007 + 11, z * 0.0007 + 4, 4));
    ridge *= ridge;
    let h = 6 + hills * 5 + mountain * (ridge * 430 + (hills + 1) * 55);
    const { d, w } = this.riverDist(x, z);
    const v = smoothstep(w, w + 260, d);
    h = lerp(-3.5, h, Math.pow(v, 0.8));
    // Reisfelder in der Flussebene
    let p = smoothstep(0.05, 0.35, n.noise(x * 0.0024 + 20, z * 0.0024 - 9));
    p *= 1 - smoothstep(0.02, 0.1, mountain);
    p *= smoothstep(w + 25, w + 60, d) * (1 - smoothstep(700, 1000, d));
    if (p > 0.5 && h > 0.8) h = Math.floor(h / 1.1) * 1.1 + 0.6;
    // Rand der Karte abflachen
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, 4, e);
    if (out) { out.paddy = p > 0.5 && h > 0.8 ? 1 : 0; out.mountain = mountain; out.river = d - w; }
    return h;
  }

  generateHeights() {
    const N = this.N, o = {};
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const i = iz * N + ix;
        this.h[i] = this.rawHeight(x, z, o);
        this.paddy[i] = o.paddy;
        const f = smoothstep(-0.7, -0.25, this.n.noise(x * 0.0017 + 40, z * 0.0017) + o.mountain * 0.4);
        this.forest[i] = o.paddy ? 0 : f * smoothstep(1.0, 3.0, this.h[i]);
      }
    }
    // FOB
    const fobH = Math.max(4, this.rawHeight(FOB_POS.x, FOB_POS.z));
    this.fob = { name: FOB_NAME, x: FOB_POS.x, z: FOB_POS.z, y: fobH, r: 230 };
    this.flatten(FOB_POS.x, FOB_POS.z, 235, 140, fobH, 'fob');

    // Landezonen suchen
    const rng = this.rng;
    const names = SITE_NAMES.slice();
    let tries = 0;
    while (this.sites.length < 22 && tries++ < 6000) {
      const x = rng.range(-HALF + 380, HALF - 380), z = rng.range(-HALF + 380, HALF - 380);
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < 950 || df > 3400) continue;
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 1.8 || h > 280 || o2.river < 90) continue;
      let maxd = 0;
      for (const [dx, dz] of [[45, 0], [-45, 0], [0, 45], [0, -45]]) maxd = Math.max(maxd, Math.abs(this.rawHeight(x + dx, z + dz) - h));
      if (maxd > 22) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 520)) continue;
      const name = names.splice(Math.floor(rng() * names.length), 1)[0];
      this.sites.push({ name, x, z, y: h, r: 45 });
      this.flatten(x, z, 46, 75, h, 'site');
    }

    // Dörfer
    const vnames = VILLAGE_NAMES.slice();
    tries = 0;
    while (this.villages.length < 6 && tries++ < 4000) {
      const x = rng.range(-HALF + 400, HALF - 400), z = rng.range(-HALF + 400, HALF - 400);
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 2 || o2.mountain > 0.05 || o2.river < 120 || o2.river > 750) continue;
      if (dist2(x, z, FOB_POS.x, FOB_POS.z) < 650) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 300)) continue;
      if (this.villages.some((s) => dist2(s.x, s.z, x, z) < 900)) continue;
      this.villages.push({ name: vnames.shift(), x, z, y: h });
      this.flatten(x, z, 55, 50, h, 'village');
    }
  }

  flatten(cx, cz, r, blend, target, kind) {
    this.flats.push({ x: cx, z: cz, r, blend, kind });
    const N = this.N;
    const R = r + blend;
    const i0 = Math.max(0, Math.floor((cx - R + HALF) / CELL)), i1 = Math.min(N - 1, Math.ceil((cx + R + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((cz - R + HALF) / CELL)), j1 = Math.min(N - 1, Math.ceil((cz + R + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -HALF + i * CELL, z = -HALF + j * CELL;
      const d = Math.hypot(x - cx, z - cz);
      if (d > R) continue;
      const t = smoothstep(r, R, d);
      const k = j * N + i;
      this.h[k] = lerp(target, this.h[k], t);
      if (t < 1) { this.paddy[k] *= t; this.forest[k] *= t * t; }
    }
  }

  // Höhe exakt passend zur Dreiecksaufteilung des Meshes
  height(x, z) {
    const N = this.N;
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    fx = clamp(fx, 0, GRID - 0.0001); fz = clamp(fz, 0, GRID - 0.0001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const u = fx - ix, v = fz - iz;
    const a = this.h[iz * N + ix], b = this.h[(iz + 1) * N + ix];
    const c = this.h[(iz + 1) * N + ix + 1], d = this.h[iz * N + ix + 1];
    if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
    return c + (b - c) * (1 - u) + (d - c) * (1 - v);
  }
  groundHeight(x, z) { return Math.max(this.height(x, z), 0); }
  isWater(x, z) { return this.height(x, z) < -0.05; }
  normal(x, z, out = new THREE.Vector3()) {
    const e = 2;
    return out.set(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e)).normalize();
  }
  inForest(x, z) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, GRID), iz = clamp(Math.round((z + HALF) / CELL), 0, GRID);
    return this.forest[iz * N + ix];
  }
  los(ax, ay, az, bx, by, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(2, Math.ceil(d / 25));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.height(lerp(ax, bx, t), lerp(az, bz, t)) > lerp(ay, by, t) + 0.5) return false;
    }
    return true;
  }
  nearFlat(x, z, pad = 0) {
    for (const f of this.flats) if (dist2(f.x, f.z, x, z) < f.r + pad) return f;
    return null;
  }

  // ------------------------------------------------------------ Terrain-Mesh
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    let r = 0.30 + n * 0.04, g = 0.40 + n * 0.05, b = 0.17;
    const f = this.forest[i];
    r = lerp(r, 0.12 + n * 0.03, f); g = lerp(g, 0.23 + n * 0.04, f); b = lerp(b, 0.08, f);
    const p = this.paddy[i];
    if (p > 0) {
      const chk = (Math.floor(x / 37) + Math.floor(z / 29)) & 1;
      r = lerp(r, chk ? 0.36 : 0.30, p); g = lerp(g, chk ? 0.52 : 0.46, p); b = lerp(b, chk ? 0.22 : 0.30, p);
    }
    const steep = smoothstep(0.82, 0.62, nY);
    r = lerp(r, 0.38, steep); g = lerp(g, 0.34, steep); b = lerp(b, 0.26, steep);
    const mud = smoothstep(2.0, 0.4, h);
    r = lerp(r, 0.44, mud); g = lerp(g, 0.37, mud); b = lerp(b, 0.24, mud);
    for (const fl of this.flats) {
      const d = Math.hypot(x - fl.x, z - fl.z);
      if (d > fl.r + 40) continue;
      const t = 1 - smoothstep(fl.r * 0.85, fl.r + 30, d);
      if (fl.kind === 'fob') { r = lerp(r, 0.47 + n * 0.04, t); g = lerp(g, 0.36 + n * 0.03, t); b = lerp(b, 0.25, t); }
      else if (fl.kind === 'site') { r = lerp(r, 0.45 + n * 0.05, t); g = lerp(g, 0.44 + n * 0.05, t); b = lerp(b, 0.22, t); }
      else { r = lerp(r, 0.48, t * 0.8); g = lerp(g, 0.40, t * 0.8); b = lerp(b, 0.25, t * 0.8); }
    }
    return [r, g, b];
  }

  buildTerrain() {
    const N = this.N;
    const pos = new Float32Array(N * N * 3);
    const uv = new Float32Array(N * N * 2);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const i = iz * N + ix;
      pos[i * 3] = -HALF + ix * CELL; pos[i * 3 + 1] = this.h[i]; pos[i * 3 + 2] = -HALF + iz * CELL;
      uv[i * 2] = ix * 1.5; uv[i * 2 + 1] = iz * 1.5;
    }
    const idx = new Uint32Array(GRID * GRID * 6);
    let k = 0;
    for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
      const a = iz * N + ix, b = (iz + 1) * N + ix, c = (iz + 1) * N + ix + 1, d = iz * N + ix + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = d;
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal.array;
    const col = new Float32Array(N * N * 3);
    this.colors = new Float32Array(N * N * 3); // sRGB-Werte für die Karte
    for (let i = 0; i < N * N; i++) {
      const c = this.vertexColor(i, pos[i * 3], pos[i * 3 + 2], nor[i * 3 + 1]);
      this.colors.set(c, i * 3);
      col[i * 3] = s2l(c[0]); col[i * 3 + 1] = s2l(c[1]); col[i * 3 + 2] = s2l(c[2]);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: this.detailTexture() });
    this.terrain = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrain);

    // Umland außerhalb der Karte
    const outer = new THREE.MeshLambertMaterial({ color: 0x24381a });
    const S = 30000;
    for (const [x, z, w, d] of [[0, -HALF - S / 2, S * 2, S], [0, HALF + S / 2, S * 2, S], [-HALF - S / 2, 0, S, WORLD_SIZE], [HALF + S / 2, 0, S, WORLD_SIZE]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), outer);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 3.9, z);
      this.scene.add(m);
    }
  }

  detailTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    const r = makeRng(42);
    for (let i = 0; i < 128 * 128; i++) {
      const px = i % 128, py = (i / 128) | 0;
      const v = 0.86 + r() * 0.14 + 0.05 * Math.sin(px * 0.35) * Math.sin(py * 0.27);
      const b = clamp(v, 0, 1) * 255;
      img.data[i * 4] = b; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const mat = new THREE.MeshPhongMaterial({ color: 0x6b6440, specular: 0x667766, shininess: 70, transparent: true, opacity: 0.88 });
    this.water = new THREE.Mesh(geo, mat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.scene.add(this.water);
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(4800, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x5d8fc4) }, horizon: { value: new THREE.Color(0xc4cbbd) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)); gl_FragColor = vec4(c,1.0); }',
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.5, 'rgba(250,250,250,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const r = makeRng(77);
    this.clouds = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55 + r() * 0.3, depthWrite: false, color: 0xf4f4f0 });
      const s = new THREE.Sprite(m);
      const cx = r.range(-HALF * 1.3, HALF * 1.3), cz = r.range(-HALF * 1.3, HALF * 1.3);
      for (let j = 0; j < 3; j++) {
        const sj = j === 0 ? s : new THREE.Sprite(m);
        sj.position.set(cx + r.range(-150, 150), r.range(850, 1150), cz + r.range(-150, 150));
        const sc = r.range(250, 520);
        sj.scale.set(sc, sc * 0.45, 1);
        this.clouds.add(sj);
      }
    }
    this.scene.add(this.clouds);
  }

  // ------------------------------------------------------------ FOB
  buildFOB() {
    const f = this.fob;
    const parts = [];
    const add = (list, lx, lz, rot = 0, dy = 0) => {
      M.placeParts(list, f.x + lx, f.y + dy, f.z + lz, rot);
      parts.push(...list);
    };
    f.pads = {
      troop: { x: f.x + 0, z: f.z + 40, name: 'H1' },
      med: { x: f.x - 62, z: f.z - 25, name: 'MED' },
      pol: { x: f.x + 62, z: f.z - 25, name: 'POL' },
      h2: { x: f.x - 40, z: f.z + 95, name: 'H2' },
    };
    add(M.padParts('troop'), 0, 40);
    add(M.padParts('med'), -62, -25);
    add(M.padParts('pol'), 62, -25);
    add(M.padParts('troop'), -40, 95);
    add(M.padParts('troop'), 40, 95);
    // Lazarett
    add(M.hospitalParts(), -62, -62, Math.PI);
    f.hospitalDoor = { x: f.x - 62, z: f.z - 52 };
    add(M.tentParts(6, 9, 3.4), -95, -60, Math.PI / 2);
    // Tankwagen & Treibstoffblasen
    add(M.fuelTruckParts(), 82, -22, 0.15);
    f.truck = { x: f.x + 82, z: f.z - 22 };
    add(M.bladderParts(), 102, -52, 0.2);
    add(M.bladderParts(), 112, -30, 0.1);
    for (let i = 0; i < 6; i++) add(M.crateParts(), 40 + (i % 3) * 1.4, -50 - Math.floor(i / 3) * 1.0, 0, Math.floor(i / 3) * 0);
    // TOC-Bunker, Zelte
    add(M.bunkerParts(), -10, -15);
    parts.push(...M.placeParts([M.P(new THREE.CylinderGeometry(0.05, 0.08, 12, 5), 0x333333, [0, 6, 0])], f.x - 7, f.y, f.z - 16));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(M.tentParts(5, 8, 3), -150 + c * 13, 30 + r * 18, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) add(M.tentParts(5, 8, 3), 100 + c * 13, 30 + r * 18 + 60, 0);
    add(M.tentParts(8, 14, 4, 0x55593a), -120, -120, 0.4);
    add(M.tentParts(8, 14, 4, 0x55593a), 120, -120, -0.4);
    // Artillerie
    for (const [x, z, rt] of [[140, 40, -0.6], [155, 62, -0.7], [128, 70, -0.5]]) {
      add(M.howitzerParts(), x, z, rt);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        add(M.sandbagWall(4, 0.9), x + Math.cos(a) * 5, z + Math.sin(a) * 5, -a + Math.PI / 2);
      }
    }
    add(M.jeepParts(), -20, 10, 0.7);
    add(M.jeepParts(), 30, -5, -0.4);
    // Wachtürme und Sandsackwall
    const R = 205;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      add(M.towerParts(), Math.cos(a) * (R - 8), Math.sin(a) * (R - 8), 0);
    }
    const segs = 96;
    for (let i = 0; i < segs; i++) {
      if (i % 24 === 0 || i % 24 === 1) continue; // Tore
      const a = (i / segs) * Math.PI * 2;
      add(M.sandbagWall((2 * Math.PI * R) / segs + 0.4, 1.3), Math.cos(a) * R, Math.sin(a) * R, -a + Math.PI / 2);
    }
    this.fobMesh = new THREE.Mesh(M.merge(parts), M.vcMat);
    this.scene.add(this.fobMesh);

    // Flagge
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 12, 6), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    pole.position.set(f.x + 12, f.y + 6, f.z - 5);
    this.scene.add(pole);
    const fc = document.createElement('canvas');
    fc.width = 190; fc.height = 100;
    const fx = fc.getContext('2d');
    for (let i = 0; i < 13; i++) { fx.fillStyle = i % 2 ? '#fff' : '#b22234'; fx.fillRect(0, (i * 100) / 13, 190, 100 / 13 + 1); }
    fx.fillStyle = '#3c3b6e'; fx.fillRect(0, 0, 76, 54);
    fx.fillStyle = '#fff';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) fx.fillRect(5 + c * 12, 4 + r * 10, 3, 3);
    const ftex = new THREE.CanvasTexture(fc);
    ftex.colorSpace = THREE.SRGBColorSpace;
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.5, 8, 1), new THREE.MeshLambertMaterial({ map: ftex, side: THREE.DoubleSide }));
    this.flag.position.set(f.x + 12 + 1.45, f.y + 11.1, f.z - 5);
    this.scene.add(this.flag);
    this.flagBase = this.flag.geometry.attributes.position.array.slice();

    // Abgestellte Hueys (der erste steht auf Pad H2 und weicht im Mehrspieler dem zweiten Hubschrauber)
    this.parked = [];
    for (const [x, z, r, num] of [[-40, 95, 0.3, '66-16112'], [40, 95, -0.2, '67-17541']]) {
      const h = M.buildHuey({ static: true, number: num });
      h.group.position.set(f.x + x, f.y + 1.6 + 0.12, f.z + z);
      h.group.rotation.y = r;
      h.mainRotor.rotation.y = 0.6;
      for (const g of Object.values(h.guns)) g.gunner.group.visible = false;
      for (const p of h.pilots) p.group.visible = false;
      this.scene.add(h.group);
      this.parked.push(h.group);
    }

    // Statische Soldaten in der FOB
    this.fobFigures = [];
    const spots = [[5, -8], [-25, -5], [-30, 2], [48, -40], [44, -47], [-55, -46], [-70, -46], [110, 75], [150, 50], [-5, 30], [20, 15]];
    for (const [x, z] of spots) {
      const fig = new M.Figure(this.rng() < 0.25 ? 'us2' : 'us');
      fig.group.position.set(f.x + x, f.y, f.z + z);
      fig.group.rotation.y = this.rng() * Math.PI * 2;
      this.scene.add(fig.group);
      this.fobFigures.push(fig);
    }
  }

  buildVillages() {
    const parts = [];
    for (const v of this.villages) {
      const n = 6 + Math.floor(this.rng() * 6);
      for (let i = 0; i < n; i++) {
        const a = this.rng() * Math.PI * 2, d = 8 + this.rng() * 42;
        const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
        parts.push(...M.placeParts(M.hutParts(this.rng), x, this.height(x, z) - 0.2, z, this.rng() * Math.PI));
      }
      for (let i = 0; i < 6; i++) {
        const a = this.rng() * Math.PI * 2, d = 20 + this.rng() * 45;
        const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
        parts.push(...M.placeParts(M.palmParts(), x, this.height(x, z) - 0.2, z, this.rng() * 6));
      }
    }
    if (parts.length) {
      this.villageMesh = new THREE.Mesh(M.merge(parts), M.vcMat);
      this.scene.add(this.villageMesh);
    }
  }

  // ------------------------------------------------------------ Bäume
  // Zellbasiert und deterministisch: dichter Dschungel im Nahbereich, lichter Fernbereich.
  buildTrees() {
    const q = this.quality;
    this.TC = 100;
    this.TN = Math.ceil(WORLD_SIZE / this.TC);
    this.perCell = { low: 22, medium: 30, high: 36 }[q] || 30;
    this.farK = { low: 2, medium: 3, high: 3 }[q] || 3;
    this.nearR = { low: 380, medium: 560, high: 780 }[q] || 560;
    this.cellCache = new Map();
    const broad = M.merge([
      M.P(new THREE.CylinderGeometry(0.35, 0.55, 9, 5), 0x4e3d2a, [0, 4.5, 0]),
      M.P(new THREE.IcosahedronGeometry(1, 0), 0x2f5a22, [0, 11, 0], [0, 0, 0], [6.4, 3.4, 6.4]),
      M.P(new THREE.IcosahedronGeometry(1, 0), 0x36652a, [2.6, 12.2, 1.2], [0.5, 0.3, 0], [3.4, 2.4, 3.4]),
    ]);
    const tall = M.merge([
      M.P(new THREE.CylinderGeometry(0.3, 0.5, 14, 5), 0x5a4a35, [0, 7, 0]),
      M.P(new THREE.IcosahedronGeometry(1, 0), 0x3b6328, [0, 16, 0], [0, 0, 0], [4.8, 2.4, 4.8]),
    ]);
    const palm = M.merge(M.palmParts());
    this.treeTypes = [
      { geo: broad, top: 14.4, r: 6.4, w: 0.64 },
      { geo: tall, top: 18.4, r: 4.8, w: 0.24 },
      { geo: palm, top: 9.5, r: 3.5, w: 0.12 },
    ];
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this._m4 = new THREE.Matrix4(); this._q4 = new THREE.Quaternion(); this._e4 = new THREE.Euler(); this._p4 = new THREE.Vector3(); this._s4 = new THREE.Vector3();
    this._c4 = new THREE.Color();

    // Fernbereich: die ersten K Bäume jeder Zelle, statisch
    const far = this.treeTypes.map(() => []);
    for (let i = 0; i < this.TN; i++) for (let j = 0; j < this.TN; j++) {
      const c = this.cellTrees(i, j);
      for (let k = 0; k < Math.min(this.farK, c.n); k++) far[c.t[k]].push([c, k]);
    }
    this.farMeshes = this.treeTypes.map((t, ti) => {
      const im = new THREE.InstancedMesh(t.geo, mat, Math.max(1, far[ti].length));
      far[ti].forEach(([c, k], idx) => this.writeTree(im, idx, c, k));
      im.count = far[ti].length;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
      return im;
    });
    // Nahbereich: dynamisch um die Kamera
    const cellsIn = Math.ceil((Math.PI * (this.nearR + this.TC) ** 2) / (this.TC * this.TC));
    const cap = cellsIn * this.perCell;
    this.nearMeshes = this.treeTypes.map((t) => {
      const im = new THREE.InstancedMesh(t.geo, mat, Math.ceil(cap * Math.min(1, t.w + 0.15)));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      this.scene.add(im);
      return im;
    });
    this.nearKey = null;
  }

  cellTrees(i, j) {
    const key = i * 1000 + j;
    let c = this.cellCache.get(key);
    if (c) return c;
    const rng = makeRng(((i * 73856093) ^ (j * 19349663) ^ 0x9e3779b9) >>> 0);
    const n = this.perCell, TC = this.TC;
    c = { n: 0, x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), s: new Float32Array(n), r: new Float32Array(n), t: new Uint8Array(n), top: new Float32Array(n), rad: new Float32Array(n), v: new Float32Array(n) };
    const x0 = -HALF + i * TC, z0 = -HALF + j * TC;
    const cx = x0 + TC / 2, cz = z0 + TC / 2;
    const fob = dist2(cx, cz, this.fob.x, this.fob.z) < 420;
    const sites = this.sites.filter((s) => dist2(s.x, s.z, cx, cz) < 140);
    const vills = this.villages.filter((s) => dist2(s.x, s.z, cx, cz) < 130);
    for (let k = 0; k < n; k++) {
      const x = x0 + rng() * TC, z = z0 + rng() * TC;
      const roll = rng(), tr = rng(), sc = rng.range(0.8, 1.45), rot = rng() * Math.PI * 2, v = rng();
      const f = this.inForest(x, z);
      if (f <= 0.02 || roll > f) continue;
      const h = this.height(x, z);
      if (h < 1.2) continue;
      if (fob && dist2(x, z, this.fob.x, this.fob.z) < 270) continue;
      if (sites.some((s) => dist2(s.x, s.z, x, z) < 58)) continue;
      if (vills.some((s) => dist2(s.x, s.z, x, z) < 50)) continue;
      const T = this.treeTypes;
      const ti = tr < T[0].w ? 0 : tr < T[0].w + T[1].w ? 1 : 2;
      const m = c.n++;
      c.x[m] = x; c.z[m] = z; c.y[m] = h - 0.3; c.s[m] = sc; c.r[m] = rot; c.t[m] = ti; c.v[m] = v;
      c.top[m] = h + T[ti].top * sc;
      c.rad[m] = T[ti].r * sc;
    }
    this.cellCache.set(key, c);
    return c;
  }

  writeTree(im, idx, c, k) {
    this._e4.set(0, c.r[k], 0);
    this._q4.setFromEuler(this._e4);
    const s = c.s[k];
    this._m4.compose(this._p4.set(c.x[k], c.y[k], c.z[k]), this._q4, this._s4.set(s, s * (0.88 + c.v[k] * 0.24), s));
    im.setMatrixAt(idx, this._m4);
    const v = 0.75 + c.v[k] * 0.4;
    im.setColorAt(idx, this._c4.setRGB(v * (0.92 + c.v[k] * 0.12), v, v * (0.9 + (1 - c.v[k]) * 0.12)));
  }

  updateTrees(pos) {
    const TC = this.TC;
    const ci = Math.floor((pos.x + HALF) / TC), cj = Math.floor((pos.z + HALF) / TC);
    const key = ci * 1000 + cj;
    if (key === this.nearKey) return;
    this.nearKey = key;
    const R = this.nearR, rc = Math.ceil(R / TC);
    const counts = [0, 0, 0];
    const caps = this.nearMeshes.map((m) => m.instanceMatrix.count);
    for (let i = ci - rc; i <= ci + rc; i++) for (let j = cj - rc; j <= cj + rc; j++) {
      if (i < 0 || j < 0 || i >= this.TN || j >= this.TN) continue;
      const dx = (i - ci) * TC, dz = (j - cj) * TC;
      if (dx * dx + dz * dz > R * R) continue;
      const c = this.cellTrees(i, j);
      for (let k = this.farK; k < c.n; k++) {
        const t = c.t[k];
        if (counts[t] >= caps[t]) continue;
        this.writeTree(this.nearMeshes[t], counts[t]++, c, k);
      }
    }
    this.nearMeshes.forEach((m, t) => {
      m.count = counts[t];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  // Liefert den kritischsten Baum (größte Überdeckung) innerhalb des Radius
  treeContact(x, z, radius, yBottom, yTop) {
    const TC = this.TC;
    const ci = Math.floor((x + HALF) / TC), cj = Math.floor((z + HALF) / TC);
    let best = null, bestPen = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (i < 0 || j < 0 || i >= this.TN || j >= this.TN) continue;
      const c = this.cellTrees(i, j);
      for (let k = 0; k < c.n; k++) {
        if (yBottom > c.top[k] || yTop < c.top[k] - 8) continue;
        const dx = c.x[k] - x, dz = c.z[k] - z;
        if (Math.abs(dx) > 20 || Math.abs(dz) > 20) continue;
        const d = Math.hypot(dx, dz);
        const pen = radius + c.rad[k] * 0.8 - d;
        if (pen > bestPen) { bestPen = pen; best = { x: c.x[k], z: c.z[k], pen, d, top: c.top[k] }; }
      }
    }
    return best;
  }

  treeTopAt(x, z) {
    const c = this.treeContact(x, z, 1, -1e9, 1e9);
    return c ? c.top : null;
  }

  // ------------------------------------------------------------ Karte
  renderMap(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const N = this.N;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const x = -HALF + ((px + 0.5) / size) * WORLD_SIZE, z = -HALF + ((py + 0.5) / size) * WORLD_SIZE;
      const ix = clamp(Math.round((x + HALF) / CELL), 0, GRID), iz = clamp(Math.round((z + HALF) / CELL), 0, GRID);
      const i = iz * N + ix;
      const h = this.height(x, z);
      let r, g, b;
      if (h < 0) { r = 0.36; g = 0.42; b = 0.40; }
      else {
        r = this.colors[i * 3]; g = this.colors[i * 3 + 1]; b = this.colors[i * 3 + 2];
        const shade = clamp(1 + (this.height(x - 12, z - 12) - this.height(x + 12, z + 12)) * 0.03, 0.6, 1.4);
        r *= shade; g *= shade; b *= shade;
      }
      const o = (py * size + px) * 4;
      img.data[o] = clamp(r * 1.3, 0, 1) * 255; img.data[o + 1] = clamp(g * 1.3, 0, 1) * 255; img.data[o + 2] = clamp(b * 1.3, 0, 1) * 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const toPx = (v) => ((v + HALF) / WORLD_SIZE) * size;
    ctx.fillStyle = 'rgba(120,80,40,0.9)';
    for (const v of this.villages) { ctx.beginPath(); ctx.arc(toPx(v.x), toPx(v.z), 3, 0, 7); ctx.fill(); }
    return c;
  }

  gridRef(x, z) {
    const col = 'ABCDEF'[clamp(Math.floor((x + HALF) / 1000), 0, 5)];
    const row = clamp(Math.floor((z + HALF) / 1000), 0, 5) + 1;
    const sx = Math.floor((((x + HALF) % 1000) / 1000) * 10), sz = Math.floor((((z + HALF) % 1000) / 1000) * 10);
    return `${col}${row}-${sx}${sz}`;
  }

  update(dt, t, camera) {
    this.sky.position.copy(camera.position);
    this.updateTrees(camera.position);
    // Flagge flattern
    const a = this.flag.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const bx = this.flagBase[i * 3];
      a.array[i * 3 + 2] = Math.sin(t * 5 + bx * 2.2) * 0.12 * (bx + 1.45);
    }
    a.needsUpdate = true;
    this.clouds.position.x = (t * 2) % 400;
  }
}
