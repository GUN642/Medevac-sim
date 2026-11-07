// Mali (Gao): Sahelzone mit roter Erde, Dornbusch, Tafelbergen und dem breiten Niger mit Inseln; Sandstürme
import * as THREE from './lib/three.module.min.js';
import { HALF, CELL } from './config.js';
import { AfghanWorld } from './worldAfg.js';
import { smoothstep, lerp, dist2, clamp } from './util.js';
import * as M from './models.js';
import * as A from './afgModels.js';

const SITE_NAMES = [
  'PB Ansongo', 'PB Bourem', 'HLZ Tilemsi', 'HLZ Kidal-Piste', 'PB Gourma', 'HLZ Djebock', 'PB Bara', 'HLZ Tacharane',
  'HLZ Wabaria', 'PB Forgho', 'HLZ Kadji', 'PB Haoussa', 'HLZ Bagoundié', 'PB Gabero', 'HLZ Tondibi', 'PB Bentia',
  'HLZ Labbezanga', 'PB Fafa', 'HLZ Koïma', 'PB Bourra', 'HLZ Ersane', 'PB Tassiga', 'HLZ Ouatagouna', 'HLZ Tin-Hama',
];
const VILLAGE_NAMES = ['Kadji', 'Gabero', 'Bagoundié', 'Haoussa Foulane', 'Tondibi', 'Bara', 'Bentia', 'Koïma', 'Forgho', 'Wabaria'];

// Tafelberg-Maske (0 = Ebene, 1 = Plateau)
function mesaAt(n, x, z) {
  const v = n.fbm(x * 0.00055 + 21, z * 0.00055 - 13, 3);
  return { m: smoothstep(0.3, 0.355, v), m2: smoothstep(0.52, 0.57, v) };
}

export class MaliWorld extends AfghanWorld {
  get outerColor() { return 0xa8653e; }
  get waterColor() { return 0x5b6a5c; }
  get villageClear() { return 80; }
  get outerHeight() { return 22; }
  get siteNames() { return SITE_NAMES; }
  get villageNames() { return VILLAGE_NAMES; }
  get desertBush() { return 0.075; }
  get secondFlag() {
    return (x) => {
      x.fillStyle = '#5b92e5'; x.fillRect(0, 0, 190, 100);
      x.strokeStyle = '#fff'; x.lineWidth = 4;
      x.beginPath(); x.arc(95, 50, 26, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(69, 50); x.lineTo(121, 50); x.moveTo(95, 24); x.lineTo(95, 76); x.stroke();
    };
  }

  // ------------------------------------------------------------ Höhen
  // Der Niger fließt breit von Nord nach Süd östlich am Camp vorbei
  riverX(z) { return 1150 + 520 * Math.sin(z * 0.0007 + 0.4) + 200 * this.n.noise(2.3, z * 0.0005); }
  riverDist(x, z) {
    const rx = this.riverX(z);
    const sl = (this.riverX(z + 5) - this.riverX(z - 5)) / 10;
    const d = Math.abs(x - rx) / Math.sqrt(1 + sl * sl);
    const w = 150 + 55 * this.n.noise(z * 0.0012, 3.3);
    return { d, w };
  }

  mountainMask(x, z) {
    const { d } = this.riverDist(x, z);
    return mesaAt(this.n, x, z).m * smoothstep(380, 700, d);
  }

  rawHeight(x, z, out) {
    const n = this.n;
    const { d, w } = this.riverDist(x, z);
    const gzW = 210 + 90 * n.noise(z * 0.0012, 9.1);
    const green = 1 - smoothstep(gzW - 50, gzW + 50, d);
    const base = 22 + n.fbm(x * 0.0012 + 3, z * 0.0012 - 5, 3) * 5 + Math.abs(n.noise(x * 0.004, z * 0.004)) * 1.5;
    // Tafelberge mit steilen Abbruchkanten, teils zweistufig
    const ms = mesaAt(n, x, z);
    const far = smoothstep(380, 700, d);
    const mesa = ms.m * far, mesa2 = ms.m2 * far;
    const top = 70 + 22 * n.noise(x * 0.0008 + 5, z * 0.0008);
    let h = base + mesa * top + mesa2 * 32;
    // Flussniederung
    h = lerp(4 + n.noise(x * 0.003, z * 0.003) * 1.0, h, smoothstep(gzW - 40, gzW + 180, d));
    // Wadis
    const wadiN = Math.abs(n.fbm(x * 0.0007 + 51, z * 0.0007 - 23, 3));
    const wadi = (1 - smoothstep(0.015, 0.05, wadiN)) * smoothstep(gzW + 80, gzW + 300, d) * (1 - mesa);
    h -= wadi * 5;
    // Niger mit Sand- und Grasinseln
    const v = smoothstep(w, w + 60, d);
    const isl = n.noise(x * 0.004 + 7, z * 0.0025) > 0.36 && d < w * 0.85 ? 1 : 0;
    h = lerp(isl ? 1.3 : -3.4, h, Math.pow(v, 0.7));
    const field = green > 0.5 && h > 1.2 && d > w + 25;
    if (field) h = Math.floor(h / 0.6) * 0.6 + 0.3;
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, lerp(Math.min(h, 3.5), 22, smoothstep(gzW - 40, gzW + 160, d)), e);
    if (out) { out.paddy = field ? 1 : 0; out.mountain = mesa; out.river = d - w; out.green = Math.max(green, isl && d < w ? 1 : 0); out.wadi = wadi; }
    return h;
  }

  // Tafelberg-LZs an der Abbruchkante, Hang-LZs an den Flanken, Wadis
  addSpecialSites() {
    const rng = this.rng, F = this.fob;
    const names = ['Tafelberg Hombori', 'Tafelberg Tin-Tarhat', 'Plateau Djebock', 'Plateau Gourma'];
    for (let i = 0; i < 16000 && names.length; i++) {
      const x = rng.range(-HALF + 500, HALF - 500), z = rng.range(-HALF + 500, HALF - 500);
      const df = dist2(x, z, F.x, F.z);
      if (df < 2600 || df > 6000 || this.sites.some((s) => dist2(s.x, s.z, x, z) < 600)) continue;
      if (this.mountainMask(x, z) < 0.97) continue;
      const h = this.rawHeight(x, z);
      let flat = true, cliff = false;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (Math.abs(this.rawHeight(x + Math.cos(a) * 25, z + Math.sin(a) * 25) - h) > 3) flat = false;
        if (this.rawHeight(x + Math.cos(a) * 90, z + Math.sin(a) * 90) < h - 35) cliff = true;
      }
      if (!flat || !cliff) continue;
      this.sites.push({ name: names.shift(), x, z, y: h, r: 18, hard: 'mesa' });
      this.flatten(x, z, 18, 12, h, 'site');
    }
    this.addRidgeSites(['HLZ Geröllhang', 'HLZ Felsband', 'HLZ Plateauflanke'], ['HLZ Wadi Tilemsi', 'HLZ Wadi Ersane'], 40);
  }

  // ------------------------------------------------------------ Farben
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    // rote Laterit-Erde mit helleren Sandflächen
    let r = 0.72 + n * 0.05, g = 0.43 + n * 0.04, b = 0.27 + n * 0.03;
    const sand = smoothstep(0.15, 0.45, this.n.noise(x * 0.0021 + 9, z * 0.0021));
    r = lerp(r, 0.82, sand * 0.6); g = lerp(g, 0.64, sand * 0.6); b = lerp(b, 0.44, sand * 0.6);
    // Tafelberge: dunkler Sandstein, steile Wände rötlich-braun
    const mt = smoothstep(40, 80, h);
    r = lerp(r, 0.6 + n * 0.04, mt); g = lerp(g, 0.38 + n * 0.03, mt); b = lerp(b, 0.26, mt);
    const steep = smoothstep(0.85, 0.55, nY);
    r = lerp(r, 0.46, steep); g = lerp(g, 0.27, steep); b = lerp(b, 0.19, steep);
    const wd = this.wadi[i];
    r = lerp(r, 0.86, wd * 0.6); g = lerp(g, 0.72, wd * 0.6); b = lerp(b, 0.52, wd * 0.6);
    // Grüne Zone und Inseln: Hirse-, Reisfelder, Bourgou-Gras
    const gz = this.green[i];
    if (gz > 0.02) {
      const fx = Math.floor((x + Math.sin(z * 0.004) * 40) / 40), fz = Math.floor(z / 30);
      const k = ((fx * 7 + fz * 13) % 4 + 4) % 4;
      const fc = [[0.42, 0.52, 0.22], [0.62, 0.58, 0.3], [0.5, 0.56, 0.26], [0.66, 0.5, 0.32]][k];
      r = lerp(r, fc[0] + n * 0.03, gz); g = lerp(g, fc[1] + n * 0.03, gz); b = lerp(b, fc[2], gz);
    }
    const mud = smoothstep(2.0, 0.3, h);
    r = lerp(r, 0.5, mud); g = lerp(g, 0.42, mud); b = lerp(b, 0.32, mud);
    for (const fl of this.flats) {
      const d = Math.hypot(x - fl.x, z - fl.z);
      if (d > fl.r + 40) continue;
      const t = 1 - smoothstep(fl.r * 0.85, fl.r + 30, d);
      if (fl.kind === 'fob') { r = lerp(r, 0.7 + n * 0.04, t); g = lerp(g, 0.5 + n * 0.03, t); b = lerp(b, 0.36, t); }
      else { r = lerp(r, 0.76 + n * 0.05, t); g = lerp(g, 0.55 + n * 0.05, t); b = lerp(b, 0.38, t); }
    }
    return [r, g, b];
  }

  // ------------------------------------------------------------ Vegetation: Akazien, Dumpalmen, Dornbusch
  get treeDefs() {
    const acacia = (detail) => {
      const p = [M.P(new THREE.CylinderGeometry(0.16, 0.26, 4.2, detail ? 7 : 5), 0x5a4632, [0, 2.1, 0], [0, 0, 0.12])];
      p.push(M.P(new THREE.CylinderGeometry(0.08, 0.14, 2.4, 5), 0x5a4632, [0.7, 4.2, 0.2], [0.3, 0, -0.6]));
      p.push(M.P(new THREE.SphereGeometry(1, detail ? 12 : 8, detail ? 6 : 4), 0x4f5e2a, [0.3, 5.0, 0], [0, 0, 0], [3.6, 0.75, 3.2]));
      if (detail) p.push(M.P(new THREE.SphereGeometry(1, 10, 5), 0x5a6a30, [1.6, 5.3, 0.6], [0, 0, 0], [2.0, 0.5, 1.8]));
      return p;
    };
    return [
      { geo: M.merge(acacia(false)), near: M.merge(acacia(true)), top: 5.8, r: 3.6, w: 0.4 },
      { geo: M.merge(M.palmParts()), top: 9.5, r: 3.0, w: 0.25 },
      { geo: M.merge(A.shrubParts()), top: 1.0, r: 0.9, w: 0 },
    ];
  }

  pickTreeType(x, z, tr) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, N - 1), iz = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    if (this.green[iz * N + ix] < 0.15) return tr < 0.3 ? 0 : 2;
    return tr < 0.55 ? 0 : 1;
  }

  // ------------------------------------------------------------ Sandsturm
  // Feste Abfolge nach Spielzeit (gleich für alle Mitspieler): etwa alle 10 Minuten zieht ein Sturm für 2–3 Minuten durch
  weather(t) {
    const P = 600, ph = ((t % P) + P) % P;
    return smoothstep(240, 275, ph) * (1 - smoothstep(400, 440, ph));
  }
}
