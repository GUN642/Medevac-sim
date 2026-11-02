// Afghanistan: staubige Hochwüste, Flussoase mit Feldern und Pappeln, Lehmdörfer, schroffe Berge
import * as THREE from './lib/three.module.min.js';
import { HALF, CELL, FOB_POS } from './config.js';
import { World } from './world.js';
import { T } from './theme.js';
import { smoothstep, lerp, dist2, clamp, makeRng } from './util.js';
import * as M from './models.js';
import * as A from './afgModels.js';

const SITE_NAMES = [
  'COP Nolay', 'COP Spin', 'PB Wahid', 'PB Viking', 'HLZ Dragon', 'HLZ Falcon', 'COP Jackson', 'PB Talib Jan',
  'HLZ Raven', 'COP Pinnacle', 'PB Kalang', 'HLZ Ice', 'COP Keating', 'PB Sandford', 'HLZ Lion', 'COP Ranch',
  'PB Hazrat', 'HLZ Wolf', 'COP Monti', 'PB Shamal', 'HLZ Bastion', 'COP Hutal', 'PB Kakaran', 'HLZ Saber',
];
const VILLAGE_NAMES = ['Chahar Dara', 'Isa Khel', 'Gor Tepa', 'Quatliam', 'Nahr-e Saraj', 'Haji Amanullah', 'Basus', 'Malgir', 'Shin Kalay', 'Karez-e Bala'];

export class AfghanWorld extends World {
  get outerColor() { return 0x9c8462; }
  get waterColor() { return 0x5f7466; }
  get villageClear() { return 95; }
  get outerHeight() { return 21.9; }

  // ------------------------------------------------------------ Höhen
  // Ein breiter Fluss zieht von Norden nach Süden durch die Ebene, dazu trockene Wadis
  riverX(z) { return 950 + 560 * Math.sin(z * 0.00085 + 0.6) + 240 * this.n.noise(2.3, z * 0.0005); }

  riverDist(x, z) {
    const rx = this.riverX(z);
    const sl = (this.riverX(z + 5) - this.riverX(z - 5)) / 10;
    const d = Math.abs(x - rx) / Math.sqrt(1 + sl * sl);
    const w = 42 + 16 * this.n.noise(z * 0.0015, 3.3);
    return { d, w };
  }

  mountainMask(x, z) {
    const n = this.n.fbm(x * 0.00025 - 7, z * 0.00025 + 2, 3) * 0.55;
    return smoothstep(0.08, 0.6, n + (-x / HALF) * 0.45 + (-z / HALF) * 0.42 - 0.05);
  }

  rawHeight(x, z, out) {
    const n = this.n;
    const mountain = this.mountainMask(x, z);
    const { d, w } = this.riverDist(x, z);
    // Grüne Zone entlang des Flusses (Breite schwankt)
    const gzW = 330 + 140 * n.noise(z * 0.0012, 9.1);
    const green = 1 - smoothstep(gzW - 60, gzW + 40, d);
    // Wüste: Dünen und flache Rücken, schroffe Grate in den Bergen
    const dunes = n.fbm(x * 0.0016 + 3, z * 0.0011 - 5, 3) * 7 + Math.abs(n.noise(x * 0.004, z * 0.004)) * 3;
    let ridge = 1 - Math.abs(n.fbm(x * 0.0009 + 31, z * 0.0009 - 8, 5));
    ridge = ridge * ridge * ridge;
    const crag = Math.abs(n.noise(x * 0.006 + 4, z * 0.006 - 1)) * 40;
    let h = 26 + dunes + mountain * (ridge * 640 + crag * (0.4 + mountain) + 60);
    // Abbruchkante zur Flussebene
    const valley = 3.5 + n.noise(x * 0.003, z * 0.003) * 1.2;
    h = lerp(valley, h, smoothstep(gzW - 40, gzW + 160, d));
    // Wadis (trockene Flussbetten) in der Wüste
    const wadiN = Math.abs(n.fbm(x * 0.0007 + 51, z * 0.0007 - 23, 3));
    const wadi = (1 - smoothstep(0.015, 0.05, wadiN)) * smoothstep(gzW + 80, gzW + 300, d) * (1 - mountain);
    h -= wadi * 6;
    // Flussbett mit Sandbänken
    const v = smoothstep(w, w + 70, d);
    const bar = n.noise(x * 0.02, z * 0.012) > 0.45 && d < w * 0.8 ? 1 : 0;
    h = lerp(bar ? 0.4 : -3.2, h, Math.pow(v, 0.7));
    // Felder: leichte Terrassen
    const field = green > 0.5 && h > 1.2 && d > w + 30;
    if (field) h = Math.floor(h / 0.6) * 0.6 + 0.3;
    // Kartenrand abflachen, das Flusstal läuft durch
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, lerp(Math.min(h, 3.5), 22, smoothstep(gzW - 40, gzW + 160, d)), e);
    if (out) { out.paddy = field ? 1 : 0; out.mountain = mountain; out.river = d - w; out.green = green; out.wadi = wadi; }
    return h;
  }

  generateHeights() {
    const N = this.N, o = {};
    this.green = new Float32Array(N * N);
    this.wadi = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const i = iz * N + ix;
        this.h[i] = this.rawHeight(x, z, o);
        this.paddy[i] = o.paddy;
        this.green[i] = o.green;
        this.wadi[i] = o.wadi;
        // Obstgärten und Pappelreihen in der grünen Zone, vereinzelt Gestrüpp in der Wüste
        const orch = smoothstep(-0.25, 0.35, this.n.noise(x * 0.005 + 40, z * 0.005));
        const rows = Math.abs(Math.sin(x * 0.045 + Math.sin(z * 0.01) * 2)) > 0.93 || Math.abs(Math.sin(z * 0.04)) > 0.95 ? 0.8 : 0;
        const f = o.green * Math.max(orch * 0.75, rows) * smoothstep(0.8, 1.8, this.h[i]) * (o.river > 25 ? 1 : 0);
        this.forest[i] = Math.max(f, (1 - o.green) * (1 - o.mountain) * 0.035);
      }
    }
    const fobH = Math.max(6, this.rawHeight(FOB_POS.x, FOB_POS.z));
    this.fob = { name: T.fobName, x: FOB_POS.x, z: FOB_POS.z, y: fobH, r: 230 };
    this.flatten(FOB_POS.x, FOB_POS.z, 240, 160, fobH, 'fob');

    const rng = this.rng;
    const names = SITE_NAMES.slice();
    let tries = 0;
    while (this.sites.length < 22 && tries++ < 8000) {
      const x = rng.range(-HALF + 380, HALF - 380), z = rng.range(-HALF + 380, HALF - 380);
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < 3050 || df > 5800) continue; // Einsatzorte mindestens 3 km von der FOB
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 1.8 || h > 420 || o2.river < 100) continue;
      let maxd = 0;
      for (const [dx, dz] of [[50, 0], [-50, 0], [0, 50], [0, -50]]) maxd = Math.max(maxd, Math.abs(this.rawHeight(x + dx, z + dz) - h));
      if (maxd > 26) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 520)) continue;
      const name = names.splice(Math.floor(rng() * names.length), 1)[0];
      this.sites.push({ name, x, z, y: h, r: 48, post: /^(COP|PB)/.test(name) });
      this.flatten(x, z, 50, 80, h, 'site');
    }

    const vnames = VILLAGE_NAMES.slice();
    tries = 0;
    while (this.villages.length < 9 && tries++ < 6000) {
      const x = rng.range(-HALF + 400, HALF - 400), z = rng.range(-HALF + 400, HALF - 400);
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      const inGreen = o2.green > 0.4 && o2.river > 110;
      const desertEdge = o2.green < 0.2 && o2.mountain < 0.1 && o2.river < 900;
      if (h < 1.5 || o2.mountain > 0.15 || !(inGreen || desertEdge)) continue;
      if (dist2(x, z, FOB_POS.x, FOB_POS.z) < 700) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 330)) continue;
      if (this.villages.some((s) => dist2(s.x, s.z, x, z) < 850)) continue;
      this.villages.push({ name: vnames.shift(), x, z, y: h, big: this.villages.length < 4 });
      this.flatten(x, z, 75, 70, h, 'village');
    }
  }

  // ------------------------------------------------------------ Farben
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    // Wüstensand
    let r = 0.74 + n * 0.05, g = 0.62 + n * 0.04, b = 0.44 + n * 0.03;
    // Geröll und Fels in den Bergen
    const mt = smoothstep(60, 220, h);
    r = lerp(r, 0.56 + n * 0.05, mt); g = lerp(g, 0.5 + n * 0.04, mt); b = lerp(b, 0.43 + n * 0.03, mt);
    const steep = smoothstep(0.85, 0.6, nY);
    r = lerp(r, 0.47, steep); g = lerp(g, 0.41, steep); b = lerp(b, 0.35, steep);
    const snow = smoothstep(560, 680, h) * smoothstep(0.55, 0.8, nY);
    r = lerp(r, 0.9, snow); g = lerp(g, 0.9, snow); b = lerp(b, 0.92, snow);
    // Wadi: heller, feiner Sand
    const wd = this.wadi[i];
    r = lerp(r, 0.82, wd * 0.7); g = lerp(g, 0.74, wd * 0.7); b = lerp(b, 0.58, wd * 0.7);
    // Grüne Zone: Felder im Schachbrett (Weizen, Mohn, Brache), Obstgärten
    const gz = this.green[i];
    if (gz > 0.02) {
      const fx = Math.floor((x + Math.sin(z * 0.004) * 40) / 46), fz = Math.floor(z / 34);
      const k = ((fx * 7 + fz * 13) % 5 + 5) % 5;
      const fc = [[0.44, 0.52, 0.22], [0.58, 0.58, 0.28], [0.52, 0.44, 0.3], [0.38, 0.47, 0.2], [0.62, 0.55, 0.36]][k];
      const f = this.forest[i];
      const cr = lerp(fc[0], 0.26, f * 0.7), cg = lerp(fc[1], 0.36, f * 0.7), cb = lerp(fc[2], 0.15, f * 0.7);
      r = lerp(r, cr + n * 0.03, gz); g = lerp(g, cg + n * 0.03, gz); b = lerp(b, cb, gz);
    }
    const mud = smoothstep(2.0, 0.3, h);
    r = lerp(r, 0.52, mud); g = lerp(g, 0.47, mud); b = lerp(b, 0.36, mud);
    for (const fl of this.flats) {
      const d = Math.hypot(x - fl.x, z - fl.z);
      if (d > fl.r + 40) continue;
      const t = 1 - smoothstep(fl.r * 0.85, fl.r + 30, d);
      if (fl.kind === 'fob') { r = lerp(r, 0.64 + n * 0.04, t); g = lerp(g, 0.58 + n * 0.03, t); b = lerp(b, 0.48, t); }
      else if (fl.kind === 'site') { r = lerp(r, 0.7 + n * 0.05, t); g = lerp(g, 0.6 + n * 0.05, t); b = lerp(b, 0.44, t); }
      else { r = lerp(r, 0.66, t * 0.85); g = lerp(g, 0.55, t * 0.85); b = lerp(b, 0.4, t * 0.85); }
    }
    return [r, g, b];
  }

  // ------------------------------------------------------------ FOB
  buildFOB() {
    const f = this.fob;
    const parts = [];
    const add = (list, lx, lz, rot = 0) => { M.placeParts(list, f.x + lx, f.y, f.z + lz, rot); parts.push(...list); };
    f.pads = {
      troop: { x: f.x + 0, z: f.z + 40, name: 'H1' },
      med: { x: f.x - 64, z: f.z - 22, name: 'MED' },
      pol: { x: f.x + 64, z: f.z - 22, name: 'POL' },
      h2: { x: f.x - 46, z: f.z + 100, name: 'H2' },
    };
    add(A.padAfg('troop'), 0, 40);
    add(A.padAfg('med'), -64, -22);
    add(A.padAfg('pol'), 64, -22);
    add(A.padAfg('troop'), -46, 100);
    add(A.padAfg('troop'), 46, 100);
    // Sanitätsstation (Role 1) aus Containern und Zelt
    add(M.hospitalParts().map((g) => g), -64, -66, Math.PI);
    f.hospitalDoor = { x: f.x - 64, z: f.z - 56 };
    add(A.containerParts(0xd8d4c8), -92, -60, 0);
    add(A.containerParts(0xd8d4c8), -100, -60, 0);
    // Betankung
    add(A.fuelTruckAfg(), 88, -18, 0.1);
    f.truck = { x: f.x + 88, z: f.z - 18 };
    add(M.bladderParts(), 108, -48, 0.2);
    add(M.bladderParts(), 118, -26, 0.1);
    // TOC aus Containern mit HESCO-Schutz
    for (let i = 0; i < 3; i++) add(A.containerParts(0x7a6a4c), -14 + i * 3, -16, 0);
    add(A.hescoWall(12), -11, -21);
    add(A.hescoWall(12), -11, -11);
    parts.push(...M.placeParts([M.P(new THREE.CylinderGeometry(0.05, 0.08, 14, 5), 0x333333, [0, 7, 0])], f.x - 4, f.y, f.z - 18));
    // Unterkünfte: Zeltreihen und Containerdorf
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(A.tentAfg(6, 10, 3.4), -160 + c * 14, 28 + r * 20, 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) add(A.containerParts([0x7a6a4c, 0x8a7a5a, 0x6d5f45][(r + c) % 3]), 100 + c * 3.2, 40 + r * 9, 0);
    add(A.tentAfg(10, 18, 5, 0xa8946c), -120, -125, 0.4);
    add(A.tentAfg(10, 18, 5, 0xa8946c), 125, -120, -0.4);
    // Mörserstellungen
    for (const [x, z, rt] of [[150, 110, -0.6], [-150, -10, 0.5]]) {
      add(M.howitzerParts(), x, z, rt);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; add(A.hescoWall(4, 1.4), x + Math.cos(a) * 5.5, z + Math.sin(a) * 5.5, -a + Math.PI / 2); }
    }
    // Fahrzeuge
    add(A.mrapParts(), -24, 8, 0.7);
    add(A.mrapParts(), 30, -2, -0.4);
    add(A.dingoParts(), 40, 4, -0.3);
    add(A.dingoParts(), -34, 14, 0.9);
    // Wachtürme und HESCO-Wall
    const R = 205;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      add(A.guardTowerAfg(), Math.cos(a) * (R - 6), Math.sin(a) * (R - 6), 0);
    }
    const segs = 104;
    for (let i = 0; i < segs; i++) {
      if (i % 26 === 0 || i % 26 === 1) continue; // Tore
      const a = (i / segs) * Math.PI * 2;
      add(A.hescoWall((2 * Math.PI * R) / segs + 0.4, 2.3), Math.cos(a) * R, Math.sin(a) * R, -a + Math.PI / 2);
    }
    this.fobMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
    this.fobMesh.castShadow = this.fobMesh.receiveShadow = true;
    this.scene.add(this.fobMesh);
    this.buildFlag(f.x + 12, f.z - 5, drawGermanFlag);
    this.buildFlag(f.x + 18, f.z - 5, drawISAFFlag);
    this.buildParked([[-46, 100, 0.3], [46, 100, -0.2]]);

    this.fobFigures = [];
    const spots = [[5, -8], [-25, -5], [-30, 2], [48, -40], [44, -47], [-55, -46], [-70, -46], [110, 75], [150, 50], [-5, 30], [20, 15]];
    for (const [x, z] of spots) {
      const fig = new M.Figure(T.friend());
      fig.group.position.set(f.x + x, f.y, f.z + z);
      fig.group.rotation.y = this.rng() * Math.PI * 2;
      this.scene.add(fig.group);
      this.fobFigures.push(fig);
    }
  }

  // ------------------------------------------------------------ Dörfer und Außenposten
  buildVillages() {
    const parts = [];
    const rng = this.rng;
    for (const v of this.villages) {
      const placed = [];
      const n = v.big ? 12 + Math.floor(rng() * 6) : 6 + Math.floor(rng() * 5);
      if (v.big) {
        parts.push(...M.placeParts(A.mosqueParts(rng), v.x, this.height(v.x, v.z) - 0.2, v.z, rng() * Math.PI));
        placed.push({ x: v.x, z: v.z, r: 10 });
        const a = rng() * Math.PI;
        const sx = v.x + Math.cos(a) * 22, sz = v.z + Math.sin(a) * 22;
        parts.push(...M.placeParts(A.shopRowParts(rng, 5), sx, this.height(sx, sz) - 0.2, sz, a));
        placed.push({ x: sx + 10, z: sz, r: 14 });
      }
      let tries = 0;
      while (placed.length < n && tries++ < 200) {
        const size = 18 + rng() * 16;
        const a = rng() * Math.PI * 2, d = 12 + rng() * (v.big ? 85 : 60);
        const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
        const r = size * 0.72;
        if (placed.some((p) => dist2(p.x, p.z, x, z) < p.r + r + 4)) continue;
        if (this.height(x, z) < 1) continue;
        placed.push({ x, z, r });
        parts.push(...M.placeParts(A.qalatParts(rng, size), x, this.height(x, z) - 0.25, z, Math.floor(rng() * 4) * (Math.PI / 2) + (rng() - 0.5) * 0.3));
      }
      v.compounds = placed;
    }
    // Kleine Außenposten (COP/PB) an manchen Landezonen
    for (const s of this.sites) {
      if (!s.post) continue;
      const y = s.y;
      // HESCO-Geviert (Ecken offen als Zugänge) mit Wachturm
      for (let k = 0; k < 4; k++) {
        const rot = (k * Math.PI) / 2 + 0.3;
        const lz = -42;
        const x = s.x + lz * Math.sin(rot), z = s.z + lz * Math.cos(rot);
        parts.push(...M.placeParts(A.hescoWall(68, 2.2), x, y, z, rot));
      }
      parts.push(...M.placeParts(A.guardTowerAfg(), s.x + 30 * Math.cos(0.3) + 30 * Math.sin(0.3), y, s.z - 30 * Math.sin(0.3) + 30 * Math.cos(0.3), 0.3));
    }
    if (parts.length) {
      this.villageMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
      this.villageMesh.castShadow = this.villageMesh.receiveShadow = true;
      this.scene.add(this.villageMesh);
    }
  }

  // ------------------------------------------------------------ Vegetation
  get treeDefs() {
    return [
      { geo: M.merge(A.poplarParts()), near: M.merge(A.poplarParts(true)), top: 15.0, r: 1.9, w: 0.5 },
      { geo: M.merge(A.fruitTreeParts()), near: M.merge(A.fruitTreeParts(true)), top: 6.4, r: 3.0, w: 0.5 },
      { geo: M.merge(A.shrubParts()), top: 1.0, r: 0.9, w: 0 },
    ];
  }

  pickTreeType(x, z, tr) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, N - 1), iz = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    if (this.green[iz * N + ix] < 0.15) return 2;
    return tr < 0.5 ? 0 : 1;
  }

  // Deckung für Feinde: Obstgärten, Lehmmauern der Dörfer, Felsen
  coverAt(x, z) {
    const f = this.inForest(x, z);
    let c = f > 0.4 ? 0.4 : 0.1;
    for (const v of this.villages) if (dist2(v.x, v.z, x, z) < 120) { c = Math.max(c, 0.45); break; }
    if (this.mountainMask(x, z) > 0.3) c = Math.max(c, 0.3);
    return c;
  }

  // Sand und Staub (für Brownout): Wüste ja, Felder/Fluss/FOB-Pads kaum
  dustAt(x, z) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, N - 1), iz = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    if (this.h[iz * N + ix] < 0.5) return 0;
    return 1 - this.green[iz * N + ix];
  }

  ambushSpot(x, z) {
    if (this.inForest(x, z) > 0.3) return true;
    if (this.villages.some((v) => dist2(v.x, v.z, x, z) < 160)) return true;
    const m = this.mountainMask(x, z);
    return m > 0.15 && m < 0.6 && this.height(x, z) < 300;
  }
}

function drawGermanFlag(x) {
  x.fillStyle = '#000'; x.fillRect(0, 0, 190, 34);
  x.fillStyle = '#dd0000'; x.fillRect(0, 33, 190, 34);
  x.fillStyle = '#ffce00'; x.fillRect(0, 66, 190, 34);
}
function drawISAFFlag(x) {
  x.fillStyle = '#1d3f7a'; x.fillRect(0, 0, 190, 100);
  x.fillStyle = '#fff';
  x.beginPath(); x.arc(95, 46, 26, 0, 7); x.fill();
  x.fillStyle = '#1d3f7a'; x.beginPath(); x.arc(95, 46, 21, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.font = 'bold 18px Arial'; x.textAlign = 'center'; x.fillText('ISAF', 95, 92);
}
