// Ukraine (Donbas): weite Felder mit Waldstreifen, Schluchten (Balkas), ein breiter Fluss mit Nebenfluss,
// zerstörte Dörfer und eine Kleinstadt mit Plattenbauten, Granattrichter, ausgebrannte Panzer
import * as THREE from './lib/three.module.min.js';
import { HALF, CELL, FOB_POS } from './config.js';
import { AfghanWorld } from './worldAfg.js';
import { T } from './theme.js';
import { smoothstep, lerp, dist2, clamp, makeRng } from './util.js';
import * as M from './models.js';
import * as U from './ukraineModels.js';

const SITE_NAMES = [
  'HLZ Sosniwka', 'HLZ Bereza', 'Stellung Kalyna', 'HLZ Zoloti Polja', 'Stellung Wyschnja', 'HLZ Stepowe', 'HLZ Dubowe', 'Stellung Topolja',
  'HLZ Krynytschne', 'HLZ Ozerne', 'Stellung Lisowe', 'HLZ Sonjatschne', 'HLZ Pischtschane', 'Stellung Jasen', 'HLZ Myrne', 'HLZ Wynohradne',
  'Stellung Hruschka', 'HLZ Werbiwka', 'HLZ Kamjanka', 'Stellung Bilyj Jar', 'HLZ Lypowe', 'HLZ Schyroke', 'Stellung Wodjane', 'HLZ Nowe Pole',
];
const VILLAGE_NAMES = ['Nowa Poltawka', 'Berezivka', 'Sosniwka', 'Kamjanka', 'Zelenyj Hai', 'Dibrowa', 'Malynivka', 'Ozerne', 'Wyschnewe', 'Hrusckiwka'];
const FA = 0.32, FCA = Math.cos(FA), FSA = Math.sin(FA), FU = 420, FV = 300;   // Feldraster (gedreht)

export class UkraineWorld extends AfghanWorld {
  get rockColor() { return 0x6c6658; }
  get outerColor() { return 0x6e6a40; }
  get waterColor() { return 0x4c5c50; }
  get villageClear() { return 55; }
  get outerHeight() { return 17.9; }
  get siteNames() { return SITE_NAMES; }
  get villageNames() { return VILLAGE_NAMES; }
  get fobFlags() { return [U.drawUkraineFlag]; }
  get desertBush() { return 0; }
  addSpecialSites() {}

  // ------------------------------------------------------------ Höhen
  riverX(z) { return 1050 + 480 * Math.sin(z * 0.0008 + 0.9) + 220 * this.n.noise(2.3, z * 0.0005); }
  tribZ(x) { return -900 + 300 * Math.sin(x * 0.0012 + 0.7) + 140 * this.n.noise(x * 0.0007, 5.5); }

  riverDist(x, z) {
    const rx = this.riverX(z);
    const sl = (this.riverX(z + 5) - this.riverX(z - 5)) / 10;
    let d = Math.abs(x - rx) / Math.sqrt(1 + sl * sl);
    let w = 70 + 22 * this.n.noise(z * 0.0012, 3.3);
    // Nebenfluss von Westen, mündet in den Hauptfluss
    if (x < rx - 30) {
      const tz = this.tribZ(x), ts = (this.tribZ(x + 5) - this.tribZ(x - 5)) / 10;
      const d2 = Math.abs(z - tz) / Math.sqrt(1 + ts * ts), w2 = 26 + 8 * this.n.noise(x * 0.002, 8.1);
      if (d2 - w2 < d - w) { d = d2; w = w2; }
    }
    return { d, w };
  }
  mountainMask() { return 0; }

  // Feldraster: Abstand zum nächsten Feldrand (für Waldstreifen) und Feldnummer
  field(x, z) {
    const u = x * FCA + z * FSA + 5000, v = -x * FSA + z * FCA + 5000;
    const fu = Math.floor(u / FU), fv = Math.floor(v / FV);
    const lu = u - fu * FU, lv = v - fv * FV;
    return { id: fu * 131 + fv * 71, edge: Math.min(lu, FU - lu, lv, FV - lv) };
  }

  // Zerstörungsgrad: nahe der Basis gering, Richtung Front (weit weg) stark
  destruction(x, z) {
    const f = this.fob || FOB_POS;
    return clamp(0.25 + 0.75 * smoothstep(1400, 4800, dist2(x, z, f.x, f.z)) * (0.65 + 0.5 * this.n.noise(x * 0.0006 + 7, z * 0.0006)), 0, 1);
  }

  rawHeight(x, z, out) {
    const n = this.n;
    const { d, w } = this.riverDist(x, z);
    // flach gewellte Steppe
    let h = 20 + n.fbm(x * 0.0007 + 3, z * 0.0007 - 5, 4) * 16 + n.noise(x * 0.003, z * 0.003) * 2;
    // Balkas: verzweigte, bewaldete Schluchten
    const rv = 1 - Math.abs(n.fbm(x * 0.0011 + 41, z * 0.0011 - 17, 3));
    const ravine = smoothstep(0.93, 0.985, rv) * smoothstep(250, 500, d);
    h -= ravine * 13;
    // breite Flussaue
    const fpW = 260 + 90 * n.noise(z * 0.001, 6.6);
    const flood = 1 - smoothstep(fpW * 0.6, fpW, d);
    h = lerp(h, 2.6 + n.noise(x * 0.004, z * 0.004) * 0.8, flood);
    // Flussbett
    const v = smoothstep(w, w + 40, d);
    h = lerp(-3.2, h, Math.pow(v, 0.7));
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, 18, e * smoothstep(w + 60, w + 400, d));
    if (out) { out.paddy = 0; out.mountain = 0; out.river = d - w; out.green = flood; out.wadi = ravine; }
    return h;
  }

  generateHeights() {
    const N = this.N, o = {};
    this.green = new Float32Array(N * N);
    this.wadi = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
      const i = iz * N + ix;
      this.h[i] = this.rawHeight(x, z, o);
      this.paddy[i] = 0;
      this.green[i] = o.green;
      this.wadi[i] = o.wadi;
      // Waldstreifen an den Feldrändern, Wäldchen, bewaldete Balkas, Weiden in der Aue
      const fl = this.field(x, z);
      const belt = fl.edge < 13 && this.n.noise(x * 0.004 + 9, z * 0.004) > -0.45 ? 0.85 : 0;
      const patch = smoothstep(0.38, 0.5, this.n.noise(x * 0.0016 + 40, z * 0.0016)) * 0.8;
      const rav = o.wadi > 0.35 ? 0.75 : 0;
      const wil = o.green > 0.5 && o.river > 15 && this.n.noise(x * 0.006, z * 0.006 + 3) > 0.2 ? 0.55 : 0;
      this.forest[i] = o.river > 12 && this.h[i] > 1.0 ? Math.max(belt, patch, rav, wil) : 0;
    }
    const fobH = Math.max(6, this.rawHeight(FOB_POS.x, FOB_POS.z));
    this.fob = { name: T.fobName, x: FOB_POS.x, z: FOB_POS.z, y: fobH, r: 230 };
    this.flatten(FOB_POS.x, FOB_POS.z, 240, 160, fobH, 'fob');

    const rng = this.rng;
    const names = this.siteNames.slice();
    let tries = 0;
    while (this.sites.length < 22 && tries++ < 8000) {
      const x = rng.range(-HALF + 380, HALF - 380), z = rng.range(-HALF + 380, HALF - 380);
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < 3050 || df > 5800) continue;
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 1.8 || o2.river < 90 || o2.wadi > 0.2) continue;
      let maxd = 0;
      for (const [dx, dz] of [[50, 0], [-50, 0], [0, 50], [0, -50]]) maxd = Math.max(maxd, Math.abs(this.rawHeight(x + dx, z + dz) - h));
      if (maxd > 12) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 520)) continue;
      const name = names.splice(Math.floor(rng() * names.length), 1)[0];
      this.sites.push({ name, x, z, y: h, r: 40, post: /^Stellung/.test(name) });
      this.flatten(x, z, 40, 70, h, 'site');
    }
    // Dörfer, das erste ist eine Kleinstadt mit Plattenbauten
    const vnames = this.villageNames.slice();
    tries = 0;
    while (this.villages.length < 9 && tries++ < 6000) {
      const x = rng.range(-HALF + 450, HALF - 450), z = rng.range(-HALF + 450, HALF - 450);
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 2 || o2.river < 140 || o2.wadi > 0.1) continue;
      const town = this.villages.length === 0;
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < (town ? 2200 : 800) || (town && df > 4600)) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 360)) continue;
      if (this.villages.some((s) => dist2(s.x, s.z, x, z) < 900)) continue;
      this.villages.push({ name: town ? 'Krasnohirka' : vnames.shift(), x, z, y: h, big: town || this.villages.length < 4, town });
      this.flatten(x, z, town ? 150 : 80, 80, h, 'village');
    }
  }

  // ------------------------------------------------------------ Farben
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    // Felder: Weizen, Stoppeln, Schwarzerde (gepflügt), Sonnenblumen, Wiese, Brache
    const fl = this.field(x, z);
    const k = ((fl.id % 7) + 7) % 7;
    const FC = [[0.72, 0.64, 0.38], [0.64, 0.58, 0.42], [0.27, 0.23, 0.19], [0.44, 0.48, 0.22], [0.42, 0.52, 0.27], [0.52, 0.52, 0.34], [0.33, 0.28, 0.22]];
    let [r, g, b] = FC[k];
    r += n * 0.04; g += n * 0.04; b += n * 0.02;
    // Feldrain / Weg
    if (fl.edge < 20) { const t = 1 - smoothstep(8, 20, fl.edge); r = lerp(r, 0.4, t); g = lerp(g, 0.46, t); b = lerp(b, 0.26, t); }
    // abgebrannte Felder in Frontnähe
    const burn = smoothstep(0.35, 0.55, this.n.noise(x * 0.0025 + 31, z * 0.0025)) * this.destruction(x, z);
    r = lerp(r, 0.16, burn * 0.8); g = lerp(g, 0.15, burn * 0.8); b = lerp(b, 0.13, burn * 0.8);
    // Aue: Wiesen und Schilf, Balkas grasig
    const gz = this.green[i];
    r = lerp(r, 0.4 + n * 0.03, gz); g = lerp(g, 0.5 + n * 0.04, gz); b = lerp(b, 0.26, gz);
    const wd = this.wadi[i];
    r = lerp(r, 0.36, wd * 0.8); g = lerp(g, 0.44, wd * 0.8); b = lerp(b, 0.24, wd * 0.8);
    const f = this.forest[i];
    r = lerp(r, 0.24, f * 0.6); g = lerp(g, 0.32, f * 0.6); b = lerp(b, 0.16, f * 0.6);
    const steep = smoothstep(0.85, 0.6, nY);
    r = lerp(r, 0.42, steep); g = lerp(g, 0.38, steep); b = lerp(b, 0.3, steep);
    const mud = smoothstep(2.0, 0.3, h);
    r = lerp(r, 0.4, mud); g = lerp(g, 0.37, mud); b = lerp(b, 0.3, mud);
    for (const fl2 of this.flats) {
      const d = Math.hypot(x - fl2.x, z - fl2.z);
      if (d > fl2.r + 40) continue;
      const t = 1 - smoothstep(fl2.r * 0.85, fl2.r + 30, d);
      if (fl2.kind === 'fob') { r = lerp(r, 0.46 + n * 0.04, t); g = lerp(g, 0.44 + n * 0.03, t); b = lerp(b, 0.36, t); }
      else if (fl2.kind === 'site') { r = lerp(r, 0.42 + n * 0.05, t); g = lerp(g, 0.4 + n * 0.05, t); b = lerp(b, 0.3, t); }
      else { r = lerp(r, 0.46, t * 0.7); g = lerp(g, 0.46, t * 0.7); b = lerp(b, 0.34, t * 0.7); }
    }
    return [r, g, b];
  }

  // ------------------------------------------------------------ Dörfer, Stadt, Wracks, Trichter
  buildVillages() {
    const parts = [];
    const rng = makeRng(4242);
    this.houses = [];
    for (const v of this.villages) {
      const dmg = this.destruction(v.x, v.z);
      if (v.town) {
        // Plattenbauten im Raster um einen Platz, dazwischen Häuser
        const rot = rng() * Math.PI;
        const ca = Math.cos(rot), sa = Math.sin(rot);
        for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          if (rng() < 0.15) continue;
          const lx = i * 48 + (rng() - 0.5) * 6, lz = j * 70 + (rng() - 0.5) * 6;
          const x = v.x + lx * ca - lz * sa, z = v.z + lx * sa + lz * ca;
          const b = U.apartmentBlock(rng, clamp(dmg + (rng() - 0.3) * 0.4, 0.15, 1));
          const g = this.height(x, z);
          parts.push(...M.placeParts(b.parts, x, g - 0.2, z, rot));
          this.houses.push({ x, z, ground: g, ridge: g + b.h, eave: g + b.h, r: b.d * 0.5, rot, village: v.name, block: true });
        }
      }
      // Dorfstraße mit Häusern beiderseits
      const n = v.town ? 14 : v.big ? 18 : 10;
      const a = rng() * Math.PI;
      const ux = Math.cos(a), uz = Math.sin(a);
      for (let k = 0; k < n; k++) {
        const along = (k / 2 - n / 4) * 26 + (rng() - 0.5) * 6 + (v.town ? 140 : 0);
        const side = k % 2 ? 1 : -1;
        const x = v.x + ux * along - uz * side * (14 + rng() * 6), z = v.z + uz * along + ux * side * (14 + rng() * 6);
        if (this.height(x, z) < 1 || this.houses.some((h) => dist2(h.x, h.z, x, z) < h.r + 8)) continue;
        const hs = U.uaHouse(rng, clamp(dmg * (0.4 + rng() * 1.0), 0, 1));
        const g = this.height(x, z);
        parts.push(...M.placeParts(hs.parts, x, g - 0.15, z, a + (side > 0 ? 0 : Math.PI)));
        this.houses.push({ x, z, ground: g, ridge: g + 6, eave: g + 3.2, r: Math.max(hs.w, hs.d) * 0.55, rot: a, village: v.name });
      }
      v.compounds = this.houses.filter((h) => h.village === v.name);
      // ausgebrannte Fahrzeuge und Panzersperren am Ortsrand
      for (let k = 0; k < 2 + Math.floor(dmg * 3); k++) {
        const aa = rng() * Math.PI * 2, d = 90 + rng() * 120;
        const x = v.x + Math.cos(aa) * d, z = v.z + Math.sin(aa) * d;
        if (this.height(x, z) < 1) continue;
        parts.push(...M.placeParts(U.tankWreck(rng, rng() < 0.6 ? 'tank' : 'bmp'), x, this.height(x, z), z, rng() * 6.28));
      }
      for (let k = 0; k < 6; k++) {
        const x = v.x + ux * (n * 7 + 30) + (rng() - 0.5) * 20, z = v.z + uz * (n * 7 + 30) + (rng() - 0.5) * 20;
        parts.push(...M.placeParts(U.hedgehogParts(), x, this.height(x, z), z, rng() * 3));
      }
    }
    // Panzerwracks verstreut auf den Feldern, Stellungen an manchen LZs (Sandsäcke)
    for (let k = 0; k < 16; k++) {
      const x = rng.range(-HALF + 300, HALF - 300), z = rng.range(-HALF + 300, HALF - 300);
      if (this.height(x, z) < 2 || dist2(x, z, this.fob.x, this.fob.z) < 900 || this.nearFlat(x, z, 20)) continue;
      parts.push(...M.placeParts(U.tankWreck(rng, rng() < 0.5 ? 'tank' : 'bmp'), x, this.height(x, z), z, rng() * 6.28));
    }
    for (const s of this.sites) {
      if (!s.post) continue;
      for (let k = 0; k < 5; k++) {
        const aa = (k / 5) * Math.PI * 2 + 0.3;
        parts.push(...M.placeParts(M.sandbagWall(6, 1.3), s.x + Math.cos(aa) * 30, s.y, s.z + Math.sin(aa) * 30, -aa + Math.PI / 2));
      }
    }
    if (parts.length) {
      this.villageMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
      this.villageMesh.castShadow = this.villageMesh.receiveShadow = true;
      this.scene.add(this.villageMesh);
    }
    this.buildCraters(rng);
  }

  // Granattrichter als flache Scheiben auf dem Gelände (dichter Richtung Front)
  buildCraters(rng) {
    const count = { low: 900, medium: 1600, high: 2400 }[this.quality] || 1600;
    const geo = M.merge(U.craterGeo());
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), nr = new THREE.Vector3(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let k = 0; k < count * 4 && n < count; k++) {
      const x = rng.range(-HALF + 200, HALF - 200), z = rng.range(-HALF + 200, HALF - 200);
      const h = this.height(x, z);
      if (h < 1 || rng() > this.destruction(x, z) * this.destruction(x, z) || this.nearFlat(x, z, 4)) continue;
      // Trichter liegen oft in Gruppen (Artilleriesalven)
      const cl = rng() < 0.5 ? 1 : 4;
      for (let c = 0; c < cl && n < count; c++) {
        const cx = x + (c ? (rng() - 0.5) * 40 : 0), cz = z + (c ? (rng() - 0.5) * 40 : 0);
        const ch = this.height(cx, cz);
        if (ch < 1) continue;
        this.normal(cx, cz, nr);
        q.setFromUnitVectors(up, nr);
        const r = 1.8 + rng() * 3.2;
        m.compose(p.set(cx, ch + 0.04, cz), q, s.set(r, 1, r));
        im.setMatrixAt(n++, m);
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    this.scene.add(im);
    this.craters = im;
  }

  // Rotor oder Rumpf in einem Gebäude (Plattenbauten sind hoch!)
  houseHit(x, z, r, yBottom) {
    for (const h of this.houses || []) {
      if (Math.abs(h.x - x) > h.r + r || Math.abs(h.z - z) > h.r + r) continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < h.r * 0.75 + r && yBottom < (d < h.r * 0.6 ? h.ridge : h.eave) - 0.3) return h;
    }
    return null;
  }

  // ------------------------------------------------------------ Vegetation
  get treeDefs() {
    return [
      { geo: M.merge(U.beltTreeParts()), near: M.merge(U.beltTreeParts(true)), top: 15, r: 3.4, w: 0.55 },
      { geo: M.merge(U.birchParts()), near: M.merge(U.birchParts(true)), top: 14, r: 2.6, w: 0.35 },
      { geo: M.merge(U.beltTreeParts()), top: 15, r: 3.4, w: 0.1 },
    ];
  }

  pickTreeType(x, z, tr) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, N - 1), iz = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    if (this.wadi[iz * N + ix] > 0.3 || this.green[iz * N + ix] > 0.4) return tr < 0.55 ? 1 : 0;
    return tr < 0.75 ? 0 : 1;
  }

  coverAt(x, z) {
    let c = this.inForest(x, z) > 0.4 ? 0.45 : 0.1;
    for (const v of this.villages) if (dist2(v.x, v.z, x, z) < (v.town ? 220 : 140)) { c = Math.max(c, 0.5); break; }
    return c;
  }
  dustAt() { return 0; }
  ambushSpot(x, z) {
    if (this.inForest(x, z) > 0.3) return true;
    return this.villages.some((v) => dist2(v.x, v.z, x, z) < (v.town ? 260 : 160));
  }
}
