// Hochwasser: Mittelgebirgstal mit überfluteter Talaue, Dörfern, Brücken, Hochspannungsleitungen und Dauerregen
import * as THREE from './lib/three.module.min.js';
import { HALF, CELL, FOB_POS } from './config.js';
import { World } from './world.js';
import { T } from './theme.js';
import { smoothstep, lerp, dist2, clamp } from './util.js';
import * as M from './models.js';
import * as A from './afgModels.js';
import * as F from './floodModels.js';

const SITE_NAMES = [
  'Sportplatz Hohenfeld', 'Hofgut Lindenhof', 'Wanderparkplatz Eichkopf', 'Schulhof Talheim', 'Friedhof Steinbach', 'Aussiedlerhof Bergmann',
  'Grillhütte Erlenbach', 'Waldparkplatz Dornau', 'Segelfluggelände Hochfeld', 'Feuerwehrhaus Kirchheim', 'Wiese am Kreuzberg', 'Reiterhof Sonnenhang',
  'Bolzplatz Rosenau', 'Kreisstraße K 12', 'Sendemast Kalmus', 'Gewerbegebiet Am Berg', 'Pferdekoppel Mühlbach', 'Golfplatz Lindental',
  'Parkplatz Klosterruine', 'Obstwiese Hohenfurt', 'Festwiese Altenbrück', 'Steinbruch Dornau',
];
const VILLAGE_NAMES = ['Altenbrück', 'Lindenau', 'Mühlbach', 'Rosenau', 'Kirchheim', 'Steinbach', 'Hohenfurt', 'Talheim', 'Erlenbach', 'Dornau'];
const WATER_FLOOR = -2.4;

export class FloodWorld extends World {
  get outerColor() { return 0x2e4424; }
  get waterColor() { return 0x6e5d3e; }
  get villageClear() { return 0; }
  get outerHeight() { return 150; }

  // ------------------------------------------------------------ Höhen
  // Hauptfluss von Norden nach Süden, ein Seitental mündet von Osten ein
  riverX(z) { return -1400 + 600 * Math.sin(z * 0.0008 + 0.5) + 220 * this.n.noise(2.7, z * 0.0006); }
  tribZ(x) { return -1000 + 260 * Math.sin(x * 0.0012 + 0.3) + 120 * this.n.noise(x * 0.0009, 5.5); }

  riverDist(x, z) {
    const rx = this.riverX(z);
    const sl = (this.riverX(z + 5) - this.riverX(z - 5)) / 10;
    let d = Math.abs(x - rx) / Math.sqrt(1 + sl * sl);
    let w = 210 + 70 * this.n.noise(z * 0.0013, 1.9);
    let main = true;
    if (x > rx) {
      const tz = this.tribZ(x);
      const ts = (this.tribZ(x + 5) - this.tribZ(x - 5)) / 10;
      const td = Math.abs(z - tz) / Math.sqrt(1 + ts * ts);
      const tw = 115 + 30 * this.n.noise(x * 0.002, 6.6);
      if (td - tw < d - w) { d = td; w = tw; main = false; }
    }
    return { d, w, main };
  }

  rawHeight(x, z, out) {
    const n = this.n;
    const { d, w } = this.riverDist(x, z);
    // Mittelgebirge: wellige Hochfläche mit Kuppen und Rücken
    const hills = n.fbm(x * 0.0009 + 3, z * 0.0009 - 2, 4);
    let ridge = 1 - Math.abs(n.fbm(x * 0.0007 + 17, z * 0.0007 + 5, 3));
    ridge *= ridge;
    const up = 150 + hills * 55 + ridge * 95;
    // Talprofil: flache Aue (unter Wasser), steile bewaldete Hänge
    const t = smoothstep(w, w + 380, d);
    let h = lerp(WATER_FLOOR, up, Math.pow(t, 0.75));
    // schmale Uferterrasse knapp über dem Wasser
    const terr = smoothstep(w - 10, w + 25, d) * (1 - smoothstep(w + 25, w + 70, d));
    h = Math.max(h, lerp(WATER_FLOOR, 1.6, terr));
    // Flussbett
    if (d < 22) h = lerp(-6.5, h, smoothstep(6, 22, d));
    // Kartenrand: Talprofil mit flacherer Hochfläche
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, lerp(WATER_FLOOR, 150, Math.pow(t, 0.75)), e);
    if (out) { out.paddy = 0; out.mountain = smoothstep(140, 260, up) * t; out.river = d - w; out.slope = t; out.up = up; }
    return h;
  }

  generateHeights() {
    const N = this.N, o = {};
    this.slope = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const i = iz * N + ix;
        this.h[i] = this.rawHeight(x, z, o);
        this.paddy[i] = 0;
        this.slope[i] = o.slope;
        // Hangwald dicht, auf der Hochfläche Waldstücke zwischen Feldern
        const hang = smoothstep(0.08, 0.25, o.slope) * (1 - smoothstep(0.75, 0.95, o.slope));
        const patch = smoothstep(0.05, 0.35, this.n.noise(x * 0.0018 + 40, z * 0.0018));
        this.forest[i] = Math.max(hang * 0.85, patch * 0.8) * smoothstep(1.5, 4, this.h[i]);
      }
    }
    const fobH = Math.max(40, this.rawHeight(FOB_POS.x, FOB_POS.z));
    this.fob = { name: T.fobName, x: FOB_POS.x, z: FOB_POS.z, y: fobH, r: 230 };
    this.flatten(FOB_POS.x, FOB_POS.z, 240, 160, fobH, 'fob');

    // Trockene Landeplätze auf Hochfläche und Hängen
    const rng = this.rng;
    const names = SITE_NAMES.slice();
    let tries = 0;
    while (this.sites.length < 20 && tries++ < 9000) {
      const x = rng.range(-HALF + 380, HALF - 380), z = rng.range(-HALF + 380, HALF - 380);
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < 3000 || df > 5800) continue;
      const o2 = {};
      const h = this.rawHeight(x, z, o2);
      if (h < 3 || o2.river < 60) continue;
      let maxd = 0;
      for (const [dx, dz] of [[45, 0], [-45, 0], [0, 45], [0, -45]]) maxd = Math.max(maxd, Math.abs(this.rawHeight(x + dx, z + dz) - h));
      if (maxd > 24) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 520)) continue;
      this.sites.push({ name: names.splice(Math.floor(rng() * names.length), 1)[0], x, z, y: h, r: 42 });
      this.flatten(x, z, 44, 60, h, 'site');
    }
    this.addHardSites(['Kuppe Hahnenkamm', 'Eichkopf', 'Kalmusgipfel', 'Rabenkopf'], ['Uferhang Mühlbach', 'Steilufer Lindenau'], 190);
    this.addRidgeSites(['Weinbergterrasse', 'Felsband Lindenfels', 'Hangwiese Kreuzberg', 'Aussicht Rabenley'], [], 120);

    // Dörfer in der Talaue (überflutet)
    const vn = VILLAGE_NAMES.slice();
    for (let k = 0; k < 6; k++) {
      const z = -2750 + k * 640 + rng.range(-80, 80);
      if (dist2(this.riverX(z), z, FOB_POS.x, FOB_POS.z) < 2400) continue;
      const side = rng() < 0.5 ? -1 : 1;
      const x = this.riverX(z) + side * rng.range(70, 120);
      this.villages.push({ name: vn.shift(), x, z, y: WATER_FLOOR, big: k % 2 === 0, main: true });
    }
    for (let k = 0; k < 3; k++) {
      const x = this.riverX(this.tribZ(0)) + 650 + k * 750 + rng.range(-60, 60);
      if (x > HALF - 500) break;
      const z = this.tribZ(x) + rng.range(-40, 40);
      this.villages.push({ name: vn.shift(), x, z, y: WATER_FLOOR, big: k === 1, main: false });
    }
  }

  // Richtung des Tals (Einheitsvektor entlang des Gewässers)
  valleyDir(v) {
    if (v.main) { const dx = this.riverX(v.z + 10) - this.riverX(v.z - 10); const l = Math.hypot(dx, 20); return [dx / l, 20 / l]; }
    const dz = this.tribZ(v.x + 10) - this.tribZ(v.x - 10); const l = Math.hypot(20, dz); return [20 / l, dz / l];
  }

  // ------------------------------------------------------------ Farben
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    // Wiesen und Felder im Schachbrett
    const fx = Math.floor((x + Math.sin(z * 0.003) * 50) / 70), fz = Math.floor((z + Math.sin(x * 0.002) * 40) / 52);
    const k = ((fx * 7 + fz * 13) % 6 + 6) % 6;
    const fc = [[0.36, 0.5, 0.22], [0.42, 0.55, 0.25], [0.66, 0.6, 0.3], [0.5, 0.42, 0.28], [0.32, 0.46, 0.2], [0.55, 0.56, 0.3]][k];
    let r = fc[0] + n * 0.04, g = fc[1] + n * 0.04, b = fc[2];
    const f = this.forest[i];
    r = lerp(r, 0.13 + n * 0.03, f); g = lerp(g, 0.24 + n * 0.04, f); b = lerp(b, 0.12, f);
    const steep = smoothstep(0.8, 0.55, nY);
    r = lerp(r, 0.4, steep * 0.7); g = lerp(g, 0.38, steep * 0.7); b = lerp(b, 0.33, steep * 0.7);
    // Schlamm in der Aue
    const mud = smoothstep(3.0, 0.2, h);
    r = lerp(r, 0.42, mud); g = lerp(g, 0.36, mud); b = lerp(b, 0.25, mud);
    for (const fl of this.flats) {
      const d = Math.hypot(x - fl.x, z - fl.z);
      if (d > fl.r + 40) continue;
      const t = 1 - smoothstep(fl.r * 0.85, fl.r + 30, d);
      if (fl.kind === 'fob') { r = lerp(r, 0.4 + n * 0.04, t); g = lerp(g, 0.47 + n * 0.03, t); b = lerp(b, 0.28, t); }
      else { r = lerp(r, 0.4 + n * 0.05, t); g = lerp(g, 0.52 + n * 0.05, t); b = lerp(b, 0.26, t); }
    }
    return [r, g, b];
  }

  buildWater() {
    super.buildWater();
    // trübes Hochwasser, aber mit Glanz, damit es als Wasserfläche erkennbar bleibt
    this.water.material.color.set(0x968a6a);
    this.water.material.opacity = 0.9;
    this.water.material.specular.set(0x8a8a80);
    this.water.material.shininess = 90;
  }

  // ------------------------------------------------------------ Himmel und Regen
  buildSky() {
    super.buildSky();
    for (const c of this.clouds.children) {
      c.material.color.set(0xc4c9cd);
      c.position.y = 420 + (c.position.y - 850) * 0.5;
      c.scale.multiplyScalar(1.4);
    }
    if (!this.rainOn) return;   // Regen ist abgeschaltet
    const N = 2200;
    this.rainN = N;
    this.rainPos = new Float32Array(N * 6);
    this.rainDrop = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.rainDrop[i * 3] = (Math.random() - 0.5) * 90; this.rainDrop[i * 3 + 1] = (Math.random() - 0.5) * 60; this.rainDrop[i * 3 + 2] = (Math.random() - 0.5) * 90; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb4bcc6, transparent: true, opacity: 0.38, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  updateRain(dt, cam) {
    const d = this.rainDrop, p = this.rainPos;
    const vy = 26 * dt, wx = 2.5 * dt;
    for (let i = 0; i < this.rainN; i++) {
      let y = d[i * 3 + 1] - vy, x = d[i * 3] + wx;
      if (y < -30) { y += 60; x = (Math.random() - 0.5) * 90; d[i * 3 + 2] = (Math.random() - 0.5) * 90; }
      if (x > 45) x -= 90;
      d[i * 3] = x; d[i * 3 + 1] = y;
      const X = cam.x + x, Y = cam.y + y, Z = cam.z + d[i * 3 + 2];
      p.set([X, Y, Z, X - 0.12, Y + 1.1, Z], i * 6);
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, t, camera) {
    super.update(dt, t, camera);
    if (this.rain) this.updateRain(Math.min(dt, 0.05), camera.position);
  }

  // ------------------------------------------------------------ Einsatzbasis
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
    // Behandlungsplatz mit Zelten
    add(M.hospitalParts(), -64, -66, Math.PI);
    f.hospitalDoor = { x: f.x - 64, z: f.z - 56 };
    add(A.tentAfg(6, 10, 3.2, 0xd8d6cc), -92, -62, 0);
    add(A.tentAfg(6, 10, 3.2, 0xd8d6cc), -100, -40, 0);
    // Betankung
    add(A.fuelTruckAfg(), 88, -18, 0.1);
    f.truck = { x: f.x + 88, z: f.z - 18 };
    add(M.bladderParts(), 108, -48, 0.2);
    // Führungsstelle und Bereitstellungsraum von THW und Feuerwehr
    for (let i = 0; i < 3; i++) add(A.containerParts(0x8a9096), -14 + i * 3, -16, 0);
    for (let i = 0; i < 6; i++) add(F.truckParts(0x1f3f8a), 110 + (i % 3) * 5, 40 + Math.floor(i / 3) * 12, 0);
    for (let i = 0; i < 4; i++) add(F.truckParts(0xb3221c, 0xe8e2d0), -140 + i * 5, 30, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) add(A.tentAfg(6, 10, 3.2, 0x5d6650), -150 + c * 14, 70 + r * 20, 0);
    // Sandsack-Paletten
    for (let i = 0; i < 8; i++) add([M.P(new THREE.BoxGeometry(1.2, 1.0, 1.2), 0xc9b88a, [0, 0.5, 0])], 30 + (i % 4) * 2, -50 + Math.floor(i / 4) * 2, 0);
    this.fobMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
    this.fobMesh.castShadow = this.fobMesh.receiveShadow = true;
    this.scene.add(this.fobMesh);
    this.buildFlag(f.x + 12, f.z - 5, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 190, 34); x.fillStyle = '#dd0000'; x.fillRect(0, 33, 190, 34); x.fillStyle = '#ffce00'; x.fillRect(0, 66, 190, 34); });
    this.buildParked([[-46, 100, 0.3], [46, 100, -0.2]]);
    this.fobFigures = [];
    for (const [x, z] of [[5, -8], [-25, -5], [-30, 2], [48, -40], [-55, -46], [-70, -46], [110, 30], [-130, 20], [-5, 30], [20, 15]]) {
      const fig = new M.Figure(T.friend());
      fig.group.position.set(f.x + x, f.y, f.z + z);
      fig.group.rotation.y = this.rng() * Math.PI * 2;
      this.scene.add(fig.group);
      this.fobFigures.push(fig);
    }
  }

  // ------------------------------------------------------------ Dörfer, Brücken, Leitungen
  buildVillages() {
    const parts = [], rng = this.rng;
    this.houses = [];
    for (const v of this.villages) {
      const [ux, uz] = this.valleyDir(v);
      const px = -uz, pz = ux;               // quer zum Tal
      const len = v.big ? 200 : 130;
      const rot = Math.atan2(ux, uz);
      // Häuser in zwei Reihen beiderseits der Dorfstraße
      for (let s = -len / 2; s < len / 2; s += 15 + rng() * 5) {
        for (const side of [-1, 1]) {
          if (rng() < 0.12) continue;
          const off = side * (11 + rng() * 4);
          const x = v.x + ux * s + px * off, z = v.z + uz * s + pz * off;
          const hs = F.germanHouse(rng, v.big && rng() < 0.3);
          const g = this.height(x, z);
          parts.push(...M.placeParts(hs.parts, x, g - 0.1, z, rot + (side > 0 ? Math.PI : 0)));
          this.houses.push({ x, z, ground: g, ridge: g + hs.ridge, eave: g + hs.eave, r: Math.max(hs.w, hs.d) * 0.55, rot, village: v.name });
        }
      }
      // Zweite Häuserreihe hangseitig (zum Teil trocken)
      for (let s = -len / 3; s < len / 3; s += 18 + rng() * 6) {
        const off = (v.x < this.riverX(v.z) ? -1 : 1) * (40 + rng() * 25) * (v.main ? 1 : 0) || (rng() < 0.5 ? -1 : 1) * 40;
        const x = v.x + ux * s + px * off, z = v.z + uz * s + pz * off;
        const hs = F.germanHouse(rng);
        const g = this.height(x, z);
        if (g > 25) continue;
        parts.push(...M.placeParts(hs.parts, x, g - 0.1, z, rot + Math.PI / 2));
        this.houses.push({ x, z, ground: g, ridge: g + hs.ridge, eave: g + hs.eave, r: Math.max(hs.w, hs.d) * 0.55, rot, village: v.name });
      }
      if (v.big) {
        const c = F.churchParts();
        const x = v.x + px * -26, z = v.z + pz * -26;
        const g = this.height(x, z);
        parts.push(...M.placeParts(c.parts, x, g - 0.1, z, rot));
        this.houses.push({ x, z, ground: g, ridge: g + 31, eave: g + 9, r: 13, rot, village: v.name, church: true });
      }
      // Autos und Treibgut im Wasser
      for (let i = 0; i < (v.big ? 14 : 8); i++) {
        const s = rng.range(-len / 2, len / 2), off = rng.range(-30, 30);
        const x = v.x + ux * s + px * off, z = v.z + uz * s + pz * off;
        if (this.houses.some((h) => dist2(h.x, h.z, x, z) < h.r + 3)) continue;
        const list = rng() < 0.5 ? F.carParts(rng) : F.debrisParts(rng);
        const y = rng() < 0.5 ? -0.9 : this.height(x, z);
        parts.push(...M.placeParts(list, x, y, z, rng() * Math.PI * 2));
      }
      // Brücke über den Fluss (jede zweite ist eingestürzt)
      const bx = v.main ? this.riverX(v.z + 40) : v.x + 40, bz = v.main ? v.z + 40 : this.tribZ(v.x + 40);
      parts.push(...M.placeParts(F.bridgeParts(70, this.villages.indexOf(v) % 2 === 0), bx, -2, bz, rot + Math.PI / 2));
      v.compounds = this.houses.filter((h) => h.village === v.name);
    }
    this.buildPowerLines(parts);
    if (parts.length) {
      this.villageMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
      this.villageMesh.castShadow = this.villageMesh.receiveShadow = true;
      this.scene.add(this.villageMesh);
    }
  }

  // Hochspannungsleitungen quer über das Tal: Masten und durchhängende Seile (Kollisionsgefahr!)
  buildPowerLines(parts) {
    this.wires = [];
    const lines = [];
    for (const z0 of [-2200, -1000, 250]) lines.push({ x0: this.riverX(z0) - 750, z0: z0 - 120, x1: this.riverX(z0) + 750, z1: z0 + 120 });
    { const x = this.riverX(this.tribZ(0)) + 1100; lines.push({ x0: x - 60, z0: this.tribZ(x) - 650, x1: x + 60, z1: this.tribZ(x) + 650 }); }
    const cableGeo = [];
    for (const L of lines) {
      const len = Math.hypot(L.x1 - L.x0, L.z1 - L.z0), n = Math.max(2, Math.round(len / 330));
      const ux = (L.x1 - L.x0) / len, uz = (L.z1 - L.z0) / len;
      const rot = Math.atan2(-uz, ux) + Math.PI / 2;   // Traversen quer zur Leitung
      const towers = [];
      for (let i = 0; i <= n; i++) {
        const x = L.x0 + (L.x1 - L.x0) * (i / n), z = L.z0 + (L.z1 - L.z0) * (i / n);
        const y = Math.max(this.height(x, z), -1);
        parts.push(...M.placeParts(F.pylonParts(), x, y, z, rot));
        towers.push({ x, y, z });
      }
      for (let i = 0; i < towers.length - 1; i++) {
        const a = towers[i], b = towers[i + 1];
        for (const [ax, ay] of F.PYLON_ARMS) {
          // Querversatz der Traverse
          const ox = Math.cos(rot) * ax, oz = -Math.sin(rot) * ax;
          const pa = new THREE.Vector3(a.x + ox, a.y + ay - 1.4, a.z + oz), pb = new THREE.Vector3(b.x + ox, b.y + ay - 1.4, b.z + oz);
          const pts = [];
          const span = pa.distanceTo(pb), sag = span * 0.035;
          for (let k = 0; k <= 12; k++) {
            const t = k / 12;
            pts.push(new THREE.Vector3().lerpVectors(pa, pb, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
          }
          const curve = new THREE.CatmullRomCurve3(pts);
          cableGeo.push(M.P(new THREE.TubeGeometry(curve, 24, ay > 40 ? 0.08 : 0.06, 4, false), 0x2a2a2a));
          // Warnkugeln am Erdseil
          if (ay > 40) for (let k = 2; k < 12; k += 3) cableGeo.push(M.P(new THREE.SphereGeometry(0.45, 8, 6), 0xe0602a, [pts[k].x, pts[k].y - 0.2, pts[k].z]));
          const bb = { minX: Math.min(pa.x, pb.x) - 15, maxX: Math.max(pa.x, pb.x) + 15, minZ: Math.min(pa.z, pb.z) - 15, maxZ: Math.max(pa.z, pb.z) + 15 };
          this.wires.push({ pts, bb });
        }
      }
    }
    if (cableGeo.length) {
      const m = new THREE.Mesh(M.merge(cableGeo), M.vcMat);
      this.scene.add(m);
    }
  }

  // Kleinster Abstand eines Punkts zu einem Leiterseil (für Kollision und Warnung)
  wireDistance(p, maxD = 200) {
    let best = 1e9;
    for (const w of this.wires || []) {
      const b = w.bb;
      if (p.x < b.minX - maxD || p.x > b.maxX + maxD || p.z < b.minZ - maxD || p.z > b.maxZ + maxD) continue;
      for (let k = 0; k < w.pts.length - 1; k++) {
        const a = w.pts[k], c = w.pts[k + 1];
        const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z;
        const l2 = dx * dx + dy * dy + dz * dz;
        const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2, 0, 1);
        const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y, a.z + dz * t - p.z);
        if (d < best) best = d;
      }
    }
    return best;
  }

  // Rotor oder Rumpf in einem Gebäude?
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
      { geo: M.merge(F.spruceParts()), near: M.merge(F.spruceParts(true)), top: 19, r: 3.0, w: 0.55 },
      { geo: M.merge(F.beechParts()), near: M.merge(F.beechParts(true)), top: 14, r: 4.8, w: 0.45 },
      { geo: M.merge(F.beechParts()), top: 14, r: 4.8, w: 0.0 },
    ];
  }

  pickTreeType(x, z, tr) {
    const N = this.N;
    const ix = clamp(Math.round((x + HALF) / CELL), 0, N - 1), iz = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    const s = this.slope[iz * N + ix];
    return s > 0.2 && s < 0.85 ? (tr < 0.65 ? 0 : 1) : tr < 0.35 ? 0 : 1;
  }

  dustAt() { return 0; }
  coverAt() { return 0.1; }
  ambushSpot() { return false; }
}
